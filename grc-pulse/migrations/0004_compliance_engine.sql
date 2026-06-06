-- ============================================================================
-- COMPLIANCE ENGINE - UNIFIED FRAMEWORK
-- Migration: 0004_compliance_engine.sql
-- Description: Creates the foundation for multi-framework compliance management
--              using ISO 27001:2022 as the core library with mappings to
--              NIST CSF, PCI-DSS, SOC2, and GDPR
-- ============================================================================

-- ============================================================================
-- PART 1: FRAMEWORK & CONTROL LIBRARY TABLES
-- ============================================================================

-- Compliance Frameworks Master Table
CREATE TABLE IF NOT EXISTS compliance_frameworks_v2 (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,           -- ISO27001, NIST_CSF, PCI_DSS, SOC2, GDPR
  name TEXT NOT NULL,
  version TEXT,                         -- 2022, 2.0, 4.0, etc.
  description TEXT,
  authority TEXT,                       -- ISO, NIST, PCI Council, AICPA, EU
  total_controls INTEGER DEFAULT 0,
  is_core_framework INTEGER DEFAULT 0,  -- 1 for ISO 27001 (our foundation)
  is_active INTEGER DEFAULT 1,
  icon TEXT,                            -- Font Awesome icon class
  color TEXT,                           -- Hex color for UI
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Control Library - All controls from all frameworks
CREATE TABLE IF NOT EXISTS control_library (
  id TEXT PRIMARY KEY,
  framework_id TEXT NOT NULL,
  control_id TEXT NOT NULL,             -- e.g., A.5.1, PR.AT-1, 12.6.1
  control_number TEXT,                  -- Numeric sort key
  title TEXT NOT NULL,
  description TEXT,
  guidance TEXT,                        -- Implementation guidance
  category TEXT,                        -- Domain/Category
  subcategory TEXT,                     -- Sub-domain
  control_type TEXT,                    -- preventive, detective, corrective
  is_critical INTEGER DEFAULT 0,        -- High priority control
  weight REAL DEFAULT 1.0,              -- For weighted scoring
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (framework_id) REFERENCES compliance_frameworks_v2(id),
  UNIQUE(framework_id, control_id)
);

-- ISO 27001:2022 Specific - 4 Themes (Annex A structure)
-- Theme: Organizational (5), People (6), Physical (7), Technological (8)
CREATE TABLE IF NOT EXISTS iso27001_themes (
  id TEXT PRIMARY KEY,
  theme_number INTEGER NOT NULL,        -- 5, 6, 7, 8
  name TEXT NOT NULL,                   -- Organizational, People, Physical, Technological
  description TEXT,
  control_count INTEGER DEFAULT 0,
  icon TEXT,
  color TEXT
);

-- ============================================================================
-- PART 2: CONTROL MAPPING ENGINE
-- ============================================================================

-- Cross-Framework Control Mappings
CREATE TABLE IF NOT EXISTS control_mappings (
  id TEXT PRIMARY KEY,
  source_framework_id TEXT NOT NULL,    -- Usually ISO27001
  source_control_id TEXT NOT NULL,
  target_framework_id TEXT NOT NULL,
  target_control_id TEXT NOT NULL,
  mapping_type TEXT DEFAULT 'equivalent', -- equivalent, partial, related
  mapping_strength REAL DEFAULT 1.0,    -- 1.0 = full, 0.5 = partial
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_framework_id) REFERENCES compliance_frameworks_v2(id),
  FOREIGN KEY (target_framework_id) REFERENCES compliance_frameworks_v2(id),
  UNIQUE(source_framework_id, source_control_id, target_framework_id, target_control_id)
);

-- ============================================================================
-- PART 3: ORGANIZATION COMPLIANCE ASSESSMENT
-- ============================================================================

-- Organization Framework Applicability (which frameworks apply to this org)
CREATE TABLE IF NOT EXISTS org_framework_applicability (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  framework_id TEXT NOT NULL,
  is_applicable INTEGER DEFAULT 1,      -- 1 = Yes, 0 = No/N/A
  applicability_reason TEXT,            -- Why applicable or not
  target_compliance_date DATE,
  certification_status TEXT,            -- none, in_progress, certified, expired
  certification_date DATE,
  certification_expiry DATE,
  auditor TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (framework_id) REFERENCES compliance_frameworks_v2(id),
  UNIQUE(organization_id, framework_id)
);

-- Control Assessments - The actual gap assessment data
CREATE TABLE IF NOT EXISTS control_assessments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  control_library_id TEXT NOT NULL,     -- Reference to control_library
  
  -- Assessment Status
  implementation_status TEXT DEFAULT 'not_started',  
  -- not_started, not_applicable, planned, in_progress, implemented, needs_improvement
  
  -- Maturity Level (1-5 CMM style)
  maturity_level INTEGER DEFAULT 0,     -- 0=Not Assessed, 1=Initial, 2=Managed, 3=Defined, 4=Measured, 5=Optimized
  
  -- Assessment Details
  assessment_date DATE,
  assessor_id TEXT,
  evidence_description TEXT,
  evidence_urls TEXT DEFAULT '[]',      -- JSON array of evidence links
  gaps_identified TEXT,
  remediation_plan TEXT,
  remediation_due_date DATE,
  remediation_owner_id TEXT,
  
  -- Risk Linkage
  linked_risk_ids TEXT DEFAULT '[]',    -- JSON array of risk IDs
  
  -- Audit Trail
  last_audit_date DATE,
  last_audit_result TEXT,
  audit_findings TEXT,
  
  -- Metadata
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (control_library_id) REFERENCES control_library(id),
  FOREIGN KEY (assessor_id) REFERENCES users(id),
  FOREIGN KEY (remediation_owner_id) REFERENCES users(id),
  UNIQUE(organization_id, control_library_id)
);

-- ============================================================================
-- PART 4: COMPLIANCE SCORING & DASHBOARD
-- ============================================================================

-- Compliance Scores (calculated/cached)
CREATE TABLE IF NOT EXISTS compliance_scores (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  framework_id TEXT NOT NULL,
  
  -- Overall Scores
  compliance_score REAL DEFAULT 0,      -- 0-100 percentage
  maturity_score REAL DEFAULT 0,        -- Average maturity level
  
  -- Control Counts
  total_controls INTEGER DEFAULT 0,
  applicable_controls INTEGER DEFAULT 0,
  implemented_controls INTEGER DEFAULT 0,
  partial_controls INTEGER DEFAULT 0,
  not_implemented_controls INTEGER DEFAULT 0,
  not_applicable_controls INTEGER DEFAULT 0,
  
  -- Category Breakdown (JSON)
  category_scores TEXT DEFAULT '{}',    -- JSON: {"Organizational": 75, "Technical": 60}
  
  -- Trend Data
  previous_score REAL,
  score_change REAL,
  
  -- Metadata
  last_calculated DATETIME,
  calculation_method TEXT DEFAULT 'weighted', -- simple, weighted, maturity_adjusted
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (framework_id) REFERENCES compliance_frameworks_v2(id),
  UNIQUE(organization_id, framework_id)
);

-- Compliance History (for trending)
CREATE TABLE IF NOT EXISTS compliance_history (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  framework_id TEXT NOT NULL,
  score REAL NOT NULL,
  maturity_score REAL,
  snapshot_date DATE NOT NULL,
  snapshot_data TEXT,                   -- JSON snapshot of full assessment
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (framework_id) REFERENCES compliance_frameworks_v2(id)
);

-- ============================================================================
-- PART 5: INSERT COMPLIANCE FRAMEWORKS
-- ============================================================================

INSERT OR IGNORE INTO compliance_frameworks_v2 (id, code, name, version, description, authority, is_core_framework, icon, color) VALUES
  ('fw-iso27001', 'ISO27001', 'ISO/IEC 27001', '2022', 'Information Security Management System (ISMS) - International standard for managing information security', 'ISO/IEC', 1, 'fa-shield-alt', '#3b82f6'),
  ('fw-nist-csf', 'NIST_CSF', 'NIST Cybersecurity Framework', '2.0', 'Framework for improving critical infrastructure cybersecurity', 'NIST', 0, 'fa-flag-usa', '#10b981'),
  ('fw-pci-dss', 'PCI_DSS', 'PCI Data Security Standard', '4.0', 'Payment Card Industry Data Security Standard for protecting cardholder data', 'PCI SSC', 0, 'fa-credit-card', '#f59e0b'),
  ('fw-soc2', 'SOC2', 'SOC 2', 'Type II', 'Service Organization Control 2 - Trust Services Criteria', 'AICPA', 0, 'fa-check-circle', '#8b5cf6'),
  ('fw-gdpr', 'GDPR', 'General Data Protection Regulation', '2018', 'EU regulation on data protection and privacy', 'European Union', 0, 'fa-user-shield', '#ec4899');

-- ============================================================================
-- PART 6: INSERT ISO 27001:2022 THEMES
-- ============================================================================

INSERT OR IGNORE INTO iso27001_themes (id, theme_number, name, description, control_count, icon, color) VALUES
  ('theme-5', 5, 'Organizational Controls', 'Policies, procedures, roles, responsibilities, and governance controls', 37, 'fa-building', '#3b82f6'),
  ('theme-6', 6, 'People Controls', 'Human resource security, awareness, and training controls', 8, 'fa-users', '#10b981'),
  ('theme-7', 7, 'Physical Controls', 'Physical security, environmental controls, and equipment protection', 14, 'fa-door-closed', '#f59e0b'),
  ('theme-8', 8, 'Technological Controls', 'Technical security controls, access management, cryptography, and operations', 34, 'fa-microchip', '#8b5cf6');

-- ============================================================================
-- PART 7: INSERT ALL 93 ISO 27001:2022 CONTROLS
-- ============================================================================

-- THEME 5: ORGANIZATIONAL CONTROLS (37 controls)
INSERT OR IGNORE INTO control_library (id, framework_id, control_id, control_number, title, description, category, subcategory, control_type, is_critical, weight) VALUES
  -- 5.1 - 5.10
  ('iso-5.1', 'fw-iso27001', 'A.5.1', '5.01', 'Policies for information security', 'Information security policy and topic-specific policies shall be defined, approved by management, published, communicated to and acknowledged by relevant personnel and relevant interested parties, and reviewed at planned intervals and if significant changes occur.', 'Organizational', 'Governance', 'preventive', 1, 1.5),
  ('iso-5.2', 'fw-iso27001', 'A.5.2', '5.02', 'Information security roles and responsibilities', 'Information security roles and responsibilities shall be defined and allocated according to the organization needs.', 'Organizational', 'Governance', 'preventive', 1, 1.3),
  ('iso-5.3', 'fw-iso27001', 'A.5.3', '5.03', 'Segregation of duties', 'Conflicting duties and conflicting areas of responsibility shall be segregated.', 'Organizational', 'Governance', 'preventive', 1, 1.2),
  ('iso-5.4', 'fw-iso27001', 'A.5.4', '5.04', 'Management responsibilities', 'Management shall require all personnel to apply information security in accordance with the established information security policy, topic-specific policies and procedures of the organization.', 'Organizational', 'Governance', 'preventive', 1, 1.3),
  ('iso-5.5', 'fw-iso27001', 'A.5.5', '5.05', 'Contact with authorities', 'The organization shall establish and maintain contact with relevant authorities.', 'Organizational', 'External', 'preventive', 0, 1.0),
  ('iso-5.6', 'fw-iso27001', 'A.5.6', '5.06', 'Contact with special interest groups', 'The organization shall establish and maintain contact with special interest groups or other specialist security forums and professional associations.', 'Organizational', 'External', 'preventive', 0, 0.8),
  ('iso-5.7', 'fw-iso27001', 'A.5.7', '5.07', 'Threat intelligence', 'Information relating to information security threats shall be collected and analysed to produce threat intelligence.', 'Organizational', 'Threat Management', 'detective', 1, 1.4),
  ('iso-5.8', 'fw-iso27001', 'A.5.8', '5.08', 'Information security in project management', 'Information security shall be integrated into project management.', 'Organizational', 'Project Management', 'preventive', 0, 1.0),
  ('iso-5.9', 'fw-iso27001', 'A.5.9', '5.09', 'Inventory of information and other associated assets', 'An inventory of information and other associated assets, including owners, shall be developed and maintained.', 'Organizational', 'Asset Management', 'preventive', 1, 1.3),
  ('iso-5.10', 'fw-iso27001', 'A.5.10', '5.10', 'Acceptable use of information and other associated assets', 'Rules for the acceptable use and procedures for handling information and other associated assets shall be identified, documented and implemented.', 'Organizational', 'Asset Management', 'preventive', 1, 1.2),
  
  -- 5.11 - 5.20
  ('iso-5.11', 'fw-iso27001', 'A.5.11', '5.11', 'Return of assets', 'Personnel and other interested parties as appropriate shall return all the organization''s assets in their possession upon change or termination of their employment, contract or agreement.', 'Organizational', 'Asset Management', 'preventive', 0, 1.0),
  ('iso-5.12', 'fw-iso27001', 'A.5.12', '5.12', 'Classification of information', 'Information shall be classified according to the information security needs of the organization based on confidentiality, integrity, availability and relevant interested party requirements.', 'Organizational', 'Information Classification', 'preventive', 1, 1.4),
  ('iso-5.13', 'fw-iso27001', 'A.5.13', '5.13', 'Labelling of information', 'An appropriate set of procedures for information labelling shall be developed and implemented in accordance with the information classification scheme adopted by the organization.', 'Organizational', 'Information Classification', 'preventive', 0, 1.0),
  ('iso-5.14', 'fw-iso27001', 'A.5.14', '5.14', 'Information transfer', 'Information transfer rules, procedures, or agreements shall be in place for all types of transfer facilities within the organization and between the organization and other parties.', 'Organizational', 'Information Transfer', 'preventive', 1, 1.3),
  ('iso-5.15', 'fw-iso27001', 'A.5.15', '5.15', 'Access control', 'Rules to control physical and logical access to information and other associated assets shall be established and implemented based on business and information security requirements.', 'Organizational', 'Access Control', 'preventive', 1, 1.5),
  ('iso-5.16', 'fw-iso27001', 'A.5.16', '5.16', 'Identity management', 'The full life cycle of identities shall be managed.', 'Organizational', 'Access Control', 'preventive', 1, 1.4),
  ('iso-5.17', 'fw-iso27001', 'A.5.17', '5.17', 'Authentication information', 'Allocation and management of authentication information shall be controlled by a management process, including advising personnel on appropriate handling of authentication information.', 'Organizational', 'Access Control', 'preventive', 1, 1.4),
  ('iso-5.18', 'fw-iso27001', 'A.5.18', '5.18', 'Access rights', 'Access rights to information and other associated assets shall be provisioned, reviewed, modified and removed in accordance with the organization''s topic-specific policy on and rules for access control.', 'Organizational', 'Access Control', 'preventive', 1, 1.4),
  ('iso-5.19', 'fw-iso27001', 'A.5.19', '5.19', 'Information security in supplier relationships', 'Processes and procedures shall be defined and implemented to manage the information security risks associated with the use of supplier''s products or services.', 'Organizational', 'Supplier Management', 'preventive', 1, 1.3),
  ('iso-5.20', 'fw-iso27001', 'A.5.20', '5.20', 'Addressing information security within supplier agreements', 'Relevant information security requirements shall be established and agreed with each supplier based on the type of supplier relationship.', 'Organizational', 'Supplier Management', 'preventive', 1, 1.3),
  
  -- 5.21 - 5.30
  ('iso-5.21', 'fw-iso27001', 'A.5.21', '5.21', 'Managing information security in the ICT supply chain', 'Processes and procedures shall be defined and implemented to manage the information security risks associated with the ICT products and services supply chain.', 'Organizational', 'Supplier Management', 'preventive', 1, 1.3),
  ('iso-5.22', 'fw-iso27001', 'A.5.22', '5.22', 'Monitoring, review and change management of supplier services', 'The organization shall regularly monitor, review, evaluate and manage change in supplier information security practices and service delivery.', 'Organizational', 'Supplier Management', 'detective', 1, 1.2),
  ('iso-5.23', 'fw-iso27001', 'A.5.23', '5.23', 'Information security for use of cloud services', 'Processes for acquisition, use, management and exit from cloud services shall be established in accordance with the organization''s information security requirements.', 'Organizational', 'Cloud Security', 'preventive', 1, 1.4),
  ('iso-5.24', 'fw-iso27001', 'A.5.24', '5.24', 'Information security incident management planning and preparation', 'The organization shall plan and prepare for managing information security incidents by defining, establishing and communicating information security incident management processes, roles and responsibilities.', 'Organizational', 'Incident Management', 'preventive', 1, 1.5),
  ('iso-5.25', 'fw-iso27001', 'A.5.25', '5.25', 'Assessment and decision on information security events', 'The organization shall assess information security events and decide if they are to be categorized as information security incidents.', 'Organizational', 'Incident Management', 'detective', 1, 1.3),
  ('iso-5.26', 'fw-iso27001', 'A.5.26', '5.26', 'Response to information security incidents', 'Information security incidents shall be responded to in accordance with the documented procedures.', 'Organizational', 'Incident Management', 'corrective', 1, 1.5),
  ('iso-5.27', 'fw-iso27001', 'A.5.27', '5.27', 'Learning from information security incidents', 'Knowledge gained from information security incidents shall be used to strengthen and improve the information security controls.', 'Organizational', 'Incident Management', 'corrective', 1, 1.2),
  ('iso-5.28', 'fw-iso27001', 'A.5.28', '5.28', 'Collection of evidence', 'The organization shall establish and implement procedures for the identification, collection, acquisition and preservation of evidence related to information security events.', 'Organizational', 'Incident Management', 'detective', 1, 1.3),
  ('iso-5.29', 'fw-iso27001', 'A.5.29', '5.29', 'Information security during disruption', 'The organization shall plan how to maintain information security at an appropriate level during disruption.', 'Organizational', 'Business Continuity', 'preventive', 1, 1.4),
  ('iso-5.30', 'fw-iso27001', 'A.5.30', '5.30', 'ICT readiness for business continuity', 'ICT readiness shall be planned, implemented, maintained and tested based on business continuity objectives and ICT continuity requirements.', 'Organizational', 'Business Continuity', 'preventive', 1, 1.4),
  
  -- 5.31 - 5.37
  ('iso-5.31', 'fw-iso27001', 'A.5.31', '5.31', 'Legal, statutory, regulatory and contractual requirements', 'Legal, statutory, regulatory and contractual requirements relevant to information security and the organization''s approach to meet these requirements shall be identified, documented and kept up to date.', 'Organizational', 'Compliance', 'preventive', 1, 1.4),
  ('iso-5.32', 'fw-iso27001', 'A.5.32', '5.32', 'Intellectual property rights', 'The organization shall implement appropriate procedures to protect intellectual property rights.', 'Organizational', 'Compliance', 'preventive', 0, 1.0),
  ('iso-5.33', 'fw-iso27001', 'A.5.33', '5.33', 'Protection of records', 'Records shall be protected from loss, destruction, falsification, unauthorized access and unauthorized release.', 'Organizational', 'Compliance', 'preventive', 1, 1.3),
  ('iso-5.34', 'fw-iso27001', 'A.5.34', '5.34', 'Privacy and protection of PII', 'The organization shall identify and meet the requirements regarding the preservation of privacy and protection of PII according to applicable laws and regulations and contractual requirements.', 'Organizational', 'Privacy', 'preventive', 1, 1.5),
  ('iso-5.35', 'fw-iso27001', 'A.5.35', '5.35', 'Independent review of information security', 'The organization''s approach to managing information security and its implementation including people, processes and technologies shall be reviewed independently at planned intervals, or when significant changes occur.', 'Organizational', 'Audit', 'detective', 1, 1.3),
  ('iso-5.36', 'fw-iso27001', 'A.5.36', '5.36', 'Compliance with policies, rules and standards for information security', 'Compliance with the organization''s information security policy, topic-specific policies, rules and standards shall be regularly reviewed.', 'Organizational', 'Audit', 'detective', 1, 1.3),
  ('iso-5.37', 'fw-iso27001', 'A.5.37', '5.37', 'Documented operating procedures', 'Operating procedures for information processing facilities shall be documented and made available to personnel who need them.', 'Organizational', 'Operations', 'preventive', 1, 1.2);

-- THEME 6: PEOPLE CONTROLS (8 controls)
INSERT OR IGNORE INTO control_library (id, framework_id, control_id, control_number, title, description, category, subcategory, control_type, is_critical, weight) VALUES
  ('iso-6.1', 'fw-iso27001', 'A.6.1', '6.01', 'Screening', 'Background verification checks on all candidates to become personnel shall be carried out prior to joining the organization and on an ongoing basis taking into consideration applicable laws, regulations and ethics and be proportional to the business requirements, the classification of the information to be accessed and the perceived risks.', 'People', 'Pre-employment', 'preventive', 1, 1.3),
  ('iso-6.2', 'fw-iso27001', 'A.6.2', '6.02', 'Terms and conditions of employment', 'The employment contractual agreements shall state the personnel''s and the organization''s responsibilities for information security.', 'People', 'Pre-employment', 'preventive', 1, 1.2),
  ('iso-6.3', 'fw-iso27001', 'A.6.3', '6.03', 'Information security awareness, education and training', 'Personnel of the organization and relevant interested parties shall receive appropriate information security awareness, education and training and regular updates of the organization''s information security policy, topic-specific policies and procedures, as relevant for their job function.', 'People', 'Awareness', 'preventive', 1, 1.5),
  ('iso-6.4', 'fw-iso27001', 'A.6.4', '6.04', 'Disciplinary process', 'A disciplinary process shall be formalized and communicated to take actions against personnel and other relevant interested parties who have committed an information security policy violation.', 'People', 'HR Process', 'corrective', 1, 1.2),
  ('iso-6.5', 'fw-iso27001', 'A.6.5', '6.05', 'Responsibilities after termination or change of employment', 'Information security responsibilities and duties that remain valid after termination or change of employment shall be defined, enforced and communicated to relevant personnel and other interested parties.', 'People', 'Termination', 'preventive', 1, 1.2),
  ('iso-6.6', 'fw-iso27001', 'A.6.6', '6.06', 'Confidentiality or non-disclosure agreements', 'Confidentiality or non-disclosure agreements reflecting the organization''s needs for the protection of information shall be identified, documented, regularly reviewed and signed by personnel and other relevant interested parties.', 'People', 'Agreements', 'preventive', 1, 1.3),
  ('iso-6.7', 'fw-iso27001', 'A.6.7', '6.07', 'Remote working', 'Security measures shall be implemented when personnel are working remotely to protect information accessed, processed or stored outside the organization''s premises.', 'People', 'Remote Work', 'preventive', 1, 1.4),
  ('iso-6.8', 'fw-iso27001', 'A.6.8', '6.08', 'Information security event reporting', 'The organization shall provide a mechanism for personnel to report observed or suspected information security events through appropriate channels in a timely manner.', 'People', 'Reporting', 'detective', 1, 1.4);

-- THEME 7: PHYSICAL CONTROLS (14 controls)
INSERT OR IGNORE INTO control_library (id, framework_id, control_id, control_number, title, description, category, subcategory, control_type, is_critical, weight) VALUES
  ('iso-7.1', 'fw-iso27001', 'A.7.1', '7.01', 'Physical security perimeters', 'Security perimeters shall be defined and used to protect areas that contain information and other associated assets.', 'Physical', 'Perimeter', 'preventive', 1, 1.3),
  ('iso-7.2', 'fw-iso27001', 'A.7.2', '7.02', 'Physical entry', 'Secure areas shall be protected by appropriate entry controls and access points.', 'Physical', 'Access Control', 'preventive', 1, 1.4),
  ('iso-7.3', 'fw-iso27001', 'A.7.3', '7.03', 'Securing offices, rooms and facilities', 'Physical security for offices, rooms and facilities shall be designed and implemented.', 'Physical', 'Facilities', 'preventive', 1, 1.2),
  ('iso-7.4', 'fw-iso27001', 'A.7.4', '7.04', 'Physical security monitoring', 'Premises shall be continuously monitored for unauthorized physical access.', 'Physical', 'Monitoring', 'detective', 1, 1.3),
  ('iso-7.5', 'fw-iso27001', 'A.7.5', '7.05', 'Protecting against physical and environmental threats', 'Protection against physical and environmental threats, such as natural disasters and other intentional or unintentional physical threats to infrastructure shall be designed and implemented.', 'Physical', 'Environmental', 'preventive', 1, 1.3),
  ('iso-7.6', 'fw-iso27001', 'A.7.6', '7.06', 'Working in secure areas', 'Security measures for working in secure areas shall be designed and implemented.', 'Physical', 'Secure Areas', 'preventive', 0, 1.0),
  ('iso-7.7', 'fw-iso27001', 'A.7.7', '7.07', 'Clear desk and clear screen', 'Clear desk rules for papers and removable storage media and clear screen rules for information processing facilities shall be defined and appropriately enforced.', 'Physical', 'Workspace', 'preventive', 0, 1.0),
  ('iso-7.8', 'fw-iso27001', 'A.7.8', '7.08', 'Equipment siting and protection', 'Equipment shall be sited securely and protected.', 'Physical', 'Equipment', 'preventive', 1, 1.2),
  ('iso-7.9', 'fw-iso27001', 'A.7.9', '7.09', 'Security of assets off-premises', 'Off-site assets shall be protected.', 'Physical', 'Equipment', 'preventive', 1, 1.2),
  ('iso-7.10', 'fw-iso27001', 'A.7.10', '7.10', 'Storage media', 'Storage media shall be managed through their life cycle of acquisition, use, transportation and disposal in accordance with the organization''s classification scheme and handling requirements.', 'Physical', 'Media', 'preventive', 1, 1.3),
  ('iso-7.11', 'fw-iso27001', 'A.7.11', '7.11', 'Supporting utilities', 'Information processing facilities shall be protected from power failures and other disruptions caused by failures in supporting utilities.', 'Physical', 'Utilities', 'preventive', 1, 1.3),
  ('iso-7.12', 'fw-iso27001', 'A.7.12', '7.12', 'Cabling security', 'Cables carrying power, data or supporting information services shall be protected from interception, interference or damage.', 'Physical', 'Infrastructure', 'preventive', 0, 1.0),
  ('iso-7.13', 'fw-iso27001', 'A.7.13', '7.13', 'Equipment maintenance', 'Equipment shall be maintained correctly to ensure availability, integrity and confidentiality of information.', 'Physical', 'Maintenance', 'preventive', 1, 1.2),
  ('iso-7.14', 'fw-iso27001', 'A.7.14', '7.14', 'Secure disposal or re-use of equipment', 'Items of equipment containing storage media shall be verified to ensure that any sensitive data and licensed software has been removed or securely overwritten prior to disposal or re-use.', 'Physical', 'Disposal', 'preventive', 1, 1.3);

-- THEME 8: TECHNOLOGICAL CONTROLS (34 controls)
INSERT OR IGNORE INTO control_library (id, framework_id, control_id, control_number, title, description, category, subcategory, control_type, is_critical, weight) VALUES
  ('iso-8.1', 'fw-iso27001', 'A.8.1', '8.01', 'User endpoint devices', 'Information stored on, processed by or accessible via user endpoint devices shall be protected.', 'Technological', 'Endpoint Security', 'preventive', 1, 1.4),
  ('iso-8.2', 'fw-iso27001', 'A.8.2', '8.02', 'Privileged access rights', 'The allocation and use of privileged access rights shall be restricted and managed.', 'Technological', 'Access Control', 'preventive', 1, 1.5),
  ('iso-8.3', 'fw-iso27001', 'A.8.3', '8.03', 'Information access restriction', 'Access to information and other associated assets shall be restricted in accordance with the established topic-specific policy on access control.', 'Technological', 'Access Control', 'preventive', 1, 1.4),
  ('iso-8.4', 'fw-iso27001', 'A.8.4', '8.04', 'Access to source code', 'Read and write access to source code, development tools and software libraries shall be appropriately managed.', 'Technological', 'Development', 'preventive', 1, 1.3),
  ('iso-8.5', 'fw-iso27001', 'A.8.5', '8.05', 'Secure authentication', 'Secure authentication technologies and procedures shall be implemented based on information access restrictions and the topic-specific policy on access control.', 'Technological', 'Authentication', 'preventive', 1, 1.5),
  ('iso-8.6', 'fw-iso27001', 'A.8.6', '8.06', 'Capacity management', 'The use of resources shall be monitored and adjusted in line with current and expected capacity requirements.', 'Technological', 'Operations', 'preventive', 0, 1.0),
  ('iso-8.7', 'fw-iso27001', 'A.8.7', '8.07', 'Protection against malware', 'Protection against malware shall be implemented and supported by appropriate user awareness.', 'Technological', 'Malware Protection', 'preventive', 1, 1.5),
  ('iso-8.8', 'fw-iso27001', 'A.8.8', '8.08', 'Management of technical vulnerabilities', 'Information about technical vulnerabilities of information systems in use shall be obtained, the organization''s exposure to such vulnerabilities shall be evaluated and appropriate measures shall be taken.', 'Technological', 'Vulnerability Management', 'preventive', 1, 1.5),
  ('iso-8.9', 'fw-iso27001', 'A.8.9', '8.09', 'Configuration management', 'Configurations, including security configurations, of hardware, software, services and networks shall be established, documented, implemented, monitored and reviewed.', 'Technological', 'Configuration', 'preventive', 1, 1.4),
  ('iso-8.10', 'fw-iso27001', 'A.8.10', '8.10', 'Information deletion', 'Information stored in information systems, devices or in any other storage media shall be deleted when no longer required.', 'Technological', 'Data Management', 'preventive', 1, 1.3),
  ('iso-8.11', 'fw-iso27001', 'A.8.11', '8.11', 'Data masking', 'Data masking shall be used in accordance with the organization''s topic-specific policy on access control and other related topic-specific policies, and business requirements, taking applicable legislation into consideration.', 'Technological', 'Data Protection', 'preventive', 1, 1.3),
  ('iso-8.12', 'fw-iso27001', 'A.8.12', '8.12', 'Data leakage prevention', 'Data leakage prevention measures shall be applied to systems, networks and any other devices that process, store or transmit sensitive information.', 'Technological', 'Data Protection', 'preventive', 1, 1.4),
  ('iso-8.13', 'fw-iso27001', 'A.8.13', '8.13', 'Information backup', 'Backup copies of information, software and systems shall be maintained and regularly tested in accordance with the agreed topic-specific policy on backup.', 'Technological', 'Backup', 'preventive', 1, 1.5),
  ('iso-8.14', 'fw-iso27001', 'A.8.14', '8.14', 'Redundancy of information processing facilities', 'Information processing facilities shall be implemented with redundancy sufficient to meet availability requirements.', 'Technological', 'Availability', 'preventive', 1, 1.3),
  ('iso-8.15', 'fw-iso27001', 'A.8.15', '8.15', 'Logging', 'Logs that record activities, exceptions, faults and other relevant events shall be produced, stored, protected and analysed.', 'Technological', 'Logging & Monitoring', 'detective', 1, 1.5),
  ('iso-8.16', 'fw-iso27001', 'A.8.16', '8.16', 'Monitoring activities', 'Networks, systems and applications shall be monitored for anomalous behaviour and appropriate actions taken to evaluate potential information security incidents.', 'Technological', 'Logging & Monitoring', 'detective', 1, 1.5),
  ('iso-8.17', 'fw-iso27001', 'A.8.17', '8.17', 'Clock synchronization', 'The clocks of information processing systems used by the organization shall be synchronized to approved time sources.', 'Technological', 'Operations', 'preventive', 0, 0.8),
  ('iso-8.18', 'fw-iso27001', 'A.8.18', '8.18', 'Use of privileged utility programs', 'The use of utility programs that can be capable of overriding system and application controls shall be restricted and tightly controlled.', 'Technological', 'Access Control', 'preventive', 1, 1.2),
  ('iso-8.19', 'fw-iso27001', 'A.8.19', '8.19', 'Installation of software on operational systems', 'Procedures and measures shall be implemented to securely manage software installation on operational systems.', 'Technological', 'Change Management', 'preventive', 1, 1.3),
  ('iso-8.20', 'fw-iso27001', 'A.8.20', '8.20', 'Networks security', 'Networks and network devices shall be secured, managed and controlled to protect information in systems and applications.', 'Technological', 'Network Security', 'preventive', 1, 1.5),
  ('iso-8.21', 'fw-iso27001', 'A.8.21', '8.21', 'Security of network services', 'Security mechanisms, service levels and service requirements of network services shall be identified, implemented and monitored.', 'Technological', 'Network Security', 'preventive', 1, 1.3),
  ('iso-8.22', 'fw-iso27001', 'A.8.22', '8.22', 'Segregation of networks', 'Groups of information services, users and information systems shall be segregated in the organization''s networks.', 'Technological', 'Network Security', 'preventive', 1, 1.4),
  ('iso-8.23', 'fw-iso27001', 'A.8.23', '8.23', 'Web filtering', 'Access to external websites shall be managed to reduce exposure to malicious content.', 'Technological', 'Network Security', 'preventive', 1, 1.2),
  ('iso-8.24', 'fw-iso27001', 'A.8.24', '8.24', 'Use of cryptography', 'Rules for the effective use of cryptography, including cryptographic key management, shall be defined and implemented.', 'Technological', 'Cryptography', 'preventive', 1, 1.5),
  ('iso-8.25', 'fw-iso27001', 'A.8.25', '8.25', 'Secure development life cycle', 'Rules for the secure development of software and systems shall be established and applied.', 'Technological', 'Development', 'preventive', 1, 1.4),
  ('iso-8.26', 'fw-iso27001', 'A.8.26', '8.26', 'Application security requirements', 'Information security requirements shall be identified, specified and approved when developing or acquiring applications.', 'Technological', 'Development', 'preventive', 1, 1.4),
  ('iso-8.27', 'fw-iso27001', 'A.8.27', '8.27', 'Secure system architecture and engineering principles', 'Principles for engineering secure systems shall be established, documented, maintained and applied to any information system development activities.', 'Technological', 'Development', 'preventive', 1, 1.4),
  ('iso-8.28', 'fw-iso27001', 'A.8.28', '8.28', 'Secure coding', 'Secure coding principles shall be applied to software development.', 'Technological', 'Development', 'preventive', 1, 1.4),
  ('iso-8.29', 'fw-iso27001', 'A.8.29', '8.29', 'Security testing in development and acceptance', 'Security testing processes shall be defined and implemented in the development life cycle.', 'Technological', 'Development', 'detective', 1, 1.4),
  ('iso-8.30', 'fw-iso27001', 'A.8.30', '8.30', 'Outsourced development', 'The organization shall direct, monitor and review the activities related to outsourced system development.', 'Technological', 'Development', 'preventive', 1, 1.2),
  ('iso-8.31', 'fw-iso27001', 'A.8.31', '8.31', 'Separation of development, test and production environments', 'Development, testing and production environments shall be separated and secured.', 'Technological', 'Development', 'preventive', 1, 1.3),
  ('iso-8.32', 'fw-iso27001', 'A.8.32', '8.32', 'Change management', 'Changes to information processing facilities and information systems shall be subject to change management procedures.', 'Technological', 'Change Management', 'preventive', 1, 1.4),
  ('iso-8.33', 'fw-iso27001', 'A.8.33', '8.33', 'Test information', 'Test information shall be appropriately selected, protected and managed.', 'Technological', 'Development', 'preventive', 0, 1.0),
  ('iso-8.34', 'fw-iso27001', 'A.8.34', '8.34', 'Protection of information systems during audit testing', 'Audit tests and other assurance activities involving assessment of operational systems shall be planned and agreed between the tester and appropriate management.', 'Technological', 'Audit', 'preventive', 0, 1.0);

-- Update total control counts for frameworks
UPDATE compliance_frameworks_v2 SET total_controls = 93 WHERE id = 'fw-iso27001';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_control_library_framework ON control_library(framework_id);
CREATE INDEX IF NOT EXISTS idx_control_library_category ON control_library(category);
CREATE INDEX IF NOT EXISTS idx_control_assessments_org ON control_assessments(organization_id);
CREATE INDEX IF NOT EXISTS idx_control_assessments_control ON control_assessments(control_library_id);
CREATE INDEX IF NOT EXISTS idx_control_assessments_status ON control_assessments(implementation_status);
CREATE INDEX IF NOT EXISTS idx_control_mappings_source ON control_mappings(source_framework_id, source_control_id);
CREATE INDEX IF NOT EXISTS idx_control_mappings_target ON control_mappings(target_framework_id, target_control_id);
CREATE INDEX IF NOT EXISTS idx_compliance_scores_org ON compliance_scores(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_applicability ON org_framework_applicability(organization_id);

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
