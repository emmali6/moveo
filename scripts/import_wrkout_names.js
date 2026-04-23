/**
 * Import exercises from a public JSON dataset and generate data/exercises_extra.json
 *
 * Goal: provide "Moveo-shaped" exercise objects for the library without requiring manual entry.
 * We bring in names + instructions + muscles + equipment + level, then generate the extra
 * Moveo fields (mods/amplifications/cues/programming) with sensible defaults.
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

function mapEquipment(eq) {
  const s = String(eq || '').toLowerCase();
  if (!s || s === 'body only') return ['none'];
  if (s.includes('dumbbell')) return ['dumbbells'];
  if (s.includes('band')) return ['resistance bands'];
  if (s.includes('machine') || s.includes('cable')) return ['gym machines'];
  if (s.includes('barbell')) return ['gym machines'];
  if (s.includes('kettlebell')) return ['gym machines'];
  return ['gym machines'];
}

function mapDifficulty(level) {
  const s = String(level || '').toLowerCase();
  if (s.includes('begin')) return 'beginner';
  if (s.includes('inter')) return 'intermediate';
  if (s.includes('adv') || s.includes('expert')) return 'advanced';
  return 'beginner';
}

function mapGoals(category) {
  const c = String(category || '').toLowerCase();
  if (c.includes('stretch') || c.includes('mobility')) return ['mobility'];
  if (c.includes('plyo') || c.includes('cardio')) return ['endurance'];
  if (c.includes('strength')) return ['strength', 'hypertrophy'];
  if (c.includes('power')) return ['strength'];
  return ['strength'];
}

function pickCategoryFromGoals(goals) {
  const g = new Set((goals || []).map((x) => String(x).toLowerCase()));
  if (g.has('rehab')) return 'rehab';
  if (g.has('mobility')) return 'mobility';
  if (g.has('endurance')) return 'endurance';
  if (g.has('hypertrophy') && !g.has('strength')) return 'hypertrophy';
  return 'strength';
}

function defaultBreathing(mechanic) {
  const m = String(mechanic || '').toLowerCase();
  if (m.includes('isolation')) {
    return ['Exhale on the effort.', 'Inhale as you return with control.'];
  }
  return ['Inhale on the way down.', 'Exhale on the way up / on the effort.'];
}

function defaultWhatFeel(primary) {
  const p = (primary || []).map((x) => String(x).toLowerCase());
  if (p.includes('glutes')) return ['Glutes doing the work (not your low back).', 'Core helping you stay steady.'];
  if (p.includes('abdominals') || p.includes('core')) return ['Abs doing the work (not your neck).', 'Ribs staying gently down as you move.'];
  if (p.includes('quadriceps')) return ['Quads and glutes working (not knee pain).', 'Feet stable and knees tracking over toes.'];
  if (p.includes('chest')) return ['Chest and triceps working (not shoulders shrugging).', 'Core braced so your body stays solid.'];
  if (p.includes('back') || p.includes('lats')) return ['Upper back/lats pulling (not just arms).', 'Shoulders down away from ears.'];
  return ['Target muscles doing the work.', 'Movement feels controlled—not rushed.'];
}

function defaultProgramming() {
  return {
    setsReps: {
      strength: '3–5 sets × 3–6 reps (rest 2–3 min)',
      hypertrophy: '3–4 sets × 8–12 reps (rest 60–90 sec)',
      endurance: '2–4 sets × 12–20 reps (rest 30–60 sec)',
    },
    workoutRole: ['accessory'],
    pairingSuggestions: ['Pair with a core move (e.g., Crunch) or a lower-body move (e.g., Squat) to build a short routine.'],
  };
}

function estimateMinutesFromGoal(goal) {
  const g = String(goal || '').toLowerCase();
  if (g === 'strength') return 8;
  if (g === 'hypertrophy') return 6;
  if (g === 'endurance') return 5;
  return 5;
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

          const difficulty = mapDifficulty(it.level);
          const equipment = mapEquipment(it.equipment);
          const primary = Array.isArray(it.primaryMuscles) ? it.primaryMuscles.map(String) : [];
          const secondary = Array.isArray(it.secondaryMuscles) ? it.secondaryMuscles.map(String) : [];
          const goals = mapGoals(it.category);
          const category = pickCategoryFromGoals(goals);
          const programming = defaultProgramming();
          const mainGoal = category || 'strength';

          extras.push({
            id,
            name,
            description: `Imported exercise. Use the steps below as a starting point and adjust for your form.`,
            difficulty,
            muscleGroups: primary.length ? primary : secondary,
            primaryMuscles: primary,
            secondaryMuscles: secondary,
            category,
            goals,
            equipment,
            constraints: [],
            duration: estimateMinutesFromGoal(category),
            tips: Array.isArray(it.instructions) ? it.instructions.map(String) : [],
            commonMistakes: [],
            modifications: [
              'Reduce range of motion and slow the tempo.',
              'Use support (wall/counter/bench) if needed for balance.'
            ],
            amplifications: [
              'Add a pause at the hardest point (1–2 seconds).',
              'Increase reps slightly while keeping form clean.'
            ],
            whatYouShouldFeel: defaultWhatFeel(primary),
            breathingTips: defaultBreathing(it.mechanic),
            noEquipmentAlternatives: equipment.includes('none') ? [] : ['Choose a bodyweight variation that trains the same muscles.', 'Slow tempo reps for extra challenge without equipment.'],
            limitedMobilityAlternatives: ['Use a shorter range of motion.', 'Try a supported or seated variation if available.'],
            setsReps: programming.setsReps,
            workoutRole: programming.workoutRole,
            pairingSuggestions: programming.pairingSuggestions,
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

