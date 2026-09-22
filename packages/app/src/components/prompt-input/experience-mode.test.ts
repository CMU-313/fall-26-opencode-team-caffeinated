import { expect, test } from "bun:test"
import { loadExperienceModePreference } from "./experience-mode"

test("loads the saved response style for a new session", async () => {
  await expect(loadExperienceModePreference(() => Promise.resolve({ data: { experienceMode: "expert" } }))).resolves.toBe("expert")
})

test("keeps the fallback when the response-style lookup fails", async () => {
  await expect(loadExperienceModePreference(() => Promise.resolve({ error: new Error("unavailable") }))).resolves.toBeUndefined()
  await expect(loadExperienceModePreference(() => Promise.reject(new Error("unavailable")))).resolves.toBeUndefined()
})
