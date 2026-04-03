export function createSpotifyAppSrcDoc() {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        color-scheme: dark;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        min-height: 100vh;
        background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
        color: #1db954;
        padding: 0;
        font-size: 14px;
        line-height: 1.5;
      }
      .shell {
        min-height: 100vh;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .header {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .spotify-logo {
        width: 32px;
        height: 32px;
        background: #1db954;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        color: #000;
        font-size: 18px;
      }
      .header h1 {
        margin: 0;
        font-size: 24px;
        font-weight: 700;
      }
      .status-badge {
        margin-left: auto;
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .status-badge.connected {
        background: rgba(29, 185, 84, 0.2);
        color: #1db954;
        border: 1px solid #1db954;
      }
      .status-badge.disconnected {
        background: rgba(191, 191, 191, 0.2);
        color: #bfbfbf;
        border: 1px solid #bfbfbf;
      }
      .panel {
        background: rgba(40, 40, 40, 0.8);
        border: 1px solid rgba(29, 185, 84, 0.2);
        border-radius: 12px;
        padding: 16px;
        backdrop-filter: blur(10px);
      }
      .loading {
        text-align: center;
        padding: 40px 20px;
        color: #888;
      }
      .spinner {
        display: inline-block;
        width: 20px;
        height: 20px;
        border: 2px solid rgba(29, 185, 84, 0.2);
        border-top-color: #1db954;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin-bottom: 12px;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      .button {
        background: #1db954;
        color: #000;
        border: none;
        padding: 10px 20px;
        border-radius: 20px;
        font-weight: 700;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s ease;
      }
      .button:hover {
        background: #1ed760;
        transform: scale(1.02);
      }
      .button:active {
        transform: scale(0.98);
      }
      .button:disabled {
        background: #555;
        cursor: not-allowed;
        opacity: 0.6;
      }
      .connection-panel {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .connection-status {
        font-size: 14px;
        padding: 12px;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 8px;
      }
      .connection-status.connected {
        color: #1db954;
      }
      .connection-status.disconnected {
        color: #888;
      }
      .error {
        background: rgba(255, 0, 0, 0.1);
        border: 1px solid rgba(255, 0, 0, 0.3);
        color: #ff6b6b;
        padding: 12px;
        border-radius: 8px;
        margin-bottom: 12px;
        display: none;
      }
      .error.visible {
        display: block;
      }
      .playlist {
        margin-top: 16px;
      }
      .playlist h3 {
        margin: 0 0 12px 0;
        color: #1db954;
        font-size: 16px;
      }
      .playlist-embed {
        border-radius: 12px;
        overflow: hidden;
        margin-bottom: 12px;
      }
      .playlist-info {
        font-size: 13px;
        color: #bfbfbf;
        padding: 12px;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 8px;
      }
      .playlist-link {
        color: #1db954;
        text-decoration: none;
        font-weight: 600;
      }
      .playlist-link:hover {
        text-decoration: underline;
      }
      .section-title {
        color: #1db954;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin: 20px 0 12px 0;
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="header">
        <div class="spotify-logo">♪</div>
        <h1>Spotify</h1>
        <div class="status-badge disconnected" id="status-badge">Disconnected</div>
      </div>

      <div class="panel">
        <div class="error" id="error-panel"></div>
        <div class="connection-panel">
          <div class="connection-status disconnected" id="connection-status">
            Not connected to Spotify
          </div>
          <button class="button" id="connect-button" style="display:none;">
            Connect Spotify
          </button>
        </div>
      </div>

      <div class="panel" id="playlist-panel" style="display:none;">
        <div class="playlist" id="playlist-result"></div>
      </div>
    </div>

    <script>
      let sessionId = '';
      let backendUrl = '';
      let authToken = '';
      let isConnected = false;

      function post(type, payload) {
        if (!sessionId) {
          console.warn('[spotify-app] No sessionId, cannot post', { type, payload });
          return;
        }
        console.info('[spotify-app] post', { type, sessionId, payload });
        window.parent.postMessage({ type, sessionId, ...payload }, '*');
      }

      function showError(message) {
        const errorPanel = document.getElementById('error-panel');
        errorPanel.textContent = message;
        errorPanel.classList.add('visible');
        setTimeout(() => {
          errorPanel.classList.remove('visible');
        }, 5000);
      }

      function updateConnectionStatus(connected) {
        isConnected = connected;
        const statusEl = document.getElementById('connection-status');
        const badgeEl = document.getElementById('status-badge');
        const connectBtn = document.getElementById('connect-button');

        if (connected) {
          statusEl.textContent = '✓ Connected to Spotify';
          statusEl.className = 'connection-status connected';
          badgeEl.textContent = 'Connected';
          badgeEl.className = 'status-badge connected';
          connectBtn.style.display = 'none';
        } else {
          statusEl.textContent = 'Not connected to Spotify';
          statusEl.className = 'connection-status disconnected';
          badgeEl.textContent = 'Disconnected';
          badgeEl.className = 'status-badge disconnected';
          connectBtn.style.display = 'block';
        }
      }

      async function checkSpotifyConnection() {
        if (!backendUrl || !authToken) {
          return;
        }

        try {
          const response = await fetch(backendUrl.replace(/\\/$/, '') + '/api/oauth/spotify/status', {
            headers: {
              'Authorization': 'Bearer ' + authToken,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            updateConnectionStatus(!!data.connected);
          } else {
            updateConnectionStatus(false);
          }
        } catch (error) {
          console.warn('[spotify-app] Failed to check connection', error);
          updateConnectionStatus(false);
        }
      }

      async function initiateSpotifyConnect() {
        if (!backendUrl || !authToken) {
          showError('Backend not configured');
          return;
        }

        try {
          const response = await fetch(
            backendUrl.replace(/\\/$/, '') + '/api/oauth/spotify/connect',
            {
              headers: {
                'Authorization': 'Bearer ' + authToken,
                'Content-Type': 'application/json',
              },
            }
          );

          if (!response.ok) {
            showError('Failed to start Spotify OAuth flow');
            return;
          }

          const data = await response.json();
          const popup = window.open(data.authorizeUrl, 'spotify_oauth', 'width=400,height=600');

          if (!popup) {
            showError('Failed to open OAuth window. Please check popup settings.');
            return;
          }

          // Listen for OAuth completion message
          const messageHandler = async (event) => {
            if (event.data && event.data.type === 'CHATBRIDGE_SPOTIFY_OAUTH_COMPLETE') {
              window.removeEventListener('message', messageHandler);
              if (event.data.ok) {
                // Wait a moment for backend to finalize
                await new Promise(resolve => setTimeout(resolve, 500));
                await checkSpotifyConnection();
              } else {
                showError(event.data.error || 'Spotify connection failed');
              }
            }
          };

          window.addEventListener('message', messageHandler);

          // Clean up listener after 10 minutes
          setTimeout(() => {
            window.removeEventListener('message', messageHandler);
          }, 10 * 60 * 1000);
        } catch (error) {
          console.error('[spotify-app] OAuth error', error);
          showError('Failed to connect Spotify: ' + (error instanceof Error ? error.message : String(error)));
        }
      }

      async function createPlaylist(prompt, trackCount) {
        if (!isConnected) {
          showError('Spotify not connected');
          return;
        }

        if (!backendUrl || !authToken) {
          showError('Backend not configured');
          return;
        }

        try {
          const body = { prompt };
          if (trackCount) {
            body.trackCount = trackCount;
          }

          const response = await fetch(
            backendUrl.replace(/\\/$/, '') + '/api/spotify/playlists',
            {
              method: 'POST',
              headers: {
                'Authorization': 'Bearer ' + authToken,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(body),
            }
          );

          if (!response.ok) {
            const error = await response.text();
            showError('Failed to create playlist: ' + error);
            return;
          }

          const data = await response.json();
          displayPlaylist(data);
        } catch (error) {
          console.error('[spotify-app] Create playlist error', error);
          showError('Failed to create playlist: ' + (error instanceof Error ? error.message : String(error)));
        }
      }

      function displayPlaylist(data) {
        const playlistPanel = document.getElementById('playlist-panel');
        const playlistResult = document.getElementById('playlist-result');

        let tracksList = '';
        if (data.tracks && Array.isArray(data.tracks)) {
          tracksList = data.tracks
            .slice(0, 5)
            .map(t => '<div style="padding: 6px 0; font-size: 13px; color: #bfbfbf;">' +
              (t.artist ? '🎵 ' + (t.name || 'Unknown') + ' by ' + t.artist : '🎵 ' + (t.name || 'Unknown')) +
              '</div>')
            .join('');
        }

        playlistResult.innerHTML =
          '<h3>' + (data.playlistName || 'New Playlist') + '</h3>' +
          (data.embedUrl ? '<iframe src="' + data.embedUrl + '" width="100%" height="380" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" style="border-radius: 12px;"></iframe>' : '') +
          (tracksList ? '<div style="margin-top: 12px;"><strong style="color: #1db954;">Tracks:</strong>' + tracksList + '</div>' : '') +
          (data.playlistUrl ? '<div style="margin-top: 12px;"><a href="' + data.playlistUrl + '" target="_blank" class="playlist-link">Open in Spotify →</a></div>' : '');

        playlistPanel.style.display = 'block';
      }

      document.getElementById('connect-button').addEventListener('click', initiateSpotifyConnect);

      window.addEventListener('message', async (rawEvent) => {
        const event = rawEvent.data;
        if (!event || typeof event !== 'object' || typeof event.type !== 'string') {
          return;
        }

        if (event.type === 'INIT_APP') {
          console.info('[spotify-app] init', { sessionId: event.sessionId, config: event.config });
          sessionId = event.sessionId;
          backendUrl = typeof event.config?.backendUrl === 'string' ? event.config.backendUrl : '';
          authToken = typeof event.config?.authToken === 'string' ? event.config.authToken : '';

          post('APP_READY', {});

          // Check connection status asynchronously
          checkSpotifyConnection();
          return;
        }

        if (event.type === 'INVOKE_TOOL' && event.toolName === 'spotify_open') {
          console.info('[spotify-app] invoke:spotify_open', { seq: event.seq });
          post('APP_RESULT', {
            seq: event.seq,
            toolName: 'spotify_open',
            result: {
              sessionId,
              connected: isConnected,
            },
          });
          return;
        }

        if (event.type === 'INVOKE_TOOL' && event.toolName === 'spotify_create_playlist') {
          console.info('[spotify-app] invoke:spotify_create_playlist', { seq: event.seq, params: event.params });
          const prompt = typeof event.params?.prompt === 'string' ? event.params.prompt : '';
          const trackCount = typeof event.params?.trackCount === 'number' ? event.params.trackCount : undefined;

          if (!prompt) {
            post('APP_RESULT', {
              seq: event.seq,
              toolName: 'spotify_create_playlist',
              result: { error: 'Missing prompt' },
            });
            return;
          }

          await createPlaylist(prompt, trackCount);

          post('APP_RESULT', {
            seq: event.seq,
            toolName: 'spotify_create_playlist',
            result: { status: 'playlist_created' },
          });
          return;
        }
      });
    </script>
  </body>
</html>`
}