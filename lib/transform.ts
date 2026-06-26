// SleuthPro API — Melissa Response → PersonData Transformer
// Maps Melissa Personator API records to the PersonData model
// the iOS app expects (PersonReport.swift)
// DreamTeamApps © 2026

import {
  PersonData,
  MelissaRecord,
  AddressEntry,
  PhoneEntry,
  RelativeEntry,
  PropertyEntry,
  MatchConfidence,
} from "@/types/sleuthpro";

function newId(): string {
  return crypto.randomUUID();
}

function formatMelissaDate(dateStr: string): string | undefined {
  if (!dateStr || dateStr.length < 8) return undefined;
  const year  = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day   = dateStr.substring(6, 8);
  if (year === "0000" || month === "00" || day === "00") return undefined;
  return `${month}/${day}/${year}`;
}

function formatPhoneType(code: string): string {
  switch ((code ?? "").toUpperCase()) {
    case "M": return "Mobile";
    case "L": return "Landline";
    case "V": return "VOIP";
    default:  return "Unknown";
  }
}

function determineConfidence(results: string): MatchConfidence {
  if (!results) return "Low";
  if (results.includes("YS01") || results.includes("AS01")) return "High";
  if (results.includes("YC") || results.includes("AS") || results.includes("YS")) return "Possible";
  return "Low";
}

export function transformMelissaRecord(record: MelissaRecord): PersonData | null {
  if (!record.FirstName && !record.LastName) return null;

  const addresses: AddressEntry[] = [];

  if (record.AddressLine1 && record.AddressLine1.trim() !== "") {
    addresses.push({
      id:     newId(),
      street: [record.AddressLine1, record.AddressLine2].filter(Boolean).join(" ").trim(),
      city:   record.City  ?? "",
      state:  record.State ?? "",
      zip:    record.PostalCode || undefined,
      from:   undefined,
      to:     "Present",
    });
  }

  if (Array.isArray(record.AddressHistoryList)) {
    for (const hist of record.AddressHistoryList) {
      if (!hist.AddressLine1) continue;
      addresses.push({
        id:     newId(),
        street: hist.AddressLine1.trim(),
        city:   hist.City  ?? "",
        state:  hist.State ?? "",
        zip:    hist.PostalCode || undefined,
        from:   formatMelissaDate(hist.DateFirstSeen),
        to:     formatMelissaDate(hist.DateLastSeen),
      });
    }
  }

  const phones: PhoneEntry[] = [];
  if (record.PhoneNumber && record.PhoneNumber.trim() !== "") {
    phones.push({
      id:      newId(),
      number:  record.PhoneNumber.trim(),
      type:    formatPhoneType(record.PhoneType),
      carrier: record.PhoneCarrier?.trim() || undefined,
    });
  }

  const emails: string[] = [];
  if (record.EmailAddress && record.EmailAddress.includes("@")) {
    emails.push(record.EmailAddress.trim());
  }

  const relatives: RelativeEntry[] = [];
  if (Array.isArray(record.CurrentResidentList)) {
    for (const resident of record.CurrentResidentList) {
      if (!resident.Name?.trim()) continue;
      relatives.push({
        id:           newId(),
        name:         resident.Name.trim(),
        relationship: resident.Relationship?.trim() || "Associate",
      });
    }
  }

  const property: PropertyEntry[] = [];
  if (Array.isArray(record.PropertyList)) {
    for (const prop of record.PropertyList) {
      if (!prop.Address?.trim()) continue;
      const rawValue = parseInt(prop.EstimatedValue ?? "0", 10);
      property.push({
        id:             newId(),
        address:        prop.Address.trim(),
        city:           prop.City  ?? "",
        state:          prop.State ?? "",
        estimatedValue: rawValue > 0
          ? `$${rawValue.toLocaleString("en-US")}`
          : undefined,
        ownershipType:  prop.OwnerType?.trim() || undefined,
      });
    }
  }

  const parsedAge = parseInt(record.Age ?? "", 10);
  const age = isNaN(parsedAge) || parsedAge <= 0 ? undefined : parsedAge;

  return {
    id:   record.RecordID ?? newId(),
    name: {
      first:  record.FirstName?.trim() ?? "",
      middle: record.MiddleName?.trim() || undefined,
      last:   record.LastName?.trim()  ?? "",
    },
    age,
    aliases:    [],
    addresses,
    phones,
    emails,
    relatives,
    criminal:   [],
    social:     [],
    employment: [],
    property,
    matchConfidence: determineConfidence(record.Results ?? ""),
  };
}