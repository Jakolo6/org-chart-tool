-- Update schema to support draft projects and improved workflow

-- Add status field to org_charts table
ALTER TABLE org_charts 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'mapped', 'ready', 'archived'));

-- Add column_mapping JSON field to chart_versions table
ALTER TABLE chart_versions
ADD COLUMN IF NOT EXISTS column_mapping JSONB;

-- Add raw_data and raw_headers fields to chart_versions table
ALTER TABLE chart_versions
ADD COLUMN IF NOT EXISTS raw_data JSONB,
ADD COLUMN IF NOT EXISTS raw_headers JSONB;

-- Add file metadata to chart_versions table
ALTER TABLE chart_versions
ADD COLUMN IF NOT EXISTS file_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS file_size INTEGER;

-- Add last_accessed_project_id to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS last_accessed_project_id UUID REFERENCES org_charts(id) ON DELETE SET NULL;

-- Create chart_snapshots table for versioning
CREATE TABLE IF NOT EXISTS chart_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chart_id UUID NOT NULL REFERENCES org_charts(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('baseline', 'target', 'custom')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Add RLS policies for chart_snapshots
ALTER TABLE chart_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view snapshots for their organization's charts" ON chart_snapshots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM org_charts c
      JOIN profiles p ON c.organization_id = p.organization_id
      WHERE c.id = chart_id AND p.id = auth.uid()
    )
  );

CREATE POLICY "Users can create snapshots for their organization's charts" ON chart_snapshots
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_charts c
      JOIN profiles p ON c.organization_id = p.organization_id
      WHERE c.id = chart_id AND p.id = auth.uid()
    )
  );

CREATE POLICY "Users can update snapshots for their organization's charts" ON chart_snapshots
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM org_charts c
      JOIN profiles p ON c.organization_id = p.organization_id
      WHERE c.id = chart_id AND p.id = auth.uid()
    )
  );

CREATE POLICY "Users can delete snapshots for their organization's charts" ON chart_snapshots
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM org_charts c
      JOIN profiles p ON c.organization_id = p.organization_id
      WHERE c.id = chart_id AND p.id = auth.uid()
    )
  );

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_org_charts_status ON org_charts(status);
CREATE INDEX IF NOT EXISTS idx_org_charts_organization_id_status ON org_charts(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_chart_versions_chart_id ON chart_versions(chart_id);
CREATE INDEX IF NOT EXISTS idx_chart_snapshots_chart_id ON chart_snapshots(chart_id);
CREATE INDEX IF NOT EXISTS idx_profiles_last_accessed_project_id ON profiles(last_accessed_project_id);
