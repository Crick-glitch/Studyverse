# Decisions

1. **Legacy files left in `Studyverse/`.** Master rule 10 and 01 Part B.9: move only if the app still runs without them. The deploy source is unknown (no Vercel/CI config in repo), so nothing is moved before Phase 8.
2. **Shared package compiles to `dist/`.** `@studyverse/shared` exports built JS + types so the API (Node ESM, `tsc` build) and web (Vite) consume the same artifact. Root scripts (`dev`, `typecheck`, `test`, `build`) build shared first. Alternative: export raw TS and bundle the API (rejected: adds a bundler).
3. **API uses `NodeNext` + `.js` import suffixes; web uses `Bundler` resolution.**
4. **Single Vite copy.** `vite@^6` is declared at the root as well as in web so vitest 3 does not pull a second Vite 5 (that caused a type clash).
5. **Fonts** loaded locally via `@fontsource/cinzel` (display) and `@fontsource/lato` (body): one display + one body face, no external requests.
6. **Anime.js not installed yet.** It is added in the phase that uses it (Phase 5/6) so the installed version's API can be verified from its docs.
7. **Rate limiting, Prisma, Supabase, auth** are intentionally absent: they belong to Phase 3.
8. **`db:*` scripts** exist but exit with a clear "not wired until Phase 3" message instead of faking success.
9. **`dangerouslySetInnerHTML` is banned by ESLint** in `apps/web` (hard rule 7).
10. **Balance reminder (for Phase 3/4):** XP curve ambiguity (cumulative vs per-level) must be decided in Phase 3 and unit-tested.
