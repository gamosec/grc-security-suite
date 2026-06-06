-- Migration: 0007_compliance_history.sql
-- Description: Add compliance score history tracking for trend charts
-- Date: 2024-12-31

-- Compliance score snapshots for trend tracking
CREATE TABLE IF NOT EXISTS compliance_snapshots (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  framework_id TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  basic_score INTEGER DEFAULT 0,
  advanced_score INTEGER DEFAULT 0,
  implemented_count INTEGER DEFAULT 0,
  in_progress_count INTEGER DEFAULT 0,
  not_started_count INTEGER DEFAULT 0,
  not_applicable_count INTEGER DEFAULT 0,
  total_controls INTEGER DEFAULT 0,
  avg_maturity REAL DEFAULT 0,
  critical_score INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (framework_id) REFERENCES compliance_frameworks_v2(id)
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_compliance_snapshots_org_fw_date 
ON compliance_snapshots(organization_id, framework_id, snapshot_date);

-- Domain score snapshots
CREATE TABLE IF NOT EXISTS domain_snapshots (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  domain_name TEXT NOT NULL,
  basic_score INTEGER DEFAULT 0,
  advanced_score INTEGER DEFAULT 0,
  implemented_count INTEGER DEFAULT 0,
  total_controls INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_domain_snapshots_org_date 
ON domain_snapshots(organization_id, snapshot_date);

-- Risk trend snapshots
CREATE TABLE IF NOT EXISTS risk_snapshots (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  total_risks INTEGER DEFAULT 0,
  open_risks INTEGER DEFAULT 0,
  critical_risks INTEGER DEFAULT 0,
  high_risks INTEGER DEFAULT 0,
  medium_risks INTEGER DEFAULT 0,
  low_risks INTEGER DEFAULT 0,
  total_exposure REAL DEFAULT 0,
  avg_risk_score REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_risk_snapshots_org_date 
ON risk_snapshots(organization_id, snapshot_date);

-- Insert some historical data for demo (last 6 months)
-- ISO 27001 historical scores
INSERT OR IGNORE INTO compliance_snapshots (id, organization_id, framework_id, snapshot_date, basic_score, advanced_score, implemented_count, in_progress_count, not_started_count, total_controls, avg_maturity) VALUES
('snap-iso-001', 'org-001', 'fw-iso27001', date('now', '-6 months'), 45, 38, 42, 15, 36, 93, 2.1),
('snap-iso-002', 'org-001', 'fw-iso27001', date('now', '-5 months'), 52, 45, 48, 18, 27, 93, 2.4),
('snap-iso-003', 'org-001', 'fw-iso27001', date('now', '-4 months'), 61, 54, 57, 16, 20, 93, 2.8),
('snap-iso-004', 'org-001', 'fw-iso27001', date('now', '-3 months'), 68, 61, 63, 14, 16, 93, 3.0),
('snap-iso-005', 'org-001', 'fw-iso27001', date('now', '-2 months'), 75, 69, 70, 12, 11, 93, 3.2),
('snap-iso-006', 'org-001', 'fw-iso27001', date('now', '-1 months'), 80, 74, 74, 10, 9, 93, 3.4),
('snap-iso-007', 'org-001', 'fw-iso27001', date('now'), 84, 77, 78, 8, 7, 93, 3.5);

-- SOC 2 historical scores
INSERT OR IGNORE INTO compliance_snapshots (id, organization_id, framework_id, snapshot_date, basic_score, advanced_score, implemented_count, in_progress_count, not_started_count, total_controls, avg_maturity) VALUES
('snap-soc2-001', 'org-001', 'fw-soc2', date('now', '-6 months'), 35, 28, 17, 10, 21, 48, 1.8),
('snap-soc2-002', 'org-001', 'fw-soc2', date('now', '-5 months'), 42, 35, 20, 12, 16, 48, 2.1),
('snap-soc2-003', 'org-001', 'fw-soc2', date('now', '-4 months'), 48, 42, 23, 11, 14, 48, 2.4),
('snap-soc2-004', 'org-001', 'fw-soc2', date('now', '-3 months'), 52, 46, 25, 10, 13, 48, 2.6),
('snap-soc2-005', 'org-001', 'fw-soc2', date('now', '-2 months'), 56, 50, 27, 9, 12, 48, 2.8),
('snap-soc2-006', 'org-001', 'fw-soc2', date('now', '-1 months'), 60, 55, 29, 8, 11, 48, 3.0),
('snap-soc2-007', 'org-001', 'fw-soc2', date('now'), 62, 58, 32, 6, 10, 48, 3.2);

-- Domain historical scores
INSERT OR IGNORE INTO domain_snapshots (id, organization_id, snapshot_date, domain_name, basic_score, advanced_score, implemented_count, total_controls) VALUES
('dsnap-org-001', 'org-001', date('now', '-6 months'), 'Organizational', 42, 35, 15, 37),
('dsnap-org-002', 'org-001', date('now', '-3 months'), 'Organizational', 58, 52, 22, 37),
('dsnap-org-003', 'org-001', date('now'), 'Organizational', 76, 70, 28, 37),
('dsnap-ppl-001', 'org-001', date('now', '-6 months'), 'People', 50, 42, 4, 8),
('dsnap-ppl-002', 'org-001', date('now', '-3 months'), 'People', 68, 60, 5, 8),
('dsnap-ppl-003', 'org-001', date('now'), 'People', 88, 82, 7, 8),
('dsnap-phy-001', 'org-001', date('now', '-6 months'), 'Physical', 55, 48, 7, 14),
('dsnap-phy-002', 'org-001', date('now', '-3 months'), 'Physical', 72, 65, 10, 14),
('dsnap-phy-003', 'org-001', date('now'), 'Physical', 93, 88, 13, 14),
('dsnap-tech-001', 'org-001', date('now', '-6 months'), 'Technological', 40, 32, 14, 34),
('dsnap-tech-002', 'org-001', date('now', '-3 months'), 'Technological', 62, 55, 21, 34),
('dsnap-tech-003', 'org-001', date('now'), 'Technological', 88, 82, 30, 34);

-- Risk historical data
INSERT OR IGNORE INTO risk_snapshots (id, organization_id, snapshot_date, total_risks, open_risks, critical_risks, high_risks, medium_risks, low_risks, total_exposure, avg_risk_score) VALUES
('rsnap-001', 'org-001', date('now', '-6 months'), 25, 22, 5, 8, 7, 2, 45000000, 68),
('rsnap-002', 'org-001', date('now', '-5 months'), 23, 19, 4, 7, 6, 2, 38000000, 62),
('rsnap-003', 'org-001', date('now', '-4 months'), 20, 16, 3, 6, 5, 2, 32000000, 55),
('rsnap-004', 'org-001', date('now', '-3 months'), 18, 14, 3, 5, 4, 2, 28000000, 50),
('rsnap-005', 'org-001', date('now', '-2 months'), 15, 11, 2, 4, 4, 1, 22000000, 45),
('rsnap-006', 'org-001', date('now', '-1 months'), 14, 10, 2, 4, 3, 1, 18000000, 42),
('rsnap-007', 'org-001', date('now'), 13, 9, 2, 3, 3, 1, 15000000, 40);
