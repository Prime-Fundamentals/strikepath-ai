# StrikePath AI

StrikePath AI is a production-oriented bowling web application foundation for dynamic shot tracking, explainable lane adjustments, equipment history, estimated lane transition, and session analytics.

Built for **Prime Fundamentals LLC**.

## Included in this MVP

- Responsive landing page using the supplied logo and intro animation
- Account registration and JWT authentication
- Bowler handedness profile
- Ball arsenal with coverstock, surface, RG, differential, and notes
- Live bowling sessions
- Manual shot telemetry for feet, laydown, target, breakpoint, pocket, speed, rev rate, axis rotation, axis tilt, pinfall, and delivery quality
- Explainable hold, confirm, 2-and-1, and 3-and-2 recommendations
- Handedness-safe high/light detection
- 39-board SVG lane visualization
- Estimated oil-transition/friction grid based on logged ball traffic
- Offline shot queue and installable PWA shell
- Session history and analytics
- PostgreSQL, Alembic migrations, Docker, and Railway configuration
- Health endpoints for both Railway services

## Architecture

```text
Browser / PWA
    │ same-origin requests
    ▼
Next.js web service
    │ server-side private proxy
    ▼
FastAPI service ─── PostgreSQL
```

The browser never needs the private API hostname. Next.js forwards `/api/proxy/*` requests to `API_INTERNAL_URL` at runtime.

## Fastest local start

### Requirements

- Docker Desktop
- Git

### Run

```powershell
cd StrikePathAI
powershell -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1
```

Then open:

- Web application: `http://localhost:3000`
- API documentation: `http://localhost:8000/docs`
- API health: `http://localhost:8000/health`

Demo account when using Docker Compose:

```text
Email: demo@strikepath.ai
Password: DemoPass123!
```

You can also create a fresh account from the registration page.

## Local development without Docker

### API

```powershell
cd apps\api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### Web

Open a second PowerShell window:

```powershell
cd apps\web
Copy-Item .env.example .env.local
npm install
npm run dev
```

## Test the source

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\test.ps1
```

## Production deployment

Read these in order:

1. [`docs/GITHUB_SETUP.md`](docs/GITHUB_SETUP.md)
2. [`docs/RAILWAY_SETUP.md`](docs/RAILWAY_SETUP.md)
3. [`docs/PRODUCTION_CHECKLIST.md`](docs/PRODUCTION_CHECKLIST.md)

## Important product note

The current lane transition model is an **estimate based on logged paths**, not a direct measurement of oil volume. The recommendation engine is deterministic and explainable. Camera tracking and personalized machine learning belong in later product phases after reliable labeled shot data is collected.
