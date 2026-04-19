# Quick Summary 260417-kxa

## What Changed

- ignored local `.main-browser-profile-*` directories and accidental `packages/*/src/**/*.d.ts*` declaration output
- simplified the current lottery page by removing dead payout actions and trimming the secondary wallet/cabinet clutter
- removed unused purchase UI/runtime leftovers: the old admin live monitor, the orphaned user notifications route, and unused web accessors around that contour
- rewrote the runtime handoff, Big 8 handoff, deployment bootstrap notes, and project state to match the actual runtime behavior

## Why

The repo had drift between code and docs, plus a large amount of generated local noise that made it harder to see which changes were real. The user-facing page also still carried hidden or secondary pieces that no longer belonged to the simplified current contour.

## Validation

- `corepack pnpm typecheck`
- `corepack pnpm --filter @lottery/web build`

## Follow-Up

- real checkout/payment automation after cart remains open
- selector hardening for NLoto DOM drift remains open
