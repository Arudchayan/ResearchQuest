# Learning Platform → ResearchQuest task handoff

The optional `lessonUrl` must point to an approved Learning Atlas subject or shared lesson path on `https://learning-platform-chi-ten.vercel.app`. ResearchQuest includes that exact lesson URL in the draft and uses it for the **Back to lesson** link. Missing or untrusted URLs fall back to the Atlas home.

Learning Platform can link to ResearchQuest's existing task creator with a normal URL:

```
https://<researchquest-host>/tasks?source=learning-platform&subject=<encoded-subject>&lesson=<encoded-lesson>&title=<encoded-task-title>&lessonUrl=<encoded-lesson-URL>&prompt=<encoded-investigation>
```

Build this URL with `URL` and `URLSearchParams`; use the ResearchQuest deployment's actual HTTPS origin. `source=learning-platform` and a nonempty `title` are required. `subject` and `lesson` are optional human-readable labels. `lessonUrl` is an optional trusted return URL. `prompt` is an optional study or investigation suggestion, limited to 500 characters in the receiving app. ResearchQuest opens an editable **New Task** dialog with the supplied title, a Study category, and a description identifying the subject, lesson, and suggested investigation. The user must choose **Create**; following the link never saves a task automatically. Closing the dialog saves nothing.

The draft includes a **Back to lesson** link that opens the trusted exact lesson, or the Atlas home when no valid lesson URL was provided. The same strict URL allowlist governs the draft link and the **Return to lesson** link on a saved task card. URLs longer than 900 characters are rejected. The task description is capped at 1,000 characters; subject, lesson, and investigation text may be shortened to preserve an accepted return URL exactly. The handoff fields are removed from the address bar after the draft opens, so a refresh does not repeat the handoff. Other query fields and the fragment are retained. Existing `/tasks/:id` deep links do not open a draft. Authentication and demo entry continue through the normal ResearchQuest flow; the full query survives sign-in or **Use demo workspace**, including a click before React mounts. Ordinary demo entry still opens the seeded first-run topic. Demo data lives in memory and resets on reload; lasting task storage requires signing in. A failed save keeps the editable draft open. There is no `return` parameter or automatic cross-site redirect in this contract.

After a task is saved, its card renders **Return to lesson** when its description retains one validated Atlas lesson URL. Shared lesson URLs use the known subject slugs and a safe lesson slug; selected legacy lab paths are also recognized. An edited, missing, or untrusted URL stays plain text. This is navigation between apps: task completion does not update Atlas lesson progress, and the two products do not share an account or a mastery score.
