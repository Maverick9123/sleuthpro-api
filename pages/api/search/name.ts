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

  try {
    const data = await callEnformion(
      {
        FirstName:  firstName.trim(),
        LastName:   lastName.trim(),
        MiddleName: middleName?.trim(),
        Addresses:  state || city
          ? [{ City: city?.trim(), State: state?.trim() }]
          : undefined,
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
    console.error("[search/name] EnformionGO error:", err);
    return res.status(500).json({ error: "Search failed. Please try again." });
  }
}
