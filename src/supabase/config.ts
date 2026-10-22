import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = "https://pdyrjkdykputlupzfbdj.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkeXJqa2R5a3B1dGx1cHpmYmRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2OTQzODQsImV4cCI6MjEwODI3MDM4NH0.-bXHNUlpVwQsC-_cm-Y3ZWA5OLuVea8vFL7t5k7-rUw";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 20,
    },
  },
});
