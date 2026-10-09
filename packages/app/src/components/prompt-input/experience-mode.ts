export type ExperienceMode = "beginner" | "intermediate" | "expert"

export function loadExperienceModePreference(
  request: () => Promise<{ data?: { experienceMode?: ExperienceMode }; error?: unknown }>,
) {
  return request()
    .then((result) => (result.error ? undefined : result.data?.experienceMode))
    .catch(() => undefined)
}
