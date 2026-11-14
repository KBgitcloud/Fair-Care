import Papa from "papaparse";

export const PLACES_SOURCE = "https://data.cdc.gov/resource/swc5-untb.json";
export const HRSA_SOURCE = "/api/hrsa-sites";

export const INDICATORS = [
  { id: "DIABETES", label: "Diagnosed diabetes", short: "Diabetes", category: "Health conditions", description: "Adults who have ever been told by a health professional that they have diabetes." },
  { id: "CASTHMA", label: "Current asthma", short: "Asthma", category: "Health conditions", description: "Adults who currently have asthma." },
  { id: "BPHIGH", label: "High blood pressure", short: "High blood pressure", category: "Health conditions", description: "Adults who have ever been told they have high blood pressure." },
  { id: "OBESITY", label: "Obesity", short: "Obesity", category: "Health conditions", description: "Adults with obesity, based on self-reported height and weight." },
  { id: "ARTHRITIS", label: "Arthritis", short: "Arthritis", category: "Health conditions", description: "Adults who have ever been told they have arthritis." },
  { id: "CANCER", label: "Cancer or melanoma", short: "Cancer", category: "Health conditions", description: "Adults who have ever been told they had cancer, excluding non-melanoma skin cancer." },
  { id: "COPD", label: "COPD", short: "COPD", category: "Health conditions", description: "Adults who have ever been told they have chronic obstructive pulmonary disease." },
  { id: "CHD", label: "Coronary heart disease", short: "Heart disease", category: "Health conditions", description: "Adults who have ever been told they have coronary heart disease." },
  { id: "DEPRESSION", label: "Depression", short: "Depression", category: "Health conditions", description: "Adults who have ever been told they have a depressive disorder." },
  { id: "HIGHCHOL", label: "High cholesterol", short: "High cholesterol", category: "Health conditions", description: "Adults with high cholesterol among those who have been screened." },
  { id: "STROKE", label: "Stroke", short: "Stroke", category: "Health conditions", description: "Adults who have ever been told they had a stroke." },
  { id: "GHLTH", label: "Fair or poor overall health", short: "Overall health", category: "Health status", description: "Adults who rate their health as fair or poor." },
  { id: "MHLTH", label: "Frequent mental distress", short: "Mental distress", category: "Health status", description: "Adults reporting frequent mental distress." },
  { id: "PHLTH", label: "Frequent physical distress", short: "Physical distress", category: "Health status", description: "Adults reporting frequent physical distress." },
  { id: "ACCESS2", label: "Lack of health insurance", short: "Uninsured", category: "Care & prevention", description: "Adults aged 18–64 who lack health insurance." },
  { id: "BPMED", label: "Taking medicine for high blood pressure", short: "Blood pressure medicine", category: "Care & prevention", description: "Adults with high blood pressure who take medicine to control it." },
  { id: "CHECKUP", label: "Routine checkup in past year", short: "Routine checkup", category: "Care & prevention", description: "Adults who report a routine checkup within the past year." },
  { id: "CHOLSCREEN", label: "Cholesterol screening", short: "Cholesterol screening", category: "Care & prevention", description: "Adults who report having their cholesterol checked." },
  { id: "BINGE", label: "Binge drinking", short: "Binge drinking", category: "Health behaviors", description: "Adults reporting binge drinking." },
  { id: "CSMOKING", label: "Current cigarette smoking", short: "Smoking", category: "Health behaviors", description: "Adults who currently smoke cigarettes." },
  { id: "LPA", label: "No leisure-time physical activity", short: "Low activity", category: "Health behaviors", description: "Adults reporting no leisure-time physical activity." },
  { id: "DISABILITY", label: "Any disability", short: "Any disability", category: "Disability", description: "Adults reporting any disability." },
  { id: "COGNITION", label: "Cognitive disability", short: "Cognitive disability", category: "Disability", description: "Adults reporting serious difficulty concentrating, remembering, or making decisions." },
  { id: "HEARING", label: "Hearing disability", short: "Hearing disability", category: "Disability", description: "Adults reporting serious difficulty hearing." },
  { id: "INDEPLIVE", label: "Independent living disability", short: "Independent living", category: "Disability", description: "Adults reporting difficulty doing errands alone because of a physical, mental, or emotional condition." },
  { id: "MOBILITY", label: "Mobility disability", short: "Mobility disability", category: "Disability", description: "Adults reporting serious difficulty walking or climbing stairs." },
  { id: "SELFCARE", label: "Self-care disability", short: "Self-care disability", category: "Disability", description: "Adults reporting difficulty dressing or bathing." },
  { id: "VISION", label: "Vision disability", short: "Vision disability", category: "Disability", description: "Adults reporting serious difficulty seeing, even when wearing glasses." },
  { id: "FOODINSECU", label: "Food insecurity", short: "Food insecurity", category: "Community needs", description: "Adults reporting food insecurity during the past 12 months." },
  { id: "HOUSINSECU", label: "Housing insecurity", short: "Housing insecurity", category: "Community needs", description: "Adults reporting housing insecurity during the past 12 months." },
  { id: "LACKTRPT", label: "Lack of reliable transportation", short: "Transportation", category: "Community needs", description: "Adults reporting a lack of reliable transportation during the past 12 months." },
  { id: "EMOTIONSPT", label: "Lack of social or emotional support", short: "Social support", category: "Community needs", description: "Adults reporting that they do not get the social and emotional support they need." },
  { id: "LONELINESS", label: "Loneliness", short: "Loneliness", category: "Community needs", description: "Adults reporting loneliness." },
  { id: "FOODSTAMP", label: "Received food assistance", short: "Food assistance", category: "Community needs", description: "Adults reporting receipt of food stamps during the past 12 months." },
  { id: "SHUTUTILITY", label: "Threat of utility shutoff", short: "Utility shutoff", category: "Community needs", description: "Adults reporting a threat of utility service shutoff during the past 12 months." },
] as const;

export const STATES = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"],
  ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"],
  ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"],
  ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"],
  ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
  ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"],
  ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"],
  ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"],
  ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"],
  ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"],
  ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
] as const;

export type IndicatorId = (typeof INDICATORS)[number]["id"];

export interface PlaceEstimate {
  year: string;
  stateabbr: string;
  locationname: string;
  locationid: string;
  measure: string;
  data_value: string;
  data_value_type?: string;
  low_confidence_limit?: string;
  high_confidence_limit?: string;
  geolocation?: { type: string; coordinates: [number, number] };
}

export interface Facility {
  name: string;
  centerType: string;
  locationType: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  website: string;
  services: string;
  county: string;
  status: string;
  latitude: number;
  longitude: number;
}

interface HrsaRow {
  "Health Center Type"?: string;
  "Site Name"?: string;
  "Site Address"?: string;
  "Site City"?: string;
  "Site State Abbreviation"?: string;
  "Site Postal Code"?: string;
  "Site Telephone Number"?: string;
  "Site Web Address"?: string;
  "Services Delivered at Site"?: string;
  "Complete County Name"?: string;
  "Site Status Description"?: string;
  "Health Center Location Type Description"?: string;
  "Geocoding Artifact Address Primary X Coordinate"?: string;
  "Geocoding Artifact Address Primary Y Coordinate"?: string;
}

const placesCache = new Map<string, Promise<PlaceEstimate[]>>();
const nationwidePlacesCache = new Map<string, Promise<PlaceEstimate[]>>();
let facilitiesCache: Promise<Facility[]> | undefined;

export function getPlaces(state: string, indicator: IndicatorId, year = "2023"): Promise<PlaceEstimate[]> {
  const key = `${state}-${indicator}-${year}`;
  const cached = placesCache.get(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    "$select": "year,stateabbr,locationname,locationid,measure,data_value,data_value_type,low_confidence_limit,high_confidence_limit,geolocation",
    "$where": `year='${year}' AND stateabbr='${state}' AND measureid='${indicator}' AND datavaluetypeid='CrdPrv'`,
    "$limit": "1000",
    "$order": "locationname",
  });
  const request = fetch(`${PLACES_SOURCE}?${params}`, { headers: { Accept: "application/json" } })
    .then(async (response) => {
      if (!response.ok) throw new Error(`CDC PLACES request failed (${response.status}).`);
      const rows = (await response.json()) as PlaceEstimate[];
      return rows.filter((row) => /^\d{5}$/.test(row.locationid) && Number.isFinite(Number(row.data_value)));
    });
  placesCache.set(key, request);
  request.catch(() => placesCache.delete(key));
  return request;
}

export function getNationwidePlaces(indicator: IndicatorId, year = "2023"): Promise<PlaceEstimate[]> {
  const key = `${indicator}-${year}`;
  const cached = nationwidePlacesCache.get(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    "$select": "year,stateabbr,locationname,locationid,measure,data_value,data_value_type,low_confidence_limit,high_confidence_limit,geolocation",
    "$where": `year='${year}' AND measureid='${indicator}' AND datavaluetypeid='CrdPrv'`,
    "$limit": "5000",
    "$order": "stateabbr,locationname",
  });
  const request = fetch(`${PLACES_SOURCE}?${params}`, { headers: { Accept: "application/json" } })
    .then(async (response) => {
      if (!response.ok) throw new Error(`CDC PLACES request failed (${response.status}).`);
      const rows = (await response.json()) as PlaceEstimate[];
      return rows.filter((row) => /^\d{5}$/.test(row.locationid) && Number.isFinite(Number(row.data_value)));
    });
  nationwidePlacesCache.set(key, request);
  request.catch(() => nationwidePlacesCache.delete(key));
  return request;
}

export function getFacilities(): Promise<Facility[]> {
  if (facilitiesCache) return facilitiesCache;
  facilitiesCache = fetch(HRSA_SOURCE)
    .then(async (response) => {
      if (!response.ok) throw new Error(`HRSA dataset request failed (${response.status}).`);
      return response.text();
    })
    .then((csv) => {
      const newline = csv.indexOf("\n");
      const header = csv.slice(0, newline).replace(/\r$/, "");
      const normalizedCsv = newline > 0 && header.endsWith(",")
        ? `${header.slice(0, -1)}${csv.slice(newline)}`
        : csv;
      const parsed = Papa.parse<HrsaRow>(normalizedCsv, { header: true, skipEmptyLines: true });
      if (parsed.errors.length) throw new Error(`Could not read the HRSA dataset: ${parsed.errors[0].message}`);
      return parsed.data.flatMap((row) => {
        const latitude = Number(row["Geocoding Artifact Address Primary Y Coordinate"]);
        const longitude = Number(row["Geocoding Artifact Address Primary X Coordinate"]);
        if (
          row["Site Status Description"]?.toLowerCase() !== "active" ||
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude) ||
          latitude < 17 || latitude > 72 || longitude < -180 || longitude > -60
        ) return [];
        return [{
          name: row["Site Name"] || "Unnamed health center site",
          centerType: row["Health Center Type"] || "Health center",
          locationType: row["Health Center Location Type Description"] || "",
          address: row["Site Address"] || "",
          city: row["Site City"] || "",
          state: row["Site State Abbreviation"] || "",
          zip: row["Site Postal Code"] || "",
          phone: row["Site Telephone Number"] || "",
          website: row["Site Web Address"] || "",
          services: row["Services Delivered at Site"] || "",
          county: row["Complete County Name"] || "",
          status: row["Site Status Description"] || "",
          latitude,
          longitude,
        }];
      });
    })
    .catch((error: unknown) => {
      facilitiesCache = undefined;
      throw error;
    });
  return facilitiesCache;
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
