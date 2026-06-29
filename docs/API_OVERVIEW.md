# API Overview

Interactive documentation is available at `/docs` on the FastAPI service.

## Authentication

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

Authenticated endpoints use:

```text
Authorization: Bearer <JWT>
```

## Equipment

```text
GET    /api/balls
POST   /api/balls
PUT    /api/balls/{ball_id}
DELETE /api/balls/{ball_id}
```

## Sessions and shots

```text
GET    /api/sessions
POST   /api/sessions
GET    /api/sessions/{session_id}
POST   /api/sessions/{session_id}/finish
DELETE /api/sessions/{session_id}
POST   /api/sessions/{session_id}/shots
GET    /api/sessions/{session_id}/shots
DELETE /api/shots/{shot_id}
```

## Analytics and lane state

```text
GET /api/dashboard
GET /api/sessions/{session_id}/analytics
GET /api/sessions/{session_id}/lane-state
```
