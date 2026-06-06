-- ============================================================================
-- SENTIENT GRC - SEED DATA
-- Demo data for testing the platform
-- ============================================================================

-- Default Organization
INSERT OR IGNORE INTO organizations (id, name, slug, industry, size, subscription_tier, compliance_frameworks)
VALUES (
    'org-001',
    'Acme Corporation',
    'acme-corp',
    'Technology',
    'enterprise',
    'enterprise',
    '["SOC2", "ISO27001", "GDPR", "PCI_DSS"]'
);

-- Default Admin User
INSERT OR IGNORE INTO users (id, organization_id, email, first_name, last_name, display_name, job_title, department, role, status)
VALUES (
    'user-001',
    'org-001',
    'admin@acme.com',
    'Khaled',
    'Gamo',
    'Khaled Gamo',
    'CISO',
    'Security',
    'org_admin',
    'active'
);

INSERT OR IGNORE INTO users (id, organization_id, email, first_name, last_name, display_name, job_title, department, role, status)
VALUES (
    'user-002',
    'org-001',
    'mike@acme.com',
    'Mike',
    'Johnson',
    'Mike Johnson',
    'Security Engineer',
    'IT Operations',
    'analyst',
    'active'
);

INSERT OR IGNORE INTO users (id, organization_id, email, first_name, last_name, display_name, job_title, department, role, status)
VALUES (
    'user-003',
    'org-001',
    'emily@acme.com',
    'Emily',
    'Davis',
    'Emily Davis',
    'Data Protection Officer',
    'Legal',
    'security_lead',
    'active'
);

-- Business Units
INSERT OR IGNORE INTO business_units (id, organization_id, name, description, annual_revenue, is_revenue_generating, criticality)
VALUES 
    ('bu-001', 'org-001', 'Engineering', 'Product development and engineering', 50000000, 1, 'critical'),
    ('bu-002', 'org-001', 'Sales', 'Sales and business development', 80000000, 1, 'critical'),
    ('bu-003', 'org-001', 'Operations', 'IT and business operations', 0, 0, 'high'),
    ('bu-004', 'org-001', 'Finance', 'Financial operations', 0, 0, 'high');

-- Business Processes
INSERT OR IGNORE INTO business_processes (id, organization_id, business_unit_id, name, description, criticality, is_revenue_generating, is_customer_facing, is_regulatory_required, revenue_impact_per_hour, rto_hours)
VALUES 
    ('bp-001', 'org-001', 'bu-002', 'Payment Processing', 'Handles all customer payment transactions', 'critical', 1, 1, 1, 50000, 1),
    ('bp-002', 'org-001', 'bu-001', 'Customer Portal', 'Customer-facing web application', 'high', 1, 1, 0, 10000, 4),
    ('bp-003', 'org-001', 'bu-002', 'Order Management', 'Order processing and fulfillment', 'high', 1, 0, 0, 25000, 2),
    ('bp-004', 'org-001', 'bu-001', 'Customer Analytics', 'Data analytics and reporting', 'medium', 0, 0, 1, 5000, 24),
    ('bp-005', 'org-001', 'bu-003', 'Inventory Management', 'Inventory tracking and management', 'medium', 0, 0, 0, 2000, 8);

-- Assets
INSERT OR IGNORE INTO assets (id, organization_id, name, description, asset_type, cloud_provider, region, criticality, data_classification, contains_pii, contains_pci, owner_id, status)
VALUES 
    ('asset-001', 'org-001', 'payment-api-prod', 'Production payment processing API', 'application', 'aws', 'us-east-1', 'critical', 'restricted', 0, 1, 'user-001', 'active'),
    ('asset-002', 'org-001', 'customer-portal', 'Customer-facing web portal', 'application', 'aws', 'us-east-1', 'high', 'confidential', 1, 0, 'user-002', 'active'),
    ('asset-003', 'org-001', 'analytics-db-cluster', 'Customer analytics database cluster', 'database', 'aws', 'us-west-2', 'high', 'confidential', 1, 0, 'user-003', 'active'),
    ('asset-004', 'org-001', 'identity-provider', 'Centralized identity management', 'application', 'azure', 'eastus', 'critical', 'restricted', 1, 0, 'user-001', 'active'),
    ('asset-005', 'org-001', 'legacy-inventory', 'Legacy inventory management system', 'application', 'on_premise', NULL, 'medium', 'internal', 0, 0, 'user-002', 'active'),
    ('asset-006', 'org-001', 'payment-db', 'Payment database', 'database', 'aws', 'us-east-1', 'critical', 'restricted', 0, 1, 'user-001', 'active'),
    ('asset-007', 'org-001', 'payment-cache', 'Payment Redis cache', 'database', 'aws', 'us-east-1', 'high', 'confidential', 0, 0, 'user-002', 'active'),
    ('asset-008', 'org-001', 'cdn-cloudfront', 'CloudFront CDN distribution', 'network_device', 'aws', 'global', 'high', 'public', 0, 0, 'user-002', 'active'),
    ('asset-009', 'org-001', 'order-service', 'Order processing microservice', 'application', 'aws', 'us-east-1', 'high', 'confidential', 1, 0, 'user-002', 'active');

-- Asset Relationships
INSERT OR IGNORE INTO asset_relationships (id, organization_id, source_asset_id, target_asset_id, relationship_type)
VALUES 
    ('rel-001', 'org-001', 'asset-001', 'asset-006', 'depends_on'),
    ('rel-002', 'org-001', 'asset-001', 'asset-007', 'depends_on'),
    ('rel-003', 'org-001', 'asset-002', 'asset-008', 'depends_on'),
    ('rel-004', 'org-001', 'asset-009', 'asset-006', 'depends_on'),
    ('rel-005', 'org-001', 'asset-002', 'asset-004', 'depends_on');

-- Asset to Process Mappings
INSERT OR IGNORE INTO asset_process_mappings (id, organization_id, asset_id, business_process_id, dependency_type)
VALUES 
    ('apm-001', 'org-001', 'asset-001', 'bp-001', 'critical'),
    ('apm-002', 'org-001', 'asset-006', 'bp-001', 'critical'),
    ('apm-003', 'org-001', 'asset-007', 'bp-001', 'supports'),
    ('apm-004', 'org-001', 'asset-002', 'bp-002', 'critical'),
    ('apm-005', 'org-001', 'asset-008', 'bp-002', 'supports'),
    ('apm-006', 'org-001', 'asset-009', 'bp-003', 'critical'),
    ('apm-007', 'org-001', 'asset-001', 'bp-003', 'supports'),
    ('apm-008', 'org-001', 'asset-003', 'bp-004', 'critical'),
    ('apm-009', 'org-001', 'asset-005', 'bp-005', 'critical');

-- Vendors
INSERT OR IGNORE INTO vendors (id, organization_id, name, description, vendor_tier, vendor_type, has_data_access, data_types_accessed, current_risk_score, certifications, status, contract_value)
VALUES 
    ('vendor-001', 'org-001', 'Stripe', 'Payment processing provider', 'critical', 'SaaS', 1, '["PCI", "Financial"]', 15, '["SOC2", "PCI_DSS", "ISO27001"]', 'active', 250000),
    ('vendor-002', 'org-001', 'AWS', 'Cloud infrastructure provider', 'critical', 'IaaS', 1, '["PII", "PHI", "Financial", "Proprietary"]', 12, '["SOC2", "ISO27001", "HIPAA", "FedRAMP"]', 'active', 1200000),
    ('vendor-003', 'org-001', 'Salesforce', 'CRM platform', 'high', 'SaaS', 1, '["PII", "Financial"]', 18, '["SOC2", "ISO27001"]', 'active', 180000),
    ('vendor-004', 'org-001', 'Datadog', 'Observability platform', 'medium', 'SaaS', 0, '["Logs", "Metrics"]', 22, '["SOC2"]', 'active', 75000),
    ('vendor-005', 'org-001', 'Acme Consulting', 'IT consulting services', 'low', 'Consultant', 0, '[]', 45, '[]', 'under_review', 50000);

-- Vendor to Process Mappings
INSERT OR IGNORE INTO vendor_process_mappings (id, organization_id, vendor_id, business_process_id, dependency_level, service_description)
VALUES 
    ('vpm-001', 'org-001', 'vendor-001', 'bp-001', 'critical', 'Payment gateway services'),
    ('vpm-002', 'org-001', 'vendor-002', 'bp-001', 'critical', 'Cloud hosting'),
    ('vpm-003', 'org-001', 'vendor-002', 'bp-002', 'critical', 'Cloud hosting'),
    ('vpm-004', 'org-001', 'vendor-002', 'bp-003', 'critical', 'Cloud hosting'),
    ('vpm-005', 'org-001', 'vendor-003', 'bp-003', 'supports', 'CRM integration'),
    ('vpm-006', 'org-001', 'vendor-004', 'bp-004', 'supports', 'Monitoring and logging');

-- Vendor Incidents
INSERT OR IGNORE INTO vendor_incidents (id, organization_id, vendor_id, incident_type, severity, title, description, source, detected_at, status, our_data_affected)
VALUES 
    ('incident-001', 'org-001', 'vendor-003', 'outage', 'high', 'Salesforce Service Degradation - EMEA Region', 'Intermittent connectivity issues affecting EMEA customers', 'vendor_notification', datetime('now', '-1 day'), 'monitoring', 0),
    ('incident-002', 'org-001', 'vendor-004', 'breach', 'medium', 'Datadog Reports Unauthorized Access to Customer Metadata', 'Third-party accessed customer organization names and billing contacts', 'news', datetime('now', '-4 days'), 'investigating', 1);

-- Risk Items
INSERT OR IGNORE INTO risk_items (id, organization_id, title, description, risk_source, external_reference, category, affected_asset_id, inherent_likelihood, inherent_impact, inherent_score, residual_score, business_impact_score, context_priority_score, context_priority_reason, financial_exposure, status, assignee_id, due_date)
VALUES 
    ('risk-001', 'org-001', 'SQL Injection Vulnerability in Payment API', 'Critical SQL injection vulnerability discovered in the payment processing API endpoint', 'vulnerability_scan', 'CVE-2024-1234', 'vulnerability', 'asset-001', 0.8, 0.95, 76, 25, 95, 92, 'Affects Payment Processing ($50K/hr revenue impact), 3 customer-facing processes', 2500000, 'open', 'user-001', date('now', '+7 days')),
    ('risk-002', 'org-001', 'Outdated SSL Certificate on Customer Portal', 'SSL certificate using deprecated TLS 1.1 protocol', 'audit_finding', NULL, 'configuration', 'asset-002', 0.6, 0.7, 42, 15, 68, 71, 'Customer-facing application, regulatory compliance requirement (PCI-DSS)', 500000, 'in_progress', 'user-002', date('now', '+21 days')),
    ('risk-003', 'org-001', 'Unencrypted PII in Analytics Database', 'Personal identifiable information stored without encryption in the analytics cluster', 'self_assessment', NULL, 'compliance', 'asset-003', 0.4, 0.9, 36, 36, 82, 78, 'Contains PII, GDPR Article 32 violation, potential €20M fine', 20000000, 'open', 'user-003', date('now', '+30 days')),
    ('risk-004', 'org-001', 'Missing MFA on Admin Accounts', 'Administrative accounts lack multi-factor authentication', 'penetration_test', NULL, 'configuration', 'asset-004', 0.5, 0.85, 43, 20, 90, 85, 'Gateway to all critical systems, SOC2 CC6.1 control gap', 5000000, 'in_progress', 'user-002', date('now', '+4 days')),
    ('risk-005', 'org-001', 'Log4j Vulnerability in Legacy System', 'CVE-2021-44228 (Log4Shell) present in legacy inventory system', 'vulnerability_scan', 'CVE-2021-44228', 'vulnerability', 'asset-005', 0.7, 0.8, 56, 40, 45, 52, 'Internal system only, no customer data, limited blast radius', 100000, 'open', 'user-002', date('now', '+45 days'));

-- Compliance Frameworks
INSERT OR IGNORE INTO compliance_frameworks (id, code, name, version, authority)
VALUES 
    ('fw-001', 'SOC2', 'SOC 2 Type II', '2017', 'AICPA'),
    ('fw-002', 'ISO27001', 'ISO/IEC 27001', '2022', 'ISO'),
    ('fw-003', 'GDPR', 'General Data Protection Regulation', '2016/679', 'EU'),
    ('fw-004', 'PCI_DSS', 'Payment Card Industry Data Security Standard', '4.0', 'PCI SSC'),
    ('fw-005', 'HIPAA', 'Health Insurance Portability and Accountability Act', '1996', 'HHS'),
    ('fw-006', 'NIST_CSF', 'NIST Cybersecurity Framework', '2.0', 'NIST');

-- Controls
INSERT OR IGNORE INTO controls (id, organization_id, control_id, name, description, category, control_type, implementation_type, implementation_status, effectiveness_rating, owner_id)
VALUES 
    ('ctrl-001', 'org-001', 'AC-001', 'Access Control Policy', 'Establish and maintain access control policies', 'Access Control', 'preventive', 'administrative', 'implemented', 'effective', 'user-001'),
    ('ctrl-002', 'org-001', 'AC-002', 'Multi-Factor Authentication', 'Require MFA for all privileged accounts', 'Access Control', 'preventive', 'technical', 'in_progress', 'partially_effective', 'user-002'),
    ('ctrl-003', 'org-001', 'DP-001', 'Data Encryption at Rest', 'Encrypt all sensitive data at rest using AES-256', 'Data Protection', 'preventive', 'technical', 'implemented', 'effective', 'user-001'),
    ('ctrl-004', 'org-001', 'DP-002', 'Data Encryption in Transit', 'Use TLS 1.2+ for all data in transit', 'Data Protection', 'preventive', 'technical', 'implemented', 'effective', 'user-002'),
    ('ctrl-005', 'org-001', 'VM-001', 'Vulnerability Management', 'Regular vulnerability scanning and remediation', 'Vulnerability Management', 'detective', 'technical', 'implemented', 'partially_effective', 'user-001'),
    ('ctrl-006', 'org-001', 'IR-001', 'Incident Response Plan', 'Documented incident response procedures', 'Incident Response', 'corrective', 'administrative', 'implemented', 'effective', 'user-001'),
    ('ctrl-007', 'org-001', 'AU-001', 'Audit Logging', 'Comprehensive audit logging for all systems', 'Audit', 'detective', 'technical', 'implemented', 'effective', 'user-002');

-- Sample Notifications
INSERT OR IGNORE INTO notifications (id, organization_id, user_id, type, title, message, priority, link_type, link_id)
VALUES 
    ('notif-001', 'org-001', 'user-001', 'risk_alert', 'Critical Risk Detected', 'SQL Injection vulnerability found in payment-api-prod', 'urgent', 'risk', 'risk-001'),
    ('notif-002', 'org-001', 'user-001', 'vendor_incident', 'Vendor Security Incident', 'Datadog reports unauthorized access to customer metadata', 'high', 'vendor_incident', 'incident-002'),
    ('notif-003', 'org-001', 'user-002', 'task_due', 'Risk Remediation Due Soon', 'MFA implementation due in 4 days', 'normal', 'risk', 'risk-004');
