import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownRight, ArrowUpRight, ArrowUpRightFromSquare, Building2,
  ChevronDown, CircleHelp, Database, FileText, HeartPulse, Layers3, LoaderCircle, LocateFixed,
  MapPin, Menu, Printer, Search, ShieldCheck, SlidersHorizontal, Stethoscope, Type, X,
} from "lucide-react";
import {
  CircleMarker, MapContainer, TileLayer, Tooltip as LeafletTooltip, useMap,
} from "react-leaflet";
import {
  Facility, getFacilities, getNationwidePlaces, getPlaces, INDICATORS, IndicatorId, PlaceEstimate, STATES,
} from "./data";

type PageId = "overview" | "map" | "compare" | "disparities" | "sources";
type Coordinates = { latitude: number; longitude: number };
type VisitBudget = "" | "under-25" | "26-75" | "76-150" | "151-plus";
type UserContext = {
  age: string;
  sex: string;
  budget: VisitBudget;
  condition: IndicatorId | "";
  state: string;
  place: string;
  radius: number;
  coordinates?: Coordinates;
};

const NAV_ITEMS: { id: PageId; label: string; icon: typeof Activity; section?: string }[] = [
  { id: "overview", label: "Overview", icon: Layers3, section: "WORKSPACE" },
  { id: "map", label: "Healthcare map", icon: MapPin },
  { id: "compare", label: "Compare clinics", icon: Building2, section: "ANALYSIS" },
  { id: "disparities", label: "Disparity explorer", icon: SlidersHorizontal },
  { id: "sources", label: "Data & sources", icon: Database, section: "REFERENCE" },
];

const VISIT_BUDGETS: { value: Exclude<VisitBudget, "">; label: string }[] = [
  { value: "under-25", label: "Under $25" },
  { value: "26-75", label: "$25–$75" },
  { value: "76-150", label: "$76–$150" },
  { value: "151-plus", label: "$151 or more" },
];

const STATE_CENTERS: Record<string, [number, number]> = {
  AL: [32.8, -86.8], AK: [64.2, -152.4], AZ: [34.3, -111.7], AR: [34.8, -92.2], CA: [37.2, -119.5],
  CO: [39, -105.5], CT: [41.6, -72.7], DE: [39.1, -75.4], DC: [38.9, -77], FL: [28.2, -82],
  GA: [32.7, -83.4], HI: [20.9, -157.5], ID: [44.2, -114.5], IL: [40, -89], IN: [40, -86.1],
  IA: [42, -93.5], KS: [38.5, -98.3], KY: [37.7, -85.3], LA: [31.1, -91.8], ME: [45.3, -69],
  MD: [39, -76.7], MA: [42.3, -71.8], MI: [44.3, -85.6], MN: [46,-94.5], MS: [32.7, -89.7],
  MO: [38.5, -92.5], MT: [46.9, -110.5], NE: [41.5, -99.8], NV: [39.3, -116.6], NH: [43.8, -71.6],
  NJ: [40.1, -74.5], NM: [34.4, -106], NY: [42.9, -75.5], NC: [35.5, -79.4], ND: [47.5, -100.5],
  OH: [40.4, -82.8], OK: [35.6, -97.5], OR: [44, -120.5], PA: [41.2, -77.2], RI: [41.6, -71.5],
  SC: [33.8, -80.9], SD: [44.5, -100], TN: [35.8, -86.4], TX: [31.5, -99.4], UT: [39.3, -111.7],
  VT: [44, -72.7], VA: [37.6, -79], WA: [47.4, -120.5], WV: [38.6, -80.6], WI: [44.5, -89.5],
  WY: [43.1, -107.6],
};

const fmt = new Intl.NumberFormat("en-US");
const QUICK_INDICATOR_IDS: IndicatorId[] = ["DIABETES", "CASTHMA", "BPHIGH", "OBESITY", "COPD", "DEPRESSION"];
const percent = (value: number | string | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${parsed.toFixed(1)}%` : "—";
};
const countyKey = (name: string) => name.toLowerCase().replace(/\s+county$/, "").replace(/[^a-z0-9]/g, "");
const facilityDistance = (facility: Facility, location: Coordinates) => {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latDifference = radians(facility.latitude - location.latitude);
  const lonDifference = radians(facility.longitude - location.longitude);
  const a = Math.sin(latDifference / 2) ** 2 + Math.cos(radians(location.latitude)) * Math.cos(radians(facility.latitude)) * Math.sin(lonDifference / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
const formatDistance = (miles: number) => `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi away`;

function normalizeZipSearch(query: string) {
  const value = query.trim();
  return /^\d{5}(?:[-\s]?\d{4})?$/.test(value) ? value.replace(/\D/g, "") : "";
}

function matchesFacilityZip(zip: string, query: string) {
  const normalizedQuery = normalizeZipSearch(query);
  return Boolean(normalizedQuery && zip.replace(/\D/g, "").startsWith(normalizedQuery));
}

function filterFacilities(facilities: Facility[], query: string, stateFilter: string, typeFilter: string, location?: Coordinates, radiusMiles = Infinity) {
  const search = query.trim().toLowerCase();
  return facilities.filter((facility) => {
    if (stateFilter !== "ALL" && facility.state !== stateFilter) return false;
    if (typeFilter !== "ALL" && facility.centerType !== typeFilter) return false;
    if (location && !search && facilityDistance(facility, location) > radiusMiles) return false;
    if (!search) return true;
    const text = `${facility.name} ${facility.city} ${facility.state} ${facility.zip} ${facility.county} ${facility.address}`.toLowerCase();
    return text.includes(search) || matchesFacilityZip(facility.zip, search);
  });
}

function rankFacilityMatches(facilities: Facility[], query: string, location?: Coordinates) {
  const search = query.trim().toLowerCase();
  const rank = (facility: Facility) => {
    const name = facility.name.toLowerCase();
    const city = facility.city.toLowerCase();
    const county = facility.county.toLowerCase().replace(/\s+county$/, "");
    if (name === search || city === search || county === search || matchesFacilityZip(facility.zip, search)) return 0;
    if (name.startsWith(search) || city.startsWith(search) || county.startsWith(search)) return 1;
    if (facility.state.toLowerCase() === search) return 2;
    return 3;
  };
  return [...facilities].sort((a, b) => {
    if (location && !search) return facilityDistance(a, location) - facilityDistance(b, location);
    return rank(a) - rank(b) || (location ? facilityDistance(a, location) - facilityDistance(b, location) : a.name.localeCompare(b.name));
  });
}

function sampleFacilitiesByState(facilities: Facility[], perState: number) {
  const grouped = new Map<string, Facility[]>();
  for (const facility of facilities) {
    const group = grouped.get(facility.state) ?? [];
    group.push(facility);
    grouped.set(facility.state, group);
  }
  return [...grouped.values()].flatMap((group) => {
    if (group.length <= perState) return group;
    return Array.from({ length: perState }, (_, index) => group[Math.floor(index * group.length / perState)]);
  });
}

function App() {
  const [page, setPage] = useState<PageId>("overview");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [state, setState] = useState("CA");
  const [mapState, setMapState] = useState("ALL");
  const [indicator, setIndicator] = useState<IndicatorId>("DIABETES");
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [largeText, setLargeText] = useState(false);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [places, setPlaces] = useState<PlaceEstimate[]>([]);
  const [nationwidePlaces, setNationwidePlaces] = useState<PlaceEstimate[]>([]);
  const [facilityLoading, setFacilityLoading] = useState(true);
  const [placesLoading, setPlacesLoading] = useState(true);
  const [facilityError, setFacilityError] = useState("");
  const [placesError, setPlacesError] = useState("");
  const [nationwidePlacesLoading, setNationwidePlacesLoading] = useState(true);
  const [nationwidePlacesError, setNationwidePlacesError] = useState("");
  const [facilityQuery, setFacilityQuery] = useState("");
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);

  useEffect(() => {
    let active = true;
    setFacilityLoading(true);
    getFacilities().then((rows) => {
      if (active) {
        setFacilities(rows);
        setFacilityError("");
      }
    }).catch((error: unknown) => {
      if (active) setFacilityError(error instanceof Error ? error.message : "Could not load HRSA site data.");
    }).finally(() => {
      if (active) setFacilityLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setPlacesLoading(true);
    getPlaces(state, indicator).then((rows) => {
      if (active) {
        setPlaces(rows);
        setPlacesError("");
      }
    }).catch((error: unknown) => {
      if (active) {
        setPlaces([]);
        setPlacesError(error instanceof Error ? error.message : "Could not load CDC PLACES estimates.");
      }
    }).finally(() => {
      if (active) setPlacesLoading(false);
    });
    return () => { active = false; };
  }, [state, indicator]);

  useEffect(() => {
    let active = true;
    setNationwidePlacesLoading(true);
    getNationwidePlaces(indicator).then((rows) => {
      if (active) {
        setNationwidePlaces(rows);
        setNationwidePlacesError("");
      }
    }).catch((error: unknown) => {
      if (active) {
        setNationwidePlaces([]);
        setNationwidePlacesError(error instanceof Error ? error.message : "Could not load CDC PLACES map estimates.");
      }
    }).finally(() => {
      if (active) setNationwidePlacesLoading(false);
    });
    return () => { active = false; };
  }, [indicator]);

  const changeState = (value: string) => {
    setState(value);
    setMapState(value);
    setSelectedFacility(null);
  };
  const changeMapState = (value: string) => {
    setMapState(value);
    setSelectedFacility(null);
    if (value !== "ALL") setState(value);
  };
  const clearDeviceLocation = () => {
    setUserContext((current) => current ? { ...current, place: "", coordinates: undefined } : current);
    setFacilityQuery("");
    setMapState(state);
  };
  const showFacilityOnMap = (facility: Facility) => {
    setSelectedFacility(facility);
    setState(facility.state);
    setMapState(facility.state);
    setPage("map");
  };
  const startExploring = (context: UserContext) => {
    setUserContext(context);
    setState(context.state);
    setMapState(context.coordinates || context.place ? "ALL" : context.state);
    setFacilityQuery(context.coordinates ? "" : context.place);
    if (context.condition) setIndicator(context.condition);
  };
  const activeIndicator = INDICATORS.find((item) => item.id === indicator)!;
  const overviewMapFacilities = useMemo(() => sampleFacilitiesByState(facilities, 45), [facilities]);
  if (!userContext) return <Welcome onContinue={startExploring} />;
  return (
    <div className={`app-shell ${largeText ? "large-text" : ""}`}>
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><FairCareMark size={26} /></div>
          <div><div className="brand-name">Fair Care</div><div className="brand-caption">CARE FOR EVERY COMMUNITY</div></div>
          <button className="mobile-close icon-button" onClick={() => setMobileMenu(false)} aria-label="Close menu"><X size={18} /></button>
        </div>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <div className="workspace-select"><div className="workspace-avatar">US</div><span>United States</span><ChevronDown size={15} /></div>
        <nav className="side-nav" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <div key={item.id}>
              {item.section && <div className="nav-section">{item.section}</div>}
              <button
                className={`nav-item ${page === item.id ? "nav-item-active" : ""}`}
                onClick={() => { setPage(item.id); setMobileMenu(false); }}
                aria-current={page === item.id ? "page" : undefined}
              >
                <item.icon size={18} strokeWidth={1.8} /><span>{item.label}</span>
                {item.id === "map" && <span className="nav-count">{facilityLoading ? "…" : fmt.format(facilities.length)}</span>}
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="data-status"><span className={`status-dot ${facilityError || placesError ? "status-warning" : ""}`} /><span>{facilityError || placesError ? "Data connection issue" : "Public data connected"}</span><span className="status-live">{facilityError || placesError ? "CHECK" : "LIVE"}</span></div>
          <div className="sidebar-note">Built for better community health decisions.</div>
          <a className="sidebar-source" href="https://www.cdc.gov/places/" target="_blank" rel="noreferrer">About Fair Care <ArrowUpRightFromSquare size={13} /></a>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <button className="mobile-menu icon-button" onClick={() => setMobileMenu(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="breadcrumb"><span>Fair Care</span><span className="crumb-slash">/</span><strong>{NAV_ITEMS.find((item) => item.id === page)?.label}</strong></div>
          <div className="topbar-right">
            <span className="topbar-date">{activeIndicator.short.toUpperCase()} · CDC PLACES 2023</span>
            <button className="accessibility-button" onClick={() => setLargeText((current) => !current)} aria-pressed={largeText} title="Change text size"><Type size={18} /><span>{largeText ? "Standard text" : "Larger text"}</span></button>
            <button className="accessibility-button print-button" onClick={() => window.print()} title="Print this page"><Printer size={17} /><span>Print</span></button>
            <div className="user-avatar">FC</div>
          </div>
        </header>
        <main className="content">
          <div className="safety-banner" role="note"><ShieldCheck size={18} /><span><strong>Need urgent help?</strong> Call <a href="tel:911">911</a> for an emergency. Call or text <a href="tel:988">988</a> for mental health crisis support in the U.S.</span></div>
          {page === "overview" && <Overview facilities={facilities} previewFacilities={overviewMapFacilities} facilitiesLoading={facilityLoading} facilityError={facilityError} places={places} placesLoading={placesLoading} placesError={placesError} communityEstimates={nationwidePlaces} communityEstimatesLoading={nationwidePlacesLoading} communityEstimatesError={nationwidePlacesError} indicator={activeIndicator} state={state} onNavigate={setPage} onSelectFacility={showFacilityOnMap} onSetIndicator={setIndicator} userContext={userContext} facilityQuery={facilityQuery} setFacilityQuery={setFacilityQuery} onClearContext={() => { setUserContext(null); setSelectedFacility(null); setFacilityQuery(""); setState("CA"); setMapState("ALL"); setIndicator("DIABETES"); }} onFindCare={() => setPage("map")} />}
          {page === "map" && <HealthcareMap facilities={facilities} loading={facilityLoading} error={facilityError} query={facilityQuery} setQuery={setFacilityQuery} selected={selectedFacility} setSelected={setSelectedFacility} stateFilter={mapState} setStateFilter={changeMapState} indicator={indicator} setIndicator={setIndicator} estimates={nationwidePlaces} placesLoading={nationwidePlacesLoading} placesError={nationwidePlacesError} location={userContext.coordinates} radiusMiles={userContext.radius} onClearLocation={clearDeviceLocation} />}
          {page === "compare" && <ClinicComparison facilities={facilities} estimates={nationwidePlaces} estimatesLoading={nationwidePlacesLoading} estimatesError={nationwidePlacesError} facilitiesLoading={facilityLoading} facilitiesError={facilityError} indicator={activeIndicator} query={facilityQuery} setQuery={setFacilityQuery} location={userContext.coordinates} radiusMiles={userContext.radius} state={userContext.coordinates || userContext.place.trim() || facilityQuery.trim() ? "ALL" : userContext.state} age={userContext.age} sex={userContext.sex} onSelectFacility={showFacilityOnMap} />}
          {page === "disparities" && <Disparities state={state} setState={changeState} indicator={indicator} setIndicator={setIndicator} places={places} loading={placesLoading} error={placesError} />}
          {page === "sources" && <Sources />}
        </main>
        <footer className="footer"><span>Fair Care is an educational public data tool—not medical advice.</span><span>Data may be incomplete or revised by its original publisher.</span></footer>
      </div>
    </div>
  );
}

export default App;

function Welcome({ onContinue }: { onContinue: (context: UserContext) => void }) {
  const [draft, setDraft] = useState<UserContext>({ age: "", sex: "", budget: "", condition: "", state: "CA", place: "", radius: 25 });
  const [locationMessage, setLocationMessage] = useState("");
  const [locating, setLocating] = useState(false);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage("This browser cannot share a location. Enter a city or ZIP code instead.");
      return;
    }
    setLocating(true);
    setLocationMessage("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setDraft((current) => ({ ...current, place: "Current location", coordinates: { latitude: coords.latitude, longitude: coords.longitude } }));
        setLocationMessage("Location ready. It stays in this browser tab and helps find nearby HRSA sites.");
        setLocating(false);
      },
      () => {
        setLocationMessage("We could not access your location. You can enter a city or ZIP code instead.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  return <main className="welcome-page">
    <div className="welcome-card">
      <div className="welcome-brand"><div className="brand-mark"><FairCareMark size={32} /></div><div><div className="brand-name">Fair Care</div><div className="brand-caption">CARE FOR EVERY COMMUNITY</div></div></div>
      <div className="welcome-intro"><div className="eyebrow">WELCOME · STEP 1 OF 1</div><h1>Care starts with you</h1><p>Choose an optional health topic, budget, and area. We’ll use them to set up your community view and help you explore nearby health centers.</p></div>
      <form className="welcome-form" onSubmit={(event) => { event.preventDefault(); onContinue(draft); }}>
        <div className="welcome-section-title"><span>01</span><div><strong>Your health focus</strong><small>These details are optional. Skip any question you do not want to answer.</small></div></div>
        <div className="welcome-grid">
          <label className="welcome-field"><span>Age range</span><select value={draft.age} onChange={(event) => setDraft((current) => ({ ...current, age: event.target.value }))}><option value="">Prefer not to say</option><option value="under-18">Under 18</option><option value="18-34">18–34</option><option value="35-49">35–49</option><option value="50-64">50–64</option><option value="65-plus">65 or older</option></select></label>
          <label className="welcome-field"><span>Sex <small>(optional)</small></span><select value={draft.sex} onChange={(event) => setDraft((current) => ({ ...current, sex: event.target.value }))}><option value="">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="another">Another response</option></select></label>
          <label className="welcome-field welcome-field-wide"><span>Health condition or topic</span><select aria-label="Health condition or topic" aria-describedby="condition-help" value={draft.condition} onChange={(event) => setDraft((current) => ({ ...current, condition: event.target.value as IndicatorId | "" }))}><option value="">Choose a topic or skip</option><IndicatorOptions /></select><small id="condition-help">Choose from 35 CDC community measures. Some choices describe access or community needs, not diseases.</small></label>
          <label className="welcome-field welcome-field-wide"><span>Budget per visit <small>(optional)</small></span><select aria-label="Budget per visit" aria-describedby="budget-help" value={draft.budget} onChange={(event) => setDraft((current) => ({ ...current, budget: event.target.value as VisitBudget }))}><option value="">Prefer not to say</option>{VISIT_BUDGETS.map(({ value, label }) => <option value={value} key={value}>{label}</option>)}</select><small id="budget-help">Clinic prices aren’t available in our data, so this won’t change clinic results.</small></label>
        </div>
        <div className="welcome-section-title welcome-section-location"><span>02</span><div><strong>Choose an area</strong><small>This helps set the community data and health center search.</small></div></div>
        <div className="welcome-grid">
          <label className="welcome-field"><span>State for community data</span><select value={draft.state} onChange={(event) => setDraft((current) => ({ ...current, state: event.target.value }))}><StateOptions /></select></label>
          <label className="welcome-field"><span>City or ZIP code <small>(optional)</small></span><input value={draft.coordinates ? "" : draft.place} onChange={(event) => setDraft((current) => ({ ...current, place: event.target.value, coordinates: undefined }))} placeholder="For example, 94103 or Fresno" autoComplete="postal-code" /></label>
          <label className="welcome-field"><span>Search within</span><select value={draft.radius} onChange={(event) => setDraft((current) => ({ ...current, radius: Number(event.target.value) }))}><option value={5}>5 miles</option><option value={10}>10 miles</option><option value={25}>25 miles</option><option value={50}>50 miles</option><option value={100}>100 miles</option></select><small>Used for device location; typed ZIP/city is a text search.</small></label>
          <button type="button" className="location-button" onClick={useMyLocation} disabled={locating}><LocateFixed size={18} />{locating ? "Finding your location…" : draft.coordinates ? "Location added" : "Use my device location"}</button>
        </div>
        {locationMessage && <p className="location-message" role="status">{locationMessage}</p>}
        <div className="privacy-note"><ShieldCheck size={19} /><p><strong>Your privacy comes first.</strong> Your age, sex, budget, health topic, and location stay in this open tab. They are not saved to an account or sent to our data sources. Location access happens only if you choose the button above.</p></div>
        <div className="welcome-limit"><CircleHelp size={17} /><p>Fair Care shows community estimates, not your personal health or risk. Current CDC measures describe adults; your age and sex do not change them. Clinic insurance, condition-specific expertise, hours, wait times, and accessibility details are not yet available here.</p></div>
        <button className="button button-primary welcome-submit" type="submit">Continue to Fair Care <ArrowUpRight size={20} /></button>
      </form>
      <p className="welcome-emergency">Need urgent help? Call <a href="tel:911">911</a>. For mental health crisis support in the U.S., call or text <a href="tel:988">988</a>.</p>
    </div>
  </main>;
}

function PageHeading({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: React.ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{children && <div className="heading-actions">{children}</div>}</div>;
}

function SelectControl({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <label className="select-wrap"><span className="sr-only">{label}</span><select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>{children}</select><ChevronDown size={15} /></label>;
}

function StateOptions() {
  return <>{STATES.map(([abbr, name]) => <option key={abbr} value={abbr}>{name}</option>)}</>;
}

function IndicatorOptions() {
  const categories = [...new Set(INDICATORS.map((item) => item.category))];
  return <>{categories.map((category) => <optgroup key={category} label={category}>{INDICATORS.filter((item) => item.category === category).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</optgroup>)}</>;
}

function FairCareMark({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <path d="M24 7a8 8 0 0 1 16 0v17h17a8 8 0 0 1 0 16H40v17a8 8 0 0 1-16 0V40H7a8 8 0 0 1 0-16h17V7Z" fill="currentColor" />
    <path d="M36 17c-10 12-10 24-3 32 0-11 2-20 8-31" fill="none" stroke="#fff9f4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

function DataNotice({ error, loading, label }: { error: string; loading: boolean; label: string }) {
  if (loading) return <div className="inline-notice"><LoaderCircle size={16} className="spin" /> Loading {label} from the public source…</div>;
  if (error) return <div className="error-notice"><CircleHelp size={17} /><div><strong>Couldn’t load {label}</strong><span>{error} Check your connection or visit the source directly.</span></div></div>;
  return null;
}

function Overview({ facilities, previewFacilities, facilitiesLoading, facilityError, places, placesLoading, placesError, communityEstimates, communityEstimatesLoading, communityEstimatesError, indicator, state, onNavigate, onSelectFacility, onSetIndicator, userContext, facilityQuery, setFacilityQuery, onClearContext, onFindCare }: {
  facilities: Facility[]; previewFacilities: Facility[]; facilitiesLoading: boolean; facilityError: string; places: PlaceEstimate[]; placesLoading: boolean; placesError: string; communityEstimates: PlaceEstimate[]; communityEstimatesLoading: boolean; communityEstimatesError: string;
  indicator: (typeof INDICATORS)[number]; state: string; onNavigate: (page: PageId) => void; onSelectFacility: (facility: Facility) => void; onSetIndicator: (value: IndicatorId) => void;
  userContext: UserContext; facilityQuery: string; setFacilityQuery: (value: string) => void; onClearContext: () => void; onFindCare: () => void;
}) {
  const avg = places.length ? places.reduce((sum, row) => sum + Number(row.data_value), 0) / places.length : 0;
  const stateName = STATES.find(([abbr]) => abbr === state)?.[1] ?? state;
  const highest = [...places].sort((a, b) => Number(b.data_value) - Number(a.data_value)).slice(0, 4);
  const clinicMatches = useMemo(() => rankFacilityMatches(
    filterFacilities(facilities, facilityQuery, "ALL", "ALL", userContext.coordinates, userContext.radius),
    facilityQuery,
    userContext.coordinates,
  ).slice(0, 5), [facilities, facilityQuery, userContext.coordinates, userContext.radius]);
  return <>
    <PageHeading eyebrow="COMMUNITY HEALTH SNAPSHOT" title="Welcome to Fair Care" description="A clearer view of health and care access in the communities that matter.">
      <button className="button button-outline" onClick={() => onNavigate("sources")}><Database size={16} /> Explore data sources</button>
    </PageHeading>
    <ClinicFinder facilities={clinicMatches} loading={facilitiesLoading} error={facilityError} query={facilityQuery} setQuery={setFacilityQuery} location={userContext.coordinates} radiusMiles={userContext.radius} estimates={communityEstimates} estimatesLoading={communityEstimatesLoading} estimatesError={communityEstimatesError} indicator={indicator} onSelect={onSelectFacility} onOpenMap={() => onNavigate("map")} onCompare={() => onNavigate("compare")} />
    <div className="overview-banner">
      <div className="banner-icon"><Activity size={21} /></div>
      <div className="banner-copy"><strong>Health is shaped by where we live.</strong><span>Explore community-level estimates and health center locations, grounded in public data.</span></div>
      <button className="banner-link" onClick={() => onNavigate("disparities")}>Explore disparities <ArrowUpRight size={16} /></button>
    </div>
    <section className="card personal-focus-card">
      <div className="personal-focus-copy"><div className="eyebrow">YOUR STARTING POINT</div><h2>{userContext.condition ? indicator.label : "A community view, set up for you"}</h2><p>{userContext.coordinates ? "Using your device location to focus nearby health center search." : userContext.place ? `Health center search is ready for ${userContext.place}.` : `Community estimates are set to ${stateName}.`}</p><small>Age and sex do not change these adult community estimates or clinic sorting. The selected topic adds county-level context; it does not identify a clinic’s specialty.</small>{userContext.budget && <small className="budget-context">Budget per visit: {VISIT_BUDGETS.find(({ value }) => value === userContext.budget)?.label}. Clinic prices aren’t available, so this won’t change clinic results.</small>}</div>
      <div className="personal-focus-actions"><button className="button button-primary" onClick={onFindCare}><MapPin size={23} /> Find health centers</button><button className="text-button" onClick={onClearContext}>Clear my choices</button></div>
    </section>
    <div className="stat-grid">
      <StatCard label="Active health center sites" value={facilitiesLoading ? "…" : facilityError ? "—" : fmt.format(facilities.length)} hint={facilityError ? "Source currently unavailable" : "HRSA service delivery sites"} icon={Building2} tone="blue" />
      <StatCard label={`${indicator.short} · ${state}`} value={placesLoading ? "…" : placesError || !places.length ? "—" : percent(avg)} hint="Mean across available county estimates" icon={HeartPulse} tone="teal" />
      <StatCard label="County estimates available" value={placesLoading ? "…" : placesError ? "—" : fmt.format(places.length)} hint={`${stateName} · CDC PLACES · 2023`} icon={MapPin} tone="purple" />
      <StatCard label="Public data, one place" value="3" hint="CDC PLACES, HRSA + OpenStreetMap" icon={Database} tone="amber" />
    </div>
    {(facilityError || placesError) && <div className="notice-stack"><DataNotice error={facilityError} loading={false} label="HRSA site data" /><DataNotice error={placesError} loading={false} label="CDC estimates" /></div>}
    <div className="dashboard-grid">
      <section className="card map-card">
        <div className="card-heading"><div><h2>Healthcare access across the U.S.</h2><p>HRSA active health center service delivery sites</p></div><button className="text-button" onClick={() => onNavigate("map")}>Open full map <ArrowUpRight size={15} /></button></div>
        <div className="map-frame map-frame-small">
          <FacilityMap facilities={previewFacilities} selected={null} onSelect={onSelectFacility} height="100%" />
          {facilitiesLoading && <div className="map-overlay"><LoaderCircle size={18} className="spin" /> Loading HRSA locations…</div>}
          {facilityError && <div className="map-overlay map-overlay-error">Location data is unavailable. Try again when online.</div>}
        </div>
        <div className="map-legend"><span><i className="legend-dot legend-facility" /> HRSA sites · per-state map preview</span><span>Open full map to search all {fmt.format(facilities.length)} sites</span><span>OpenStreetMap © contributors</span></div>
      </section>
      <section className="card insights-card">
        <div className="card-heading"><div><h2>Community snapshot</h2><p>{stateName} · {indicator.label} · 2023</p></div><span className="live-tag"><span /> LIVE DATA</span></div>
        {placesLoading ? <div className="empty-panel"><LoaderCircle className="spin" size={20} /><span>Loading county estimates…</span></div> : placesError ? <EmptyState text="Estimates could not be loaded from CDC PLACES." /> : highest.length ? <div className="insight-list">
          {highest.map((row, index) => <div className="insight-row" key={row.locationid}><span className={`rank rank-${index + 1}`}>{String(index + 1).padStart(2, "0")}</span><div className="insight-name"><strong>{row.locationname} County</strong><span>{row.measure}</span></div><strong className="insight-value">{percent(row.data_value)}</strong></div>)}
          <div className="insight-footnote">Highest estimates among counties returned for this state and indicator. Estimates describe populations, not individuals.</div>
        </div> : <EmptyState text="No county estimates are available for this selection." />}
      </section>
      <section className="card indicator-card">
        <div className="card-heading"><div><h2>Explore health indicators</h2><p>Population-level estimates for community context</p></div><button className="text-button" onClick={() => onNavigate("disparities")}>Open explorer <ArrowUpRight size={15} /></button></div>
        <div className="indicator-pills">{QUICK_INDICATOR_IDS.map((id) => INDICATORS.find((item) => item.id === id)!).map((item) => <button key={item.id} className={`indicator-pill ${item.id === indicator.id ? "indicator-pill-active" : ""}`} onClick={() => { onSetIndicator(item.id); onNavigate("disparities"); }}><span className={`indicator-dot dot-${item.category === "Health conditions" ? "blue" : item.category === "Care & prevention" ? "teal" : "purple"}`} />{item.short}</button>)}</div>
      </section>
      <section className="card quick-card">
        <div className="card-heading"><div><h2>Continue exploring</h2><p>Tools for community health analysis</p></div></div>
        <div className="quick-links">
          <button onClick={() => onNavigate("compare")}><div className="quick-icon"><Building2 size={17} /></div><div><strong>Compare clinics</strong><span>Review up to three HRSA health centers</span></div><ArrowUpRight size={15} /></button>
          <button onClick={() => onNavigate("map")}><div className="quick-icon quick-icon-teal"><MapPin size={17} /></div><div><strong>Find health centers</strong><span>Search official HRSA sites</span></div><ArrowUpRight size={15} /></button>
        </div>
      </section>
    </div>
  </>;
}

function ClinicFinder({ facilities, loading, error, query, setQuery, location, radiusMiles, estimates, estimatesLoading, estimatesError, indicator, onSelect, onOpenMap, onCompare }: {
  facilities: Facility[]; loading: boolean; error: string; query: string; setQuery: (value: string) => void;
  location?: Coordinates; radiusMiles: number; estimates: PlaceEstimate[]; estimatesLoading: boolean; estimatesError: string; indicator: (typeof INDICATORS)[number];
  onSelect: (facility: Facility) => void; onOpenMap: () => void; onCompare: () => void;
}) {
  const hasSearch = Boolean(query.trim() || location);
  const title = location && !query.trim() ? "Closest health centers" : query.trim() ? "Clinic search results" : "Find health centers";
  const description = query.trim()
    ? "HRSA health centers matching your search. These are not hospital ratings or medical recommendations."
    : location
    ? `Sorted by straight-line distance within ${radiusMiles} miles—not by quality or medical suitability.`
    : "Search official HRSA health center locations by city, ZIP code, county, or clinic name.";
  return <section className="card clinic-finder-card" aria-labelledby="clinic-finder-title">
    <div className="clinic-finder-header">
      <div><div className="eyebrow">CLINIC FINDER</div><h2 id="clinic-finder-title">{title}</h2><p>{description}</p></div>
    <div className="clinic-finder-actions"><button className="button button-outline clinic-map-button" onClick={onOpenMap}><MapPin size={17} /> Open clinic map</button><button className="button button-outline clinic-map-button" onClick={onCompare}><Building2 size={17} /> Compare clinics</button></div>
    </div>
    <label className="search-field clinic-finder-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Enter a city, ZIP code, county, or clinic name" aria-label="Find a clinic by location or name" />{query && <button aria-label="Clear clinic search" onClick={() => setQuery("")}><X size={17} /></button>}</label>
    {loading ? <div className="clinic-finder-empty"><LoaderCircle size={19} className="spin" /> Loading official HRSA clinic locations…</div>
      : error ? <div className="clinic-finder-empty">{error} Try again later or open the map.</div>
        : !hasSearch ? <div className="clinic-finder-empty">Enter a location above to see matching clinics, or use device location during setup for nearby results.</div>
          : facilities.length ? <div className="clinic-finder-results">{facilities.map((facility, index) => <button className="clinic-result" key={`${facility.name}-${facility.zip}-${index}`} onClick={() => onSelect(facility)} aria-label={`View ${facility.name} on the map`}>
            <MapPin size={19} /><span className="clinic-result-content"><strong>{facility.name}</strong><small>{[facility.address, `${facility.city}, ${facility.state} ${facility.zip}`, facility.county].filter(Boolean).join(" · ")}</small><em>{facility.centerType}{location ? ` · ${formatDistance(facilityDistance(facility, location))}` : ""}</em>{facility.services && <small><strong>HRSA services:</strong> {facility.services}</small>}<ClinicCommunityEstimate facility={facility} estimates={estimates} loading={estimatesLoading} error={estimatesError} indicator={indicator} /></span><span className="clinic-result-action">View on map <ArrowUpRight size={15} /></span>
          </button>)}</div>
            : <div className="clinic-finder-empty">No matching clinics found. Check the spelling or try a city, ZIP code, or county.</div>}
    <div className="clinic-finder-disclaimer"><ShieldCheck size={15} /> HRSA health centers—not a full hospital directory. County statistics describe residents, not this clinic or its patients.</div>
  </section>;
}

function findFacilityEstimate(facility: Facility, estimates: PlaceEstimate[]) {
  if (!facility.county) return undefined;
  return estimates.find((estimate) => estimate.stateabbr === facility.state && countyKey(estimate.locationname) === countyKey(facility.county));
}

function ClinicCommunityEstimate({ facility, estimates, loading, error = "", indicator }: { facility: Facility; estimates: PlaceEstimate[]; loading: boolean; error?: string; indicator: (typeof INDICATORS)[number] }) {
  const estimate = findFacilityEstimate(facility, estimates);
  return <div className="clinic-community-estimate">
    <span className="clinic-community-label">CDC COMMUNITY ESTIMATE · 2023</span>
    <strong>{facility.county || "County unavailable"} · {indicator.short}: {loading ? "Loading…" : error ? "Unavailable" : estimate ? percent(estimate.data_value) : "Not available"}</strong>
    {estimate && !error && <small>{estimate.low_confidence_limit && estimate.high_confidence_limit ? `95% CI ${percent(estimate.low_confidence_limit)}–${percent(estimate.high_confidence_limit)} · ` : ""}{estimate.measure}</small>}
    {!loading && !estimate && <small>{error || "No matching county estimate is available for this site."}</small>}
    <small>Population estimate for county residents—not this center or its patients.</small>
  </div>;
}

function StatCard({ label, value, hint, icon: Icon, tone }: { label: string; value: string; hint: string; icon: typeof Activity; tone: string }) {
  return <div className="card stat-card"><div className="stat-top"><span>{label}</span><div className={`stat-icon tone-${tone}`}><Icon size={18} /></div></div><div className="stat-value">{value}</div><div className="stat-hint">{hint}</div></div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-panel"><Database size={19} /><span>{text}</span></div>;
}

function FacilityMap({ facilities, selected, onSelect, estimates = [], activeIndicator, height = "100%", fitKey = "", location, fitFacilityResults = false }: {
  facilities: Facility[]; selected: Facility | null; onSelect: (facility: Facility) => void; estimates?: PlaceEstimate[];
  activeIndicator?: string; height?: string; fitKey?: string; location?: Coordinates; fitFacilityResults?: boolean;
}) {
  const center: [number, number] = [39.5, -98.35];
  const sortedEstimateValues = estimates.map((estimate) => Number(estimate.data_value)).filter(Number.isFinite).sort((a, b) => a - b);
  const lowBand = sortedEstimateValues[Math.floor((sortedEstimateValues.length - 1) / 3)] ?? 0;
  const highBand = sortedEstimateValues[Math.floor(((sortedEstimateValues.length - 1) * 2) / 3)] ?? lowBand;
  return <MapContainer center={center} zoom={4} scrollWheelZoom className="leaflet-map" style={{ height, width: "100%" }} preferCanvas>
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <MapUpdater facilities={facilities} estimates={estimates} fitKey={fitKey} selected={selected} location={location} fitFacilityResults={fitFacilityResults} />
    {facilities.map((facility, index) => <CircleMarker
      key={`${facility.name}-${facility.zip}-${index}`}
      center={[facility.latitude, facility.longitude]}
      radius={selected === facility ? 7 : 3.2}
      pathOptions={{ color: selected === facility ? "#fff" : "#1d77c4", weight: selected === facility ? 2 : 0.6, fillColor: selected === facility ? "#0f5da5" : "#2788d2", fillOpacity: selected === facility ? 0.95 : 0.72 }}
      eventHandlers={{ click: () => onSelect(facility) }}
    ><LeafletTooltip direction="top" offset={[0, -4]}>{facility.name}</LeafletTooltip></CircleMarker>)}
    {estimates.filter((row) => row.geolocation?.coordinates?.length === 2).map((row) => {
      const [longitude, latitude] = row.geolocation!.coordinates;
      const value = Number(row.data_value);
      return <CircleMarker key={`estimate-${row.locationid}`} center={[latitude, longitude]} radius={Math.min(14, 5 + value / 5)} pathOptions={{ color: "#fff", weight: 1.5, fillColor: estimateColor(value, lowBand, highBand), fillOpacity: 0.82 }}>
        <LeafletTooltip direction="top"><strong>{row.locationname} County</strong><br />{activeIndicator}: {percent(value)}<br />CDC PLACES · {row.year}</LeafletTooltip>
      </CircleMarker>;
    })}
    {location && <CircleMarker center={[location.latitude, location.longitude]} radius={9} pathOptions={{ color: "#fff", weight: 3, fillColor: "#6b5acb", fillOpacity: 1 }}><LeafletTooltip direction="top">Your device location · stays in this tab</LeafletTooltip></CircleMarker>}
  </MapContainer>;
}

function MapUpdater({ facilities, estimates, fitKey, selected, location, fitFacilityResults }: { facilities: Facility[]; estimates: PlaceEstimate[]; fitKey: string; selected: Facility | null; location?: Coordinates; fitFacilityResults: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (selected) {
      map.setView([selected.latitude, selected.longitude], Math.max(map.getZoom(), 9), { animate: true });
      return;
    }
    if (location) {
      map.setView([location.latitude, location.longitude], 10, { animate: true });
      return;
    }
    if (fitFacilityResults && facilities.length) {
      map.fitBounds(facilities.map((facility) => [facility.latitude, facility.longitude] as [number, number]), { padding: [32, 32], maxZoom: 11 });
      return;
    }
    const points = estimates.filter((row) => row.geolocation?.coordinates?.length === 2).map((row) => [row.geolocation!.coordinates[1], row.geolocation!.coordinates[0]] as [number, number]);
    if (points.length) map.fitBounds(points, { padding: [28, 28], maxZoom: 7 });
    else if (facilities.length && fitKey) map.setView(STATE_CENTERS[fitKey] ?? [39.5, -98.35], fitKey ? 6 : 4);
  }, [map, facilities, estimates, fitKey, selected, location, fitFacilityResults]);
  return null;
}

function estimateColor(value: number, lowBand: number, highBand: number) {
  if (value >= highBand) return "#c64c54";
  if (value >= lowBand) return "#e1bd55";
  return "#34a99c";
}

function HealthcareMap({ facilities, loading, error, query, setQuery, selected, setSelected, stateFilter, setStateFilter, indicator, setIndicator, estimates, placesLoading, placesError, location, radiusMiles, onClearLocation }: {
  facilities: Facility[]; loading: boolean; error: string; query: string; setQuery: (value: string) => void; selected: Facility | null; setSelected: (facility: Facility | null) => void;
  stateFilter: string; setStateFilter: (value: string) => void; indicator: IndicatorId; setIndicator: (value: IndicatorId) => void;
  estimates: PlaceEstimate[]; placesLoading: boolean; placesError: string; location?: Coordinates; radiusMiles: number; onClearLocation: () => void;
}) {
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [showInfo, setShowInfo] = useState(true);
  const filtered = useMemo(
    () => filterFacilities(facilities, query, stateFilter, typeFilter, location, radiusMiles),
    [facilities, stateFilter, typeFilter, query, location, radiusMiles],
  );
  const mapFacilities = useMemo(
    () => filtered.length > 3000 ? sampleFacilitiesByState(filtered, 60) : filtered,
    [filtered],
  );
  const facilityTypes = useMemo(() => [...new Set(facilities.map((facility) => facility.centerType))].sort(), [facilities]);
  const topMatches = useMemo(() => {
    if (!query.trim() && !location) return [];
    return rankFacilityMatches(filtered, query, location).slice(0, 5);
  }, [filtered, query, location]);
  const visibleEstimates = useMemo(
    () => location && !query.trim() ? [] : estimates.filter((row) => stateFilter === "ALL" || row.stateabbr === stateFilter),
    [estimates, stateFilter, location, query],
  );
  const activeIndicator = INDICATORS.find((item) => item.id === indicator)!;
  const mapArea = stateFilter === "ALL" ? "United States" : STATES.find(([abbr]) => abbr === stateFilter)?.[1] ?? stateFilter;
  return <>
    <PageHeading eyebrow="HEALTHCARE ACCESS" title="Health center map" description={query.trim()
      ? "Showing official HRSA sites that match your search. Typed searches are not limited by your device-location radius."
      : location
        ? `Find official HRSA sites within ${radiusMiles} straight-line miles of your device location. This is not driving distance.`
        : `Explore active HRSA sites and 2023 ${activeIndicator.short} estimates across ${mapArea}.`}>
      <SelectControl label="Health indicator overlay" value={indicator} onChange={(value) => setIndicator(value as IndicatorId)}><IndicatorOptions /></SelectControl>
      <span className="source-chip"><span className="source-pulse" /> HRSA DATA</span>
    </PageHeading>
    <DataNotice error={error} loading={loading} label="HRSA health center sites" />
    <DataNotice error={placesError} loading={placesLoading} label={`CDC ${activeIndicator.short} county estimates`} />
    <div className="map-toolbar">
      <div className="search-field"><Search size={17} /><input value={query} onChange={(event) => { const value = event.target.value; setSelected(null); if (normalizeZipSearch(value)) setStateFilter("ALL"); setQuery(value); }} placeholder="Search site, city, county, ZIP…" aria-label="Search health centers" />{query && <button aria-label="Clear search" onClick={() => { setSelected(null); setQuery(""); }}><X size={15} /></button>}</div>
      <SelectControl label="Filter map by state" value={stateFilter} onChange={setStateFilter}><option value="ALL">All states</option><StateOptions /></SelectControl>
      <SelectControl label="Filter by center type" value={typeFilter} onChange={(value) => { setSelected(null); setTypeFilter(value); }}><option value="ALL">All center types</option>{facilityTypes.map((type) => <option value={type} key={type}>{type}</option>)}</SelectControl>
      {location && <button className="button button-outline map-filter" onClick={onClearLocation}><X size={16} /> Clear nearby search</button>}
      <button className="button button-outline map-filter" onClick={() => setShowInfo((current) => !current)}><CircleHelp size={16} /> {showInfo ? "Hide details" : "Show details"}</button>
    </div>
    {(query.trim() || location) && <div className="search-results-panel">
      <div className="search-results-heading"><strong>{location && !query.trim() ? "NEARBY HEALTH CENTERS" : "SEARCH MATCHES"}</strong><span>{location ? "Straight-line distance, not drive or transit time" : "Ordered by search relevance—not quality or ratings"}</span></div>
      {topMatches.length ? <div className="search-results">{topMatches.map((facility, index) => <button key={`${facility.name}-${facility.zip}-${index}`} onClick={() => setSelected(facility)}><MapPin size={15} /><span><strong>{facility.name}</strong><small>{facility.city}, {facility.state} {facility.zip}{facility.county ? ` · ${facility.county}` : ""}{location ? ` · ${formatDistance(facilityDistance(facility, location))}` : ""}</small><em>{facility.centerType}</em></span></button>)}</div> : <div className="search-no-results">{location && !query.trim() ? `No sites found within ${radiusMiles} miles. Increase the search area or clear nearby search.` : "No matching sites. Try another site name, city, county, state, or ZIP code."}</div>}
    </div>}
    <div className="map-layout">
      <section className="card map-card map-card-full">
        <div className="full-map-title"><span><i className="legend-dot legend-facility" /> {fmt.format(mapFacilities.length)}{mapFacilities.length < filtered.length ? ` of ${fmt.format(filtered.length)}` : ""} HRSA sites plotted</span><span><i className="legend-dot legend-estimate" /> {location && !query.trim() ? "County overlay hidden during nearby search" : `${fmt.format(visibleEstimates.length)} ${activeIndicator.short} county estimates · 2023`}</span><span>{location && !query.trim() ? `Within ${radiusMiles} miles · straight-line distance` : query.trim() ? "Typed search · all matching sites" : "Pan and zoom to explore"}</span></div>
        <div className="map-frame map-frame-large"><FacilityMap facilities={mapFacilities} selected={selected} onSelect={setSelected} estimates={visibleEstimates} activeIndicator={activeIndicator.short} fitKey={stateFilter === "ALL" ? "" : stateFilter} location={location} fitFacilityResults={Boolean(query.trim())} />
          {loading && <div className="map-overlay"><LoaderCircle size={18} className="spin" /> Downloading official HRSA locations…</div>}
          {!loading && !error && !filtered.length && <div className="map-overlay map-overlay-error">No facilities match this search. Try another location.</div>}
        </div>
        <div className="map-legend"><span><i className="legend-dot legend-facility" /> Facility locations · HRSA active sites</span>{(!location || query.trim()) && <span><i className="legend-dot legend-estimate" /> County estimates · CDC PLACES {activeIndicator.short}</span>}{mapFacilities.length < filtered.length && <span>At U.S. scale, a per-state subset is plotted to keep the map responsive; search or filter a state to inspect matching sites.</span>}<span>OpenStreetMap © contributors</span></div>
      </section>
      {showInfo && <aside className="card facility-panel">
        {selected ? <><div className="facility-panel-top"><span className="panel-kicker">HRSA SERVICE DELIVERY SITE</span><button className="icon-button" onClick={() => setSelected(null)} aria-label="Close details"><X size={16} /></button></div>
          <div className="facility-pin"><Building2 size={20} /></div><h2>{selected.name}</h2><span className="active-badge"><span /> Active site</span>
          <div className="detail-list"><DetailRow icon={MapPin} label="Address">{[selected.address, `${selected.city}, ${selected.state} ${selected.zip}`].filter(Boolean).join(", ")}</DetailRow>
            {selected.phone && <DetailRow icon={Stethoscope} label="Phone"><a href={`tel:${selected.phone}`}>{selected.phone}</a></DetailRow>}
            {selected.county && <DetailRow icon={Layers3} label="County">{selected.county}</DetailRow>}
            <DetailRow icon={Building2} label="Center type">{selected.centerType}</DetailRow>
            {selected.locationType && <DetailRow icon={Layers3} label="Site type">{selected.locationType}</DetailRow>}
            {selected.services && <DetailRow icon={HeartPulse} label="HRSA-listed services">{selected.services}</DetailRow>}
            {selected.website && <DetailRow icon={ArrowUpRightFromSquare} label="Website"><a href={selected.website.startsWith("http") ? selected.website : `https://${selected.website}`} target="_blank" rel="noreferrer">Visit site</a></DetailRow>}</div>
          <ClinicCommunityEstimate facility={selected} estimates={estimates} loading={placesLoading} error={placesError} indicator={activeIndicator} />
          <div className="panel-source-note"><ShieldCheck size={15} /> Facility details from HRSA's public service delivery site dataset.</div>
        </> : <div className="facility-empty"><div className="facility-pin"><MapPin size={20} /></div><h2>Select a site</h2><p>Click a marker on the map or search for a health center to view its available details.</p><div className="mini-stat"><span>Sites in current view</span><strong>{fmt.format(filtered.length)}</strong></div>        <div className="mini-stat"><span>Dataset</span><strong>HRSA download</strong></div></div>}
      </aside>}
    </div>
    {!loading && !error && <div className="data-footnote"><CircleHelp size={14} /> {fmt.format(facilities.length)} active geocoded sites loaded from the latest HRSA download. Some sites may lack complete contact or service details.</div>}
  </>;
}

function DetailRow({ icon: Icon, label, children }: { icon: typeof Activity; label: string; children: React.ReactNode }) {
  return <div className="detail-row"><Icon size={16} /><div><span>{label}</span><strong>{children}</strong></div></div>;
}

function ClinicComparison({ facilities, estimates, estimatesLoading, estimatesError, facilitiesLoading, facilitiesError, indicator, query, setQuery, location, radiusMiles, state, age, sex, onSelectFacility }: {
  facilities: Facility[]; estimates: PlaceEstimate[]; estimatesLoading: boolean; estimatesError: string; facilitiesLoading: boolean; facilitiesError: string;
  indicator: (typeof INDICATORS)[number]; query: string; setQuery: (value: string) => void; location?: Coordinates; radiusMiles: number; state: string; age: string; sex: string;
  onSelectFacility: (facility: Facility) => void;
}) {
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [clinicStateFilter, setClinicStateFilter] = useState(state);
  const zipSearch = normalizeZipSearch(query);
  const stateName = STATES.find(([abbr]) => abbr === clinicStateFilter)?.[1] ?? clinicStateFilter;
  const candidates = useMemo(() => {
    const matches = filterFacilities(facilities, query, clinicStateFilter, "ALL", location, radiusMiles);
    const uniqueMatches = [...new Map(matches.map((facility) => [facilityKey(facility), facility])).values()];
    return rankFacilityMatches(uniqueMatches, query, zipSearch ? undefined : location).slice(0, 12);
  }, [facilities, query, clinicStateFilter, location, radiusMiles, zipSearch]);
  const selectedFacilities = candidates.filter((facility) => selectedKeys.includes(facilityKey(facility)));
  const sortDescription = zipSearch
    ? "ZIP code searches include all states and are not limited by your device-location radius."
    : query.trim()
      ? "Search results are not limited by your device-location radius; ordered by search relevance."
      : location
    ? `Sorted by straight-line distance within ${radiusMiles} miles—not drive time or clinic quality.`
      : clinicStateFilter === "ALL"
        ? "Showing all states, sorted by name—not proximity or quality."
        : `Showing HRSA sites in ${stateName}, sorted by name—not proximity or quality.`;

  const toggleFacility = (facility: Facility) => {
    const key = facilityKey(facility);
    setSelectedKeys((current) => current.includes(key)
      ? current.filter((value) => value !== key)
      : current.length < 3 ? [...current, key] : current);
  };
  const changeQuery = (value: string) => {
    setSelectedKeys([]);
    if (normalizeZipSearch(value)) setClinicStateFilter("ALL");
    setQuery(value);
  };

  return <>
    <PageHeading eyebrow="CLINIC COMPARISON" title="Compare health centers" description="Review up to three HRSA health center sites side by side, with available services and local health context.">
      <SelectControl label="Filter health centers by state" value={clinicStateFilter} onChange={(value) => { setSelectedKeys([]); setClinicStateFilter(value); }}><option value="ALL">All states</option><StateOptions /></SelectControl>
    </PageHeading>
    <div className="context-callout"><ShieldCheck size={17} /><span><strong>Your selected topic: {indicator.label}.</strong> It selects the CDC county estimate shown for each site; it does not identify a clinic specialty. {age || sex ? "Age and sex do not change these public estimates or the clinic order." : "Clinic quality, insurance acceptance, appointments, and condition-specific expertise are not in the connected data."}</span><span className="year-pill">CDC · 2023</span></div>
    <DataNotice error={facilitiesError} loading={facilitiesLoading} label="HRSA health centers" />
    {estimatesError && <DataNotice error={estimatesError} loading={false} label="CDC community estimates" />}
    <div className="clinic-comparison-search">
      <label className="search-field"><Search size={18} /><input value={query} onChange={(event) => changeQuery(event.target.value)} placeholder="Search clinics by city, ZIP, county, or name" aria-label="Search clinics to compare" />{query && <button aria-label="Clear clinic comparison search" onClick={() => changeQuery("")}><X size={16} /></button>}</label>
      <span>{sortDescription}</span>
    </div>
    <div className="clinic-comparison-layout">
      <section className="card clinic-choice-card">
        <div className="card-heading"><div><h2>Choose up to 3 health centers</h2><p>{selectedFacilities.length} selected · HRSA active sites</p></div><span className="live-tag"><span /> HRSA DATA</span></div>
        {facilitiesLoading ? <div className="empty-panel"><LoaderCircle size={19} className="spin" /> Loading official HRSA locations…</div>
          : facilitiesError ? <EmptyState text="Health centers could not be loaded. Try again later." />
            : candidates.length ? <div className="clinic-choice-list">{candidates.map((facility, index) => {
              const isSelected = selectedKeys.includes(facilityKey(facility));
              const disabled = !isSelected && selectedFacilities.length >= 3;
              return <button className={`clinic-choice ${isSelected ? "clinic-choice-selected" : ""}`} key={facilityKey(facility)} aria-pressed={isSelected} disabled={disabled} onClick={() => toggleFacility(facility)}>
                <span className="clinic-choice-check">{isSelected ? "✓" : index + 1}</span><span className="clinic-choice-copy"><strong>{facility.name}</strong><small>{facility.city}, {facility.state} {facility.zip}{facility.county ? ` · ${facility.county}` : ""}</small><em>{facility.centerType}{location ? ` · ${formatDistance(facilityDistance(facility, location))}` : ""}</em></span><span className="clinic-choice-action">{isSelected ? "Selected" : "Add"}</span>
              </button>;
            })}</div> : <div className="empty-panel empty-panel-large"><MapPin size={20} /><strong>No health centers found</strong><span>Try a city, ZIP code, or county in the search box above.</span></div>}
      </section>
      <section className="clinic-comparison-results" aria-live="polite">
        <div className="card-heading clinic-comparison-results-heading"><div><h2>Your comparison</h2><p>Review the available information before contacting a site</p></div><span className="year-pill">{selectedFacilities.length} / 3</span></div>
        {selectedFacilities.length ? <div className="clinic-compare-cards">{selectedFacilities.map((facility, index) => <article className="card clinic-compare-card" key={facilityKey(facility)}>
          <div className="clinic-compare-card-top"><span>HEALTH CENTER {index + 1}</span><button className="text-button" onClick={() => toggleFacility(facility)}>Remove</button></div>
          <h3>{facility.name}</h3>
          <p className="clinic-compare-address">{[facility.address, `${facility.city}, ${facility.state} ${facility.zip}`, facility.county].filter(Boolean).join(" · ")}</p>
          <ClinicCommunityEstimate facility={facility} estimates={estimates} loading={estimatesLoading} error={estimatesError} indicator={indicator} />
          <dl className="clinic-compare-details">
            <div><dt>Center type</dt><dd>{facility.centerType}</dd></div>
            {facility.locationType && <div><dt>Site type</dt><dd>{facility.locationType}</dd></div>}
            <div><dt>HRSA-listed services</dt><dd>{facility.services || "Not provided in the HRSA record"}</dd></div>
            {facility.phone && <div><dt>Phone</dt><dd><a href={`tel:${facility.phone}`}>{facility.phone}</a></dd></div>}
            {facility.website && <div><dt>Website</dt><dd><a href={facility.website.startsWith("http") ? facility.website : `https://${facility.website}`} target="_blank" rel="noreferrer">Visit official site</a></dd></div>}
            {location && <div><dt>Straight-line distance</dt><dd>{formatDistance(facilityDistance(facility, location))}</dd></div>}
          </dl>
          <button className="button button-outline clinic-compare-map" onClick={() => onSelectFacility(facility)}><MapPin size={16} /> View this center on map</button>
        </article>)}</div> : <div className="card clinic-compare-empty"><Building2 size={22} /><strong>Select centers from the list</strong><span>Choose two or three sites to review their HRSA details and county health estimates together.</span></div>}
      </section>
    </div>
    <div className="clinic-ranking-note"><ShieldCheck size={17} /><span><strong>We cannot identify the “best” clinic from this data.</strong> Results are ordered by distance or search match only. The CDC number is a population estimate for the surrounding county—not a clinic outcome, a prediction about you, or evidence that a site treats a condition. Call the clinic to confirm services, eligibility, insurance, and appointments.</span></div>
  </>;
}

function facilityKey(facility: Facility) {
  return `${facility.name}|${facility.zip}|${facility.latitude}|${facility.longitude}`;
}

function Disparities({ state, setState, indicator, setIndicator, places, loading, error }: {
  state: string; setState: (value: string) => void; indicator: IndicatorId; setIndicator: (value: IndicatorId) => void; places: PlaceEstimate[]; loading: boolean; error: string;
}) {
  const active = INDICATORS.find((item) => item.id === indicator)!;
  const sorted = useMemo(() => [...places].sort((a, b) => Number(b.data_value) - Number(a.data_value)), [places]);
  const stateName = STATES.find(([abbr]) => abbr === state)?.[1] ?? state;
  const average = places.length ? places.reduce((sum, row) => sum + Number(row.data_value), 0) / places.length : 0;
  const spread = sorted.length > 1 ? Number(sorted[0].data_value) - Number(sorted[sorted.length - 1].data_value) : 0;
  return <>
    <PageHeading eyebrow="HEALTH DISPARITY EXPLORER" title="See the differences" description="Explore how one health indicator varies across county communities.">
      <SelectControl label="Select state" value={state} onChange={setState}><StateOptions /></SelectControl>
      <SelectControl label="Select indicator" value={indicator} onChange={(value) => setIndicator(value as IndicatorId)}><IndicatorOptions /></SelectControl>
    </PageHeading>
    <div className="context-callout"><ShieldCheck size={17} /><span>Markers show CDC PLACES county estimates at their published geographic coordinates. This is not a boundary-level choropleth; no county boundaries or missing estimates are inferred.</span><span className="year-pill">2023 DATA</span></div>
    <DataNotice error={error} loading={loading} label="CDC PLACES estimates" />
    <div className="disparity-stats">
      <div className="card disparity-kpi"><span>INDICATOR</span><strong>{active.short}</strong><small>{stateName} counties</small></div>
      <div className="card disparity-kpi"><span>COUNTY MEAN</span><strong>{loading ? "…" : error || !places.length ? "—" : percent(average)}</strong><small>Average crude prevalence</small></div>
      <div className="card disparity-kpi"><span>COUNTY RANGE</span><strong>{loading ? "…" : error || !places.length ? "—" : `${spread.toFixed(1)} pp`}</strong><small>Highest minus lowest estimate</small></div>
      <div className="card disparity-kpi"><span>COUNTIES</span><strong>{loading ? "…" : error ? "—" : places.length}</strong><small>With available estimates</small></div>
    </div>
    <section className="card disparity-map-card"><div className="card-heading"><div><h2>{active.short} across {stateName}</h2><p>Each marker represents one county estimate · circle color indicates relative estimate bands</p></div><div className="map-scale"><span>Lower</span><i className="scale-low" /><i className="scale-mid" /><i className="scale-high" /><span>Higher</span></div></div>
      <div className="map-frame disparity-map-frame"><FacilityMap facilities={[]} selected={null} onSelect={() => {}} estimates={places} activeIndicator={active.short} fitKey={state} />
        {loading && <div className="map-overlay"><LoaderCircle size={18} className="spin" /> Loading county estimates…</div>}
        {error && <div className="map-overlay map-overlay-error">CDC PLACES data is unavailable.</div>}
      </div>
    </section>
    <section className="card disparity-table-card"><div className="card-heading"><div><h2>High and low estimates</h2><p>Extremes among counties with available estimates—no causal interpretation implied.</p></div></div>
      <div className="extreme-grid">{sorted.length ? <><div className="extreme-col"><div className="extreme-label extreme-high"><ArrowUpRight size={15} /> HIGHER ESTIMATES</div>{sorted.slice(0, 5).map((row) => <div className="extreme-row" key={row.locationid}><span>{row.locationname} County</span><strong>{percent(row.data_value)}</strong></div>)}</div>
        <div className="extreme-col"><div className="extreme-label extreme-low"><ArrowDownRight size={15} /> LOWER ESTIMATES</div>{sorted.slice(-5).reverse().map((row) => <div className="extreme-row" key={row.locationid}><span>{row.locationname} County</span><strong>{percent(row.data_value)}</strong></div>)}</div></> : <EmptyState text="Available county estimates will appear here." />}</div>
    </section>
    <div className="data-footnote"><Database size={14} /> CDC PLACES · {active.label} · 2023 crude prevalence · {stateName}. Ranges are descriptive summaries, not evidence of cause.</div>
  </>;
}

function Sources() {
  const sources = [
    { title: "CDC PLACES", type: "COMMUNITY HEALTH ESTIMATES", desc: "Model-based estimates for chronic disease, health outcomes, prevention, and health status at multiple geographic levels.", update: "Annual releases", geo: "Counties, places, census tracts, and states (dataset-dependent)", link: "https://www.cdc.gov/places/", linkText: "CDC PLACES" },
    { title: "CDC Open Data API", type: "LIVE PUBLIC DATA API", desc: "Fair Care queries 35 health, prevention, disability, and community-need measures from the CDC PLACES Local Data for Better Health dataset. County estimates shown beside a health center describe its surrounding population, not the center or its patients.", update: "Dataset metadata lists year 2023 in the queried release", geo: "County-level records filtered by state and indicator", link: "https://data.cdc.gov/resource/swc5-untb.json", linkText: "Open dataset API" },
    { title: "HRSA Health Center Service Delivery Sites", type: "FACILITY LOCATIONS", desc: "HRSA's downloadable active health center service delivery and look-alike sites dataset. Fair Care uses official site coordinates and available contact and location attributes.", update: "HRSA labels the dataset as daily refresh; downloaded at app start", geo: "Individual geocoded service delivery sites", link: "https://data.hrsa.gov/topics/health-centers", linkText: "HRSA dataset page" },
    { title: "OpenStreetMap", type: "MAP BASE LAYER", desc: "OpenStreetMap provides the geographic basemap. Facility markers are from HRSA, not OpenStreetMap.", update: "Community-maintained map data", geo: "Global map tiles", link: "https://www.openstreetmap.org/", linkText: "OpenStreetMap" },
  ];
  return <>
    <PageHeading eyebrow="TRANSPARENCY & METHODOLOGY" title="Data & sources" description="Know where the numbers come from, what they represent, and where they have limits." />
    <div className="source-summary"><div className="source-summary-icon"><Database size={20} /></div><div><strong>No account and no saved health profile.</strong><span>Live integrations: CDC PLACES, HRSA health center sites, and OpenStreetMap tiles. Your intake stays in this tab and is not sent to these sources.</span></div><span className="source-count">3 INTEGRATIONS</span></div>
    <div className="source-list">{sources.map((source, index) => <article className="card source-card" key={source.title}><div className="source-number">{String(index + 1).padStart(2, "0")}</div><div className="source-content"><div className="eyebrow">{source.type}</div><h2>{source.title}</h2><p>{source.desc}</p><div className="source-meta"><div><span>UPDATE</span><strong>{source.update}</strong></div><div><span>GEOGRAPHIC COVERAGE</span><strong>{source.geo}</strong></div></div><a href={source.link} target="_blank" rel="noreferrer" className="source-link">{source.linkText} <ArrowUpRightFromSquare size={14} /></a></div><div className="source-card-icon">{index === 0 ? <HeartPulse size={19} /> : index === 1 ? <Activity size={19} /> : index === 2 ? <Building2 size={19} /> : <MapPin size={19} />}</div></article>)}</div>
    <section className="card source-roadmap">
      <div className="card-heading"><div><h2>More trusted sources to build from</h2><p>These are not connected to Fair Care yet. Their data does not appear in the app today.</p></div><span className="planned-tag">REFERENCE ONLY</span></div>
      <div className="source-roadmap-grid">
        <article><span>HEALTH ESTIMATES</span><a href="https://www.cdc.gov/brfss/" target="_blank" rel="noreferrer">CDC BRFSS <ArrowUpRightFromSquare size={13} /></a><a href="https://wonder.cdc.gov/" target="_blank" rel="noreferrer">CDC WONDER <ArrowUpRightFromSquare size={13} /></a></article>
        <article><span>SOCIAL & COMMUNITY</span><a href="https://www.atsdr.cdc.gov/place-health/php/svi/" target="_blank" rel="noreferrer">CDC/ATSDR SVI <ArrowUpRightFromSquare size={13} /></a><a href="https://data.census.gov/" target="_blank" rel="noreferrer">U.S. Census ACS <ArrowUpRightFromSquare size={13} /></a><a href="https://www.ers.usda.gov/data-products/food-access-research-atlas/" target="_blank" rel="noreferrer">USDA Food Access <ArrowUpRightFromSquare size={13} /></a><a href="https://www.epa.gov/ejscreen" target="_blank" rel="noreferrer">EPA EJScreen <ArrowUpRightFromSquare size={13} /></a></article>
        <article><span>CARE & ACCESS</span><a href="https://data.hrsa.gov/topics/health-workforce/shortage-areas" target="_blank" rel="noreferrer">HRSA shortage areas <ArrowUpRightFromSquare size={13} /></a><a href="https://www.medicare.gov/care-compare/" target="_blank" rel="noreferrer">CMS Care Compare <ArrowUpRightFromSquare size={13} /></a></article>
        <article><span>PLACE & ENVIRONMENT</span><a href="https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html" target="_blank" rel="noreferrer">Census map boundaries <ArrowUpRightFromSquare size={13} /></a><a href="https://www.cdc.gov/nchs/data-analysis-tools/urban-rural.html" target="_blank" rel="noreferrer">CDC rural/urban data <ArrowUpRightFromSquare size={13} /></a><a href="https://www.weather.gov/documentation/services-web-api" target="_blank" rel="noreferrer">National Weather Service API <ArrowUpRightFromSquare size={13} /></a><a href="https://www.airnow.gov/aqi/aqi-basics/" target="_blank" rel="noreferrer">AirNow air quality <ArrowUpRightFromSquare size={13} /></a></article>
      </div>
    </section>
    <section className="card limitations"><div className="limitations-heading"><ShieldCheck size={18} /><h2>Important limitations</h2></div><ul><li><strong>Modeled, population-level estimates.</strong> CDC PLACES estimates are not individual health records and cannot be used for diagnosis or treatment.</li><li><strong>County data is not clinic data.</strong> A statistic shown beside a center describes county residents, not the center, its patients, or your personal risk.</li><li><strong>Uncertainty matters.</strong> Estimates include sampling and modeling uncertainty. Similar displayed values may not represent meaningful differences.</li><li><strong>Years are not interchangeable.</strong> Do not interpret differences across data years as trends without accounting for changes in methods and population.</li><li><strong>Facility information is limited.</strong> HRSA service labels may be incomplete and do not show condition expertise, capacity, hours, patient eligibility, quality, travel time, or appointment availability.</li><li><strong>Not a hospital directory.</strong> The connected HRSA dataset lists health center service sites, not every hospital or specialist.</li><li><strong>Map detail is scale-aware.</strong> At national zoom, the health center map plots a per-state subset for responsiveness. Search or filter by state to view all matching sites.</li><li><strong>Not medical advice.</strong> Fair Care is for education and community-level exploration only.</li></ul></section>
    <div className="source-disclaimer"><FileText size={15} /><span>Data remains the property of its original publishers and is subject to their terms of use. Always consult the source for the latest definitions and methodology.</span></div>
  </>;
}
