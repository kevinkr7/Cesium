# CESIUM — PRODUCTION ENGINEERING CONTRACT

## Preamble

This contract governs all engineering work performed on the **Cesium** codebase ([https://github.com/kevinkr7/Cesium](https://github.com/kevinkr7/Cesium)). The objective is turning the repository into a verified, resilient, production-ready social discovery platform without compromising its established visual design, Motion animation language, or architectural stack.

---

## 1. Architectural Stack & Principles

- **Frontend**: React 19, TypeScript, TanStack Router, TanStack Query, Tailwind CSS v4.
- **Animation**: Motion for React (`motion` / `motion/react`) only. No secondary animation libraries.
- **Server & Deployment**: Vite, TanStack Start, Nitro (`cloudflare-module` preset) with SSR server entry in `src/server.ts`.
- **Backend & Database**: Supabase PostgreSQL, GoTrue Auth, Realtime Postgres Changes, Storage (`public_assets`), Row Level Security (RLS), and transactional PL/pgSQL RPC functions.
- **State Coordination**: Supabase session/backend sync combined with `useSyncExternalStore` in `src/lib/store.ts`.
- **Design Tokens**: Defined in `src/styles.css`. Components must consume semantic CSS classes and variables, never hardcoded raw hex colors.

---

## 2. Absolute Restrictions

1. **Never simulate backend success in production mode.** Mock fallbacks must be strictly isolated to offline development/testing and never mask production database or network failures.
2. **Never treat `localStorage` as authoritative** for user identities, connections, messages, or permissions. All state mutations must be validated against the Supabase database.
3. **Never expose service-role keys or server secrets to browser client code.** Only the public anonymous key (`VITE_SUPABASE_ANON_KEY`) and URL (`VITE_SUPABASE_URL`) are permissible in client builds.
4. **Never weaken database RLS policies** to bypass authentication or permission failures. Fix client authorization or RPC logic instead.
5. **Never modify or reset production data** without explicit written authorization.
6. **Never claim tests passed if they were not executed.** All test results must include commands, exit codes, and verifiable outputs.
7. **Never substitute a mocked test for a real integration test** and call it equivalent.
8. **Never change unrelated application features.**
9. **Never automatically deploy to production.**
10. **Never report a feature as completed** when external setup, missing migrations, or environment configuration is still required.
11. **Use additive migrations** for existing databases. Any destructive migration requires explicit approval.
12. **Stop at the phase boundary.** Do not begin subsequent phases until the current phase report is verified and approved.

---

## 3. Mandatory Execution Protocol

1. **Identify Baseline**: Inspect existing behavior, affected files, edge cases, failure states, and expected outcomes before modifying code.
2. **Dedicated Checkpoint**: Maintain phase branches (`phase-N-...`) and commit checkpoints with clear messages.
3. **Comprehensive Implementation**: Deliver end-to-end functionality including database migrations, service layer integration, error handling, visual polish, and automated tests.
4. **Execution Verification**: Execute all linting, typechecking, unit, integration, and browser tests directly. Document actual exit codes.
5. **Regression Prevention**: Re-run previously passing test suites on every change.
6. **Transparent Reporting**: Every phase terminates with a standardized report in `docs/production/phase-N.md` and an update to `docs/production/PROGRESS.md`.
7. **Blocker Handling**: If external dependencies, credentials, containers, or network registries are unreachable, complete all safe local work, detail the exact blocker, and mark the phase `BLOCKED` rather than claiming a false `PASS`.

---

## 4. Quality Gate Standards

Every phase must satisfy:

- `npm run lint`: Zero ESLint errors.
- `npm run typecheck` (`tsc --noEmit`): Zero TypeScript compilation errors.
- `npm test`: Passing unit and integration tests.
- `npm run build`: Clean production build without warnings or bundling errors.
- `test:e2e`: Functional end-to-end browser execution covering critical user journeys.
