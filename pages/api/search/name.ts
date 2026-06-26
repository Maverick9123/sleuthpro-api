// SleuthPro API — Name Search
// POST /api/search/name
// DreamTeamApps © 2026

import type { NextApiRequest, NextApiResponse } from "next";
import { callMelissa } from "@/lib/melissa";
import { transformMelissaRecord } from "@/lib/transform";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { firstName, lastName, middleName, state } = req.body;

    if (!firstName || !lastName) {
      return res.status(400).json({ error: "firstName and lastName are required" });
    }

    const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ");
    const data = await callMelissa({ full: fullName, state });
    const results = data.Records.map(transformMelissaRecord);
    return res.status(200).json(results);
  } catch (err) {
    console.error("Name search error:", err);
    return res.status(500).json({ error: "Search failed" });
  }
}
