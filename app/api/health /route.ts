// SleuthPro API — Health Check
// GET /api/health — verifies the backend is running
// DreamTeamApps © 2026

import { NextResponse } from "next/server";

export async function GET() {
  const melissaConfigured = !!process.env.MELISSA_LICENSE_KEY;

  return NextResponse.json(
    {
      status:   "ok",
      service:  "SleuthPro API",
      version:  "1.0.0",
      melissa:  melissaConfigured
        ? "configured"
        : "MISSING — set MELISSA_LICENSE_KEY env var",
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}