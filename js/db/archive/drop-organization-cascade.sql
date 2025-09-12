-- Drop organization_id column with CASCADE option
BEGIN;

-- Make sure all records have owner_id set
UPDATE public.org_charts
SET owner_id = created_by
WHERE owner_id IS NULL AND created_by IS NOT NULL;

-- Drop the organization_id column with CASCADE
ALTER TABLE public.org_charts
DROP COLUMN organization_id CASCADE;

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
