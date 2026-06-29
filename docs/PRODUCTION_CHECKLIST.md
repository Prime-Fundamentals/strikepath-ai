# Production Checklist

## Security

- Replace the development JWT secret with at least 48 random bytes.
- Keep `SEED_DEMO=false` in production.
- Keep PostgreSQL private and do not publish its credentials.
- Configure a production custom domain and HTTPS.
- Publish Terms of Service and Privacy Policy before accepting public registrations.
- Add email verification and password reset before paid launch.
- Add rate limiting to login, registration, and shot endpoints.
- Add account deletion and data export.
- Add structured audit logs for staff/admin changes.

## Reliability

- Configure scheduled PostgreSQL backups.
- Add external uptime monitoring; Railway deployment healthchecks are not continuous uptime monitors.
- Add error monitoring for Next.js and FastAPI.
- Create staging and production Railway environments.
- Test database restoration at least quarterly.
- Add idempotency keys for offline shot synchronization before large-scale release.

## Product accuracy

- Keep the lane-state label clear: it is an estimated transition model.
- Validate high/light rules with qualified coaches for both handedness modes.
- Add separate first-ball and spare-ball workflows.
- Add configurable pocket targets for sport conditions and user preference.
- Collect explicit recommendation feedback: worked, over-moved, under-moved, execution miss.
- Do not market the Bézier path as measured ball motion unless camera tracking is used.

## Commercial launch

- Add Stripe or another billing provider.
- Create personal, coach, team, pro-shop, and center roles.
- Add organization membership and coach sharing.
- Add support contact, product status page, and incident process.
- Add SEO metadata, sitemap, robots.txt, and public product pages.
