// Integrations the CRM can hold credentials for (SPEC §R-7). Add a provider here, then build its connector.
export const PROVIDERS = ["instantly", "ringcentral", "salesforce", "linkedin", "google", "calendar", "other"] as const;
export type Provider = (typeof PROVIDERS)[number];

export const PROVIDER_LABEL: Record<Provider, string> = {
  instantly: "Instantly",
  ringcentral: "RingCentral",
  salesforce: "Salesforce",
  linkedin: "LinkedIn",
  google: "Google (email / calendar)",
  calendar: "Calendar / booking tool",
  other: "Other",
};
