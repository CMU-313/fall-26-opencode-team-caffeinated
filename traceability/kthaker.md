# Traceability: Khushi Thaker (kthaker)

**Target feature:** Intro to OpenCode feature, which lives in `packages/tui/src/feature-plugins/home/intro.tsx` (registered as a built-in plugin in `packages/tui/src/feature-plugins/builtins.ts`)

## Requirements

| ID | Interview evidence | Requirement | Acceptance Criteria | Changed in P4? | Property (kind) | Test |
|---|---|---|---|---|---|---|
| R1 | C-7, O-5: “If it showed 4/6 the first time…it should still show 4/6” | Intro progress is saved and restored when OpenCode restarts. | With the intro at 4/6, restarting OpenCode with no other changes still shows 4/6 with the same steps checked. | No | | |
| R2 | C-4, O-3: “I wouldn’t expect it to change the files in the codebase” | Using the intro never creates, edits, or deletes files in the user’s project. | After selecting every row in the intro, except “Try It”, the project’s files and their contents are unchanged. | No | | |
| R3 | C-8, O-7, S-10: “I would check … by manually following the instructions” | Each step that checks the user’s real setup (steps 1, 2, 3, and 6) shows a status line that says why it is done, or what action will check it off, so users can verify a checkmark themselves. | In a project without AGENTS.md, step 3 shows “not done yet” and names /init. After /init, it shows “Done” and mentions “AGENTS.md”. | Yes | | |
| R4 | S-5: “I didn’t even know it was clickable it just looks like a line” | The launch toggle shows its current state (☑ on, ☐ off), includes a hint for how to change it, and highlights when hovered or selected like the other selectable rows. | With auto-launch on, the row reads “☑ Show this when OpenCode starts (enter to toggle)” and highlights when hovered or selected, like other selectable rows. Selecting it changes the row to “☐,” and after a restart the intro does not open automatically. | Yes | | |
| R5 | S-12: “There are lots of OpenCode commands, so what are these commands” | The intro gives an optional, non-required way to see every OpenCode command. | Selecting “See every command OpenCode has” opens the command palette. Not selecting it does not affect the completed number of steps. | No | | |

Properties written or suggested by opencode or another AI tool: <list by requirement ID, or "none">

## Requirement changes

| ID | Original requirement (P3) | Revised requirement | Why it changed |
|---|---|---|---|
| R1 | Intro progress is saved and restored when OpenCode restarts. | Unchanged | Kept because it is feasible (progress is already saved in OpenCode’s local settings) and its acceptance criterion gives a concrete, checkable result: the same 4/6 with the same steps checked after a restart. |
| R2 | Using the intro never creates, edits, or deletes files in the user’s project. | Unchanged | Kept because it is checkable by comparing the project’s files before and after using the intro, and limiting it to the user’s project keeps it compatible with R1 and R4, which save settings outside the project. |
| R3 | Each step’s status line says why it is done, or what action will check it off so users can verify a checkmark themselves. | Each step that checks the user’s real setup (steps 1, 2, 3, and 6) shows a status line that says why it is done, or what action will check it off, so users can verify a checkmark themselves. | The original wording claimed every step has a status line, but steps 4 (Plan/Build) and 5 (Review/Undo) have nothing in the user’s setup to check, so they are checked off when read and have no status line. As written, the requirement was false for two of the six steps. The revision limits it to the steps the intro can actually verify, which still answers C-8, O-7, and S-10: users can follow the instructions themselves and see why a checkmark appeared. |
| R4 | The launch toggle clearly shows it can be selected and what its current state is. | The launch toggle shows its current state (☑ on, ☐ off), includes a hint for how to change it, and highlights when hovered or selected like the other selectable rows. | “Clearly” is too vague to check. The revision names the observable signals that show the row is selectable (a state symbol, a hint for how to change it, and the same highlight as other selectable rows), which still answers S-5’s complaint that the toggle “just looks like a line.” |
| R5 | The intro gives an optional, non-required way to see every OpenCode command. | Unchanged | Kept because it is feasible with the existing command palette and checkable: selecting the row opens the palette, and the done count is the same whether or not it is selected. |