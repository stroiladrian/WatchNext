# WatchNext

Simple dark/amber web app (styled after your CinemaCity designs): see the best-rated new movies and shows, with Rotten Tomatoes scores.

## Free setup (no paid services)
1. Free API keys:
   - TMDB: https://www.themoviedb.org/settings/api (posters, dates, new releases)
   - OMDb: https://www.omdbapi.com/apikey.aspx (free tier, 1000 req/day; returns the Rotten Tomatoes %)
2. Fetch data locally: `TMDB_KEY=... OMDB_KEY=... node fetch-data.mjs` (Node 18+) -> writes `data.json`
3. View: `python3 -m http.server 8000` then open http://localhost:8000
4. Host free on GitHub Pages; add TMDB_KEY / OMDB_KEY as repo secrets and the included workflow refreshes `data.json` automatically.

`data.json` currently holds demo data taken from your screenshots (no posters).

Notes: rottentomatoes.com has no public API and scraping it is against its terms, so scores come via OMDb. Scores are cached 3 days to stay under the OMDb limit.
