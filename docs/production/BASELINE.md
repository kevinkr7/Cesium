# CESIUM — ARCHITECTURAL BASELINE AUDIT

## 1. Executive Summary

Cesium is a social discovery platform built around curated interests, niche obsessions, and graph-based overlap discovery.

This baseline audit evaluates the existing repository state against the **Production Engineering Contract** to establish verified quality gates, document architectural characteristics, catalog real versus simulated backend functionality, and map technical debt before implementing Phase 1.

---

## 2. Deployment & Runtime Architecture

### Runtime Mode: Hybrid SSR & Client Hydration
- **Core Bundler**: Vite 8 with `@tanstack/react-start/plugin/vite` and Nitro 3.
- **SSR Server Entry**: `src/server.ts` exporting a Cloudflare Workers / Pages Module `fetch(request, env, ctx)` handler.
- **Server Middleware**: `src/start.ts` with catastrophic error normalization and CSRF protection on `serverFn`.
- **Client Hydration**: React 19 hydrated via TanStack Router (`src/router.tsx`) and TanStack Query (`src/routes/__root.tsx`).
- **Production Build Target**: Nitro preset `cloudflare-module`, outputting server bundle to `.output/server/index.mjs` and static client assets to `.output/public/`.

---

## 3. Package Management & Tooling

- **Standardized Package Manager**: `npm` (v10.9.2 on Node v22.14.0) with `package-lock.json`.
- **Alternative Artifacts**: `bun.lock` and `bunfig.toml` are present from earlier iterations, but `bun` is not installed on the host system.
- **Scripts Standardized**:
  - `npm run dev`: Starts Vite SSR dev server.
  - `npm run build`: Executes production client and Nitro server build.
  - `npm run lint`: ESLint with Prettier and React Hooks rules.
  - `npm run typecheck`: `tsc --noEmit` validation.
  - `npm test`: Runs Vitest test suite (`19 tests in 6 suites`).
  - `npm run test:e2e`: Playwright browser test runner.

---

## 4. Database Schema & RLS Audit

The database schema is defined in `supabase/migrations/20261015000001_initial_schema.sql` and `20261015000002_seed_data.sql`.

### Tables (16 total):
All 16 tables explicitly enforce `ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;`:

1. `public.profiles`: User profiles linked to `auth.users(id)` with handle uniqueness, constraints, and discoverability flags.
2. `public.interests`: Master catalog of curated and user-contributed interests.
3. `public.user_interests`: Join table representing a user's personal constellation (primary vs. niche).
4. `public.interest_relations`: Graph edges connecting related interests with assigned weights (0.0 to 1.0).
5. `public.connections`: Relationship lifecycle table (`pending`, `accepted`, `declined`, `canceled`, `removed`) with unordered uniqueness index `idx_connections_unordered_pair`.
6. `public.conversations`: Chat conversations created upon connection acceptance.
7. `public.conversation_members`: Join table linking users to conversations.
8. `public.messages`: Individual chat messages.
9. `public.communities`: Interest-based micro-communities.
10. `public.community_members`: Community memberships with role hierarchy (`owner`, `moderator`, `member`).
11. `public.community_interests`: Tagged interests linking communities to the discovery graph.
12. `public.community_posts`: Discussion threads within communities.
13. `public.community_replies`: Discussion replies.
14. `public.blocked_users`: Mutual blocking table preventing interaction and discovery.
15. `public.user_reports`: Moderation queue for safety reports.
16. `public.notifications`: System and social notifications table.

### Database Functions & RPCs:
1. `handle_updated_at()`: Trigger updating `updated_at` timestamps.
2. `handle_new_user()`: Trigger on `auth.users` automatically inserting a default profile into `public.profiles`.
3. `rpc_send_connection_request(p_target_user_id UUID)`: Transactional RPC that validates blocking rules, ensures no duplicate requests, and inserts pending connections.
4. `rpc_respond_to_connection_request(p_connection_id UUID, p_status TEXT)`: Transactional RPC that updates connection status and automatically initializes a `public.conversations` record when accepted.
5. `rpc_send_message(p_conversation_id UUID, p_body TEXT)`: Transactional RPC verifying conversation membership before inserting messages.
6. `rpc_get_discovery(p_filter TEXT, p_query TEXT, p_limit INT, p_offset INT)`: Server-side discovery matching function calculating Jaccard-style overlap scores, explanations, and connection states.

---

## 5. Frontend-to-Backend Integration Inventory

| UI Surface / Route | UI Trigger / Handler | Service Function | Database / Backend Operation | Expected State & Response |
| :--- | :--- | :--- | :--- | :--- |
| `/login` (Sign Up) | Form submit (`handleRegister`) | `signUpUser()` | `supabase.auth.signUp()` + trigger `handle_new_user()` | Session created, profile inserted, redirects to `/onboarding`. |
| `/login` (Sign In) | Form submit (`handleLogin`) | `signInUser()` | `supabase.auth.signInWithPassword()` | Auth cookie/token set, redirects to `/discover`. |
| `/onboarding` | Step 5 Submit (`completeOnboarding`) | `updateProfile()`, `saveUserInterests()` | `UPDATE profiles`, `INSERT user_interests` | `onboarding_completed = true`, constellation saved, redirects to `/discover`. |
| `/discover` | Page Mount / Filter change | `fetchDiscoveryPeople()` | `supabase.rpc('rpc_get_discovery')` | Ranked list of candidates with match score and overlap explanation. |
| `/discover` | Click "Connect" button | `sendConnectionRequest()` | `supabase.rpc('rpc_send_connection_request')` | `connections` record inserted with `pending` status. |
| `/discover` | Search input debounce | `fetchDiscoveryPeople()` | `supabase.rpc('rpc_get_discovery', { p_query })` | Filtered list matching query in name, bio, or interests. |
| `/constellation` | Page Mount | `fetchAllInterests()`, `fetchUserInterests()` | `SELECT FROM interests`, `SELECT FROM user_interests` | Interactive visual graph highlighting user nodes and edges. |
| `/messages` | Conversation select | `fetchConversationMessages()` | `SELECT FROM messages WHERE conversation_id = $1` | Chronological message thread. |
| `/messages` | Send Message submit | `sendChatMessage()` | `supabase.rpc('rpc_send_message')` | Message appended to DB, broadcast via Postgres changes realtime channel. |
| `/messages` | Realtime channel listener | `subscribeToConversationMessages()` | Supabase Realtime channel `conv:<id>` | Real-time message push without page reload. |
| `/communities` | Page Mount | `fetchCommunitiesList()` | `SELECT FROM communities` with joins on members, posts, interests | Community directory with active member counts. |
| `/communities` | "Create Community" modal | `createNewCommunity()` | `INSERT INTO communities`, `INSERT INTO community_members (role: owner)` | Community created and creator added as owner. |
| `/communities/$id` | "Join / Leave" toggle | `joinCommunityMembership()` / `leaveCommunityMembership()` | `INSERT / DELETE community_members` | Member count updated, membership state toggled. |
| `/communities/$id` | "Start Discussion" | `createCommunityThread()` | `INSERT INTO community_posts` | New discussion thread displayed. |

---

## 6. Real vs. Mocked Feature Inventory

| Subsystem | Existing Implementation Reality | Mocked / Local Fallback Mechanism | Production Remediation Required |
| :--- | :--- | :--- | :--- |
| **Authentication** | Real Supabase Auth client logic exists in `src/services/auth.ts`. | When `!isSupabaseConfigured`, generates fake local users (`local-xxxxx`) and writes to `localStorage`. | Enforce strict auth requirement; reject simulated login in production builds. |
| **State Storage** | `src/lib/store.ts` coordinates local state using `useSyncExternalStore`. | Authoritative state is stored in `localStorage` under `cesium-demo-v1`. Defaults include seed demo user, connections, and messages. | Transition authoritative state to Supabase queries/cache; treat `localStorage` strictly as an unauthoritative client cache. |
| **Connections** | Real RPC calls (`rpc_send_connection_request`) implemented in `src/services/connections.ts`. | When `!sb`, returns `{ success: true, status: 'pending' }` without database mutation. | Remove optimistic false-success returns; surface appropriate error states when disconnected. |
| **Realtime Messaging** | Postgres Changes subscription logic implemented in `src/services/messaging.ts`. | Hardcoded messages for user `"mira"` in `defaults.messages` in `src/lib/store.ts`. Realtime listener returns dummy cleanup when unconfigured. | Connect messaging directly to live Supabase conversation IDs. |
| **Communities** | Supabase query with relational joins written in `src/services/communities.ts`. | When query fails or `!sb`, silently returns hardcoded `seedCommunities` from `src/lib/data.ts`. | Render genuine empty/error states instead of silent static fallback. |
| **Safety / Moderation** | Table insertions to `blocked_users` and `user_reports` written in `src/services/safety.ts`. | When `!sb`, returns `{ success: true, error: null }`. | Require authenticated user ID and return clear failures when backend is unconfigured. |

---

## 7. Baseline Quality Gate Audit

### 1. TypeScript Validation (`tsc --noEmit`)
- **Status**: **FAIL (Exit Code 1)** — 69 errors.
- **Root Cause**:
  1. `tsconfig.json` has `noPropertyAccessFromIndexSignature: true`, which flags `user.user_metadata?.display_name`.
  2. `tsconfig.json` has `exactOptionalPropertyTypes: true`, flagging objects where properties can be `undefined`.
  3. `src/types/database.ts` is missing explicit `Views`, `Enums`, and `CompositeTypes` required by `@supabase/supabase-js` v2.118, causing client table access types to collapse to `never`.
- **Classification**: **Baseline Technical Debt**.

### 2. ESLint Validation (`npm run lint`)
- **Status**: **FAIL (Exit Code 1)** — 11 problems (4 errors, 7 warnings).
- **Errors**:
  - `src/components/HeroConstellation.tsx`: 4 Prettier whitespace/indentation formatting errors.
- **Warnings**:
  - `react-refresh/only-export-components` in `ui/badge.tsx`, `ui/button.tsx`, `ui/form.tsx`, `ui/navigation-menu.tsx`, `ui/sidebar.tsx`, `ui/toggle.tsx`.
  - `react-hooks/exhaustive-deps` in `src/routes/discover.tsx`.
- **Classification**: **Baseline Technical Debt**.

### 3. Unit & Integration Tests (`npm test`)
- **Status**: **PASS (Exit Code 0)**.
- **Results**: 6 test files passed, 19 tests passed in ~9.8s.
  - `src/test/connection-lifecycle.test.ts`: 3 tests passed.
  - `src/test/database-migrations.test.ts`: 4 tests passed.
  - `src/test/icebreakers.test.ts`: 2 tests passed.
  - `src/test/safety-validation.test.ts`: 4 tests passed.
  - `src/test/matching-engine.test.ts`: 5 tests passed.
  - `src/test/app-routing.test.tsx`: 1 test passed.

### 4. Production Build (`npm run build`)
- **Status**: **PASS (Exit Code 0)**.
- **Results**:
  - Client bundle transformed and built in 1.42s.
  - Nitro cloudflare-module worker generated in `.output/server/index.mjs` (927ms).
  - Static public assets generated in `.output/public/`.

### 5. Playwright Browser E2E Testing
- **Configuration Established**: `playwright.config.ts` and `e2e/baseline.spec.ts`.
- **Execution Status**: **PASS (Exit Code 0)** — 8 tests passed across 2 projects (Desktop Chrome and Mobile Chrome) in ~58.5s.
- **Test Results**:
  - `[Desktop Chrome] Homepage loads with hero constellation and title`: PASS
  - `[Desktop Chrome] Authentication page displays login and register options`: PASS
  - `[Desktop Chrome] Protected routes redirect unauthenticated users to login`: PASS
  - `[Desktop Chrome] 404 Error page is rendered for unknown routes`: PASS
  - `[Mobile Chrome] Homepage loads with hero constellation and title`: PASS
  - `[Mobile Chrome] Authentication page displays login and register options`: PASS
  - `[Mobile Chrome] Protected routes redirect unauthenticated users to login`: PASS
  - `[Mobile Chrome] 404 Error page is rendered for unknown routes`: PASS
- **Visual Verification**: 8 baseline screenshots captured and confirmed across public and authenticated states.

---

## 8. Unconfigured Supabase Detection

In `src/lib/supabase/client.ts`:
```ts
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith("http") &&
  !supabaseUrl.includes("your-project.supabase.co"),
);
```
- In default state with `.env.example` placeholder values, `isSupabaseConfigured` evaluates to `false`.
- All services correctly detect this condition without throwing uncaught runtime exceptions during page rendering.

---

## 9. Baseline Visual Evidence

The following visual baseline screenshots were recorded and verified:

1. **Homepage Hero & Constellation**: `homepage_1792142329148.png`
2. **Authentication (Login View)**: `login_page_1792142352057.png`
3. **Authentication (Register View)**: `register_view_1792142417624.png`
4. **Discover Feed**: `discover_feed_1792145395755.png`
5. **Onboarding Flow**: `onboarding_flow_1792145406465.png`
6. **Messages & Conversations**: `messages_view_1792145426406.png`
7. **Micro-Communities Directory**: `communities_directory_179214440738.png`
8. **Interactive Constellation Graph**: `constellation_graph_1792145450935.png`
