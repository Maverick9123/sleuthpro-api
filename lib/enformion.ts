const ENFORMION_BASE =
  process.env.ENFORMION_API_BASE ?? "https://devapi.enformion.com";

export type EnformionSearchType =
  | "Person"
  | "Teaser"
  | "ReversePhonePerson"
  | "ReversePhonePersonTeaser";

// ── REQUEST ──────────────────────────────────────────────────────
// Enformion accepts PascalCase request fields (verified live: a
// PascalCase FirstName/LastName search returns results). Left as-is.
export interface EnformionRequestBody {
  FirstName?:      string;
  MiddleName?:     string;
  LastName?:       string;
  Addresses?: Array<{
    AddressLine1?: string;
    AddressLine2?: string;
    City?:         string;
    State?:        string;
    Zip?:          string;
  }>;
  Phone?:          string;
  Email?:          string;
  Dob?:            string;
  Includes?:       string[];
  FilterOptions?:  string[];
  Page?:           number;
  ResultsPerPage?: number;
}

// ── RESPONSE ─────────────────────────────────────────────────────
// The live Enformion response is camelCase (verified via a PII-safe
// structure dump on 2026-07-21). The previous PascalCase types here
// never matched, so every real search parsed to zero people.
export interface EnformionName {
  prefix?:     string;
  firstName?:  string;
  middleName?: string;
  lastName?:   string;
  suffix?:     string;
  rawNames?:   string[];
}

export interface EnformionAddress {
  houseNumber?:         string;
  streetPreDirection?:  string;
  streetName?:          string;
  streetPostDirection?: string;
  streetType?:          string;
  unit?:                string;
  city?:                string;
  state?:               string;
  county?:              string;
  zip?:                 string;
  zip4?:                string;
  firstReportedDate?:   string;
  lastReportedDate?:    string;
  fullAddress?:         string;
}

export interface EnformionPhone {
  phoneNumber?:       string;
  company?:           string;
  location?:          string;
  phoneType?:         string;
  isConnected?:       boolean;
  firstReportedDate?: string;
  lastReportedDate?:  string;
}

export interface EnformionEmail {
  emailAddress?: string;
  isPremium?:    boolean;
}

export interface EnformionRelative {
  firstName?:     string;
  middleName?:    string;
  lastName?:      string;
  relativeType?:  string;
  relativeLevel?: string;
}

export interface EnformionPerson {
  tahoeId?:           string;
  name?:              EnformionName;
  age?:               number;
  dob?:               string;
  akas?:              EnformionName[];
  locations?:         Array<{ city?: string; state?: string }>;
  addresses?:         EnformionAddress[];
  phoneNumbers?:      EnformionPhone[];
  emailAddresses?:    EnformionEmail[];
  relativesSummary?:  EnformionRelative[];
  associatesSummary?: EnformionRelative[];
  fullName?:          string;
}

export interface EnformionResponse {
  persons?: EnformionPerson[];
  pagination?: {
    currentPageNumber?: number;
    resultsPerPage?:    number;
    totalPages?:        number;
    totalResults?:      number;
  };
  isError?:   boolean;
  error?:     unknown;
  requestId?: string;
}

export async function callEnformion(
  body:       EnformionRequestBody,
  searchType: EnformionSearchType = "Person"
): Promise<EnformionResponse> {
  const apName     = process.env.ENFORMION_AP_NAME;
  const apPassword = process.env.ENFORMION_AP_PASSWORD;

  if (!apName || !apPassword) {
    throw new Error(
      "Missing EnformionGO credentials. " +
      "Set ENFORMION_AP_NAME and ENFORMION_AP_PASSWORD in Vercel environment variables."
    );
  }

  const response = await fetch(`${ENFORMION_BASE}/PersonSearch`, {
    method:  "POST",
    headers: {
      "Content-Type":       "application/json",
      "Accept":             "application/json",
      "galaxy-ap-name":     apName,
      "galaxy-ap-password": apPassword,
      "galaxy-search-type": searchType,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `EnformionGO API error ${response.status}: ${text || response.statusText}`
    );
  }

  const data: EnformionResponse = await response.json();
  return data;
}
