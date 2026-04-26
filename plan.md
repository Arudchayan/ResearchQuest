1. **Add `id` and `htmlFor` to form inputs**
   - In `src/components/topics/TopicSelector.tsx`, add `htmlFor="new-topic-name"` to the `<label>` and `id="new-topic-name"` to the `<input>`.
   - In `src/components/topics/TopicDetailView.tsx`, add `aria-label="Topic name"` to the `<input>` (there's no label text).
   - In `src/components/topics/TopicsView.tsx`, add `aria-label="New topic name"` to the `<input>` for creating a new topic.
   - In `src/components/entities/IdeaDetailView.tsx`, the `<input>` for `Idea title` is already correctly labelled with `aria-label`.
   - In `src/components/entities/PaperDetailView.tsx`, the `<input>` for `Paper title` and `Authors` are already correctly labelled with `aria-label`.
   - In `src/components/editor/sub-components/EditorHeader.tsx`, the `<input>` for `Note title` is already correctly labelled with `aria-label`.

   *Self-correction: I found false positives in my earlier checks because I was matching `aria-label` incorrectly or some elements like `IdeaDetailView` already had them. The missing ones are `TopicsView` and `TopicDetailView` and `TopicSelector`. Let's fix them.*

2. **Verify Changes and Pre-commit Instructions**
   - Run `pnpm lint` and `pnpm test` in a bash session to verify the changes.
   - Complete pre commit steps to make sure proper testing, verifications, reviews and reflections are done.

3. **Submit PR**
   - Create PR using `submit` tool following Palette's specific format ("🎨 Palette: Fix input accessibility in topics").
