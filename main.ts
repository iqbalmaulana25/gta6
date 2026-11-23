// Solano Heat — the hand-in program for the make.fun "Make GTA 6" bounty (gta6-01).
//
// The game itself is the static site in game/ beside this file: plain HTML and ES modules
// that a desktop browser runs offline, with no build step and no network request. This
// program's whole job is to hand that site in exactly as the bounty asks: copy game/ and
// screenshots/ into the output directory and write dossier.json there with the vendored
// make.fun library, so the sealed scorer can rebuild the same dossier from the same files
// and compare the two byte for byte.
//
// Run it the way the grader does (Node 22, standard library only):
//   node main.ts                          — writes to /output
//   MAKEFUN_OUTPUT_DIR=out node main.ts   — writes to ./out outside the grader

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's own limits, handed to the dossier builder so an entry the scorer would refuse
// is refused here first: at most 4 screenshots of 256 KiB, at most 993 files and 48 MiB
// under game/, no game/ path over 1,000 bytes, and the dossier's source text capped at
// 160 KiB (the one cap that shapes the bytes written).
const GATE = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function countTree(dir) {
  let files = 0;
  let bytes = 0;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const info = statSync(path);
    if (info.isDirectory()) {
      const sub = countTree(path);
      files += sub.files;
      bytes += sub.bytes;
    } else {
      files += 1;
      bytes += info.size;
    }
  }
  return { files, bytes };
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

writeFileSync(join(out, 'dossier.json'), buildDossier(out, GATE));

const game = countTree(join(out, 'game'));
const shots = existsSync(join(out, 'screenshots')) ? readdirSync(join(out, 'screenshots')).length : 0;
console.log(`Solano Heat handed in: ${game.files} game files (${game.bytes} bytes), ${shots} screenshots, dossier.json written to ${out}`);
