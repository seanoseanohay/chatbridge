# architecture.md
## System Architecture

---

## Layer Overview

```
┌─────────────────────────────────────────────────────┐
│  Chatbox Renderer (existing, minimal modification)  │
│  React 18, Jotai, TanStack Router, Webpack          │
│  Components: Sidebar, MessageList, InputBox         │
│  State: settingsAtom, currentSessionAtom            │
│  Orchestration: session/generation.ts, stream-text.ts │
└─────────────────┬───────────────────────────────────┘
                  │ SEAM (4 points, defined below)
┌─────────────────▼───────────────────────────────────┐
│  Plugin Runtime (new: src/plugin-runtime/)          │
│  Registry, session manager, AppFrame, event bus     │
│  Jotai atoms: activeAppSessionAtom, pluginStateAtom │
└─────────────────┬───────────────────────────────────┘
                  │ postMessage (validated, typed)
┌─────────────────▼───────────────────────────────────┐
│  Sandboxed Iframes (third-party apps)               │
│  sandbox="allow-scripts allow-forms"                │
│  No allow-same-origin. No DOM access.               │
└─────────────────────────────────────────────────────┘
                  │ HTTP / SSE
┌─────────────────▼───────────────────────────────────┐
│  Backend API (new: server/)                         │
│  Express, Postgres, Redis, OAuth broker             │
└─────────────────────────────────────────────────────┘
```

---

## The Four Seam Points

These are the only four locations in existing Chatbox files that may be modified. All other existing files are read-only.

### Seam 1: Tool Routing in stream-text.ts
**File:** `src/renderer/packages/model-calls/stream-text.ts`
**Change:** When constructing the `tools` object for `model.chat()`, add plugin tools alongside the existing MCP tool set from `mcpController.getAvailableTools()`. Plugin tools must execute through `pluginRuntime.invokePluginTool()`, while non-plugin tools continue unchanged through the existing MCP and built-in tool paths.
**Risk:** Low. The branch is additive. The existing MCP path is untouched for non-plugin tools.

### Seam 2: Message Renderer Extension in MessageList
**File:** `src/renderer/components/chat/MessageList.tsx`
**Change:** Add a docked app host in the chat layout that renders `<AppFrame>` in a right-side panel when an active app session exists for the current conversation. The conversation history remains visible and the input stays usable while the app runs.
**Risk:** Low. Existing message rendering stays unchanged. Only the chat layout gains an additive app panel.

### Seam 3: App Context Injection in stream-text.ts
**File:** `src/renderer/packages/model-calls/stream-text.ts`
**Change:** Before building the messages array for the API call, check whether an active app session exists (`activeAppSessionAtom`). If it does, prepend a system message containing the `appStateSummary` from the current app session. If not, build messages unchanged.
**Risk:** Medium. This modifies context window content. The injected message must be short and structured. Test that it does not corrupt existing message formatting.

### Seam 4: Plugin Atoms in uiAtoms.ts
**File:** `src/renderer/stores/atoms/uiAtoms.ts`
**Change:** Add two new Jotai atoms: `activeAppSessionAtom` (holds the current app session ID and status, nullable) and `pluginRegistryAtom` (holds the list of available apps for the current session, populated at startup).
**Risk:** Low. New atoms do not affect existing atoms.

---

## New File Locations

All new code goes in these directories. Nothing else.

```
src/
  plugin-runtime/
    types.ts            Plugin contract TypeScript types (written first)
    registry.ts         Client-side registry access (reads from backend)
    runtime.ts          Tool routing, app session lifecycle
    AppFrame.tsx        Sandboxed iframe host component
    eventBus.ts         postMessage send/receive with validation
    atoms.ts            activeAppSessionAtom, pluginRegistryAtom

  apps/
    chess/
      manifest.json     App manifest
      index.html        App entry point (sandboxed)
      chess.ts          Game logic
    weather/
      manifest.json
      index.html
      weather.ts
    spotify/
      manifest.json
      index.html
      spotify.ts

server/
  index.ts              Express entry point
  routes/
    apps.ts             App registration and registry endpoints
    sessions.ts         App session CRUD
    auth.ts             Platform auth (JWT issue/verify)
    oauth.ts            Spotify OAuth broker
    invocations.ts      Tool invocation log
  db/
    schema.sql          Postgres schema (canonical)
    client.ts           Postgres connection
  cache/
    client.ts           Redis connection
  middleware/
    auth.ts             JWT verification middleware
    validate.ts         Request body validation
```

---

## Plugin Contract

### App Manifest Shape

```typescript
interface AppManifest {
  id: string;                // Unique, URL-safe, e.g. "chess-v1"
  name: string;              // Display name
  version: string;           // Semver string
  origin: string;            // Trusted iframe origin, e.g. "https://apps.chatbridge.app"
  tools: ToolDefinition[];   // One or more tool definitions
  requiresAuth: boolean;     // Whether platform must broker OAuth before launch
  authProvider?: string;     // e.g. "spotify" — required if requiresAuth is true
}
```

### Tool Definition Shape

```typescript
interface ToolDefinition {
  name: string;              // Unique within the app, e.g. "chess_move"
  description: string;       // Natural language description for the LLM
  parameters: JSONSchema;    // JSON Schema object for input parameters
  returns: JSONSchema;       // JSON Schema object for return value shape
}
```

### postMessage Event Shapes

All events from platform to app:

```typescript
type PlatformToAppEvent =
  | { type: 'INIT_APP';    sessionId: string; config: Record<string, unknown> }
  | { type: 'INVOKE_TOOL'; sessionId: string; seq: number; toolName: string; params: Record<string, unknown> }
  | { type: 'APP_ERROR';   sessionId: string; error: string };
```

All events from app to platform:

```typescript
type AppToPlatformEvent =
  | { type: 'APP_READY';        sessionId: string }
  | { type: 'APP_STATE_UPDATE'; sessionId: string; seq: number; stateSummary: string }
  | { type: 'APP_RESULT';       sessionId: string; seq: number; toolName: string; result: unknown }
  | { type: 'APP_COMPLETE';     sessionId: string; result: AppResult }
  | { type: 'APP_ERROR';        sessionId: string; error: string };

interface AppResult {
  summary: string;           // Human-readable summary injected into chat context
  data: Record<string, unknown>; // Structured data for assistant reasoning
}
```

### Message Ordering

Every INVOKE_TOOL carries a monotonically increasing `seq` number. Every APP_RESULT and APP_STATE_UPDATE echoes the `seq` from its corresponding INVOKE_TOOL. The runtime discards results with a seq lower than the last received seq for that session.

---

## App State Summary Injection

When an active app session exists, the following system message is prepended to the LLM context. It must not exceed 300 tokens.

```
[ACTIVE APP: {appName}]
Session: {sessionId}
Status: {status}
Summary: {appStateSummary}
```

`appStateSummary` is the `stateSummary` string from the most recent `APP_STATE_UPDATE` event. For Chess, this is a compact board description and move count. For Weather, it is the last queried location and conditions. For Spotify, it is the playlist title and track count.

---

## Phase 0 Confirmed Upstream Anchors

Confirmed against upstream Chatbox commit `4bf64ec3`:

- Seam 1 tool assembly anchor: `src/renderer/packages/model-calls/stream-text.ts:295`
- Seam 3 message injection anchor: `src/renderer/packages/model-calls/stream-text.ts:178`
- Seam 4 atom insertion anchor: `src/renderer/stores/atoms/uiAtoms.ts:28`
- Seam 2 message renderer anchor: `src/renderer/components/chat/MessageList.tsx:346`
- Chat generation entry point: `src/renderer/stores/session/generation.ts:110`
- Message content-part union: `src/shared/types/session.ts:120`

---

## Backend Postgres Schema

```sql
-- Users (platform auth)
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,         -- bcrypt hash
  tenant_id   UUID NOT NULL,
  role        TEXT NOT NULL DEFAULT 'student',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Registered apps (allowlist)
CREATE TABLE app_registrations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id      TEXT UNIQUE NOT NULL,  -- e.g. "chess-v1"
  manifest    JSONB NOT NULL,
  origin      TEXT NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Active app sessions
CREATE TABLE app_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT NOT NULL,     -- Chatbox session ID
  user_id         UUID REFERENCES users(id),
  app_id          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active',  -- active | complete | error
  state_summary   TEXT,
  result          JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON app_sessions (conversation_id, app_id);

-- Tool invocation log
CREATE TABLE invocations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID REFERENCES app_sessions(id),
  user_id     UUID REFERENCES users(id),
  tool_name   TEXT NOT NULL,
  params      JSONB NOT NULL,
  result      JSONB,
  status      TEXT NOT NULL,  -- success | error | timeout
  latency_ms  INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- OAuth tokens (Spotify)
CREATE TABLE oauth_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id),
  provider        TEXT NOT NULL,   -- e.g. "spotify"
  access_token    TEXT NOT NULL,
  refresh_token   TEXT NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);
```

---

## AppState Summary Format per App

**Chess:**
```
Turn {n}. {activeColor} to move. Position: {FEN string, abbreviated}.
```

**Weather:**
```
Last query: {location}. Conditions: {summary}. Temp: {temp}.
```

**Spotify:**
```
Playlist "{title}" in progress. {trackCount} tracks. Auth: connected.
```
