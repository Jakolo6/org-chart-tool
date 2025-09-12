-- =========================================================
-- FINAL DATABASE SCHEMA - USER-BASED MODEL
-- =========================================================

-- Start transaction
BEGIN;

-- =========================================================
-- CLEAN UP EXISTING ORGANIZATION DEPENDENCIES
-- =========================================================

-- Drop organization_id column with CASCADE to remove all dependent policies
ALTER TABLE IF EXISTS public.org_charts
DROP COLUMN IF EXISTS organization_id CASCADE;

-- =========================================================
-- TABLE DEFINITIONS
-- =========================================================

-- Create profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    display_name TEXT,
    last_accessed_project_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create org_charts table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.org_charts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    owner_id UUID REFERENCES public.profiles NOT NULL,
    is_baseline BOOLEAN DEFAULT false,
    is_target BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'draft',
    created_by UUID REFERENCES public.profiles,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create chart_versions table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.chart_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chart_id UUID REFERENCES public.org_charts ON DELETE CASCADE NOT NULL,
    version_number INTEGER NOT NULL,
    data JSONB,
    raw_data JSONB,
    raw_headers JSONB,
    column_mapping JSONB,
    file_name TEXT,
    file_size INTEGER,
    created_by UUID REFERENCES public.profiles,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create employees table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chart_id UUID REFERENCES public.org_charts NOT NULL,
    employee_id TEXT NOT NULL,
    name TEXT NOT NULL,
    manager_id TEXT,
    title TEXT,
    fte NUMERIC,
    location TEXT,
    job_family TEXT,
    management_level TEXT,
    additional_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create chart_snapshots table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.chart_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chart_id UUID REFERENCES public.org_charts ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =========================================================
-- FUNCTIONS AND TRIGGERS
-- =========================================================

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    display_name TEXT;
BEGIN
    -- Get display_name from user metadata if available
    display_name := NEW.raw_user_meta_data->>'display_name';
    
    -- If no display name in metadata, use email username
    IF display_name IS NULL THEN
        display_name := split_part(NEW.email, '@', 1);
    END IF;
    
    -- Create a profile for the user
    INSERT INTO public.profiles (id, display_name)
    VALUES (NEW.id, display_name);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile when a new user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to update timestamps
DROP TRIGGER IF EXISTS update_profiles_timestamp ON public.profiles;
CREATE TRIGGER update_profiles_timestamp
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS update_org_charts_timestamp ON public.org_charts;
CREATE TRIGGER update_org_charts_timestamp
    BEFORE UPDATE ON public.org_charts
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS update_chart_versions_timestamp ON public.chart_versions;
CREATE TRIGGER update_chart_versions_timestamp
    BEFORE UPDATE ON public.chart_versions
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- =========================================================
-- ROW LEVEL SECURITY POLICIES
-- =========================================================

-- First, enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_snapshots ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (if any)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "New users can insert their profile" ON public.profiles;

DROP POLICY IF EXISTS "Users can view their own org charts" ON public.org_charts;
DROP POLICY IF EXISTS "Users can create their own org charts" ON public.org_charts;
DROP POLICY IF EXISTS "Users can update their own org charts" ON public.org_charts;
DROP POLICY IF EXISTS "Users can delete their own org charts" ON public.org_charts;

DROP POLICY IF EXISTS "Users can view their own chart versions" ON public.chart_versions;
DROP POLICY IF EXISTS "Users can create their own chart versions" ON public.chart_versions;
DROP POLICY IF EXISTS "Users can update their own chart versions" ON public.chart_versions;

DROP POLICY IF EXISTS "Users can view their own employees" ON public.employees;
DROP POLICY IF EXISTS "Users can create their own employees" ON public.employees;
DROP POLICY IF EXISTS "Users can update their own employees" ON public.employees;
DROP POLICY IF EXISTS "Users can delete their own employees" ON public.employees;

DROP POLICY IF EXISTS "Users can view their own chart snapshots" ON public.chart_snapshots;
DROP POLICY IF EXISTS "Users can create their own chart snapshots" ON public.chart_snapshots;
DROP POLICY IF EXISTS "Users can delete their own chart snapshots" ON public.chart_snapshots;

-- Create new policies based on user ownership

-- Profile policies
CREATE POLICY "Users can view their own profile" 
    ON public.profiles FOR SELECT 
    USING (id = auth.uid());

CREATE POLICY "Users can update their own profile" 
    ON public.profiles FOR UPDATE 
    USING (id = auth.uid());

CREATE POLICY "New users can insert their profile" 
    ON public.profiles FOR INSERT 
    WITH CHECK (id = auth.uid());

-- Org Charts policies
CREATE POLICY "Users can view their own org charts"
    ON public.org_charts FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Users can create their own org charts"
    ON public.org_charts FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own org charts"
    ON public.org_charts FOR UPDATE
    USING (owner_id = auth.uid());

CREATE POLICY "Users can delete their own org charts"
    ON public.org_charts FOR DELETE
    USING (owner_id = auth.uid());

-- Chart Versions policies
CREATE POLICY "Users can view their own chart versions"
    ON public.chart_versions FOR SELECT
    USING (chart_id IN (
        SELECT id FROM public.org_charts 
        WHERE owner_id = auth.uid()
    ));

CREATE POLICY "Users can create their own chart versions"
    ON public.chart_versions FOR INSERT
    WITH CHECK (chart_id IN (
        SELECT id FROM public.org_charts 
        WHERE owner_id = auth.uid()
    ));

CREATE POLICY "Users can update their own chart versions"
    ON public.chart_versions FOR UPDATE
    USING (chart_id IN (
        SELECT id FROM public.org_charts 
        WHERE owner_id = auth.uid()
    ));

-- Employees policies
CREATE POLICY "Users can view their own employees"
    ON public.employees FOR SELECT
    USING (chart_id IN (
        SELECT id FROM public.org_charts 
        WHERE owner_id = auth.uid()
    ));

CREATE POLICY "Users can create their own employees"
    ON public.employees FOR INSERT
    WITH CHECK (chart_id IN (
        SELECT id FROM public.org_charts 
        WHERE owner_id = auth.uid()
    ));

CREATE POLICY "Users can update their own employees"
    ON public.employees FOR UPDATE
    USING (chart_id IN (
        SELECT id FROM public.org_charts 
        WHERE owner_id = auth.uid()
    ));

CREATE POLICY "Users can delete their own employees"
    ON public.employees FOR DELETE
    USING (chart_id IN (
        SELECT id FROM public.org_charts 
        WHERE owner_id = auth.uid()
    ));

-- Chart Snapshots policies
CREATE POLICY "Users can view their own chart snapshots"
    ON public.chart_snapshots FOR SELECT
    USING (chart_id IN (
        SELECT id FROM public.org_charts 
        WHERE owner_id = auth.uid()
    ));

CREATE POLICY "Users can create their own chart snapshots"
    ON public.chart_snapshots FOR INSERT
    WITH CHECK (chart_id IN (
        SELECT id FROM public.org_charts 
        WHERE owner_id = auth.uid()
    ));

CREATE POLICY "Users can delete their own chart snapshots"
    ON public.chart_snapshots FOR DELETE
    USING (chart_id IN (
        SELECT id FROM public.org_charts 
        WHERE owner_id = auth.uid()
    ));

-- =========================================================
-- DATA MIGRATION
-- =========================================================

-- Make sure all records have owner_id set
UPDATE public.org_charts
SET owner_id = created_by
WHERE owner_id IS NULL AND created_by IS NOT NULL;

-- Commit transaction
COMMIT;
