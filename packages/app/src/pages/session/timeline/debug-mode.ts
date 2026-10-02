export type DebugFailure = {
  command: string
  output: string
  exit?: number
}

export type DebugStep = {
  id: "reproduce" | "inspect" | "rerun"
  kind?: "assertion" | "exception"
  evidence?: string
}

export type DebugProgress = {
  enabled: boolean
  completed: number
}

export function debugFailureKey(failure: DebugFailure) {
  return `${failure.command}\0${failure.exit ?? "unknown"}\0${failure.output}`
}

export function debugSteps(failure: DebugFailure): DebugStep[] {
  const output = failure.output.trim()
  const evidence = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /assert|expected|received|traceback|error|exception|at .+?:\d+/i.test(line))
  const type = /assert|expected|received|toBe|toEqual/i.test(output) ? "assertion" : "exception"

  return [
    {
      id: "reproduce",
      evidence: failure.command,
    },
    {
      id: "inspect",
      kind: type,
      evidence: evidence ?? output.split(/\r?\n/).find(Boolean),
    },
    {
      id: "rerun",
    },
  ]
}

export function readDebugProgress(storage: Pick<Storage, "getItem">, key: string): DebugProgress {
  try {
    const value = JSON.parse(storage.getItem(key) ?? "null") as Partial<DebugProgress> | null
    return {
      enabled: value?.enabled === true,
      completed: typeof value?.completed === "number" ? Math.max(0, Math.floor(value.completed)) : 0,
    }
  } catch {
    return { enabled: false, completed: 0 }
  }
}

export function writeDebugProgress(storage: Pick<Storage, "setItem">, key: string, progress: DebugProgress) {
  storage.setItem(key, JSON.stringify(progress))
}

export function advanceDebugStep(progress: DebugProgress, index: number): DebugProgress {
  return { ...progress, completed: index < progress.completed ? index : index + 1 }
}