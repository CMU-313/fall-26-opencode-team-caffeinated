# Skill Mode Based Response Style (Anna David)

Response style lets you choose how much explanation OpenCode gives with its answers. It does not change what the model can do; it changes the level and style of explanation it uses.

- **Beginner** explains concepts in depth and walks through the important parts of an implementation.
- **Intermediate** assumes basic software-engineering knowledge and explains the approach and important choices.
- **Expert** is concise and implementation-first, while still calling out material design decisions.

Intermediate is the default for new sessions.

## Use it

In the app, select the response-style button beside the prompt (it shows the current style), or enter `/skill-mode` in the prompt. In the terminal UI, run `/skill-mode`; in the `opencode run` interface, open the command menu and select **Response style**. Choose Beginner, Intermediate, or Expert, then choose when it applies:

- **For this and future sessions** changes the current session and makes that style the default for new sessions.
- **For this session only** changes only the current session.
- **For the next prompt only** uses the style for the next prompt, including any tool-follow-up turns that prompt needs, then returns to the saved session style.

You can change the style before sending the first prompt in a new session or at any time in an existing session. A session-only change does not alter the default for later sessions. A next-prompt-only change is not saved in the conversation history.

## User-test checklist

1. Start a new session and confirm the displayed style is **Intermediate**.
2. Select **Beginner** and **For this session only**. Ask the same implementation question; confirm the reply explains concepts and meaningful code sections in more detail. Create another session and confirm it is still Intermediate.
3. Select **Expert** and **For this and future sessions**. Confirm the current reply is concise and implementation-first, then create a new session and confirm Expert is selected there too.
4. In a session with a saved style, select a different style and **For the next prompt only**. Send two similar prompts. Confirm the first uses the temporary style and the second returns to the saved style. If the first prompt invokes tools, confirm its follow-up response keeps the temporary style.
5. Repeat one selection through `/skill-mode` (or the `opencode run` command menu) to confirm the terminal flow exposes the same choices.

## Automated tests

The automated tests are located in [the app response-style test](packages/app/src/components/prompt-input/experience-mode.test.ts), [the app submission test](packages/app/src/components/prompt-input/submit.test.ts), [the server session API test](packages/opencode/test/server/httpapi-session.test.ts), [the prompt execution test](packages/opencode/test/session/prompt.test.ts), and [the terminal footer UI test](packages/opencode/test/cli/run/footer.view.test.tsx).

Together, these tests cover loading the saved default and safely falling back when it cannot be read; applying a one-prompt choice to normal, queued, shell, and custom-command submissions; the API's default, session-only, and session-and-default persistence behavior; and the instructions sent to the provider for all three styles. They also verify that temporary styles are not persisted, continue across tool turns, and revert for the following prompt, plus that the terminal command menu displays the response-style control. This covers each scope, persistence boundary, and provider-facing behavior introduced by the change; the manual checklist covers the visible app and terminal interactions.
