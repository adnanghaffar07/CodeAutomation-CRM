// DEMO DATA. Everything in this file is fictional and generated, never read from the database.
//
// Why it exists: the CRM has no pipeline, target or KPI tables yet and too few real records to fill a dashboard.
// This module builds one small, internally consistent "organisation" (people, teams, tasks, leads, deals, targets,
// follow-ups) and every dashboard number is computed FROM it, so a team total always equals the sum of its people.
//
// How to replace it: dashboards only call `getDataset()` (see src/lib/dashboard/source.ts). Swap that one function for
// a loader that returns the same `Dataset` shape from real tables and nothing else changes. To switch demo data off, set
// DASHBOARD_DEMO_DATA=off. Deterministic: the same day always produces the same numbers (fixed seed, dates are
// offsets from "today").
import type { Role } from "@/lib/scope";
import type { AssignmentStatus, Priority, TaskType } from "@/lib/assignments";

export const DEMO_SEED = 20261107;

export type PersonStatus = "active" | "suspended";

export type Person = {
  id: string;
  name: string;
  email: string;
  role: Role;
  title: string;
  department: "Executive" | "Administration" | "Sales" | "Research" | "Data quality";
  teamId: string | null;
  managerId: string | null;
  status: PersonStatus;
  joinedAt: Date;
  /** Demo only: how reliable this person is, 0..1. Drives task outcomes and deal results, never shown. */
  skill: number;
};

export type Team = { id: string; name: string; department: Person["department"]; managerId: string };

export type Task = {
  id: string;
  assigneeId: string;
  assignedById: string;
  title: string;
  type: TaskType;
  priority: Priority;
  status: AssignmentStatus;
  createdAt: Date;
  dueAt: Date;
  /** When the person submitted it (verified / awaiting approval or later). */
  submittedAt: Date | null;
  /** When a manager approved it. */
  completedAt: Date | null;
  requiresEvidence: boolean;
  evidenceCount: number;
};

export const STAGES = ["qualified", "discovery", "proposal", "negotiation", "won", "lost"] as const;
export type Stage = (typeof STAGES)[number];
export const OPEN_STAGES: Stage[] = ["qualified", "discovery", "proposal", "negotiation"];
export const STAGE_LABEL: Record<Stage, string> = {
  qualified: "Qualified", discovery: "Discovery", proposal: "Proposal", negotiation: "Negotiation", won: "Won", lost: "Lost",
};
/** Chance a deal in this stage closes, used for the weighted pipeline value. */
export const STAGE_WEIGHT: Record<Stage, number> = { qualified: 0.1, discovery: 0.25, proposal: 0.5, negotiation: 0.75, won: 1, lost: 0 };

export type Opportunity = {
  id: string;
  ownerId: string;
  company: string;
  stage: Stage;
  value: number;
  createdAt: Date;
  expectedCloseAt: Date;
  closedAt: Date | null;
  lostReason: string | null;
  /** Last time anything happened on the deal. Used to flag stale deals. */
  lastActivityAt: Date;
};

export type LeadStatusKey = "new" | "researching" | "contacted" | "engaged" | "qualified" | "disqualified";
export type Lead = { id: string; ownerId: string; company: string; source: string; status: LeadStatusKey; createdAt: Date };

export type FollowUp = { id: string; ownerId: string; company: string; kind: "call" | "email" | "meeting"; subject: string; dueAt: Date; done: boolean };

export type ExportRequest = { id: string; requestedById: string; dataset: string; rows: number; requestedAt: Date };
export type Invitation = { id: string; email: string; role: Role; sentAt: Date; invitedById: string };
export type Integration = { id: string; name: string; status: "healthy" | "delayed" | "error"; lastSyncAt: Date; note: string };
export type SystemEvent = { id: string; at: Date; actorId: string; text: string; kind: "user" | "security" | "data" | "approval" | "integration" };

export type Dataset = {
  isDemo: true;
  today: Date;
  people: Person[];
  teams: Team[];
  tasks: Task[];
  opportunities: Opportunity[];
  leads: Lead[];
  followUps: FollowUp[];
  monthlyTarget: Record<string, number>;
  exportRequests: ExportRequest[];
  invitations: Invitation[];
  integrations: Integration[];
  systemEvents: SystemEvent[];
};

// ───────────────────────────── helpers ─────────────────────────────

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

/** Small seeded random number generator (mulberry32), so the demo never changes between reloads. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const startOfUtcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);

/** Stable fake ids. They look like UUIDs so nothing downstream has to special-case them, and start with "de0000" so they are recognisable. */
const demoId = (kind: number, n: number) => `de000000-0000-4000-8000-${String(kind).padStart(4, "0")}${String(n).padStart(8, "0")}`;
export const isDemoId = (id: string) => id.startsWith("de000000-0000-4000-8000-");

// ───────────────────────────── people and teams ─────────────────────────────

type P = Omit<Person, "id" | "email" | "joinedAt"> & { key: string; joinedDaysAgo: number };

const PEOPLE: P[] = [
  { key: "amina", name: "Amina Rahman", role: "ceo_admin", title: "Chief Executive Officer", department: "Executive", teamId: null, managerId: null, status: "active", skill: 0.9, joinedDaysAgo: 900 },
  { key: "daniel", name: "Daniel Okafor", role: "ceo_admin", title: "Operations & Admin Lead", department: "Administration", teamId: null, managerId: "amina", status: "active", skill: 0.9, joinedDaysAgo: 700 },
  // Managers
  { key: "sara", name: "Sara Malik", role: "manager", title: "Sales Manager, North", department: "Sales", teamId: "t-north", managerId: "amina", status: "active", skill: 0.9, joinedDaysAgo: 640 },
  { key: "marcus", name: "Marcus Webb", role: "manager", title: "Sales Manager, South", department: "Sales", teamId: "t-south", managerId: "amina", status: "active", skill: 0.85, joinedDaysAgo: 600 },
  { key: "leila", name: "Leila Hassan", role: "manager", title: "Research Manager", department: "Research", teamId: "t-research", managerId: "amina", status: "active", skill: 0.9, joinedDaysAgo: 520 },
  { key: "tom", name: "Tom Brennan", role: "manager", title: "Data Quality Manager", department: "Data quality", teamId: "t-quality", managerId: "amina", status: "active", skill: 0.85, joinedDaysAgo: 480 },
  // Sales / BD, North
  { key: "priya", name: "Priya Nair", role: "sales_bd", title: "Senior BD Executive", department: "Sales", teamId: "t-north", managerId: "sara", status: "active", skill: 0.95, joinedDaysAgo: 540 },
  { key: "james", name: "James Carter", role: "sales_bd", title: "BD Executive", department: "Sales", teamId: "t-north", managerId: "sara", status: "active", skill: 0.8, joinedDaysAgo: 400 },
  { key: "fatima", name: "Fatima Zahra", role: "sales_bd", title: "BD Executive", department: "Sales", teamId: "t-north", managerId: "sara", status: "active", skill: 0.88, joinedDaysAgo: 320 },
  { key: "liam", name: "Liam O'Connor", role: "sales_bd", title: "Junior BD Executive", department: "Sales", teamId: "t-north", managerId: "sara", status: "active", skill: 0.62, joinedDaysAgo: 150 },
  // Sales / BD, South
  { key: "elena", name: "Elena Petrova", role: "sales_bd", title: "Senior BD Executive", department: "Sales", teamId: "t-south", managerId: "marcus", status: "active", skill: 0.92, joinedDaysAgo: 500 },
  { key: "omar", name: "Omar Haddad", role: "sales_bd", title: "BD Executive", department: "Sales", teamId: "t-south", managerId: "marcus", status: "active", skill: 0.78, joinedDaysAgo: 380 },
  { key: "chloe", name: "Chloe Martin", role: "sales_bd", title: "BD Executive", department: "Sales", teamId: "t-south", managerId: "marcus", status: "active", skill: 0.7, joinedDaysAgo: 260 },
  { key: "noah", name: "Noah Fischer", role: "sales_bd", title: "BD Executive", department: "Sales", teamId: "t-south", managerId: "marcus", status: "suspended", skill: 0.55, joinedDaysAgo: 330 },
  // Data researchers, Research
  { key: "yuki", name: "Yuki Tanaka", role: "data_researcher", title: "Senior Researcher", department: "Research", teamId: "t-research", managerId: "leila", status: "active", skill: 0.95, joinedDaysAgo: 450 },
  { key: "diego", name: "Diego Garcia", role: "data_researcher", title: "Researcher", department: "Research", teamId: "t-research", managerId: "leila", status: "active", skill: 0.82, joinedDaysAgo: 300 },
  { key: "grace", name: "Grace Wilson", role: "data_researcher", title: "Researcher", department: "Research", teamId: "t-research", managerId: "leila", status: "active", skill: 0.9, joinedDaysAgo: 280 },
  { key: "ravi", name: "Ravi Sharma", role: "data_researcher", title: "Researcher", department: "Research", teamId: "t-research", managerId: "leila", status: "active", skill: 0.72, joinedDaysAgo: 210 },
  { key: "mei", name: "Mei Chen", role: "data_researcher", title: "Junior Researcher", department: "Research", teamId: "t-research", managerId: "leila", status: "active", skill: 0.66, joinedDaysAgo: 90 },
  // Data researchers, Data quality
  { key: "hana", name: "Hana Yilmaz", role: "data_researcher", title: "Data Quality Analyst", department: "Data quality", teamId: "t-quality", managerId: "tom", status: "active", skill: 0.93, joinedDaysAgo: 420 },
  { key: "ben", name: "Ben Adeyemi", role: "data_researcher", title: "Data Quality Analyst", department: "Data quality", teamId: "t-quality", managerId: "tom", status: "active", skill: 0.8, joinedDaysAgo: 350 },
  { key: "sofia", name: "Sofia Rossi", role: "data_researcher", title: "Data Quality Analyst", department: "Data quality", teamId: "t-quality", managerId: "tom", status: "active", skill: 0.76, joinedDaysAgo: 240 },
  { key: "kwame", name: "Kwame Mensah", role: "data_researcher", title: "Data Quality Analyst", department: "Data quality", teamId: "t-quality", managerId: "tom", status: "suspended", skill: 0.6, joinedDaysAgo: 200 },
];

const TEAM_DEFS: { id: string; name: string; department: Team["department"]; managerKey: string }[] = [
  { id: "t-north", name: "Sales North", department: "Sales", managerKey: "sara" },
  { id: "t-south", name: "Sales South", department: "Sales", managerKey: "marcus" },
  { id: "t-research", name: "Research", department: "Research", managerKey: "leila" },
  { id: "t-quality", name: "Data quality", department: "Data quality", managerKey: "tom" },
];

const COMPANIES = ["Northwind Logistics", "Bluepeak Software", "Harbor Health Group", "Lumen Retail", "Cedar Finance", "Orbit Media", "Apex Energy", "Willow Education",
  "Granite Systems", "Summit Labs", "Riverbend Foods", "Ironclad Security", "Pioneer Telecom", "Evergreen Travel", "Falcon Analytics", "Maple Insurance", "Nimbus Cloud",
  "Oakridge Realty", "Quartz Robotics", "Redwood Legal", "Sable Fashion", "Tidewater Marine", "Union Freight", "Vertex Pharma", "Atlas Mining", "Beacon Hotels",
  "Coral Biotech", "Delta Packaging", "Ember Studios", "Fjord Shipping", "Glacier Water", "Horizon Aviation"];
const SOURCES = ["Instantly campaign", "LinkedIn outreach", "Referral", "Webinar", "Inbound website", "Conference list"];
const LOST_REASONS = ["Chose a competitor", "Budget frozen", "No decision made", "Timing not right", "Project cancelled"];

const TASK_TITLES: Record<TaskType, string[]> = {
  research: ["Research decision makers at", "Find verified emails for", "Profile the tech stack of", "Map the org chart at"],
  cleaning: ["Clean and de-duplicate contacts for", "Fix missing fields on", "Validate phone numbers for", "Standardise job titles at"],
  outreach: ["Send intro sequence to", "Personalised outreach to", "Re-engage cold leads at", "LinkedIn connection round for"],
  calling: ["Discovery call with", "Qualification calls for", "Callback round for", "Warm-up calls at"],
  follow_up: ["Follow up on proposal with", "Check in after demo with", "Chase signed order form from", "Follow up on meeting with"],
};

// ───────────────────────────── generator ─────────────────────────────

export function buildDemoDataset(now: Date = new Date()): Dataset {
  const today = startOfUtcDay(now);
  const rand = rng(DEMO_SEED);
  const between = (a: number, b: number) => a + rand() * (b - a);
  const int = (a: number, b: number) => Math.floor(between(a, b + 1));
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];

  const idOf = new Map<string, string>();
  PEOPLE.forEach((p, i) => idOf.set(p.key, demoId(1, i + 1)));
  const people: Person[] = PEOPLE.map((p) => ({
    id: idOf.get(p.key)!,
    name: p.name,
    email: `${p.key}@demo.codeautomation.example`,
    role: p.role,
    title: p.title,
    department: p.department,
    teamId: p.teamId,
    managerId: p.managerId ? idOf.get(p.managerId)! : null,
    status: p.status,
    joinedAt: addDays(today, -p.joinedDaysAgo),
    skill: p.skill,
  }));
  const teams: Team[] = TEAM_DEFS.map((t) => ({ id: t.id, name: t.name, department: t.department, managerId: idOf.get(t.managerKey)! }));
  const byId = new Map(people.map((p) => [p.id, p]));

  // A suspended person's work stops 40 days ago; everyone else works through to 45 days ahead.
  const SUSPENDED_CUTOFF = -40;

  // ── Tasks: assignments to sales and research staff ──
  const tasks: Task[] = [];
  let taskN = 0;
  for (const p of people) {
    if (p.role !== "sales_bd" && p.role !== "data_researcher") continue;
    const types: TaskType[] = p.role === "sales_bd" ? ["outreach", "calling", "follow_up", "outreach", "calling"] : ["research", "cleaning", "research", "cleaning", "follow_up"];
    const maxOff = p.status === "suspended" ? SUSPENDED_CUTOFF : 14;
    const count = p.status === "suspended" ? 40 : 80;
    for (let k = 0; k < count; k++) {
      const off = int(-100, maxOff);
      const type = pick(types);
      const dueAt = new Date(addDays(today, off).getTime() + 17 * HOUR);
      const createdAt = new Date(dueAt.getTime() - int(3, 10) * DAY);
      const priority: Priority = pick(["low", "normal", "normal", "normal", "high", "high", "urgent"] as Priority[]);
      const requiresEvidence = rand() > 0.15;
      const skill = p.skill;
      let status: AssignmentStatus;
      let submittedAt: Date | null = null;
      let completedAt: Date | null = null;
      const r = rand();
      if (off < 0) {
        const recent = off > -35;
        const lateDays = rand() < (1 - skill) * 1.4 ? int(1, 4) : 0;
        if (r < 0.04 + (1 - skill) * 0.12) {
          status = "rejected";
          submittedAt = new Date(dueAt.getTime() - int(0, 2) * DAY);
        } else if (recent && r < 0.06 + (1 - skill) * 0.12 + (1 - skill) * 0.42) {
          status = rand() < 0.55 ? "open" : "in_progress"; // still not done, now overdue
        } else if (off > -6 && r < 0.9 && r > 0.82) {
          status = "verified"; // submitted, waiting for the manager
          submittedAt = new Date(Math.min(now.getTime() - HOUR, dueAt.getTime() + lateDays * DAY - HOUR));
        } else {
          status = "approved";
          submittedAt = new Date(dueAt.getTime() + lateDays * DAY - int(2, 30) * HOUR);
          completedAt = new Date(submittedAt.getTime() + int(2, 20) * HOUR);
          if (completedAt.getTime() > now.getTime()) completedAt = new Date(now.getTime() - HOUR);
          if (submittedAt.getTime() > completedAt.getTime()) submittedAt = new Date(completedAt.getTime() - HOUR);
        }
      } else if (r < 0.43) status = "open";
      else if (r < 0.7) status = "in_progress";
      else if (r < 0.75) status = "on_hold";
      else if (r < 0.9 && off <= 6) {
        status = "verified";
        submittedAt = new Date(now.getTime() - int(1, 30) * HOUR);
      } else if (off <= 3) {
        status = "approved";
        submittedAt = new Date(now.getTime() - int(6, 40) * HOUR);
        completedAt = new Date(submittedAt.getTime() + int(1, 4) * HOUR);
        if (completedAt.getTime() > now.getTime()) completedAt = new Date(now.getTime() - HOUR);
        if (submittedAt.getTime() > completedAt.getTime()) submittedAt = new Date(completedAt.getTime() - HOUR);
      } else status = "open";

      const evidenceCount = status === "verified" || status === "approved" || status === "rejected" ? (requiresEvidence ? int(1, 3) : int(0, 1)) : status === "in_progress" ? int(0, 1) : 0;
      tasks.push({
        id: demoId(2, ++taskN),
        assigneeId: p.id,
        assignedById: p.managerId ?? people[0].id,
        title: `${pick(TASK_TITLES[type])} ${pick(COMPANIES)}`,
        type, priority, status, createdAt, dueAt, submittedAt, completedAt, requiresEvidence, evidenceCount,
      });
    }
  }

  // ── Deals, targets, leads and follow-ups for sales staff ──
  const sales = people.filter((p) => p.role === "sales_bd");
  const monthlyTarget: Record<string, number> = {};
  const opportunities: Opportunity[] = [];
  const leads: Lead[] = [];
  const followUps: FollowUp[] = [];
  let oppN = 0, leadN = 0, fuN = 0;
  const monthStart = (back: number) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - back, 1));
  const daysInMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();

  for (const p of sales) {
    const senior = /Senior/.test(p.title);
    const target = senior ? 60000 : /Junior/.test(p.title) ? 30000 : 45000;
    monthlyTarget[p.id] = target;
    const lastMonth = p.status === "suspended" ? 2 : 0; // suspended: no activity in the current and previous month
    for (let back = 3; back >= lastMonth; back--) {
      const ms = monthStart(back);
      const dim = daysInMonth(ms);
      const lastDay = back === 0 ? Math.max(1, today.getUTCDate()) : dim;
      const progress = back === 0 ? Math.min(1, lastDay / dim + 0.08) : 1;
      const attain = (0.55 + p.skill * 0.6) * between(0.85, 1.12) * progress;
      const wonTotal = target * attain;
      const nWon = Math.max(1, Math.round(wonTotal / 22000));
      const weights = Array.from({ length: nWon }, () => between(0.6, 1.5));
      const wsum = weights.reduce((a, b) => a + b, 0);
      for (let i = 0; i < nWon; i++) {
        const closedAt = new Date(Math.min(now.getTime() - HOUR, ms.getTime() + (int(1, lastDay) - 1) * DAY + int(9, 17) * HOUR));
        const createdAt = addDays(closedAt, -int(18, 60));
        opportunities.push({
          id: demoId(3, ++oppN), ownerId: p.id, company: pick(COMPANIES), stage: "won",
          value: Math.round((wonTotal * weights[i]) / wsum / 100) * 100, createdAt, expectedCloseAt: closedAt, closedAt, lostReason: null, lastActivityAt: closedAt,
        });
      }
      const nLost = Math.round((int(1, 2) + (p.skill < 0.75 ? 1 : 0)) * progress);
      for (let i = 0; i < nLost; i++) {
        const closedAt = new Date(Math.min(now.getTime() - HOUR, ms.getTime() + (int(1, lastDay) - 1) * DAY + int(9, 17) * HOUR));
        opportunities.push({
          id: demoId(3, ++oppN), ownerId: p.id, company: pick(COMPANIES), stage: "lost",
          value: Math.round(between(6000, 38000) / 100) * 100, createdAt: addDays(closedAt, -int(15, 55)), expectedCloseAt: closedAt, closedAt,
          lostReason: pick(LOST_REASONS), lastActivityAt: closedAt,
        });
      }
    }
    if (p.status === "active") {
      const nOpen = senior ? 8 : 6;
      for (let i = 0; i < nOpen; i++) {
        const stage = pick(["qualified", "qualified", "discovery", "discovery", "proposal", "proposal", "negotiation"] as Stage[]);
        const createdAt = addDays(today, -int(4, 70));
        const stale = rand() < 0.18;
        opportunities.push({
          id: demoId(3, ++oppN), ownerId: p.id, company: pick(COMPANIES), stage,
          value: Math.round(between(8000, 65000) / 100) * 100, createdAt, expectedCloseAt: addDays(today, int(-6, 60)), closedAt: null, lostReason: null,
          lastActivityAt: stale ? addDays(today, -int(15, 30)) : addDays(today, -int(0, 9)),
        });
      }
    }
  }

  // Leads: every deal started as a qualified lead, and a steady stream of other leads sits around them in the funnel.
  // Qualified leads are exactly the ones that became a deal, so lead-to-qualified conversion ties back to the pipeline.
  for (const o of opportunities) {
    leads.push({ id: demoId(4, ++leadN), ownerId: o.ownerId, company: o.company, source: pick(SOURCES), status: "qualified", createdAt: addDays(o.createdAt, -int(2, 12)) });
  }
  for (const p of sales) {
    const lastDay = p.status === "suspended" ? -40 : 0;
    for (let off = -100; off <= lastDay; off++) {
      const perDay = rand() < 0.35 + p.skill * 0.35 ? (rand() < 0.3 ? 2 : 1) : 0;
      for (let i = 0; i < perDay; i++) {
        const age = -off;
        const status: LeadStatusKey = age < 4 ? pick(["new", "new", "researching"] as LeadStatusKey[]) : age < 14 ? pick(["researching", "contacted", "contacted", "engaged"] as LeadStatusKey[]) : pick(["contacted", "engaged", "engaged", "disqualified", "disqualified"] as LeadStatusKey[]);
        const createdAt = new Date(addDays(today, off).getTime() + int(8, 17) * HOUR);
        if (createdAt.getTime() > now.getTime()) continue;
        leads.push({ id: demoId(4, ++leadN), ownerId: p.id, company: pick(COMPANIES), source: pick(SOURCES), status, createdAt });
      }
    }
  }
  for (const p of sales.filter((s) => s.status === "active")) {
    const n = int(7, 10);
    for (let i = 0; i < n; i++) {
      const dueAt = new Date(addDays(today, int(-5, 8)).getTime() + int(9, 16) * HOUR);
      const past = dueAt.getTime() < now.getTime();
      followUps.push({
        id: demoId(5, ++fuN), ownerId: p.id, company: pick(COMPANIES), kind: pick(["call", "email", "meeting"] as const),
        subject: pick(["Send revised proposal", "Confirm demo time", "Ask about budget cycle", "Share case study", "Intro to technical lead", "Contract questions"]),
        dueAt, done: past ? rand() < 0.55 + p.skill * 0.3 : false,
      });
    }
  }

  // ── Administration ──
  const ceo = people[0];
  const admin = people[1];
  const exportRequests: ExportRequest[] = [
    { id: demoId(6, 1), requestedById: idOf.get("priya")!, dataset: "Qualified contacts, UK", rows: 1840, requestedAt: new Date(now.getTime() - 5 * HOUR) },
    { id: demoId(6, 2), requestedById: idOf.get("sara")!, dataset: "North pipeline report", rows: 212, requestedAt: new Date(now.getTime() - 27 * HOUR) },
    { id: demoId(6, 3), requestedById: idOf.get("yuki")!, dataset: "Verified emails, SaaS sector", rows: 5320, requestedAt: new Date(now.getTime() - 52 * HOUR) },
  ];
  const invitations: Invitation[] = [
    { id: demoId(7, 1), email: "new.researcher@demo.codeautomation.example", role: "data_researcher", sentAt: addDays(now, -2), invitedById: admin.id },
    { id: demoId(7, 2), email: "new.bd@demo.codeautomation.example", role: "sales_bd", sentAt: addDays(now, -4), invitedById: admin.id },
  ];
  const integrations: Integration[] = [
    { id: "instantly", name: "Instantly", status: "healthy", lastSyncAt: new Date(now.getTime() - 12 * 60000), note: "Campaigns and replies syncing" },
    { id: "ringcentral", name: "RingCentral", status: "healthy", lastSyncAt: new Date(now.getTime() - 25 * 60000), note: "Calls syncing" },
    { id: "calendar", name: "Calendar", status: "delayed", lastSyncAt: new Date(now.getTime() - 7 * HOUR), note: "Last sync over 6 hours ago" },
    { id: "email", name: "Business email", status: "healthy", lastSyncAt: new Date(now.getTime() - 40 * 60000), note: "Conversations linked" },
    { id: "salesforce", name: "Salesforce", status: "error", lastSyncAt: addDays(now, -2), note: "Authentication expired: reconnect" },
  ];
  const systemEvents: SystemEvent[] = [
    { id: demoId(8, 1), at: new Date(now.getTime() - 2 * HOUR), actorId: admin.id, text: "Invited new.bd@demo.codeautomation.example as Sales / BD", kind: "user" },
    { id: demoId(8, 2), at: new Date(now.getTime() - 5 * HOUR), actorId: idOf.get("leila")!, text: "Completed import of 1,240 contacts (38 duplicates skipped)", kind: "data" },
    { id: demoId(8, 3), at: new Date(now.getTime() - 9 * HOUR), actorId: ceo.id, text: "Approved export: Customer list, EMEA (904 rows)", kind: "approval" },
    { id: demoId(8, 4), at: new Date(now.getTime() - 26 * HOUR), actorId: admin.id, text: "Suspended Kwame Mensah's access", kind: "security" },
    { id: demoId(8, 5), at: new Date(now.getTime() - 31 * HOUR), actorId: admin.id, text: "Rotated the Instantly API key", kind: "security" },
    { id: demoId(8, 6), at: new Date(now.getTime() - 48 * HOUR), actorId: ceo.id, text: "Changed Tom Brennan's role to Manager", kind: "user" },
    { id: demoId(8, 7), at: new Date(now.getTime() - 55 * HOUR), actorId: admin.id, text: "Salesforce connection reported an authentication error", kind: "integration" },
    { id: demoId(8, 8), at: new Date(now.getTime() - 74 * HOUR), actorId: idOf.get("tom")!, text: "Merged 56 duplicate accounts in Data quality", kind: "data" },
  ];

  return { isDemo: true, today, people, teams, tasks, opportunities, leads, followUps, monthlyTarget, exportRequests, invitations, integrations, systemEvents };
}
