-- ============================================================================
-- SENTIENT GRC - D1 DATABASE SCHEMA
-- Initial migration for core GRC functionality
-- ============================================================================

-- Organizations (Multi-tenant root)
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    industry TEXT,
    size TEXT CHECK (size IN ('startup', 'smb', 'enterprise')),
    subscription_tier TEXT DEFAULT 'starter',
    settings TEXT DEFAULT '{}',
    logo_url TEXT,
    compliance_frameworks TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    is_active INTEGER DEFAULT 1
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    password_hash TEXT,
    first_name TEXT,
    last_name TEXT,
    display_name TEXT,
    avatar_url TEXT,
    job_title TEXT,
    department TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'pending')),
    role TEXT DEFAULT 'analyst' CHECK (role IN ('super_admin', 'org_admin', 'security_lead', 'analyst', 'auditor', 'vendor')),
    last_login_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(organization_id, email)
);

-- Business Units
CREATE TABLE IF NOT EXISTS business_units (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    parent_id TEXT REFERENCES business_units(id),
    head_user_id TEXT REFERENCES users(id),
    annual_revenue REAL,
    employee_count INTEGER,
    is_revenue_generating INTEGER DEFAULT 0,
    criticality TEXT DEFAULT 'medium' CHECK (criticality IN ('critical', 'high', 'medium', 'low', 'informational')),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Business Processes
CREATE TABLE IF NOT EXISTS business_processes (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    business_unit_id TEXT REFERENCES business_units(id),
    name TEXT NOT NULL,
    description TEXT,
    process_owner_id TEXT REFERENCES users(id),
    criticality TEXT DEFAULT 'medium' CHECK (criticality IN ('critical', 'high', 'medium', 'low', 'informational')),
    is_revenue_generating INTEGER DEFAULT 0,
    is_customer_facing INTEGER DEFAULT 0,
    is_regulatory_required INTEGER DEFAULT 0,
    revenue_impact_per_hour REAL DEFAULT 0,
    regulatory_fine_exposure REAL DEFAULT 0,
    rto_hours INTEGER,
    rpo_hours INTEGER,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Assets
CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    external_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    asset_type TEXT NOT NULL CHECK (asset_type IN ('server', 'database', 'application', 'network_device', 'container', 'serverless', 'storage', 'endpoint', 'iot_device', 'other')),
    cloud_provider TEXT CHECK (cloud_provider IN ('aws', 'azure', 'gcp', 'oracle', 'on_premise', 'hybrid', 'other')),
    cloud_account_id TEXT,
    region TEXT,
    criticality TEXT DEFAULT 'medium' CHECK (criticality IN ('critical', 'high', 'medium', 'low', 'informational')),
    data_classification TEXT CHECK (data_classification IN ('public', 'internal', 'confidential', 'restricted')),
    contains_pii INTEGER DEFAULT 0,
    contains_phi INTEGER DEFAULT 0,
    contains_pci INTEGER DEFAULT 0,
    ip_address TEXT,
    hostname TEXT,
    owner_id TEXT REFERENCES users(id),
    owner_team TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'decommissioned', 'pending')),
    tags TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    created_by TEXT REFERENCES users(id)
);

-- Asset Relationships (for graph-like queries)
CREATE TABLE IF NOT EXISTS asset_relationships (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    source_asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    target_asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL CHECK (relationship_type IN ('depends_on', 'connects_to', 'hosts', 'stores_data_in')),
    metadata TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(source_asset_id, target_asset_id, relationship_type)
);

-- Asset to Business Process mapping
CREATE TABLE IF NOT EXISTS asset_process_mappings (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    business_process_id TEXT NOT NULL REFERENCES business_processes(id) ON DELETE CASCADE,
    dependency_type TEXT DEFAULT 'supports' CHECK (dependency_type IN ('critical', 'supports', 'optional')),
    impact_if_unavailable TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    created_by TEXT REFERENCES users(id),
    UNIQUE(asset_id, business_process_id)
);

-- Vendors
CREATE TABLE IF NOT EXISTS vendors (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    legal_name TEXT,
    description TEXT,
    website TEXT,
    industry TEXT,
    vendor_tier TEXT DEFAULT 'medium' CHECK (vendor_tier IN ('critical', 'high', 'medium', 'low')),
    vendor_type TEXT,
    has_data_access INTEGER DEFAULT 0,
    data_types_accessed TEXT DEFAULT '[]',
    data_residency_countries TEXT DEFAULT '[]',
    contract_start_date TEXT,
    contract_end_date TEXT,
    contract_value REAL,
    primary_contact_name TEXT,
    primary_contact_email TEXT,
    primary_contact_phone TEXT,
    inherent_risk_score REAL,
    current_risk_score REAL,
    external_risk_score REAL,
    certifications TEXT DEFAULT '[]',
    status TEXT DEFAULT 'prospect' CHECK (status IN ('prospect', 'active', 'under_review', 'suspended', 'terminated', 'archived')),
    last_assessment_date TEXT,
    next_assessment_due TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    created_by TEXT REFERENCES users(id)
);

-- Vendor to Business Process mapping
CREATE TABLE IF NOT EXISTS vendor_process_mappings (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    vendor_id TEXT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    business_process_id TEXT NOT NULL REFERENCES business_processes(id) ON DELETE CASCADE,
    dependency_level TEXT DEFAULT 'supports' CHECK (dependency_level IN ('critical', 'supports', 'optional')),
    service_description TEXT,
    failover_available INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(vendor_id, business_process_id)
);

-- Vendor Incidents
CREATE TABLE IF NOT EXISTS vendor_incidents (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    vendor_id TEXT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    incident_type TEXT CHECK (incident_type IN ('breach', 'outage', 'compliance_violation', 'other')),
    severity TEXT CHECK (severity IN ('critical', 'high', 'medium', 'low', 'informational')),
    title TEXT NOT NULL,
    description TEXT,
    source TEXT,
    source_url TEXT,
    data_compromised INTEGER DEFAULT 0,
    service_affected INTEGER DEFAULT 0,
    our_data_affected INTEGER DEFAULT 0,
    estimated_impact TEXT,
    vendor_response TEXT,
    our_actions TEXT DEFAULT '[]',
    status TEXT DEFAULT 'investigating' CHECK (status IN ('investigating', 'monitoring', 'resolved', 'closed')),
    legal_notified INTEGER DEFAULT 0,
    legal_notified_at TEXT,
    executives_notified INTEGER DEFAULT 0,
    detected_at TEXT,
    resolved_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Risk Items
CREATE TABLE IF NOT EXISTS risk_items (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    risk_source TEXT NOT NULL CHECK (risk_source IN ('vulnerability_scan', 'penetration_test', 'audit_finding', 'self_assessment', 'vendor_assessment', 'threat_intel', 'incident', 'manual', 'ai_detected')),
    external_reference TEXT,
    category TEXT CHECK (category IN ('vulnerability', 'configuration', 'compliance', 'operational')),
    subcategory TEXT,
    affected_asset_id TEXT REFERENCES assets(id),
    affected_vendor_id TEXT REFERENCES vendors(id),
    affected_control_id TEXT,
    inherent_likelihood REAL CHECK (inherent_likelihood >= 0 AND inherent_likelihood <= 1),
    inherent_impact REAL CHECK (inherent_impact >= 0 AND inherent_impact <= 1),
    inherent_score REAL,
    residual_likelihood REAL,
    residual_impact REAL,
    residual_score REAL,
    business_impact_score REAL,
    financial_exposure REAL,
    context_priority_score REAL,
    context_priority_reason TEXT,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'mitigated', 'accepted', 'transferred', 'closed', 'false_positive')),
    assignee_id TEXT REFERENCES users(id),
    due_date TEXT,
    remediation_plan TEXT,
    remediation_cost_estimate REAL,
    remediation_effort_days INTEGER,
    evidence_urls TEXT DEFAULT '[]',
    ai_analysis TEXT DEFAULT '{}',
    ai_suggested_controls TEXT DEFAULT '[]',
    discovered_at TEXT DEFAULT (datetime('now')),
    last_assessed_at TEXT,
    resolved_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    created_by TEXT REFERENCES users(id)
);

-- Risk History
CREATE TABLE IF NOT EXISTS risk_history (
    id TEXT PRIMARY KEY,
    risk_id TEXT NOT NULL REFERENCES risk_items(id) ON DELETE CASCADE,
    changed_by TEXT REFERENCES users(id),
    change_type TEXT,
    previous_value TEXT,
    new_value TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Compliance Frameworks
CREATE TABLE IF NOT EXISTS compliance_frameworks (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    version TEXT,
    authority TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Controls
CREATE TABLE IF NOT EXISTS controls (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    control_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    control_type TEXT CHECK (control_type IN ('preventive', 'detective', 'corrective')),
    implementation_type TEXT CHECK (implementation_type IN ('technical', 'administrative', 'physical')),
    owner_id TEXT REFERENCES users(id),
    owner_team TEXT,
    implementation_status TEXT DEFAULT 'not_started' CHECK (implementation_status IN ('not_started', 'in_progress', 'implemented', 'not_applicable')),
    implementation_evidence TEXT,
    implementation_date TEXT,
    effectiveness_rating TEXT CHECK (effectiveness_rating IN ('effective', 'partially_effective', 'ineffective', 'not_tested')),
    last_tested_date TEXT,
    next_test_due TEXT,
    test_frequency_days INTEGER DEFAULT 365,
    policy_document_url TEXT,
    procedure_document_url TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    created_by TEXT REFERENCES users(id),
    UNIQUE(organization_id, control_id)
);

-- Policies
CREATE TABLE IF NOT EXISTS policies (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    policy_number TEXT,
    version TEXT DEFAULT '1.0',
    category TEXT,
    policy_type TEXT CHECK (policy_type IN ('policy', 'standard', 'procedure', 'guideline')),
    content TEXT,
    summary TEXT,
    document_url TEXT,
    owner_id TEXT REFERENCES users(id),
    approver_id TEXT REFERENCES users(id),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'archived')),
    effective_date TEXT,
    review_date TEXT,
    next_review_date TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    created_by TEXT REFERENCES users(id)
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    previous_state TEXT,
    new_state TEXT,
    ip_address TEXT,
    user_agent TEXT,
    status TEXT DEFAULT 'success',
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    link_type TEXT,
    link_id TEXT,
    link_url TEXT,
    is_read INTEGER DEFAULT 0,
    read_at TEXT,
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_assets_org ON assets(organization_id);
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(organization_id, asset_type);
CREATE INDEX IF NOT EXISTS idx_assets_criticality ON assets(organization_id, criticality);
CREATE INDEX IF NOT EXISTS idx_risks_org ON risk_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_risks_status ON risk_items(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_risks_priority ON risk_items(organization_id, context_priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_vendors_org ON vendors(organization_id);
CREATE INDEX IF NOT EXISTS idx_vendors_tier ON vendors(organization_id, vendor_tier);
CREATE INDEX IF NOT EXISTS idx_vendor_incidents_vendor ON vendor_incidents(vendor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
