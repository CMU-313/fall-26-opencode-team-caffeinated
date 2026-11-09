# Traceability: Sanika Jain (sanikaj)

**Target feature:** Command discovery and command-argument hint extraction in
[`packages/opencode/src/command/index.ts`](../packages/opencode/src/command/index.ts).

## Requirements

| ID | Interview evidence | Requirement | Acceptance Criteria | Changed in P4? | Property (kind) | Test | Mutants it kills |
|---|---|---|---|---|---|---|---|
| R1 | C-2, O-2 | The command service must expose available built-in, configured, MCP, and skill commands with their corresponding metadata. | Given one eligible command from each source, `Command.list()` returns all four commands with the correct names and source values. | No | Command metadata preserves required fields (invariant) | `R1: command metadata preserves its name, source, and description` in `packages/opencode/test/command/command.property.test.ts` | H4 |
| R2 | C-3 | Positional arguments must be substituted into their corresponding placeholders without being dropped or assigned to the wrong placeholder. | Given a template containing `$1` and `$2`, invoking the command with two arguments substitutes the first argument into `$1` and the second into `$2`. | No | Positional substitution agrees with the expected model (model/oracle) | `R2: positional arguments are not dropped or reordered` in `packages/opencode/test/command/command.property.test.ts` | H1 |
| R3 | C-5, O-5 | Argument hint extraction must depend on placeholders rather than unrelated text in the command template. | Two templates containing the same placeholders but different non-argument words produce identical argument hint arrays. | No | Unrelated text leaves hints unchanged (metamorphic) | `R3: unrelated template text does not change hints` in `packages/opencode/test/command/command.property.test.ts` | None initially |
| R4 | C-6, O-7 | Each listed command should have metadata consistent with the configured command, including its description and source. | Given a configured command with a known name and description, the command returns those values. | No | Configured metadata survives schema round-trip (round-trip) | `R4: configured descriptions remain consistent with command metadata` in `packages/opencode/test/command/command.property.test.ts` | None initially |
| R5 | S-5 | Users should be able to pin up to three commands and sort pinned commands before unpinned commands alphabetically. | Given a visible command list, pinning up to three commands places pinned commands first and sorts each group alphabetically. | Yes | Not tested: this P3 requirement requires a new persistence and UI design outside the existing command service. | — | None |

Properties written or suggested by opencode or another AI tool: R1, R2, R3, and R4 were drafted with AI assistance and reviewed against the interview evidence and implementation.

## Requirement changes

| ID | Original requirement (P3) | Revised requirement | Why it changed |
|---|---|---|---|
| R5 | The command list should be customizable so users can pin up to three commands, sorting pinned commands first and then alphabetically. | The command discovery service will expose available commands and metadata; command pinning is deferred until a persistence and UI design is specified. | The existing target feature has no pin state, storage boundary, or ordering UI, so the original requirement cannot be implemented or checked without expanding scope beyond command discovery. |

## Hand-written mutants

These predictions were recorded before applying the patches or running Stryker.

| ID | Requirement targeted | Change | Predicted killer | Actual result |
|---|---|---|---|---|
| H1 | R2 | Change the positional argument index from `position - 1` to `position`. | R2 positional-substitution property, because `$1` would receive the second generated token. | Pending |
| H2 | R2 | Make the final placeholder consume only one token instead of all remaining tokens. | None initially; the current generator supplies exactly two arguments. | Pending |
| H3 | R3 | Remove deduplication from extracted numbered hints. | None initially; the current generator uses each placeholder once. | Pending |
| H4 | R1 | Omit `source: "command"` from configured command metadata. | R1 metadata property, because generated command metadata would no longer preserve the source. | Pending |
| H5 | R2 | Stop appending raw input when a template has no placeholders. | None initially; the current property only exercises numbered placeholders. | Pending |

## Stryker comparison

Pending the dependency update and mutation run.
