# Quick Task 260405-nsq Summary

## Task

Fix runtime crash caused by cookie mutation attempts from server render access flow.

## Completed

1. Removed `clearSessionCookie()` calls from render-time guards:
   - `resolveCurrentAccessRole`
   - `requireAccessRole`
2. Preserved cookie mutation only in action-safe paths (for example `submitLogout`).
3. Rechecked the previously failing web routes.

## Verification

- `corepack pnpm --filter @lottery/web typecheck` (passed)
- HTTP smoke:
  - `http://localhost:3000/login` => `200`
  - `http://localhost:3000/debug/access-lab` => `200`

## Notes

- Root cause was Next.js cookie mutation from server render path; this is not allowed outside Server Actions or Route Handlers.

