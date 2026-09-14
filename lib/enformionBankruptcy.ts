// Enformion Debt Search V2 integration — BANKRUPTCY records only.
//
// Same galaxy-ap auth as lib/enformion.ts, different endpoint. Per the
// EnformionGO docs (enformiongo.readme.io/reference/debt-v2):
//   endpoint:            POST /DebtSearch/V2
//   galaxy-search-type:  "DebtV2"   (required, mirrors the PropertyV2 pattern)
//   request body:        FirstName, LastName, AddressLine2 (state), DebtType,
//                        Page, ResultsPerPage
//   DebtType:            0=all, 1=Bankruptcies, 2=Liens, 3=Judgments
//
// Search Quest deliberately requests DebtType=1 (bankruptcies ONLY). Liens and
// judgments are intentionally left off until reviewed. The exact response field
// nesting is confirmed live with the route's debug toggle, so transformBankruptcy
// reads many candidate key names/casings defensively (same posture as the
// property transform, which dodged the casing trap that once zeroed PersonSearch).
//
// ⚠️ COMPLIANCE: bankruptcy is public court-record data. It is FCRA-relevant
// (bankruptcies appear on credit reports) — this feature is gated behind an FCRA
// attestation in the UI and is for PERSONAL, non-covered use only.

const ENFORMION_BASE =
  process.env.ENFORMION_API_BASE ?? "https://devapi.enformion.com";

// DebtType filter values Enformion accepts.
export const DEBT_TYPE = {
  ALL:          0,
  BANKRUPTCIES: 1,
  LIENS:        2,
  JUDGMENTS:    3,
} as const;

// ── Clean shape the front-end consumes (bare array, like PersonData) ─────────
export interface BankruptcyData {
  id:          string;
  debtorName:  string;
  recordType?: string;   // "Bankruptcy" (or Lien/Judgment if ever enabled)
  filingDate?: string;
  caseNumber?: string;
  court?:      string;   // court / filing agency
  chapter?:    string;   // bankruptcy chapter (7 / 11 / 13)
  status?:     string;   // e.g. "Discharged", "Dismissed", "Filed"
  amount?:     string;   // formatted "$12,500"
  filingType?: string;   // e.g. "Voluntary" / "Involuntary"
  address?:    string;
  city?:       string;
  state?:      string;
  zip?:        string;
}

// ── Request ──────────────────────────────────────────────────────────────────
export interface BankruptcyRequestBody {
  FirstName?:      string;
  LastName?:       string;
  AddressLine2?:   string;   // "City, ST" or just "ST"
  DebtType?:       number;   // default 1 (bankruptcies)
  Page?:           number;
  ResultsPerPage?: number;
}

type Any = Record<string, unknown>;

export interface EnformionDebtResponse {
  isError?: boolean;
  error?:   unknown;
  requestId?: string;
  [k: string]: unknown;
}

export async function callEnformionBankruptcy(
  body: BankruptcyRequestBody,
  searchType: string = "DebtV2"
): Promise<EnformionDebtResponse> {
  const apName     = process.env.ENFORMION_AP_NAME;
  const apPassword = process.env.ENFORMION_AP_PASSWORD;
  if (!apName || !apPassword) {
    throw new Error(
      "Missing EnformionGO credentials. Set ENFORMION_AP_NAME and " +
      "ENFORMION_AP_PASSWORD in Vercel environment variables."
    );
  }

  const response = await fetch(`${ENFORMION_BASE}/DebtSearch/V2`, {
    method:  "POST",
    headers: {
      "Content-Type":       "application/json",
      "Accept":             "application/json",
      "galaxy-ap-name":     apName,
      "galaxy-ap-password": apPassword,
      "galaxy-search-type": searchType,   // required; "DebtV2" for /DebtSearch/V2
    },
    body: JSON.stringify({ DebtType: DEBT_TYPE.BANKRUPTCIES, ...body }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `EnformionGO Debt API error ${response.status}: ${text || response.statusText}`
    );
  }
  return (await response.json()) as EnformionDebtResponse;
}

// ── Helpers (mirror lib/enformionProperty.ts) ────────────────────────────────
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
  if (typeof v === "object") return undefined;
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

/** The top-level records array, under any of the likely casings/names. */
export function bankruptcyRecords(data: EnformionDebtResponse): Any[] {
  return arr(
    pick(
      data,
      "DebtRecords", "debtRecords",
      "DebtV2Records", "debtV2Records",
      "Records", "records",
      "BankruptcyRecords", "bankruptcyRecords",
      "results", "Results"
    )
  );
}

/** A debtor entry → a display name. `name` may be an object {fullName, firstName, lastName} or a string. */
function debtorName(rec: Any): string | undefined {
  const n = pick(rec, "debtor", "Debtor", "name", "Name", "debtorName", "DebtorName");
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

/** Turn one Enformion Debt V2 record into the clean BankruptcyData shape. */
export function transformBankruptcy(rec: Any): BankruptcyData | null {
  if (!rec || typeof rec !== "object") return null;

  // Address may be flat or nested under an address object.
  const addrObj = pick(rec, "address", "Address") as Any | undefined;
  const addr =
    str(pick(addrObj, "fullAddress", "FullAddress")) ??
    str(pick(rec, "fullAddress", "FullAddress", "addressLine1", "AddressLine1"));

  const name = debtorName(rec) ?? "Name not listed";

  return {
    id:
      str(pick(rec, "caseNumber", "CaseNumber", "recordId", "RecordId", "id", "Id")) ??
      `${name}-${str(pick(rec, "filingDate", "FilingDate")) ?? Math.random().toString(36).slice(2)}`,
    debtorName:  name,
    recordType:
      str(pick(rec, "recordType", "RecordType", "debtType", "DebtType", "type", "Type")) ??
      "Bankruptcy",
    filingDate:
      str(pick(rec, "filingDate", "FilingDate", "fileDate", "FileDate", "dateFiled", "DateFiled")),
    caseNumber:  str(pick(rec, "caseNumber", "CaseNumber", "caseNo", "CaseNo")),
    court:
      str(pick(rec, "court", "Court", "courtName", "CourtName", "filingAgency", "FilingAgency", "agency", "Agency")),
    chapter:     str(pick(rec, "chapter", "Chapter")),
    status:      str(pick(rec, "status", "Status", "dispositionType", "DispositionType", "disposition", "Disposition")),
    amount:
      money(pick(rec, "amount", "Amount", "liabilityAmount", "LiabilityAmount", "totalDebt", "TotalDebt", "assetAmount", "AssetAmount")),
    filingType:  str(pick(rec, "filingType", "FilingType", "typeDescription", "TypeDescription")),
    address:     addr,
    city:        str(pick(addrObj ?? rec, "city", "City")),
    state:       str(pick(addrObj ?? rec, "state", "State")),
    zip:         str(pick(addrObj ?? rec, "zip", "Zip", "zipCode", "ZipCode", "postalCode", "PostalCode")),
  };
}
