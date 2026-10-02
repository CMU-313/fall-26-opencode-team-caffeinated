import { describe, expect, test } from "bun:test"
import { advanceDebugStep, debugFailureKey, debugSteps, readDebugProgress, writeDebugProgress } from "./debug-mode"

const assertionFailure = {
  command: "bun test test/cart.test.ts",
  exit: 1,
  output: "expect(received).toBe(expected)\nExpected: 3\nReceived: 2",
}

const exceptionFailure = {
  command: "pytest tests/test_parser.py::test_empty",
  exit: 1,
  output: "E   TypeError: Cannot read properties of undefined\nE   at parse (src/parser.ts:42:11)",
}

describe("debug mode", () => {
  test("orders assertion steps and quotes assertion output", () => {
    const steps = debugSteps(assertionFailure)

    expect(steps.map((step) => step.id)).toEqual(["reproduce", "inspect", "rerun"])
    expect(steps[0]?.evidence).toBe("bun test test/cart.test.ts")
    expect(steps[1]?.evidence).toBe("expect(received).toBe(expected)")
    expect(steps[1]?.kind).toBe("assertion")
  })

  test("orders exception steps and quotes the exception output", () => {
    const steps = debugSteps(exceptionFailure)

    expect(steps.map((step) => step.id)).toEqual(["reproduce", "inspect", "rerun"])
    expect(steps[1]?.evidence).toBe("E   TypeError: Cannot read properties of undefined")
    expect(steps[1]?.kind).toBe("exception")
  })

  test("persists toggle and advancement for the failure signature", () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    const key = `debug:${debugFailureKey(assertionFailure)}`

    const first = advanceDebugStep({ enabled: true, completed: 0 }, 0)
    const second = advanceDebugStep(first, 1)
    writeDebugProgress(storage, key, second)

    expect(readDebugProgress(storage, key)).toEqual({ enabled: true, completed: 2 })
  })
})