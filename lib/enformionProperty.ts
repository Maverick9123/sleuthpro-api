// Enformion Property Search (PropertyV2Search) integration.
//
// Same galaxy-ap auth as lib/enformion.ts, different endpoint. The live Enformion
// response is camelCase even though the API docs render PascalCase (the same trap
// that once made PersonSearch parse to zero results — see lib/enformion.ts note),
// so every read below tries BOTH casings via pick(). Field nesting is read
// defensively from either `property.summary` or the first `assessorRecords[]`
// entry, so slight shape differences don't blank the card. Confirm against a live
// response with the route's `debug:true` toggle, then tighten if desired.

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
  searchType: string = "Property"
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
      "galaxy-search-type": searchType,   // required by Enformion for API customers
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
/** First defined value among candidate keys (case-insensitive-ish). */
function pick(obj: unknown, ...keys: string[]): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const o = obj as Any;
  for (const k of keys) {
    if (o[k] !== undefined && o[k] !== null) return o[k];
    // try lowercased first-letter and other casing
    const lc = k.charAt(0).toLowerCase() + k.slice(1);
    if (o[lc] !== undefined && o[lc] !== null) return o[lc];
  }
  return undefined;
}
function str(v: unknown): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
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

/** Turn one Enformion PropertyV2 record into the clean PropertyData shape. */
export function transformProperty(rec: Any): PropertyData | null {
  if (!rec || typeof rec !== "object") return null;

  const property = pick(rec, "Property", "property") as Any | undefined;
  const summary  = pick(property, "Summary", "summary") as Any | undefined;
  const assessors = arr(pick(property, "AssessorRecords", "assessorRecords"));
  const a0 = assessors[0] ?? {};

  // Address — prefer summary's address object, else assessor's.
  const addrObj = (pick(summary, "Address", "address") ?? pick(a0, "Address", "address")) as Any | undefined;
  const fullAddress = str(pick(addrObj, "FullAddress", "fullAddress"))
    ?? [str(pick(addrObj, "AddressLine1", "addressLine1")), str(pick(addrObj, "AddressLine2", "addressLine2"))]
        .filter(Boolean).join(", ");

  // Owners
  const currentOwners = arr(pick(summary, "CurrentOwners", "currentOwners") ?? pick(a0, "CurrentOwners", "currentOwners"))
    .map(o => str(pick(o, "Name", "name")) ?? [str(pick(o,"FirstName","firstName")), str(pick(o,"LastName","lastName"))].filter(Boolean).join(" "))
    .filter((s): s is string => !!s);
  const prevOwners = arr(pick(summary, "PreviousOwners", "previousOwners") ?? pick(a0, "PreviousOwners", "previousOwners"))
    .map(o => str(pick(o, "Name", "name")) ?? [str(pick(o,"FirstName","firstName")), str(pick(o,"LastName","lastName"))].filter(Boolean).join(" "))
    .filter((s): s is string => !!s);

  // Values
  const assessedObj = pick(summary, "AssessedValue", "assessedValue") ?? pick(a0, "AssessedValue", "assessedValue");
  const marketObj   = pick(summary, "MarketValue", "marketValue", "EstimatedValue", "estimatedValue") ?? pick(a0, "MarketValue", "marketValue");
  const purchaseObj = pick(summary, "PurchasePrice", "purchasePrice", "LastSale", "lastSale") ?? pick(a0, "PurchasePrice", "purchasePrice");

  const structure = (pick(a0, "Structure", "structure") ?? a0) as Any;

  const data: PropertyData = {
    id:             str(pick(rec, "PoseidonId", "poseidonId")) ?? str(pick(a0, "Apn", "apn")) ?? (fullAddress || "property"),
    address:        fullAddress || "Unknown address",
    city:           str(pick(addrObj, "City", "city")),
    state:          str(pick(addrObj, "State", "state")),
    zip:            str(pick(addrObj, "Zip", "zip", "PostalCode", "postalCode")),
    apn:            str(pick(a0, "Apn", "apn") ?? pick(summary, "Apn", "apn")),
    owners:         currentOwners,
    previousOwners: prevOwners,
    estimatedValue: money(pick(marketObj, "Price", "price", "Value", "value") ?? marketObj),
    assessedValue:  money(pick(assessedObj, "Price", "price", "Value", "value") ?? assessedObj),
    lastSalePrice:  money(pick(purchaseObj, "Price", "price", "Amount", "amount") ?? purchaseObj),
    lastSaleDate:   str(pick(purchaseObj, "Date", "date", "SaleDate", "saleDate")),
    taxAmount:      money(pick(summary, "TaxAmount", "taxAmount") ?? pick(a0, "TaxAmount", "taxAmount")),
    yearBuilt:      str(pick(structure, "YearBuilt", "yearBuilt") ?? pick(summary, "YearBuilt", "yearBuilt")),
    bedrooms:       str(pick(structure, "Bedrooms", "bedrooms")),
    bathrooms:      str(pick(structure, "TotalBathrooms", "totalBathrooms", "Bathrooms", "bathrooms")),
    squareFeet:     str(pick(structure, "LivingSquareFootage", "livingSquareFootage", "BuildingSquareFootage", "buildingSquareFootage", "SquareFootage", "squareFootage")),
    lotAcres:       str(pick(structure, "Acres", "acres") ?? pick(a0, "Acres", "acres")),
    propertyType:   str(pick(summary, "PropertyType", "propertyType") ?? pick(a0, "PropertyType", "propertyType", "LandUse", "landUse")),
    ownerOccupied:  (() => { const v = pick(summary, "OwnerOccupied", "ownerOccupied") ?? pick(a0, "OwnerOccupied", "ownerOccupied"); return typeof v === "boolean" ? v : undefined; })(),
  } as PropertyData;

  return data;
}
