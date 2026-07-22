import type { NextApiRequest, NextApiResponse } from "next";
import { callEnformion }            from "../../../lib/enformion";
import { transformEnformionRecord } from "../../../lib/transformEnformion";
import type { PersonData }          from "../../../lib/transformEnformion";
import { rateGuard, clientIp }     from "../../../lib/rateGuard";
import { toStateCode }              from "../../../lib/usStates";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { firstName, lastName, middleName, state, city } = req.body as {
    firstName?:  string;
    lastName?:   string;
    middleName?: string;
    state?:      string;
    city?:       string;
  };

  if (!firstName || !lastName) {
    return res.status(400).json({ error: "firstName and lastName are required" });
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
    const data = await callEnformion(
      {
        FirstName:  firstName.trim(),
        LastName:   lastName.trim(),
        MiddleName: middleName?.trim(),
        Addresses:  state || city
          ? [{ City: city?.trim(), State: toStateCode(state) }]
          : undefined,
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
    console.error("[search/name] EnformionGO error:", err);
    return res.status(500).json({ error: "Search failed. Please try again." });
  }
}
