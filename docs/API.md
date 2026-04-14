# API And Route Surface

This repository is not a versioned public API service.
It is a Next.js app with:

- page routes;
- server actions embedded in page files;
- a small number of JSON endpoints used by the UI and verification pages.

Use this document to understand what surfaces exist before adding new ones.

## Page Routes

| Route | Purpose | Auth | Source |
|---|---|---|---|
| `/` | lottery shell and entry links | none | `apps/web/src/app/page.tsx` |
| `/login` | session login form | none | `apps/web/src/app/login/page.tsx` |
| `/denied` | access denied state | none | `apps/web/src/app/denied/page.tsx` |
| `/lottery/[lotteryCode]` | user purchase flow, wallet, requests, tickets | user | `apps/web/src/app/lottery/[lotteryCode]/page.tsx` |
| `/admin` | registry controls, queue controls, operations view | admin | `apps/web/src/app/admin/page.tsx` |
| `/terminal/receiver` | terminal-side inbox monitor for Big 8 mock/receiver flow | none | `apps/web/src/app/terminal/receiver/page.tsx` |
| `/debug/access-lab` | access verification page | debug/manual | `apps/web/src/app/debug/access-lab/page.tsx` |
| `/debug/admin-ops-lab` | admin operations verification page | debug/manual | `apps/web/src/app/debug/admin-ops-lab/page.tsx` |
| `/debug/mock-terminal` | mock terminal inbox monitor | debug/manual | `apps/web/src/app/debug/mock-terminal/page.tsx` |
| `/debug/purchase-lab` | purchase projection verification page | debug/manual | `apps/web/src/app/debug/purchase-lab/page.tsx` |
| `/debug/registry-lab` | registry and draw verification page | debug/manual | `apps/web/src/app/debug/registry-lab/page.tsx` |
| `/debug/terminal-lab` | terminal health verification page | debug/manual | `apps/web/src/app/debug/terminal-lab/page.tsx` |
| `/debug/ticket-lab` | ticket verification page | debug/manual | `apps/web/src/app/debug/ticket-lab/page.tsx` |
| `/debug/wallet-lab` | wallet projection verification page | debug/manual | `apps/web/src/app/debug/wallet-lab/page.tsx` |

## JSON Endpoints

These are the only route handlers under `apps/web/src/app/api/`.

| Method | Route | Auth | Purpose | Source |
|---|---|---|---|---|
| `GET` | `/api/lottery/[lotteryCode]/draws` | none | current draw freshness state and available draws for a lottery | `apps/web/src/app/api/lottery/[lotteryCode]/draws/route.ts` |
| `GET` | `/api/lottery/[lotteryCode]/requests` | user | user-scoped request and ticket projection for a lottery | `apps/web/src/app/api/lottery/[lotteryCode]/requests/route.ts` |
| `GET` | `/api/admin/operations` | admin | terminal status, queue pressure, problem requests, queue rows | `apps/web/src/app/api/admin/operations/route.ts` |
| `GET` | `/api/debug/mock-terminal/inbox` | none | debug JSON view of Big 8 inbox rows | `apps/web/src/app/api/debug/mock-terminal/inbox/route.ts` |
| `GET` | `/api/terminal/receiver/inbox` | none | terminal-side JSON view of the same inbox rows | `apps/web/src/app/api/terminal/receiver/inbox/route.ts` |

### Notes About The Inbox Endpoints

Both inbox endpoints currently resolve through the same helper:

- `apps/web/src/lib/purchase/mock-terminal-inbox.ts`

They expose Big 8-oriented request projections such as:

- `requestId`
- `userId`
- `drawId`
- `state`
- `attemptCount`
- `receiverLabel`
- `phoneMasked`
- `ticketCount`
- decoded payload when mock raw output contains `payload_base64`
- `workerRawOutput`

These endpoints are operational/debug surfaces, not stable external contracts.

## Server Actions

Most write behavior in the repo uses server actions instead of REST endpoints.

### Login

Defined in:

- `apps/web/src/app/login/page.tsx`

Action:

- `handleLoginAction`
  - calls `submitLogin` through access runtime

### Lottery Purchase Page

Defined in:

- `apps/web/src/app/lottery/[lotteryCode]/page.tsx`

Actions:

- `handleLogoutAction`
- `submitPurchaseDraftAction`
- `confirmPurchaseRequestAction`
- `cancelPurchaseRequestAction`

These actions are the write surface for:

- request draft preparation;
- request snapshot creation;
- reserve + queue insertion;
- queued-request cancellation.

### Admin Console

Defined in:

- `apps/web/src/app/admin/page.tsx`

Actions:

- `setLotteryEnabledAction`
- `moveLotteryAction`
- `setQueuePriorityAction`
- `enqueueAsAdminPriorityAction`
- `logoutFromAdminAction`

These actions are the only intended mutation path for:

- registry enable/disable;
- registry reorder;
- queue priority changes;
- admin-priority queue insertion.

## Auth Model

Auth is session-cookie based and enforced in server-side guards:

- `apps/web/src/lib/access/entry-flow.ts`
- `apps/web/src/lib/access/session-cookie.ts`
- `apps/web/src/lib/access/access-runtime.ts`

Important rule:

- middleware and client redirects can pre-filter UX;
- authoritative authorization must still happen in server actions or route handlers.

## Worker Integration Model

The terminal worker does not expose its own HTTP API.
Integration between web and worker happens through shared stores:

- purchase requests;
- queue items;
- execution lock;
- tickets;
- verification jobs;
- audit/event logs.

That means new write behavior usually belongs in application services plus shared storage, not in a new worker HTTP endpoint.

## Related Docs

- `apps/web/README.md`
- `apps/terminal-worker/README.md`
- `docs/DEVELOPMENT.md`
- `docs/modules/boundary-catalog.md`
