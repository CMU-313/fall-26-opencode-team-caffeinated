# Traceability: Khushi Thaker (kthaker)

**Target feature:** Intro to OpenCode feature, which lives in `packages/tui/src/feature-plugins/home/intro.tsx` (registered as a built-in plugin in `packages/tui/src/feature-plugins/builtins.ts`)

## Requirements

| ID | Interview evidence | Requirement | Acceptance Criteria | Changed in P4? | Property (kind) | Test | Mutants it kills |
|---|---|---|---|---|---|---|---|
| R1 | C-7, O-5: “If it showed 4/6 the first time…it should still show 4/6” | Intro progress is saved and restored when OpenCode restarts. | With the intro at 4/6, restarting OpenCode with no other changes still shows 4/6 with the same steps checked. | No | Restarting OpenCode with the intro's saved settings shows the same N/6 and the same checked steps, for any setup, earlier progress, and use of the dialog; a step the user opened stays checked, verified steps match an independent rule, and N/6 equals the number of checkmarks (round-trip + oracle) | `packages/tui/test/feature-plugins/intro.property.test.ts`: “R1: restarting OpenCode restores the same progress” | H1, H2, H3 |
| R2 | C-4, O-3: “I wouldn’t expect it to change the files in the codebase” | Using the intro never creates, edits, or deletes files in the user’s project. | After selecting every row in the intro, except “Try It”, the project’s files and their contents are unchanged. | No | For any setup and any use of the dialog except “Try it”, every server call the intro makes is the read-only file listing of the project root, and it saves only its own `intro_` settings (invariant) | `packages/tui/test/feature-plugins/intro.property.test.ts`: “R2: using the intro only reads the project and only saves its own settings” | None |
| R3 | C-8, O-7, S-10: “I would check … by manually following the instructions” | Each step that checks the user’s real setup (steps 1, 2, 3, and 6) shows a status line that says why it is done, or what action will check it off, so users can verify a checkmark themselves. | In a project without AGENTS.md, step 3 shows “not done yet” and names /init. After /init, it shows “Done” and mentions “AGENTS.md”. | Yes | For any setup, steps 1, 2, 3, and 6 show “✓ Done” with the reason or “○ Not done yet” with what checks it off, matching an independent rule and wording for each step (not the text in the source); step 3 names /init when not done and AGENTS.md when done (model / oracle) | `packages/tui/test/feature-plugins/intro.property.test.ts`: “R3: every verified step's status line matches the user's real setup” | H2, H3 |
| R4 | S-5: “I didn’t even know it was clickable it just looks like a line” | The launch toggle shows its current state (☑ on, ☐ off), includes a hint for how to change it, and highlights when hovered or selected like the other selectable rows. | With auto-launch on, the row reads “☑ Show this when OpenCode starts (enter to toggle)” and highlights when hovered or selected, like other selectable rows. Selecting it changes the row to “☐,” and after a restart the intro does not open automatically. | Yes | From any dialog state and starting setting (on, off, or never saved), toggling the launch row flips ☑/☐ (keeping the “enter to toggle” hint and highlight) and saves only that setting; toggling again restores the screen and all saved settings (round-trip) | `packages/tui/test/feature-plugins/intro.property.test.ts`: “R4: toggling the launch setting twice puts everything back” | H4, H5 |
| R5 | S-12: “There are lots of OpenCode commands, so what are these commands” | The intro gives an optional, non-required way to see every OpenCode command. | Selecting “See every command OpenCode has” opens the command palette. Not selecting it does not affect the completed number of steps. | No | From any dialog state, selecting the commands row opens the command palette and leaves the N/6 and checked steps unchanged (invariant) | `packages/tui/test/feature-plugins/intro.property.test.ts`: “R5: the commands row opens the palette without changing progress” | None |

Properties written/suggested by another AI tool: R1, R2, R3, R4, R5

Property written by opencode: an extra R1 property in `packages/tui/test/feature-plugins/intro.opencode.property.test.ts` (see Agent failure case)

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

**Mutation score before strengthening: 57.24%** (83 killed, 62 survived, 0 timeouts, 145 mutants). Run with fast-check seed `42` and `numRuns: 20`, using `packages/tui/stryker.kthaker.config.json`, which runs only `intro.property.test.ts` and mutates only the lines of `intro.tsx` that my requirements cover. The final score after strengthening is in the Strengthening section, and `mutants/kthaker/mutation.html` is the report from that final run.

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

The other 32 survivors change things no requirement covers: which step the intro opens on first (lines 101, 131, 134), "Start over" (167–177), the question row (163, 166), "Try it" (162), collapsing a step (180), selecting a clicked row without hovering first (160), a duplicate step number in the saved read list (183), colors (211, 270), and step numbers (271).

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

**Property:** a new R1 property written by opencode, in `packages/tui/test/feature-plugins/intro.opencode.property.test.ts` ("R1: restarting OpenCode at 4/6 restores the same progress"). None of my existing properties came from opencode, so I asked it to write one for R1.

### opencode transcript

Share link (from `/share`): https://opncd.ai/share/8YALrKZZ

**My prompt:**

> I'm working on the "Intro to OpenCode" feature in packages/tui/src/feature-plugins/home/intro.tsx. There is a test fixture in packages/tui/test/fixture/intro.tsx (renderIntro) that renders the intro with a fake settings store, a fake setup (provider, sessions, files), and a `stored` option to simulate settings saved by an earlier run.
>
> Write a fast-check property-based test for this requirement:
>
> R1: Intro progress is saved and restored when OpenCode restarts.
> Acceptance criterion: with the intro at 4/6, restarting OpenCode with no other changes still shows 4/6 with the same steps checked.
>
> Put it in a new file: packages/tui/test/feature-plugins/intro.opencode.property.test.ts. Use bun:test and fast-check (already installed), use { numRuns: 40, seed: 42 }, and make sure it passes when run from packages/tui with: bun test test/feature-plugins/intro.opencode.property.test.ts. Don't modify any existing files.

**opencode's plan (excerpt):**

> 1. Generators that hold the intro at exactly 4/6:
>    - provider: undefined or "opencode" (no connected provider → step 0 undone)
>    - costs: [0] (free models → step 0 stays undone even for opencode)
>    - sessions: 1 (step 1 done; step 5 needs >1, so undone)
>    - files: one of ["AGENTS.md"], ["AGENTS.md", "README.md"], ["AGENTS.md", "src"] (step 2 done via AGENTS.md)
> 2. Per run: … Click step 3 ("Plan first, then build") and step 4 ("Review and undo") titles → both added to intro_read → now 4/6 done. Capture before …, assert before.done === "4". … Re-render with stored: saved (simulated restart). Capture after, assert after deep-equals before.
>
> One design note: I chose not to vary sessions beyond 1 because any other value changes the done count (0 → 3/6, 2 → 5/6), which would violate the fixed "4/6" acceptance criterion.

**opencode's generator and property (excerpt from the file it wrote):**

```ts
const setup = fc.record({
  provider: fc.constantFrom(undefined, "opencode"),
  costs: fc.constant([0]),
  sessions: fc.constant(1),
  files: fc.oneof(
    fc.constant(["AGENTS.md"]),
    fc.constant(["AGENTS.md", "README.md"]),
    fc.constant(["AGENTS.md", "src"]),
  ),
})
...
// Read steps 3 ("Plan first, then build") and 4 ("Review and undo") to reach 4/6
await click(first.app, STEPS[3].title)
await click(first.app, STEPS[4].title)
const before = progressShown(first.app.captureCharFrame())
expect(before.done).toBe("4")
...
expect(after).toEqual(before)
```

**opencode's result:** "Done. Created packages/tui/test/feature-plugins/intro.opencode.property.test.ts and verified it passes (1 pass, 160 expect() calls, ~5s)."

### The mutant it let survive

**H1** (targets R1): the step the intro opens on by itself is saved as read, so each restart checks off one more step.

```diff
-    untrack(() => setExpanded(firstUnfinished(progress(), read())))
+    untrack(() => {
+      const step = firstUnfinished(progress(), read())
+      setExpanded(step)
+      if (!read().includes(step)) props.api.kv.set("intro_read", [...read(), step])
+    })
```

Results of all my hand-written mutants against opencode's property:

| Mutant | Requirement | Result |
|---|---|---|
| H1 | R1 | **Survived** |
| H2 | R3 | Survived |
| H3 | R3 | Killed |
| H4 | R4 | Survived |
| H5 | R4 | Survived |

H1 is the failure case: it targets R1, the requirement opencode was asked to test. (H2, H4, and H5 target other requirements, so it is expected that an R1 property misses them.)

### Why the property was too weak

It was a **generator that never reaches the bug**. To keep the intro at exactly 4/6, opencode fixed the setup so a provider is never connected. That means step 1 is always unfinished, so the step the intro opens on by itself is always step 1. Step 1 is a verified step, and marking a verified step as read changes nothing, so H1 has no visible effect. H1 only shows up when the intro opens on step 4 or 5 (the steps that are checked off by reading), which needs steps 1–3 to be done first, and opencode's generator never produces that setup.

### Strengthened version

I added a second setup where steps 1–3 are already done (a connected provider, one session, and AGENTS.md or CLAUDE.md). The intro then opens on step 4 by itself, and the user reads only step 5 to reach 4/6. Each setup lists the steps to click in `toRead`:

```ts
const setup = fc.oneof(
  fc.record({
    provider: fc.constantFrom(undefined, "opencode"),
    costs: fc.constant<number[]>([0]),
    sessions: fc.constant(1),
    files: fc.constantFrom<string[]>(["AGENTS.md"], ["AGENTS.md", "README.md"], ["AGENTS.md", "src"]),
    toRead: fc.constant([3, 4]),
  }),
  fc.record({
    provider: fc.constant("anthropic"),
    costs: fc.constant<number[]>([0]),
    sessions: fc.constant(1),
    files: fc.constantFrom<string[]>(["AGENTS.md"], ["CLAUDE.md"]),
    toRead: fc.constant([4]),
  }),
)
...
// Read the steps needed to reach 4/6
for (const step of env.toRead) await click(first.app, STEPS[step].title)
```

The assertions are unchanged. The acceptance criterion still holds (4/6 before and after a restart), but now the intro can open on a step that is checked off by reading.

### Evidence it kills the mutant

H1 run against both versions (`bun test test/feature-plugins/intro.opencode.property.test.ts`):

| Version | Real code | With H1 |
|---|---|---|
| opencode's original | 1 pass | 1 pass (mutant survives) |
| Strengthened | 1 pass | 0 pass, 1 fail (mutant killed) |

Output from the strengthened property with H1 applied:

```
Counterexample: [{"provider":"anthropic","costs":[0],"sessions":1,"files":["AGENTS.md"],"toRead":[4]}]
Expected: "4"
Received: "5"
(fail) R1: restarting OpenCode at 4/6 restores the same progress
```

With steps 1–3 done, the mutant saved the auto-opened step 4 as read, so the intro showed 5/6 instead of 4/6.
