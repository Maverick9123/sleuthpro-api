// SleuthPro API — Name Search
// POST /api/search/name
// DreamTeamApps © 2026

import type { NextApiRequest, NextApiResponse } from "next";
import { searchByName } from "@/lib/melissa";
import { transformMelissaRecord } from "@/lib/transform";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { firstName, lastName, middleName, state, gender } = req.body;

    if (!firstName || !lastName) {
      return res.status(400).json({ error: "firstName and lastName are required" });
    }

    const data = await searchByName({ firstName, middleName, lastName, state, gender });
    const results = data.Records.map(transformMelissaRecord);
    return res.status(200).json(results);
  } catch (err) {
    console.error("Name search error:", err);
    return res.status(500).json({ error: "Search failed" });
  }
}
