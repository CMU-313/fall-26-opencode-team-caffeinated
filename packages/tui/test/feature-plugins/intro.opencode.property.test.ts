import { expect, test } from "bun:test"
import fc from "fast-check"
import { STEPS } from "../../src/feature-plugins/home/intro"
import { click, renderIntro } from "../fixture/intro"

// Generators: aimed at keeping the intro at exactly 4/6.
// Steps 1 (a session exists) and 2 (AGENTS.md is present) are verified done by the user's setup;
// step 0 (no connected provider) and step 5 (only one session) are not done. Reading steps 3 and 4
// brings the total to 4/6.
// provider/costs: free or no provider, so step 0 stays undone.
// files: AGENTS.md present, optionally with other files, so step 2 stays done.
// sessions: exactly 1, so step 1 is done and step 5 is not.
// Strengthened (kthaker): opencode's setup never connects a provider, so the intro always opens on
// step 1 by itself. The second setup has steps 1-3 done, so the intro opens on step 4 by itself and
// the user reads only step 5 to reach 4/6. `toRead` lists the steps the user clicks.
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

// Fixed seed so every run sees the same inputs and results are repeatable
const runs = { numRuns: 40, seed: 42 }
const timeout = 120_000

// R1: Intro progress is saved and restored when OpenCode restarts.
// Acceptance: with the intro at 4/6, restarting OpenCode with no other changes still shows 4/6
// with the same steps checked.
// Kind: round-trip
test(
  "R1: restarting OpenCode at 4/6 restores the same progress",
  async () => {
    await fc.assert(
      fc.asyncProperty(setup, async (env) => {
        const first = await openIntro(env)
        try {
          // Read the steps needed to reach 4/6
          for (const step of env.toRead) await click(first.app, STEPS[step].title)
          const before = progressShown(first.app.captureCharFrame())
          expect(before.done).toBe("4")
          const saved = first.saved()

          const second = await openIntro({ ...env, stored: saved })
          try {
            const after = progressShown(second.app.captureCharFrame())
            expect(after).toEqual(before)
          } finally {
            second.app.renderer.destroy()
          }
        } finally {
          first.app.renderer.destroy()
        }
      }),
      runs,
    )
  },
  timeout,
)

async function openIntro(input: Parameters<typeof renderIntro>[0]) {
  const intro = await renderIntro(input)
  intro.commands.get("intro.open")!.run?.({} as never)
  await intro.app.waitForFrame((frame) => frame.includes("▾"))
  return intro
}

// The N/6 counter plus which steps show a checkmark
function progressShown(frame: string) {
  return {
    done: frame.match(new RegExp(`(\\d)/${STEPS.length} done`))?.[1],
    checked: STEPS.map((step) => frame.split("\n").find((line) => line.includes(step.title))?.includes("✓")),
  }
}