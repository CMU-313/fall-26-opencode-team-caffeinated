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
The user chooses a mode from a dropdown on the main prompt surface.
Required behavior
Mode is a session-level setting.
- Every session has its own stored experienceMode.
- Changing a session’s mode affects future provider turns in that session.
- Changing Session B does not alter Session A.
- A durable local preference supplies the default for future sessions.
- When a session mode is explicitly changed, that selected mode becomes the default for later sessions.
- A session created with an explicit mode also updates that future-session default.
- A newly created session with no explicit mode inherits the stored preference.
- The initial default is intermediate.
- Per-message overrides are explicitly out of scope for this version.
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
  experienceMode?: "beginner" | "intermediate" | "expert"
}
Behavior:
- Update only the selected session’s session.experience_mode.
- Update session_preference.experience_mode.
- Update the session’s normal time_updated.
- Return the updated session.
- Do not alter other sessions.
A dedicated route such as POST /session/:sessionID/experience-mode is unnecessary for this version; the existing legacy session update endpoint is the natural compatibility surface.
Legacy session-service changes
In packages/opencode/src/session/session.ts:
- Add experienceMode to the legacy Session.Info schema and TypeScript type.
- Map SessionTable.experience_mode in fromRow.
- Ensure all legacy session list/get operations naturally expose it through fromRow.
- Add a typed mode field to legacy session creation input.
- Resolve a new session’s mode from either explicit creation input or the singleton preference.
- Persist explicit creation choices as the future default.
- Add a setExperienceMode operation to the legacy session service, or incorporate it cleanly into the existing update pathway.
- Update mode and preference in a database transaction where practical, so the session update and default preference do not diverge.
- Preserve the selected mode when creating a fork. A fork should inherit its source session’s mode unless an explicit product decision says otherwise; inheritance is the sensible behavior for this version.
No V2 SessionV2.Service dependency should be introduced into the legacy session service.
Legacy prompt-runner changes
In packages/opencode/src/session/prompt.ts, add a dedicated system instruction based on the legacy session’s experienceMode.
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
Add the selector to both App composer variants:
- classic PromptInput;
- V2 PromptInputV2Composer.
Behavior:
- The control displays Beginner, Intermediate, or Expert.
- On an existing session:
  - call legacy PATCH /session/:sessionID with experienceMode;
  - update the UI from the returned session/sync state;
  - show a useful error toast if persistence fails.
- On a new-session composer:
  - maintain the selected mode in composer state;
  - include it in POST /session when the user submits the first prompt;
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
TUI implementation
Add a compact selector to the TUI prompt footer.
Behavior:
- Display the active mode next to the existing agent/model metadata.
- Offer a keyboard-accessible picker consistent with existing TUI selection/dialog patterns.
- On an existing session, call legacy session update with the selected mode.
- On a new session, retain the local selection until legacy session creation and pass it as experienceMode.
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
- legacy PATCH /session/:sessionID mode update;
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
Commit 3: App and TUI selectors
Proposed title:
feat(app): add experience mode selectors
Includes:
- App classic composer selector;
- App V2 composer selector;
- TUI prompt-footer selector;
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
- mode selector renders on both App composer variants;
- mode selector renders in TUI prompt footer;
- selecting mode updates an existing session through legacy API;
- selected mode is included when creating a new session;
- failure preserves/reverts UI state appropriately and shows an error;
- a different session’s displayed mode does not change.
Explicit non-goals
- Per-message mode override.
- Changes to V2 API routes or V2 generated clients.
- Changes to V2 session persistence, events, or runner.
- Syncing preference across machines/accounts.
- Automatically changing an existing session’s mode when the global preference changes.
- Letting model/provider configuration override the chosen mode.