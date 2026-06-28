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

  const { street, city, state, zip } = req.body as {
    street?: string;
    city?:   string;
    state?:  string;
    zip?:    string;
  };

  if (!street) {
    return res.status(400).json({ error: "street is required" });
  }

  try {
    const data = await callEnformion(
      {
        Addresses: [
          {
            AddressLine1: street.trim(),
            City:         city?.trim(),
            State:        state?.trim(),
            Zip:          zip?.trim(),
          },
        ],
        Page:           1,
        ResultsPerPage: 10,
      },
      "Person"
    );

    const results: PersonData[] = (data.People ?? [])
      .map(transformEnformionRecord)
      .filter((r): r is PersonData => r !== null);

    return res.status(200).json({ results, totalCount: data.TotalCount ?? results.length });
  } catch (err) {
    console.error("[search/address] EnformionGO error:", err);
    return res.status(500).json({ error: "Search failed. Please try again." });
  }
}
