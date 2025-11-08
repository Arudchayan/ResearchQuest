# Modern Spacing and Layout Systems: From Grids to Proportional Responsiveness

## Executive Summary

Most successful digital products look cohesive not because they are complicated, but because they are built on predictable spatial rules that scale across devices, teams, and time. The most durable of these rules combine two complementary ideas: a discrete spacing scale (typically 4pt or 8pt) to govern rhythm and alignment, and proportional responsiveness (percentages, ratios, and modern viewport units) to ensure the same interface adapts to different containers and screens. When executed as a system rather than a set of one-off decisions, these rules reduce design debt, make components more reusable, and protect accessibility without sacrificing visual polish.

Several mature design systems codify this pairing. Atlassian anchors spacing in an 8px base with a tokenized scale to keep layout decisions consistent and composable. Shopify Polaris builds its admin on a 4px scale and supplies layout primitives so teams can space components without reinventing margins on every page. GitHub’s Primer distills responsive page anatomy into pragmatic viewport ranges, breakpoints, and pane behaviors that preserve focus as screens grow or shrink. Together, these systems validate that a hybrid model—discrete tokens for spacing plus proportional mechanisms for structure—delivers resilience and clarity at scale.[^1][^2][^3]

Key recommendations:
- Choose a spacing base (4pt or 8pt) that matches your density and platform, and encode it as design tokens used for gaps, padding, and layout primitives.
- Size structural layout with CSS Grid for two-dimensional patterns and Flexbox for one-dimensional alignment inside grid areas; use Container Queries to make components respond to their containers, not just the viewport.
- Use modern viewport units (svh/lvh/dvh) for full-viewport experiences; use ch for comfortable line-length ranges; use aspect-ratio for media and component shapes.
- Define a small set of viewport ranges and max-widths to stabilize content width across breakpoints; apply increased padding at wider breakpoints to preserve rhythm.
- Treat sidebars and panels as structured panes: couple width strategy to content type, use min/max constraints, and move auxiliary panes to bottom sheets or separate pages at narrow widths.

The payoff is tangible: fewer decisions per component, faster iteration, better accessibility, and a consistent visual rhythm users can trust.[^1][^2][^3]



## Scope, Method, and Evidence

This report focuses on spacing and layout systems for modern product applications, not pure marketing sites. It covers spacing scales (8pt vs 4pt), proportional spacing and sizing, CSS techniques (Grid, Flexbox, Container Queries), and concrete guidance on content regions, sidebars, and panels. The analysis synthesizes mature design-system guidance and practitioner resources with code-level implementation details, and it distills patterns from well-known applications.

- Canonical resources define the theory and practice of grids, spacing, and component responsiveness, including detailed Container Query mechanics and support, modern viewport units, and Grid/Flex usage patterns.[^4][^5][^6]
- Design-system sources (Atlassian, Shopify Polaris, GitHub Primer) provide concrete tokens, page anatomy, responsive ranges, and layout primitives, offering stable patterns that have shipped at scale.[^1][^2][^3]
- UI and accessibility guidance supply spacing rationale, grouping, and user-centered design implications for grids and whitespace.[^7][^8]

Editorially, recommendations prioritize evidence from system maintainers and canonical docs, with practitioner resources used to illustrate usage. Where industry consensus is absent, the report notes the gap and suggests local validation.



## Foundations: Grids, Scales, and Tokenized Spacing

Grids organize content; spacing scales define how empty space behaves between and around that content; and tokens make both repeatable. A spatial system combines these into a shared vocabulary that scales across components, platforms, and teams.

Why use a base unit? A base unit makes spacing predictable. Designers and engineers can glance at a value and know whether it is “in system” or not, which accelerates decision-making and enforces rhythm. Atlassian’s 8px base and Shopify Polaris’s 4px grid exemplify how a base unit, a small set of scale values, and a token language create consistency without brittleness.[^1][^2]

When to deviate. Dense data tables, complex forms, or compact cards often require micro-adjustments to prevent visual strain. Practical systems accommodate this through fine-grained tokens (e.g., 2px, 4px) and optical adjustments—small, intentional tweaks to correct perceived imbalance. Mature systems explicitly describe when and how to break the rules, and they frame such deviations as a last step to resolve visual weight, not as a way to avoid the system.[^1][^7][^8]

### The 8pt System

An 8pt spacing system uses multiples of 8 (8, 16, 24, 32, 40, 48, 56, etc.) for dimensions, padding, and margins. It promotes a calm, breathable UI and aligns well with iOS and many web applications. Benefits include easier designer–developer handoff, alignment with common screen sizes, and consistent scaling for iconography and components. Atlassian’s tokenized 8px base illustrates how to translate the base into named tokens used across primitives and components.[^1][^9]

To illustrate a tokenized 8px scale, Table 1 shows representative tokens and their use cases.

Table 1 — Example 8pt spacing tokens and typical usage
| Token          | Pixels | Rem (approx.) | Typical usage                                                                 |
|----------------|--------|---------------|-------------------------------------------------------------------------------|
| space.025      | 2px    | 0.125rem      | Fine alignment within controls; tight gaps between small icons and labels    |
| space.050      | 4px    | 0.25rem       | Intra-component micro-gaps; small optical adjustments                         |
| space.100      | 8px    | 0.5rem        | Icon-text gaps; small control padding; list item inner spacing                |
| space.150      | 12px   | 0.75rem       | Medium gaps in cards; label-to-input spacing                                  |
| space.200      | 16px   | 1rem          | Standard intra-card spacing; between related UI elements                      |
| space.300      | 24px   | 1.5rem        | Inter-section spacing within containers; between related cards                |
| space.400      | 32px   | 2rem          | Container padding for large cards/sections; page-level rhythm                 |
| space.500–1000 | 40–80px| 2.5–5rem      | Page-level spacing between major regions; layout breathing room               |

These values reflect Atlassian’s published spacing scale and guidance, and they show how a limited set of tokens can address everything from control-level to page-level spacing.[^1][^9]

### The 4pt System

A 4pt scale allows finer control and higher information density, useful when screen real estate is constrained or the domain requires dense data presentation. It is well aligned with Android and with teams that prefer tighter UI rhythm. Shopify’s admin is built on a 4px spacing grid, and their layout primitives (Page, Grid, Stack, Section) encourage teams to apply the scale without “rolling their own” spacing logic in every component.[^2][^10] Practitioners highlight the same benefits as the 8pt scale—clarity, rhythm, and faster collaboration—while noting that the finer granularity requires discipline to avoid visual noise.[^11]



## Proportional Spacing and Sizing: Ratios, Percentages, and Viewport Units

Discrete spacing scales govern rhythm; proportional mechanisms govern responsiveness. The art is blending the two: use tokens for gaps and padding, and use proportional units and constraints for structure, sizing, and fluid behavior.

Viewport units have evolved. Traditional vh/vw can be unreliable on mobile due to dynamic browser toolbars that change the visible viewport. Modern large, small, and dynamic viewport units (lvh/svh/dvh) address this by stabilizing sizing against either the expanded or collapsed toolbar, or by dynamically tracking the visible area as toolbars change.[^5] Aspect-ratio helps maintain media and component shapes without JavaScript. And ch units remain a practical way to cap line length for comfortable reading.

Table 2 compares viewport unit families and their support.

Table 2 — Viewport unit families: definitions, use cases, and browser support
| Family   | Definition (practical)                                | Units                   | Typical use-cases                                   | Browser support (modern) |
|----------|--------------------------------------------------------|-------------------------|------------------------------------------------------|--------------------------|
| Legacy vh/vw | 1% of layout viewport width/height                | vw, vh, vi, vb, vmin, vmax | Legacy full-viewport heroes, simple full-bleed sections | Broad (legacy)           |
| Large (lv*) | Viewport assuming UA toolbars retracted           | lvw, lvh, lvi, lvb, lvmin, lvmax | Full-viewport sections that must not jump when toolbars collapse/expand | Chrome/Edge 108+, Firefox 101+, Safari 15.4+ |
| Small (sv*) | Viewport assuming UA toolbars expanded            | svw, svh, svi, svb, svmin, svmax | “Always fits” mobile sections; conservative sizing    | Chrome/Edge 108+, Firefox 101+, Safari 15.4+ |
| Dynamic (dv*) | Tracks visible viewport; clamps between sv* and lv* | dvw, dvh, dvi, dvb, dvmin, dvmax | Resilient full-viewport components that adapt to toolbar changes | Chrome/Edge 108+, Firefox 101+, Safari 15.4+ |

These definitions and support details are documented by web platform sources, along with caveats such as throttled updates for dynamic units and the fact that none of these units account for scrollbar size. The practical takeaway: prefer svh/lvh/dvh for full-viewport sizing on mobile; avoid layout failures caused by toolbar-induced viewport changes.[^5]

Choosing the right proportional unit is often a matter of what you are trying to control.

Table 3 — Choosing proportional units for layout and typography
| Unit / mechanism | What it controls                    | Best used for                                        | Notes and accessibility considerations                          |
|------------------|-------------------------------------|------------------------------------------------------|-----------------------------------------------------------------|
| %                | Relative to parent size             | Fluid columns, width fractions of a container        | Beware累积百分比 rounding; pair with min/max widths            |
| fr               | Fraction of available space in Grid | Flexible grid tracks that share space predictably    | Great for 2D page structure; combine with minmax for resilience |
| ch               | Approx. character width             | Line-length caps for readable text (e.g., 60–75ch)   | Respects user font size; good for content columns               |
| vw/vh            | Legacy viewport width/height        | Simple full-bleed marketing sections                 | Beware mobile toolbar; prefer modern units for app UIs          |
| svh/lvh/dvh      | Stable/dynamic viewport sizes       | Mobile-full-viewport components and heroes           | Account for toolbars; updates may be throttled for dv*          |
| aspect-ratio     | Width-to-height ratio               | Media, cards, and consistent component shapes        | Reduces JS hacks; pairs well with object-fit for media          |

In practice, teams often combine these: a content region that caps at 75ch for typography, a hero section that uses dvh for height, and grid tracks that use fr to share leftover space after fixed sidebars are accounted for. Practitioner guidance and design-system patterns reinforce these choices as a pragmatic, maintainable baseline.[^12][^5][^13][^14]



## Responsive Layout Techniques: CSS Grid, Flexbox, and Container Queries

The modern layout toolbox works best when responsibilities are clear. Use CSS Grid for page-level, two-dimensional structure; use Flexbox inside grid areas for alignment and one-dimensional distribution; and use Container Queries so components can respond to the space they actually have—not just the global viewport.

When to use which. Grid excels at 2D layout: columns and rows together, named areas, and responsive track sizing with repeat and minmax. Flexbox excels at distributing items along a single axis, with powerful alignment and wrapping. Container Queries decouple component variation from the viewport, improving reusability in dynamic layouts like sidebars, dashboards, and design工具 where the same component appears in containers of different sizes.[^12][^4][^15][^16][^17][^6][^18][^19]

### Choosing Grid vs Flexbox

Grid and Flexbox are complementary. Grid defines where areas live; Flexbox shapes the content inside those areas.

Table 4 — Decision guide for Grid vs Flexbox
| Layout challenge                            | Dimensionality | Recommended technique               | Why                                                                |
|---------------------------------------------|----------------|-------------------------------------|--------------------------------------------------------------------|
| Page shell: header, sidebar, content, footer| 2D             | CSS Grid                            | Named areas, easy 2D reflow, explicit tracks                       |
| Card grid: responsive columns with gaps      | 2D             | CSS Grid + minmax + auto-fit/auto-fill | Tracks resize predictably, no media queries needed in many cases  |
| Navbar: items spaced with wrapping           | 1D             | Flexbox                             | Wrap behavior, alignment, distribution are natural fits            |
| Form layout: labels and inputs in rows       | 1D             | Flexbox                             | Align baselines, distribute space along the row                    |
| Sidebar: collapse to bottom sheet at narrow  | 2D + CQ        | Grid for structure, CQ for variants | Container-driven component variants improve reusability            |

In production, hybrid patterns dominate: Grid for structure, with Flexbox inside each region. Many teams report that this reduces CSS complexity and makes refactoring less risky.[^12][^17][^15]

### Container Queries in Practice

Container Queries (CQ) let a component adapt to its container’s size rather than the global viewport. The core mechanism is containment: mark a parent as a container, then query its inline-size (width) for most width-based adaptations. The “golden rule” is that we cannot change what we measure; when measuring inline-size, height-based conditions are off-limits. Using rem-based thresholds in queries respects user font-size preferences and improves accessibility.[^6][^4][^18]

A pattern that ships frequently: a card that lays out tall and narrow in a sidebar, but wide with media and metadata in the main content area. The same component can have two or three CQ-driven variants, and those variants are reusable wherever the card appears. This decoupling from the viewport is what makes CQs a structural win in component-driven systems.[^6][^4][^18]

### Hybrid Layout Patterns

The most robust layout systems combine:
- Grid for page anatomy: explicit tracks, named areas, and clean reflow across breakpoints.
- Flexbox inside grid areas: for alignment, distribution, and wrapping of child content.
- Container Queries: to switch component variants based on the container’s space.
- Design tokens and layout primitives: to ensure spacing and structure are applied consistently across components and pages.

This hierarchy—structure, alignment, and context-sensitive variants—keeps CSS maintainable and reduces the need for brittle, global media queries.[^12][^15][^1][^2]



## Dimensions by Context: Viewport Ranges, Breakpoints, and Page Anatomy

Rather than targeting specific devices, successful systems define viewport ranges and breakpoints that map to layout behaviors. GitHub’s Primer offers one of the clearest, production-proven examples.

Table 5 — Viewport ranges, breakpoints, and padding guidance (GitHub Primer)
| Range   | Width range        | Columns        | Breakpoints (px)        | Padding at xlarge/xxlarge (content / pane) |
|---------|---------------------|----------------|-------------------------|--------------------------------------------|
| Narrow  | < 768px             | 1              | xsmall: 320, small: 544 | —                                          |
| Regular | ≥ 768px             | Up to 2        | medium: 768, large: 1012| 16px / 16px (default)                      |
| Wide    | ≥ 1400px            | Up to 3        | xlarge: 1280, xxlarge: 1400 | 24px / 16px (content increased, pane stable) |

Primer also defines page types and regions, providing a shared language for where content lives. This helps teams reason about what to stack, what to move to a pane, and what should be in a bottom sheet at narrow widths.[^3][^16]

Table 6 — Primer page types and content constraints
| Page type        | Purpose and anatomy                                                     | Content-region constraints                              |
|------------------|--------------------------------------------------------------------------|---------------------------------------------------------|
| Full pages       | Classic, content and pane centered; app header, context, content, footer| Centered content; max width at xlarge (1280px)          |
| Split pages      | Two independent, scrollable panes (e.g., list-detail); left pane flushed| Content region may be centered; width optional          |
| Interstitial     | Focused tasks: sign-in, verification, long operations                    | Narrow; max width at xsmall (320px)                     |

These constraints avoid ambiguity: full pages emphasize a stable reading zone; split pages keep panes scannable and independent; interstitial pages lock focus on a single task.[^3]

### Page Anatomy and Content Regions

Primer’s region model—header, content, left pane, right pane, footer—codifies what should appear where and how it should behave at narrow widths. For example, list-detail patterns should either stack panes vertically or convert auxiliary panes to bottom sheets, avoiding a stacked wall of links that buries the main content. Applying more generous content padding at wider breakpoints preserves rhythm and keeps the reading experience comfortable as screens grow.[^3]



## Sidebar and Panel Width Best Practices

Sidebars and panels carry some of the most consequential layout decisions in application design. They house navigation, filtering, metadata, and actions; the wrong width strategy creates either cramped lists or wasteful whitespace. Two principles help: treat panes as structured regions with clear width strategies, and prefer behavior changes over pure resizing as screens get smaller.

Fixed vs fluid vs adaptive widths. Fixed widths establish rhythm and predictability; fluid widths respond to available space; adaptive widths change strategy at thresholds. GitHub’s split-page pattern flushes left panes to avoid off-center alignment that can disrupt scanning, while Material’s side sheets and the Every Layout sidebar offer pragmatic width anchors and behavior definitions.[^3][^20][^21]

Table 7 — Sidebar/panel width strategies with trade-offs
| Strategy | Description                                  | Pros                                        | Cons                                             | Example behaviors and references            |
|----------|----------------------------------------------|---------------------------------------------|--------------------------------------------------|---------------------------------------------|
| Fixed    | Constant width across viewports              | Predictable rhythm, easy to scan            | Can waste space or overflow on small screens     | Notion’s 224px fixed sidebar for clear alignment and long names[^22] |
| Fluid    | Width responds to container (%, fr)          | Fills space, reduces dead space             | Harder to scan if too variable                   | Use min/max constraints to cap variability   |
| Adaptive | Changes at thresholds (media/container)      | Tailored experience per range               | Requires clear breakpoints and test coverage     | Sidebar → bottom sheet at narrow widths; panes stacked or separated[^3][^20] |

Notion’s sidebar is a practical reference: a fixed 224px width supports long page names, consistent alignment, and comfortable hit targets; adjacent sections use small gaps that create separation without clutter. That combination—fixed width plus tight inter-section spacing—balances scannability and density for navigation.[^22]

### Adaptive Patterns for Small Screens

At narrow widths, multi-pane layouts should prioritize the task. Primer recommends converting auxiliary panes to bottom sheets or splitting list-detail into separate pages rather than stacking navigation above main content. This avoids excessive scrolling and maintains context when the task requires focus. On mobile, avoid hard-coded heights that clash with dynamic viewport sizes; prefer modern svh/dvh to prevent clipping or unwanted reflow.[^3][^5][^20]



## Content Area Optimization

Reading comfort and scannability are largely functions of line length, line height, and consistent rhythm. A practical baseline is to cap the main content width at roughly 60–75 characters with a line height between 1.4 and 1.6 for body text; this is easy to achieve with ch-based caps and tokens for vertical rhythm. Use cards and sections to structure content, avoid long stretches of text placed directly on background surfaces, and keep container padding in step with the base spacing scale.[^7][^2]

Table 8 — Content-region width and padding guidance
| Context                   | Recommended width/length            | Padding strategy                            | Rationale                                          |
|---------------------------|-------------------------------------|---------------------------------------------|----------------------------------------------------|
| Body text                 | 60–75ch cap                         | page-level padding increases at wide ranges | Comfortable reading; consistent rhythm across sizes|
| Dashboard content         | Max-width aligned to breakpoints; use fr for flexible tracks | Container padding in 4/8pt scale             | Scannability with density control                  |
| Interstitial pages        | Narrow (e.g., ~320px)               | Compact but legible                          | Focused task; reduce distractions                  |
| Media-rich sections       | Use aspect-ratio and flexible grids | Maintain consistent gaps via tokens          | Stable composition with proportional responsiveness|

These recommendations harmonize tokens for spacing, ch for readability, and Grid for structure. The result is content that “breathes” without becoming diffuse, even as viewport widths change.[^7][^2][^12]



## Case Studies: Mature Systems in Action

Mature systems demonstrate that spacing and layout are not only about aesthetics—they are operational tools that reduce coordination costs and protect usability.

Atlassian. An 8px base unit, a published spacing scale, and negative-space tokens enable fine control. Layout primitives—Box, Inline, Stack—turn spacing best practices into reusable components that carry tokens by default. This keeps rhythm consistent even as content changes.[^1][^24][^25]

Shopify Polaris. A 4px spacing grid and a 4px-based Stack component make it easy to maintain rhythm while increasing information density when the task demands it. Page and Grid components supply responsive structure, and explicit guidance on containers ensures most content lives in cards, avoiding direct placement on background surfaces.[^2][^10][^23]

GitHub Primer. Viewport ranges and breakpoints shape predictable behavior. Content padding increases at the largest breakpoints, and split pages define clear two-pane patterns. At narrow widths, auxiliary panes become bottom sheets or are separated into different pages, avoiding stacked navigation that harms scannability.[^3][^16]

Notion. A fixed 224px sidebar with tight inter-section gaps balances scannability with compactness. The system is coherent because the width and spacing choices are uniform; the result is a navigation that feels stable, predictable, and easy to use across different workspaces.[^22]

Table 9 — System patterns summary
| System            | Spacing base | Layout primitives / page anatomy         | Width strategy highlights                         | Density guidance                                 |
|-------------------|--------------|------------------------------------------|---------------------------------------------------|--------------------------------------------------|
| Atlassian         | 8px          | Box, Inline, Stack; tokens               | Tokenized spacing; negative tokens for bleed      | Use scale and optical adjustments to balance     |
| Shopify Polaris   | 4px          | Page, Grid, Stack, Section               | Built-in responsiveness; stack for gaps           | Adjust density by task; avoid mixed density pages|
| GitHub Primer     | —            | Regions: header, content, panes, footer  | Viewport ranges; split pages; increased padding   | Focused experience; stack or bottom sheet at narrow|
| Notion            | 8px          | Sidebar as structured pane               | Fixed 224px sidebar; consistent inter-section gaps| Easy targets; balanced hierarchy                 |

These systems converge on the same operating model: publish a spacing scale, ship primitives or utilities that enforce it, and define page anatomy and behaviors that scale across widths. The details differ (4 vs 8, fixed vs fluid), but the pattern is stable.[^1][^2][^3][^22][^24][^25][^23][^16]



## Implementation Playbook: From Tokens to Components

1) Define the spacing base and scale. Choose 4pt for denser interfaces or 8pt for breathability; publish a small, named token scale that includes fine-grained steps for optical adjustments. Atlassian and Polaris demonstrate how a base and tokens keep decisions fast and consistent.[^1][^2]

2) Convert tokens to utilities and primitives. Create layout primitives (e.g., Box, Inline, Stack) that pull from tokens by default. These primitives should make the “right thing” the easy thing, reducing bespoke margin CSS in components.[^24]

3) Structure with Grid, align with Flexbox. Use Grid for page regions and named areas; use Flexbox inside regions to distribute and align items. This separation of concerns reduces CSS complexity and makes refactors safer.[^12][^15]

4) Make components container-aware. Register containers and write Container Queries to switch component variants based on inline-size, not viewport. Prefer rem-based thresholds to respect user font scaling. Use minmax and fr to create flexible tracks without excessive media queries.[^6][^4][^18]

5) Codify viewport ranges and content max-widths. Define a small set of ranges and page types; set content max-widths and padding that increase slightly at wide breakpoints. Use modern viewport units (svh/lvh/dvh) for full-viewport components on mobile.[^3][^5][^16]

6) Test and tune. Validate density and readability on real devices and with real content. Adjust tokens where optical corrections are needed, and document exceptions sparingly.



## Accessibility, Risks, and Anti-patterns

Respect user font size. Use rem for query thresholds and component sizes that affect text layout; ch for line-length caps; and avoid hard-coding pixel-only dimensions where text is central to the experience. Container Queries written with rem thresholds adapt more gracefully to user preferences.[^6]

Beware of layout shifts. Dynamic viewport units do not update at 60fps; their values are throttled or debounced. Combine them with intrinsic sizing and minmax constraints to avoid sudden jumps when toolbars expand or collapse. None of the viewport units account for scrollbar size; avoid pairing 100vw with fixed sidebars unless you account for scrollbar width.[^5]

Avoid fixed widths that break at narrow sizes. Long sidebars or hard-coded maxima can cause overflow or buried content. Prefer adaptive behavior: move auxiliary panes to bottom sheets or separate pages at narrow widths rather than stacking navigation above the main content.[^3][^20]

Do not overfit to devices. Viewport ranges and named breakpoints (e.g., Primer’s) create more resilient layouts than device-specific targets. Test with real content, not just the latest phones, to ensure rhythm and line length remain comfortable at the edges.[^3][^16]

Finally, keep exceptions rare. The ability to optically adjust spacing is essential, but overuse undermines the system. Document the “why” behind exceptions so future maintainers can learn from, not repeat, them.[^1][^7]



## Conclusions and Actionable Checklist

The most effective spacing and layout systems combine a discrete spacing base with proportional responsiveness, encoded as tokens, primitives, and a small set of viewport ranges. They separate structural layout (Grid) from alignment (Flexbox) and use Container Queries to make components respond to their containers. Sidebars and panels follow behavior-first strategies at narrow widths, while content regions preserve comfortable reading and consistent rhythm.

A minimal, robust system you can ship:
- Choose 4pt or 8pt as your base; publish tokens and layout primitives that use them by default.
- Use Grid for page structure; Flexbox inside grid areas.
- Use Container Queries (inline-size) with rem thresholds to switch component variants by container width; avoid height-based queries.
- Use ch for line-length caps and modern svh/lvh/dvh for full-viewport sizing; account for scrollbars and throttled updates.
- Define viewport ranges and content max-widths; increase content padding at wide breakpoints to maintain rhythm.
- On small screens, move auxiliary panes to bottom sheets or split pages; avoid stacking long nav above main content.

Validation plan:
- Test density and readability with real content and users across defined ranges.
- Audit exceptions and optical adjustments to keep the system healthy.
- Review component reusability: if a component needs bespoke CSS per placement, add a Container Query variant instead.

These steps, proven by mature systems, will reduce decision churn, make components more portable, and keep accessibility and readability non-negotiable—all while giving designers and engineers room to solve product problems, not layout puzzles.[^1][^2][^3]



## Known Information Gaps and Research Needs

- Comprehensive, public documentation from Linear’s design system was not available in the sources reviewed. Any claims about Linear’s spacing or layout would require direct validation.
- Figma-specific auto layout and spacing details should be corroborated with official, up-to-date Figma help documentation for code-level implementation guidance.
- The optimal content “max-width” is context-dependent. While 60–75ch is a common readability target, teams should validate with their content and user tasks.
- Aspect-ratio usage patterns and constraints for complex responsive components merit further, component-level case studies.
- Quantified before/after metrics (e.g., task completion time, error rates) for adopting Container Queries or switching spacing systems are limited; local A/B testing is recommended.



## References

[^1]: Atlassian Design System. “Spacing.” https://atlassian.design/foundations/spacing  
[^2]: Shopify. “Layout – Shopify Polaris.” https://polaris-react.shopify.com/design/layout  
[^3]: GitHub. “Primer Design System – Layout Foundations.” https://primer.style/product/getting-started/foundations/layout/  
[^4]: CSS-Tricks. “A Complete Guide to CSS Grid.” https://css-tricks.com/snippets/css/complete-guide-grid/  
[^5]: web.dev. “The large, small, and dynamic viewport units.” https://web.dev/blog/viewport-units  
[^6]: Josh W. Comeau. “A Friendly Introduction to Container Queries.” https://www.joshwcomeau.com/css/container-queries-introduction/  
[^7]: Nielsen Norman Group. “Using Grids in Interface Designs.” https://www.nngroup.com/articles/using-grids-in-interface-designs/  
[^8]: Eightshapes. “Space in Design Systems.” https://eightshapes.com/articles/space-in-design-systems/  
[^9]: UX Planet. “Everything you should know about 8-point grid system in UX design.” https://uxplanet.org/everything-you-should-know-about-8-point-grid-system-in-ux-design-b69cb945b18d  
[^10]: Shopify. “Layout and structure — Shopify Polaris React.” https://polaris-react.shopify.com/components/layout-and-structure  
[^11]: The Designership. “The 4-Point Grid System: Mastering Spacing in UI Design.” https://www.thedesignership.com/blog/the-ultimate-spacing-guide-for-ui-designers  
[^12]: ModernCSS. “Container Query Solutions with CSS Grid and Flexbox.” https://moderncss.dev/container-query-solutions-with-css-grid-and-flexbox/  
[^13]: Chip Cullen. “Responsive spacing with viewport and ch units.” https://chipcullen.com/responsive-spacing-with-viewport-units/  
[^14]: MDN Web Docs. “Understanding and setting aspect ratios.” https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_box_sizing/Understanding_aspect-ratio  
[^15]: MDN Web Docs. “CSS Grid Layout.” https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout  
[^16]: CSS-Tricks. “CSS Container Queries.” https://css-tricks.com/css-container-queries/  
[^17]: LogRocket. “When to use Flexbox and when to use CSS Grid.” https://blog.logrocket.com/css-flexbox-vs-css-grid/  
[^18]: MDN Web Docs. “CSS container queries.” https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries  
[^19]: MDN Web Docs. “CSS Nesting.” https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_nesting/Using_CSS_nesting  
[^20]: Material Design 3. “Side sheets – Guidelines.” https://m3.material.io/components/side-sheets/guidelines  
[^21]: Every Layout. “The Sidebar.” https://every-layout.dev/layouts/sidebar/  
[^22]: Medium. “UI Breakdown of Notion’s Sidebar.” https://medium.com/@quickmasum/ui-breakdown-of-notions-sidebar-2121364ec78d  
[^23]: Shopify. “Layout – Shopify Dev Docs (apps).” https://shopify.dev/docs/apps/design/layout  
[^24]: Atlassian Design System. “Layout primitives.” https://atlassian.design/foundations/spacing/primitives  
[^25]: Atlassian Design System. “All design tokens.” https://atlassian.design/components/tokens/all-tokens