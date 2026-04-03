export function createWeatherAppSrcDoc() {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        color-scheme: light;
        font-family: "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        min-height: 100vh;
        color: #0b2942;
        background:
          radial-gradient(circle at top left, rgba(255,255,255,0.92), transparent 26%),
          linear-gradient(180deg, #d9eefb 0%, #bfe0f4 38%, #9ecde8 100%);
      }
      .shell {
        min-height: 100vh;
        padding: 18px;
        display: grid;
        gap: 16px;
      }
      .hero {
        display: flex;
        justify-content: space-between;
        align-items: start;
        gap: 12px;
      }
      .eyebrow {
        font-size: 10px;
        letter-spacing: 0.24em;
        text-transform: uppercase;
        color: #52718a;
        margin-bottom: 4px;
      }
      .title {
        font-size: 28px;
        font-weight: 800;
        line-height: 1;
      }
      .subtitle {
        margin-top: 6px;
        font-size: 13px;
        color: #45657d;
      }
      .badge {
        border-radius: 999px;
        padding: 10px 14px;
        background: rgba(255,255,255,0.72);
        box-shadow: 0 12px 24px rgba(47, 90, 122, 0.14);
        font-size: 12px;
        font-weight: 700;
        white-space: nowrap;
      }
      .panel {
        border-radius: 22px;
        padding: 18px;
        background: rgba(255,255,255,0.72);
        border: 1px solid rgba(76, 122, 155, 0.18);
        box-shadow:
          0 18px 30px rgba(33, 82, 117, 0.12),
          inset 0 1px 0 rgba(255,255,255,0.7);
      }
      .status {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 14px;
        color: #35556c;
      }
      .spinner {
        width: 16px;
        height: 16px;
        border-radius: 999px;
        border: 2px solid rgba(11, 41, 66, 0.16);
        border-top-color: #0b2942;
        animation: spin 0.7s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      .error {
        display: none;
        background: #fff1f1;
        color: #8f2626;
        border: 1px solid rgba(143, 38, 38, 0.12);
      }
      .error.visible {
        display: block;
      }
      .current {
        display: grid;
        grid-template-columns: 1.2fr 0.8fr;
        gap: 14px;
      }
      .current h2,
      .forecast h2 {
        margin: 0 0 10px;
        font-size: 13px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #54748a;
      }
      .location {
        font-size: 28px;
        font-weight: 800;
        line-height: 1.1;
        margin-bottom: 8px;
      }
      .temp {
        font-size: 56px;
        font-weight: 800;
        line-height: 1;
      }
      .summary {
        margin-top: 10px;
        font-size: 16px;
        color: #385871;
      }
      .meta {
        display: grid;
        gap: 10px;
      }
      .meta-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 12px;
        border-radius: 14px;
        background: rgba(255,255,255,0.62);
        font-size: 13px;
      }
      .meta-label {
        color: #5d7a90;
      }
      .forecast-grid {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 10px;
      }
      .forecast-card {
        padding: 12px;
        border-radius: 16px;
        background: rgba(255,255,255,0.58);
        border: 1px solid rgba(76, 122, 155, 0.12);
      }
      .forecast-day {
        font-size: 12px;
        font-weight: 800;
        color: #4d6d84;
        margin-bottom: 8px;
        text-transform: uppercase;
      }
      .forecast-temp {
        font-size: 26px;
        font-weight: 800;
        margin-bottom: 6px;
      }
      .forecast-copy {
        font-size: 12px;
        color: #496880;
        line-height: 1.5;
      }
      .empty {
        text-align: center;
        color: #47687f;
        padding: 30px 20px;
        font-size: 14px;
      }
      @media (max-width: 900px) {
        .current {
          grid-template-columns: 1fr;
        }
        .forecast-grid {
          grid-template-columns: 1fr 1fr;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="hero">
        <div>
          <div class="eyebrow">Interactive App</div>
          <div class="title">Weather</div>
          <div class="subtitle" id="subtitle">Waiting for a location...</div>
        </div>
        <div class="badge" id="badge">Idle</div>
      </div>

      <div class="panel status" id="loading">
        <div class="spinner"></div>
        <div id="loading-copy">Waiting for a weather request...</div>
      </div>

      <div class="panel error" id="error-panel"></div>

      <div class="panel empty" id="empty-state">
        Ask for the weather in a city like Austin, Chicago, or London.
      </div>

      <div class="panel current" id="current-panel" hidden>
        <div>
          <h2>Current Conditions</h2>
          <div class="location" id="location-name"></div>
          <div class="temp" id="temp-value"></div>
          <div class="summary" id="summary-copy"></div>
        </div>
        <div class="meta" id="meta-grid"></div>
      </div>

      <div class="panel forecast" id="forecast-panel" hidden>
        <h2>5-Day Forecast</h2>
        <div class="forecast-grid" id="forecast-grid"></div>
      </div>
    </div>

    <script>
      const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      let sessionId = '';
      let backendUrl = '';

      function escapeHtml(value) {
        return String(value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      const loadingEl = document.getElementById('loading');
      const loadingCopyEl = document.getElementById('loading-copy');
      const errorPanelEl = document.getElementById('error-panel');
      const subtitleEl = document.getElementById('subtitle');
      const badgeEl = document.getElementById('badge');
      const emptyStateEl = document.getElementById('empty-state');
      const currentPanelEl = document.getElementById('current-panel');
      const forecastPanelEl = document.getElementById('forecast-panel');
      const locationNameEl = document.getElementById('location-name');
      const tempValueEl = document.getElementById('temp-value');
      const summaryCopyEl = document.getElementById('summary-copy');
      const metaGridEl = document.getElementById('meta-grid');
      const forecastGridEl = document.getElementById('forecast-grid');

      function post(type, payload) {
        if (!sessionId) {
          return;
        }
        console.info('[weather-app] post', { type, sessionId, payload });
        window.parent.postMessage({ type, sessionId, ...payload }, '*');
      }

      function setBadge(text) {
        badgeEl.textContent = text;
      }

      function showLoading(copy) {
        loadingEl.hidden = false;
        loadingCopyEl.textContent = copy;
        emptyStateEl.hidden = true;
        currentPanelEl.hidden = true;
        forecastPanelEl.hidden = true;
        errorPanelEl.classList.remove('visible');
        errorPanelEl.textContent = '';
        setBadge('Loading');
      }

      function showEmpty(copy) {
        loadingEl.hidden = true;
        emptyStateEl.hidden = false;
        emptyStateEl.textContent = copy;
        currentPanelEl.hidden = true;
        forecastPanelEl.hidden = true;
        errorPanelEl.classList.remove('visible');
        errorPanelEl.textContent = '';
        setBadge('Idle');
      }

      function showError(message) {
        loadingEl.hidden = true;
        emptyStateEl.hidden = true;
        currentPanelEl.hidden = true;
        forecastPanelEl.hidden = true;
        errorPanelEl.textContent = message;
        errorPanelEl.classList.add('visible');
        setBadge('Error');
      }

      function describeConditions(item) {
        return item.weather && item.weather.length ? item.weather[0].description : 'Unavailable';
      }

      function summarizeForecast(list) {
        const grouped = new Map();
        for (const item of list) {
          const dayKey = item.dt_txt.slice(0, 10);
          if (!grouped.has(dayKey)) {
            grouped.set(dayKey, item);
          }
        }
        return Array.from(grouped.values()).slice(0, 5);
      }

      function renderMeta(current) {
        metaGridEl.innerHTML = '';
        const rows = [
          ['Feels like', Math.round(current.main.feels_like) + '°F'],
          ['Humidity', current.main.humidity + '%'],
          ['Wind', Math.round(current.wind.speed) + ' mph'],
          ['Clouds', current.clouds.all + '%'],
        ];
        for (const row of rows) {
          const el = document.createElement('div');
          el.className = 'meta-row';
          el.innerHTML = '<span class="meta-label">' + row[0] + '</span><strong>' + row[1] + '</strong>';
          metaGridEl.appendChild(el);
        }
      }

      function renderForecast(items) {
        forecastGridEl.innerHTML = '';
        for (const item of items) {
          const day = new Date(item.dt * 1000);
          const card = document.createElement('div');
          card.className = 'forecast-card';
          card.innerHTML =
            '<div class="forecast-day">' +
            DAYS[day.getDay()] +
            '</div>' +
            '<div class="forecast-temp">' +
            Math.round(item.main.temp) +
            '°</div>' +
            '<div class="forecast-copy">' +
            escapeHtml(describeConditions(item)) +
            '</div>';
          forecastGridEl.appendChild(card);
        }
      }

      async function fetchJson(url) {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Weather request failed with status ' + response.status);
        }
        return await response.json();
      }

      async function lookupWeather(location, toolName, seq) {
        console.info('[weather-app] lookup:start', { location, toolName, seq, backendUrl });
        subtitleEl.textContent = location;
        if (!backendUrl) {
          const message = 'Weather service is not configured.';
          showError(message);
          post('APP_ERROR', { error: message });
          post('APP_RESULT', {
            seq,
            toolName,
            result: { error: 'not_configured', message },
          });
          return;
        }

        showLoading('Looking up ' + location + '...');

        try {
          const result = await fetchJson(
            backendUrl.replace(/\/$/, '') + '/api/weather?location=' + encodeURIComponent(location)
          );
          console.info('[weather-app] lookup:success', { location, seq, result });
          const summaryText =
            result.location +
            ': ' +
            Math.round(result.temperatureF) +
            '°F and ' +
            result.description;

          locationNameEl.textContent = result.location;
          tempValueEl.textContent = Math.round(result.temperatureF) + '°F';
          summaryCopyEl.textContent = result.description;
          renderMeta({
            main: {
              temp: result.temperatureF,
              feels_like: result.feelsLikeF,
              humidity: result.humidity,
            },
            weather: [{ description: result.description }],
            wind: { speed: result.windMph },
          });
          renderForecast(
            Array.isArray(result.forecast)
              ? result.forecast.map((item, index) => ({
                  dt: Date.now() / 1000 + index * 86400,
                  main: { temp: item.temperatureF },
                  weather: [{ description: item.description }],
                }))
              : []
          );
          loadingEl.hidden = true;
          errorPanelEl.classList.remove('visible');
          emptyStateEl.hidden = true;
          currentPanelEl.hidden = false;
          forecastPanelEl.hidden = false;
          setBadge('Ready');

          post('APP_STATE_UPDATE', {
            seq,
            stateSummary:
              summaryText +
              '. Forecast: ' +
              (Array.isArray(result.forecast) ? result.forecast : [])
                .map((item) => item.day + ' ' + Math.round(item.temperatureF) + '°F')
                .join(', '),
          });

          post('APP_RESULT', {
            seq,
            toolName,
            result,
          });

          post('APP_COMPLETE', {
            result: {
              summary: summaryText,
              data: result,
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn('[weather-app] lookup:error', { location, seq, message });
          showError(message);
          post('APP_ERROR', { error: message });
          post('APP_RESULT', {
            seq,
            toolName,
            result: { error: 'request_failed', location, message },
          });
        }
      }

      window.addEventListener('message', async (rawEvent) => {
        const event = rawEvent.data;
        if (!event || typeof event !== 'object' || typeof event.type !== 'string') {
          return;
        }

        if (event.type === 'INIT_APP') {
          console.info('[weather-app] init', { sessionId: event.sessionId, config: event.config });
          sessionId = event.sessionId;
          backendUrl = typeof event.config?.backendUrl === 'string' ? event.config.backendUrl : '';
          post('APP_READY', {});

          subtitleEl.textContent = 'Waiting for a location...';
          showEmpty('Ask for the weather in a city like Austin, Chicago, or London.');
          return;
        }

        if (event.type === 'INVOKE_TOOL' && event.toolName === 'weather_get') {
          console.info('[weather-app] invoke', { seq: event.seq, params: event.params });
          const location = typeof event.params?.location === 'string' ? event.params.location : '';
          if (!location.trim()) {
            const message = 'Location not found';
            showError(message);
            post('APP_RESULT', {
              seq: event.seq,
              toolName: 'weather_get',
              result: { error: 'location_not_found', message },
            });
            return;
          }
          await lookupWeather(location, 'weather_get', event.seq);
        }
      });
    </script>
  </body>
</html>`
}
