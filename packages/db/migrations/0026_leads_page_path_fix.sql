-- 0026 — Fix the leads.page_path check from 0025 (Step 25 / MVP M4, 2026-10-15). Found by the attack test on the applied
-- migration (scripts/rls_attack_test_leads.sql): the pattern '{0,299}' is over Postgres' regex repetition limit (255), so
-- every insert into leads failed with 2201B "invalid repetition count(s)" and no lead could be stored. The length cap moves
-- to length(); the character rule is unchanged. A path never starts with "//" (the function refuses it too).
alter table public.leads drop constraint if exists leads_page_path_check;
alter table public.leads add constraint leads_page_path_check
  check (page_path ~ '^/[A-Za-z0-9/_.-]*$' and page_path !~ '^//' and length(page_path) <= 300);
