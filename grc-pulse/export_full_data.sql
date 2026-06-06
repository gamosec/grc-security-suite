-- ============================================================================
-- GRC PULSE - FULL DATA EXPORT
-- Generated: 2025-01-08
-- Run after applying all migrations (0001-0009)
-- ============================================================================

-- Organization Profile
INSERT OR REPLACE INTO organization_profile (id, organization_id, company_name, industry, company_size, region, data_types_processed, is_public_company, is_government_contractor, accepts_credit_cards, processes_health_data, operates_in_eu, operates_in_california)
VALUES ('profile-001', 'org-001', 'ACME Corporation', 'technology', 'enterprise', 'north_america', '["pii", "financial"]', 0, 0, 1, 0, 1, 1);

-- Compliance Frameworks V2
INSERT OR REPLACE INTO compliance_frameworks_v2 (id, code, name, version, description, authority, total_controls, is_core_framework, is_active, icon, color) VALUES
('fw-iso27001', 'ISO27001', 'ISO/IEC 27001:2022', '2022', 'International standard for information security management systems', 'ISO/IEC', 93, 1, 1, 'fa-shield-alt', '#3b82f6'),
('fw-nist-csf', 'NIST-CSF', 'NIST Cybersecurity Framework', '2.0', 'Voluntary guidance for managing cybersecurity risk', 'NIST', 108, 0, 1, 'fa-flag', '#10b981'),
('fw-pci-dss', 'PCI-DSS', 'PCI Data Security Standard', '4.0', 'Security standard for payment card handling', 'PCI SSC', 78, 0, 1, 'fa-credit-card', '#f59e0b'),
('fw-soc2', 'SOC2', 'SOC 2 Type II', '2017', 'Trust Services Criteria for service organizations', 'AICPA', 64, 0, 1, 'fa-check-circle', '#8b5cf6'),
('fw-gdpr', 'GDPR', 'General Data Protection Regulation', '2016', 'EU data protection and privacy regulation', 'European Union', 45, 0, 1, 'fa-euro-sign', '#ef4444');

-- Framework Applicability
INSERT OR REPLACE INTO org_framework_applicability (id, organization_id, framework_id, is_applicable, applicability_reason) VALUES
('ofa-001', 'org-001', 'fw-iso27001', 1, 'Core security framework'),
('ofa-002', 'org-001', 'fw-soc2', 1, 'Required for enterprise customers'),
('ofa-003', 'org-001', 'fw-gdpr', 1, 'EU operations'),
('ofa-004', 'org-001', 'fw-pci-dss', 1, 'Payment processing'),
('ofa-005', 'org-001', 'fw-nist-csf', 0, 'Optional guidance');

-- Sample Maturity Assessment
INSERT OR REPLACE INTO maturity_assessments (id, organization_id, name, description, assessment_type, status, overall_score, overall_percentage, assessor_id)
VALUES ('ma-001', 'org-001', 'Q4 2024 Security Assessment', 'Quarterly security maturity evaluation', 'security', 'completed', 3.56, 71.2, 'user-001');

-- Control-Risk Mappings (Phase 6)
INSERT OR REPLACE INTO control_risk_mappings (id, organization_id, control_id, risk_id, mapping_type, effectiveness, confidence_score, is_auto_suggested) VALUES
('crm-001', 'org-001', 'iso-8.28', 'risk-pt-mjshl9q0-kcdq61yd4', 'mitigates', 'full', 95, 1),
('crm-002', 'org-001', 'iso-8.29', 'risk-pt-mjshl9q0-kcdq61yd4', 'detects', 'partial', 85, 1),
('crm-003', 'org-001', 'iso-8.5', 'risk-004', 'mitigates', 'full', 95, 1),
('crm-004', 'org-001', 'iso-8.24', 'risk-002', 'mitigates', 'full', 90, 1),
('crm-005', 'org-001', 'iso-8.24', 'risk-003', 'mitigates', 'full', 95, 1),
('crm-006', 'org-001', 'iso-5.34', 'risk-003', 'reduces', 'partial', 80, 1),
('crm-007', 'org-001', 'iso-8.8', 'risk-005', 'mitigates', 'full', 95, 1);

-- Compliance Snapshots (Historical Data)
INSERT OR REPLACE INTO compliance_snapshots (id, organization_id, framework_id, snapshot_date, basic_score, advanced_score, implemented_count, in_progress_count, not_started_count, not_applicable_count, total_controls, avg_maturity, critical_score) VALUES
('snap-iso-001', 'org-001', 'fw-iso27001', '2025-07-01', 52, 44, 48, 8, 37, 0, 93, 2.4, 45),
('snap-iso-002', 'org-001', 'fw-iso27001', '2025-08-01', 58, 50, 54, 10, 29, 0, 93, 2.7, 52),
('snap-iso-003', 'org-001', 'fw-iso27001', '2025-09-01', 65, 57, 60, 10, 23, 0, 93, 3.0, 60),
('snap-iso-004', 'org-001', 'fw-iso27001', '2025-10-01', 72, 64, 67, 9, 17, 0, 93, 3.2, 68),
('snap-iso-005', 'org-001', 'fw-iso27001', '2025-11-01', 78, 70, 72, 9, 12, 0, 93, 3.4, 75),
('snap-iso-006', 'org-001', 'fw-iso27001', '2025-12-01', 82, 74, 76, 8, 9, 0, 93, 3.5, 80),
('snap-iso-007', 'org-001', 'fw-iso27001', '2025-12-31', 84, 77, 78, 8, 7, 0, 93, 3.6, 85),
('snap-soc2-001', 'org-001', 'fw-soc2', '2025-07-01', 35, 28, 17, 5, 26, 0, 48, 2.0, 30),
('snap-soc2-002', 'org-001', 'fw-soc2', '2025-08-01', 42, 35, 20, 6, 22, 0, 48, 2.3, 38),
('snap-soc2-003', 'org-001', 'fw-soc2', '2025-09-01', 48, 41, 23, 7, 18, 0, 48, 2.6, 45),
('snap-soc2-004', 'org-001', 'fw-soc2', '2025-10-01', 54, 47, 26, 7, 15, 0, 48, 2.8, 50),
('snap-soc2-005', 'org-001', 'fw-soc2', '2025-11-01', 58, 52, 28, 8, 12, 0, 48, 3.0, 55),
('snap-soc2-006', 'org-001', 'fw-soc2', '2025-12-01', 60, 55, 29, 8, 11, 0, 48, 3.0, 58),
('snap-soc2-007', 'org-001', 'fw-soc2', '2025-12-31', 62, 58, 30, 8, 10, 0, 48, 3.1, 60);

-- Domain Snapshots
INSERT OR REPLACE INTO domain_snapshots (id, organization_id, domain_name, snapshot_date, basic_score, advanced_score, implemented_count, in_progress_count, total_controls, avg_maturity) VALUES
('dsnap-org-001', 'org-001', 'Organizational', '2025-07-01', 45, 38, 17, 3, 37, 2.3),
('dsnap-org-002', 'org-001', 'Organizational', '2025-12-31', 81, 74, 30, 3, 37, 3.5),
('dsnap-ppl-001', 'org-001', 'People', '2025-07-01', 50, 42, 4, 1, 8, 2.5),
('dsnap-ppl-002', 'org-001', 'People', '2025-12-31', 88, 80, 7, 1, 8, 3.8),
('dsnap-phy-001', 'org-001', 'Physical', '2025-07-01', 57, 48, 8, 1, 14, 2.6),
('dsnap-phy-002', 'org-001', 'Physical', '2025-12-31', 86, 78, 12, 1, 14, 3.6),
('dsnap-tech-001', 'org-001', 'Technological', '2025-07-01', 53, 45, 18, 3, 34, 2.4),
('dsnap-tech-002', 'org-001', 'Technological', '2025-12-31', 85, 78, 29, 3, 34, 3.6);

-- Risk Snapshots
INSERT OR REPLACE INTO risk_snapshots (id, organization_id, snapshot_date, total_risks, open_risks, critical_risks, high_risks, medium_risks, low_risks, total_exposure, avg_risk_score) VALUES
('rsnap-001', 'org-001', '2025-07-01', 22, 20, 3, 8, 7, 4, 45000, 16),
('rsnap-002', 'org-001', '2025-08-01', 20, 18, 2, 7, 7, 4, 38000, 15),
('rsnap-003', 'org-001', '2025-09-01', 18, 16, 2, 6, 6, 4, 32000, 14),
('rsnap-004', 'org-001', '2025-10-01', 16, 14, 1, 5, 6, 4, 26000, 13),
('rsnap-005', 'org-001', '2025-11-01', 14, 13, 1, 4, 5, 4, 22000, 12),
('rsnap-006', 'org-001', '2025-12-01', 13, 12, 0, 3, 5, 4, 18000, 11),
('rsnap-007', 'org-001', '2025-12-31', 13, 12, 0, 0, 6, 6, 18000, 11);

