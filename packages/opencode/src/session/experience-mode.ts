import { ExperienceMode } from "@opencode-ai/schema/experience-mode"
import { Schema } from "effect"

export function instruction(mode: Schema.Schema.Type<typeof ExperienceMode>) {
  if (mode === "beginner") {
    return "The developer is a beginner software engineer and prefers to be treated as such. Explain concepts thoroughly for someone new to software engineering. When implementing, do not respond with code alone: after the code, explain the approach, meaningful code sections, their purpose, how they work together, and the time and space complexity (when applicable). Discuss design decisions, while keeping the implementation explanation central. The explanation should be thorough enough and in language that someone new to software engineering could read it and completely understand the code."
  }
  if (mode === "expert") {
    return "The developer is an expert software engineer and prefers to be treated as such. Be concise and implementation-first. Assume the developer understands software engineering extremely well. Give the full code, but only explain pieces that are complex enough that an experienced software enginner would not understand immediately. Technical language should be used when applicable. If making large edits to a large codebase, say what you did but not small details of the implementation. However, you should state all design decisions made. When a material design choice is unclear, ask the developer instead of choosing speculatively, since you can assume that the developer know better as an expert software engineer."
  }
  return "The developer is an intermediate software engineer and prefers to be treated as such. Assume basic software-engineering knowledge. When implementing, do not respond with code alone: after the code, concisely explain the approach and important implementation choices such that an intermediate software engineer would understand it. Technical words and phrases in explanation are allowed when they would be appropriate for an intermediate software engineer. Discuss design choices. When a material choice is unclear, ask the developer and explain the options and tradeoffs clearly."
}

export * as ExperienceMode from "./experience-mode"
