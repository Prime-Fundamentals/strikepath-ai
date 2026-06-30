# StrikePath AI QA and release checklist

This checklist covers the production-facing surfaces reviewed in the professional stability release.

## Automated validation

- Next.js production compilation and TypeScript checking
- Static and dynamic route generation
- FastAPI unit tests
- Alembic migration chain through revision 0006
- Next.js proxy to FastAPI
- Registration, login, profile read, and profile update
- Ball create, list, update, and delete
- Session create, list, read, finish, and delete
- First-ball logging and pin-specific spare recommendation
- Shot list, deletion, lane state, analytics, and dashboard
- AR capture create, list, and delete

## UI control audit

- Landing-page navigation and calls to action
- Desktop sidebar and mobile navigation
- Live-session create, undo, finish, and offline queue controls
- Lane view tabs: overhead, bowler perspective, and pin-deck zoom
- Line edit mode, whole-line movement, individual markers, snapping, undo, redo, zoom, and reset
- AI suggestion visibility and apply controls
- Shot form, pin leave selection, simple and advanced fields
- Arsenal create and delete controls
- Session filtering controls
- Profile hand selection and save action
- AR camera, upload, calibration, tracking, review, save, and delete controls
- Guides search and category controls

## Manual release checks after Railway deployment

1. Open the public landing page in desktop and mobile widths.
2. Register a left-handed account and confirm lane labels and setup mirror correctly.
3. Start a session and log a first ball that leaves one pin.
4. Confirm the second-shot spare plan updates automatically.
5. Edit the line, drag the whole path, drag feet in two dimensions, undo, redo, and switch snap modes.
6. Switch among overhead, bowler, and pin-deck views.
7. Add and remove a ball from the arsenal.
8. Open AR Tracking on an HTTPS phone browser and grant camera permission.
9. Close and reopen the installed PWA to verify the new service-worker assets are active.
