# Traceability: Sanika Jain (sanikaj)

**Target feature:** Command discovery and command-argument hint extraction in
[`packages/opencode/src/command/index.ts`](../packages/opencode/src/command/index.ts).

## Requirements

| ID | Interview evidence | Requirement | Acceptance Criteria | Changed in P4? | Property (kind) | Test | Mutants it kills |
|---|---|---|---|---|---|---|---|
| R1 | C-2, O-2 | The command service must expose available built-in, configured, MCP, and skill commands with their corresponding metadata. | Given one eligible command from each source, `Command.list()` returns all four commands with the correct names and source values. | No | Command metadata preserves required fields (invariant) | `R1: command metadata preserves its name, source, and description` in `packages/opencode/test/command/command.property.test.ts` | H4 |
| R2 | C-3 | Positional arguments must be substituted into their corresponding placeholders without being dropped or assigned to the wrong placeholder. | Given a template containing `$1` and `$2`, invoking the command with two arguments substitutes the first argument into `$1` and the second into `$2`. Extra arguments belong to the final placeholder; input is preserved when a template has no placeholders. | No | Positional substitution agrees with the expected model (model/oracle) | `R2: positional arguments are not dropped or reordered` in `packages/opencode/test/command/command.property.test.ts` | H1, H2, H5 |
| R3 | C-5, O-5 | Argument hint extraction must depend on placeholders rather than unrelated text in the command template. | Two templates containing the same placeholders but different non-argument words produce identical argument hint arrays, with each placeholder listed once. | No | Unrelated text leaves hints unchanged (metamorphic) | `R3: unrelated template text does not change hints` in `packages/opencode/test/command/command.property.test.ts` | H3 |
| R4 | C-6, O-7 | Each listed command should have metadata consistent with the configured command, including its description and source. | Given a configured command with a known name and description, the command returns those values. | No | Configured metadata survives schema round-trip (round-trip) | `R4: configured descriptions remain consistent with command metadata` in `packages/opencode/test/command/command.property.test.ts` | H4 |
| R5 | S-5 | Users should be able to pin up to three commands and sort pinned commands before unpinned commands alphabetically. | Given a visible command list, pinning up to three commands places pinned commands first and sorts each group alphabetically. | Yes | Not tested: this P3 requirement requires a new persistence and UI design outside the existing command service. | — | None |

Properties written or suggested by opencode or another AI tool: R1, R2, R3, and R4 were drafted with AI assistance and reviewed against the interview evidence and implementation. The fixed fast-check seed is `42`.

## Requirement changes

| ID | Original requirement (P3) | Revised requirement | Why it changed |
|---|---|---|---|
| R5 | The command list should be customizable so users can pin up to three commands, sorting pinned commands first and then alphabetically. | The command discovery service will expose available commands and metadata; command pinning is deferred until a persistence and UI design is specified. | The existing target feature has no pin state, storage boundary, or ordering UI, so the original requirement cannot be implemented or checked without expanding scope beyond command discovery. |

## Hand-written mutants

These predictions were recorded before applying the patches or running Stryker.

| ID | Requirement targeted | Change | Predicted killer | Actual result |
|---|---|---|---|---|
| H1 | R2 | Change the positional argument index from `position - 1` to `position`. | R2 positional-substitution property, because `$1` would receive the second generated token. | Killed by R2 after 1,000 seeded cases. |
| H2 | R2 | Make the final placeholder consume only one token instead of all remaining tokens. | Initially predicted to survive; after strengthening R2 with 2–5 generated tokens, it is killed. | Killed by strengthened R2. |
| H3 | R3 | Remove deduplication from extracted numbered hints. | Initially predicted to survive; after generating duplicate `$1` placeholders, it is killed. | Killed by strengthened R3. |
| H4 | R4 | Omit `source: "command"` from configured command metadata. | Initially predicted to survive because the property only constructed `Command.Info`; after testing `Command.configured`, it is killed. | Killed by strengthened R4. |
| H5 | R2 | Stop appending raw input when a template has no placeholders. | Initially predicted to survive; after adding a no-placeholder generated case, it is killed. | Killed by strengthened R2. |

## Stryker comparison

Stryker configuration: `packages/opencode/stryker.sanikaj.config.json`. The fixed
fast-check seed was `42`.

The mutation run is pending.

## Agent failure case

The initial property suggested by opencode for R2 generated exactly two
arguments and tested only `first=$1 second=$2`:

> `fc.property(first, second, (first, second) => { const result = Command.resolve("first=$1 second=$2", \`${first} ${second}\`); expect(result).toBe(\`first=${first} second=${second}\`) })`

That weak property let H2 survive because a final placeholder that consumes one
token behaves identically when only two tokens are generated. It also did not
exercise R2's no-placeholder fallback, so H5 survived. The strengthened R2
property generates 2–5 tokens, checks that the final placeholder joins all
remaining tokens, and separately checks generated no-placeholder templates;
the rerun killed both H2 and H5.
