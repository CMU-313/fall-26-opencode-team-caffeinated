# Traceability: Khushi Thaker (kthaker)

**Target feature:** Intro to OpenCode feature, which lives in `packages/tui/src/feature-plugins/home/intro.tsx` (registered as a built-in plugin in `packages/tui/src/feature-plugins/builtins.ts`)

## Requirements

| ID | Interview evidence | Requirement | Acceptance Criteria | Changed in P4? | Property (kind) | Test | Mutants it kills |
|---|---|---|---|---|---|---|---|
| R1 | C-7, O-5: “If it showed 4/6 the first time…it should still show 4/6” | Intro progress is saved and restored when OpenCode restarts. | With the intro at 4/6, restarting OpenCode with no other changes still shows 4/6 with the same steps checked. | No | Restarting OpenCode with the intro's saved settings shows the same N/6 and the same checked steps, for any setup, earlier progress, and use of the dialog; a step the user opened stays checked, verified steps match an independent rule, and N/6 equals the number of checkmarks (round-trip + oracle) | `packages/tui/test/feature-plugins/intro.property.test.ts`: “R1: restarting OpenCode restores the same progress” | H1, H2, H3 |
| R2 | C-4, O-3: “I wouldn’t expect it to change the files in the codebase” | Using the intro never creates, edits, or deletes files in the user’s project. | After selecting every row in the intro, except “Try It”, the project’s files and their contents are unchanged. | No | For any setup and any use of the dialog except “Try it”, every server call the intro makes is the read-only file listing of the project root, and it saves only its own `intro_` settings (invariant) | `packages/tui/test/feature-plugins/intro.property.test.ts`: “R2: using the intro only reads the project and only saves its own settings” | None |
| R3 | C-8, O-7, S-10: “I would check … by manually following the instructions” | Each step that checks the user’s real setup (steps 1, 2, 3, and 6) shows a status line that says why it is done, or what action will check it off, so users can verify a checkmark themselves. | In a project without AGENTS.md, step 3 shows “not done yet” and names /init. After /init, it shows “Done” and mentions “AGENTS.md”. | Yes | For any setup, steps 1, 2, 3, and 6 show “✓ Done” with the reason or “○ Not done yet” with what checks it off, matching an independent rule and wording for each step (not the text in the source); step 3 names /init when not done and AGENTS.md when done (model / oracle) | `packages/tui/test/feature-plugins/intro.property.test.ts`: “R3: every verified step's status line matches the user's real setup” | H2, H3 |
| R4 | S-5: “I didn’t even know it was clickable it just looks like a line” | The launch toggle shows its current state (☑ on, ☐ off), includes a hint for how to change it, and highlights when hovered or selected like the other selectable rows. | With auto-launch on, the row reads “☑ Show this when OpenCode starts (enter to toggle)” and highlights when hovered or selected, like other selectable rows. Selecting it changes the row to “☐,” and after a restart the intro does not open automatically. | Yes | From any dialog state and starting setting (on, off, or never saved), toggling the launch row flips ☑/☐ (keeping the “enter to toggle” hint and highlight) and saves only that setting; toggling again restores the screen and all saved settings (round-trip) | `packages/tui/test/feature-plugins/intro.property.test.ts`: “R4: toggling the launch setting twice puts everything back” | H4, H5 |
| R5 | S-12: “There are lots of OpenCode commands, so what are these commands” | The intro gives an optional, non-required way to see every OpenCode command. | Selecting “See every command OpenCode has” opens the command palette. Not selecting it does not affect the completed number of steps. | No | From any dialog state, selecting the commands row opens the command palette and leaves the N/6 and checked steps unchanged (invariant) | `packages/tui/test/feature-plugins/intro.property.test.ts`: “R5: the commands row opens the palette without changing progress” | None (no hand-written mutant targets R5) |

Properties written or suggested by opencode or another AI tool: R1, R2, R3, R4, R5

## Requirement changes

| ID | Original requirement (P3) | Revised requirement | Why it changed |
|---|---|---|---|
| R1 | Intro progress is saved and restored when OpenCode restarts. | Unchanged | Kept because it is feasible (progress is already saved in OpenCode’s local settings) and its acceptance criterion gives a concrete, checkable result: the same 4/6 with the same steps checked after a restart. |
| R2 | Using the intro never creates, edits, or deletes files in the user’s project. | Unchanged | Kept because it is checkable by comparing the project’s files before and after using the intro, and limiting it to the user’s project keeps it compatible with R1 and R4, which save settings outside the project. |
| R3 | Each step’s status line says why it is done, or what action will check it off so users can verify a checkmark themselves. | Each step that checks the user’s real setup (steps 1, 2, 3, and 6) shows a status line that says why it is done, or what action will check it off, so users can verify a checkmark themselves. | The original wording claimed every step has a status line, but steps 4 (Plan/Build) and 5 (Review/Undo) have nothing in the user’s setup to check, so they are checked off when read and have no status line. As written, the requirement was false for two of the six steps. The revision limits it to the steps the intro can actually verify, which still answers C-8, O-7, and S-10: users can follow the instructions themselves and see why a checkmark appeared. |
| R4 | The launch toggle clearly shows it can be selected and what its current state is. | The launch toggle shows its current state (☑ on, ☐ off), includes a hint for how to change it, and highlights when hovered or selected like the other selectable rows. | “Clearly” is too vague to check. The revision names the observable signals that show the row is selectable (a state symbol, a hint for how to change it, and the same highlight as other selectable rows), which still answers S-5’s complaint that the toggle “just looks like a line.” |
| R5 | The intro gives an optional, non-required way to see every OpenCode command. | Unchanged | Kept because it is feasible with the existing command palette and checkable: selecting the row opens the palette, and the done count is the same whether or not it is selected. |

## Hand-written mutants

| ID | Requirement targeted | Change | Predicted killer | Actual result |
|---|---|---|---|---|
| H1 | R1 | intro.tsx: the step the intro opens on by itself is saved as read, so each restart checks off one more step | "Restarting OpenCode restores the same progress" (R1) | Killed by R1: with steps 1–3 done and nothing read, the first launch showed 4/6 and the restart showed 5/6 |
| H2 | R3 | intro.tsx: `isComplete` uses `\|\|` instead of `??`, so opening a verified step marks it done even if the user's setup doesn't match | "Every verified step's status line matches the user's real setup" (R3) | Killed by R3: with nothing set up, opening step 2 showed "✓ Done" |
| H3 | R3 | intro.tsx: step 6 check changed from `sessions > 1` to `sessions >= 1`, so one session already checks it off | "Every verified step's status line matches the user's real setup" (R3) | Killed by R3: with exactly 1 session, step 6 showed "✓ Done" |
| H4 | R4 | intro.tsx: the launch row shows ☐ by default when no setting is saved, while the toggle and auto-launch treat the default as on | None: the tests always save the launch setting, so the default is never used | Survived: every test saves the launch setting, so the wrong default never shows. After strengthening, killed by R4 (see Strengthening) |
| H5 | R4 | intro.tsx: toggling saves to `hide_intro_on_launch` instead of `intro_hide_on_launch`, so the row never flips | "Toggling the launch setting twice puts everything back" (R4); maybe R2 if the random keys select the launch row | Killed by R4: the row stayed ☑ after toggling. R2 did not catch it because its random keys never pressed enter on the launch row |

## Stryker comparison

**Mutation score before strengthening: 57.24%** (83 killed, 62 survived, 0 timeouts, 145 mutants). Run with fast-check seed `42` and `numRuns: 20`, using `packages/tui/stryker.kthaker.config.json`, which runs only `intro.property.test.ts` and mutates only the lines of `intro.tsx` that R1–R4 cover. The final score after strengthening is in the Strengthening section, and `mutants/kthaker/mutation.html` is the report from that final run.

**Which hand-written mutants did Stryker never generate, and why?**

- **H1** (save the auto-opened step as read): Stryker only changes or removes code that already exists. It never adds a new line, and H1 adds a `kv.set` call.
- **H2** (`??` to `||`): Stryker swaps `??` for `&&`, not `||`. The `||` version is the realistic bug, because people mix up `??` and `||`.
- **H5** (setting saved under a misspelled key): Stryker replaces strings with `""`, not with a believable typo. It made the related mutant `kv.set("", ...)`, which was killed.

Stryker did generate the other two exactly. It made H3 (`sessions >= 1` on step 6), which was killed, and H4 (default `false` to `true` on line 234), which also survived.

**Which Stryker survivors would I never have thought of? Are any plausible bugs?**

- **`if (!read().includes(...))` changed to `if (false)`**, so opened steps are never saved as read. This is plausible (a forgotten save), and it is the most important survivor: R1 only checks that progress is the same before and after a restart, so if progress is never saved it is wrongly the same both times.
- **The "N/6 done" count changed to always show 6/6, and "✓" changed to ""**. These survive for the same reason: R1 compares the mutant to itself and never checks that the count is correct.
- **`if (instructions.loading) return` changed to `if (false)`**, so the intro picks its opening step before the AGENTS.md check finishes. This is a plausible race-condition bug.
- **`!isComplete` changed to `isComplete` in `firstUnfinished`, and `Math.max` changed to `Math.min`**, so the intro opens on the wrong step. Both are plausible, and no property checks which step opens first.
- **`.some` changed to `.every` when checking a provider's models**. This is plausible, and it survives only because the generator gives each provider exactly one model.
- **`file.list({ path: "." })` changed to `file.list({})`, and `files?.data` changed to `files.data`**. Both are plausible. They survive because the fixture ignores the path and the generator never makes the file listing fail.
- **Not plausible:** `"Stryker was here"` strings, empty `style={{}}` objects, and an empty toast `variant`. These are noise.

**What does each approach find that the other doesn't?**

- **Hand-written mutants find realistic, multi-step bugs.** They can add new behavior (H1), use the operator a person would actually confuse (H2), and aim at one requirement on purpose. Predicting the result also tested whether I understood my own properties, for example that R2 would miss H5.
- **Stryker finds what I didn't think to check.** It showed that R1 has no oracle for the correct count, that whole branches ("Start over", the question, "Try it", and commands rows) are never checked by any property, and that the generator misses cases (more than one model, a failed file listing). It also creates noise mutants that don't matter, and it can't add new code.

## Strengthening

### What changed

| Change | Requirement | Mutants it killed |
|---|---|---|
| R1 now opens step 4 or 5 before restarting, then checks that step stays checked, that verified steps match the oracle, and that N/6 equals the number of checkmarks | R1 | Read steps never saved (`if (false)`, `[]`), count always 6/6, "✓" removed; also kills H2 and H3 |
| R2 checks that the file listing asks for the project root (`path: "."`) | R2 | `file.list({})`, `path: ""` |
| R3 checks the status line against its own wording instead of the text in `STEPS` | R3 | All 8 `when`/`because` mutants |
| Generator: model costs can be free, paid, missing, or mixed, and the file listing can fail | R1, R3 | `.some` to `.every`, `cost?.` to `cost.`, `files?.data` to `files.data` |
| R4 sometimes starts with the launch setting never saved | R4 | H4, and the same default mutant on the toggle (line 165) |
| New R5 property: the commands row opens the palette without changing progress | R5 | All 3 commands-row mutants (line 161) |
| `numRuns` raised from 20 to 40 (seed still `42`) so rare cases are reached | All | `.every` on models, any-file-counts-as-AGENTS.md |
| Code fix: step 3's "not done" line now names /init ("your project has an AGENTS.md (run /init to create one)"), which the stronger R3 showed was missing | R3 | (real bug found by the property) |

Not killed, because no requirement covers them: which step the intro opens on first, "Start over", the question row, "Try it", collapsing a step, colors, and step numbers.

### Equivalent mutants

| Line | Mutant | Why it is equivalent |
|---|---|---|
| 120 | `files?.data ?? []` changed to `files?.data ?? ["Stryker was here"]` | The fallback is only used when the file listing fails. The next step checks `file.name === "AGENTS.md"`, and a string has no `.name`, so the check is `false` exactly as it is for `[]`. Step 3 stays "not done" either way. |
| 162 | `tryIt?.command ?? ""` changed to `tryIt?.command ?? "Stryker was here!"` | A "Try it" row is only created when the step has a `tryIt`, and every `tryIt` in `STEPS` has a `command`. So the value after `??` is never used, and changing it makes no difference. |
| 162 | `tryIt?.command` changed to `tryIt.command` | For the same reason, `tryIt` is never undefined on a "Try it" row. `?.` and `.` behave the same when the value is always defined. |

### Final mutation score

Run with fast-check seed `42` and `numRuns: 40`.

| | Killed | Survived | Total | Score |
|---|---|---|---|---|
| As Stryker reports it | 110 | 35 | 145 | **75.86%** |
| Equivalent mutants excluded | 110 | 32 | 142 | **77.46%** |

## Agent failure case

**Property:** R3, "every verified step's status line matches the user's real setup", written with opencode.

### opencode transcript

> TODO: paste the opencode prompt and response where R3 was written (a screenshot is fine).
>
> Share link (from `/share`): TODO

### The mutant it let survive

Stryker's `StringLiteral` mutant on step 3: the "done" message is emptied, so the status line no longer says why the step is done or mentions AGENTS.md.

```diff
-      because: "This project already has an AGENTS.md file.",
+      because: "",
```

### Why the property was too weak

It was an **always-passing property**: the assertion restated the implementation. The expected text was built from `STEPS`, which the test imports from the same file it is testing, so when the mutant emptied `because`, the expected text became empty too:

```ts
const verify = STEPS[step].verify!
if (done) expect(text).toContain(`✓ Done. ${verify.because}`)
if (!done) expect(text).toContain(`○ Not done yet. This checks off when ${verify.when}.`)
```

The extra step 3 check did not help either. It searched the whole screen for "AGENTS.md" and "/init", and step 3's body text always contains both words, so it passed no matter what the status line said.

### Strengthened version

The test now finds the status line itself and checks it against its own wording, written in the oracle instead of copied from `STEPS`:

```ts
for (const [step, done, why, todo] of oracle(env)) {
  await expand(intro, step)
  // The status line is checked against our own wording, not the text in STEPS
  const status = statusLine(intro.app.captureCharFrame())
  if (done) expect(status).toStartWith("✓ Done.")
  if (done) expect(status).toContain(why)
  if (!done) expect(status).toStartWith("○ Not done yet.")
  if (!done) expect(status).toContain(todo)
}
```

For step 3, the oracle expects "AGENTS.md" when done and "/init" when not done, which is what R3's acceptance criterion says. This also found a real gap: step 3's "not done" line never mentioned /init, so its text was changed to "your project has an AGENTS.md (run /init to create one)".

### Evidence it kills the mutant

Same mutant, run against both versions of R3 (`bun test test/feature-plugins/intro.property.test.ts -t "R3"`):

| Version | Result |
|---|---|
| Original R3 | 1 pass, 0 fail (mutant survives) |
| Strengthened R3 | 0 pass, 1 fail (mutant killed) |

Output from the strengthened R3:

```
Counterexample: [{"provider":"anthropic","costs":[0],"sessions":1,"files":["AGENTS.md"],"filesFail":false}]
error: expect(received).toContain(expected)
Expected to contain: "AGENTS.md"
Received: "✓ Done."
(fail) R3: every verified step's status line matches the user's real setup
```

In the full Stryker run, all 8 `when`/`because` mutants on steps 1, 2, 3, and 6 survived the original R3 and are killed by the strengthened one.


