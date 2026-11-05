/** @jsxImportSource @opentui/solid */
import { expect } from "bun:test"
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui"
import { testRender, useRenderer } from "@opentui/solid"
import type { TuiPluginApi, TuiPluginMeta } from "@opencode-ai/plugin/tui"
import { createSignal, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { TuiConfigProvider } from "../../src/config"
import { OpencodeKeymapProvider } from "../../src/keymap"
import introPlugin from "../../src/feature-plugins/home/intro"
import type { BuiltinTuiPlugin } from "../../src/feature-plugins/builtins"
import { createTuiPluginApi } from "./tui-plugin"
import { createTuiResolvedConfig } from "./tui-runtime"
import { TestTuiContexts } from "./tui-environment"

// The intro auto-opens only once per process, so launch tests load their own copy of the module
export async function freshLaunch(name: string): Promise<BuiltinTuiPlugin> {
  const module: { default: BuiltinTuiPlugin } = await import(`../../src/feature-plugins/home/intro.tsx?${name}`)
  return module.default
}

export async function click(app: Awaited<ReturnType<typeof testRender>>, text: string) {
  const lines = app.captureCharFrame().split("\n")
  const y = lines.findIndex((line) => line.includes(text))
  expect(y).toBeGreaterThanOrEqual(0)
  await app.mockMouse.click(lines[y].indexOf(text), y)
  await app.renderOnce()
}

export async function renderIntro(input: {
  provider?: string
  paid?: boolean
  // Input cost of each model the provider offers (undefined = no cost info); overrides `paid`
  costs?: (number | undefined)[]
  sessions?: number
  files?: string[]
  filesFail?: boolean
  firstLaunch?: boolean
  hideOnLaunch?: boolean
  dialogOpen?: boolean
  plugin?: BuiltinTuiPlugin
  // Settings saved by an earlier run, used to simulate restarting OpenCode
  stored?: Record<string, unknown>
  // Rendered above the home screen, e.g. stand-ins for the controls the tour spotlights
  extra?: () => JSX.Element
}) {
  const commands = new Map<
    string,
    NonNullable<Parameters<TuiPluginApi["keymap"]["registerLayer"]>[0]["commands"]>[number]
  >()
  const dispatched: string[] = []
  const toasts: string[] = []
  // Every server call the intro makes, as "namespace.method"
  const calls: string[] = []
  const [dialog, setDialog] = createSignal<{ render: () => JSX.Element; onClose?: () => void } | undefined>(
    input.dialogOpen ? { render: () => <text>Another dialog</text> } : undefined,
  )
  let homeBottom: (() => JSX.Element) | undefined
  let fileListInput: unknown
  // Reactive like the real KV store, so the intro re-renders when progress is saved or cleared
  // Other tests open the intro themselves, so stop it auto-opening even when a test runs alone
  const [values, setValues] = createStore<Record<string, unknown>>({
    ...(input.firstLaunch && !input.hideOnLaunch ? {} : { intro_hide_on_launch: true }),
    ...input.stored,
  })
  const kv = {
    get: (name: string, fallback?: unknown) => (name in values ? values[name] : fallback),
    set: (name: string, value: unknown) => setValues(name, value),
    ready: true,
  } as TuiPluginApi["kv"]
  const config = createTuiResolvedConfig()
  // Answers any server call so nothing the intro does is hidden by a crash; only file.list returns data
  const client = new Proxy(
    {},
    {
      get: (_, namespace) =>
        new Proxy(
          {},
          {
            get: (_, method) => async (params: unknown) => {
              calls.push(`${String(namespace)}.${String(method)}`)
              if (namespace !== "file" || method !== "list") return { data: undefined }
              fileListInput = params
              if (input.filesFail) throw new Error("file list unavailable")
              return { data: (input.files ?? []).map((name) => ({ name })) }
            },
          },
        ),
    },
  ) as TuiPluginApi["client"]

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
    const base = createTuiPluginApi({ keymap, client })
    const api = {
      ...base,
      kv,
      state: {
        ...base.state,
        provider: input.provider
          ? [
              {
                id: input.provider,
                models: Object.fromEntries(
                  (input.costs ?? [input.paid ? 3 : 0]).map((cost, i) => [`model${i}`, cost === undefined ? {} : { cost: { input: cost } }]),
                ),
              },
            ]
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

  const app = await testRender(() => <Harness />, { width: 100, height: 60 })
  await app.waitFor(() => commands.has("intro.open"))
  return {
    app,
    commands,
    dispatched,
    toasts,
    calls,
    kv,
    // A copy of everything saved, as it would be written to disk
    saved: () => JSON.parse(JSON.stringify(values)) as Record<string, unknown>,
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
