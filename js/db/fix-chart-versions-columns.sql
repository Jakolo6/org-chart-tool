-- Fix chart_versions table columns
DO $$
BEGIN
    -- Add file_name column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'chart_versions'
        AND column_name = 'file_name'
    ) THEN
        ALTER TABLE public.chart_versions 
        ADD COLUMN file_name TEXT;
        
        RAISE NOTICE 'Added file_name column to chart_versions table';
    ELSE
        RAISE NOTICE 'file_name column already exists in chart_versions table';
    END IF;
    
    -- Add file_size column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'chart_versions'
        AND column_name = 'file_size'
    ) THEN
        ALTER TABLE public.chart_versions 
        ADD COLUMN file_size INTEGER;
        
        RAISE NOTICE 'Added file_size column to chart_versions table';
    ELSE
        RAISE NOTICE 'file_size column already exists in chart_versions table';
    END IF;
END $$;
