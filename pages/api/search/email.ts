import type { NextApiRequest, NextApiResponse } from "next";
import { callEnformion }            from "../../../lib/enformion";
import { transformEnformionRecord } from "../../../lib/transformEnformion";
import type { PersonData }          from "../../../lib/transformEnformion";
import { rateGuard, clientIp }     from "../../../lib/rateGuard";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // The shipped iOS app sends `emailAddress` (EmailSearchParams); accept
  // `email` too for direct/testing callers.
  const body = req.body as { emailAddress?: string; email?: string };
  const email = body.emailAddress ?? body.email;

  if (!email) {
    return res.status(400).json({ error: "email is required" });
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
        Email:          email.trim().toLowerCase(),
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
    console.error("[search/email] EnformionGO error:", err);
    return res.status(500).json({ error: "Search failed. Please try again." });
  }
}
