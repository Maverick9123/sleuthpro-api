// SleuthPro API — Address Search
// POST /api/search/address
// DreamTeamApps © 2026

import type { NextApiRequest, NextApiResponse } from "next";
import { searchByAddress } from "@/lib/melissa";
import { transformMelissaRecord } from "@/lib/transform";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { street, city, state } = req.body;

    if (!street || !city || !state) {
      return res.status(400).json({ error: "street, city, and state are required" });
    }

    const data = await searchByAddress({ street, city, state });
    const results = data.Records.map(transformMelissaRecord);
    return res.status(200).json(results);
  } catch (err) {
    console.error("Address search error:", err);
    return res.status(500).json({ error: "Search failed" });
  }
}
