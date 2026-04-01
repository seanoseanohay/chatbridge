# constraints.md
## Hard Limits

These constraints are non-negotiable. None may be changed without explicit human approval documented in `docs/decisions.md`.

---

## Codebase Constraints

**CB-1.** The base is a fork of `chatboxai/chatbox` at its current main branch. No upstream merges during the build week without explicit human approval.

**CB-2.** Modifications to existing Chatbox source files are limited to four seam points defined in `docs/architecture.md`. All other existing files are read-only.

**CB-3.** `src/main/`, `src/shared/`, and all existing `src/renderer/` files outside the four seam points must not be modified. New code goes in `src/plugin-runtime/`, `src/apps/`, and `server/`.

**CB-4.** The build must continue to produce a working Electron desktop app and a working web renderer build (`npm run build:web`). Neither target may be broken by plugin runtime additions.

---

## Security Constraints

**SC-1.** All third-party app UI runs in sandboxed iframes. The sandbox attribute must include `allow-scripts` and must never include `allow-same-origin`. No exceptions.

**SC-2.** The full `allow-same-origin` flag is permanently forbidden on all plugin iframes regardless of app identity or trust level.

**SC-3.** All postMessage events received from iframes must be validated against the plugin contract type schema before any processing. Events that fail validation are logged and discarded. They are never processed.

**SC-4.** The platform must never expose raw conversation history to an app. Only the structured `appStateSummary` field defined in `docs/architecture.md` may be passed to app context.

**SC-5.** App origins must be validated against the allowlist in the plugin registry before any iframe is created. Unregistered origins are rejected.

**SC-6.** Third-party OAuth tokens (Spotify) must be stored server-side only. They must never be exposed to the renderer process or to the app iframe.

**SC-7.** Content Security Policy headers must be set on the backend API. The iframe `src` CSP directive must restrict frame sources to the allowlisted app origins only.

---

## Architecture Constraints

**AC-1.** The plugin runtime must fail safely. If the plugin runtime throws or fails to initialize, the system must fall back to normal Chatbox chat behavior without crashing.

**AC-2.** Apps are allowlisted. There is no open registration endpoint accessible to arbitrary third parties. New apps are added by modifying the server-side registry config.

**AC-3.** The plugin runtime must not be the source of truth for persistent state. Durable state (app session records, move history, invocation logs) lives in the Postgres database on the backend.

**AC-4.** MCP runtime state is treated as ephemeral. It may be used for tool execution coordination but must be reconstructable from Postgres if lost.

**AC-5.** Redis is used for session caching only. It is not the primary store for any data that must survive a Redis restart.

**AC-6.** The Chatbox libsql database schema must not be modified. New persistent data lives in the backend Postgres schema.

---

## Dependency Constraints

**DC-1.** Node.js version must remain within 20.x to 22.x as required by Chatbox.

**DC-2.** Package manager is npm. pnpm is not supported by Chatbox and must not be used.

**DC-3.** New npm dependencies added to the root `package.json` require human approval. Dependencies added to `server/package.json` are at Codex discretion within reason.

**DC-4.** The existing Jotai state management in Chatbox must not be replaced or supplemented with a competing state library (Zustand, Redux, etc.) in the renderer.

---

## Deadline Constraint

**DL-1.** Final submission is Sunday 11:59 PM CT. All three apps (Chess, Weather, Spotify) must be functional and deployed at that time. Incomplete phases are not acceptable submissions.
