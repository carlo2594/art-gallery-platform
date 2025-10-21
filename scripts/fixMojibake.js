/*
  Fixes mojibake in selected project files by converting only broken substrings
  back to proper UTF-8. It preserves already-correct text by only transforming
  sequences that contain typical mojibake lead characters.

  Usage:
    node scripts/fixMojibake.js
*/

const fs = require('fs');
const path = require('path');

// Project directories to scan (exclude dependencies and build outputs)
const ROOT = process.cwd();
const TARGET_DIRS = [
  'controllers',
  'views',
  'models',
  'scripts',
  'routes'
].map((p) => path.join(ROOT, p)).filter(fs.existsSync);

// File extensions to consider
const EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.pug', '.json']);

// Patterns for common mojibake sequences
const PATTERNS = [
  // Latin-1/Windows-1252 decoded from UTF-8 (e.g., sequences starting with Ã, Â, â)
  { re: /(?:[ÃÂâ][\u0080-\uFFFF]{1,3})+/g },
  // Emoji mojibake (e.g., sequences starting with ð followed by a few high bytes)
  { re: /ð[\u0080-\uFFFF]{1,3}/g }
];

function fixSubstring(s) {
  try {
    return Buffer.from(s, 'latin1').toString('utf8');
  } catch {
    return s;
  }
}

function processFile(filePath) {
  const orig = fs.readFileSync(filePath, 'utf8');
  if (!(/[ÃÂâð]/.test(orig))) return { changed: false };
  let fixed = orig;
  for (const { re } of PATTERNS) {
    fixed = fixed.replace(re, (m) => fixSubstring(m));
  }
  if (fixed !== orig) {
    fs.writeFileSync(filePath, fixed, 'utf8');
    return { changed: true };
  }
  return { changed: false };
}

function* walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (/node_modules|\.git|dist|build|public[\\\/]assets/.test(p)) continue;
      yield* walk(p);
    } else if (EXTENSIONS.has(path.extname(e.name))) {
      yield p;
    }
  }
}

function main() {
  let changedCount = 0;
  let filesScanned = 0;
  for (const base of TARGET_DIRS) {
    for (const file of walk(base)) {
      filesScanned += 1;
      const { changed } = processFile(file);
      if (changed) {
        changedCount += 1;
        console.log(`Fixed mojibake: ${path.relative(ROOT, file)}`);
      }
    }
  }
  console.log(`\nScanned ${filesScanned} files. Updated ${changedCount} file(s).`);
}

if (require.main === module) {
  main();
}

