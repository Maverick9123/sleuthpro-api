// SleuthPro API — Phone Search
// POST /api/search/phone
// Body: { phoneNumber }
// Returns: PersonData[]
// DreamTeamApps © 2026

import { NextRequest, NextResponse } from "next/server";
import { callMelissa } from "@/lib/melissa";
import { transformMelissaRecord } from "@/lib/transform";
import { PhoneSearchRequest, PersonData } from "@/types/sleuthpro";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PhoneSearchRequest;

    if (!body.phoneNumber?.trim()) {
      return NextResponse.json(
        { error: "phoneNumber is required." },
        { status: 400 }
      );
    }

    const digits = body.phoneNumber.replace(/\D/g, "");

    if (digits.length < 10) {
      return NextResponse.json(
        { error: "Please provide a valid 10-digit US phone number." },
        { status: 400 }
      );
    }

    const melissaRes = await callMelissa({ phone: digits });

    const results: PersonData[] = (melissaRes.Records ?? [])
      .map(transformMelissaRecord)
      .filter((r): r is PersonData => r !== null);

    return NextResponse.json(results, { status: 200 });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Search failed.";
    console.error("[/api/search/phone]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}