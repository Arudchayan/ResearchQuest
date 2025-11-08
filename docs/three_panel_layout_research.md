# Responsive Three-Panel Layouts: Techniques, Patterns, and Performance Across Screen Sizes

## Executive Summary: Why Three Panels, Why Now

A three-panel layout—left navigation, a primary content canvas, and a right contextual panel—remains one of the most effective UI structures for information-dense applications. It reduces context switching by bringing primary tasks into view while keeping navigation and contextual tools within arm’s reach. Popular products have refined this pattern to balance discoverability with screen real estate: Gmail integrates a collapsible left sidebar of app entry points and maintains a reading list, Figma’s left navigator and right properties panel bracket a canvas-centered workflow, and Notion’s left sidebar offers deep hierarchy with favorites, drag-and-drop organization, and resize/collapse controls that adapt to space constraints[^5][^6][^7].

Modern CSS now allows these layouts to feel consistent across devices without brittle viewport hacks. CSS Grid and Flexbox establish robust, componentized page structure; container queries enable component-level responsiveness so sidebars and contextual panels adapt to their own available space rather than the viewport; and CSS containment, content-visibility, and intentional animation choices improve render performance and visual stability[^8][^11][^2][^3][^9]. Accessibility standards provide clear guidance for keyboard navigation, focus management, and predictable reading order to ensure multi-panel interfaces are usable by everyone[^1][^2][^20].

The scope of this report includes: patterns from widely used applications; collapsible and responsive sidebar strategies; content proportion optimization; mobile adaptation patterns; breakpoint design using media and container queries; performance implications; and accessibility and usability requirements. We close with a practical implementation playbook to help teams apply the techniques cohesively.

The expected outcome is a set of actionable patterns and a sequencing strategy that can be applied to new builds or phased into existing applications. Where direct, up-to-date, official documentation is unavailable (e.g., detailed mobile adaptations of Gmail’s sidebar or Google Docs’ three-panel structure), we note information gaps and derive defensible recommendations from adjacent sources and best practices.

---

## Layout Foundations: Patterns in the Wild

Three-panel interfaces succeed when each panel has a clear role: left for global navigation and workspace structure; center for primary work; right for contextual inspection, configuration, or secondary tools. This pattern thrives in products where users frequently shift between navigation, content, and fine-grained controls.

- Gmail’s integrated view consolidates Mail, Chat, Spaces, and Meet into a left sidebar, with hover menus for quick previews and a collapsible panel to maximize reading space. Users can customize which apps appear and pin the panel open when needed[^5].
- Figma frames the canvas with a left navigation panel for layers and a right properties panel for design, prototype, and inspection—functional differences depend on access level, aligning UI complexity with permissioned capabilities[^6].
- Notion’s left sidebar provides infinite nesting, favorites for quick access, section-based visibility, and resize/collapse behavior. Users can organize content with drag-and-drop, collapse sections, and reopen the sidebar via consistent controls or keyboard shortcuts[^7].

To illustrate the different panel roles and behaviors, Table 1 compares the three applications.

Table 1. Feature comparison across Gmail, Figma, and Notion

| Application | Left Panel Role | Right Panel Role | Collapsibility | Hover/Preview Behavior | Notes |
|---|---|---|---|---|---|
| Gmail | Consolidated app menu (Mail, Chat, Spaces, Meet) and integrated tools | Reading pane (third column for email) | Collapsible; can pin open | App icons feature hover menus for quick previews | Customizable apps in sidebar; Material 3 refresh; no return to classic view[^5] |
| Figma | Navigation panel (layers, files) | Properties panel (design, prototype, comments, inspection) | Not typically collapsed; adapts to access level | N/A | Right panel capabilities vary by edit vs view access; canvas-centric workflow[^6] |
| Notion | Workspace navigation; nested pages; favorites; shared/private sections | Contextual content via open pages; right panel not a fixed UI element | Resizable; collapsible; slides out on hover when collapsed | N/A | Rich section controls; drag-and-drop organization; shortcuts for toggle[^7] |

These patterns suggest a few core principles:

- Clarity of panel purpose increases usability. When the center is the “work” area, the left should prioritize navigation and the right should expose contextual affordances without demanding a context switch.
- Adaptive visibility (collapsible, resizable, hover-preview) is essential to preserve focus on the primary task while maintaining fast access to secondary functions.
- Consistency of controls and reading order across the application matters as much as the layout itself. Discoverable affordances and predictable focus management reduce cognitive load.

### Common Anatomy and Interaction Principles

Two principles recur in accessible, high-performance three-panel layouts:

First, alignment with natural reading order and keyboard navigation is foundational. The left, center, and right panels should follow a logical DOM order that matches visual flow and the tab sequence. The source order—not CSS alone—should determine how screen readers and keyboard users traverse the interface[^1][^2][^20]. As a rule, avoid reordering with tabindex; instead, arrange the DOM to align with reading order and use CSS for presentation.

Second, consistent interaction models reduce errors. Common patterns—such as collapsible sidebars, hover previews, and drag-and-drop reorganization—work when they are predictable, discoverable, and consistent across contexts. This includes maintaining focus indicators, providing “skip to main content” links, and using ARIA landmarks to mitigate lengthy navigation[^1][^2].

---

## Responsive Sidebar Strategies: Collapse, Overlay, Dock, and Resize

Collapsible and resizable sidebars make three-panel layouts viable across a wide range of widths. The strategies below can be implemented with modern CSS and progressively enhanced for browsers that lack container query support.

State management across breakpoints should be explicit. Define defaults for narrow viewports (e.g., mobile) where sidebars are hidden or overlays, and then progressively show docked sidebars as space allows. Container queries help change behaviors based on the parent’s inline size rather than the viewport, producing resilient component layouts that work inside narrow columns as well as wide screens[^3][^4][^19].

Transitions should preserve performance. Animate transforms and opacity rather than width, height, or top/left to avoid triggering layout recalculation and painting cost. GPU-friendly transitions keep interactions smooth and minimize reflows and repaints[^9][^3].

To make these choices concrete, Table 2 summarizes common sidebar strategies by breakpoint and trade-offs.

Table 2. Sidebar strategies by viewport and container width

| Strategy | Typical Trigger | Best Use Cases | Trade-offs |
|---|---|---|---|
| Hidden | Very narrow viewports; primary task dominates | Mobile small screens; single-task flows | Low discoverability; must provide clear open controls and alternative navigation (e.g., bottom tabs)[^16] |
| Overlay (drawer) | Narrow viewports; quick access needed | Transient navigation or filters; ephemeral tools | Must manage focus, scrim, and keyboard escape; risk of hidden navigation if overused[^18][^16] |
| Docked | Medium widths; adequate space for persistent access | Tablets; productivity apps; frequent navigation | Reduces main content area; requires responsive resizing; consider container queries for component adaptation[^3] |
| Auto-hide (hover to open) | Space-constrained but frequent access | Dense data apps; when panels must be available but not always visible | Discoverability issues; ensure visible affordance and keyboard alternative; Notion-like slide-out behavior aids orientation[^7] |
| Resizable | Larger screens; variable content density | Power users; flexible content; dashboard-like tools | Implementation complexity; must maintain minimums and avoid overflow; keyboard controls and ARIA attributes improve accessibility[^2] |

#### State Management Across Breakpoints

For narrow widths, default to overlay or hidden sidebars. As inline size increases, switch to docked behavior. Container queries are the appropriate mechanism for these shifts, responding to the space actually available to the component rather than the viewport. This approach allows a right “context panel” to collapse into an icon tray in narrow containers, while remaining fully docked with labels in wider parents[^4][^3]. Provide fallbacks for older browsers by defining base styles that keep the sidebar collapsed; enhanced docking behaviors via container queries can then apply in modern environments.

---

## Content Area Proportion Optimization

Three-panel layouts must balance sidebars with the primary canvas. Two practical approaches—golden ratio-inspired proportions and dashboard-oriented content density—help ensure readability and focus.

Golden ratio-inspired proportions can guide column widths and hierarchy. A simple strategy is to treat the full width as a golden rectangle and derive column widths through successive divisions by approximately 1.618. This yields hierarchical proportions (e.g., ~62% and ~38%) that visually balance a larger content area with a smaller but legible sidebar. Phi scaling can also influence typographic rhythm, margins, and spacing to maintain consistency across panels[^10].

For dense information dashboards, prioritize cognitive landmarks: group related modules, surface key metrics, and leave visual breaks. Important content should land along scanning patterns (F and Z), with the most valuable data positioned to be seen early. The right panel often hosts contextual details or filters; ensure labels, legends, and controls are consistent in placement to lower cognitive load[^14].

To translate these ideas into implementation, Table 3 provides example proportion schemes and readability notes.

Table 3. Proportion schemes and readability notes

| Scheme | Example Column Widths | Readability Notes |
|---|---|---|
| Equal thirds | 33% / 34% / 33% | Neutral but can underweight contextual tools; rely on content density, grouping, and typographic hierarchy to sustain focus[^8] |
| Golden ratio split | ~62% main / ~38% sidebars (left and right combined) | Emphasizes primary content while giving sidebars enough space for labels and controls; apply phi scaling to margins and type for consistent rhythm[^10] |
| Dashboard emphasis | ~70% main / ~30% sidebars (combined) | Useful when main canvas hosts primary charts; ensure right panel is configurable and does not crowd content; leverage tooltips and toggles to manage density[^14] |

No single ratio is universally best. Start with a content-first approach: prototype realistic data, observe reading patterns, test with users, and refine proportions to match task needs. Use container queries to allow right-side panels to drop icons or collapse labels at narrower widths without sacrificing discoverability.

---

## Mobile Adaptation Patterns

On small screens, the three-panel desktop pattern should transform into visible primary navigation (often a bottom tab bar) with secondary actions accessible via drawers or sheets. This preserves discoverability and thumb reachability while keeping the main content prominent.

Drawer and sidebar use on mobile requires restraint. Hidden navigation is less discoverable and often underused; avoid making it the primary path to core features. Instead, reserve drawers for lower-frequency destinations, secondary settings, or utility actions, and rely on visible tab bars for primary navigation when the app has three to five top-level destinations[^16][^18]. Material Design guidance distinguishes between navigation bars (visible, primary destinations) and navigation drawers (hidden, secondary destinations), and advises against combining them when primary destinations can be shown directly[^18].

Progressive disclosure helps control complexity. Tooltips, bottom sheets, and in-panel toggles can surface detail on demand without overloading the main canvas. Treat the mobile main content area as the focal point and use bottom sheets for contextual details or filters when appropriate, especially for content editing or detail inspection.

To guide pattern selection, Table 4 maps mobile navigation patterns to scenarios.

Table 4. Mobile navigation pattern-to-use-case map

| Pattern | Ideal Scenarios | Rationale |
|---|---|---|
| Bottom tab bar (primary destinations) | 3–5 top-level sections; frequent switching | Visible, thumb-friendly access; improves discoverability and reduces navigation cost[^16][^17] |
| Sidebar/drawer (secondary destinations) | Lower-frequency utilities; many rarely used items | Keeps UI clean while retaining access; avoid over-reliance due to lower discoverability[^18][^16] |
| Search-driven entry | Large content corpus; direct retrieval tasks | Reduces UI complexity when discovery is primarily through search; complement with visible primary navigation[^16] |
| In-canvas actions with sheets | Contextual details and quick edits | Progressive disclosure avoids overloading main content; consistent close and focus behaviors are critical[^16] |

#### Material/HIG Cross-Guidance

- Apple’s Human Interface Guidelines (HIG) recommend sidebars on iPad but emphasize tab bars on iPhone due to horizontal space constraints. Avoid hiding primary destinations behind drawers on small screens[^16].
- Material Design 3 guidance suggests drawers for secondary destinations and advises not combining drawers with a navigation bar. Use drawers for deep or unrelated sections and keep primary destinations visible[^18].

---

## Breakpoint Strategies: Media Queries vs Container Queries

Media queries are indispensable for coarse, top-level layout restructuring, such as collapsing a three-panel desktop layout into a single column on narrow viewports. Container queries, however, are ideal for component-level responsiveness: sidebars, toolbars, and contextual panels can adapt to the space they actually have, not the viewport width, making layouts robust in “layouts within layouts” scenarios[^3][^4].

Combine the two strategically:

- Use media queries at the page level to handle macro transitions (e.g., three columns to one column).
- Use container queries for sub-layouts within columns: switching label-only modes, resizing groups of controls, or collapsing icon trays when a panel becomes narrow.

Progressive enhancement ensures the interface remains usable where container queries are unsupported: provide sensible defaults that keep panels accessible, and layer enhanced adaptations for modern browsers. Named containers and inline-size containment support complex UIs with multiple nested panels[^4][^19].

Table 5 compares the two approaches.

Table 5. Media queries vs container queries

| Dimension | Media Queries | Container Queries |
|---|---|---|
| Scope | Viewport or device characteristics | Parent container size and style/state |
| Best for | Macro layout changes (e.g., columns to stack) | Component sub-layouts (sidebar label vs icon mode) |
| Fragility | Susceptible to “magic numbers” tied to device classes | Intentional thresholds based on component needs[^19] |
| Support | Universal | Modern browsers; requires progressive enhancement[^3][^4] |
| Examples | Collapse sidebars at narrow viewport widths | Right panel collapses icons when its container is narrow[^3][^4][^19] |

#### Pattern Library: Intentional Breakpoints

Define container thresholds based on component needs, not device width. For example, a right contextual panel might switch to an icon-only mode below an inline size of 20–24rem, and expand to labeled controls above that threshold. Avoid “magic numbers” divorced from content. Progressive enhancement ensures baseline usability: in older browsers, keep the icon-only mode as the default, and enable label expansion via container queries when supported[^19].

---

## Performance Considerations for Multi-Panel Layouts

Performance challenges in three-panel layouts arise from multiple regions potentially triggering layout, paint, and composite operations during interactions. Optimizing CSS and rendering paths is essential.

First, minimize render-blocking CSS. Split non-critical styles, simplify selectors, and preload critical assets to accelerate first render. Attribute the media condition on linked styles to avoid blocking for non-matching conditions[^3].

Second, isolate layout and paint costs. Use CSS containment (layout, paint, style, size) to limit the scope of recalculations. Apply content-visibility to defer rendering of off-screen panels, and provide contain-intrinsic-size placeholders to avoid layout shifts when content appears. These techniques help keep scroll smooth and prevent jank during panel transitions[^3][^12].

Third, animate the right properties. Favor transforms and opacity to keep work on the compositor thread, avoiding property changes that trigger reflow and repaint. When necessary, use will-change sparingly to hint at upcoming animations, and measure the impact before and after changes[^9][^3].

Table 6 summarizes recommended CSS properties for animation.

Table 6. Properties to animate vs avoid

| Prefer to Animate | Avoid Animating | Rationale |
|---|---|---|
| transform | width, height | Transforms do not trigger layout; width/height changes cause reflow[^9] |
| opacity | top, left, right, bottom | Opacity blends; positional changes trigger layout and paint[^9] |
| filter (modest use) | margin, padding | Filters can be composited; margin/padding cause layout[^9] |
| color/background-color (cautious) | border | Color changes are typically cheaper than geometry changes[^3] |

Table 7 lists containment techniques and when to use them.

Table 7. CSS containment techniques and usage

| Technique | Purpose | When to Use |
|---|---|---|
| content-visibility: auto | Defer layout/paint until needed | Off-screen panels or sections; large dashboards[^12] |
| contain-intrinsic-size | Reserve space to prevent shifts | For contained elements to avoid scroll jank[^3] |
| contain: layout/paint/size | Isolate rendering scope | Independent panels with complex internal content[^3] |

#### Measuring and Iterating

Use performance profiling to identify bottlenecks before optimizing. Record interactions—such as opening a sidebar, switching tabs, and resizing a panel—and analyze layout and paint stages to target improvements. Iterate with before/after measurements to confirm gains and avoid regressions[^13].

---

## Accessibility and Usability in Multi-Panel Layouts

Accessible multi-panel interfaces follow predictable focus order, clear focus indicators, and standardized keyboard interaction patterns. They respect the principle that all functionality is operable via keyboard without timing constraints and that the reading order aligns with the DOM[^20][^1].

Keyboard navigation should separate “between components” from “within components.” Tab and Shift+Tab move focus between components; arrow keys move focus within composite widgets. For three-panel layouts, this means the left sidebar can be a composite with internal navigation via arrow keys, while Tab moves from sidebar to main canvas to right panel in a logical order[^2]. Avoid using tabindex values greater than zero, which disrupt reading order; rely on DOM order to reflect visual order[^1][^2].

Disabled controls and discoverability need careful handling. In composite widgets, keep disabled items focusable during arrow-key navigation for discoverability; in simple controls, disabled elements are typically removed from the tab sequence. Ensure a visible focus indicator and persist focus during transitions, returning focus to the triggering element when panels close[^2][^1].

Screen reader usability benefits from ARIA landmarks and headings. Mark regions such as main, navigation, complementary, and use headings to structure the page. Provide a “skip to main content” link to mitigate lengthy navigation, and use clear labels for panels and controls[^1].

Table 8 maps common interactions to recommended keystrokes.

Table 8. Keyboard interaction map for multi-panel UIs

| Interaction | Recommended Keys | Notes |
|---|---|---|
| Navigate between panels | Tab / Shift+Tab | Follow DOM reading order (left → main → right)[^2] |
| Navigate within sidebar (list) | Arrow Up/Down | Roving tabindex or aria-activedescendant pattern[^2] |
| Open/close drawer | Enter / Esc | Esc should close modal-like drawers; return focus to trigger[^1][^2] |
| Toggle sidebar collapse | Enter (button) | Maintain focus indicator and ARIA-expanded state[^1][^2] |
| Switch tabs in panel | Arrow Left/Right | Within tablist composite; Enter activates selection if needed[^1][^2] |
| Activate links/buttons | Enter / Space | Space also activates buttons; ensure role=button semantics[^1] |
| Close dialog/sheet | Esc | Focus returns to the element that opened the dialog[^1] |

#### Focus Management in Collapsible Panels

Use roving tabindex or aria-activedescendant for complex sidebars. Roving tabindex moves the tabindex=0 among items while internal navigation uses arrow keys; aria-activedescendant keeps container focus and points to the active element via ID. On drawer or sheet close, return focus to the control that opened the panel to preserve continuity for keyboard and screen reader users[^2].

---

## Implementation Playbook: From Prototype to Production

Building a robust three-panel layout is as much about sequencing as it is about choosing the right CSS. A pragmatic, production-ready playbook follows.

1) Establish the page grid using CSS Grid for three columns, and define the DOM order to match the reading sequence. Use grid templates to set relative column sizes that reflect your proportion strategy, and avoid rigid pixel widths that break across devices[^8]. Flexbox is ideal for intra-panel layout and alignment of controls[^22].

2) Define state transitions for sidebars (hidden, overlay, docked, resizable). Start with mobile-first defaults that favor visible primary navigation and overlay drawers for secondary actions. Then, progressively enhance docking and resizing behaviors as inline size grows. Container queries should drive label vs icon modes and collapsible sections within panels[^3][^4][^18][^16].

3) Integrate accessibility from the beginning. Ensure the tab order matches the DOM, add skip links, apply ARIA landmarks, and implement composite keyboard patterns for sidebars. Provide clear focus indicators and test for operable keyboard interactions across panels[^1][^2][^20].

4) Profile and optimize. Record the initial render, panel open/close interactions, and resize operations. Apply content-visibility to off-screen sections, contain-intrinsic-size to reserve space, and animate transforms and opacity for smooth transitions. Iterate with before/after performance analysis to validate improvements[^12][^3][^9][^13].

Table 9 provides an implementation checklist for reference.

Table 9. Step-by-step implementation checklist

| Area | Key Steps |
|---|---|
| Grid & DOM order | Define 3-column grid; arrange DOM to match reading order; use Grid for page-level structure and Flexbox for controls[^8][^22] |
| Sidebar states | Implement hidden/overlay on mobile; dock/resize on larger containers; use container queries for sub-layout transitions[^3][^4] |
| Breakpoints | Media queries for macro changes; container queries for component adaptation; provide fallbacks[^3][^4][^19] |
| Accessibility | Ensure logical tab sequence; add skip links; ARIA landmarks; implement composite keyboard patterns and focus returns[^1][^2][^20] |
| Performance | Use content-visibility, containment, and contain-intrinsic-size; animate transforms/opacity; profile interactions[^12][^3][^9][^13] |

#### Quality Gates

- Accessibility audits: Verify keyboard operability across all panels, proper focus indicators, and reading order alignment between DOM and visual layout[^1][^20].
- Performance budgets: Define and measure against thresholds for initial render, panel interactions, and resize behaviors. Confirm smooth 60fps animations where applicable[^9].
- Usability testing: Validate discoverability of navigation and efficiency of task flows on mobile and desktop. Confirm that hidden navigation is not the primary path for critical features[^16].

---

## Conclusion: The “So What”

Three-panel layouts deliver an optimal balance of navigation, primary work, and contextual tooling for information-dense applications. Modern CSS provides the tools to make this pattern viable across screen sizes: Grid and Flexbox for robust structure, container queries for component-level responsiveness, and containment techniques for performance. Successful applications—Gmail, Figma, Notion—demonstrate that clarity of panel purpose, discoverable controls, and adaptive visibility underpin usability.

Teams should adopt a content-first approach to proportion, use breakpoints as a progressive enhancement strategy, and prioritize accessibility and performance from the outset. Doing so will produce multi-panel interfaces that feel consistent, fast, and inclusive across devices. As standards and browser support evolve, container queries will increasingly become the default for component responsiveness, reducing the fragility of viewport-only breakpoints and making “layouts within layouts” both practical and maintainable[^3][^4][^19].

---

## Information Gaps

- Direct, official documentation on Google Docs’ three-panel interface patterns and mobile adaptations was not available in the collected sources.
- Detailed Gmail mobile sidebar adaptation and exact breakpoint behavior were not documented in official sources within the context set; we relied on third-party documentation of the 2022 update.
- Quantitative performance benchmarks specific to three-panel layouts (e.g., FPS, CLS impacts across devices) were not provided; general performance guidance was applied.
- Comparative usability studies on three-panel mobile adaptations (drawer vs bottom sheet vs visible sidebar) were limited.
- Broad quantitative evidence comparing three-column equal splits versus golden ratio proportions for diverse content types remains scarce.

---

## References

[^1]: WebAIM. Keyboard Accessibility. https://webaim.org/techniques/keyboard/
[^2]: W3C WAI-ARIA. Developing a Keyboard Interface (APG Practices). https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/
[^3]: MDN Web Docs. CSS Container Queries. https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries
[^4]: Builder.io. Modern CSS for 2024: Nesting, Layers, and Container Queries. https://www.builder.io/blog/css-2024-nesting-layers-container-queries
[^5]: Streak CRM. Everything you need to know about the new Gmail view: how to use the new Gmail sidebar. https://www.streak.com/post/everything-you-need-to-know-about-the-new-gmail-view-how-to-use-the-new-gmail-sidebar
[^6]: Figma Help Center. Design, prototype, and explore layer properties in the right sidebar. https://help.figma.com/hc/en-us/articles/360039832014-Design-prototype-and-explore-layer-properties-in-the-right-sidebar
[^7]: Notion Help Center. Navigate with the sidebar. https://www.notion.com/help/navigate-with-the-sidebar
[^8]: MDN Web Docs. Realizing common layouts using grids. https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout/Realizing_common_layouts_using_grids
[^9]: web.dev. Rendering performance. https://web.dev/articles/rendering-performance
[^10]: Figma Resource Library. What is the Golden Ratio? https://www.figma.com/resource-library/golden-ratio/
[^11]: web.dev. How to use container queries now. https://web.dev/blog/how-to-use-container-queries-now
[^12]: web.dev. content-visibility. https://web.dev/articles/content-visibility
[^13]: Chrome DevTools. Performance panel: Analyze your website's performance. https://developer.chrome.com/docs/devtools/performance/overview
[^14]: Pencil & Paper. Dashboard Design UX Patterns Best Practices. https://www.pencilandpaper.io/articles/ux-pattern-analysis-data-dashboards
[^15]: Material Design 2. Navigation drawer. https://m2.material.io/components/navigation-drawer
[^16]: UX Collective. Navigation patterns in mobile applications: how to make the right choice. https://uxdesign.cc/navigation-patterns-in-mobile-applications-how-to-make-the-right-choice-fa3c228e5097
[^17]: Apple Human Interface Guidelines. Tab Bars. https://developer.apple.com/design/human-interface-guidelines/tab-bars
[^18]: Material Design 3. Navigation Bar Guidelines. https://m3.material.io/components/navigation-bar/guidelines
[^19]: Josh W. Comeau. Container Queries Unleashed. https://www.joshwcomeau.com/css/container-queries-unleashed/
[^20]: W3C WAI. Understanding Success Criterion 2.1.1: Keyboard. https://www.w3.org/WAI/WCAG21/Understanding/keyboard.html
[^21]: web.dev. Preload critical assets. https://web.dev/articles/preload-critical-assets
[^22]: CSS-Tricks. A Complete Guide to Flexbox. https://css-tricks.com/snippets/css/a-guide-to-flexbox/