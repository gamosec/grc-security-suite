-- Migration: Control-Risk-Asset Linking
-- Phase 6: Connect controls to risks and assets for mitigation tracking

-- ============================================================================
-- CONTROL-RISK MAPPINGS
-- Links ISO 27001 controls to specific risks they mitigate
-- ============================================================================

CREATE TABLE IF NOT EXISTS control_risk_mappings (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  control_id TEXT NOT NULL,           -- References control_library.id (e.g., 'iso-8.7')
  risk_id TEXT NOT NULL,              -- References risk_items.id
  mapping_type TEXT DEFAULT 'mitigates', -- 'mitigates', 'detects', 'prevents', 'reduces'
  effectiveness TEXT DEFAULT 'partial', -- 'full', 'partial', 'minimal'
  confidence_score INTEGER DEFAULT 80,  -- 0-100, how confident we are in this mapping
  notes TEXT,
  is_auto_suggested INTEGER DEFAULT 0,  -- 1 if system suggested, 0 if manual
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  UNIQUE(organization_id, control_id, risk_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_crm_org_control ON control_risk_mappings(organization_id, control_id);
CREATE INDEX IF NOT EXISTS idx_crm_org_risk ON control_risk_mappings(organization_id, risk_id);
CREATE INDEX IF NOT EXISTS idx_crm_mapping_type ON control_risk_mappings(mapping_type);

-- ============================================================================
-- CONTROL-ASSET MAPPINGS
-- Links controls to assets they protect
-- ============================================================================

CREATE TABLE IF NOT EXISTS control_asset_mappings (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  control_id TEXT NOT NULL,           -- References control_library.id
  asset_id TEXT NOT NULL,             -- References assets.id
  protection_type TEXT DEFAULT 'protects', -- 'protects', 'monitors', 'controls_access'
  coverage TEXT DEFAULT 'partial',    -- 'full', 'partial', 'minimal'
  notes TEXT,
  is_auto_suggested INTEGER DEFAULT 0,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  UNIQUE(organization_id, control_id, asset_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_cam_org_control ON control_asset_mappings(organization_id, control_id);
CREATE INDEX IF NOT EXISTS idx_cam_org_asset ON control_asset_mappings(organization_id, asset_id);

-- ============================================================================
-- RISK-ASSET MAPPINGS
-- Links risks to assets they affect
-- ============================================================================

CREATE TABLE IF NOT EXISTS risk_asset_mappings (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  risk_id TEXT NOT NULL,              -- References risk_items.id
  asset_id TEXT NOT NULL,             -- References assets.id
  impact_type TEXT DEFAULT 'affects', -- 'affects', 'targets', 'exposes'
  impact_level TEXT DEFAULT 'medium', -- 'critical', 'high', 'medium', 'low'
  notes TEXT,
  is_auto_suggested INTEGER DEFAULT 0,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  UNIQUE(organization_id, risk_id, asset_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_ram_org_risk ON risk_asset_mappings(organization_id, risk_id);
CREATE INDEX IF NOT EXISTS idx_ram_org_asset ON risk_asset_mappings(organization_id, asset_id);

-- ============================================================================
-- CONTROL CATEGORIES TO RISK TYPES MAPPING
-- Suggested mappings between control categories and risk categories
-- Used for auto-suggestion feature
-- ============================================================================

CREATE TABLE IF NOT EXISTS control_risk_suggestions (
  id TEXT PRIMARY KEY,
  control_category TEXT NOT NULL,     -- ISO 27001 category (e.g., 'Technological', 'Organizational')
  control_subcategory TEXT,           -- More specific (e.g., 'Access Control', 'Cryptography')
  risk_category TEXT NOT NULL,        -- Risk category (e.g., 'vulnerability', 'configuration')
  risk_keywords TEXT,                 -- Comma-separated keywords to match in risk titles
  suggestion_weight INTEGER DEFAULT 50, -- 0-100, higher = stronger suggestion
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Pre-populate suggestion rules
INSERT OR IGNORE INTO control_risk_suggestions (id, control_category, control_subcategory, risk_category, risk_keywords, suggestion_weight) VALUES
-- Technological controls to vulnerability/injection risks
('sug-001', 'Technological', 'Application Security', 'vulnerability', 'SQL injection,XSS,injection,code injection', 95),
('sug-002', 'Technological', 'Access Control', 'configuration', 'MFA,authentication,password,access,unauthorized', 90),
('sug-003', 'Technological', 'Cryptography', 'compliance', 'encryption,unencrypted,PII,data exposure', 90),
('sug-004', 'Technological', 'Network Security', 'vulnerability', 'SSL,TLS,certificate,network,firewall', 85),
('sug-005', 'Technological', 'Vulnerability Management', 'vulnerability', 'CVE,vulnerability,patch,outdated,Log4j', 95),

-- Organizational controls
('sug-006', 'Organizational', 'Policies', 'compliance', 'policy,procedure,compliance,audit', 80),
('sug-007', 'Organizational', 'Asset Management', 'configuration', 'inventory,asset,configuration', 75),
('sug-008', 'Organizational', 'Incident Response', 'vulnerability', 'incident,breach,response,detection', 85),

-- People controls
('sug-009', 'People', 'Training', 'compliance', 'awareness,training,phishing,social engineering', 80),
('sug-010', 'People', 'Access', 'configuration', 'user access,privilege,role,permission', 85),

-- Physical controls
('sug-011', 'Physical', 'Physical Security', 'physical', 'physical,access,facility,premises', 75),
('sug-012', 'Physical', 'Environmental', 'physical', 'environmental,disaster,fire,flood', 70);

-- ============================================================================
-- SEED DATA: Initial control-risk mappings for demo
-- Maps existing risks to relevant ISO 27001 controls
-- ============================================================================

-- SQL Injection -> A.8.28 (Secure coding), A.8.29 (Security testing)
INSERT OR IGNORE INTO control_risk_mappings (id, organization_id, control_id, risk_id, mapping_type, effectiveness, confidence_score, is_auto_suggested) VALUES
('crm-001', 'org-001', 'iso-8.28', 'risk-pt-mjshl9q0-kcdq61yd4', 'mitigates', 'full', 95, 1),
('crm-002', 'org-001', 'iso-8.29', 'risk-pt-mjshl9q0-kcdq61yd4', 'detects', 'partial', 85, 1);

-- Missing MFA -> A.8.5 (Secure authentication)
INSERT OR IGNORE INTO control_risk_mappings (id, organization_id, control_id, risk_id, mapping_type, effectiveness, confidence_score, is_auto_suggested) VALUES
('crm-003', 'org-001', 'iso-8.5', 'risk-004', 'mitigates', 'full', 95, 1);

-- SSL Certificate issue -> A.8.24 (Use of cryptography)
INSERT OR IGNORE INTO control_risk_mappings (id, organization_id, control_id, risk_id, mapping_type, effectiveness, confidence_score, is_auto_suggested) VALUES
('crm-004', 'org-001', 'iso-8.24', 'risk-002', 'mitigates', 'full', 90, 1);

-- Unencrypted PII -> A.8.24 (Use of cryptography), A.5.34 (Privacy)
INSERT OR IGNORE INTO control_risk_mappings (id, organization_id, control_id, risk_id, mapping_type, effectiveness, confidence_score, is_auto_suggested) VALUES
('crm-005', 'org-001', 'iso-8.24', 'risk-003', 'mitigates', 'full', 95, 1),
('crm-006', 'org-001', 'iso-5.34', 'risk-003', 'reduces', 'partial', 80, 1);

-- Log4j Vulnerability -> A.8.8 (Technical vulnerability management)
INSERT OR IGNORE INTO control_risk_mappings (id, organization_id, control_id, risk_id, mapping_type, effectiveness, confidence_score, is_auto_suggested) VALUES
('crm-007', 'org-001', 'iso-8.8', 'risk-005', 'mitigates', 'full', 95, 1);
