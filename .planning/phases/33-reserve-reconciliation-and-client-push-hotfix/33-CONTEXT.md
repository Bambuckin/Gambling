---
phase: 33
title: Reserve reconciliation and client push hotfix
status: in_progress
created_at: "2026-04-24T17:45:00+05:00"
depends_on: [32]
---

# Context

The active v1.2 runtime still shows two user-visible regressions:

1. Client wallet reserve can remain non-zero after the purchase request has left the active queue.
2. Client result push is not visible when a ticket win/lose notification already exists at page load or arrives from draw close.

## Acceptance

- If a user has reserved funds for a request that is no longer in the active queue, the ledger is repaired with an auditable debit for purchased requests or release for non-purchased detached requests.
- The client wallet read path runs that reconciliation before returning the live wallet snapshot.
- Result notifications are readable Russian and visible as in-app push even when the unread result notification exists before the component mounts.
- The client live cabinet contains no mojibake text in touched labels.
