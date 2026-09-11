// Enformion Property Search (PropertyV2Search) integration.
//
// Same galaxy-ap auth as lib/enformion.ts, different endpoint. Enformion API
// customers MUST send the galaxy-search-type header — for /PropertyV2Search the
// required value is "PropertyV2" (confirmed live 2026-09-11; "Property" is
// rejected as "not valid at /PropertyV2Search"). The live response is camelCase
// (propertyV2Records[].property.summary.*), so the transform targets that shape;
// pick() still tries both casings as a safety net. Confirmed field paths:
//   summary.address {fullAddress, city, state, zipCode, ...}
//   summary.currentOwners[].name {fullName, firstName, lastName}   ← name is an OBJECT
//   summary.assessedValue {price, year}   summary.purchasePrice {price, date}
//   summary.propertyDetails {beds, baths, yearBuilt, squareFootage, lotSize, type}
//   summary.propertyValue {totalValue, ...}   summary.isOwnerOccupied

const ENFORMION_BASE =
  process.env.ENFORMION_API_BASE ?? "https://devapi.enformion.com";

// ── Clean shape the apps consume (bare array, like PersonData) ──────────────
export interface PropertyData {
  id:             string;
  address:        string;
  city?:          string;
  state?:         string;
  zip?:           string;
  apn?:           string;
  owners:         string[];
  previousOwners: string[];
  estimatedValue?: string;   // market/estimated value, formatted "$284,000"
  assessedValue?:  string;   // tax-assessed value, formatted
  lastSalePrice?:  string;
  lastSaleDate?:   string;
  taxAmount?:      string;
  yearBuilt?:      string;
  bedrooms?:       string;
  bathrooms?:      string;
  squareFeet?:     string;
  lotAcres?:       string;
  propertyType?:   string;
  ownerOccupied?:  boolean;
}

// ── Request ─────────────────────────────────────────────────────────────────
export interface PropertyRequestBody {
  FirstName?:    string;   // owner-name search
  LastName?:     string;
  AddressLine1?: string;   // "123 Main St"
  AddressLine2?: string;   // "City, ST 12345"
  Apn?:          string;
  Page?:         number;
  ResultsPerPage?: number;
}

// Loose response typing — Enformion property payloads vary in casing/nesting.
type Any = Record<string, unknown>;

export interface EnformionPropertyResponse {
  isError?: boolean;
  error?:   unknown;
  requestId?: string;
  [k: string]: unknown;
}

export async function callEnformionProperty(
  body: PropertyRequestBody,
  searchType: string = "PropertyV2"
): Promise<EnformionPropertyResponse> {
  const apName     = process.env.ENFORMION_AP_NAME;
  const apPassword = process.env.ENFORMION_AP_PASSWORD;
  if (!apName || !apPassword) {
    throw new Error(
      "Missing EnformionGO credentials. Set ENFORMION_AP_NAME and " +
      "ENFORMION_AP_PASSWORD in Vercel environment variables."
    );
  }

  const response = await fetch(`${ENFORMION_BASE}/PropertyV2Search`, {
    method:  "POST",
    headers: {
      "Content-Type":       "application/json",
      "Accept":             "application/json",
      "galaxy-ap-name":     apName,
      "galaxy-ap-password": apPassword,
      "galaxy-search-type": searchType,   // required; "PropertyV2" for /PropertyV2Search
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `EnformionGO Property API error ${response.status}: ${text || response.statusText}`
    );
  }
  return (await response.json()) as EnformionPropertyResponse;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
/** First defined value among candidate keys (tries the given key and its lower-first-letter form). */
function pick(obj: unknown, ...keys: string[]): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const o = obj as Any;
  for (const k of keys) {
    if (o[k] !== undefined && o[k] !== null) return o[k];
    const lc = k.charAt(0).toLowerCase() + k.slice(1);
    if (o[lc] !== undefined && o[lc] !== null) return o[lc];
  }
  return undefined;
}
function str(v: unknown): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v === "object") return undefined;   // never stringify an object
  return String(v);
}
function money(v: unknown): string | undefined {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[^0-9.]/g, ""));
  if (!isFinite(n) || n <= 0) return undefined;
  return "$" + Math.round(n).toLocaleString("en-US");
}
function arr(v: unknown): Any[] {
  return Array.isArray(v) ? (v as Any[]) : [];
}

/** The top-level records array, under either casing. */
export function propertyRecords(data: EnformionPropertyResponse): Any[] {
  return arr(pick(data, "PropertyV2Records", "propertyV2Records", "PropertyRecords", "propertyRecords"));
}

/** One owner entry → a display name. `name` is an object {fullName, firstName, lastName}. */
function ownerName(o: Any): string | undefined {
  const n = pick(o, "name", "Name");
  if (n && typeof n === "object") {
    return (
      str(pick(n, "fullName", "FullName")) ??
      ([str(pick(n, "firstName", "FirstName")), str(pick(n, "lastName", "LastName"))]
        .filter(Boolean)
        .join(" ") || undefined)
    );
  }
  return str(n);
}

/** Turn one Enformion PropertyV2 record into the clean PropertyData shape. */
export function transformProperty(rec: Any): PropertyData | null {
  if (!rec || typeof rec !== "object") return null;

  const property = pick(rec, "property", "Property") as Any | undefined;
  const summary  = pick(property, "summary", "Summary") as Any | undefined;
  if (!summary) return null;

  const addr    = pick(summary, "address", "Address") as Any | undefined;
  const details = pick(summary, "propertyDetails", "PropertyDetails") as Any | undefined;
  const pv      = pick(summary, "propertyValue", "PropertyValue") as Any | undefined;
  const assessedObj = pick(summary, "assessedValue", "AssessedValue");
  const purchaseObj = pick(summary, "purchasePrice", "PurchasePrice");

  const owners = arr(pick(summary, "currentOwners", "CurrentOwners"))
    .map(ownerName)
    .filter((s): s is string => !!s);
  const prevOwners = arr(pick(summary, "previousOwners", "PreviousOwners"))
    .map(ownerName)
    .filter((s): s is string => !!s);

  const fullAddress =
    str(pick(addr, "fullAddress", "FullAddress")) ??
    str(pick(addr, "addressLine1", "AddressLine1")) ??
    "Unknown address";

  // Enformion returns lot size in square feet; show acres when it clearly is sqft.
  const lotRaw = parseFloat(String(pick(details, "lotSize", "LotSize") ?? "").replace(/[^0-9.]/g, ""));
  const lotAcres =
    isFinite(lotRaw) && lotRaw > 0
      ? lotRaw > 1000
        ? (lotRaw / 43560).toFixed(2)
        : String(lotRaw)
      : undefined;

  const occ = pick(summary, "isOwnerOccupied", "IsOwnerOccupied", "ownerOccupied", "OwnerOccupied");

  return {
    id:
      str(pick(rec, "poseidonId", "PoseidonId")) ??
      str(pick(summary, "apn", "Apn")) ??
      fullAddress,
    address:        fullAddress,
    city:           str(pick(addr, "city", "City")),
    state:          str(pick(addr, "state", "State")),
    zip:            str(pick(addr, "zipCode", "zip", "Zip", "postalCode", "PostalCode")),
    apn:            str(pick(summary, "apn", "Apn")),
    owners,
    previousOwners: prevOwners,
    estimatedValue: money(pick(pv, "totalValue", "TotalValue")),
    assessedValue:  money(pick(assessedObj, "price", "Price")),
    lastSalePrice:  money(pick(purchaseObj, "price", "Price")),
    lastSaleDate:   str(pick(purchaseObj, "date", "Date")),
    taxAmount:      money(pick(summary, "taxAmount", "TaxAmount")),
    yearBuilt:      str(pick(details, "yearBuilt", "YearBuilt")),
    bedrooms:       str(pick(details, "beds", "Beds", "bedrooms", "Bedrooms")),
    bathrooms:      str(pick(details, "baths", "Baths", "bathrooms", "Bathrooms")),
    squareFeet:     str(pick(details, "squareFootage", "SquareFootage", "livingArea", "LivingArea")),
    lotAcres,
    propertyType:   str(pick(details, "type", "Type")),
    ownerOccupied:  typeof occ === "boolean" ? occ : undefined,
  };
}
