// Use the supabase instance from supabase.js
import { supabase } from './supabase.js';

/**
 * Authentication module for handling user registration, login, and profile management
 */

/**
 * Sign up a new user with email and password
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @param {string} displayName - User's display name
 * @param {string} organizationName - Name of the user's organization
 * @returns {Promise<{user, error}>} - The created user or error
 */
export async function signUp(email, password, displayName, organizationName) {
  try {
    // 1. Sign up the user with Supabase Auth with improved email confirmation
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + '/auth/email-confirmation.html',
        data: {
          display_name: displayName,
          organization_name: organizationName
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
    
    // 2. Create an organization for the user
    try {
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert([{ name: organizationName }])
        .select()
        .single();
      
      if (orgError) {
        console.error('Organization creation error:', orgError);
        // Continue with signup even if org creation fails
        // We'll return partial success
        return { 
          user: authData.user, 
          partialSuccess: true,
          message: 'Account created but organization setup failed. Please contact support.',
          error: null 
        };
      }
      
      // 3. Update the user's profile with organization ID and display name
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .insert([{
            id: authData.user.id,
            display_name: displayName,
            organization_id: orgData.id,
            role: 'admin' // First user is the admin
          }])
          .select()
          .single();
        
        if (profileError) {
          console.error('Profile creation error:', profileError);
          // Continue with signup even if profile creation fails
          return { 
            user: authData.user, 
            organization: orgData,
            partialSuccess: true,
            message: 'Account and organization created but profile setup failed. Please contact support.',
            error: null 
          };
        }
        
        return { user: authData.user, profile: profileData, organization: orgData, error: null };
      } catch (profileError) {
        console.error('Profile creation exception:', profileError);
        return { 
          user: authData.user, 
          organization: orgData,
          partialSuccess: true,
          message: 'Account and organization created but profile setup failed. Please contact support.',
          error: null 
        };
      }
    } catch (orgError) {
      console.error('Organization creation exception:', orgError);
      return { 
        user: authData.user, 
        partialSuccess: true,
        message: 'Account created but organization setup failed. Please contact support.',
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
export async function signIn(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    
    // Get the user's profile and organization
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*, organizations(*)')
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
        organization: profile.organizations,
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
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error signing out:', error);
    return { error };
  }
}

/**
 * Get the current authenticated user
 * @returns {Promise<{user, profile, organization, error}>} - The current user, profile, and organization
 */
export async function getCurrentUser() {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { user: null, profile: null, organization: null, error: authError };
    }
    
    // Get the user's profile and organization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*, organizations(*)')
      .eq('id', user.id)
      .single();
    
    if (profileError) {
      return { user, profile: null, organization: null, error: profileError };
    }
    
    return { 
      user, 
      profile, 
      organization: profile.organizations,
      error: null 
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return { user: null, profile: null, organization: null, error };
  }
}

/**
 * Update the user's profile
 * @param {string} userId - User's ID
 * @param {Object} updates - Profile updates
 * @returns {Promise<{profile, error}>} - The updated profile or error
 */
export async function updateProfile(userId, updates) {
  try {
    const { data, error } = await supabase
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

/**
 * Invite a user to the organization
 * @param {string} email - User's email
 * @param {string} organizationId - Organization ID
 * @returns {Promise<{success, error}>} - Success status or error
 */
export async function inviteUser(email, organizationId) {
  // In a real app, you would send an email invitation
  // For now, we'll just create a placeholder user
  try {
    // This is a simplified version - in a real app, you would:
    // 1. Generate an invitation token
    // 2. Store it in a database table
    // 3. Send an email with a signup link containing the token
    
    console.log(`Invitation sent to ${email} for organization ${organizationId}`);
    return { success: true, error: null };
  } catch (error) {
    console.error('Error inviting user:', error);
    return { success: false, error };
  }
}

// Set up auth state change listener
export function setupAuthListener(callback) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}
