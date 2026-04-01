# scope.md
## Scope Boundaries

---

## In Scope — This Week

**Platform infrastructure:**
- Fork and run Chatbox locally in development mode
- Backend API service (Express, Postgres, Redis) with the schema defined in `docs/architecture.md`
- Plugin registry: app registration, manifest validation, tool schema storage, origin allowlist
- Plugin runtime: seam intercept in `sessionActions.ts`, tool routing, app session management
- AppFrame component: sandboxed iframe host with loading states, error panels, and retry
- postMessage event bus: typed events, validation, sequence numbering
- Completion signaling: APP_COMPLETE handler, Postgres write, conversation context merge

**Authentication:**
- Platform email/password auth with JWT
- Spotify OAuth 2.0 via backend broker, including token refresh

**Three reference apps, fully functional:**
- Chess: game start, legal move validation, mid-game AI analysis, game end with discussion
- Weather Dashboard: location input, current conditions and forecast display, no user auth
- Spotify Playlist Creator: OAuth connect flow, playlist creation from chat prompt, confirmation display

**Deployment:**
- Backend deployed to Railway or Render with managed Postgres and Redis
- Web renderer build deployed as static site
- Electron desktop build packaged and runnable

**Documentation:**
- All docs in this `docs/` directory completed before code is written
- API documentation for the plugin contract (manifest spec, event spec, tool schema spec)
- Setup guide in README.md accurate against the actual deployed system

---

## Out of Scope — This Week

**Open app marketplace.** Third-party developers cannot self-register apps. The registry is an allowlist managed in server config. This is a post-launch feature.

**Mobile builds.** Chatbox supports iOS and Android via Capacitor. The plugin runtime is not tested or adapted for mobile this week.

**Multi-tenant district management UI.** Teacher/admin controls over which apps are available per district are not implemented. Tool governance uses a single allowlist.

**App versioning.** The manifest versioning system described in the planning checklist (versioned manifests for update safety) is not implemented. Apps have a single registered version.

**Offline mode.** The plugin runtime requires the backend API. If the backend is unreachable, apps fail gracefully with an error state and fall back to chat, but no offline queue is implemented.

**Drawing canvas app.** Not selected. The three apps are Chess, Weather Dashboard, and Spotify.

**Rate limiting infrastructure.** Per-user and per-app rate limits are defined in constraints but enforcement is basic (request counting in Redis). A formal rate-limiting service is post-launch.

**Audit log UI.** Invocation history is written to Postgres but there is no UI to view it this week.

**Knowledge base integration.** Chatbox has a RAG/knowledge base subsystem. Plugin tools do not query it this week.

**Team collaboration features.** Chatbox has a team-sharing proxy feature. It is not integrated with the plugin runtime this week.

---

## Explicitly Deferred (Not Forgotten)

The following items came up in planning and were explicitly deferred rather than forgotten:

- App manifest signing and cryptographic verification (deferred: use origin allowlist only this week)
- Circuit breaker with configurable failure thresholds (deferred: use basic timeout + error count this week)
- Context window compression for long multi-app sessions (deferred: use recency truncation this week)
- Point-in-time recovery for Postgres (deferred: enable managed backups, no PITR drills this week)
- Developer SDK and documentation for external third-party developers (deferred: internal use only this week)
