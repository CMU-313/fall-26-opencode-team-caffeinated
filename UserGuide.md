# User Guide

## Skill Mode Based Response Style (Anna David)

Response style lets you choose how much explanation OpenCode gives with its answers. It does not change what the model can do; it changes the level and style of explanation it uses.

- **Beginner** explains concepts in depth and walks through the important parts of an implementation.
- **Intermediate** assumes basic software-engineering knowledge and explains the approach and important choices.
- **Expert** is concise and implementation-first, while still calling out material design decisions.

Intermediate is the default for new sessions.

### Use it

In the app, select the response-style button beside the prompt (it shows the current style), or enter `/skill-mode` in the prompt. In the terminal UI, run `/skill-mode`; in the `opencode run` interface, open the command menu and select **Response style**. Choose Beginner, Intermediate, or Expert, then choose when it applies:

- **For this and future sessions** changes the current session and makes that style the default for new sessions.
- **For this session only** changes only the current session.
- **For the next prompt only** uses the style for the next prompt, including any tool-follow-up turns that prompt needs, then returns to the saved session style.

You can change the style before sending the first prompt in a new session or at any time in an existing session. A session-only change does not alter the default for later sessions. A next-prompt-only change is not saved in the conversation history.

### User-test checklist

1. Start a new session and confirm the displayed style is **Intermediate**.
2. Select **Beginner** and **For this session only**. Ask the same implementation question; confirm the reply explains concepts and meaningful code sections in more detail. Create another session and confirm it is still Intermediate.
3. Select **Expert** and **For this and future sessions**. Confirm the current reply is concise and implementation-first, then create a new session and confirm Expert is selected there too.
4. In a session with a saved style, select a different style and **For the next prompt only**. Send two similar prompts. Confirm the first uses the temporary style and the second returns to the saved style. If the first prompt invokes tools, confirm its follow-up response keeps the temporary style.
5. Repeat one selection through `/skill-mode` (or the `opencode run` command menu) to confirm the terminal flow exposes the same choices.

### Automated tests

The automated tests are located in [the app response-style test](packages/app/src/components/prompt-input/experience-mode.test.ts), [the app submission test](packages/app/src/components/prompt-input/submit.test.ts), [the server session API test](packages/opencode/test/server/httpapi-session.test.ts), [the prompt execution test](packages/opencode/test/session/prompt.test.ts), and [the terminal footer UI test](packages/opencode/test/cli/run/footer.view.test.tsx).

Together, these tests cover loading the saved default and safely falling back when it cannot be read; applying a one-prompt choice to normal, queued, shell, and custom-command submissions; the API's default, session-only, and session-and-default persistence behavior; and the instructions sent to the provider for all three styles. They also verify that temporary styles are not persisted, continue across tool turns, and revert for the following prompt, plus that the terminal command menu displays the response-style control. This covers each scope, persistence boundary, and provider-facing behavior introduced by the change; the manual checklist covers the visible app and terminal interactions.

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
