import type { EnformionPerson, EnformionName } from "./enformion";

// ────────────────────────────────────────────────────────────────
// IMPORTANT: This shape must match the SHIPPED iOS app's Codable
// `PersonData` model EXACTLY (SearchQuest/Models/PersonReport.swift).
// The app binary is frozen in the App Store, so the backend conforms
// to it — not the other way around. Every field the app marks as
// non-optional MUST always be present here, or JSONDecoder throws and
// the app shows "Could not read server response."
//
// The endpoints return a BARE ARRAY of these objects (not a wrapper),
// because the app decodes `[PersonData]` at the top level.
// ────────────────────────────────────────────────────────────────

export interface PersonName {
  first:   string;
  middle?: string;
  last:    string;
}

export interface AddressEntry {
  id:     string;
  street: string;
  city:   string;
  state:  string;
  zip?:   string;
  from?:  string;
  to?:    string;
}

export interface PhoneEntry {
  id:       string;
  number:   string;
  type:     string;
  carrier?: string;
}

export interface RelativeEntry {
  id:           string;
  name:         string;
  relationship: string;
}

export interface SocialEntry {
  id:       string;
  platform: string;
  username: string;
  url?:     string;
}

export interface EmploymentEntry {
  id:      string;
  company: string;
  title?:  string;
  from?:   string;
  to?:     string;
}

export interface PropertyEntry {
  id:             string;
  address:        string;
  city:           string;
  state:          string;
  estimatedValue?: string;
  ownershipType?:  string;
}

export type MatchConfidence = "High" | "Possible" | "Low";

export interface PersonData {
  id:              string;
  name:            PersonName;
  age?:            number;
  aliases:         string[];
  addresses:       AddressEntry[];
  phones:          PhoneEntry[];
  emails:          string[];
  relatives:       RelativeEntry[];
  social:          SocialEntry[];
  employment:      EmploymentEntry[];
  property:        PropertyEntry[];
  matchConfidence: MatchConfidence;
}

function nameParts(name: EnformionName | undefined): PersonName {
  return {
    first: name?.FirstName?.trim() ?? "",
    middle: name?.MiddleName?.trim() || undefined,
    last: name?.LastName?.trim() ?? "",
  };
}

function fullName(name: EnformionName | undefined): string {
  if (!name) return "";
  return [name.FirstName, name.MiddleName, name.LastName]
    .filter(Boolean)
    .join(" ")
    .trim();
}

/**
 * @param person  one EnformionPerson record
 * @param idx     position in the result list (used for stable child IDs and
 *                to mark the top hit as the "High" confidence match)
 */
export function transformEnformionRecord(
  person: EnformionPerson,
  idx = 0
): PersonData | null {
  if (!person) return null;

  const primary = nameParts(person.Names?.[0]);
  if (!primary.first && !primary.last) return null;

  const pid = person.Id?.trim() || `person-${idx}`;

  // Extra name records become aliases.
  const aliases = (person.Names ?? [])
    .slice(1)
    .map(fullName)
    .filter((s) => s.length > 0);

  const addresses: AddressEntry[] = (person.Addresses ?? []).map((addr, i) => ({
    id:     `${pid}-addr-${i}`,
    street: addr.AddressLine1?.trim() ?? "",
    city:   addr.City?.trim() ?? "",
    state:  addr.State?.trim() ?? "",
    zip:    addr.Zip?.trim() || undefined,
    from:   addr.FirstReportedDate || undefined,
    to:     addr.LastReportedDate || undefined,
  }));

  const phones: PhoneEntry[] = (person.Phones ?? []).map((ph, i) => ({
    id:      `${pid}-phone-${i}`,
    number:  ph.PhoneNumber?.trim() ?? "",
    type:    ph.PhoneType?.trim() || "unknown",
    carrier: ph.Provider?.trim() || undefined,
  }));

  const emails: string[] = (person.Emails ?? [])
    .map((e) => e.Email?.trim())
    .filter((e): e is string => !!e && e.length > 0);

  const relatives: RelativeEntry[] = [
    ...(person.Relatives  ?? []),
    ...(person.Associates ?? []),
  ]
    .map((r, i) => ({
      id:           `${pid}-rel-${i}`,
      name:         fullName(r.Name),
      relationship: r.Relation?.trim() || "Relative",
    }))
    .filter((r) => r.name.length > 0);

  // Enformion's property record carries no street/city/state, only a type
  // and estimated value — so we surface those and leave the rest blank
  // rather than fabricate an address.
  const property: PropertyEntry[] = (person.Properties ?? []).map((p, i) => ({
    id:            `${pid}-prop-${i}`,
    address:       p.PropertyType?.trim() || "Property record",
    city:          "",
    state:         "",
    estimatedValue: p.EstimatedValue?.trim() || undefined,
    ownershipType:  p.OwnerOccupied ? "Owner Occupied" : undefined,
  }));

  return {
    id:              pid,
    name:            primary,
    age:             typeof person.Age === "number" ? person.Age : undefined,
    aliases,
    addresses,
    phones,
    emails,
    relatives,
    // Enformion (this plan) returns no social or employment data.
    social:          [],
    employment:      [],
    property,
    matchConfidence: idx === 0 ? "High" : "Possible",
  };
}
