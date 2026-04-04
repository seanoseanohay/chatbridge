export function createGitHubAppSrcDoc() {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        color-scheme: dark;
        font-family: "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        color: #f7f9fb;
        background:
          radial-gradient(circle at top left, rgba(96, 165, 250, 0.14), transparent 24%),
          linear-gradient(180deg, #0b1220 0%, #121c2c 48%, #0f1724 100%);
      }
      a { color: #8ec5ff; text-decoration: none; }
      button { font: inherit; }
      .shell { min-height: 100vh; display: grid; gap: 16px; padding: 18px; }
      .hero { display: flex; align-items: start; justify-content: space-between; gap: 12px; }
      .eyebrow { font-size: 10px; letter-spacing: 0.24em; text-transform: uppercase; color: #88a7c8; margin-bottom: 4px; }
      .title { font-size: 28px; line-height: 1; font-weight: 800; }
      .subtitle { margin-top: 6px; font-size: 13px; color: #aabbd2; }
      .badge { border-radius: 999px; padding: 10px 14px; background: rgba(15, 23, 36, 0.7); border: 1px solid rgba(145, 194, 255, 0.18); font-size: 12px; font-weight: 700; white-space: nowrap; }
      .panel { border-radius: 22px; padding: 18px; background: rgba(13, 22, 34, 0.82); border: 1px solid rgba(145, 194, 255, 0.12); box-shadow: 0 18px 30px rgba(0, 0, 0, 0.2); }
      .status { display: flex; align-items: center; gap: 10px; font-size: 14px; color: #c4d3e6; }
      .spinner { width: 16px; height: 16px; border-radius: 999px; border: 2px solid rgba(255,255,255,0.16); border-top-color: #60a5fa; animation: spin 0.7s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }
      .error { display: none; color: #ffd4d4; background: rgba(86, 24, 24, 0.68); border: 1px solid rgba(255, 120, 120, 0.22); }
      .error.visible { display: block; }
      .auth, .content { display: grid; gap: 14px; }
      .auth[hidden], .content[hidden] { display: none; }
      .actions { display: flex; gap: 10px; flex-wrap: wrap; }
      .button { border: 0; border-radius: 999px; padding: 12px 16px; cursor: pointer; font-weight: 700; color: #dbeafe; background: rgba(255,255,255,0.08); }
      .section { display: grid; gap: 10px; }
      .section-title { font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: #89a5c4; }
      .repo-name { font-size: 26px; font-weight: 800; line-height: 1.1; }
      .repo-meta { font-size: 13px; color: #aabbd2; }
      .stats { display: flex; flex-wrap: wrap; gap: 10px; }
      .stat { padding: 10px 12px; border-radius: 14px; background: rgba(255,255,255,0.05); font-size: 13px; color: #c7d6e7; }
      .list { display: grid; gap: 10px; }
      .item { padding: 12px 14px; border-radius: 16px; background: rgba(255,255,255,0.05); border: 1px solid rgba(145, 194, 255, 0.08); }
      .item-title { font-size: 14px; font-weight: 700; }
      .item-meta { margin-top: 4px; font-size: 12px; color: #96adc7; }
      .empty { color: #96adc7; font-size: 14px; }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="hero">
        <div>
          <div class="eyebrow">Interactive App</div>
          <div class="title">GitHub</div>
          <div class="subtitle" id="subtitle">Checking GitHub status...</div>
        </div>
        <div class="badge" id="badge">Loading</div>
      </div>

      <div class="panel status" id="loading">
        <div class="spinner"></div>
        <div id="loading-copy">Checking GitHub connection...</div>
      </div>

      <div class="panel error" id="error-panel"></div>

      <div class="panel auth" id="auth-panel" hidden>
        <div id="auth-copy">Use the Connect GitHub button in the app header to authorize your account.</div>
        <div class="actions">
          <button class="button" id="refresh-button" type="button">Refresh Status</button>
        </div>
      </div>

      <div class="panel content" id="content-panel" hidden>
        <div class="section">
          <div class="section-title">Repository</div>
          <div class="repo-name" id="repo-name"></div>
          <div class="repo-meta" id="repo-meta"></div>
          <div class="stats" id="repo-stats"></div>
        </div>
        <div class="section">
          <div class="section-title">Open Pull Requests</div>
          <div class="list" id="pull-list"></div>
        </div>
        <div class="section">
          <div class="section-title">Open Issues</div>
          <div class="list" id="issue-list"></div>
        </div>
      </div>
    </div>

    <script>
      var sessionId = '';
      var backendUrl = '';
      var authToken = '';
      var connected = false;
      var lastOverview = null;

      function log(message, details) {
        console.info('[github-app] ' + message, details || {});
      }

      function escapeHtml(value) {
        return String(value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      var loadingEl = document.getElementById('loading');
      var loadingCopyEl = document.getElementById('loading-copy');
      var errorPanelEl = document.getElementById('error-panel');
      var subtitleEl = document.getElementById('subtitle');
      var badgeEl = document.getElementById('badge');
      var authPanelEl = document.getElementById('auth-panel');
      var authCopyEl = document.getElementById('auth-copy');
      var contentPanelEl = document.getElementById('content-panel');
      var repoNameEl = document.getElementById('repo-name');
      var repoMetaEl = document.getElementById('repo-meta');
      var repoStatsEl = document.getElementById('repo-stats');
      var pullListEl = document.getElementById('pull-list');
      var issueListEl = document.getElementById('issue-list');
      var refreshButtonEl = document.getElementById('refresh-button');

      function post(type, payload) {
        if (!sessionId) return;
        log('post', { type: type, sessionId: sessionId, payload: payload });
        window.parent.postMessage({ type: type, sessionId: sessionId, ...payload }, '*');
      }

      function authHeaders() {
        var headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
        if (authToken) {
          headers.Authorization = 'Bearer ' + authToken;
        }
        return headers;
      }

      function setBadge(text) {
        badgeEl.textContent = text;
      }

      function showLoading(copy) {
        loadingEl.hidden = false;
        loadingCopyEl.textContent = copy;
        errorPanelEl.classList.remove('visible');
        errorPanelEl.textContent = '';
        authPanelEl.hidden = true;
        contentPanelEl.hidden = true;
        setBadge('Loading');
      }

      function showError(message) {
        loadingEl.hidden = true;
        contentPanelEl.hidden = true;
        errorPanelEl.textContent = message;
        errorPanelEl.classList.add('visible');
        setBadge('Error');
      }

      function showConnectPanel(message) {
        loadingEl.hidden = true;
        errorPanelEl.classList.remove('visible');
        errorPanelEl.textContent = '';
        authPanelEl.hidden = false;
        contentPanelEl.hidden = true;
        authCopyEl.textContent = message || 'Use the Connect GitHub button in the app header to authorize your account.';
        subtitleEl.textContent = 'Account not connected';
        setBadge('Connect');
      }

      function showContent() {
        loadingEl.hidden = true;
        errorPanelEl.classList.remove('visible');
        errorPanelEl.textContent = '';
        authPanelEl.hidden = true;
        contentPanelEl.hidden = false;
        subtitleEl.textContent = 'Connected and ready';
        setBadge('Ready');
      }

      async function fetchJson(url, init) {
        var response = await fetch(url, {
          ...init,
          headers: {
            ...authHeaders(),
            ...(init && init.headers ? init.headers : {}),
          },
        });
        var payload = null;
        try { payload = await response.json(); } catch { payload = null; }
        if (!response.ok) {
          var message = 'GitHub request failed with status ' + response.status;
          if (payload && typeof payload.error === 'string') message = payload.error;
          else if (payload && typeof payload.message === 'string') message = payload.message;
          throw new Error(message);
        }
        return payload;
      }

      function summaryFromOverview(overview) {
        if (!overview || !overview.repo) return 'GitHub connected.';
        return overview.repo.fullName + ' has ' + overview.pulls.length + ' open pull requests and ' + overview.issues.length + ' open issues.';
      }

      function renderItems(container, items, emptyCopy, typeLabel) {
        container.innerHTML = '';
        if (!Array.isArray(items) || !items.length) {
          container.innerHTML = '<div class="empty">' + escapeHtml(emptyCopy) + '</div>';
          return;
        }
        for (var i = 0; i < items.length; i += 1) {
          var item = items[i];
          var node = document.createElement('div');
          node.className = 'item';
          node.innerHTML =
            '<div class="item-title"><a target="_blank" rel="noreferrer noopener" href="' + escapeHtml(item.url || '#') + '">' +
            escapeHtml('#' + item.number + ' ' + item.title) + '</a></div>' +
            '<div class="item-meta">' + escapeHtml(typeLabel + ' by ' + (item.author || 'unknown')) + '</div>';
          container.appendChild(node);
        }
      }

      function renderOverview(overview) {
        lastOverview = overview;
        repoNameEl.textContent = overview.repo.fullName;
        repoMetaEl.innerHTML =
          escapeHtml(overview.repo.description || 'No description provided.') +
          ' <a target="_blank" rel="noreferrer noopener" href="' + escapeHtml(overview.repo.url) + '">Open repo</a>';
        repoStatsEl.innerHTML =
          '<div class="stat">' + escapeHtml(String(overview.repo.stars)) + ' stars</div>' +
          '<div class="stat">' + escapeHtml(String(overview.repo.forks)) + ' forks</div>' +
          '<div class="stat">' + escapeHtml(String(overview.repo.openIssuesCount)) + ' open items</div>' +
          '<div class="stat">Viewer: ' + escapeHtml(overview.viewer.login) + '</div>';
        renderItems(pullListEl, overview.pulls, 'No open pull requests.', 'PR');
        renderItems(issueListEl, overview.issues, 'No open issues.', 'Issue');
        showContent();
      }

      async function refreshStatus() {
        log('status:refresh:start', { backendUrl: backendUrl, hasAuthToken: Boolean(authToken) });
        if (!backendUrl || !authToken) {
          connected = false;
          showConnectPanel('Sign in to ChatBridge first, then connect GitHub.');
          return { connected: false, authRequired: true };
        }

        var status = await fetchJson(backendUrl.replace(/\/$/, '') + '/api/oauth/github/status');
        connected = Boolean(status && status.connected);

        if (connected) {
          showLoading('Loading repository overview...');
        } else {
          showConnectPanel('Connect GitHub to view repository pull requests and issues.');
        }

        return status;
      }

      async function loadOverview(seq, toolName) {
        if (!connected) {
          if (typeof seq === 'number' && toolName) {
            post('APP_STATE_UPDATE', { seq: seq, stateSummary: 'GitHub account not connected.' });
            post('APP_RESULT', {
              seq: seq,
              toolName: toolName,
              result: { error: 'auth_required', message: 'Connect GitHub to continue.' },
            });
          }
          return;
        }

        var overview = await fetchJson(backendUrl.replace(/\/$/, '') + '/api/github/overview');
        renderOverview(overview);

        if (typeof seq === 'number' && toolName) {
          var summary = summaryFromOverview(overview);
          post('APP_STATE_UPDATE', { seq: seq, stateSummary: summary });
          post('APP_RESULT', {
            seq: seq,
            toolName: toolName,
            result: {
              sessionId: sessionId,
              connected: true,
              repoFullName: overview.repo.fullName,
              pullCount: overview.pulls.length,
              issueCount: overview.issues.length,
            },
          });
        }
      }

      async function sync(seq, toolName) {
        try {
          await refreshStatus();
          if (connected) {
            await loadOverview(seq, toolName);
          } else if (typeof seq === 'number' && toolName) {
            post('APP_STATE_UPDATE', { seq: seq, stateSummary: 'GitHub account not connected.' });
            post('APP_RESULT', {
              seq: seq,
              toolName: toolName,
              result: { error: 'auth_required', message: 'Connect GitHub to continue.' },
            });
          }
        } catch (error) {
          var message = error instanceof Error ? error.message : String(error);
          showError(message);
          if (typeof seq === 'number' && toolName) {
            post('APP_ERROR', { error: message });
            post('APP_RESULT', { seq: seq, toolName: toolName, result: { error: 'request_failed', message: message } });
          }
        }
      }

      refreshButtonEl.addEventListener('click', function () {
        void sync();
      });

      window.addEventListener('message', async function (rawEvent) {
        var event = rawEvent.data;
        if (!event || typeof event !== 'object' || typeof event.type !== 'string') return;
        log('message:receive', { type: event.type, event: event });

        if (event.type === 'INIT_APP') {
          sessionId = event.sessionId;
          backendUrl = event.config && typeof event.config.backendUrl === 'string' ? event.config.backendUrl : '';
          authToken = event.config && typeof event.config.authToken === 'string' ? event.config.authToken : '';
          post('APP_READY', {});
          await sync();
          return;
        }

        if (event.type === 'INVOKE_TOOL' && event.toolName === 'github_open') {
          await sync(event.seq, 'github_open');
        }
      });
    </script>
  </body>
</html>`
}
