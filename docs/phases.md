# phases.md
## Build Phases

Phases are gate-based. A phase must fully pass its gate criteria before the next phase begins. Partial passes do not unlock the next phase.

---

## Phase 0: Read and Map (2 hours)
**Goal:** Understand the Chatbox codebase well enough to implement the four seam points without breaking anything.

**Tasks:**
1. Clone and run Chatbox locally. Confirm `npm run dev` opens the Electron app.
2. Confirm `npm run serve:web` renders the web version in a browser.
3. Read the eight key Chatbox files listed in `docs/system-map.md`.
4. Locate the exact line numbers for each of the four seam points in the actual forked code.
5. Document the exact current signature of `generate()` in `src/renderer/stores/session/generation.ts`, and note that `sessionActions.ts` is now a re-export facade.
6. Document the exact message content-part union in `src/shared/types/session.ts`.
7. Fill in `docs/architecture.md` Seam 2 with the confirmed filename for MessageList.
8. Fill in `docs/system-map.md` with the confirmed exact file paths after reading the repo.

**Gate criteria:**
- All four seam point locations confirmed with file + line number
- `npm run dev` runs without errors on the forked repo
- No code written yet

---

## Phase 1: Backend + Plugin Contract (Day 1, ~8 hours)
**Goal:** Backend API running locally. Plugin contract types written and unit tested. Chess app session can be created and logged.

**Tasks:**
1. Write `src/plugin-runtime/types.ts` with all types from `docs/architecture.md`.
2. Write unit tests for type validation (manifest validation, event shape validation).
3. Scaffold `server/` with Express, Postgres connection, Redis connection.
4. Apply `server/db/schema.sql` to local Postgres.
5. Implement auth routes: register, login, JWT middleware.
6. Implement app routes: GET /api/apps (returns hardcoded registry for now), POST /api/sessions, PATCH /api/sessions/:id.
7. Implement invocations route: POST /api/sessions/:id/invocations.
8. Add chess manifest to the server-side registry config.

**Gate criteria:**
- All type validation unit tests pass
- `POST /api/auth/register` and `POST /api/auth/login` work and return JWTs
- `GET /api/apps` returns the Chess manifest
- `POST /api/sessions` creates a session record in Postgres (verified by direct DB query)
- `POST /api/sessions/:id/invocations` writes an invocation record (verified by direct DB query)
- Requirements R-10, R-11, R-12, R-13, R-14, R-16 pass

---

## Phase 2: Chess End to End (Day 2-3, ~16 hours)
**Goal:** User can say "let's play chess", the board appears, they can play, ask for help, and finish. This is the full plugin lifecycle working for one app.

**Tasks:**
1. Implement `src/plugin-runtime/registry.ts` (fetches from backend, populates atom).
2. Implement Seam 4: add atoms to `uiAtoms.ts`.
3. Implement `src/plugin-runtime/eventBus.ts` (postMessage send/receive with validation).
4. Implement `src/plugin-runtime/AppFrame.tsx` (iframe, loading states, error panel).
5. Implement Seam 2: add the docked AppFrame host in MessageList.
6. Implement Seam 1: plugin tool injection in `src/renderer/packages/model-calls/stream-text.ts`.
7. Implement Seam 3: app state summary injection in `stream-text.ts`.
8. Implement `src/plugin-runtime/runtime.ts` (invokePluginTool, startAppSession, handleAppComplete).
9. Build Chess app: `src/apps/chess/` with manifest, game logic, iframe entry point.
10. Connect Chess to the event bus: handle INIT_APP, INVOKE_TOOL, fire APP_RESULT, APP_STATE_UPDATE, APP_COMPLETE.
11. Implement `PATCH /api/sessions/:id` on the backend to persist Chess game state summary.

**Gate criteria (all must pass before Phase 3):**
- R-03: existing Chatbox chat works identically (manual smoke test: send 3 messages, verify streaming, verify history)
- R-20: `pluginRegistryAtom` is populated at startup (verified via React DevTools or log)
- R-30: "let's play chess" routes to plugin runtime (verified via log, not MCP)
- R-40: AppFrame loading spinner appears immediately
- R-41: AppFrame error panel appears if APP_READY not received within 10s (verified by blocking the iframe URL)
- R-42: iframe has `sandbox="allow-scripts allow-forms"` and no other flags (verified by DOM inspection)
- R-43: AppFrame appears in the docked app panel within the chat window
- R-60: chess board renders within 2 seconds
- R-61: illegal move returns error, board does not update
- R-62: "what should I do here?" returns a move suggestion referencing current board state
- R-63: checkmate fires APP_COMPLETE, assistant discusses the game
- R-50: APP_COMPLETE writes result to Postgres (verified by direct DB query)
- R-52: assistant resumes after APP_COMPLETE without user prompting
- R-53: app state summary is present in messages array before LLM call (verified by log)
- R-04: if backend is stopped, chat still works and apps show "unavailable" notice
- NF-04: iframe cannot read `window.parent.document.title` (verified by trying in iframe console)

---

## Phase 3: Weather Dashboard (Day 4, ~6 hours)
**Goal:** Weather app works end to end. Proves the platform handles a stateless, no-auth app.

**Tasks:**
1. Build Weather app: `src/apps/weather/` with manifest, API call logic, display.
2. Add Weather manifest to server registry.
3. Add OPENWEATHER_API_KEY to environment config.
4. Implement `weather_get` tool routing in the plugin runtime (no new runtime code needed; this tests the existing routing).
5. Connect Weather to the event bus.

**Gate criteria (all must pass before Phase 4):**
- R-70: weather request routes correctly and board renders with conditions + forecast
- R-71: API call made from iframe, no user auth required
- R-72: invalid location shows error state in AppFrame and assistant acknowledges
- R-73: weather state summary present in context for follow-up questions
- Switching from a Chess session to a Weather session in the same conversation works without errors

---

## Phase 4: Spotify + OAuth (Day 5, ~8 hours)
**Goal:** Spotify app works end to end including OAuth flow. Proves the platform handles authenticated apps.

**Tasks:**
1. Implement backend OAuth routes: connect, callback, refresh, disconnect.
2. Implement `oauth_tokens` table operations (store, retrieve, refresh).
3. Build Spotify app: `src/apps/spotify/` with manifest, OAuth connect UI, playlist creation.
4. Add Spotify manifest to server registry.
5. Implement `spotify_create_playlist` tool routing.
6. Handle the OAuth redirect within the iframe context (open in new tab, return via postMessage on success).

**Gate criteria (all must pass before Phase 5):**
- R-80: unauthenticated user sees connect prompt
- R-81: OAuth flow completes and user is returned to app session with confirmation
- R-82: tokens stored in Postgres, not in renderer (verified by checking localStorage and Redux/Jotai state — neither should contain token)
- R-83: expired token is automatically refreshed (verified by manually expiring token in DB and retrying)
- R-84: playlist created in Spotify account (verified by checking Spotify app)
- R-85: Spotify API error shows in AppFrame and assistant acknowledges

---

## Phase 5: Polish, Deployment, Submission (Day 6-7, ~10 hours)
**Goal:** All three apps deployed and working. Documentation accurate. Demo-ready.

**Tasks:**
1. Deploy backend to Railway or Render. Configure environment variables.
2. Deploy web renderer build as static site.
3. Package Electron app (`npm run package`).
4. Run all gate criteria from Phases 2-4 against the deployed environment.
5. Write API documentation for the plugin contract (manifest spec, event spec) in a `docs/plugin-api.md` file.
6. Update README.md setup instructions to match the actual deployed system.
7. Verify non-functional requirements NF-01 through NF-07 against deployed environment.
8. Record demo video.
9. Write cost analysis.

**Final gate criteria:**
- All Phase 2, 3, and 4 gate criteria pass against the deployed environment
- NF-01 through NF-07 pass
- `npm run dev` and `npm run serve:web` both work from a clean clone with documented setup steps
- Demo video recorded and ready
- Cost analysis complete
- Social post drafted

---

## Time Budget (Against Sunday Deadline)

| Phase | Duration | Latest Start | Buffer |
|-------|----------|-------------|--------|
| Phase 0: Read and Map | 2h | Day 1 morning | None |
| Phase 1: Backend + Contract | 8h | Day 1 | 1h |
| Phase 2: Chess E2E | 16h | Day 2 | 2h |
| Phase 3: Weather | 6h | Day 4 morning | 1h |
| Phase 4: Spotify + OAuth | 8h | Day 5 | 1h |
| Phase 5: Polish + Deploy | 10h | Day 6 | 2h |

If Phase 2 is not complete by the end of Day 3, skip Phase 4 (Spotify) and complete a clean Weather integration instead. A working Chess + Weather with solid error handling is a better submission than a broken three-app system.
