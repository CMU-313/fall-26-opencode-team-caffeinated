/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui"
import { testRender, useRenderer } from "@opentui/solid"
import type { TuiPluginApi, TuiPluginMeta } from "@opencode-ai/plugin/tui"
import { createSignal, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { TuiConfigProvider } from "../../src/config"
import { OpencodeKeymapProvider } from "../../src/keymap"
import introPlugin from "../../src/feature-plugins/home/intro"
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

async function renderIntro(input: { provider?: string; sessions?: number; files?: string[]; firstLaunch?: boolean }) {
  const commands = new Map<
    string,
    NonNullable<Parameters<TuiPluginApi["keymap"]["registerLayer"]>[0]["commands"]>[number]
  >()
  const dispatched: string[] = []
  const toasts: string[] = []
  const [dialog, setDialog] = createSignal<{ render: () => JSX.Element; onClose?: () => void }>()
  let homeBottom: (() => JSX.Element) | undefined
  let fileListInput: unknown
  // Reactive like the real KV store, so the intro re-renders when progress is saved or cleared
  // Other tests open the intro themselves, so stop it auto-opening even when a test runs alone
  const [values, setValues] = createStore<Record<string, unknown>>(
    input.firstLaunch ? {} : { intro_hide_on_launch: true },
  )
  const kv = {
    get: (name: string, fallback?: unknown) => (name in values ? values[name] : fallback),
    set: (name: string, value: unknown) => setValues(name, value),
    ready: true,
  } as TuiPluginApi["kv"]
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
        provider: input.provider ? [{ id: input.provider, models: { free: { cost: { input: 0 } } } }] : [],
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

    void introPlugin.tui(api, undefined, pluginMeta)

    return (
      <TestTuiContexts>
        <OpencodeKeymapProvider keymap={keymap}>
          <TuiConfigProvider config={config}>
            <box>
              {homeBottom?.()}
              {dialog()?.render()}
            </box>
          </TuiConfigProvider>
        </OpencodeKeymapProvider>
      </TestTuiContexts>
    )
  }

  const app = await testRender(() => <Harness />, { width: 100, height: 60 })
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
