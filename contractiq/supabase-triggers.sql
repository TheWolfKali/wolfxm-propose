-- ============================================================
-- ContractIQ — Additional SQL: Triggers & Buckets
-- Run this in your Supabase SQL Editor after supabase-setup.sql
-- ============================================================

-- 1. Avatars storage bucket (for contractor logos)
-- Run in Supabase Dashboard → Storage → New Bucket
-- Name: avatars, Public: true
-- Or via SQL (requires pg_net extension):
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read on avatars
CREATE POLICY "Public avatar read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Allow authenticated users to upload their own avatar
CREATE POLICY "Contractor avatar upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to update/delete their own avatar
CREATE POLICY "Contractor avatar update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- 2. Auto-update job status when homeowner approves proposal
CREATE OR REPLACE FUNCTION update_job_status_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.approved_at IS NOT NULL AND OLD.approved_at IS NULL THEN
    UPDATE jobs SET status = 'approved'
    WHERE id = (
      SELECT j.id FROM jobs j
      JOIN estimates e ON e.job_id = j.id
      WHERE e.id = NEW.estimate_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists, then recreate
DROP TRIGGER IF EXISTS proposal_approved_trigger ON proposals;

CREATE TRIGGER proposal_approved_trigger
  AFTER UPDATE ON proposals
  FOR EACH ROW EXECUTE FUNCTION update_job_status_on_approval();


-- 3. Allow public (unauthenticated) to approve proposals via share token
-- The proposals table already allows public SELECT via share_token.
-- We also need to allow public UPDATE for the approve flow.
-- Add this policy if it doesn't exist:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'proposals' AND policyname = 'Public can approve proposals'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Public can approve proposals"
        ON proposals FOR UPDATE
        USING (true)
        WITH CHECK (true);
    $policy$;
  END IF;
END $$;
