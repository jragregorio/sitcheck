# SitCheck

Toilet location and bidet availability. Because why not?

## What this is

This is a lightweight static demo for `SitCheck`, a restroom finder focused on:

- location
- bidet availability
- cleanliness
- payment requirement

The current version is intentionally simple so it can be tested quickly and shared easily.

## Files

- `index.html` - page structure
- `styles.css` - layout and visual styling
- `app.js` - sample data, filters, and local form behavior

## Run locally

Option 1:

- Open `index.html` directly in your browser

Option 2:

- Serve the folder locally with a static server

Example with Python:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Demo features

- responsive landing page
- restroom listing cards
- filters for bidet, payment, cleanliness, and search
- add-a-toilet form
- browser local storage persistence for demo data

## Easy online sharing

Because this is a static site, it is a good fit for GitHub Pages:

1. Push these files to the repository.
2. In GitHub, open repository settings.
3. Enable GitHub Pages from the main branch.
4. Share the generated URL for testing.

Repository: [jragregorio/sitcheck](https://github.com/jragregorio/sitcheck)
