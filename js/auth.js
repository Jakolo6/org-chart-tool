// Auth.js - Authentication functions

// Wait for supabaseClient to be available
let authInitialized = false;
let authInitAttempts = 0;
const MAX_INIT_ATTEMPTS = 10;

// Initialize auth module
function initAuth() {
  if (authInitialized) return true;
  
  if (authInitAttempts >= MAX_INIT_ATTEMPTS) {
    console.error('Failed to initialize auth after multiple attempts');
    return false;
  }
  
  if (!window.supabaseClient) {
    console.warn(`Supabase client not available yet, attempt ${authInitAttempts + 1}/${MAX_INIT_ATTEMPTS}`);
    authInitAttempts++;
    setTimeout(initAuth, 100);
    return false;
  }
  
  console.log('Auth module initialized successfully');
  authInitialized = true;
  return true;
}

/**
 * Authentication module for handling user registration, login, and profile management
 */

/**
 * Sign up a new user with email and password
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @param {string} displayName - User's display name
 * @returns {Promise<{user, error}>} - The created user or error
 */
async function signUp(email, password, displayName) {
  if (!initAuth()) return { user: null, error: { message: 'Auth not initialized' } };
  
  try {
    // 1. Sign up the user with Supabase Auth with improved email confirmation
    const { data: authData, error: authError } = await window.supabaseClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + '/auth/email-confirmation.html',
        data: {
          display_name: displayName
        }
      }
    });
    
    if (authError) {
      // Handle rate limiting errors
      if (authError.message && authError.message.includes('security purposes') && authError.message.includes('seconds')) {
        throw new Error('Too many registration attempts. Please wait a minute before trying again.');
      }
      throw authError;
    }
    
    // If we don't have a user object, it means email confirmation is required
    if (!authData.user) {
      return {
        user: null,
        emailConfirmationRequired: true,
        message: 'Please check your email to confirm your account.',
        error: null
      };
    }
    
    // 2. Create a profile for the user
    try {
      // Check if profile already exists
      const { data: existingProfile } = await window.supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();
        
      if (existingProfile) {
        // Profile exists, update it
        const { data: updatedProfile, error: updateError } = await window.supabaseClient
          .from('profiles')
          .update({
            display_name: displayName || existingProfile.display_name
          })
          .eq('id', authData.user.id)
          .select()
          .single();
          
        if (updateError) {
          console.error('Profile update error:', updateError);
          return { 
            user: authData.user,
            partialSuccess: true,
            message: 'Account created but profile update failed. Please try logging in.',
            error: null 
          };
        }
        
        return { user: authData.user, profile: updatedProfile, error: null };
      }
      
      // Create new profile
      const { data: profile, error: profileError } = await window.supabaseClient
        .from('profiles')
        .insert([
          {
            id: authData.user.id,
            display_name: displayName,
            email: email,
            created_at: new Date().toISOString()
          }
        ])
        .select()
        .single();
      
      if (profileError) {
        console.error('Profile creation error:', profileError);
        // Try a simpler approach
        const { error: simpleProfileError } = await window.supabaseClient
          .from('profiles')
          .insert({
            id: authData.user.id,
            display_name: authData.user.email.split('@')[0]
          });
          
        if (simpleProfileError) {
          console.error('Simple profile creation also failed:', simpleProfileError);
          return { 
            user: authData.user,
            partialSuccess: true,
            message: 'Account created but profile setup failed. Please try logging in.',
            error: null 
          };
        }
        
        return { user: authData.user, profile: { id: authData.user.id }, error: null };
      }
      
      return { user: authData.user, profile, error: null };
    } catch (profileError) {
      console.error('Profile creation exception:', profileError);
      return { 
        user: authData.user,
        partialSuccess: true,
        message: 'Account created but profile setup failed. Please try logging in.',
        error: null 
      };
    }
  } catch (error) {
    console.error('Error signing up:', error);
    
    // Provide user-friendly error messages
    let userMessage = 'Registration failed. Please try again.';
    
    if (error.message) {
      if (error.message.includes('Too many registration attempts')) {
        userMessage = error.message;
      } else if (error.message.includes('already registered')) {
        userMessage = 'This email is already registered. Please log in or use a different email.';
      } else if (error.message.includes('password')) {
        userMessage = 'Password does not meet requirements. Please use at least 8 characters.';
      } else if (error.message.includes('recursion')) {
        userMessage = 'System error with permissions. Please try again in a few minutes.';
      }
    }
    
    return { user: null, error: { message: userMessage, originalError: error } };
  }
}

/**
 * Sign in an existing user with email and password
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @returns {Promise<{user, error}>} - The authenticated user or error
 */
async function signIn(email, password) {
  if (!initAuth()) return { user: null, error: { message: 'Auth not initialized' } };
  
  try {
    const { data, error } = await window.supabaseClient.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    
    // Get the user's profile
    try {
      const { data: profile, error: profileError } = await window.supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();
      
      if (profileError) {
        console.error('Profile fetch error:', profileError);
        return { 
          user: data.user, 
          partialSuccess: true,
          message: 'Logged in but could not load profile data. Some features may be limited.',
          error: null 
        };
      }
      
      return { 
        user: data.user, 
        profile, 
        error: null 
      };
    } catch (profileError) {
      console.error('Profile fetch exception:', profileError);
      return { 
        user: data.user, 
        partialSuccess: true,
        message: 'Logged in but could not load profile data. Some features may be limited.',
        error: null 
      };
    }
  } catch (error) {
    console.error('Error signing in:', error);
    
    // Provide user-friendly error messages
    let userMessage = 'Login failed. Please check your credentials and try again.';
    
    if (error.message) {
      if (error.message.includes('Invalid login')) {
        userMessage = 'Invalid email or password. Please try again.';
      } else if (error.message.includes('Email not confirmed')) {
        userMessage = 'Please confirm your email address before logging in.';
      } else if (error.message.includes('recursion')) {
        userMessage = 'System error with permissions. Please try again in a few minutes.';
      }
    }
    
    return { user: null, error: { message: userMessage, originalError: error } };
  }
}

/**
 * Sign out the current user
 * @returns {Promise<{error}>} - Error if any
 */
async function signOut() {
  if (!initAuth()) return { error: { message: 'Auth not initialized' } };
  
  try {
    const { error } = await window.supabaseClient.auth.signOut();
    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error signing out:', error);
    return { error };
  }
}

/**
 * Get the current authenticated user
 * @returns {Promise<{user, profile, error}>} - The current user and profile
 */
async function getCurrentUser() {
  if (!initAuth()) return { user: null, profile: null, error: { message: 'Auth not initialized' } };
  
  try {
    // First check the session
    const { data: sessionData, error: sessionError } = await window.supabaseClient.auth.getSession();
    
    // If no session or session error, user is not logged in (this is normal)
    if (sessionError || !sessionData?.session) {
      // This is not an error, just means user is not logged in
      return { user: null, profile: null, error: null };
    }
    
    // Get the user
    const { data: userData, error: userError } = await window.supabaseClient.auth.getUser();
    
    if (userError || !userData?.user) {
      // Only log as error if it's not an auth session missing error
      if (userError && !userError.message?.includes('Auth session missing')) {
        console.error('User error:', userError);
      }
      return { user: null, profile: null, error: null };
    }
    
    // Get the user's profile
    const { data: profile, error: profileError } = await window.supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', userData.user.id)
      .single();
      
    if (profileError) {
      console.warn('Profile fetch error:', profileError);
      return { user: userData.user, profile: null, error: profileError };
    }
    
    return { 
      user: userData.user, 
      profile,
      error: null 
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return { user: null, profile: null, error };
  }
}

/**
 * Update the user's profile
 * @param {string} userId - User's ID
 * @param {Object} updates - Profile updates
 * @returns {Promise<{profile, error}>} - The updated profile or error
 */
async function updateProfile(userId, updates) {
  if (!initAuth()) return { profile: null, error: { message: 'Auth not initialized' } };
  
  try {
    const { data, error } = await window.supabaseClient
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    
    if (error) throw error;
    
    return { profile: data, error: null };
  } catch (error) {
    console.error('Error updating profile:', error);
    return { profile: null, error };
  }
}

// Make functions available globally
window.signUp = signUp;
window.signIn = signIn;
window.signOut = signOut;
window.getCurrentUser = getCurrentUser;
window.updateProfile = updateProfile;

// Set up auth state change listener
function setupAuthListener(callback) {
  if (!initAuth()) return null;
  
  return window.supabaseClient.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}

// Add to global scope
window.setupAuthListener = setupAuthListener;
