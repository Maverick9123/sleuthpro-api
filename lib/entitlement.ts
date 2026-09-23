// Per-install entitlement — the layer rateGuard cannot provide.
//
// rateGuard stops a flooder (per-IP per-minute) and stops bankruptcy (global
// per-day). Neither sees the behaviour that actually costs money: someone
// installs, runs five lookups over two weeks, gets the job done, and leaves.
// They never flood, and five calls barely move the daily total — so they pass
// both layers untouched.
//
// The reason is simple: the server cannot tell callers apart. It has an IP,
// and mobile IPs are shared by carrier NAT and rotate between wifi and
// cellular. So this adds the missing thing — a stable per-INSTALL identity the
// client supplies, metered server-side where the phone cannot edit it.
//
// ROLLOUT SAFETY. Every currently shipped client sends no install id. If this
// rejected anonymous callers on day one it would break every existing user,
// including paying ones. So:
//
//   • no id  -> allowed, and counted as anonymous (existing behaviour)
//   • an id  -> metered and enforced
//
// Deploying this therefore changes nothing until updated clients ship. Once
// adoption is high, set REQUIRE_INSTALL_ID=true to close the anonymous door.
//
// FAIL-OPEN, like rateGuard: a KV outage must never block paying users. The
// global day cap is still there as the backstop if that is ever exploited.

import { Redis } from "@upstash/redis";

const url   = process.env.KV_REST_API_URL   ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

/** Free lookups per install, ever. Matches the clients' own free grant. */
const FREE_LOOKUPS = Number(process.env.FREE_LOOKUPS ?? 2);

/** Flip to "true" once updated clients are widely adopted. */
const REQUIRE_ID = (process.env.REQUIRE_INSTALL_ID ?? "false") === "true";

/** Keep ids sane: opaque, bounded, no key-injection via colons. */
const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

export type Entitlement =
  | { ok: true;  mode: "anonymous" | "free" | "credit"; remaining?: number }
  | { ok: false; reason: "exhausted" | "id_required"; remaining: 0 };

export function installId(
  headers: Headers | Record<string, string | string[] | undefined>
): string | null {
  const anyH = headers as any;
  const raw =
    typeof anyH.get === "function"
      ? anyH.get("x-install-id")
      : (Array.isArray(anyH["x-install-id"]) ? anyH["x-install-id"][0] : anyH["x-install-id"]);
  if (!raw) return null;
  const id = String(raw).trim();
  return ID_RE.test(id) ? id : null;
}

/**
 * Spend one lookup for this install. Call AFTER rateGuard and BEFORE the paid
 * API — a call that is refused here must never reach Enformion.
 *
 * Spends purchased credits first, then the free allowance.
 */
export async function spendLookup(id: string | null): Promise<Entitlement> {
  if (!id) {
    if (REQUIRE_ID) return { ok: false, reason: "id_required", remaining: 0 };
    return { ok: true, mode: "anonymous" };
  }
  if (!redis) return { ok: true, mode: "anonymous" };   // fail open until KV exists

  try {
    const kCredits = `ent:${id}:credits`;
    const kUsed    = `ent:${id}:used`;
    const kSeen    = `ent:${id}:first`;

    await redis.setnx(kSeen, Date.now());               // telemetry: first sighting

    // 1) purchased credits. DECR is atomic; if it takes us negative we put it
    //    back. The window is tiny and self-correcting, which beats a Lua script
    //    for something this simple.
    const left = await redis.decr(kCredits);
    if (left >= 0) return { ok: true, mode: "credit", remaining: left };
    await redis.incr(kCredits);                          // undo — none were left

    // 2) free allowance, counted for the lifetime of the install
    const used = await redis.incr(kUsed);
    if (used <= FREE_LOOKUPS) {
      return { ok: true, mode: "free", remaining: FREE_LOOKUPS - used };
    }
    await redis.decr(kUsed);                             // do not inflate past the cap
    console.warn(`[entitlement] exhausted — install=${id} free=${FREE_LOOKUPS}`);
    return { ok: false, reason: "exhausted", remaining: 0 };
  } catch (err) {
    console.error("[entitlement] KV error, failing open:", err);
    return { ok: true, mode: "anonymous" };
  }
}

/**
 * Give back a lookup that was spent but never delivered.
 *
 * The credit is taken BEFORE the paid API is called, because a refused call
 * must never reach Enformion. The cost of that ordering is that a failure at
 * the provider would otherwise bill the user for nothing - which is precisely
 * the kind of thing that generates support mail and one-star reviews. So every
 * endpoint refunds on its error path.
 *
 * Refunding is deliberately best-effort and never throws: a failed refund must
 * not turn one bad search into a 500.
 */
export async function refundLookup(
  id: string | null,
  mode: "anonymous" | "free" | "credit"
): Promise<void> {
  if (!redis || !id || mode === "anonymous") return;
  try {
    if (mode === "credit") await redis.incr(`ent:${id}:credits`);
    else                   await redis.decr(`ent:${id}:used`);
  } catch (err) {
    console.error("[entitlement] refund failed:", err);
  }
}

/** Credits currently available to an install (for the app to mirror). */
export async function balanceOf(id: string): Promise<{ credits: number; freeLeft: number }> {
  if (!redis) return { credits: 0, freeLeft: FREE_LOOKUPS };
  try {
    const [c, u] = await Promise.all([
      redis.get<number>(`ent:${id}:credits`),
      redis.get<number>(`ent:${id}:used`),
    ]);
    return {
      credits: Math.max(0, Number(c ?? 0)),
      freeLeft: Math.max(0, FREE_LOOKUPS - Number(u ?? 0)),
    };
  } catch {
    return { credits: 0, freeLeft: 0 };
  }
}

/**
 * Add credits to an install. PHASE 2 will call this only after validating a
 * purchase token with Apple or Google — it must never be reachable from an
 * unauthenticated route, or the leak simply moves here.
 */
export async function grantCredits(id: string, credits: number): Promise<number> {
  if (!redis || credits <= 0) return 0;
  return await redis.incrby(`ent:${id}:credits`, credits);
}
