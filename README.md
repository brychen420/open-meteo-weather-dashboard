# Weather Dashboard

A single-page weather dashboard built with pure frontend technologies. Search any city — or let it use your current location — and see the current conditions plus a 7-day forecast, powered by [Open-Meteo](https://open-meteo.com/).

## Features

- 🔍 **City search** — type a city name; it's geocoded to coordinates, then its weather is fetched.
- 📍 **Geolocation on load** — on startup the app asks for your location and auto-loads its weather (labeled "My Location"). Denying silently falls back to manual search.
- 🌡️ **Current conditions** — temperature, weather condition, wind speed, and humidity.
- 📅 **7-day forecast** — daily min/max temperature with a weather icon.
- ☔ **Precipitation probability** — today's rain chance on the current card, plus the daily max for each forecast day.
- ⭐ **Favorite cities** — star a city to save it; open the slide-out menu to revisit saved cities with one click. Favorites persist across reloads via `localStorage`.

## Tech

Pure frontend — **HTML + CSS + vanilla JavaScript**. No build tools, no npm, no frameworks, no dependencies. Weather data comes from **Open-Meteo**, which needs no API key and is CORS-enabled, so the browser fetches it directly.

## Running locally

Just open `index.html` in a browser — no build step or server required.

```bash
# Option A: open the file directly
open index.html        # macOS
start index.html       # Windows

# Option B: serve locally (required to test geolocation, which needs a secure context)
python -m http.server 8000
# then open http://localhost:8000
```

> **Note:** The browser Geolocation API requires a secure context. Opening via `file://` may not prompt for location in some browsers — use the local-server option above to test that feature.

## Project structure

| File | Responsibility |
|------|----------------|
| `index.html` | Static skeleton — empty tagged elements that JavaScript fills in. |
| `style.css` | Dark glassmorphism theme driven by CSS custom properties. |
| `app.js` | All logic — state, rendering, API calls, favorites, geolocation. |

A single `state` object is the source of truth; only `render()` touches the DOM.

## APIs used

- **Geocoding** — `https://geocoding-api.open-meteo.com/v1/search` (city name → coordinates).
- **Forecast** — `https://api.open-meteo.com/v1/forecast` (current weather + hourly humidity + 7-day daily forecast).

## Author

Built by [brychen420](https://github.com/brychen420).

## License

MIT
