/*
  Fixes mojibake in selected project files by converting only the broken substrings
  (e.g., 'á', '·', 'â€œ', 'ðŸ…') back to proper UTF-8 characters. It preserves
  already-correct text by only transforming sequences that contain typical mojibake
  lead chars.

  Usage:
    node scripts/fixMojibake.js
*/

const fs = require('fs');
const path = require('path');

// Directories to scan (project-local code only; exclude node_modules)
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

// Regex to find mojibake substrings. We target sequences that include
// common lead characters produced when UTF-8 was mis-decoded as Latin-1.
//
// Examples we fix:
//   - 'á' -> 'á'
//   - '·' -> '·'
//   - 'Galería' -> 'Galería'
//   - 'â€œ' 'â€\x9d' -> fancy quotes
//   - 'ðŸ”„' -> emoji sequences
const MOJIBAKE_PATTERN = /(?:[����][\u0080-\u00FF]{1,3})+/g;

function fixSubstring(s) {
  try {
    // Interpret current substring as if it were Latin-1 bytes, then decode as UTF-8
    return Buffer.from(s, 'latin1').toString('utf8');
  } catch (_) {
    return s; // Fallback: return as-is if anything goes wrong
  }
}

function processFile(filePath) {
  const orig = fs.readFileSync(filePath, 'utf8');

  // Quick filter: skip files without any obvious mojibake lead chars
  if (!(/[����]/.test(orig))) return { changed: false };

  const fixed = orig.replace(MOJIBAKE_PATTERN, (m) => fixSubstring(m));

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
      // Skip dependencies, build output, and dot dirs
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
        console.log(`✔ Fixed mojibake: ${path.relative(ROOT, file)}`);
      }
    }
  }
  console.log(`\nScanned ${filesScanned} files. Updated ${changedCount} file(s).`);
}

if (require.main === module) {
  main();
}


