# CESIUM — PRODUCTION DEPLOYMENT RUNBOOK & OPERATIONS GUIDE

**Document Version**: 1.0.0  
**Phase**: Phase 14 — Production Deployment & Release Readiness  
**Target Environment**: Cloudflare Pages / Workers (Edge SSR) + Hosted Supabase (PostgreSQL 15+)

---

## 1. System Architecture Overview

Cesium is engineered as a zero-simulation, edge-ready social discovery platform:

```
[ Client Browser ]
        │ (HTTPS)
        ▼
[ Cloudflare Edge CDN / Nitro SSR ]
  ├── Static Assets: /.output/public (Immutable cache, CSP, HSTS, XFO)
  ├── Server Entry: /.output/server (Cloudflare module SSR, /health probe)
  └── Error Handling: In-handler error capture & branded recovery UI
        │
        ├── (REST / RPC via HTTPS) ──────────────────────────┐
        └── (Realtime Websocket via WSS) ─────────────┐      │
                                                      ▼      ▼
                                            [ Supabase PostgreSQL 15+ ]
                                            ├── 16 Relational Tables
                                            ├── Defense-in-Depth RLS
                                            ├── 8 Additive Migrations
                                            ├── Transactional RPC Functions
                                            ├── Storage: public_assets
                                            └── Realtime Engine
```

---

## 2. Pre-Deployment Prerequisites

Before executing a production deployment, ensure the following infrastructure is provisioned:

1. **Domain & DNS**:
   - Registered custom domain with Cloudflare DNS management (e.g. `cesium.network`).
2. **Cloudflare Account**:
   - Cloudflare Pages project linked to the GitHub repository: `https://github.com/kevinkr7/Cesium`.
   - Compatibility date: `2026-10-19` or later.
3. **Supabase Production Project**:
   - Hosted Supabase project in the target region.
   - Public URL (`https://<project-id>.supabase.co`) and Anon Key (`eyJ...`).
   - Secure database password stored in a password manager.

---

## 3. Database Migration Sequence

All 8 migrations in `supabase/migrations/` are idempotent and additive. Apply them in exact sequential order:

```bash
# Via Supabase CLI (Recommended)
npx supabase link --project-ref <project-id>
npx supabase db push

# Or execute sequentially via Supabase SQL Editor:
# 1. 20261015000001_initial_schema.sql
# 2. 20261015000002_seed_data.sql
# 3. 20261017000001_schema_constraints_and_rls.sql
# 4. 20261017000002_curated_graph_bridges.sql
# 5. 20261017000003_uncommon_ground_rpc.sql
# 6. 20261017000004_realtime_messaging_rpc.sql
# 7. 20261017000005_micro_communities_rpc.sql
# 8. 20261017000006_safety_moderation_rpc.sql
# 9. 20261017000007_production_hardening_rls.sql
```

### Database Verification Checks

Run the following SQL queries to verify production schema health:

```sql
-- 1. Verify RLS is enabled on all tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- 2. Verify Realtime publication includes messages
SELECT tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';

-- 3. Verify public_assets storage bucket exists
SELECT id, name, public 
FROM storage.buckets 
WHERE id = 'public_assets';

-- 4. Verify all RPC functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE 'rpc_%';
```

---

## 4. Environment Variables Provisioning

Configure the following environment variables in **Cloudflare Pages Dashboard** (`Settings -> Environment Variables -> Production`):

| Variable | Sensitivity | Purpose |
| :--- | :---: | :--- |
| `VITE_SUPABASE_URL` | Public | Hosted Supabase project endpoint (e.g. `https://xyz.supabase.co`). |
| `VITE_SUPABASE_ANON_KEY` | Public (Client-safe) | Public anonymous JWT key for PostgREST & Auth. |
| `NODE_ENV` | Build | Set to `production`. |
| `NITRO_PRESET` | Build | Set to `cloudflare-module`. |

> [!CAUTION]
> **NEVER** set `SUPABASE_SERVICE_ROLE_KEY` or `DATABASE_URL` in client environment variables. Cesium's zero-trust security architecture relies entirely on authenticated JWT tokens evaluated against PostgreSQL Row Level Security (RLS).

---

## 5. Build & Deployment Execution

### Automated CI/CD (Cloudflare Pages GitHub Integration)

1. **Build Command**: `npm run build`
2. **Build Output Directory**: `.output/public`
3. **Node.js Version**: `22.x` (Configure `NODE_VERSION: 22` in Environment Variables)

### Manual CLI Deployment (Wrangler)

```bash
# 1. Clean installation of dependencies
npm ci

# 2. Run full quality gate validation
npm run typecheck
npm run lint
npm test
npx playwright test

# 3. Build production bundles
npm run build

# 4. Deploy to Cloudflare Pages
npx wrangler pages deploy .output/public --project-name cesium
```

---

## 6. Post-Deployment Verification & Smoke Checklist

Immediately following deployment, perform the verification checks:

- [ ] **Health Endpoint**: `curl -I https://cesium.network/health` returns `HTTP 200 OK` with JSON payload `{ "status": "healthy", "service": "cesium" }`.
- [ ] **Security Headers**: Verify presence of:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- [ ] **Robots & Sitemap**:
  - `curl https://cesium.network/robots.txt`
  - `curl https://cesium.network/sitemap.xml`
- [ ] **Authentication Flow**: Sign up new user, complete 5-step onboarding, verify redirect to `/discover`.
- [ ] **Constellation Visualization**: Load `/constellation`, verify interactive SVG renders and inspects nodes.
- [ ] **Discovery & Uncommon Ground**: Load `/discover`, verify match calculation, open `ProfileSheet`, inspect shared anchor.
- [ ] **Realtime Messaging**: Send message in active conversation, verify instant optimistic UI update and Realtime delivery.
- [ ] **Communities**: Create community or post in thread, verify content safety checks pass.

---

## 7. Rollback & Disaster Recovery Procedures

### Instant Frontend Rollback

Cloudflare Pages maintains immutable deployment previews for every git commit:

1. Open Cloudflare Pages Dashboard -> `Cesium` -> `Deployments`.
2. Locate the last known good deployment.
3. Click `...` -> **Rollback to this deployment**.
4. Traffic is rerouted instantaneously (< 1 second) across Cloudflare's global edge network.

### Database Recovery (Point-in-Time Recovery)

1. Hosted Supabase includes automated Point-in-Time Recovery (PITR) up to 7-30 days.
2. In the event of catastrophic data corruption:
   - Navigate to Supabase Dashboard -> `Settings` -> `Backups`.
   - Select point-in-time prior to the incident.
   - Restore database to an isolated temporary instance or restore in-place.
3. Because all migrations are strictly additive with idempotent triggers, schema rollbacks do not require dropping tables.

---

## 8. Incident Response & Monitoring

- **Error Monitoring**: In-handler errors are captured by `src/lib/error-capture.ts` and rendered via `src/lib/error-page.ts`. Connect Sentry or Cloudflare Logpush for centralized telemetry.
- **Abuse & Moderation**: Periodically review the `content_reports` table for flagged users and objectionable content.
- **Database Metrics**: Monitor active connection poolers in Supabase Dashboard (Transaction Mode vs Session Mode on port 6543 / 5432).
