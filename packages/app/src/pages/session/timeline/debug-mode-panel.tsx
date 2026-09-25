import { For, Show, onMount } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import {
  advanceDebugStep,
  debugFailureKey,
  debugSteps,
  readDebugProgress,
  writeDebugProgress,
  type DebugFailure,
} from "./debug-mode"

export function DebugModePanel(props: { sessionID: string; failure: DebugFailure }) {
  const language = useLanguage()
  const steps = debugSteps(props.failure)
  const storageKey = `opencode.debug-mode:${props.sessionID}:${debugFailureKey(props.failure)}`
  const [state, setState] = createStore({ enabled: false, completed: 0 })

  onMount(() => setState(readDebugProgress(localStorage, storageKey)))

  const save = (next: { enabled?: boolean; completed?: number }) => {
    const progress = {
      enabled: next.enabled ?? state.enabled,
      completed: next.completed ?? state.completed,
    }
    setState(progress)
    writeDebugProgress(localStorage, storageKey, progress)
  }

  return (
    <section class="mt-3 rounded-[6px] border border-border-weak-base bg-background-stronger p-3" data-debug-mode>
      <button
        type="button"
        class="flex w-full items-center justify-between text-left text-13-medium text-text-strong"
        aria-pressed={state.enabled}
        onClick={() => save({ enabled: !state.enabled })}
      >
        <span>{language.t("command.steps.toggle")}</span>
        <span class="text-12-regular text-text-weak">{state.enabled ? language.t("debugBar.on") : language.t("debugBar.off")}</span>
      </button>
      <Show when={state.enabled}>
        <ol class="mt-3 flex flex-col gap-2 border-s-2 border-border-weak-base ps-3">
          <For each={steps}>
            {(step, index) => {
              const complete = () => index() < state.completed
              return (
                <li class="flex gap-2 text-12-regular" classList={{ "text-text-weak": complete(), "text-text-strong": !complete() }}>
                  <button
                    type="button"
                    class="mt-0.5 size-4 shrink-0 rounded-full border border-border-base text-10-medium"
                    aria-label={language.t("command.steps.toggle.description")}
                    aria-pressed={complete()}
                    onClick={() => save({ completed: advanceDebugStep(state, index()).completed })}
                  >
                    {complete() ? "x" : index() + 1}
                  </button>
                  <div class="min-w-0">
                    <div>
                      {language.t(
                        step.id === "reproduce"
                          ? "debugMode.reproduce"
                          : step.id === "rerun"
                            ? "debugMode.rerun"
                            : "debugMode.inspect",
                        {
                          command: props.failure.command,
                          exit: props.failure.exit ?? "non-zero",
                          kind: step.kind ?? "exception",
                        },
                      )}
                    </div>
                    <Show when={step.evidence}>
                      {(evidence) => <code class="mt-1 block whitespace-pre-wrap break-words text-11-regular text-text-weak">{evidence()}</code>}
                    </Show>
                  </div>
                </li>
              )
            }}
          </For>
        </ol>
      </Show>
    </section>
  )
}