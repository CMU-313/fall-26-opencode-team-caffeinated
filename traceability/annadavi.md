# Traceability: Anna David (annadavi)

**Target feature:** Aggregate Statistics

Main implementation: [packages/opencode/src/cli/cmd/stats.ts](../packages/opencode/src/cli/cmd/stats.ts)

Wiring into CLI: [packages/opencode/src/index.ts](../packages/opencode/src/index.ts)

Data Access: [packages/opencode/src/session/session.ts](../packages/opencode/src/session/session.ts), [packages/opencode/src/session/sql.ts](../packages/opencode/src/session/sql.ts)


## Requirements

| ID | Interview evidence | Requirement | Acceptance Criteria | Changed in P4? | Property (kind) | Test |
|---|---|---|---|---|---|---|
| R1 | S-10: “Well, so, you know, like, your usage across, like, all models, so that should always, like, stay the same.”, O-10: “No, [the cost and token values and overview values don’t change]” | The overview statistics should be the same regardless of which flags are passed. | If stats is run with no flags, then with –models 5, the total session and message count at in the top overview box should remain the same. | No | Invariant | [Line 133](../packages/opencode/test/aggregate-statistics/aggregate-statistics.property.test.ts#133) |
| R2 | S-3: “discrepancies with, like, their, like, credit card charges, that might be, like, a huge issue”, C-8: “I would absolutely not want the number of tokens I've used to be incorrect in any way”, O-3: “token usage slash cost [should be correct]” | Total cost/token use should never be over-reported, even temporarily. | In between a prompt being sent and a response being returned, the total cost/tokens should only include up until the previous message. It should not try to estimate the cost/tokens of the current (in progress) message. | Yes | None | None |
| R3 | O-6: “I still want to know. So, like, I ran the session, all that data, about usage, for that session, remains in the output.”, C-12: “if I delete the session, well, I would assume that my tokens are still accurately updated, because, like, I don't think... You can get back the two things that you've already used.”, S-6: “Um, maybe they're gonna be like separate, like, deleted, like, sessions, dats or something, but, like, to me, like, these numbers should always be there.” | If a session is deleted, the token count/cost from it should still be reported. | If the token count is x, then a session is created such that the token count becomes x+y, then that session is deleted, the reported token count should remain x+y. | No | Invariant | [Line 194](../packages/opencode/test/aggregate-statistics/aggregate-statistics.property.test.ts#194) |
| R4 | S-8: “the top 3 [models] of the top 5 should be the same as the top 3”, O-9: “Well, the first three, I'm assuming, the first three outputted for the five. List of five will be the same as the ones that were listed for the list of three.” | The order of reported models should be consistent. | If stats are run with –models 3 then –models 5, the first 3 models and associated stats are identical in both. | No | Metamorphic | [Line 237](../packages/opencode/test/aggregate-statistics/aggregate-statistics.property.test.ts#237) |
| R5 | O-13: “Well, if you have, you have the number of messages and the number of sessions. You know, like, if that's increasing, you're good there.”, S-6 “the message count should never go down” | Token/message count should never decrease. | If token count is recorded at any 2 points in time, it should have stayed the same or increased, regardless of what was done during that time (multiple sessions, 1 sessions, no sessions, deleted a session, deleted a message, etc.). | No | Invariant | [Line 303](../packages/opencode/test/aggregate-statistics/aggregate-statistics.property.test.ts#303) |

Properties written or suggested by opencode or another AI tool: R1, R3, R4, R5

## Requirement changes

| ID | Original requirement (P3) | Revised requirement | Why it changed |
|---|---|---|---|
| R2 | Total cost/token use should never be over-reported, even temporarily. | Cost and token use for a message should be added to the total cost and total token use exactly once, after the response is returned in full. | The original requirement was too vague. Over-reported temporarily is difficult to test, but testing that there is exactly one database update that occurs after the response finishes is easier. |