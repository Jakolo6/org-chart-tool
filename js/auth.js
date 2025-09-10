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
    // 1. Sign up the user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });
    
    if (authError) throw authError;
    
    // 2. Create an organization for the user
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .insert([{ name: organizationName }])
      .select()
      .single();
    
    if (orgError) throw orgError;
    
    // 3. Update the user's profile with organization ID and display name
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
    
    if (profileError) throw profileError;
    
    return { user: authData.user, profile: profileData, organization: orgData, error: null };
  } catch (error) {
    console.error('Error signing up:', error);
    return { user: null, error };
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
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*, organizations(*)')
      .eq('id', data.user.id)
      .single();
    
    if (profileError) throw profileError;
    
    return { 
      user: data.user, 
      profile, 
      organization: profile.organizations,
      error: null 
    };
  } catch (error) {
    console.error('Error signing in:', error);
    return { user: null, error };
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
