// Supabase configuration
// Using Jakolof's Project credentials
const supabaseUrl = 'https://vfmxsiebtetinszkyzsf.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmbXhzaWVidGV0aW5zemt5enNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNDI2MTYsImV4cCI6MjA3MjkxODYxNn0.dWf_CUYHe0G-gUnlleTQNKcb79f3TyHuh0nmrRCms5c'

// Create Supabase client using the global Supabase object from CDN with proper auth persistence
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Export for use in other modules
export { supabase }
