-- Check if owner_id column exists
DO $$
BEGIN
    -- Check if the column exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'org_charts'
        AND column_name = 'owner_id'
    ) THEN
        -- Add the column if it doesn't exist
        ALTER TABLE public.org_charts 
        ADD COLUMN owner_id UUID REFERENCES public.profiles;
        
        -- Update existing charts to set owner_id from created_by
        UPDATE public.org_charts
        SET owner_id = created_by
        WHERE owner_id IS NULL AND created_by IS NOT NULL;
    END IF;
END $$;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'org_charts' 
AND column_name = 'owner_id';
