import { expect, test } from "bun:test"
import fc from "fast-check"
import { STEPS } from "../../src/feature-plugins/home/intro"
import { click, renderIntro } from "../fixture/intro"

// Generators: aimed at the points where steps check off, not random values.
// setup: no/free/paid provider (step 1), 0/1/2+ sessions (steps 2 and 6 flip at 1 and 2),
// AGENTS.md/CLAUDE.md/neither (step 3). Half the time steps 1-3 are already done, the "4/6" case from C-7/O-5.
// read: often empty, since a new user is the common case.
// actions: weighted toward "down" so key sequences reach the bottom rows.
const setup = fc.oneof(
  fc.record({
    provider: fc.constantFrom(undefined, "opencode", "anthropic"),
    paid: fc.boolean(),
    sessions: fc.constantFrom(0, 1, 2, 7),
    files: fc.subarray(["AGENTS.md", "CLAUDE.md", "README.md", "src"]),
  }),
  fc.record({
    provider: fc.constant("anthropic"),
    paid: fc.boolean(),
    sessions: fc.constantFrom(1, 2, 7),
    files: fc.constantFrom<string[]>(["AGENTS.md"], ["CLAUDE.md"], ["AGENTS.md", "src"]),
  }),
)
const read = fc.oneof(fc.constant<number[]>([]), fc.subarray([0, 1, 2, 3, 4, 5]))
const actions = fc.array(
  fc.oneof(
    { arbitrary: fc.constant("down" as const), weight: 3 },
    { arbitrary: fc.constant("up" as const), weight: 1 },
    { arbitrary: fc.constant("enter" as const), weight: 2 },
  ),
  { maxLength: 25 },
)

const runs = { numRuns: 20 }
const timeout = 120_000

// R1: Intro progress is saved and restored when OpenCode restarts.
// Acceptance: restarting OpenCode with no other changes shows the same N/6 with the same steps checked.
// Kind: round-trip
test(
  "R1: restarting OpenCode restores the same progress",
  async () => {
    await fc.assert(
      fc.asyncProperty(setup, read, actions, async (env, opened, keys) => {
        const first = await openIntro({ ...env, stored: { intro_read: opened } })
        const before = await use(first, keys).then(() => progressShown(first.app.captureCharFrame()))
        const saved = first.saved()
        first.app.renderer.destroy()

        const second = await openIntro({ ...env, stored: saved })
        try {
          expect(progressShown(second.app.captureCharFrame())).toEqual(before)
        } finally {
          second.app.renderer.destroy()
        }
      }),
      runs,
    )
  },
  timeout,
)

// R2: Using the intro never creates, edits, or deletes files in the user's project.
// Acceptance: using the intro (except "Try it") leaves the project's files unchanged.
// Kind: invariant
test(
  "R2: using the intro only reads the project and only saves its own settings",
  async () => {
    await fc.assert(
      fc.asyncProperty(setup, read, actions, async (env, opened, keys) => {
        const intro = await openIntro({ ...env, stored: { intro_read: opened } })
        try {
          await use(intro, keys, { skipTryIt: true })
          expect(intro.calls.every((call) => call === "file.list")).toBe(true)
          expect(Object.keys(intro.saved()).every((key) => key.startsWith("intro_"))).toBe(true)
        } finally {
          intro.app.renderer.destroy()
        }
      }),
      runs,
    )
  },
  timeout,
)

// R3: Steps 1, 2, 3, and 6 each show a status line explaining why the step is done, or what the user still needs to do to check it off.
// Acceptance: in a project without AGENTS.md, step 3 says "Not done yet" and tells you to run /init. In a project with AGENTS.md, it says "Done" and mentions AGENTS.md.
// Kind: model / oracle (the status the real intro shows must match oracle(), a simpler rule written in this test)
test(
  "R3: every verified step's status line matches the user's real setup",
  async () => {
    await fc.assert(
      fc.asyncProperty(setup, async (env) => {
        const intro = await openIntro(env)
        try {
          for (const [step, done] of oracle(env)) {
            const verify = STEPS[step].verify!
            const text = await expand(intro, step)
            if (done) expect(text).toContain(`✓ Done. ${verify.because}`)
            if (!done) expect(text).toContain(`○ Not done yet. This checks off when ${verify.when}.`)
          }
          const hasInstructions = env.files.includes("AGENTS.md") || env.files.includes("CLAUDE.md")
          const step3 = await expand(intro, 2)
          if (hasInstructions) expect(step3).toContain("AGENTS.md")
          if (!hasInstructions) expect(step3).toContain("/init")
        } finally {
          intro.app.renderer.destroy()
        }
      }),
      runs,
    )
  },
  timeout,
)

// R4: The launch toggle shows its current state (☑ on, ☐ off), includes a hint for how to change it, and highlights when hovered or selected like the other selectable rows.
// Acceptance: when selected, the row reads "› ☑ Show this when OpenCode starts (enter to toggle)". Pressing enter flips it to ☐ and saves the setting; pressing enter again puts it back.
// Kind: round-trip (toggle once, then toggle again: the screen and every saved setting must be exactly where they started)
test(
  "R4: toggling the launch setting twice puts everything back",
  async () => {
    await fc.assert(
      fc.asyncProperty(setup, read, fc.boolean(), actions, async (env, opened, hidden, keys) => {
        const intro = await openIntro({ ...env, stored: { intro_read: opened, intro_hide_on_launch: hidden } })
        try {
          // Start from any state of the dialog, then select the launch row (just above "Start over", the last row)
          await use(intro, keys)
          intro.app.mockInput.pressKeys([...Array.from({ length: 20 }, () => "\x1b[B"), "\x1b[A"])
          await intro.app.renderOnce()
          const startScreen = intro.app.captureCharFrame()
          const startSaved = intro.saved()
          expect(selectedLine(startScreen)).toContain(`› ${hidden ? "☐" : "☑"} Show this when OpenCode starts (enter to toggle)`)

          // Toggle once: the row shows the other state, still highlighted with its hint, and only that setting is saved
          intro.app.mockInput.pressEnter()
          await intro.app.renderOnce()
          expect(selectedLine(intro.app.captureCharFrame())).toContain(
            `› ${hidden ? "☑" : "☐"} Show this when OpenCode starts (enter to toggle)`,
          )
          expect(intro.saved()).toEqual({ ...startSaved, intro_hide_on_launch: !hidden })

          // Toggle again: back exactly where it started
          intro.app.mockInput.pressEnter()
          await intro.app.renderOnce()
          expect(intro.app.captureCharFrame()).toBe(startScreen)
          expect(intro.saved()).toEqual(startSaved)
        } finally {
          intro.app.renderer.destroy()
        }
      }),
      runs,
    )
  },
  timeout,
)

// The oracle for R3
function oracle(env: { provider?: string; paid: boolean; sessions: number; files: string[] }) {
  return [
    [0, env.provider === "anthropic" || (env.provider === "opencode" && env.paid)],
    [1, env.sessions >= 1],
    [2, env.files.includes("AGENTS.md") || env.files.includes("CLAUDE.md")],
    [5, env.sessions >= 2],
  ] as const
}

async function openIntro(input: Parameters<typeof renderIntro>[0]) {
  const intro = await renderIntro(input)
  intro.commands.get("intro.open")!.run?.({} as never)
  await intro.app.waitForFrame((frame) => frame.includes("▾"))
  return intro
}

async function use(intro: Awaited<ReturnType<typeof renderIntro>>, keys: ("up" | "down" | "enter")[], options = { skipTryIt: false }) {
  for (const key of keys) {
    if (key !== "enter") intro.app.mockInput.pressArrow(key)
    if (key === "enter" && !(options.skipTryIt && selectedLine(intro.app.captureCharFrame()).includes("▶ Try it")))
      intro.app.mockInput.pressEnter()
    await intro.app.renderOnce()
  }
}

// Opens a step if it isn't already open and returns the dialog text with line wrapping removed
async function expand(intro: Awaited<ReturnType<typeof renderIntro>>, step: number) {
  const title = STEPS[step].title
  const row = intro.app
    .captureCharFrame()
    .split("\n")
    .find((line) => line.includes(title))
  if (!row?.includes("▾")) await click(intro.app, title)
  return intro.app.captureCharFrame().replace(/\s+/g, " ")
}

// The N/6 counter plus which steps show a checkmark
function progressShown(frame: string) {
  const lines = frame.split("\n")
  return {
    done: frame.match(/(\d)\/6 done/)?.[1],
    checked: STEPS.map((step) => lines.find((line) => line.includes(step.title))?.includes("✓")),
  }
}

function selectedLine(frame: string) {
  return frame.split("\n").find((line) => line.includes("› ")) ?? ""
}
