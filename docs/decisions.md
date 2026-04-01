# decisions.md
## Closed Architectural Decisions

Each entry records what was decided, why, and what alternatives were rejected. These decisions are closed. Codex must not reopen them. If a decision creates an unforeseen problem during implementation, surface it as a question rather than silently overriding it.

---

## D-01: Plugin Transport — postMessage over Extending Chatbox MCP

**Decision:** The plugin runtime uses a postMessage event bus between the renderer and sandboxed iframes as the primary transport for tool invocation and app communication. Chatbox's existing MCP integration (`@modelcontextprotocol/sdk`) is used only as the adapter layer through which the LLM selects and invokes tools — it is not extended to carry app UI state or iframe communication.

**Rationale:** Chatbox's MCP layer is designed for server-to-server tool calls. It has no concept of iframe lifecycle, UI rendering, or completion signaling. Extending it to carry those semantics would require deep modifications to `sessionActions.ts` and `stream-text.ts` and would create a fragile coupling between app UI state and the MCP protocol. postMessage is the correct browser primitive for sandboxed iframe communication: it is explicit, inspectable, and enforces the isolation boundary by design.

**Alternatives rejected:**
- Extending Chatbox MCP to carry iframe events: rejected because it requires invasive changes to core session orchestration and creates a protocol mismatch.
- WebSocket channel between backend and iframe: rejected because it adds network round-trips to operations that are local to the renderer, and complicates the iframe sandbox CSP requirements.
- Custom events on the DOM: rejected because they cannot cross iframe sandbox boundaries.

---

## D-02: Seam Strategy — Intercept in sessionActions.ts

**Decision:** The plugin runtime intercepts tool-eligible turns by wrapping the tool resolution step inside `src/renderer/stores/sessionActions.ts`. This is one of four permitted seam points. The wrapper checks whether the resolved tool name maps to a registered plugin app; if it does, it hands control to the plugin runtime instead of passing the tool call through the existing MCP path.

**Rationale:** `sessionActions.ts` is the single orchestration point for all AI turn logic in Chatbox. It is the correct and minimal place to branch plugin tool calls from native MCP tool calls. Intercepting here means Chatbox's message building, streaming, and history persistence all continue to work unchanged.

**Alternatives rejected:**
- Intercepting in `stream-text.ts`: rejected because that layer is provider-specific and mixing plugin routing there would break the provider abstraction.
- Middleware wrapping the provider's `chat()` call: rejected because it would intercept all turns, not just tool-eligible ones.

---

## D-03: State Ownership — Hybrid Model

**Decision:** Apps manage their own internal state. The platform backend (Postgres) persists durable records: app session ID, conversation linkage, structured state snapshots, and invocation history. The renderer holds only the current active app session ID and loading state in Jotai atoms. MCP runtime state is ephemeral and reconstructable.

**Rationale:** Full centralization (platform owns all state) creates tight coupling and requires every app to push every state change through the platform. Full independence (apps own all state) means the assistant cannot reason about app context after page refresh or app switch. The hybrid model gives apps autonomy while ensuring the assistant always has a recoverable, structured summary.

**Alternatives rejected:**
- Full platform ownership: rejected because it requires a synchronous state channel for every app interaction, creating latency and coupling.
- Full app ownership: rejected because app sessions are not resumable after reload and the assistant cannot reference prior app results.

---

## D-04: Database — Postgres for Backend, No Changes to Chatbox libsql

**Decision:** New persistent data (app registrations, app sessions, invocation logs, OAuth tokens, user accounts) lives in a Postgres database managed by the new backend service. The Chatbox libsql database that stores conversation history and settings is not modified. No foreign keys or joins cross this boundary.

**Rationale:** Modifying the Chatbox libsql schema would require writing and testing a migration against a format that is not documented for extension. The risk of breaking existing session history is unacceptable. The backend Postgres database is purpose-built for the new data and has no legacy schema concerns.

**Alternatives rejected:**
- Extending libsql with new tables: rejected due to migration risk and lack of documentation for schema extension.
- Using only libsql for everything: rejected because it runs in the Electron main process via IPC, which creates a bottleneck for the backend API serving app sessions.

---

## D-05: App Sandbox — Sandboxed Iframes with Strict Flags

**Decision:** All third-party apps run in iframes with `sandbox="allow-scripts allow-forms"`. The `allow-same-origin` flag is never added. Communication is exclusively via `window.postMessage`. Apps cannot access `window.parent`, the parent DOM, or any Chatbox internals.

**Rationale:** `allow-same-origin` combined with `allow-scripts` would allow a sandboxed iframe to escape the sandbox entirely by accessing `document.domain`. This is not acceptable in a K-12 environment. The constraint that students' session data cannot be accessed by third-party apps is non-negotiable.

**Alternatives rejected:**
- Web Components for app embedding: rejected because they share the same DOM and cannot provide the same isolation guarantee.
- Server-side rendering of app UI: rejected because it eliminates app autonomy over UI and requires the platform to understand every app's rendering logic.

---

## D-06: LLM Provider — OpenAI Function Calling

**Decision:** The plugin runtime uses OpenAI function calling to invoke plugin tools. Tool schemas from the plugin registry are injected into the model context as OpenAI function definitions. Only tool schemas for currently active or available apps are injected — not all registered schemas.

**Rationale:** Chatbox's `AbstractAISDKModel` already has `isSupportToolUse()`. OpenAI's function calling produces reliable structured parameter output. Injecting only active schemas keeps the context window manageable and prevents the model from attempting to invoke tools for apps that are not loaded.

**Alternatives rejected:**
- Anthropic tool use: not rejected on merit; OpenAI is chosen because the existing Chatbox integration already handles OpenAI function calling output format.
- Injecting all tool schemas at all times: rejected because it fills the context window and increases the probability of incorrect tool routing.

---

## D-07: Auth — Email/Password for Platform, OAuth 2.0 Backend Broker for Spotify

**Decision:** Platform authentication uses email and password stored as salted bcrypt hashes, with JWT tokens issued on login. JWT carries user ID, tenant ID, and role. Spotify uses OAuth 2.0 with the backend acting as the broker. The backend exchanges the authorization code, stores the access and refresh tokens in Postgres, and injects the access token into tool calls on the user's behalf. The renderer and app iframe never see the Spotify token.

**Rationale:** Server-side token storage is the only acceptable pattern for OAuth tokens in a K-12 environment. Tokens in the renderer or in localStorage can be extracted by malicious app code. The backend broker pattern keeps secrets server-side while still allowing the app to make authenticated API calls through the platform.

**Alternatives rejected:**
- PKCE flow in the renderer: rejected because it still results in access tokens in the browser.
- Storing tokens in Chatbox's libsql: rejected per D-04.

---

## D-08: Real-Time Chat — SSE for Streaming, postMessage for App Events

**Decision:** The backend uses Server-Sent Events for streaming AI token output to the renderer. Chatbox's existing SSE streaming infrastructure is reused. The postMessage event bus handles all app-to-platform events within the renderer. There is no new WebSocket channel.

**Rationale:** Chatbox already implements SSE streaming in `stream-text.ts`. Adding a WebSocket channel for the same renderer would require managing two connection types and two reconnection strategies. postMessage covers the app communication case entirely within the renderer without a network round-trip.

**Alternatives rejected:**
- WebSockets for both chat and app events: rejected because it replaces working Chatbox infrastructure unnecessarily.
- Polling for app state: rejected because it cannot deliver sub-second completion signaling reliably.

---

## D-09: Completion Signaling — APP_COMPLETE Event with Structured Payload

**Decision:** When an app finishes its task, it fires `APP_COMPLETE` via postMessage with a structured payload: `{ type: 'APP_COMPLETE', sessionId: string, result: AppResult }`. The plugin runtime receives this, writes the result to Postgres, and injects a tool result message into the conversation context. The assistant then resumes streaming. The chat never waits silently for completion.

**Rationale:** Completion signaling is the most common failure point in plugin systems. Making it explicit, typed, and platform-handled (rather than app-handled) ensures consistent behavior regardless of which app fires it. The platform — not the app — decides when the assistant resumes.

**Alternatives rejected:**
- Apps posting a message to the chat directly: rejected because it bypasses the platform's context merge step and produces inconsistent conversation history.
- Polling the backend for completion: rejected because it adds latency and complexity for an event that the app already knows has occurred.

---

## D-10: Deployment — Managed Cloud for Backend, Static/Electron for Frontend

**Decision:** The backend API (Express + Postgres + Redis) deploys to Railway or Render with managed database and cache add-ons. The Electron desktop app is packaged with `electron-builder`. The web renderer is served as a static site from the same managed deployment.

**Rationale:** Managed deployment removes ops burden during a one-week sprint. Railway and Render both provide Postgres and Redis as first-class add-ons with no separate provisioning step.

**Alternatives rejected:**
- Self-managed VPS: rejected because provisioning time is not available within the sprint timeline.
- Serverless functions: rejected because the backend needs persistent WebSocket/SSE connections and a long-lived Redis connection for session caching.
