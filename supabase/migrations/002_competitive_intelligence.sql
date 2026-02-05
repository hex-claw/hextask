-- Competitive Intelligence Schema
-- Created: 2026-02-04
-- Purpose: Track competitor data, snapshots, changes, and alerts

-- Core competitor registry
CREATE TABLE competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  industry TEXT,
  target_markets TEXT[],
  monitoring_active BOOLEAN DEFAULT true,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Point-in-time snapshots (full state capture)
CREATE TABLE competitor_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID REFERENCES competitors(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  
  -- JSONB fields for flexible structure
  pricing_data JSONB,           -- tiers, plans, pricing changes
  features_data JSONB,           -- feature list, new releases
  messaging_data JSONB,          -- homepage copy, positioning, value props
  review_stats JSONB,            -- G2/Capterra ratings, count, sentiment
  hiring_signals JSONB,          -- job postings, team growth indicators
  news_items JSONB,              -- press releases, funding, partnerships
  
  snapshot_hash TEXT,            -- MD5 of combined data to detect changes
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(competitor_id, snapshot_date)
);

-- Granular change tracking (deltas only)
CREATE TABLE competitor_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID REFERENCES competitors(id) ON DELETE CASCADE,
  detected_at TIMESTAMPTZ DEFAULT now(),
  
  category TEXT NOT NULL,        -- pricing|features|reviews|hiring|news|messaging
  change_type TEXT NOT NULL,     -- added|removed|modified|increased|decreased
  
  field_path TEXT,               -- JSON path to changed field
  before_value JSONB,
  after_value JSONB,
  
  significance TEXT DEFAULT 'low', -- low|medium|high|critical
  alert_sent BOOLEAN DEFAULT false,
  notes TEXT,
  
  CONSTRAINT valid_category CHECK (category IN ('pricing', 'features', 'reviews', 'hiring', 'news', 'messaging', 'other')),
  CONSTRAINT valid_change_type CHECK (change_type IN ('added', 'removed', 'modified', 'increased', 'decreased')),
  CONSTRAINT valid_significance CHECK (significance IN ('low', 'medium', 'high', 'critical'))
);

-- Alert management
CREATE TABLE competitor_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_id UUID REFERENCES competitor_changes(id) ON DELETE CASCADE,
  alerted_at TIMESTAMPTZ DEFAULT now(),
  channel TEXT,                  -- telegram|email|dashboard
  j_acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMPTZ
);

-- Indexes for common queries
CREATE INDEX idx_snapshots_competitor_date ON competitor_snapshots(competitor_id, snapshot_date DESC);
CREATE INDEX idx_changes_competitor_detected ON competitor_changes(competitor_id, detected_at DESC);
CREATE INDEX idx_changes_significance ON competitor_changes(significance, alert_sent);
CREATE INDEX idx_changes_category ON competitor_changes(category, detected_at DESC);
CREATE INDEX idx_alerts_acknowledged ON competitor_alerts(j_acknowledged, alerted_at DESC);

-- RLS Policies (authenticated users can read, service role can write)
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_alerts ENABLE ROW LEVEL SECURITY;

-- Read access for authenticated users
CREATE POLICY "Allow authenticated read on competitors" ON competitors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read on competitor_snapshots" ON competitor_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read on competitor_changes" ON competitor_changes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read on competitor_alerts" ON competitor_alerts FOR SELECT TO authenticated USING (true);

-- Service role has full access (bypasses RLS)

-- Insert initial competitors
INSERT INTO competitors (name, domain, industry, target_markets, monitoring_active) VALUES
  ('Guesty', 'guesty.com', 'Hospitality Technology', ARRAY['vacation_rentals', 'property_management'], true),
  ('Jurny', 'jurny.com', 'Hospitality Technology', ARRAY['vacation_rentals', 'property_management'], true);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_competitors_updated_at BEFORE UPDATE ON competitors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
