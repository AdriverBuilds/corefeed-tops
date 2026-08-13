/**
 * Public COREFEED config — anon key is the same one baked into the game client.
 * Safe to ship: RLS allows read + claim RPC; no service role here.
 */
window.CF = {
  supabaseUrl: 'https://pkaacfyfkrhrjnplgung.supabase.co',
  supabaseAnon: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrYWFjZnlma3JocmpucGxndW5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxNDAxMjAsImV4cCI6MjEwMTcxNjEyMH0.MDTHS-SZ1KgnWS69ERetiATfmst2hlZqPvo6Jd2xMk4',
  itch: 'https://adriverbuilds.itch.io/corefeed',
};
