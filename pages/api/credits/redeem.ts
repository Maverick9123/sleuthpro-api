import type { NextApiRequest, NextApiResponse } from "next";
import { installId, grantCredits, balanceOf } from "../../../lib/entitlement";
import { verifyAppleTransaction } from "../../../lib/appleReceipts";
import { verifyGooglePurchase } from "../../../lib/googleReceipts";
import { rateGuard, clientIp } from "../../../lib/rateGuard";
import { Redis } from "@upstash/redis";

// Credits are granted HERE, server-side, against a purchase the platform
// signed - never on the app's say-so. Before this existed a pack bought on a
// phone lived only on that phone: a reinstall lost it, and a refunded purchase
// kept working forever.
//
// The pack sizes must match the apps. They are stated here because this is
// now the authority on what a purchase is worth.
const PACKS: Record<string, number> = {
  // iOS product ids
  "com.dreamteamapps.searchquest.credits10": 10,
  "com.dreamteamapps.searchquest.credits25": 25,
  "com.dreamteamapps.searchquest.credits60": 60,
  // Android product ids
  "searchquest_credits10": 10,
  "searchquest_credits25": 25,
  "searchquest_credits60": 60,
};

/**
 * LOG-ONLY MODE. With REDEEM_ENFORCE unset or "false", a failed verification
 * is logged and the credits are STILL granted. That is deliberate for the
 * first days of a release: it lets real purchases be watched verifying
 * correctly before verification becomes the thing standing between a paying
 * customer and what they bought. Turn it on once the logs are clean.
 */
const ENFORCE = (process.env.REDEEM_ENFORCE ?? "false") === "true";

const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

/** One grant per platform transaction, ever, across every install. */
async function claimOnce(key: string): Promise<boolean> {
  if (!redis) return true;
  try {
    const first = await redis.setnx(`redeemed:${key}`, Date.now());
    if (first) await redis.expire(`redeemed:${key}`, 60 * 60 * 24 * 400);
    return first === 1;
  } catch (err) {
    console.error("[redeem] KV error on claim:", err);
    return true; // a KV hiccup must not swallow a real purchase
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Cheap shield: redeeming is not a money-spending call, but it is a public
  // endpoint and should not be floodable.
  const guard = await rateGuard("redeem", clientIp(req.headers), 20, 5000);
  if (!guard.ok) {
    res.setHeader("Retry-After", String(guard.retryAfter));
    return res.status(429).json({ error: "Too many requests. Please try again shortly." });
  }

  const install = installId(req.headers);
  if (!install) return res.status(400).json({ error: "Missing install id." });

  const { platform, jws, originalJson, signature } = req.body as {
    platform?: string;
    jws?: string;             // iOS: VerificationResult.jwsRepresentation
    originalJson?: string;    // Android: Purchase.originalJson
    signature?: string;       // Android: Purchase.signature
  };

  let productId: string | null = null;
  let txnKey: string | null = null;
  let failure: string | null = null;

  if (platform === "ios") {
    const v = await verifyAppleTransaction(jws ?? "");
    if (v.ok) { productId = v.productId; txnKey = `ios:${v.transactionId}`; }
    else failure = v.reason;
  } else if (platform === "android") {
    const v = verifyGooglePurchase(originalJson ?? "", signature ?? "");
    if (v.ok) { productId = v.productId; txnKey = `android:${v.purchaseToken}`; }
    else failure = v.reason;
  } else {
    return res.status(400).json({ error: "Unknown platform." });
  }

  if (failure) {
    console.warn(`[redeem] verification FAILED (${failure}) install=${install} enforce=${ENFORCE}`);
    if (ENFORCE) return res.status(400).json({ error: "Purchase could not be verified.", code: failure });
    // Log-only: fall through using what the client claimed, so a verification
    // bug cannot cost a paying customer their credits during rollout.
    productId = (req.body as { productId?: string }).productId ?? null;
    txnKey = `unverified:${install}:${productId}:${Date.now()}`;
  }

  const credits = productId ? PACKS[productId] : undefined;
  if (!credits) {
    console.warn(`[redeem] unknown product '${productId}' install=${install}`);
    return res.status(400).json({ error: "Unknown product." });
  }

  if (!(await claimOnce(txnKey!))) {
    // Already granted. Not an error - the app retries, and StoreKit and Play
    // both re-deliver. Report the balance so the app stays in step.
    const bal = await balanceOf(install);
    return res.status(200).json({ ok: true, alreadyRedeemed: true, ...bal });
  }

  await grantCredits(install, credits);
  const bal = await balanceOf(install);
  console.log(`[redeem] +${credits} install=${install} product=${productId} verified=${!failure}`);
  return res.status(200).json({ ok: true, granted: credits, ...bal });
}
