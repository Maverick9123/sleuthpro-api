// SleuthPro API — Health Check
// GET /api/health
// DreamTeamApps © 2026

import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const melissaConfigured = !!process.env.MELISSA_LICENSE_KEY;

  res.status(200).json({
    status: "ok",
    service: "SleuthPro API",
    version: "1.0.0",
    melissa: melissaConfigured
      ? "configured"
      : "MISSING — set MELISSA_LICENSE_KEY env var",
    timestamp: new Date().toISOString(),
  });
}
