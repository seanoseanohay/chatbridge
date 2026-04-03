export function createSpotifyAppSrcDoc() {
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
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        min-height: 100vh;
        color: #f6f8f4;
        background:
          radial-gradient(circle at top left, rgba(34, 197, 94, 0.18), transparent 28%),
          linear-gradient(180deg, #09120d 0%, #102018 54%, #0f1712 100%);
      }
      button {
        font: inherit;
      }
      .shell {
        min-height: 100vh;
        display: grid;
        gap: 16px;
        padding: 18px;
      }
      .hero {
        display: flex;
        align-items: start;
        justify-content: space-between;
        gap: 12px;
      }
      .eyebrow {
        font-size: 10px;
        letter-spacing: 0.24em;
        text-transform: uppercase;
        color: #8eb89c;
        margin-bottom: 4px;
      }
      .title {
        font-size: 28px;
        line-height: 1;
        font-weight: 800;
      }
      .subtitle {
        margin-top: 6px;
        font-size: 13px;
        color: #a6bda9;
      }
      .badge {
        border-radius: 999px;
        padding: 10px 14px;
        background: rgba(14, 33, 22, 0.7);
        border: 1px solid rgba(114, 195, 134, 0.22);
        font-size: 12px;
        font-weight: 700;
        white-space: nowrap;
      }
      .panel {
        border-radius: 22px;
        padding: 18px;
        background: rgba(12, 25, 17, 0.8);
        border: 1px solid rgba(114, 195, 134, 0.16);
        box-shadow:
          0 18px 30px rgba(0, 0, 0, 0.22),
          inset 0 1px 0 rgba(255,255,255,0.04);
      }
      .status {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 14px;
        color: #c0d4c4;
      }
      .spinner {
        width: 16px;
        height: 16px;
        border-radius: 999px;
        border: 2px solid rgba(255,255,255,0.16);
        border-top-color: #1ed760;
        animation: spin 0.7s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      .error {
        display: none;
        color: #ffd2d2;
        background: rgba(92, 28, 28, 0.68);
        border: 1px solid rgba(255, 120, 120, 0.22);
      }
      .error.visible {
        display: block;
      }
      .empty {
        text-align: center;
        color: #a6bda9;
        padding: 26px 18px;
        font-size: 14px;
      }
      .auth {
        display: grid;
        gap: 14px;
      }
      .auth-copy {
        font-size: 14px;
        color: #d4dfd5;
        line-height: 1.6;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .button {
        border: 0;
        border-radius: 999px;
        padding: 12px 16px;
        cursor: pointer;
        font-weight: 700;
      }
      .button-primary {
        color: #081109;
        background: #1ed760;
      }
      .button-secondary {
        color: #d9e5db;
        background: rgba(255,255,255,0.08);
      }
      .playlist {
        display: none;
        gap: 16px;
      }
      .playlist.visible {
        display: grid;
      }
      .playlist-header {
        display: grid;
        gap: 8px;
      }
      .playlist-title {
        font-size: 28px;
        font-weight: 800;
        line-height: 1.1;
      }
      .playlist-meta {
        color: #9eb7a4;
        font-size: 14px;
      }
      .playlist-link {
        color: #7ee39a;
        text-decoration: none;
        font-weight: 700;
      }
      .tracks {
        display: grid;
        gap: 10px;
      }
      .track {
        padding: 12px 14px;
        border-radius: 16px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(114, 195, 134, 0.1);
      }
      .track-title {
        font-size: 14px;
        font-weight: 700;
      }
      .track-artist {
        font-size: 12px;
        color: #99b09f;
        margin-top: 4px;
      }
      .track-link {
        display: inline-block;
        margin-top: 6px;
        color: #7ee39a;
        font-size: 12px;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="hero">
        <div>
          <div class="eyebrow">Interactive App</div>
          <div class="title">Spotify</div>
          <div class="subtitle" id="subtitle">Checking connection...</div>
        </div>
        <div class="badge" id="badge">Loading</div>
      </div>

      <div class="panel status" id="loading">
        <div class="spinner"></div>
        <div id="loading-copy">Checking Spotify status...</div>
      </div>

      <div class="panel error" id="error-panel"></div>

      <div class="panel auth" id="auth-panel" hidden>
        <div class="auth-copy" id="auth-copy">
          Use the Connect Spotify button in the app header to authorize your account.
        </div>
        <div class="actions">
          <button class="button button-secondary" id="refresh-button" type="button">Refresh Status</button>
        </div>
      </div>

      <div class="panel empty" id="empty-state" hidden>
        Ask for a playlist like "make me a study playlist with 10 lo-fi tracks."
      </div>

      <div class="panel playlist" id="playlist-panel">
        <div class="playlist-header">
          <div class="playlist-title" id="playlist-title"></div>
          <div class="playlist-meta" id="playlist-meta"></div>
          <a class="playlist-link" id="playlist-link" target="_blank" rel="noreferrer noopener">Open in Spotify</a>
        </div>
        <div class="tracks" id="tracks"></div>
      </div>
    </div>

    <script>
      let sessionId = '';
      let backendUrl = '';
      let authToken = '';
      let connected = false;
      let lastKnownStatus = null;

      const loadingEl = document.getElementById('loading');
      const loadingCopyEl = document.getElementById('loading-copy');
      const errorPanelEl = document.getElementById('error-panel');
      const subtitleEl = document.getElementById('subtitle');
      const badgeEl = document.getElementById('badge');
      const authPanelEl = document.getElementById('auth-panel');
      const authCopyEl = document.getElementById('auth-copy');
      const emptyStateEl = document.getElementById('empty-state');
      const playlistPanelEl = document.getElementById('playlist-panel');
      const playlistTitleEl = document.getElementById('playlist-title');
      const playlistMetaEl = document.getElementById('playlist-meta');
      const playlistLinkEl = document.getElementById('playlist-link');
      const tracksEl = document.getElementById('tracks');
      const refreshButtonEl = document.getElementById('refresh-button');

      function post(type, payload) {
        if (!sessionId) {
          return;
        }
        window.parent.postMessage({ type, sessionId, ...payload }, '*');
      }

      function authHeaders() {
        return authToken
          ? {
              Accept: 'application/json',
              Authorization: 'Bearer ' + authToken,
              'Content-Type': 'application/json',
            }
          : {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            };
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
        emptyStateEl.hidden = true;
        playlistPanelEl.classList.remove('visible');
        setBadge('Loading');
      }

      function showError(message) {
        loadingEl.hidden = true;
        errorPanelEl.textContent = message;
        errorPanelEl.classList.add('visible');
        setBadge('Error');
      }

      function showConnectPanel(message) {
        loadingEl.hidden = true;
        errorPanelEl.classList.remove('visible');
        errorPanelEl.textContent = '';
        authPanelEl.hidden = false;
        emptyStateEl.hidden = true;
        playlistPanelEl.classList.remove('visible');
        authCopyEl.textContent = message || 'Use the Connect Spotify button in the app header to authorize your account.';
        subtitleEl.textContent = 'Account not connected';
        setBadge('Connect');
      }

      function showReadyState(message) {
        loadingEl.hidden = true;
        errorPanelEl.classList.remove('visible');
        errorPanelEl.textContent = '';
        authPanelEl.hidden = true;
        emptyStateEl.hidden = false;
        emptyStateEl.textContent = message || 'Ask for a playlist like "make me a study playlist with 10 lo-fi tracks."';
        playlistPanelEl.classList.remove('visible');
        subtitleEl.textContent = 'Connected and ready';
        setBadge('Ready');
      }

      function renderPlaylist(result) {
        playlistTitleEl.textContent = result.playlistName || 'Spotify Playlist';
        playlistMetaEl.textContent = (Array.isArray(result.tracks) ? result.tracks.length : 0) + ' tracks added';
        playlistLinkEl.href = result.playlistUrl;
        tracksEl.innerHTML = '';

        const tracks = Array.isArray(result.tracks) ? result.tracks : [];
        for (const track of tracks) {
          const item = document.createElement('div');
          item.className = 'track';
          item.innerHTML =
            '<div class="track-title">' + escapeHtml(track.name || 'Unknown track') + '</div>' +
            '<div class="track-artist">' + escapeHtml(track.artist || 'Unknown artist') + '</div>' +
            (track.url
              ? '<a class="track-link" target="_blank" rel="noreferrer noopener" href="' +
                escapeHtml(track.url) +
                '">Open track</a>'
              : '');
          tracksEl.appendChild(item);
        }

        loadingEl.hidden = true;
        errorPanelEl.classList.remove('visible');
        errorPanelEl.textContent = '';
        authPanelEl.hidden = true;
        emptyStateEl.hidden = true;
        playlistPanelEl.classList.add('visible');
        subtitleEl.textContent = 'Latest playlist';
        setBadge('Created');
      }

      function escapeHtml(value) {
        return String(value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      async function fetchJson(url, init) {
        const response = await fetch(url, {
          ...init,
          headers: {
            ...authHeaders(),
            ...(init && init.headers ? init.headers : {}),
          },
        });
        let payload = null;
        try {
          payload = await response.json();
        } catch {}
        if (!response.ok) {
          const message =
            payload && typeof payload.error === 'string'
              ? payload.error
              : payload && typeof payload.message === 'string'
                ? payload.message
                : 'Spotify request failed with status ' + response.status;
          const error = new Error(message);
          error.payload = payload;
          throw error;
        }
        return payload;
      }

      function statusSummary() {
        if (!connected) {
          return 'Spotify account not connected.';
        }
        if (lastKnownStatus && lastKnownStatus.playlistName && Array.isArray(lastKnownStatus.tracks)) {
          return lastKnownStatus.playlistName + ' with ' + lastKnownStatus.tracks.length + ' tracks.';
        }
        return 'Spotify connected and ready for playlist creation.';
      }

      async function refreshStatus(seq, toolName) {
        if (!backendUrl || !authToken) {
          connected = false;
          showConnectPanel('Sign in to ChatBridge first, then connect Spotify.');
          if (typeof seq === 'number' && toolName) {
            post('APP_STATE_UPDATE', { seq, stateSummary: 'Spotify requires ChatBridge authentication.' });
            post('APP_RESULT', {
              seq,
              toolName,
              result: { error: 'auth_required', message: 'Sign in to ChatBridge before using Spotify.' },
            });
          }
          return { connected: false, authRequired: true };
        }

        const status = await fetchJson(backendUrl.replace(/\/$/, '') + '/api/oauth/spotify/status');
        connected = Boolean(status && status.connected);
        if (connected) {
          showReadyState();
        } else {
          showConnectPanel('Connect Spotify to create playlists from your prompts.');
        }
        if (typeof seq === 'number' && toolName) {
          post('APP_STATE_UPDATE', { seq, stateSummary: statusSummary() });
          post('APP_RESULT', {
            seq,
            toolName,
            result: connected
              ? {
                  connected: true,
                  expiresAt: status ? status.expiresAt || null : null,
                }
              : {
                  error: 'auth_required',
                  connected: false,
                  message: 'Connect Spotify to continue.',
                },
          });
        }
        return status;
      }

      async function createPlaylist(prompt, trackCount, seq) {
        if (!connected) {
          showConnectPanel('Connect Spotify before creating a playlist.');
          post('APP_STATE_UPDATE', { seq, stateSummary: 'Spotify account not connected.' });
          post('APP_ERROR', { error: 'Spotify account not connected' });
          post('APP_RESULT', {
            seq,
            toolName: 'spotify_create_playlist',
            result: { error: 'auth_required', message: 'Connect Spotify to continue.' },
          });
          return;
        }

        showLoading('Building playlist from your prompt...');
        subtitleEl.textContent = prompt;

        try {
          const result = await fetchJson(backendUrl.replace(/\/$/, '') + '/api/spotify/playlists', {
            method: 'POST',
            body: JSON.stringify({
              prompt: prompt,
              trackCount: trackCount,
            }),
          });
          lastKnownStatus = result;
          renderPlaylist(result);
          const summary =
            (result.playlistName || 'Spotify playlist') +
            ' with ' +
            (Array.isArray(result.tracks) ? result.tracks.length : 0) +
            ' tracks.';

          post('APP_STATE_UPDATE', {
            seq,
            stateSummary: summary,
          });
          post('APP_RESULT', {
            seq,
            toolName: 'spotify_create_playlist',
            result: result,
          });
          post('APP_COMPLETE', {
            result: {
              summary: 'Created ' + summary,
              data: result,
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          showError(message);
          post('APP_ERROR', { error: message });
          post('APP_RESULT', {
            seq,
            toolName: 'spotify_create_playlist',
            result: { error: 'request_failed', message: message },
          });
        }
      }

      refreshButtonEl.addEventListener('click', function () {
        void refreshStatus();
      });

      window.addEventListener('message', async function (rawEvent) {
        const event = rawEvent.data;
        if (!event || typeof event !== 'object' || typeof event.type !== 'string') {
          return;
        }

        if (event.type === 'INIT_APP') {
          sessionId = event.sessionId;
          backendUrl = typeof event.config?.backendUrl === 'string' ? event.config.backendUrl : '';
          authToken = typeof event.config?.authToken === 'string' ? event.config.authToken : '';
          post('APP_READY', {});
          try {
            await refreshStatus();
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            showError(message);
          }
          return;
        }

        if (event.type === 'INVOKE_TOOL' && event.toolName === 'spotify_open') {
          try {
            await refreshStatus(event.seq, 'spotify_open');
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            showError(message);
            post('APP_ERROR', { error: message });
            post('APP_RESULT', {
              seq: event.seq,
              toolName: 'spotify_open',
              result: { error: 'request_failed', message: message },
            });
          }
          return;
        }

        if (event.type === 'INVOKE_TOOL' && event.toolName === 'spotify_create_playlist') {
          const prompt = typeof event.params?.prompt === 'string' ? event.params.prompt.trim() : '';
          const trackCount = typeof event.params?.trackCount === 'number' ? event.params.trackCount : undefined;
          if (!prompt) {
            showError('Playlist prompt is required.');
            post('APP_RESULT', {
              seq: event.seq,
              toolName: 'spotify_create_playlist',
              result: { error: 'invalid_prompt', message: 'Playlist prompt is required.' },
            });
            return;
          }
          await createPlaylist(prompt, trackCount, event.seq);
        }
      });
    </script>
  </body>
</html>`;
}
