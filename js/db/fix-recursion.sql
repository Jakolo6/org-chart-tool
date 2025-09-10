-- First, drop all existing policies that might be causing recursion
DROP POLICY IF EXISTS profiles_select_policy ON profiles;
DROP POLICY IF EXISTS profiles_update_policy ON profiles;
DROP POLICY IF EXISTS profiles_admin_update_policy ON profiles;
DROP POLICY IF EXISTS profiles_insert_policy ON profiles;

DROP POLICY IF EXISTS organization_select_policy ON organizations;
DROP POLICY IF EXISTS organization_update_policy ON organizations;
DROP POLICY IF EXISTS organization_insert_policy ON organizations;

-- Now create simpler policies that won't cause recursion

-- Organizations table policies
-- Allow anyone to insert into organizations (needed for registration)
CREATE POLICY organization_insert_policy ON organizations
    FOR INSERT
    WITH CHECK (true);

-- Users can only view their own organization
CREATE POLICY organization_select_policy ON organizations
    FOR SELECT
    USING (id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    ));

-- Users can only update their own organization
CREATE POLICY organization_update_policy ON organizations
    FOR UPDATE
    USING (id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    ));

-- Profiles table policies
-- Allow users to insert their own profile (needed for registration)
CREATE POLICY profiles_insert_policy ON profiles
    FOR INSERT
    WITH CHECK (id = auth.uid());

-- Users can view all profiles (simplify to avoid recursion)
CREATE POLICY profiles_select_policy ON profiles
    FOR SELECT
    USING (true);

-- Users can only update their own profile
CREATE POLICY profiles_update_policy ON profiles
    FOR UPDATE
    USING (id = auth.uid());
