# Small garden

Home shows the percentage of scheduled dose occurrences explicitly recorded as TAKEN, SKIPPED or UNKNOWN. The three answers have the same input effort, completion treatment and garden rewards. Empty days are 0%, and rounding cannot show 100% before the final occurrence is recorded. This measures recording, not verified ingestion.

An account earns at most one stamp per fully recorded day. Stamps accumulate across days without records. Seven stamps complete one plant; the next plant starts a new seven-stamp cycle. Pots and stamp designs unlock at 7, 14 and 21 stamps, with no purchase flow. All progress and selected styles live on the server and survive app restarts and device changes.

- Stamps begin with explicit current-day records when the feature is first used. Historical schedules are mutable, so older days are never guessed or backfilled.
- A day is earned when every configured occurrence has an explicit TAKEN, SKIPPED or UNKNOWN record. Empty/unconfigured schedules and extra unscheduled logs do not earn a stamp.
- UNKNOWN means the user explicitly chose “기억이 안 나요”; it counts as a record without implying ingestion. An absent record remains unrecorded. History's existing MISSED API value means unrecorded and must not be presented as proof that the supplement was not taken.
- Schedule changes, registration and product deletion cannot create a stamp. A previously earned day is preserved across these changes.
- Correcting or deleting a dose record never retracts an earned stamp, completed plant or unlocked style. A day can never award a second stamp after correction or re-entry.
- Account row locking and a unique account/date constraint serialize simultaneous devices and prevent duplicate stamps. Both home/detail recording and notification actions use the same rules.

GET `/api/garden` returns account progress and current selections. PUT `/api/garden/style` accepts `{pot, stamp}` and validates unlocks on the server. Both require the existing session. The additive `garden_day` and `garden_style` tables are created by the normal idempotent production schema initialization.

Plant illustrations are local SVGs with eight growth stages, three variations and four pots. Each newly confirmed daily stamp opens a dismissible growth sheet, wherever the last dose was recorded (Home, product detail or notification action). A 2.1-second sequence gently stirs the existing plant, adds soft light, then crossfades to the next growth stage and stamps the new day. Daily copy matches the growth stage; every seventh stamp shows the completed plant and collection/unlock action. TAKEN, SKIPPED and UNKNOWN receive the same celebration, with no special reward or animation for an all-TAKEN day. All pots and species share the same animation.

The shared signed-in-session tracker compares server-confirmed stamps, never optimistic dose percentages. It survives reminder navigation resets, suppresses duplicate/undo-and-recheck celebrations for the same date and resets on account changes. Initial loads of already-earned days do not replay rewards. A failed garden request never fails or rolls back a saved dose. Optional pre-write reads for detail/reminder actions have a short timeout.

Reduced motion shows the grown plant and confirmation immediately, without movement, light effects or modal transitions. Close/continue controls remain available throughout; there is no forced timer, looping animation or sound. Small screens can scroll the sheet.
