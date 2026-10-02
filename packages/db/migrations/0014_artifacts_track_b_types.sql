-- 0014 — Step 4B M4: Track B sites in the artifact store.
--
-- A Track B build is a Next.js static export, checkpointed as a folder clients/<slug>/sites/track-b/ that
-- holds the static output (HTML, CSS, JavaScript chunks, the RSC payload .txt files, self-hosted woff2
-- fonts), the project source it was built from under _source/ (TypeScript, CSS and JSON, stored as
-- text/plain or their own type), content.json and site.manifest.json, which pins every file's sha256
-- (packages/workflow/src/buildAndVerify.ts, contentTypeFor in supabaseArtifacts.ts). 0009/0012 allowed
-- only text/html and application/json, so the export would be refused. This adds exactly the types the
-- export and its source use. Nothing else changes: the bucket stays private, the size limit stays 2 MB
-- per object (the largest Track B file measured is about 0.25 MB), the only policy is still the
-- owner/admin read from 0009, and writes remain service-role only. No table, no RLS change.

update storage.buckets
set allowed_mime_types = array[
  'text/html',
  'application/json',
  'text/css',
  'text/javascript',
  'text/plain',
  'image/svg+xml',
  'image/x-icon',
  'font/woff2'
]
where id = 'artifacts';
