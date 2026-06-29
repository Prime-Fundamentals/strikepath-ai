# Railway Deployment Guide

StrikePath AI is an isolated monorepo with two deployed application services and one PostgreSQL service:

```text
strikepath-web       root: /apps/web
strikepath-api       root: /apps/api
Postgres             Railway database template
```

Only the web service needs a public domain. The web service proxies API traffic over Railway private networking.

## 1. Create the Railway project

1. Sign in to Railway.
2. Click **New Project**.
3. Choose **Empty Project**.
4. Rename the project to `StrikePath AI`.

## 2. Add PostgreSQL

1. In the project canvas, click **+ New**.
2. Choose **Database → Add PostgreSQL**.
3. Rename it `Postgres` if Railway gave it another name.

Railway supplies `DATABASE_URL` and the individual `PG*` connection variables from this service.

## 3. Add the API service

1. Click **+ New → GitHub Repo** and select your `strikepath-ai` repository.
2. Rename the service to `strikepath-api`.
3. Open **Settings**.
4. Set **Root Directory** to:

```text
/apps/api
```

5. Confirm Railway detects the Dockerfile.
6. In **Variables**, add:

```text
PORT=8000
ENVIRONMENT=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
SECRET_KEY=<paste-a-long-random-secret>
ACCESS_TOKEN_EXPIRE_MINUTES=10080
CORS_ORIGINS=https://YOUR-WEB-DOMAIN
SEED_DEMO=false
```

Generate a secure secret locally with:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generate-secret.ps1
```

7. In **Settings → Healthcheck**, confirm the path is `/health`.
8. Deploy the staged changes.

The API can remain private. A public domain is optional for API testing and should not be required by the web application.

## 4. Add the web service

1. Add the same GitHub repository as another Railway service.
2. Rename it `strikepath-web`.
3. Set **Root Directory** to:

```text
/apps/web
```

4. In **Variables**, add:

```text
PORT=3000
API_INTERNAL_URL=http://${{strikepath-api.RAILWAY_PRIVATE_DOMAIN}}:${{strikepath-api.PORT}}
SITE_URL=https://YOUR-WEB-DOMAIN
```

The API service must have the explicit `PORT=8000` variable because a cross-service reference such as `${{strikepath-api.PORT}}` references a service variable, not Railway's runtime-injected port.

5. Confirm the healthcheck path is `/api/health`.
6. Deploy.

## 5. Generate the public web domain

1. Open `strikepath-web`.
2. Go to **Settings → Networking → Public Networking**.
3. Click **Generate Domain**.
4. Open the generated `*.up.railway.app` address.

Update the API's `CORS_ORIGINS` variable to this address, even though normal browser requests use the Next.js proxy. It is useful for controlled direct API access and future integrations.

## 6. Add your custom domain later

In `strikepath-web`:

1. Open **Settings → Networking**.
2. Choose **Custom Domain**.
3. Enter the intended domain or subdomain, such as `app.strikepathai.com`.
4. Add the CNAME and ownership-verification TXT records Railway displays to your DNS provider.
5. Wait for verification and automatic SSL provisioning.

Do not add the custom domain to the private API unless there is a concrete integration need.

## 7. Watch paths

To avoid rebuilding both services for every change, configure these service watch paths:

### strikepath-web

```text
/apps/web/**
```

### strikepath-api

```text
/apps/api/**
```

Watch paths are evaluated from the repository root even when a Root Directory is configured.

## 8. Verify production

Check these endpoints:

```text
https://YOUR-WEB-DOMAIN/api/health
https://YOUR-WEB-DOMAIN/login
https://YOUR-WEB-DOMAIN/register
```

Then:

1. Register a new account.
2. Add a ball.
3. Start a session.
4. Log two controlled shots.
5. Confirm a recommendation appears.
6. Finish the session.
7. Open analytics.

## 9. Deployment troubleshooting

### Web says it cannot reach the API

Check:

- Both services are in the same Railway project and environment.
- API service name is exactly `strikepath-api` or update the variable reference accordingly.
- API contains `PORT=8000` as a user-defined variable.
- `API_INTERNAL_URL` begins with `http://`, not `https://`.
- The API deployment passed `/health`.

### API database connection fails

Check that the API variable is exactly:

```text
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

Redeploy after changing variables.

### Build uses the wrong folder

Confirm Root Directory is `/apps/web` or `/apps/api`. The included `railway.json` files are inside those directories and should be detected after the root is configured.

### Migration fails

Open the API deployment logs. The API container runs:

```text
alembic upgrade head
```

before starting Uvicorn. Fix the migration or database variable rather than moving migration execution to the Docker build stage; Railway private networking is available at runtime, not during build.
