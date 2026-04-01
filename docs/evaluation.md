# evaluation.md
## Success Criteria and Test Scenarios

---

## Grader Test Scenarios

These are the exact scenarios the graders will run, per the assignment spec. Each maps to specific requirements.

### Scenario 1: Tool Discovery and Invocation
**Input:** User types "let's play chess"
**Expected:** Assistant invokes chess_start. AppFrame renders with a chess board. No error state appears.
**Requirements:** R-30, R-40, R-43, R-60
**Fail condition:** AppFrame does not render, or tool routes to MCP instead of plugin runtime, or board takes more than 2 seconds.

### Scenario 2: Third-Party App UI Renders in Chat
**Input:** Any message that triggers an app
**Expected:** App UI appears inline in the chat window, not in a separate tab or modal. The chat input remains visible.
**Requirements:** R-43, NF-01
**Fail condition:** App opens in a new window or a separate panel outside the message list.

### Scenario 3: User Interacts with App, Then Returns to Chatbot
**Input:** User makes a chess move, then types "nice move right?"
**Expected:** The chess app processes the move. APP_RESULT fires. Assistant responds to the follow-up message with context about the move.
**Requirements:** R-31, R-44, R-52, R-54
**Fail condition:** Assistant responds without acknowledging the game, or chat stays silent after the move.

### Scenario 4: Chatbot Retains Context After App Completion
**Input:** Chess game ends (checkmate). User types "who won and how?"
**Expected:** Assistant describes the outcome from the APP_COMPLETE result without requiring the user to re-explain.
**Requirements:** R-50, R-51, R-54
**Fail condition:** Assistant says it doesn't know the outcome or asks the user to describe what happened.

### Scenario 5: Switching Between Multiple Apps
**Input:** User plays chess, then asks for weather in Austin, then asks a question that could relate to either
**Expected:** Both AppFrames are visible in the conversation history. Weather app renders correctly. The assistant correctly routes the ambiguous follow-up.
**Requirements:** R-30, R-73, NF-05
**Fail condition:** One app crashes when the other loads, or the ambiguous question routes incorrectly.

### Scenario 6: Ambiguous Query Routing
**Input:** User types "show me something" with both Chess and Weather apps registered
**Expected:** Assistant asks a clarifying question rather than guessing. Does not invoke a random tool.
**Requirements:** R-30 (routing accuracy)
**Fail condition:** Assistant randomly invokes a tool, or invokes both, or crashes.

### Scenario 7: Chatbot Refuses Unrelated App Invocation
**Input:** User asks "what is the capital of France?" with Chess and Weather apps registered
**Expected:** Assistant answers directly. No tool is invoked. No AppFrame renders.
**Requirements:** R-30
**Fail condition:** Assistant invokes any tool in response to a general knowledge question.

---

## Additional Test Scenarios

### Scenario 8: App Timeout
**Setup:** Block the chess app iframe from loading (e.g. bad URL in manifest for this test)
**Expected:** After 10 seconds, AppFrame shows error panel with retry button. Assistant acknowledges the failure in chat. Conversation continues.
**Requirements:** R-41, R-32, NF-07
**Fail condition:** Blank screen, browser crash, or silent hang.

### Scenario 9: Illegal Chess Move
**Input:** User attempts to move a piece to an illegal square
**Expected:** Board does not update. Assistant explains the move was illegal and asks for a different move.
**Requirements:** R-61
**Fail condition:** Board updates with an illegal position, or error is swallowed silently.

### Scenario 10: Spotify Auth Required
**Input:** User asks to create a Spotify playlist without having connected their account
**Expected:** Assistant prompts user to connect. Connect button or link appears. No tool invocation fires until auth is complete.
**Requirements:** R-80
**Fail condition:** Tool fires and fails with a 401, or error is unhandled.

### Scenario 11: Backend Unreachable
**Setup:** Stop the backend API server. Reload the app.
**Expected:** App loads. Chat works for basic conversation. Plugin features show "Apps unavailable" notice. No crash.
**Requirements:** R-04, NF-07
**Fail condition:** White screen, unhandled promise rejection, or app fails to load at all.

### Scenario 12: Iframe Sandbox Verification
**Setup:** Open browser DevTools in the chess app iframe context. Run `window.parent.document.title`.
**Expected:** SecurityError is thrown. The iframe cannot access the parent document.
**Requirements:** NF-04
**Fail condition:** The expression returns a value without throwing.

---

## Hypothesis Definitions

The following hypotheses must be confirmed by the end of Phase 2. If any is falsified, surface it immediately.

**H-1:** Injecting app tool schemas into the OpenAI function calling context does not cause the model to invoke plugin tools for unrelated queries. Confirmed when Scenario 7 passes.

**H-2:** The app state summary can be injected as a system message without corrupting Chatbox's existing message formatting or causing the model to fail. Confirmed when R-53 passes and R-03 passes simultaneously.

**H-3:** postMessage between the Chatbox renderer and a sandboxed iframe with `allow-scripts` (no `allow-same-origin`) works reliably in both the Electron renderer and the web build. Confirmed when AppFrame renders in both targets and R-60 passes in both.

**H-4:** The Chatbox libsql session can co-exist with the backend Postgres session without ID conflicts. The Chatbox conversation ID can be used as a foreign key in the Postgres `app_sessions.conversation_id` column without modification. Confirmed when Phase 1 gate passes with a real Chatbox session ID.

If H-3 is falsified (postMessage blocked in Electron's renderer), the fallback is IPC-mediated message passing through the Electron main process. This must be escalated immediately as it changes Seam 1 and requires Codex to stop and get human input before continuing.

---

## Minimum Viable Submission

If the full three-app build is not achievable by Sunday, the following constitutes a minimum passing submission:

1. Chess app: fully functional end to end including completion signaling and context retention
2. Weather app: renders and returns data (completion signaling optional if time is the constraint)
3. Backend: auth, sessions, and invocation logging working
4. Deployment: backend and web renderer accessible at a public URL
5. No crashes in Scenarios 1, 2, 3, 4, 11, and 12

This is the floor. A clean two-app submission beats a broken three-app submission.
