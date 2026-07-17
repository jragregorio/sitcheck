const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(projectRoot, "dist");
const filesToCopy = [
  "index.html",
  "admin.html",
  "about.html",
  "privacy-policy.html",
  "CHANGELOG.md",
  "app.js",
  "admin.js",
  "custom-select.js",
  "contribution-reminders.js",
  "styles.css",
  "config.js"
];

fs.rmSync(outputDir, {
  recursive: true,
  force: true
});
fs.mkdirSync(outputDir, {
  recursive: true
});

for (const fileName of filesToCopy) {
  const sourcePath = path.join(projectRoot, fileName);
  const destinationPath = path.join(outputDir, fileName);
  fs.copyFileSync(sourcePath, destinationPath);
}

console.log(`Synced ${filesToCopy.length} files to dist/`);
