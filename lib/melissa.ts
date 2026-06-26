// SleuthPro API — Melissa Data API Client
// Handles all communication with Melissa Personator Consumer API
// DreamTeamApps © 2026

import { MelissaResponse } from "@/types/sleuthpro";

const MELISSA_BASE_URL =
  "https://personator.melissadata.net/v3/WEB/ContactVerify/doContactVerify";

interface MelissaQueryParams {
  full?: string;
  a1?: string;
  city?: string;
  state?: string;
  postal?: string;
  phone?: string;
  email?: string;
}

export async function callMelissa(
  params: MelissaQueryParams
): Promise<MelissaResponse> {
  const licenseKey = process.env.MELISSA_LICENSE_KEY;

  if (!licenseKey) {
    throw new Error(
      "MELISSA_LICENSE_KEY environment variable is not configured."
    );
  }

  const query = new URLSearchParams({
    id: licenseKey,
    act: "Check,Verify,Append",
    ctry: "US",
    format: "JSON",
  });

  if (params.full)   query.set("full",   params.full.trim());
  if (params.a1)     query.set("a1",     params.a1.trim());
  if (params.city)   query.set("city",   params.city.trim());
  if (params.state)  query.set("state",  params.state.trim());
  if (params.postal) query.set("postal", params.postal.trim());
  if (params.phone)  query.set("phone",  params.phone.replace(/\D/g, ""));
  if (params.email)  query.set("email",  params.email.trim());

  const url = `${MELISSA_BASE_URL}?${query.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(
      `Melissa API returned HTTP ${response.status}: ${response.statusText}`
    );
  }

  const data = (await response.json()) as MelissaResponse;
  return data;
}