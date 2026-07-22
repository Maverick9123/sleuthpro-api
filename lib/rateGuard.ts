// Rate-limit / abuse guard for money-spending endpoints.
//
// Two layers, backed by a shared Vercel KV (Upstash Redis) counter:
//   1. Per-IP per-minute limit — stops a single scripted attacker (the "flag").
//   2. Global per-day cap      — a wallet kill-switch: once total calls for the
//      day cross the ceiling, the endpoint stops calling the paid API and
//      returns 429 (the "trap"). Every trip is logged so abuse is visible.
//
// FAIL-OPEN by design: if the KV store isn't configured yet (env vars absent)
// or KV ever errors, real users are NEVER blocked. Protection simply switches
// on the moment the store is connected — deploying this code can't break a
// live endpoint.

import { Redis } from "@upstash/redis";

// Vercel KV injects KV_REST_API_*; a native Upstash integration injects
// UPSTASH_REDIS_REST_*. Accept either so provisioning "just works".
const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

export type GuardResult =
  | { ok: true }
  | { ok: false; reason: "ip" | "global"; retryAfter: number };

/**
 * @param name         logical endpoint name (namespaces the counters)
 * @param ip           client IP (see clientIp)
 * @param perIpPerMin  max requests one IP may make per minute
 * @param globalPerDay max requests across ALL callers per day (the money cap)
 */
export async function rateGuard(
  name: string,
  ip: string,
  perIpPerMin: number,
  globalPerDay: number
): Promise<GuardResult> {
  if (!redis) return { ok: true }; // fail open until KV is provisioned

  try {
    const now = Date.now();
    const minute = Math.floor(now / 60_000);
    const day = Math.floor(now / 86_400_000);

    // Layer 1 — per-IP per-minute (stop one flooder before it touches the day cap)
    const ipKey = `rl:${name}:ip:${ip}:${minute}`;
    const ipCount = await redis.incr(ipKey);
    if (ipCount === 1) await redis.expire(ipKey, 120);
    if (ipCount > perIpPerMin) {
      console.warn(`[rateGuard] per-IP limit — ${name} ip=${ip} ${ipCount}/${perIpPerMin} per min`);
      return { ok: false, reason: "ip", retryAfter: 60 };
    }

    // Layer 2 — global daily cap (the wallet trap)
    const dayKey = `rl:${name}:global:${day}`;
    const dayCount = await redis.incr(dayKey);
    if (dayCount === 1) await redis.expire(dayKey, 172_800);
    if (dayCount > globalPerDay) {
      console.warn(`[rateGuard] GLOBAL DAILY CAP TRIPPED — ${name} ${dayCount}/${globalPerDay} — paid API paused for the day`);
      return { ok: false, reason: "global", retryAfter: 3600 };
    }

    return { ok: true };
  } catch (err) {
    console.error(`[rateGuard] KV error for ${name}, failing open:`, err);
    return { ok: true }; // never block real users on an infra hiccup
  }
}

/** Best-effort client IP from request headers (App Router Headers OR Pages req.headers). */
export function clientIp(
  headers: Headers | Record<string, string | string[] | undefined>
): string {
  const get = (k: string): string | null => {
    const anyH = headers as any;
    if (typeof anyH.get === "function") return anyH.get(k);
    const v = anyH[k];
    return Array.isArray(v) ? v[0] : (v ?? null);
  };
  const xff = get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return get("x-real-ip") || "unknown";
}
