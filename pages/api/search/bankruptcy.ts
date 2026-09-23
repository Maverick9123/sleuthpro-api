import type { NextApiRequest, NextApiResponse } from "next";
import {
  callEnformionBankruptcy,
  bankruptcyRecords,
  transformBankruptcy,
}                               from "../../../lib/enformionBankruptcy";
import type { BankruptcyData }  from "../../../lib/enformionBankruptcy";
import { rateGuard, clientIp }  from "../../../lib/rateGuard";
import { installId, spendLookup, refundLookup } from "../../../lib/entitlement";
import { toStateCode }          from "../../../lib/usStates";

// Bankruptcy Lookup — 6th Search Quest search type.
// Person name (+ optional state) → public bankruptcy court records via
// Enformion Debt Search V2 (DebtType=1). Public-record data only. Gated
// behind an FCRA attestation in the UI; personal, non-covered use only.
//
// DEBUG: POST { firstName, lastName, debug:true } to dump the raw Enformion
// response and confirm the field nesting, then remove the debug block.
// A `searchType` body field overrides the galaxy-search-type header (probe only).
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { firstName, lastName, state, debug, searchType } = req.body as {
    firstName?:  string;
    lastName?:   string;
    state?:      string;
    debug?:      boolean;
    searchType?: string;
  };

  if (!lastName?.trim()) {
    return res.status(400).json({ error: "Enter at least a last name to search." });
  }

  // Abuse guard — cap per-IP bursts and total daily calls (fail-open until KV set).
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
    const data = await callEnformionBankruptcy(
      {
        FirstName:      firstName?.trim() || undefined,
        LastName:       lastName.trim(),
        AddressLine2:   toStateCode(state) || undefined,
        Page:           1,
        ResultsPerPage: 10,
      },
      searchType?.trim() || "DebtV2"
    );

    // TEMP probe: raw dump to confirm the live response shape.
    if (debug) {
      return res.status(200).json({ _debug: true, raw: data });
    }

    const results: BankruptcyData[] = bankruptcyRecords(data)
      .map(transformBankruptcy)
      .filter((r): r is BankruptcyData => r !== null);

    // Bare array — matches the app's top-level decode of the other searches.
    return res.status(200).json(results);
  } catch (err) {
    console.error("[search/bankruptcy] EnformionGO error:", err);
    await refundLookup(install, ent.mode);   // never bill for a search we failed to deliver
    // TEMP: surface the upstream error to the caller during bring-up.
    if (debug) {
      return res
        .status(500)
        .json({ error: "Search failed.", _debug: err instanceof Error ? err.message : String(err) });
    }
    return res.status(500).json({ error: "Search failed. Please try again." });
  }
}
