# Multi-Device Sync (MDS) — Chat Test Plan

> Source: **"MDS Testing"** spreadsheet (`1P5EiR5zfVzq8K7sEDG-vUsQLsLoEMSqzzFsG5Q3ZJP8`, owner `dmitry@novasama.io`).
> This plan generalizes the spreadsheet's matrix into runnable test scenarios for **3 device combinations × 7 cases**.

## 1. Feature under test

**Multi-Device Sync (MDS)** lets one account (`A`) be signed in on **two devices at once** — a desktop and a
mobile — that must stay in sync. Every chat action performed on one of A's devices (send, accept, read) must be
reflected on A's *other* device, while the counterpart account (`B`, a single device) communicates normally.

The hard part — and what these tests target — is **the desktop ↔ paired-mobile sync within account A**, plus
**offline catch-up** when one or more devices miss messages and reconnect.

## 2. Terminology & device model

| Symbol  | Meaning                                                                        |
| ------- | ------------------------------------------------------------------------------ |
| `D(A)`  | **Desktop** device, signed into account **A**                                  |
| `M(A)`  | **Mobile** device (Android or iOS), signed into the **same** account **A** — paired with `D(A)` |
| `M(B)`  | **Mobile** device, signed into the counterpart account **B**                   |

- Account **A** = `D(A)` + `M(A)` (two devices, always paired). **One mobile is always paired with the desktop.**
- Account **B** = `M(B)` (one device, the conversation partner).
- "Account A's chat with B" is a single conversation that must look identical on both `D(A)` and `M(A)`.

## 3. Legend (from the spreadsheet)

| Mark                 | Meaning                                                                       |
| -------------------- | ----------------------------------------------------------------------------- |
| ↗️                   | This device **performs the action** (it is the sender / initiator)            |
| ✅                   | Expected end-state correct on this device (message present, attributed, in order) |
| ❌                   | Failure observed — message did **not** appear                                 |
| `❌ ✅ (see note)`    | Eventually appeared, but only after retries / multiple relaunches             |
| ⚠️ (Report)          | Bug to report                                                                 |
| 🟢                   | Device **online**                                                             |
| ⚪️                   | Device **offline** (verification happens **after relaunch / reconnect**)      |

**Result codes used in the matrices below** (what each device *should* show for a given message):

- **SENT** — this device originated the message; shows as own outgoing.
- **SYNC** — this device shares the sender's account (the other A device); must show the message as **own outgoing** via multi-device sync.
- **RECV** — this device is the counterpart; must show the message as **incoming**.
- **CATCH-UP** — this device was offline when the message was sent; must show the correct state **after it relaunches/reconnects**.
- A sender that is offline **queues** the message and transmits it on reconnect.

## 4. Core sync invariants (the actual assertions)

For every case, after all devices are back online and idle, verify on **all three** devices:

1. **Identical message list** — same set of messages, same chronological order.
2. **Correct attribution** — A's messages are *outgoing* on both `D(A)` and `M(A)`; B's messages are *incoming* on A's devices and *outgoing* on `M(B)` (and vice-versa).
3. **No duplicates** — no message (or system event like "request accepted") appears twice.
4. **Read/unread integrity** — unread badges clear consistently after a device views the chat; no stray unread on a device that already displayed the message.
5. **Convergence without manual intervention** — sync completes after a normal reconnect; needing repeated relaunches or long idle (>5 min) is a **failure**.

## 5. Generic case definitions

These 7 cases are the reusable template. Section 6 instantiates them per combo. `M(A)`/`M(B)` are substituted with
the concrete platform (Android/iOS).

### Case 1 — Base case: all online, full chat handshake (Desktop is initiator)

**Preconditions:** all three devices online; `D(A)` and `M(A)` signed into the same account A; no prior chat between A and B.

| # | Step (Given/When/Then)                                                        | Sender | `D(A)` | `M(A)` | `M(B)` |
| - | ----------------------------------------------------------------------------- | ------ | ------ | ------ | ------ |
| 1 | **When** A sends a chat request with a message from the desktop               | `D(A)` | SENT   | SYNC   | RECV (incoming request) |
| 2 | **When** B accepts the chat request                                           | `M(B)` | shows accepted | shows accepted (SYNC) | SENT (accept) |
| 3 | **When** B sends the first answer                                             | `M(B)` | RECV   | RECV   | SENT   |
| 4 | **When** A replies from the mobile                                            | `M(A)` | SYNC   | SENT   | RECV   |
| 5 | **When** A replies from the desktop                                           | `D(A)` | SENT   | SYNC   | RECV   |
| 6 | **When** B sends another message                                             | `M(B)` | RECV   | RECV   | SENT   |

**Then** all 5 core invariants hold. Pay special attention to step 2 (no duplicate "request accepted" system message)
and steps 4–5 (desktop ↔ mobile sync of A's own messages).

### Cases 2–7 — Established chat, offline / catch-up resilience

**Preconditions:** chat A↔B already accepted and active (run Case 1 first). Each case sends the **same 3 messages**:

- **s1. Message from A** — sent by `M(A)`
- **s2. Message from B** — sent by `M(B)`
- **s3. Message from D(A)** — sent by `D(A)`

The **Device state** row defines which devices are offline (⚪️). Offline **receivers** are verified after relaunch
(CATCH-UP); offline **senders** queue their message and transmit on reconnect. After all devices reconnect and idle,
assert the 5 core invariants.

| Case | Offline (⚪️)          | Online (🟢)        | Scenario summary                                        |
| ---- | --------------------- | ------------------ | ------------------------------------------------------- |
| 2    | `D(A)`                | `M(A)`, `M(B)`     | Desktop offline; A-mobile & B converse, then desktop catches up |
| 3    | `M(A)`                | `D(A)`, `M(B)`     | A-mobile offline; desktop & B converse, then mobile catches up |
| 4    | `M(B)`                | `D(A)`, `M(A)`     | B offline; A's two devices converse, then B catches up  |
| 5    | `D(A)`, `M(A)`        | `M(B)`             | Both of account A's devices offline; B sends            |
| 6    | `M(A)`, `M(B)`        | `D(A)`             | Both mobiles offline; desktop sends                     |
| 7    | `D(A)`, `M(B)`        | `M(A)`             | Desktop & B offline; A-mobile sends                     |

**Generic step procedure for each case:**
1. **Given** the chat is active and the listed devices are taken offline (background-killed / airplane mode).
2. **When** each of s1/s2/s3 is performed (online senders send immediately; offline senders compose → queued).
3. **And** every offline device is relaunched / brought back online.
4. **Then** assert the 5 core invariants on all three devices.

#### Per-case expected result matrices

**Case 2 — `D(A)` offline**

| Message            | `D(A)`      | `M(A)`  | `M(B)`  |
| ------------------ | ----------- | ------- | ------- |
| s1. from A `M(A)`  | CATCH-UP (SYNC) | SENT | RECV |
| s2. from B `M(B)`  | CATCH-UP (RECV) | RECV | SENT |
| s3. from D(A)      | SENT (queued→reconnect) | SYNC | RECV |

**Case 3 — `M(A)` offline**

| Message            | `D(A)` | `M(A)`              | `M(B)`  |
| ------------------ | ------ | ------------------- | ------- |
| s1. from A `M(A)`  | SYNC   | SENT (queued→reconnect) | RECV |
| s2. from B `M(B)`  | RECV   | CATCH-UP (RECV)     | SENT    |
| s3. from D(A)      | SENT   | CATCH-UP (SYNC)     | RECV    |

**Case 4 — `M(B)` offline**

| Message            | `D(A)` | `M(A)` | `M(B)`              |
| ------------------ | ------ | ------ | ------------------- |
| s1. from A `M(A)`  | SYNC   | SENT   | CATCH-UP (RECV)     |
| s2. from B `M(B)`  | RECV   | RECV   | SENT (queued→reconnect) |
| s3. from D(A)      | SENT   | SYNC   | CATCH-UP (RECV)     |

**Case 5 — `D(A)` & `M(A)` offline (all of account A)**

| Message            | `D(A)`              | `M(A)`              | `M(B)`  |
| ------------------ | ------------------- | ------------------- | ------- |
| s1. from A `M(A)`  | CATCH-UP (SYNC)     | SENT (queued→reconnect) | RECV (after A reconnects) |
| s2. from B `M(B)`  | CATCH-UP (RECV)     | CATCH-UP (RECV)     | SENT    |
| s3. from D(A)      | SENT (queued→reconnect) | CATCH-UP (SYNC) | RECV (after D reconnects) |

> Extra check: the two account-A devices must reconcile **each other's** queued sends after both reconnect.

**Case 6 — `M(A)` & `M(B)` offline; desktop sends**

| Message            | `D(A)` | `M(A)`              | `M(B)`              |
| ------------------ | ------ | ------------------- | ------------------- |
| s1. from A `M(A)`  | SYNC (after M(A) reconnects) | SENT (queued→reconnect) | RECV (after reconnect) |
| s2. from B `M(B)`  | RECV (after M(B) reconnects) | RECV (after reconnect) | SENT (queued→reconnect) |
| s3. from D(A)      | SENT   | CATCH-UP (SYNC)     | CATCH-UP (RECV)     |

**Case 7 — `D(A)` & `M(B)` offline; A-mobile sends**

| Message            | `D(A)`              | `M(A)` | `M(B)`              |
| ------------------ | ------------------- | ------ | ------------------- |
| s1. from A `M(A)`  | CATCH-UP (SYNC)     | SENT   | CATCH-UP (RECV)     |
| s2. from B `M(B)`  | CATCH-UP (RECV)     | RECV (after M(B) reconnects) | SENT (queued→reconnect) |
| s3. from D(A)      | SENT (queued→reconnect) | SYNC (after D reconnects) | CATCH-UP (RECV) |

---

## 6. Combinations

One mobile is **always** paired with the desktop (= `M(A)`). The combos differ by the platform of `M(A)` and `M(B)`.

| Combo | `D(A)` | `M(A)` (paired) | `M(B)` (counterpart) | Sheet status |
| ----- | ------ | --------------- | -------------------- | ------------ |
| **6.1** Android + Android + Desktop | Desktop | Android (A) | Android (B) | new |
| **6.2** iOS + Android + Desktop     | Desktop | Android (A) | iOS (B)     | filled in Sheet1 (retest) |
| **6.3** iOS + iOS + Desktop         | Desktop | iOS (A)     | iOS (B)     | new |

> **6.2 pairing note:** Sheet1 pairs **Android** with the desktop and uses **iOS** as B. The mirror sub-variant
> — **iOS** paired with the desktop, **Android** as B — is also valid and worth a pass if time allows; the offline
> behaviour of the *paired mobile* is platform-dependent (see watchpoints), so swapping which OS is paired can expose
> different bugs.

Each combo runs all **7 cases** from Section 5. Fill the result column with ✅ / ❌ / `❌ ✅ (note)` / ⚠️.

### Platform watchpoints (apply per combo)

- **Android (`M(A)` or `M(B)`):**
  - Push notification delivery while backgrounded (Sheet1: "Push on Android" expected).
  - Aggressive background-kill by the OS — confirm queued sends survive an OS-initiated kill, not just a manual relaunch.
  - **Known bug:** duplicate "request approved / accepted" system message (Case 1, step 2).
- **iOS (`M(A)` or `M(B)`):**
  - Background sync latency — Sheet1: "Messages from Desktop appeared in iOS after long idle (>5 min)". Per invariant #5 this is a **failure**, not a pass.
  - App suspension vs. termination — test both.
- **Desktop (`D(A)`):**
  - **Known bug:** Desktop → paired-mobile message sync unreliable; in Sheet1 a "Message from D(A)" did not reach the paired Android even after restart, sometimes only after the **3rd** relaunch.
  - Stray **unread** indicator on the desktop for a message it already sent/displayed (Sheet1 note, Cases 2–3).
  - Offline launch must not block the chat behind the Remote-Config / onboarding-offline screen (relevant to current branch work).

### 6.1 — Android + Android + Desktop

`D(A)` = Desktop · `M(A)` = **Android (A)** · `M(B)` = **Android (B)**

Run Cases 1–7 (Section 5) with the substitution above. Result grid to fill:

| Case | s1 from A `D(A)`/`M(A)`/`M(B)` | s2 from B | s3 from D(A) | Notes |
| ---- | ------------------------------ | --------- | ------------ | ----- |
| 1 (handshake) | _/_/_                 | _/_/_     | _/_/_        |       |
| 2 `D(A)`⚪️    | _/_/_                 | _/_/_     | _/_/_        |       |
| 3 `M(A)`⚪️    | _/_/_                 | _/_/_     | _/_/_        |       |
| 4 `M(B)`⚪️    | _/_/_                 | _/_/_     | _/_/_        |       |
| 5 `D(A)`+`M(A)`⚪️ | _/_/_             | _/_/_     | _/_/_        |       |
| 6 `M(A)`+`M(B)`⚪️ | _/_/_             | _/_/_     | _/_/_        |       |
| 7 `D(A)`+`M(B)`⚪️ | _/_/_             | _/_/_     | _/_/_        |       |

Focus: both mobiles are Android, so Android push + background-kill behaviour is exercised on **both** ends, and the
desktop↔Android(A) sync bug is in scope every case.

### 6.2 — iOS + Android + Desktop (retest of Sheet1)

`D(A)` = Desktop · `M(A)` = **Android (A)** · `M(B)` = **iOS (B)**

This is the combo recorded in Sheet1. Re-run Cases 1–7 to verify whether the issues below are fixed.

| Case | s1 from A | s2 from B | s3 from D(A) | Sheet1 result (to confirm fixed) |
| ---- | --------- | --------- | ------------ | -------------------------------- |
| 1 (handshake) | `D(A)`✅ / `M(A)`✅ / `M(B)`✅ | all ✅ | all ✅ | ⚠️ Android showed "request approved" **twice** (step 2) |
| 2 `D(A)`⚪️ | all ✅ | all ✅ | D↗️ / **Android ❌→✅** / iOS ✅ | Desktop→Android message missing even after Android restart; stray unread on Desktop |
| 3 `M(A)`⚪️ | all ✅ | all ✅ (push on Android) | D↗️ / **Android ❌→✅** / iOS ✅ | Appeared only after **3rd** restart; stray unread on Desktop |
| 4 `M(B)`⚪️ | **Desktop ❌→✅** / Android↗️ / iOS ✅ | all ✅ | D↗️ / **Android ❌→✅** / **iOS ❌→✅** | Messages from Desktop reached iOS only after **>5 min idle**; multiple restarts needed |
| 5 `D(A)`+`M(A)`⚪️ | — | — | — | not yet run in Sheet1 — execute fresh |
| 6 `M(A)`+`M(B)`⚪️ | — | — | — | not yet run in Sheet1 — execute fresh |
| 7 `D(A)`+`M(B)`⚪️ | — | — | — | not yet run in Sheet1 — execute fresh |

### 6.3 — iOS + iOS + Desktop

`D(A)` = Desktop · `M(A)` = **iOS (A)** · `M(B)` = **iOS (B)**

Run Cases 1–7 with the substitution above. Result grid to fill:

| Case | s1 from A | s2 from B | s3 from D(A) | Notes |
| ---- | --------- | --------- | ------------ | ----- |
| 1 (handshake) | _/_/_  | _/_/_     | _/_/_        |       |
| 2 `D(A)`⚪️    | _/_/_  | _/_/_     | _/_/_        |       |
| 3 `M(A)`⚪️    | _/_/_  | _/_/_     | _/_/_        |       |
| 4 `M(B)`⚪️    | _/_/_  | _/_/_     | _/_/_        |       |
| 5 `D(A)`+`M(A)`⚪️ | _/_/_ | _/_/_   | _/_/_        |       |
| 6 `M(A)`+`M(B)`⚪️ | _/_/_ | _/_/_   | _/_/_        |       |
| 7 `D(A)`+`M(B)`⚪️ | _/_/_ | _/_/_   | _/_/_        |       |

Focus: the **paired** device of account A is now **iOS**, so the desktop→paired-mobile sync bug is tested against
iOS's background-sync latency (the ">5 min idle" symptom). This is the combo most likely to surface the
"desktop messages arrive only after long idle" failure as the *primary* (not counterpart) sync path.

---

## 7. Known issues to verify fixed (carried from Sheet1, combo 6.2)

| # | Case / step                  | Symptom                                                                                  | Invariant violated |
| - | ---------------------------- | ---------------------------------------------------------------------------------------- | ------------------ |
| 1 | Case 1, step 2 (accept)      | "Request approved" system message shown **twice** on Android                             | #3 No duplicates   |
| 2 | Case 2, s3 (Msg from D(A))   | Desktop's message never reached paired Android, even after Android restart               | #1, #5             |
| 3 | Case 2–3                     | Stray **unread** badge on the Desktop for a message it itself sent                        | #4 Read/unread     |
| 4 | Case 3, s3                   | Desktop→Android message appeared only after the **3rd** relaunch                         | #5 Convergence     |
| 5 | Case 4, s1 (Msg from A)      | Android's message reached the **Desktop** only after the 3rd restart                     | #1, #5             |
| 6 | Case 4, s3 (Msg from D(A))   | Desktop's message reached **iOS** only after **>5 min idle**; Android after restarts     | #5 Convergence     |

**Root-cause hypothesis (for dev):** the **Desktop → paired-mobile** outbound sync path and **offline catch-up** are
unreliable — messages converge only via repeated relaunches or long idle, rather than promptly on reconnect. The
counterpart (`B` ↔ A) delivery path is comparatively healthy. Prioritize cases 2–7 step **s3 (Message from D(A))** and
the paired-device sync direction.
