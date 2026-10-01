-- 0012 — Step 4B M3: multi-page sites in the artifact store.
--
-- A Track A build is checkpointed as a folder: clients/<slug>/sites/<site>/ holding the page files
-- (text/html), the content it was rendered from (content.json) and a manifest that pins every file's
-- sha256 (site.manifest.json). 0009 created the private `artifacts` bucket for HTML only, so the two
-- JSON files would be refused. This adds application/json to the allowed types. Nothing else changes:
-- the bucket stays private, the size limit stays 2 MB per object, and the only policy is still the
-- owner/admin read from 0009 (writes remain service-role only). No table, no RLS change.

update storage.buckets
set allowed_mime_types = array['text/html', 'application/json']
where id = 'artifacts';
