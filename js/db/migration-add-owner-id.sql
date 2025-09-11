-- Add owner_id column to org_charts table
ALTER TABLE public.org_charts 
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles;

-- Update existing charts to set owner_id from created_by
UPDATE public.org_charts
SET owner_id = created_by
WHERE owner_id IS NULL AND created_by IS NOT NULL;

-- Make owner_id NOT NULL after migration
ALTER TABLE public.org_charts
ALTER COLUMN owner_id SET NOT NULL;
