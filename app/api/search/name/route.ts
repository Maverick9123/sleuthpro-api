// SleuthPro API — Name Search
// POST /api/search/name
// Body: { firstName, middleName?, lastName, state?, gender? }
// Returns: PersonData[]
// DreamTeamApps © 2026

import { NextRequest, NextResponse } from "next/server";
import { callMelissa } from "@/lib/melissa";
import { transformMelissaRecord } from "@/lib/transform";
import { NameSearchRequest, PersonData } from "@/types/sleuthpro";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as NameSearchRequest;

    if (!body.firstName?.trim() || !body.lastName?.trim()) {
      return NextResponse.json(
        { error: "firstName and lastName are required." },
        { status: 400 }
      );
    }

    const nameParts = [
      body.firstName.trim(),
      body.middleName?.trim() ?? "",
      body.lastName.trim(),
    ].filter(Boolean);
    const fullName = nameParts.join(" ");

    const melissaRes = await callMelissa({
      full:  fullName,
      state: body.state?.trim() || undefined,
    });

    const results: PersonData[] = (melissaRes.Records ?? [])
      .map(transformMelissaRecord)
      .filter((r): r is PersonData => r !== null);

    return NextResponse.json(results, { status: 200 });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Search failed.";
    console.error("[/api/search/name]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}