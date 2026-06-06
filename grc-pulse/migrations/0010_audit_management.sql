-- Migration: Audit Management Module
-- Creates tables for audit programs, engagements, and findings

-- Audit Programs (Annual audit plans)
CREATE TABLE IF NOT EXISTS audit_programs (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    year INTEGER NOT NULL,
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'active', 'completed', 'cancelled')),
    start_date TEXT,
    end_date TEXT,
    audit_manager_id TEXT,
    total_engagements INTEGER DEFAULT 0,
    completed_engagements INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Audit Engagements (Individual audits within a program)
CREATE TABLE IF NOT EXISTS audit_engagements (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    program_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    audit_type TEXT DEFAULT 'internal' CHECK(audit_type IN ('internal', 'external', 'regulatory', 'compliance', 'operational', 'financial', 'it', 'security')),
    status TEXT DEFAULT 'planned' CHECK(status IN ('planned', 'in_progress', 'fieldwork', 'reporting', 'completed', 'cancelled')),
    priority TEXT DEFAULT 'medium' CHECK(priority IN ('critical', 'high', 'medium', 'low')),
    scope TEXT,
    objectives TEXT,
    lead_auditor_id TEXT,
    lead_auditor_name TEXT,
    start_date TEXT,
    end_date TEXT,
    report_date TEXT,
    department TEXT,
    findings_count INTEGER DEFAULT 0,
    open_findings INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (program_id) REFERENCES audit_programs(id) ON DELETE SET NULL
);

-- Audit Findings (Issues discovered during audits)
CREATE TABLE IF NOT EXISTS audit_findings (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    engagement_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    finding_type TEXT DEFAULT 'deficiency' CHECK(finding_type IN ('deficiency', 'weakness', 'observation', 'recommendation', 'non_compliance', 'fraud', 'control_gap')),
    severity TEXT DEFAULT 'medium' CHECK(severity IN ('critical', 'high', 'medium', 'low', 'informational')),
    status TEXT DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'remediation_planned', 'remediated', 'closed', 'accepted', 'deferred')),
    category TEXT,
    affected_process TEXT,
    affected_department TEXT,
    root_cause TEXT,
    impact TEXT,
    likelihood INTEGER DEFAULT 3 CHECK(likelihood >= 1 AND likelihood <= 5),
    impact_score INTEGER DEFAULT 3 CHECK(impact_score >= 1 AND impact_score <= 5),
    risk_rating TEXT,
    recommendation TEXT,
    management_response TEXT,
    remediation_plan TEXT,
    remediation_owner_id TEXT,
    remediation_owner_name TEXT,
    due_date TEXT,
    closed_date TEXT,
    evidence TEXT,
    related_control_id TEXT,
    related_risk_id TEXT,
    external_reference TEXT,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (engagement_id) REFERENCES audit_engagements(id) ON DELETE SET NULL
);

-- Audit Evidence/Attachments
CREATE TABLE IF NOT EXISTS audit_evidence (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    finding_id TEXT,
    engagement_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    file_type TEXT,
    file_url TEXT,
    uploaded_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (finding_id) REFERENCES audit_findings(id) ON DELETE CASCADE,
    FOREIGN KEY (engagement_id) REFERENCES audit_engagements(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_programs_org ON audit_programs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_programs_year ON audit_programs(year);
CREATE INDEX IF NOT EXISTS idx_audit_engagements_org ON audit_engagements(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_engagements_program ON audit_engagements(program_id);
CREATE INDEX IF NOT EXISTS idx_audit_engagements_status ON audit_engagements(status);
CREATE INDEX IF NOT EXISTS idx_audit_findings_org ON audit_findings(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_findings_engagement ON audit_findings(engagement_id);
CREATE INDEX IF NOT EXISTS idx_audit_findings_status ON audit_findings(status);
CREATE INDEX IF NOT EXISTS idx_audit_findings_severity ON audit_findings(severity);
CREATE INDEX IF NOT EXISTS idx_audit_findings_risk ON audit_findings(related_risk_id);
