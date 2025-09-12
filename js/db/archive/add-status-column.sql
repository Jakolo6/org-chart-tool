-- Add status column to org_charts table
DO $$
BEGIN
    -- Check if the column exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'org_charts'
        AND column_name = 'status'
    ) THEN
        -- Add the column if it doesn't exist
        ALTER TABLE public.org_charts 
        ADD COLUMN status TEXT DEFAULT 'draft';
    END IF;
END $$;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'org_charts' 
AND column_name = 'status';
