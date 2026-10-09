import { For } from "solid-js"
import { Button } from "@opencode-ai/ui/button"
import { Dialog } from "@opencode-ai/ui/dialog"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { useLanguage } from "@/context/language"

type ExperienceMode = "beginner" | "intermediate" | "expert"
type ExperienceModeScope = "session" | "session_and_preference" | "next"

export function DialogSelectExperienceMode(props: {
  session: boolean
  onSelect: (mode: ExperienceMode, scope: ExperienceModeScope) => void
}) {
  const dialog = useDialog()
  const language = useLanguage()
  const modes: { value: ExperienceMode; title: string; description: string }[] = [
    {
      value: "beginner",
      title: language.t("prompt.experienceMode.beginner"),
      description: language.t("prompt.experienceMode.beginner.description"),
    },
    {
      value: "intermediate",
      title: language.t("prompt.experienceMode.intermediate"),
      description: language.t("prompt.experienceMode.intermediate.description"),
    },
    {
      value: "expert",
      title: language.t("prompt.experienceMode.expert"),
      description: language.t("prompt.experienceMode.expert.description"),
    },
  ]

  const chooseScope = (mode: ExperienceMode) => {
    const scopes: { value: ExperienceModeScope; title: string }[] = [
      { value: "session_and_preference", title: language.t("prompt.experienceMode.scope.sessionAndPreference") },
      { value: "session", title: language.t("prompt.experienceMode.scope.session") },
      { value: "next", title: language.t("prompt.experienceMode.scope.next") },
    ]
    void dialog.show(() => (
      <Dialog title={language.t("prompt.experienceMode.applyTitle")}>
        <div class="flex flex-col gap-2 p-3">
          <For each={scopes}>{(scope) => <Button onClick={() => props.onSelect(mode, scope.value)}>{scope.title}</Button>}</For>
        </div>
      </Dialog>
    ))
  }

  return (
    <Dialog title={language.t("prompt.experienceMode.label")}>
      <div class="flex flex-col gap-2 p-3">
        <For each={modes}>
          {(mode) => (
            <Button class="justify-start" onClick={() => chooseScope(mode.value)}>
              <span class="flex items-center gap-2">
                <span>{mode.title}</span>
                <span class="text-text-weak">{mode.description}</span>
              </span>
            </Button>
          )}
        </For>
      </div>
    </Dialog>
  )
}
