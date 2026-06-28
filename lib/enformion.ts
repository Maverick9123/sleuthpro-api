const ENFORMION_BASE =
  process.env.ENFORMION_API_BASE ?? "https://devapi.enformion.com";

export type EnformionSearchType =
  | "Person"
  | "Teaser"
  | "ReversePhonePerson"
  | "ReversePhonePersonTeaser";

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

export interface EnformionName {
  FirstName?:  string;
  MiddleName?: string;
  LastName?:   string;
}

export interface EnformionAddress {
  AddressLine1?:      string;
  City?:              string;
  State?:             string;
  Zip?:               string;
  Type?:              string;
  FirstReportedDate?: string;
  LastReportedDate?:  string;
}

export interface EnformionPhone {
  PhoneNumber?: string;
  PhoneType?:   string;
  Provider?:    string;
  IsPrimary?:   boolean;
}

export interface EnformionEmail {
  Email?: string;
}

export interface EnformionRelative {
  Name?:     EnformionName;
  Relation?: string;
  Age?:      number;
}

export interface EnformionProperty {
  PropertyType?:   string;
  OwnerOccupied?:  boolean;
  EstimatedValue?: string;
}

export interface EnformionPerson {
  Id?:         string;
  Names?:      EnformionName[];
  Age?:        number;
  Dob?:        string;
  Addresses?:  EnformionAddress[];
  Phones?:     EnformionPhone[];
  Emails?:     EnformionEmail[];
  Relatives?:  EnformionRelative[];
  Associates?: EnformionRelative[];
  Properties?: EnformionProperty[];
}

export interface EnformionResponse {
  People?:         EnformionPerson[];
  TotalCount?:     number;
  Page?:           number;
  ResultsPerPage?: number;
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
