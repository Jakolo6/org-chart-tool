-- =========================================================
-- COMPLETE DATABASE SCHEMA FOR ORG CHART TOOL
-- =========================================================

-- =========================================================
-- TABLE DEFINITIONS
-- =========================================================

-- Create organizations table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    subscription_tier TEXT,
    max_users INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    display_name TEXT,
    organization_id UUID REFERENCES public.organizations,
    role TEXT DEFAULT 'member',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create org_charts table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.org_charts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    organization_id UUID REFERENCES public.organizations NOT NULL,
    created_by UUID REFERENCES public.profiles,
    is_baseline BOOLEAN,
    is_target BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create chart_versions table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.chart_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chart_id UUID REFERENCES public.org_charts ON DELETE CASCADE NOT NULL,
    version_number INTEGER NOT NULL,
    data JSONB,
    created_by UUID REFERENCES public.profiles,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
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

-- =========================================================
-- FUNCTIONS AND TRIGGERS
-- =========================================================

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_org_id UUID;
    display_name TEXT;
BEGIN
    -- Get display_name from user metadata if available
    display_name := NEW.raw_user_meta_data->>'display_name';
    
    -- If no display name in metadata, use email username
    IF display_name IS NULL THEN
        display_name := split_part(NEW.email, '@', 1);
    END IF;
    
    -- Create a default organization for the user
    INSERT INTO public.organizations (name)
    VALUES ('My Organization')
    RETURNING id INTO default_org_id;
    
    -- Create a profile for the user
    INSERT INTO public.profiles (id, display_name, organization_id, role)
    VALUES (NEW.id, display_name, default_org_id, 'admin');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile and organization when a new user signs up
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
DROP TRIGGER IF EXISTS update_organizations_timestamp ON public.organizations;
CREATE TRIGGER update_organizations_timestamp
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS update_profiles_timestamp ON public.profiles;
CREATE TRIGGER update_profiles_timestamp
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS update_org_charts_timestamp ON public.org_charts;
CREATE TRIGGER update_org_charts_timestamp
    BEFORE UPDATE ON public.org_charts
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- =========================================================
-- ROW LEVEL SECURITY POLICIES
-- =========================================================

-- First, disable RLS on all tables
ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_charts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_versions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees DISABLE ROW LEVEL SECURITY;

-- Drop existing policies
DO $$
BEGIN
    -- Drop organization policies
    DROP POLICY IF EXISTS "Users can view their own organization" ON public.organizations;
    DROP POLICY IF EXISTS "Users can update their own organization" ON public.organizations;
    DROP POLICY IF EXISTS "Allow public insert to organizations" ON public.organizations;
    
    -- Drop profile policies
    DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;
    DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
    DROP POLICY IF EXISTS "New users can insert their profile" ON public.profiles;
    
    -- Drop org_charts policies
    DROP POLICY IF EXISTS "Enable read access for organization members" ON public.org_charts;
    DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.org_charts;
    DROP POLICY IF EXISTS "Enable update for chart owners" ON public.org_charts;
    DROP POLICY IF EXISTS "Enable delete for chart owners" ON public.org_charts;
    
    -- Drop chart_versions policies
    DROP POLICY IF EXISTS "Enable read access for organization members" ON public.chart_versions;
    DROP POLICY IF EXISTS "Enable insert for chart owners" ON public.chart_versions;
    DROP POLICY IF EXISTS "Enable update for chart owners" ON public.chart_versions;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error dropping policies: %', SQLERRM;
END $$;

-- Organization policies
CREATE POLICY "Users can view their own organization" 
    ON public.organizations FOR SELECT 
    USING (id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1));

CREATE POLICY "Users can update their own organization" 
    ON public.organizations FOR UPDATE 
    USING (id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND role = 'admin' LIMIT 1));

CREATE POLICY "Allow public insert to organizations" 
    ON public.organizations FOR INSERT 
    WITH CHECK (true);

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
CREATE POLICY "Enable read access for organization members"
    ON public.org_charts FOR SELECT
    USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1));

CREATE POLICY "Enable insert for authenticated users"
    ON public.org_charts FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for chart owners"
    ON public.org_charts FOR UPDATE
    USING (created_by = auth.uid() OR 
           organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND role = 'admin' LIMIT 1));

CREATE POLICY "Enable delete for chart owners"
    ON public.org_charts FOR DELETE
    USING (created_by = auth.uid() OR 
           organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND role = 'admin' LIMIT 1));

-- Chart Versions policies
CREATE POLICY "Enable read access for organization members"
    ON public.chart_versions FOR SELECT
    USING (chart_id IN (
        SELECT id FROM public.org_charts 
        WHERE organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
    ));

CREATE POLICY "Enable insert for chart owners"
    ON public.chart_versions FOR INSERT
    WITH CHECK (chart_id IN (
        SELECT id FROM public.org_charts 
        WHERE created_by = auth.uid() 
        OR organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND role = 'admin' LIMIT 1)
    ));

CREATE POLICY "Enable update for chart owners"
    ON public.chart_versions FOR UPDATE
    USING (chart_id IN (
        SELECT id FROM public.org_charts 
        WHERE created_by = auth.uid() 
        OR organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND role = 'admin' LIMIT 1)
    ));

-- Employees policies
CREATE POLICY "Enable read access for organization members"
    ON public.employees FOR SELECT
    USING (chart_id IN (
        SELECT id FROM public.org_charts 
        WHERE organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
    ));

CREATE POLICY "Enable insert for chart owners"
    ON public.employees FOR INSERT
    WITH CHECK (chart_id IN (
        SELECT id FROM public.org_charts 
        WHERE created_by = auth.uid() 
        OR organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND role = 'admin' LIMIT 1)
    ));

CREATE POLICY "Enable update for chart owners"
    ON public.employees FOR UPDATE
    USING (chart_id IN (
        SELECT id FROM public.org_charts 
        WHERE created_by = auth.uid() 
        OR organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND role = 'admin' LIMIT 1)
    ));

CREATE POLICY "Enable delete for chart owners"
    ON public.employees FOR DELETE
    USING (chart_id IN (
        SELECT id FROM public.org_charts 
        WHERE created_by = auth.uid() 
        OR organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND role = 'admin' LIMIT 1)
    ));

-- Re-enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- HANDLE EXISTING USERS
-- =========================================================

-- Create organizations and profiles for existing users who don't have them
DO $$
DECLARE
    user_record RECORD;
    new_org_id UUID;
BEGIN
    FOR user_record IN 
        SELECT au.id, au.email, au.raw_user_meta_data 
        FROM auth.users au
        LEFT JOIN public.profiles p ON au.id = p.id
        WHERE p.id IS NULL
    LOOP
        -- Create organization
        INSERT INTO public.organizations (name)
        VALUES ('My Organization')
        RETURNING id INTO new_org_id;
        
        -- Create profile
        INSERT INTO public.profiles (
            id, 
            display_name, 
            organization_id, 
            role
        ) VALUES (
            user_record.id, 
            COALESCE(
                user_record.raw_user_meta_data->>'display_name',
                split_part(user_record.email, '@', 1)
            ),
            new_org_id,
            'admin'
        );
    END LOOP;
END;
$$;
