# Calendar

An installable bulletin-board calendar with month and week views, pastel event categories, tasks, recurrence, reminders, search, drag-and-drop, offline access, and optional Supabase account syncing.

## Use locally

Serve the folder with any static web server. Service workers do not run from `file://` URLs.

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Enable accounts and sync

1. Create a Supabase project.
2. Run `supabase-schema.sql` in the Supabase SQL editor.
3. Copy the project URL and anon public key into `config.js`.
4. Add the GitHub Pages URL to the Supabase authentication redirect URLs.

The app remains usable in local-only mode when Supabase is not configured.

## Push notifications

The service worker is ready to receive Web Push events. True closed-app push delivery additionally requires a VAPID-enabled server or Supabase Edge Function to store subscriptions and send scheduled notifications. The in-app notification scheduler works after the user grants notification permission.

## GitHub Pages

In repository settings, open **Pages**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
