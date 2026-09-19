# Phase 2 accessibility acceptance

## Automated acceptance

Date: 2026-09-13

Environment: Playwright 1.63.0 with bundled Chromium on WSL2.

- `@axe-core/playwright` reports no detectable violations on the login, Game Upload form, Player
  Directory dialog, busy, uploading, interrupted, Partial Success, and success screens.
- Keyboard interaction tests cover Player autocomplete, unknown-Player addition, option selection,
  closing the listbox, Player Directory actions, and focus restoration after closing the dialog.
- Screen transitions move focus to the new heading. Login and logout move focus to the shared
  password field. Errors use alert semantics; Visibility and progress updates use status/live-region
  semantics.
- The in-flight interruption test confirms that heartbeats stop, no upload state is written to
  browser storage, form data and the selected MP4 remain in memory, and the replacement upload
  begins at byte zero.

Verification command:

```sh
pnpm test:e2e
```

## NVDA + Chrome acceptance

Status: Pending. NVDA is not installed in the available Windows host, so a genuine NVDA pass cannot
be recorded from this workspace. Do not check the Phase 2 accessibility item or declare the Phase 2
exit until an Uploader completes and records this pass.

Environment to record:

- Windows version:
- Chrome version:
- NVDA version:
- Tester:
- Date:

Keyboard-only and NVDA checklist:

- [ ] Sign in, including incorrect-password and rate-limit announcements.
- [ ] Complete the Game Upload form and select or add Players through autocomplete.
- [ ] Open the Player Directory, rename/merge/remove Players, cancel confirmations, close the
      dialog, and confirm focus returns to Manage Players.
- [ ] Trigger form validation and confirm focus context and error announcements are understandable.
- [ ] Choose Public Visibility and accept and reject the immediate confirmation.
- [ ] Start a Game Upload, review progress, and cancel it.
- [ ] Recover an interrupted upload with Release and restart and confirm the retained form/file are
      announced clearly.
- [ ] Retry playlist addition and accept Partial Success.
- [ ] Review success links, activate Done, and activate Upload another.

Result and notes:

Pending.
