import { useState } from 'react';

const BUCKET_NAME = 'exercise-videos';

/**
 * Uploads a video file to Supabase Storage bucket 'exercise-videos', then creates a row in
 * the 'exercises' table with the resulting public URL.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - Supabase client
 * @param {File} file - Video file to upload
 * @param {Object} exerciseData - Fields for the exercises table (e.g. name, description, difficulty, duration, category).
 *                               Will be merged with the generated video_url. Include any columns your table has.
 * @param {Object} options - { pathPrefix?: string, videoUrlColumn?: string, storagePathColumn?: string } pathPrefix for storage path; videoUrlColumn = exercises column for URL (default 'video_url'); storagePathColumn = optional column to store storage path
 * @returns {Promise<{ success: boolean, data?: { videoUrl: string, exerciseRow: object }, error?: Error }>}
 */
export async function uploadExerciseVideoAndCreateRow(supabase, file, exerciseData, options = {}) {
  if (!supabase || !file || !exerciseData?.name) {
    const err = new Error('supabase, file, and exerciseData.name are required');
    return { success: false, error: err };
  }

  const pathPrefix = options.pathPrefix || 'uploads';
  const slug = exerciseData.name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  const timestamp = Date.now();
  const ext = file.name.split('.').pop() || 'mp4';
  const storagePath = `${pathPrefix}/${slug}-${timestamp}.${ext}`;

  // 1. Upload to Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    return { success: false, error: uploadError };
  }

  // 2. Get public URL for the uploaded file
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(uploadData.path);

  const videoUrl = urlData?.publicUrl ?? null;
  if (!videoUrl) {
    return {
      success: false,
      error: new Error('Could not get public URL for uploaded file'),
    };
  }

  // 3. Insert row in exercises table (merge exerciseData + video URL column)
  const videoUrlColumn = options.videoUrlColumn ?? 'video_url';
  const row = {
    ...exerciseData,
    [videoUrlColumn]: videoUrl,
    ...(options.storagePathColumn && { [options.storagePathColumn]: uploadData.path }),
  };

  const { data: insertData, error: insertError } = await supabase
    .from('exercises')
    .insert(row)
    .select()
    .single();

  if (insertError) {
    return { success: false, error: insertError };
  }

  return {
    success: true,
    data: {
      videoUrl,
      storagePath: uploadData.path,
      exerciseRow: insertData,
    },
  };
}

/**
 * React hook: upload a video to 'exercise-videos' and create an exercises row with the URL.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - Supabase client
 * @returns {{
 *   uploadAndCreate: (file: File, exerciseData: Object, options?: Object) => Promise<{ success: boolean, data?: Object, error?: Error }>,
 *   isLoading: boolean,
 *   error: Error | null,
 *   progress: number | null
 * }}
 */
export function useUploadExerciseVideo(supabase) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null);

  const uploadAndCreate = async (file, exerciseData, options = {}) => {
    if (!supabase) {
      const err = new Error('Supabase client is required');
      setError(err);
      return { success: false, error: err };
    }

    setIsLoading(true);
    setError(null);
    setProgress(0);

    try {
      const result = await uploadExerciseVideoAndCreateRow(supabase, file, exerciseData, options);
      setProgress(100);
      if (result.error) setError(result.error);
      return result;
    } catch (err) {
      setError(err);
      return { success: false, error: err };
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  };

  return { uploadAndCreate, isLoading, error, progress };
}

/*
  Usage:

  // In a form component
  import { useUploadExerciseVideo } from './hooks/useUploadExerciseVideo';
  import { useSupabaseClient } from '@supabase/auth-helpers-react';

  function AddExerciseForm() {
    const supabase = useSupabaseClient();
    const { uploadAndCreate, isLoading, error } = useUploadExerciseVideo(supabase);
    const [file, setFile] = useState(null);

    const handleSubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const exerciseData = {
        name: formData.get('name'),
        description: formData.get('description'),
        difficulty: formData.get('difficulty') || 'beginner',
        duration: parseInt(formData.get('duration'), 10) || 5,
        category: formData.get('category') || 'strength',
      };
      const { success, data, error: err } = await uploadAndCreate(file, exerciseData);
      if (success) {
        console.log('Exercise created:', data.exerciseRow);
      } else {
        console.error(err);
      }
    };

    return (
      <form onSubmit={handleSubmit}>
        <input name="name" required />
        <input name="description" />
        <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0])} required />
        <button type="submit" disabled={isLoading}>{isLoading ? 'Uploading...' : 'Upload & Create'}</button>
        {error && <p>{error.message}</p>}
      </form>
    );
  }

  // Or use the standalone function (e.g. with userId as path prefix):
  import { uploadExerciseVideoAndCreateRow } from './hooks/useUploadExerciseVideo';
  const result = await uploadExerciseVideoAndCreateRow(supabase, file, { name, description, difficulty, duration }, { pathPrefix: user.id });
*/
