/**
 * SitCheck versioning: MAJOR.MINOR.PATCH where PATCH is 1–9 only.
 * When PATCH would reach 10, set PATCH to 1 and increment MINOR (and so on for MINOR→MAJOR).
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

const FILES = {
  packageJson: path.join(ROOT, "package.json"),
  packageLock: path.join(ROOT, "package-lock.json"),
  aboutHtml: path.join(ROOT, "about.html"),
  buildGradle: path.join(ROOT, "android", "app", "build.gradle")
};

function parseVersion(version) {
  const parts = String(version).trim().split(".").map((part) => Number(part));

  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part) || part < 0)) {
    throw new Error(`Invalid version "${version}". Expected MAJOR.MINOR.PATCH with integers.`);
  }

  return { major: parts[0], minor: parts[1], patch: parts[2] };
}

function formatVersion({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

/** Carry overflow so PATCH stays in 1–9 (values 0 or 10+ roll upward). */
function normalizeParts({ major, minor, patch }) {
  let nextMajor = major;
  let nextMinor = minor;
  let nextPatch = patch;

  while (nextPatch > 9) {
    const carries = Math.floor((nextPatch - 1) / 9);
    nextMinor += carries;
    nextPatch = ((nextPatch - 1) % 9) + 1;
  }

  while (nextMinor > 9) {
    const carries = Math.floor((nextMinor - 1) / 9);
    nextMajor += carries;
    nextMinor = ((nextMinor - 1) % 9) + 1;
  }

  return { major: nextMajor, minor: nextMinor, patch: nextPatch };
}

function bumpPatch(version) {
  const normalized = normalizeParts(parseVersion(version));
  normalized.patch += 1;
  return formatVersion(normalizeParts(normalized));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function updatePackageLock(version) {
  const lock = readJson(FILES.packageLock);
  lock.version = version;

  if (lock.packages?.[""]) {
    lock.packages[""].version = version;
  }

  writeJson(FILES.packageLock, lock);
}

function updateAboutHtml(version) {
  const html = fs.readFileSync(FILES.aboutHtml, "utf8");
  const updated = html.replace(
    /(<span id="app-version">)[^<]+(<\/span>)/,
    `$1${version}$2`
  );

  if (updated === html) {
    throw new Error("Could not find app-version span in about.html");
  }

  fs.writeFileSync(FILES.aboutHtml, updated);
}

function readBuildGradle() {
  return fs.readFileSync(FILES.buildGradle, "utf8");
}

function updateBuildGradle(version) {
  const gradle = readBuildGradle();
  const versionCodeMatch = gradle.match(/versionCode\s+(\d+)/);

  if (!versionCodeMatch) {
    throw new Error("Could not find versionCode in android/app/build.gradle");
  }

  const nextVersionCode = Number(versionCodeMatch[1]) + 1;
  const updated = gradle
    .replace(/versionCode\s+\d+/, `versionCode ${nextVersionCode}`)
    .replace(/versionName\s+"[^"]+"/, `versionName "${version}"`);

  fs.writeFileSync(FILES.buildGradle, updated);
  return nextVersionCode;
}

function main() {
  const pkg = readJson(FILES.packageJson);
  const current = pkg.version;
  const next = bumpPatch(current);

  pkg.version = next;
  writeJson(FILES.packageJson, pkg);
  updatePackageLock(next);
  updateAboutHtml(next);
  const versionCode = updateBuildGradle(next);

  console.log(`Bumped ${current} → ${next} (versionCode ${versionCode})`);
  console.log("Update CHANGELOG.md with the release notes for this version.");
}

main();
