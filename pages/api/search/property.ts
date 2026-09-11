import type { NextApiRequest, NextApiResponse } from "next";
import {
  callEnformionProperty,
  propertyRecords,
  transformProperty,
}                              from "../../../lib/enformionProperty";
import type { PropertyData }   from "../../../lib/enformionProperty";
import { rateGuard, clientIp } from "../../../lib/rateGuard";
import { toStateCode }         from "../../../lib/usStates";

// Property Lookup — 5th Search Quest search type.
// Address → owner, value, sale history via Enformion PropertyV2Search.
// Public-record data only (FCRA-safe, same posture as the other four searches).
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { street, city, state, zip, firstName, lastName, debug } = req.body as {
    street?:    string;
    city?:      string;
    state?:     string;
    zip?:       string;
    firstName?: string;
    lastName?:  string;
    debug?:     boolean;
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

  try {
    // Build the request from whichever inputs we got.
    const addrLine2 = [city?.trim(), toStateCode(state), zip?.trim()]
      .filter(Boolean)
      .join(", ")
      .replace(/, (\S+)$/, " $1"); // "City, ST 12345"

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

    // Debug toggle: surface the raw Enformion payload so we can confirm the
    // exact field nesting/casing against a real response. Never sent to the app.
    if (debug) {
      return res.status(200).json({
        _debug:   true,
        rawKeys:  Object.keys(data),
        recordCount: propertyRecords(data).length,
        raw:      data,
      });
    }

    const results: PropertyData[] = propertyRecords(data)
      .map(transformProperty)
      .filter((r): r is PropertyData => r !== null);

    // Bare array — matches the app's top-level decode of the other searches.
    return res.status(200).json(results);
  } catch (err) {
    console.error("[search/property] EnformionGO error:", err);
    // Debug-only: surface the upstream error message (carries Enformion's
    // HTTP status + body) so we can confirm entitlement/endpoint. Removed
    // before release along with the rest of the debug path.
    if (debug) {
      return res
        .status(500)
        .json({ _debug: true, error: err instanceof Error ? err.message : String(err) });
    }
    return res.status(500).json({ error: "Search failed. Please try again." });
  }
}
