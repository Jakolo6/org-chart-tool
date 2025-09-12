-- Remove organization_id column from org_charts table
DO $$
BEGIN
    -- First check if the column exists
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'org_charts'
        AND column_name = 'organization_id'
    ) THEN
        -- First make sure all records have owner_id set
        UPDATE public.org_charts
        SET owner_id = created_by
        WHERE owner_id IS NULL AND created_by IS NOT NULL;
        
        -- Then drop the organization_id column completely
        ALTER TABLE public.org_charts
        DROP COLUMN organization_id;
        
        RAISE NOTICE 'organization_id column has been removed from org_charts table';
    ELSE
        RAISE NOTICE 'organization_id column does not exist in org_charts table';
    END IF;
END $$;
