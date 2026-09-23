// Apple purchase verification.
//
// StoreKit 2 hands the app a transaction signed by Apple as a JWS. The app
// forwards that JWS verbatim; this verifies Apple's signature and reads the
// payload. Nothing the app *claims* is trusted - only what Apple signed.
//
// WHY NOT THE APP STORE SERVER API. That route needs a .p8 key, key id and
// issuer id provisioned in App Store Connect. Verifying the JWS the app
// already holds needs no credentials at all, which means one less secret to
// rotate and one less thing to get wrong. The App Store Server API is still
// the right tool for refund/revocation checks later.
//
// The signature chain is validated by Apple's own library rather than by hand:
// x5c chain validation is precisely the kind of code that looks right and is
// subtly, silently wrong.

import { SignedDataVerifier, Environment } from "@apple/app-store-server-library";

export type VerifiedPurchase = {
  ok: true;
  productId: string;
  transactionId: string;
  originalTransactionId: string;
  environment: "Sandbox" | "Production";
} | {
  ok: false;
  reason: string;
};

const BUNDLE_ID = process.env.APPLE_BUNDLE_ID ?? "com.dreamteamapps.searchquest";

/**
 * Apple root certificates, base64 DER, newline-separated, in
 * APPLE_ROOT_CERTS. Without them nothing can be verified and every redeem is
 * refused - deliberately. Failing OPEN here would mean handing out credits to
 * anyone who can POST, which is worse than refusing a real purchase (that we
 * can fix by hand; the other we would never even see).
 */
function rootCerts(): Buffer[] {
  const raw = process.env.APPLE_ROOT_CERTS ?? "";
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((b64) => Buffer.from(b64, "base64"));
}

let verifierProd: SignedDataVerifier | null = null;
let verifierSandbox: SignedDataVerifier | null = null;

function verifier(env: Environment): SignedDataVerifier | null {
  const certs = rootCerts();
  if (certs.length === 0) return null;
  const cached = env === Environment.PRODUCTION ? verifierProd : verifierSandbox;
  if (cached) return cached;
  const made = new SignedDataVerifier(certs, true, env, BUNDLE_ID);
  if (env === Environment.PRODUCTION) verifierProd = made;
  else verifierSandbox = made;
  return made;
}

/**
 * Verify a StoreKit 2 signed transaction.
 *
 * Production is tried first, then Sandbox. Both must be accepted: a TestFlight
 * build and an App Review device both produce Sandbox transactions, and
 * refusing those is how a release gets rejected for "in-app purchase did not
 * work" when it works perfectly in the store.
 */
export async function verifyAppleTransaction(jws: string): Promise<VerifiedPurchase> {
  if (!jws || typeof jws !== "string") {
    return { ok: false, reason: "missing_jws" };
  }
  if (rootCerts().length === 0) {
    console.error("[apple] APPLE_ROOT_CERTS not set — refusing to verify");
    return { ok: false, reason: "verifier_unconfigured" };
  }

  for (const env of [Environment.PRODUCTION, Environment.SANDBOX] as const) {
    const v = verifier(env);
    if (!v) continue;
    try {
      const payload = await v.verifyAndDecodeTransaction(jws);
      const productId = payload.productId;
      const transactionId = payload.transactionId;
      if (!productId || !transactionId) {
        return { ok: false, reason: "payload_incomplete" };
      }
      return {
        ok: true,
        productId,
        transactionId,
        originalTransactionId: payload.originalTransactionId ?? transactionId,
        environment: env === Environment.PRODUCTION ? "Production" : "Sandbox",
      };
    } catch {
      // Wrong environment for this transaction — try the other one.
    }
  }
  return { ok: false, reason: "signature_invalid" };
}
