# Subishi Projects Map

Phone-first map of every Subishi project across Telangana. Vite + Preact + MapLibre, deployed on Vercel.
The full plan, UI spec and build guide live in the "Subishi Project Map — Build Plan & UI Spec" doc.

## Start
```bash
npm ci          # installs the exact versions in package-lock.json
npm run dev     # checks the data, then starts the dev server (open the Network URL on your phone)
```

## Everyday commands
| Command | What it does |
| --- | --- |
| `npm run data` | Validates `data/` and writes `public/data/index.json` |
| `npm run build` | Data check + type check + production build into `dist/` |
| `npm run preview` | Serves the production build locally |
| `npm run links` | Checks every outbound link still answers |
| `npm run pins` | Makes the round photo for each map pin (`public/img/projects/<id>/pin.webp`) from the project photo |
| `npm run style` | Regenerates `public/map/style.json` from OpenFreeMap Positron (overwrites manual edits) |

## Add a project
See `data/README.md`.

## Built vs still to build
Built and tested: splash → logo into nav, India → Telangana intro, Telangana outline, clustered pins with pop-in,
status filter chips, shared links (`?p=serenity`), data validation, map style, Vercel caching headers.
Still to build (Phase 3): the bottom sheet's list and project card, search, area chips, Villas/Apartments toggle,
sheet drag snapping. `reference/prototype.html` is the approved design for all of these: open it in a browser
and reuse its markup, CSS and sheet-drag logic.
