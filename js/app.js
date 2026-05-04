// Moveo - Movement Made Simple
// Main application JavaScript

// Supabase – account auth (script loaded on account.html)
// Replace with your project URL and anon/publishable key from Supabase Dashboard > Project Settings > API
const SUPABASE_URL = 'https://lydlimchauawqmjxprip.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ZQkm5aQmwJdRkwseoJUvag_bKRNLVQG';

const STORAGE_BUCKET = 'exercise-videos';
// Bump this when the local exercise catalog changes (helps GitHub Pages caching).
const EXERCISE_CATALOG_VERSION = '2026-02-08-1';

let supabaseClient = null;
function getSupabase() {
  if (supabaseClient) return supabaseClient;
  let createClient = null;
  if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
    createClient = window.supabase.createClient;
  } else if (typeof window.createClient === 'function') {
    createClient = window.createClient;
  }
  if (!createClient) {
    console.warn('Moveo: Supabase JS not loaded. Add <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script> before app.js');
    return null;
  }
  try {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return supabaseClient;
  } catch (e) {
    console.error('Supabase init error:', e);
    return null;
  }
}

/**
 * Build a playable video URL from an exercises table row.
 * Handles: full https URLs, storage object paths, and common column names.
 */
function resolveExerciseVideoUrl(sb, row) {
  if (!row) return null;

  const candidates = [
    row.video_url,
    row.preview_video,
    row.previewVideo,
    row.media_url,
    row.videoUrl,
    row.url,
  ].filter(Boolean);

  for (const c of candidates) {
    const s = String(c).trim();
    if (!s) continue;
    if (/^https?:\/\//i.test(s)) return s;
    if (sb) {
      const path = s.replace(/^\/+/, '').replace(/^exercise-videos\/?/i, '');
      const { data } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      if (data?.publicUrl) return data.publicUrl;
    }
  }

  const pathOnly =
    row.storage_path ||
    row.video_path ||
    row.path ||
    row.file_path ||
    row.object_path;

  if (pathOnly && sb) {
    const path = String(pathOnly)
      .replace(/^\/+/, '')
      .replace(/^exercise-videos\/?/i, '');
    const { data } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data?.publicUrl || null;
  }

  return null;
}

/**
 * True when the exercise has a playable preview URL from JSON or Supabase merge.
 * Automatically reflects new uploads when the catalog is re-fetched or merged.
 */
function exerciseHasPlayableVideo(ex) {
  const v = ex?.previewVideo;
  return typeof v === 'string' && v.trim().length > 0;
}

/** Whether the list contains both moves with and without video (section UI only when mixed). */
function exercisesMixVideoAndPlain(fullList) {
  if (!Array.isArray(fullList) || fullList.length === 0) return false;
  let anyVideo = false;
  let anyPlain = false;
  for (const ex of fullList) {
    if (exerciseHasPlayableVideo(ex)) anyVideo = true;
    else anyPlain = true;
    if (anyVideo && anyPlain) return true;
  }
  return false;
}

/**
 * Builds gallery inner HTML: optional section headings + cards.
 * Layout: always "with video" block first (subgrid), then "without video" below (divider + subgrid).
 * When the filtered catalog has only one kind, section wrappers/headings are omitted (nothing to separate).
 */
function buildExerciseGridMarkup(view, fullFilteredList) {
  if (!Array.isArray(view) || view.length === 0) return '';
  if (!exercisesMixVideoAndPlain(fullFilteredList)) {
    return view.map((ex) => createExerciseCard(ex)).join('');
  }
  const withVideo = [];
  const withoutVideo = [];
  for (const ex of view) {
    if (exerciseHasPlayableVideo(ex)) withVideo.push(ex);
    else withoutVideo.push(ex);
  }
  const parts = [];
  if (withVideo.length) {
    parts.push('<div class="exercise-gallery-stack exercise-gallery-stack--video" role="region" aria-labelledby="exerciseGalleryVideoHeading">');
    parts.push('<h3 class="exercise-section-heading" id="exerciseGalleryVideoHeading">With demonstration video</h3>');
    parts.push(withVideo.map((ex) => createExerciseCard(ex)).join(''));
    parts.push('</div>');
  }
  if (withoutVideo.length) {
    parts.push('<div class="exercise-gallery-stack exercise-gallery-stack--plain" role="region" aria-labelledby="exerciseGalleryPlainHeading">');
    parts.push(
      '<h3 class="exercise-section-heading exercise-section-heading-muted" id="exerciseGalleryPlainHeading">Exercises without a demo video yet <span class="exercise-section-subdued">(shown below; they move up when a video is added)</span></h3>'
    );
    parts.push(withoutVideo.map((ex) => createExerciseCard(ex)).join(''));
    parts.push('</div>');
  } else if (withVideo.length > 0) {
    const plainTotal = fullFilteredList.filter((ex) => !exerciseHasPlayableVideo(ex)).length;
    // First slice is often all demos when many moves have videos; second section loads after Show more.
    if (plainTotal > 0) {
      parts.push(
        `<p class="exercise-gallery-plain-hint" role="status">` +
          `<strong>${plainTotal}</strong> more exercise${plainTotal === 1 ? '' : 's'} without a demo video yet load next — tap <strong>Show more</strong> (you’ll see the separate section below the video demos).` +
          `</p>`
      );
    }
  }
  return parts.join('');
}

/** Split filtered list into [with video…][without video…] (order preserved). */
function splitHomeListVideoPlain(list) {
  if (!Array.isArray(list)) return { withVideo: [], withoutVideo: [] };
  const i = list.findIndex((ex) => !exerciseHasPlayableVideo(ex));
  if (i === -1) return { withVideo: [...list], withoutVideo: [] };
  return { withVideo: list.slice(0, i), withoutVideo: list.slice(i) };
}

/** Home page: two sections always visible when catalog is mixed (each has its own Show more). */
function buildHomeDualSectionMarkup(viewWithVideo, viewPlain, fullList) {
  const { withVideo: allV, withoutVideo: allP } = splitHomeListVideoPlain(fullList);
  const parts = [];
  if (allV.length) {
    parts.push('<div class="exercise-gallery-stack exercise-gallery-stack--video" role="region" aria-labelledby="exerciseGalleryVideoHeading">');
    parts.push('<h3 class="exercise-section-heading" id="exerciseGalleryVideoHeading">With demonstration video</h3>');
    parts.push(viewWithVideo.map((ex) => createExerciseCard(ex)).join(''));
    parts.push('</div>');
  }
  if (allP.length) {
    parts.push('<div class="exercise-gallery-stack exercise-gallery-stack--plain" role="region" aria-labelledby="exerciseGalleryPlainHeading">');
    parts.push(
      '<h3 class="exercise-section-heading exercise-section-heading-muted" id="exerciseGalleryPlainHeading">Exercises without a demo video yet <span class="exercise-section-subdued">(shown here too; they move up when a video is added)</span></h3>'
    );
    parts.push(viewPlain.map((ex) => createExerciseCard(ex)).join(''));
    parts.push('</div>');
  }
  return parts.join('');
}

function logExerciseVideoMix() {
  if (!Array.isArray(exercises) || exercises.length === 0) return;
  const withV = exercises.filter(exerciseHasPlayableVideo).length;
  const without = exercises.length - withV;
  console.info(
    `Moveo: ${withV} exercise(s) have a preview video, ${without} do not. ` +
      (withV > 0 && without > 0
        ? 'You should see two sections on the Exercises page when mixed (each with its own Show more).'
        : 'Only one group — no split headings (all have video, or none yet).')
  );
}

function bindExerciseGridCardNav(container, orderedExercises, { setDataHref = false } = {}) {
  const cards = container.querySelectorAll('.exercise-card');
  cards.forEach((card, index) => {
    const exercise = orderedExercises[index];
    if (!exercise) return;
    const href = getBaseUrl() + 'exercise.html?id=' + encodeURIComponent(exercise.id);
    if (setDataHref) card.setAttribute('data-href', href);
    card.addEventListener('click', () => {
      window.location.href = href;
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        window.location.href = href;
      }
    });
  });
}

// State management
let exercises = [];
let bookmarkedExercises = [];
let currentExercise = null;
let animationSpeed = 1.0;
let isPlaying = false;
// Kept for backward compatibility with older cached HTML/JS; no UI uses this anymore.
let showMuscleHighlight = false;
let visibleHomeCount = 6;
/** Home gallery only: separate pagination when mixed video / no-video catalog. */
let visibleHomeVideoCount = 6;
let visibleHomePlainCount = 6;
let visibleExercisesCount = 12;
/** Exercises page: separate pagination when mixed video / no-video catalog. */
let visibleExercisesVideoCount = 6;
let visibleExercisesPlainCount = 6;
let visibleRoutinesCount = 6;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.page === 'exercise') {
    initExercisePage();
    return;
  }
  if (document.body.dataset.page === 'exercises') {
    initExercisesPage();
    return;
  }
  if (document.body.dataset.page === 'workouts') {
    initWorkoutsPage();
    return;
  }
  if (document.body.dataset.page === 'account') {
    initAccountPage();
    return;
  }
  initializeApp();
});

const WORKOUT_STORAGE_KEY = 'moveoWorkoutBuilder';
const WORKOUT_NOTES_KEY = 'moveoWorkoutNotes';
const LOAD_PROFILE_KEY = 'moveoExerciseLoadProfile';
const LOAD_PROFILE_VERSION = 1;

/** Short plain-text snippet safe for injecting into HTML (not for attributes). */
function escapeHtmlBody(s, maxLen) {
  let t = String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if (maxLen && t.length > maxLen) t = `${t.slice(0, maxLen)}…`;
  return t.replace(/\n/g, '<br>');
}

function loadWorkoutNotesText() {
  try {
    return localStorage.getItem(WORKOUT_NOTES_KEY) || '';
  } catch {
    return '';
  }
}

function saveWorkoutNotesText(text) {
  try {
    localStorage.setItem(WORKOUT_NOTES_KEY, text || '');
  } catch (_) {}
}

function loadLoadProfileDoc() {
  try {
    const raw = localStorage.getItem(LOAD_PROFILE_KEY);
    if (!raw)
      return { v: LOAD_PROFILE_VERSION, byExercise: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.byExercise) return { v: LOAD_PROFILE_VERSION, byExercise: {} };
    return parsed;
  } catch {
    return { v: LOAD_PROFILE_VERSION, byExercise: {} };
  }
}

function saveLoadProfileDoc(doc) {
  try {
    localStorage.setItem(LOAD_PROFILE_KEY, JSON.stringify(doc));
  } catch (_) {}
}

function medianInt(samples) {
  if (!samples.length) return 0;
  const s = [...samples].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/**
 * Infer rep delta from last reps-in-reserve readings (median of last up to 8).
 * Conservative: requires at least 2 logged sets before adapting.
 */
function computeRepDeltaFromSamples(samples) {
  if (!Array.isArray(samples) || samples.length < 2) return 0;
  const use = samples.slice(-8);
  const med = medianInt(use);
  if (med >= 5) return 2;
  if (med >= 3) return 1;
  if (med <= 0) return -1;
  return 0;
}

function recordRepsAfterSample(exerciseId, goal, repsAfter) {
  if (!exerciseId || !goal || repsAfter == null) return;
  const doc = loadLoadProfileDoc();
  if (!doc.byExercise[exerciseId]) doc.byExercise[exerciseId] = {};
  if (!doc.byExercise[exerciseId][goal]) doc.byExercise[exerciseId][goal] = { samples: [] };
  const arr = doc.byExercise[exerciseId][goal].samples;
  arr.push(Number(repsAfter));
  while (arr.length > 14) arr.shift();
  saveLoadProfileDoc(doc);
}

function getRepAdjustmentForExercise(exerciseId, goal, baseReps) {
  const br = Math.max(1, Math.round(Number(baseReps) || 1));
  const doc = loadLoadProfileDoc();
  const samples = doc.byExercise?.[exerciseId]?.[goal]?.samples || [];
  const delta = computeRepDeltaFromSamples(samples);
  let target = br + delta;
  target = Math.max(1, Math.min(target, Math.round(br * 1.35) + 2));
  let reason = '';
  if (samples.length >= 2) {
    if (target > br) reason = 'Recent sets felt lighter — bumped reps.';
    else if (target < br) reason = 'Recent sets felt heavy — eased reps.';
  }
  return { baseReps: br, targetReps: target, delta: target - br, samplesUsed: samples.length, reason };
}

function estimateExerciseSecondsForId(exerciseId, goal) {
  const presets = {
    strength: { sets: 4, reps: 5, rest: 150 },
    hypertrophy: { sets: 3, reps: 10, rest: 75 },
    endurance: { sets: 3, reps: 15, rest: 45 },
  };
  const p = presets[goal] || presets.strength;
  const adj = getRepAdjustmentForExercise(exerciseId, goal, p.reps);
  const repSeconds = 4;
  const setWork = p.sets * (adj.targetReps * repSeconds);
  const totalRest = (p.sets - 1) * p.rest;
  return setWork + totalRest + 30;
}

async function mergeLoadProfilesFromRemote(user) {
  const sb = getSupabase();
  if (!sb || !user?.id) return;
  try {
    const { data, error } = await sb
      .from('user_exercise_load_profiles')
      .select('*')
      .eq('user_id', user.id);
    if (error || !data?.length) return;
    const doc = loadLoadProfileDoc();
    data.forEach((row) => {
      const exId = row.exercise_id != null ? String(row.exercise_id) : '';
      const goal = row.goal != null ? String(row.goal).toLowerCase() : '';
      if (!exId || !goal) return;
      const remote = Array.isArray(row.reps_after_samples) ? row.reps_after_samples.map((n) => Number(n)).filter(Number.isFinite) : [];
      if (!doc.byExercise[exId]) doc.byExercise[exId] = {};
      if (!doc.byExercise[exId][goal]) doc.byExercise[exId][goal] = { samples: [] };
      const local = doc.byExercise[exId][goal].samples || [];
      const merged = [...local, ...remote].slice(-14);
      doc.byExercise[exId][goal].samples = merged;
    });
    saveLoadProfileDoc(doc);
  } catch (e) {
    console.warn('Moveo: could not merge load profiles (table may need migration — see docs/supabase-workout-adaptation.sql)', e);
  }
}

async function pushLoadProfilesToRemote(user) {
  const sb = getSupabase();
  if (!sb || !user?.id) return;
  const doc = loadLoadProfileDoc();
  const rows = [];
  Object.entries(doc.byExercise || {}).forEach(([exId, goalsObj]) => {
    Object.entries(goalsObj || {}).forEach(([goal, blob]) => {
      const samples = Array.isArray(blob?.samples)
        ? blob.samples.map((n) => Math.min(99, Math.max(0, Math.round(Number(n))))).filter((n) => Number.isFinite(n))
        : [];
      if (!samples.length) return;
      rows.push({
        user_id: user.id,
        exercise_id: exId,
        goal: goal.toLowerCase(),
        reps_after_samples: samples,
        updated_at: new Date().toISOString(),
      });
    });
  });
  if (!rows.length) return;
  try {
    const { error } = await sb.from('user_exercise_load_profiles').upsert(rows, {
      onConflict: 'user_id,exercise_id,goal',
    });
    if (error) console.warn('Moveo: load profile upsert — run docs/supabase-workout-adaptation.sql if missing table:', error.message);
  } catch (e) {
    console.warn('Moveo: load profile upsert exception', e);
  }
}

async function insertUserWorkoutSessionRow(user, summary) {
  const sb = getSupabase();
  if (!sb || !user?.id) return;

  const baseRow = {
    user_id: user.id,
    title: summary.title,
    goal: summary.goal,
    duration_seconds: summary.duration_seconds,
    ended_at: summary.ended_at,
    exercises: summary.exercises,
    session_notes: summary.notes || null,
    set_feedback: summary.feedback || [],
  };

  let { error } = await sb.from('user_workout_sessions').insert(baseRow);
  const msg = error?.message || '';
  // Missing optional columns — retry without extras (deploy docs/supabase-workout-adaptation.sql for full fidelity).
  if (
    error &&
    (msg.includes('session_notes') ||
      msg.includes('set_feedback') ||
      /Could not find the .* column/i.test(msg))
  ) {
    delete baseRow.session_notes;
    delete baseRow.set_feedback;
    const retry = await sb.from('user_workout_sessions').insert(baseRow);
    error = retry.error;
    console.warn(
      'Moveo: session saved without notes/feedback columns. Add docs/supabase-workout-adaptation.sql in Supabase for full persistence.'
    );
  }
  if (error) console.warn('Moveo: workout session log error:', error);
}

function setupWorkoutBuilderNotesUI() {
  const ta = document.getElementById('workoutBuilderNotes');
  if (!ta || ta.dataset.bound === 'true') return;
  ta.dataset.bound = 'true';
  ta.value = loadWorkoutNotesText();
  let t = null;
  ta.addEventListener('input', () => {
    saveWorkoutNotesText(ta.value);
    const el = document.getElementById('workoutNotesSaveHint');
    if (el) {
      window.clearTimeout(t);
      el.textContent = 'Saved locally (this browser). Signed-in sessions also attach notes.';
      t = window.setTimeout(() => {
        el.textContent = '';
      }, 4200);
    }
    try {
      const rt = document.getElementById('runnerSessionNotes');
      if (rt && !document.getElementById('workoutRunner')?.classList.contains('hidden')) rt.value = ta.value;
    } catch (_) {}
  });
}

/** Sync runner textarea with builder notes on first interaction with runner. */
function bindRunnerNotesFieldOnce() {
  const rt = document.getElementById('runnerSessionNotes');
  if (!rt || rt.dataset.bound === 'true') return;
  rt.dataset.bound = 'true';
  rt.addEventListener('input', () => {
    saveWorkoutNotesText(rt.value);
    const ta = document.getElementById('workoutBuilderNotes');
    if (ta) ta.value = rt.value;
  });
}

function updateWorkoutAdaptationHintForBuilder() {
  const el = document.getElementById('workoutAdaptHint');
  const idsEl = loadWorkoutBuilder();
  if (!el) return;
  if (!idsEl.length) {
    el.textContent = '';
    return;
  }
  const goal = getWorkoutGoal();
  const doc = loadLoadProfileDoc();
  let n = 0;
  idsEl.forEach((id) => {
    const s = doc.byExercise?.[id]?.[goal]?.samples?.length || 0;
    if (s >= 2) n += 1;
  });
  el.textContent =
    n > 0
      ? `Rep targets adapt for ${n} exercise(s) in this list based on recent “extra reps left” logs (${goal}). After tough sets, enter that number in the runner — works signed out; sign in to sync across devices.`
      : `After tough sets, log how many more good‑form reps you could still do (runner below). Moveo adjusts future targets on this device; sign in to sync notes, history, and adaptations across devices.`;
}

function loadWorkoutBuilder() {
  const raw = localStorage.getItem(WORKOUT_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveWorkoutBuilder(ids) {
  localStorage.setItem(WORKOUT_STORAGE_KEY, JSON.stringify(ids || []));
}

function addToWorkout(exerciseId) {
  const ids = loadWorkoutBuilder();
  ids.push(exerciseId);
  saveWorkoutBuilder(ids);
  showError('Added to workout');
}
window.addToWorkout = addToWorkout;

function removeFromWorkoutAt(index) {
  const ids = loadWorkoutBuilder();
  ids.splice(index, 1);
  saveWorkoutBuilder(ids);
}

function applyWorkoutsQueryParams() {
  const p = new URLSearchParams(window.location.search || '');
  const goal = normalizeFilterValue(p.get('goal'));
  const sel = document.getElementById('workoutGoal');
  if (sel && goal && ['strength', 'hypertrophy', 'endurance'].includes(goal)) {
    sel.value = goal;
  }
}

async function initWorkoutsPage() {
  await loadExercises();
  applyWorkoutsQueryParams();
  setupWorkoutBuilderNotesUI();
  bindRunnerNotesFieldOnce();
  renderWorkoutBuilderList();
  updateWorkoutAdaptationHintForBuilder();
  const u = await getCurrentUser();
  if (u) {
    await mergeLoadProfilesFromRemote(u);
    renderWorkoutBuilderList();
    updateWorkoutAdaptationHintForBuilder();
  }
  await loadRoutines();
  renderDailyWorkout();
  setupRoutineFilters();
  setupWorkoutGoalAndEstimate();
  setupSaveWorkoutToAccount();
  document.getElementById('clearWorkoutBtn')?.addEventListener('click', () => {
    saveWorkoutBuilder([]);
    renderWorkoutBuilderList();
  });

  document.getElementById('startWorkoutBtn')?.addEventListener('click', () => {
    startWorkoutSession();
  });

  // Deep link support: workouts.html?routine=<id>&start=1
  try {
    const params = new URLSearchParams(window.location.search || '');
    const routineId = params.get('routine');
    const shouldStart = params.get('start') === '1';
    if (routineId) {
      loadRoutineToWorkout(routineId);
      if (shouldStart) startWorkoutSession();
    }
  } catch {}

  if (window.location.hash === '#prebuilt-routines') {
    requestAnimationFrame(() => {
      document.getElementById('prebuilt-routines')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
}

function setWorkoutSaveMessage(msg, isError) {
  const el = document.getElementById('workoutSaveMsg');
  if (!el) return;
  el.textContent = msg || '';
  el.style.color = isError ? 'rgba(245, 101, 101, 0.95)' : 'rgba(255, 255, 255, 0.85)';
}

function setupSaveWorkoutToAccount() {
  const btn = document.getElementById('saveWorkoutToAccountBtn');
  if (!btn || btn.dataset.bound === 'true') return;
  btn.dataset.bound = 'true';
  btn.addEventListener('click', async () => {
    setWorkoutSaveMessage('');
    const user = await getCurrentUser();
    if (!user) {
      setWorkoutSaveMessage('Sign in to save workouts to your account.', true);
      return;
    }
    const sb = getSupabase();
    if (!sb) {
      setWorkoutSaveMessage('Supabase unavailable. Please refresh.', true);
      return;
    }
    const ids = loadWorkoutBuilder();
    if (!ids.length) {
      setWorkoutSaveMessage('Add at least one exercise first.', true);
      return;
    }
    const goal = getWorkoutGoal();
    const name = `Workout · ${goal}`;
    setWorkoutSaveMessage('Saving…');
    const payload = {
      user_id: user.id,
      name,
      goal,
      exercise_ids: ids,
    };
    const { error } = await sb.from('user_workouts').insert(payload);
    if (error) {
      console.warn('Moveo: save workout error:', error);
      setWorkoutSaveMessage('Could not save workout. Check Supabase table/policies for user_workouts.', true);
      return;
    }
    setWorkoutSaveMessage('Saved to your account.');
  });
}

function setupWorkoutGoalAndEstimate() {
  const sel = document.getElementById('workoutGoal');
  if (sel && sel.dataset.bound !== 'true') {
    sel.dataset.bound = 'true';
    sel.addEventListener('change', () => {
      updateWorkoutEstimate();
      updateWorkoutAdaptationHintForBuilder();
    });
  }
  updateWorkoutEstimate();
}

function getWorkoutGoal() {
  const v = document.getElementById('workoutGoal')?.value;
  return (v || 'strength').toLowerCase();
}

function formatMMSS(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

function estimateExerciseSeconds(ex, goal) {
  // Heuristic defaults (keeps it simple + beginner-friendly).
  const presets = {
    strength: { sets: 4, reps: 5, rest: 150 },
    hypertrophy: { sets: 3, reps: 10, rest: 75 },
    endurance: { sets: 3, reps: 15, rest: 45 },
  };
  const p = presets[goal] || presets.strength;
  const repSeconds = 4; // controlled tempo
  const setWork = p.reps * repSeconds;
  const totalWork = p.sets * setWork;
  const totalRest = (p.sets - 1) * p.rest;
  const transition = 30;
  return totalWork + totalRest + transition;
}

function updateWorkoutEstimate() {
  const el = document.getElementById('workoutEstimate');
  if (!el) return;
  const ids = loadWorkoutBuilder();
  if (!ids.length) {
    el.textContent = '—';
    return;
  }
  const goal = getWorkoutGoal();
  const seconds = ids.reduce((sum, id) => sum + estimateExerciseSecondsForId(id, goal), 0);
  el.textContent = `${Math.max(1, Math.round(seconds / 60))} min`;
}

let runnerState = null;

function startWorkoutSession() {
  const runner = document.getElementById('workoutRunner');
  const listEl = document.getElementById('runnerExerciseList');
  if (!runner || !listEl) return;
  const ids = loadWorkoutBuilder();
  if (!ids.length) {
    showError('Add exercises to your workout first.');
    return;
  }

  const goal = getWorkoutGoal();
  const presets = {
    strength: { sets: 4, reps: 5, rest: 150 },
    hypertrophy: { sets: 3, reps: 10, rest: 75 },
    endurance: { sets: 3, reps: 15, rest: 45 },
  };
  const p = presets[goal] || presets.strength;

  runnerState = {
    goal,
    startedAt: null,
    elapsedSeconds: 0,
    ticking: false,
    restRemaining: 0,
    restInterval: null,
    tickInterval: null,
    activeExerciseIndex: 0,
    setFeedback: [],
    exercises: ids.map((id) => {
      const ex = exercises.find((e) => e.id === id) || { id, name: id };
      const adj = getRepAdjustmentForExercise(id, goal, p.reps);
      return {
        id,
        name: ex.name || id,
        sets: p.sets,
        reps: adj.targetReps,
        baseReps: adj.baseReps,
        repDelta: adj.targetReps - adj.baseReps,
        adaptationHint: adj.reason || '',
        rest: p.rest,
        completedSets: 0,
      };
    }),
  };

  runner.classList.remove('hidden');

  try {
    const rt = document.getElementById('runnerSessionNotes');
    const bd = document.getElementById('workoutBuilderNotes');
    const notes = bd?.value ?? loadWorkoutNotesText();
    if (rt) rt.value = notes;
    const rin = document.getElementById('runnerRepsAfterSet');
    if (rin) rin.value = '';
  } catch (_) {}

  renderRunnerExercises();
  bindRunnerControls();
  updateRunnerUI();
  announceToScreenReader('Workout started');
}

function bindRunnerControls() {
  const btn = document.getElementById('runnerStartPauseBtn');
  const next = document.getElementById('runnerNextSetBtn');
  const end = document.getElementById('runnerEndBtn');
  if (btn && btn.dataset.bound !== 'true') {
    btn.dataset.bound = 'true';
    btn.addEventListener('click', () => toggleRunnerStartPause());
  }
  if (next && next.dataset.bound !== 'true') {
    next.dataset.bound = 'true';
    next.addEventListener('click', () => completeSetAndRest());
  }
  if (end && end.dataset.bound !== 'true') {
    end.dataset.bound = 'true';
    end.addEventListener('click', () => endRunnerSession());
  }
}

function toggleRunnerStartPause() {
  if (!runnerState) return;
  runnerState.ticking = !runnerState.ticking;
  const btn = document.getElementById('runnerStartPauseBtn');
  if (btn) btn.textContent = runnerState.ticking ? 'Pause' : 'Start';

  if (runnerState.ticking) {
    runnerState.tickInterval = runnerState.tickInterval || setInterval(() => {
      runnerState.elapsedSeconds += 1;
      if (runnerState.restRemaining > 0) {
        runnerState.restRemaining -= 1;
      }
      updateRunnerUI();
    }, 1000);
  } else {
    if (runnerState.tickInterval) {
      clearInterval(runnerState.tickInterval);
      runnerState.tickInterval = null;
    }
  }
  updateRunnerUI();
}

function completeSetAndRest() {
  if (!runnerState) return;
  const ex = runnerState.exercises[runnerState.activeExerciseIndex];
  if (!ex) return;

  try {
    const input = document.getElementById('runnerRepsAfterSet');
    if (input && String(input.value).trim() !== '') {
      const n = parseInt(input.value, 10);
      const nextSetNum = ex.completedSets + 1;
      if (Number.isFinite(n) && n >= 0 && n <= 99) {
        recordRepsAfterSample(ex.id, runnerState.goal, n);
        runnerState.setFeedback.push({
          exercise_id: ex.id,
          exercise_name: ex.name,
          set_number: nextSetNum,
          reps_after: n,
          at: new Date().toISOString(),
        });
      }
      input.value = '';
    }
  } catch (_) {}

  if (ex.completedSets < ex.sets) ex.completedSets += 1;
  runnerState.restRemaining = ex.completedSets >= ex.sets ? 0 : ex.rest;

  // If exercise finished, move to next exercise (after rest)
  if (ex.completedSets >= ex.sets) {
    runnerState.activeExerciseIndex = Math.min(runnerState.activeExerciseIndex + 1, runnerState.exercises.length - 1);
  }
  renderRunnerExercises();
  updateRunnerUI();
}

function endRunnerSession() {
  if (!runnerState) return;
  const notes =
    document.getElementById('runnerSessionNotes')?.value ??
    loadWorkoutNotesText() ??
    '';
  saveWorkoutNotesText(notes);

  const summary = {
    title: 'Workout session',
    goal: runnerState.goal,
    duration_seconds: runnerState.elapsedSeconds,
    ended_at: new Date().toISOString(),
    notes,
    feedback: [...(runnerState.setFeedback || [])],
    exercises: runnerState.exercises.map((e) => ({
      id: e.id,
      name: e.name,
      sets: e.sets,
      reps: e.reps,
      base_reps: e.baseReps != null ? e.baseReps : e.reps,
      completed_sets: e.completedSets,
    })),
  };

  // Always keep a local history for non-signed-in users.
  try {
    const key = 'moveoWorkoutHistory';
    const raw = localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    const next = Array.isArray(arr) ? arr : [];
    next.unshift(summary);
    localStorage.setItem(key, JSON.stringify(next.slice(0, 50)));
  } catch {}

  // Signed-in users: richer row + synced load profiles
  getCurrentUser().then(async (user) => {
    if (!user) return;
    await insertUserWorkoutSessionRow(user, summary);
    await pushLoadProfilesToRemote(user);
  });

  renderWorkoutBuilderList();
  updateWorkoutAdaptationHintForBuilder();

  if (runnerState.tickInterval) clearInterval(runnerState.tickInterval);
  runnerState = null;
  document.getElementById('workoutRunner')?.classList.add('hidden');
  document.getElementById('runnerElapsed').textContent = '00:00';
  document.getElementById('runnerRest').textContent = '—';
  announceToScreenReader('Workout ended');
}

function updateRunnerUI() {
  if (!runnerState) return;
  const elapsed = document.getElementById('runnerElapsed');
  const rest = document.getElementById('runnerRest');
  if (elapsed) elapsed.textContent = formatMMSS(runnerState.elapsedSeconds);
  if (rest) rest.textContent = runnerState.restRemaining > 0 ? formatMMSS(runnerState.restRemaining) : '—';
}

function renderRunnerExercises() {
  if (!runnerState) return;
  const listEl = document.getElementById('runnerExerciseList');
  if (!listEl) return;
  renderRunnerNowPlaying();
  listEl.innerHTML = runnerState.exercises.map((ex, idx) => {
    const pills = Array.from({ length: ex.sets }).map((_, i) => {
      const done = i < ex.completedSets;
      return `<span class="set-pill ${done ? 'done' : ''}">Set ${i + 1}</span>`;
    }).join('');
    const isActive = idx === runnerState.activeExerciseIndex;
    const active = isActive ? ' style="border-left: 4px solid var(--primary);"' : '';
    return `
      <div class="runner-ex" role="button" tabindex="0" data-runner-idx="${idx}" aria-label="Show video for ${ex.name}"${active}>
        <div class="runner-ex-top">
          <div class="runner-ex-name">${ex.name}</div>
          <div class="runner-ex-prescription">${ex.sets} × ${ex.reps}${ex.baseReps != null && ex.reps !== ex.baseReps ? ` <span class="runner-rep-base">(${ex.baseReps} base)</span>` : ''} · rest ${Math.round(ex.rest / 60)}m</div>
        </div>
        <div class="runner-ex-sets">${pills}</div>
      </div>
    `;
  }).join('');

  // Bind click/keyboard to swap current exercise preview without leaving the page
  listEl.querySelectorAll('[data-runner-idx]').forEach((el) => {
    if (el.dataset.bound === 'true') return;
    el.dataset.bound = 'true';
    const go = () => {
      const idx = Number(el.dataset.runnerIdx);
      if (!Number.isFinite(idx) || !runnerState) return;
      runnerState.activeExerciseIndex = Math.max(0, Math.min(idx, runnerState.exercises.length - 1));
      renderRunnerExercises();
      updateRunnerUI();
    };
    el.addEventListener('click', go);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        go();
      }
    });
  });
}

function renderRunnerNowPlaying() {
  if (!runnerState) return;
  const details = document.getElementById('runnerNowPlaying');
  const titleEl = document.getElementById('runnerNowTitle');
  const mediaEl = document.getElementById('runnerNowMedia');
  const metaEl = document.getElementById('runnerNowMeta');
  if (!details || !titleEl || !mediaEl || !metaEl) return;

  const ex = runnerState.exercises[runnerState.activeExerciseIndex];
  if (!ex) return;
  titleEl.textContent = ex.name || '—';

  const full = exercises.find((e) => e.id === ex.id);
  const videoUrl = full?.previewVideo || '';

  const prescrip =
    `${ex.sets} × ${ex.reps}` +
    (ex.baseReps != null && ex.reps !== ex.baseReps ? ` (${ex.baseReps} base)` : '') +
    ` · rest ${Math.round(ex.rest / 60)}m`;
  metaEl.innerHTML =
    `<span>${prescrip}</span>` +
    (ex.adaptationHint ? ` <span class="runner-meta-hint">${escapeHtmlBody(ex.adaptationHint, 160)}</span>` : '');

  if (videoUrl) {
    mediaEl.innerHTML = `
      <video
        src="${videoUrl}"
        controls
        playsinline
        preload="metadata"
        aria-label="Video demonstration of ${ex.name}">
      </video>
    `;
  } else {
    mediaEl.innerHTML = `
      <div class="runner-now-placeholder">
        Video not available for this exercise yet.
        <div style="margin-top: 0.5rem;">
          <a class="btn-secondary btn-link" href="exercise.html?id=${encodeURIComponent(ex.id)}">Open exercise page</a>
        </div>
      </div>
    `;
  }
}

async function loadRoutines() {
  const base = getBaseUrl();
  const url = base + 'data/routines.json?v=2026-04-24';
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed routines');
    const baseRoutines = await res.json();
    const autoRoutines = buildAutoRoutinesFromCatalog(exercises, baseRoutines);
    window.moveoRoutines = baseRoutines.concat(autoRoutines);
  } catch (e) {
    console.warn('Moveo: routines load error', e);
    window.moveoRoutines = [];
  }
  renderRoutineGrid();
}

function seededRandom(seedStr) {
  let h = 2166136261;
  const s = String(seedStr || '');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    // xorshift-ish
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickUnique(list, count, rand) {
  const pool = (Array.isArray(list) ? list : []).slice();
  // Fisher–Yates shuffle
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.max(0, count));
}

function isBodyweightOnly(ex) {
  const eq = (ex?.equipment || []).map(normalizeFilterValue);
  return !eq.length || eq.includes('none');
}

function listToHuman(items, max = 3) {
  const arr = (Array.isArray(items) ? items : []).map((x) => String(x || '').trim()).filter(Boolean);
  if (!arr.length) return '';
  const cut = arr.slice(0, max);
  return cut.join(', ') + (arr.length > max ? '…' : '');
}

function generateExerciseDescription(ex) {
  const name = String(ex?.name || 'This exercise');
  const category = normalizeFilterValue(ex?.category);
  const primary = Array.isArray(ex?.primaryMuscles) && ex.primaryMuscles.length ? ex.primaryMuscles : ex?.muscleGroups;
  const muscle = listToHuman(primary, 2);
  const equipment = listToHuman(ex?.equipment, 2) || 'minimal equipment';

  const base = muscle ? `${name} targets ${muscle}.` : `${name} is a simple movement you can repeat with good form.`;

  if (category === 'mobility') return `${base} Use it to open up range of motion and feel looser before or after training.`;
  if (category === 'rehab') return `${base} Keep reps controlled and pain-free—think stability, control, and joint-friendly range.`;
  if (category === 'endurance') return `${base} Keep breathing steady and aim for smooth reps to build stamina and conditioning.`;
  if (category === 'hypertrophy') return `${base} Slow the tempo and chase a solid pump—great for muscle-building sets.`;
  return `${base} A strong pick for building strength with ${equipment}.`;
}

function shouldRegenerateDescription(desc) {
  const d = String(desc || '').trim();
  if (!d) return true;
  // Catch the imported-library boilerplate style.
  if (/^a\s+(beginner|intermediate|advanced)-friendly\s+/i.test(d)) return true;
  if (/^a\s+\w+-friendly\s+(strength|mobility|endurance|rehab)\s+move/i.test(d)) return true;
  if (d.includes('This is a') && d.includes('that uses')) return true;
  return false;
}

function buildAutoRoutinesFromCatalog(allExercises, existingRoutines) {
  const existingIds = new Set((existingRoutines || []).map((r) => String(r?.id || '').toLowerCase()));
  const ex = Array.isArray(allExercises) ? allExercises : [];
  if (!ex.length) return [];

  const byCategory = (cat) => ex.filter((e) => normalizeFilterValue(e.category) === normalizeFilterValue(cat));
  const byNameIncludes = (re) => ex.filter((e) => re.test(String(e?.name || '').toLowerCase()));

  const strength = byCategory('strength');
  const hypertrophy = byCategory('hypertrophy').length ? byCategory('hypertrophy') : strength;
  const endurance = byCategory('endurance');
  const mobility = byCategory('mobility');
  const rehab = byCategory('rehab');

  const coreLike = ex.filter((e) => {
    const mg = (e.muscleGroups || []).map(normalizeFilterValue);
    return mg.includes('abdominals') || mg.includes('core');
  });

  const upperLike = ex.filter((e) => {
    const mg = (e.muscleGroups || []).map(normalizeFilterValue);
    return mg.includes('chest') || mg.includes('back') || mg.includes('shoulders') || mg.includes('arms');
  });

  const lowerLike = ex.filter((e) => {
    const mg = (e.muscleGroups || []).map(normalizeFilterValue);
    return mg.includes('quadriceps') || mg.includes('glutes') || mg.includes('hamstrings') || mg.includes('hips');
  });

  const yogaLike = byNameIncludes(/\byoga\b/).concat(byNameIncludes(/\bstretch\b/)).concat(mobility);
  const calisthenicsLike = ex.filter((e) => isBodyweightOnly(e) && ['strength', 'endurance', 'mobility'].includes(normalizeFilterValue(e.category)));

  const templates = [
    { id: 'auto-mobility-flow-20', name: 'Mobility Flow (20 min)', minutes: 20, goals: ['mobility', 'stretching'], pool: mobility.concat(rehab).concat(yogaLike), count: 7, description: 'A joint-friendly flow to loosen hips/hamstrings/shoulders and prep you for training (or unwind after).' },
    { id: 'auto-yoga-reset-30', name: 'Yoga Reset (30 min)', minutes: 30, goals: ['mobility', 'stretching'], pool: yogaLike, count: 10, description: 'A longer reset session: breathing, stretches, and gentle holds to downshift and recover.' },
    { id: 'auto-endurance-cardio-25', name: 'Cardio Endurance (25 min)', minutes: 25, goals: ['endurance', 'cardio'], pool: endurance.length ? endurance : ex, count: 8, description: 'Keep moving. This session favors steady pace, shorter rests, and repeatable reps to build stamina.' },
    { id: 'auto-strength-fullbody-30', name: 'Full Body Strength (30 min)', minutes: 30, goals: ['strength', 'full body'], pool: strength, count: 8, description: 'A balanced strength session covering legs, push, pull, and core with clean, controlled reps.' },
    { id: 'auto-hypertrophy-upper-35', name: 'Upper Body Hypertrophy (35 min)', minutes: 35, goals: ['hypertrophy', 'upper body'], pool: hypertrophy.filter((e) => upperLike.includes(e)), count: 8, description: 'Upper body volume work for chest/back/shoulders/arms. Slow reps, solid pump, repeatable sets.' },
    { id: 'auto-strength-lower-35', name: 'Lower Body Strength (35 min)', minutes: 35, goals: ['strength', 'lower body'], pool: strength.filter((e) => lowerLike.includes(e)), count: 8, description: 'Lower-body focused strength: squats/lunges/hinges and glute work with longer rests.' },
    { id: 'auto-core-builder-15', name: 'Core Builder (15 min)', minutes: 15, goals: ['strength', 'core'], pool: coreLike.length ? coreLike : strength, count: 6, description: 'Quick core session to build bracing and control. Great as a finisher or a stand-alone mini-workout.' },
    { id: 'auto-calisthenics-30', name: 'Calisthenics Circuit (30 min)', minutes: 30, goals: ['strength', 'endurance', 'calisthenics'], pool: calisthenicsLike, count: 9, description: 'Bodyweight circuit that blends strength + conditioning. Minimal equipment, easy to do anywhere.' },
  ];

  const out = [];
  templates.forEach((t) => {
    const id = String(t.id).toLowerCase();
    if (existingIds.has(id)) return;
    const rand = seededRandom(id);
    const items = pickUnique(t.pool, t.count, rand).map((e) => e.id);
    if (items.length < Math.min(4, t.count)) return;
    out.push({
      id,
      name: t.name,
      minutes: t.minutes,
      goals: t.goals,
      equipment: ['none'],
      constraints: ['apartment/no jumping'],
      description: t.description || 'Auto-generated from your current exercise library (updates as you add more exercises).',
      blocks: [{ title: 'Session', items }],
      auto: true,
    });
  });

  return out;
}

function getDailyRoutine(routines) {
  const list = Array.isArray(routines) ? routines : [];
  if (!list.length) return null;
  const d = new Date();
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const rand = seededRandom(`daily-routine:${key}`);
  const idx = Math.floor(rand() * list.length);
  return list[idx] || list[0];
}

function renderDailyWorkout() {
  const container = document.getElementById('dailyWorkoutContent');
  if (!container) return;
  const routines = Array.isArray(window.moveoRoutines) ? window.moveoRoutines : [];
  const r = getDailyRoutine(routines);
  if (!r) {
    container.innerHTML = `<h2>Workout of the Day</h2><p>No routines available yet.</p>`;
    return;
  }
  const goals = Array.isArray(r.goals) ? r.goals : [];
  const meta = `${r.minutes} min${goals.length ? ` · ${goals.join(' / ')}` : ''}`;
  const href = getBaseUrl() + `workouts.html?routine=${encodeURIComponent(r.id)}&start=1`;
  container.innerHTML = `
    <h2>${r.name}</h2>
    <p>${r.description || 'A daily session picked from your routine library.'}</p>
    <p class="routine-meta">${meta}</p>
    <div class="daily-actions">
      <a href="${href}" class="btn-primary btn-link">Start workout</a>
    </div>
  `;
}

function setupRoutineFilters() {
  const sel = document.getElementById('routineMinutes');
  if (!sel || sel.dataset.bound === 'true') return;
  sel.dataset.bound = 'true';
  sel.addEventListener('change', () => {
    visibleRoutinesCount = 6;
    renderRoutineGrid();
  });

  const btn = document.getElementById('showMoreRoutinesBtn');
  if (btn && btn.dataset.bound !== 'true') {
    btn.dataset.bound = 'true';
    btn.addEventListener('click', () => {
      visibleRoutinesCount += 6;
      renderRoutineGrid();
      btn.focus();
    });
  }
}

function renderRoutineGrid() {
  const grid = document.getElementById('routineGrid');
  if (!grid) return;
  const routines = Array.isArray(window.moveoRoutines) ? window.moveoRoutines : [];
  const minutes = document.getElementById('routineMinutes')?.value || '';
  const filtered = minutes ? routines.filter((r) => String(r.minutes) === String(minutes)) : routines;
  if (!filtered.length) {
    grid.innerHTML = '<p class="no-exercises" style="color: rgba(255,255,255,0.9);">No routines match yet.</p>';
    updateShowMoreRoutinesVisibility(0);
    return;
  }
  const view = filtered.slice(0, visibleRoutinesCount);
  updateShowMoreRoutinesVisibility(filtered.length);
  grid.innerHTML = view.map((r) => {
    const blocks = (r.blocks || []).map((b) => `${b.title}: ${(b.items || []).length} move(s)`).join(' · ');
    return `
      <article class="routine-card" role="listitem">
        <h3>${r.name}</h3>
        <p>${r.description || ''}</p>
        <p class="routine-meta">${r.minutes} min · ${(r.goals || []).join(' / ')}</p>
        <p class="routine-meta">${blocks}</p>
        <button type="button" class="btn-secondary btn-link routine-load" onclick="loadRoutineToWorkout('${r.id}')">Load into builder</button>
      </article>
    `;
  }).join('');
}

function loadRoutineToWorkout(routineId) {
  const routines = Array.isArray(window.moveoRoutines) ? window.moveoRoutines : [];
  const r = routines.find((x) => x.id === routineId);
  if (!r) return;
  const ids = [];
  (r.blocks || []).forEach((b) => (b.items || []).forEach((id) => ids.push(id)));
  saveWorkoutBuilder(ids);
  renderWorkoutBuilderList();
  setWorkoutSaveMessage('Loaded routine into builder.');
  announceToScreenReader('Routine loaded into workout builder');
}
window.loadRoutineToWorkout = loadRoutineToWorkout;

function renderWorkoutBuilderList() {
  const list = document.getElementById('workoutList');
  if (!list) return;
  const ids = loadWorkoutBuilder();
  if (!ids.length) {
    list.innerHTML = '<p class="loading-message">No exercises yet. Add from the Exercises tab.</p>';
    updateWorkoutEstimate();
    updateWorkoutAdaptationHintForBuilder();
    return;
  }
  list.innerHTML = ids.map((id, idx) => {
    const ex = exercises.find((e) => e.id === id);
    const name = ex?.name || id;
    const meta = ex ? `${ex.difficulty} · ${ex.category}` : '';
    return `
      <div class="workout-item" role="listitem" draggable="true" data-index="${idx}">
        <div class="workout-item-main">
          <div class="workout-item-name">${name}</div>
          <div class="workout-item-meta">${meta}</div>
        </div>
        <div class="workout-item-actions">
          <a class="btn-secondary btn-link" href="${getBaseUrl()}exercise.html?id=${encodeURIComponent(id)}">Open</a>
          <button type="button" class="btn-secondary btn-link" onclick="removeWorkoutIndex(${idx})">Remove</button>
        </div>
      </div>
    `;
  }).join('');

  setupWorkoutDragAndDrop(list);
  updateWorkoutEstimate();
  updateWorkoutAdaptationHintForBuilder();
}

function removeWorkoutIndex(idx) {
  removeFromWorkoutAt(idx);
  renderWorkoutBuilderList();
}
window.removeWorkoutIndex = removeWorkoutIndex;

function setupWorkoutDragAndDrop(container) {
  const items = container.querySelectorAll('.workout-item');
  items.forEach((el) => {
    el.addEventListener('dragstart', (e) => {
      e.dataTransfer?.setData('text/plain', String(el.dataset.index));
      el.classList.add('dragging');
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
    });
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      el.classList.add('dragover');
    });
    el.addEventListener('dragleave', () => el.classList.remove('dragover'));
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('dragover');
      const from = Number(e.dataTransfer?.getData('text/plain'));
      const to = Number(el.dataset.index);
      if (Number.isNaN(from) || Number.isNaN(to) || from === to) return;
      const ids = loadWorkoutBuilder();
      const [moved] = ids.splice(from, 1);
      ids.splice(to, 0, moved);
      saveWorkoutBuilder(ids);
      renderWorkoutBuilderList();
    });
  });
}

async function initExercisePage() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const container = document.getElementById('exercisePageContent');
  if (!container) return;
  if (!id) {
    container.innerHTML = '<p class="no-exercises">No exercise selected.</p><a href="index.html" class="btn-secondary">← Back to Gallery</a>';
    return;
  }
  await loadExercises();
  const exercise = exercises.find(ex => ex.id === id);
  if (!exercise) {
    container.innerHTML = '<p class="no-exercises">Exercise not found.</p><a href="index.html" class="btn-secondary">← Back to Gallery</a>';
    return;
  }
  loadBookmarks();
  renderExerciseDetail(exercise, { containerId: 'exercisePageContent', backHref: 'index.html', baseUrl: getBaseUrl() });
}

function applyExerciseCatalogQueryParams() {
  const p = new URLSearchParams(window.location.search || '');
  const setIf = (id, val) => {
    if (val == null || String(val).trim() === '') return;
    const el = document.getElementById(id);
    if (!el) return;
    const want = normalizeFilterValue(val);
    const opts = Array.from(el.options || []);
    const match = opts.find((o) => normalizeFilterValue(o.value) === want);
    if (match) el.value = match.value;
  };
  setIf('filterLevel', p.get('level'));
  setIf('filterCategory', p.get('category') || p.get('type'));
  setIf('filterEquipment', p.get('equipment'));
  setIf('filterMuscle', p.get('muscle'));
  const letter = (p.get('letter') || p.get('alpha') || '').trim().toUpperCase();
  if (letter && /^[A-Z]$/.test(letter)) {
    const el = document.getElementById('filterAlpha');
    if (el) {
      const hit = Array.from(el.options).find((o) => o.value === letter);
      if (hit) el.value = letter;
    }
  }
  const q = p.get('q') || p.get('search');
  if (q) {
    const input = document.getElementById('exerciseSearch');
    if (input) input.value = q;
  }
}

async function initExercisesPage() {
  await loadExercises();
  loadBookmarks();
  applyExerciseCatalogQueryParams();
  renderExercisesPageGrid();
  setupExerciseSearch();
  setupPaginationButtons();
}

async function initAccountPage() {
  loadBookmarks();
  const currentUser = await getCurrentUser();
  if (currentUser) {
    await loadExercises();
    await showAccountDashboard(currentUser);
    hideAuthForm();
  } else {
    showAuthForm();
    hideAccountDashboard();
  }
  setupAuthTabs();
  document.getElementById('signInForm')?.addEventListener('submit', handleSignIn);
  document.getElementById('signUpForm')?.addEventListener('submit', handleSignUp);
  document.getElementById('signOutBtn')?.addEventListener('click', handleSignOut);
}

// Account auth via Supabase
async function getCurrentUser() {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data: { session }, error } = await sb.auth.getSession();
    if (error || !session?.user) return null;
    const u = session.user;
    const name = u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0] || 'User';
    return { id: u.id, email: u.email, name };
  } catch (e) {
    console.error('getCurrentUser error:', e);
    return null;
  }
}

function showAuthForm() {
  document.getElementById('accountAuthSection')?.classList.remove('hidden');
}

function hideAuthForm() {
  document.getElementById('accountAuthSection')?.classList.add('hidden');
}

async function showAccountDashboard(user) {
  document.getElementById('accountDashboardSection')?.classList.remove('hidden');
  document.getElementById('accountUserName').textContent = user.name || user.email;
  renderSavedExercisesList();
  await mergeLoadProfilesFromRemote(user);
  await loadAccountWorkoutsAndHistory(user);
}

function hideAccountDashboard() {
  document.getElementById('accountDashboardSection')?.classList.add('hidden');
}

function setupAuthTabs() {
  const tabSignIn = document.getElementById('tabSignIn');
  const tabSignUp = document.getElementById('tabSignUp');
  const panelSignIn = document.getElementById('panelSignIn');
  const panelSignUp = document.getElementById('panelSignUp');
  if (!tabSignIn || !tabSignUp) return;
  tabSignIn.addEventListener('click', () => {
    tabSignIn.classList.add('active');
    tabSignUp.classList.remove('active');
    tabSignIn.setAttribute('aria-selected', 'true');
    tabSignUp.setAttribute('aria-selected', 'false');
    panelSignIn?.classList.remove('hidden');
    panelSignUp?.classList.add('hidden');
    panelSignIn?.removeAttribute('hidden');
    panelSignUp?.setAttribute('hidden', '');
  });
  tabSignUp.addEventListener('click', () => {
    tabSignUp.classList.add('active');
    tabSignIn.classList.remove('active');
    tabSignUp.setAttribute('aria-selected', 'true');
    tabSignIn.setAttribute('aria-selected', 'false');
    panelSignUp?.classList.remove('hidden');
    panelSignIn?.classList.add('hidden');
    panelSignUp?.removeAttribute('hidden');
    panelSignIn?.setAttribute('hidden', '');
  });
}

function setAuthMessage(msg, isError) {
  const el = document.getElementById('authMessage');
  if (!el) return;
  el.textContent = msg;
  el.className = 'auth-message' + (isError ? ' error' : ' success');
}

async function handleSignIn(e) {
  e.preventDefault();
  const email = document.getElementById('signInEmail')?.value?.trim();
  const password = document.getElementById('signInPassword')?.value;
  if (!email || !password) {
    setAuthMessage('Please enter email and password.', true);
    return;
  }
  const sb = getSupabase();
  if (!sb) {
    setAuthMessage('Sign-in is not available. Please refresh the page.', true);
    return;
  }
  setAuthMessage('Signing in...');
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    setAuthMessage(error.message || 'Invalid email or password.', true);
    return;
  }
  const user = data.user;
  const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User';
  setAuthMessage('');
  hideAuthForm();
  await loadExercises();
  await showAccountDashboard({ id: user.id, email: user.email, name });
}

async function handleSignUp(e) {
  e.preventDefault();
  const name = document.getElementById('signUpName')?.value?.trim();
  const email = document.getElementById('signUpEmail')?.value?.trim();
  const password = document.getElementById('signUpPassword')?.value;
  if (!name || !email || !password) {
    setAuthMessage('Please fill in all fields.', true);
    return;
  }
  if (password.length < 6) {
    setAuthMessage('Password must be at least 6 characters.', true);
    return;
  }
  const sb = getSupabase();
  if (!sb) {
    setAuthMessage('Sign-up is not available. Please refresh the page.', true);
    return;
  }
  setAuthMessage('Creating account...');
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } }
  });
  if (error) {
    setAuthMessage(error.message || 'Could not create account.', true);
    return;
  }
  const user = data.user;
  const displayName = user.user_metadata?.full_name || name;
  if (data.session) {
    setAuthMessage('');
    hideAuthForm();
    await loadExercises();
    await showAccountDashboard({ id: user.id, email: user.email, name: displayName });
  } else {
    setAuthMessage('Account created! Please check your email to confirm, then sign in.', false);
    document.getElementById('tabSignIn')?.click();
  }
}

async function handleSignOut() {
  const sb = getSupabase();
  if (sb) {
    try {
      await sb.auth.signOut();
    } catch (e) {
      console.error('Sign out error:', e);
    }
  }
  showAuthForm();
  hideAccountDashboard();
}

function renderSavedExercisesList() {
  const list = document.getElementById('savedExercisesList');
  const noSaved = document.getElementById('noSavedExercises');
  if (!list) return;
  if (bookmarkedExercises.length === 0) {
    list.innerHTML = '';
    if (noSaved) {
      noSaved.classList.remove('hidden');
    }
    return;
  }
  if (noSaved) noSaved.classList.add('hidden');
  if (exercises.length === 0) {
    list.innerHTML = '<p class="loading-message">Loading saved exercises...</p>';
    loadExercises().then(() => renderSavedExercisesList());
    return;
  }
  const base = getBaseUrl();
  list.innerHTML = bookmarkedExercises.map(id => {
    const ex = exercises.find(e => e.id === id);
    if (!ex) return '';
    return `
      <article class="saved-exercise-item" role="listitem">
        <a href="${base}exercise.html?id=${encodeURIComponent(ex.id)}" class="saved-exercise-link">
          <span class="saved-exercise-name">${ex.name}</span>
          <span class="saved-exercise-meta">${ex.difficulty} · ${ex.duration} min</span>
        </a>
        <button type="button" class="btn-remove-saved" aria-label="Remove ${ex.name} from saved" onclick="removeSavedOnAccountPage('${ex.id}')">Remove</button>
      </article>
    `;
  }).filter(Boolean).join('');
}

function removeSavedOnAccountPage(exerciseId) {
  const index = bookmarkedExercises.indexOf(exerciseId);
  if (index > -1) {
    bookmarkedExercises.splice(index, 1);
    saveBookmarks();
    renderSavedExercisesList();
  }
}
window.removeSavedOnAccountPage = removeSavedOnAccountPage;

async function loadAccountWorkoutsAndHistory(user) {
  await loadSavedWorkoutsList(user);
  await loadWorkoutHistory(user);
}

async function loadSavedWorkoutsList(user) {
  const list = document.getElementById('savedWorkoutsList');
  const empty = document.getElementById('noSavedWorkouts');
  if (!list) return;
  const sb = getSupabase();
  if (!sb) {
    list.innerHTML = '<p class="loading-message">Sign-in required to load saved workouts.</p>';
    return;
  }
  const { data, error } = await sb
    .from('user_workouts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) {
    list.innerHTML = '<p class="loading-message">Saved workouts unavailable. (Check Supabase table/policies for user_workouts.)</p>';
    console.warn('Moveo: user_workouts error:', error);
    return;
  }
  if (!data?.length) {
    list.innerHTML = '';
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');
  const base = getBaseUrl();
  list.innerHTML = data.map((w) => {
    const ids = w.exercise_ids || (w.workout?.exercise_ids) || [];
    const count = Array.isArray(ids) ? ids.length : 0;
    return `
      <article class="saved-exercise-item" role="listitem">
        <div>
          <div class="saved-exercise-name">${w.name || 'Workout'}</div>
          <div class="saved-exercise-meta">${count} exercise(s) · ${w.goal || 'mixed'}</div>
        </div>
        <div class="workout-item-actions">
          <a class="btn-secondary btn-link" href="${base}workouts.html">Open builder</a>
        </div>
      </article>
    `;
  }).join('');
}

async function loadWorkoutHistory(user) {
  const list = document.getElementById('workoutHistoryList');
  const empty = document.getElementById('noWorkoutHistory');
  if (!list) return;
  const sb = getSupabase();
  if (!sb) return;
  const { data, error } = await sb
    .from('user_workout_sessions')
    .select('*')
    .eq('user_id', user.id)
    .order('ended_at', { ascending: false })
    .limit(20);
  if (error) {
    list.innerHTML = '<p class="loading-message">Workout history unavailable. (Check Supabase table/policies for user_workout_sessions.)</p>';
    console.warn('Moveo: user_workout_sessions error:', error);
    return;
  }
  if (!data?.length) {
    list.innerHTML = '';
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');
  list.innerHTML = data.map((s) => {
    const mins = s.duration_seconds ? Math.round(s.duration_seconds / 60) : null;
    const when = s.ended_at ? new Date(s.ended_at).toLocaleDateString() : '';
    const fb = Array.isArray(s.set_feedback) ? s.set_feedback : [];
    const note = String(s.session_notes || '').trim();
    let noteHtml = '';
    if (note)
      noteHtml = `<div class="history-note-preview">${escapeHtmlBody(note, 180)}</div>`;
    const fbLine = fb.length ? ` · ${fb.length} set log(s)` : '';
    return `
      <article class="saved-exercise-item workout-history-item" role="listitem">
        <div>
          <div class="saved-exercise-name">${escapeHtmlBody(s.title || 'Workout session', 120)}</div>
          <div class="saved-exercise-meta">${when}${mins ? ` · ${mins} min` : ''} · ${escapeHtmlBody(String(s.goal || 'mixed'), 32)}${fbLine}</div>
          ${noteHtml}
        </div>
      </article>
    `;
  }).join('');
}

async function initializeApp() {
  // Load exercises data
  await loadExercises();
  
  // Load bookmarks from localStorage
  loadBookmarks();

  // Load routines and render workout of the day (uses the full catalog, including Supabase-added exercises)
  await loadRoutines();
  renderDailyWorkout();
  
  // Set up event listeners
  setupEventListeners();
  applyExerciseCatalogQueryParams();
  setupExerciseSearch();
  
  // Set daily exercise
  setDailyExercise();
  
  // Render exercise gallery
  renderExerciseGallery();
  setupPaginationButtons();
  
  // Announce page load to screen readers
  announceToScreenReader('Moveo loaded. Use navigation to explore exercises.');
}

function resetPagination() {
  const input = document.getElementById('exerciseSearch');
  const q = (input?.value || '').trim();
  const f = getActiveFilters();
  const anyFilters =
    !!q ||
    !!f.level ||
    !!f.category ||
    !!f.equipment ||
    !!f.muscle ||
    !!f.alpha ||
    (Array.isArray(f.constraints) && f.constraints.length > 0);

  // When filters are active, show more upfront so changes are obvious.
  visibleHomeCount = anyFilters ? 18 : 6;
  visibleHomeVideoCount = anyFilters ? 18 : 6;
  visibleHomePlainCount = 6;
  visibleExercisesCount = anyFilters ? 36 : 12;
  visibleExercisesVideoCount = anyFilters ? 24 : 6;
  visibleExercisesPlainCount = 6;
  updateShowMoreVisibility();
}

function updateShowMoreRoutinesVisibility(total) {
  const btn = document.getElementById('showMoreRoutinesBtn');
  if (!btn) return;
  const shouldShow = total > visibleRoutinesCount;
  btn.style.display = shouldShow ? 'inline-block' : 'none';
}

function updateResultsMeta({ total, shown }) {
  const input = document.getElementById('exerciseSearch');
  if (!input) return;
  const parent = input.closest('.search-container') || input.parentElement;
  if (!parent) return;

  let el = document.getElementById('exerciseResultsMeta');
  if (!el) {
    el = document.createElement('p');
    el.id = 'exerciseResultsMeta';
    el.className = 'workout-help';
    el.style.marginTop = '0.5rem';
    parent.appendChild(el);
  }

  const q = (input.value || '').trim();
  if (!q && total === exercises.length) {
    el.textContent = '';
    return;
  }

  el.textContent = `Showing ${shown} of ${total} match${total === 1 ? '' : 'es'}.`;
}

function setupPaginationButtons() {
  const homeBtn = document.getElementById('showMoreHomeBtn');
  if (homeBtn && homeBtn.dataset.bound !== 'true') {
    homeBtn.dataset.bound = 'true';
    homeBtn.addEventListener('click', () => {
      visibleHomeCount += 6;
      renderExerciseGallery();
      updateShowMoreVisibility();
      homeBtn.focus();
    });
  }

  const homeVideoBtn = document.getElementById('showMoreHomeVideoBtn');
  if (homeVideoBtn && homeVideoBtn.dataset.bound !== 'true') {
    homeVideoBtn.dataset.bound = 'true';
    homeVideoBtn.addEventListener('click', () => {
      visibleHomeVideoCount += 6;
      renderExerciseGallery();
      updateShowMoreVisibility();
      homeVideoBtn.focus();
    });
  }

  const homePlainBtn = document.getElementById('showMoreHomePlainBtn');
  if (homePlainBtn && homePlainBtn.dataset.bound !== 'true') {
    homePlainBtn.dataset.bound = 'true';
    homePlainBtn.addEventListener('click', () => {
      visibleHomePlainCount += 6;
      renderExerciseGallery();
      updateShowMoreVisibility();
      homePlainBtn.focus();
    });
  }

  const exVideoBtn = document.getElementById('showMoreExercisesVideoBtn');
  if (exVideoBtn && exVideoBtn.dataset.bound !== 'true') {
    exVideoBtn.dataset.bound = 'true';
    exVideoBtn.addEventListener('click', () => {
      visibleExercisesVideoCount += 6;
      renderExercisesPageGrid();
      updateShowMoreVisibility();
      exVideoBtn.focus();
    });
  }

  const exPlainBtn = document.getElementById('showMoreExercisesPlainBtn');
  if (exPlainBtn && exPlainBtn.dataset.bound !== 'true') {
    exPlainBtn.dataset.bound = 'true';
    exPlainBtn.addEventListener('click', () => {
      visibleExercisesPlainCount += 6;
      renderExercisesPageGrid();
      updateShowMoreVisibility();
      exPlainBtn.focus();
    });
  }

  const exBtn = document.getElementById('showMoreExercisesBtn');
  if (exBtn && exBtn.dataset.bound !== 'true') {
    exBtn.dataset.bound = 'true';
    exBtn.addEventListener('click', () => {
      visibleExercisesCount += 12;
      renderExercisesPageGrid();
      updateShowMoreVisibility();
      exBtn.focus();
    });
  }

  updateShowMoreVisibility();
}

function updateShowMoreVisibility() {
  const list = getFilteredExercises();
  const mix = exercisesMixVideoAndPlain(list);
  const { withVideo: allV, withoutVideo: allP } = mix ? splitHomeListVideoPlain(list) : { withVideo: [], withoutVideo: [] };

  const gallery = document.getElementById('exercisesGrid');
  const dualWrap = document.getElementById('paginationHomeDual');
  const singleWrap = document.getElementById('paginationHomeSingle');
  const homeBtn = document.getElementById('showMoreHomeBtn');
  const homeVideoBtn = document.getElementById('showMoreHomeVideoBtn');
  const homePlainBtn = document.getElementById('showMoreHomePlainBtn');

  if (gallery && dualWrap && singleWrap) {
    if (mix) {
      dualWrap.classList.remove('hidden');
      singleWrap.classList.add('hidden');
      if (homeBtn) homeBtn.style.display = 'none';
      if (homeVideoBtn) homeVideoBtn.style.display = allV.length > visibleHomeVideoCount ? 'inline-block' : 'none';
      if (homePlainBtn) homePlainBtn.style.display = allP.length > visibleHomePlainCount ? 'inline-block' : 'none';
    } else {
      dualWrap.classList.add('hidden');
      singleWrap.classList.remove('hidden');
      if (homeVideoBtn) homeVideoBtn.style.display = 'none';
      if (homePlainBtn) homePlainBtn.style.display = 'none';
      if (homeBtn) {
        homeBtn.style.display = gallery && list.length > visibleHomeCount ? 'inline-block' : 'none';
      }
    }
  }

  const exGrid = document.getElementById('exercisesPageGrid');
  const exDual = document.getElementById('paginationExercisesDual');
  const exSingle = document.getElementById('paginationExercisesSingle');
  const exBtn = document.getElementById('showMoreExercisesBtn');
  const exVideoBtn = document.getElementById('showMoreExercisesVideoBtn');
  const exPlainBtn = document.getElementById('showMoreExercisesPlainBtn');

  if (exGrid && exDual && exSingle) {
    if (mix) {
      exDual.classList.remove('hidden');
      exSingle.classList.add('hidden');
      if (exBtn) exBtn.style.display = 'none';
      if (exVideoBtn) exVideoBtn.style.display = allV.length > visibleExercisesVideoCount ? 'inline-block' : 'none';
      if (exPlainBtn) exPlainBtn.style.display = allP.length > visibleExercisesPlainCount ? 'inline-block' : 'none';
    } else {
      exDual.classList.add('hidden');
      exSingle.classList.remove('hidden');
      if (exVideoBtn) exVideoBtn.style.display = 'none';
      if (exPlainBtn) exPlainBtn.style.display = 'none';
      if (exBtn) {
        exBtn.style.display = list.length > visibleExercisesCount ? 'inline-block' : 'none';
      }
    }
  }
}

// Base URL for relative paths (works from file, local server, or subdirectory like GitHub Pages)
function getBaseUrl() {
  const href = window.location.href;
  const lastSlash = href.lastIndexOf('/');
  return lastSlash >= 0 ? href.slice(0, lastSlash + 1) : href + '/';
}

// Normalize a Supabase exercises row to app shape (used when Supabase-only list is needed)
function normalizeExerciseFromSupabase(row) {
  const id = row.id != null ? String(row.id) : '';
  const videoUrl = row.video_url || row.preview_video || row.previewVideo || null;
  const muscleGroups = row.muscle_groups || row.muscleGroups || [];
  const primaryMuscles = row.primary_muscles || row.primaryMuscles || muscleGroups || [];
  const secondaryMuscles = row.secondary_muscles || row.secondaryMuscles || [];
  return {
    id,
    name: row.name || 'Exercise',
    description: row.description || '',
    duration: row.duration != null ? Number(row.duration) : 5,
    difficulty: row.difficulty || 'beginner',
    category: (row.category || 'strength').toLowerCase(),
    previewVideo: videoUrl,
    muscleGroups: Array.isArray(muscleGroups) ? muscleGroups : [],
    primaryMuscles: Array.isArray(primaryMuscles) ? primaryMuscles : [],
    secondaryMuscles: Array.isArray(secondaryMuscles) ? secondaryMuscles : [],
    equipment: Array.isArray(row.equipment) ? row.equipment : [],
    constraints: Array.isArray(row.constraints) ? row.constraints : [],
    whatYouShouldFeel: Array.isArray(row.what_you_should_feel || row.whatYouShouldFeel) ? (row.what_you_should_feel || row.whatYouShouldFeel) : [],
    breathingTips: Array.isArray(row.breathing_tips || row.breathingTips) ? (row.breathing_tips || row.breathingTips) : [],
    setsReps: row.sets_reps || row.setsReps || null,
    workoutRole: Array.isArray(row.workout_role || row.workoutRole) ? (row.workout_role || row.workoutRole) : [],
    pairingSuggestions: Array.isArray(row.pairing_suggestions || row.pairingSuggestions) ? (row.pairing_suggestions || row.pairingSuggestions) : [],
    limitedMobilityAlternatives: Array.isArray(row.limited_mobility_alternatives || row.limitedMobilityAlternatives)
      ? (row.limited_mobility_alternatives || row.limitedMobilityAlternatives)
      : [],
    modifications: Array.isArray(row.modifications) ? row.modifications : [],
    amplifications: Array.isArray(row.amplifications) ? row.amplifications : [],
    tips: Array.isArray(row.tips) ? row.tips : [],
    commonMistakes: row.common_mistakes || row.commonMistakes || [],
    progression: row.progression || [],
    rhythm: row.rhythm || null,
  };
}

/** For matching "Push Up" / "Push-Up" to push-up */
function nameKeyForMatch(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * Overlay Supabase video URLs onto the local catalog so library exercises keep JSON ids (e.g. bodyweight-squat, push-up).
 * Matches Supabase rows by: slug, exercise_id, id (string), or normalized exercise name.
 */
function mergeSupabaseVideosIntoExercises(localList, supabaseRows, sb) {
  if (!supabaseRows?.length) return localList;

  const byId = new Map();
  const byName = new Map();
  const usedIds = new Set();
  (Array.isArray(localList) ? localList : []).forEach((ex, idx) => {
    const id = String(ex?.id || '').toLowerCase();
    if (id) {
      byId.set(id, idx);
      usedIds.add(id);
    }
    const nk = nameKeyForMatch(ex?.name);
    if (nk) byName.set(`name:${nk}`, idx);
  });

  const out = (Array.isArray(localList) ? localList : []).map((x) => ({ ...x }));

  supabaseRows.forEach((row) => {
    const url = resolveExerciseVideoUrl(sb, row);
    const matchKeys = [
      row.slug,
      row.exercise_id,
      row.exercise_key,
      row.key,
      row.id,
    ]
      .filter((k) => k != null && String(k).trim() !== '')
      .map((k) => String(k).toLowerCase());

    const nk = nameKeyForMatch(row.name);
    const nameKey = nk ? `name:${nk}` : null;

    let idx = null;
    for (const k of matchKeys) {
      if (byId.has(k)) {
        idx = byId.get(k);
        break;
      }
    }
    if (idx == null && nameKey && byName.has(nameKey)) {
      idx = byName.get(nameKey);
    }

    if (idx != null) {
      if (url) out[idx] = { ...out[idx], previewVideo: url };
      return;
    }

    // No match: create a new exercise entry so Supabase-only exercises appear in the library.
    const normalized = normalizeExerciseFromSupabase(row);
    const baseId =
      (row.slug && String(row.slug).trim()) ||
      (row.exercise_id && String(row.exercise_id).trim()) ||
      (row.id != null ? String(row.id).trim() : '') ||
      (nk ? `sb-${nk}` : '');

    let id = String(baseId || '').toLowerCase();
    if (!id) return;
    if (usedIds.has(id)) {
      // Extremely unlikely, but guarantee uniqueness.
      let n = 2;
      while (usedIds.has(`${id}-${n}`)) n += 1;
      id = `${id}-${n}`;
    }
    usedIds.add(id);

    const created = {
      ...normalized,
      id,
      // Prefer resolved Storage/public URL when available.
      previewVideo: url || normalized.previewVideo || null,
      // Keep the raw Supabase row id for troubleshooting/mapping.
      supabaseId: row.id != null ? String(row.id) : undefined,
      createdFromSupabase: true,
    };

    out.push(created);
    byId.set(id, out.length - 1);
    if (nameKey) byName.set(nameKey, out.length - 1);
  });

  return out;
}

// Load exercises: local JSON catalog + Supabase videos merged in (same ids/names as site exercises)
async function loadExercises() {
  const base = getBaseUrl();
  const jsonUrl = base + 'data/exercises.json?v=' + encodeURIComponent(EXERCISE_CATALOG_VERSION);
  const extraUrl = base + 'data/exercises_extra.json?v=' + encodeURIComponent(EXERCISE_CATALOG_VERSION);
  let localList = [];
  let extraList = [];

  try {
    const response = await fetch(jsonUrl);
    if (!response.ok) throw new Error('Failed to load exercises');
    localList = await response.json();
  } catch (error) {
    console.error('Error loading exercises:', error);
    showError('Failed to load exercises. Please refresh the page, or open the site from a local server (e.g. live server).');
    exercises = [];
    return;
  }

  // Optional: load extra exercise names dataset (placeholders until enriched)
  try {
    const res2 = await fetch(extraUrl);
    if (res2.ok) {
      extraList = await res2.json();
    }
  } catch (e) {
    console.warn('Moveo: extra exercises list not loaded:', e);
  }

  // Merge: curated list first, then extras that aren't duplicates
  const seen = new Set(localList.map((e) => String(e.id).toLowerCase()));
  const mergedLocal = localList.concat(
    (Array.isArray(extraList) ? extraList : []).filter((e) => {
      const id = String(e?.id || '').toLowerCase();
      if (!id) return false;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
  );

  const sb = getSupabase();
  if (sb) {
    try {
      const { data: rows, error } = await sb.from('exercises').select('*').order('created_at', { ascending: false });
      if (error) {
        console.warn('Moveo: Supabase exercises table error (check RLS allows SELECT for anon):', error.message, error);
      } else if (rows?.length) {
        exercises = mergeSupabaseVideosIntoExercises(mergedLocal, rows, sb).map((ex) => {
          const hasExplicit = Array.isArray(ex?.constraints) && ex.constraints.length > 0;
          return {
            ...ex,
            inferredConstraints: hasExplicit ? [] : inferConstraintsForExercise(ex),
            description: shouldRegenerateDescription(ex?.description) ? generateExerciseDescription(ex) : (ex?.description || ''),
          };
        });
        const withVideo = exercises.filter((e) => e.previewVideo && /^https?:\/\//i.test(e.previewVideo)).length;
        console.info('Moveo: merged', rows.length, 'Supabase exercise row(s);', withVideo, 'exercise(s) now have https video URLs.');
        logExerciseVideoMix();
        return;
      } else {
        console.warn('Moveo: Supabase exercises query returned 0 rows. Enable SELECT on public.exercises for the anon role, or add rows.');
      }
    } catch (e) {
      console.warn('Moveo: Supabase exercises error:', e);
    }
  } else {
    console.warn('Moveo: Supabase client not initialized — videos from Storage will not load. Ensure @supabase/supabase-js loads before app.js.');
  }

  exercises = mergedLocal.map((ex) => {
    const hasExplicit = Array.isArray(ex?.constraints) && ex.constraints.length > 0;
    return {
      ...ex,
      inferredConstraints: hasExplicit ? [] : inferConstraintsForExercise(ex),
      description: shouldRegenerateDescription(ex?.description) ? generateExerciseDescription(ex) : (ex?.description || ''),
    };
  });
  logExerciseVideoMix();
}

// Load bookmarks from localStorage
function loadBookmarks() {
  const stored = localStorage.getItem('moveoBookmarks');
  if (stored) {
    try {
      bookmarkedExercises = JSON.parse(stored);
    } catch (error) {
      console.error('Error parsing bookmarks:', error);
      bookmarkedExercises = [];
    }
  }
}

// Save bookmarks to localStorage
function saveBookmarks() {
  localStorage.setItem('moveoBookmarks', JSON.stringify(bookmarkedExercises));
}

// Setup event listeners
function setupEventListeners() {
  // Navigation
  const learnMoveBtn = document.getElementById('learnMoveBtn');

  if (learnMoveBtn) {
    learnMoveBtn.addEventListener('click', () => {
      window.location.href = getBaseUrl() + 'exercises.html';
      announceToScreenReader('Opening exercise library');
    });
  }

  // Keyboard navigation
  document.addEventListener('keydown', handleKeyboardNavigation);
}

let lastSearchNotFoundNotice = '';

/** Filter exercises by search box (name, description, category, difficulty, muscles) */
function getFilteredExercises() {
  const input = document.getElementById('exerciseSearch');
  const q = (input?.value || '').trim().toLowerCase();
  const filters = getActiveFilters();
  const words = q.split(/\s+/).filter(Boolean);
  const filtered = exercises.filter((ex) => {
    if (!matchesFilters(ex, filters)) return false;
    if (!words.length) return true;
    const muscle = [
      ...(ex.muscleGroups || []),
      ...(ex.primaryMuscles || []),
      ...(ex.secondaryMuscles || []),
    ].join(' ');
    const extra = [
      (ex.equipment || []).join(' '),
      (ex.constraints || []).join(' ')
    ].join(' ');
    const hay = [ex.name, ex.description, ex.category, ex.difficulty, muscle, extra]
      .join(' ')
      .toLowerCase();
    return words.every((w) => hay.includes(w));
  });

  const sortAlpha = (a, b) => {
    const an = String(a?.name || '').toLowerCase();
    const bn = String(b?.name || '').toLowerCase();
    const byName = an.localeCompare(bn);
    if (byName) return byName;
    return String(a?.id || '').localeCompare(String(b?.id || ''));
  };

  // When searching, show exact match(es) first, then close name matches.
  if (q) {
    const qNameKey = nameKeyForMatch(q);
    const qId = q.toLowerCase();
    const score = (ex) => {
      const id = String(ex?.id || '').toLowerCase();
      const name = String(ex?.name || '').toLowerCase();
      const nameKey = nameKeyForMatch(ex?.name || '');
      if (id && id === qId) return 0;
      if (qNameKey && nameKey && nameKey === qNameKey) return 0;
      if (name && name.startsWith(qId)) return 1;
      if (name && name.includes(qId)) return 2;
      return 3;
    };

    // Rank by text match first; then partition: all matches with video, then all without (below in UI).
    const sortBySearchRank = (a, b) => {
      const sa = score(a);
      const sb = score(b);
      if (sa !== sb) return sa - sb;
      return sortAlpha(a, b);
    };
    const withVideoSearch = filtered.filter(exerciseHasPlayableVideo).sort(sortBySearchRank);
    const withoutVideoSearch = filtered.filter((ex) => !exerciseHasPlayableVideo(ex)).sort(sortBySearchRank);
    return [...withVideoSearch, ...withoutVideoSearch];
  }

  // No search: videos first (A–Z), then exercises without video (A–Z). When all have video, order is just A–Z.
  const withVideo = [];
  const withoutVideo = [];
  for (const ex of filtered) {
    if (exerciseHasPlayableVideo(ex)) withVideo.push(ex);
    else withoutVideo.push(ex);
  }
  withVideo.sort(sortAlpha);
  withoutVideo.sort(sortAlpha);
  return [...withVideo, ...withoutVideo];
}

function normalizeFilterValue(v) {
  return String(v || '').trim().toLowerCase();
}

function getExerciseConstraintTags(ex) {
  const raw = Array.isArray(ex?.constraints) ? ex.constraints : [];
  const inferred = Array.isArray(ex?.inferredConstraints) ? ex.inferredConstraints : [];
  return [...raw, ...inferred].map(normalizeFilterValue).filter(Boolean);
}

function inferConstraintsForExercise(ex) {
  const name = String(ex?.name || '').toLowerCase();
  const desc = String(ex?.description || '').toLowerCase();
  const id = String(ex?.id || '').toLowerCase();
  const hay = `${name} ${desc} ${id}`;
  const equipment = (Array.isArray(ex?.equipment) ? ex.equipment : []).map(normalizeFilterValue);

  const tags = [];

  // Apartment / no jumping: allow unless explicitly plyometric/jumping.
  const isJumping =
    /\bjump(ing|s)?\b/.test(hay) ||
    /\bplyo(metric)?\b/.test(hay) ||
    /\bburpee(s)?\b/.test(hay) ||
    /\bbox jump(s)?\b/.test(hay) ||
    /\btuck jump(s)?\b/.test(hay) ||
    /\bjump squat(s)?\b/.test(hay);
  if (!isJumping) tags.push('apartment/no jumping');

  // Knee-friendly: exclude obvious knee-dominant patterns.
  const kneeHeavy =
    /\bsquat(s)?\b/.test(hay) ||
    /\blunge(s)?\b/.test(hay) ||
    /\bstep[- ]?up(s)?\b/.test(hay) ||
    /\bpistol\b/.test(hay) ||
    /\bsplit squat(s)?\b/.test(hay) ||
    /\bleg press\b/.test(hay) ||
    isJumping;
  if (!kneeHeavy) tags.push('knee-friendly');

  // Wrist-safe: exclude common wrist-loading floor/press patterns.
  const wristHeavy =
    /\bpush[- ]?up(s)?\b/.test(hay) ||
    /\bplank(s)?\b/.test(hay) ||
    /\bhandstand\b/.test(hay) ||
    /\bmountain climber(s)?\b/.test(hay) ||
    /\bdip(s)?\b/.test(hay) ||
    /\bpress\b/.test(hay) ||
    /\bbench press\b/.test(hay) ||
    /\bclean\b/.test(hay) ||
    /\bsnatch\b/.test(hay);
  if (!wristHeavy) tags.push('wrist-safe');

  // Low-back friendly: exclude obvious hinge/heavy spinal loading patterns.
  const lowBackHeavy =
    /\bdeadlift(s)?\b/.test(hay) ||
    /\bgood morning(s)?\b/.test(hay) ||
    /\bback extension(s)?\b/.test(hay) ||
    /\bhyperextension\b/.test(hay) ||
    /\bkettlebell swing(s)?\b/.test(hay) ||
    /\brow(s)?\b/.test(hay);
  if (!lowBackHeavy) tags.push('low-back friendly');

  // If this is clearly weighted, be a bit more conservative about "friendly" tags.
  const isWeighted = equipment.some((e) => ['barbell', 'dumbbell', 'kettlebell', 'machine', 'cable'].includes(e));
  if (isWeighted) {
    return tags.filter((t) => t !== 'knee-friendly' && t !== 'low-back friendly');
  }

  return tags;
}

function getActiveFilters() {
  const level = normalizeFilterValue(document.getElementById('filterLevel')?.value);
  const equipment = normalizeFilterValue(document.getElementById('filterEquipment')?.value);
  const muscle = normalizeFilterValue(document.getElementById('filterMuscle')?.value);
  const category = normalizeFilterValue(document.getElementById('filterCategory')?.value);
  const alpha = String(document.getElementById('filterAlpha')?.value || '').trim().toUpperCase();
  const constraints = Array.from(document.querySelectorAll('.filter-constraint:checked'))
    .map((el) => normalizeFilterValue(el.value));
  return { level, equipment, muscle, category, alpha, constraints };
}

function exerciseMuscleBuckets(ex) {
  const primary = (ex.primaryMuscles || []).map(normalizeFilterValue);
  const secondary = (ex.secondaryMuscles || []).map(normalizeFilterValue);
  const legacy = (ex.muscleGroups || []).map(normalizeFilterValue);
  return { primary, secondary, legacy };
}

function matchesFilters(ex, filters) {
  if (!filters) return true;

  if (filters.alpha) {
    const n = String(ex?.name || '').trim();
    const first = n ? n[0].toUpperCase() : '';
    if (first !== filters.alpha) return false;
  }

  if (filters.level && normalizeFilterValue(ex.difficulty) !== filters.level) return false;

  if (filters.equipment) {
    const eq = (ex.equipment || []).map(normalizeFilterValue);
    if (!eq.includes(filters.equipment)) return false;
  }

  if (filters.muscle) {
    const { primary, secondary, legacy } = exerciseMuscleBuckets(ex);
    const bucketHit = primary.includes(filters.muscle) || secondary.includes(filters.muscle) || legacy.includes(filters.muscle);
    if (!bucketHit) return false;
  }

  if (filters.category && normalizeFilterValue(ex.category) !== filters.category) return false;

  if (filters.constraints?.length) {
    const cs = getExerciseConstraintTags(ex);
    const ok = filters.constraints.every((c) => cs.includes(c));
    if (!ok) return false;
  }

  return true;
}

function setupExerciseSearch() {
  const input = document.getElementById('exerciseSearch');
  if (!input || input.dataset.bound === 'true') return;
  input.dataset.bound = 'true';
  const maybeShowNotFoundNotice = () => {
    const raw = (input.value || '').trim();
    const q = raw.toLowerCase();
    if (!q) return;
    const list = getFilteredExercises();
    const qKey = nameKeyForMatch(raw);
    const exact = list.some((ex) => {
      const id = String(ex?.id || '').toLowerCase();
      const nameKey = nameKeyForMatch(ex?.name || '');
      return (id && id === q) || (qKey && nameKey && nameKey === qKey);
    });
    if (exact) return;
    if (lastSearchNotFoundNotice === q) return;
    lastSearchNotFoundNotice = q;
    showError(`“${raw}” isn’t in the library yet — but it could be added soon.`);
  };
  const refresh = () => {
    resetPagination();
    if (document.getElementById('exercisesGrid')) renderExerciseGallery();
    if (document.getElementById('exercisesPageGrid')) renderExercisesPageGrid();
  };
  input.addEventListener('input', refresh);
  input.addEventListener('search', () => {
    refresh();
    maybeShowNotFoundNotice();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      // Let the browser fire 'search' if it will, but also show feedback immediately.
      setTimeout(() => maybeShowNotFoundNotice(), 0);
    }
  });
  bindFilterControls(refresh);
}

function bindFilterControls(onChange) {
  const ids = ['filterLevel', 'filterCategory', 'filterEquipment', 'filterMuscle', 'filterAlpha'];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el || el.dataset.bound === 'true') return;
    el.dataset.bound = 'true';
    el.addEventListener('change', onChange);
  });

  document.querySelectorAll('.filter-constraint').forEach((cb) => {
    if (cb.dataset.bound === 'true') return;
    cb.dataset.bound = 'true';
    cb.addEventListener('change', onChange);
  });

  const clear = document.getElementById('clearFiltersBtn');
  if (clear && clear.dataset.bound !== 'true') {
    clear.dataset.bound = 'true';
    clear.addEventListener('click', () => {
      ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      document.querySelectorAll('.filter-constraint:checked').forEach((cb) => { cb.checked = false; });
      onChange();
    });
  }
}

function renderExercisesPageGrid() {
  const grid = document.getElementById('exercisesPageGrid');
  if (!grid) return;
  const list = getFilteredExercises();
  if (exercises.length === 0) {
    grid.innerHTML = '<p class="no-exercises" style="color: rgba(255,255,255,0.9);">No exercises available.</p>';
    updateResultsMeta({ total: 0, shown: 0 });
    updateShowMoreVisibility();
    return;
  }
  if (list.length === 0) {
    grid.innerHTML = '<p class="no-exercises" style="color: rgba(255,255,255,0.9);">No exercises match your search. Try different words.</p>';
    updateResultsMeta({ total: 0, shown: 0 });
    updateShowMoreVisibility();
    return;
  }
  if (exercisesMixVideoAndPlain(list)) {
    const { withVideo: allV, withoutVideo: allP } = splitHomeListVideoPlain(list);
    const viewV = allV.slice(0, visibleExercisesVideoCount);
    const viewP = allP.slice(0, visibleExercisesPlainCount);
    const ordered = [...viewV, ...viewP];
    grid.innerHTML = buildHomeDualSectionMarkup(viewV, viewP, list);
    updateResultsMeta({ total: list.length, shown: ordered.length });
    bindExerciseGridCardNav(grid, ordered, { setDataHref: false });
  } else {
    const view = list.slice(0, visibleExercisesCount);
    grid.innerHTML = buildExerciseGridMarkup(view, list);
    updateResultsMeta({ total: list.length, shown: view.length });
    bindExerciseGridCardNav(grid, view, { setDataHref: false });
  }
  updateShowMoreVisibility();
}

// Handle keyboard navigation
function handleKeyboardNavigation(event) {
  // Escape key closes modals/overlays
  if (event.key === 'Escape') {
    const tipsOverlay = document.getElementById('tipsOverlay');
    if (tipsOverlay && tipsOverlay.classList.contains('active')) {
      toggleTipsOverlay();
    }
  }
  
  // Space bar toggles play/pause when focused on animation controls
  if (event.target.classList.contains('control-btn') && event.key === ' ') {
    event.preventDefault();
    if (event.target.id === 'playPauseBtn') {
      togglePlayPause();
    }
  }
}

// Render exercise gallery
function renderExerciseGallery() {
  const gallery = document.getElementById('exercisesGrid');
  if (!gallery) return;
  
  if (exercises.length === 0) {
    gallery.innerHTML = '<p class="no-exercises">No exercises available. Please check back soon!</p>';
    return;
  }

  const list = getFilteredExercises();
  if (list.length === 0) {
    gallery.innerHTML = '<p class="no-exercises">No exercises match your search. Try different words.</p>';
    updateResultsMeta({ total: 0, shown: 0 });
    return;
  }
  
  if (exercisesMixVideoAndPlain(list)) {
    const { withVideo: allV, withoutVideo: allP } = splitHomeListVideoPlain(list);
    const viewV = allV.slice(0, visibleHomeVideoCount);
    const viewP = allP.slice(0, visibleHomePlainCount);
    const ordered = [...viewV, ...viewP];
    gallery.innerHTML = buildHomeDualSectionMarkup(viewV, viewP, list);
    updateResultsMeta({ total: list.length, shown: ordered.length });
    bindExerciseGridCardNav(gallery, ordered, { setDataHref: true });
  } else {
    const view = list.slice(0, visibleHomeCount);
    gallery.innerHTML = buildExerciseGridMarkup(view, list);
    updateResultsMeta({ total: list.length, shown: view.length });
    bindExerciseGridCardNav(gallery, view, { setDataHref: true });
  }
  updateShowMoreVisibility();
}

// Create exercise card HTML
function createExerciseCard(exercise) {
  const isBookmarked = bookmarkedExercises.includes(exercise.id);
  const bookmarkIcon = isBookmarked ? 'bookmarked' : 'bookmark';
  
  return `
    <article class="exercise-card" tabindex="0" role="button" aria-label="View ${exercise.name} exercise">
      <div class="exercise-thumbnail">
        ${exercise.previewVideo ? 
          `<video src="${exercise.previewVideo}" muted loop playsinline aria-hidden="true"></video>` :
          `<div class="placeholder-icon" aria-hidden="true">${getCategoryIcon(exercise.category)}</div>`
        }
      </div>
      <div class="exercise-info">
        <h3>${exercise.name}</h3>
        <p>${(exercise.description || '').substring(0, 100)}${(exercise.description || '').length > 100 ? '...' : ''}</p>
        <div class="exercise-meta">
          <span>⏱️ ${exercise.duration} min</span>
          <span class="difficulty-badge ${exercise.difficulty}">${exercise.difficulty}</span>
          <span aria-label="Category">${getCategoryIcon(exercise.category)}</span>
        </div>
        <button
          class="btn-secondary btn-link"
          onclick="event.stopPropagation(); addToWorkout('${exercise.id}')"
          aria-label="Add ${exercise.name} to workout">
          Add to workout
        </button>
        <button 
          class="bookmark-btn ${isBookmarked ? 'bookmarked' : ''}" 
          onclick="event.stopPropagation(); toggleBookmark('${exercise.id}')"
          aria-label="${isBookmarked ? 'Remove' : 'Add'} ${exercise.name} to bookmarks"
          aria-pressed="${isBookmarked}">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
          </svg>
          ${isBookmarked ? 'Bookmarked' : 'Bookmark'}
        </button>
      </div>
    </article>
  `;
}

// View exercise detail page
function viewExercise(exerciseId) {
  const exercise = exercises.find(ex => ex.id === exerciseId);
  if (!exercise) {
    showError('Exercise not found');
    return;
  }
  
  currentExercise = exercise;
  
  const gallery = document.getElementById('gallery');
  const detail = document.getElementById('exerciseDetail');
  if (!gallery || !detail) {
    window.location.href = getBaseUrl() + 'exercise.html?id=' + encodeURIComponent(exerciseId);
    return;
  }

  // Update URL without page reload
  window.history.pushState({ exerciseId }, '', `?exercise=${exerciseId}`);

  gallery.classList.add('hidden');
  detail.classList.remove('hidden');

  renderExerciseDetail(exercise);
  
  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  announceToScreenReader(`Viewing ${exercise.name} exercise`);
}

// Render exercise detail
function renderExerciseDetail(exercise, options = {}) {
  const containerId =
    options.containerId ||
    (document.getElementById('exerciseDetailContent')
      ? 'exerciseDetailContent'
      : 'exercisePageContent');
  const detailContainer = document.getElementById(containerId);
  if (!detailContainer) return;

  const baseUrl = options.baseUrl || getBaseUrl();
  const backHref = options.backHref || 'index.html';
  const backUrl = /^https?:\/\//i.test(backHref) ? backHref : baseUrl + backHref;
  const backMarkup = `<a href="${backUrl}" class="btn-secondary btn-link">← Back to Gallery</a>`;
  
  const isBookmarked = bookmarkedExercises.includes(exercise.id);
  const showPlaceholders = !!exercise.createdFromSupabase;
  const placeholderLine = (msg) => `<p class="workout-help" style="margin-top: 0.25rem;">${msg}</p>`;
  const placeholderList = (msg) => `<ul class="cue-list"><li>${msg}</li></ul>`;
  
  detailContainer.innerHTML = `
    <div class="exercise-detail">
      <header>
        <h1>${exercise.name}</h1>
        <button 
          class="bookmark-btn ${isBookmarked ? 'bookmarked' : ''}" 
          onclick="toggleBookmark('${exercise.id}')"
          aria-label="${isBookmarked ? 'Remove' : 'Add'} ${exercise.name} to bookmarks"
          aria-pressed="${isBookmarked}">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
          </svg>
          ${isBookmarked ? 'Bookmarked' : 'Bookmark'}
        </button>
      </header>
      
      <div class="exercise-animation-container">
        <div class="animation-display" id="animationDisplay" role="img" aria-label="Animation of ${exercise.name} exercise">
          ${exercise.previewVideo ? 
            `<video id="exerciseVideo" src="${exercise.previewVideo}" muted loop playsinline aria-label="Video demonstration of ${exercise.name}"></video>` :
            `<div class="placeholder-animation" aria-hidden="true">${getCategoryIcon(exercise.category)}</div>`
          }
        </div>
        
        <div class="animation-controls" role="group" aria-label="Animation controls">
          <button 
            id="playPauseBtn" 
            class="control-btn ${isPlaying ? 'active' : ''}" 
            onclick="togglePlayPause()"
            aria-label="${isPlaying ? 'Pause' : 'Play'} animation">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              ${isPlaying ? 
                '<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>' :
                '<path d="M8 5v14l11-7z"/>'
              }
            </svg>
            ${isPlaying ? 'Pause' : 'Play'}
          </button>
          
          <button 
            id="slowMotionBtn" 
            class="control-btn ${animationSpeed === 0.5 ? 'active' : ''}" 
            onclick="toggleSlowMotion()"
            aria-label="Toggle slow motion">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M10 8v8l6-4-6-4zm11-5H3v18h18V3zm-2 16H5V5h14v14z"/>
            </svg>
            Slow Motion
          </button>
        </div>
      </div>
      
      <div class="exercise-info">
        <p>${exercise.description}</p>
        
        <div class="exercise-meta">
          <span>⏱️ Duration: ${exercise.duration} minutes</span>
          <span class="difficulty-badge ${exercise.difficulty}">${exercise.difficulty}</span>
          <span aria-label="Category">${getCategoryIcon(exercise.category)}</span>
        </div>

        <button
          class="btn-secondary btn-link"
          onclick="addToWorkout('${exercise.id}')"
          aria-label="Add ${exercise.name} to workout">
          Add to workout
        </button>
        
        ${Array.isArray(exercise.modifications) && exercise.modifications.length ? `
          <div class="mod-ampl-block">
            <h3>Modifications</h3>
            <ul class="mod-list">
              ${exercise.modifications.map(m => `<li>${m}</li>`).join('')}
            </ul>
          </div>` : ''}
        
        ${Array.isArray(exercise.amplifications) && exercise.amplifications.length ? `
          <div class="mod-ampl-block">
            <h3>Amplifications</h3>
            <ul class="mod-list">
              ${exercise.amplifications.map(a => `<li>${a}</li>`).join('')}
            </ul>
          </div>` : ''}
        
        <div class="muscle-groups">
          <h3>Target Muscles</h3>
          <div id="muscleTags">
            ${exercise.muscleGroups.map(muscle => 
              `<span class="muscle-highlight">${muscle}</span>`
            ).join('')}
          </div>
        </div>

        ${(Array.isArray(exercise.whatYouShouldFeel) && exercise.whatYouShouldFeel.length) || showPlaceholders ? `
          <div class="cue-block">
            <h3>What you should feel</h3>
            ${(Array.isArray(exercise.whatYouShouldFeel) && exercise.whatYouShouldFeel.length)
              ? `<ul class="cue-list">${exercise.whatYouShouldFeel.map((c) => `<li>${c}</li>`).join('')}</ul>`
              : placeholderList('Coming soon — add “what you should feel” to this Supabase exercise to show it here.')}
          </div>` : ''}

        ${(Array.isArray(exercise.breathingTips) && exercise.breathingTips.length) || showPlaceholders ? `
          <div class="cue-block">
            <h3>Breathing</h3>
            ${(Array.isArray(exercise.breathingTips) && exercise.breathingTips.length)
              ? `<ul class="cue-list">${exercise.breathingTips.map((c) => `<li>${c}</li>`).join('')}</ul>`
              : placeholderList('Coming soon — add breathing tips to this Supabase exercise to show them here.')}
          </div>` : ''}

        ${shouldShowNoEquipmentAlternatives(exercise) ? `
          <div class="cue-block">
            <h3>No equipment alternatives</h3>
            <ul class="cue-list">
              ${(exercise.noEquipmentAlternatives || []).map((c) => `<li>${c}</li>`).join('')}
            </ul>
          </div>` : ''}

        ${(Array.isArray(exercise.limitedMobilityAlternatives) && exercise.limitedMobilityAlternatives.length) || showPlaceholders ? `
          <div class="cue-block">
            <h3>Limited mobility alternatives</h3>
            ${(Array.isArray(exercise.limitedMobilityAlternatives) && exercise.limitedMobilityAlternatives.length)
              ? `<ul class="cue-list">${exercise.limitedMobilityAlternatives.map((c) => `<li>${c}</li>`).join('')}</ul>`
              : placeholderList('Coming soon — add limited mobility alternatives to this Supabase exercise to show them here.')}
          </div>` : ''}

        ${exercise.setsReps || showPlaceholders ? `
          <div class="cue-block">
            <h3>Suggested sets & reps</h3>
            ${exercise.setsReps ? `
              <ul class="cue-list">
                ${exercise.setsReps.strength ? `<li><strong>Strength:</strong> ${exercise.setsReps.strength}</li>` : ''}
                ${exercise.setsReps.hypertrophy ? `<li><strong>Hypertrophy:</strong> ${exercise.setsReps.hypertrophy}</li>` : ''}
                ${exercise.setsReps.endurance ? `<li><strong>Endurance:</strong> ${exercise.setsReps.endurance}</li>` : ''}
              </ul>
            ` : placeholderLine('Coming soon — add a sets/reps preset in Supabase (strength/hypertrophy/endurance) to show it here.')}
          </div>` : ''}

        ${Array.isArray(exercise.workoutRole) && exercise.workoutRole.length ? `
          <div class="cue-block">
            <h3>Where it fits in a workout</h3>
            <p class="cue-inline">${exercise.workoutRole.join(' · ')}</p>
          </div>` : ''}

        ${(Array.isArray(exercise.pairingSuggestions) && exercise.pairingSuggestions.length) || showPlaceholders ? `
          <div class="cue-block">
            <h3>Pairing ideas</h3>
            ${(Array.isArray(exercise.pairingSuggestions) && exercise.pairingSuggestions.length)
              ? `<ul class="cue-list">${exercise.pairingSuggestions.map((c) => `<li>${c}</li>`).join('')}</ul>`
              : placeholderList('Coming soon — add pairing suggestions to this Supabase exercise to show them here.')}
          </div>` : ''}
        
        <button 
          class="btn-primary" 
          onclick="toggleTipsOverlay()"
          aria-expanded="false"
          aria-controls="tipsOverlay">
          Show Form Tips
        </button>
      </div>

      <div id="tipsOverlay" class="tips-overlay hidden" role="region" aria-labelledby="tipsHeading">
        <h3 id="tipsHeading">Form Tips</h3>
        <ul class="tips-list">
          ${(Array.isArray(exercise.tips) && exercise.tips.length)
            ? exercise.tips.map(tip => `<li>${tip}</li>`).join('')
            : (showPlaceholders ? '<li>Add form tips in Supabase to show them here.</li>' : '')}
        </ul>
        
        ${exercise.commonMistakes ? `
          <h3 style="margin-top: 2rem;">Common Mistakes to Avoid</h3>
          <ul class="tips-list" style="list-style-type: disc;">
            ${exercise.commonMistakes.map(mistake => `<li style="color: var(--error);">${mistake}</li>`).join('')}
          </ul>
        ` : ''}
        
        ${exercise.progression ? `
          <h3 style="margin-top: 2rem;">Progression Tips</h3>
          <ul class="tips-list">
            ${exercise.progression.map(step => `<li>${step}</li>`).join('')}
          </ul>
        ` : ''}
        
        ${exercise.rhythm ? `
          <div style="margin-top: 2rem; padding: 1rem; background: var(--light); border-radius: 8px;">
            <strong>💡 Rhythm & Timing:</strong> ${exercise.rhythm}
          </div>
        ` : ''}
      </div>

      ${renderSmartSuggestions(exercise)}
    </div>
    
    ${backMarkup}
  `;
  
  // Setup video controls if video exists (preview paths relative to current page)
  const video = document.getElementById('exerciseVideo');
  if (video && exercise.previewVideo) {
    const isAbsolute = /^https?:\/\//i.test(exercise.previewVideo);
    video.src = isAbsolute ? exercise.previewVideo : baseUrl + exercise.previewVideo;
    video.playbackRate = animationSpeed;
    if (isPlaying) {
      video.play().catch(err => console.error('Video play error:', err));
    }
  }
}

function shouldShowNoEquipmentAlternatives(ex) {
  const eq = (ex?.equipment || []).map((x) => String(x).toLowerCase());
  const alreadyNoEquipment = eq.length === 1 && eq[0] === 'none';
  if (alreadyNoEquipment) return false;
  return Array.isArray(ex?.noEquipmentAlternatives) && ex.noEquipmentAlternatives.length > 0;
}

function difficultyRank(d) {
  const k = String(d || '').toLowerCase();
  if (k === 'beginner') return 1;
  if (k === 'intermediate') return 2;
  if (k === 'advanced') return 3;
  return 2;
}

function sharedCount(a, b) {
  const setB = new Set((b || []).map((x) => String(x).toLowerCase()));
  let n = 0;
  (a || []).forEach((x) => { if (setB.has(String(x).toLowerCase())) n += 1; });
  return n;
}

function exerciseSuggestScore(base, cand) {
  const primary = sharedCount(base.primaryMuscles || base.muscleGroups, cand.primaryMuscles || cand.muscleGroups);
  const secondary = sharedCount(base.secondaryMuscles || [], cand.secondaryMuscles || []);
  const goals = sharedCount(base.goals || [], cand.goals || []);
  return primary * 3 + secondary + goals * 2;
}

function renderSuggestionRow(title, list) {
  if (!list?.length) return '';
  const base = getBaseUrl();
  return `
    <div class="suggest-row">
      <h3>${title}</h3>
      <div class="suggest-grid" role="list">
        ${list.map((ex) => `
          <a class="suggest-card" role="listitem" href="${base}exercise.html?id=${encodeURIComponent(ex.id)}">
            <div class="suggest-name">${ex.name}</div>
            <div class="suggest-meta">
              <span class="difficulty-badge ${ex.difficulty}">${ex.difficulty}</span>
              <span class="suggest-small">${(ex.primaryMuscles || ex.muscleGroups || []).slice(0, 2).join(' · ')}</span>
            </div>
          </a>
        `).join('')}
      </div>
    </div>
  `;
}

function renderSmartSuggestions(exercise) {
  if (!Array.isArray(exercises) || exercises.length < 2) return '';
  const baseRank = difficultyRank(exercise.difficulty);
  const pool = exercises.filter((e) => e && e.id && e.id !== exercise.id);

  const scored = pool
    .map((cand) => ({ cand, score: exerciseSuggestScore(exercise, cand) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const similar = scored.slice(0, 3).map((x) => x.cand);

  const regressions = scored
    .filter((x) => difficultyRank(x.cand.difficulty) < baseRank)
    .slice(0, 3)
    .map((x) => x.cand);

  const progressions = scored
    .filter((x) => difficultyRank(x.cand.difficulty) > baseRank)
    .slice(0, 3)
    .map((x) => x.cand);

  if (!similar.length && !regressions.length && !progressions.length) return '';

  return `
    <section class="suggestions" aria-label="Suggested exercises">
      <h2 class="suggestions-heading">If you like this, try…</h2>
      ${renderSuggestionRow('Similar moves', similar)}
      ${renderSuggestionRow('Make it easier', regressions)}
      ${renderSuggestionRow('Level up', progressions)}
    </section>
  `;
}

// Toggle play/pause
function togglePlayPause() {
  isPlaying = !isPlaying;
  const video = document.getElementById('exerciseVideo');
  const btn = document.getElementById('playPauseBtn');
  
  if (video) {
    if (isPlaying) {
      video.play().catch(err => {
        console.error('Video play error:', err);
        isPlaying = false;
      });
    } else {
      video.pause();
    }
  }
  
  if (btn) {
    btn.classList.toggle('active', isPlaying);
    btn.innerHTML = `
      <svg aria-hidden="true" viewBox="0 0 24 24">
        ${isPlaying ? 
          '<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>' :
          '<path d="M8 5v14l11-7z"/>'
        }
      </svg>
      ${isPlaying ? 'Pause' : 'Play'}
    `;
    btn.setAttribute('aria-label', `${isPlaying ? 'Pause' : 'Play'} animation`);
  }
  
  announceToScreenReader(`Animation ${isPlaying ? 'playing' : 'paused'}`);
}

// Toggle slow motion
function toggleSlowMotion() {
  animationSpeed = animationSpeed === 1.0 ? 0.5 : 1.0;
  const video = document.getElementById('exerciseVideo');
  const btn = document.getElementById('slowMotionBtn');
  
  if (video) {
    video.playbackRate = animationSpeed;
  }
  
  if (btn) {
    btn.classList.toggle('active', animationSpeed === 0.5);
    btn.setAttribute('aria-label', `Slow motion ${animationSpeed === 0.5 ? 'on' : 'off'}`);
  }
  
  announceToScreenReader(`Slow motion ${animationSpeed === 0.5 ? 'enabled' : 'disabled'}`);
}

// (Removed) Muscle highlight toggle UI

// Toggle bookmark
function toggleBookmark(exerciseId) {
  const index = bookmarkedExercises.indexOf(exerciseId);
  
  if (index > -1) {
    bookmarkedExercises.splice(index, 1);
    announceToScreenReader('Exercise removed from bookmarks');
  } else {
    bookmarkedExercises.push(exerciseId);
    announceToScreenReader('Exercise added to bookmarks');
  }
  
  saveBookmarks();
  
  // Update UI
  const exercise = exercises.find(ex => ex.id === exerciseId);
  if (exercise) {
    if (currentExercise && currentExercise.id === exerciseId) {
      renderExerciseDetail(exercise);
    } else {
      renderExerciseGallery();
    }
  }
}

// Toggle tips overlay
function toggleTipsOverlay() {
  const overlay = document.getElementById('tipsOverlay');
  const btn = document.querySelector('[aria-controls="tipsOverlay"]');
  
  if (overlay) {
    overlay.classList.toggle('hidden');
    const isExpanded = !overlay.classList.contains('hidden');
    
    if (btn) {
      btn.setAttribute('aria-expanded', isExpanded);
      btn.textContent = isExpanded ? 'Hide Form Tips' : 'Show Form Tips';
    }
    
    announceToScreenReader(`Form tips ${isExpanded ? 'shown' : 'hidden'}`);
  }
}

// Back to gallery (legacy inline home view; no-op when gallery/detail are not on the page)
function backToGallery() {
  const gallery = document.getElementById('gallery');
  const detail = document.getElementById('exerciseDetail');
  if (!gallery || !detail) return;
  gallery.classList.remove('hidden');
  detail.classList.add('hidden');
  window.history.pushState({}, '', getBaseUrl());
  announceToScreenReader('Returned to exercise gallery');
}

// Get daily exercise
function getDailyExercise() {
  if (exercises.length === 0) return null;
  const dayIndex = new Date().getDate() % exercises.length;
  return exercises[dayIndex];
}

// Set daily exercise on homepage
function setDailyExercise() {
  const dailyExercise = getDailyExercise();
  const container = document.getElementById('dailyExerciseContent');
  
  if (!container || !dailyExercise) return;
  
  const exerciseUrl = getBaseUrl() + 'exercise.html?id=' + encodeURIComponent(dailyExercise.id);
  container.innerHTML = `
    <h2><a class="daily-exercise-link" href="${exerciseUrl}">${dailyExercise.name}</a></h2>
    <p>${dailyExercise.description}</p>
    <div class="exercise-meta">
      <span>⏱️ ${dailyExercise.duration} min</span>
      <span class="difficulty-badge ${dailyExercise.difficulty}">${dailyExercise.difficulty}</span>
      <span aria-label="Category">${getCategoryIcon(dailyExercise.category)}</span>
    </div>
    <div class="daily-actions">
      <a href="${exerciseUrl}" class="btn-primary btn-link">Open exercise page</a>
    </div>
  `;
}

// Get category icon
function getCategoryIcon(category) {
  const icons = {
    strength: '💪',
    hypertrophy: '🏋️',
    endurance: '❤️',
    mobility: '🧘',
    rehab: '🩹'
  };
  return icons[category] || '⭐';
}

// Announce to screen readers
function announceToScreenReader(message) {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

// Show error message
function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.setAttribute('role', 'alert');
  errorDiv.textContent = message;
  errorDiv.style.cssText = `
    position: fixed;
    top: 100px;
    right: 20px;
    background: var(--error);
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    box-shadow: var(--shadow-lg);
    z-index: 1000;
    animation: fadeInUp 0.3s ease-out;
  `;
  
  document.body.appendChild(errorDiv);
  
  setTimeout(() => {
    errorDiv.remove();
  }, 5000);
}

// Handle browser back/forward buttons
window.addEventListener('popstate', (event) => {
  if (event.state && event.state.exerciseId) {
    viewExercise(event.state.exerciseId);
  } else {
    backToGallery();
  }
});

// Make functions globally available
window.viewExercise = viewExercise;
window.toggleBookmark = toggleBookmark;
window.togglePlayPause = togglePlayPause;
window.toggleSlowMotion = toggleSlowMotion;
window.toggleTipsOverlay = toggleTipsOverlay;
window.backToGallery = backToGallery;
