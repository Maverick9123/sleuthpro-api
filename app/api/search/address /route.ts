// SleuthPro API — Address Search
// POST /api/search/address
// Body: { street, city, state }
// Returns: PersonData[]
// DreamTeamApps © 2026

import { NextRequest, NextResponse } from "next/server";
import { callMelissa } from "@/lib/melissa";
import { transformMelissaRecord } from "@/lib/transform";
import { AddressSearchRequest, PersonData } from "@/types/sleuthpro";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AddressSearchRequest;

    if (!body.street?.trim()) {
      return NextResponse.json(
        { error: "street is required." },
        { status: 400 }
      );
    }

    const melissaRes = await callMelissa({
      a1:    body.street.trim(),
      city:  body.city?.trim()  || undefined,
      state: body.state?.trim() || undefined,
    });

    const results: PersonData[] = (melissaRes.Records ?? [])
      .map(transformMelissaRecord)
      .filter((r): r is PersonData => r !== null);

    return NextResponse.json(results, { status: 200 });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Search failed.";
    console.error("[/api/search/address]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}