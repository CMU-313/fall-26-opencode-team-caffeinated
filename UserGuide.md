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

# Interactive and Responsive "Intro to OpenCode" Feature (Khushi Thaker)

The Intro to OpenCode is an interactive guide in the terminal app. It walks new users through six steps for setting up and using OpenCode, so they don't have to work it out on their own. It checks off each step automatically when it can see the user has done it, using their real setup. It only adds explanations and tracks progress. It doesn't change what the model can do or how it behaves.

## Use it

### Opening and closing

- **At launch:** the intro opens automatically each time OpenCode starts on the home screen. It won't open on top of another dialog that's already showing.
- **Anytime:** type `/intro`, choose **Intro to OpenCode** from the command palette, or click **"New to OpenCode? Open the intro"** at the bottom of the home screen.
- **Closing:** press `esc` or click `esc` in the top-right corner. Closing it only hides it until the next launch.
- **Turning off auto-launch:** select **"Show this when OpenCode starts"** to switch between ☑ (on) and ☐ (off). The setting is saved, and `/intro` still works when it's off.

### What's inside

- **About:** a short explanation of what OpenCode is.
- **Get started:** the six steps, with an **N/6 done** counter. Selecting a step expands it to show:
  - an explanation, with the keys and commands to type highlighted;
  - a status line, either "✓ Done" with the reason or "○ Not done yet" with what will check it off;
  - **▶ Try it** on some steps, which runs the real command so the user can practice right away;
  - a common question that shows its answer when selected.
- **See every command OpenCode has:** opens the command palette.
- **Start over:** clears the progress from steps the user has read. Steps verified from the user's real setup stay checked, and a message names them.
- **Quick keys:** the user's actual shortcuts for the command palette, switching between Plan and Build, and stopping a response. It also shows `@` (attach a file), `!` (shell command), and `/` (slash commands).
- **Footer:** a link to opencode.ai/docs.

### The six steps

| #   | Step                        | Checks off when                                                                       |
| --- | --------------------------- | ------------------------------------------------------------------------------------- |
| 1   | Connect a model             | A provider is connected. The free built-in models don't count, but a paid model does. |
| 2   | Ask for what you want       | The user has sent a message in this project.                                          |
| 3   | Point it at the right files | The project has an `AGENTS.md` or `CLAUDE.md` file, which `/init` creates.            |
| 4   | Plan first, then build      | The user has opened the step.                                                         |
| 5   | Review and undo             | The user has opened the step.                                                         |
| 6   | Manage your conversations   | The project has more than one session.                                                |

The intro always opens at the first unfinished step, or at step 1 when all six are done. Progress and the launch setting are saved between launches.

### Controls

Use `↑`/`↓` to move and `enter` to open or select, or hover and click with the mouse. Selecting an open step folds it closed.

## User-test checklist

1. Start OpenCode in a project with no `AGENTS.md`, without connecting a provider. Check that the intro opens automatically, shows **0/6 done**, and opens at step 1 with "○ Not done yet".
2. On step 1, select **▶ Try it: Open /connect**. Check that the connect dialog opens, then close it and reopen the intro with `/intro`.
3. Select **"Do I need to pay for a model?"**. Check that the answer appears, and that it closes when you select another step.
4. Open steps 4 and 5. Check that each gets a ✓ and the counter goes up.
5. Close the intro, connect a provider, send a message, and run `/init`. Reopen it with `/intro` and check that steps 1–3 now show "✓ Done" with the reason.
6. Start a second session with `/new`, reopen the intro, and check that step 6 is checked and the intro shows **6/6 done**.
7. Select **Start over**. Check that only steps 4 and 5 clear, and that the message names the steps that stay checked.
8. Select **"Show this when OpenCode starts"** to turn it off (☐), then restart OpenCode. Check that the intro doesn't open, and that the home-screen link and `/intro` still open it.

## Tests

The automated tests are located in [the intro UI test](packages/tui/test/feature-plugins/intro.test.tsx). Run them from `packages/tui` with `bun test test/feature-plugins/intro.test.tsx`.

The 23 tests render the real intro in a test terminal and drive it with the keyboard and mouse. They cover:

- **Opening and closing:** it opens at launch and after closing stays hidden only until the next launch. It also opens from `/intro` and from the home-screen link. It stays closed when auto-launch is turned off, and it never opens on top of another dialog.
- **Progress tracking:** steps are checked off from the user's real setup. That means a connected provider (the free built-in models don't count, but a paid model does), a first and a second session, and an `AGENTS.md` or `CLAUDE.md` file. Other steps check off once they are read. The intro opens at the first unfinished step, shows 6/6 when everything is done, and still works if the file list can't be loaded.
- **Interactions:** steps open and fold, and questions show their answers, which close when you move to another step. "Try it" and "See every command" run the real commands, and keyboard selection stays in bounds.
- **Settings:** the launch toggle is saved. "Start over" clears only the steps checked by reading, keeps the ones verified from the user's setup, and says which were kept.
- **Registration:** the intro is included in OpenCode's built-in plugins.

Together with the manual checklist above, these tests cover every way the intro opens, every step's completion rule, and every row a user can select.

## Debug Mode for Failed Shell Commands (Sanika Jain)

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

# Unit Test Evaluation Subagent (Vidhya Vishwanath)
The coverage agent is a tool that let's users find the aps within th test cases within the code that they write, and get coached through how to update their tests to make necessary changes for full test coverage.

## Use it

## Opening and Closing
In the app, the user types /coverage and then the path to the file that they want to analyze coverage for, it is session dependent so the state isn't stored in a new session.

It gives you test coverage ratings, then proposes the first issue to walk through. To leave the session, the user presses escape or redirects to a different conversation

## What's Inside
Once you point to your code to the file, the agent runs the bun test coverage to see which functions are not fully covered with your tests, and then, it ranks the gaps in order of importance, presenting them to the user. Then it takes the first gap and asks the user how they would approach fixing it, and gives them feedback on their approach.

# Automated Verification

The tests are in [packages/opencode/src/test/command/index.test.ts] subfolder that has unit and some integration tests for the coverage agent, where it checks whether it's registered as a built in command, resolves the correct path, and exposes the correct argument instead of giving the user the correct answer


