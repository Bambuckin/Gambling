# Quick Task 260405-nsq: Fix cookie mutation crash in server render access flow

## Objective

Eliminate runtime 500 errors caused by cookie mutation attempts from server render paths in access role resolution.

## Tasks

1. Remove session cookie clearing from render-time access guards (`resolveCurrentAccessRole` and `requireAccessRole`).
2. Keep cookie mutation only in allowed contexts (login/logout actions).
3. Run minimal web verification against `/login` and `/debug/access-lab`.

## Files

- `apps/web/src/lib/access/entry-flow.ts`

