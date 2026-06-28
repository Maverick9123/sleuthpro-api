import type { EnformionPerson, EnformionName } from "./enformion";

export interface PersonData {
  name:            string;
  addresses: Array<{
    street?:        string;
    city?:          string;
    state?:         string;
    zip?:           string;
    isCurrent?:     boolean;
    firstReported?: string;
    lastReported?:  string;
  }>;
  phones: Array<{
    number:    string;
    type?:     string;
    provider?: string;
  }>;
  emails:    Array<{ address: string }>;
  relatives: Array<{ name: string; relation?: string }>;
  property?: {
    ownerOccupied?: boolean;
    propertyType?:  string;
    value?:         string;
  };
  matchConfidence?: number;
}

function fullName(name: EnformionName | undefined): string {
  if (!name) return "";
  return [name.FirstName, name.MiddleName, name.LastName]
    .filter(Boolean)
    .join(" ")
    .trim();
}

export function transformEnformionRecord(
  person: EnformionPerson
): PersonData | null {
  if (!person) return null;

  const primaryName = fullName(person.Names?.[0]);
  if (!primaryName) return null;

  const addresses = (person.Addresses ?? []).map((addr, idx) => ({
    street:        addr.AddressLine1,
    city:          addr.City,
    state:         addr.State,
    zip:           addr.Zip,
    isCurrent:     idx === 0 || addr.Type?.toLowerCase() === "current",
    firstReported: addr.FirstReportedDate,
    lastReported:  addr.LastReportedDate,
  }));

  const phones = (person.Phones ?? []).map((ph) => ({
    number:   ph.PhoneNumber ?? "",
    type:     ph.PhoneType,
    provider: ph.Provider,
  }));

  const emails = (person.Emails ?? [])
    .filter((e) => e.Email)
    .map((e) => ({ address: e.Email! }));

  const relatives = [
    ...(person.Relatives  ?? []),
    ...(person.Associates ?? []),
  ].map((r) => ({
    name:     fullName(r.Name),
    relation: r.Relation,
  }));

  const topProp = person.Properties?.[0];
  const property = topProp
    ? {
        ownerOccupied: topProp.OwnerOccupied,
        propertyType:  topProp.PropertyType,
        value:         topProp.EstimatedValue,
      }
    : undefined;

  return {
    name: primaryName,
    addresses,
    phones,
    emails,
    relatives,
    property,
    matchConfidence: undefined,
  };
}
