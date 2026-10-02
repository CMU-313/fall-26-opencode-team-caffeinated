import { afterEach, describe, expect } from "bun:test"
import { Effect } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Command } from "@/command"
import { Config } from "@/config/config"
import { TestConfig } from "../fixture/config"
import { disposeAllInstances, TestInstance } from "../fixture/fixture"
import { testEffect } from "../lib/effect"
import PROMPT_COVERAGE from "@/command/template/coverage.txt"

const configLayer = TestConfig.layer()

const it = testEffect(LayerNode.compile(Command.node, [[Config.node, configLayer]]))

afterEach(async () => {
  await disposeAllInstances()
})

describe("command.coverage", () => {
  it.instance("is registered as a built-in command", () =>
    Effect.gen(function* () {
      const command = yield* Command.Service
      const list = yield* command.list()
      const coverage = list.find((item) => item.name === "coverage")

      expect(coverage?.source).toBe("command")
      expect(coverage?.description).toBe(
        "evaluate test coverage [path|package], defaults to uncommitted changes, and coach you through closing gaps",
      )
      expect(coverage?.subtask).toBe(true)
    }),
  )

  it.instance("resolves its template with ${path} substituted for the current working directory", () =>
    Effect.gen(function* () {
      const command = yield* Command.Service
      const test = yield* TestInstance
      const info = yield* command.get("coverage")

      expect(info?.template).toBe(PROMPT_COVERAGE.replaceAll("${path}", test.directory))
    }),
  )

  it.instance("exposes an $ARGUMENTS hint and no numbered placeholders", () =>
    Effect.gen(function* () {
      const command = yield* Command.Service
      const info = yield* command.get("coverage")

      expect(info?.hints).toEqual(["$ARGUMENTS"])
    }),
  )
})

const overrideLayer = TestConfig.layer({
  get: () =>
    Effect.succeed({
      command: {
        coverage: { template: "custom coverage template", description: "custom coverage description" },
      },
    }),
})
const itWithOverride = testEffect(LayerNode.compile(Command.node, [[Config.node, overrideLayer]]))

describe("command.list", () => {
  itWithOverride.instance("a user config command overrides the built-in of the same name", () =>
    Effect.gen(function* () {
      const command = yield* Command.Service
      const list = yield* command.list()
      const matches = list.filter((item) => item.name === "coverage")

      expect(matches).toHaveLength(1)
      expect(matches[0].description).toBe("custom coverage description")
      expect(matches[0].template).toBe("custom coverage template")
    }),
  )
})
