// Supabase configuration
// Using Jakolof's Project credentials
const supabaseUrl = 'https://vfmxsiebtetinszkyzsf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmbXhzaWVidGV0aW5zemt5enNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNDI2MTYsImV4cCI6MjA3MjkxODYxNn0.dWf_CUYHe0G-gUnlleTQNKcb79f3TyHuh0nmrRCms5c';

// Initialize Supabase client
if (!window.supabaseClient) {
  try {
    // Create Supabase client using the global Supabase object from CDN
    const client = window.supabase.createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    });
    
    // Make supabase client available globally
    window.supabaseClient = client;
    console.log('Supabase client initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
  }
}
