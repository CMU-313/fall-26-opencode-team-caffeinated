/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import fc from "fast-check"
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui"
import { testRender, useRenderer } from "@opentui/solid"
import type { TuiPluginApi, TuiPluginMeta } from "@opencode-ai/plugin/tui"
import { createSignal, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { TuiConfigProvider } from "../../src/config"
import { OpencodeKeymapProvider } from "../../src/keymap"
import introPlugin from "../../src/feature-plugins/home/intro"
import { createBuiltinPlugins, type BuiltinTuiPlugin } from "../../src/feature-plugins/builtins"
import { createTuiPluginApi } from "../fixture/tui-plugin"
import { createTuiResolvedConfig } from "../fixture/tui-runtime"
import { TestTuiContexts } from "../fixture/tui-environment"

// The intro auto-opens only once per launch (module state), so this test must run first
test("opens on launch, and closing it only hides it until the next launch", async () => {
  const intro = await renderIntro({ firstLaunch: true })
  try {
    await intro.app.waitForFrame((frame) => frame.includes("Welcome to OpenCode"))
    expect(intro.app.captureCharFrame()).toContain("New to OpenCode? Open the intro")

    intro.close()
    await intro.app.renderOnce()
    expect(intro.app.captureCharFrame()).not.toContain("Welcome to OpenCode")
    expect(intro.kv.get("intro_hide_on_launch", false)).toBe(false)
  } finally {
    intro.app.renderer.destroy()
  }
})

test("/intro reopens it", async () => {
  const intro = await renderIntro({})
  try {
    await intro.app.waitForFrame((frame) => frame.includes("New to OpenCode"))
    expect(intro.app.captureCharFrame()).not.toContain("Welcome to OpenCode")

    intro.commands.get("intro.open")!.run?.({} as never)
    await intro.app.waitForFrame((frame) => frame.includes("Welcome to OpenCode"))
  } finally {
    intro.app.renderer.destroy()
  }
})

test("a new user starts at step 1 and sees it is not done yet", async () => {
  const intro = await renderIntro({})
  try {
    intro.commands.get("intro.open")!.run?.({} as never)
    await intro.app.waitForFrame((frame) => frame.includes("Not done yet"))
    const frame = intro.app.captureCharFrame()
    expect(frame).toContain("0/6 done")
    expect(frame).toContain("free models")
    expect(frame).toContain("checks off when you connect a provider")
  } finally {
    intro.app.renderer.destroy()
  }
})

test("steps check off from the user's real setup and it opens at the first unfinished one", async () => {
  const intro = await renderIntro({ provider: "anthropic", sessions: 1, files: ["AGENTS.md", "src"] })
  try {
    intro.commands.get("intro.open")!.run?.({} as never)
    // Connected, one session, and AGENTS.md: steps 1-3 are done, so step 4 opens first.
    // Opening step 4 counts as reading it, so it checks off too
    await intro.app.waitForFrame((frame) => frame.includes("4/6 done"))
    const frame = intro.app.captureCharFrame()
    expect(frame).toContain("switch between two agents")
    expect(frame).not.toContain("free models")
    expect(intro.fileListInput()).toEqual({ path: "." })
  } finally {
    intro.app.renderer.destroy()
  }
})

test("the built-in free models don't count as a connected provider", async () => {
  const intro = await renderIntro({ provider: "opencode" })
  try {
    intro.commands.get("intro.open")!.run?.({} as never)
    await intro.app.waitForFrame((frame) => frame.includes("0/6 done"))
    expect(intro.app.captureCharFrame()).toContain("checks off when you connect a provider")
  } finally {
    intro.app.renderer.destroy()
  }
})

test("Try it runs the real command", async () => {
  const intro = await renderIntro({})
  try {
    intro.commands.get("intro.open")!.run?.({} as never)
    await intro.app.waitForFrame((frame) => frame.includes("Try it: Open /connect"))

    // Rows under the open step 1: the step itself, then "Try it"
    intro.app.mockInput.pressArrow("down")
    intro.app.mockInput.pressEnter()
    await intro.app.renderOnce()
    expect(intro.dispatched).toEqual(["provider.connect"])
  } finally {
    intro.app.renderer.destroy()
  }
})

test("clicking a common question shows its answer", async () => {
  const intro = await renderIntro({})
  try {
    intro.commands.get("intro.open")!.run?.({} as never)
    await intro.app.waitForFrame((frame) => frame.includes("Do I need to pay for a model?"))
    expect(intro.app.captureCharFrame()).not.toContain("work without signing in")

    // Rows under the open step 1: the step, "Try it", then the question
    intro.app.mockInput.pressArrow("down")
    intro.app.mockInput.pressArrow("down")
    intro.app.mockInput.pressEnter()
    await intro.app.waitForFrame((frame) => frame.includes("work without signing in"))
  } finally {
    intro.app.renderer.destroy()
  }
})

test("the launch row turns the pop-up on and off", async () => {
  const intro = await renderIntro({})
  try {
    intro.commands.get("intro.open")!.run?.({} as never)
    await intro.app.waitForFrame((frame) => frame.includes("Show this when OpenCode starts"))

    // The launch row sits just above "Start over", the last row
    intro.app.mockInput.pressKeys([...Array.from({ length: 20 }, () => "\x1b[B"), "\x1b[A"])
    await intro.app.waitForFrame((frame) => frame.includes("› ☐ Show this when OpenCode starts"))
    intro.app.mockInput.pressEnter()
    await intro.app.waitForFrame((frame) => frame.includes("› ☑ Show this when OpenCode starts"))
    expect(intro.kv.get("intro_hide_on_launch", true)).toBe(false)

    intro.app.mockInput.pressEnter()
    await intro.app.waitForFrame((frame) => frame.includes("› ☐ Show this when OpenCode starts"))
    expect(intro.kv.get("intro_hide_on_launch", false)).toBe(true)
  } finally {
    intro.app.renderer.destroy()
  }
})

test("Start over clears the read checkmarks, keeps real setup, and says why", async () => {
  const intro = await renderIntro({ provider: "anthropic", files: ["AGENTS.md"] })
  try {
    // Steps 1 and 3 are verified from the provider and AGENTS.md; steps 4 and 5 were only read
    intro.kv.set("intro_read", [3, 4])
    intro.commands.get("intro.open")!.run?.({} as never)
    await intro.app.waitForFrame((frame) => frame.includes("4/6 done"))

    // "Start over" is the last row
    intro.app.mockInput.pressKeys(Array.from({ length: 20 }, () => "\x1b[B"))
    await intro.app.waitForFrame((frame) => frame.includes("› ↺ Start over"))
    intro.app.mockInput.pressEnter()
    await intro.app.waitForFrame((frame) => frame.includes("2/6 done"))

    expect(intro.app.captureCharFrame()).toContain("✓ Done. You've connected a provider.")
    expect(intro.toasts).toEqual([
      "Progress cleared. Still checked because they're true for your setup: Connect a model, Point it at the right files.",
    ])
    expect(intro.kv.get("intro_read", [])).not.toContain(3)
    expect(intro.kv.get("intro_read", [])).not.toContain(4)
  } finally {
    intro.app.renderer.destroy()
  }
})

test("turning off the launch pop-up keeps it closed on the next launch", async () => {
  const intro = await renderIntro({ plugin: await freshLaunch("off"), firstLaunch: true, hideOnLaunch: true })
  try {
    await intro.app.waitForFrame((frame) => frame.includes("New to OpenCode"))
    await intro.app.renderOnce()
    expect(intro.app.captureCharFrame()).not.toContain("Welcome to OpenCode")
  } finally {
    intro.app.renderer.destroy()
  }
})

test("it doesn't open on top of another dialog at launch", async () => {
  const intro = await renderIntro({ plugin: await freshLaunch("busy"), firstLaunch: true, dialogOpen: true })
  try {
    await intro.app.waitForFrame((frame) => frame.includes("Another dialog"))
    await intro.app.renderOnce()
    expect(intro.app.captureCharFrame()).not.toContain("Welcome to OpenCode")
  } finally {
    intro.app.renderer.destroy()
  }
})

test("clicking the home link opens it, and clicking esc closes it", async () => {
  const intro = await renderIntro({})
  try {
    await intro.app.waitForFrame((frame) => frame.includes("New to OpenCode"))
    await click(intro.app, "New to OpenCode? Open the intro")
    await intro.app.waitForFrame((frame) => frame.includes("Welcome to OpenCode"))

    await click(intro.app, "esc")
    await intro.app.waitForFrame((frame) => !frame.includes("Welcome to OpenCode"))
  } finally {
    intro.app.renderer.destroy()
  }
})

test("if the file list fails, it still opens and the AGENTS.md step stays unchecked", async () => {
  const intro = await renderIntro({ filesFail: true })
  try {
    intro.commands.get("intro.open")!.run?.({} as never)
    await intro.app.waitForFrame((frame) => frame.includes("0/6 done"))

    await click(intro.app, "Point it at the right files")
    await intro.app.waitForFrame((frame) => frame.includes("checks off when your project has an AGENTS.md"))
  } finally {
    intro.app.renderer.destroy()
  }
})

test("a CLAUDE.md file counts the same as AGENTS.md", async () => {
  const intro = await renderIntro({ provider: "anthropic", files: ["CLAUDE.md"] })
  try {
    intro.commands.get("intro.open")!.run?.({} as never)
    // Connected and CLAUDE.md: steps 1 and 3 are done, so step 2 opens first
    await intro.app.waitForFrame((frame) => frame.includes("2/6 done"))
    expect(intro.app.captureCharFrame()).toContain("Type in the prompt box")
  } finally {
    intro.app.renderer.destroy()
  }
})

test("a second session checks off the sessions step", async () => {
  const intro = await renderIntro({ provider: "anthropic", sessions: 2, files: ["AGENTS.md"] })
  try {
    intro.commands.get("intro.open")!.run?.({} as never)
    // Steps 1, 2, 3, and 6 are verified; step 4 opens first and counts as read
    await intro.app.waitForFrame((frame) => frame.includes("5/6 done"))

    await click(intro.app, "Manage your conversations")
    await intro.app.waitForFrame((frame) => frame.includes("✓ Done. You have more than one session in this project."))
  } finally {
    intro.app.renderer.destroy()
  }
})

test("a paid model from the built-in provider counts as connected", async () => {
  const intro = await renderIntro({ provider: "opencode", paid: true })
  try {
    intro.commands.get("intro.open")!.run?.({} as never)
    // Step 1 is done, so step 2 opens first
    await intro.app.waitForFrame((frame) => frame.includes("1/6 done"))
    expect(intro.app.captureCharFrame()).toContain("Type in the prompt box")
  } finally {
    intro.app.renderer.destroy()
  }
})

test("when every step is done it shows 6/6 and opens at step 1", async () => {
  const intro = await renderIntro({ provider: "anthropic", sessions: 2, files: ["AGENTS.md"] })
  try {
    intro.kv.set("intro_read", [3, 4])
    intro.commands.get("intro.open")!.run?.({} as never)
    await intro.app.waitForFrame((frame) => frame.includes("6/6 done"))
    expect(intro.app.captureCharFrame()).toContain("✓ Done. You've connected a provider.")
  } finally {
    intro.app.renderer.destroy()
  }
})

test("clicking a step opens it and marks it read; clicking it again folds it", async () => {
  const intro = await renderIntro({})
  try {
    intro.commands.get("intro.open")!.run?.({} as never)
    await intro.app.waitForFrame((frame) => frame.includes("free models"))

    await click(intro.app, "Plan first, then build")
    await intro.app.waitForFrame((frame) => frame.includes("switch between two agents"))
    expect(intro.app.captureCharFrame()).not.toContain("free models")
    expect(intro.kv.get<number[]>("intro_read", [])).toContain(3)

    await click(intro.app, "Plan first, then build")
    await intro.app.waitForFrame((frame) => !frame.includes("switch between two agents"))
  } finally {
    intro.app.renderer.destroy()
  }
})

test("an open answer closes when you move to another step", async () => {
  const intro = await renderIntro({})
  try {
    intro.commands.get("intro.open")!.run?.({} as never)
    await intro.app.waitForFrame((frame) => frame.includes("Do I need to pay for a model?"))
    await click(intro.app, "Do I need to pay for a model?")
    await intro.app.waitForFrame((frame) => frame.includes("work without signing in"))

    await click(intro.app, "Ask for what you want")
    await intro.app.waitForFrame((frame) => frame.includes("What makes a good request?"))
    expect(intro.app.captureCharFrame()).not.toContain("Say what to change")
  } finally {
    intro.app.renderer.destroy()
  }
})

test("the commands row opens the command palette", async () => {
  const intro = await renderIntro({})
  try {
    intro.commands.get("intro.open")!.run?.({} as never)
    await intro.app.waitForFrame((frame) => frame.includes("See every command OpenCode has"))
    await click(intro.app, "See every command OpenCode has")
    expect(intro.dispatched).toEqual(["command.palette.show"])
  } finally {
    intro.app.renderer.destroy()
  }
})

test("pressing up on the first row stays on the first row", async () => {
  const intro = await renderIntro({})
  try {
    intro.commands.get("intro.open")!.run?.({} as never)
    await intro.app.waitForFrame((frame) => frame.includes("› 1  Connect a model"))
    intro.app.mockInput.pressArrow("up")
    intro.app.mockInput.pressArrow("down")
    await intro.app.waitForFrame((frame) => frame.includes("› ▶ Try it: Open /connect"))
  } finally {
    intro.app.renderer.destroy()
  }
})

test("Start over with nothing verified just says progress was cleared", async () => {
  const intro = await renderIntro({})
  try {
    intro.kv.set("intro_read", [3, 4])
    intro.commands.get("intro.open")!.run?.({} as never)
    await intro.app.waitForFrame((frame) => frame.includes("2/6 done"))

    await click(intro.app, "Start over")
    await intro.app.waitForFrame((frame) => frame.includes("0/6 done"))
    expect(intro.toasts).toEqual(["Progress cleared."])
  } finally {
    intro.app.renderer.destroy()
  }
})

test("the intro is registered as a built-in plugin", () => {
  expect(createBuiltinPlugins({ experimentalEventSystem: false })).toContain(introPlugin)
})

// Property-based tests for the tour requirements R1–R4. fast-check generates the user's actions,
// and each property must hold for every generated sequence, not just one hand-picked example.

let launches = 0

test(
  "R1: the tour opens on the first launch only, however the user closes it, and /intro always opens it",
  async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({ advance: fc.nat({ max: 5 }), reopen: fc.boolean() }), { minLength: 2, maxLength: 4 }),
        async (sessions) => {
          // One KV store shared by every launch, like the user's saved settings
          const kv = createKv({})
          for (const [index, session] of sessions.entries()) {
            const intro = await renderIntro({ plugin: await freshLaunch(`r1-${launches++}`), kv })
            try {
              await intro.app.waitForFrame((frame) => frame.includes("New to OpenCode"))
              await intro.app.renderOnce()
              expect(intro.app.captureCharFrame().includes("Welcome to OpenCode")).toBe(index === 0)
              // The user moves through some of the tour, then closes it partway
              for (const _ of Array.from({ length: session.advance })) await press(intro.app, "right")
              intro.close()
              await intro.app.renderOnce()

              if (!session.reopen) continue
              intro.commands.get("intro.open")!.run?.({} as never)
              await intro.app.waitForFrame((frame) => frame.includes("Welcome to OpenCode"))
              intro.close()
            } finally {
              intro.app.renderer.destroy()
            }
          }
        },
      ),
      { numRuns: 10 },
    )
  },
  60_000,
)

test(
  "R2: enter, the right arrow, and the Next button each move to the next step",
  async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.nat({ max: 7 }),
        fc.array(fc.constantFrom<TourInput>("enter", "right", "next"), { minLength: 1, maxLength: 8 }),
        async (start, inputs) => {
          const intro = await openTour({})
          try {
            const count = tourSteps(intro.app.captureCharFrame()).titles.length
            const first = start % count
            if (first > 0) await click(intro.app, tourSteps(intro.app.captureCharFrame()).titles[first])
            expect(tourSteps(intro.app.captureCharFrame()).open).toBe(first)

            for (const [index, input] of inputs.entries()) {
              await press(intro.app, input)
              // The last step has nowhere further to go, so it stays put
              expect(tourSteps(intro.app.captureCharFrame()).open).toBe(Math.min(first + index + 1, count - 1))
            }
          } finally {
            intro.app.renderer.destroy()
          }
        },
      ),
      { numRuns: 20 },
    )
  },
  60_000,
)

test(
  "R3: each step spotlights only its own target and dims the others; closing clears the spotlight",
  async () => {
    const extra = await spotlightTargets()
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom<TourInput>("enter", "right", "next"), { maxLength: 9 }),
        async (inputs) => {
          const intro = await openTour({ extra })
          try {
            expectSpotlight(intro.app)
            for (const input of inputs) {
              await press(intro.app, input)
              expectSpotlight(intro.app)
            }
            intro.close()
            await intro.app.renderOnce()
            expect(look(intro.app, "MODEL-SELECTOR")).toBe("normal")
            expect(look(intro.app, "MCP-CONTROL")).toBe("normal")
          } finally {
            intro.app.renderer.destroy()
          }
        },
      ),
      { numRuns: 20 },
    )
  },
  60_000,
)

test("R3: the spotlight moves from the model selector to the MCP control", async () => {
  const intro = await openTour({ extra: await spotlightTargets() })
  try {
    await click(intro.app, "Switch model")
    expect(look(intro.app, "MODEL-SELECTOR")).toBe("lit")
    expect(look(intro.app, "MCP-CONTROL")).toBe("dimmed")

    await press(intro.app, "right")
    const steps = tourSteps(intro.app.captureCharFrame())
    expect(steps.titles[steps.open]).toBe("Connect an MCP server")
    expect(look(intro.app, "MCP-CONTROL")).toBe("lit")
    expect(look(intro.app, "MODEL-SELECTOR")).toBe("dimmed")
  } finally {
    intro.app.renderer.destroy()
  }
})

test(
  "R4: a Skip button is visible on every step, and it closes the tour",
  async () => {
    await fc.assert(
      fc.asyncProperty(
        // Each move either presses right or clicks a step (by index, wrapped to the number of steps)
        fc.array(fc.oneof(fc.constant("right" as const), fc.nat({ max: 7 })), { maxLength: 8 }),
        async (moves) => {
          const intro = await openTour({})
          try {
            expect(intro.app.captureCharFrame()).toContain("Skip tour")
            for (const move of moves) {
              const titles = tourSteps(intro.app.captureCharFrame()).titles
              if (move === "right") await press(intro.app, "right")
              if (move !== "right") await click(intro.app, titles[move % titles.length])
              expect(intro.app.captureCharFrame()).toContain("Skip tour")
            }
            await click(intro.app, "Skip tour")
            expect(intro.app.captureCharFrame()).not.toContain("Welcome to OpenCode")
          } finally {
            intro.app.renderer.destroy()
          }
        },
      ),
      { numRuns: 20 },
    )
  },
  60_000,
)

// The spotlight test names each step by the target it should highlight; steps not listed spotlight nothing
const SPOTLIGHT: Record<string, string | undefined> = {
  "Switch model": "model",
  "Connect an MCP server": "mcp",
}

type TourInput = "enter" | "right" | "next"

// A new user opens the tour with /intro and lands on step 1
async function openTour(input: Parameters<typeof renderIntro>[0]) {
  const intro = await renderIntro(input)
  intro.commands.get("intro.open")!.run?.({} as never)
  await intro.app.waitForFrame((frame) => tourSteps(frame).open === 0)
  return intro
}

async function press(app: Awaited<ReturnType<typeof testRender>>, input: TourInput) {
  if (input === "next") return click(app, "Next →")
  if (input === "enter") app.mockInput.pressEnter()
  if (input === "right") app.mockInput.pressArrow("right")
  await app.renderOnce()
}

// Reads the tour from the screen: every step title in order, and the index of the open (▾) step, or -1
function tourSteps(frame: string) {
  const rows = frame.split("\n").flatMap((line) => {
    const match = line.match(/^\s*(?:› )?(?:✓|\d+) {2}(.+?) {2}([▸▾])/)
    return match ? [{ title: match[1], open: match[2] === "▾" }] : []
  })
  return { titles: rows.map((row) => row.title), open: rows.findIndex((row) => row.open) }
}

// Stand-ins for the real model selector and MCP control, wrapped the way the home screen wraps them
async function spotlightTargets() {
  const { Spotlight } = await import("../../src/ui/spotlight")
  return () => (
    <box>
      <Spotlight id="model">
        <text fg="#ffffff">MODEL-SELECTOR</text>
      </Spotlight>
      <Spotlight id="mcp">
        <text fg="#ffffff">MCP-CONTROL</text>
      </Spotlight>
    </box>
  )
}

function expectSpotlight(app: Awaited<ReturnType<typeof testRender>>) {
  const steps = tourSteps(app.captureCharFrame())
  const target = SPOTLIGHT[steps.titles[steps.open] ?? ""]
  const expected = (id: string) => (target === undefined ? "normal" : target === id ? "lit" : "dimmed")
  expect(look(app, "MODEL-SELECTOR")).toBe(expected("model"))
  expect(look(app, "MCP-CONTROL")).toBe(expected("mcp"))
}

// "lit" means framed by a border, "dimmed" means faded below its white text color, otherwise "normal"
function look(app: Awaited<ReturnType<typeof testRender>>, label: string) {
  const line = app.captureSpans().lines.find((line) => line.spans.some((span) => span.text.includes(label)))
  expect(line).toBeDefined()
  if (line!.spans.some((span) => span.text.includes("│"))) return "lit"
  const span = line!.spans.find((span) => span.text.includes(label))!
  return span.fg.toInts()[0] < 255 ? "dimmed" : "normal"
}

// Reactive like the real KV store, so the intro re-renders when progress is saved or cleared
function createKv(initial: Record<string, unknown>) {
  const [values, setValues] = createStore<Record<string, unknown>>(initial)
  return {
    get: (name: string, fallback?: unknown) => (name in values ? values[name] : fallback),
    set: (name: string, value: unknown) => setValues(name, value),
    ready: true,
  } as TuiPluginApi["kv"]
}

// The intro auto-opens only once per process, so launch tests load their own copy of the module
async function freshLaunch(name: string): Promise<BuiltinTuiPlugin> {
  const module: { default: BuiltinTuiPlugin } = await import(`../../src/feature-plugins/home/intro.tsx?${name}`)
  return module.default
}

async function click(app: Awaited<ReturnType<typeof testRender>>, text: string) {
  const lines = app.captureCharFrame().split("\n")
  const y = lines.findIndex((line) => line.includes(text))
  expect(y).toBeGreaterThanOrEqual(0)
  await app.mockMouse.click(lines[y].indexOf(text), y)
  await app.renderOnce()
}

async function renderIntro(input: {
  provider?: string
  paid?: boolean
  sessions?: number
  files?: string[]
  filesFail?: boolean
  firstLaunch?: boolean
  hideOnLaunch?: boolean
  dialogOpen?: boolean
  plugin?: BuiltinTuiPlugin
  kv?: TuiPluginApi["kv"]
  extra?: () => JSX.Element
}) {
  const commands = new Map<
    string,
    NonNullable<Parameters<TuiPluginApi["keymap"]["registerLayer"]>[0]["commands"]>[number]
  >()
  const dispatched: string[] = []
  const toasts: string[] = []
  const [dialog, setDialog] = createSignal<{ render: () => JSX.Element; onClose?: () => void } | undefined>(
    input.dialogOpen ? { render: () => <text>Another dialog</text> } : undefined,
  )
  let homeBottom: (() => JSX.Element) | undefined
  let fileListInput: unknown
  // Other tests open the intro themselves, so stop it auto-opening even when a test runs alone
  const kv = input.kv ?? createKv(input.firstLaunch && !input.hideOnLaunch ? {} : { intro_hide_on_launch: true })
  const config = createTuiResolvedConfig()

  function Harness() {
    const keymap = createDefaultOpenTuiKeymap(useRenderer())
    const registerLayer = keymap.registerLayer.bind(keymap)
    keymap.registerLayer = (layer) => {
      layer.commands?.forEach((command) => commands.set(command.name, command))
      return registerLayer(layer)
    }
    keymap.dispatchCommand = ((name: string) => {
      dispatched.push(name)
    }) as typeof keymap.dispatchCommand
    const base = createTuiPluginApi({
      keymap,
      client: {
        file: {
          list: async (params: unknown) => {
            fileListInput = params
            if (input.filesFail) throw new Error("file list unavailable")
            return { data: (input.files ?? []).map((name) => ({ name })) }
          },
        },
      } as unknown as TuiPluginApi["client"],
    })
    const api = {
      ...base,
      kv,
      state: {
        ...base.state,
        provider: input.provider
          ? [{ id: input.provider, models: { model: { cost: { input: input.paid ? 3 : 0 } } } }]
          : [],
        session: { ...base.state.session, count: () => input.sessions ?? 0 },
      },
      slots: {
        register(plugin: { slots: { home_bottom?: () => JSX.Element } }) {
          homeBottom = plugin.slots.home_bottom
          return "intro"
        },
      },
      ui: {
        ...base.ui,
        toast(toast: { message: string }) {
          toasts.push(toast.message)
        },
        dialog: {
          ...base.ui.dialog,
          replace(render: () => JSX.Element, onClose?: () => void) {
            setDialog({ render, onClose })
          },
          clear() {
            dialog()?.onClose?.()
            setDialog(undefined)
          },
          get open() {
            return dialog() !== undefined
          },
        },
      },
    } as unknown as TuiPluginApi

    void (input.plugin ?? introPlugin).tui(api, undefined, pluginMeta)

    return (
      <TestTuiContexts>
        <OpencodeKeymapProvider keymap={keymap}>
          <TuiConfigProvider config={config}>
            <box>
              {input.extra?.()}
              {homeBottom?.()}
              {dialog()?.render()}
            </box>
          </TuiConfigProvider>
        </OpencodeKeymapProvider>
      </TestTuiContexts>
    )
  }

  const app = await testRender(() => <Harness />, { width: 100, height: 80 })
  await app.waitFor(() => commands.has("intro.open"))
  return {
    app,
    commands,
    dispatched,
    toasts,
    kv,
    close: () => {
      dialog()?.onClose?.()
      setDialog(undefined)
    },
    fileListInput: () => fileListInput,
  }
}

const pluginMeta = {
  id: "internal:home-intro",
  source: "internal",
  spec: "internal:home-intro",
  target: "internal:home-intro",
  first_time: 0,
  last_time: 0,
  time_changed: 0,
  load_count: 1,
  fingerprint: "test",
  state: "same",
} satisfies TuiPluginMeta
