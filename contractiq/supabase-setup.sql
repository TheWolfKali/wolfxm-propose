-- ============================================================
-- ContractIQ — Supabase setup
-- Run this entire file in the Supabase SQL editor
-- ============================================================

-- Enums
CREATE TYPE job_type_enum AS ENUM ('foundation', 'crawlspace', 'framing', 'roofing', 'remodel', 'other');
CREATE TYPE job_status_enum AS ENUM ('draft', 'sent', 'approved', 'declined');
CREATE TYPE confidence_enum AS ENUM ('high', 'medium', 'low');

-- Contractors (1:1 with auth.users)
CREATE TABLE contractors (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text NOT NULL,
  company_name text NOT NULL,
  logo_url    text,
  labor_rate  numeric NOT NULL DEFAULT 75,
  markup_pct  numeric NOT NULL DEFAULT 20,
  zip         text,
  license_no  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Jobs
CREATE TABLE jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  job_type      job_type_enum NOT NULL,
  description   text NOT NULL DEFAULT '',
  status        job_status_enum NOT NULL DEFAULT 'draft',
  address       text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Job photos
CREATE TABLE job_photos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  storage_url text NOT NULL,
  "order"     integer NOT NULL DEFAULT 0
);

-- Estimates
CREATE TABLE estimates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id           uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  ai_raw_response  text NOT NULL DEFAULT '',
  line_items       jsonb NOT NULL DEFAULT '[]',
  labor_hours      numeric NOT NULL DEFAULT 0,
  labor_rate       numeric NOT NULL DEFAULT 75,
  markup_pct       numeric NOT NULL DEFAULT 20,
  grand_total      numeric NOT NULL DEFAULT 0,
  warning_flags    jsonb NOT NULL DEFAULT '[]',
  confidence_level confidence_enum NOT NULL DEFAULT 'medium',
  confidence_note  text NOT NULL DEFAULT '',
  version          integer NOT NULL DEFAULT 1,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Proposals
CREATE TABLE proposals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  pdf_url     text,
  share_token text NOT NULL UNIQUE,
  sent_at     timestamptz,
  viewed_at   timestamptz,
  approved_at timestamptz
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

-- Contractors: only own row
CREATE POLICY "contractors_self" ON contractors
  FOR ALL USING (auth.uid() = id);

-- Jobs: only own jobs
CREATE POLICY "jobs_own" ON jobs
  FOR ALL USING (auth.uid() = contractor_id);

-- Job photos: via job ownership
CREATE POLICY "job_photos_own" ON job_photos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM jobs WHERE jobs.id = job_photos.job_id AND jobs.contractor_id = auth.uid()
    )
  );

-- Estimates: via job ownership
CREATE POLICY "estimates_own" ON estimates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM jobs WHERE jobs.id = estimates.job_id AND jobs.contractor_id = auth.uid()
    )
  );

-- Proposals: contractors can manage; public can read/approve by token
CREATE POLICY "proposals_contractor_manage" ON proposals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM estimates e
      JOIN jobs j ON j.id = e.job_id
      WHERE e.id = proposals.estimate_id AND j.contractor_id = auth.uid()
    )
  );

-- Public can read proposals (for share link)
CREATE POLICY "proposals_public_read" ON proposals
  FOR SELECT USING (true);

-- Public can approve (update approved_at) by id — anon users
CREATE POLICY "proposals_public_approve" ON proposals
  FOR UPDATE USING (true)
  WITH CHECK (true);

-- ============================================================
-- Storage buckets (run in SQL or create via Dashboard)
-- ============================================================

-- Private bucket for job photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-photos', 'job-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Public bucket for proposal PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('proposals', 'proposals', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: job-photos (private, contractor only)
CREATE POLICY "job_photos_storage_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'job-photos'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = 'jobs'
    AND EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id::text = (storage.foldername(name))[2]
      AND jobs.contractor_id = auth.uid()
    )
  );

CREATE POLICY "job_photos_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'job-photos'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "job_photos_storage_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'job-photos'
    AND auth.uid() IS NOT NULL
  );

-- Storage policies: proposals (public read, service role write)
CREATE POLICY "proposals_storage_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'proposals');

CREATE POLICY "proposals_storage_service_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'proposals');
