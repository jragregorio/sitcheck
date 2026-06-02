# Changelog

Version format: **MAJOR.MINOR.PATCH** with PATCH **1–9 only**. When PATCH would hit 10, carry to MINOR (e.g. `1.2.11` → `1.3.1`). Use `npm run bump:version` for releases.

## [1.3.5] - 2026-05-30

### Fixed
- Contribution submit no longer sends invalid `pressure_level: 0` when Has Bidet? is off (uses `null` per Supabase constraint).
- New submissions explicitly set `status: pending`; clearer Supabase error messages on submit failure.

## [1.3.4] - 2026-05-30

### Changed
- Adopted carry versioning; display version renumbered from `1.2.13`.
- Contribute and moderator forms default Has Bidet? and Has Tissue? to off.
- Pressure level shows only when Has Bidet? is on; fee amount shows only when Payment required? is on.

## [1.2.12] - 2026-05-30

### Fixed
- Narrowed moderator edit toggle thumb width while keeping full track height for a cleaner switch appearance.

## [1.2.11] - 2026-05-29

### Added
- Moderator inline edit for submission details (bidet, tissue, cleanliness, pressure, payment, notes).

### Fixed
- Approved submission edits and approvals now sync listing fields to the public `toilets` table so map popups match moderator data (e.g. tissue availability).

## [1.2.10] - 2026-05-29

### Changed
- Polished contribute form toggles with full-width pill handles for Has Bidet?, Has Tissue?, and Payment required?.

## [1.2.9] - 2026-05-29

### Changed
- Improved the contribute form layout so Has Bidet? and Has Tissue? toggles appear side by side with labels above each switch.

## [1.2.8] - 2026-05-29

### Changed
- Replaced Yes/No dropdowns in the contribute form with modern toggle switches for bidet, tissue, and payment fields.

## [1.2.7] - 2026-05-29

### Added
- Added a Has tissue? field to contributions and listing displays, including Supabase and moderator queue support.

## [1.2.6] - 2026-05-29

### Fixed
- Added and aligned Privacy Policy navigation so users can return to the app without relaunching.

## [1.2.5] - 2026-05-22

### Fixed
- Improved the About page mobile action buttons so they stack cleanly and remain easy to tap.

## [1.2.4] - 2026-05-21

### Added
- Added an in-app privacy policy page and About page link for Play Console release requirements.

## [1.2.3] - 2026-05-21

### Fixed
- Preserved current map center and zoom when returning to the map from About or Moderator pages.

## [1.2.2] - 2026-05-21

### Fixed
- Prevented mobile Listings/Filters/Add panel toggles from refitting or recentering the map unexpectedly.

## [1.1.11] - 2026-05-21

### Added
- Added clearer manual location feedback with a stronger pulsing locate button and fetching-location toast.

## [1.1.10] - 2026-05-21

### Added
- Added visual location-enabled indicators: active locate button state, pulsing user marker, and one-time location success toast.

## [1.1.9] - 2026-05-21

### Fixed
- Improved mobile Add panel pin focusing so the contribution pin centers in the visible map area above the expanded panel.

## [1.1.8] - 2026-05-21

### Changed
- Improved Add/Contribute pin behavior: opening Add prefers detected user location, while Reset Pin uses the current map view center.

## [1.1.7] - 2026-05-21

### Changed
- Bumped displayed release version in About page to `v1.1.7`.
- Disabled the About page release hyperlink/changelog popup interaction.

## [1.1.6] - 2026-05-21

### Changed
- Moved Ko-fi support action into the About card action row for a cleaner, less intrusive layout.

## [1.1.5] - 2026-05-21

### Added
- Added Ko-fi support action to the About page.

## [1.1.4] - 2026-05-21

### Added
- Added in-app changelog document and release link popup experiment.

## [1.1.3] - 2026-05-21

### Changed
- Bumped displayed release version in About page to `v1.1.3`.

## [1.1.2] - 2026-05-21

### Added
- Automatic location detection on launch with quiet fallback behavior.
- Additional quirky splash loading lines.

### Changed
- Tuned splash loading text swipe speed and readable hold timing.

## [1.1.1] - 2026-05-21

### Added
- Session-aware splash behavior: splash now appears once per launch session.

### Changed
- About button visibility on mobile now hides when Listings/Filters/Add panels are open.

## [1.0.10] - 2026-05-21

### Added
- Quirky rotating splash loading messages.
- Animated splash progress bar replacing dot animation.

### Changed
- Increased splash minimum display duration and slowed fade-out for readability.

## [1.0.9] - 2026-05-21

### Fixed
- Included `about.html` in Capacitor web sync packaging so About route works in Android builds.
- Cleaned Android Gradle warning for unused catch parameter.

## [1.0.8] - 2026-05-21

### Added
- Android app launcher/splash assets generated from SitCheck logo.
- Android location permissions in `AndroidManifest.xml`.

### Fixed
- Updated Android ProGuard default file reference for modern AGP compatibility.

## [1.0.7] - 2026-05-20

### Added
- Capacitor Android project bootstrap (`android/`, `capacitor.config.json`).
- NPM scripts for web sync and Android sync/open workflows.
- Basic `.gitignore` entries for Capacitor/web build outputs.

## [1.0.6] - 2026-05-20

### Added
- About page (`about.html`) with release display and attribution.
- Mobile floating About (`☕`) button and desktop floating placement.

### Changed
- Mobile About page card centered for improved presentation.
- About page button alignment and release typography refinements.

## [1.0.5] - 2026-05-20

### Added
- Branded launch splash screen with transition behavior tied to initial data/render readiness.

## [1.0.4] - 2026-05-20

### Added
- Contribution form `Reset Pin` action.

### Changed
- Contribution pin flow now preserves draft pin position between panel toggles.
- Initial pin placement now waits for settled map center before applying.
- Pin helper layout updated for better mobile/desktop responsiveness.

## [1.0.3] - 2026-05-20

### Added
- Moderator submission cards now show map snapshots with quick "Open in map" links.

### Changed
- Snapshot layout now auto-fits queue cards in desktop view.

## [1.0.2] - 2026-05-20

### Changed
- Moderator header made sticky/floating while scrolling.
- Sign out action moved beside Back to Map in moderator header.
- Minor moderation UI typography and action alignment polish.

## [1.0.1] - 2026-05-20

### Added
- Moderator console (`admin.html`, `admin.js`) with Supabase auth and queue moderation actions.
- Desktop Admin entry button and mobile floating moderator icon.

## [1.0.0] - 2026-05-20

### Added
- Initial SitCheck web experience with map-based restroom discovery, filtering, sorting, and contribution flow.
