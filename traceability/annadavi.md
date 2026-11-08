# Traceability: Anna David (annadavi)

**Target feature:** Aggregate Statistics

Main implementation: [packages/opencode/src/cli/cmd/stats.ts](../packages/opencode/src/cli/cmd/stats.ts)

Wiring into CLI: [packages/opencode/src/index.ts](../packages/opencode/src/index.ts)

Data Access: [packages/opencode/src/session/session.ts](../packages/opencode/src/session/session.ts), [packages/core/src/session/sql.ts](../packages/core/src/session/sql.ts)


## Requirements

| ID | Interview evidence | Requirement | Acceptance Criteria | Changed in P4? | Property (kind) | Test | Mutants it kills |
|---|---|---|---|---|---|---|---|
| R1 | S-10: “Well, so, you know, like, your usage across, like, all models, so that should always, like, stay the same.”, O-10: “No, [the cost and token values and overview values don’t change]” | The overview statistics should be the same regardless of which flags are passed. | If stats is run with no flags, then with –models 5, the total session and message count at in the top overview box should remain the same. | No | Invariant | [Line 190](../packages/opencode/test/aggregate-statistics/aggregate-statistics.property.test.ts#190) | H1 |
| R2 | S-3: “discrepancies with, like, their, like, credit card charges, that might be, like, a huge issue”, C-8: “I would absolutely not want the number of tokens I've used to be incorrect in any way”, O-3: “token usage slash cost [should be correct]” | Total cost/token use should never be over-reported, even temporarily. | In between a prompt being sent and a response being returned, the total cost/tokens should only include up until the previous message. It should not try to estimate the cost/tokens of the current (in progress) message. | Yes | None | None | No test in this suite |
| R3 | O-6: “I still want to know. So, like, I ran the session, all that data, about usage, for that session, remains in the output.”, C-12: “if I delete the session, well, I would assume that my tokens are still accurately updated, because, like, I don't think... You can get back the two things that you've already used.”, S-6: “Um, maybe they're gonna be like separate, like, deleted, like, sessions, dats or something, but, like, to me, like, these numbers should always be there.” | If a session is deleted, the token count/cost from it should still be reported. | If the token count is x, then a session is created such that the token count becomes x+y, then that session is deleted, the reported token count should remain x+y. | No | Invariant | [Line 257](../packages/opencode/test/aggregate-statistics/aggregate-statistics.property.test.ts#257) | H2 |
| R4 | S-8: “the top 3 [models] of the top 5 should be the same as the top 3”, O-9: “Well, the first three, I'm assuming, the first three outputted for the five. List of five will be the same as the ones that were listed for the list of three.” | Models should be reported in descending order by message count, consistently across model limits. | If stats are run with –models 3 then –models 5, both lists rank models by descending message count, and the first 3 models and associated stats are identical in both. | No | Metamorphic | [Line 417](../packages/opencode/test/aggregate-statistics/aggregate-statistics.property.test.ts#417) | H3, H5 |
| R5 | O-13: “Well, if you have, you have the number of messages and the number of sessions. You know, like, if that's increasing, you're good there.”, S-6 “the message count should never go down” | Token/message count should never decrease. | If token count is recorded at any 2 points in time, it should have stayed the same or increased, regardless of what was done during that time (multiple sessions, 1 sessions, no sessions, deleted a session, deleted a message, etc.). | No | Invariant | [Line 514](../packages/opencode/test/aggregate-statistics/aggregate-statistics.property.test.ts#514) | H4 |
| R6 | CLI `--days` option | Statistics for a requested time window should exclude older ledger activity. | With `--days 1`, older message and usage rows are excluded while recent message, cost, and token rows remain included. | No | Invariant | [Line 326](../packages/opencode/test/aggregate-statistics/aggregate-statistics.property.test.ts#326) | Added to kill Stryker mutants, after hand-written mutants, so no hand-written mutant created. The Stryker result is suite-wide, not directly attributable to this property |

Properties written or suggested by opencode or another AI tool: R1, R3, R4, R5, R6

## Requirement changes

| ID | Original requirement (P3) | Revised requirement | Why it changed |
|---|---|---|---|
| R2 | Total cost/token use should never be over-reported, even temporarily. | Cost and token use for a message should be added to the total cost and total token use exactly once, after the response is returned in full. | The original requirement was too vague. Over-reported temporarily is difficult to test, but testing that there is exactly one database update that occurs after the response finishes is easier. |

## Hand-written mutants
| ID | Requirement targeted | Change | Predicted killer | Actual result
|---|---|---|---|---|
| H1 | R1 | Change the Sessions row in `displayStats` from `stats.totalSessions.toLocaleString()` to `(modelLimit === undefined ? stats.totalSessions : Object.keys(stats.modelUsage).length).toLocaleString()` | "keeps overview counts unchanged when model and tool flags are passed" (R1) | Killed by R1 |
| H2 | R3 | projectId !== undefined became projectId == undefined | "retains token and cost totals after deleting a session" (R3) | Killed by R3 |
| H3 | R4 | Change `Object.entries(stats.modelUsage).sort(([, a], [, b]) => b.messages - a.messages)` to `Object.entries(stats.modelUsage).slice(0, modelLimit).sort(([, a], [, b]) => b.messages - a.messages)` | "displays ranked top models and preserves their prefix when increasing the limit" (R4) | Killed by R4 |
| H4 | R5 | Change `stats.totalMessages = messageRows.length` to `stats.totalMessages = messageRows.filter((message) => filteredSessions.some((session) => session.id === message.session_id)).length` | "never decreases token or message totals as sessions and messages are deleted" (R5) | Killed by R5 |
| H5 | R4 | Change `sortedModels.slice(0, modelLimit)` to `sortedModels.slice(-modelLimit)` | "displays ranked top models and preserves their prefix when increasing the limit" (R4) | Killed by R4 |

## Stryker Comparison
*Which of your hand-written mutants did Stryker never generate? Why not?*

None of my mutants were generated by Stryker. Some had related effects, but none of them were the exact same change, because each of the hand-written mutants had a specific change, and each of the 31 Stryker mutants had specific changes, and they did not happen to be the same due to the probability of an exact change being made. This was also affected by the type of mutants I wrote compared to those Stryker makes. I also wrote my mutants to specifically target my requirements, while the Stryker mutants just change relevant lines or code, but not necessarily in a way that affects the requirement.


*Which Stryker survivors would you never have thought of? Are any of them bugs a real developer might plausibly write?*

One mutant just did not slice the model list, which is a reasonable bug for a developer to write, but I did not think of it. One switched the displayed models to show all models when infinity was passed, and slice otherwise, which should have caused an error when slicing with Infinity, but didn't since I didn't think about that case so none of my generators generated infinity. Another did not sort the models at all, which could be reasonably written by a developer but I did not consider.


*What does each approach find that the other doesn't?*

Hand-written mutants were more targeted for my requirements, so it worked better for confirming that my tests actually checked the requirements I intended them to in the way that I wanted. In contrast, the Stryker mutants were more exhaustive and were better able to identify gaps in my tests as well as both inputs and bugs I had not considered. Overall, the hand-written mutants were more tailored to what I wanted to verify, while the Stryker mutants were more general and less biased.


## Strengthening
*Equivalent mutants*

The prior run had 5 equivalent survivors: two variants each at the message and usage `.where(and(...))` conditions, plus one model-limit ternary variant. These were removed by simplifying both `.where` conditions to `.where(and(...conditions))` and the model-limit expression to `sortedModels.slice(0, modelLimit)`. The subsequent Stryker run generated 20 mutants and all were killed, with no equivalent survivors.

*Final mutation score*

Latest reported Stryker run: 20 of 20 mutants killed, 0 survived, and 0 timeouts. Mutation score: 100%.
Equivalent mutants excluded: still 20/20, 100%, since no equivalent mutants.


## Agent failure case

The original R5 property did not exercise every token category. Stryker exposed this gap with an output-token mutant:

- **Transcript excerpt — prompt:**
  > Add a test for requirement 5

- **Transcript excerpt — response:**
  > I’ll add a sequence-based property that records aggregate token and message counts after generated session/message operations, including deletion, and checks neither total ever drops.
  >
  > Added an R5 fast-check invariant to `aggregate-statistics.property.test.ts`. It generates zero or more sessions with positive token usage and varying message counts, then checks that aggregate token and message totals never decrease after creating sessions/messages, removing messages, or deleting sessions.

- **Mutant that survived:** `stats.totalTokens.output += usage.tokens_output` → `stats.totalTokens.output -= usage.tokens_output` at `stats.ts:213`.
- **Why the property was too weak:** The original generator produced one scalar token value, and the test helper recorded it only as input tokens. Output, reasoning, and cache tokens were always zero. Subtracting zero did not change the aggregate, so the property could not detect the defect.
- **Strengthened version:** Generate positive values independently for input, output, reasoning, cache-read, and cache-write tokens. In R3, assert each aggregate category increases by the generated total before deletion and remains unchanged after deletion. In R5, assert each category is individually monotonic through the generated create/delete sequence.
- **Evidence:** In the previous Stryker run, the output-token subtraction mutant was reported as `Killed` at `stats.ts:213` after strengthening R3/R5 to generate and assert each token category independently. In the latest reported run, Stryker killed all 20 generated mutants with no survivors or timeouts. The focused aggregate-statistics suite passed all 5 tests.