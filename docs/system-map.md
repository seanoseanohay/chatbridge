# system-map.md
## System Map

---

## Chatbox Internals Reference

These are the key files in the Chatbox codebase that the plugin runtime touches or must understand. Read these before writing any code that interacts with them.

### Files You Must Read Before Writing Code

| File | What It Does | Your Interaction |
|------|-------------|-----------------|
| `src/renderer/stores/sessionActions.ts` | Orchestrates all AI turns: builds context, calls stream-text, persists messages | Seam 1: intercept tool routing after LLM returns tool call |
| `src/renderer/packages/model-calls/stream-text.ts` | Calls the LLM provider, handles streaming tokens, processes tool use responses | Seam 3: inject app state summary before messages array is built |
| `src/renderer/stores/atoms/uiAtoms.ts` | Defines Jotai atoms for UI state: `settingsAtom`, `currentSessionAtom`, `showSidebarAtom` | Seam 4: add `activeAppSessionAtom` and `pluginRegistryAtom` |
| `src/renderer/components/MessageList.tsx` | Renders the chat message list. Each message type renders a different component | Seam 2: add conditional render for `type: 'app_frame'` messages |
| `src/shared/types.ts` | All shared TypeScript types: `Session`, `Message`, `SessionSettings`, `ModelInterface` | Read-only. Understand the `Message` type before adding `app_frame` |
| `src/shared/defaults.ts` | Default session settings, provider list, model capabilities | Read-only. Reference for understanding `isSupportToolUse()` |
| `src/shared/models/abstract-ai-sdk.ts` | Base class for all AI providers. Implements `chat()`, `isSupportToolUse()` | Read-only. Understand how tool results are returned to `sessionActions.ts` |
| `src/renderer/packages/model-calls/tools.ts` | Tool call processing helpers used by stream-text | Read-only. Understand tool result shape before writing plugin tool result injection |

### Files You Must Not Touch

All files in `src/main/` — Electron main process, IPC handlers, storage adapters.
All files in `src/shared/` — shared types and defaults.
All files in `src/renderer/` except the four seam points above.
All files in `.erb/` — Webpack build configuration.

---

## Chatbox Data Flow (Existing)

```
User types message
  -> InputBox captures input
  -> sessionActions.ts: submitMessage()
       -> builds context from currentSessionAtom + maxContextMessageCount
       -> queries Knowledge Base if enabled
       -> prepares MCP tools if configured
       -> calls stream-text.ts
           -> calls AbstractAISDKModel.chat()
           -> streams tokens back, updates Jotai atoms
           -> if tool call returned: processes via tools.ts
       -> persists final message to libsql via IPC
  -> MessageList re-renders with new message
```

### Where Plugin Runtime Intercepts (After This Week)

```
User types message
  -> InputBox captures input
  -> sessionActions.ts: submitMessage()
       -> builds context (SEAM 3: prepend app state summary if active session)
       -> calls stream-text.ts
           -> streams tokens
           -> if tool call returned:
               [SEAM 1] check plugin registry
               IF plugin tool -> pluginRuntime.invokePluginTool()
                   -> sends INVOKE_TOOL via eventBus to iframe
                   -> waits for APP_RESULT (with timeout)
                   -> injects result as tool result message
                   -> if APP_COMPLETE: merge result, resume assistant
               ELSE -> existing MCP path (unchanged)
  -> MessageList re-renders
      [SEAM 2] if message.type === 'app_frame' -> render AppFrame
```

---

## New Files Reference

### src/plugin-runtime/types.ts
Defines all plugin contract types. Written first, before any other new file. Contains:
- `AppManifest`
- `ToolDefinition`
- `PlatformToAppEvent` (discriminated union)
- `AppToPlatformEvent` (discriminated union)
- `AppResult`
- `AppSession`
- `PluginRegistryEntry`

### src/plugin-runtime/registry.ts
Client-side registry module. Fetches available apps from the backend at startup and on session change. Provides:
- `loadRegistry(): Promise<PluginRegistryEntry[]>` — fetches from `GET /api/apps`
- `resolveToolToApp(toolName: string): PluginRegistryEntry | null`
- `getAppManifest(appId: string): AppManifest | null`

### src/plugin-runtime/runtime.ts
Plugin session lifecycle and tool routing. Provides:
- `invokePluginTool(toolName: string, params: Record<string, unknown>, sessionId: string): Promise<unknown>`
- `startAppSession(appId: string, conversationId: string): Promise<AppSession>`
- `endAppSession(sessionId: string, result: AppResult): Promise<void>`
- `handleAppComplete(event: AppToPlatformEvent & { type: 'APP_COMPLETE' }): void`

### src/plugin-runtime/AppFrame.tsx
React component that renders a sandboxed iframe. Props:
- `appId: string`
- `sessionId: string`
- `src: string` — the app's URL (from manifest origin)
- `onReady: () => void`
- `onError: (error: string) => void`

Renders: loading spinner while waiting for APP_READY, error panel with retry if APP_ERROR received or iframe fails to load, the iframe itself once ready.

### src/plugin-runtime/eventBus.ts
postMessage send/receive with validation. Provides:
- `sendToApp(iframeRef: HTMLIFrameElement, event: PlatformToAppEvent): void`
- `registerAppListener(sessionId: string, handler: (event: AppToPlatformEvent) => void): () => void`

All incoming postMessage events are validated against the `AppToPlatformEvent` discriminated union before the handler is called. Invalid events are logged to console with the raw event data and discarded.

### server/db/schema.sql
Canonical Postgres schema. Defined in `docs/architecture.md`. This file is the source of truth for the database structure. Apply it with `psql $DATABASE_URL < server/db/schema.sql`.

---

## Backend API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/register | None | Create user account |
| POST | /api/auth/login | None | Issue JWT |
| GET | /api/apps | JWT | List available apps for current user |
| GET | /api/apps/:appId | JWT | Get app manifest |
| POST | /api/sessions | JWT | Create app session |
| GET | /api/sessions/:id | JWT | Get app session |
| PATCH | /api/sessions/:id | JWT | Update session status/state |
| POST | /api/sessions/:id/invocations | JWT | Log tool invocation |
| GET | /api/oauth/spotify/connect | JWT | Begin Spotify OAuth flow |
| GET | /api/oauth/spotify/callback | None | OAuth callback handler |
| POST | /api/oauth/spotify/refresh | JWT | Refresh Spotify token |
| DELETE | /api/oauth/spotify | JWT | Disconnect Spotify |

---

## Environment Variables

### Renderer / Electron
```
PLUGIN_BACKEND_URL=http://localhost:3001   # Backend API base URL
```

### Backend (server/.env)
```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...                             # min 32 chars, random
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
SPOTIFY_REDIRECT_URI=http://localhost:3001/api/oauth/spotify/callback
OPENWEATHER_API_KEY=...
```
