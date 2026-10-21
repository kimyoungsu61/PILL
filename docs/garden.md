# Small garden

Home shows the percentage of scheduled dose occurrences marked TAKEN. Empty days are 0%, and rounding cannot show 100% before the final occurrence.

An account earns at most one stamp per completed day. Stamps accumulate across missed days. Seven stamps complete one plant; the next plant starts a new seven-stamp cycle. Pots and stamp designs unlock at 7, 14 and 21 stamps, with no purchase flow. All progress and selected styles live on the server and survive app restarts and device changes.

- Stamps begin with actual current-day completion when the feature is first used. Historical schedules are mutable, so older days are never guessed or backfilled.
- A day is earned only when every configured occurrence is TAKEN. SKIPPED, empty/unconfigured schedules and extra unscheduled logs do not earn a stamp.
- Schedule changes, registration and product deletion cannot create a stamp. A previously earned day is preserved across these changes.
- Explicitly undoing an occurrence that earned today's stamp retracts that day's stamp. Older days remain intact. Styles that become locked fall back to the free selection until re-earned.
- Account row locking and a unique account/date constraint serialize simultaneous devices and prevent duplicate stamps. Both home/detail recording and notification actions use the same rules.

GET `/api/garden` returns account progress and current selections. PUT `/api/garden/style` accepts `{pot, stamp}` and validates unlocks on the server. Both require the existing session. The additive `garden_day` and `garden_style` tables are created by the normal idempotent production schema initialization.

Plant illustrations are local SVGs with eight growth stages and three variations. Home animates confirmed new stamps with reduced-motion support; every seventh stamp opens a dismissible completion sheet. An already-earned reward does not replay on reload.
