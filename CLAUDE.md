# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Single-page weather dashboard. Pure frontend: HTML + CSS + vanilla JavaScript. **No build tools, no npm, no frameworks, no dependencies.** Run it by opening `index.html` directly in a browser — Open-Meteo's APIs are CORS-enabled, so no local server is required.

On load the page tries the browser **Geolocation API** and, if permission is granted, auto-loads that location's weather labeled "My Location". Any failure (denied / timeout / unsupported) falls back **silently** to the empty search prompt.

## Running

Open `index.html` in a browser. There is no build, lint, or test command. Verify changes manually:
- Search a real city (e.g. `Taipei`) → expect a geocoding request then a forecast request in the Network tab, current weather + a 7-day forecast.
- Search gibberish → "City not found" error.
- Submit empty input → "Please enter a city name."

**Testing geolocation:** the Geolocation API requires a secure context, so `file://` may not prompt. Serve locally to test it: `python -m http.server 8000` → open `http://localhost:8000`.

## Architecture

Three files, strict separation of concerns:

- `index.html` — static skeleton only. Every dynamic element is an empty tag with an `id`; JS fills content and toggles a `.hidden` class to show/hide whole sections (`#loader`, `#currentWeather`, `#forecast`, `#errorMsg`), plus the favorites menu button, panel, and backdrop.
- `style.css` — dark glassmorphism theme driven by `:root` custom properties. Visibility is never set here per-element; the shared `.hidden { display: none !important }` utility is the show/hide mechanism. The favorites panel slides via `transform: translateX(100%)` → `.open`.
- `app.js` — all logic.

### app.js data flow

A single `state` object is the source of truth: `{ cityLabel, lat, lon, current, humidity, daily, isLoading, error, favorites, panelOpen }`. Nothing touches the DOM except `render()`.

The cycle is: an entry point (`handleSearch()` for manual search, `loadFavorite()` from the panel, `geolocateOnLoad()` on startup) mutates `state` and calls `render()` at each transition (loading → loaded/error) → `render()` reads `state` and calls **six** sub-renderers (`renderLoader/Error/Current/Forecast/FavList/Panel`), each of which derives visibility from `state` and toggles `.hidden`/`.open`. **Do not update the DOM outside `render()`** — add to `state` and let `render()` reflect it.

`loadByCoords(lat, lon, label)` is the shared "fetch by coordinates, skip geocoding" path — both `loadFavorite()` (stored coords) and `geolocateOnLoad()` (browser coords, label `"My Location"`) delegate to it, reusing `fetchForecast()` directly.

### API integration (two sequential calls)

1. **Geocoding** — `geocode(city)` hits `geocoding-api.open-meteo.com/v1/search`, returns `{ lat, lon, cityLabel }`. Empty `results` → throws `NOT_FOUND`. **Forward-only** — the endpoint has no reverse geocoding (lat/lon → name returns HTTP 400), which is why geolocation shows the generic label "My Location" rather than a city name.
2. **Forecast** — `fetchForecast(lat, lon)` hits `api.open-meteo.com/v1/forecast` with `current_weather`, `hourly=relativehumidity_2m`, and `daily` arrays (`temperature_2m_max/min`, `weathercode`, `precipitation_probability_max`). Humidity is not in `current_weather`; it's looked up by matching `current_weather.time` against the `hourly.time` array. Today's rain chance shown on the current-weather card is `daily.precipitation_probability_max[0]`.

### Favorites

Saved cities persist in `localStorage` under the key `weather-dashboard-favorites` (constant `FAVORITES_KEY`) as `{ label, lat, lon }` objects. Membership/identity is keyed by `coordKey(lat, lon)` (coords rounded to 2 decimals to avoid float mismatch). `loadFavorites()`/`saveFavorites()` wrap storage access and tolerate it being unavailable (private mode / quota) — favorites then stay in-memory only.

Errors are thrown as plain objects `{ type, message, status? }`, never `Error` instances. Types: `EMPTY_INPUT`, `NOT_FOUND`, `NETWORK` (fetch rejection), `API_ERROR` (non-ok HTTP). `fetchWeather`'s `catch` stores the object in `state.error`; its `finally` always re-renders so the UI never hangs on the spinner.

### WMO weather codes

`WMO_CODES` maps Open-Meteo's numeric `weathercode` to `{ label, emoji }`. `getWeatherInfo(code)` is the only accessor and falls back to `{ label: 'Unknown', emoji: '🌡️' }` for unmapped codes — keep this fallback when extending the table.

## Git workflow

`main` is the main branch. Each new feature gets its own branch cut from latest `main` (`feat/<name>`), developed, then merged back. Commit messages use Conventional Commits.
