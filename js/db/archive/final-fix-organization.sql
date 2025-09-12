-- Remove organization_id column and all dependent policies
BEGIN;

-- First drop all dependent policies
DROP POLICY IF EXISTS "Users can view org charts in their organization" ON public.org_charts;
DROP POLICY IF EXISTS "Users can create org charts in their organization" ON public.org_charts;
DROP POLICY IF EXISTS "Users can update org charts in their organization" ON public.org_charts;
DROP POLICY IF EXISTS "Users can view chart versions in their organization" ON public.chart_versions;
DROP POLICY IF EXISTS "Users can create chart versions in their organization" ON public.chart_versions;
DROP POLICY IF EXISTS "Users can view employees in their organization" ON public.employees;
DROP POLICY IF EXISTS "Users can create employees in their organization" ON public.employees;
DROP POLICY IF EXISTS "Users can update employees in their organization" ON public.employees;

-- Make sure all records have owner_id set
UPDATE public.org_charts
SET owner_id = created_by
WHERE owner_id IS NULL AND created_by IS NOT NULL;

-- Drop the organization_id column
ALTER TABLE public.org_charts
DROP COLUMN IF EXISTS organization_id;

-- Create new policies based on owner_id
CREATE POLICY "Users can view their own org charts" 
ON public.org_charts FOR SELECT 
USING (owner_id = auth.uid());

CREATE POLICY "Users can create their own org charts" 
ON public.org_charts FOR INSERT 
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own org charts" 
ON public.org_charts FOR UPDATE 
USING (owner_id = auth.uid());

-- Create policies for chart versions based on org chart ownership
CREATE POLICY "Users can view their own chart versions" 
ON public.chart_versions FOR SELECT 
USING (chart_id IN (SELECT id FROM public.org_charts WHERE owner_id = auth.uid()));

CREATE POLICY "Users can create their own chart versions" 
ON public.chart_versions FOR INSERT 
WITH CHECK (chart_id IN (SELECT id FROM public.org_charts WHERE owner_id = auth.uid()));

-- Create policies for employees based on org chart ownership
CREATE POLICY "Users can view their own employees" 
ON public.employees FOR SELECT 
USING (chart_id IN (SELECT id FROM public.org_charts WHERE owner_id = auth.uid()));

CREATE POLICY "Users can create their own employees" 
ON public.employees FOR INSERT 
WITH CHECK (chart_id IN (SELECT id FROM public.org_charts WHERE owner_id = auth.uid()));

CREATE POLICY "Users can update their own employees" 
ON public.employees FOR UPDATE 
USING (chart_id IN (SELECT id FROM public.org_charts WHERE owner_id = auth.uid()));

COMMIT;
