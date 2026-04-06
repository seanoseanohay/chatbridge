export function createSlackAppSrcDoc() {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
        background: #f5f5f5;
        color: #333;
        padding: 16px;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
      }
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 24px;
        padding-bottom: 12px;
        border-bottom: 1px solid #e0e0e0;
      }
      .title {
        font-size: 20px;
        font-weight: 600;
        margin: 0;
      }
      .status-badge {
        display: inline-block;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
      }
      .status-badge.connected {
        background: #dff0d8;
        color: #3c763d;
      }
      .status-badge.disconnected {
        background: #f2dede;
        color: #a94442;
      }
      .content {
        display: none;
      }
      .content.visible {
        display: block;
      }
      .disconnected-view {
        text-align: center;
        padding: 40px 20px;
      }
      .disconnected-view p {
        margin: 0 0 16px 0;
        color: #666;
      }
      .connect-button {
        background: #4a90e2;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
      }
      .connect-button:hover {
        background: #3a7bc8;
      }
      .team-info {
        background: white;
        padding: 12px;
        border-radius: 4px;
        margin-bottom: 16px;
        border: 1px solid #e0e0e0;
      }
      .team-name {
        font-size: 16px;
        font-weight: 600;
        margin: 0 0 4px 0;
      }
      .team-time {
        font-size: 12px;
        color: #999;
        margin: 0;
      }
      .channels-section {
        display: none;
      }
      .channels-section.visible {
        display: block;
      }
      .section-title {
        font-size: 14px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #666;
        margin-top: 16px;
        margin-bottom: 12px;
        padding: 8px 0;
        border-top: 1px solid #e0e0e0;
      }
      .channel-item {
        background: white;
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        padding: 12px;
        margin-bottom: 8px;
      }
      .channel-header {
        display: flex;
        align-items: baseline;
        margin-bottom: 8px;
        gap: 8px;
      }
      .channel-name {
        font-weight: 600;
        color: #4a90e2;
      }
      .message-count {
        font-size: 12px;
        color: #999;
      }
      .channel-highlight {
        font-size: 13px;
        color: #555;
        line-height: 1.4;
        margin: 6px 0 0 0;
      }
      .highlight-item {
        padding: 4px 0;
        border-left: 2px solid #4a90e2;
        padding-left: 8px;
        margin-bottom: 4px;
      }
      .error {
        background: #f2dede;
        color: #a94442;
        border: 1px solid #ebccd1;
        border-radius: 4px;
        padding: 12px;
        margin-bottom: 16px;
      }
      .loading {
        text-align: center;
        padding: 24px;
        color: #999;
      }
      .spinner {
        display: inline-block;
        width: 20px;
        height: 20px;
        border: 2px solid #e0e0e0;
        border-radius: 50%;
        border-top-color: #4a90e2;
        animation: spin 0.6s linear infinite;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1 class="title">Slack</h1>
        <span id="statusBadge" class="status-badge disconnected">Disconnected</span>
      </div>

      <div id="errorContainer"></div>

      <div id="disconnected" class="content disconnected-view visible">
        <p>Connect your Slack workspace to see activity highlights.</p>
        <button class="connect-button" onclick="requestConnect()">Connect Slack</button>
      </div>

      <div id="connected" class="content">
        <div id="loading" class="loading" style="display: none;">
          <div class="spinner"></div>
          <p>Loading...</p>
        </div>

        <div id="summary" style="display: none;">
          <div class="team-info">
            <p class="team-name" id="teamName"></p>
            <p class="team-time" id="generatedTime"></p>
          </div>

          <div id="channelsContainer"></div>
        </div>
      </div>
    </div>

    <script>
      var sessionId = '';
      var backendUrl = '';
      var authToken = '';
      var connected = false;
      var lastSync = null;

      function post(type, payload) {
        if (!sessionId) return;
        window.parent.postMessage({ type, sessionId, ...payload }, '*');
      }

      function showError(message) {
        var container = document.getElementById('errorContainer');
        container.innerHTML = '<div class="error">' + message + '</div>';
      }

      function clearError() {
        document.getElementById('errorContainer').innerHTML = '';
      }

      function setStatus(isConnected) {
        connected = isConnected;
        var badge = document.getElementById('statusBadge');
        badge.textContent = isConnected ? 'Connected' : 'Disconnected';
        badge.className = 'status-badge ' + (isConnected ? 'connected' : 'disconnected');

        var disconnected = document.getElementById('disconnected');
        var connectedView = document.getElementById('connected');
        disconnected.className = 'content' + (isConnected ? '' : ' visible');
        connectedView.className = 'content' + (isConnected ? ' visible' : '');
      }

      function showLoading() {
        document.getElementById('loading').style.display = 'block';
        document.getElementById('summary').style.display = 'none';
      }

      function showSummary(data) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('summary').style.display = 'block';

        document.getElementById('teamName').textContent = data.teamName;
        var now = new Date(data.generatedAt);
        document.getElementById('generatedTime').textContent = 'Updated ' + now.toLocaleTimeString();

        var container = document.getElementById('channelsContainer');
        container.innerHTML = '';

        if (!Array.isArray(data.channels) || data.channels.length === 0) {
          container.innerHTML = '<p style="text-align: center; color: #999;">No activity in the last 24 hours.</p>';
          return;
        }

        var html = '<div class="section-title">Channels (' + data.channels.length + ')</div>';
        data.channels.forEach(function(channel) {
          html += '<div class="channel-item">';
          html += '<div class="channel-header"><span class="channel-name">#' + escapeHtml(channel.name) + '</span><span class="message-count">' + channel.messageCount + ' message' + (channel.messageCount === 1 ? '' : 's') + '</span></div>';
          if (Array.isArray(channel.highlights) && channel.highlights.length > 0) {
            html += '<div class="channel-highlight">';
            channel.highlights.slice(0, 3).forEach(function(highlight) {
              html += '<div class="highlight-item">' + escapeHtml(highlight) + '</div>';
            });
            html += '</div>';
          }
          html += '</div>';
        });

        container.innerHTML = html;
      }

      function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      }

      function requestConnect() {
        post('CHATBRIDGE_SLACK_OAUTH_REQUEST', {});
      }

      async function refreshStatus() {
        try {
          var response = await fetch(backendUrl + '/api/oauth/slack/status', {
            headers: {
              Accept: 'application/json',
              Authorization: 'Bearer ' + authToken,
            },
          });
          var data = await response.json();
          return !!data.connected;
        } catch (e) {
          console.error('Status check failed:', e);
          return false;
        }
      }

      async function loadSummary() {
        showLoading();
        try {
          var response = await fetch(backendUrl + '/api/slack/summary', {
            headers: {
              Accept: 'application/json',
              Authorization: 'Bearer ' + authToken,
            },
          });
          if (!response.ok) {
            throw new Error('Failed to load summary (HTTP ' + response.status + ')');
          }
          var summary = await response.json();
          showSummary(summary);
          post('APP_STATE_UPDATE', {
            seq: 0,
            stateSummary:
              'Connected to Slack workspace: ' +
              summary.teamName +
              '. ' +
              summary.channels.length +
              ' channels with activity in last 24 hours.',
          });
        } catch (error) {
          var msg = error instanceof Error ? error.message : String(error);
          showError('Failed to load summary: ' + msg);
          post('APP_ERROR', { error: msg });
        }
      }

      async function sync() {
        var isConnected = await refreshStatus();
        setStatus(isConnected);

        if (isConnected) {
          await loadSummary();
          post('APP_RESULT', {
            seq: 0,
            toolName: 'slack_open',
            result: { sessionId: sessionId, connected: true },
          });
        } else {
          post('APP_RESULT', {
            seq: 0,
            toolName: 'slack_open',
            result: { sessionId: sessionId, connected: false },
          });
        }
      }

      window.addEventListener('message', function(rawEvent) {
        var event = rawEvent.data;
        if (!event || typeof event !== 'object') return;

        if (event.type === 'INIT_APP') {
          sessionId = event.sessionId;
          backendUrl = event.config && typeof event.config.backendUrl === 'string' ? event.config.backendUrl : '';
          authToken = event.config && typeof event.config.authToken === 'string' ? event.config.authToken : '';
          post('APP_READY', {});
          clearError();
          sync();
          return;
        }

        if (!sessionId || (event.sessionId && event.sessionId !== sessionId)) return;

        if (event.type === 'INVOKE_TOOL' && event.toolName === 'slack_open') {
          sync();
        }
      });
    </script>
  </body>
</html>`;
}
