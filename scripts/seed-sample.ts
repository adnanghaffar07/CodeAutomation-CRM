// Small, fictional sample dataset for development: 24 companies and 80 contacts spread over the people who exist in the workspace.
// Every row has source = "sample-data" and the tag "sample", so removing it is one command and never touches real records.
//   npm run seed:sample          add the sample data (does nothing if it is already there)
//   npm run seed:sample -- clear remove it again
import { PrismaClient, type LeadStatus, type EmailStatus } from "@prisma/client";
import { loadEnv } from "./_env";
import { fullName, searchBlob, normDomain } from "../src/lib/records/text";

loadEnv();
const SOURCE = "sample-data";

const COMPANIES = ["Northwind Logistics", "Bluepeak Software", "Harbor Health Group", "Lumen Retail", "Cedar Finance", "Orbit Media", "Apex Energy", "Willow Education", "Granite Systems", "Summit Labs", "Riverbend Foods", "Ironclad Security",
  "Pioneer Telecom", "Evergreen Travel", "Falcon Analytics", "Maple Insurance", "Nimbus Cloud", "Oakridge Realty", "Quartz Robotics", "Redwood Legal", "Sable Fashion", "Tidewater Marine", "Union Freight", "Vertex Pharma"];
const INDUSTRIES = ["Logistics", "Software", "Healthcare", "Retail", "Finance", "Media", "Energy", "Education"];
const CITIES: [string, string][] = [["London", "GB"], ["Austin", "US"], ["Berlin", "DE"], ["Lahore", "PK"], ["Dubai", "AE"], ["Toronto", "CA"], ["Sydney", "AU"], ["Singapore", "SG"]];
const FIRST = ["Ada", "Grace", "Alan", "Linus", "Margaret", "Dennis", "Barbara", "Ken", "Radia", "Tim", "Sophie", "Omar", "Priya", "Chen", "Fatima", "Jamal", "Elena", "Diego", "Yuki", "Noah"];
const LAST = ["Lovelace", "Hopper", "Turing", "Torvalds", "Hamilton", "Ritchie", "Liskov", "Thompson", "Perlman", "Berners", "Wilson", "Khan", "Sharma", "Wei", "Ali", "Smith", "Petrova", "Garcia", "Tanaka", "Brown"];
const TITLES = ["CEO", "CTO", "Head of Sales", "VP Engineering", "Marketing Manager", "Founder", "Operations Lead", "Procurement Manager"];
const STATUSES: LeadStatus[] = ["new", "researching", "contacted", "engaged", "qualified", "disqualified"];
const NOTES = ["Intro call went well. Wants a proposal after the next board meeting.", "Left a voicemail. Try again Thursday morning.", "Asked us to send case studies for the logistics sector.", "Budget approved for next quarter. Decision maker is the CTO."];

async function main() {
  const clear = process.argv.includes("clear");
  const db = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
  try {
    const ws = await db.workspace.findUniqueOrThrow({ where: { slug: "codeautomation" } });
    if (clear) {
      const [cs, as] = await Promise.all([
        db.contact.findMany({ where: { workspaceId: ws.id, source: SOURCE }, select: { id: true } }),
        db.account.findMany({ where: { workspaceId: ws.id, source: SOURCE }, select: { id: true } }),
      ]);
      const ids = [...cs, ...as].map((r) => r.id);
      await db.activity.deleteMany({ where: { workspaceId: ws.id, recordId: { in: ids } } });
      const c = await db.contact.deleteMany({ where: { workspaceId: ws.id, source: SOURCE } });
      const a = await db.account.deleteMany({ where: { workspaceId: ws.id, source: SOURCE } });
      console.log(`Removed ${c.count} sample contacts and ${a.count} sample accounts.`);
      return;
    }
    if ((await db.account.count({ where: { workspaceId: ws.id, source: SOURCE } })) > 0) {
      console.log("Sample data is already there. Run with 'clear' first to recreate it.");
      return;
    }
    const members = await db.workspaceMember.findMany({ where: { workspaceId: ws.id, status: "active" }, orderBy: { createdAt: "asc" } });
    if (members.length === 0) throw new Error("No members yet: create your admin first (npm run admin:link).");
    const person = (i: number) => members[i % members.length];

    const accounts = [];
    for (let i = 0; i < COMPANIES.length; i++) {
      const name = COMPANIES[i];
      const [city, country] = CITIES[i % CITIES.length];
      const owner = person(i);
      const domain = normDomain(name.toLowerCase().replace(/[^a-z]/g, "") + ".example");
      accounts.push(await db.account.create({
        data: {
          workspaceId: ws.id, name, domain, website: `https://${domain}`, industry: INDUSTRIES[i % INDUSTRIES.length],
          sizeBand: ["1-10", "11-50", "51-200", "201-1000", "1000+"][i % 5], city, country, source: SOURCE,
          createdById: owner.userId, ownerId: owner.userId, tags: i % 4 === 0 ? ["sample", "target"] : ["sample"],
          qualification: STATUSES[i % 6], serviceInterest: i % 3 === 0 ? "Automation audit" : null,
          searchText: searchBlob([name, domain, INDUSTRIES[i % INDUSTRIES.length], city, country]),
        },
      }));
    }

    const now = Date.now();
    let contacts = 0;
    for (let i = 0; i < 80; i++) {
      const first = FIRST[i % FIRST.length];
      const last = LAST[(i * 7 + 3) % LAST.length];
      const acc = accounts[i % accounts.length];
      const owner = person(i + 1);
      const [city, country] = CITIES[(i + 2) % CITIES.length];
      const email = `${first}.${last}${i}@${acc.domain}`.toLowerCase();
      const emailStatus: EmailStatus = i % 17 === 0 ? "unsubscribed" : i % 23 === 0 ? "bounced" : i % 29 === 0 ? "do_not_contact" : "active";
      const title = TITLES[i % TITLES.length];
      const created = await db.contact.create({
        data: {
          workspaceId: ws.id, accountId: acc.id, firstName: first, lastName: last, fullName: fullName(first, last), email, emailStatus,
          jobTitle: title, city, country, source: SOURCE, createdById: owner.userId, ownerId: owner.userId,
          assigneeIds: i % 9 === 0 ? [person(i + 2).userId] : [],
          tags: i % 5 === 0 ? ["sample", "hot"] : i % 5 === 1 ? ["sample", "webinar"] : ["sample"],
          qualification: STATUSES[i % 6], nextAction: i % 4 === 0 ? "Send proposal" : i % 4 === 1 ? "Follow-up call" : null,
          followUpAt: i % 3 === 0 ? new Date(now + (i % 14 - 4) * 86_400_000) : null,
          verifiedAt: i % 6 === 0 ? new Date(now - 5 * 86_400_000) : null,
          createdAt: new Date(now - (i * 3 + 1) * 86_400_000), updatedAt: new Date(now - i * 86_400_000),
          searchText: searchBlob([fullName(first, last), email, title, acc.name, city, country]),
        },
      });
      contacts++;
      if (i % 5 === 0) {
        await db.activity.createMany({ data: [
          { workspaceId: ws.id, recordType: "contact", recordId: created.id, kind: "system", summary: "Contact created", actorId: owner.userId, actorEmail: owner.email, source: "system", occurredAt: created.createdAt },
          { workspaceId: ws.id, recordType: "contact", recordId: created.id, kind: "note", summary: "Note", body: NOTES[(i / 5) % NOTES.length], actorId: owner.userId, actorEmail: owner.email, source: "manual", occurredAt: new Date(now - i * 43_200_000) },
        ] });
      }
    }
    console.log(`Added ${accounts.length} sample accounts and ${contacts} sample contacts, owned by ${members.length} member(s).`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => { console.error("seed-sample failed:", String(e.message ?? e)); process.exit(1); });
