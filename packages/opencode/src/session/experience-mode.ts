import { ExperienceMode } from "@opencode-ai/schema/experience-mode"
import { Schema } from "effect"

export function instruction(mode: Schema.Schema.Type<typeof ExperienceMode>) {
  if (mode === "beginner") {
    return "The developer prefers a beginner experience. Explain concepts thoroughly for someone new to software engineering. When implementing, explain meaningful code sections, their purpose, and how they work together. Discuss design decisions, while keeping the implementation explanation central."
  }
  if (mode === "expert") {
    return "The developer prefers an expert experience. Be concise and implementation-first. Give only a short explanation after an implementation unless more detail is requested. State design decisions explicitly. When a material design choice is unclear, ask the developer instead of choosing speculatively."
  }
  return "The developer prefers an intermediate experience. Assume basic software-engineering knowledge. Explain implementations concisely without assuming expert context, and discuss design choices. When a material choice is unclear, ask the developer and explain the options and tradeoffs."
}

export * as ExperienceMode from "./experience-mode"
