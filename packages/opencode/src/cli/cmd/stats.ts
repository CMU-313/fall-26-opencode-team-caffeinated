import { Effect } from "effect"
import { and, eq, gte } from "drizzle-orm"
import { effectCmd } from "../effect-cmd"
import { Session } from "@/session/session"
import { NotFoundError } from "@/storage/storage"
import { Database } from "@opencode-ai/core/database/database"
import {
  SessionMessageLedgerTable,
  SessionTable,
  SessionUsageLedgerTable,
} from "@opencode-ai/core/session/sql"
import { Project } from "@/project/project"
import { ProjectV2 } from "@opencode-ai/core/project"
import { InstanceRef } from "@/effect/instance-ref"

interface SessionStats {
  totalSessions: number
  totalMessages: number
  totalCost: number
  totalTokens: {
    input: number
    output: number
    reasoning: number
    cache: {
      read: number
      write: number
    }
  }
  toolUsage: Record<string, number>
  modelUsage: Record<
    string,
    {
      messages: number
      tokens: {
        input: number
        output: number
        cache: {
          read: number
          write: number
        }
      }
      cost: number
    }
  >
  dateRange: {
    earliest: number
    latest: number
  }
  days: number
  costPerDay: number
  tokensPerSession: number
  medianTokensPerSession: number
}

export const StatsCommand = effectCmd({
  command: "stats",
  describe: "show token usage and cost statistics",
  builder: (yargs) =>
    yargs
      .option("days", {
        describe: "show stats for the last N days (default: all time)",
        type: "number",
      })
      .option("tools", {
        describe: "number of tools to show (default: all)",
        type: "number",
      })
      .option("models", {
        describe: "show model statistics (default: hidden). Pass a number to show top N, otherwise shows all",
      })
      .option("project", {
        describe: "filter by project (default: all projects, empty string: current project)",
        type: "string",
      }),
  handler: Effect.fn("Cli.stats")(function* (args) {
    const ctx = yield* InstanceRef
    if (!ctx) return
    const stats = yield* aggregateSessionStats(args.days, args.project, ctx.project)
    let modelLimit: number | undefined
    if (args.models === true) {
      modelLimit = Infinity
    } else if (typeof args.models === "number") {
      modelLimit = args.models
    }
    displayStats(stats, args.tools, modelLimit)
  }),
})

const getAllSessions = Effect.fnUntraced(function* () {
  const { db } = yield* Database.Service
  return (yield* db.select().from(SessionTable).all().pipe(Effect.orDie)).map((row) => Session.fromRow(row))
})

export const aggregateSessionStats = Effect.fn("Cli.stats.aggregate")(function* (
  days?: number,
  projectFilter?: string,
  currentProject?: Project.Info,
) {
  const svc = yield* Session.Service
  const { db } = yield* Database.Service
  const sessions = yield* getAllSessions()
  const MS_IN_DAY = 24 * 60 * 60 * 1000

  const cutoffTime = (() => {
    if (days === undefined) return 0
    if (days === 0) {
      const now = new Date()
      now.setHours(0, 0, 0, 0)
      return now.getTime()
    }
    return Date.now() - days * MS_IN_DAY
  })()

  const windowDays = (() => {
    if (days === undefined) return
    if (days === 0) return 1
    return days
  })()

  let filteredSessions = cutoffTime > 0 ? sessions.filter((session) => session.time.updated >= cutoffTime) : sessions

  if (projectFilter !== undefined) {
    if (projectFilter === "") {
      if (!currentProject) throw new Error("currentProject required when projectFilter is empty string")
      filteredSessions = filteredSessions.filter((session) => session.projectID === currentProject.id)
    } else {
      filteredSessions = filteredSessions.filter((session) => session.projectID === projectFilter)
    }
  }

  const projectID = (() => {
    if (projectFilter === undefined) return
    if (projectFilter === "") {
      if (!currentProject) throw new Error("currentProject required when projectFilter is empty string")
      return currentProject.id
    }
    return ProjectV2.ID.make(projectFilter)
  })()
  const messageConditions = []
  if (cutoffTime > 0) messageConditions.push(gte(SessionMessageLedgerTable.time_created, cutoffTime))
  if (projectID !== undefined) messageConditions.push(eq(SessionMessageLedgerTable.project_id, projectID))
  const messageRows = yield* db
    .select()
    .from(SessionMessageLedgerTable)
    .where(and(...messageConditions))
    .all()
    .pipe(Effect.orDie)

  const usageConditions = []
  if (cutoffTime > 0) usageConditions.push(gte(SessionUsageLedgerTable.time_created, cutoffTime))
  if (projectID !== undefined) usageConditions.push(eq(SessionUsageLedgerTable.project_id, projectID))
  const usageRows = yield* db
    .select()
    .from(SessionUsageLedgerTable)
    .where(and(...usageConditions))
    .all()
    .pipe(Effect.orDie)

  const stats: SessionStats = {
    totalSessions: filteredSessions.length,
    totalMessages: 0,
    totalCost: 0,
    totalTokens: {
      input: 0,
      output: 0,
      reasoning: 0,
      cache: {
        read: 0,
        write: 0,
      },
    },
    toolUsage: {},
    modelUsage: {},
    dateRange: {
      earliest: Date.now(),
      latest: Date.now(),
    },
    days: 0,
    costPerDay: 0,
    tokensPerSession: 0,
    medianTokensPerSession: 0,
  }

  if (filteredSessions.length > 1000) {
    console.log(`Large dataset detected (${filteredSessions.length} sessions). This may take a while...`)
  }

  let earliestTime = Date.now()
  let latestTime = 0
  const sessionTotalTokens = new Map(filteredSessions.map((session) => [session.id, 0]))

  for (const message of messageRows) {
    earliestTime = Math.min(earliestTime, message.time_created)
    latestTime = Math.max(latestTime, message.time_created)
    if (!sessionTotalTokens.has(message.session_id)) sessionTotalTokens.set(message.session_id, 0)
    if (message.role !== "assistant" || !message.provider_id || !message.model_id) continue
    const model = `${message.provider_id}/${message.model_id}`
    if (!stats.modelUsage[model]) {
      stats.modelUsage[model] = {
        messages: 0,
        tokens: { input: 0, output: 0, cache: { read: 0, write: 0 } },
        cost: 0,
      }
    }
    stats.modelUsage[model].messages++
  }

  for (const usage of usageRows) {
    earliestTime = Math.min(earliestTime, usage.time_created)
    latestTime = Math.max(latestTime, usage.time_created)
    stats.totalCost += usage.cost
    stats.totalTokens.input += usage.tokens_input
    stats.totalTokens.output += usage.tokens_output
    stats.totalTokens.reasoning += usage.tokens_reasoning
    stats.totalTokens.cache.read += usage.tokens_cache_read
    stats.totalTokens.cache.write += usage.tokens_cache_write
    sessionTotalTokens.set(
      usage.session_id,
      (sessionTotalTokens.get(usage.session_id) ?? 0) +
        usage.tokens_input +
        usage.tokens_output +
        usage.tokens_reasoning +
        usage.tokens_cache_read +
        usage.tokens_cache_write,
    )

    if (!usage.provider_id || !usage.model_id) continue
    const model = `${usage.provider_id}/${usage.model_id}`
    if (!stats.modelUsage[model]) {
      stats.modelUsage[model] = {
        messages: 0,
        tokens: { input: 0, output: 0, cache: { read: 0, write: 0 } },
        cost: 0,
      }
    }
    stats.modelUsage[model].cost += usage.cost
    stats.modelUsage[model].tokens.input += usage.tokens_input
    stats.modelUsage[model].tokens.output += usage.tokens_output + usage.tokens_reasoning
    stats.modelUsage[model].tokens.cache.read += usage.tokens_cache_read
    stats.modelUsage[model].tokens.cache.write += usage.tokens_cache_write
  }

  const toolResults = yield* Effect.forEach(
    filteredSessions,
    (session) =>
      Effect.gen(function* () {
        const messages = yield* svc
          .messages({ sessionID: session.id })
          .pipe(Effect.catchIf(NotFoundError.isInstance, () => Effect.succeed([])))

        const sessionToolUsage: Record<string, number> = {}
        for (const message of messages) {
          for (const part of message.parts) {
            if (part.type === "tool" && part.tool) {
              sessionToolUsage[part.tool] = (sessionToolUsage[part.tool] || 0) + 1
            }
          }
        }

        return {
          sessionToolUsage,
          earliestTime: cutoffTime > 0 ? session.time.updated : session.time.created,
          latestTime: session.time.updated,
        }
      }),
    { concurrency: 20 },
  )

  for (const session of filteredSessions) {
    earliestTime = Math.min(earliestTime, cutoffTime > 0 ? session.time.updated : session.time.created)
    latestTime = Math.max(latestTime, session.time.updated)
  }

  for (const result of toolResults) {
    earliestTime = Math.min(earliestTime, result.earliestTime)
    latestTime = Math.max(latestTime, result.latestTime)

    for (const [tool, count] of Object.entries(result.sessionToolUsage)) {
      stats.toolUsage[tool] = (stats.toolUsage[tool] || 0) + count
    }
  }

  stats.totalMessages = messageRows.length
  const rangeDays = Math.max(1, Math.ceil((latestTime - earliestTime) / MS_IN_DAY))
  const hasActivity = filteredSessions.length > 0 || messageRows.length > 0 || usageRows.length > 0
  if (!hasActivity) latestTime = earliestTime
  const effectiveDays = windowDays ?? (hasActivity ? rangeDays : 0)
  stats.dateRange = {
    earliest: earliestTime,
    latest: latestTime,
  }
  stats.days = effectiveDays
  stats.costPerDay = effectiveDays > 0 ? stats.totalCost / effectiveDays : 0
  const totalTokens =
    stats.totalTokens.input +
    stats.totalTokens.output +
    stats.totalTokens.reasoning +
    stats.totalTokens.cache.read +
    stats.totalTokens.cache.write
  const sessionTokenValues = [...sessionTotalTokens.values()]
  sessionTokenValues.sort((a, b) => a - b)
  const mid = Math.floor(sessionTokenValues.length / 2)
  stats.medianTokensPerSession =
    sessionTokenValues.length === 0
      ? 0
      : sessionTokenValues.length % 2 === 0
        ? (sessionTokenValues[mid - 1] + sessionTokenValues[mid]) / 2
        : sessionTokenValues[mid]
  stats.tokensPerSession =
    sessionTokenValues.length > 0 ? totalTokens / sessionTokenValues.length : 0

  return stats
})

export function displayStats(stats: SessionStats, toolLimit?: number, modelLimit?: number) {
  const width = 56

  function renderRow(label: string, value: string): string {
    const availableWidth = width - 1
    const paddingNeeded = availableWidth - label.length - value.length
    const padding = Math.max(0, paddingNeeded)
    return `│${label}${" ".repeat(padding)}${value} │`
  }

  // Overview section
  console.log("┌────────────────────────────────────────────────────────┐")
  console.log("│                       OVERVIEW                         │")
  console.log("├────────────────────────────────────────────────────────┤")
  console.log(renderRow("Sessions", stats.totalSessions.toLocaleString()))
  console.log(renderRow("Messages", stats.totalMessages.toLocaleString()))
  console.log(renderRow("Days", stats.days.toString()))
  console.log("└────────────────────────────────────────────────────────┘")
  console.log()

  // Cost & Tokens section
  console.log("┌────────────────────────────────────────────────────────┐")
  console.log("│                    COST & TOKENS                       │")
  console.log("├────────────────────────────────────────────────────────┤")
  const cost = isNaN(stats.totalCost) ? 0 : stats.totalCost
  const costPerDay = isNaN(stats.costPerDay) ? 0 : stats.costPerDay
  const tokensPerSession = isNaN(stats.tokensPerSession) ? 0 : stats.tokensPerSession
  console.log(renderRow("Total Cost", `$${cost.toFixed(2)}`))
  console.log(renderRow("Avg Cost/Day", `$${costPerDay.toFixed(2)}`))
  console.log(renderRow("Avg Tokens/Session", formatNumber(Math.round(tokensPerSession))))
  const medianTokensPerSession = isNaN(stats.medianTokensPerSession) ? 0 : stats.medianTokensPerSession
  console.log(renderRow("Median Tokens/Session", formatNumber(Math.round(medianTokensPerSession))))
  console.log(renderRow("Input", formatNumber(stats.totalTokens.input)))
  console.log(renderRow("Output", formatNumber(stats.totalTokens.output)))
  console.log(renderRow("Cache Read", formatNumber(stats.totalTokens.cache.read)))
  console.log(renderRow("Cache Write", formatNumber(stats.totalTokens.cache.write)))
  console.log("└────────────────────────────────────────────────────────┘")
  console.log()

  // Model Usage section
  if (modelLimit !== undefined && Object.keys(stats.modelUsage).length > 0) {
    const sortedModels = Object.entries(stats.modelUsage).sort(([, a], [, b]) => b.messages - a.messages)
    const modelsToDisplay = sortedModels.slice(0, modelLimit)

    console.log("┌────────────────────────────────────────────────────────┐")
    console.log("│                      MODEL USAGE                       │")
    console.log("├────────────────────────────────────────────────────────┤")

    for (const [model, usage] of modelsToDisplay) {
      console.log(`│ ${model.padEnd(54)} │`)
      console.log(renderRow("  Messages", usage.messages.toLocaleString()))
      console.log(renderRow("  Input Tokens", formatNumber(usage.tokens.input)))
      console.log(renderRow("  Output Tokens", formatNumber(usage.tokens.output)))
      console.log(renderRow("  Cache Read", formatNumber(usage.tokens.cache.read)))
      console.log(renderRow("  Cache Write", formatNumber(usage.tokens.cache.write)))
      console.log(renderRow("  Cost", `$${usage.cost.toFixed(4)}`))
      console.log("├────────────────────────────────────────────────────────┤")
    }
    // Remove last separator and add bottom border
    process.stdout.write("\x1B[1A") // Move up one line
    console.log("└────────────────────────────────────────────────────────┘")
  }
  console.log()

  // Tool Usage section
  if (Object.keys(stats.toolUsage).length > 0) {
    const sortedTools = Object.entries(stats.toolUsage).sort(([, a], [, b]) => b - a)
    const toolsToDisplay = toolLimit ? sortedTools.slice(0, toolLimit) : sortedTools

    console.log("┌────────────────────────────────────────────────────────┐")
    console.log("│                      TOOL USAGE                        │")
    console.log("├────────────────────────────────────────────────────────┤")

    const maxCount = Math.max(...toolsToDisplay.map(([, count]) => count))
    const totalToolUsage = Object.values(stats.toolUsage).reduce((a, b) => a + b, 0)

    for (const [tool, count] of toolsToDisplay) {
      const barLength = Math.max(1, Math.floor((count / maxCount) * 20))
      const bar = "█".repeat(barLength)
      const percentage = ((count / totalToolUsage) * 100).toFixed(1)

      const maxToolLength = 18
      const truncatedTool = tool.length > maxToolLength ? tool.substring(0, maxToolLength - 2) + ".." : tool
      const toolName = truncatedTool.padEnd(maxToolLength)

      const content = ` ${toolName} ${bar.padEnd(20)} ${count.toString().padStart(3)} (${percentage.padStart(4)}%)`
      const padding = Math.max(0, width - content.length - 1)
      console.log(`│${content}${" ".repeat(padding)} │`)
    }
    console.log("└────────────────────────────────────────────────────────┘")
  }
  console.log()
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M"
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K"
  }
  return num.toString()
}
