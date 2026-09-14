"use client";

// Search Quest — Web front-end (Phase 1)
// A browser storefront over the same backend the apps use. No app-store
// gatekeeper. Calls the existing /api/search/* routes directly.
// Monetization (Stripe credits) comes next; the server rate guard caps
// total Enformion cost for now.
// DreamTeamApps © 2026

import { useState, useEffect } from "react";
import type { PersonData } from "../lib/transformEnformion";
import type { PropertyData } from "../lib/enformionProperty";
import type { BankruptcyData } from "../lib/enformionBankruptcy";

type SearchType = "name" | "phone" | "email" | "address" | "property" | "bankruptcy";

const TYPES: { key: SearchType; label: string; icon: string }[] = [
  { key: "name",       label: "Name",       icon: "👤" },
  { key: "phone",      label: "Phone",      icon: "📞" },
  { key: "email",      label: "Email",      icon: "✉️" },
  { key: "address",    label: "Address",    icon: "🏠" },
  { key: "property",   label: "Property",   icon: "🏡" },
  { key: "bankruptcy", label: "Bankruptcy", icon: "⚖️" },
];

const FCRA_KEY = "sq_fcra_accepted_v1";

interface Fields {
  firstName: string; middleName: string; lastName: string; state: string;
  phoneNumber: string; emailAddress: string;
  street: string; city: string; addrState: string; zip: string;
}
const EMPTY: Fields = {
  firstName: "", middleName: "", lastName: "", state: "",
  phoneNumber: "", emailAddress: "",
  street: "", city: "", addrState: "", zip: "",
};

export default function Home() {
  const [type, setType] = useState<SearchType>("name");
  const [f, setF] = useState<Fields>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [people, setPeople] = useState<PersonData[] | null>(null);
  const [props, setProps] = useState<PropertyData[] | null>(null);
  const [bks, setBks] = useState<BankruptcyData[] | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<PersonData | null>(null);
  const [selectedProp, setSelectedProp] = useState<PropertyData | null>(null);
  const [selectedBk, setSelectedBk] = useState<BankruptcyData | null>(null);

  // FCRA attestation gate — must be accepted once (per browser) before searching.
  const [accepted, setAccepted] = useState(true); // assume yes to avoid SSR flash; corrected on mount
  useEffect(() => {
    try {
      setAccepted(window.localStorage.getItem(FCRA_KEY) === "yes");
    } catch {
      setAccepted(false);
    }
  }, []);
  function acceptFcra() {
    try { window.localStorage.setItem(FCRA_KEY, "yes"); } catch { /* private mode — session only */ }
    setAccepted(true);
  }

  const set = (k: keyof Fields, v: string) => setF((p) => ({ ...p, [k]: v }));

  function pickType(t: SearchType) {
    setType(t); setF(EMPTY); setError(null);
    setPeople(null); setProps(null); setBks(null);
    setSelectedPerson(null); setSelectedProp(null); setSelectedBk(null);
  }

  async function post(path: string, body: unknown) {
    const res = await fetch(`/api/search/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 429) throw new Error("We're busy right now — please wait a moment and try again.");
    if (!res.ok) throw new Error("Search failed. Please try again.");
    return res.json();
  }

  async function runSearch() {
    setError(null); setSelectedPerson(null); setSelectedProp(null); setSelectedBk(null);
    setPeople(null); setProps(null); setBks(null);

    const t = (s: string) => s.trim();
    if (type === "name" && (!t(f.firstName) || !t(f.lastName))) return setError("Enter a first and last name.");
    if (type === "phone" && !t(f.phoneNumber)) return setError("Enter a phone number.");
    if (type === "email" && !t(f.emailAddress)) return setError("Enter an email address.");
    if ((type === "address" || type === "property") && (!t(f.street) || !t(f.city) || !t(f.addrState)))
      return setError("Enter a street, city, and state.");
    if (type === "bankruptcy" && !t(f.lastName)) return setError("Enter at least a last name.");

    setLoading(true);
    try {
      if (type === "name") {
        const mid = t(f.middleName);
        const data: PersonData[] = await post("name", {
          firstName: t(f.firstName), middleName: mid || undefined,
          lastName: t(f.lastName), state: t(f.state) || undefined,
        });
        setPeople(data);
        if (!data.length) setError("No records found. Try a different spelling.");
      } else if (type === "phone") {
        const data: PersonData[] = await post("phone", { phoneNumber: t(f.phoneNumber) });
        setPeople(data);
        if (!data.length) setError("No records found for that number.");
      } else if (type === "email") {
        const data: PersonData[] = await post("email", { emailAddress: t(f.emailAddress) });
        setPeople(data);
        if (!data.length) setError("No records found for that email.");
      } else if (type === "address") {
        const data: PersonData[] = await post("address", {
          street: t(f.street), city: t(f.city), state: t(f.addrState), zip: t(f.zip) || undefined,
        });
        setPeople(data);
        if (!data.length) setError("No records found at that address.");
      } else if (type === "property") {
        const data: PropertyData[] = await post("property", {
          street: t(f.street), city: t(f.city), state: t(f.addrState), zip: t(f.zip) || undefined,
        });
        setProps(data);
        if (!data.length) setError("No property records found. Check the address, or try without the ZIP.");
      } else {
        const data: BankruptcyData[] = await post("bankruptcy", {
          firstName: t(f.firstName) || undefined, lastName: t(f.lastName), state: t(f.state) || undefined,
        });
        setBks(data);
        if (!data.length) setError("No bankruptcy records found for that name.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const nonZero = (s?: string) => (s && s !== "0" && s !== "0.0" ? s : undefined);

  return (
    <>
      {!accepted && <FcraGate onAccept={acceptFcra} />}

      <div className="page" aria-hidden={!accepted}>
        <header className="top">
          <div className="brand">🔎 Search Quest</div>
          <div className="tag">People &amp; property lookups</div>
        </header>

        {selectedPerson ? (
          <PersonReport person={selectedPerson} onBack={() => setSelectedPerson(null)} nonZero={nonZero} />
        ) : selectedProp ? (
          <PropertyReport property={selectedProp} onBack={() => setSelectedProp(null)} nonZero={nonZero} />
        ) : selectedBk ? (
          <BankruptcyReport record={selectedBk} onBack={() => setSelectedBk(null)} />
        ) : (
          <main className="wrap">
            <h1>Find the people &amp; property in your life</h1>
            <p className="sub">Search by name, phone, email, or address — plus full property lookups. Public records, personal use.</p>

            <div className="card">
              <div className="pills">
                {TYPES.map((tt) => (
                  <button
                    key={tt.key}
                    className={`pill ${type === tt.key ? "on" : ""}`}
                    onClick={() => pickType(tt.key)}
                  >
                    <span aria-hidden>{tt.icon}</span> {tt.label}
                  </button>
                ))}
              </div>

              <div className="form">
                {type === "name" && (
                  <>
                    <input placeholder="First name *" value={f.firstName} onChange={(e) => set("firstName", e.target.value)} />
                    <input placeholder="Middle name (optional)" value={f.middleName} onChange={(e) => set("middleName", e.target.value)} />
                    <input placeholder="Last name *" value={f.lastName} onChange={(e) => set("lastName", e.target.value)} />
                    <input placeholder="State (optional — e.g. GA)" value={f.state} onChange={(e) => set("state", e.target.value)} />
                  </>
                )}
                {type === "phone" && (
                  <input placeholder="Phone number (e.g. 4045550182)" value={f.phoneNumber} onChange={(e) => set("phoneNumber", e.target.value)} />
                )}
                {type === "email" && (
                  <input placeholder="Email address" value={f.emailAddress} onChange={(e) => set("emailAddress", e.target.value)} />
                )}
                {(type === "address" || type === "property") && (
                  <>
                    <input placeholder="Street address *" value={f.street} onChange={(e) => set("street", e.target.value)} />
                    <input placeholder="City *" value={f.city} onChange={(e) => set("city", e.target.value)} />
                    <div className="row2">
                      <input placeholder="State * (e.g. GA)" value={f.addrState} onChange={(e) => set("addrState", e.target.value)} />
                      <input placeholder="ZIP" value={f.zip} onChange={(e) => set("zip", e.target.value)} />
                    </div>
                  </>
                )}
                {type === "bankruptcy" && (
                  <>
                    <input placeholder="First name (optional)" value={f.firstName} onChange={(e) => set("firstName", e.target.value)} />
                    <input placeholder="Last name *" value={f.lastName} onChange={(e) => set("lastName", e.target.value)} />
                    <input placeholder="State (optional — e.g. GA)" value={f.state} onChange={(e) => set("state", e.target.value)} />
                    <p className="note">Searches public bankruptcy court records nationwide. Records may not exist for every name, and matches should be confirmed against official court sources.</p>
                  </>
                )}
              </div>

              <button className="go" onClick={runSearch} disabled={loading}>
                {loading ? "Searching…" : type === "property" ? "Look Up Property" : type === "bankruptcy" ? "Search Bankruptcy Records" : "Search"}
              </button>

              {error && <div className="err">{error}</div>}
            </div>

            {people && people.length > 0 && (
              <section className="results">
                <div className="rcount">{people.length} {people.length === 1 ? "result" : "results"}</div>
                {people.map((p) => (
                  <button key={p.id} className="rcard" onClick={() => setSelectedPerson(p)}>
                    <div className="ravatar">{(p.name.first || "?").charAt(0)}</div>
                    <div className="rbody">
                      <div className="rname">
                        {[p.name.first, p.name.middle, p.name.last].filter(Boolean).join(" ")}
                        {typeof p.age === "number" && <span className="rmeta"> · Age {p.age}</span>}
                      </div>
                      <div className="rsub">
                        {p.addresses[0] ? `${p.addresses[0].city}, ${p.addresses[0].state}` : "Location unknown"}
                      </div>
                      <span className={`badge ${p.matchConfidence.toLowerCase()}`}>{p.matchConfidence}</span>
                    </div>
                    <div className="chev">›</div>
                  </button>
                ))}
              </section>
            )}

            {props && props.length > 0 && (
              <section className="results">
                <div className="rcount">{props.length} {props.length === 1 ? "property" : "properties"}</div>
                {props.map((p) => (
                  <button key={p.id} className="rcard" onClick={() => setSelectedProp(p)}>
                    <div className="ravatar">🏡</div>
                    <div className="rbody">
                      <div className="rname">{p.address}</div>
                      <div className="rsub">{p.owners[0] ?? "Owner not listed"}</div>
                      {(p.estimatedValue ?? p.assessedValue) && (
                        <span className="value">{p.estimatedValue ?? p.assessedValue}</span>
                      )}
                    </div>
                    <div className="chev">›</div>
                  </button>
                ))}
              </section>
            )}

            {bks && bks.length > 0 && (
              <section className="results">
                <div className="rcount">{bks.length} {bks.length === 1 ? "record" : "records"}</div>
                {bks.map((b) => (
                  <button key={b.id} className="rcard" onClick={() => setSelectedBk(b)}>
                    <div className="ravatar">⚖️</div>
                    <div className="rbody">
                      <div className="rname">{b.debtorName}</div>
                      <div className="rsub">
                        {[b.recordType ?? "Bankruptcy", b.chapter ? `Chapter ${b.chapter}` : null, b.filingDate]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                      {(b.city || b.state) && (
                        <span className="value">{[b.city, b.state].filter(Boolean).join(", ")}</span>
                      )}
                    </div>
                    <div className="chev">›</div>
                  </button>
                ))}
              </section>
            )}

            <p className="fcra">
              For personal use only. Search Quest is not a consumer reporting agency, and its data — including public
              records such as bankruptcy filings — may not be used for tenant screening, employment, credit, insurance,
              or any other purpose covered by the Fair Credit Reporting Act (FCRA). Public-record data may be incomplete
              or inaccurate and should be verified against official sources.
            </p>
          </main>
        )}
      </div>

      <style jsx global>{`
        :root{
          --burg:#9E3450; --deep:#6E2438; --accent:#B23A57; --light:#E2AEBB;
          --bg:#FBF3F4; --card:#ffffff; --ink:#1E293B; --muted:#64748B; --line:#f3e8eb;
        }
        *{box-sizing:border-box}
        html,body{margin:0;padding:0}
        body{background:var(--bg);color:var(--ink);
          font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}
        .page{min-height:100vh;display:flex;flex-direction:column}
        .top{background:var(--deep);color:#fff;padding:16px 20px;display:flex;align-items:baseline;gap:12px}
        .brand{font-size:22px;font-weight:800;letter-spacing:.2px;
          background:linear-gradient(90deg,#f6d68a,#e8b45a);-webkit-background-clip:text;background-clip:text;color:transparent}
        .tag{font-size:13px;color:#f0d7de}
        .wrap{max-width:720px;margin:0 auto;padding:28px 18px 60px;width:100%}
        h1{font-size:30px;line-height:1.15;margin:6px 0 8px;text-align:center}
        .sub{color:var(--muted);text-align:center;margin:0 auto 22px;max-width:52ch}
        .card{background:var(--card);border:1px solid #f0dfe3;border-radius:16px;padding:16px;
          box-shadow:0 8px 30px rgba(158,52,80,.08)}
        .pills{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
        .pill{border:none;cursor:pointer;font-size:14px;font-weight:600;padding:9px 14px;border-radius:999px;
          background:#f7e9ec;color:var(--ink)}
        .pill.on{background:var(--burg);color:#fff}
        .form{display:flex;flex-direction:column;gap:10px}
        .row2{display:flex;gap:10px}
        .row2 input{flex:1;min-width:0}
        input{width:100%;font-size:16px;padding:12px 14px;border:1px solid var(--light);border-radius:10px;
          background:#fdf8f9;color:var(--ink);outline:none}
        input:focus{border-color:var(--burg)}
        .go{margin-top:14px;width:100%;border:none;cursor:pointer;font-size:16px;font-weight:700;color:#fff;
          background:var(--burg);border-radius:10px;padding:14px;transition:opacity .15s}
        .go:disabled{opacity:.6;cursor:default}
        .err{margin-top:12px;background:#fdecec;color:#b3261e;border-radius:10px;padding:10px 12px;font-size:14px}
        .results{margin-top:22px;display:flex;flex-direction:column;gap:10px}
        .rcount{font-size:13px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
        .rcard{display:flex;align-items:center;gap:12px;text-align:left;cursor:pointer;width:100%;
          background:var(--card);border:1px solid #f0dfe3;border-radius:14px;padding:14px}
        .rcard:hover{border-color:var(--light)}
        .ravatar{width:42px;height:42px;border-radius:50%;background:#f7e0e6;color:var(--burg);
          display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;flex:0 0 auto}
        .rbody{flex:1;min-width:0}
        .rname{font-weight:700;font-size:16px}
        .rmeta{color:var(--muted);font-weight:400}
        .rsub{color:var(--muted);font-size:14px;margin:2px 0 6px}
        .badge{font-size:12px;font-weight:700;padding:3px 8px;border-radius:999px}
        .badge.high{background:#dcfce7;color:#166534}
        .badge.possible{background:#fef3c7;color:#92400e}
        .badge.low{background:#fee2e2;color:#991b1b}
        .value{font-size:13px;font-weight:800;color:var(--burg)}
        .chev{color:var(--muted);font-size:22px;flex:0 0 auto}
        .fcra{color:var(--muted);font-size:12px;text-align:center;margin-top:26px;max-width:60ch;margin-left:auto;margin-right:auto}
        .report{max-width:720px;margin:0 auto;padding:20px 18px 60px;width:100%}
        .back{background:none;border:none;color:var(--burg);font-weight:700;font-size:15px;cursor:pointer;padding:6px 0;margin-bottom:8px}
        .rhead{background:var(--card);border:1px solid #f0dfe3;border-radius:16px;padding:18px;margin-bottom:14px}
        .rhead h2{margin:0 0 4px;font-size:22px}
        .rhead .m{color:var(--muted);font-size:14px}
        .sec{background:var(--card);border:1px solid #f0dfe3;border-radius:16px;padding:16px;margin-bottom:14px}
        .sec h3{margin:0 0 12px;font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
        .kv{display:flex;justify-content:space-between;gap:16px;padding:7px 0;border-top:1px solid #f3e8eb;font-size:15px}
        .kv:first-of-type{border-top:none}
        .kv .k{color:var(--muted)}
        .kv .v{font-weight:600;text-align:right}
        .li{padding:8px 0;border-top:1px solid #f3e8eb}
        .li:first-child{border-top:none}
        .li .t{font-weight:600}
        .li .d{color:var(--muted);font-size:13px}
        .pills-badges{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
        .tagpill{font-size:12px;font-weight:700;color:#fff;background:var(--burg);border-radius:999px;padding:4px 10px}
        .note{color:var(--muted);font-size:12.5px;line-height:1.45;margin:2px 2px 0}
        /* FCRA attestation gate */
        .gate{position:fixed;inset:0;z-index:1000;background:rgba(46,16,26,.55);
          display:flex;align-items:center;justify-content:center;padding:18px;backdrop-filter:blur(3px)}
        .gatebox{background:var(--card);border-radius:18px;max-width:560px;width:100%;
          padding:26px 24px;box-shadow:0 20px 60px rgba(0,0,0,.35);max-height:92vh;overflow:auto}
        .gatebox h2{margin:0 0 4px;font-size:22px;color:var(--deep)}
        .gatebox .lead{color:var(--muted);margin:0 0 16px;font-size:14px}
        .gaterules{list-style:none;padding:0;margin:0 0 16px;display:flex;flex-direction:column;gap:10px}
        .gaterules li{display:flex;gap:10px;align-items:flex-start;font-size:14px;line-height:1.4}
        .gaterules .x{color:var(--burg);font-weight:800;flex:0 0 auto}
        .gatecheck{display:flex;gap:10px;align-items:flex-start;background:#fdf8f9;border:1px solid var(--light);
          border-radius:12px;padding:12px 14px;font-size:13.5px;line-height:1.45;cursor:pointer;margin-bottom:14px}
        .gatecheck input{width:20px;height:20px;flex:0 0 auto;margin:1px 0 0;accent-color:var(--burg);cursor:pointer}
        .gate .go{margin-top:0}
        .gatelaw{color:var(--muted);font-size:11.5px;line-height:1.4;margin:14px 0 0}
        @media(max-width:520px){ h1{font-size:24px} }
      `}</style>
    </>
  );
}

function PersonReport({ person, onBack }: { person: PersonData; onBack: () => void; nonZero: (s?: string) => string | undefined }) {
  const full = [person.name.first, person.name.middle, person.name.last].filter(Boolean).join(" ");
  return (
    <div className="report">
      <button className="back" onClick={onBack}>‹ Back to results</button>
      <div className="rhead">
        <h2>{full}</h2>
        <div className="m">
          {typeof person.age === "number" ? `Age ${person.age}` : "Age unknown"}
          {person.addresses[0] ? ` · ${person.addresses[0].city}, ${person.addresses[0].state}` : ""}
          {` · ${person.matchConfidence} match`}
        </div>
        {person.aliases.length > 0 && (
          <div className="m" style={{ marginTop: 6 }}>Also known as: {person.aliases.join(", ")}</div>
        )}
      </div>

      {person.addresses.length > 0 && (
        <div className="sec">
          <h3>Address History ({person.addresses.length})</h3>
          {person.addresses.map((a) => (
            <div className="li" key={a.id}>
              <div className="t">{[a.street, a.city, a.state, a.zip].filter(Boolean).join(", ")}</div>
              {(a.from || a.to) && <div className="d">{[a.from, a.to].filter(Boolean).join(" – ")}</div>}
            </div>
          ))}
        </div>
      )}

      {person.phones.length > 0 && (
        <div className="sec">
          <h3>Phone Numbers ({person.phones.length})</h3>
          {person.phones.map((ph) => (
            <div className="li" key={ph.id}>
              <div className="t">{ph.number}</div>
              <div className="d">{[ph.type, ph.carrier].filter(Boolean).join(" · ")}</div>
            </div>
          ))}
        </div>
      )}

      {person.emails.length > 0 && (
        <div className="sec">
          <h3>Emails ({person.emails.length})</h3>
          {person.emails.map((e, i) => (<div className="li" key={i}><div className="t">{e}</div></div>))}
        </div>
      )}

      {person.relatives.length > 0 && (
        <div className="sec">
          <h3>Relatives &amp; Associates ({person.relatives.length})</h3>
          {person.relatives.map((r) => (
            <div className="li" key={r.id}><div className="t">{r.name}</div><div className="d">{r.relationship}</div></div>
          ))}
        </div>
      )}
    </div>
  );
}

function PropertyReport({ property, onBack, nonZero }: { property: PropertyData; onBack: () => void; nonZero: (s?: string) => string | undefined }) {
  const p = property;
  const cityStateZip = [[p.city, p.state].filter(Boolean).join(", "), p.zip].filter(Boolean).join(" ");
  const kv = (k: string, v?: string) => (v ? <div className="kv"><span className="k">{k}</span><span className="v">{v}</span></div> : null);
  return (
    <div className="report">
      <button className="back" onClick={onBack}>‹ Back to results</button>
      <div className="rhead">
        <h2>{p.address}</h2>
        {cityStateZip && <div className="m">{cityStateZip}</div>}
        <div className="pills-badges">
          {p.propertyType && <span className="tagpill">{p.propertyType}</span>}
          {typeof p.ownerOccupied === "boolean" && (
            <span className="tagpill">{p.ownerOccupied ? "Owner-occupied" : "Not owner-occupied"}</span>
          )}
        </div>
      </div>

      <div className="sec">
        <h3>Owner</h3>
        {(p.owners.length ? p.owners : ["Not listed"]).map((o, i) => (
          <div className="kv" key={i}><span className="k">Current</span><span className="v">{o}</span></div>
        ))}
      </div>

      {(p.estimatedValue || p.assessedValue || p.lastSalePrice || p.lastSaleDate || p.taxAmount) && (
        <div className="sec">
          <h3>Value &amp; Sale History</h3>
          {kv("Estimated value", p.estimatedValue)}
          {kv("Assessed value", p.assessedValue)}
          {kv("Last sale price", p.lastSalePrice)}
          {kv("Last sale date", p.lastSaleDate)}
          {kv("Annual tax", p.taxAmount)}
        </div>
      )}

      <div className="sec">
        <h3>Property Details</h3>
        {kv("Year built", p.yearBuilt)}
        {kv("Bedrooms", nonZero(p.bedrooms))}
        {kv("Bathrooms", nonZero(p.bathrooms))}
        {kv("Square feet", nonZero(p.squareFeet))}
        {kv("Lot (acres)", p.lotAcres)}
        {kv("Parcel (APN)", p.apn)}
      </div>

      {p.previousOwners.length > 0 && (
        <div className="sec">
          <h3>Previous Owners</h3>
          {p.previousOwners.map((o, i) => (<div className="li" key={i}><div className="t">{o}</div></div>))}
        </div>
      )}
    </div>
  );
}

function BankruptcyReport({ record, onBack }: { record: BankruptcyData; onBack: () => void }) {
  const b = record;
  const cityStateZip = [[b.city, b.state].filter(Boolean).join(", "), b.zip].filter(Boolean).join(" ");
  const kv = (k: string, v?: string) => (v ? <div className="kv"><span className="k">{k}</span><span className="v">{v}</span></div> : null);
  return (
    <div className="report">
      <button className="back" onClick={onBack}>‹ Back to results</button>
      <div className="rhead">
        <h2>{b.debtorName}</h2>
        {cityStateZip && <div className="m">{cityStateZip}</div>}
        <div className="pills-badges">
          <span className="tagpill">{b.recordType ?? "Bankruptcy"}</span>
          {b.chapter && <span className="tagpill">Chapter {b.chapter}</span>}
          {b.status && <span className="tagpill">{b.status}</span>}
        </div>
      </div>

      <div className="sec">
        <h3>Filing Details</h3>
        {kv("Record type", b.recordType ?? "Bankruptcy")}
        {kv("Chapter", b.chapter)}
        {kv("Filing type", b.filingType)}
        {kv("Filing date", b.filingDate)}
        {kv("Status", b.status)}
        {kv("Case number", b.caseNumber)}
        {kv("Court / agency", b.court)}
        {kv("Amount", b.amount)}
        {b.address && kv("Address on file", [b.address, cityStateZip].filter(Boolean).join(", "))}
      </div>

      <p className="fcra">
        Public court-record data, shown for personal use only. It may be incomplete or out of date, may reflect a
        different person with the same name, and may not be used for any FCRA-covered decision. Verify against
        official court records before relying on it.
      </p>
    </div>
  );
}

function FcraGate({ onAccept }: { onAccept: () => void }) {
  const [agree, setAgree] = useState(false);
  return (
    <div className="gate" role="dialog" aria-modal="true" aria-labelledby="gate-title">
      <div className="gatebox">
        <h2 id="gate-title">Before you search</h2>
        <p className="lead">
          Search Quest provides public-record and contact information for <strong>personal use only</strong>. It is
          <strong> not</strong> a consumer reporting agency, and the results are <strong>not</strong> a consumer report.
        </p>

        <ul className="gaterules">
          <li><span className="x">✕</span><span>Do not use it for <strong>employment</strong> screening or hiring decisions.</span></li>
          <li><span className="x">✕</span><span>Do not use it for <strong>tenant or housing</strong> screening.</span></li>
          <li><span className="x">✕</span><span>Do not use it for <strong>credit, lending, or insurance</strong> decisions.</span></li>
          <li><span className="x">✕</span><span>Do not use it to <strong>stalk, harass, or harm</strong> anyone.</span></li>
        </ul>

        <label className="gatecheck">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>
            I understand and agree that I will not use Search Quest or any information from it — including public
            records such as bankruptcy filings — for employment, tenant screening, credit, insurance, or any other
            purpose covered by the Fair Credit Reporting Act (FCRA) or the Driver&apos;s Privacy Protection Act, and I
            agree to use it only for lawful, personal purposes.
          </span>
        </label>

        <button className="go" disabled={!agree} onClick={onAccept}>
          I Agree &amp; Continue
        </button>

        <p className="gatelaw">
          Misuse of consumer information can carry civil and criminal penalties. By continuing you accept full
          responsibility for how you use these results.
        </p>
      </div>
    </div>
  );
}
