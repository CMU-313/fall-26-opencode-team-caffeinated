import { For } from "solid-js"
import { Button } from "@opencode-ai/ui/button"
import { Dialog } from "@opencode-ai/ui/dialog"
import { useDialog } from "@opencode-ai/ui/context/dialog"

type ExperienceMode = "beginner" | "intermediate" | "expert"
type ExperienceModeScope = "session" | "session_and_preference" | "next"

export function DialogSelectExperienceMode(props: {
  session: boolean
  onSelect: (mode: ExperienceMode, scope: ExperienceModeScope) => void
}) {
  const dialog = useDialog()
  const modes: { value: ExperienceMode; title: string; description: string }[] = [
    { value: "beginner", title: "Beginner", description: "Detailed explanations for learning" },
    { value: "intermediate", title: "Intermediate", description: "Balanced explanations and tradeoffs" },
    { value: "expert", title: "Expert", description: "Concise, implementation-first responses" },
  ]

  const chooseScope = (mode: ExperienceMode) => {
    const scopes: { value: ExperienceModeScope; title: string }[] = [
      { value: "session_and_preference", title: "For this and future sessions" },
      { value: "session", title: "For this session only" },
      { value: "next", title: "For the next prompt only" },
    ]
    void dialog.show(() => (
      <Dialog title="Apply response style">
        <div class="flex flex-col gap-2 p-3">
          <For each={scopes}>{(scope) => <Button onClick={() => props.onSelect(mode, scope.value)}>{scope.title}</Button>}</For>
        </div>
      </Dialog>
    ))
  }

  return (
    <Dialog title="Response style">
      <div class="flex flex-col gap-2 p-3">
        <For each={modes}>
          {(mode) => (
            <Button class="justify-start" onClick={() => chooseScope(mode.value)}>
              <span class="flex flex-col items-start"><span>{mode.title}</span><span class="text-text-weak">{mode.description}</span></span>
            </Button>
          )}
        </For>
      </div>
    </Dialog>
  )
}
