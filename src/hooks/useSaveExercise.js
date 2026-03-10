import { useState } from 'react';

/**
 * Inserts a row into user_saved_exercises. Use this when you already have the user id (e.g. from auth context).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - Supabase client
 * @param {string} userId - Auth user id (uuid)
 * @param {string} exerciseId - Exercise id (e.g. "bodyweight-squat" or exercises.id)
 * @returns {Promise<{ success: boolean, error?: import('@supabase/supabase-js').PostgrestError | Error }>}
 */
export async function saveExerciseForUser(supabase, userId, exerciseId) {
  if (!supabase || !userId || !exerciseId) {
    const err = new Error('supabase, userId, and exerciseId are required');
    return { success: false, error: err };
  }

  const { error } = await supabase
    .from('user_saved_exercises')
    .insert({
      user_id: userId,
      exercise_id: exerciseId,
    });

  if (error) return { success: false, error };
  return { success: true };
}

/**
 * React hook: inserts a row into user_saved_exercises for the current logged-in user.
 * Assumes table: user_saved_exercises (user_id uuid, exercise_id text/uuid, created_at timestamptz).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - Supabase client
 * @returns {{ saveExercise: (exerciseId: string) => Promise<{ success: boolean, error?: Error }>, isLoading: boolean, error: Error | null }}
 */
export function useSaveExercise(supabase) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const saveExercise = async (exerciseId) => {
    if (!supabase) {
      setError(new Error('Supabase client is required'));
      return { success: false, error: new Error('Supabase client is required') };
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const err = new Error('User must be logged in to save exercises');
      setError(err);
      return { success: false, error: err };
    }

    setIsLoading(true);
    setError(null);

    try {
      const { error: insertError } = await supabase
        .from('user_saved_exercises')
        .insert({
          user_id: user.id,
          exercise_id: exerciseId,
        });

      if (insertError) {
        setError(insertError);
        return { success: false, error: insertError };
      }

      return { success: true };
    } catch (err) {
      setError(err);
      return { success: false, error: err };
    } finally {
      setIsLoading(false);
    }
  };

  return { saveExercise, isLoading, error };
}

/*
  Usage in a React component:

  // Option 1: useSaveExercise hook (gets current user from Supabase auth)
  import { useSaveExercise } from './hooks/useSaveExercise';
  import { useSupabaseClient } from '@supabase/auth-helpers-react'; // or your Supabase context

  function ExerciseCard({ exercise }) {
    const supabase = useSupabaseClient();
    const { saveExercise, isLoading, error } = useSaveExercise(supabase);

    const handleSave = async () => {
      const { success, error: err } = await saveExercise(exercise.id);
      if (success) {
        // e.g. toast or set local state
      } else {
        console.error(err);
      }
    };

    return (
      <div>
        <span>{exercise.name}</span>
        <button onClick={handleSave} disabled={isLoading}>Save</button>
        {error && <p>{error.message}</p>}
      </div>
    );
  }

  // Option 2: saveExerciseForUser when you already have userId (e.g. from auth context)
  import { saveExerciseForUser } from './hooks/useSaveExercise';

  const handleSave = async () => {
    const { success, error } = await saveExerciseForUser(supabase, user.id, exercise.id);
    if (success) { /* ... */ } else { /* show error */ }
  };
*/
