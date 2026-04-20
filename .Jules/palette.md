## 2026-04-20 - Native Tooltips for Icon-Only Buttons
**Learning:** Native HTML `title` attributes complement `aria-label`s perfectly for icon-only buttons. While `aria-label` ensures screen reader accessibility, adding `title` provides immediate visual feedback (tooltips) for sighted users, improving discoverability without custom JS/CSS tooltips.
**Action:** Always add a `title` attribute mirroring the `aria-label` when implementing icon-only buttons (like clear search inputs or minimalist sidebar navigation) to enhance usability for sighted users.
