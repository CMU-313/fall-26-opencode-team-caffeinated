import { expect, test } from "bun:test"
import introPlugin from "../../src/feature-plugins/home/intro"
import { createBuiltinPlugins } from "../../src/feature-plugins/builtins"
import { click, freshLaunch, renderIntro } from "../fixture/intro"

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
    // The intro opening step 4 on its own doesn't count as the user reading it
    await intro.app.waitForFrame((frame) => frame.includes("3/6 done"))
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
    // Steps 1, 2, 3, and 6 are verified; step 4 opens first but isn't read until the user opens it
    await intro.app.waitForFrame((frame) => frame.includes("4/6 done"))

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
