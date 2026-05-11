## 2024-05-18 - Optimize BibTeX Import
**Learning:** BibTeX imports loop over `onAdd` resulting in the N+1 problem for Supabase database insertions.
**Action:** Always provide batch operations, such as `insert(validPayloads)`, to avoid inserting database rows in a loop sequentially.
