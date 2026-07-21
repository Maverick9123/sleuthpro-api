// TEMPORARY DEBUG — remove before anything else ships.
// Shows what Enformion ACTUALLY replies with the live Vercel credentials,
// WITHOUT leaking any person PII (returns only counts, structure, and any
// account/error metadata). Purpose: distinguish "account not entitled to data"
// from "genuinely no match."
import type { NextApiRequest, NextApiResponse } from "next";

const ENFORMION_BASE =
  process.env.ENFORMION_API_BASE ?? "https://devapi.enformion.com";

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const apName     = process.env.ENFORMION_AP_NAME;
  const apPassword = process.env.ENFORMION_AP_PASSWORD;

  const credsPresent = {
    ENFORMION_API_BASE: ENFORMION_BASE,
    ENFORMION_AP_NAME_present: !!apName,
    ENFORMION_AP_PASSWORD_present: !!apPassword,
    ENFORMION_AP_NAME_length: apName?.length ?? 0,
  };

  if (!apName || !apPassword) {
    return res.status(200).json({ credsPresent, note: "Missing credentials in Vercel env." });
  }

  try {
    const resp = await fetch(`${ENFORMION_BASE}/PersonSearch`, {
      method: "POST",
      headers: {
        "Content-Type":       "application/json",
        "Accept":             "application/json",
        "galaxy-ap-name":     apName,
        "galaxy-ap-password": apPassword,
        "galaxy-search-type": "Person",
      },
      // Common name, no state — if the account has data at all, this returns people.
      body: JSON.stringify({ FirstName: "Michael", LastName: "Johnson", Page: 1, ResultsPerPage: 5 }),
    });

    const rawText = await resp.text();
    let data: any = null;
    try { data = JSON.parse(rawText); } catch { /* leave null */ }

    // PII-safe recursive shape: keys + types only, values discarded.
    const shape = (v: any, depth = 0): any => {
      if (v === null) return "null";
      if (Array.isArray(v)) return v.length ? [shape(v[0], depth + 1)] : "[]";
      if (typeof v === "object") {
        if (depth > 5) return "object";
        const o: any = {};
        for (const k of Object.keys(v)) o[k] = shape(v[k], depth + 1);
        return o;
      }
      return typeof v; // "string" | "number" | "boolean"
    };

    // PII-safe summary only.
    const people = data?.persons ?? data?.People ?? data?.results ?? [];
    const summary = {
      httpStatus: resp.status,
      httpOk: resp.ok,
      topLevelKeys: data && typeof data === "object" ? Object.keys(data) : null,
      isError: data?.isError ?? data?.IsError ?? null,
      error:   data?.error ?? data?.Error ?? null,
      message: data?.message ?? data?.Message ?? null,
      requestId: data?.requestId ?? data?.RequestId ?? null,
      pagination: data?.pagination ?? data?.Pagination ?? null,
      totalCount: data?.totalCount ?? data?.TotalCount ?? null,
      peopleCount: Array.isArray(people) ? people.length : "not-an-array",
      firstPersonShape:
        Array.isArray(people) && people[0] && typeof people[0] === "object"
          ? shape(people[0]) // nested keys + types, NO values
          : null,
    };

    return res.status(200).json({ credsPresent, summary });
  } catch (err: any) {
    return res.status(200).json({ credsPresent, fetchError: err?.message ?? String(err) });
  }
}
