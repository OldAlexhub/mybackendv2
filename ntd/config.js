export const NTD_SOURCE = {
  publisher: "Federal Transit Administration, National Transit Database",
  portal: "https://data.transportation.gov",
  productPage: "https://www.transit.dot.gov/ntd/ntd-data",
};

export const NTD_DATASETS = {
  adjustedMonthly: {
    id: "8bui-9xvu",
    name: "Complete Monthly Ridership (with Adjustments and Estimates)",
    treatment: "complete",
  },
  rawMonthlySafety: {
    id: "5ti2-5uiv",
    name: "Monthly Modal Time Series (Safety and Service)",
    treatment: "raw",
  },
  annualMetrics: {
    id: "ekg5-frzt",
    name: "2022 - 2024 NTD Annual Data - Metrics",
  },
  annualAgencyMetrics: {
    id: "g27i-aq2u",
    name: "NTD Annual Data View - Metrics (by Agency)",
  },
  funding: {
    id: "ujv8-f24s",
    name: "NTD Annual Data View - Funding Sources (by Expense Type and Agency)",
  },
  fleetAge: {
    id: "6abt-uhgq",
    name: "2022 - 2024 NTD Annual Data - Vehicles (Age Distribution)",
  },
  fleetTypes: {
    id: "nimp-626k",
    name: "2022 - 2024 NTD Annual Data - Vehicles (Type Count by Agency)",
  },
};

export const CACHE_TTL = {
  status: 30 * 60 * 1000,
  agencyDirectory: 12 * 60 * 60 * 1000,
  agencyReport: 6 * 60 * 60 * 1000,
  national: 12 * 60 * 60 * 1000,
  metadata: 12 * 60 * 60 * 1000,
};

export const PERIOD_YEARS = {
  "1y": 1,
  "3y": 3,
  "5y": 5,
  "10y": 10,
  max: 30,
};

