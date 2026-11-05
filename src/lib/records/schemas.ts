// Input validation and change tracking for contacts and accounts. Pure (no server-only imports) so tests can load it.
import { z } from "zod";
import { LEAD_STATUSES, EMAIL_STATUSES } from "@/lib/records/constants";

const optText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim() || null : v ?? null), z.string().max(max).nullable());
const optUuid = z.preprocess((v) => (v === "" || v === undefined ? null : v), z.string().uuid().nullable());
const optDate = z.preprocess((v) => (v === "" || v === undefined || v === null ? null : v), z.coerce.date().nullable());

export const customFieldsSchema = z.record(z.string().max(60), z.union([z.string().max(500), z.number(), z.null()])).default({});

export const contactSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().max(100).default(""),
  email: z.preprocess((v) => (typeof v === "string" ? v.trim() || null : v ?? null), z.string().email("That email address doesn't look right").max(200).nullable()),
  phone: optText(60),
  jobTitle: optText(120),
  linkedinUrl: optText(300),
  city: optText(80),
  region: optText(80),
  country: optText(80),
  source: optText(80),
  serviceInterest: optText(200),
  nextAction: optText(200),
  accountId: optUuid,
  ownerId: optUuid,
  assigneeIds: z.array(z.string().uuid()).max(20).default([]),
  qualification: z.enum(LEAD_STATUSES).default("new"),
  emailStatus: z.enum(EMAIL_STATUSES).default("active"),
  followUpAt: optDate,
  verified: z.boolean().default(false),
  tags: z.array(z.string()).max(30).default([]),
  customFields: customFieldsSchema,
});
export type ContactInput = z.input<typeof contactSchema>;

export const accountSchema = z.object({
  name: z.string().trim().min(1, "Company name is required").max(200),
  domain: optText(200),
  website: optText(300),
  industry: optText(80),
  sizeBand: optText(40),
  city: optText(80),
  region: optText(80),
  country: optText(80),
  phone: optText(60),
  linkedinUrl: optText(300),
  description: optText(2000),
  source: optText(80),
  serviceInterest: optText(200),
  nextAction: optText(200),
  ownerId: optUuid,
  assigneeIds: z.array(z.string().uuid()).max(20).default([]),
  qualification: z.enum(LEAD_STATUSES).default("new"),
  followUpAt: optDate,
  verified: z.boolean().default(false),
  tags: z.array(z.string()).max(30).default([]),
  customFields: customFieldsSchema,
});
export type AccountInput = z.input<typeof accountSchema>;

export type FieldChange = { field: string; from: unknown; to: unknown };

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Which of the tracked fields differ between the stored record and the new values. */
export function diffFields(before: Record<string, unknown>, after: Record<string, unknown>, labels: Record<string, string>): FieldChange[] {
  const out: FieldChange[] = [];
  for (const key of Object.keys(labels)) {
    const a = before[key] instanceof Date ? (before[key] as Date).toISOString().slice(0, 10) : before[key];
    const b = after[key] instanceof Date ? (after[key] as Date).toISOString().slice(0, 10) : after[key];
    if (!same(a, b)) out.push({ field: labels[key], from: a ?? null, to: b ?? null });
  }
  return out;
}

