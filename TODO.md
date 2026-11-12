# TrueScale Atlas — Implementation Checklist

- [x] **Interactive survey map** — Provide an interactive world map with smooth pan, zoom, and touch controls on desktop and mobile. Show a map loading state and a clear, recoverable tile-error message without blocking country comparisons.
  - Evidence: Leaflet map with OpenTopoMap's free keyless tiles, custom zoom/reset controls, animated loading sheet, and retryable tile-error alert.

- [x] **Open place discovery** — Search and autocomplete countries and supported regions using free and open geographic data. Support keyboard navigation, a no-results message, and browsing by world region. Adding a place places a recognizable geographic outline on the map.
  - Evidence: Local Natural Earth index of 242 places, name/alias ranking, region chips, keyboard browsing, Enter-to-add, empty state, and bundled outline geometry.

- [x] **True-size outlines** — Let people drag outlines anywhere on the map while dynamically correcting their displayed scale for latitude and the map projection. Preserve each place's true area, keep labels readable, and handle overlapping outlines with distinct colors, labels, and active-place emphasis.
  - Evidence: Equal-area normalized SVG paths scaled with Mercator's latitude factor, pointer/keyboard dragging, per-place labels, eight-ink palette, and selected-outline emphasis.

- [x] **Comparison workbench** — Compare multiple places simultaneously. Include a side-by-side comparison mode that arranges selected places at one equal-area scale for direct visual comparison. Provide per-place controls to focus, hide, remove, recolor, rotate, or reset an outline, plus a clear-all action.
  - Evidence: Full-screen scale table with one shared scale, centroid-aligned map lineup, per-place controls, clear-map confirmation, and a panel-safe arrangement.

- [x] **Place details and relationships** — Show each selected place's name, region, area, current latitude, and concise scale relationships to other selected places, including the ratio to the largest and smallest active place.
  - Evidence: Active-place details report true area, latitude, Mercator stretch, and ratios to both the largest and smallest visible outlines.

- [x] **Shareable atlas state** — Encode the map view, selected places, positions, colors, visibility, rotation, and comparison mode into a shareable URL. Restore that state when the URL is opened, and provide a share/copy action with feedback.
  - Evidence: Base64url atlas state in the query string, browser history updates, Web Share/clipboard actions, validation for malformed links, and restored field studies.

- [x] **Responsive, accessible guidance** — Provide a polished responsive interface with mobile-friendly controls, onboarding guidance, first-use examples, keyboard focus states, reduced-motion support, and accessible labels and announcements.
  - Evidence: Desktop survey card, mobile bottom sheet and header, illustrated help dialog, first-use field studies, visible focus styles, reduced-motion media query, ARIA labels, and status toasts.

## Delivery evidence

- `pnpm typecheck` passes.
- `pnpm build` produces the static `dist` output.
- Desktop and mobile previews were checked, including search, field study, scale table, country arrangement, tile fallback, and clear-map confirmation.
- Free/open dependencies only: Natural Earth boundaries, OpenStreetMap/OpenTopoMap tiles, self-hosted open-source fonts, Leaflet, React, and Lucide.
