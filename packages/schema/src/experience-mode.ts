import { Schema } from "effect"

export const ExperienceMode = Schema.Literals(["beginner", "intermediate", "expert"])
export type ExperienceMode = typeof ExperienceMode.Type
