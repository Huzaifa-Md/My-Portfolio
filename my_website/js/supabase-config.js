// ═══════════════════════════════════════════════════════════════
//   SUPABASE CONFIGURATION
// ═══════════════════════════════════════════════════════════════
const SUPABASE_URL = 'https://vpkmjohklisurwkgfekq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwa21qb2hrbGlzdXJ3a2dmZWtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MDkyMDIsImV4cCI6MjA5MjA4NTIwMn0.aCXe0RKMmdqACjDPA0Bl3lixuzlwCSyrDtOMbXqHPBM';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
