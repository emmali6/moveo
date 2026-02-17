/**
 * React: save an exercise to Supabase user_saved_exercises (logged-in user).
 *
 * Usage (hook):
 *   const { saveExercise, isLoading, error } = useSaveExercise(supabase);
 *   <button onClick={() => saveExercise('bodyweight-squat')} disabled={isLoading}>Save</button>
 *
 * Usage (plain function):
 *   const { data, error } = await saveExercise(supabase, 'bodyweight-squat');
 */
import { useState, useCallback } from 'react';

/**
 * Inserts a row into Supabase `user_saved_exercises` for the logged-in user.
 * Assumes table columns: user_id (uuid), exercise_id (text or uuid).
 * Adjust the insert payload if your schema differs (e.g. different column names).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - Supabase client
 * @param {string} exerciseId - Exercise id (matches your exercises table or app ids)
 * @returns {Promise<{ data: object | null, error: Error | null }>}
 */
export async function saveExercise(supabase, exerciseId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client is required') };
  }
  if (!exerciseId) {
    return { data: null, error: new Error('Exercise id is required') };
  }

  const {
    data: { user },
    error: sessionError,
  } = await supabase.auth.getUser();

  if (sessionError || !user) {
    return {
      data: null,
      error: sessionError || new Error('You must be logged in to save an exercise'),
    };
  }

  const row = {
    user_id: user.id,
    exercise_id: exerciseId,
  };

  // Use .insert() – if your table has a UNIQUE(user_id, exercise_id), duplicate
  // inserts will fail; catch and treat as "already saved" or use upsert instead:
  //
  // const { data, error } = await supabase
  //   .from('user_saved_exercises')
  //   .upsert(row, { onConflict: 'user_id,exercise_id' })
  //   .select()
  //   .single();

  const { data, error } = await supabase
    .from('user_saved_exercises')
    .insert(row)
    .select()
    .single();

  if (error) return { data: null, error };
  return { data, error: null };
}

/**
 * React hook: lets a logged-in user save an exercise (insert into user_saved_exercises).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - Supabase client (e.g. from context)
 * @returns {{ saveExercise: (exerciseId: string) => Promise<boolean>, isLoading: boolean, error: Error | null }}
 */
export function useSaveExercise(supabase) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const saveExerciseForUser = useCallback(
    async (exerciseId) => {
      if (!supabase || !exerciseId) return false;
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: err } = await saveExercise(supabase, exerciseId);
        if (err) {
          setError(err);
          return false;
        }
        return !!data;
      } finally {
        setIsLoading(false);
      }
    },
    [supabase]
  );

  return {
    saveExercise: saveExerciseForUser,
    isLoading,
    error,
  };
}
