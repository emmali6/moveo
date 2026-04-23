/**
 * Import exercise names from a public JSON dataset and generate data/exercises_extra.json
 *
 * Source dataset:
 * - https://github.com/wrkout/exercises.json
 * Prebuilt export used:
 * - https://github.com/yuhonas/free-exercise-db (dist/exercises.json)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

function slugify(str) {
  return String(str || '')
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function uniqueId(baseId, used) {
  let id = baseId;
  let n = 2;
  while (used.has(id) || !id) {
    id = `${baseId}-${n++}`;
  }
  used.add(id);
  return id;
}

function main() {
  const outPath = path.join(__dirname, '..', 'data', 'exercises_extra.json');

  const sourceUrl = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
  https
    .get(sourceUrl, (res) => {
      if (res.statusCode !== 200) {
        console.error('Failed to download source JSON:', res.statusCode);
        process.exit(1);
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        const items = JSON.parse(body);

        const usedIds = new Set();
        const extras = [];

        for (const it of items) {
          const name = it?.name || it?.exercise?.name;
          if (!name) continue;
          const baseId = slugify(name);
          const id = uniqueId(baseId, usedIds);

          extras.push({
            id,
            name,
            description: '',
            difficulty: 'beginner',
            muscleGroups: [],
            primaryMuscles: [],
            secondaryMuscles: [],
            category: 'strength',
            goals: [],
            equipment: ['none'],
            constraints: [],
            duration: 5,
            tips: [],
            commonMistakes: [],
          });
        }

        extras.sort((a, b) => a.name.localeCompare(b.name));
        fs.writeFileSync(outPath, JSON.stringify(extras, null, 2) + '\n', 'utf8');
        console.log(`Wrote ${extras.length} exercises to ${outPath}`);
      });
    })
    .on('error', (err) => {
      console.error('Download error:', err);
      process.exit(1);
    });
}

main();

