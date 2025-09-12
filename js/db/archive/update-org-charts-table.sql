-- Add missing columns to org_charts table
DO $$
BEGIN
    -- Add status column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'org_charts'
        AND column_name = 'status'
    ) THEN
        ALTER TABLE public.org_charts 
        ADD COLUMN status TEXT DEFAULT 'draft';
    END IF;

    -- Add deleted_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'org_charts'
        AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE public.org_charts 
        ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'org_charts' 
AND column_name IN ('status', 'deleted_at');
