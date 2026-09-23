// Google Play purchase verification.
//
// Play Billing hands the app a purchase as `originalJson` plus a `signature`
// that Google produced with the app's private key. The matching RSA public key
// is in Play Console under Monetise > Monetisation setup > Licensing. Verify
// the signature against that key and the JSON can be trusted.
//
// WHY NOT THE PLAY DEVELOPER API. That needs a service-account JSON, an
// enabled API and a linked project. Signature verification needs one public
// key in an env var. The Developer API is still the right tool later for
// refund and void checks, which signature verification cannot see.

import { createVerify } from "crypto";

export type VerifiedPurchase = {
  ok: true;
  productId: string;
  purchaseToken: string;
  orderId: string | null;
} | {
  ok: false;
  reason: string;
};

/**
 * Base64 RSA public key from Play Console, in GOOGLE_PLAY_PUBLIC_KEY.
 * Absent means every redeem is refused - failing open here would hand credits
 * to anyone who can POST.
 */
function publicKeyPem(): string | null {
  const b64 = (process.env.GOOGLE_PLAY_PUBLIC_KEY ?? "").replace(/\s+/g, "");
  if (!b64) return null;
  const lines = b64.match(/.{1,64}/g)?.join("\n") ?? b64;
  return `-----BEGIN PUBLIC KEY-----\n${lines}\n-----END PUBLIC KEY-----\n`;
}

export function verifyGooglePurchase(
  originalJson: string,
  signature: string
): VerifiedPurchase {
  if (!originalJson || !signature) return { ok: false, reason: "missing_fields" };

  const pem = publicKeyPem();
  if (!pem) {
    console.error("[google] GOOGLE_PLAY_PUBLIC_KEY not set — refusing to verify");
    return { ok: false, reason: "verifier_unconfigured" };
  }

  let valid = false;
  try {
    // Play signs the EXACT originalJson bytes. Re-serialising the parsed
    // object would change key order or spacing and break the signature, so
    // the raw string is what gets verified.
    valid = createVerify("RSA-SHA1")
      .update(originalJson, "utf8")
      .verify(pem, signature, "base64");
  } catch (err) {
    console.error("[google] signature check threw:", err);
    return { ok: false, reason: "verify_error" };
  }
  if (!valid) return { ok: false, reason: "signature_invalid" };

  try {
    const p = JSON.parse(originalJson) as {
      productId?: string;
      purchaseToken?: string;
      orderId?: string;
      purchaseState?: number;
    };
    if (!p.productId || !p.purchaseToken) {
      return { ok: false, reason: "payload_incomplete" };
    }
    // purchaseState 0 = purchased. 1 = cancelled, 2 = pending.
    if (p.purchaseState !== undefined && p.purchaseState !== 0) {
      return { ok: false, reason: `purchase_state_${p.purchaseState}` };
    }
    return {
      ok: true,
      productId: p.productId,
      purchaseToken: p.purchaseToken,
      orderId: p.orderId ?? null,
    };
  } catch {
    return { ok: false, reason: "json_unparseable" };
  }
}
