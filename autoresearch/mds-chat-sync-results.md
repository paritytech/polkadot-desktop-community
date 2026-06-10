# MDS Chat Sync — Test Run Results

> Execution log for [`mds-chat-sync-test-plan.md`](./mds-chat-sync-test-plan.md). Fill one **Run** block per pass.
> **Status values:** `PASS` ✅ · `FAIL` ❌ · `FLAKY` `❌→✅` (only after retries/relaunch) · `BLOCKED` 🚫 · `SKIP` ➖ · `—` not run.

## Run metadata

| Field            | Value |
| ---------------- | ----- |
| Run date         |       |
| Tester           |       |
| Desktop build    |       |
| Android build    |       |
| iOS build        |       |
| Network / chain  |       |
| Notes            |       |

---

## Combo 6.1 — Android + Android + Desktop

`D(A)` = Desktop · `M(A)` = Android (A) · `M(B)` = Android (B)

### Case 1 — Base case (all online, full handshake)

| Step | Action                     | `D(A)` | `M(A)` | `M(B)` | Status | Notes |
| ---- | -------------------------- | ------ | ------ | ------ | ------ | ----- |
| 1    | Chat request + message (D) |   ✅   |   ✅  |   ✅   |        |     |
| 2    | Chat accepted (B)          |    ✅    |    ❌    |    ✅    |        |    double approve shown on M(A)    |
| 3    | Answer from B              |    ✅    |    ✅    |    ✅    |        |       |
| 4    | Message from A (mobile)    |    ✅    |     ✅   |    ✅    |        |       |
| 5    | Message from D(A)          |    ✅   |      ✅  |   ✅     |        |       |
| 6    | Message from B             |    ✅  |       ✅ |  ✅      |        |       |

**Case 1 verdict:** ___ &nbsp;&nbsp; **Notes:** _______________________________________________

### Cases 2–7 (established chat — s1: Msg from A · s2: Msg from B · s3: Msg from D(A))

| Case | Offline (⚪️)      | s1 `D(A)`/`M(A)`/`M(B)` | s2 `D(A)`/`M(A)`/`M(B)` | s3 `D(A)`/`M(A)`/`M(B)` | Verdict | Notes |
| ---- | ----------------- | ----------------------- | ----------------------- | ----------------------- | ------- | ----- |
| 2    | `D(A)`            |    ✅ /  ✅ / ✅       |  ✅   / ✅  / ✅        |   ✅  /  ✅ /  ✅       |         |       |
| 3    | `M(A)`            |    ✅ / ❌  / ✅       |     ✅ / ❌  / ✅       |     ✅ / ❌  / ✅       |         |   there is missed message on M(A)    |
| 4    | `M(B)`            |    ✅ / ❌  / ✅       |    ✅ / ❌  / ✅        |     ✅ / ❌  / ✅       |         |   there is missed message on M(A)   |
| 5    | `D(A)`+`M(A)`     |     ✅ /  ✅ / ✅      |     ✅ /  ✅ / ✅       |      ✅ /  ✅ / ✅      |         |       |
| 6    | `M(A)`+`M(B)`     |     ✅ / ❌  / ✅      |     ✅ / ❌  / ✅       |     ✅ / ❌  / ✅       |         |    there is missed message on M(A)   |
| 7    | `D(A)`+`M(B)`     |     ❌ / ✅ / ✅       |    ❌ / ✅ / ✅         |    ❌ / ✅ / ✅         |         |   there is missed message on D(A)    |

**Combo 6.1 invariant checks:** identical list ☐ · attribution ☐ · no duplicates ☐ · read/unread ☐ · no-manual-relaunch convergence ☐

---

## Combo 6.2 — iOS + Android + Desktop (retest of Sheet1)

`D(A)` = Desktop · `M(A)` = Android (A) · `M(B)` = iOS (B)

### Case 1 — Base case (all online, full handshake)

| Step | Action                     | `D(A)` | `M(A)` | `M(B)` | Status | Notes (Sheet1 baseline) |
| ---- | -------------------------- | ------ | ------ | ------ | ------ | ----------------------- |
| 1    | Chat request + message (D) |        |        |        |        |                         |
| 2    | Chat accepted (B)          |        |        |        |        | ⚠️ was: "approved" shown twice on Android |
| 3    | Answer from B              |        |        |        |        |                         |
| 4    | Message from A (mobile)    |        |        |        |        |                         |
| 5    | Message from D(A)          |        |        |        |        |                         |
| 6    | Message from B             |        |        |        |        |                         |

**Case 1 verdict:** ___ &nbsp;&nbsp; **Notes:** _______________________________________________

### Cases 2–7 (established chat — s1: Msg from A · s2: Msg from B · s3: Msg from D(A))

| Case | Offline (⚪️)      | s1 `D(A)`/`M(A)`/`M(B)` | s2 `D(A)`/`M(A)`/`M(B)` | s3 `D(A)`/`M(A)`/`M(B)` | Verdict | Notes (Sheet1 baseline) |
| ---- | ----------------- | ----------------------- | ----------------------- | ----------------------- | ------- | ----------------------- |
| 2    | `D(A)`            |     /   /               |     /   /               |     /   /               |         | was: D→Android missing even after restart; stray unread on Desktop |
| 3    | `M(A)`            |     /   /               |     /   /               |     /   /               |         | was: appeared only after 3rd restart |
| 4    | `M(B)`            |     /   /               |     /   /               |     /   /               |         | was: D→iOS only after >5 min idle; A→Desktop after restarts |
| 5    | `D(A)`+`M(A)`     |     /   /               |     /   /               |     /   /               |         | not run in Sheet1 |
| 6    | `M(A)`+`M(B)`     |     /   /               |     /   /               |     /   /               |         | not run in Sheet1 |
| 7    | `D(A)`+`M(B)`     |     /   /               |     /   /               |     /   /               |         | not run in Sheet1 |

**Combo 6.2 invariant checks:** identical list ☐ · attribution ☐ · no duplicates ☐ · read/unread ☐ · no-manual-relaunch convergence ☐

---

## Combo 6.3 — iOS + iOS + Desktop

`D(A)` = Desktop · `M(A)` = iOS (A) · `M(B)` = iOS (B)

### Case 1 — Base case (all online, full handshake)

| Step | Action                     | `D(A)` | `M(A)` | `M(B)` | Status | Notes |
| ---- | -------------------------- | ------ | ------ | ------ | ------ | ----- |
| 1    | Chat request + message (D) |        |        |        |        |       |
| 2    | Chat accepted (B)          |        |        |        |        |       |
| 3    | Answer from B              |        |        |        |        |       |
| 4    | Message from A (mobile)    |        |        |        |        |       |
| 5    | Message from D(A)          |        |        |        |        |       |
| 6    | Message from B             |        |        |        |        |       |

**Case 1 verdict:** ___ &nbsp;&nbsp; **Notes:** _______________________________________________

### Cases 2–7 (established chat — s1: Msg from A · s2: Msg from B · s3: Msg from D(A))

| Case | Offline (⚪️)      | s1 `D(A)`/`M(A)`/`M(B)` | s2 `D(A)`/`M(A)`/`M(B)` | s3 `D(A)`/`M(A)`/`M(B)` | Verdict | Notes |
| ---- | ----------------- | ----------------------- | ----------------------- | ----------------------- | ------- | ----- |
| 2    | `D(A)`            |     /   /               |     /   /               |     /   /               |         |       |
| 3    | `M(A)`            |     /   /               |     /   /               |     /   /               |         |       |
| 4    | `M(B)`            |     /   /               |     /   /               |     /   /               |         |       |
| 5    | `D(A)`+`M(A)`     |     /   /               |     /   /               |     /   /               |         |       |
| 6    | `M(A)`+`M(B)`     |     /   /               |     /   /               |     /   /               |         |       |
| 7    | `D(A)`+`M(B)`     |     /   /               |     /   /               |     /   /               |         |       |

**Combo 6.3 invariant checks:** identical list ☐ · attribution ☐ · no duplicates ☐ · read/unread ☐ · no-manual-relaunch convergence ☐

---

## Bug log (file new / confirm existing)

| # | Combo | Case / step | Severity | Symptom observed | Repro steps | Status (new/known/fixed) | Ticket |
| - | ----- | ----------- | -------- | ---------------- | ----------- | ------------------------ | ------ |
| 1 |       |             |          |                  |             |                          |        |
| 2 |       |             |          |                  |             |                          |        |
| 3 |       |             |          |                  |             |                          |        |
| 4 |       |             |          |                  |             |                          |        |
| 5 |       |             |          |                  |             |                          |        |

## Run summary

| Combo | Cases passed | Cases failed | Flaky | Blocked | Notes |
| ----- | ------------ | ------------ | ----- | ------- | ----- |
| 6.1   |              |              |       |         |       |
| 6.2   |              |              |       |         |       |
| 6.3   |              |              |       |         |       |
