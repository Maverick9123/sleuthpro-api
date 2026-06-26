// SleuthPro API — Email Search
// POST /api/search/email
// Body: { emailAddress }
// Returns: PersonData[]
// DreamTeamApps © 2026

import { NextRequest, NextResponse } from "next/server";
import { callMelissa } from "@/lib/melissa";
import { transformMelissaRecord } from "@/lib/transform";
import { EmailSearchRequest, PersonData } from "@/types/sleuthpro";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as EmailSearchRequest;

    if (!body.emailAddress?.trim()) {
      return NextResponse.json(
        { error: "emailAddress is required." },
        { status: 400 }
      );
    }

    const email = body.emailAddress.trim().toLowerCase();

    if (!email.includes("@") || !email.includes(".")) {
      return NextResponse.json(
        { error: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    const melissaRes = await callMelissa({ email });

    const results: PersonData[] = (melissaRes.Records ?? [])
      .map(transformMelissaRecord)
      .filter((r): r is PersonData => r !== null);

    return NextResponse.json(results, { status: 200 });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Search failed.";
    console.error("[/api/search/email]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}