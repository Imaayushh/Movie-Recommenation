# AGENTS.md

Project-specific guidance for AI coding agents.

## What this project is

**Filmphile** is a static site: plain HTML, CSS and vanilla JavaScript.
There is **no framework and no build step**. `index.html` at the repo root *is* the site.

## Rules

- **No build tooling.** Do not add npm dependencies, bundlers, or frameworks unless the
  user explicitly asks. The site must run by opening `index.html`.
- **Scripts are classic `<script defer>` files**, not ES modules — this keeps the site
  working when opened directly from the filesystem (`file://`).
- **All asset paths are relative** (`./assets/...`). Never use absolute `/assets/...`
  paths, or the deploy breaks on GitHub Pages project sites (`/<repo>/`).
- **Never use `innerHTML` with data.** Movie titles and viewer names are user-editable;
  build DOM with `document.createElement` + `textContent` (see the `h()` helper in
  `assets/js/app.js`).
- **All rendered UI lives in `assets/js/app.js`.** Keep the five menu panels as separate
  functions and re-render through `render()` / `renderPanel()`.
- **Domain logic stays out of the UI.** Scoring lives in `assets/js/recommender.js`,
  catalog data in `assets/js/data.js`, persistence in `assets/js/storage.js`.
- **Design tokens are CSS custom properties** in `assets/css/styles.css` (`:root` plus a
  `prefers-color-scheme: dark` block). Use `var(--…)` — no raw hex values in components.
- **Storage must fail safe.** `localStorage` can throw (private mode); `storage.js`
  already swallows those errors — keep it that way.

## Layout of files

```
index.html                     app shell, meta tags, script/style tags
assets/css/styles.css          design tokens + all styling
assets/js/data.js              CATEGORIES, MOVIES, USERS, SEED_RATINGS
assets/js/recommender.js       buildMatrix / topRated / recommendForUser / pickSurprise
assets/js/storage.js           localStorage wrapper
assets/js/app.js               state + rendering + five menu panels
.nojekyll                      GitHub Pages: skip Jekyll
.github/workflows/deploy.yml   GitHub Pages deploy
legacy-react/                  previous React + TypeScript source, kept for reference
```

## Original C program

The app is a port of a C movie-recommendation program (`reference/original.c`).
Genre ids, the 5 seeded viewers and the 50 seeded rating values are preserved 1:1 —
do not renumber them. `0` always means "Not Rated".

## Historical docs

`DESIGN.md` and `apple/` describe the Apple design language that the visual style follows.
They were written for the (now removed) Astryx/React version; treat them as design
reference only, not as build instructions.
