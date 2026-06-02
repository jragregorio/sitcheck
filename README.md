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

## Android development

After you change web files (`index.html`, `app.js`, `styles.css`, and related assets), copy them into the Android app:

```bash
npm run cap:sync:android
```

This runs `sync:web` (copies the site into `dist/`) and then `cap sync android` so the Capacitor Android project picks up the latest web build. Use this before running or packaging the app whenever the in-app UI looks stale.

Open the native project in Android Studio (emulator, device, or manual Gradle tasks):

```bash
npm run cap:open:android
```

## Rebuild Android release bundle

From the project root in PowerShell, set Java 17 (required by Gradle) and build the Play Console bundle:

```powershell
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
$env:Path="$env:JAVA_HOME\bin;$env:Path"
npm run android:bundle:release
```

Upload this file to Play Console:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

If Gradle reports Java 8, run the `$env:JAVA_HOME` and `$env:Path` lines again in the same terminal before rebuilding.

## Version numbering

Display versions use **MAJOR.MINOR.PATCH** where each segment is **1–9 only**. When PATCH would reach 10, reset PATCH to 1 and increment MINOR (for example `1.2.9` → `1.3.1`, and old `1.2.11` → `1.3.1`).

To bump for a new release:

```bash
npm run bump:version
```

Then update `CHANGELOG.md`, run `npm run sync:web`, and build the Android bundle. **`versionCode`** in `android/app/build.gradle` still increases by 1 every release (required by Play Console).

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
