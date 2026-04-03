# requirements.md
## Functional and Non-Functional Requirements

Requirements are numbered and testable. Each must be verifiable by running a specific action and observing a specific outcome. Codex uses these as acceptance criteria.

---

## Platform Core

**R-01.** The application runs as an Electron desktop app (`npm run dev`) without errors on Node.js 20-22.

**R-02.** The application renders as a web app (`npm run serve:web`) without errors in Chrome and Firefox.

**R-03.** Existing Chatbox functionality (multi-turn conversation, streaming, session history, model switching) works identically after all plugin runtime additions are applied.

**R-04.** If the backend API is unreachable at startup, the application loads and chat works normally. Plugin features display a "Apps unavailable" notice. No crash occurs.

**R-05.** If the plugin runtime throws an unhandled error during a tool invocation, the error is caught, logged, and a structured error message is injected into the chat. The conversation continues.

---

## Backend API

**R-10.** `POST /api/auth/register` with valid email and password returns a 201 with a JWT. The password is stored as a bcrypt hash. The plaintext password is never logged or stored.

**R-11.** `POST /api/auth/login` with valid credentials returns a 200 with a JWT. Invalid credentials return a 401. The response time is under 500ms.

**R-12.** All endpoints except `/api/auth/register` and `/api/auth/login` and `/api/oauth/spotify/callback` return 401 if no valid JWT is present in the Authorization header.

**R-13.** `GET /api/apps` returns the list of enabled apps from the registry. Disabled apps are excluded. The response includes the full manifest for each app.

**R-14.** `POST /api/sessions` with a valid `appId` and `conversationId` creates an app session record in Postgres and returns the session ID. Creating a session for an app not in the registry returns 404.

**R-15.** `PATCH /api/sessions/:id` with `status: 'complete'` and a `result` payload updates the session record and returns 200. Patching a session belonging to a different user returns 403.

**R-16.** `POST /api/sessions/:id/invocations` writes an invocation record with timestamp, tool name, params, result, status, and latency. Returns 201.

---

## Plugin Registry and Manifest Validation

**R-20.** At application startup, the plugin runtime fetches the app list from `GET /api/apps` and populates `pluginRegistryAtom`. If the fetch fails, `pluginRegistryAtom` is set to an empty array.

**R-21.** A manifest with a missing `id`, `name`, `version`, `origin`, or `tools` field is rejected at registration time with a descriptive error. It is not added to the registry.

**R-22.** A tool definition with a missing `name`, `description`, or `parameters` field is rejected. The entire manifest is rejected if any tool definition is invalid.

**R-23.** An iframe `src` that does not match the `origin` field in the registered manifest is not created. The runtime logs the mismatch and returns an error to the chat.

---

## Tool Routing and Invocation

**R-30.** When the LLM returns a tool call, the plugin runtime checks the tool name against the registry. If the tool name matches a registered plugin tool, the plugin runtime handles it. If not, the existing MCP path handles it.

**R-31.** `invokePluginTool()` sends an `INVOKE_TOOL` event with a unique monotonically increasing `seq` number to the app iframe.

**R-32.** If no `APP_RESULT` is received within 15 seconds of sending `INVOKE_TOOL`, the runtime sends `APP_ERROR` to the iframe, logs the timeout to the invocation table with `status: 'timeout'`, and injects a structured timeout message into the chat.

**R-33.** An `APP_RESULT` with a `seq` lower than the last received `seq` for that session is discarded without processing.

**R-34.** A successful tool invocation is logged to the invocations table with status, latency, params, and result before the result is injected into the chat.

---

## App Frame and Embedding

**R-40.** AppFrame renders a loading spinner immediately after INIT_APP is sent. The spinner remains until APP_READY is received or a 10-second timeout occurs.

**R-41.** If APP_READY is not received within 10 seconds, AppFrame renders an error panel with a retry button. Clicking retry re-sends INIT_APP without reloading the page.

**R-42.** AppFrame iframes have `sandbox="allow-scripts allow-forms"` and no other sandbox flags. Verifiable by inspecting the DOM.

**R-43.** AppFrame is rendered inside the chat window as a docked app panel. The conversation history and input remain visible while the app is open.

**R-44.** When APP_COMPLETE is received, the AppFrame remains visible but enters a "completed" visual state. The conversation input field becomes active again.

---

## Completion Signaling and Context

**R-50.** When APP_COMPLETE is received, the runtime writes the result to the app session record in Postgres before injecting the tool result into the conversation.

**R-51.** The tool result message injected after APP_COMPLETE uses `result.summary` as the human-readable content and `result.data` as structured context available to the LLM.

**R-52.** After APP_COMPLETE is processed, the LLM receives the tool result and resumes generating a response. The response references the app result content. The chat does not remain silent.

**R-53.** When an active app session exists, the app state summary is prepended to the LLM context as a system message. The system message does not exceed 300 tokens. Its presence is verifiable by logging the messages array before the LLM call.

**R-54.** After APP_COMPLETE, if the user asks a follow-up question about the app result, the assistant's response reflects the result content without requiring the user to repeat it.

---

## Chess App

**R-60.** Typing "let's play chess" (case-insensitive) causes the assistant to invoke `chess_start`. The chess board AppFrame renders in the chat within 2 seconds of the tool call.

**R-61.** All moves entered by the user are validated for legality before being accepted. An illegal move returns an `APP_RESULT` with `error: 'illegal_move'` and a description. The board does not update.

**R-62.** During a game, the user can ask "what should I do here?" and the assistant responds with a move suggestion based on the current board position (injected via the app state summary). The suggestion includes a reason.

**R-63.** When checkmate or stalemate occurs, the app fires `APP_COMPLETE` with a result summary including the outcome and final move count. The assistant then discusses the game.

**R-64.** The user can type "new game" and the assistant invokes `chess_start` again, creating a new app session. The previous game's AppFrame enters completed state.

---

## Weather Dashboard App

**R-70.** Typing a message that requests weather for a location (e.g. "what's the weather in Austin?") causes the assistant to invoke `weather_get`. The weather AppFrame renders with current conditions and a 5-day forecast.

**R-71.** The Weather app makes its API call through the ChatBridge weather endpoint backed by Open-Meteo. No user authentication is required.

**R-72.** If the location is not found by the API, the AppFrame displays an error state with the message "Location not found" and the user's input. The assistant acknowledges the failure in chat.

**R-73.** The app state summary for Weather includes the queried location and current conditions so the assistant can reference them in follow-up messages.

---

## Spotify Playlist Creator App

**R-80.** If the user triggers the Spotify app and has not connected their account, the assistant prompts them to connect. A "Connect Spotify" button appears in the chat or in the AppFrame.

**R-81.** Clicking "Connect Spotify" opens the Spotify OAuth flow. The redirect goes to the backend `/api/oauth/spotify/callback`. After successful auth, the user is returned to the app session with a visible "Connected" confirmation.

**R-82.** The OAuth callback stores the access token and refresh token in the `oauth_tokens` table. The tokens are never sent to the renderer.

**R-83.** Tool invocations that require the Spotify token retrieve it from Postgres on the backend. If the token is expired, the backend refreshes it automatically before making the Spotify API call.

**R-84.** The user can describe a playlist in chat (e.g. "make me a study playlist with 10 lo-fi tracks") and the assistant invokes `spotify_create_playlist`. The app creates the playlist in the user's Spotify account and fires `APP_COMPLETE` with the playlist URL and track list.

**R-85.** If the Spotify API returns an error, the AppFrame displays the error clearly and fires `APP_ERROR`. The assistant acknowledges the failure and offers to try again.

---

## Auth

**R-90.** A user who is not logged in cannot access any plugin feature. The registry fetch returns 401. Plugin tools are not injected into the model context.

**R-91.** JWT tokens expire after 24 hours. Expired tokens return 401 on all protected endpoints. The application prompts the user to log in again without crashing.

**R-92.** Passwords are hashed with bcrypt at cost factor 12 or higher.

---

## Non-Functional Requirements

**NF-01. Performance.** The AppFrame must render (iframe loads, APP_READY received) within 2 seconds on a local network. If it takes longer, a progress indicator is visible the entire time.

**NF-02. Performance.** Tool invocation round-trip (INVOKE_TOOL sent to APP_RESULT received) must complete within 5 seconds for Chess moves and Weather fetches under normal conditions. Spotify playlist creation may take up to 15 seconds.

**NF-03. Availability.** The backend must handle at least 50 concurrent users without response time degrading above 2x baseline. Tested with a basic load test before submission.

**NF-04. Isolation.** An app iframe must not be able to read or write to `window.parent` properties, access Chatbox state, or fire events on the parent document. Verifiable by attempting `window.parent.document.title` from inside the iframe and confirming it throws a SecurityError.

**NF-05. Feedback.** Every operation that takes longer than 500ms must display a visible progress indicator. This applies to: AppFrame loading, tool invocations, Spotify auth flow, playlist creation.

**NF-06. Error visibility.** All errors surfaced to the user must include enough context to understand what failed and what to do next. Generic "something went wrong" messages are not acceptable.

**NF-07. Graceful degradation.** All three of the following failure modes must be tested and handled: (1) iframe fails to load, (2) tool invocation times out, (3) backend is unreachable. Each must result in a readable error state, not a blank screen or a crash.
