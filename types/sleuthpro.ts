// SleuthPro API — Type Definitions
// Mirrors PersonData model in PersonReport.swift exactly
// DreamTeamApps © 2026

export interface PersonName {
  first: string;
  middle?: string;
  last: string;
}

export interface AddressEntry {
  id: string;
  street: string;
  city: string;
  state: string;
  zip?: string;
  from?: string;
  to?: string;
}

export interface PhoneEntry {
  id: string;
  number: string;
  type: string;
  carrier?: string;
}

export interface RelativeEntry {
  id: string;
  name: string;
  relationship: string;
}

export interface CriminalEntry {
  id: string;
  date?: string;
  charge: string;
  disposition: string;
  jurisdiction: string;
  caseNumber?: string;
}

export interface SocialEntry {
  id: string;
  platform: string;
  username: string;
  url?: string;
}

export interface EmploymentEntry {
  id: string;
  company: string;
  title?: string;
  from?: string;
  to?: string;
}

export interface PropertyEntry {
  id: string;
  address: string;
  city: string;
  state: string;
  estimatedValue?: string;
  ownershipType?: string;
}

export type MatchConfidence = "High" | "Possible" | "Low";

export interface PersonData {
  id: string;
  name: PersonName;
  age?: number;
  aliases: string[];
  addresses: AddressEntry[];
  phones: PhoneEntry[];
  emails: string[];
  relatives: RelativeEntry[];
  criminal: CriminalEntry[];
  social: SocialEntry[];
  employment: EmploymentEntry[];
  property: PropertyEntry[];
  matchConfidence: MatchConfidence;
}

export interface NameSearchRequest {
  firstName: string;
  middleName?: string;
  lastName: string;
  state?: string;
  gender?: string;
}

export interface PhoneSearchRequest {
  phoneNumber: string;
}

export interface EmailSearchRequest {
  emailAddress: string;
}

export interface AddressSearchRequest {
  street: string;
  city: string;
  state: string;
}

export interface MelissaAddressHistory {
  DateLastSeen: string;
  DateFirstSeen: string;
  AddressLine1: string;
  City: string;
  State: string;
  PostalCode: string;
}

export interface MelissaResident {
  Name: string;
  Age: string;
  Relationship: string;
}

export interface MelissaProperty {
  Address: string;
  City: string;
  State: string;
  EstimatedValue: string;
  OwnerType: string;
}

export interface MelissaRecord {
  RecordID: string;
  Results: string;
  FormattedName: string;
  NamePrefix: string;
  FirstName: string;
  MiddleName: string;
  LastName: string;
  NameSuffix: string;
  Gender: string;
  DateOfBirth: string;
  Age: string;
  PhoneNumber: string;
  PhoneType: string;
  PhoneCarrier: string;
  EmailAddress: string;
  VerifiedStatus: string;
  AddressLine1: string;
  AddressLine2: string;
  City: string;
  State: string;
  PostalCode: string;
  CountyName: string;
  AddressHistoryCount: string;
  AddressHistoryList: MelissaAddressHistory[];
  CurrentResidentCount: string;
  CurrentResidentList: MelissaResident[];
  PropertyCount: string;
  PropertyList: MelissaProperty[];
}

export interface MelissaResponse {
  Version: string;
  TransmissionResults: string;
  TotalRecords: string;
  Records: MelissaRecord[];
}