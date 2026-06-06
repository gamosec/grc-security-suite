-- ============================================================================
-- SENTIENT GRC PLATFORM - POSTGRESQL DATABASE SCHEMA
-- Version: 1.0.0
-- Description: Complete relational database schema for enterprise GRC platform
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";  -- For AI embeddings (pgvector)

-- ============================================================================
-- SECTION 1: ORGANIZATIONS & MULTI-TENANCY
-- ============================================================================

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    industry VARCHAR(100),
    size VARCHAR(50) CHECK (size IN ('startup', 'smb', 'enterprise')),
    subscription_tier VARCHAR(50) DEFAULT 'starter' CHECK (subscription_tier IN ('starter', 'professional', 'enterprise')),
    settings JSONB DEFAULT '{}',
    logo_url TEXT,
    primary_contact_email VARCHAR(255),
    
    -- Compliance metadata
    compliance_frameworks TEXT[],  -- ['SOC2', 'ISO27001', 'GDPR']
    regulatory_requirements TEXT[],
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_active ON organizations(is_active) WHERE is_active = true;

-- Organization domains for SSO verification
CREATE TABLE organization_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL UNIQUE,
    is_verified BOOLEAN DEFAULT false,
    verification_token VARCHAR(255),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SECTION 2: USERS & AUTHENTICATION
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),  -- NULL for SSO-only users
    
    -- Profile
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    display_name VARCHAR(200),
    avatar_url TEXT,
    job_title VARCHAR(100),
    department VARCHAR(100),  -- 'IT', 'Security', 'Legal', 'Compliance', 'Executive'
    phone VARCHAR(50),
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Authentication
    auth_provider VARCHAR(50) DEFAULT 'local' CHECK (auth_provider IN ('local', 'okta', 'azure_ad', 'google')),
    auth_provider_id VARCHAR(255),
    mfa_enabled BOOLEAN DEFAULT false,
    mfa_secret VARCHAR(255),
    
    -- Status
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'pending')),
    email_verified BOOLEAN DEFAULT false,
    last_login_at TIMESTAMPTZ,
    failed_login_attempts INT DEFAULT 0,
    locked_until TIMESTAMPTZ,
    
    -- Preferences
    preferences JSONB DEFAULT '{}',
    notification_settings JSONB DEFAULT '{"email": true, "slack": false, "in_app": true}',
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    
    UNIQUE(organization_id, email)
);

CREATE INDEX idx_users_org ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_department ON users(organization_id, department);

-- Roles (system and custom)
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,  -- NULL for system roles
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system_role BOOLEAN DEFAULT false,
    level INT DEFAULT 0,  -- Hierarchy level for role inheritance
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(organization_id, name)
);

-- Insert default system roles
INSERT INTO roles (id, name, description, is_system_role, level) VALUES
    ('00000000-0000-0000-0000-000000000001', 'super_admin', 'Platform super administrator', true, 100),
    ('00000000-0000-0000-0000-000000000002', 'org_admin', 'Organization administrator', true, 90),
    ('00000000-0000-0000-0000-000000000003', 'security_lead', 'Security team lead', true, 70),
    ('00000000-0000-0000-0000-000000000004', 'analyst', 'Security analyst', true, 50),
    ('00000000-0000-0000-0000-000000000005', 'auditor', 'External auditor (read-only)', true, 30),
    ('00000000-0000-0000-0000-000000000006', 'vendor', 'Vendor portal access', true, 10);

-- Permissions
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource VARCHAR(100) NOT NULL,  -- 'assets', 'risks', 'vendors', 'reports'
    action VARCHAR(50) NOT NULL,     -- 'create', 'read', 'update', 'delete', 'export'
    description TEXT,
    UNIQUE(resource, action)
);

-- Role-Permission mapping
CREATE TABLE role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- User-Role mapping
CREATE TABLE user_roles (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES users(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,  -- Temporary role assignments
    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);

-- API Keys for service accounts
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,  -- SHA-256 hash
    key_prefix VARCHAR(10) NOT NULL,  -- First 8 chars for identification
    scopes TEXT[],
    rate_limit INT DEFAULT 1000,  -- Requests per hour
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_keys_org ON api_keys(organization_id);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);

-- ============================================================================
-- SECTION 3: ASSETS & INFRASTRUCTURE
-- ============================================================================

CREATE TYPE asset_type AS ENUM (
    'server', 'database', 'application', 'network_device', 
    'container', 'serverless', 'storage', 'endpoint', 'iot_device', 'other'
);

CREATE TYPE asset_cloud_provider AS ENUM (
    'aws', 'azure', 'gcp', 'oracle', 'on_premise', 'hybrid', 'other'
);

CREATE TYPE asset_criticality AS ENUM (
    'critical', 'high', 'medium', 'low', 'informational'
);

CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Identification
    external_id VARCHAR(255),  -- Cloud provider resource ID
    name VARCHAR(255) NOT NULL,
    description TEXT,
    asset_type asset_type NOT NULL,
    
    -- Cloud metadata
    cloud_provider asset_cloud_provider,
    cloud_account_id VARCHAR(100),
    region VARCHAR(50),
    availability_zone VARCHAR(50),
    
    -- Classification
    criticality asset_criticality DEFAULT 'medium',
    data_classification VARCHAR(50),  -- 'public', 'internal', 'confidential', 'restricted'
    contains_pii BOOLEAN DEFAULT false,
    contains_phi BOOLEAN DEFAULT false,  -- Protected Health Information
    contains_pci BOOLEAN DEFAULT false,  -- Payment Card Data
    
    -- Technical details
    ip_address INET,
    hostname VARCHAR(255),
    operating_system VARCHAR(100),
    software_version VARCHAR(100),
    configuration JSONB DEFAULT '{}',
    tags JSONB DEFAULT '{}',
    
    -- Ownership
    owner_id UUID REFERENCES users(id),
    owner_team VARCHAR(100),
    cost_center VARCHAR(50),
    
    -- Status
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'decommissioned', 'pending')),
    discovered_at TIMESTAMPTZ,
    last_scanned_at TIMESTAMPTZ,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    
    UNIQUE(organization_id, external_id)
);

CREATE INDEX idx_assets_org ON assets(organization_id);
CREATE INDEX idx_assets_type ON assets(organization_id, asset_type);
CREATE INDEX idx_assets_criticality ON assets(organization_id, criticality);
CREATE INDEX idx_assets_cloud ON assets(organization_id, cloud_provider);
CREATE INDEX idx_assets_owner ON assets(owner_id);
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_assets_tags ON assets USING GIN(tags);

-- Asset relationships (for graph-like queries in PostgreSQL)
CREATE TABLE asset_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    source_asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    target_asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) NOT NULL,  -- 'depends_on', 'connects_to', 'hosts', 'stores_data_in'
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(source_asset_id, target_asset_id, relationship_type)
);

CREATE INDEX idx_asset_rel_source ON asset_relationships(source_asset_id);
CREATE INDEX idx_asset_rel_target ON asset_relationships(target_asset_id);
CREATE INDEX idx_asset_rel_type ON asset_relationships(relationship_type);

-- ============================================================================
-- SECTION 4: BUSINESS PROCESSES & IMPACT
-- ============================================================================

CREATE TABLE business_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES business_units(id),
    head_user_id UUID REFERENCES users(id),
    annual_revenue DECIMAL(15,2),
    employee_count INT,
    is_revenue_generating BOOLEAN DEFAULT false,
    criticality asset_criticality DEFAULT 'medium',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_business_units_org ON business_units(organization_id);
CREATE INDEX idx_business_units_parent ON business_units(parent_id);

CREATE TABLE business_processes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    business_unit_id UUID REFERENCES business_units(id),
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    process_owner_id UUID REFERENCES users(id),
    
    -- Impact classification
    criticality asset_criticality DEFAULT 'medium',
    is_revenue_generating BOOLEAN DEFAULT false,
    is_customer_facing BOOLEAN DEFAULT false,
    is_regulatory_required BOOLEAN DEFAULT false,
    
    -- Financial impact
    revenue_impact_per_hour DECIMAL(15,2),  -- Lost revenue per hour of downtime
    regulatory_fine_exposure DECIMAL(15,2),
    
    -- Recovery objectives
    rto_hours INT,  -- Recovery Time Objective
    rpo_hours INT,  -- Recovery Point Objective
    mtpd_hours INT, -- Maximum Tolerable Period of Disruption
    
    -- Dependencies count (denormalized)
    asset_count INT DEFAULT 0,
    vendor_count INT DEFAULT 0,
    
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_business_processes_org ON business_processes(organization_id);
CREATE INDEX idx_business_processes_unit ON business_processes(business_unit_id);
CREATE INDEX idx_business_processes_criticality ON business_processes(criticality);
CREATE INDEX idx_business_processes_revenue ON business_processes(is_revenue_generating);

-- Asset to Business Process mapping
CREATE TABLE asset_process_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    business_process_id UUID NOT NULL REFERENCES business_processes(id) ON DELETE CASCADE,
    
    dependency_type VARCHAR(50) DEFAULT 'supports',  -- 'critical', 'supports', 'optional'
    impact_if_unavailable TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    
    UNIQUE(asset_id, business_process_id)
);

CREATE INDEX idx_asset_process_asset ON asset_process_mappings(asset_id);
CREATE INDEX idx_asset_process_process ON asset_process_mappings(business_process_id);

-- ============================================================================
-- SECTION 5: VENDORS & SUPPLY CHAIN
-- ============================================================================

CREATE TYPE vendor_status AS ENUM (
    'prospect', 'active', 'under_review', 'suspended', 'terminated', 'archived'
);

CREATE TYPE vendor_tier AS ENUM ('critical', 'high', 'medium', 'low');

CREATE TABLE vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Basic info
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    description TEXT,
    website VARCHAR(500),
    industry VARCHAR(100),
    
    -- Classification
    vendor_tier vendor_tier DEFAULT 'medium',
    vendor_type VARCHAR(100),  -- 'SaaS', 'IaaS', 'Consultant', 'Hardware', 'MSP'
    
    -- Data handling
    has_data_access BOOLEAN DEFAULT false,
    data_types_accessed TEXT[],  -- ['PII', 'PHI', 'Financial', 'Proprietary']
    data_residency_countries TEXT[],
    
    -- Contract
    contract_start_date DATE,
    contract_end_date DATE,
    contract_value DECIMAL(15,2),
    contract_document_url TEXT,
    
    -- Contacts
    primary_contact_name VARCHAR(255),
    primary_contact_email VARCHAR(255),
    primary_contact_phone VARCHAR(50),
    
    -- Risk scoring
    inherent_risk_score DECIMAL(4,2),
    current_risk_score DECIMAL(4,2),
    external_risk_score DECIMAL(4,2),  -- From SecurityScorecard/BitSight
    external_risk_source VARCHAR(100),
    last_external_check TIMESTAMPTZ,
    
    -- Compliance
    certifications TEXT[],  -- ['SOC2', 'ISO27001', 'HIPAA']
    certification_expiries JSONB,  -- {"SOC2": "2025-06-01", ...}
    
    -- Status
    status vendor_status DEFAULT 'prospect',
    onboarding_completed_at TIMESTAMPTZ,
    last_assessment_date DATE,
    next_assessment_due DATE,
    
    -- Integration
    external_vendor_id VARCHAR(255),  -- SecurityScorecard ID
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_vendors_org ON vendors(organization_id);
CREATE INDEX idx_vendors_tier ON vendors(organization_id, vendor_tier);
CREATE INDEX idx_vendors_status ON vendors(organization_id, status);
CREATE INDEX idx_vendors_risk ON vendors(organization_id, current_risk_score DESC);
CREATE INDEX idx_vendors_assessment_due ON vendors(next_assessment_due);

-- Vendor to Business Process mapping
CREATE TABLE vendor_process_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    business_process_id UUID NOT NULL REFERENCES business_processes(id) ON DELETE CASCADE,
    
    dependency_level VARCHAR(50) DEFAULT 'supports',  -- 'critical', 'supports', 'optional'
    service_description TEXT,
    failover_available BOOLEAN DEFAULT false,
    alternative_vendor_id UUID REFERENCES vendors(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(vendor_id, business_process_id)
);

CREATE INDEX idx_vendor_process_vendor ON vendor_process_mappings(vendor_id);
CREATE INDEX idx_vendor_process_process ON vendor_process_mappings(business_process_id);

-- Vendor assessments
CREATE TABLE vendor_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    
    assessment_type VARCHAR(50),  -- 'initial', 'annual', 'incident_triggered', 'ad_hoc'
    questionnaire_template_id UUID,
    
    -- Scoring
    overall_score DECIMAL(5,2),  -- 0-100
    section_scores JSONB,  -- {"security": 85, "privacy": 72, ...}
    
    -- Status
    status VARCHAR(50) DEFAULT 'draft',  -- 'draft', 'sent', 'in_progress', 'completed', 'expired'
    sent_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    
    -- Responses
    responses JSONB,
    evidence_files TEXT[],
    
    -- Analysis
    ai_risk_summary TEXT,
    identified_gaps TEXT[],
    recommended_actions TEXT[],
    
    -- Reviewer
    reviewed_by UUID REFERENCES users(id),
    review_notes TEXT,
    review_decision VARCHAR(50),  -- 'approved', 'conditionally_approved', 'rejected'
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_vendor_assessments_vendor ON vendor_assessments(vendor_id);
CREATE INDEX idx_vendor_assessments_status ON vendor_assessments(status);

-- Vendor incidents (breaches, outages)
CREATE TABLE vendor_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    
    incident_type VARCHAR(50),  -- 'breach', 'outage', 'compliance_violation', 'other'
    severity asset_criticality,
    
    title VARCHAR(500) NOT NULL,
    description TEXT,
    
    -- Source
    source VARCHAR(100),  -- 'news', 'vendor_notification', 'threat_intel', 'internal_detection'
    source_url TEXT,
    
    -- Impact
    data_compromised BOOLEAN,
    service_affected BOOLEAN,
    our_data_affected BOOLEAN,
    estimated_impact TEXT,
    
    -- Response
    vendor_response TEXT,
    our_actions TEXT[],
    status VARCHAR(50) DEFAULT 'investigating',  -- 'investigating', 'monitoring', 'resolved', 'closed'
    
    -- Notifications
    legal_notified BOOLEAN DEFAULT false,
    legal_notified_at TIMESTAMPTZ,
    executives_notified BOOLEAN DEFAULT false,
    
    detected_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vendor_incidents_vendor ON vendor_incidents(vendor_id);
CREATE INDEX idx_vendor_incidents_type ON vendor_incidents(incident_type);
CREATE INDEX idx_vendor_incidents_status ON vendor_incidents(status);

-- ============================================================================
-- SECTION 6: RISKS & FINDINGS
-- ============================================================================

CREATE TYPE risk_status AS ENUM (
    'open', 'in_progress', 'mitigated', 'accepted', 'transferred', 'closed', 'false_positive'
);

CREATE TYPE risk_source AS ENUM (
    'vulnerability_scan', 'penetration_test', 'audit_finding', 'self_assessment',
    'vendor_assessment', 'threat_intel', 'incident', 'manual', 'ai_detected'
);

CREATE TABLE risk_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Identification
    title VARCHAR(500) NOT NULL,
    description TEXT,
    risk_source risk_source NOT NULL,
    external_reference VARCHAR(255),  -- CVE ID, finding ID, etc.
    
    -- Classification
    category VARCHAR(100),  -- 'vulnerability', 'configuration', 'compliance', 'operational'
    subcategory VARCHAR(100),
    
    -- Affected resources
    affected_asset_id UUID REFERENCES assets(id),
    affected_vendor_id UUID REFERENCES vendors(id),
    affected_control_id UUID,
    
    -- Scoring (CVSS-like)
    inherent_likelihood DECIMAL(3,2),  -- 0.00 to 1.00
    inherent_impact DECIMAL(3,2),
    inherent_score DECIMAL(4,2) GENERATED ALWAYS AS (inherent_likelihood * inherent_impact * 100) STORED,
    
    residual_likelihood DECIMAL(3,2),
    residual_impact DECIMAL(3,2),
    residual_score DECIMAL(4,2) GENERATED ALWAYS AS (COALESCE(residual_likelihood, inherent_likelihood) * COALESCE(residual_impact, inherent_impact) * 100) STORED,
    
    -- Business impact (calculated from graph)
    business_impact_score DECIMAL(4,2),
    financial_exposure DECIMAL(15,2),  -- Estimated $ exposure
    
    -- Contextual priority (the magic sauce)
    context_priority_score DECIMAL(4,2),
    context_priority_reason TEXT,
    
    -- Status & lifecycle
    status risk_status DEFAULT 'open',
    assignee_id UUID REFERENCES users(id),
    due_date DATE,
    
    -- Remediation
    remediation_plan TEXT,
    remediation_cost_estimate DECIMAL(10,2),
    remediation_effort_days INT,
    
    -- Evidence
    evidence_urls TEXT[],
    screenshots JSONB,
    
    -- AI metadata
    ai_analysis JSONB,
    ai_suggested_controls TEXT[],
    
    -- Audit trail
    discovered_at TIMESTAMPTZ DEFAULT NOW(),
    last_assessed_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_risks_org ON risk_items(organization_id);
CREATE INDEX idx_risks_status ON risk_items(organization_id, status);
CREATE INDEX idx_risks_asset ON risk_items(affected_asset_id);
CREATE INDEX idx_risks_vendor ON risk_items(affected_vendor_id);
CREATE INDEX idx_risks_score ON risk_items(organization_id, inherent_score DESC);
CREATE INDEX idx_risks_context_priority ON risk_items(organization_id, context_priority_score DESC);
CREATE INDEX idx_risks_assignee ON risk_items(assignee_id);
CREATE INDEX idx_risks_due ON risk_items(due_date) WHERE status IN ('open', 'in_progress');

-- Partial index for open risks (most common query)
CREATE INDEX idx_risks_open ON risk_items(organization_id, context_priority_score DESC)
    WHERE status IN ('open', 'in_progress');

-- Risk history for trend analysis
CREATE TABLE risk_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    risk_id UUID NOT NULL REFERENCES risk_items(id) ON DELETE CASCADE,
    changed_by UUID REFERENCES users(id),
    change_type VARCHAR(50),  -- 'status_change', 'score_update', 'assignment', 'note_added'
    previous_value JSONB,
    new_value JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_risk_history_risk ON risk_history(risk_id);
CREATE INDEX idx_risk_history_date ON risk_history(created_at);

-- ============================================================================
-- SECTION 7: COMPLIANCE & CONTROLS
-- ============================================================================

CREATE TABLE compliance_frameworks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,  -- 'SOC2', 'ISO27001', 'GDPR', 'HIPAA'
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version VARCHAR(50),
    authority VARCHAR(255),  -- 'AICPA', 'ISO', 'EU', 'HHS'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert common frameworks
INSERT INTO compliance_frameworks (code, name, version, authority) VALUES
    ('SOC2', 'SOC 2 Type II', '2017', 'AICPA'),
    ('ISO27001', 'ISO/IEC 27001', '2022', 'ISO'),
    ('GDPR', 'General Data Protection Regulation', '2016/679', 'EU'),
    ('HIPAA', 'Health Insurance Portability and Accountability Act', '1996', 'HHS'),
    ('PCI_DSS', 'Payment Card Industry Data Security Standard', '4.0', 'PCI SSC'),
    ('NIST_CSF', 'NIST Cybersecurity Framework', '2.0', 'NIST'),
    ('CIS', 'CIS Controls', 'v8', 'CIS');

-- Framework requirements/controls (canonical)
CREATE TABLE framework_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    framework_id UUID NOT NULL REFERENCES compliance_frameworks(id) ON DELETE CASCADE,
    
    requirement_id VARCHAR(50) NOT NULL,  -- 'CC1.1', 'A.5.1', etc.
    parent_requirement_id UUID REFERENCES framework_requirements(id),
    
    title VARCHAR(500) NOT NULL,
    description TEXT,
    guidance TEXT,
    
    category VARCHAR(100),
    control_type VARCHAR(50),  -- 'preventive', 'detective', 'corrective'
    
    is_mandatory BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(framework_id, requirement_id)
);

CREATE INDEX idx_framework_req_framework ON framework_requirements(framework_id);
CREATE INDEX idx_framework_req_parent ON framework_requirements(parent_requirement_id);

-- Organization-specific controls
CREATE TABLE controls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Identification
    control_id VARCHAR(100) NOT NULL,  -- Internal control ID
    name VARCHAR(500) NOT NULL,
    description TEXT,
    
    -- Classification
    category VARCHAR(100),  -- 'Access Control', 'Data Protection', 'Network Security'
    control_type VARCHAR(50),  -- 'preventive', 'detective', 'corrective'
    implementation_type VARCHAR(50),  -- 'technical', 'administrative', 'physical'
    
    -- Owner
    owner_id UUID REFERENCES users(id),
    owner_team VARCHAR(100),
    
    -- Implementation
    implementation_status VARCHAR(50) DEFAULT 'not_started' 
        CHECK (implementation_status IN ('not_started', 'in_progress', 'implemented', 'not_applicable')),
    implementation_evidence TEXT,
    implementation_date DATE,
    
    -- Effectiveness
    effectiveness_rating VARCHAR(50) 
        CHECK (effectiveness_rating IN ('effective', 'partially_effective', 'ineffective', 'not_tested')),
    last_tested_date DATE,
    next_test_due DATE,
    test_frequency_days INT DEFAULT 365,
    
    -- Documentation
    policy_document_url TEXT,
    procedure_document_url TEXT,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    
    UNIQUE(organization_id, control_id)
);

CREATE INDEX idx_controls_org ON controls(organization_id);
CREATE INDEX idx_controls_status ON controls(organization_id, implementation_status);
CREATE INDEX idx_controls_owner ON controls(owner_id);
CREATE INDEX idx_controls_test_due ON controls(next_test_due);

-- Control to Framework mapping
CREATE TABLE control_framework_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    control_id UUID NOT NULL REFERENCES controls(id) ON DELETE CASCADE,
    framework_requirement_id UUID NOT NULL REFERENCES framework_requirements(id) ON DELETE CASCADE,
    
    coverage_level VARCHAR(50) DEFAULT 'full',  -- 'full', 'partial', 'planned'
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(control_id, framework_requirement_id)
);

CREATE INDEX idx_control_framework_control ON control_framework_mappings(control_id);
CREATE INDEX idx_control_framework_req ON control_framework_mappings(framework_requirement_id);

-- Control evidence
CREATE TABLE control_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    control_id UUID NOT NULL REFERENCES controls(id) ON DELETE CASCADE,
    
    evidence_type VARCHAR(50),  -- 'screenshot', 'document', 'log', 'attestation', 'automated'
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    file_url TEXT,
    file_type VARCHAR(50),
    file_size_bytes BIGINT,
    
    collected_at TIMESTAMPTZ,
    valid_from DATE,
    valid_until DATE,
    
    is_automated BOOLEAN DEFAULT false,
    automation_source VARCHAR(100),
    
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_control_evidence_control ON control_evidence(control_id);
CREATE INDEX idx_control_evidence_type ON control_evidence(evidence_type);

-- ============================================================================
-- SECTION 8: POLICIES & DOCUMENTS (for RAG)
-- ============================================================================

CREATE TABLE policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Identification
    title VARCHAR(500) NOT NULL,
    policy_number VARCHAR(50),
    version VARCHAR(20) DEFAULT '1.0',
    
    -- Classification
    category VARCHAR(100),  -- 'Security', 'Privacy', 'HR', 'Compliance'
    policy_type VARCHAR(50),  -- 'policy', 'standard', 'procedure', 'guideline'
    
    -- Content
    content TEXT,  -- Markdown or HTML
    summary TEXT,
    
    -- File
    document_url TEXT,
    document_type VARCHAR(50),  -- 'pdf', 'docx', 'md'
    
    -- Ownership
    owner_id UUID REFERENCES users(id),
    approver_id UUID REFERENCES users(id),
    
    -- Lifecycle
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'archived')),
    effective_date DATE,
    review_date DATE,
    next_review_date DATE,
    
    -- AI processing
    embedding_status VARCHAR(50),  -- 'pending', 'processing', 'completed', 'failed'
    chunk_count INT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_policies_org ON policies(organization_id);
CREATE INDEX idx_policies_category ON policies(organization_id, category);
CREATE INDEX idx_policies_status ON policies(status);
CREATE INDEX idx_policies_review ON policies(next_review_date);

-- Policy chunks for RAG (vector search)
CREATE TABLE policy_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
    
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    token_count INT,
    
    -- Vector embedding (using pgvector)
    embedding vector(1536),  -- OpenAI ada-002 dimension
    
    -- Metadata for retrieval
    section_title VARCHAR(255),
    page_number INT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_policy_chunks_policy ON policy_chunks(policy_id);
CREATE INDEX idx_policy_chunks_embedding ON policy_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- SECTION 9: AI QUESTIONNAIRES
-- ============================================================================

CREATE TABLE questionnaire_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,  -- NULL for system templates
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),  -- 'vendor_assessment', 'security_rfp', 'compliance_audit'
    
    is_system_template BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

CREATE TABLE questionnaire_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES questionnaire_templates(id) ON DELETE CASCADE,
    
    question_number VARCHAR(20),
    section VARCHAR(100),
    question_text TEXT NOT NULL,
    
    question_type VARCHAR(50),  -- 'text', 'boolean', 'single_choice', 'multi_choice', 'file_upload'
    options JSONB,  -- For choice questions
    
    is_required BOOLEAN DEFAULT true,
    guidance TEXT,
    
    -- For AI matching
    embedding vector(1536),
    keywords TEXT[],
    
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_questionnaire_q_template ON questionnaire_questions(template_id);
CREATE INDEX idx_questionnaire_q_embedding ON questionnaire_questions USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Questionnaire sessions (for RFP answering)
CREATE TABLE questionnaire_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Source
    source_type VARCHAR(50),  -- 'upload', 'vendor_request', 'manual'
    source_file_url TEXT,
    source_vendor_id UUID REFERENCES vendors(id),
    
    -- Status
    status VARCHAR(50) DEFAULT 'processing',  -- 'processing', 'ready', 'in_progress', 'completed', 'exported'
    
    -- Stats
    total_questions INT,
    answered_questions INT DEFAULT 0,
    auto_answered_questions INT DEFAULT 0,
    
    -- Export
    export_url TEXT,
    exported_at TIMESTAMPTZ,
    
    due_date DATE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_q_sessions_org ON questionnaire_sessions(organization_id);
CREATE INDEX idx_q_sessions_status ON questionnaire_sessions(status);

CREATE TABLE questionnaire_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES questionnaire_sessions(id) ON DELETE CASCADE,
    
    question_number VARCHAR(20),
    question_text TEXT NOT NULL,
    
    -- Response
    response_text TEXT,
    is_ai_generated BOOLEAN DEFAULT false,
    ai_confidence DECIMAL(3,2),
    
    -- Source tracking
    source_policy_ids UUID[],
    source_control_ids UUID[],
    
    -- Review
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    is_approved BOOLEAN,
    reviewer_notes TEXT,
    
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_q_responses_session ON questionnaire_responses(session_id);

-- AI response cache
CREATE TABLE ai_response_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    question_hash VARCHAR(64) NOT NULL,  -- SHA-256 of normalized question
    question_text TEXT NOT NULL,
    
    generated_response TEXT NOT NULL,
    confidence_score DECIMAL(3,2),
    
    source_policy_ids UUID[],
    source_control_ids UUID[],
    source_chunks JSONB,
    
    model_used VARCHAR(100),
    tokens_used INT,
    
    -- Feedback
    was_used BOOLEAN DEFAULT false,
    was_edited BOOLEAN DEFAULT false,
    user_rating INT,  -- 1-5
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

CREATE INDEX idx_ai_cache_org ON ai_response_cache(organization_id);
CREATE INDEX idx_ai_cache_hash ON ai_response_cache(organization_id, question_hash);

-- ============================================================================
-- SECTION 10: AUDIT & NOTIFICATIONS
-- ============================================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Action details
    action VARCHAR(100) NOT NULL,  -- 'create', 'update', 'delete', 'login', 'export', 'approve'
    resource_type VARCHAR(100) NOT NULL,  -- 'risk', 'asset', 'vendor', 'user'
    resource_id UUID,
    
    -- Change details
    previous_state JSONB,
    new_state JSONB,
    changed_fields TEXT[],
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    
    -- Request details
    request_method VARCHAR(10),
    request_path TEXT,
    
    -- Outcome
    status VARCHAR(50) DEFAULT 'success',  -- 'success', 'failure', 'error'
    error_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_org_date ON audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action, created_at DESC);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,  -- NULL for org-wide
    
    -- Content
    type VARCHAR(50) NOT NULL,  -- 'risk_alert', 'vendor_breach', 'task_due', 'system'
    title VARCHAR(255) NOT NULL,
    message TEXT,
    
    -- Link
    link_type VARCHAR(50),
    link_id UUID,
    link_url TEXT,
    
    -- Delivery
    channels TEXT[] DEFAULT ARRAY['in_app'],  -- 'in_app', 'email', 'slack'
    email_sent BOOLEAN DEFAULT false,
    slack_sent BOOLEAN DEFAULT false,
    
    -- Status
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    
    priority VARCHAR(20) DEFAULT 'normal',  -- 'low', 'normal', 'high', 'urgent'
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_org ON notifications(organization_id, created_at DESC);

-- ============================================================================
-- SECTION 11: ROW-LEVEL SECURITY
-- ============================================================================

-- Enable RLS on tenant-specific tables
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (example for assets)
CREATE POLICY assets_org_isolation ON assets
    USING (organization_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY risks_org_isolation ON risk_items
    USING (organization_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY vendors_org_isolation ON vendors
    USING (organization_id = current_setting('app.current_org_id', true)::uuid);

-- ============================================================================
-- SECTION 12: TRIGGERS & FUNCTIONS
-- ============================================================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables with updated_at
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON assets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_risk_items_updated_at BEFORE UPDATE ON risk_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_controls_updated_at BEFORE UPDATE ON controls FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_policies_updated_at BEFORE UPDATE ON policies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_business_processes_updated_at BEFORE UPDATE ON business_processes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (
        organization_id,
        user_id,
        action,
        resource_type,
        resource_id,
        previous_state,
        new_state
    ) VALUES (
        COALESCE(NEW.organization_id, OLD.organization_id),
        current_setting('app.current_user_id', true)::uuid,
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to sensitive tables
CREATE TRIGGER audit_assets AFTER INSERT OR UPDATE OR DELETE ON assets FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_risks AFTER INSERT OR UPDATE OR DELETE ON risk_items FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_vendors AFTER INSERT OR UPDATE OR DELETE ON vendors FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_controls AFTER INSERT OR UPDATE OR DELETE ON controls FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
