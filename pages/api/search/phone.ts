import type { NextApiRequest, NextApiResponse } from "next";
import { callEnformion }            from "../../../lib/enformion";
import { transformEnformionRecord } from "../../../lib/transformEnformion";
import type { PersonData }          from "../../../lib/transformEnformion";
import { rateGuard, clientIp }     from "../../../lib/rateGuard";
import { installId, spendLookup, refundLookup } from "../../../lib/entitlement";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { phoneNumber } = req.body as { phoneNumber?: string };

  if (!phoneNumber) {
    return res.status(400).json({ error: "phoneNumber is required" });
  }

  const digits = phoneNumber.replace(/\D/g, "");

  if (digits.length < 10) {
    return res.status(400).json({ error: "phoneNumber must contain at least 10 digits" });
  }


  // Abuse guard: cap per-IP bursts and total daily calls so nobody can run up
  // the Enformion bill. Fail-open — no effect until Vercel KV is connected.
  const guard = await rateGuard(
    "searchquest",
    clientIp(req.headers),
    Number(process.env.SEARCH_IP_PER_MIN ?? 10),
    Number(process.env.SEARCH_GLOBAL_PER_DAY ?? 400)
  );
  if (!guard.ok) {
    res.setHeader("Retry-After", String(guard.retryAfter));
    return res.status(429).json({
      error:
        guard.reason === "global"
          ? "Search is temporarily unavailable due to heavy use. Please try again later."
          : "Too many searches in a short time. Please wait a moment and try again.",
    });
  }

  // Per-install entitlement. rateGuard above stops floods and bankruptcy; it
  // cannot see a user who quietly burns their free lookups and leaves, because
  // it only knows an IP. This does, and it must sit BEFORE the paid call.
  const install = installId(req.headers);
  const ent = await spendLookup(install);
  if (!ent.ok) {
    return res.status(402).json({
      error:
        ent.reason === "id_required"
          ? "Please update the app to keep searching."
          : "You're out of lookups. Buy more credits to keep searching.",
      code: ent.reason,
      remaining: 0,
    });
  }

  try {
    // Use the "Person" search type (which this Access Profile IS entitled to)
    // with the phone as a search field, rather than the separate
    // "ReversePhonePerson" product the profile is NOT provisioned for.
    const data = await callEnformion(
      {
        Phone:          digits,
        Page:           1,
        ResultsPerPage: 10,
      },
      "Person"
    );

    const results: PersonData[] = (data.persons ?? [])
      .map(transformEnformionRecord)
      .filter((r): r is PersonData => r !== null);

    // Bare array — the shipped iOS app decodes `[PersonData]` at the top level.
    return res.status(200).json(results);
  } catch (err) {
    console.error("[search/phone] EnformionGO error:", err);
    await refundLookup(install, ent.mode);   // never bill for a search we failed to deliver
    return res.status(500).json({ error: "Search failed. Please try again." });
  }
}
