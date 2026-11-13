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
    // Model costs: only free, only paid, no cost info, or a mix of free and paid
    costs: fc.constantFrom<(number | undefined)[]>([0], [3], [undefined], [0, 3]),
    sessions: fc.constantFrom(0, 1, 2, 7),
    files: fc.subarray(["AGENTS.md", "CLAUDE.md", "README.md", "src"]),
    filesFail: fc.boolean(),
  }),
  fc.record({
    provider: fc.constant("anthropic"),
    costs: fc.constant<(number | undefined)[]>([0]),
    sessions: fc.constantFrom(1, 2, 7),
    files: fc.constantFrom<string[]>(["AGENTS.md"], ["CLAUDE.md"], ["AGENTS.md", "src"]),
    filesFail: fc.constant(false),
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

// Fixed seed so every Stryker run sees the same inputs and mutant results are repeatable
const runs = { numRuns: 40, seed: 42 }
const timeout = 120_000

// R1: Intro progress is saved and restored when OpenCode restarts.
// Acceptance: restarting OpenCode with no other changes shows the same N/6 with the same steps checked.
// Kind: round-trip
test(
  "R1: restarting OpenCode restores the same progress",
  async () => {
    await fc.assert(
      fc.asyncProperty(setup, read, actions, fc.constantFrom(3, 4), async (env, opened, keys, step) => {
        const first = await openIntro({ ...env, stored: { intro_read: opened } })
        await use(first, keys)
        // Open step 4 or 5 (steps checked off by reading), closing it first if it is already open
        if (rowOf(first.app.captureCharFrame(), step).includes("▾")) await click(first.app, STEPS[step].title)
        await click(first.app, STEPS[step].title)
        const before = progressShown(first.app.captureCharFrame())
        const saved = first.saved()
        first.app.renderer.destroy()

        const second = await openIntro({ ...env, stored: saved })
        try {
          const after = progressShown(second.app.captureCharFrame())
          expect(after).toEqual(before)
          // The opened step stays checked, verified steps match the user's setup, and N/6 counts the checkmarks
          expect(after.checked[step]).toBe(true)
          for (const [index, done] of oracle(env)) expect(after.checked[index]).toBe(done)
          expect(after.done).toBe(String(after.checked.filter(Boolean).length))
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
          expect(intro.fileListInput()).toEqual({ path: "." })
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
          for (const [step, done, why, todo] of oracle(env)) {
            await expand(intro, step)
            // The status line is checked against our own wording, not the text in STEPS
            const status = statusLine(intro.app.captureCharFrame())
            if (done) expect(status).toStartWith("✓ Done.")
            if (done) expect(status).toContain(why)
            if (!done) expect(status).toStartWith("○ Not done yet.")
            if (!done) expect(status).toContain(todo)
          }
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
      // hidden: undefined means the setting was never saved, so the default (show on launch) applies
      fc.asyncProperty(setup, read, fc.constantFrom(true, false, undefined), actions, async (env, opened, hidden, keys) => {
        const intro = await openIntro({
          ...env,
          firstLaunch: hidden === undefined,
          stored: { intro_read: opened, ...(hidden === undefined ? {} : { intro_hide_on_launch: hidden }) },
        })
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

          // Toggle again: back exactly where it started (a never-saved setting is now saved as "show")
          intro.app.mockInput.pressEnter()
          await intro.app.renderOnce()
          expect(intro.app.captureCharFrame()).toBe(startScreen)
          expect(intro.saved()).toEqual({ intro_hide_on_launch: false, ...startSaved })
        } finally {
          intro.app.renderer.destroy()
        }
      }),
      runs,
    )
  },
  timeout,
)

// R5: The intro gives an optional, non-required way to see every OpenCode command.
// Acceptance: selecting "See every command OpenCode has" opens the command palette and does not change the N/6 done.
// Kind: invariant (from any dialog state, selecting the row opens the palette and progress is unchanged)
test(
  "R5: the commands row opens the palette without changing progress",
  async () => {
    await fc.assert(
      fc.asyncProperty(setup, read, actions, async (env, opened, keys) => {
        const intro = await openIntro({ ...env, stored: { intro_read: opened } })
        try {
          await use(intro, keys)
          // The commands row is two rows above "Start over", the last row
          intro.app.mockInput.pressKeys([...Array.from({ length: 20 }, () => "\x1b[B"), "\x1b[A", "\x1b[A"])
          await intro.app.renderOnce()
          const before = progressShown(intro.app.captureCharFrame())
          intro.app.mockInput.pressEnter()
          await intro.app.renderOnce()
          expect(intro.dispatched.at(-1)).toBe("command.palette.show")
          expect(progressShown(intro.app.captureCharFrame())).toEqual(before)
        } finally {
          intro.app.renderer.destroy()
        }
      }),
      runs,
    )
  },
  timeout,
)

// The oracle for R1 and R3: [step, done, words that say why it is done, words that say what checks it off]
function oracle(env: { provider?: string; costs: (number | undefined)[]; sessions: number; files: string[]; filesFail: boolean }) {
  return [
    [0, env.provider === "anthropic" || (env.provider === "opencode" && env.costs.some((cost) => cost !== 0)), "connected a provider", "connect a provider"],
    [1, env.sessions >= 1, "sent a message", "send your first message"],
    [2, !env.filesFail && (env.files.includes("AGENTS.md") || env.files.includes("CLAUDE.md")), "AGENTS.md", "/init"],
    [5, env.sessions >= 2, "more than one session", "more than one session"],
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
    done: frame.match(new RegExp(`(\\d)/${STEPS.length} done`))?.[1],
    checked: STEPS.map((step) => lines.find((line) => line.includes(step.title))?.includes("✓")),
  }
}

function rowOf(frame: string, step: number) {
  return frame.split("\n").find((line) => line.includes(STEPS[step].title)) ?? ""
}

// The "✓ Done." or "○ Not done yet." line under the open step
function statusLine(frame: string) {
  return (
    frame
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.startsWith("✓ Done.") || line.startsWith("○ Not done yet.")) ?? ""
  )
}

function selectedLine(frame: string) {
  return frame.split("\n").find((line) => line.includes("› ")) ?? ""
}
