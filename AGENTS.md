# AGENTS.md
## Codex Operating Instructions for ChatBridge

---

## What You Are Building

You are extending **Chatbox** (chatboxai/chatbox) with a plugin runtime that allows third-party apps to register tools, render UI inside the chat window, communicate bidirectionally with the assistant, and signal completion back into the conversation.

Chatbox is an Electron desktop app (React 18 + TypeScript + Jotai + TanStack Router + Webpack + libsql/SQLite). You are adding a new layer on top of it. You are not rewriting it.

---

## Document Authority Hierarchy

When information conflicts, resolve it in this order:

1. **Codebase** — for anything that already exists in Chatbox. What the code does is ground truth.
2. **docs/requirements.md** — for functional behavior of new code.
3. **docs/decisions.md** — for architectural choices already made. Do not re-litigate these.
4. **docs/constraints.md** — for hard limits. These are never negotiable.
5. **docs/scope.md** — for what is in and out of scope for this week.
6. **docs/phases.md** — for build order and gate conditions.

If you encounter a conflict not resolved by this hierarchy, stop and surface it as a question rather than making an assumption.

---

## What You Have Access To

- Terminal and bash for running builds, tests, and installs
- The Chatbox source code, already forked and present in this repo
- GitLab repo with push access
- The live deployed app URL for smoke testing

---

## Before Writing Any Code

1. Read `docs/architecture.md` and `docs/system-map.md` in full.
2. Read `docs/constraints.md`. Every item there is a hard stop.
3. Read `docs/decisions.md`. Every decision there is closed. Do not reopen it.
4. Read `docs/scope.md`. Understand what is explicitly out of scope.
5. Read `docs/phases.md`. Understand what gate you are currently working toward.
6. Read the relevant Chatbox source files before touching anything adjacent to them. The key files are listed in `docs/system-map.md`.

---

## How to Work

**Build vertically.** Complete one full integration (Chess) before adding the second app (Weather). Complete Weather before adding Spotify. Do not start a new app until the previous one passes all its acceptance criteria.

**Touch Chatbox files minimally.** The seam between Chatbox and the plugin runtime is defined in `docs/architecture.md`. New code goes in new files. Modifications to existing Chatbox files must be the smallest possible change needed to expose a hook point.

**Define interfaces before implementation.** The plugin contract (manifest shape, tool schema shape, postMessage event shapes) must be written as TypeScript types before any runtime code is written. These types live in `src/plugin-runtime/types.ts`.

**Test the contract before testing the app.** Write unit tests for manifest validation, tool schema validation, and event parsing before writing the app itself. If the contract tests do not pass, the app tests cannot be trusted.

**Never silence errors.** All tool invocations must return a structured result, success or failure. All postMessage events must be validated before processing. Unknown event types must be logged and discarded, not silently ignored.

---

## What You Can Decide Autonomously

- Internal component structure within new files you create
- Variable names, function signatures within new modules
- How to organize unit tests for new code
- CSS/styling choices for new UI elements (AppFrame, error panels)
- Whether to split a large new file into smaller modules

## What Requires a Human Checkpoint

- Any modification to an existing Chatbox file other than the four seam points defined in `docs/architecture.md`
- Any change to the plugin contract types after Phase 1 is complete
- Any schema migration to the Chatbox libsql database
- Adding a new npm dependency that is not already in `package.json`
- Deviating from the auth pattern specified for Spotify in `docs/decisions.md`
- Any change to iframe sandbox flags beyond what is specified in `docs/constraints.md`

---

## Per-Task Document Checklist

Before starting any task, identify its type below and re-read the listed docs and sections. This is not optional. Skipping this step is the most common cause of constraint violations mid-build.

**Before touching any existing Chatbox file:**
- `docs/constraints.md` CB-1, CB-2, CB-3
- `docs/architecture.md` — The Four Seam Points section
- `docs/system-map.md` — Files You Must Not Touch section

**Before writing any plugin contract code (types, eventBus, runtime):**
- `docs/architecture.md` — Plugin Contract section (all type definitions)
- `docs/decisions.md` D-01 (postMessage transport), D-09 (completion signaling)
- `docs/constraints.md` SC-3 (event validation before processing)

**Before writing or modifying AppFrame:**
- `docs/constraints.md` SC-1, SC-2 (iframe sandbox flags — never allow-same-origin)
- `docs/architecture.md` — AppFrame section in New File Locations
- `docs/requirements.md` R-40, R-41, R-42, R-43, R-44

**Before implementing the tool routing intercept (Seam 1):**
- `docs/architecture.md` — Seam 1 description
- `docs/decisions.md` D-02 (seam strategy), D-01 (why not extending MCP)
- `docs/system-map.md` — Where Plugin Runtime Intercepts section

**Before implementing app state summary injection (Seam 3):**
- `docs/architecture.md` — Seam 3 description and App State Summary Injection section
- `docs/requirements.md` R-53
- `docs/constraints.md` SC-4 (never expose full conversation history)

**Before implementing any backend route:**
- `docs/system-map.md` — Backend API Endpoints table
- `docs/architecture.md` — Backend Postgres Schema section
- `docs/constraints.md` AC-3, AC-5, AC-6

**Before implementing OAuth (Spotify):**
- `docs/decisions.md` D-07 (auth decision, backend broker pattern)
- `docs/constraints.md` SC-6 (tokens never sent to renderer)
- `docs/requirements.md` R-80 through R-85

**Before implementing completion signaling:**
- `docs/decisions.md` D-09 (APP_COMPLETE event, why not polling)
- `docs/requirements.md` R-50, R-51, R-52
- `docs/architecture.md` — APP_COMPLETE event shape in Plugin Contract section

**Before starting any new phase:**
- `docs/phases.md` — gate criteria for the phase you are entering
- `docs/evaluation.md` — any grader scenarios that phase's gate criteria cover

**Before adding any npm dependency:**
- `docs/constraints.md` DC-1, DC-2, DC-3
- If adding to root `package.json`: stop and get human approval first

**Before writing any test:**
- `docs/evaluation.md` — the requirement numbers the test must cover
- `docs/requirements.md` — the exact expected behavior for those requirement numbers

---

## Phase Gate Protocol

At the end of each phase, run the acceptance criteria listed in `docs/phases.md` for that phase. All criteria must pass before beginning the next phase. Do not proceed past a gate on a partial pass.

If a gate criterion is ambiguous or untestable as written, surface it as a question. Do not interpret it generously and move on.

---

## Forbidden Patterns

- Do not write to `src/main/`, `src/shared/`, or any existing `src/renderer/` files except at the four defined seam points.
- Do not use `localStorage` or `sessionStorage`. Chatbox uses libsql; new session state uses the backend Postgres store.
- Do not add iframe `allow-same-origin` to any sandboxed app frame. This is a hard security constraint.
- Do not inject the full conversation history into app context. Pass only the structured app-state summary.
- Do not implement an open app registry. Apps are allowlisted. New entries require explicit addition to the registry config.
- Do not use `any` types in plugin contract interfaces. All types must be explicit.
- Do not skip the manifest validation step on app registration. Unvalidated manifests must be rejected before any tool schemas are loaded.
