'use strict';

// ── WMO Weather Code mapping ──────────────────────────────────────────────────

const WMO_CODES = {
  0:  { label: 'Clear sky',        emoji: '☀️'  },
  1:  { label: 'Mainly clear',     emoji: '🌤️' },
  2:  { label: 'Partly cloudy',    emoji: '⛅'  },
  3:  { label: 'Overcast',         emoji: '☁️'  },
  45: { label: 'Fog',              emoji: '🌫️' },
  48: { label: 'Rime fog',         emoji: '🌫️' },
  51: { label: 'Light drizzle',    emoji: '🌦️' },
  53: { label: 'Drizzle',          emoji: '🌦️' },
  55: { label: 'Dense drizzle',    emoji: '🌧️' },
  61: { label: 'Slight rain',      emoji: '🌧️' },
  63: { label: 'Rain',             emoji: '🌧️' },
  65: { label: 'Heavy rain',       emoji: '🌧️' },
  66: { label: 'Freezing rain',    emoji: '🌨️' },
  67: { label: 'Heavy freezing rain', emoji: '🌨️' },
  71: { label: 'Slight snow',      emoji: '🌨️' },
  73: { label: 'Snow',             emoji: '❄️'  },
  75: { label: 'Heavy snow',       emoji: '❄️'  },
  77: { label: 'Snow grains',      emoji: '🌨️' },
  80: { label: 'Rain showers',     emoji: '🌦️' },
  81: { label: 'Rain showers',     emoji: '🌧️' },
  82: { label: 'Violent showers',  emoji: '⛈️' },
  85: { label: 'Snow showers',     emoji: '🌨️' },
  86: { label: 'Heavy snow showers', emoji: '🌨️' },
  95: { label: 'Thunderstorm',     emoji: '⛈️' },
  96: { label: 'Thunderstorm',     emoji: '⛈️' },
  99: { label: 'Thunderstorm',     emoji: '⛈️' },
};

// ── State ─────────────────────────────────────────────────────────────────────

const FAVORITES_KEY = 'weather-dashboard-favorites';

const state = {
  cityLabel: null,
  lat:       null,
  lon:       null,
  current:   null,
  humidity:  null,
  daily:     null,
  isLoading: false,
  error:     null,
  favorites: [],     // [{ label, lat, lon }]
  panelOpen: false,
};

// ── DOM refs ──────────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);

const els = {
  form:         $('searchForm'),
  input:        $('cityInput'),
  errorMsg:     $('errorMsg'),
  loader:       $('loader'),
  currentWx:    $('currentWeather'),
  cityName:     $('cityName'),
  weatherIcon:  $('weatherIcon'),
  temperature:  $('temperature'),
  condition:    $('condition'),
  windSpeed:    $('windSpeed'),
  humidity:     $('humidity'),
  forecast:     $('forecast'),
  forecastCards: $('forecastCards'),
  favToggle:    $('favToggle'),
  menuBtn:      $('menuBtn'),
  favBackdrop:  $('favBackdrop'),
  favPanel:     $('favPanel'),
  favCloseBtn:  $('favCloseBtn'),
  favList:      $('favList'),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getWeatherInfo(code) {
  return WMO_CODES[code] ?? { label: 'Unknown', emoji: '🌡️' };
}

function formatTemp(n) {
  return `${Math.round(n)}°C`;
}

function getDayLabel(isoDate) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const d = new Date(isoDate + 'T12:00:00');
  const today = new Date();
  if (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  ) return 'Today';
  return days[d.getDay()];
}

// Coordinate identity key (rounded to avoid float mismatch)
function coordKey(lat, lon) {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

// ── Favorites persistence ──────────────────────────────────────────────────────

function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
  } catch {
    /* storage unavailable (private mode / quota) — favorites stay in-memory */
  }
}

function isFavorited(lat, lon) {
  if (lat === null || lon === null) return false;
  const key = coordKey(lat, lon);
  return state.favorites.some(f => coordKey(f.lat, f.lon) === key);
}

function toggleFavorite() {
  if (state.lat === null || state.lon === null) return;
  const key = coordKey(state.lat, state.lon);
  if (isFavorited(state.lat, state.lon)) {
    state.favorites = state.favorites.filter(f => coordKey(f.lat, f.lon) !== key);
  } else {
    state.favorites.push({ label: state.cityLabel, lat: state.lat, lon: state.lon });
  }
  saveFavorites();
  render();
}

function removeFavorite(key) {
  state.favorites = state.favorites.filter(f => coordKey(f.lat, f.lon) !== key);
  saveFavorites();
  render();
}

// ── API calls ─────────────────────────────────────────────────────────────────

async function geocode(city) {
  let res;
  try {
    res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
    );
  } catch {
    throw { type: 'NETWORK', message: 'Network error. Check your connection and try again.' };
  }

  if (!res.ok) {
    throw { type: 'API_ERROR', message: `Weather service error (HTTP ${res.status}). Try again later.`, status: res.status };
  }

  const data = await res.json();
  if (!data.results || data.results.length === 0) {
    throw { type: 'NOT_FOUND', message: 'City not found. Check the spelling and try again.' };
  }

  const { latitude, longitude, name, country } = data.results[0];
  return { lat: latitude, lon: longitude, cityLabel: `${name}, ${country}` };
}

async function fetchForecast(lat, lon) {
  let res;
  try {
    res = await fetch(
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&current_weather=true` +
      `&hourly=relativehumidity_2m` +
      `&daily=temperature_2m_max,temperature_2m_min,weathercode` +
      `&timezone=auto` +
      `&forecast_days=7`
    );
  } catch {
    throw { type: 'NETWORK', message: 'Network error. Check your connection and try again.' };
  }

  if (!res.ok) {
    throw { type: 'API_ERROR', message: `Weather service error (HTTP ${res.status}). Try again later.`, status: res.status };
  }

  const data = await res.json();
  const cw = data.current_weather;

  // Match current hour for humidity
  const currentTimePrefix = cw.time.slice(0, 16);
  const hourlyIdx = data.hourly.time.findIndex(t => t === currentTimePrefix);
  const humidity = data.hourly.relativehumidity_2m[hourlyIdx >= 0 ? hourlyIdx : 0];

  return {
    current: cw,
    humidity,
    daily: data.daily,
  };
}

// ── Core fetch orchestration ──────────────────────────────────────────────────

async function fetchWeather(cityQuery) {
  state.isLoading = true;
  state.error     = null;
  state.current   = null;
  state.daily     = null;
  render();

  try {
    const geo = await geocode(cityQuery);
    const wx  = await fetchForecast(geo.lat, geo.lon);

    state.cityLabel = geo.cityLabel;
    state.lat       = geo.lat;
    state.lon       = geo.lon;
    state.current   = wx.current;
    state.humidity  = wx.humidity;
    state.daily     = wx.daily;
  } catch (err) {
    state.error   = err;
    state.current = null;
    state.daily   = null;
  } finally {
    state.isLoading = false;
    render();
  }
}

// Load a saved favorite by stored coords — skips geocoding, reuses fetchForecast.
async function loadFavorite(fav) {
  state.panelOpen = false;
  state.isLoading = true;
  state.error     = null;
  state.current   = null;
  state.daily     = null;
  render();

  try {
    const wx = await fetchForecast(fav.lat, fav.lon);
    state.cityLabel = fav.label;
    state.lat       = fav.lat;
    state.lon       = fav.lon;
    state.current   = wx.current;
    state.humidity  = wx.humidity;
    state.daily     = wx.daily;
  } catch (err) {
    state.error   = err;
    state.current = null;
    state.daily   = null;
  } finally {
    state.isLoading = false;
    render();
  }
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderLoader() {
  els.loader.classList.toggle('hidden', !state.isLoading);
}

function renderError() {
  if (state.error) {
    els.errorMsg.textContent = state.error.message;
    els.errorMsg.classList.remove('hidden');
  } else {
    els.errorMsg.classList.add('hidden');
  }
}

function renderCurrent() {
  const show = !state.isLoading && state.current !== null;
  els.currentWx.classList.toggle('hidden', !show);
  if (!show) return;

  const info = getWeatherInfo(state.current.weathercode);

  els.cityName.textContent    = state.cityLabel;
  els.weatherIcon.textContent = info.emoji;
  els.temperature.textContent = formatTemp(state.current.temperature);
  els.condition.textContent   = info.label;
  els.windSpeed.textContent   = `💨 ${Math.round(state.current.windspeed)} km/h`;
  els.humidity.textContent    = `💧 ${state.humidity}%`;

  const fav = isFavorited(state.lat, state.lon);
  els.favToggle.textContent = fav ? '★' : '☆';
  els.favToggle.classList.toggle('active', fav);
}

function renderFavList() {
  if (state.favorites.length === 0) {
    els.favList.innerHTML = '<p class="fav-empty">No favorites yet.</p>';
    return;
  }
  els.favList.innerHTML = state.favorites.map(f => {
    const key = coordKey(f.lat, f.lon);
    return `
      <div class="fav-row" data-key="${key}">
        <span class="fav-row-name">${f.label}</span>
        <button class="fav-remove" data-key="${key}" aria-label="Remove favorite">×</button>
      </div>
    `;
  }).join('');
}

function renderPanel() {
  els.favPanel.classList.toggle('open', state.panelOpen);
  els.favBackdrop.classList.toggle('hidden', !state.panelOpen);
}

function renderForecast() {
  const show = !state.isLoading && state.daily !== null;
  els.forecast.classList.toggle('hidden', !show);
  if (!show) return;

  const { time, temperature_2m_max, temperature_2m_min, weathercode } = state.daily;

  els.forecastCards.innerHTML = time.map((isoDate, i) => {
    const info = getWeatherInfo(weathercode[i]);
    return `
      <div class="forecast-card">
        <span class="forecast-day">${getDayLabel(isoDate)}</span>
        <span class="forecast-icon">${info.emoji}</span>
        <span class="forecast-temp-max">${formatTemp(temperature_2m_max[i])}</span>
        <span class="forecast-temp-min">${formatTemp(temperature_2m_min[i])}</span>
      </div>
    `;
  }).join('');
}

function render() {
  renderLoader();
  renderError();
  renderCurrent();
  renderForecast();
  renderFavList();
  renderPanel();
}

// ── Event handling ────────────────────────────────────────────────────────────

function handleSearch() {
  const city = els.input.value.trim();
  if (!city) {
    state.error = { type: 'EMPTY_INPUT', message: 'Please enter a city name.' };
    render();
    return;
  }
  fetchWeather(city);
}

function setPanel(open) {
  state.panelOpen = open;
  render();
}

document.addEventListener('DOMContentLoaded', () => {
  state.favorites = loadFavorites();

  els.form.addEventListener('submit', e => {
    e.preventDefault();
    handleSearch();
  });

  els.favToggle.addEventListener('click', toggleFavorite);
  els.menuBtn.addEventListener('click', () => setPanel(!state.panelOpen));
  els.favCloseBtn.addEventListener('click', () => setPanel(false));
  els.favBackdrop.addEventListener('click', () => setPanel(false));

  // Event delegation: distinguish remove button from row click.
  els.favList.addEventListener('click', e => {
    const removeBtn = e.target.closest('.fav-remove');
    if (removeBtn) {
      removeFavorite(removeBtn.dataset.key);
      return;
    }
    const row = e.target.closest('.fav-row');
    if (row) {
      const fav = state.favorites.find(f => coordKey(f.lat, f.lon) === row.dataset.key);
      if (fav) loadFavorite(fav);
    }
  });

  render();
});
