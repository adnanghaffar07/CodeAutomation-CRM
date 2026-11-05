// Shared vocabulary for contacts and accounts (SPEC §R-3). Pure data: safe for server and client.

export const LEAD_STATUSES = ["new", "researching", "contacted", "engaged", "qualified", "disqualified"] as const;
export type LeadStatusValue = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABEL: Record<LeadStatusValue, string> = {
  new: "New",
  researching: "Researching",
  contacted: "Contacted",
  engaged: "Engaged",
  qualified: "Qualified",
  disqualified: "Disqualified",
};

export const EMAIL_STATUSES = ["active", "unsubscribed", "do_not_contact", "bounced"] as const;
export type EmailStatusValue = (typeof EMAIL_STATUSES)[number];

export const EMAIL_STATUS_LABEL: Record<EmailStatusValue, string> = {
  active: "Can email",
  unsubscribed: "Unsubscribed",
  do_not_contact: "Do not contact",
  bounced: "Bounced",
};

export const SORTS = ["newest", "oldest", "name"] as const;
export type SortValue = (typeof SORTS)[number];
export const SORT_LABEL: Record<SortValue, string> = { newest: "Newest first", oldest: "Oldest first", name: "Name A to Z" };

export const SIZE_BANDS = ["1-10", "11-50", "51-200", "201-1000", "1000+"] as const;

export const PAGE_SIZE = 50;
/** Counts stop here: "10,000+" is accurate enough for a list header and never scans the whole table. */
export const COUNT_CAP = 10_000;

export type EntityKind = "contact" | "account";

/** Filters shared by both lists. Everything is optional and travels in the page URL. */
export type ListFilters = {
  q?: string;
  status?: LeadStatusValue;
  emailStatus?: EmailStatusValue;
  /** a member id, "me" or "none" */
  owner?: string;
  tag?: string;
  country?: string;
  industry?: string;
  accountId?: string;
  due?: "overdue" | "week";
  sort: SortValue;
};

export const FILTER_KEYS = ["q", "status", "emailStatus", "owner", "tag", "country", "industry", "accountId", "due", "sort"] as const;
