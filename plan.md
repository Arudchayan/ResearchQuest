1. **Add `convertPapersToMarkdown` in `src/utils/export.ts`**
   - Create a new function `convertPapersToMarkdown(papers: Paper[]): string` that formats papers into Markdown strings.
   - It will map over the array of papers and convert them to Markdown. Each paper will have a title, publication date, authors, DOI, abstract, and notes.

2. **Add Markdown export option to `PapersView.tsx`**
   - Add a "Markdown (.md)" option to the Export DropdownMenu in `src/components/papers/PapersView.tsx`.
   - Update the `handleExport` function to handle the `"markdown"` case by using `convertPapersToMarkdown` and downloading the file with `downloadFile`.

3. **Update PR Title and Description (.jules/innovator.md)**
   - As required by the prompt, update the `innovator.md` file if applicable, and make sure we create an appropriate PR.
   - Run tests to ensure the feature doesn't break any functionality.

4. **Complete pre-commit steps**
   - Complete pre commit steps to make sure proper testing, verifications, reviews and reflections are done.

5. **Submit the change**
   - Commit and submit the code changes.
