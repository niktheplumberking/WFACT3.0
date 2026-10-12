-- 0019 — MVP M5 (docs/MVP-CUTLINE.md): launch files in the artifact store.
--
-- Both starters now ship a share card, og-image.png (1200x630, the brand's deep and accent colours, a few KB),
-- next to robots.txt, llms.txt, sitemap.xml and 404.html (packages/frontend-loop/src/launch.ts). The text files
-- already fit 0014's types; the PNG does not, so a Track A or Track B checkpoint would be refused. This adds
-- exactly image/png. Nothing else changes: the bucket stays private, the 2 MB per-object limit stays, the only
-- policy is still the owner/admin read from 0009, and writes remain service-role only. No table, no RLS change.

update storage.buckets
set allowed_mime_types = array[
  'text/html',
  'application/json',
  'text/css',
  'text/javascript',
  'text/plain',
  'image/svg+xml',
  'image/x-icon',
  'font/woff2',
  'image/png'
]
where id = 'artifacts';
