import { describe, expect, spyOn, test } from "bun:test"
import { array, assert, asyncProperty, constant, integer, oneof, record, property } from "fast-check"
import { Effect, Layer } from "effect"
import { inArray } from "drizzle-orm"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { Database } from "@opencode-ai/core/database/database"
import { SessionProjector } from "@opencode-ai/core/session/projector"
import { SessionUsageLedgerTable } from "@opencode-ai/core/session/sql"
import { ModelV2 } from "@opencode-ai/core/model"
import { ProviderV2 } from "@opencode-ai/core/provider"
import { InstanceStore } from "@/project/instance-store"
import { InstanceBootstrap } from "@/project/bootstrap"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { EventV2Bridge } from "@/event-v2-bridge"
import { Session } from "@/session/session"
import { MessageID, PartID, type SessionID } from "@/session/schema"
import { SessionV1 } from "@opencode-ai/core/v1/session"
import { testEffect } from "../lib/effect"
import { aggregateSessionStats, displayStats } from "@/cli/cmd/stats"

// R1: Generate overview counts, models, and tools alongside optional display
// limits so both absent and present --models/--tools flags are exercised.
// The same model data feeds the R4 ordering property below.
const modelUsageArbitrary = record({
  messages: integer({ min: 0, max: 10 }),
  inputTokens: integer({ min: 0, max: 100_000 }),
  outputTokens: integer({ min: 0, max: 100_000 }),
  cacheReadTokens: integer({ min: 0, max: 100_000 }),
  cacheWriteTokens: integer({ min: 0, max: 100_000 }),
  costCents: integer({ min: 0, max: 100_000 }),
})

// R1: Pair generated overview totals with generated model/tool data and flag
// options so the same stats can be rendered with and without those options.
const overviewFlagsArbitrary = record({
  totalSessions: integer({ min: 0, max: 1_000 }),
  totalMessages: integer({ min: 0, max: 10_000 }),
  models: array(modelUsageArbitrary, { minLength: 2, maxLength: 10 }),
  tools: array(integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 6 }),
  toolLimit: oneof(constant(undefined), integer({ min: 0, max: 10 })),
  modelLimit: oneof(constant(undefined), integer({ min: 0, max: 10 }), constant(Infinity)),
})

// R3: Generate a valid zero-or-positive baseline and additional positive usage
// for the session that will be deleted; costs in cents avoid float noise.
const usageArbitrary = record({
  baseTokens: integer({ min: 0, max: 1_000_000 }),
  addedTokens: integer({ min: 1, max: 1_000_000 }),
  baseCostCents: integer({ min: 0, max: 100_000 }),
  addedCostCents: integer({ min: 1, max: 100_000 }),
})

// R4: Generate at least two model entries and two increasing limits, constrained
// so each displayed prefix exists in the generated model list.
const modelOrderingArbitrary = array(modelUsageArbitrary, { minLength: 2, maxLength: 10 }).chain((models) =>
  integer({ min: 1, max: models.length - 1 }).chain((firstLimit) =>
    integer({ min: firstLimit + 1, max: models.length }).map((secondLimit) => ({
      models,
      firstLimit,
      secondLimit,
    })),
  ),
)

// R5: Generate empty or multi-session histories with positive tokens per
// session and zero-or-more messages, including boundary cases for both totals.
const monotonicCountsArbitrary = array(
  record({
    tokens: integer({ min: 1, max: 1_000_000 }),
    messages: integer({ min: 0, max: 3 }),
  }),
  { minLength: 0, maxLength: 5 },
)

// Keep ledger writes in memory so property runs never pollute the user's stats database.
const it = testEffect(
  AppNodeBuilder.build(
    LayerNode.group([
      Session.node,
      EventV2Bridge.node,
      SessionProjector.node,
      Database.node,
      CrossSpawnSpawner.node,
      InstanceStore.node,
    ]),
    [
      [RuntimeFlags.node, RuntimeFlags.layer({ experimentalWorkspaces: false })],
      [Database.node, Database.layerFromPath(":memory:")],
      [
        InstanceBootstrap.node,
        Layer.succeed(InstanceBootstrap.Service, InstanceBootstrap.Service.of({ run: Effect.void })),
      ],
    ],
  ),
)

function recordUsage(session: Session.Interface, sessionID: SessionID, inputTokens: number, cost: number) {
  const messageID = MessageID.ascending()
  const tokens = {
    input: inputTokens,
    output: 0,
    reasoning: 0,
    cache: { read: 0, write: 0 },
  }
  return Effect.gen(function* () {
    yield* session.updateMessage({
      id: messageID,
      sessionID,
      role: "assistant",
      time: { created: Date.now() },
      parentID: messageID,
      modelID: ModelV2.ID.make("test"),
      providerID: ProviderV2.ID.make("test"),
      mode: "test",
      agent: "test",
      path: { cwd: "/", root: "/" },
      cost,
      tokens,
    })
    yield* session.updatePart({
      id: PartID.ascending(),
      messageID,
      sessionID,
      type: "step-finish",
      reason: "stop",
      cost,
      tokens,
    })
  })
}

describe("aggregate statistics", () => {
  // R1: Presentation flags must not change session or message counts.
  // Kind: invariant
  test("keeps overview counts unchanged when model and tool flags are passed", () => {
    // Suppress rendered output while retaining the overview rows for comparison.
    const write = spyOn(process.stdout, "write").mockImplementation(() => true)
    const log = spyOn(console, "log").mockImplementation(() => {})
    // Session and message counts are the two values in the overview under test.
    const overviewCounts = () =>
      log.mock.calls
        .map(([line]) => String(line))
        .filter((line) => line.startsWith("│Sessions") || line.startsWith("│Messages"))

    try {
      assert(
        property(overviewFlagsArbitrary, ({ totalSessions, totalMessages, models, tools, toolLimit, modelLimit }) => {
          // Generate varied stats and presentation options, then compare the same overview with and without limits.
          const stats = {
            totalSessions,
            totalMessages,
            totalCost: 0,
            totalTokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
            toolUsage: Object.fromEntries(tools.map((count, index) => [`tool-${index}`, count])),
            modelUsage: Object.fromEntries(
              models.map((usage, index) => [
                `model-${index}`,
                {
                  messages: usage.messages,
                  tokens: {
                    input: usage.inputTokens,
                    output: usage.outputTokens,
                    cache: { read: usage.cacheReadTokens, write: usage.cacheWriteTokens },
                  },
                  cost: usage.costCents / 100,
                },
              ]),
            ),
            dateRange: { earliest: 0, latest: 0 },
            days: 0,
            costPerDay: 0,
            tokensPerSession: 0,
            medianTokensPerSession: 0,
          }

          displayStats(stats)
          const withoutFlags = overviewCounts()
          log.mockClear()

          displayStats(stats, toolLimit, modelLimit)
          const withFlags = overviewCounts()
          log.mockClear()

          expect(withFlags).toEqual(withoutFlags)
        }),
        { numRuns: 50 },
      )
    } finally {
      log.mockRestore()
      write.mockRestore()
    }
  })

  // R3: Deleting a session must not change aggregate token or cost totals.
  // Kind: invariant
  it.instance("retains token and cost totals after deleting a session", () =>
    Effect.gen(function* () {
      const session = yield* Session.Service
      const context = yield* Effect.context<Database.Service | Session.Service>()
      // Re-run the create, aggregate, delete, and aggregate sequence for each generated usage pair.
      yield* Effect.promise(() =>
        assert(
          asyncProperty(usageArbitrary, async ({ baseTokens, addedTokens, baseCostCents, addedCostCents }) =>
            Effect.runPromiseWith<Database.Service | Session.Service>(context)(
              Effect.gen(function* () {
                const initial = yield* aggregateSessionStats()
                const database = yield* Database.Service
                // Give one session baseline usage and the soon-to-be-deleted session additional usage.
                const base = yield* session.create({})
                const added = yield* session.create({})
                yield* recordUsage(session, base.id, baseTokens, baseCostCents / 100)
                yield* recordUsage(session, added.id, addedTokens, addedCostCents / 100)
                const ledgerRows = yield* database.db
                  .select({ time_created: SessionUsageLedgerTable.time_created })
                  .from(SessionUsageLedgerTable)
                  .where(inArray(SessionUsageLedgerTable.session_id, [base.id, added.id]))
                  .all()
                  .pipe(Effect.orDie)
                expect(ledgerRows).toHaveLength(2)
                expect(ledgerRows.every((row) => row.time_created > 1_577_836_800_000)).toBe(true)

                const expectedTokens = baseTokens + addedTokens
                const expectedCost = (baseCostCents + addedCostCents) / 100

                // First confirm both sessions contribute before testing deletion retention.
                const beforeDelete = yield* aggregateSessionStats()
                expect(beforeDelete.totalTokens.input - initial.totalTokens.input).toBe(expectedTokens)
                expect(beforeDelete.totalCost - initial.totalCost).toBeCloseTo(expectedCost, 8)

                // Removing the added session must leave the combined totals intact.
                yield* session.remove(added.id)
                const afterDelete = yield* aggregateSessionStats()
                expect(afterDelete.totalTokens.input).toBe(beforeDelete.totalTokens.input)
                expect(afterDelete.totalCost).toBeCloseTo(beforeDelete.totalCost, 8)

                yield* session.remove(base.id)
              }),
            ),
          ),
          { numRuns: 20 },
        ),
      )
    }),
  )

  // R4: Increasing the generated model limit must preserve the displayed prefix.
  // Kind: metamorphic
  test("keeps model order and stats unchanged when increasing the model limit", () => {
    // Capture terminal writes too; displayStats uses one to repair the model-section border.
    const write = spyOn(process.stdout, "write").mockImplementation(() => true)
    const log = spyOn(console, "log").mockImplementation(() => {})
    // Keep each model name next to all of its displayed stats for an exact prefix comparison.
    const modelLines = (lines: string[]) =>
      lines.filter(
        (line) =>
          line.startsWith("│ model-") ||
          ["  Messages", "  Input Tokens", "  Output Tokens", "  Cache Read", "  Cache Write", "  Cost"].some((label) =>
            line.startsWith(`│${label}`),
          ),
      )

    try {
      assert(
        property(modelOrderingArbitrary, ({ models, firstLimit, secondLimit }) => {
          // Use stable model names and generated usage so different limits select from identical input.
          const stats = {
            totalSessions: 0,
            totalMessages: 0,
            totalCost: 0,
            totalTokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
            toolUsage: {},
            modelUsage: Object.fromEntries(
              models.map((usage, index) => [
                `model-${index}`,
                {
                  messages: usage.messages,
                  tokens: {
                    input: usage.inputTokens,
                    output: usage.outputTokens,
                    cache: { read: usage.cacheReadTokens, write: usage.cacheWriteTokens },
                  },
                  cost: usage.costCents / 100,
                },
              ]),
            ),
            dateRange: { earliest: 0, latest: 0 },
            days: 0,
            costPerDay: 0,
            tokensPerSession: 0,
            medianTokensPerSession: 0,
          }

          // The smaller-limit output must be an unchanged prefix of the larger one.
          displayStats(stats, undefined, firstLimit)
          const firstModels = modelLines(log.mock.calls.map(([line]) => String(line)))
          log.mockClear()

          displayStats(stats, undefined, secondLimit)
          const moreModels = modelLines(log.mock.calls.map(([line]) => String(line)))
          log.mockClear()

          expect(moreModels.slice(0, firstModels.length)).toEqual(firstModels)
        }),
        { numRuns: 50 },
      )
    } finally {
      log.mockRestore()
      write.mockRestore()
    }
  })

  // R5: Token and message totals must never decrease as sessions or messages are removed.
  // Kind: invariant
  it.instance("never decreases token or message totals as sessions and messages are deleted", () =>
    Effect.gen(function* () {
      const session = yield* Session.Service
      const context = yield* Effect.context<Database.Service | Session.Service>()

      yield* Effect.promise(() =>
        assert(
          asyncProperty(monotonicCountsArbitrary, async (generatedSessions) =>
            Effect.runPromiseWith<Database.Service | Session.Service>(context)(
              Effect.scoped(
                Effect.gen(function* () {
                  const activeSessionIDs: SessionID[] = []
                  yield* Effect.addFinalizer(() =>
                    Effect.forEach(activeSessionIDs, (id) => session.remove(id).pipe(Effect.ignore), {
                      discard: true,
                    }),
                  )

                  const snapshot = () =>
                    Effect.gen(function* () {
                      const stats = yield* aggregateSessionStats()
                      const tokens =
                        stats.totalTokens.input +
                        stats.totalTokens.output +
                        stats.totalTokens.reasoning +
                        stats.totalTokens.cache.read +
                        stats.totalTokens.cache.write
                      return { tokens, messages: stats.totalMessages }
                    })

                  // Start from existing totals so each generated example is independent of earlier archived usage.
                  let previous = yield* snapshot()
                  const expectMonotonic = Effect.fnUntraced(function* () {
                    const current = yield* snapshot()
                    expect(current.tokens).toBeGreaterThanOrEqual(previous.tokens)
                    expect(current.messages).toBeGreaterThanOrEqual(previous.messages)
                    previous = current
                  })

                  const created: { id: SessionID; messages: MessageID[] }[] = []
                  for (const generated of generatedSessions) {
                    const info = yield* session.create({})
                    activeSessionIDs.push(info.id)
                    const item: { id: SessionID; messages: MessageID[] } = { id: info.id, messages: [] }
                    created.push(item)
                    yield* expectMonotonic()

                    yield* recordUsage(session, info.id, generated.tokens, 0)
                    yield* expectMonotonic()

                    for (let index = 0; index < generated.messages; index++) {
                      const messageID = MessageID.ascending()
                      yield* session.updateMessage({
                        id: messageID,
                        sessionID: info.id,
                        role: "user",
                        time: { created: Date.now() },
                        agent: "test",
                        model: { providerID: "test", modelID: "test" },
                        tools: {},
                        mode: "",
                      } as unknown as SessionV1.Info)
                      item.messages.push(messageID)
                      yield* expectMonotonic()
                    }
                  }

                  // Removing messages must not erase already reported message counts or usage.
                  for (const item of created) {
                    for (const messageID of item.messages) {
                      yield* session.removeMessage({ sessionID: item.id, messageID })
                      yield* expectMonotonic()
                    }
                  }

                  // Likewise, deleting each session must not discard its historical totals.
                  for (const item of created) {
                    yield* session.remove(item.id)
                    activeSessionIDs.splice(activeSessionIDs.indexOf(item.id), 1)
                    yield* expectMonotonic()
                  }
                }),
              ),
            ),
          ),
          { numRuns: 20 },
        ),
      )
    }),
  )
})
