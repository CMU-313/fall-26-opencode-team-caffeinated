import { createSignal, Show, type JSX } from "solid-js"
import { useTheme } from "../context/theme"

// Process-global like the dialog stack: one tour runs at a time, and it names the control to highlight
const [active, setActive] = createSignal<string>()

export const setSpotlight = setActive

// Wraps a home-screen control the intro tour can point at. While some target is spotlighted,
// the active one is framed and lifted above the dialog backdrop, and every other target fades.
// Switches between two boxes because toggling `border` on a mounted box doesn't reliably clear it
export function Spotlight(props: { id: string; children: JSX.Element }) {
  const { theme } = useTheme()
  return (
    <Show
      when={active() === props.id}
      fallback={
        <box opacity={active() === undefined ? 1 : 0.4} flexShrink={0}>
          {props.children}
        </box>
      }
    >
      <box border borderColor={theme.primary} zIndex={4000} flexShrink={0}>
        {props.children}
      </box>
    </Show>
  )
}
