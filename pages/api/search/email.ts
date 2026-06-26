// SleuthPro API — Email Search
// POST /api/search/email
// DreamTeamApps © 2026

import type { NextApiRequest, NextApiResponse } from "next";
import { callMelissa } from "@/lib/melissa";
import { transformMelissaRecord } from "@/lib/transform";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { emailAddress } = req.body;

    if (!emailAddress) {
      return res.status(400).json({ error: "emailAddress is required" });
    }

    const data = await callMelissa({ email: emailAddress });
    const results = data.Records.map(transformMelissaRecord);
    return res.status(200).json(results);
  } catch (err) {
    console.error("Email search error:", err);
    return res.status(500).json({ error: "Search failed" });
  }
}
