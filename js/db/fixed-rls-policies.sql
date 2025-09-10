-- Row Level Security (RLS) policies for multi-tenant data isolation
-- These policies ensure users can only access data from their own organization

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Organizations table policies
-- Users can only view their own organization
CREATE POLICY organization_select_policy ON organizations
    FOR SELECT
    USING (id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    ));

-- Allow users to insert into organizations (needed for registration)
CREATE POLICY organization_insert_policy ON organizations
    FOR INSERT
    WITH CHECK (true);

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

-- Users can view profiles in their organization
CREATE POLICY profiles_select_policy ON profiles
    FOR SELECT
    USING (organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    ));

-- Users can only update their own profile
CREATE POLICY profiles_update_policy ON profiles
    FOR UPDATE
    USING (id = auth.uid());

-- Admin users can update profiles in their organization
CREATE POLICY profiles_admin_update_policy ON profiles
    FOR UPDATE
    USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
        AND
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Org Charts table policies
-- Users can only view charts from their organization
CREATE POLICY org_charts_select_policy ON org_charts
    FOR SELECT
    USING (organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    ));

-- Users can only insert charts into their organization
CREATE POLICY org_charts_insert_policy ON org_charts
    FOR INSERT
    WITH CHECK (organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    ));

-- Users can only update charts from their organization
CREATE POLICY org_charts_update_policy ON org_charts
    FOR UPDATE
    USING (organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    ));

-- Users can only delete charts from their organization
CREATE POLICY org_charts_delete_policy ON org_charts
    FOR DELETE
    USING (organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    ));

-- Chart Versions table policies
-- Users can only view chart versions for charts in their organization
CREATE POLICY chart_versions_select_policy ON chart_versions
    FOR SELECT
    USING (chart_id IN (
        SELECT id FROM org_charts
        WHERE organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    ));

-- Users can only insert chart versions for charts in their organization
CREATE POLICY chart_versions_insert_policy ON chart_versions
    FOR INSERT
    WITH CHECK (chart_id IN (
        SELECT id FROM org_charts
        WHERE organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    ));

-- Users can only update chart versions for charts in their organization
CREATE POLICY chart_versions_update_policy ON chart_versions
    FOR UPDATE
    USING (chart_id IN (
        SELECT id FROM org_charts
        WHERE organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    ));

-- Users can only delete chart versions for charts in their organization
CREATE POLICY chart_versions_delete_policy ON chart_versions
    FOR DELETE
    USING (chart_id IN (
        SELECT id FROM org_charts
        WHERE organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    ));

-- Employees table policies
-- Users can only view employees for charts in their organization
CREATE POLICY employees_select_policy ON employees
    FOR SELECT
    USING (chart_id IN (
        SELECT id FROM org_charts
        WHERE organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    ));

-- Users can only insert employees for charts in their organization
CREATE POLICY employees_insert_policy ON employees
    FOR INSERT
    WITH CHECK (chart_id IN (
        SELECT id FROM org_charts
        WHERE organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    ));

-- Users can only update employees for charts in their organization
CREATE POLICY employees_update_policy ON employees
    FOR UPDATE
    USING (chart_id IN (
        SELECT id FROM org_charts
        WHERE organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    ));

-- Users can only delete employees for charts in their organization
CREATE POLICY employees_delete_policy ON employees
    FOR DELETE
    USING (chart_id IN (
        SELECT id FROM org_charts
        WHERE organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    ));
