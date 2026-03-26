# Supabase videos on the Moveo site

If videos from Storage do not appear in the exercise library, check the following.

## 1. Row Level Security (RLS) on `exercises`

The browser loads exercises with your **anon / publishable** key. The `exercises` table must allow **anonymous SELECT**.

In Supabase: **Table Editor → exercises → RLS**  
Add a policy such as:

- **Policy name:** `Allow public read exercises`
- **Command:** `SELECT`
- **Using expression:** `true`  
  (or `auth.role() = 'anon'` depending on your setup)

If this policy is missing, the query returns **0 rows** and no videos are merged (check the browser **Console** for a warning).

## 2. Storage bucket `exercise-videos`

Videos must be playable in the browser:

- **Public bucket:** In **Storage → exercise-videos →** set the bucket to **Public**, **or**
- Add a **Storage policy** that allows `SELECT` (read) for `anon` on objects in that bucket.

If the bucket is private, `getPublicUrl` URLs will **403** and the video may spin forever.

## 3. How URLs are resolved in the app

The app reads each row from `exercises` and builds a URL in this order:

1. **Full URL** — if `video_url`, `preview_video`, `media_url`, etc. starts with `http://` or `https://`, it is used as-is.
2. **Storage path** — if the value looks like a path (no `http`), or you use columns such as `storage_path`, `video_path`, `path`, `file_path`, the app calls:
   - `supabase.storage.from('exercise-videos').getPublicUrl(<path>)`

So your table can store either:

- A **full public URL** from Supabase Storage, or  
- The **object path inside the bucket** (e.g. `folder/my-video.mp4`), not including the bucket name.

## 4. Matching rows to the site catalog

The site merges Supabase rows onto the local list by **slug**, **exercise_id**, **id**, or **normalized name** (e.g. “Push Up” ↔ `push-up`).  
If nothing matches, the JSON exercise stays without a Supabase video.

## 5. Supabase script

Pages that load exercises must include the Supabase JS **before** `app.js`:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/app.js"></script>
```

Open **DevTools → Console** and look for messages starting with `Moveo:` to debug.
