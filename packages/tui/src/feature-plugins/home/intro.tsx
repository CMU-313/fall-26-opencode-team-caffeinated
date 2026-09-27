import type { TuiPlugin, TuiPluginApi } from "@opencode-ai/plugin/tui"
import type { BuiltinTuiPlugin } from "../builtins"
import { TextAttributes, type RGBA } from "@opentui/core"
import { createEffect, createMemo, createSignal, For, Show } from "solid-js"
import { useBindings, useCommandShortcut } from "../../keymap"
import { Link } from "../../ui/link"

const id = "internal:home-intro"

// Text wrapped in `backticks` is highlighted as something the user can type or press.
// `tryIt` runs a real OpenCode command so the user can practice the step right away.
const ABOUT =
  "OpenCode is an AI coding assistant that lives in your terminal. Tell it what you want in plain English and it reads your code, edits files, and runs commands for you. You can review and undo everything it does."

const STEPS = [
  {
    title: "Connect a model",
    body: "OpenCode needs an AI model to think with. Run `/connect` to sign in to a provider like Anthropic, OpenAI, or GitHub Copilot, or choose OpenCode Zen to try free models. Then run `/models` to pick which one to use.",
    tryIt: { label: "Open /connect", command: "provider.connect" },
    question: "Do I need to pay for a model?",
    answer:
      "No. OpenCode Zen includes free models you can start with. If you already pay for something like Claude, ChatGPT, or GitHub Copilot, connect that account with `/connect` and use those models instead.",
  },
  {
    title: "Ask for what you want",
    body: 'Type in the prompt box and press `enter`. Be specific, like you would with a teammate: "add a test for parseDate in src/date.ts" works much better than "write tests". Press `esc` to stop it if it heads the wrong way.',
    tryIt: undefined,
    question: "What makes a good request?",
    answer:
      'Say what to change, where, and how you will know it worked. For example: "In src/cart.ts, make applyDiscount ignore negative numbers and add a test for it." If it misunderstands, just reply with a correction, like you would to a person.',
  },
  {
    title: "Point it at the right files",
    body: "Type `@` and a file name to attach that file to your message. Start a message with `!` to run a shell command yourself, like `!npm test`. Run `/init` once in a new project so OpenCode writes an AGENTS.md file that explains how your project works.",
    tryIt: undefined,
    question: "What does /init do?",
    answer:
      "It looks through your project and writes an AGENTS.md file describing how it is built and how to run it. OpenCode reads that file at the start of every session, so it makes fewer wrong guesses. Commit it so your teammates get the same benefit.",
  },
  {
    title: "Plan first, then build",
    body: "Press `tab` to switch between two agents. Plan can only read and suggest, so it is safe for exploring ideas. Build can edit files and run commands. A good habit: talk the idea through in Plan, then switch to Build to make the change.",
    tryIt: { label: "See the agents", command: "agent.list" },
    question: "When should I use Plan instead of Build?",
    answer:
      "Use Plan when you are not sure what to do yet, like understanding unfamiliar code or comparing two approaches. It can't change files, so nothing breaks. Switch to Build once you know what you want.",
  },
  {
    title: "Review and undo",
    body: "Read the changes OpenCode shows you before moving on. If you don't like them, `/undo` rolls back the last message and its file changes, and `/redo` puts them back.",
    tryIt: undefined,
    question: "Can /undo take back everything?",
    answer:
      "It reverts the file edits in your project. It can't take back things that happened outside your project, like a `git push` or a message sent to another service, so read those commands before letting them run.",
  },
  {
    title: "Manage your conversations",
    body: "Each conversation is a session. Use `/new` when you switch tasks so old context doesn't confuse it, and `/sessions` to jump back to an earlier one. If a long session gets slow, `/compact` summarizes it.",
    tryIt: { label: "Open /sessions", command: "session.list" },
    question: "When should I start a new session?",
    answer:
      "Whenever you switch to a different task. A long conversation about one feature can confuse OpenCode when you ask about something unrelated. Old sessions are saved, so you can always go back with `/sessions`.",
  },
]

// Auto-open once per launch, not every time the user comes back to the home screen
let autoOpened = false

function open(api: TuiPluginApi) {
  // onClose runs on esc, clicking outside, or when another dialog replaces this one
  api.ui.dialog.replace(
    () => <Intro api={api} />,
    () => api.kv.set("intro_dismissed", true),
  )
  api.ui.dialog.setSize("large")
}

function Intro(props: { api: TuiPluginApi }) {
  const theme = () => props.api.theme.current
  const [expanded, setExpanded] = createSignal(0)
  const [answered, setAnswered] = createSignal(false)
  const [selected, setSelected] = createSignal(0)
  const read = () => props.api.kv.get<number[]>("intro_read", [])
  const palette = useCommandShortcut("command.palette.show")
  const agent = useCommandShortcut("agent.cycle")
  const stop = useCommandShortcut("session.interrupt")

  // Every selectable line: each step, the "try it" and question under the open step, then "see every command"
  const rows = createMemo(() => [
    ...STEPS.flatMap((step, index) => {
      if (index !== expanded()) return [{ kind: "step" as const, step: index }]
      return [
        { kind: "step" as const, step: index },
        ...(step.tryIt ? [{ kind: "try" as const, step: index }] : []),
        { kind: "question" as const, step: index },
      ]
    }),
    { kind: "commands" as const, step: -1 },
  ])

  createEffect(() => {
    if (expanded() < 0 || read().includes(expanded())) return
    props.api.kv.set("intro_read", [...read(), expanded()])
  })

  const select = (index: number) => {
    const row = rows()[index]
    setSelected(index)
    if (row.kind === "commands") return props.api.keymap.dispatchCommand("command.palette.show")
    if (row.kind === "try") return props.api.keymap.dispatchCommand(STEPS[row.step].tryIt?.command ?? "")
    if (row.kind === "question") return setAnswered(!answered())
    setAnswered(false)
    setExpanded(expanded() === row.step ? -1 : row.step)
  }

  useBindings(() => ({
    bindings: [
      { key: "up", desc: "Previous", group: "Intro", cmd: () => setSelected((i) => Math.max(0, i - 1)) },
      { key: "down", desc: "Next", group: "Intro", cmd: () => setSelected((i) => Math.min(rows().length - 1, i + 1)) },
      { key: "return", desc: "Open", group: "Intro", cmd: () => select(selected()) },
    ],
  }))

  return (
    <box paddingLeft={3} paddingRight={3} paddingBottom={1} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme().text}>
          <span style={{ fg: theme().primary }}>✦ </span>
          Welcome to OpenCode
        </text>
        <text fg={theme().textMuted} onMouseUp={() => props.api.ui.dialog.clear()}>
          esc
        </text>
      </box>
      <Highlight api={props.api} text={ABOUT} />

      <box>
        <text fg={theme().textMuted} paddingBottom={1}>
          GET STARTED{"  "}
          <span style={{ fg: theme().success }}>
            {read().length}/{STEPS.length} read
          </span>
        </text>
        <For each={rows()}>
          {(row, index) => {
            const color = (fallback: RGBA) => (selected() === index() ? theme().primary : fallback)
            const prefix = () => (selected() === index() ? "› " : "  ")
            const hover = () => setSelected(index())
            const click = () => select(index())
            const step = STEPS[row.step]
            if (row.kind === "commands")
              return (
                <box paddingTop={1}>
                  <text fg={color(theme().accent)} onMouseOver={hover} onMouseUp={click}>
                    {prefix()}⌘ See every command OpenCode has
                  </text>
                </box>
              )
            if (row.kind === "try")
              return (
                <box paddingLeft={5}>
                  <text fg={color(theme().success)} onMouseOver={hover} onMouseUp={click}>
                    {prefix()}▶ Try it: {step.tryIt?.label}
                  </text>
                </box>
              )
            if (row.kind === "question")
              return (
                <box paddingLeft={5} paddingBottom={1}>
                  <text fg={color(theme().accent)} onMouseOver={hover} onMouseUp={click}>
                    {prefix()}? {step.question}
                    <span style={{ fg: theme().textMuted }}>{answered() ? "  ▾" : "  ▸"}</span>
                  </text>
                  <Show when={answered()}>
                    <box paddingLeft={4} paddingTop={1}>
                      <Highlight api={props.api} text={step.answer} />
                    </box>
                  </Show>
                </box>
              )
            const done = () => read().includes(row.step)
            return (
              <box>
                <text fg={color(theme().text)} onMouseOver={hover} onMouseUp={click}>
                  {prefix()}
                  <span style={{ fg: done() ? theme().success : theme().textMuted }}>
                    {done() ? "✓" : row.step + 1}
                  </span>
                  {"  "}
                  {step.title}
                  <span style={{ fg: theme().textMuted }}>{expanded() === row.step ? "  ▾" : "  ▸"}</span>
                </text>
                <Show when={expanded() === row.step}>
                  <box paddingLeft={5} paddingTop={1} paddingBottom={1}>
                    <Highlight api={props.api} text={step.body} />
                  </box>
                </Show>
              </box>
            )
          }}
        </For>
      </box>

      <box>
        <text fg={theme().textMuted} paddingBottom={1}>
          QUICK KEYS
        </text>
        <text wrapMode="word">
          <For
            each={[
              [palette(), "all commands"],
              [agent(), "plan ↔ build"],
              [stop(), "stop"],
              ["@", "attach file"],
              ["!", "shell"],
              ["/", "slash commands"],
            ].filter((item) => item[0])}
          >
            {(item) => (
              <span style={{ fg: theme().textMuted }}>
                <span style={{ fg: theme().primary }}>{item[0]}</span> {item[1]}
                {"    "}
              </span>
            )}
          </For>
        </text>
      </box>

      <box flexDirection="row" justifyContent="space-between">
        <text fg={theme().textMuted}>↑↓ move · enter open · reopen anytime with /intro</text>
        <Link href="https://opencode.ai/docs" fg={theme().textMuted}>
          opencode.ai/docs
        </Link>
      </box>
    </box>
  )
}

function Highlight(props: { api: TuiPluginApi; text: string }) {
  const theme = () => props.api.theme.current
  return (
    <text wrapMode="word" fg={theme().textMuted}>
      <For each={props.text.split("`")}>
        {(part, index) => (index() % 2 === 1 ? <span style={{ fg: theme().primary }}>{part}</span> : part)}
      </For>
    </text>
  )
}

const tui: TuiPlugin = async (api) => {
  api.keymap.registerLayer({
    commands: [
      {
        name: "intro.open",
        title: "Intro to OpenCode",
        slashName: "intro",
        category: "System",
        namespace: "palette",
        run() {
          open(api)
        },
      },
    ],
  })

  api.slots.register({
    order: 50,
    slots: {
      home_bottom() {
        // Show the intro on launch until the user closes it once
        createEffect(() => {
          if (autoOpened || !api.kv.ready) return
          autoOpened = true
          if (!api.kv.get("intro_dismissed", false) && !api.ui.dialog.open) open(api)
        })
        return (
          <box paddingTop={2} flexShrink={0}>
            <text fg={api.theme.current.text} onMouseUp={() => open(api)}>
              <span style={{ fg: api.theme.current.primary }}>✦ </span>
              New to OpenCode? Open the intro
              <span style={{ fg: api.theme.current.textMuted }}>{"  "}click or type /intro</span>
            </text>
          </box>
        )
      },
    },
  })
}

const plugin: BuiltinTuiPlugin = {
  id,
  tui,
}

export default plugin
