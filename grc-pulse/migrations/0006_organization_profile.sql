-- =====================================================
-- PHASE 3: ORGANIZATION PROFILE & FRAMEWORK APPLICABILITY
-- Enables organizations to set their profile and auto-determine applicable frameworks
-- =====================================================

-- Organization Profile Table
CREATE TABLE IF NOT EXISTS organization_profile (
  organization_id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  industry TEXT NOT NULL DEFAULT 'technology',
  industry_sector TEXT,
  company_size TEXT DEFAULT 'medium',
  headquarters_region TEXT DEFAULT 'us',
  operating_regions TEXT DEFAULT '["us"]',
  
  -- Data Types Handled
  handles_card_data INTEGER DEFAULT 0,
  handles_health_data INTEGER DEFAULT 0,
  handles_personal_data INTEGER DEFAULT 1,
  handles_financial_data INTEGER DEFAULT 0,
  handles_government_data INTEGER DEFAULT 0,
  
  -- Certifications & Compliance Goals
  iso_certified INTEGER DEFAULT 0,
  soc2_certified INTEGER DEFAULT 0,
  pci_certified INTEGER DEFAULT 0,
  gdpr_compliant INTEGER DEFAULT 0,
  hipaa_compliant INTEGER DEFAULT 0,
  
  -- Risk Profile
  risk_appetite TEXT DEFAULT 'moderate',
  security_maturity_target INTEGER DEFAULT 3,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Framework Applicability Table
CREATE TABLE IF NOT EXISTS framework_applicability (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  framework_id TEXT NOT NULL,
  is_applicable INTEGER DEFAULT 1,
  applicability_reason TEXT,
  priority INTEGER DEFAULT 3,
  target_score INTEGER DEFAULT 80,
  target_date TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, framework_id)
);

-- Statement of Applicability (SoA) Table
CREATE TABLE IF NOT EXISTS soa_entries (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  control_library_id TEXT NOT NULL,
  is_applicable INTEGER DEFAULT 1,
  justification TEXT,
  exclusion_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, control_library_id)
);

-- Insert default organization profile
INSERT OR IGNORE INTO organization_profile (
  organization_id, company_name, industry, industry_sector, company_size,
  headquarters_region, operating_regions,
  handles_card_data, handles_health_data, handles_personal_data,
  handles_financial_data, handles_government_data,
  risk_appetite, security_maturity_target
) VALUES (
  'org-001', 'Acme Corporation', 'technology', 'SaaS', 'medium',
  'us', '["us", "eu"]',
  1, 0, 1,
  1, 0,
  'moderate', 4
);

-- Set default framework applicability for org-001
INSERT OR IGNORE INTO framework_applicability (id, organization_id, framework_id, is_applicable, applicability_reason, priority, target_score) VALUES
('fa-001', 'org-001', 'fw-iso27001', 1, 'Core information security framework - applicable to all organizations', 1, 85),
('fa-002', 'org-001', 'fw-nist-csf', 1, 'Best practice cybersecurity framework for US-based companies', 2, 75),
('fa-003', 'org-001', 'fw-pci-dss', 1, 'Required due to payment card processing', 2, 100),
('fa-004', 'org-001', 'fw-soc2', 1, 'Required for SaaS companies serving enterprise customers', 1, 90),
('fa-005', 'org-001', 'fw-gdpr', 1, 'Required due to EU operations and EU customer data', 2, 80);

-- Industry-Framework Mapping Reference Table
CREATE TABLE IF NOT EXISTS industry_framework_requirements (
  id TEXT PRIMARY KEY,
  industry TEXT NOT NULL,
  framework_id TEXT NOT NULL,
  is_typically_required INTEGER DEFAULT 0,
  is_recommended INTEGER DEFAULT 1,
  requirement_notes TEXT,
  UNIQUE(industry, framework_id)
);

-- Insert industry-framework mappings
INSERT OR IGNORE INTO industry_framework_requirements (id, industry, framework_id, is_typically_required, is_recommended, requirement_notes) VALUES
-- Healthcare
('ifr-hc-iso', 'healthcare', 'fw-iso27001', 1, 1, 'Recommended for healthcare organizations handling sensitive data'),
('ifr-hc-nist', 'healthcare', 'fw-nist-csf', 1, 1, 'Recommended by HHS for healthcare cybersecurity'),
('ifr-hc-soc2', 'healthcare', 'fw-soc2', 0, 1, 'Recommended for healthcare SaaS providers'),
('ifr-hc-gdpr', 'healthcare', 'fw-gdpr', 0, 1, 'Required if processing EU patient data'),

-- Finance
('ifr-fin-iso', 'finance', 'fw-iso27001', 1, 1, 'Often required by financial regulators'),
('ifr-fin-nist', 'finance', 'fw-nist-csf', 1, 1, 'FFIEC recommends NIST CSF alignment'),
('ifr-fin-pci', 'finance', 'fw-pci-dss', 1, 1, 'Required if processing card data'),
('ifr-fin-soc2', 'finance', 'fw-soc2', 1, 1, 'Common requirement for fintech'),
('ifr-fin-gdpr', 'finance', 'fw-gdpr', 0, 1, 'Required if serving EU customers'),

-- Retail / E-commerce
('ifr-ret-iso', 'retail', 'fw-iso27001', 0, 1, 'Recommended for enterprise retail'),
('ifr-ret-pci', 'retail', 'fw-pci-dss', 1, 1, 'Required for payment processing'),
('ifr-ret-soc2', 'retail', 'fw-soc2', 0, 1, 'Recommended for e-commerce platforms'),
('ifr-ret-gdpr', 'retail', 'fw-gdpr', 0, 1, 'Required if serving EU customers'),

-- Technology / SaaS
('ifr-tech-iso', 'technology', 'fw-iso27001', 0, 1, 'Increasingly required by enterprise customers'),
('ifr-tech-nist', 'technology', 'fw-nist-csf', 0, 1, 'US government contracts often require'),
('ifr-tech-soc2', 'technology', 'fw-soc2', 1, 1, 'Essential for B2B SaaS'),
('ifr-tech-gdpr', 'technology', 'fw-gdpr', 0, 1, 'Required if serving EU customers'),

-- Government / Public Sector
('ifr-gov-iso', 'government', 'fw-iso27001', 1, 1, 'Often required for government contractors'),
('ifr-gov-nist', 'government', 'fw-nist-csf', 1, 1, 'Required for federal contractors'),
('ifr-gov-soc2', 'government', 'fw-soc2', 0, 1, 'May be required for cloud services'),

-- Manufacturing
('ifr-mfg-iso', 'manufacturing', 'fw-iso27001', 0, 1, 'Recommended for supply chain security'),
('ifr-mfg-nist', 'manufacturing', 'fw-nist-csf', 0, 1, 'Recommended for critical infrastructure'),

-- Professional Services
('ifr-ps-iso', 'professional_services', 'fw-iso27001', 0, 1, 'Recommended for client data protection'),
('ifr-ps-soc2', 'professional_services', 'fw-soc2', 1, 1, 'Common requirement from enterprise clients'),
('ifr-ps-gdpr', 'professional_services', 'fw-gdpr', 0, 1, 'Required if handling EU personal data');

-- Data Type Framework Requirements
CREATE TABLE IF NOT EXISTS data_type_framework_requirements (
  id TEXT PRIMARY KEY,
  data_type TEXT NOT NULL,
  framework_id TEXT NOT NULL,
  is_required INTEGER DEFAULT 1,
  requirement_notes TEXT,
  UNIQUE(data_type, framework_id)
);

INSERT OR IGNORE INTO data_type_framework_requirements (id, data_type, framework_id, is_required, requirement_notes) VALUES
('dfr-card-pci', 'card_data', 'fw-pci-dss', 1, 'PCI DSS is mandatory for organizations processing, storing, or transmitting cardholder data'),
('dfr-personal-gdpr', 'personal_data_eu', 'fw-gdpr', 1, 'GDPR is mandatory for organizations processing EU personal data'),
('dfr-personal-soc2', 'personal_data', 'fw-soc2', 0, 'SOC 2 Privacy criteria recommended for personal data'),
('dfr-financial-soc2', 'financial_data', 'fw-soc2', 0, 'SOC 2 Security criteria recommended for financial data');

-- Region Framework Requirements  
CREATE TABLE IF NOT EXISTS region_framework_requirements (
  id TEXT PRIMARY KEY,
  region TEXT NOT NULL,
  framework_id TEXT NOT NULL,
  is_required INTEGER DEFAULT 0,
  is_recommended INTEGER DEFAULT 1,
  requirement_notes TEXT,
  UNIQUE(region, framework_id)
);

INSERT OR IGNORE INTO region_framework_requirements (id, region, framework_id, is_required, is_recommended, requirement_notes) VALUES
('rfr-eu-gdpr', 'eu', 'fw-gdpr', 1, 1, 'GDPR is mandatory for EU operations or EU customer data'),
('rfr-eu-iso', 'eu', 'fw-iso27001', 0, 1, 'ISO 27001 is widely recognized in the EU'),
('rfr-us-nist', 'us', 'fw-nist-csf', 0, 1, 'NIST CSF is the US government recommended framework'),
('rfr-us-soc2', 'us', 'fw-soc2', 0, 1, 'SOC 2 is common requirement for US B2B services'),
('rfr-global-iso', 'global', 'fw-iso27001', 0, 1, 'ISO 27001 is internationally recognized');
