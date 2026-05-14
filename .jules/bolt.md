## 2026-05-09 - Fix N+1 database queries on bulk import
**Learning:** Sequential, individual database `.insert()` calls inside a loop (`useBibTeXImport` parsing many papers) create an N+1 network request bottleneck that severely degrades performance. Supabase natively supports passing an array of objects to `.insert()`.
**Action:** Always write a bulk insertion function variant (e.g. `createPapers`) that utilizes `supabase.from('table').insert(arrayOfObjects)` instead of calling the single-item creation function repeatedly inside a loop.
