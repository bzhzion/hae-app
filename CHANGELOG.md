# Changelog

## [0.2.0] - 2026-06-09
### Added
- Card detail view: full CRUD for labels, members, checklists (+ items), comments, due date, stopwatch
- Label picker (toggle labels from project labels list)
- Member picker (toggle members from project members list)
- Checklist management: add/delete checklists, add/toggle/delete items with progress bar
- Comments: add/delete, author + date display
- Stopwatch: start/stop with live ticker, formatted HH:MM:SS display
- Due date editor (inline modal, JJ/MM/AAAA format)
- Move card to another column
- Delete card (soft-delete to Trash column)
- Card title + description inline editing (tap to edit)
- `CardDetailSheet` extracted as standalone component

### Changed
- Card detail overlay is now fully interactive (was read-only)
- `tasks.tsx` delegates all card interactions to `CardDetailSheet`

---

## [0.1.0] - 2026-06-08
### Added
- Initial app skeleton: Expo SDK 54 + Expo Router + Zustand
- Auth screen (login with server URL + JWT)
- Projects screen (list, select active project)
- Tasks screen: GTD kanban (Inbox/Next/Urgent/Someday/Waiting), scrollable tabs
- Pull-to-refresh on projects and tasks screens
- 401 auto-logout + redirect to login
- Inline card creation (+ button in header)
- Card design: white card, shadow, border-radius, due date badge
- Card detail overlay: expand animation (spring + scale), read-only view
- Rich test data: 98 cards across 4 projects (labels, members, checklists, comments, stopwatch, due dates)
- App logo top-left in tasks header
