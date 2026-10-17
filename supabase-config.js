/*
  supabase-config.js = how the website connects to your Supabase project.
  Every page that talks to the database loads this file first.

  The publishable/anon key is SAFE to put in a public website: on its own
  it can only READ, because of the security rules in setup.sql.
  NEVER put the "secret" or "service_role" key here. That one ignores
  all the rules, and anyone could use it to wipe your data.
*/
const SUPABASE_URL = "https://YOUR-PROJECT-ID.supabase.co";
const SUPABASE_KEY = "YOUR-PUBLISHABLE-OR-ANON-KEY";

// The storage bucket created in setup.sql (product photos + hero photo)
const IMAGE_BUCKET = "site-images";

/*
  "db" is our connection. Other scripts use it like:
    db.from("products").select("*")
  It's called db instead of supabase because the Supabase library
  already uses the name "supabase" for itself.
*/
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
