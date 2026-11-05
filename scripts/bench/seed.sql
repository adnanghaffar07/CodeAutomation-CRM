-- Synthetic data for the scale test: 1 workspace, 20 users, N accounts, M contacts. Throwaway database only.
-- psql -v accounts=300000 -v contacts=2000000 -f scripts/bench/seed.sql
\set ON_ERROR_STOP on
\timing on

-- Users: 1 CEO, 1 manager, 10 sales, 8 researchers (fixed ids so the queries can use them).
create temp table bench_users as
select i, ('00000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid as id,
       case when i = 1 then 'ceo_admin' when i = 2 then 'manager' when i <= 12 then 'sales_bd' else 'data_researcher' end as role
from generate_series(1, 20) i;

insert into "Workspace" (id, name, slug) values ('11111111-1111-4111-8111-111111111111', 'Bench', 'bench') on conflict do nothing;

-- Accounts
insert into "Account" (id, "workspaceId", name, domain, industry, "sizeBand", city, country, "createdById", "ownerId", "assigneeIds",
                       tags, qualification, "searchText", "createdAt", "updatedAt")
select gen_random_uuid(), '11111111-1111-4111-8111-111111111111',
       co.name, lower(replace(co.name, ' ', '')) || n || '.com',
       (array['Software','Finance','Healthcare','Retail','Logistics','Education','Energy','Media'])[1 + (n % 8)],
       (array['1-10','11-50','51-200','201-1000','1000+'])[1 + (n % 5)],
       (array['London','Austin','Berlin','Lahore','Dubai','Toronto','Sydney','Singapore'])[1 + (n % 8)],
       (array['GB','US','DE','PK','AE','CA','AU','SG'])[1 + (n % 8)],
       u.id, u.id, '{}',
       case when n % 5 = 0 then array['target'] else '{}' end,
       (array['new','researching','contacted','engaged','qualified','disqualified'])[1 + (n % 6)]::"LeadStatus",
       lower(co.name || ' ' || n),
       now() - (random() * interval '730 days'), now()
from generate_series(1, :accounts) n
cross join lateral (select (array['Acme','Globex','Initech','Umbrella','Hooli','Vandelay','Stark','Wayne','Wonka','Tyrell','Cyberdyne','Soylent'])[1 + (n % 12)] || ' ' ||
                           (array['Systems','Labs','Group','Partners','Digital','Holdings'])[1 + (n % 6)] as name) co
cross join lateral (select id from bench_users where i = 3 + (n % 18) limit 1) u;

create temp table bench_accounts as select id, row_number() over () as rn from "Account";
create index on bench_accounts (rn);

-- Contacts: created and owned by sales/researchers; ~10% also assigned to a second person.
insert into "Contact" (id, "workspaceId", "accountId", "firstName", "lastName", "fullName", email, "emailStatus", "jobTitle", city, country,
                       "createdById", "ownerId", "assigneeIds", tags, qualification, "followUpAt", "searchText", "createdAt", "updatedAt")
select gen_random_uuid(), '11111111-1111-4111-8111-111111111111', a.id, f.v, l.v, f.v || ' ' || l.v,
       lower(f.v || '.' || l.v || n || '@' || 'example' || (n % 1000) || '.com'),
       case when n % 40 = 0 then 'unsubscribed' when n % 97 = 0 then 'bounced' else 'active' end::"EmailStatus",
       (array['CEO','CTO','Head of Sales','VP Engineering','Marketing Manager','Founder','Operations Lead','Procurement'])[1 + (n % 8)],
       (array['London','Austin','Berlin','Lahore','Dubai','Toronto','Sydney','Singapore'])[1 + (n % 8)],
       (array['GB','US','DE','PK','AE','CA','AU','SG'])[1 + (n % 8)],
       u.id, u.id,
       case when n % 10 = 0 then array[u2.id] else '{}'::uuid[] end,
       case n % 6 when 0 then array['hot','2024-event'] when 1 then array['webinar'] when 2 then array['referral','partner'] else '{}'::text[] end,
       (array['new','researching','contacted','engaged','qualified','disqualified'])[1 + (n % 6)]::"LeadStatus",
       case when n % 3 = 0 then now() + (random() * interval '60 days') - interval '10 days' else null end,
       lower(f.v || ' ' || l.v || ' ' || f.v || '.' || l.v || n || '@example' || (n % 1000) || '.com' || ' ' || (array['CEO','CTO','Head of Sales','VP Engineering','Marketing Manager','Founder','Operations Lead','Procurement'])[1 + (n % 8)]),
       now() - (random() * interval '730 days'), now()
from generate_series(1, :contacts) n
cross join lateral (select (array['Ada','Grace','Alan','Linus','Margaret','Dennis','Barbara','Ken','Radia','Tim','Sophie','Omar','Priya','Chen','Fatima','Jamal','Elena','Diego','Yuki','Noah'])[1 + (n % 20)] v) f
cross join lateral (select (array['Lovelace','Hopper','Turing','Torvalds','Hamilton','Ritchie','Liskov','Thompson','Perlman','Berners','Wilson','Khan','Sharma','Wei','Ali','Smith','Petrova','Garcia','Tanaka','Brown'])[1 + ((n / 20) % 20)] v) l
cross join lateral (select id from bench_users where i = 3 + (n % 18) limit 1) u
cross join lateral (select id from bench_users where i = 3 + ((n + 5) % 18) limit 1) u2
join bench_accounts a on a.rn = 1 + (n % :accounts);

analyze "Contact";
analyze "Account";
select count(*) as contacts from "Contact";
select pg_size_pretty(pg_total_relation_size('"Contact"')) as contact_table_with_indexes;
