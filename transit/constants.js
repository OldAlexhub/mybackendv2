export const TRANSIT_DATASET_ID = "8bui-9xvu";
export const TRANSIT_DATASET_URL =
  `https://data.transportation.gov/resource/${TRANSIT_DATASET_ID}.json`;
export const TRANSIT_METADATA_URL =
  `https://data.transportation.gov/api/views/${TRANSIT_DATASET_ID}`;
export const TRANSIT_SOURCE_PAGE =
  "https://data.transportation.gov/Public-Transit/Complete-Monthly-Ridership-with-Adjustments-and-Es/8bui-9xvu";

export const SOURCE_FIELDS = [
  "ntd_id",
  "legacy_ntd_id",
  "agency",
  "mode_type_of_service_status",
  "reporter_type",
  "uace_cd",
  "uza_name",
  "mode",
  "tos",
  "_3_mode",
  "date",
  "upt",
  "voms",
  "vrh",
  "vrm",
  "agency_mode_tos_date",
  "state",
  "fta_region",
];

export const BASE_METRICS = ["upt", "vrm", "vrh", "voms"];
export const DERIVED_METRICS = ["uptPerVrh", "uptPerVrm", "vrmPerVrh"];
export const ALLOWED_METRICS = [...BASE_METRICS, ...DERIVED_METRICS];

export const METRIC_LABELS = {
  upt: "Unlinked passenger trips",
  vrm: "Vehicle revenue miles",
  vrh: "Vehicle revenue hours",
  voms: "Vehicles operated in maximum service",
  uptPerVrh: "Passenger trips per revenue hour",
  uptPerVrm: "Passenger trips per revenue mile",
  vrmPerVrh: "Average revenue-service speed proxy",
};

export const MODE_LABELS = {
  AR: "Alaska Railroad",
  CC: "Cable Car",
  CR: "Commuter Rail",
  HR: "Heavy Rail",
  YR: "Hybrid Rail",
  IP: "Inclined Plane",
  LR: "Light Rail",
  MG: "Monorail / Automated Guideway",
  SR: "Streetcar Rail",
  TR: "Aerial Tramway",
  CB: "Commuter Bus",
  MB: "Bus",
  RB: "Bus Rapid Transit",
  DR: "Demand Response",
  FB: "Ferryboat",
  JT: "Jitney",
  PB: "Publico",
  TB: "Trolleybus",
  VP: "Vanpool",
  OR: "Other",
};

export const TRANSIT_CAVEATS = [
  "This dashboard uses the FTA Complete Monthly Ridership dataset, which includes historical adjustments and estimates for recent missing reports.",
  "The source does not identify which individual API values are estimated, so the dashboard does not label individual records as reported or estimated.",
  "State represents the reporter headquarters and may not describe the full service area.",
  "Changes and seasonal diagnostics are descriptive and do not establish cause.",
];

export const CACHE_CONTROL =
  "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400";
