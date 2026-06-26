// SleuthPro API — Shared TypeScript Types
// Mirrors PersonData model in PersonReport.swift exactly
// DreamTeamApps © 2026

// ─── iOS App Models ────────────────────────────────────────────────────────

export type MatchConfidence = "High" | "Possible" | "Low";

export interface PersonName {
  first:  string;
  middle?: string;
  last:   string;
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

export interface CriminalEntry {
  id:          string;
  offense:     string;
  date?:       string;
  disposition?: string;
  state?:      string;
}

export interface SocialEntry {
  id:       string;
  platform: string;
  handle:   string;
  url?:     string;
}

export interface EmploymentEntry {
  id:        string;
  company:   string;
  title?:    string;
  from?:     string;
  to?:       string;
}

export interface PropertyEntry {
  id:              string;
  address:         string;
  city:            string;
  state:           string;
  estimatedValue?: string;
  ownershipType?:  string;
}

export interface PersonData {
  id:              string;
  name:            PersonName;
  age?:            number;
  aliases:         string[];
  addresses:       AddressEntry[];
  phones:          PhoneEntry[];
  emails:          string[];
  relatives:       RelativeEntry[];
  criminal:        CriminalEntry[];
  social:          SocialEntry[];
  employment:      EmploymentEntry[];
  property:        PropertyEntry[];
  matchConfidence: MatchConfidence;
}

// ─── Melissa API Types ─────────────────────────────────────────────────────

export interface MelissaAddressHistory {
  AddressLine1?:  string;
  City?:          string;
  State?:         string;
  PostalCode?:    string;
  DateFirstSeen?: string;
  DateLastSeen?:  string;
}

export interface MelissaResident {
  Name?:         string;
  Relationship?: string;
}

export interface MelissaProperty {
  Address?:        string;
  City?:           string;
  State?:          string;
  EstimatedValue?: string;
  OwnerType?:      string;
}

export interface MelissaRecord {
  RecordID?:           string;
  Results?:            string;
  NameFirst?:          string;
  NameMiddle?:         string;
  NameLast?:           string;
  NameFull?:           string;
  NamePrefix?:         string;
  NameSuffix?:         string;
  Age?:                string;
  DateOfBirth?:        string;
  Gender?:             string;
  AddressLine1?:       string;
  AddressLine2?:       string;
  City?:               string;
  State?:              string;
  PostalCode?:         string;
  PhoneNumber?:        string;
  PhoneType?:          string;
  PhoneCarrier?:       string;
  EmailAddress?:       string;
  AddressHistoryList?: MelissaAddressHistory[];
  CurrentResidentList?: MelissaResident[];
  PropertyList?:       MelissaProperty[];
}

export interface MelissaResponse {
  Records:              MelissaRecord[];
  TotalRecords:         string;
  TransmissionResults:  string;
  TransmissionReference?: string;
  Version?:             string;
}

// ─── Search Request Types ──────────────────────────────────────────────────

export interface NameSearchRequest {
  firstName:   string;
  middleName?: string;
  lastName:    string;
  state?:      string;
  gender?:     string;
}

export interface PhoneSearchRequest {
  phoneNumber: string;
}

export interface EmailSearchRequest {
  emailAddress: string;
}

export interface AddressSearchRequest {
  street: string;
  city:   string;
  state:  string;
}
