# Build Validation

This source package was validated before delivery with the following checks:

- Python source compilation completed successfully.
- API recommendation tests: 3 passed.
- Alembic initial migration applied successfully to a clean database.
- API smoke flow completed: health, registration, authentication, ball creation, session creation, two shot entries, recommendation generation, lane-state response, and analytics response.
- Next.js TypeScript type-check completed successfully.
- Next.js 16 production build completed successfully.
- Next.js web health endpoint responded with HTTP 200.
- Next.js server-side API proxy reached the FastAPI health endpoint and returned HTTP 200.

The package intentionally excludes generated dependencies and build output (`node_modules`, `.next`, Python caches). Install dependencies from the included lock and requirements files.

## Handedness, Guides, and Mobile pass

Validated after the handedness/mobile update:

- Next.js production build: passed
- TypeScript checking: passed
- Static generation for `/app/guides` and `/app/profile`: passed
- Existing API unit tests: 3 passed
- Registration with left-handed profile: passed
- `PATCH /api/auth/me` handedness update: passed
- Left-handed board values are mirrored for display while physical storage remains unchanged
- Live Session, shot history, recommendation overlay, and AR telemetry use the authenticated profile hand
