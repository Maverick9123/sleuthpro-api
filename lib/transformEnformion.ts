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
    first: name?.firstName?.trim() ?? "",
    middle: name?.middleName?.trim() || undefined,
    last: name?.lastName?.trim() ?? "",
  };
}

function fullName(
  name: { firstName?: string; middleName?: string; lastName?: string } | undefined
): string {
  if (!name) return "";
  return [name.firstName, name.middleName, name.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
}

/** Build a street line from Enformion's component fields. */
function streetLine(a: {
  houseNumber?: string; streetPreDirection?: string; streetName?: string;
  streetPostDirection?: string; streetType?: string; unit?: string;
}): string {
  return [
    a.houseNumber, a.streetPreDirection, a.streetName,
    a.streetPostDirection, a.streetType, a.unit,
  ]
    .map((s) => s?.trim())
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

  const primary = nameParts(person.name);
  if (!primary.first && !primary.last) return null;

  const pid = person.tahoeId?.trim() || `person-${idx}`;

  // Alternate names (akas) become aliases, de-duped against the primary.
  const primaryFull = fullName(person.name).toLowerCase();
  const aliases = (person.akas ?? [])
    .map(fullName)
    .filter((s) => s.length > 0 && s.toLowerCase() !== primaryFull);

  const addresses: AddressEntry[] = (person.addresses ?? []).map((addr, i) => ({
    id:     `${pid}-addr-${i}`,
    street: streetLine(addr) || addr.fullAddress?.trim() || "",
    city:   addr.city?.trim() ?? "",
    state:  addr.state?.trim() ?? "",
    zip:    addr.zip?.trim() || undefined,
    from:   addr.firstReportedDate || undefined,
    to:     addr.lastReportedDate || undefined,
  }));

  const phones: PhoneEntry[] = (person.phoneNumbers ?? []).map((ph, i) => ({
    id:      `${pid}-phone-${i}`,
    number:  ph.phoneNumber?.trim() ?? "",
    type:    ph.phoneType?.trim() || "unknown",
    carrier: ph.company?.trim() || undefined,
  }));

  const emails: string[] = (person.emailAddresses ?? [])
    .map((e) => e.emailAddress?.trim())
    .filter((e): e is string => !!e && e.length > 0);

  const relatives: RelativeEntry[] = [
    ...(person.relativesSummary ?? []).map((r, i) => ({
      id:           `${pid}-rel-${i}`,
      name:         fullName(r),
      relationship: r.relativeType?.trim() || "Relative",
    })),
    ...(person.associatesSummary ?? []).map((r, i) => ({
      id:           `${pid}-assoc-${i}`,
      name:         fullName(r),
      relationship: "Associate",
    })),
  ].filter((r) => r.name.length > 0);

  return {
    id:              pid,
    name:            primary,
    age:             typeof person.age === "number" ? person.age : undefined,
    aliases,
    addresses,
    phones,
    emails,
    relatives,
    // This Enformion response carries no social handles or employment history,
    // and property data needs a separate lookup — surfaced as empty for now.
    social:          [],
    employment:      [],
    property:        [],
    matchConfidence: idx === 0 ? "High" : "Possible",
  };
}
