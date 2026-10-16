# Cesium Project Rules

- User state, session, interests, connections, communities, and messaging are coordinated via Supabase and synced via external store (`src/lib/store.ts`).
- Design tokens (colors, fonts, button/field/chip classes) live in `src/styles.css`; components use semantic classes, never raw colors.
- Animation uses `motion` (Motion for React) only — do not add a second animation library.
