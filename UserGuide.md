# User Guide

## Debug mode for failed shell commands

The session timeline can show a short, persistent checklist when a completed Bash
tool call reports a non-zero exit code or recognizable assertion/exception output.
The checklist is tied to the session and the exact failure signature, so a new
failure gets its own progress instead of reusing an unrelated checklist.

### How to use it

1. Open a session in the app and run a command that fails, such as a test command
   with an assertion failure or an exception.
2. Locate the failed Bash tool call in the session timeline.
3. Select **Toggle steps** in the debug panel below the failed command.
4. Work through **reproduce**, **inspect**, and **rerun**. The panel shows the
   failed command and the most relevant assertion or exception line as evidence.
5. Select a numbered step to mark it complete. Select it again to undo completion.
   Closing and reopening the session preserves the toggle and checklist progress
   for that failure.

To test the feature manually, verify that successful commands do not show the
panel, failed commands do show it, assertion and exception output produce the
corresponding inspection wording, and changing one failure's checklist does not
change another failure's checklist.

### Automated verification

The feature logic is tested in
[`packages/app/src/pages/session/timeline/debug-mode.test.ts`](./packages/app/src/pages/session/timeline/debug-mode.test.ts).
These tests cover:

- the ordered reproduce/inspect/rerun checklist for assertion and exception output;
- extraction of representative failure evidence and classification of the failure;
- failure-signature isolation so different exits or output cannot share progress;
- persistence, malformed-storage recovery, and normalization of saved progress; and
- advancing and undoing checklist steps.

Together these tests cover the analyzer's output, the state transitions used by
the panel, and the persistence boundary. The UI uses those same pure functions
to render and save its state, while the manual checks above verify the
success/failure gating and interactive rendering in the timeline.

Run the focused suite from the app package:

```bash
cd packages/app
bun test --conditions=solid --preload ./happydom.ts src/pages/session/timeline/debug-mode.test.ts
```
