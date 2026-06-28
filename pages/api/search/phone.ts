import type { NextApiRequest, NextApiResponse } from "next";
import { callEnformion }            from "../../../lib/enformion";
import { transformEnformionRecord } from "../../../lib/transformEnformion";
import type { PersonData }          from "../../../lib/transformEnformion";

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

  try {
    const data = await callEnformion(
      {
        Phone:          digits,
        Page:           1,
        ResultsPerPage: 10,
      },
      "ReversePhonePerson"
    );

    const results: PersonData[] = (data.People ?? [])
      .map(transformEnformionRecord)
      .filter((r): r is PersonData => r !== null);

    return res.status(200).json({ results, totalCount: data.TotalCount ?? results.length });
  } catch (err) {
    console.error("[search/phone] EnformionGO error:", err);
    return res.status(500).json({ error: "Search failed. Please try again." });
  }
}
