StrikePath AI Railway web build fix

Root cause:
The prior apps/web/package-lock.json contained 58 absolute tarball URLs pointing to an internal OpenAI package registry. Railway cannot access that host, so npm ci stalled and ended with "Exit handler never called!".

Files in this patch:
- apps/web/package-lock.json: all dependency tarball URLs now use https://registry.npmjs.org/
- apps/web/.npmrc: explicitly selects the public npm registry and disables audit/fund/update notices during container builds
- apps/web/Dockerfile: pins Node 22.23.1 Alpine and runs a quieter, deterministic npm ci

Apply:
1. Copy the apps folder from this patch over your repository's apps folder.
2. From the repository root run:
   git add apps/web/Dockerfile apps/web/package-lock.json apps/web/.npmrc
   git commit -m "Fix Railway web dependency installation"
   git push origin main
3. In Railway, open strikepath-ai Web and choose Deploy Latest Commit.
4. Do not merely redeploy the old failed deployment; it uses the old commit.
