import type { NextApiRequest, NextApiResponse } from "next";
import {
  callEnformionProperty,
  propertyRecords,
  transformProperty,
}                              from "../../../lib/enformionProperty";
import type { PropertyData }   from "../../../lib/enformionProperty";
import { rateGuard, clientIp } from "../../../lib/rateGuard";
import { installId, spendLookup, refundLookup } from "../../../lib/entitlement";
import { toStateCode }         from "../../../lib/usStates";

// Property Lookup — 5th Search Quest search type.
// Address (or owner name) → owner, value, and sale history via Enformion
// PropertyV2Search. Public-record data only (FCRA-safe, same posture as the
// other four searches).
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { street, city, state, zip, firstName, lastName } = req.body as {
    street?:    string;
    city?:      string;
    state?:     string;
    zip?:       string;
    firstName?: string;
    lastName?:  string;
  };

  // Need EITHER an address (street) OR an owner name (last name) to search.
  const hasAddress = !!street?.trim();
  const hasName    = !!lastName?.trim();
  if (!hasAddress && !hasName) {
    return res
      .status(400)
      .json({ error: "Provide a street address or an owner's last name." });
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
    // "City, ST 12345" for AddressLine2.
    const addrLine2 = [city?.trim(), toStateCode(state), zip?.trim()]
      .filter(Boolean)
      .join(", ")
      .replace(/, (\S+)$/, " $1");

    const data = await callEnformionProperty({
      ...(hasAddress
        ? { AddressLine1: street!.trim(), AddressLine2: addrLine2 || undefined }
        : {}),
      ...(hasName
        ? { FirstName: firstName?.trim(), LastName: lastName!.trim() }
        : {}),
      Page:           1,
      ResultsPerPage: 10,
    });

    const results: PropertyData[] = propertyRecords(data)
      .map(transformProperty)
      .filter((r): r is PropertyData => r !== null);

    // Bare array — matches the app's top-level decode of the other searches.
    return res.status(200).json(results);
  } catch (err) {
    console.error("[search/property] EnformionGO error:", err);
    await refundLookup(install, ent.mode);   // never bill for a search we failed to deliver
    return res.status(500).json({ error: "Search failed. Please try again." });
  }
}
