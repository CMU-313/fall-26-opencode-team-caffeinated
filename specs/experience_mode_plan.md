Feature summary
Add an experience mode to OpenCode so users can choose how much explanation the assistant gives.
The modes are:
- Beginner
  - Explain concepts thoroughly for someone new to software engineering.
  - For implementations, fully explain meaningful code sections, their purpose, and how they work together.
  - Discuss design decisions, but keep the implementation explanation central.
- Intermediate
  - Assume basic software-engineering knowledge.
  - Explain implementations concisely, without assuming expert context.
  - Discuss design choices.
  - When a material choice is unclear, ask the developer and explain the options and tradeoffs.
- Expert
  - Be concise and implementation-first.
  - Give only a short explanation after an implementation unless more detail is requested.
  - State design decisions explicitly.
  - When a material design choice is unclear, ask the developer instead of choosing speculatively.
The user invokes the mode picker with the `/skill-mode` slash command, following the
same command-menu interaction pattern as `/models` and `/connect`. It is not a
persistent control on the main prompt surface, and `ctrl+e` must not open it.

`/skill-mode` immediately opens a first selector with Beginner, Intermediate, and
Expert. Selecting a mode immediately opens a second selector that determines
the selection's scope:
- For this and future sessions
- For this session only
- For the next prompt only

The command itself is not included in, or submitted as, a user prompt.
Required behavior
Mode is a session-level setting.
- Every session has its own stored experienceMode.
- Changing a session’s mode affects future provider turns in that session.
- Changing Session B does not alter Session A.
- A durable local preference supplies the default for future sessions.
- Choosing “For this and future sessions” updates both the selected session and
  the durable local preference used by later sessions.
- Choosing “For this session only” updates the selected session without
  changing the durable local preference.
- Choosing “For the next prompt only” does not update either stored session
  mode or the durable preference. It applies only to the immediately following
  submitted prompt, then subsequent prompts use the previously stored session
  mode again.
- A session created with an explicit persistent mode also updates the
  future-session default. On the first prompt of a new session, all three
  scopes are available: persistent selection is passed during creation,
  session-only selection is applied immediately after creation, and a
  next-prompt selection is sent only with the first prompt.
- A newly created session with no explicit mode inherits the stored preference.
- The initial default is intermediate.
- The one-prompt override is transient: it must not appear as a changed mode in
  session list/get responses, sync state, or a later session load.
Example:
1. Session A starts as Beginner.
2. Session B starts as Beginner.
3. Session B changes to Intermediate.
4. Future prompts in Session B use Intermediate.
5. Session A continues to use Beginner.
6. Session C starts as Intermediate.
Critical architecture decision
This feature must target the legacy session system, not the V2 API.
The currently active product paths use the legacy OpenCode session API and runner:
- App uses legacy /session/... routes.
- TUI uses the legacy JavaScript SDK and /session/... routes.
- CLI and opencode run use the legacy session service.
- The legacy prompt runner constructs the provider requests used in ordinary product use.
The newer V2 API (/api/session/...) and V2 session runner are not the active product path for these clients. Therefore:
- Do not add V2 protocol endpoints.
- Do not add V2 API client bindings.
- Do not change V2 session schemas, V2 durable events, or the V2 runner for this feature.
- Do not build a parallel V2 implementation.
The legacy API and legacy database-backed session service are the source of behavior for this feature.
Data model
Use the existing Core SQLite database, because legacy sessions already use the Core session table.
Add these fields/tables:
session
  experience_mode TEXT NOT NULL DEFAULT 'intermediate'

session_preference
  id INTEGER PRIMARY KEY
  experience_mode TEXT NOT NULL DEFAULT 'intermediate'
  time_updated INTEGER NOT NULL
session_preference is a local singleton row, using a fixed id = 1.
The mode type should be a shared typed union:
type ExperienceMode = "beginner" | "intermediate" | "expert"
It may live in the shared Schema package so Core database definitions, legacy OpenCode session schemas, HTTP validation, SDK generation, and UI controls use the same values. Sharing the type does not mean exposing or implementing it through V2.
Legacy API changes
Extend the legacy /session contract.
Legacy session response
Every legacy session response should expose:
experienceMode: "beginner" | "intermediate" | "expert"
This includes at least:
- GET /session
- GET /session/:sessionID
- POST /session
- PATCH /session/:sessionID
- session forks, where applicable
- session data emitted through the existing legacy sync/update system
Existing persisted sessions migrate to intermediate through the database default.
Legacy session creation
Extend legacy POST /session input:
{
  // existing fields...
  experienceMode?: "beginner" | "intermediate" | "expert"
}
Behavior:
- Omitted: read session_preference.experience_mode.
- Supplied: use it for the new session and write it to session_preference.
- The created session response returns the resolved mode.
Legacy session update
Extend legacy PATCH /session/:sessionID input:
{
  // existing fields...
  experienceMode?: "beginner" | "intermediate" | "expert",
  experienceModeScope?: "session" | "session_and_preference"
}
Behavior:
- Update only the selected session’s session.experience_mode.
- When experienceModeScope is `session_and_preference`, also update
  session_preference.experience_mode.
- When experienceModeScope is `session`, leave session_preference unchanged.
- For backwards compatibility, an update that supplies experienceMode without
  experienceModeScope uses `session_and_preference`.
- Update the session’s normal time_updated.
- Return the updated session.
- Do not alter other sessions.
A dedicated route such as POST /session/:sessionID/experience-mode is unnecessary for this version; the existing legacy session update endpoint is the natural compatibility surface.

Legacy prompt override
Extend the legacy prompt submission input with an optional transient field:
{
  // existing fields...
  experienceMode?: "beginner" | "intermediate" | "expert"
}
Behavior:
- When omitted, construct the provider request from the session’s stored mode.
- When supplied by `/skill-mode` with “For the next prompt only,” use it only for
  that submitted prompt’s provider request.
- Do not persist it to session.experience_mode or session_preference, and do
  not expose it as a session update/sync event.
- The override applies to the complete execution started by that prompt,
  including provider continuation turns and tool-loop continuations, so a
  single user request has one consistent response style.
Legacy session-service changes
In packages/opencode/src/session/session.ts:
- Add experienceMode to the legacy Session.Info schema and TypeScript type.
- Map SessionTable.experience_mode in fromRow.
- Ensure all legacy session list/get operations naturally expose it through fromRow.
- Add a typed mode field to legacy session creation input.
- Resolve a new session’s mode from either explicit creation input or the singleton preference.
- Persist explicit creation choices as the future default.
- Add a setExperienceMode operation to the legacy session service, or incorporate it cleanly into the existing update pathway.
- Support explicit session-only and session-and-preference update scopes.
- Update the mode and preference in a database transaction for the
  session-and-preference scope, so they do not diverge.
- Preserve the selected mode when creating a fork. A fork should inherit its source session’s mode unless an explicit product decision says otherwise; inheritance is the sensible behavior for this version.
No V2 SessionV2.Service dependency should be introduced into the legacy session service.
Legacy prompt-runner changes
In packages/opencode/src/session/prompt.ts, add a dedicated system instruction
based on the stored legacy session experienceMode or the transient prompt
override when one is supplied.
The instruction should be built from one reusable helper, for example:
ExperienceMode.instruction(session.experienceMode)
Insert it in the existing system-prompt assembly sequence alongside existing environment, global instructions, MCP guidance, and skills guidance.
Recommended ordering:
environment context
global/agent instructions
experience-mode instruction
MCP instructions
skills instructions
structured-output instruction, if applicable
The exact surrounding ordering should follow existing prompt semantics, but the mode instruction must be present for every normal legacy provider turn.
It should not be inserted as a user-visible chat message. It is a system instruction sent to the provider.
SDK changes
The App and TUI use the legacy JavaScript SDK.
After updating the legacy OpenAPI session group:
./packages/sdk/js/script/build.ts
This must regenerate:
- legacy session response types;
- legacy session create input;
- legacy session update input;
- any generated OpenAPI declarations used by App and TUI.
Do not manually edit generated SDK files.
App implementation
Add a `/skill-mode` slash command to both App composer variants:
- classic PromptInput;
- V2 PromptInputV2Composer.
Behavior:
- Entering or selecting `/skill-mode` immediately opens the existing command-style
  selector for Beginner, Intermediate, or Expert, then opens a second selector
  with the three scope labels above.
- Remove the `ctrl+e` binding for response-style selection; it remains
  available to the normal input editing behavior.
- On an existing session:
  - for “For this and future sessions,” call legacy PATCH /session/:sessionID
    with experienceMode and `experienceModeScope: "session_and_preference"`;
  - for “For this session only,” call legacy PATCH /session/:sessionID with
    experienceMode and `experienceModeScope: "session"`;
  - for “For the next prompt only,” retain a transient pending override in the
    composer and include it in the next legacy prompt submission, then clear it
    after that submission is admitted;
  - update the UI from the returned session/sync state;
  - show a useful error toast if persistence fails.
- On a new-session composer:
  - offer all three scopes;
  - for “For this and future sessions,” include the selected mode in POST
    /session when the user submits the first prompt;
  - for “For this session only,” create the session with its stored default,
    then immediately apply a session-only update before submitting the prompt;
  - for “For the next prompt only,” create the session with its stored default
    and include the selected mode only in the first prompt submission;
  - use the server-provided default initially.
- Preserve editor focus after a selection, consistent with model/agent controls.
- Add accessible labels and stable data-action identifiers for tests.
- Use existing i18n infrastructure for visible labels and descriptions.
Suggested wording:
Response style
Beginner — Detailed explanations for learning
Intermediate — Balanced explanations and tradeoffs
Expert — Concise, implementation-first responses
The App must not infer mode solely from local storage. The server/database remains authoritative.

Display the active stored mode adjacent to the model name in the prompt
metadata, using semantic mode colors: green for Beginner, yellow for
Intermediate, and red for Expert. A next-prompt-only override may additionally
be indicated until submission, but it must not replace the displayed stored
mode as if it were persistent.
TUI implementation
Add the `/skill-mode` slash command and its two-step selector flow to the TUI prompt
input, using the existing command and selection/dialog patterns.
Behavior:
- Display the active stored mode next to the existing agent/model metadata:
  Beginner in green, Intermediate in yellow, and Expert in red.
- `/skill-mode` first selects the mode, then selects its scope; no `ctrl+e`
  response-style binding is present.
- On an existing session, use the appropriate scoped legacy session update for
  persistent and session-only choices.
- For a next-prompt-only choice, retain a transient override and include it in
  the next legacy prompt submission, clearing it when the prompt is admitted.
- On a new session, offer all three scopes: pass persistent selection as
  experienceMode during creation, apply session-only selection after creation,
  and include next-prompt selection only in the first prompt submission.
- Refresh displayed state from the returned/synced legacy session.
- Avoid storing an independent permanent TUI-only preference.
The TUI may use a short visible label:
Beginner
Intermediate
Expert
or abbreviated labels only if the picker clearly presents the full names.
Commit plan
Commit 1: Legacy persistence and API
Proposed title:
feat(session): persist legacy experience modes
Includes:
- shared ExperienceMode schema/type;
- database migration for session.experience_mode;
- database migration for local session_preference;
- legacy Session.Info and Session.CreateInput changes;
- legacy session create/get/list/fork persistence behavior;
- scoped legacy PATCH /session/:sessionID mode update;
- transient legacy prompt override input;
- legacy OpenAPI schema updates;
- regenerated legacy JavaScript SDK;
- tests for persistence and API behavior.
Does not include:
- legacy provider prompt instruction;
- App UI;
- TUI UI;
- V2 changes.
Commit 2: Legacy provider behavior
Proposed title:
feat(session): apply legacy experience mode instructions
Includes:
- reusable mode-instruction helper;
- insertion into legacy prompt request construction;
- request-construction tests for Beginner, Intermediate, and Expert;
- recorded HTTP fixture updates where request bodies now include a system message.
Does not include UI.
Commit 3: App and TUI slash-command selectors
Proposed title:
feat(app): add experience mode slash selector
Includes:
- App classic-composer `/skill-mode` selector flow;
- App V2-composer `/skill-mode` selector flow;
- TUI `/skill-mode` selector flow;
- scope selector and persistent, session-only, and next-prompt behavior;
- removal of the `ctrl+e` response-style binding;
- semantic mode colors next to prompt model metadata;
- new-session selection state;
- existing-session update behavior;
- client/UI tests;
- translations.
Validation plan
Commit 1
Run from the relevant package directories:
cd packages/core
bun run migration -- --name add_legacy_experience_mode
bun run migration -- --check
bun typecheck
bun test
cd packages/opencode
bun typecheck
bun test test/session
bun test:httpapi
Regenerate the legacy SDK:
./packages/sdk/js/script/build.ts
Then typecheck the generated SDK and consuming clients:
cd packages/sdk/js
bun typecheck
cd packages/app
bun typecheck
cd packages/tui
bun typecheck
Required test cases:
- existing sessions decode as Intermediate after migration;
- create without explicit mode uses Intermediate when no preference exists;
- explicit Beginner creation stores Beginner on the session and preference;
- a later creation without explicit mode inherits Beginner;
- changing Session B to Expert leaves Session A unchanged;
- a later Session C inherits Expert;
- a session-only change does not alter the preference used by Session C;
- session get/list/create/update responses expose the selected mode;
- fork inherits its source mode;
- invalid mode values are rejected by the legacy HTTP schema.
Commit 2
cd packages/opencode
bun typecheck
bun test test/session
bun test test/server
Required tests:
- Beginner system instruction is present in provider request.
- Intermediate system instruction is present in provider request.
- Expert system instruction is present in provider request.
- The instruction is not stored as a user-visible message.
- A next-prompt-only override applies to its submitted prompt and continuation
  turns, while the following prompt returns to the stored session mode.
- A next-prompt-only override does not update session or preference storage.
- Existing agent, skills, MCP, environment, structured-output, and continuation behavior remains intact.
- Recorded transport tests pass after fixture updates.
Commit 3
cd packages/app
bun typecheck
bun test:unit
bun test:browser
cd packages/tui
bun typecheck
bun test
Required UI tests:
- `/skill-mode` opens the mode selector on both App composer variants and TUI;
- choosing a mode opens the scope selector with all three labels;
- `ctrl+e` does not open the response-style selector;
- persistent selection updates an existing session and preference through the
  legacy API;
- session-only selection updates only the existing session;
- next-prompt-only selection is sent with one prompt, then cleared;
- persistent selected mode is included when creating a new session;
- active prompt metadata shows Beginner green, Intermediate yellow, and Expert
  red;
- failure preserves/reverts UI state appropriately and shows an error;
- a different session’s displayed mode does not change.
Explicit non-goals
- General per-message mode overrides beyond the explicit one-next-prompt flow.
- Changes to V2 API routes or V2 generated clients.
- Changes to V2 session persistence, events, or runner.
- Syncing preference across machines/accounts.
- Automatically changing an existing session’s mode when the global preference changes.
- Letting model/provider configuration override the chosen mode.
