import { expect, test } from "bun:test"
import fc from "fast-check"
import { STEPS, firstUnfinished, isComplete } from "../../src/feature-plugins/home/intro"

// Random versions of what the intro can see about a user's setup
const progress = fc.record({
  connected: fc.boolean(),
  sessions: fc.nat({ max: 50 }),
  instructions: fc.boolean(),
})
// Random sets of steps the user has opened (may include duplicates or out-of-range indexes)
const read = fc.array(fc.integer({ min: -2, max: STEPS.length + 2 }))
const steps = STEPS.map((_, index) => index)

test("the intro always opens at a real step", () => {
  fc.assert(
    fc.property(progress, read, (p, r) => {
      const index = firstUnfinished(p, r)
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(STEPS.length)
    }),
  )
})

test("every step before the one that opens is already done", () => {
  fc.assert(
    fc.property(progress, read, (p, r) => {
      const index = firstUnfinished(p, r)
      steps.slice(0, index).forEach((step) => expect(isComplete(step, p, r)).toBe(true))
    }),
  )
})

test("it opens at step 1 only when step 1 is unfinished or everything is done", () => {
  fc.assert(
    fc.property(progress, read, (p, r) => {
      if (firstUnfinished(p, r) !== 0) return
      expect(!isComplete(0, p, r) || steps.every((step) => isComplete(step, p, r))).toBe(true)
    }),
  )
})

test("start over never unchecks a step verified from the real setup", () => {
  fc.assert(
    fc.property(progress, read, (p, r) => {
      steps
        .filter((step) => STEPS[step].verify)
        .forEach((step) => expect(isComplete(step, p, [])).toBe(isComplete(step, p, r)))
    }),
  )
})

test("reading more steps never makes a step undone", () => {
  fc.assert(
    fc.property(progress, read, read, (p, r, more) => {
      steps
        .filter((step) => isComplete(step, p, r))
        .forEach((step) => expect(isComplete(step, p, [...r, ...more])).toBe(true))
    }),
  )
})

test("more sessions never makes a step undone", () => {
  fc.assert(
    fc.property(progress, read, fc.nat({ max: 50 }), (p, r, extra) => {
      const later = { ...p, sessions: p.sessions + extra }
      steps
        .filter((step) => isComplete(step, p, r))
        .forEach((step) => expect(isComplete(step, later, r)).toBe(true))
    }),
  )
})
