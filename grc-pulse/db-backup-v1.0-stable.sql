PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE d1_migrations(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO "d1_migrations" VALUES(1,'0001_initial_schema.sql','2025-12-24 12:06:52');
INSERT INTO "d1_migrations" VALUES(2,'0002_maturity_assessment.sql','2025-12-24 18:16:41');
INSERT INTO "d1_migrations" VALUES(3,'0003_pentest_sync_support.sql','2025-12-30 11:01:47');
INSERT INTO "d1_migrations" VALUES(4,'0004_compliance_engine.sql','2025-12-30 13:11:47');
INSERT INTO "d1_migrations" VALUES(5,'0005_framework_mappings.sql','2025-12-30 13:40:29');
INSERT INTO "d1_migrations" VALUES(6,'0006_organization_profile.sql','2025-12-30 13:52:29');
INSERT INTO "d1_migrations" VALUES(7,'0007_compliance_history.sql','2026-01-12 17:52:25');
INSERT INTO "d1_migrations" VALUES(8,'0008_extended_history.sql','2026-01-12 17:52:25');
INSERT INTO "d1_migrations" VALUES(9,'0009_control_risk_asset_linking.sql','2026-01-12 17:52:25');
INSERT INTO "d1_migrations" VALUES(10,'0010_audit_management.sql','2026-01-12 17:52:25');
CREATE TABLE organizations (
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
INSERT INTO "organizations" VALUES('org-001','Acme Corporation','acme-corp','Technology','enterprise','enterprise','{}',NULL,'["SOC2", "ISO27001", "GDPR", "PCI_DSS"]','2025-12-24 12:07:01','2025-12-24 12:07:01',1);
CREATE TABLE users (
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
INSERT INTO "users" VALUES('user-001','org-001','admin@acme.com',NULL,'Khaled','Gamo','Khaled Gamo',NULL,'CISO','Security','active','org_admin',NULL,'2025-12-24 12:07:01','2025-12-24 12:07:01');
INSERT INTO "users" VALUES('user-002','org-001','mike@acme.com',NULL,'Mike','Johnson','Mike Johnson',NULL,'Security Engineer','IT Operations','active','analyst',NULL,'2025-12-24 12:07:01','2025-12-24 12:07:01');
INSERT INTO "users" VALUES('user-003','org-001','emily@acme.com',NULL,'Emily','Davis','Emily Davis',NULL,'Data Protection Officer','Legal','active','security_lead',NULL,'2025-12-24 12:07:01','2025-12-24 12:07:01');
CREATE TABLE business_units (
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
INSERT INTO "business_units" VALUES('bu-001','org-001','Engineering','Product development and engineering',NULL,NULL,50000000,NULL,1,'critical','2025-12-24 12:07:01','2025-12-24 12:07:01');
INSERT INTO "business_units" VALUES('bu-002','org-001','Sales','Sales and business development',NULL,NULL,80000000,NULL,1,'critical','2025-12-24 12:07:01','2025-12-24 12:07:01');
INSERT INTO "business_units" VALUES('bu-003','org-001','Operations','IT and business operations',NULL,NULL,0,NULL,0,'high','2025-12-24 12:07:01','2025-12-24 12:07:01');
INSERT INTO "business_units" VALUES('bu-004','org-001','Finance','Financial operations',NULL,NULL,0,NULL,0,'high','2025-12-24 12:07:01','2025-12-24 12:07:01');
CREATE TABLE business_processes (
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
INSERT INTO "business_processes" VALUES('bp-001','org-001','bu-002','Payment Processing','Handles all customer payment transactions',NULL,'critical',1,1,1,50000,0,1,NULL,'active','2025-12-24 12:07:01','2025-12-24 12:07:01');
INSERT INTO "business_processes" VALUES('bp-002','org-001','bu-001','Customer Portal','Customer-facing web application',NULL,'high',1,1,0,10000,0,4,NULL,'active','2025-12-24 12:07:01','2025-12-24 12:07:01');
INSERT INTO "business_processes" VALUES('bp-003','org-001','bu-002','Order Management','Order processing and fulfillment',NULL,'high',1,0,0,25000,0,2,NULL,'active','2025-12-24 12:07:01','2025-12-24 12:07:01');
INSERT INTO "business_processes" VALUES('bp-004','org-001','bu-001','Customer Analytics','Data analytics and reporting',NULL,'medium',0,0,1,5000,0,24,NULL,'active','2025-12-24 12:07:01','2025-12-24 12:07:01');
INSERT INTO "business_processes" VALUES('bp-005','org-001','bu-003','Inventory Management','Inventory tracking and management',NULL,'medium',0,0,0,2000,0,8,NULL,'active','2025-12-24 12:07:01','2025-12-24 12:07:01');
CREATE TABLE assets (
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
INSERT INTO "assets" VALUES('asset-001','org-001',NULL,'payment-api-prod','Production payment processing API','application','aws',NULL,'us-east-1','critical','restricted',0,0,1,NULL,NULL,'user-001',NULL,'active','{}','2025-12-24 12:07:01','2025-12-24 12:07:01',NULL);
INSERT INTO "assets" VALUES('asset-002','org-001',NULL,'customer-portal','Customer-facing web portal','application','aws',NULL,'us-east-1','high','confidential',1,0,0,NULL,NULL,'user-002',NULL,'active','{}','2025-12-24 12:07:01','2025-12-24 12:07:01',NULL);
INSERT INTO "assets" VALUES('asset-003','org-001',NULL,'analytics-db-cluster','Customer analytics database cluster','database','aws',NULL,'us-west-2','high','confidential',1,0,0,NULL,NULL,'user-003',NULL,'active','{}','2025-12-24 12:07:01','2025-12-24 12:07:01',NULL);
INSERT INTO "assets" VALUES('asset-004','org-001',NULL,'identity-provider','Centralized identity management','application','azure',NULL,'eastus','critical','restricted',1,0,0,NULL,NULL,'user-001',NULL,'active','{}','2025-12-24 12:07:01','2025-12-24 12:07:01',NULL);
INSERT INTO "assets" VALUES('asset-005','org-001',NULL,'legacy-inventory','Legacy inventory management system','application','on_premise',NULL,NULL,'medium','internal',0,0,0,NULL,NULL,'user-002',NULL,'active','{}','2025-12-24 12:07:01','2025-12-24 12:07:01',NULL);
INSERT INTO "assets" VALUES('asset-006','org-001',NULL,'payment-db','Payment database','database','aws',NULL,'us-east-1','critical','restricted',0,0,1,NULL,NULL,'user-001',NULL,'active','{}','2025-12-24 12:07:01','2025-12-24 12:07:01',NULL);
INSERT INTO "assets" VALUES('asset-007','org-001',NULL,'payment-cache','Payment Redis cache','database','aws',NULL,'us-east-1','high','confidential',0,0,0,NULL,NULL,'user-002',NULL,'active','{}','2025-12-24 12:07:01','2025-12-24 12:07:01',NULL);
INSERT INTO "assets" VALUES('asset-008','org-001',NULL,'cdn-cloudfront','CloudFront CDN distribution','network_device','aws',NULL,'global','high','public',0,0,0,NULL,NULL,'user-002',NULL,'active','{}','2025-12-24 12:07:01','2025-12-24 12:07:01',NULL);
INSERT INTO "assets" VALUES('asset-009','org-001',NULL,'order-service','Order processing microservice','application','aws',NULL,'us-east-1','high','confidential',1,0,0,NULL,NULL,'user-002',NULL,'active','{}','2025-12-24 12:07:01','2025-12-24 12:07:01',NULL);
INSERT INTO "assets" VALUES('asset-mjme0unj-gvx8xzt7b','org-001',NULL,'IGW Router','the Main Internet getway router','network_device','on_premise',NULL,'Hedqurater','critical','restricted',0,0,0,NULL,NULL,NULL,NULL,'active','{}','2025-12-26 04:44:45','2025-12-26 04:44:45',NULL);
INSERT INTO "assets" VALUES('asset-mjoahkxr-1hb40hc68','org-001',NULL,'Core  Router','the  MPLS P Router ','network_device','on_premise',NULL,'Head quarater','critical','confidential',0,0,0,NULL,NULL,NULL,NULL,'active','{}','2025-12-27 12:41:19','2025-12-27 12:41:19',NULL);
INSERT INTO "assets" VALUES('asset-pt-6219392d','org-001','pentest:asset-001','Corporate Website','Main corporate website','application','on_premise',NULL,NULL,'high','public',0,0,0,NULL,NULL,NULL,NULL,'active','{"source":"pentest_pulse","url":"https://www.acme-corp.com","original_type":"web_application","pentest_tags":"[]","pentest_findings_count":4}','2025-12-30 12:17:38','2025-12-30 12:54:59',NULL);
INSERT INTO "assets" VALUES('asset-pt-d2a4a02a','org-001','pentest:asset-002','Customer Portal','Customer self-service portal','application','on_premise',NULL,NULL,'critical','confidential',0,0,0,NULL,NULL,NULL,NULL,'active','{"source":"pentest_pulse","url":"https://portal.acme-corp.com","original_type":"web_application","pentest_tags":"[]","pentest_findings_count":2}','2025-12-30 12:17:38','2025-12-30 12:54:59',NULL);
INSERT INTO "assets" VALUES('asset-pt-b4ba6c07','org-001','pentest:asset-003','REST API Gateway','Main API gateway for mobile apps','application','on_premise',NULL,NULL,'critical','restricted',0,0,0,NULL,NULL,NULL,NULL,'active','{"source":"pentest_pulse","url":"https://api.acme-corp.com","original_type":"api","pentest_tags":"[]","pentest_findings_count":2}','2025-12-30 12:17:38','2025-12-30 12:54:59',NULL);
INSERT INTO "assets" VALUES('asset-pt-11c781c9','org-001','pentest:asset-004','Internal HR System','HR management system','application','on_premise',NULL,NULL,'high','confidential',0,0,0,NULL,NULL,NULL,NULL,'active','{"source":"pentest_pulse","url":"https://hr.internal.acme-corp.com","original_type":"web_application","pentest_tags":"[]","pentest_findings_count":0}','2025-12-30 12:17:38','2025-12-30 12:54:59',NULL);
INSERT INTO "assets" VALUES('asset-pt-f5d1850a','org-001','pentest:asset-005','Database Server','Primary PostgreSQL database','database','on_premise',NULL,NULL,'critical','restricted',0,0,0,NULL,NULL,NULL,NULL,'active','{"source":"pentest_pulse","url":null,"original_type":"database","pentest_tags":"[]","pentest_findings_count":0}','2025-12-30 12:17:38','2025-12-30 12:55:00',NULL);
CREATE TABLE asset_relationships (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    source_asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    target_asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL CHECK (relationship_type IN ('depends_on', 'connects_to', 'hosts', 'stores_data_in')),
    metadata TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(source_asset_id, target_asset_id, relationship_type)
);
INSERT INTO "asset_relationships" VALUES('rel-001','org-001','asset-001','asset-006','depends_on','{}','2025-12-24 12:07:01');
INSERT INTO "asset_relationships" VALUES('rel-002','org-001','asset-001','asset-007','depends_on','{}','2025-12-24 12:07:01');
INSERT INTO "asset_relationships" VALUES('rel-003','org-001','asset-002','asset-008','depends_on','{}','2025-12-24 12:07:01');
INSERT INTO "asset_relationships" VALUES('rel-004','org-001','asset-009','asset-006','depends_on','{}','2025-12-24 12:07:01');
INSERT INTO "asset_relationships" VALUES('rel-005','org-001','asset-002','asset-004','depends_on','{}','2025-12-24 12:07:01');
CREATE TABLE asset_process_mappings (
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
INSERT INTO "asset_process_mappings" VALUES('apm-001','org-001','asset-001','bp-001','critical',NULL,'2025-12-24 12:07:01',NULL);
INSERT INTO "asset_process_mappings" VALUES('apm-002','org-001','asset-006','bp-001','critical',NULL,'2025-12-24 12:07:01',NULL);
INSERT INTO "asset_process_mappings" VALUES('apm-003','org-001','asset-007','bp-001','supports',NULL,'2025-12-24 12:07:01',NULL);
INSERT INTO "asset_process_mappings" VALUES('apm-004','org-001','asset-002','bp-002','critical',NULL,'2025-12-24 12:07:01',NULL);
INSERT INTO "asset_process_mappings" VALUES('apm-005','org-001','asset-008','bp-002','supports',NULL,'2025-12-24 12:07:01',NULL);
INSERT INTO "asset_process_mappings" VALUES('apm-006','org-001','asset-009','bp-003','critical',NULL,'2025-12-24 12:07:01',NULL);
INSERT INTO "asset_process_mappings" VALUES('apm-007','org-001','asset-001','bp-003','supports',NULL,'2025-12-24 12:07:01',NULL);
INSERT INTO "asset_process_mappings" VALUES('apm-008','org-001','asset-003','bp-004','critical',NULL,'2025-12-24 12:07:01',NULL);
INSERT INTO "asset_process_mappings" VALUES('apm-009','org-001','asset-005','bp-005','critical',NULL,'2025-12-24 12:07:01',NULL);
CREATE TABLE vendors (
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
INSERT INTO "vendors" VALUES('vendor-001','org-001','Stripe',NULL,'Payment processing provider',NULL,NULL,'critical','SaaS',1,'["PCI", "Financial"]','[]',NULL,NULL,250000,NULL,NULL,NULL,NULL,15,NULL,'["SOC2", "PCI_DSS", "ISO27001"]','active',NULL,NULL,'2025-12-24 12:07:01','2025-12-24 12:07:01',NULL);
INSERT INTO "vendors" VALUES('vendor-002','org-001','AWS',NULL,'Cloud infrastructure provider',NULL,NULL,'critical','IaaS',1,'["PII", "PHI", "Financial", "Proprietary"]','[]',NULL,NULL,1200000,NULL,NULL,NULL,NULL,12,NULL,'["SOC2", "ISO27001", "HIPAA", "FedRAMP"]','active',NULL,NULL,'2025-12-24 12:07:01','2025-12-24 12:07:01',NULL);
INSERT INTO "vendors" VALUES('vendor-003','org-001','Salesforce',NULL,'CRM platform',NULL,NULL,'high','SaaS',1,'["PII", "Financial"]','[]',NULL,NULL,180000,NULL,NULL,NULL,NULL,18,NULL,'["SOC2", "ISO27001"]','active',NULL,NULL,'2025-12-24 12:07:01','2025-12-24 12:07:01',NULL);
INSERT INTO "vendors" VALUES('vendor-004','org-001','Datadog',NULL,'Observability platform',NULL,NULL,'medium','SaaS',0,'["Logs", "Metrics"]','[]',NULL,NULL,75000,NULL,NULL,NULL,NULL,22,NULL,'["SOC2"]','active',NULL,NULL,'2025-12-24 12:07:01','2025-12-24 12:07:01',NULL);
INSERT INTO "vendors" VALUES('vendor-005','org-001','Acme Consulting',NULL,'IT consulting services',NULL,NULL,'low','Consultant',0,'[]','[]',NULL,NULL,50000,NULL,NULL,NULL,NULL,45,NULL,'[]','under_review',NULL,NULL,'2025-12-24 12:07:01','2025-12-24 12:07:01',NULL);
CREATE TABLE vendor_process_mappings (
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
INSERT INTO "vendor_process_mappings" VALUES('vpm-001','org-001','vendor-001','bp-001','critical','Payment gateway services',0,'2025-12-24 12:07:01');
INSERT INTO "vendor_process_mappings" VALUES('vpm-002','org-001','vendor-002','bp-001','critical','Cloud hosting',0,'2025-12-24 12:07:01');
INSERT INTO "vendor_process_mappings" VALUES('vpm-003','org-001','vendor-002','bp-002','critical','Cloud hosting',0,'2025-12-24 12:07:01');
INSERT INTO "vendor_process_mappings" VALUES('vpm-004','org-001','vendor-002','bp-003','critical','Cloud hosting',0,'2025-12-24 12:07:01');
INSERT INTO "vendor_process_mappings" VALUES('vpm-005','org-001','vendor-003','bp-003','supports','CRM integration',0,'2025-12-24 12:07:01');
INSERT INTO "vendor_process_mappings" VALUES('vpm-006','org-001','vendor-004','bp-004','supports','Monitoring and logging',0,'2025-12-24 12:07:01');
CREATE TABLE vendor_incidents (
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
INSERT INTO "vendor_incidents" VALUES('incident-001','org-001','vendor-003','outage','high','Salesforce Service Degradation - EMEA Region','Intermittent connectivity issues affecting EMEA customers','vendor_notification',NULL,0,0,0,NULL,NULL,'[]','monitoring',0,NULL,0,'2025-12-23 12:07:01',NULL,'2025-12-24 12:07:01','2025-12-24 12:07:01');
INSERT INTO "vendor_incidents" VALUES('incident-002','org-001','vendor-004','breach','medium','Datadog Reports Unauthorized Access to Customer Metadata','Third-party accessed customer organization names and billing contacts','news',NULL,0,0,1,NULL,NULL,'[]','investigating',0,NULL,0,'2025-12-20 12:07:01',NULL,'2025-12-24 12:07:01','2025-12-24 12:07:01');
CREATE TABLE risk_items (
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
INSERT INTO "risk_items" VALUES('risk-002','org-001','Outdated SSL Certificate on Customer Portal','SSL certificate using deprecated TLS 1.1 protocol','audit_finding',NULL,'configuration',NULL,'asset-002',NULL,NULL,0.6,0.7,42,NULL,NULL,15,68,500000,71,'Customer-facing application, regulatory compliance requirement (PCI-DSS)','in_progress','user-002','2026-01-14',NULL,NULL,NULL,'[]','{}','[]','2025-12-24 12:07:01',NULL,NULL,'2025-12-24 12:07:01','2026-01-08 16:36:54',NULL);
INSERT INTO "risk_items" VALUES('risk-003','org-001','Unencrypted PII in Analytics Database','Personal identifiable information stored without encryption in the analytics cluster','self_assessment',NULL,'compliance',NULL,'asset-003',NULL,NULL,0.4,0.9,36,NULL,NULL,36,82,20000000,78,'Contains PII, GDPR Article 32 violation, potential €20M fine','open','user-003','2026-01-23',NULL,NULL,NULL,'[]','{}','[]','2025-12-24 12:07:01',NULL,NULL,'2025-12-24 12:07:01','2025-12-24 12:07:01',NULL);
INSERT INTO "risk_items" VALUES('risk-pt-mk5ahg2p-i30tvew59','org-001','Cross-Site Scripting (XSS) in Search','The search functionality reflects user input without proper encoding','penetration_test','pentest:find-002|project:PT1-Q4-2024|','vulnerability','A03:2021',NULL,NULL,NULL,0.8,0.8,64,NULL,NULL,NULL,NULL,NULL,64,'Imported from Pentest Pulse','mitigated',NULL,NULL,'Implement proper output encoding. Use Content Security Policy headers.',NULL,NULL,'[]','{"source":"pentest_pulse","risk_score":16,"likelihood":4,"impact":4,"severity":"high","technical_details":{"severity":"high","cvss_score":null,"cvss_vector":null,"proof_of_concept":null,"affected_url":"https://www.almadar.com/search","affected_parameter":null,"affected_component":null,"cwe_id":null,"cve_id":null}}','[]','2025-12-28 12:17:10','2026-01-12 15:39:46',NULL,'2026-01-08 10:13:17','2026-01-12 15:39:46',NULL);
INSERT INTO "risk_items" VALUES('risk-pt-mk5ahg4a-1z68w2cyl','org-001','Missing Security Headers','Several important security headers are missing from HTTP responses','penetration_test','pentest:find-003|project:PT1-Q4-2024|','vulnerability','A05:2021',NULL,NULL,NULL,0.6,0.6,36,NULL,NULL,NULL,NULL,NULL,36,'Imported from Pentest Pulse','in_progress',NULL,NULL,'Configure web server to send appropriate security headers.',NULL,NULL,'[]','{"source":"pentest_pulse","risk_score":9,"likelihood":3,"impact":3,"severity":"medium","technical_details":{"severity":"medium","cvss_score":null,"cvss_vector":null,"proof_of_concept":null,"affected_url":"https://www.almadar.com","affected_parameter":null,"affected_component":null,"cwe_id":null,"cve_id":null}}','[]','2025-12-28 12:17:10','2026-01-12 15:39:46',NULL,'2026-01-08 10:13:17','2026-01-12 15:39:46',NULL);
INSERT INTO "risk_items" VALUES('risk-pt-mk5ahg5t-zdhvlij0x','org-001','Insecure Direct Object Reference','Users can access other users'' data by modifying the user ID in the URL','penetration_test','pentest:find-004|project:PT2-Q4-2024|','vulnerability','A01:2021',NULL,NULL,NULL,0.8,1,80,NULL,NULL,NULL,NULL,NULL,80,'Imported from Pentest Pulse','mitigated',NULL,NULL,'Implement proper authorization checks for all data access.',NULL,NULL,'[]','{"source":"pentest_pulse","risk_score":20,"likelihood":4,"impact":5,"severity":"high","technical_details":{"severity":"high","cvss_score":null,"cvss_vector":null,"proof_of_concept":null,"affected_url":"https://portal.almadar.com/api/users/123","affected_parameter":null,"affected_component":null,"cwe_id":null,"cve_id":null}}','[]','2025-12-28 12:17:10','2026-01-12 15:39:47',NULL,'2026-01-08 10:13:17','2026-01-12 15:39:47',NULL);
INSERT INTO "risk_items" VALUES('risk-pt-mk5ahg7l-m2ldk99p2','org-001','Weak Password Policy','The application accepts weak passwords','penetration_test','pentest:find-005|project:PT2-Q4-2024|','vulnerability','A07:2021',NULL,NULL,NULL,0.6,0.8,48,NULL,NULL,NULL,NULL,NULL,48,'Imported from Pentest Pulse','mitigated',NULL,NULL,'Implement strong password policy: minimum 12 characters, complexity requirements, check against breached passwords.',NULL,NULL,'[]','{"source":"pentest_pulse","risk_score":12,"likelihood":3,"impact":4,"severity":"medium","technical_details":{"severity":"medium","cvss_score":null,"cvss_vector":null,"proof_of_concept":null,"affected_url":"https://portal.almadar.com/register","affected_parameter":null,"affected_component":null,"cwe_id":null,"cve_id":null}}','[]','2025-12-28 12:17:10','2026-01-12 15:39:47',NULL,'2026-01-08 10:13:18','2026-01-12 15:39:47',NULL);
INSERT INTO "risk_items" VALUES('risk-pt-mk5ahgb4-rk2uloyzz','org-001','IDOR finding in mobi app ','The Attacker with normal access can get critical information and data like other user information ','penetration_test','pentest:find-mjprd7p7-gjf6ufuf9|project:PT251-Q4-2025|','vulnerability','A01:2021',NULL,NULL,NULL,0.8,1,80,NULL,NULL,NULL,NULL,NULL,80,'Imported from Pentest Pulse','mitigated',NULL,NULL,'applay access control to all links and test it from pentester',NULL,NULL,'[]','{"source":"pentest_pulse","risk_score":20,"likelihood":4,"impact":5,"severity":"high","technical_details":{"severity":"high","cvss_score":null,"cvss_vector":null,"proof_of_concept":"","affected_url":"https://www.almadarmobi.ly/admin/backup","affected_parameter":null,"affected_component":null,"cwe_id":null,"cve_id":null}}','[]','2025-12-28 13:21:35','2026-01-12 15:39:45',NULL,'2026-01-08 10:13:18','2026-01-12 15:39:45',NULL);
INSERT INTO "risk_items" VALUES('risk-pt-mk5bpb2f-enbofu5z7','org-001','TLS Version 1.0 Protocol Detection',replace('The remote service accepts connections encrypted using TLS 1.0. TLS 1.0 has a number of cryptographic design flaws. Modern implementations of TLS 1.0 mitigate these problems, but newer versions of TLS like 1.2 and 1.3 are designed against these flaws and should be used whenever possible.\n\nAs of March 31, 2020, Endpoints that aren’t enabled for TLS 1.2 and higher will no longer function properly with major web browsers and major vendors.\n\nPCI DSS v3.2 requires that TLS 1.0 be disabled entirely by June 30, 2018, except for POS POI terminals (and the SSL/TLS termination points to which they connect) that can be verified as not being susceptible to any known exploits.','\n',char(10)),'penetration_test','pentest:find-9a7f9a52-8615f3f1-|project:PT251-Q4-2025|','vulnerability',NULL,NULL,NULL,NULL,0.8,0.8,64,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'in_progress',NULL,NULL,'Enable support for TLS 1.2 and 1.3, and disable support for TLS 1.0.',NULL,NULL,'[]','{"source":"pentest_pulse","risk_score":16,"likelihood":4,"impact":4,"severity":"medium","technical_details":{"severity":"medium","cvss_score":6.1,"cvss_vector":"CVSS2#AV:N/AC:H/Au:N/C:C/I:P/A:N","proof_of_concept":null,"affected_url":null,"affected_parameter":null,"affected_component":null,"cwe_id":null,"cve_id":null}}','[]','2026-01-08 10:47:24','2026-01-12 15:39:45',NULL,'2026-01-08 10:47:24','2026-01-12 15:39:45',NULL);
INSERT INTO "risk_items" VALUES('risk-pt-mk5c60wy-1vwnxiox6','org-001','Apache HTTP Server &apos;httpOnly&apos; Cookie Information Disclosure Vulnerability',replace('<result id="7ffcbe5c-03fa-4342-89f7-9e546f1c625c"><name>Apache HTTP Server &apos;httpOnly&apos; Cookie Information Disclosure Vulnerability</name><owner><name>admin</name></owner><comment></comment><creation_time>2018-02-19T19:49:27Z</creation_time><modification_time>2018-02-19T19:49:27Z</modification_time><user_tags><count>0</count></user_tags><host>192.168.222.131</host><port>80/tcp</port><nvt oid="1.3.6.1.4.1.25623.1.0.902830"><name>Apache HTTP Server &apos;httpOnly&apos; Cookie Information Disclosure Vulnerability</name><family>Web Servers</family><cvss_base>4.3</cvss_base><cve>CVE-2012-0053</cve><bid>51706</bid><xref>URL:http://secunia.com/advisories/47779, URL:http://www.exploit-db.com/exploits/18442, URL:http://rhn.redhat.com/errata/RHSA-2012-0128.html, URL:http://httpd.apache.org/security/vulnerabilities_22.html, URL:http://svn.apache.org/viewvc?view=revision&amp;revision=1235454, URL:http://lists.opensuse.org/opensuse-security-announce/2012-02/msg00026.html</xref><tags>cvss_base_vector=AV:N/AC:M/Au:N/C:P/I:N/A:N|impact=Successful exploitation will allow attackers to obtain sensitive information\n  that may aid in further attacks.\n\n  Impact Level: Application|affected=Apache HTTP Server versions 2.2.0 through 2.2.21|insight=The flaw is due to an error within the default error response for\n  status code 400 when no custom ErrorDocument is configured, which can be\n  exploited to expose &apos;httpOnly&apos; cookies.|solution=Upgrade to Apache HTTP Server version 2.2.22 or later,\n  For updates refer to http://httpd.apache.org/|summary=This host is running Apache HTTP Server and is prone to cookie\n  information disclosure vulnerability.|solution_type=VendorFix|qod_type=remote_vul</tags><cert><cert_ref id="DFN-CERT-2015-0082" type="DFN-CERT"></cert_ref><cert_ref id="DFN-CERT-2014-1592" type="DFN-CERT"></cert_ref><cert_ref id="DFN-CERT-2014-0635" type="DFN-CERT"></cert_ref><cert_ref id="DFN-CERT-2013-1307" type="DFN-CERT"></cert_ref><cert_ref id="DFN-CERT-2012-1276" type="DFN-CERT"></cert_ref><cert_ref id="DFN-CERT-2012-1112" type="DFN-CERT"></cert_ref><cert_ref id="DFN-CERT-2012-0928" type="DFN-CERT"></cert_ref><cert_ref id="DFN-CERT-2012-0758" type="DFN-CERT"></cert_ref><cert_ref id="DFN-CERT-2012-0744" type="DFN-CERT"></cert_ref><cert_ref id="DFN-CERT-2012-0568" type="DFN-CERT"></cert_ref><cert_ref id="DFN-CERT-2012-0425" type="DFN-CERT"></cert_ref><cert_ref id="DFN-CERT-2012-0424" type="DFN-CERT"></cert_ref><cert_ref id="DFN-CERT-2012-0387" type="DFN-CERT"></cert_ref><cert_ref id="DFN-CERT-2012-0343" type="DFN-CERT"></cert_ref><cert_ref id="DFN-CERT-2012-0332" type="DFN-CERT"></cert_ref><cert_ref id="DFN-CERT-2012-0306" type="DFN-CERT"></cert_ref><cert_ref id="DFN-CERT-2012-0264" type="DFN-CERT"></cert_ref><cert_ref id="DFN-CERT-2012-0203" type="DFN-CERT"></cert_ref><cert_ref id="DFN-CERT-2012-0188" type="DFN-CERT"></cert_ref></cert></nvt><scan_nvt_version>$Revision: 6720 $</scan_nvt_version><threat>Medium</threat><severity>4.3</severity><qod><value>99</value><type>remote_vul</type></qod><description></description><original_threat>Medium</original_threat><original_severity>4.3</original_severity><notes></notes><overrides></overrides></result>','\n',char(10)),'penetration_test','pentest:find-5eb8fc36-08890d58-|project:PT3-Q4-2024|','vulnerability',NULL,NULL,NULL,NULL,0.6,0.6,36,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'open',NULL,NULL,NULL,NULL,NULL,'[]','{"source":"pentest_pulse","risk_score":9,"likelihood":3,"impact":3,"severity":"medium","technical_details":{"severity":"medium","cvss_score":4.3,"cvss_vector":null,"proof_of_concept":null,"affected_url":null,"affected_parameter":null,"affected_component":null,"cwe_id":null,"cve_id":null}}','[]','2026-01-08 11:00:24','2026-01-12 15:39:43',NULL,'2026-01-08 11:00:24','2026-01-12 15:39:43',NULL);
INSERT INTO "risk_items" VALUES('risk-pt-mk5c65vz-6p4oyv227','org-001','phpMyAdmin Bookmark Security Bypass Vulnerability','<result id="dd543b39-fb6a-4e21-a9c5-a70a8f4f3dd2"><name>phpMyAdmin Bookmark Security Bypass Vulnerability</name><owner><name>admin</name></owner><comment></comment><creation_time>2018-02-19T19:48:42Z</creation_time><modification_time>2018-02-19T19:48:42Z</modification_time><user_tags><count>0</count></user_tags><detection><result id="3a2e0474-df40-42a7-baeb-bc52212abeac"><details><detail><name>product</name><value>cpe:/a:phpmyadmin:phpmyadmin:3.1.1</value></detail><detail><name>location</name><value>/phpMyAdmin</value></detail><detail><name>source_oid</name><value>1.3.6.1.4.1.25623.1.0.900129</value></detail><detail><name>source_name</name><value>phpMyAdmin Detection</value></detail></details></result>','penetration_test','pentest:find-ca7d284a-d7ef4cb9-|project:PT3-Q4-2024|','vulnerability',NULL,NULL,NULL,NULL,0.2,0.2,4,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'open',NULL,NULL,NULL,NULL,NULL,'[]','{"source":"pentest_pulse","risk_score":1,"likelihood":1,"impact":1,"severity":"medium","technical_details":{"severity":"medium","cvss_score":null,"cvss_vector":null,"proof_of_concept":null,"affected_url":null,"affected_parameter":null,"affected_component":null,"cwe_id":null,"cve_id":null}}','[]','2026-01-08 11:00:30','2026-01-12 15:39:43',NULL,'2026-01-08 11:00:30','2026-01-12 15:39:43',NULL);
INSERT INTO "risk_items" VALUES('risk-pt-mk5c66mt-6zbl6wq3e','org-001','phpinfo() output accessible',replace('The following files are calling the function phpinfo() which disclose potentially sensitive information to the remote attacker:\n\nhttp://192.168.222.131/phpinfo.php\nhttp://192.168.222.131/mutillidae/phpinfo.php','\n',char(10)),'penetration_test','pentest:find-dd37202c-16e6119d-|project:PT3-Q4-2024|','vulnerability',NULL,NULL,NULL,NULL,0.8,0.8,64,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'open',NULL,NULL,NULL,NULL,NULL,'[]','{"source":"pentest_pulse","risk_score":16,"likelihood":4,"impact":4,"severity":"high","technical_details":{"severity":"high","cvss_score":7.5,"cvss_vector":null,"proof_of_concept":null,"affected_url":null,"affected_parameter":null,"affected_component":null,"cwe_id":null,"cve_id":null}}','[]','2026-01-08 11:00:31','2026-01-12 15:39:44',NULL,'2026-01-08 11:00:31','2026-01-12 15:39:44',NULL);
INSERT INTO "risk_items" VALUES('risk-pt-mk5c67wi-j47zcqki4','org-001','PHP-CGI-based setups vulnerability when parsing query string parameters from php files.','Vulnerable url: http://192.168.222.131/cgi-bin/php','penetration_test','pentest:find-a7880492-0cdba356-|project:PT3-Q4-2024|','vulnerability',NULL,NULL,NULL,NULL,0.8,0.8,64,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'open',NULL,NULL,NULL,NULL,NULL,'[]','{"source":"pentest_pulse","risk_score":16,"likelihood":4,"impact":4,"severity":"high","technical_details":{"severity":"high","cvss_score":7.5,"cvss_vector":null,"proof_of_concept":null,"affected_url":null,"affected_parameter":null,"affected_component":null,"cwe_id":null,"cve_id":null}}','[]','2026-01-08 11:00:33','2026-01-12 15:39:44',NULL,'2026-01-08 11:00:33','2026-01-12 15:39:44',NULL);
INSERT INTO "risk_items" VALUES('risk-pt-mk5c685k-pxp2vjcml','org-001','Test HTTP dangerous methods',replace('We could upload the following files via the PUT method at this web server:\n\nhttp://192.168.222.131/dav/puttest1482502572.html\n\nWe could delete the following files via the DELETE method at this web server:\n\nhttp://192.168.222.131/dav/puttest1482502572.html','\n',char(10)),'penetration_test','pentest:find-3bc6c0ef-827433e6-|project:PT3-Q4-2024|','vulnerability',NULL,NULL,NULL,NULL,0.8,0.8,64,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'open',NULL,NULL,NULL,NULL,NULL,'[]','{"source":"pentest_pulse","risk_score":16,"likelihood":4,"impact":4,"severity":"high","technical_details":{"severity":"high","cvss_score":7.5,"cvss_vector":null,"proof_of_concept":null,"affected_url":null,"affected_parameter":null,"affected_component":null,"cwe_id":null,"cve_id":null}}','[]','2026-01-08 11:00:33','2026-01-12 15:39:44',NULL,'2026-01-08 11:00:33','2026-01-12 15:39:44',NULL);
INSERT INTO "risk_items" VALUES('risk-pt-mk5ky9tp-5sp4kcdm1','org-001','SQL Injection in Login Form','The login form is vulnerable to SQL injection attacks','penetration_test','pentest:find-001|project:PT1-Q4-2024|','vulnerability','A03:2021',NULL,NULL,NULL,1,1,100,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'mitigated',NULL,NULL,'Use parameterized queries or prepared statements. Implement input validation.',NULL,NULL,'[]','{"source":"pentest_pulse","risk_score":25,"likelihood":5,"impact":5,"severity":"critical","technical_details":{"severity":"critical","cvss_score":null,"cvss_vector":null,"proof_of_concept":null,"affected_url":"https://www.almadar.com/login","affected_parameter":null,"affected_component":null,"cwe_id":null,"cve_id":null}}','[]','2026-01-08 15:06:19','2026-01-12 15:39:45',NULL,'2026-01-08 15:06:19','2026-01-12 15:39:45',NULL);
INSERT INTO "risk_items" VALUES('risk-aud-mkbhclol-ogqe3q','org-001','Clean desk policy not enforced','the users not locked computers and no screen saver configured ','audit_finding','audit:afnd-mkbhc0rm-hcrgdk|engagement:eng-mkbh42si-47ebav','compliance',NULL,NULL,NULL,NULL,0.6,0.6,36,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'mitigated',NULL,'2026-01-24',NULL,NULL,NULL,'[]','{}','[]','2026-01-12 18:12:06',NULL,'2026-01-13T04:14:21.987Z','2026-01-12 18:12:06','2026-01-13T04:14:21.987Z',NULL);
INSERT INTO "risk_items" VALUES('risk-aud-mkbjlv6u-qs6bwv','org-001','no security awarance program implemeted','no security awarance program implemeted','audit_finding','audit:afnd-mkbjlueo-me6tfd|engagement:eng-mkbh42si-47ebav|controls:A.6.3','compliance',NULL,NULL,NULL,NULL,0.6,0.6,36,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'mitigated',NULL,'2026-01-31',NULL,NULL,NULL,'[]','{}','[]','2026-01-12 19:15:17',NULL,'2026-01-13T04:24:43.557Z','2026-01-12 19:15:17','2026-01-13T04:24:43.557Z',NULL);
CREATE TABLE risk_history (
    id TEXT PRIMARY KEY,
    risk_id TEXT NOT NULL REFERENCES risk_items(id) ON DELETE CASCADE,
    changed_by TEXT REFERENCES users(id),
    change_type TEXT,
    previous_value TEXT,
    new_value TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
INSERT INTO "risk_history" VALUES('hist-mkbhqkap-3b9a3p4ih','risk-aud-mkbhclol-ogqe3q',NULL,'update','{"id":"risk-aud-mkbhclol-ogqe3q","organization_id":"org-001","title":"Clean desk policy not enforced","description":"the users not locked computers and no screen saver configured ","risk_source":"audit_finding","external_reference":"audit:afnd-mkbhc0rm-hcrgdk|engagement:eng-mkbh42si-47ebav","category":"compliance","subcategory":null,"affected_asset_id":null,"affected_vendor_id":null,"affected_control_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"inherent_score":36,"residual_likelihood":null,"residual_impact":null,"residual_score":null,"business_impact_score":null,"financial_exposure":null,"context_priority_score":null,"context_priority_reason":null,"status":"open","assignee_id":null,"due_date":"2026-01-24","remediation_plan":null,"remediation_cost_estimate":null,"remediation_effort_days":null,"evidence_urls":"[]","ai_analysis":"{}","ai_suggested_controls":"[]","discovered_at":"2026-01-12 18:12:06","last_assessed_at":null,"resolved_at":null,"created_at":"2026-01-12 18:12:06","updated_at":"2026-01-12 18:12:06","created_by":null}','{"title":"Clean desk policy not enforced","description":"the users not locked computers and no screen saver configured ","risk_source":"audit_finding","category":"compliance","affected_asset_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"context_priority_score":9,"ai_analysis":"{\"risk_score\":9,\"likelihood\":3,\"impact\":3,\"severity\":\"medium\"}","status":"open","assignee_id":null,"due_date":"2026-01-24"}',NULL,'2026-01-12 18:22:57');
INSERT INTO "risk_history" VALUES('hist-mkbhrarv-rumgczdaw','risk-aud-mkbhclol-ogqe3q',NULL,'update','{"id":"risk-aud-mkbhclol-ogqe3q","organization_id":"org-001","title":"Clean desk policy not enforced","description":"the users not locked computers and no screen saver configured ","risk_source":"audit_finding","external_reference":"audit:afnd-mkbhc0rm-hcrgdk|engagement:eng-mkbh42si-47ebav","category":"compliance","subcategory":null,"affected_asset_id":null,"affected_vendor_id":null,"affected_control_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"inherent_score":36,"residual_likelihood":null,"residual_impact":null,"residual_score":null,"business_impact_score":null,"financial_exposure":null,"context_priority_score":null,"context_priority_reason":null,"status":"open","assignee_id":null,"due_date":"2026-01-24","remediation_plan":null,"remediation_cost_estimate":null,"remediation_effort_days":null,"evidence_urls":"[]","ai_analysis":"{}","ai_suggested_controls":"[]","discovered_at":"2026-01-12 18:12:06","last_assessed_at":null,"resolved_at":null,"created_at":"2026-01-12 18:12:06","updated_at":"2026-01-12T18:22:57.237Z","created_by":null}','{"title":"Clean desk policy not enforced","description":"the users not locked computers and no screen saver configured ","risk_source":"audit_finding","category":"compliance","affected_asset_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"context_priority_score":9,"ai_analysis":"{\"risk_score\":9,\"likelihood\":3,\"impact\":3,\"severity\":\"medium\"}","status":"open","assignee_id":null,"due_date":"2026-01-24"}',NULL,'2026-01-12 18:23:31');
INSERT INTO "risk_history" VALUES('hist-mkc13tkf-w77s4nu9i','risk-aud-mkbjlv6u-qs6bwv',NULL,'update','{"id":"risk-aud-mkbjlv6u-qs6bwv","organization_id":"org-001","title":"no security awarance program implemeted","description":"no security awarance program implemeted","risk_source":"audit_finding","external_reference":"audit:afnd-mkbjlueo-me6tfd|engagement:eng-mkbh42si-47ebav|controls:A.6.3","category":"compliance","subcategory":null,"affected_asset_id":null,"affected_vendor_id":null,"affected_control_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"inherent_score":36,"residual_likelihood":null,"residual_impact":null,"residual_score":null,"business_impact_score":null,"financial_exposure":null,"context_priority_score":null,"context_priority_reason":null,"status":"open","assignee_id":null,"due_date":"2026-01-31","remediation_plan":null,"remediation_cost_estimate":null,"remediation_effort_days":null,"evidence_urls":"[]","ai_analysis":"{}","ai_suggested_controls":"[]","discovered_at":"2026-01-12 19:15:17","last_assessed_at":null,"resolved_at":null,"created_at":"2026-01-12 19:15:17","updated_at":"2026-01-12 19:15:17","created_by":null}','{"title":"no security awarance program implemeted","description":"no security awarance program implemeted","risk_source":"audit_finding","category":"compliance","affected_asset_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"context_priority_score":9,"ai_analysis":"{\"risk_score\":9,\"likelihood\":3,\"impact\":3,\"severity\":\"medium\"}","status":"mitigated","assignee_id":null,"due_date":"2026-01-31"}',NULL,'2026-01-13 03:25:08');
INSERT INTO "risk_history" VALUES('hist-mkc15ur7-o1znftbwe','risk-aud-mkbjlv6u-qs6bwv',NULL,'update','{"id":"risk-aud-mkbjlv6u-qs6bwv","organization_id":"org-001","title":"no security awarance program implemeted","description":"no security awarance program implemeted","risk_source":"audit_finding","external_reference":"audit:afnd-mkbjlueo-me6tfd|engagement:eng-mkbh42si-47ebav|controls:A.6.3","category":"compliance","subcategory":null,"affected_asset_id":null,"affected_vendor_id":null,"affected_control_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"inherent_score":36,"residual_likelihood":null,"residual_impact":null,"residual_score":null,"business_impact_score":null,"financial_exposure":null,"context_priority_score":null,"context_priority_reason":null,"status":"mitigated","assignee_id":null,"due_date":"2026-01-31","remediation_plan":null,"remediation_cost_estimate":null,"remediation_effort_days":null,"evidence_urls":"[]","ai_analysis":"{}","ai_suggested_controls":"[]","discovered_at":"2026-01-12 19:15:17","last_assessed_at":null,"resolved_at":"2026-01-13T03:25:08.539Z","created_at":"2026-01-12 19:15:17","updated_at":"2026-01-13T03:25:08.539Z","created_by":null}','{"title":"no security awarance program implemeted","description":"no security awarance program implemeted","risk_source":"audit_finding","category":"compliance","affected_asset_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"context_priority_score":9,"ai_analysis":"{\"risk_score\":9,\"likelihood\":3,\"impact\":3,\"severity\":\"medium\"}","status":"mitigated","assignee_id":null,"due_date":"2026-01-31"}',NULL,'2026-01-13 03:26:43');
INSERT INTO "risk_history" VALUES('hist-mkc1vc9o-0fe16z4gi','risk-aud-mkbjlv6u-qs6bwv',NULL,'update','{"id":"risk-aud-mkbjlv6u-qs6bwv","organization_id":"org-001","title":"no security awarance program implemeted","description":"no security awarance program implemeted","risk_source":"audit_finding","external_reference":"audit:afnd-mkbjlueo-me6tfd|engagement:eng-mkbh42si-47ebav|controls:A.6.3","category":"compliance","subcategory":null,"affected_asset_id":null,"affected_vendor_id":null,"affected_control_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"inherent_score":36,"residual_likelihood":null,"residual_impact":null,"residual_score":null,"business_impact_score":null,"financial_exposure":null,"context_priority_score":null,"context_priority_reason":null,"status":"mitigated","assignee_id":null,"due_date":"2026-01-31","remediation_plan":null,"remediation_cost_estimate":null,"remediation_effort_days":null,"evidence_urls":"[]","ai_analysis":"{}","ai_suggested_controls":"[]","discovered_at":"2026-01-12 19:15:17","last_assessed_at":null,"resolved_at":"2026-01-13T03:25:08.539Z","created_at":"2026-01-12 19:15:17","updated_at":"2026-01-13T03:26:43.369Z","created_by":null}','{"title":"no security awarance program implemeted","description":"no security awarance program implemeted","risk_source":"audit_finding","category":"compliance","affected_asset_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"context_priority_score":9,"ai_analysis":"{\"risk_score\":9,\"likelihood\":3,\"impact\":3,\"severity\":\"medium\"}","status":"mitigated","assignee_id":null,"due_date":"2026-01-31"}',NULL,'2026-01-13 03:46:32');
INSERT INTO "risk_history" VALUES('hist-mkc1w8ic-3uveo8v16','risk-aud-mkbjlv6u-qs6bwv',NULL,'update','{"id":"risk-aud-mkbjlv6u-qs6bwv","organization_id":"org-001","title":"no security awarance program implemeted","description":"no security awarance program implemeted","risk_source":"audit_finding","external_reference":"audit:afnd-mkbjlueo-me6tfd|engagement:eng-mkbh42si-47ebav|controls:A.6.3","category":"compliance","subcategory":null,"affected_asset_id":null,"affected_vendor_id":null,"affected_control_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"inherent_score":36,"residual_likelihood":null,"residual_impact":null,"residual_score":null,"business_impact_score":null,"financial_exposure":null,"context_priority_score":null,"context_priority_reason":null,"status":"mitigated","assignee_id":null,"due_date":"2026-01-31","remediation_plan":null,"remediation_cost_estimate":null,"remediation_effort_days":null,"evidence_urls":"[]","ai_analysis":"{}","ai_suggested_controls":"[]","discovered_at":"2026-01-12 19:15:17","last_assessed_at":null,"resolved_at":"2026-01-13T03:25:08.539Z","created_at":"2026-01-12 19:15:17","updated_at":"2026-01-13T03:46:32.488Z","created_by":null}','{"title":"no security awarance program implemeted","description":"no security awarance program implemeted","risk_source":"audit_finding","category":"compliance","affected_asset_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"context_priority_score":9,"ai_analysis":"{\"risk_score\":9,\"likelihood\":3,\"impact\":3,\"severity\":\"medium\"}","status":"mitigated","assignee_id":null,"due_date":"2026-01-31"}',NULL,'2026-01-13 03:47:14');
INSERT INTO "risk_history" VALUES('hist-mkc23s3o-04t4pk40d','risk-aud-mkbhclol-ogqe3q',NULL,'update','{"id":"risk-aud-mkbhclol-ogqe3q","organization_id":"org-001","title":"Clean desk policy not enforced","description":"the users not locked computers and no screen saver configured ","risk_source":"audit_finding","external_reference":"audit:afnd-mkbhc0rm-hcrgdk|engagement:eng-mkbh42si-47ebav","category":"compliance","subcategory":null,"affected_asset_id":null,"affected_vendor_id":null,"affected_control_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"inherent_score":36,"residual_likelihood":null,"residual_impact":null,"residual_score":null,"business_impact_score":null,"financial_exposure":null,"context_priority_score":null,"context_priority_reason":null,"status":"open","assignee_id":null,"due_date":"2026-01-24","remediation_plan":null,"remediation_cost_estimate":null,"remediation_effort_days":null,"evidence_urls":"[]","ai_analysis":"{}","ai_suggested_controls":"[]","discovered_at":"2026-01-12 18:12:06","last_assessed_at":null,"resolved_at":null,"created_at":"2026-01-12 18:12:06","updated_at":"2026-01-12T18:23:31.584Z","created_by":null}','{"title":"Clean desk policy not enforced","description":"the users not locked computers and no screen saver configured ","risk_source":"audit_finding","category":"compliance","affected_asset_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"context_priority_score":9,"ai_analysis":"{\"risk_score\":9,\"likelihood\":3,\"impact\":3,\"severity\":\"medium\"}","status":"mitigated","assignee_id":null,"due_date":"2026-01-24"}',NULL,'2026-01-13 03:53:06');
INSERT INTO "risk_history" VALUES('hist-mkc23txm-9nzwx0gmx','risk-aud-mkbhclol-ogqe3q',NULL,'update','{"id":"risk-aud-mkbhclol-ogqe3q","organization_id":"org-001","title":"Clean desk policy not enforced","description":"the users not locked computers and no screen saver configured ","risk_source":"audit_finding","external_reference":"audit:afnd-mkbhc0rm-hcrgdk|engagement:eng-mkbh42si-47ebav","category":"compliance","subcategory":null,"affected_asset_id":null,"affected_vendor_id":null,"affected_control_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"inherent_score":36,"residual_likelihood":null,"residual_impact":null,"residual_score":null,"business_impact_score":null,"financial_exposure":null,"context_priority_score":null,"context_priority_reason":null,"status":"mitigated","assignee_id":null,"due_date":"2026-01-24","remediation_plan":null,"remediation_cost_estimate":null,"remediation_effort_days":null,"evidence_urls":"[]","ai_analysis":"{}","ai_suggested_controls":"[]","discovered_at":"2026-01-12 18:12:06","last_assessed_at":null,"resolved_at":"2026-01-13T03:52:53.498Z","created_at":"2026-01-12 18:12:06","updated_at":"2026-01-13T03:52:53.498Z","created_by":null}','{"title":"Clean desk policy not enforced","description":"the users not locked computers and no screen saver configured ","risk_source":"audit_finding","category":"compliance","affected_asset_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"context_priority_score":9,"ai_analysis":"{\"risk_score\":9,\"likelihood\":3,\"impact\":3,\"severity\":\"medium\"}","status":"mitigated","assignee_id":null,"due_date":"2026-01-24"}',NULL,'2026-01-13 03:53:09');
INSERT INTO "risk_history" VALUES('hist-mkc2i7l0-v3z8cxgdv','risk-aud-mkbhclol-ogqe3q',NULL,'update','{"id":"risk-aud-mkbhclol-ogqe3q","organization_id":"org-001","title":"Clean desk policy not enforced","description":"the users not locked computers and no screen saver configured ","risk_source":"audit_finding","external_reference":"audit:afnd-mkbhc0rm-hcrgdk|engagement:eng-mkbh42si-47ebav","category":"compliance","subcategory":null,"affected_asset_id":null,"affected_vendor_id":null,"affected_control_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"inherent_score":36,"residual_likelihood":null,"residual_impact":null,"residual_score":null,"business_impact_score":null,"financial_exposure":null,"context_priority_score":null,"context_priority_reason":null,"status":"mitigated","assignee_id":null,"due_date":"2026-01-24","remediation_plan":null,"remediation_cost_estimate":null,"remediation_effort_days":null,"evidence_urls":"[]","ai_analysis":"{}","ai_suggested_controls":"[]","discovered_at":"2026-01-12 18:12:06","last_assessed_at":null,"resolved_at":"2026-01-13T03:52:53.498Z","created_at":"2026-01-12 18:12:06","updated_at":"2026-01-13T03:53:08.603Z","created_by":null}','{"title":"Clean desk policy not enforced","description":"the users not locked computers and no screen saver configured ","risk_source":"audit_finding","category":"compliance","affected_asset_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"context_priority_score":9,"ai_analysis":"{\"risk_score\":9,\"likelihood\":3,\"impact\":3,\"severity\":\"medium\"}","status":"open","assignee_id":null,"due_date":"2026-01-24"}',NULL,'2026-01-13 04:04:19');
INSERT INTO "risk_history" VALUES('hist-mkc2jux9-2jyzw04a4','risk-aud-mkbjlv6u-qs6bwv',NULL,'update','{"id":"risk-aud-mkbjlv6u-qs6bwv","organization_id":"org-001","title":"no security awarance program implemeted","description":"no security awarance program implemeted","risk_source":"audit_finding","external_reference":"audit:afnd-mkbjlueo-me6tfd|engagement:eng-mkbh42si-47ebav|controls:A.6.3","category":"compliance","subcategory":null,"affected_asset_id":null,"affected_vendor_id":null,"affected_control_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"inherent_score":36,"residual_likelihood":null,"residual_impact":null,"residual_score":null,"business_impact_score":null,"financial_exposure":null,"context_priority_score":null,"context_priority_reason":null,"status":"mitigated","assignee_id":null,"due_date":"2026-01-31","remediation_plan":null,"remediation_cost_estimate":null,"remediation_effort_days":null,"evidence_urls":"[]","ai_analysis":"{}","ai_suggested_controls":"[]","discovered_at":"2026-01-12 19:15:17","last_assessed_at":null,"resolved_at":"2026-01-13T03:25:08.539Z","created_at":"2026-01-12 19:15:17","updated_at":"2026-01-13T03:47:14.270Z","created_by":null}','{"title":"no security awarance program implemeted","description":"no security awarance program implemeted","risk_source":"audit_finding","category":"compliance","affected_asset_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"context_priority_score":9,"ai_analysis":"{\"risk_score\":9,\"likelihood\":3,\"impact\":3,\"severity\":\"medium\"}","status":"mitigated","assignee_id":null,"due_date":"2026-01-31"}',NULL,'2026-01-13 04:05:36');
INSERT INTO "risk_history" VALUES('hist-mkc2trdc-jyamau8tg','risk-aud-mkbhclol-ogqe3q',NULL,'update','{"id":"risk-aud-mkbhclol-ogqe3q","organization_id":"org-001","title":"Clean desk policy not enforced","description":"the users not locked computers and no screen saver configured ","risk_source":"audit_finding","external_reference":"audit:afnd-mkbhc0rm-hcrgdk|engagement:eng-mkbh42si-47ebav","category":"compliance","subcategory":null,"affected_asset_id":null,"affected_vendor_id":null,"affected_control_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"inherent_score":36,"residual_likelihood":null,"residual_impact":null,"residual_score":null,"business_impact_score":null,"financial_exposure":null,"context_priority_score":null,"context_priority_reason":null,"status":"mitigated","assignee_id":null,"due_date":"2026-01-24","remediation_plan":null,"remediation_cost_estimate":null,"remediation_effort_days":null,"evidence_urls":"[]","ai_analysis":"{}","ai_suggested_controls":"[]","discovered_at":"2026-01-12 18:12:06","last_assessed_at":null,"resolved_at":"2026-01-13T03:52:53.498Z","created_at":"2026-01-12 18:12:06","updated_at":"2026-01-13 04:10:31","created_by":null}','{"title":"Clean desk policy not enforced","description":"the users not locked computers and no screen saver configured ","risk_source":"audit_finding","category":"compliance","affected_asset_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"context_priority_score":9,"ai_analysis":"{\"risk_score\":9,\"likelihood\":3,\"impact\":3,\"severity\":\"medium\"}","status":"open","assignee_id":null,"due_date":"2026-01-24"}',NULL,'2026-01-13 04:13:18');
INSERT INTO "risk_history" VALUES('hist-mkc2v4h0-irbfwvjeu','risk-aud-mkbhclol-ogqe3q',NULL,'update','{"id":"risk-aud-mkbhclol-ogqe3q","organization_id":"org-001","title":"Clean desk policy not enforced","description":"the users not locked computers and no screen saver configured ","risk_source":"audit_finding","external_reference":"audit:afnd-mkbhc0rm-hcrgdk|engagement:eng-mkbh42si-47ebav","category":"compliance","subcategory":null,"affected_asset_id":null,"affected_vendor_id":null,"affected_control_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"inherent_score":36,"residual_likelihood":null,"residual_impact":null,"residual_score":null,"business_impact_score":null,"financial_exposure":null,"context_priority_score":null,"context_priority_reason":null,"status":"open","assignee_id":null,"due_date":"2026-01-24","remediation_plan":null,"remediation_cost_estimate":null,"remediation_effort_days":null,"evidence_urls":"[]","ai_analysis":"{}","ai_suggested_controls":"[]","discovered_at":"2026-01-12 18:12:06","last_assessed_at":null,"resolved_at":"2026-01-13T03:52:53.498Z","created_at":"2026-01-12 18:12:06","updated_at":"2026-01-13T04:13:18.352Z","created_by":null}','{"title":"Clean desk policy not enforced","description":"the users not locked computers and no screen saver configured ","risk_source":"audit_finding","category":"compliance","affected_asset_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"context_priority_score":9,"ai_analysis":"{\"risk_score\":9,\"likelihood\":3,\"impact\":3,\"severity\":\"medium\"}","status":"mitigated","assignee_id":null,"due_date":"2026-01-24"}',NULL,'2026-01-13 04:14:22');
INSERT INTO "risk_history" VALUES('hist-mkc36r4y-461qnaxxs','risk-aud-mkbjlv6u-qs6bwv',NULL,'update','{"id":"risk-aud-mkbjlv6u-qs6bwv","organization_id":"org-001","title":"no security awarance program implemeted","description":"no security awarance program implemeted","risk_source":"audit_finding","external_reference":"audit:afnd-mkbjlueo-me6tfd|engagement:eng-mkbh42si-47ebav|controls:A.6.3","category":"compliance","subcategory":null,"affected_asset_id":null,"affected_vendor_id":null,"affected_control_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"inherent_score":36,"residual_likelihood":null,"residual_impact":null,"residual_score":null,"business_impact_score":null,"financial_exposure":null,"context_priority_score":null,"context_priority_reason":null,"status":"mitigated","assignee_id":null,"due_date":"2026-01-31","remediation_plan":null,"remediation_cost_estimate":null,"remediation_effort_days":null,"evidence_urls":"[]","ai_analysis":"{}","ai_suggested_controls":"[]","discovered_at":"2026-01-12 19:15:17","last_assessed_at":null,"resolved_at":"2026-01-13T03:25:08.539Z","created_at":"2026-01-12 19:15:17","updated_at":"2026-01-13T04:05:31.368Z","created_by":null}','{"status":"open"}',NULL,'2026-01-13 04:23:24');
INSERT INTO "risk_history" VALUES('hist-mkc38g2o-fvtx13rel','risk-aud-mkbjlv6u-qs6bwv',NULL,'update','{"id":"risk-aud-mkbjlv6u-qs6bwv","organization_id":"org-001","title":"no security awarance program implemeted","description":"no security awarance program implemeted","risk_source":"audit_finding","external_reference":"audit:afnd-mkbjlueo-me6tfd|engagement:eng-mkbh42si-47ebav|controls:A.6.3","category":"compliance","subcategory":null,"affected_asset_id":null,"affected_vendor_id":null,"affected_control_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"inherent_score":36,"residual_likelihood":null,"residual_impact":null,"residual_score":null,"business_impact_score":null,"financial_exposure":null,"context_priority_score":null,"context_priority_reason":null,"status":"open","assignee_id":null,"due_date":"2026-01-31","remediation_plan":null,"remediation_cost_estimate":null,"remediation_effort_days":null,"evidence_urls":"[]","ai_analysis":"{}","ai_suggested_controls":"[]","discovered_at":"2026-01-12 19:15:17","last_assessed_at":null,"resolved_at":"2026-01-13T03:25:08.539Z","created_at":"2026-01-12 19:15:17","updated_at":"2026-01-13T04:23:05.547Z","created_by":null}','{"status":"mitigated"}',NULL,'2026-01-13 04:24:43');
CREATE TABLE compliance_frameworks (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    version TEXT,
    authority TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);
INSERT INTO "compliance_frameworks" VALUES('fw-001','SOC2','SOC 2 Type II',NULL,'2017','AICPA',1,'2025-12-24 12:07:01');
INSERT INTO "compliance_frameworks" VALUES('fw-002','ISO27001','ISO/IEC 27001',NULL,'2022','ISO',1,'2025-12-24 12:07:01');
INSERT INTO "compliance_frameworks" VALUES('fw-003','GDPR','General Data Protection Regulation',NULL,'2016/679','EU',1,'2025-12-24 12:07:01');
INSERT INTO "compliance_frameworks" VALUES('fw-004','PCI_DSS','Payment Card Industry Data Security Standard',NULL,'4.0','PCI SSC',1,'2025-12-24 12:07:01');
INSERT INTO "compliance_frameworks" VALUES('fw-005','HIPAA','Health Insurance Portability and Accountability Act',NULL,'1996','HHS',1,'2025-12-24 12:07:01');
INSERT INTO "compliance_frameworks" VALUES('fw-006','NIST_CSF','NIST Cybersecurity Framework',NULL,'2.0','NIST',1,'2025-12-24 12:07:01');
CREATE TABLE controls (
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
INSERT INTO "controls" VALUES('ctrl-001','org-001','AC-001','Access Control Policy','Establish and maintain access control policies','Access Control','preventive','administrative','user-001',NULL,'implemented',NULL,NULL,'effective',NULL,NULL,365,NULL,NULL,'2025-12-24 12:07:01','2025-12-24 12:07:01',NULL);
INSERT INTO "controls" VALUES('ctrl-002','org-001','AC-002','Multi-Factor Authentication','Require MFA for all privileged accounts','Access Control','preventive','technical','user-002',NULL,'in_progress',NULL,NULL,'partially_effective',NULL,NULL,365,NULL,NULL,'2025-12-24 12:07:01','2025-12-24 12:07:01',NULL);
INSERT INTO "controls" VALUES('ctrl-003','org-001','DP-001','Data Encryption at Rest','Encrypt all sensitive data at rest using AES-256','Data Protection','preventive','technical','user-001',NULL,'implemented',NULL,NULL,'effective',NULL,NULL,365,NULL,NULL,'2025-12-24 12:07:01','2025-12-24 12:07:01',NULL);
INSERT INTO "controls" VALUES('ctrl-004','org-001','DP-002','Data Encryption in Transit','Use TLS 1.2+ for all data in transit','Data Protection','preventive','technical','user-002',NULL,'implemented',NULL,NULL,'effective',NULL,NULL,365,NULL,NULL,'2025-12-24 12:07:01','2025-12-24 12:07:01',NULL);
INSERT INTO "controls" VALUES('ctrl-005','org-001','VM-001','Vulnerability Management','Regular vulnerability scanning and remediation','Vulnerability Management','detective','technical','user-001',NULL,'implemented',NULL,NULL,'partially_effective',NULL,NULL,365,NULL,NULL,'2025-12-24 12:07:01','2025-12-24 12:07:01',NULL);
INSERT INTO "controls" VALUES('ctrl-006','org-001','IR-001','Incident Response Plan','Documented incident response procedures','Incident Response','corrective','administrative','user-001',NULL,'implemented',NULL,NULL,'effective',NULL,NULL,365,NULL,NULL,'2025-12-24 12:07:01','2025-12-24 12:07:01',NULL);
INSERT INTO "controls" VALUES('ctrl-007','org-001','AU-001','Audit Logging','Comprehensive audit logging for all systems','Audit','detective','technical','user-002',NULL,'implemented',NULL,NULL,'effective',NULL,NULL,365,NULL,NULL,'2025-12-24 12:07:01','2025-12-24 12:07:01',NULL);
CREATE TABLE policies (
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
CREATE TABLE audit_logs (
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
INSERT INTO "audit_logs" VALUES('audit-mjjz2lio-h88j8n4jo','org-001',NULL,'create','risk','risk-mjjz2kar-024748r4i',NULL,'{"title":"PROD TEST: API Security Check","category":"vulnerability","risk_source":"penetration_test"}',NULL,NULL,'success',NULL,'2025-12-24 12:10:39');
INSERT INTO "audit_logs" VALUES('audit-mjjz2nx8-x3atoto9g','org-001',NULL,'delete','risk','risk-mjjz2kar-024748r4i','{"id":"risk-mjjz2kar-024748r4i","organization_id":"org-001","title":"PROD TEST: API Security Check","description":null,"risk_source":"penetration_test","external_reference":null,"category":"vulnerability","subcategory":null,"affected_asset_id":null,"affected_vendor_id":null,"affected_control_id":null,"inherent_likelihood":0.5,"inherent_impact":0.5,"inherent_score":25,"residual_likelihood":null,"residual_impact":null,"residual_score":null,"business_impact_score":8,"financial_exposure":0,"context_priority_score":8,"context_priority_reason":"Limited business impact identified","status":"open","assignee_id":null,"due_date":null,"remediation_plan":null,"remediation_cost_estimate":null,"remediation_effort_days":null,"evidence_urls":"[]","ai_analysis":"{}","ai_suggested_controls":"[]","discovered_at":"2025-12-24 12:10:38","last_assessed_at":null,"resolved_at":null,"created_at":"2025-12-24 12:10:38","updated_at":"2025-12-24 12:10:38","created_by":null}',NULL,NULL,NULL,'success',NULL,'2025-12-24 12:10:42');
INSERT INTO "audit_logs" VALUES('log-mjk0hart-housa2sq1','org-001','user-001','login','user','user-001',NULL,NULL,'170.106.202.227',NULL,'success',NULL,'2025-12-24 12:50:05');
INSERT INTO "audit_logs" VALUES('log-mjk0kxx0-141qf4oa7','org-001','user-001','login','user','user-001',NULL,NULL,'170.106.202.227',NULL,'success',NULL,'2025-12-24 12:52:55');
INSERT INTO "audit_logs" VALUES('log-mjk0n3le-7bvr2j7hi','org-001','user-001','login','user','user-001',NULL,NULL,'170.106.202.227',NULL,'success',NULL,'2025-12-24 12:54:35');
INSERT INTO "audit_logs" VALUES('log-mjk0o3jm-utlzyv5bc','org-001','user-001','login','user','user-001',NULL,NULL,'102.38.7.132',NULL,'success',NULL,'2025-12-24 12:55:22');
INSERT INTO "audit_logs" VALUES('log-mjkbnfpv-sf5742dc7','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.136.60',NULL,'success',NULL,'2025-12-24 18:02:47');
INSERT INTO "audit_logs" VALUES('log-mjkbp8sv-bt2y6qxnz','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.136.60',NULL,'success',NULL,'2025-12-24 18:04:11');
INSERT INTO "audit_logs" VALUES('maturity-mjkbpqs1-wpk367zfj','org-001',NULL,'maturity_assessment','assessment','maturity-mjkbpqs1-wpk367zfj',NULL,'{"name":"Test Assessment","answers":{"1":4,"2":4,"3":3,"4":4,"5":4,"6":3,"7":4,"8":4,"9":4,"10":3,"11":4,"12":4,"13":4,"14":3,"15":4,"16":3,"17":4,"18":4,"19":4,"20":4,"21":3,"22":3,"23":2,"24":2,"25":3,"26":4,"27":4,"28":4,"29":4,"30":4,"31":4,"32":3},"categoryScores":{"governance":3.75,"policies":3.67,"organization":3.71,"hr_security":3.8,"communication":3.5,"supplier":2.5,"risk":4,"incident":4,"continuity":3},"overallScore":3.5477777777777777,"overallPercentage":70.95555555555555,"timestamp":"2025-12-24T18:04:34.897Z"}',NULL,NULL,'success',NULL,'2025-12-24 18:04:34');
INSERT INTO "audit_logs" VALUES('maturity-mjkbsp4j-1wyqldp9g','org-001','user-001','maturity_assessment','assessment','maturity-mjkbsp4j-1wyqldp9g',NULL,'{"name":"Security Maturity Assessment - 24/12/2025","answers":{"1":2,"2":2,"3":1,"4":3,"5":3,"6":2,"7":2,"8":2,"9":3,"10":1,"11":3,"12":3,"13":2,"14":3,"15":2,"16":3,"17":3,"18":1,"19":3,"20":2,"21":1,"22":2,"23":1,"24":1,"25":3,"26":3,"27":3,"28":2,"29":2,"30":3,"31":2,"32":3},"categoryScores":{"governance":2,"policies":2.33,"organization":2.43,"hr_security":2.4,"communication":1.5,"supplier":1.75,"risk":2.67,"incident":2.33,"continuity":3},"overallScore":2.267777777777778,"overallPercentage":45.35555555555556,"timestamp":"2025-12-24T18:06:52.723Z"}',NULL,NULL,'success',NULL,'2025-12-24 18:06:53');
INSERT INTO "audit_logs" VALUES('log-mjkc5ea6-pmlmut51k','org-001',NULL,'create','maturity_assessment','maturity-mjkc5cze-t5n12yo6b',NULL,NULL,NULL,NULL,'success',NULL,'2025-12-24 18:16:45');
INSERT INTO "audit_logs" VALUES('log-mjkc5u72-i0y42aze6','org-001',NULL,'create','maturity_assessment','maturity-mjkc5t71-fw69sxz28',NULL,NULL,NULL,NULL,'success',NULL,'2025-12-24 18:17:05');
INSERT INTO "audit_logs" VALUES('log-mjkcdlbc-9cvd6cuuf','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.136.60',NULL,'success',NULL,'2025-12-24 18:23:07');
INSERT INTO "audit_logs" VALUES('log-mjkcm638-h38dbgbi7','org-001','user-001','create','maturity_assessment','maturity-mjkcm04q-v39jby189',NULL,NULL,NULL,NULL,'success',NULL,'2025-12-24 18:29:47');
INSERT INTO "audit_logs" VALUES('log-mjkcng6g-vgkkmxawi','org-001','user-001','update','maturity_assessment','maturity-mjkcm04q-v39jby189',NULL,NULL,NULL,NULL,'success',NULL,'2025-12-24 18:30:47');
INSERT INTO "audit_logs" VALUES('log-mjkct6qn-fcbmpdqez','org-001','user-001','update','maturity_assessment','maturity-mjkc5t71-fw69sxz28',NULL,NULL,NULL,NULL,'success',NULL,'2025-12-24 18:35:15');
INSERT INTO "audit_logs" VALUES('log-mjlm6p9f-vsjxatjlb','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.139.251',NULL,'success',NULL,'2025-12-25 15:45:28');
INSERT INTO "audit_logs" VALUES('log-mjmddym6-tp16py06f','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.139.251',NULL,'success',NULL,'2025-12-26 04:26:56');
INSERT INTO "audit_logs" VALUES('audit-mjme0v9x-xg83i6nyr','org-001',NULL,'create','asset','asset-mjme0unj-gvx8xzt7b',NULL,'{"name":"IGW Router","description":"the Main Internet getway router","asset_type":"network_device","cloud_provider":"on_premise","criticality":"critical","region":"Hedqurater","data_classification":"restricted","contains_pii":false,"contains_pci":false,"contains_phi":false}',NULL,NULL,'success',NULL,'2025-12-26 04:44:45');
INSERT INTO "audit_logs" VALUES('audit-mjmea9qi-10kfo5b8c','org-001',NULL,'create','risk','risk-mjmea9dn-y5qq12njt',NULL,'{"title":"DDos Attak to Targeting payment getway ","description":"Hackers targeting appliaction  payment getway service with mutli vecor DDos attack to make down the service and effecting the payment services","risk_source":"manual","category":"operational","affected_asset_id":"asset-001","inherent_likelihood":0.7,"inherent_impact":1,"status":"open","assignee_id":"user-001","due_date":"2026-01-26"}',NULL,NULL,'success',NULL,'2025-12-26 04:52:04');
INSERT INTO "audit_logs" VALUES('log-mjmed9qe-ikvsb7mm5','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.139.251',NULL,'success',NULL,'2025-12-26 04:54:24');
INSERT INTO "audit_logs" VALUES('log-mjmf0lly-8z6i57im2','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.139.251',NULL,'success',NULL,'2025-12-26 05:12:32');
INSERT INTO "audit_logs" VALUES('log-mjoa9jp5-w1qyzsohy','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.137.80',NULL,'success',NULL,'2025-12-27 12:35:04');
INSERT INTO "audit_logs" VALUES('audit-mjoahn0v-nf4sozqu3','org-001',NULL,'create','asset','asset-mjoahkxr-1hb40hc68',NULL,'{"name":"Core  Router","description":"the  MPLS P Router ","asset_type":"network_device","cloud_provider":"on_premise","criticality":"critical","region":"Head quarater","data_classification":"confidential","contains_pii":false,"contains_pci":false,"contains_phi":false}',NULL,NULL,'success',NULL,'2025-12-27 12:41:21');
INSERT INTO "audit_logs" VALUES('audit-mjoapf10-uyuw3v7g4','org-001',NULL,'update','risk','risk-mjmea9dn-y5qq12njt','{"id":"risk-mjmea9dn-y5qq12njt","organization_id":"org-001","title":"DDos Attak to Targeting payment getway ","description":"Hackers targeting appliaction  payment getway service with mutli vecor DDos attack to make down the service and effecting the payment services","risk_source":"manual","external_reference":null,"category":"operational","subcategory":null,"affected_asset_id":"asset-001","affected_vendor_id":null,"affected_control_id":null,"inherent_likelihood":0.7,"inherent_impact":1,"inherent_score":70,"residual_likelihood":null,"residual_impact":null,"residual_score":null,"business_impact_score":88,"financial_exposure":1800000,"context_priority_score":88,"context_priority_reason":"Affects revenue-generating process; Customer-facing system; Regulatory compliance requirement; $75K/hr revenue exposure","status":"open","assignee_id":"user-001","due_date":"2026-01-26","remediation_plan":null,"remediation_cost_estimate":null,"remediation_effort_days":null,"evidence_urls":"[]","ai_analysis":"{}","ai_suggested_controls":"[]","discovered_at":"2025-12-26 04:52:04","last_assessed_at":null,"resolved_at":null,"created_at":"2025-12-26 04:52:04","updated_at":"2025-12-26 04:52:04","created_by":null}','{"title":"DDos Attak to Targeting payment getway ","description":"Hackers targeting appliaction  payment getway service with mutli vecor DDos attack to make down the service and effecting the payment services","risk_source":"manual","category":"operational","affected_asset_id":"asset-001","inherent_likelihood":0.7,"inherent_impact":0.8,"status":"open","assignee_id":"user-001","due_date":"2026-01-26"}',NULL,NULL,'success',NULL,'2025-12-27 12:47:24');
INSERT INTO "audit_logs" VALUES('audit-mjoaqvha-jr1jv5v7s','org-001',NULL,'update','risk','risk-mjmea9dn-y5qq12njt','{"id":"risk-mjmea9dn-y5qq12njt","organization_id":"org-001","title":"DDos Attak to Targeting payment getway ","description":"Hackers targeting appliaction  payment getway service with mutli vecor DDos attack to make down the service and effecting the payment services","risk_source":"manual","external_reference":null,"category":"operational","subcategory":null,"affected_asset_id":"asset-001","affected_vendor_id":null,"affected_control_id":null,"inherent_likelihood":0.7,"inherent_impact":0.8,"inherent_score":56,"residual_likelihood":null,"residual_impact":null,"residual_score":null,"business_impact_score":88,"financial_exposure":1800000,"context_priority_score":84,"context_priority_reason":"Affects revenue-generating process; Customer-facing system; Regulatory compliance requirement; $75K/hr revenue exposure","status":"open","assignee_id":"user-001","due_date":"2026-01-26","remediation_plan":null,"remediation_cost_estimate":null,"remediation_effort_days":null,"evidence_urls":"[]","ai_analysis":"{}","ai_suggested_controls":"[]","discovered_at":"2025-12-26 04:52:04","last_assessed_at":null,"resolved_at":null,"created_at":"2025-12-26 04:52:04","updated_at":"2025-12-27T12:47:24.529Z","created_by":null}','{"title":"DDos Attak to Targeting payment getway ","description":"Hackers targeting appliaction  payment getway service with mutli vecor DDos attack to make down the service and effecting the payment services","risk_source":"manual","category":"operational","affected_asset_id":"asset-001","inherent_likelihood":0.7,"inherent_impact":0.8,"status":"closed","assignee_id":"user-001","due_date":"2026-01-26"}',NULL,NULL,'success',NULL,'2025-12-27 12:48:32');
INSERT INTO "audit_logs" VALUES('log-mjpkvhk1-pzxvrxbnf','org-001','user-001','login','user','user-001',NULL,NULL,'156.38.50.212',NULL,'success',NULL,'2025-12-28 10:19:50');
INSERT INTO "audit_logs" VALUES('log-mjpokh94-84htzvcd2','org-001','user-001','login','user','user-001',NULL,NULL,'156.38.49.175',NULL,'success',NULL,'2025-12-28 12:03:15');
INSERT INTO "audit_logs" VALUES('log-mjq0s9bp-qhg17bd27','org-001','user-001','login','user','user-001',NULL,NULL,'156.38.49.135',NULL,'success',NULL,'2025-12-28 17:45:13');
INSERT INTO "audit_logs" VALUES('log-mjqc6ptc-eg0bf7vgv','org-001','user-001','login','user','user-001',NULL,NULL,'2a02:26f7:f9c8:d0a6:0:b000:0:c',NULL,'success',NULL,'2025-12-28 23:04:23');
INSERT INTO "audit_logs" VALUES('log-mjseplbd-n8zsy4py6','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.138.148',NULL,'success',NULL,'2025-12-30 09:50:36');
INSERT INTO "audit_logs" VALUES('log-mjshf3ds-ydhvl6syt','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.137.84',NULL,'success',NULL,'2025-12-30 11:06:25');
INSERT INTO "audit_logs" VALUES('log-mjsi05c6-2e7ihl9cx','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.137.84',NULL,'success',NULL,'2025-12-30 11:22:47');
INSERT INTO "audit_logs" VALUES('audit-mjsi0q6y-42wnhh2f0','org-001',NULL,'delete','risk','risk-001','{"id":"risk-001","organization_id":"org-001","title":"SQL Injection Vulnerability in Payment API","description":"Critical SQL injection vulnerability discovered in the payment processing API endpoint","risk_source":"vulnerability_scan","external_reference":"CVE-2024-1234","category":"vulnerability","subcategory":null,"affected_asset_id":"asset-001","affected_vendor_id":null,"affected_control_id":null,"inherent_likelihood":0.8,"inherent_impact":0.95,"inherent_score":76,"residual_likelihood":null,"residual_impact":null,"residual_score":25,"business_impact_score":95,"financial_exposure":2500000,"context_priority_score":92,"context_priority_reason":"Affects Payment Processing ($50K/hr revenue impact), 3 customer-facing processes","status":"open","assignee_id":"user-001","due_date":"2025-12-31","remediation_plan":null,"remediation_cost_estimate":null,"remediation_effort_days":null,"evidence_urls":"[]","ai_analysis":"{}","ai_suggested_controls":"[]","discovered_at":"2025-12-24 12:07:01","last_assessed_at":null,"resolved_at":null,"created_at":"2025-12-24 12:07:01","updated_at":"2025-12-24 12:07:01","created_by":null}',NULL,NULL,NULL,'success',NULL,'2025-12-30 11:23:14');
INSERT INTO "audit_logs" VALUES('audit-mjsi0xu8-b6xcx5tg8','org-001',NULL,'delete','risk','risk-mjmea9dn-y5qq12njt','{"id":"risk-mjmea9dn-y5qq12njt","organization_id":"org-001","title":"DDos Attak to Targeting payment getway ","description":"Hackers targeting appliaction  payment getway service with mutli vecor DDos attack to make down the service and effecting the payment services","risk_source":"manual","external_reference":null,"category":"operational","subcategory":null,"affected_asset_id":"asset-001","affected_vendor_id":null,"affected_control_id":null,"inherent_likelihood":0.7,"inherent_impact":0.8,"inherent_score":56,"residual_likelihood":null,"residual_impact":null,"residual_score":null,"business_impact_score":88,"financial_exposure":1800000,"context_priority_score":84,"context_priority_reason":"Affects revenue-generating process; Customer-facing system; Regulatory compliance requirement; $75K/hr revenue exposure","status":"closed","assignee_id":"user-001","due_date":"2026-01-26","remediation_plan":null,"remediation_cost_estimate":null,"remediation_effort_days":null,"evidence_urls":"[]","ai_analysis":"{}","ai_suggested_controls":"[]","discovered_at":"2025-12-26 04:52:04","last_assessed_at":null,"resolved_at":"2025-12-27T12:48:32.581Z","created_at":"2025-12-26 04:52:04","updated_at":"2025-12-27T12:48:32.581Z","created_by":null}',NULL,NULL,NULL,'success',NULL,'2025-12-30 11:23:24');
INSERT INTO "audit_logs" VALUES('log-mjsi8tud-uc5r6revm','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.137.84',NULL,'success',NULL,'2025-12-30 11:29:32');
INSERT INTO "audit_logs" VALUES('log-mjsiwnp5-12rio1qui','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.137.84',NULL,'success',NULL,'2025-12-30 11:48:04');
INSERT INTO "audit_logs" VALUES('log-mjsj00q1-ga5le1hrx','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.137.84',NULL,'success',NULL,'2025-12-30 11:50:41');
INSERT INTO "audit_logs" VALUES('log-mjsk0l7x-3sgthu4qu','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.137.84',NULL,'success',NULL,'2025-12-30 12:19:07');
INSERT INTO "audit_logs" VALUES('log-mjskyiir-z54l337lh','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.137.84',NULL,'success',NULL,'2025-12-30 12:45:30');
INSERT INTO "audit_logs" VALUES('log-mjsm2az2-xl8ze8znu','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.137.84',NULL,'success',NULL,'2025-12-30 13:16:26');
INSERT INTO "audit_logs" VALUES('log-mjsm5dwc-2iruchold','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.137.84',NULL,'success',NULL,'2025-12-30 13:18:50');
INSERT INTO "audit_logs" VALUES('log-mjsn0oty-1bpwzec3b','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.137.84',NULL,'success',NULL,'2025-12-30 13:43:10');
INSERT INTO "audit_logs" VALUES('log-mjsnw27b-rl6953ckv','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.137.84',NULL,'success',NULL,'2025-12-30 14:07:34');
INSERT INTO "audit_logs" VALUES('log-mjso9yd4-94cp6th2f','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.137.84',NULL,'success',NULL,'2025-12-30 14:18:22');
INSERT INTO "audit_logs" VALUES('log-mjsofarm-xyqs3rwe2','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.137.84',NULL,'success',NULL,'2025-12-30 14:22:32');
INSERT INTO "audit_logs" VALUES('log-mjsolpla-gauo963ct','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.137.84',NULL,'success',NULL,'2025-12-30 14:27:31');
INSERT INTO "audit_logs" VALUES('log-mjspfhx6-usx0i6n4t','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.137.84',NULL,'success',NULL,'2025-12-30 14:50:40');
INSERT INTO "audit_logs" VALUES('log-mjspsqj7-s81nckuoc','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.137.84',NULL,'success',NULL,'2025-12-30 15:00:58');
INSERT INTO "audit_logs" VALUES('log-mjsqsrod-na9gacmzc','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.137.84',NULL,'success',NULL,'2025-12-30 15:28:59');
INSERT INTO "audit_logs" VALUES('log-mjsr5akg-kzbfc889r','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.137.84',NULL,'success',NULL,'2025-12-30 15:38:44');
INSERT INTO "audit_logs" VALUES('log-mjsrgv00-od9exwr1u','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.137.84',NULL,'success',NULL,'2025-12-30 15:47:43');
INSERT INTO "audit_logs" VALUES('log-mjsspmvy-x8djnup1s','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.137.84',NULL,'success',NULL,'2025-12-30 16:22:32');
INSERT INTO "audit_logs" VALUES('log-mjthjtun-weon9pvml','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.137.84',NULL,'success',NULL,'2025-12-31 03:57:52');
INSERT INTO "audit_logs" VALUES('log-mjtjn3sb-wbbgsvyfa','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.137.84',NULL,'success',NULL,'2025-12-31 04:56:24');
INSERT INTO "audit_logs" VALUES('log-mju75r76-06xahx7hn','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.137.84',NULL,'success',NULL,'2025-12-31 15:54:45');
INSERT INTO "audit_logs" VALUES('log-mju7iyt4-hnrp3egz2','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.137.84',NULL,'success',NULL,'2025-12-31 16:05:02');
INSERT INTO "audit_logs" VALUES('log-mju7thhu-hrpply0nd','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.137.84',NULL,'success',NULL,'2025-12-31 16:13:12');
INSERT INTO "audit_logs" VALUES('log-mju9153x-fikk2wbi1','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.137.84',NULL,'success',NULL,'2025-12-31 16:47:09');
INSERT INTO "audit_logs" VALUES('log-mju9i8kq-a6bwmwzls','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.137.84',NULL,'success',NULL,'2025-12-31 17:00:27');
INSERT INTO "audit_logs" VALUES('log-mju9pmsw-ggi9kcgyq','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.137.84',NULL,'success',NULL,'2025-12-31 17:06:12');
INSERT INTO "audit_logs" VALUES('log-mjue232t-ihbrsienf','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.137.84',NULL,'success',NULL,'2025-12-31 19:07:51');
INSERT INTO "audit_logs" VALUES('log-mjuf40zb-kucgkiou3','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.137.84',NULL,'success',NULL,'2025-12-31 19:37:21');
INSERT INTO "audit_logs" VALUES('log-mk4gf85u-6yem3thy8','org-001','user-001','login','user','user-001',NULL,NULL,'102.209.112.126',NULL,'success',NULL,'2026-01-07 20:11:45');
INSERT INTO "audit_logs" VALUES('log-mk4xe7o9-ao1l49lgm','org-001','user-001','login','user','user-001',NULL,NULL,'102.209.112.126',NULL,'success',NULL,'2026-01-08 04:06:52');
INSERT INTO "audit_logs" VALUES('log-mk4yh19s-wqvpp7tq5','org-001','user-001','login','user','user-001',NULL,NULL,'102.209.112.126',NULL,'success',NULL,'2026-01-08 04:37:03');
INSERT INTO "audit_logs" VALUES('log-mk58eyqu-bygja9h9n','org-001','user-001','login','user','user-001',NULL,NULL,'102.209.112.126',NULL,'success',NULL,'2026-01-08 09:15:22');
INSERT INTO "audit_logs" VALUES('log-mk5avpvm-um5aphso8','org-001','user-001','login','user','user-001',NULL,NULL,'102.209.112.126',NULL,'success',NULL,'2026-01-08 10:24:23');
INSERT INTO "audit_logs" VALUES('log-mk5b704k-t48okvruh','org-001','user-001','login','user','user-001',NULL,NULL,'102.209.112.126',NULL,'success',NULL,'2026-01-08 10:33:10');
INSERT INTO "audit_logs" VALUES('log-mk5cdsr2-gedqex0x6','org-001','user-001','login','user','user-001',NULL,NULL,'102.209.112.126',NULL,'success',NULL,'2026-01-08 11:06:26');
INSERT INTO "audit_logs" VALUES('log-mk5ik000-w8s6mm5sy','org-001','user-001','login','user','user-001',NULL,NULL,'102.209.112.126',NULL,'success',NULL,'2026-01-08 13:59:14');
INSERT INTO "audit_logs" VALUES('log-mk5k15cb-iyk1nzybr','org-001','user-001','login','user','user-001',NULL,NULL,'102.209.112.126',NULL,'success',NULL,'2026-01-08 14:40:33');
INSERT INTO "audit_logs" VALUES('log-mk5k674d-q2mn3gopz','org-001','user-001','login','user','user-001',NULL,NULL,'102.209.112.126',NULL,'success',NULL,'2026-01-08 14:44:29');
INSERT INTO "audit_logs" VALUES('log-mk5l1q0o-ooqgvq19n','org-001','user-001','login','user','user-001',NULL,NULL,'102.209.112.126',NULL,'success',NULL,'2026-01-08 15:09:00');
INSERT INTO "audit_logs" VALUES('audit-mk5lddxm-svvlj9kqy','org-001',NULL,'delete','risk','risk-005','{"id":"risk-005","organization_id":"org-001","title":"Log4j Vulnerability in Legacy System","description":"CVE-2021-44228 (Log4Shell) present in legacy inventory system","risk_source":"vulnerability_scan","external_reference":"CVE-2021-44228","category":"vulnerability","subcategory":null,"affected_asset_id":"asset-005","affected_vendor_id":null,"affected_control_id":null,"inherent_likelihood":0.7,"inherent_impact":0.8,"inherent_score":56,"residual_likelihood":null,"residual_impact":null,"residual_score":40,"business_impact_score":45,"financial_exposure":100000,"context_priority_score":52,"context_priority_reason":"Internal system only, no customer data, limited blast radius","status":"open","assignee_id":"user-002","due_date":"2026-02-07","remediation_plan":null,"remediation_cost_estimate":null,"remediation_effort_days":null,"evidence_urls":"[]","ai_analysis":"{}","ai_suggested_controls":"[]","discovered_at":"2025-12-24 12:07:01","last_assessed_at":null,"resolved_at":null,"created_at":"2025-12-24 12:07:01","updated_at":"2025-12-24 12:07:01","created_by":null}',NULL,NULL,NULL,'success',NULL,'2026-01-08 15:18:04');
INSERT INTO "audit_logs" VALUES('log-mk5litqn-opipi3ton','org-001','user-001','login','user','user-001',NULL,NULL,'102.209.112.126',NULL,'success',NULL,'2026-01-08 15:22:18');
INSERT INTO "audit_logs" VALUES('log-mk5lzjq1-ef6irkcj1','org-001','user-001','login','user','user-001',NULL,NULL,'102.209.112.126',NULL,'success',NULL,'2026-01-08 15:35:18');
INSERT INTO "audit_logs" VALUES('log-mk5nl1dn-nn6wc22bu','org-001','user-001','login','user','user-001',NULL,NULL,'102.209.112.126',NULL,'success',NULL,'2026-01-08 16:20:00');
INSERT INTO "audit_logs" VALUES('log-mk5pxf9z-g32n5v7fw','org-001','user-001','login','user','user-001',NULL,NULL,'102.209.112.126',NULL,'success',NULL,'2026-01-08 17:25:37');
INSERT INTO "audit_logs" VALUES('log-mk5q3x8d-3ar2b75si','org-001','user-001','login','user','user-001',NULL,NULL,'102.209.112.126',NULL,'success',NULL,'2026-01-08 17:30:40');
INSERT INTO "audit_logs" VALUES('log-mk5qbaxr-qr1q79adh','org-001','user-001','login','user','user-001',NULL,NULL,'102.209.112.126',NULL,'success',NULL,'2026-01-08 17:36:25');
INSERT INTO "audit_logs" VALUES('log-mk6qrmew-mpw8wazcy','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.136.72',NULL,'success',NULL,'2026-01-09 10:36:52');
INSERT INTO "audit_logs" VALUES('log-mk74snll-b4ap136ol','org-001','user-001','login','user','user-001',NULL,NULL,'102.212.136.72',NULL,'success',NULL,'2026-01-09 17:09:35');
INSERT INTO "audit_logs" VALUES('log-mk8o1t4w-ns5bexd2q','org-001','user-001','login','user','user-001',NULL,NULL,'156.38.63.253',NULL,'success',NULL,'2026-01-10 18:56:21');
INSERT INTO "audit_logs" VALUES('log-mka080ax-gl6t547xt','org-001','user-001','login','user','user-001',NULL,NULL,'156.38.61.50',NULL,'success',NULL,'2026-01-11 17:24:52');
INSERT INTO "audit_logs" VALUES('log-mkbbuj7g-ko8tjtl73','org-001','user-001','login','user','user-001',NULL,NULL,'156.38.54.206',NULL,'success',NULL,'2026-01-12 15:38:05');
INSERT INTO "audit_logs" VALUES('log-mkbgxz8c-05shlr654','org-001','user-001','login','user','user-001',NULL,NULL,'156.38.54.206',NULL,'success',NULL,'2026-01-12 18:00:44');
INSERT INTO "audit_logs" VALUES('log-mkbhnms7-s4e2c11og','org-001','user-001','login','user','user-001',NULL,NULL,'156.38.54.206',NULL,'success',NULL,'2026-01-12 18:20:40');
INSERT INTO "audit_logs" VALUES('audit-mkbhqk5t-l52wszu61','org-001',NULL,'update','risk','risk-aud-mkbhclol-ogqe3q','{"id":"risk-aud-mkbhclol-ogqe3q","organization_id":"org-001","title":"Clean desk policy not enforced","description":"the users not locked computers and no screen saver configured ","risk_source":"audit_finding","external_reference":"audit:afnd-mkbhc0rm-hcrgdk|engagement:eng-mkbh42si-47ebav","category":"compliance","subcategory":null,"affected_asset_id":null,"affected_vendor_id":null,"affected_control_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"inherent_score":36,"residual_likelihood":null,"residual_impact":null,"residual_score":null,"business_impact_score":null,"financial_exposure":null,"context_priority_score":null,"context_priority_reason":null,"status":"open","assignee_id":null,"due_date":"2026-01-24","remediation_plan":null,"remediation_cost_estimate":null,"remediation_effort_days":null,"evidence_urls":"[]","ai_analysis":"{}","ai_suggested_controls":"[]","discovered_at":"2026-01-12 18:12:06","last_assessed_at":null,"resolved_at":null,"created_at":"2026-01-12 18:12:06","updated_at":"2026-01-12 18:12:06","created_by":null}','{"title":"Clean desk policy not enforced","description":"the users not locked computers and no screen saver configured ","risk_source":"audit_finding","category":"compliance","affected_asset_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"context_priority_score":9,"ai_analysis":"{\"risk_score\":9,\"likelihood\":3,\"impact\":3,\"severity\":\"medium\"}","status":"open","assignee_id":null,"due_date":"2026-01-24"}',NULL,NULL,'success',NULL,'2026-01-12 18:22:57');
INSERT INTO "audit_logs" VALUES('audit-mkbhrang-v71cciqtn','org-001',NULL,'update','risk','risk-aud-mkbhclol-ogqe3q','{"id":"risk-aud-mkbhclol-ogqe3q","organization_id":"org-001","title":"Clean desk policy not enforced","description":"the users not locked computers and no screen saver configured ","risk_source":"audit_finding","external_reference":"audit:afnd-mkbhc0rm-hcrgdk|engagement:eng-mkbh42si-47ebav","category":"compliance","subcategory":null,"affected_asset_id":null,"affected_vendor_id":null,"affected_control_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"inherent_score":36,"residual_likelihood":null,"residual_impact":null,"residual_score":null,"business_impact_score":null,"financial_exposure":null,"context_priority_score":null,"context_priority_reason":null,"status":"open","assignee_id":null,"due_date":"2026-01-24","remediation_plan":null,"remediation_cost_estimate":null,"remediation_effort_days":null,"evidence_urls":"[]","ai_analysis":"{}","ai_suggested_controls":"[]","discovered_at":"2026-01-12 18:12:06","last_assessed_at":null,"resolved_at":null,"created_at":"2026-01-12 18:12:06","updated_at":"2026-01-12T18:22:57.237Z","created_by":null}','{"title":"Clean desk policy not enforced","description":"the users not locked computers and no screen saver configured ","risk_source":"audit_finding","category":"compliance","affected_asset_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"context_priority_score":9,"ai_analysis":"{\"risk_score\":9,\"likelihood\":3,\"impact\":3,\"severity\":\"medium\"}","status":"open","assignee_id":null,"due_date":"2026-01-24"}',NULL,NULL,'success',NULL,'2026-01-12 18:23:31');
INSERT INTO "audit_logs" VALUES('log-mkbi4jpq-f23zdi368','org-001','user-001','login','user','user-001',NULL,NULL,'156.38.54.206',NULL,'success',NULL,'2026-01-12 18:33:50');
INSERT INTO "audit_logs" VALUES('log-mkbjgtz5-4nfskqsxg','org-001','user-001','login','user','user-001',NULL,NULL,'156.38.54.206',NULL,'success',NULL,'2026-01-12 19:11:22');
INSERT INTO "audit_logs" VALUES('log-mkc11qqe-jf4g52nxi','org-001','user-001','login','user','user-001',NULL,NULL,'156.38.57.58',NULL,'success',NULL,'2026-01-13 03:23:31');
INSERT INTO "audit_logs" VALUES('audit-mkc13tg4-9pez1aza7','org-001',NULL,'update','risk','risk-aud-mkbjlv6u-qs6bwv','{"id":"risk-aud-mkbjlv6u-qs6bwv","organization_id":"org-001","title":"no security awarance program implemeted","description":"no security awarance program implemeted","risk_source":"audit_finding","external_reference":"audit:afnd-mkbjlueo-me6tfd|engagement:eng-mkbh42si-47ebav|controls:A.6.3","category":"compliance","subcategory":null,"affected_asset_id":null,"affected_vendor_id":null,"affected_control_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"inherent_score":36,"residual_likelihood":null,"residual_impact":null,"residual_score":null,"business_impact_score":null,"financial_exposure":null,"context_priority_score":null,"context_priority_reason":null,"status":"open","assignee_id":null,"due_date":"2026-01-31","remediation_plan":null,"remediation_cost_estimate":null,"remediation_effort_days":null,"evidence_urls":"[]","ai_analysis":"{}","ai_suggested_controls":"[]","discovered_at":"2026-01-12 19:15:17","last_assessed_at":null,"resolved_at":null,"created_at":"2026-01-12 19:15:17","updated_at":"2026-01-12 19:15:17","created_by":null}','{"title":"no security awarance program implemeted","description":"no security awarance program implemeted","risk_source":"audit_finding","category":"compliance","affected_asset_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"context_priority_score":9,"ai_analysis":"{\"risk_score\":9,\"likelihood\":3,\"impact\":3,\"severity\":\"medium\"}","status":"mitigated","assignee_id":null,"due_date":"2026-01-31"}',NULL,NULL,'success',NULL,'2026-01-13 03:25:08');
INSERT INTO "audit_logs" VALUES('audit-mkc15ump-ilks0n9xc','org-001',NULL,'update','risk','risk-aud-mkbjlv6u-qs6bwv','{"id":"risk-aud-mkbjlv6u-qs6bwv","organization_id":"org-001","title":"no security awarance program implemeted","description":"no security awarance program implemeted","risk_source":"audit_finding","external_reference":"audit:afnd-mkbjlueo-me6tfd|engagement:eng-mkbh42si-47ebav|controls:A.6.3","category":"compliance","subcategory":null,"affected_asset_id":null,"affected_vendor_id":null,"affected_control_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"inherent_score":36,"residual_likelihood":null,"residual_impact":null,"residual_score":null,"business_impact_score":null,"financial_exposure":null,"context_priority_score":null,"context_priority_reason":null,"status":"mitigated","assignee_id":null,"due_date":"2026-01-31","remediation_plan":null,"remediation_cost_estimate":null,"remediation_effort_days":null,"evidence_urls":"[]","ai_analysis":"{}","ai_suggested_controls":"[]","discovered_at":"2026-01-12 19:15:17","last_assessed_at":null,"resolved_at":"2026-01-13T03:25:08.539Z","created_at":"2026-01-12 19:15:17","updated_at":"2026-01-13T03:25:08.539Z","created_by":null}','{"title":"no security awarance program implemeted","description":"no security awarance program implemeted","risk_source":"audit_finding","category":"compliance","affected_asset_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"context_priority_score":9,"ai_analysis":"{\"risk_score\":9,\"likelihood\":3,\"impact\":3,\"severity\":\"medium\"}","status":"mitigated","assignee_id":null,"due_date":"2026-01-31"}',NULL,NULL,'success',NULL,'2026-01-13 03:26:43');
INSERT INTO "audit_logs" VALUES('audit-mkc1vc59-gmk2kbyvh','org-001',NULL,'update','risk','risk-aud-mkbjlv6u-qs6bwv','{"id":"risk-aud-mkbjlv6u-qs6bwv","organization_id":"org-001","title":"no security awarance program implemeted","description":"no security awarance program implemeted","risk_source":"audit_finding","external_reference":"audit:afnd-mkbjlueo-me6tfd|engagement:eng-mkbh42si-47ebav|controls:A.6.3","category":"compliance","subcategory":null,"affected_asset_id":null,"affected_vendor_id":null,"affected_control_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"inherent_score":36,"residual_likelihood":null,"residual_impact":null,"residual_score":null,"business_impact_score":null,"financial_exposure":null,"context_priority_score":null,"context_priority_reason":null,"status":"mitigated","assignee_id":null,"due_date":"2026-01-31","remediation_plan":null,"remediation_cost_estimate":null,"remediation_effort_days":null,"evidence_urls":"[]","ai_analysis":"{}","ai_suggested_controls":"[]","discovered_at":"2026-01-12 19:15:17","last_assessed_at":null,"resolved_at":"2026-01-13T03:25:08.539Z","created_at":"2026-01-12 19:15:17","updated_at":"2026-01-13T03:26:43.369Z","created_by":null}','{"title":"no security awarance program implemeted","description":"no security awarance program implemeted","risk_source":"audit_finding","category":"compliance","affected_asset_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"context_priority_score":9,"ai_analysis":"{\"risk_score\":9,\"likelihood\":3,\"impact\":3,\"severity\":\"medium\"}","status":"mitigated","assignee_id":null,"due_date":"2026-01-31"}',NULL,NULL,'success',NULL,'2026-01-13 03:46:32');
INSERT INTO "audit_logs" VALUES('log-mkc1vp6t-5b4vf5boy','org-001','user-001','login','user','user-001',NULL,NULL,'156.38.57.58',NULL,'success',NULL,'2026-01-13 03:46:49');
INSERT INTO "audit_logs" VALUES('audit-mkc1w8dy-pubau8i9l','org-001',NULL,'update','risk','risk-aud-mkbjlv6u-qs6bwv','{"id":"risk-aud-mkbjlv6u-qs6bwv","organization_id":"org-001","title":"no security awarance program implemeted","description":"no security awarance program implemeted","risk_source":"audit_finding","external_reference":"audit:afnd-mkbjlueo-me6tfd|engagement:eng-mkbh42si-47ebav|controls:A.6.3","category":"compliance","subcategory":null,"affected_asset_id":null,"affected_vendor_id":null,"affected_control_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"inherent_score":36,"residual_likelihood":null,"residual_impact":null,"residual_score":null,"business_impact_score":null,"financial_exposure":null,"context_priority_score":null,"context_priority_reason":null,"status":"mitigated","assignee_id":null,"due_date":"2026-01-31","remediation_plan":null,"remediation_cost_estimate":null,"remediation_effort_days":null,"evidence_urls":"[]","ai_analysis":"{}","ai_suggested_controls":"[]","discovered_at":"2026-01-12 19:15:17","last_assessed_at":null,"resolved_at":"2026-01-13T03:25:08.539Z","created_at":"2026-01-12 19:15:17","updated_at":"2026-01-13T03:46:32.488Z","created_by":null}','{"title":"no security awarance program implemeted","description":"no security awarance program implemeted","risk_source":"audit_finding","category":"compliance","affected_asset_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"context_priority_score":9,"ai_analysis":"{\"risk_score\":9,\"likelihood\":3,\"impact\":3,\"severity\":\"medium\"}","status":"mitigated","assignee_id":null,"due_date":"2026-01-31"}',NULL,NULL,'success',NULL,'2026-01-13 03:47:14');
INSERT INTO "audit_logs" VALUES('audit-mkc23roi-iilcwiqh5','org-001',NULL,'update','risk','risk-aud-mkbhclol-ogqe3q','{"id":"risk-aud-mkbhclol-ogqe3q","organization_id":"org-001","title":"Clean desk policy not enforced","description":"the users not locked computers and no screen saver configured ","risk_source":"audit_finding","external_reference":"audit:afnd-mkbhc0rm-hcrgdk|engagement:eng-mkbh42si-47ebav","category":"compliance","subcategory":null,"affected_asset_id":null,"affected_vendor_id":null,"affected_control_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"inherent_score":36,"residual_likelihood":null,"residual_impact":null,"residual_score":null,"business_impact_score":null,"financial_exposure":null,"context_priority_score":null,"context_priority_reason":null,"status":"open","assignee_id":null,"due_date":"2026-01-24","remediation_plan":null,"remediation_cost_estimate":null,"remediation_effort_days":null,"evidence_urls":"[]","ai_analysis":"{}","ai_suggested_controls":"[]","discovered_at":"2026-01-12 18:12:06","last_assessed_at":null,"resolved_at":null,"created_at":"2026-01-12 18:12:06","updated_at":"2026-01-12T18:23:31.584Z","created_by":null}','{"title":"Clean desk policy not enforced","description":"the users not locked computers and no screen saver configured ","risk_source":"audit_finding","category":"compliance","affected_asset_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"context_priority_score":9,"ai_analysis":"{\"risk_score\":9,\"likelihood\":3,\"impact\":3,\"severity\":\"medium\"}","status":"mitigated","assignee_id":null,"due_date":"2026-01-24"}',NULL,NULL,'success',NULL,'2026-01-13 03:53:06');
INSERT INTO "audit_logs" VALUES('audit-mkc23tsp-j2kqrzf9d','org-001',NULL,'update','risk','risk-aud-mkbhclol-ogqe3q','{"id":"risk-aud-mkbhclol-ogqe3q","organization_id":"org-001","title":"Clean desk policy not enforced","description":"the users not locked computers and no screen saver configured ","risk_source":"audit_finding","external_reference":"audit:afnd-mkbhc0rm-hcrgdk|engagement:eng-mkbh42si-47ebav","category":"compliance","subcategory":null,"affected_asset_id":null,"affected_vendor_id":null,"affected_control_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"inherent_score":36,"residual_likelihood":null,"residual_impact":null,"residual_score":null,"business_impact_score":null,"financial_exposure":null,"context_priority_score":null,"context_priority_reason":null,"status":"mitigated","assignee_id":null,"due_date":"2026-01-24","remediation_plan":null,"remediation_cost_estimate":null,"remediation_effort_days":null,"evidence_urls":"[]","ai_analysis":"{}","ai_suggested_controls":"[]","discovered_at":"2026-01-12 18:12:06","last_assessed_at":null,"resolved_at":"2026-01-13T03:52:53.498Z","created_at":"2026-01-12 18:12:06","updated_at":"2026-01-13T03:52:53.498Z","created_by":null}','{"title":"Clean desk policy not enforced","description":"the users not locked computers and no screen saver configured ","risk_source":"audit_finding","category":"compliance","affected_asset_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"context_priority_score":9,"ai_analysis":"{\"risk_score\":9,\"likelihood\":3,\"impact\":3,\"severity\":\"medium\"}","status":"mitigated","assignee_id":null,"due_date":"2026-01-24"}',NULL,NULL,'success',NULL,'2026-01-13 03:53:08');
INSERT INTO "audit_logs" VALUES('log-mkc2hjpc-fuj5rlqhu','org-001','user-001','login','user','user-001',NULL,NULL,'156.38.57.58',NULL,'success',NULL,'2026-01-13 04:03:48');
INSERT INTO "audit_logs" VALUES('audit-mkc2i7gd-o83n4trik','org-001',NULL,'update','risk','risk-aud-mkbhclol-ogqe3q','{"id":"risk-aud-mkbhclol-ogqe3q","organization_id":"org-001","title":"Clean desk policy not enforced","description":"the users not locked computers and no screen saver configured ","risk_source":"audit_finding","external_reference":"audit:afnd-mkbhc0rm-hcrgdk|engagement:eng-mkbh42si-47ebav","category":"compliance","subcategory":null,"affected_asset_id":null,"affected_vendor_id":null,"affected_control_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"inherent_score":36,"residual_likelihood":null,"residual_impact":null,"residual_score":null,"business_impact_score":null,"financial_exposure":null,"context_priority_score":null,"context_priority_reason":null,"status":"mitigated","assignee_id":null,"due_date":"2026-01-24","remediation_plan":null,"remediation_cost_estimate":null,"remediation_effort_days":null,"evidence_urls":"[]","ai_analysis":"{}","ai_suggested_controls":"[]","discovered_at":"2026-01-12 18:12:06","last_assessed_at":null,"resolved_at":"2026-01-13T03:52:53.498Z","created_at":"2026-01-12 18:12:06","updated_at":"2026-01-13T03:53:08.603Z","created_by":null}','{"title":"Clean desk policy not enforced","description":"the users not locked computers and no screen saver configured ","risk_source":"audit_finding","category":"compliance","affected_asset_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"context_priority_score":9,"ai_analysis":"{\"risk_score\":9,\"likelihood\":3,\"impact\":3,\"severity\":\"medium\"}","status":"open","assignee_id":null,"due_date":"2026-01-24"}',NULL,NULL,'success',NULL,'2026-01-13 04:04:19');
INSERT INTO "audit_logs" VALUES('audit-mkc2juqd-ojfyuxhid','org-001',NULL,'update','risk','risk-aud-mkbjlv6u-qs6bwv','{"id":"risk-aud-mkbjlv6u-qs6bwv","organization_id":"org-001","title":"no security awarance program implemeted","description":"no security awarance program implemeted","risk_source":"audit_finding","external_reference":"audit:afnd-mkbjlueo-me6tfd|engagement:eng-mkbh42si-47ebav|controls:A.6.3","category":"compliance","subcategory":null,"affected_asset_id":null,"affected_vendor_id":null,"affected_control_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"inherent_score":36,"residual_likelihood":null,"residual_impact":null,"residual_score":null,"business_impact_score":null,"financial_exposure":null,"context_priority_score":null,"context_priority_reason":null,"status":"mitigated","assignee_id":null,"due_date":"2026-01-31","remediation_plan":null,"remediation_cost_estimate":null,"remediation_effort_days":null,"evidence_urls":"[]","ai_analysis":"{}","ai_suggested_controls":"[]","discovered_at":"2026-01-12 19:15:17","last_assessed_at":null,"resolved_at":"2026-01-13T03:25:08.539Z","created_at":"2026-01-12 19:15:17","updated_at":"2026-01-13T03:47:14.270Z","created_by":null}','{"title":"no security awarance program implemeted","description":"no security awarance program implemeted","risk_source":"audit_finding","category":"compliance","affected_asset_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"context_priority_score":9,"ai_analysis":"{\"risk_score\":9,\"likelihood\":3,\"impact\":3,\"severity\":\"medium\"}","status":"mitigated","assignee_id":null,"due_date":"2026-01-31"}',NULL,NULL,'success',NULL,'2026-01-13 04:05:36');
INSERT INTO "audit_logs" VALUES('log-mkc2t99m-k6ykd87bd','org-001','user-001','login','user','user-001',NULL,NULL,'156.38.57.58',NULL,'success',NULL,'2026-01-13 04:12:55');
INSERT INTO "audit_logs" VALUES('audit-mkc2tr8s-dezapnbbx','org-001',NULL,'update','risk','risk-aud-mkbhclol-ogqe3q','{"id":"risk-aud-mkbhclol-ogqe3q","organization_id":"org-001","title":"Clean desk policy not enforced","description":"the users not locked computers and no screen saver configured ","risk_source":"audit_finding","external_reference":"audit:afnd-mkbhc0rm-hcrgdk|engagement:eng-mkbh42si-47ebav","category":"compliance","subcategory":null,"affected_asset_id":null,"affected_vendor_id":null,"affected_control_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"inherent_score":36,"residual_likelihood":null,"residual_impact":null,"residual_score":null,"business_impact_score":null,"financial_exposure":null,"context_priority_score":null,"context_priority_reason":null,"status":"mitigated","assignee_id":null,"due_date":"2026-01-24","remediation_plan":null,"remediation_cost_estimate":null,"remediation_effort_days":null,"evidence_urls":"[]","ai_analysis":"{}","ai_suggested_controls":"[]","discovered_at":"2026-01-12 18:12:06","last_assessed_at":null,"resolved_at":"2026-01-13T03:52:53.498Z","created_at":"2026-01-12 18:12:06","updated_at":"2026-01-13 04:10:31","created_by":null}','{"title":"Clean desk policy not enforced","description":"the users not locked computers and no screen saver configured ","risk_source":"audit_finding","category":"compliance","affected_asset_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"context_priority_score":9,"ai_analysis":"{\"risk_score\":9,\"likelihood\":3,\"impact\":3,\"severity\":\"medium\"}","status":"open","assignee_id":null,"due_date":"2026-01-24"}',NULL,NULL,'success',NULL,'2026-01-13 04:13:18');
INSERT INTO "audit_logs" VALUES('audit-mkc2v4ch-z74xoc5pl','org-001',NULL,'update','risk','risk-aud-mkbhclol-ogqe3q','{"id":"risk-aud-mkbhclol-ogqe3q","organization_id":"org-001","title":"Clean desk policy not enforced","description":"the users not locked computers and no screen saver configured ","risk_source":"audit_finding","external_reference":"audit:afnd-mkbhc0rm-hcrgdk|engagement:eng-mkbh42si-47ebav","category":"compliance","subcategory":null,"affected_asset_id":null,"affected_vendor_id":null,"affected_control_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"inherent_score":36,"residual_likelihood":null,"residual_impact":null,"residual_score":null,"business_impact_score":null,"financial_exposure":null,"context_priority_score":null,"context_priority_reason":null,"status":"open","assignee_id":null,"due_date":"2026-01-24","remediation_plan":null,"remediation_cost_estimate":null,"remediation_effort_days":null,"evidence_urls":"[]","ai_analysis":"{}","ai_suggested_controls":"[]","discovered_at":"2026-01-12 18:12:06","last_assessed_at":null,"resolved_at":"2026-01-13T03:52:53.498Z","created_at":"2026-01-12 18:12:06","updated_at":"2026-01-13T04:13:18.352Z","created_by":null}','{"title":"Clean desk policy not enforced","description":"the users not locked computers and no screen saver configured ","risk_source":"audit_finding","category":"compliance","affected_asset_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"context_priority_score":9,"ai_analysis":"{\"risk_score\":9,\"likelihood\":3,\"impact\":3,\"severity\":\"medium\"}","status":"mitigated","assignee_id":null,"due_date":"2026-01-24"}',NULL,NULL,'success',NULL,'2026-01-13 04:14:22');
INSERT INTO "audit_logs" VALUES('log-mkc35y6w-8zq31hkcv','org-001','user-001','login','user','user-001',NULL,NULL,'156.38.57.58',NULL,'success',NULL,'2026-01-13 04:22:47');
INSERT INTO "audit_logs" VALUES('audit-mkc36qq4-0h373860i','org-001',NULL,'update','risk','risk-aud-mkbjlv6u-qs6bwv','{"id":"risk-aud-mkbjlv6u-qs6bwv","organization_id":"org-001","title":"no security awarance program implemeted","description":"no security awarance program implemeted","risk_source":"audit_finding","external_reference":"audit:afnd-mkbjlueo-me6tfd|engagement:eng-mkbh42si-47ebav|controls:A.6.3","category":"compliance","subcategory":null,"affected_asset_id":null,"affected_vendor_id":null,"affected_control_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"inherent_score":36,"residual_likelihood":null,"residual_impact":null,"residual_score":null,"business_impact_score":null,"financial_exposure":null,"context_priority_score":null,"context_priority_reason":null,"status":"mitigated","assignee_id":null,"due_date":"2026-01-31","remediation_plan":null,"remediation_cost_estimate":null,"remediation_effort_days":null,"evidence_urls":"[]","ai_analysis":"{}","ai_suggested_controls":"[]","discovered_at":"2026-01-12 19:15:17","last_assessed_at":null,"resolved_at":"2026-01-13T03:25:08.539Z","created_at":"2026-01-12 19:15:17","updated_at":"2026-01-13T04:05:31.368Z","created_by":null}','{"status":"open"}',NULL,NULL,'success',NULL,'2026-01-13 04:23:24');
INSERT INTO "audit_logs" VALUES('audit-mkc38fya-c6ls653sr','org-001',NULL,'update','risk','risk-aud-mkbjlv6u-qs6bwv','{"id":"risk-aud-mkbjlv6u-qs6bwv","organization_id":"org-001","title":"no security awarance program implemeted","description":"no security awarance program implemeted","risk_source":"audit_finding","external_reference":"audit:afnd-mkbjlueo-me6tfd|engagement:eng-mkbh42si-47ebav|controls:A.6.3","category":"compliance","subcategory":null,"affected_asset_id":null,"affected_vendor_id":null,"affected_control_id":null,"inherent_likelihood":0.6,"inherent_impact":0.6,"inherent_score":36,"residual_likelihood":null,"residual_impact":null,"residual_score":null,"business_impact_score":null,"financial_exposure":null,"context_priority_score":null,"context_priority_reason":null,"status":"open","assignee_id":null,"due_date":"2026-01-31","remediation_plan":null,"remediation_cost_estimate":null,"remediation_effort_days":null,"evidence_urls":"[]","ai_analysis":"{}","ai_suggested_controls":"[]","discovered_at":"2026-01-12 19:15:17","last_assessed_at":null,"resolved_at":"2026-01-13T03:25:08.539Z","created_at":"2026-01-12 19:15:17","updated_at":"2026-01-13T04:23:05.547Z","created_by":null}','{"status":"mitigated"}',NULL,NULL,'success',NULL,'2026-01-13 04:24:43');
INSERT INTO "audit_logs" VALUES('log-mkc3k620-xeogvlwq7','org-001','user-001','login','user','user-001',NULL,NULL,'156.38.57.58',NULL,'success',NULL,'2026-01-13 04:33:50');
CREATE TABLE notifications (
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
INSERT INTO "notifications" VALUES('notif-001','org-001','user-001','risk_alert','Critical Risk Detected','SQL Injection vulnerability found in payment-api-prod','risk','risk-001',NULL,0,NULL,'urgent','2025-12-24 12:07:01',NULL);
INSERT INTO "notifications" VALUES('notif-002','org-001','user-001','vendor_incident','Vendor Security Incident','Datadog reports unauthorized access to customer metadata','vendor_incident','incident-002',NULL,0,NULL,'high','2025-12-24 12:07:01',NULL);
INSERT INTO "notifications" VALUES('notif-003','org-001','user-002','task_due','Risk Remediation Due Soon','MFA implementation due in 4 days','risk','risk-004',NULL,0,NULL,'normal','2025-12-24 12:07:01',NULL);
CREATE TABLE maturity_assessments (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    assessment_type TEXT DEFAULT 'security' CHECK (assessment_type IN ('security', 'privacy', 'risk', 'compliance')),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'archived')),
    overall_score REAL,
    overall_percentage REAL,
    target_score REAL DEFAULT 5.0,
    assessor_id TEXT REFERENCES users(id),
    reviewer_id TEXT REFERENCES users(id),
    approved_by TEXT REFERENCES users(id),
    approved_at TEXT,
    assessment_date TEXT DEFAULT (datetime('now')),
    next_assessment_due TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    created_by TEXT REFERENCES users(id)
);
INSERT INTO "maturity_assessments" VALUES('maturity-mjkc5cze-t5n12yo6b','org-001','Initial Security Assessment',NULL,'security','completed',3.55,70.96,5,NULL,NULL,NULL,NULL,'2025-12-24 18:16:43',NULL,NULL,'2025-12-24 18:16:43','2025-12-24 18:16:43',NULL);
INSERT INTO "maturity_assessments" VALUES('maturity-mjkc5t71-fw69sxz28','org-001','Security Maturity Assessment - 24/12/2025',NULL,'security','completed',3.45,69,5,NULL,NULL,NULL,NULL,'2025-12-24 18:17:04',NULL,NULL,'2025-12-24 18:17:04','2025-12-24 18:34:57',NULL);
INSERT INTO "maturity_assessments" VALUES('maturity-mjkcm04q-v39jby189','org-001','Security Maturity Assessment - 24/12/2025',NULL,'security','completed',3.06,61.29,5,'user-001',NULL,NULL,NULL,'2025-12-24 18:29:40',NULL,NULL,'2025-12-24 18:29:40','2025-12-24 18:30:32','user-001');
CREATE TABLE maturity_responses (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL REFERENCES maturity_assessments(id) ON DELETE CASCADE,
    category_id TEXT NOT NULL,
    question_id INTEGER NOT NULL,
    current_score INTEGER CHECK (current_score >= 0 AND current_score <= 5),
    target_score INTEGER DEFAULT 5 CHECK (target_score >= 0 AND target_score <= 5),
    evidence TEXT,
    notes TEXT,
    action_plan TEXT,
    responsible_person TEXT,
    target_date TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(assessment_id, question_id)
);
INSERT INTO "maturity_responses" VALUES('resp-mjkc5d0n-jc697ydhe','maturity-mjkc5cze-t5n12yo6b','governance',1,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:16:43','2025-12-24 18:16:43');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5d28-xwjhn63k9','maturity-mjkc5cze-t5n12yo6b','governance',2,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:16:43','2025-12-24 18:16:43');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5d35-0ozem6qyu','maturity-mjkc5cze-t5n12yo6b','governance',3,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:16:43','2025-12-24 18:16:43');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5d48-67ugz0qzk','maturity-mjkc5cze-t5n12yo6b','governance',4,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:16:43','2025-12-24 18:16:43');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5d59-p9bip7e7n','maturity-mjkc5cze-t5n12yo6b','policies',5,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:16:43','2025-12-24 18:16:43');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5d69-lhp2jfngm','maturity-mjkc5cze-t5n12yo6b','policies',6,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:16:43','2025-12-24 18:16:43');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5d73-xkcvn8kr4','maturity-mjkc5cze-t5n12yo6b','policies',7,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:16:43','2025-12-24 18:16:43');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5d86-d09yixwi9','maturity-mjkc5cze-t5n12yo6b','organization',8,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:16:43','2025-12-24 18:16:43');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5d94-ptb275w8k','maturity-mjkc5cze-t5n12yo6b','organization',9,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:16:43','2025-12-24 18:16:43');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5da4-fvjnysmxh','maturity-mjkc5cze-t5n12yo6b','organization',10,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:16:43','2025-12-24 18:16:43');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5dbt-jbqmfygp0','maturity-mjkc5cze-t5n12yo6b','organization',11,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:16:43','2025-12-24 18:16:43');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5dct-usp01c6rl','maturity-mjkc5cze-t5n12yo6b','organization',12,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:16:44','2025-12-24 18:16:44');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5dez-j1ycn863y','maturity-mjkc5cze-t5n12yo6b','organization',13,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:16:44','2025-12-24 18:16:44');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5dft-1w1qqc5xw','maturity-mjkc5cze-t5n12yo6b','organization',14,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:16:44','2025-12-24 18:16:44');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5dgu-lxonpvrxu','maturity-mjkc5cze-t5n12yo6b','hr_security',15,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:16:44','2025-12-24 18:16:44');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5dhy-ikwokqqqk','maturity-mjkc5cze-t5n12yo6b','hr_security',16,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:16:44','2025-12-24 18:16:44');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5diy-ebyohrwf6','maturity-mjkc5cze-t5n12yo6b','hr_security',17,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:16:44','2025-12-24 18:16:44');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5djz-srkudc9up','maturity-mjkc5cze-t5n12yo6b','hr_security',18,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:16:44','2025-12-24 18:16:44');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5dl9-07wha6lus','maturity-mjkc5cze-t5n12yo6b','hr_security',19,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:16:44','2025-12-24 18:16:44');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5dme-fz01fxugb','maturity-mjkc5cze-t5n12yo6b','communication',20,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:16:44','2025-12-24 18:16:44');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5dne-47jo071gk','maturity-mjkc5cze-t5n12yo6b','communication',21,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:16:44','2025-12-24 18:16:44');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5doc-ohmcfwo9r','maturity-mjkc5cze-t5n12yo6b','supplier',22,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:16:44','2025-12-24 18:16:44');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5dph-xmq7ttpk4','maturity-mjkc5cze-t5n12yo6b','supplier',23,2,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:16:44','2025-12-24 18:16:44');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5dqn-mk216jzim','maturity-mjkc5cze-t5n12yo6b','supplier',24,2,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:16:44','2025-12-24 18:16:44');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5drs-quxr6rj0s','maturity-mjkc5cze-t5n12yo6b','supplier',25,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:16:44','2025-12-24 18:16:44');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5dsy-qco2mgu1a','maturity-mjkc5cze-t5n12yo6b','risk',26,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:16:44','2025-12-24 18:16:44');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5du2-tervluy49','maturity-mjkc5cze-t5n12yo6b','risk',27,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:16:44','2025-12-24 18:16:44');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5dv1-7xn6ebnrs','maturity-mjkc5cze-t5n12yo6b','risk',28,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:16:44','2025-12-24 18:16:44');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5dw0-fwav2h06j','maturity-mjkc5cze-t5n12yo6b','incident',29,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:16:44','2025-12-24 18:16:44');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5dxb-p3dywjpvk','maturity-mjkc5cze-t5n12yo6b','incident',30,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:16:44','2025-12-24 18:16:44');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5dy9-40d6zzhxh','maturity-mjkc5cze-t5n12yo6b','incident',31,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:16:44','2025-12-24 18:16:44');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5dza-e5006evq9','maturity-mjkc5cze-t5n12yo6b','continuity',32,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:16:44','2025-12-24 18:16:44');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5t7y-0c6uajuar','maturity-mjkc5t71-fw69sxz28','governance',1,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:17:04','2025-12-24 18:34:57');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5t8p-65tn44vn6','maturity-mjkc5t71-fw69sxz28','governance',2,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:17:04','2025-12-24 18:34:57');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5t9i-p5u3lvmfw','maturity-mjkc5t71-fw69sxz28','governance',3,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:17:04','2025-12-24 18:34:58');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5ta8-7ut74nxpy','maturity-mjkc5t71-fw69sxz28','governance',4,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:17:04','2025-12-24 18:34:58');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5tb2-ajmuvvmy6','maturity-mjkc5t71-fw69sxz28','policies',5,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:17:04','2025-12-24 18:34:59');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5tbx-pynqz15pe','maturity-mjkc5t71-fw69sxz28','policies',6,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:17:04','2025-12-24 18:34:59');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5tcw-69i6suuaj','maturity-mjkc5t71-fw69sxz28','policies',7,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:17:04','2025-12-24 18:35:00');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5tdw-ypul0n6tj','maturity-mjkc5t71-fw69sxz28','organization',8,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:17:04','2025-12-24 18:35:00');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5tew-o64m6h2g0','maturity-mjkc5t71-fw69sxz28','organization',9,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:17:04','2025-12-24 18:35:00');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5tfw-f1xzf0mu7','maturity-mjkc5t71-fw69sxz28','organization',10,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:17:04','2025-12-24 18:35:01');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5tgx-gohp3j6se','maturity-mjkc5t71-fw69sxz28','organization',11,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:17:04','2025-12-24 18:35:01');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5thr-f450h5t6o','maturity-mjkc5t71-fw69sxz28','organization',12,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:17:04','2025-12-24 18:35:02');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5tip-9zuko864c','maturity-mjkc5t71-fw69sxz28','organization',13,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:17:04','2025-12-24 18:35:02');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5tjr-j3jcbrm25','maturity-mjkc5t71-fw69sxz28','organization',14,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:17:04','2025-12-24 18:35:03');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5tkl-o6rhwl6u9','maturity-mjkc5t71-fw69sxz28','hr_security',15,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:17:05','2025-12-24 18:35:03');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5tlg-ae107cbta','maturity-mjkc5t71-fw69sxz28','hr_security',16,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:17:05','2025-12-24 18:35:03');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5tm6-f7tcv57cy','maturity-mjkc5t71-fw69sxz28','hr_security',17,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:17:05','2025-12-24 18:35:04');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5tn1-szkv0ian2','maturity-mjkc5t71-fw69sxz28','hr_security',18,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:17:05','2025-12-24 18:35:04');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5tnv-pfz3ivsdx','maturity-mjkc5t71-fw69sxz28','hr_security',19,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:17:05','2025-12-24 18:35:04');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5tor-dlbi9twfz','maturity-mjkc5t71-fw69sxz28','communication',20,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:17:05','2025-12-24 18:35:05');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5tpj-8f6p5v6ax','maturity-mjkc5t71-fw69sxz28','communication',21,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:17:05','2025-12-24 18:35:05');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5tqb-m4c9dzaxj','maturity-mjkc5t71-fw69sxz28','supplier',22,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:17:05','2025-12-24 18:35:05');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5tr6-2prz2d4gf','maturity-mjkc5t71-fw69sxz28','supplier',23,2,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:17:05','2025-12-24 18:35:06');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5ts1-4c126ou5u','maturity-mjkc5t71-fw69sxz28','supplier',24,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:17:05','2025-12-24 18:35:06');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5tsw-rwkzsc17l','maturity-mjkc5t71-fw69sxz28','supplier',25,2,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:17:05','2025-12-24 18:35:06');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5tts-vibx4m96e','maturity-mjkc5t71-fw69sxz28','risk',26,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:17:05','2025-12-24 18:35:07');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5tul-a7qntn8zo','maturity-mjkc5t71-fw69sxz28','risk',27,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:17:05','2025-12-24 18:35:07');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5tva-l6b8539z2','maturity-mjkc5t71-fw69sxz28','risk',28,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:17:05','2025-12-24 18:35:08');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5tw0-m0a8k1h8r','maturity-mjkc5t71-fw69sxz28','incident',29,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:17:05','2025-12-24 18:35:08');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5twy-4u34ariur','maturity-mjkc5t71-fw69sxz28','incident',30,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:17:05','2025-12-24 18:35:08');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5txt-l2nwsm1ao','maturity-mjkc5t71-fw69sxz28','incident',31,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:17:05','2025-12-24 18:35:09');
INSERT INTO "maturity_responses" VALUES('resp-mjkc5typ-3kkwoq23t','maturity-mjkc5t71-fw69sxz28','continuity',32,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:17:05','2025-12-24 18:35:09');
INSERT INTO "maturity_responses" VALUES('resp-mjkcm0ix-1ugyvlidd','maturity-mjkcm04q-v39jby189','governance',1,5,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:29:40','2025-12-24 18:30:32');
INSERT INTO "maturity_responses" VALUES('resp-mjkcm0nh-6midmxhp3','maturity-mjkcm04q-v39jby189','governance',2,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:29:40','2025-12-24 18:30:33');
INSERT INTO "maturity_responses" VALUES('resp-mjkcm0s6-cz7k8dys6','maturity-mjkcm04q-v39jby189','governance',3,2,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:29:40','2025-12-24 18:30:33');
INSERT INTO "maturity_responses" VALUES('resp-mjkcm0x7-58sbmeesa','maturity-mjkcm04q-v39jby189','governance',4,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:29:41','2025-12-24 18:30:33');
INSERT INTO "maturity_responses" VALUES('resp-mjkcm12f-adxk0ww0g','maturity-mjkcm04q-v39jby189','policies',5,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:29:41','2025-12-24 18:30:34');
INSERT INTO "maturity_responses" VALUES('resp-mjkcm1be-k6i44lkdc','maturity-mjkcm04q-v39jby189','policies',6,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:29:41','2025-12-24 18:30:34');
INSERT INTO "maturity_responses" VALUES('resp-mjkcm1g1-wegho4e41','maturity-mjkcm04q-v39jby189','policies',7,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:29:41','2025-12-24 18:30:34');
INSERT INTO "maturity_responses" VALUES('resp-mjkcm1ki-0bs23orvl','maturity-mjkcm04q-v39jby189','organization',8,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:29:41','2025-12-24 18:30:35');
INSERT INTO "maturity_responses" VALUES('resp-mjkcm1p1-t1vrfg5fp','maturity-mjkcm04q-v39jby189','organization',9,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:29:42','2025-12-24 18:30:35');
INSERT INTO "maturity_responses" VALUES('resp-mjkcm1tn-oe34lmqha','maturity-mjkcm04q-v39jby189','organization',10,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:29:42','2025-12-24 18:30:35');
INSERT INTO "maturity_responses" VALUES('resp-mjkcm1y8-ke063sne4','maturity-mjkcm04q-v39jby189','organization',11,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:29:42','2025-12-24 18:30:36');
INSERT INTO "maturity_responses" VALUES('resp-mjkcm22k-fu55gd43n','maturity-mjkcm04q-v39jby189','organization',12,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:29:42','2025-12-24 18:30:36');
INSERT INTO "maturity_responses" VALUES('resp-mjkcm274-ikftjzsyu','maturity-mjkcm04q-v39jby189','organization',13,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:29:42','2025-12-24 18:30:36');
INSERT INTO "maturity_responses" VALUES('resp-mjkcm2bv-scdrrpqsm','maturity-mjkcm04q-v39jby189','organization',14,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:29:42','2025-12-24 18:30:37');
INSERT INTO "maturity_responses" VALUES('resp-mjkcm2gc-9kapode7b','maturity-mjkcm04q-v39jby189','hr_security',15,4,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:29:43','2025-12-24 18:30:37');
INSERT INTO "maturity_responses" VALUES('resp-mjkcm2kw-l7fbcb3r7','maturity-mjkcm04q-v39jby189','hr_security',16,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:29:43','2025-12-24 18:30:38');
INSERT INTO "maturity_responses" VALUES('resp-mjkcm2pq-rmdbpsy30','maturity-mjkcm04q-v39jby189','hr_security',17,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:29:43','2025-12-24 18:30:38');
INSERT INTO "maturity_responses" VALUES('resp-mjkcm2ur-am3xk5wtu','maturity-mjkcm04q-v39jby189','hr_security',18,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:29:43','2025-12-24 18:30:38');
INSERT INTO "maturity_responses" VALUES('resp-mjkcm2zb-qdg7oguch','maturity-mjkcm04q-v39jby189','communication',20,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:29:43','2025-12-24 18:30:39');
INSERT INTO "maturity_responses" VALUES('resp-mjkcm33z-c1ruse1i7','maturity-mjkcm04q-v39jby189','communication',21,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:29:43','2025-12-24 18:30:39');
INSERT INTO "maturity_responses" VALUES('resp-mjkcm38k-aud9xv2y8','maturity-mjkcm04q-v39jby189','supplier',22,2,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:29:44','2025-12-24 18:30:39');
INSERT INTO "maturity_responses" VALUES('resp-mjkcm3du-zs7slpf55','maturity-mjkcm04q-v39jby189','supplier',23,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:29:44','2025-12-24 18:30:40');
INSERT INTO "maturity_responses" VALUES('resp-mjkcm3ji-36hfh2u4y','maturity-mjkcm04q-v39jby189','supplier',24,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:29:44','2025-12-24 18:30:40');
INSERT INTO "maturity_responses" VALUES('resp-mjkcm3p4-6co47hb2o','maturity-mjkcm04q-v39jby189','supplier',25,1,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:29:44','2025-12-24 18:30:40');
INSERT INTO "maturity_responses" VALUES('resp-mjkcm3tt-kseeoth5h','maturity-mjkcm04q-v39jby189','risk',26,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:29:44','2025-12-24 18:30:41');
INSERT INTO "maturity_responses" VALUES('resp-mjkcm3yk-ihnl96uz0','maturity-mjkcm04q-v39jby189','risk',27,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:29:45','2025-12-24 18:30:41');
INSERT INTO "maturity_responses" VALUES('resp-mjkcm43j-88ebvwrec','maturity-mjkcm04q-v39jby189','risk',28,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:29:45','2025-12-24 18:30:42');
INSERT INTO "maturity_responses" VALUES('resp-mjkcm483-8v4gdlhp0','maturity-mjkcm04q-v39jby189','incident',29,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:29:45','2025-12-24 18:30:42');
INSERT INTO "maturity_responses" VALUES('resp-mjkcm4cq-ji4s8md06','maturity-mjkcm04q-v39jby189','incident',30,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:29:45','2025-12-24 18:30:43');
INSERT INTO "maturity_responses" VALUES('resp-mjkcm4hr-zs3di34t2','maturity-mjkcm04q-v39jby189','incident',31,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:29:45','2025-12-24 18:30:43');
INSERT INTO "maturity_responses" VALUES('resp-mjkcm4mo-2xqg8aud3','maturity-mjkcm04q-v39jby189','continuity',32,3,5,NULL,NULL,NULL,NULL,NULL,'2025-12-24 18:29:45','2025-12-24 18:30:43');
CREATE TABLE maturity_category_scores (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL REFERENCES maturity_assessments(id) ON DELETE CASCADE,
    category_id TEXT NOT NULL,
    category_name_en TEXT NOT NULL,
    category_name_ar TEXT,
    current_score REAL,
    target_score REAL DEFAULT 5.0,
    questions_answered INTEGER DEFAULT 0,
    total_questions INTEGER,
    gap_score REAL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(assessment_id, category_id)
);
INSERT INTO "maturity_category_scores" VALUES('catscore-mjkc5e0f-xfni4pacv','maturity-mjkc5cze-t5n12yo6b','governance','Governance & Management Commitment','حوكمة ومدى التزام الإدارة بدعم أمن المعلومات',3.75,5,4,4,NULL,'2025-12-24 18:16:44','2025-12-24 18:16:44');
INSERT INTO "maturity_category_scores" VALUES('catscore-mjkc5e1o-djcurkelo','maturity-mjkc5cze-t5n12yo6b','policies','Security Policies','سياسات أمن المعلومات',3.67,5,3,3,NULL,'2025-12-24 18:16:44','2025-12-24 18:16:44');
INSERT INTO "maturity_category_scores" VALUES('catscore-mjkc5e2z-akg89r5kx','maturity-mjkc5cze-t5n12yo6b','organization','Organizational Structure','هيكلية أمن المعلومات في المؤسسة',3.71,5,7,7,NULL,'2025-12-24 18:16:44','2025-12-24 18:16:44');
INSERT INTO "maturity_category_scores" VALUES('catscore-mjkc5e40-xrkm7ichf','maturity-mjkc5cze-t5n12yo6b','hr_security','HR Security','أمن المعلومات للموارد البشرية',3.8,5,5,5,NULL,'2025-12-24 18:16:44','2025-12-24 18:16:44');
INSERT INTO "maturity_category_scores" VALUES('catscore-mjkc5e4y-jng9qnptn','maturity-mjkc5cze-t5n12yo6b','communication','Communication','آليات وعملية التواصل',3.5,5,2,2,NULL,'2025-12-24 18:16:44','2025-12-24 18:16:44');
INSERT INTO "maturity_category_scores" VALUES('catscore-mjkc5e5z-zmzthu6dk','maturity-mjkc5cze-t5n12yo6b','supplier','Supplier Security','أمن المعلومات مع الموردين',2.5,5,4,4,NULL,'2025-12-24 18:16:45','2025-12-24 18:16:45');
INSERT INTO "maturity_category_scores" VALUES('catscore-mjkc5e73-nnd1munco','maturity-mjkc5cze-t5n12yo6b','risk','Risk Management','إدارة المخاطر',4,5,3,3,NULL,'2025-12-24 18:16:45','2025-12-24 18:16:45');
INSERT INTO "maturity_category_scores" VALUES('catscore-mjkc5e89-psdoez5sp','maturity-mjkc5cze-t5n12yo6b','incident','Incident Response','الاستجابة لحوادث الأمن السيبراني',4,5,3,3,NULL,'2025-12-24 18:16:45','2025-12-24 18:16:45');
INSERT INTO "maturity_category_scores" VALUES('catscore-mjkc5e9a-bdyyq8m4b','maturity-mjkc5cze-t5n12yo6b','continuity','Business Continuity','جوانب أمن المعلومات في إدارة استمرارية الأعمال',3,5,1,1,NULL,'2025-12-24 18:16:45','2025-12-24 18:16:45');
INSERT INTO "maturity_category_scores" VALUES('catscore-mjkc5tzh-eynsctiab','maturity-mjkc5t71-fw69sxz28','governance','Governance & Management Commitment','حوكمة ومدى التزام الإدارة بدعم أمن المعلومات',3.75,5,4,4,NULL,'2025-12-24 18:17:05','2025-12-24 18:35:10');
INSERT INTO "maturity_category_scores" VALUES('catscore-mjkc5u08-o175972d7','maturity-mjkc5t71-fw69sxz28','policies','Security Policies','سياسات أمن المعلومات',3.33,5,3,3,NULL,'2025-12-24 18:17:05','2025-12-24 18:35:10');
INSERT INTO "maturity_category_scores" VALUES('catscore-mjkc5u0z-0zgoe60av','maturity-mjkc5t71-fw69sxz28','organization','Organizational Structure','هيكلية أمن المعلومات في المؤسسة',3.57,5,7,7,NULL,'2025-12-24 18:17:05','2025-12-24 18:35:10');
INSERT INTO "maturity_category_scores" VALUES('catscore-mjkc5u1z-a0at1lm6g','maturity-mjkc5t71-fw69sxz28','hr_security','HR Security','أمن المعلومات للموارد البشرية',3.4,5,5,5,NULL,'2025-12-24 18:17:05','2025-12-24 18:35:11');
INSERT INTO "maturity_category_scores" VALUES('catscore-mjkc5u30-38lb3djrr','maturity-mjkc5t71-fw69sxz28','communication','Communication','آليات وعملية التواصل',3.5,5,2,2,NULL,'2025-12-24 18:17:05','2025-12-24 18:35:11');
INSERT INTO "maturity_category_scores" VALUES('catscore-mjkc5u3s-zj0eausmp','maturity-mjkc5t71-fw69sxz28','supplier','Supplier Security','أمن المعلومات مع الموردين',2.5,5,4,4,NULL,'2025-12-24 18:17:05','2025-12-24 18:35:13');
INSERT INTO "maturity_category_scores" VALUES('catscore-mjkc5u4p-soj9plyjo','maturity-mjkc5t71-fw69sxz28','risk','Risk Management','إدارة المخاطر',4,5,3,3,NULL,'2025-12-24 18:17:05','2025-12-24 18:35:14');
INSERT INTO "maturity_category_scores" VALUES('catscore-mjkc5u5h-g77ecak4g','maturity-mjkc5t71-fw69sxz28','incident','Incident Response','الاستجابة لحوادث الأمن السيبراني',4,5,3,3,NULL,'2025-12-24 18:17:05','2025-12-24 18:35:14');
INSERT INTO "maturity_category_scores" VALUES('catscore-mjkc5u67-l3wm7ntu0','maturity-mjkc5t71-fw69sxz28','continuity','Business Continuity','جوانب أمن المعلومات في إدارة استمرارية الأعمال',3,5,1,1,NULL,'2025-12-24 18:17:05','2025-12-24 18:35:15');
INSERT INTO "maturity_category_scores" VALUES('catscore-mjkcm4s7-5o9rqoz8l','maturity-mjkcm04q-v39jby189','governance','Governance & Management Commitment','حوكمة ومدى التزام الإدارة بدعم أمن المعلومات',3.75,5,4,4,NULL,'2025-12-24 18:29:46','2025-12-24 18:30:44');
INSERT INTO "maturity_category_scores" VALUES('catscore-mjkcm4x3-0qe9ffyry','maturity-mjkcm04q-v39jby189','policies','Security Policies','سياسات أمن المعلومات',3.33,5,3,3,NULL,'2025-12-24 18:29:46','2025-12-24 18:30:44');
INSERT INTO "maturity_category_scores" VALUES('catscore-mjkcm526-q228ia2pl','maturity-mjkcm04q-v39jby189','organization','Organizational Structure','هيكلية أمن المعلومات في المؤسسة',3,5,7,7,NULL,'2025-12-24 18:29:46','2025-12-24 18:30:45');
INSERT INTO "maturity_category_scores" VALUES('catscore-mjkcm56y-qfevpp51d','maturity-mjkcm04q-v39jby189','hr_security','HR Security','أمن المعلومات للموارد البشرية',3.25,5,4,5,NULL,'2025-12-24 18:29:46','2025-12-24 18:30:45');
INSERT INTO "maturity_category_scores" VALUES('catscore-mjkcm5bp-h4uecsonp','maturity-mjkcm04q-v39jby189','communication','Communication','آليات وعملية التواصل',3,5,2,2,NULL,'2025-12-24 18:29:46','2025-12-24 18:30:46');
INSERT INTO "maturity_category_scores" VALUES('catscore-mjkcm5kj-771tulzgz','maturity-mjkcm04q-v39jby189','supplier','Supplier Security','أمن المعلومات مع الموردين',2.25,5,4,4,NULL,'2025-12-24 18:29:47','2025-12-24 18:30:46');
INSERT INTO "maturity_category_scores" VALUES('catscore-mjkcm5pi-faebyndc9','maturity-mjkcm04q-v39jby189','risk','Risk Management','إدارة المخاطر',3,5,3,3,NULL,'2025-12-24 18:29:47','2025-12-24 18:30:46');
INSERT INTO "maturity_category_scores" VALUES('catscore-mjkcm5ue-bsz50c1bu','maturity-mjkcm04q-v39jby189','incident','Incident Response','الاستجابة لحوادث الأمن السيبراني',3,5,3,3,NULL,'2025-12-24 18:29:47','2025-12-24 18:30:47');
INSERT INTO "maturity_category_scores" VALUES('catscore-mjkcm5yx-84r8c2vvp','maturity-mjkcm04q-v39jby189','continuity','Business Continuity','جوانب أمن المعلومات في إدارة استمرارية الأعمال',3,5,1,1,NULL,'2025-12-24 18:29:47','2025-12-24 18:30:47');
CREATE TABLE maturity_improvement_actions (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL REFERENCES maturity_assessments(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    category_id TEXT NOT NULL,
    question_id INTEGER,
    action_title TEXT NOT NULL,
    action_description TEXT,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled', 'deferred')),
    assignee_id TEXT REFERENCES users(id),
    due_date TEXT,
    completed_date TEXT,
    estimated_effort_days INTEGER,
    estimated_cost REAL,
    expected_score_improvement REAL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    created_by TEXT REFERENCES users(id)
);
CREATE TABLE pentest_sync_log (
    id TEXT PRIMARY KEY,
    sync_type TEXT NOT NULL CHECK (sync_type IN ('create', 'update', 'delete', 'bulk')),
    source_finding_id TEXT NOT NULL,
    source_project_code TEXT,
    target_risk_id TEXT,
    payload TEXT,
    status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failed', 'pending')),
    error_message TEXT,
    synced_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE compliance_frameworks_v2 (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,           
  name TEXT NOT NULL,
  version TEXT,                         
  description TEXT,
  authority TEXT,                       
  total_controls INTEGER DEFAULT 0,
  is_core_framework INTEGER DEFAULT 0,  
  is_active INTEGER DEFAULT 1,
  icon TEXT,                            
  color TEXT,                           
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "compliance_frameworks_v2" VALUES('fw-iso27001','ISO27001','ISO/IEC 27001','2022','Information Security Management System (ISMS) - International standard for managing information security','ISO/IEC',93,1,1,'fa-shield-alt','#3b82f6','2025-12-30 13:11:47','2025-12-30 13:11:47');
INSERT INTO "compliance_frameworks_v2" VALUES('fw-nist-csf','NIST_CSF','NIST Cybersecurity Framework','2.0','Framework for improving critical infrastructure cybersecurity','NIST',47,0,1,'fa-flag-usa','#10b981','2025-12-30 13:11:47','2025-12-30 13:11:47');
INSERT INTO "compliance_frameworks_v2" VALUES('fw-pci-dss','PCI_DSS','PCI Data Security Standard','4.0','Payment Card Industry Data Security Standard for protecting cardholder data','PCI SSC',51,0,1,'fa-credit-card','#f59e0b','2025-12-30 13:11:47','2025-12-30 13:11:47');
INSERT INTO "compliance_frameworks_v2" VALUES('fw-soc2','SOC2','SOC 2','Type II','Service Organization Control 2 - Trust Services Criteria','AICPA',48,0,1,'fa-check-circle','#8b5cf6','2025-12-30 13:11:47','2025-12-30 13:11:47');
INSERT INTO "compliance_frameworks_v2" VALUES('fw-gdpr','GDPR','General Data Protection Regulation','2018','EU regulation on data protection and privacy','European Union',26,0,1,'fa-user-shield','#ec4899','2025-12-30 13:11:47','2025-12-30 13:11:47');
CREATE TABLE control_library (
  id TEXT PRIMARY KEY,
  framework_id TEXT NOT NULL,
  control_id TEXT NOT NULL,             
  control_number TEXT,                  
  title TEXT NOT NULL,
  description TEXT,
  guidance TEXT,                        
  category TEXT,                        
  subcategory TEXT,                     
  control_type TEXT,                    
  is_critical INTEGER DEFAULT 0,        
  weight REAL DEFAULT 1.0,              
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (framework_id) REFERENCES compliance_frameworks_v2(id),
  UNIQUE(framework_id, control_id)
);
INSERT INTO "control_library" VALUES('iso-5.1','fw-iso27001','A.5.1','5.01','Policies for information security','Information security policy and topic-specific policies shall be defined, approved by management, published, communicated to and acknowledged by relevant personnel and relevant interested parties, and reviewed at planned intervals and if significant changes occur.',NULL,'Organizational','Governance','preventive',1,1.5,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-5.2','fw-iso27001','A.5.2','5.02','Information security roles and responsibilities','Information security roles and responsibilities shall be defined and allocated according to the organization needs.',NULL,'Organizational','Governance','preventive',1,1.3,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-5.3','fw-iso27001','A.5.3','5.03','Segregation of duties','Conflicting duties and conflicting areas of responsibility shall be segregated.',NULL,'Organizational','Governance','preventive',1,1.2,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-5.4','fw-iso27001','A.5.4','5.04','Management responsibilities','Management shall require all personnel to apply information security in accordance with the established information security policy, topic-specific policies and procedures of the organization.',NULL,'Organizational','Governance','preventive',1,1.3,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-5.5','fw-iso27001','A.5.5','5.05','Contact with authorities','The organization shall establish and maintain contact with relevant authorities.',NULL,'Organizational','External','preventive',0,1,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-5.6','fw-iso27001','A.5.6','5.06','Contact with special interest groups','The organization shall establish and maintain contact with special interest groups or other specialist security forums and professional associations.',NULL,'Organizational','External','preventive',0,0.8,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-5.7','fw-iso27001','A.5.7','5.07','Threat intelligence','Information relating to information security threats shall be collected and analysed to produce threat intelligence.',NULL,'Organizational','Threat Management','detective',1,1.4,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-5.8','fw-iso27001','A.5.8','5.08','Information security in project management','Information security shall be integrated into project management.',NULL,'Organizational','Project Management','preventive',0,1,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-5.9','fw-iso27001','A.5.9','5.09','Inventory of information and other associated assets','An inventory of information and other associated assets, including owners, shall be developed and maintained.',NULL,'Organizational','Asset Management','preventive',1,1.3,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-5.10','fw-iso27001','A.5.10','5.10','Acceptable use of information and other associated assets','Rules for the acceptable use and procedures for handling information and other associated assets shall be identified, documented and implemented.',NULL,'Organizational','Asset Management','preventive',1,1.2,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-5.11','fw-iso27001','A.5.11','5.11','Return of assets','Personnel and other interested parties as appropriate shall return all the organization''s assets in their possession upon change or termination of their employment, contract or agreement.',NULL,'Organizational','Asset Management','preventive',0,1,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-5.12','fw-iso27001','A.5.12','5.12','Classification of information','Information shall be classified according to the information security needs of the organization based on confidentiality, integrity, availability and relevant interested party requirements.',NULL,'Organizational','Information Classification','preventive',1,1.4,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-5.13','fw-iso27001','A.5.13','5.13','Labelling of information','An appropriate set of procedures for information labelling shall be developed and implemented in accordance with the information classification scheme adopted by the organization.',NULL,'Organizational','Information Classification','preventive',0,1,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-5.14','fw-iso27001','A.5.14','5.14','Information transfer','Information transfer rules, procedures, or agreements shall be in place for all types of transfer facilities within the organization and between the organization and other parties.',NULL,'Organizational','Information Transfer','preventive',1,1.3,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-5.15','fw-iso27001','A.5.15','5.15','Access control','Rules to control physical and logical access to information and other associated assets shall be established and implemented based on business and information security requirements.',NULL,'Organizational','Access Control','preventive',1,1.5,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-5.16','fw-iso27001','A.5.16','5.16','Identity management','The full life cycle of identities shall be managed.',NULL,'Organizational','Access Control','preventive',1,1.4,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-5.17','fw-iso27001','A.5.17','5.17','Authentication information','Allocation and management of authentication information shall be controlled by a management process, including advising personnel on appropriate handling of authentication information.',NULL,'Organizational','Access Control','preventive',1,1.4,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-5.18','fw-iso27001','A.5.18','5.18','Access rights','Access rights to information and other associated assets shall be provisioned, reviewed, modified and removed in accordance with the organization''s topic-specific policy on and rules for access control.',NULL,'Organizational','Access Control','preventive',1,1.4,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-5.19','fw-iso27001','A.5.19','5.19','Information security in supplier relationships','Processes and procedures shall be defined and implemented to manage the information security risks associated with the use of supplier''s products or services.',NULL,'Organizational','Supplier Management','preventive',1,1.3,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-5.20','fw-iso27001','A.5.20','5.20','Addressing information security within supplier agreements','Relevant information security requirements shall be established and agreed with each supplier based on the type of supplier relationship.',NULL,'Organizational','Supplier Management','preventive',1,1.3,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-5.21','fw-iso27001','A.5.21','5.21','Managing information security in the ICT supply chain','Processes and procedures shall be defined and implemented to manage the information security risks associated with the ICT products and services supply chain.',NULL,'Organizational','Supplier Management','preventive',1,1.3,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-5.22','fw-iso27001','A.5.22','5.22','Monitoring, review and change management of supplier services','The organization shall regularly monitor, review, evaluate and manage change in supplier information security practices and service delivery.',NULL,'Organizational','Supplier Management','detective',1,1.2,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-5.23','fw-iso27001','A.5.23','5.23','Information security for use of cloud services','Processes for acquisition, use, management and exit from cloud services shall be established in accordance with the organization''s information security requirements.',NULL,'Organizational','Cloud Security','preventive',1,1.4,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-5.24','fw-iso27001','A.5.24','5.24','Information security incident management planning and preparation','The organization shall plan and prepare for managing information security incidents by defining, establishing and communicating information security incident management processes, roles and responsibilities.',NULL,'Organizational','Incident Management','preventive',1,1.5,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-5.25','fw-iso27001','A.5.25','5.25','Assessment and decision on information security events','The organization shall assess information security events and decide if they are to be categorized as information security incidents.',NULL,'Organizational','Incident Management','detective',1,1.3,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-5.26','fw-iso27001','A.5.26','5.26','Response to information security incidents','Information security incidents shall be responded to in accordance with the documented procedures.',NULL,'Organizational','Incident Management','corrective',1,1.5,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-5.27','fw-iso27001','A.5.27','5.27','Learning from information security incidents','Knowledge gained from information security incidents shall be used to strengthen and improve the information security controls.',NULL,'Organizational','Incident Management','corrective',1,1.2,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-5.28','fw-iso27001','A.5.28','5.28','Collection of evidence','The organization shall establish and implement procedures for the identification, collection, acquisition and preservation of evidence related to information security events.',NULL,'Organizational','Incident Management','detective',1,1.3,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-5.29','fw-iso27001','A.5.29','5.29','Information security during disruption','The organization shall plan how to maintain information security at an appropriate level during disruption.',NULL,'Organizational','Business Continuity','preventive',1,1.4,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-5.30','fw-iso27001','A.5.30','5.30','ICT readiness for business continuity','ICT readiness shall be planned, implemented, maintained and tested based on business continuity objectives and ICT continuity requirements.',NULL,'Organizational','Business Continuity','preventive',1,1.4,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-5.31','fw-iso27001','A.5.31','5.31','Legal, statutory, regulatory and contractual requirements','Legal, statutory, regulatory and contractual requirements relevant to information security and the organization''s approach to meet these requirements shall be identified, documented and kept up to date.',NULL,'Organizational','Compliance','preventive',1,1.4,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-5.32','fw-iso27001','A.5.32','5.32','Intellectual property rights','The organization shall implement appropriate procedures to protect intellectual property rights.',NULL,'Organizational','Compliance','preventive',0,1,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-5.33','fw-iso27001','A.5.33','5.33','Protection of records','Records shall be protected from loss, destruction, falsification, unauthorized access and unauthorized release.',NULL,'Organizational','Compliance','preventive',1,1.3,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-5.34','fw-iso27001','A.5.34','5.34','Privacy and protection of PII','The organization shall identify and meet the requirements regarding the preservation of privacy and protection of PII according to applicable laws and regulations and contractual requirements.',NULL,'Organizational','Privacy','preventive',1,1.5,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-5.35','fw-iso27001','A.5.35','5.35','Independent review of information security','The organization''s approach to managing information security and its implementation including people, processes and technologies shall be reviewed independently at planned intervals, or when significant changes occur.',NULL,'Organizational','Audit','detective',1,1.3,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-5.36','fw-iso27001','A.5.36','5.36','Compliance with policies, rules and standards for information security','Compliance with the organization''s information security policy, topic-specific policies, rules and standards shall be regularly reviewed.',NULL,'Organizational','Audit','detective',1,1.3,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-5.37','fw-iso27001','A.5.37','5.37','Documented operating procedures','Operating procedures for information processing facilities shall be documented and made available to personnel who need them.',NULL,'Organizational','Operations','preventive',1,1.2,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-6.1','fw-iso27001','A.6.1','6.01','Screening','Background verification checks on all candidates to become personnel shall be carried out prior to joining the organization and on an ongoing basis taking into consideration applicable laws, regulations and ethics and be proportional to the business requirements, the classification of the information to be accessed and the perceived risks.',NULL,'People','Pre-employment','preventive',1,1.3,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-6.2','fw-iso27001','A.6.2','6.02','Terms and conditions of employment','The employment contractual agreements shall state the personnel''s and the organization''s responsibilities for information security.',NULL,'People','Pre-employment','preventive',1,1.2,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-6.3','fw-iso27001','A.6.3','6.03','Information security awareness, education and training','Personnel of the organization and relevant interested parties shall receive appropriate information security awareness, education and training and regular updates of the organization''s information security policy, topic-specific policies and procedures, as relevant for their job function.',NULL,'People','Awareness','preventive',1,1.5,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-6.4','fw-iso27001','A.6.4','6.04','Disciplinary process','A disciplinary process shall be formalized and communicated to take actions against personnel and other relevant interested parties who have committed an information security policy violation.',NULL,'People','HR Process','corrective',1,1.2,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-6.5','fw-iso27001','A.6.5','6.05','Responsibilities after termination or change of employment','Information security responsibilities and duties that remain valid after termination or change of employment shall be defined, enforced and communicated to relevant personnel and other interested parties.',NULL,'People','Termination','preventive',1,1.2,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-6.6','fw-iso27001','A.6.6','6.06','Confidentiality or non-disclosure agreements','Confidentiality or non-disclosure agreements reflecting the organization''s needs for the protection of information shall be identified, documented, regularly reviewed and signed by personnel and other relevant interested parties.',NULL,'People','Agreements','preventive',1,1.3,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-6.7','fw-iso27001','A.6.7','6.07','Remote working','Security measures shall be implemented when personnel are working remotely to protect information accessed, processed or stored outside the organization''s premises.',NULL,'People','Remote Work','preventive',1,1.4,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-6.8','fw-iso27001','A.6.8','6.08','Information security event reporting','The organization shall provide a mechanism for personnel to report observed or suspected information security events through appropriate channels in a timely manner.',NULL,'People','Reporting','detective',1,1.4,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-7.1','fw-iso27001','A.7.1','7.01','Physical security perimeters','Security perimeters shall be defined and used to protect areas that contain information and other associated assets.',NULL,'Physical','Perimeter','preventive',1,1.3,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-7.2','fw-iso27001','A.7.2','7.02','Physical entry','Secure areas shall be protected by appropriate entry controls and access points.',NULL,'Physical','Access Control','preventive',1,1.4,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-7.3','fw-iso27001','A.7.3','7.03','Securing offices, rooms and facilities','Physical security for offices, rooms and facilities shall be designed and implemented.',NULL,'Physical','Facilities','preventive',1,1.2,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-7.4','fw-iso27001','A.7.4','7.04','Physical security monitoring','Premises shall be continuously monitored for unauthorized physical access.',NULL,'Physical','Monitoring','detective',1,1.3,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-7.5','fw-iso27001','A.7.5','7.05','Protecting against physical and environmental threats','Protection against physical and environmental threats, such as natural disasters and other intentional or unintentional physical threats to infrastructure shall be designed and implemented.',NULL,'Physical','Environmental','preventive',1,1.3,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-7.6','fw-iso27001','A.7.6','7.06','Working in secure areas','Security measures for working in secure areas shall be designed and implemented.',NULL,'Physical','Secure Areas','preventive',0,1,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-7.7','fw-iso27001','A.7.7','7.07','Clear desk and clear screen','Clear desk rules for papers and removable storage media and clear screen rules for information processing facilities shall be defined and appropriately enforced.',NULL,'Physical','Workspace','preventive',0,1,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-7.8','fw-iso27001','A.7.8','7.08','Equipment siting and protection','Equipment shall be sited securely and protected.',NULL,'Physical','Equipment','preventive',1,1.2,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-7.9','fw-iso27001','A.7.9','7.09','Security of assets off-premises','Off-site assets shall be protected.',NULL,'Physical','Equipment','preventive',1,1.2,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-7.10','fw-iso27001','A.7.10','7.10','Storage media','Storage media shall be managed through their life cycle of acquisition, use, transportation and disposal in accordance with the organization''s classification scheme and handling requirements.',NULL,'Physical','Media','preventive',1,1.3,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-7.11','fw-iso27001','A.7.11','7.11','Supporting utilities','Information processing facilities shall be protected from power failures and other disruptions caused by failures in supporting utilities.',NULL,'Physical','Utilities','preventive',1,1.3,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-7.12','fw-iso27001','A.7.12','7.12','Cabling security','Cables carrying power, data or supporting information services shall be protected from interception, interference or damage.',NULL,'Physical','Infrastructure','preventive',0,1,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-7.13','fw-iso27001','A.7.13','7.13','Equipment maintenance','Equipment shall be maintained correctly to ensure availability, integrity and confidentiality of information.',NULL,'Physical','Maintenance','preventive',1,1.2,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-7.14','fw-iso27001','A.7.14','7.14','Secure disposal or re-use of equipment','Items of equipment containing storage media shall be verified to ensure that any sensitive data and licensed software has been removed or securely overwritten prior to disposal or re-use.',NULL,'Physical','Disposal','preventive',1,1.3,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-8.1','fw-iso27001','A.8.1','8.01','User endpoint devices','Information stored on, processed by or accessible via user endpoint devices shall be protected.',NULL,'Technological','Endpoint Security','preventive',1,1.4,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-8.2','fw-iso27001','A.8.2','8.02','Privileged access rights','The allocation and use of privileged access rights shall be restricted and managed.',NULL,'Technological','Access Control','preventive',1,1.5,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-8.3','fw-iso27001','A.8.3','8.03','Information access restriction','Access to information and other associated assets shall be restricted in accordance with the established topic-specific policy on access control.',NULL,'Technological','Access Control','preventive',1,1.4,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-8.4','fw-iso27001','A.8.4','8.04','Access to source code','Read and write access to source code, development tools and software libraries shall be appropriately managed.',NULL,'Technological','Development','preventive',1,1.3,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-8.5','fw-iso27001','A.8.5','8.05','Secure authentication','Secure authentication technologies and procedures shall be implemented based on information access restrictions and the topic-specific policy on access control.',NULL,'Technological','Authentication','preventive',1,1.5,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-8.6','fw-iso27001','A.8.6','8.06','Capacity management','The use of resources shall be monitored and adjusted in line with current and expected capacity requirements.',NULL,'Technological','Operations','preventive',0,1,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-8.7','fw-iso27001','A.8.7','8.07','Protection against malware','Protection against malware shall be implemented and supported by appropriate user awareness.',NULL,'Technological','Malware Protection','preventive',1,1.5,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-8.8','fw-iso27001','A.8.8','8.08','Management of technical vulnerabilities','Information about technical vulnerabilities of information systems in use shall be obtained, the organization''s exposure to such vulnerabilities shall be evaluated and appropriate measures shall be taken.',NULL,'Technological','Vulnerability Management','preventive',1,1.5,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-8.9','fw-iso27001','A.8.9','8.09','Configuration management','Configurations, including security configurations, of hardware, software, services and networks shall be established, documented, implemented, monitored and reviewed.',NULL,'Technological','Configuration','preventive',1,1.4,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-8.10','fw-iso27001','A.8.10','8.10','Information deletion','Information stored in information systems, devices or in any other storage media shall be deleted when no longer required.',NULL,'Technological','Data Management','preventive',1,1.3,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-8.11','fw-iso27001','A.8.11','8.11','Data masking','Data masking shall be used in accordance with the organization''s topic-specific policy on access control and other related topic-specific policies, and business requirements, taking applicable legislation into consideration.',NULL,'Technological','Data Protection','preventive',1,1.3,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-8.12','fw-iso27001','A.8.12','8.12','Data leakage prevention','Data leakage prevention measures shall be applied to systems, networks and any other devices that process, store or transmit sensitive information.',NULL,'Technological','Data Protection','preventive',1,1.4,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-8.13','fw-iso27001','A.8.13','8.13','Information backup','Backup copies of information, software and systems shall be maintained and regularly tested in accordance with the agreed topic-specific policy on backup.',NULL,'Technological','Backup','preventive',1,1.5,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-8.14','fw-iso27001','A.8.14','8.14','Redundancy of information processing facilities','Information processing facilities shall be implemented with redundancy sufficient to meet availability requirements.',NULL,'Technological','Availability','preventive',1,1.3,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-8.15','fw-iso27001','A.8.15','8.15','Logging','Logs that record activities, exceptions, faults and other relevant events shall be produced, stored, protected and analysed.',NULL,'Technological','Logging & Monitoring','detective',1,1.5,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-8.16','fw-iso27001','A.8.16','8.16','Monitoring activities','Networks, systems and applications shall be monitored for anomalous behaviour and appropriate actions taken to evaluate potential information security incidents.',NULL,'Technological','Logging & Monitoring','detective',1,1.5,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-8.17','fw-iso27001','A.8.17','8.17','Clock synchronization','The clocks of information processing systems used by the organization shall be synchronized to approved time sources.',NULL,'Technological','Operations','preventive',0,0.8,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-8.18','fw-iso27001','A.8.18','8.18','Use of privileged utility programs','The use of utility programs that can be capable of overriding system and application controls shall be restricted and tightly controlled.',NULL,'Technological','Access Control','preventive',1,1.2,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-8.19','fw-iso27001','A.8.19','8.19','Installation of software on operational systems','Procedures and measures shall be implemented to securely manage software installation on operational systems.',NULL,'Technological','Change Management','preventive',1,1.3,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-8.20','fw-iso27001','A.8.20','8.20','Networks security','Networks and network devices shall be secured, managed and controlled to protect information in systems and applications.',NULL,'Technological','Network Security','preventive',1,1.5,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-8.21','fw-iso27001','A.8.21','8.21','Security of network services','Security mechanisms, service levels and service requirements of network services shall be identified, implemented and monitored.',NULL,'Technological','Network Security','preventive',1,1.3,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-8.22','fw-iso27001','A.8.22','8.22','Segregation of networks','Groups of information services, users and information systems shall be segregated in the organization''s networks.',NULL,'Technological','Network Security','preventive',1,1.4,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-8.23','fw-iso27001','A.8.23','8.23','Web filtering','Access to external websites shall be managed to reduce exposure to malicious content.',NULL,'Technological','Network Security','preventive',1,1.2,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-8.24','fw-iso27001','A.8.24','8.24','Use of cryptography','Rules for the effective use of cryptography, including cryptographic key management, shall be defined and implemented.',NULL,'Technological','Cryptography','preventive',1,1.5,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-8.25','fw-iso27001','A.8.25','8.25','Secure development life cycle','Rules for the secure development of software and systems shall be established and applied.',NULL,'Technological','Development','preventive',1,1.4,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-8.26','fw-iso27001','A.8.26','8.26','Application security requirements','Information security requirements shall be identified, specified and approved when developing or acquiring applications.',NULL,'Technological','Development','preventive',1,1.4,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-8.27','fw-iso27001','A.8.27','8.27','Secure system architecture and engineering principles','Principles for engineering secure systems shall be established, documented, maintained and applied to any information system development activities.',NULL,'Technological','Development','preventive',1,1.4,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-8.28','fw-iso27001','A.8.28','8.28','Secure coding','Secure coding principles shall be applied to software development.',NULL,'Technological','Development','preventive',1,1.4,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-8.29','fw-iso27001','A.8.29','8.29','Security testing in development and acceptance','Security testing processes shall be defined and implemented in the development life cycle.',NULL,'Technological','Development','detective',1,1.4,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-8.30','fw-iso27001','A.8.30','8.30','Outsourced development','The organization shall direct, monitor and review the activities related to outsourced system development.',NULL,'Technological','Development','preventive',1,1.2,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-8.31','fw-iso27001','A.8.31','8.31','Separation of development, test and production environments','Development, testing and production environments shall be separated and secured.',NULL,'Technological','Development','preventive',1,1.3,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-8.32','fw-iso27001','A.8.32','8.32','Change management','Changes to information processing facilities and information systems shall be subject to change management procedures.',NULL,'Technological','Change Management','preventive',1,1.4,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-8.33','fw-iso27001','A.8.33','8.33','Test information','Test information shall be appropriately selected, protected and managed.',NULL,'Technological','Development','preventive',0,1,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('iso-8.34','fw-iso27001','A.8.34','8.34','Protection of information systems during audit testing','Audit tests and other assurance activities involving assessment of operational systems shall be planned and agreed between the tester and appropriate management.',NULL,'Technological','Audit','preventive',0,1,'2025-12-30 13:11:47');
INSERT INTO "control_library" VALUES('nist-gv.oc-01','fw-nist-csf','GV.OC-01',NULL,'Organizational Context','The circumstances surrounding the organizations cybersecurity risk management decisions are understood','Document business context, mission, stakeholders','Govern','Organizational Context',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-gv.rm-01','fw-nist-csf','GV.RM-01',NULL,'Risk Management Strategy','Risk management objectives are established and communicated','Establish risk appetite and tolerance','Govern','Risk Management Strategy',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-gv.rm-02','fw-nist-csf','GV.RM-02',NULL,'Risk Management Priorities','Risk appetite and risk tolerance statements are established, communicated, and maintained','Document risk thresholds','Govern','Risk Management Strategy',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-gv.rr-01','fw-nist-csf','GV.RR-01',NULL,'Roles and Responsibilities','Organizational leadership is responsible and accountable for cybersecurity risk','Define cybersecurity roles','Govern','Roles and Responsibilities',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-gv.po-01','fw-nist-csf','GV.PO-01',NULL,'Cybersecurity Policy','Policy for managing cybersecurity risks is established based on organizational context','Develop cybersecurity policies','Govern','Policy',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-gv.sc-01','fw-nist-csf','GV.SC-01',NULL,'Supply Chain Risk Management','Cyber supply chain risk management processes are identified and managed','Manage third-party risks','Govern','Supply Chain Risk Management',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-id.am-01','fw-nist-csf','ID.AM-01',NULL,'Asset Inventory','Inventories of hardware managed by the organization are maintained','Maintain hardware asset inventory','Identify','Asset Management',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-id.am-02','fw-nist-csf','ID.AM-02',NULL,'Software Inventory','Inventories of software, services, and systems are maintained','Maintain software asset inventory','Identify','Asset Management',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-id.am-03','fw-nist-csf','ID.AM-03',NULL,'Data Inventory','Network communication and data flows are maintained','Document data flows','Identify','Asset Management',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-id.am-07','fw-nist-csf','ID.AM-07',NULL,'Asset Criticality','Inventories of services provided by suppliers are maintained','Classify asset criticality','Identify','Asset Management',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-id.ra-01','fw-nist-csf','ID.RA-01',NULL,'Vulnerability Identification','Vulnerabilities in assets are identified, validated, and recorded','Perform vulnerability assessments','Identify','Risk Assessment',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-id.ra-02','fw-nist-csf','ID.RA-02',NULL,'Threat Intelligence','Cyber threat intelligence is received from information sharing forums','Monitor threat intelligence','Identify','Risk Assessment',NULL,0,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-id.ra-05','fw-nist-csf','ID.RA-05',NULL,'Risk Assessment','Threats and vulnerabilities are used to understand inherent risk','Conduct risk assessments','Identify','Risk Assessment',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-id.im-01','fw-nist-csf','ID.IM-01',NULL,'Improvement Identification','Improvements are identified from security tests and exercises','Conduct security testing','Identify','Improvement',NULL,0,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-pr.aa-01','fw-nist-csf','PR.AA-01',NULL,'Identity Management','Identities and credentials for authorized users are managed','Manage identities','Protect','Identity Management',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-pr.aa-02','fw-nist-csf','PR.AA-02',NULL,'Authentication','Identities are proofed and bound to credentials','Implement authentication','Protect','Identity Management',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-pr.aa-03','fw-nist-csf','PR.AA-03',NULL,'Access Provisioning','Users, services, and hardware are authenticated','Manage access provisioning','Protect','Identity Management',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-pr.aa-05','fw-nist-csf','PR.AA-05',NULL,'Access Control','Access permissions, entitlements, and authorizations are defined','Implement access controls','Protect','Identity Management',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-pr.at-01','fw-nist-csf','PR.AT-01',NULL,'Security Awareness','Personnel are provided awareness and training','Conduct security training','Protect','Awareness and Training',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-pr.at-02','fw-nist-csf','PR.AT-02',NULL,'Privileged Users Training','Individuals in specialized roles are provided training','Train privileged users','Protect','Awareness and Training',NULL,0,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-pr.ds-01','fw-nist-csf','PR.DS-01',NULL,'Data Protection','The confidentiality and integrity of data-at-rest are protected','Protect data at rest','Protect','Data Security',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-pr.ds-02','fw-nist-csf','PR.DS-02',NULL,'Data in Transit','The confidentiality and integrity of data-in-transit are protected','Protect data in transit','Protect','Data Security',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-pr.ds-10','fw-nist-csf','PR.DS-10',NULL,'Data Integrity','The confidentiality and integrity of data-in-use are protected','Protect data in use','Protect','Data Security',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-pr.ps-01','fw-nist-csf','PR.PS-01',NULL,'Configuration Management','Configuration management practices are established','Manage configurations','Protect','Platform Security',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-pr.ps-02','fw-nist-csf','PR.PS-02',NULL,'Software Maintenance','Software is maintained, replaced, and removed','Maintain software','Protect','Platform Security',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-pr.ps-04','fw-nist-csf','PR.PS-04',NULL,'Log Management','Log records are generated and made available','Implement logging','Protect','Platform Security',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-pr.ir-01','fw-nist-csf','PR.IR-01',NULL,'Incident Response','Incident response plans are established and maintained','Plan incident response','Protect','Infrastructure Resilience',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-pr.ir-02','fw-nist-csf','PR.IR-02',NULL,'Backup Recovery','Backup and recovery data are maintained and tested','Implement backup/recovery','Protect','Infrastructure Resilience',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-de.cm-01','fw-nist-csf','DE.CM-01',NULL,'Network Monitoring','Networks are monitored to find potentially adverse events','Monitor networks','Detect','Continuous Monitoring',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-de.cm-02','fw-nist-csf','DE.CM-02',NULL,'Physical Environment Monitoring','The physical environment is monitored','Monitor physical environment','Detect','Continuous Monitoring',NULL,0,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-de.cm-03','fw-nist-csf','DE.CM-03',NULL,'Personnel Activity Monitoring','Personnel activity and technology usage are monitored','Monitor user activity','Detect','Continuous Monitoring',NULL,0,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-de.cm-06','fw-nist-csf','DE.CM-06',NULL,'External Service Monitoring','External service provider activity is monitored','Monitor third parties','Detect','Continuous Monitoring',NULL,0,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-de.cm-09','fw-nist-csf','DE.CM-09',NULL,'Computing Hardware Monitoring','Computing hardware and software are monitored','Monitor endpoints','Detect','Continuous Monitoring',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-de.ae-02','fw-nist-csf','DE.AE-02',NULL,'Event Analysis','Potentially adverse events are analyzed','Analyze security events','Detect','Adverse Event Analysis',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-de.ae-06','fw-nist-csf','DE.AE-06',NULL,'Event Correlation','Information on adverse events is correlated','Correlate events','Detect','Adverse Event Analysis',NULL,0,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-rs.ma-01','fw-nist-csf','RS.MA-01',NULL,'Incident Management','The incident response plan is executed','Execute IR plan','Respond','Incident Management',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-rs.ma-02','fw-nist-csf','RS.MA-02',NULL,'Incident Triage','Incident reports are triaged and validated','Triage incidents','Respond','Incident Management',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-rs.ma-03','fw-nist-csf','RS.MA-03',NULL,'Incident Categorization','Incidents are categorized and prioritized','Categorize incidents','Respond','Incident Management',NULL,0,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-rs.an-03','fw-nist-csf','RS.AN-03',NULL,'Forensic Analysis','Analysis is performed to establish what has taken place','Conduct forensics','Respond','Incident Analysis',NULL,0,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-rs.an-06','fw-nist-csf','RS.AN-06',NULL,'Root Cause Analysis','Actions performed during investigation are recorded','Document investigations','Respond','Incident Analysis',NULL,0,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-rs.co-02','fw-nist-csf','RS.CO-02',NULL,'Incident Communication','Stakeholders are notified of incidents','Notify stakeholders','Respond','Incident Communication',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-rs.mi-01','fw-nist-csf','RS.MI-01',NULL,'Incident Containment','Incidents are contained','Contain incidents','Respond','Incident Mitigation',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-rs.mi-02','fw-nist-csf','RS.MI-02',NULL,'Incident Eradication','Incidents are eradicated','Eradicate threats','Respond','Incident Mitigation',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-rc.rp-01','fw-nist-csf','RC.RP-01',NULL,'Recovery Execution','The recovery portion of the incident response plan is executed','Execute recovery','Recover','Recovery Execution',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-rc.rp-03','fw-nist-csf','RC.RP-03',NULL,'Backup Recovery','The integrity of backups is verified','Verify backups','Recover','Recovery Execution',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-rc.rp-05','fw-nist-csf','RC.RP-05',NULL,'Post-Incident Review','Systems and services are restored','Verify restoration','Recover','Recovery Execution',NULL,0,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('nist-rc.co-03','fw-nist-csf','RC.CO-03',NULL,'Recovery Communication','Recovery activities and progress are communicated','Communicate recovery','Recover','Recovery Communication',NULL,0,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-1.1','fw-pci-dss','1.1',NULL,'Network Security Policies','Processes for installing and maintaining network security controls are defined','Document network security controls','Build Secure Network','Network Security Controls',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-1.2','fw-pci-dss','1.2',NULL,'NSC Configuration Standards','Network security controls are configured and maintained','Configure network security','Build Secure Network','Network Security Controls',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-1.3','fw-pci-dss','1.3',NULL,'Network Access Restriction','Network access to and from the CDE is restricted','Restrict CDE access','Build Secure Network','Network Security Controls',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-1.4','fw-pci-dss','1.4',NULL,'Trusted Network Connections','Connections between trusted and untrusted networks are controlled','Control network connections','Build Secure Network','Network Security Controls',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-2.1','fw-pci-dss','2.1',NULL,'Secure Configuration Processes','Processes for applying secure configurations are defined','Document secure configurations','Build Secure Network','Secure Configurations',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-2.2','fw-pci-dss','2.2',NULL,'System Configuration Standards','System components are configured and managed securely','Implement secure configurations','Build Secure Network','Secure Configurations',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-3.1','fw-pci-dss','3.1',NULL,'Account Data Protection Processes','Processes for protecting stored account data are defined','Document data protection','Protect Account Data','Stored Account Data',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-3.2','fw-pci-dss','3.2',NULL,'Storage Limitation','Storage of account data is kept to a minimum','Minimize data storage','Protect Account Data','Stored Account Data',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-3.3','fw-pci-dss','3.3',NULL,'SAD Protection','Sensitive authentication data is not stored after authorization','Prevent SAD storage','Protect Account Data','Stored Account Data',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-3.4','fw-pci-dss','3.4',NULL,'PAN Display Restriction','Access to displays of full PAN is restricted','Restrict PAN display','Protect Account Data','Stored Account Data',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-3.5','fw-pci-dss','3.5',NULL,'PAN Protection','PAN is secured wherever it is stored','Secure stored PAN','Protect Account Data','Stored Account Data',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-3.6','fw-pci-dss','3.6',NULL,'Key Management','Cryptographic keys are secured','Manage encryption keys','Protect Account Data','Stored Account Data',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-4.1','fw-pci-dss','4.1',NULL,'Transmission Protection Processes','Processes for protecting cardholder data during transmission are defined','Document transmission security','Protect Account Data','Data in Transit',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-4.2','fw-pci-dss','4.2',NULL,'PAN Protection in Transit','PAN is protected with strong cryptography during transmission','Encrypt PAN in transit','Protect Account Data','Data in Transit',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-5.1','fw-pci-dss','5.1',NULL,'Malware Protection Processes','Processes for protecting from malware are defined','Document malware protection','Vulnerability Management','Malware Protection',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-5.2','fw-pci-dss','5.2',NULL,'Anti-Malware Deployment','Malware is prevented, detected and addressed','Deploy anti-malware','Vulnerability Management','Malware Protection',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-5.3','fw-pci-dss','5.3',NULL,'Anti-Malware Mechanisms','Anti-malware mechanisms are active and maintained','Maintain anti-malware','Vulnerability Management','Malware Protection',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-6.1','fw-pci-dss','6.1',NULL,'Secure Development Processes','Processes for developing secure systems are defined','Document SDLC security','Vulnerability Management','Secure Development',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-6.2','fw-pci-dss','6.2',NULL,'Bespoke Software Security','Custom software is developed securely','Secure custom software','Vulnerability Management','Secure Development',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-6.3','fw-pci-dss','6.3',NULL,'Security Vulnerabilities','Security vulnerabilities are identified and addressed','Manage vulnerabilities','Vulnerability Management','Secure Development',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-6.4','fw-pci-dss','6.4',NULL,'Web Application Security','Web applications are protected against attacks','Secure web apps','Vulnerability Management','Secure Development',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-6.5','fw-pci-dss','6.5',NULL,'Change Management','Changes are managed securely','Manage changes','Vulnerability Management','Secure Development',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-7.1','fw-pci-dss','7.1',NULL,'Access Control Processes','Processes for restricting access are defined','Document access control','Access Control','Restrict Access',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-7.2','fw-pci-dss','7.2',NULL,'Access Establishment','Access is appropriately defined and assigned','Assign access appropriately','Access Control','Restrict Access',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-7.3','fw-pci-dss','7.3',NULL,'Access Systems','Access is managed via access control systems','Implement access systems','Access Control','Restrict Access',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-8.1','fw-pci-dss','8.1',NULL,'User Identification Processes','Processes for identifying users are defined','Document ID management','Access Control','User Authentication',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-8.2','fw-pci-dss','8.2',NULL,'User Identification','User identification is strictly managed','Manage user IDs','Access Control','User Authentication',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-8.3','fw-pci-dss','8.3',NULL,'Strong Authentication','Strong authentication is established','Implement strong auth','Access Control','User Authentication',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-8.4','fw-pci-dss','8.4',NULL,'MFA Implementation','MFA is implemented for CDE access','Deploy MFA','Access Control','User Authentication',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-9.1','fw-pci-dss','9.1',NULL,'Physical Access Processes','Processes for restricting physical access are defined','Document physical access','Access Control','Physical Access',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-9.2','fw-pci-dss','9.2',NULL,'Physical Access Controls','Physical access controls manage entry','Implement physical controls','Access Control','Physical Access',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-9.4','fw-pci-dss','9.4',NULL,'Media Security','Media is securely stored and destroyed','Secure media','Access Control','Physical Access',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-10.1','fw-pci-dss','10.1',NULL,'Logging Processes','Processes for logging and monitoring are defined','Document logging','Monitoring and Testing','Logging',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-10.2','fw-pci-dss','10.2',NULL,'Audit Log Implementation','Audit logs are implemented','Implement audit logs','Monitoring and Testing','Logging',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-10.3','fw-pci-dss','10.3',NULL,'Audit Log Protection','Audit logs are protected','Protect audit logs','Monitoring and Testing','Logging',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-10.4','fw-pci-dss','10.4',NULL,'Audit Log Review','Audit logs are reviewed','Review audit logs','Monitoring and Testing','Logging',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-10.5','fw-pci-dss','10.5',NULL,'Audit Log History','Audit log history is retained','Retain audit logs','Monitoring and Testing','Logging',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-10.6','fw-pci-dss','10.6',NULL,'Time Synchronization','Time-synchronization is implemented','Synchronize time','Monitoring and Testing','Logging',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-11.1','fw-pci-dss','11.1',NULL,'Security Testing Processes','Processes for testing security are defined','Document security testing','Monitoring and Testing','Security Testing',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-11.3','fw-pci-dss','11.3',NULL,'Vulnerability Scanning','Vulnerabilities are regularly identified','Conduct vulnerability scans','Monitoring and Testing','Security Testing',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-11.4','fw-pci-dss','11.4',NULL,'Penetration Testing','Penetration testing is regularly performed','Perform penetration tests','Monitoring and Testing','Security Testing',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-11.5','fw-pci-dss','11.5',NULL,'Change Detection','Intrusions and file changes are detected','Detect changes/intrusions','Monitoring and Testing','Security Testing',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-12.1','fw-pci-dss','12.1',NULL,'Security Policy','A comprehensive security policy is established','Establish security policy','Information Security Policy','Policy',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-12.2','fw-pci-dss','12.2',NULL,'Acceptable Use','Acceptable use policies are implemented','Define acceptable use','Information Security Policy','Policy',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-12.3','fw-pci-dss','12.3',NULL,'Risk Assessment','Risks to the CDE are managed','Manage risks','Information Security Policy','Policy',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-12.4','fw-pci-dss','12.4',NULL,'PCI DSS Responsibilities','PCI DSS compliance is managed','Manage PCI compliance','Information Security Policy','Policy',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-12.5','fw-pci-dss','12.5',NULL,'PCI DSS Scope','PCI DSS scope is documented','Document scope','Information Security Policy','Policy',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-12.6','fw-pci-dss','12.6',NULL,'Security Awareness','Security awareness education is ongoing','Train employees','Information Security Policy','Policy',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-12.7','fw-pci-dss','12.7',NULL,'Personnel Screening','Personnel are screened','Screen personnel','Information Security Policy','Policy',NULL,0,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-12.8','fw-pci-dss','12.8',NULL,'Third-Party Risk','Third-party risks are managed','Manage third parties','Information Security Policy','Policy',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('pci-12.10','fw-pci-dss','12.10',NULL,'Incident Response','Security incidents are responded to immediately','Respond to incidents','Information Security Policy','Policy',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-cc1.1','fw-soc2','CC1.1',NULL,'Control Environment','The entity demonstrates commitment to integrity','Establish tone at the top','Common Criteria','Control Environment',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-cc1.2','fw-soc2','CC1.2',NULL,'Board Independence','Board demonstrates independence from management','Ensure board independence','Common Criteria','Control Environment',NULL,0,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-cc1.3','fw-soc2','CC1.3',NULL,'Organizational Structure','Management establishes structures and reporting lines','Define organizational structure','Common Criteria','Control Environment',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-cc1.4','fw-soc2','CC1.4',NULL,'Commitment to Competence','Entity demonstrates commitment to attract competent individuals','Hire and develop talent','Common Criteria','Control Environment',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-cc1.5','fw-soc2','CC1.5',NULL,'Accountability','Entity holds individuals accountable','Enforce accountability','Common Criteria','Control Environment',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-cc2.1','fw-soc2','CC2.1',NULL,'Internal Communication','Entity uses relevant quality information','Use quality information','Common Criteria','Communication and Information',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-cc2.2','fw-soc2','CC2.2',NULL,'Internal Information','Entity internally communicates information','Communicate internally','Common Criteria','Communication and Information',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-cc2.3','fw-soc2','CC2.3',NULL,'External Communication','Entity communicates with external parties','Communicate externally','Common Criteria','Communication and Information',NULL,0,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-cc3.1','fw-soc2','CC3.1',NULL,'Risk Objectives','Entity specifies objectives with sufficient clarity','Define clear objectives','Common Criteria','Risk Assessment',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-cc3.2','fw-soc2','CC3.2',NULL,'Risk Identification','Entity identifies risks to objectives','Identify risks','Common Criteria','Risk Assessment',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-cc3.3','fw-soc2','CC3.3',NULL,'Fraud Risk','Entity considers fraud in assessing risks','Assess fraud risk','Common Criteria','Risk Assessment',NULL,0,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-cc3.4','fw-soc2','CC3.4',NULL,'Change Management','Entity identifies and assesses changes','Manage changes','Common Criteria','Risk Assessment',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-cc4.1','fw-soc2','CC4.1',NULL,'Ongoing Evaluations','Entity performs ongoing evaluations','Perform ongoing evaluations','Common Criteria','Monitoring Activities',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-cc4.2','fw-soc2','CC4.2',NULL,'Deficiency Evaluation','Entity evaluates and communicates deficiencies','Address deficiencies','Common Criteria','Monitoring Activities',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-cc5.1','fw-soc2','CC5.1',NULL,'Control Selection','Entity selects and develops control activities','Select controls','Common Criteria','Control Activities',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-cc5.2','fw-soc2','CC5.2',NULL,'Technology Controls','Entity develops general controls over technology','Implement technology controls','Common Criteria','Control Activities',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-cc5.3','fw-soc2','CC5.3',NULL,'Policy Deployment','Entity deploys control activities through policies','Deploy policies','Common Criteria','Control Activities',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-cc6.1','fw-soc2','CC6.1',NULL,'Logical Access','Entity implements logical access security','Implement access controls','Common Criteria','Logical and Physical Access',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-cc6.2','fw-soc2','CC6.2',NULL,'Access Registration','Entity registers and authorizes users','Register users','Common Criteria','Logical and Physical Access',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-cc6.3','fw-soc2','CC6.3',NULL,'Access Removal','Entity removes access to protected assets','Remove access','Common Criteria','Logical and Physical Access',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-cc6.4','fw-soc2','CC6.4',NULL,'Access Review','Entity restricts physical access','Restrict physical access','Common Criteria','Logical and Physical Access',NULL,0,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-cc6.5','fw-soc2','CC6.5',NULL,'Asset Disposal','Entity discontinues protections over physical assets','Dispose assets securely','Common Criteria','Logical and Physical Access',NULL,0,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-cc6.6','fw-soc2','CC6.6',NULL,'Boundary Protection','Entity implements logical access security measures','Protect boundaries','Common Criteria','Logical and Physical Access',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-cc6.7','fw-soc2','CC6.7',NULL,'Transmission Protection','Entity restricts transmission of information','Protect data transmission','Common Criteria','Logical and Physical Access',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-cc6.8','fw-soc2','CC6.8',NULL,'Malware Prevention','Entity implements controls to prevent malware','Prevent malware','Common Criteria','Logical and Physical Access',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-cc7.1','fw-soc2','CC7.1',NULL,'Configuration Management','Entity uses detection and monitoring procedures','Manage configurations','Common Criteria','System Operations',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-cc7.2','fw-soc2','CC7.2',NULL,'Security Monitoring','Entity monitors system components','Monitor systems','Common Criteria','System Operations',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-cc7.3','fw-soc2','CC7.3',NULL,'Event Analysis','Entity evaluates security events','Analyze events','Common Criteria','System Operations',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-cc7.4','fw-soc2','CC7.4',NULL,'Incident Response','Entity responds to identified security incidents','Respond to incidents','Common Criteria','System Operations',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-cc7.5','fw-soc2','CC7.5',NULL,'Incident Recovery','Entity recovers from identified security incidents','Recover from incidents','Common Criteria','System Operations',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-cc8.1','fw-soc2','CC8.1',NULL,'Change Management Process','Entity authorizes and manages changes','Manage system changes','Common Criteria','Change Management',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-cc9.1','fw-soc2','CC9.1',NULL,'Risk Mitigation','Entity identifies and develops risk mitigation','Mitigate risks','Common Criteria','Risk Mitigation',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-cc9.2','fw-soc2','CC9.2',NULL,'Third-Party Risk','Entity assesses risks associated with vendors','Manage vendor risk','Common Criteria','Risk Mitigation',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-a1.1','fw-soc2','A1.1',NULL,'Capacity Management','Entity maintains and monitors processing capacity','Manage capacity','Availability','System Availability',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-a1.2','fw-soc2','A1.2',NULL,'Environmental Protections','Entity implements environmental protections','Implement environmental controls','Availability','System Availability',NULL,0,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-a1.3','fw-soc2','A1.3',NULL,'Recovery Procedures','Entity tests recovery plan procedures','Test recovery procedures','Availability','System Availability',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-c1.1','fw-soc2','C1.1',NULL,'Confidential Information','Entity identifies and maintains confidential information','Identify confidential data','Confidentiality','Protection of Confidential Information',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-c1.2','fw-soc2','C1.2',NULL,'Disposal of Confidential Information','Entity disposes of confidential information','Dispose confidential data','Confidentiality','Protection of Confidential Information',NULL,0,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-pi1.1','fw-soc2','PI1.1',NULL,'Processing Definition','Entity uses relevant quality information','Define processing requirements','Processing Integrity','System Processing',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-pi1.2','fw-soc2','PI1.2',NULL,'Input Validation','Entity implements policies over system inputs','Validate inputs','Processing Integrity','System Processing',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-pi1.3','fw-soc2','PI1.3',NULL,'Processing Accuracy','Entity implements policies over system processing','Ensure processing accuracy','Processing Integrity','System Processing',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-p1.1','fw-soc2','P1.1',NULL,'Privacy Notice','Entity provides notice about privacy practices','Provide privacy notice','Privacy','Privacy Notice',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-p2.1','fw-soc2','P2.1',NULL,'Consent','Entity communicates choices about data use','Obtain consent','Privacy','Choice and Consent',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-p3.1','fw-soc2','P3.1',NULL,'Collection Limitation','Entity collects data only for identified purposes','Limit collection','Privacy','Collection',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-p4.1','fw-soc2','P4.1',NULL,'Use Limitation','Entity limits use of personal information','Limit use','Privacy','Use, Retention, and Disposal',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-p5.1','fw-soc2','P5.1',NULL,'Data Subject Access','Entity grants data subjects access to their data','Provide data access','Privacy','Access',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-p6.1','fw-soc2','P6.1',NULL,'Third-Party Disclosure','Entity discloses data only for identified purposes','Limit disclosure','Privacy','Disclosure to Third Parties',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('soc2-p8.1','fw-soc2','P8.1',NULL,'Privacy Monitoring','Entity monitors compliance with privacy commitments','Monitor privacy compliance','Privacy','Monitoring and Enforcement',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('gdpr-5.1','fw-gdpr','Art.5.1',NULL,'Data Processing Principles','Personal data shall be processed lawfully, fairly and transparently','Ensure lawful processing','Principles','Lawfulness',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('gdpr-5.2','fw-gdpr','Art.5.2',NULL,'Accountability','Controller shall demonstrate compliance','Demonstrate compliance','Principles','Accountability',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('gdpr-6','fw-gdpr','Art.6',NULL,'Lawfulness of Processing','Processing shall be lawful with legal basis','Establish legal basis','Principles','Legal Basis',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('gdpr-7','fw-gdpr','Art.7',NULL,'Conditions for Consent','Controller shall demonstrate consent','Demonstrate consent','Principles','Consent',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('gdpr-9','fw-gdpr','Art.9',NULL,'Special Categories','Processing of special categories shall be prohibited except...','Protect special categories','Principles','Special Categories',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('gdpr-12','fw-gdpr','Art.12',NULL,'Transparent Information','Controller shall provide information in a concise manner','Provide clear information','Data Subject Rights','Transparency',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('gdpr-13','fw-gdpr','Art.13',NULL,'Information at Collection','Controller shall provide information when collecting data','Inform at collection','Data Subject Rights','Privacy Notice',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('gdpr-14','fw-gdpr','Art.14',NULL,'Information Not From Subject','Controller shall provide info for indirect collection','Inform for indirect collection','Data Subject Rights','Privacy Notice',NULL,0,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('gdpr-15','fw-gdpr','Art.15',NULL,'Right of Access','Data subject has right to obtain confirmation','Provide data access','Data Subject Rights','Access',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('gdpr-16','fw-gdpr','Art.16',NULL,'Right to Rectification','Data subject has right to rectification','Enable data correction','Data Subject Rights','Rectification',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('gdpr-17','fw-gdpr','Art.17',NULL,'Right to Erasure','Data subject has right to erasure','Enable data deletion','Data Subject Rights','Erasure',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('gdpr-18','fw-gdpr','Art.18',NULL,'Right to Restriction','Data subject has right to restriction','Enable processing restriction','Data Subject Rights','Restriction',NULL,0,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('gdpr-20','fw-gdpr','Art.20',NULL,'Right to Data Portability','Data subject has right to receive data','Enable data portability','Data Subject Rights','Portability',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('gdpr-21','fw-gdpr','Art.21',NULL,'Right to Object','Data subject has right to object','Handle objections','Data Subject Rights','Objection',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('gdpr-22','fw-gdpr','Art.22',NULL,'Automated Decision-Making','Data subject has right regarding automated decisions','Address automated decisions','Data Subject Rights','Automated Decisions',NULL,0,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('gdpr-24','fw-gdpr','Art.24',NULL,'Controller Responsibility','Controller shall implement appropriate measures','Implement appropriate measures','Controller/Processor','Controller Obligations',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('gdpr-25','fw-gdpr','Art.25',NULL,'Data Protection by Design','Controller shall implement data protection by design','Design for privacy','Controller/Processor','Privacy by Design',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('gdpr-28','fw-gdpr','Art.28',NULL,'Processor','Controller shall use only adequate processors','Manage processors','Controller/Processor','Processor Requirements',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('gdpr-30','fw-gdpr','Art.30',NULL,'Records of Processing','Controller shall maintain records of processing','Maintain processing records','Controller/Processor','Records',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('gdpr-32','fw-gdpr','Art.32',NULL,'Security of Processing','Controller shall implement appropriate security measures','Implement security measures','Controller/Processor','Security',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('gdpr-33','fw-gdpr','Art.33',NULL,'Breach Notification to Authority','Controller shall notify authority of breaches','Notify authority of breaches','Controller/Processor','Breach Notification',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('gdpr-34','fw-gdpr','Art.34',NULL,'Breach Communication to Subject','Controller shall communicate high-risk breaches to subjects','Notify subjects of breaches','Controller/Processor','Breach Notification',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('gdpr-35','fw-gdpr','Art.35',NULL,'Data Protection Impact Assessment','Controller shall carry out DPIA for high-risk processing','Conduct DPIAs','Controller/Processor','DPIA',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('gdpr-37','fw-gdpr','Art.37',NULL,'Data Protection Officer','Controller shall designate DPO when required','Appoint DPO if required','Controller/Processor','DPO',NULL,0,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('gdpr-44','fw-gdpr','Art.44',NULL,'Transfer Principles','Transfers to third countries shall comply with conditions','Ensure lawful transfers','International Transfers','General Principle',NULL,1,1,'2025-12-30 13:40:29');
INSERT INTO "control_library" VALUES('gdpr-46','fw-gdpr','Art.46',NULL,'Appropriate Safeguards','Controller may transfer with appropriate safeguards','Implement transfer safeguards','International Transfers','Safeguards',NULL,1,1,'2025-12-30 13:40:29');
CREATE TABLE iso27001_themes (
  id TEXT PRIMARY KEY,
  theme_number INTEGER NOT NULL,        
  name TEXT NOT NULL,                   
  description TEXT,
  control_count INTEGER DEFAULT 0,
  icon TEXT,
  color TEXT
);
INSERT INTO "iso27001_themes" VALUES('theme-5',5,'Organizational Controls','Policies, procedures, roles, responsibilities, and governance controls',37,'fa-building','#3b82f6');
INSERT INTO "iso27001_themes" VALUES('theme-6',6,'People Controls','Human resource security, awareness, and training controls',8,'fa-users','#10b981');
INSERT INTO "iso27001_themes" VALUES('theme-7',7,'Physical Controls','Physical security, environmental controls, and equipment protection',14,'fa-door-closed','#f59e0b');
INSERT INTO "iso27001_themes" VALUES('theme-8',8,'Technological Controls','Technical security controls, access management, cryptography, and operations',34,'fa-microchip','#8b5cf6');
CREATE TABLE control_mappings (
  id TEXT PRIMARY KEY,
  source_framework_id TEXT NOT NULL,    
  source_control_id TEXT NOT NULL,
  target_framework_id TEXT NOT NULL,
  target_control_id TEXT NOT NULL,
  mapping_type TEXT DEFAULT 'equivalent', 
  mapping_strength REAL DEFAULT 1.0,    
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_framework_id) REFERENCES compliance_frameworks_v2(id),
  FOREIGN KEY (target_framework_id) REFERENCES compliance_frameworks_v2(id),
  UNIQUE(source_framework_id, source_control_id, target_framework_id, target_control_id)
);
INSERT INTO "control_mappings" VALUES('map-5.1-nist-gv','fw-iso27001','iso-5.1','fw-nist-csf','nist-gv.po-01','equivalent',1,'Both require establishing security policies','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.1-pci-12','fw-iso27001','iso-5.1','fw-pci-dss','pci-12.1','equivalent',1,'Both require comprehensive security policy','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.1-soc2','fw-iso27001','iso-5.1','fw-soc2','soc2-cc5.3','equivalent',1,'Both require policy deployment','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.1-gdpr','fw-iso27001','iso-5.1','fw-gdpr','gdpr-24','partial',1,'GDPR requires appropriate measures','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.2-nist','fw-iso27001','iso-5.2','fw-nist-csf','nist-gv.rr-01','equivalent',1,'Both require defining security roles','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.2-soc2','fw-iso27001','iso-5.2','fw-soc2','soc2-cc1.3','equivalent',1,'Both require organizational structure','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.3-pci','fw-iso27001','iso-5.3','fw-pci-dss','pci-7.2','partial',1,'PCI requires appropriate access','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.3-soc2','fw-iso27001','iso-5.3','fw-soc2','soc2-cc5.1','partial',1,'SOC2 requires control selection','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.4-soc2','fw-iso27001','iso-5.4','fw-soc2','soc2-cc1.1','equivalent',1,'Both require management commitment','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.4-gdpr','fw-iso27001','iso-5.4','fw-gdpr','gdpr-5.2','partial',1,'GDPR accountability','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.5-gdpr','fw-iso27001','iso-5.5','fw-gdpr','gdpr-33','partial',1,'GDPR requires notification','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.7-nist','fw-iso27001','iso-5.7','fw-nist-csf','nist-id.ra-02','equivalent',1,'Both require threat intelligence','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.8-pci','fw-iso27001','iso-5.8','fw-pci-dss','pci-6.1','partial',1,'PCI requires secure development','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.8-soc2','fw-iso27001','iso-5.8','fw-soc2','soc2-cc8.1','partial',1,'SOC2 requires change management','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.9-nist','fw-iso27001','iso-5.9','fw-nist-csf','nist-id.am-02','equivalent',1,'Both require asset inventory','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.9-pci','fw-iso27001','iso-5.9','fw-pci-dss','pci-12.5','partial',1,'PCI requires scope documentation','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.9-soc2','fw-iso27001','iso-5.9','fw-soc2','soc2-cc6.1','partial',1,'SOC2 requires logical access','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.9-gdpr','fw-iso27001','iso-5.9','fw-gdpr','gdpr-30','partial',1,'GDPR requires records','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.10-pci','fw-iso27001','iso-5.10','fw-pci-dss','pci-12.2','equivalent',1,'Both require acceptable use policies','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.10-soc2','fw-iso27001','iso-5.10','fw-soc2','soc2-cc1.4','partial',1,'SOC2 requires competence','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.12-nist','fw-iso27001','iso-5.12','fw-nist-csf','nist-id.am-07','partial',1,'NIST requires asset criticality','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.12-pci','fw-iso27001','iso-5.12','fw-pci-dss','pci-3.1','partial',1,'PCI requires data classification','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.12-soc2','fw-iso27001','iso-5.12','fw-soc2','soc2-c1.1','equivalent',1,'Both require identifying confidential info','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.12-gdpr','fw-iso27001','iso-5.12','fw-gdpr','gdpr-9','partial',1,'GDPR requires special category','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.14-nist','fw-iso27001','iso-5.14','fw-nist-csf','nist-pr.ds-02','equivalent',1,'Both require data-in-transit protection','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.14-pci','fw-iso27001','iso-5.14','fw-pci-dss','pci-4.2','equivalent',1,'Both require encryption in transit','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.14-soc2','fw-iso27001','iso-5.14','fw-soc2','soc2-cc6.7','equivalent',1,'Both require transmission protection','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.15-nist','fw-iso27001','iso-5.15','fw-nist-csf','nist-pr.aa-05','equivalent',1,'Both require access control','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.15-pci','fw-iso27001','iso-5.15','fw-pci-dss','pci-7.1','equivalent',1,'Both require access restriction','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.15-soc2','fw-iso27001','iso-5.15','fw-soc2','soc2-cc6.1','equivalent',1,'Both require logical access','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.16-nist','fw-iso27001','iso-5.16','fw-nist-csf','nist-pr.aa-01','equivalent',1,'Both require identity management','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.16-pci','fw-iso27001','iso-5.16','fw-pci-dss','pci-8.2','equivalent',1,'Both require user identification','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.16-soc2','fw-iso27001','iso-5.16','fw-soc2','soc2-cc6.2','equivalent',1,'Both require user registration','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.17-nist','fw-iso27001','iso-5.17','fw-nist-csf','nist-pr.aa-02','equivalent',1,'Both require authentication','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.17-pci','fw-iso27001','iso-5.17','fw-pci-dss','pci-8.3','equivalent',1,'Both require strong authentication','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.17-soc2','fw-iso27001','iso-5.17','fw-soc2','soc2-cc6.1','partial',1,'SOC2 requires access security','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.18-pci','fw-iso27001','iso-5.18','fw-pci-dss','pci-7.2','equivalent',1,'Both require appropriate access','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.18-soc2','fw-iso27001','iso-5.18','fw-soc2','soc2-cc6.3','partial',1,'SOC2 requires access removal','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.19-nist','fw-iso27001','iso-5.19','fw-nist-csf','nist-gv.sc-01','equivalent',1,'Both require supply chain risk','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.19-pci','fw-iso27001','iso-5.19','fw-pci-dss','pci-12.8','equivalent',1,'Both require third-party risk','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.19-soc2','fw-iso27001','iso-5.19','fw-soc2','soc2-cc9.2','equivalent',1,'Both require vendor risk','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.19-gdpr','fw-iso27001','iso-5.19','fw-gdpr','gdpr-28','equivalent',1,'Both require processor management','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.24-nist','fw-iso27001','iso-5.24','fw-nist-csf','nist-pr.ir-01','equivalent',1,'Both require incident response','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.24-pci','fw-iso27001','iso-5.24','fw-pci-dss','pci-12.10','equivalent',1,'Both require incident response','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.24-soc2','fw-iso27001','iso-5.24','fw-soc2','soc2-cc7.4','equivalent',1,'Both require incident response','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.24-gdpr','fw-iso27001','iso-5.24','fw-gdpr','gdpr-33','partial',1,'GDPR requires breach notification','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.26-nist','fw-iso27001','iso-5.26','fw-nist-csf','nist-rs.ma-01','equivalent',1,'Both require incident management','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.26-soc2','fw-iso27001','iso-5.26','fw-soc2','soc2-cc7.4','equivalent',1,'Both require incident response','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.29-nist','fw-iso27001','iso-5.29','fw-nist-csf','nist-pr.ir-02','equivalent',1,'Both require backup/recovery','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.29-soc2','fw-iso27001','iso-5.29','fw-soc2','soc2-a1.3','equivalent',1,'Both require recovery procedures','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.30-nist','fw-iso27001','iso-5.30','fw-nist-csf','nist-rc.rp-01','equivalent',1,'Both require recovery execution','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.30-soc2','fw-iso27001','iso-5.30','fw-soc2','soc2-cc7.5','equivalent',1,'Both require incident recovery','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.31-pci','fw-iso27001','iso-5.31','fw-pci-dss','pci-12.4','partial',1,'PCI requires compliance management','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.31-gdpr','fw-iso27001','iso-5.31','fw-gdpr','gdpr-5.2','partial',1,'GDPR requires demonstrating compliance','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.34-soc2','fw-iso27001','iso-5.34','fw-soc2','soc2-p1.1','equivalent',1,'Both require privacy notice','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.34-gdpr','fw-iso27001','iso-5.34','fw-gdpr','gdpr-5.1','equivalent',1,'Both require lawful processing','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.35-soc2','fw-iso27001','iso-5.35','fw-soc2','soc2-cc4.1','equivalent',1,'Both require evaluations','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-5.36-soc2','fw-iso27001','iso-5.36','fw-soc2','soc2-cc4.2','partial',1,'SOC2 requires deficiency evaluation','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-6.1-pci','fw-iso27001','iso-6.1','fw-pci-dss','pci-12.7','equivalent',1,'Both require personnel screening','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-6.1-soc2','fw-iso27001','iso-6.1','fw-soc2','soc2-cc1.4','partial',1,'SOC2 requires competent individuals','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-6.2-soc2','fw-iso27001','iso-6.2','fw-soc2','soc2-cc1.5','partial',1,'SOC2 requires accountability','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-6.3-nist','fw-iso27001','iso-6.3','fw-nist-csf','nist-pr.at-01','equivalent',1,'Both require security awareness','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-6.3-pci','fw-iso27001','iso-6.3','fw-pci-dss','pci-12.6','equivalent',1,'Both require security awareness','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-6.3-soc2','fw-iso27001','iso-6.3','fw-soc2','soc2-cc1.4','partial',1,'SOC2 requires competence','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-6.4-soc2','fw-iso27001','iso-6.4','fw-soc2','soc2-cc1.5','equivalent',1,'Both require accountability','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-6.5-pci','fw-iso27001','iso-6.5','fw-pci-dss','pci-8.2','partial',1,'PCI requires user ID management','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-6.5-soc2','fw-iso27001','iso-6.5','fw-soc2','soc2-cc6.3','equivalent',1,'Both require access removal','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-6.6-soc2','fw-iso27001','iso-6.6','fw-soc2','soc2-c1.1','partial',1,'SOC2 requires confidential info protection','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-6.6-gdpr','fw-iso27001','iso-6.6','fw-gdpr','gdpr-28','partial',1,'GDPR requires processor confidentiality','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-6.7-nist','fw-iso27001','iso-6.7','fw-nist-csf','nist-pr.aa-05','partial',1,'NIST covers access controls','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-6.8-pci','fw-iso27001','iso-6.8','fw-pci-dss','pci-12.10','partial',1,'PCI requires incident response','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-6.8-soc2','fw-iso27001','iso-6.8','fw-soc2','soc2-cc7.3','partial',1,'SOC2 requires event analysis','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-6.8-gdpr','fw-iso27001','iso-6.8','fw-gdpr','gdpr-33','partial',1,'GDPR requires breach notification','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-7.1-pci','fw-iso27001','iso-7.1','fw-pci-dss','pci-9.2','equivalent',1,'Both require physical access controls','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-7.1-soc2','fw-iso27001','iso-7.1','fw-soc2','soc2-cc6.4','equivalent',1,'Both require physical access restriction','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-7.2-pci','fw-iso27001','iso-7.2','fw-pci-dss','pci-9.2','equivalent',1,'Both require physical entry controls','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-7.2-soc2','fw-iso27001','iso-7.2','fw-soc2','soc2-cc6.4','equivalent',1,'Both require physical access restriction','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-7.3-nist','fw-iso27001','iso-7.3','fw-nist-csf','nist-de.cm-02','partial',1,'NIST covers physical monitoring','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-7.4-nist','fw-iso27001','iso-7.4','fw-nist-csf','nist-de.cm-02','equivalent',1,'Both require physical monitoring','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-7.5-soc2','fw-iso27001','iso-7.5','fw-soc2','soc2-a1.2','equivalent',1,'Both require environmental protections','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-7.7-pci','fw-iso27001','iso-7.7','fw-pci-dss','pci-3.4','partial',1,'PCI requires PAN display restriction','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-7.9-pci','fw-iso27001','iso-7.9','fw-pci-dss','pci-9.4','partial',1,'PCI requires media security','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-7.10-pci','fw-iso27001','iso-7.10','fw-pci-dss','pci-9.4','equivalent',1,'Both require media security','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-7.10-soc2','fw-iso27001','iso-7.10','fw-soc2','soc2-cc6.5','equivalent',1,'Both require secure disposal','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-7.13-nist','fw-iso27001','iso-7.13','fw-nist-csf','nist-pr.ps-02','partial',1,'NIST covers software maintenance','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-7.14-pci','fw-iso27001','iso-7.14','fw-pci-dss','pci-9.4','partial',1,'PCI requires media destruction','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-7.14-soc2','fw-iso27001','iso-7.14','fw-soc2','soc2-cc6.5','equivalent',1,'Both require secure disposal','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-7.14-gdpr','fw-iso27001','iso-7.14','fw-gdpr','gdpr-17','partial',1,'GDPR requires erasure capability','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.1-nist','fw-iso27001','iso-8.1','fw-nist-csf','nist-de.cm-09','equivalent',1,'Both require endpoint monitoring','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.1-pci','fw-iso27001','iso-8.1','fw-pci-dss','pci-2.2','partial',1,'PCI requires secure configurations','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.2-nist','fw-iso27001','iso-8.2','fw-nist-csf','nist-pr.at-02','partial',1,'NIST requires privileged user training','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.2-pci','fw-iso27001','iso-8.2','fw-pci-dss','pci-7.2','equivalent',1,'Both require appropriate access','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.2-soc2','fw-iso27001','iso-8.2','fw-soc2','soc2-cc6.1','equivalent',1,'Both require access control','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.3-pci','fw-iso27001','iso-8.3','fw-pci-dss','pci-7.3','equivalent',1,'Both require access control systems','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.3-soc2','fw-iso27001','iso-8.3','fw-soc2','soc2-cc6.1','equivalent',1,'Both require logical access','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.4-pci','fw-iso27001','iso-8.4','fw-pci-dss','pci-6.2','partial',1,'PCI requires secure custom software','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.5-nist','fw-iso27001','iso-8.5','fw-nist-csf','nist-pr.aa-02','equivalent',1,'Both require authentication','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.5-pci','fw-iso27001','iso-8.5','fw-pci-dss','pci-8.3','equivalent',1,'Both require strong authentication','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.5-pci-mfa','fw-iso27001','iso-8.5','fw-pci-dss','pci-8.4','partial',1,'PCI requires MFA','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.5-soc2','fw-iso27001','iso-8.5','fw-soc2','soc2-cc6.1','partial',1,'SOC2 requires access security','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.6-soc2','fw-iso27001','iso-8.6','fw-soc2','soc2-a1.1','equivalent',1,'Both require capacity management','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.7-nist','fw-iso27001','iso-8.7','fw-nist-csf','nist-de.cm-09','partial',1,'NIST covers endpoint monitoring','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.7-pci','fw-iso27001','iso-8.7','fw-pci-dss','pci-5.2','equivalent',1,'Both require malware protection','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.7-soc2','fw-iso27001','iso-8.7','fw-soc2','soc2-cc6.8','equivalent',1,'Both require malware prevention','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.8-nist','fw-iso27001','iso-8.8','fw-nist-csf','nist-id.ra-01','equivalent',1,'Both require vulnerability identification','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.8-pci','fw-iso27001','iso-8.8','fw-pci-dss','pci-6.3','equivalent',1,'Both require vulnerability management','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.8-pci-scan','fw-iso27001','iso-8.8','fw-pci-dss','pci-11.3','equivalent',1,'Both require vulnerability scanning','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.9-nist','fw-iso27001','iso-8.9','fw-nist-csf','nist-pr.ps-01','equivalent',1,'Both require configuration management','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.9-pci','fw-iso27001','iso-8.9','fw-pci-dss','pci-2.2','equivalent',1,'Both require secure configurations','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.9-soc2','fw-iso27001','iso-8.9','fw-soc2','soc2-cc7.1','equivalent',1,'Both require configuration management','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.10-pci','fw-iso27001','iso-8.10','fw-pci-dss','pci-3.2','partial',1,'PCI requires minimizing data storage','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.10-soc2','fw-iso27001','iso-8.10','fw-soc2','soc2-c1.2','equivalent',1,'Both require confidential info disposal','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.10-gdpr','fw-iso27001','iso-8.10','fw-gdpr','gdpr-17','equivalent',1,'Both require erasure/deletion','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.11-pci','fw-iso27001','iso-8.11','fw-pci-dss','pci-3.4','equivalent',1,'Both require data masking/protection','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.12-pci','fw-iso27001','iso-8.12','fw-pci-dss','pci-3.5','partial',1,'PCI requires PAN protection','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.12-soc2','fw-iso27001','iso-8.12','fw-soc2','soc2-c1.1','partial',1,'SOC2 requires confidential info protection','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.13-nist','fw-iso27001','iso-8.13','fw-nist-csf','nist-pr.ir-02','equivalent',1,'Both require backup','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.13-soc2','fw-iso27001','iso-8.13','fw-soc2','soc2-a1.3','partial',1,'SOC2 requires recovery procedures','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.14-soc2','fw-iso27001','iso-8.14','fw-soc2','soc2-a1.1','partial',1,'SOC2 requires capacity management','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.15-nist','fw-iso27001','iso-8.15','fw-nist-csf','nist-pr.ps-04','equivalent',1,'Both require log management','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.15-pci','fw-iso27001','iso-8.15','fw-pci-dss','pci-10.2','equivalent',1,'Both require audit logs','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.15-soc2','fw-iso27001','iso-8.15','fw-soc2','soc2-cc7.2','partial',1,'SOC2 requires security monitoring','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.16-nist','fw-iso27001','iso-8.16','fw-nist-csf','nist-de.cm-01','equivalent',1,'Both require network monitoring','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.16-pci','fw-iso27001','iso-8.16','fw-pci-dss','pci-10.4','equivalent',1,'Both require log review','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.16-soc2','fw-iso27001','iso-8.16','fw-soc2','soc2-cc7.2','equivalent',1,'Both require system monitoring','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.17-pci','fw-iso27001','iso-8.17','fw-pci-dss','pci-10.6','equivalent',1,'Both require time synchronization','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.18-pci','fw-iso27001','iso-8.18','fw-pci-dss','pci-7.2','partial',1,'PCI requires access control','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.20-nist','fw-iso27001','iso-8.20','fw-nist-csf','nist-pr.aa-05','partial',1,'NIST covers access permissions','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.20-pci','fw-iso27001','iso-8.20','fw-pci-dss','pci-1.2','equivalent',1,'Both require network security','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.20-soc2','fw-iso27001','iso-8.20','fw-soc2','soc2-cc6.6','equivalent',1,'Both require boundary protection','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.21-pci','fw-iso27001','iso-8.21','fw-pci-dss','pci-1.3','partial',1,'PCI requires network access restriction','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.22-pci','fw-iso27001','iso-8.22','fw-pci-dss','pci-1.3','equivalent',1,'Both require network segmentation','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.22-soc2','fw-iso27001','iso-8.22','fw-soc2','soc2-cc6.6','partial',1,'SOC2 requires boundary protection','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.24-nist','fw-iso27001','iso-8.24','fw-nist-csf','nist-pr.ds-01','partial',1,'NIST covers data-at-rest protection','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.24-pci','fw-iso27001','iso-8.24','fw-pci-dss','pci-3.5','equivalent',1,'Both require cryptographic protection','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.24-pci-key','fw-iso27001','iso-8.24','fw-pci-dss','pci-3.6','equivalent',1,'Both require key management','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.25-pci','fw-iso27001','iso-8.25','fw-pci-dss','pci-6.1','equivalent',1,'Both require secure SDLC','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.25-soc2','fw-iso27001','iso-8.25','fw-soc2','soc2-cc8.1','equivalent',1,'Both require change management','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.26-pci','fw-iso27001','iso-8.26','fw-pci-dss','pci-6.2','equivalent',1,'Both require secure software development','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.27-pci','fw-iso27001','iso-8.27','fw-pci-dss','pci-2.2','partial',1,'PCI requires secure configurations','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.27-gdpr','fw-iso27001','iso-8.27','fw-gdpr','gdpr-25','partial',1,'GDPR requires privacy by design','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.28-pci','fw-iso27001','iso-8.28','fw-pci-dss','pci-6.2','equivalent',1,'Both require secure coding','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.29-pci','fw-iso27001','iso-8.29','fw-pci-dss','pci-11.4','equivalent',1,'Both require penetration testing','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.29-nist','fw-iso27001','iso-8.29','fw-nist-csf','nist-id.im-01','equivalent',1,'Both require security testing','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.30-pci','fw-iso27001','iso-8.30','fw-pci-dss','pci-6.5','partial',1,'PCI requires change management','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.30-soc2','fw-iso27001','iso-8.30','fw-soc2','soc2-cc9.2','partial',1,'SOC2 covers third-party risk','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.31-pci','fw-iso27001','iso-8.31','fw-pci-dss','pci-6.5','partial',1,'PCI requires change management','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.31-soc2','fw-iso27001','iso-8.31','fw-soc2','soc2-cc8.1','partial',1,'SOC2 covers change management','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.32-pci','fw-iso27001','iso-8.32','fw-pci-dss','pci-6.5','equivalent',1,'Both require change management','2025-12-30 13:40:29');
INSERT INTO "control_mappings" VALUES('map-8.32-soc2','fw-iso27001','iso-8.32','fw-soc2','soc2-cc8.1','equivalent',1,'Both require change management','2025-12-30 13:40:29');
CREATE TABLE org_framework_applicability (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  framework_id TEXT NOT NULL,
  is_applicable INTEGER DEFAULT 1,      
  applicability_reason TEXT,            
  target_compliance_date DATE,
  certification_status TEXT,            
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
CREATE TABLE control_assessments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  control_library_id TEXT NOT NULL,     
  
  
  implementation_status TEXT DEFAULT 'not_started',  
  
  
  
  maturity_level INTEGER DEFAULT 0,     
  
  
  assessment_date DATE,
  assessor_id TEXT,
  evidence_description TEXT,
  evidence_urls TEXT DEFAULT '[]',      
  gaps_identified TEXT,
  remediation_plan TEXT,
  remediation_due_date DATE,
  remediation_owner_id TEXT,
  
  
  linked_risk_ids TEXT DEFAULT '[]',    
  
  
  last_audit_date DATE,
  last_audit_result TEXT,
  audit_findings TEXT,
  
  
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
INSERT INTO "control_assessments" VALUES('ca-600a2782','org-001','iso-5.1','implemented',1,'2025-12-30 15:53:27',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:48','2025-12-30 15:53:27',NULL);
INSERT INTO "control_assessments" VALUES('ca-c9ad261f','org-001','iso-5.2','implemented',4,'2025-12-30 13:20:54',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:48','2025-12-30 13:20:54',NULL);
INSERT INTO "control_assessments" VALUES('ca-4fe8aa53','org-001','iso-5.3','implemented',3,'2025-12-30 13:20:54',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:49','2025-12-30 13:20:54',NULL);
INSERT INTO "control_assessments" VALUES('ca-837c32de','org-001','iso-5.4','implemented',4,'2025-12-30 13:20:54',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:49','2025-12-30 13:20:54',NULL);
INSERT INTO "control_assessments" VALUES('ca-40344b5c','org-001','iso-5.5','implemented',3,'2025-12-30 13:20:54',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:49','2025-12-30 13:20:54',NULL);
INSERT INTO "control_assessments" VALUES('ca-77d96f5e','org-001','iso-5.6','not_started',0,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:49','2025-12-30 13:20:49',NULL);
INSERT INTO "control_assessments" VALUES('ca-772b1266','org-001','iso-5.7','in_progress',2,'2025-12-30 13:20:55',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:49','2025-12-30 13:20:55',NULL);
INSERT INTO "control_assessments" VALUES('ca-2d9a7ef1','org-001','iso-5.8','not_started',0,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:49','2025-12-30 13:20:49',NULL);
INSERT INTO "control_assessments" VALUES('ca-322c9201','org-001','iso-5.9','implemented',4,'2025-12-30 13:20:55',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:49','2025-12-30 13:20:55',NULL);
INSERT INTO "control_assessments" VALUES('ca-99a5385e','org-001','iso-5.10','implemented',3,'2025-12-30 13:20:55',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:49','2025-12-30 13:20:55',NULL);
INSERT INTO "control_assessments" VALUES('ca-40875713','org-001','iso-5.11','implemented',3,'2025-12-30 13:50:16',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:49','2025-12-30 13:50:16',NULL);
INSERT INTO "control_assessments" VALUES('ca-7087725f','org-001','iso-5.12','in_progress',2,'2025-12-30 13:20:55',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:49','2025-12-30 13:20:55',NULL);
INSERT INTO "control_assessments" VALUES('ca-db380e77','org-001','iso-5.13','in_progress',2,'2025-12-30 13:50:16',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:49','2025-12-30 13:50:16',NULL);
INSERT INTO "control_assessments" VALUES('ca-be867ea6','org-001','iso-5.14','implemented',4,'2025-12-30 13:50:16',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:49','2025-12-30 13:50:16',NULL);
INSERT INTO "control_assessments" VALUES('ca-227f36e6','org-001','iso-5.15','in_progress',2,'2025-12-30 13:20:56',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:49','2025-12-30 13:20:56',NULL);
INSERT INTO "control_assessments" VALUES('ca-2e97d362','org-001','iso-5.16','implemented',4,'2025-12-30 13:50:16',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:49','2025-12-30 13:50:16',NULL);
INSERT INTO "control_assessments" VALUES('ca-9a614bf8','org-001','iso-5.17','implemented',5,'2025-12-30 13:50:17',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:49','2025-12-30 13:50:17',NULL);
INSERT INTO "control_assessments" VALUES('ca-1039fb2f','org-001','iso-5.18','implemented',4,'2025-12-30 13:50:17',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:49','2025-12-30 13:50:17',NULL);
INSERT INTO "control_assessments" VALUES('ca-8c13696e','org-001','iso-5.19','implemented',3,'2025-12-30 13:50:17',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:49','2025-12-30 13:50:17',NULL);
INSERT INTO "control_assessments" VALUES('ca-356c20c1','org-001','iso-5.20','implemented',3,'2025-12-30 13:50:17',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:49','2025-12-30 13:50:17',NULL);
INSERT INTO "control_assessments" VALUES('ca-231c50c3','org-001','iso-5.21','in_progress',2,'2025-12-30 13:50:17',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:49','2025-12-30 13:50:17',NULL);
INSERT INTO "control_assessments" VALUES('ca-42e7b444','org-001','iso-5.22','implemented',3,'2025-12-30 13:50:18',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:49','2025-12-30 13:50:18',NULL);
INSERT INTO "control_assessments" VALUES('ca-976b66cc','org-001','iso-5.23','implemented',4,'2025-12-30 13:50:18',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:49','2025-12-30 13:50:18',NULL);
INSERT INTO "control_assessments" VALUES('ca-cbfb125e','org-001','iso-5.24','not_started',0,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:50','2025-12-30 13:20:50',NULL);
INSERT INTO "control_assessments" VALUES('ca-c8841860','org-001','iso-5.25','implemented',3,'2025-12-30 13:50:18',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:50','2025-12-30 13:50:18',NULL);
INSERT INTO "control_assessments" VALUES('ca-8e24e444','org-001','iso-5.26','not_started',0,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:50','2025-12-30 13:20:50',NULL);
INSERT INTO "control_assessments" VALUES('ca-6c480247','org-001','iso-5.27','implemented',3,'2025-12-30 13:50:18',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:50','2025-12-30 13:50:18',NULL);
INSERT INTO "control_assessments" VALUES('ca-cc5ba7ec','org-001','iso-5.28','implemented',3,'2025-12-30 13:50:19',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:50','2025-12-30 13:50:19',NULL);
INSERT INTO "control_assessments" VALUES('ca-73a6fd4c','org-001','iso-5.29','implemented',4,'2025-12-30 13:50:19',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:50','2025-12-30 13:50:19',NULL);
INSERT INTO "control_assessments" VALUES('ca-aff0a751','org-001','iso-5.30','implemented',4,'2025-12-30 13:50:19',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:50','2025-12-30 13:50:19',NULL);
INSERT INTO "control_assessments" VALUES('ca-bb668dd1','org-001','iso-5.31','implemented',3,'2025-12-30 13:50:19',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:50','2025-12-30 13:50:19',NULL);
INSERT INTO "control_assessments" VALUES('ca-971450cd','org-001','iso-5.32','implemented',3,'2025-12-30 13:50:19',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:50','2025-12-30 13:50:19',NULL);
INSERT INTO "control_assessments" VALUES('ca-c9bf65fd','org-001','iso-5.33','implemented',4,'2025-12-30 13:50:20',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:50','2025-12-30 13:50:20',NULL);
INSERT INTO "control_assessments" VALUES('ca-57c8ece7','org-001','iso-5.34','not_implemented',4,'2025-12-30 13:50:20',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,'[Auto-sync 2026-01-08] All 1 linked risk(s) are open - control not effective','2025-12-30 13:20:50','2026-01-08 15:33:56',NULL);
INSERT INTO "control_assessments" VALUES('ca-c9ffba10','org-001','iso-5.35','implemented',3,'2025-12-30 13:50:20',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:50','2025-12-30 13:50:20',NULL);
INSERT INTO "control_assessments" VALUES('ca-2616a3f0','org-001','iso-5.36','implemented',3,'2025-12-30 13:50:20',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:50','2025-12-30 13:50:20',NULL);
INSERT INTO "control_assessments" VALUES('ca-85f6b94c','org-001','iso-5.37','implemented',4,'2025-12-30 13:50:21',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:50','2025-12-30 13:50:21',NULL);
INSERT INTO "control_assessments" VALUES('ca-8e55f1ad','org-001','iso-6.1','implemented',4,'2025-12-30 13:27:28',NULL,'Personnel screening implemented','[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:50','2025-12-30 13:27:28',NULL);
INSERT INTO "control_assessments" VALUES('ca-15039483','org-001','iso-6.2','implemented',3,'2025-12-30 13:27:29',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:50','2025-12-30 13:27:29',NULL);
INSERT INTO "control_assessments" VALUES('ca-ee456aa5','org-001','iso-6.3','implemented',2,'2025-12-30 13:27:29',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,replace('\n[Manual Sync] Restored after audit finding remediation\n[2026-01-13 04:23:26] Deficiency identified via Risk Register (re-opened)\n[2026-01-13 04:24:44] Restored via Risk Register mitigation','\n',char(10)),'2025-12-30 13:20:50','2026-01-13 04:24:44',NULL);
INSERT INTO "control_assessments" VALUES('ca-63639a12','org-001','iso-6.4','implemented',3,'2025-12-30 13:50:31',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:50','2025-12-30 13:50:31',NULL);
INSERT INTO "control_assessments" VALUES('ca-174dd5ee','org-001','iso-6.5','implemented',4,'2025-12-30 13:50:31',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:50','2025-12-30 13:50:31',NULL);
INSERT INTO "control_assessments" VALUES('ca-234cfa8b','org-001','iso-6.6','implemented',4,'2025-12-30 13:50:31',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:51','2025-12-30 13:50:31',NULL);
INSERT INTO "control_assessments" VALUES('ca-f29abe69','org-001','iso-6.7','implemented',3,'2025-12-30 13:50:31',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:51','2025-12-30 13:50:31',NULL);
INSERT INTO "control_assessments" VALUES('ca-f82cc375','org-001','iso-6.8','implemented',3,'2025-12-30 13:50:32',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:51','2025-12-30 13:50:32',NULL);
INSERT INTO "control_assessments" VALUES('ca-679686b1','org-001','iso-7.1','implemented',4,'2025-12-30 13:27:29',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:51','2025-12-30 13:27:29',NULL);
INSERT INTO "control_assessments" VALUES('ca-16e14312','org-001','iso-7.2','implemented',3,'2025-12-30 13:27:29',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:51','2025-12-30 13:27:29',NULL);
INSERT INTO "control_assessments" VALUES('ca-adaa87ca','org-001','iso-7.3','implemented',4,'2025-12-30 13:50:46',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:51','2025-12-30 13:50:46',NULL);
INSERT INTO "control_assessments" VALUES('ca-831b2021','org-001','iso-7.4','implemented',3,'2025-12-30 13:50:46',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:51','2025-12-30 13:50:46',NULL);
INSERT INTO "control_assessments" VALUES('ca-cc7c9bd3','org-001','iso-7.5','not_started',0,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:51','2025-12-30 13:20:51',NULL);
INSERT INTO "control_assessments" VALUES('ca-f5dcbbc9','org-001','iso-7.6','implemented',3,'2025-12-30 13:50:46',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:51','2025-12-30 13:50:46',NULL);
INSERT INTO "control_assessments" VALUES('ca-c69846ef','org-001','iso-7.7','implemented',3,'2025-12-30 13:50:46',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,replace('\n[2026-01-13 04:04:20] Deficiency identified via Risk Register (re-opened)\n[2026-01-13 04:13:19] Deficiency identified via Risk Register (re-opened)\n[2026-01-13 04:14:22] Restored via Risk Register mitigation','\n',char(10)),'2025-12-30 13:20:51','2026-01-13 04:14:22',NULL);
INSERT INTO "control_assessments" VALUES('ca-0ded5849','org-001','iso-7.8','implemented',4,'2025-12-30 13:50:46',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:51','2025-12-30 13:50:46',NULL);
INSERT INTO "control_assessments" VALUES('ca-815c1db3','org-001','iso-7.9','implemented',3,'2025-12-30 13:50:46',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:51','2025-12-30 13:50:46',NULL);
INSERT INTO "control_assessments" VALUES('ca-495d6937','org-001','iso-7.10','implemented',4,'2025-12-30 13:50:47',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:51','2025-12-30 13:50:47',NULL);
INSERT INTO "control_assessments" VALUES('ca-a2a86881','org-001','iso-7.11','implemented',4,'2025-12-30 13:50:47',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:51','2025-12-30 13:50:47',NULL);
INSERT INTO "control_assessments" VALUES('ca-5d18cdbc','org-001','iso-7.12','implemented',3,'2025-12-30 13:50:47',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:51','2025-12-30 13:50:47',NULL);
INSERT INTO "control_assessments" VALUES('ca-39b81e2c','org-001','iso-7.13','implemented',4,'2025-12-30 13:50:47',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:51','2025-12-30 13:50:47',NULL);
INSERT INTO "control_assessments" VALUES('ca-b11fef98','org-001','iso-7.14','implemented',4,'2025-12-30 13:50:47',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:51','2025-12-30 13:50:47',NULL);
INSERT INTO "control_assessments" VALUES('ca-bdffbc60','org-001','iso-8.1','implemented',4,'2025-12-30 13:27:29',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,'[Auto-sync 2026-01-08] All 1 linked risk(s) are open - control not effective | [Auto-sync 2026-01-08] All 1 linked risk(s) are mitigated/closed','2025-12-30 13:20:51','2026-01-08 16:36:41',NULL);
INSERT INTO "control_assessments" VALUES('ca-cebe748a','org-001','iso-8.2','implemented',5,'2025-12-30 13:27:30',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,'[Auto-sync 2026-01-08] All 1 linked risk(s) are open - control not effective | [Auto-sync 2026-01-08] All 1 linked risk(s) are mitigated/closed','2025-12-30 13:20:51','2026-01-08 16:36:42',NULL);
INSERT INTO "control_assessments" VALUES('ca-2ad9bfb1','org-001','iso-8.3','implemented',4,'2025-12-30 13:51:14',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,'[Auto-sync 2026-01-08] All 1 linked risk(s) are open - control not effective | [Auto-sync 2026-01-08] All 1 linked risk(s) are mitigated/closed','2025-12-30 13:20:51','2026-01-08 16:18:37',NULL);
INSERT INTO "control_assessments" VALUES('ca-152dae34','org-001','iso-8.4','implemented',3,'2025-12-30 13:51:14',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,'[Auto-sync 2026-01-08] All 1 linked risk(s) are open - control not effective | [Auto-sync 2026-01-08] All 1 linked risk(s) are mitigated/closed','2025-12-30 13:20:52','2026-01-08 16:36:43',NULL);
INSERT INTO "control_assessments" VALUES('ca-eb16235d','org-001','iso-8.5','implemented',4,'2025-12-30 13:27:30',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,'[Auto-sync 2026-01-08] All 1 linked risk(s) are open - control not effective | [Auto-sync 2026-01-08] All 1 linked risk(s) are mitigated/closed','2025-12-30 13:20:52','2026-01-08 16:36:43',NULL);
INSERT INTO "control_assessments" VALUES('ca-043698ca','org-001','iso-8.6','implemented',4,'2025-12-30 13:51:14',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,'[Auto-sync 2026-01-08] All 1 linked risk(s) are open - control not effective | [Auto-sync 2026-01-08] All 1 linked risk(s) are mitigated/closed','2025-12-30 13:20:52','2026-01-08 16:36:43',NULL);
INSERT INTO "control_assessments" VALUES('ca-111b00ec','org-001','iso-8.7','in_progress',2,'2025-12-30 13:27:30',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:52','2025-12-30 13:27:30',NULL);
INSERT INTO "control_assessments" VALUES('ca-714b182f','org-001','iso-8.8','not_implemented',3,'2025-12-30 13:27:30',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,'[Auto-sync 2026-01-08] All 1 linked risk(s) are open - control not effective | [Auto-sync 2026-01-08] All 1 linked risk(s) are mitigated/closed | [Auto-sync 2026-01-08] All 2 linked risk(s) are open - control not effective','2025-12-30 13:20:52','2026-01-08 16:39:03',NULL);
INSERT INTO "control_assessments" VALUES('ca-afdad4e3','org-001','iso-8.9','not_implemented',0,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,'[Auto-sync 2026-01-08] All 1 linked risk(s) are mitigated/closed | [Auto-sync 2026-01-08] All 6 linked risk(s) are open - control not effective','2025-12-30 13:20:52','2026-01-08 16:39:03',NULL);
INSERT INTO "control_assessments" VALUES('ca-87cda73c','org-001','iso-8.10','implemented',3,'2025-12-30 13:51:15',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,'[Auto-sync 2026-01-08] All 1 linked risk(s) are open - control not effective | [Auto-sync 2026-01-08] All 1 linked risk(s) are mitigated/closed','2025-12-30 13:20:52','2026-01-08 16:36:41',NULL);
INSERT INTO "control_assessments" VALUES('ca-51cdea4e','org-001','iso-8.11','implemented',4,'2025-12-30 13:51:15',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,'[Auto-sync 2026-01-08] All 1 linked risk(s) are open - control not effective | [Auto-sync 2026-01-08] All 1 linked risk(s) are mitigated/closed','2025-12-30 13:20:52','2026-01-08 16:36:41',NULL);
INSERT INTO "control_assessments" VALUES('ca-ce805c5a','org-001','iso-8.12','in_progress',2,'2025-12-30 13:51:15',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'2025-12-30 13:20:52','2025-12-30 13:51:15',NULL);
INSERT INTO "control_assessments" VALUES('ca-779c6d38','org-001','iso-8.13','implemented',5,'2025-12-30 13:51:15',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,'[Auto-sync 2026-01-08] All 1 linked risk(s) are open - control not effective | [Auto-sync 2026-01-08] All 1 linked risk(s) are mitigated/closed','2025-12-30 13:20:52','2026-01-08 16:36:41',NULL);
INSERT INTO "control_assessments" VALUES('ca-735fcae4','org-001','iso-8.14','implemented',4,'2025-12-30 13:51:15',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,'[Auto-sync 2026-01-08] All 1 linked risk(s) are open - control not effective | [Auto-sync 2026-01-08] All 1 linked risk(s) are mitigated/closed','2025-12-30 13:20:52','2026-01-08 16:36:41',NULL);
INSERT INTO "control_assessments" VALUES('ca-98d48d35','org-001','iso-8.15','implemented',4,'2025-12-30 13:27:30',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,'[Auto-sync 2026-01-08] All 1 linked risk(s) are open - control not effective | [Auto-sync 2026-01-08] All 1 linked risk(s) are mitigated/closed','2025-12-30 13:20:52','2026-01-08 16:36:41',NULL);
INSERT INTO "control_assessments" VALUES('ca-c51d7e20','org-001','iso-8.16','implemented',0,NULL,NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,'[Auto-sync 2026-01-08] All 1 linked risk(s) are mitigated/closed','2025-12-30 13:20:52','2026-01-08 16:36:41',NULL);
INSERT INTO "control_assessments" VALUES('ca-d1661f62','org-001','iso-8.17','implemented',4,'2025-12-30 13:51:16',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,'[Auto-sync 2026-01-08] All 1 linked risk(s) are open - control not effective | [Auto-sync 2026-01-08] All 1 linked risk(s) are mitigated/closed','2025-12-30 13:20:52','2026-01-08 16:36:41',NULL);
INSERT INTO "control_assessments" VALUES('ca-16ab9399','org-001','iso-8.18','not_implemented',3,'2025-12-30 13:51:16',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,'[Auto-sync 2026-01-08] All 1 linked risk(s) are open - control not effective | [Auto-sync 2026-01-08] All 1 linked risk(s) are mitigated/closed | [Auto-sync 2026-01-08] All 1 linked risk(s) are open - control not effective','2025-12-30 13:20:52','2026-01-08 16:39:02',NULL);
INSERT INTO "control_assessments" VALUES('ca-2b5dc365','org-001','iso-8.19','not_implemented',4,'2025-12-30 13:51:16',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,'[Auto-sync 2026-01-08] All 1 linked risk(s) are open - control not effective | [Auto-sync 2026-01-08] All 1 linked risk(s) are mitigated/closed | [Auto-sync 2026-01-08] All 1 linked risk(s) are open - control not effective','2025-12-30 13:20:52','2026-01-08 16:39:02',NULL);
INSERT INTO "control_assessments" VALUES('ca-0227b344','org-001','iso-8.20','not_implemented',4,'2025-12-30 13:51:16',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,'[Auto-sync 2026-01-08] All 1 linked risk(s) are open - control not effective | [Auto-sync 2026-01-08] All 1 linked risk(s) are mitigated/closed | [Auto-sync 2026-01-08] All 3 linked risk(s) are open - control not effective','2025-12-30 13:20:52','2026-01-08 16:39:03',NULL);
INSERT INTO "control_assessments" VALUES('ca-239838ce','org-001','iso-8.21','implemented',4,'2025-12-30 13:51:16',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,'[Auto-sync 2026-01-08] All 1 linked risk(s) are open - control not effective | [Auto-sync 2026-01-08] All 1 linked risk(s) are mitigated/closed','2025-12-30 13:20:52','2026-01-08 16:36:42',NULL);
INSERT INTO "control_assessments" VALUES('ca-50f24d02','org-001','iso-8.22','implemented',4,'2025-12-30 13:51:16',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,'[Auto-sync 2026-01-08] All 1 linked risk(s) are open - control not effective | [Auto-sync 2026-01-08] All 1 linked risk(s) are mitigated/closed','2025-12-30 13:20:52','2026-01-08 16:36:42',NULL);
INSERT INTO "control_assessments" VALUES('ca-f26c7191','org-001','iso-8.23','implemented',3,'2025-12-30 13:51:17',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,'[Auto-sync 2026-01-08] All 1 linked risk(s) are open - control not effective | [Auto-sync 2026-01-08] All 1 linked risk(s) are mitigated/closed','2025-12-30 13:20:52','2026-01-08 16:36:42',NULL);
INSERT INTO "control_assessments" VALUES('ca-91c7bf04','org-001','iso-8.24','not_implemented',5,'2025-12-30 13:51:17',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,'[Auto-sync 2026-01-08] All 2 linked risk(s) are open - control not effective | [Auto-sync 2026-01-08] All 1 linked risk(s) are mitigated/closed | [Auto-sync 2026-01-08] All 1 linked risk(s) are open - control not effective','2025-12-30 13:20:53','2026-01-08 16:44:05',NULL);
INSERT INTO "control_assessments" VALUES('ca-fcb66857','org-001','iso-8.25','implemented',4,'2025-12-30 13:51:17',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,'[Auto-sync 2026-01-08] All 1 linked risk(s) are open - control not effective | [Auto-sync 2026-01-08] All 1 linked risk(s) are mitigated/closed','2025-12-30 13:20:53','2026-01-08 16:36:42',NULL);
INSERT INTO "control_assessments" VALUES('ca-967647bb','org-001','iso-8.26','partially_implemented',4,'2025-12-30 13:51:17',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,'[Auto-sync 2026-01-08] All 1 linked risk(s) are open - control not effective | [Auto-sync 2026-01-08] All 1 linked risk(s) are mitigated/closed | [Auto-sync 2026-01-08] 2 of 5 linked risk(s) still open','2025-12-30 13:20:53','2026-01-08 16:39:03',NULL);
INSERT INTO "control_assessments" VALUES('ca-28796ebf','org-001','iso-8.27','implemented',4,'2025-12-30 13:51:17',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,'[Auto-sync 2026-01-08] All 1 linked risk(s) are open - control not effective | [Auto-sync 2026-01-08] All 1 linked risk(s) are mitigated/closed','2025-12-30 13:20:53','2026-01-08 16:36:42',NULL);
INSERT INTO "control_assessments" VALUES('ca-eb9da409','org-001','iso-8.28','implemented',4,'2025-12-30 13:51:17',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,'[Auto-sync 2026-01-08] All 1 linked risk(s) are open - control not effective | [Auto-sync 2026-01-08] All 1 linked risk(s) are mitigated/closed','2025-12-30 13:20:53','2026-01-08 16:36:42',NULL);
INSERT INTO "control_assessments" VALUES('ca-75a26d8f','org-001','iso-8.29','implemented',4,'2025-12-30 13:51:18',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,'[Auto-sync 2026-01-08] All 1 linked risk(s) are open - control not effective | [Auto-sync 2026-01-08] All 1 linked risk(s) are mitigated/closed','2025-12-30 13:20:53','2026-01-08 16:36:43',NULL);
INSERT INTO "control_assessments" VALUES('ca-694d2754','org-001','iso-8.30','implemented',3,'2025-12-30 13:51:18',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,'[Auto-sync 2026-01-08] All 1 linked risk(s) are open - control not effective | [Auto-sync 2026-01-08] All 1 linked risk(s) are mitigated/closed','2025-12-30 13:20:53','2026-01-08 16:36:43',NULL);
INSERT INTO "control_assessments" VALUES('ca-30d4b744','org-001','iso-8.31','implemented',4,'2025-12-30 13:51:18',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,'[Auto-sync 2026-01-08] All 1 linked risk(s) are open - control not effective | [Auto-sync 2026-01-08] All 1 linked risk(s) are mitigated/closed','2025-12-30 13:20:53','2026-01-08 16:36:43',NULL);
INSERT INTO "control_assessments" VALUES('ca-f258c0d3','org-001','iso-8.32','implemented',4,'2025-12-30 13:51:18',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,'[Auto-sync 2026-01-08] All 1 linked risk(s) are open - control not effective | [Auto-sync 2026-01-08] All 1 linked risk(s) are mitigated/closed','2025-12-30 13:20:53','2026-01-08 16:36:43',NULL);
INSERT INTO "control_assessments" VALUES('ca-f66683b1','org-001','iso-8.33','implemented',3,'2025-12-30 13:51:18',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,'[Auto-sync 2026-01-08] All 1 linked risk(s) are open - control not effective | [Auto-sync 2026-01-08] All 1 linked risk(s) are mitigated/closed','2025-12-30 13:20:53','2026-01-08 16:36:43',NULL);
INSERT INTO "control_assessments" VALUES('ca-ef25aeb5','org-001','iso-8.34','implemented',4,'2025-12-30 13:51:19',NULL,NULL,'[]',NULL,NULL,NULL,NULL,'[]',NULL,NULL,NULL,'[Auto-sync 2026-01-08] All 1 linked risk(s) are open - control not effective | [Auto-sync 2026-01-08] All 1 linked risk(s) are mitigated/closed','2025-12-30 13:20:53','2026-01-08 16:36:43',NULL);
CREATE TABLE compliance_scores (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  framework_id TEXT NOT NULL,
  
  
  compliance_score REAL DEFAULT 0,      
  maturity_score REAL DEFAULT 0,        
  
  
  total_controls INTEGER DEFAULT 0,
  applicable_controls INTEGER DEFAULT 0,
  implemented_controls INTEGER DEFAULT 0,
  partial_controls INTEGER DEFAULT 0,
  not_implemented_controls INTEGER DEFAULT 0,
  not_applicable_controls INTEGER DEFAULT 0,
  
  
  category_scores TEXT DEFAULT '{}',    
  
  
  previous_score REAL,
  score_change REAL,
  
  
  last_calculated DATETIME,
  calculation_method TEXT DEFAULT 'weighted', 
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (framework_id) REFERENCES compliance_frameworks_v2(id),
  UNIQUE(organization_id, framework_id)
);
CREATE TABLE compliance_history (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  framework_id TEXT NOT NULL,
  score REAL NOT NULL,
  maturity_score REAL,
  snapshot_date DATE NOT NULL,
  snapshot_data TEXT,                   
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (framework_id) REFERENCES compliance_frameworks_v2(id)
);
CREATE TABLE organization_profile (
  organization_id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  industry TEXT NOT NULL DEFAULT 'technology',
  industry_sector TEXT,
  company_size TEXT DEFAULT 'medium',
  headquarters_region TEXT DEFAULT 'us',
  operating_regions TEXT DEFAULT '["us"]',
  
  
  handles_card_data INTEGER DEFAULT 0,
  handles_health_data INTEGER DEFAULT 0,
  handles_personal_data INTEGER DEFAULT 1,
  handles_financial_data INTEGER DEFAULT 0,
  handles_government_data INTEGER DEFAULT 0,
  
  
  iso_certified INTEGER DEFAULT 0,
  soc2_certified INTEGER DEFAULT 0,
  pci_certified INTEGER DEFAULT 0,
  gdpr_compliant INTEGER DEFAULT 0,
  hipaa_compliant INTEGER DEFAULT 0,
  
  
  risk_appetite TEXT DEFAULT 'moderate',
  security_maturity_target INTEGER DEFAULT 3,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "organization_profile" VALUES('org-001','Acm Corporatione ','technology','SaaS','medium','mena','["mena"]',1,0,1,1,0,0,0,0,0,0,'moderate',4,'2025-12-30 13:52:29','2025-12-30 16:12:41');
CREATE TABLE framework_applicability (
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
INSERT INTO "framework_applicability" VALUES('fa-001','org-001','fw-iso27001',1,'Core information security framework - applicable to all organizations',1,85,NULL,NULL,'2025-12-30 13:52:29','2025-12-30 16:12:43');
INSERT INTO "framework_applicability" VALUES('fa-002','org-001','fw-nist-csf',0,'Optional - primarily used in US market',4,75,NULL,NULL,'2025-12-30 13:52:29','2025-12-30 16:12:42');
INSERT INTO "framework_applicability" VALUES('fa-003','org-001','fw-pci-dss',1,'Required - organization handles payment card data',1,100,NULL,NULL,'2025-12-30 13:52:29','2025-12-30 16:12:44');
INSERT INTO "framework_applicability" VALUES('fa-004','org-001','fw-soc2',1,'Recommended for technology/SaaS companies handling customer data',1,90,NULL,NULL,'2025-12-30 13:52:29','2025-12-30 16:12:44');
INSERT INTO "framework_applicability" VALUES('fa-005','org-001','fw-gdpr',0,'Not applicable - no EU operations or EU personal data',5,80,NULL,NULL,'2025-12-30 13:52:29','2025-12-30 16:12:43');
CREATE TABLE soa_entries (
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
CREATE TABLE industry_framework_requirements (
  id TEXT PRIMARY KEY,
  industry TEXT NOT NULL,
  framework_id TEXT NOT NULL,
  is_typically_required INTEGER DEFAULT 0,
  is_recommended INTEGER DEFAULT 1,
  requirement_notes TEXT,
  UNIQUE(industry, framework_id)
);
INSERT INTO "industry_framework_requirements" VALUES('ifr-hc-iso','healthcare','fw-iso27001',1,1,'Recommended for healthcare organizations handling sensitive data');
INSERT INTO "industry_framework_requirements" VALUES('ifr-hc-nist','healthcare','fw-nist-csf',1,1,'Recommended by HHS for healthcare cybersecurity');
INSERT INTO "industry_framework_requirements" VALUES('ifr-hc-soc2','healthcare','fw-soc2',0,1,'Recommended for healthcare SaaS providers');
INSERT INTO "industry_framework_requirements" VALUES('ifr-hc-gdpr','healthcare','fw-gdpr',0,1,'Required if processing EU patient data');
INSERT INTO "industry_framework_requirements" VALUES('ifr-fin-iso','finance','fw-iso27001',1,1,'Often required by financial regulators');
INSERT INTO "industry_framework_requirements" VALUES('ifr-fin-nist','finance','fw-nist-csf',1,1,'FFIEC recommends NIST CSF alignment');
INSERT INTO "industry_framework_requirements" VALUES('ifr-fin-pci','finance','fw-pci-dss',1,1,'Required if processing card data');
INSERT INTO "industry_framework_requirements" VALUES('ifr-fin-soc2','finance','fw-soc2',1,1,'Common requirement for fintech');
INSERT INTO "industry_framework_requirements" VALUES('ifr-fin-gdpr','finance','fw-gdpr',0,1,'Required if serving EU customers');
INSERT INTO "industry_framework_requirements" VALUES('ifr-ret-iso','retail','fw-iso27001',0,1,'Recommended for enterprise retail');
INSERT INTO "industry_framework_requirements" VALUES('ifr-ret-pci','retail','fw-pci-dss',1,1,'Required for payment processing');
INSERT INTO "industry_framework_requirements" VALUES('ifr-ret-soc2','retail','fw-soc2',0,1,'Recommended for e-commerce platforms');
INSERT INTO "industry_framework_requirements" VALUES('ifr-ret-gdpr','retail','fw-gdpr',0,1,'Required if serving EU customers');
INSERT INTO "industry_framework_requirements" VALUES('ifr-tech-iso','technology','fw-iso27001',0,1,'Increasingly required by enterprise customers');
INSERT INTO "industry_framework_requirements" VALUES('ifr-tech-nist','technology','fw-nist-csf',0,1,'US government contracts often require');
INSERT INTO "industry_framework_requirements" VALUES('ifr-tech-soc2','technology','fw-soc2',1,1,'Essential for B2B SaaS');
INSERT INTO "industry_framework_requirements" VALUES('ifr-tech-gdpr','technology','fw-gdpr',0,1,'Required if serving EU customers');
INSERT INTO "industry_framework_requirements" VALUES('ifr-gov-iso','government','fw-iso27001',1,1,'Often required for government contractors');
INSERT INTO "industry_framework_requirements" VALUES('ifr-gov-nist','government','fw-nist-csf',1,1,'Required for federal contractors');
INSERT INTO "industry_framework_requirements" VALUES('ifr-gov-soc2','government','fw-soc2',0,1,'May be required for cloud services');
INSERT INTO "industry_framework_requirements" VALUES('ifr-mfg-iso','manufacturing','fw-iso27001',0,1,'Recommended for supply chain security');
INSERT INTO "industry_framework_requirements" VALUES('ifr-mfg-nist','manufacturing','fw-nist-csf',0,1,'Recommended for critical infrastructure');
INSERT INTO "industry_framework_requirements" VALUES('ifr-ps-iso','professional_services','fw-iso27001',0,1,'Recommended for client data protection');
INSERT INTO "industry_framework_requirements" VALUES('ifr-ps-soc2','professional_services','fw-soc2',1,1,'Common requirement from enterprise clients');
INSERT INTO "industry_framework_requirements" VALUES('ifr-ps-gdpr','professional_services','fw-gdpr',0,1,'Required if handling EU personal data');
CREATE TABLE data_type_framework_requirements (
  id TEXT PRIMARY KEY,
  data_type TEXT NOT NULL,
  framework_id TEXT NOT NULL,
  is_required INTEGER DEFAULT 1,
  requirement_notes TEXT,
  UNIQUE(data_type, framework_id)
);
INSERT INTO "data_type_framework_requirements" VALUES('dfr-card-pci','card_data','fw-pci-dss',1,'PCI DSS is mandatory for organizations processing, storing, or transmitting cardholder data');
INSERT INTO "data_type_framework_requirements" VALUES('dfr-personal-gdpr','personal_data_eu','fw-gdpr',1,'GDPR is mandatory for organizations processing EU personal data');
INSERT INTO "data_type_framework_requirements" VALUES('dfr-personal-soc2','personal_data','fw-soc2',0,'SOC 2 Privacy criteria recommended for personal data');
INSERT INTO "data_type_framework_requirements" VALUES('dfr-financial-soc2','financial_data','fw-soc2',0,'SOC 2 Security criteria recommended for financial data');
CREATE TABLE region_framework_requirements (
  id TEXT PRIMARY KEY,
  region TEXT NOT NULL,
  framework_id TEXT NOT NULL,
  is_required INTEGER DEFAULT 0,
  is_recommended INTEGER DEFAULT 1,
  requirement_notes TEXT,
  UNIQUE(region, framework_id)
);
INSERT INTO "region_framework_requirements" VALUES('rfr-eu-gdpr','eu','fw-gdpr',1,1,'GDPR is mandatory for EU operations or EU customer data');
INSERT INTO "region_framework_requirements" VALUES('rfr-eu-iso','eu','fw-iso27001',0,1,'ISO 27001 is widely recognized in the EU');
INSERT INTO "region_framework_requirements" VALUES('rfr-us-nist','us','fw-nist-csf',0,1,'NIST CSF is the US government recommended framework');
INSERT INTO "region_framework_requirements" VALUES('rfr-us-soc2','us','fw-soc2',0,1,'SOC 2 is common requirement for US B2B services');
INSERT INTO "region_framework_requirements" VALUES('rfr-global-iso','global','fw-iso27001',0,1,'ISO 27001 is internationally recognized');
CREATE TABLE compliance_snapshots (
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
INSERT INTO "compliance_snapshots" VALUES('snap-iso-m12','org-001','fw-iso27001','2025-01-12',25,18,23,10,60,0,93,1.5,0,'2026-01-12 17:52:25');
INSERT INTO "compliance_snapshots" VALUES('snap-iso-m11','org-001','fw-iso27001','2025-02-12',32,24,30,12,51,0,93,1.8,0,'2026-01-12 17:52:25');
INSERT INTO "compliance_snapshots" VALUES('snap-iso-m10','org-001','fw-iso27001','2025-03-12',38,30,35,14,44,0,93,2,0,'2026-01-12 17:52:25');
INSERT INTO "compliance_snapshots" VALUES('snap-iso-m09','org-001','fw-iso27001','2025-04-12',45,38,42,15,36,0,93,2.2,0,'2026-01-12 17:52:25');
INSERT INTO "compliance_snapshots" VALUES('snap-iso-m08','org-001','fw-iso27001','2025-05-12',50,42,47,16,30,0,93,2.4,0,'2026-01-12 17:52:25');
INSERT INTO "compliance_snapshots" VALUES('snap-iso-m07','org-001','fw-iso27001','2025-06-12',55,48,51,17,25,0,93,2.6,0,'2026-01-12 17:52:25');
INSERT INTO "compliance_snapshots" VALUES('snap-iso-m06','org-001','fw-iso27001','2025-07-12',58,51,54,18,21,0,93,2.7,0,'2026-01-12 17:52:25');
INSERT INTO "compliance_snapshots" VALUES('snap-iso-m05','org-001','fw-iso27001','2025-08-12',63,56,59,16,18,0,93,2.9,0,'2026-01-12 17:52:25');
INSERT INTO "compliance_snapshots" VALUES('snap-iso-m04','org-001','fw-iso27001','2025-09-12',68,61,63,14,16,0,93,3.1,0,'2026-01-12 17:52:25');
INSERT INTO "compliance_snapshots" VALUES('snap-iso-m03','org-001','fw-iso27001','2025-10-12',73,66,68,12,13,0,93,3.2,0,'2026-01-12 17:52:25');
INSERT INTO "compliance_snapshots" VALUES('snap-iso-m02','org-001','fw-iso27001','2025-11-12',78,71,73,10,10,0,93,3.4,0,'2026-01-12 17:52:25');
INSERT INTO "compliance_snapshots" VALUES('snap-iso-m01','org-001','fw-iso27001','2025-12-12',82,75,76,9,8,0,93,3.5,0,'2026-01-12 17:52:25');
INSERT INTO "compliance_snapshots" VALUES('snap-iso-m00','org-001','fw-iso27001','2026-01-12',84,77,78,8,7,0,93,3.6,0,'2026-01-12 17:52:25');
INSERT INTO "compliance_snapshots" VALUES('snap-soc2-m12','org-001','fw-soc2','2025-01-12',15,10,7,5,36,0,48,1.2,0,'2026-01-12 17:52:25');
INSERT INTO "compliance_snapshots" VALUES('snap-soc2-m11','org-001','fw-soc2','2025-02-12',21,15,10,6,32,0,48,1.5,0,'2026-01-12 17:52:25');
INSERT INTO "compliance_snapshots" VALUES('snap-soc2-m10','org-001','fw-soc2','2025-03-12',27,20,13,8,27,0,48,1.7,0,'2026-01-12 17:52:25');
INSERT INTO "compliance_snapshots" VALUES('snap-soc2-m09','org-001','fw-soc2','2025-04-12',33,26,16,9,23,0,48,1.9,0,'2026-01-12 17:52:25');
INSERT INTO "compliance_snapshots" VALUES('snap-soc2-m08','org-001','fw-soc2','2025-05-12',38,30,18,10,20,0,48,2.1,0,'2026-01-12 17:52:25');
INSERT INTO "compliance_snapshots" VALUES('snap-soc2-m07','org-001','fw-soc2','2025-06-12',42,34,20,11,17,0,48,2.3,0,'2026-01-12 17:52:25');
INSERT INTO "compliance_snapshots" VALUES('snap-soc2-m06','org-001','fw-soc2','2025-07-12',46,38,22,10,16,0,48,2.5,0,'2026-01-12 17:52:25');
INSERT INTO "compliance_snapshots" VALUES('snap-soc2-m05','org-001','fw-soc2','2025-08-12',50,42,24,10,14,0,48,2.7,0,'2026-01-12 17:52:25');
INSERT INTO "compliance_snapshots" VALUES('snap-soc2-m04','org-001','fw-soc2','2025-09-12',54,46,26,9,13,0,48,2.8,0,'2026-01-12 17:52:25');
INSERT INTO "compliance_snapshots" VALUES('snap-soc2-m03','org-001','fw-soc2','2025-10-12',56,48,27,9,12,0,48,2.9,0,'2026-01-12 17:52:25');
INSERT INTO "compliance_snapshots" VALUES('snap-soc2-m02','org-001','fw-soc2','2025-11-12',58,52,28,8,12,0,48,3,0,'2026-01-12 17:52:25');
INSERT INTO "compliance_snapshots" VALUES('snap-soc2-m01','org-001','fw-soc2','2025-12-12',60,55,29,7,12,0,48,3.1,0,'2026-01-12 17:52:25');
INSERT INTO "compliance_snapshots" VALUES('snap-soc2-m00','org-001','fw-soc2','2026-01-12',62,58,30,6,12,0,48,3.2,0,'2026-01-12 17:52:25');
INSERT INTO "compliance_snapshots" VALUES('snap-auto-mkc14p2s','org-001','fw-iso27001','2026-01-13',77,71,72,8,13,0,93,3.6,78,'2026-01-13 03:25:49');
CREATE TABLE domain_snapshots (
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
INSERT INTO "domain_snapshots" VALUES('dsnap-org-m12','org-001','2025-01-12','Organizational',22,16,8,37,'2026-01-12 17:52:25');
INSERT INTO "domain_snapshots" VALUES('dsnap-org-m09','org-001','2025-04-12','Organizational',38,30,14,37,'2026-01-12 17:52:25');
INSERT INTO "domain_snapshots" VALUES('dsnap-org-m06','org-001','2025-07-12','Organizational',54,46,20,37,'2026-01-12 17:52:25');
INSERT INTO "domain_snapshots" VALUES('dsnap-org-m03','org-001','2025-10-12','Organizational',68,60,25,37,'2026-01-12 17:52:25');
INSERT INTO "domain_snapshots" VALUES('dsnap-org-m00','org-001','2026-01-12','Organizational',76,70,28,37,'2026-01-12 17:52:25');
INSERT INTO "domain_snapshots" VALUES('dsnap-ppl-m12','org-001','2025-01-12','People',25,18,2,8,'2026-01-12 17:52:25');
INSERT INTO "domain_snapshots" VALUES('dsnap-ppl-m09','org-001','2025-04-12','People',50,40,4,8,'2026-01-12 17:52:25');
INSERT INTO "domain_snapshots" VALUES('dsnap-ppl-m06','org-001','2025-07-12','People',63,54,5,8,'2026-01-12 17:52:25');
INSERT INTO "domain_snapshots" VALUES('dsnap-ppl-m03','org-001','2025-10-12','People',75,66,6,8,'2026-01-12 17:52:25');
INSERT INTO "domain_snapshots" VALUES('dsnap-ppl-m00','org-001','2026-01-12','People',88,82,7,8,'2026-01-12 17:52:25');
INSERT INTO "domain_snapshots" VALUES('dsnap-phy-m12','org-001','2025-01-12','Physical',29,20,4,14,'2026-01-12 17:52:25');
INSERT INTO "domain_snapshots" VALUES('dsnap-phy-m09','org-001','2025-04-12','Physical',50,42,7,14,'2026-01-12 17:52:25');
INSERT INTO "domain_snapshots" VALUES('dsnap-phy-m06','org-001','2025-07-12','Physical',64,56,9,14,'2026-01-12 17:52:25');
INSERT INTO "domain_snapshots" VALUES('dsnap-phy-m03','org-001','2025-10-12','Physical',79,72,11,14,'2026-01-12 17:52:25');
INSERT INTO "domain_snapshots" VALUES('dsnap-phy-m00','org-001','2026-01-12','Physical',93,88,13,14,'2026-01-12 17:52:25');
INSERT INTO "domain_snapshots" VALUES('dsnap-tech-m12','org-001','2025-01-12','Technological',26,18,9,34,'2026-01-12 17:52:25');
INSERT INTO "domain_snapshots" VALUES('dsnap-tech-m09','org-001','2025-04-12','Technological',44,36,15,34,'2026-01-12 17:52:25');
INSERT INTO "domain_snapshots" VALUES('dsnap-tech-m06','org-001','2025-07-12','Technological',56,48,19,34,'2026-01-12 17:52:25');
INSERT INTO "domain_snapshots" VALUES('dsnap-tech-m03','org-001','2025-10-12','Technological',74,66,25,34,'2026-01-12 17:52:25');
INSERT INTO "domain_snapshots" VALUES('dsnap-tech-m00','org-001','2026-01-12','Technological',88,82,30,34,'2026-01-12 17:52:25');
INSERT INTO "domain_snapshots" VALUES('dsnap-auto-org-mkc14p6z','org-001','2026-01-13','Organizational',73,68,27,37,'2026-01-13 03:25:49');
INSERT INTO "domain_snapshots" VALUES('dsnap-auto-peo-mkc14pcx','org-001','2026-01-13','People',88,80,7,8,'2026-01-13 03:25:50');
INSERT INTO "domain_snapshots" VALUES('dsnap-auto-phy-mkc14pha','org-001','2026-01-13','Physical',93,82,13,14,'2026-01-13 03:25:50');
INSERT INTO "domain_snapshots" VALUES('dsnap-auto-tec-mkc14pli','org-001','2026-01-13','Technological',74,68,25,34,'2026-01-13 03:25:50');
CREATE TABLE risk_snapshots (
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
INSERT INTO "risk_snapshots" VALUES('rsnap-m12','org-001','2025-01-12',35,32,8,12,9,3,65000000,78,'2026-01-12 17:52:25');
INSERT INTO "risk_snapshots" VALUES('rsnap-m11','org-001','2025-02-12',33,29,7,11,8,3,58000000,72,'2026-01-12 17:52:25');
INSERT INTO "risk_snapshots" VALUES('rsnap-m10','org-001','2025-03-12',30,26,6,10,7,3,52000000,68,'2026-01-12 17:52:25');
INSERT INTO "risk_snapshots" VALUES('rsnap-m09','org-001','2025-04-12',28,24,6,9,7,2,48000000,64,'2026-01-12 17:52:25');
INSERT INTO "risk_snapshots" VALUES('rsnap-m08','org-001','2025-05-12',26,22,5,8,7,2,42000000,60,'2026-01-12 17:52:25');
INSERT INTO "risk_snapshots" VALUES('rsnap-m07','org-001','2025-06-12',24,20,5,7,6,2,38000000,56,'2026-01-12 17:52:25');
INSERT INTO "risk_snapshots" VALUES('rsnap-m06','org-001','2025-07-12',22,18,4,6,6,2,34000000,52,'2026-01-12 17:52:25');
INSERT INTO "risk_snapshots" VALUES('rsnap-m05','org-001','2025-08-12',20,16,4,5,5,2,30000000,48,'2026-01-12 17:52:25');
INSERT INTO "risk_snapshots" VALUES('rsnap-m04','org-001','2025-09-12',18,14,3,5,4,2,26000000,45,'2026-01-12 17:52:25');
INSERT INTO "risk_snapshots" VALUES('rsnap-m03','org-001','2025-10-12',16,12,3,4,4,1,22000000,42,'2026-01-12 17:52:25');
INSERT INTO "risk_snapshots" VALUES('rsnap-m02','org-001','2025-11-12',15,11,2,4,4,1,20000000,40,'2026-01-12 17:52:25');
INSERT INTO "risk_snapshots" VALUES('rsnap-m01','org-001','2025-12-12',14,10,2,3,4,1,18000000,38,'2026-01-12 17:52:25');
INSERT INTO "risk_snapshots" VALUES('rsnap-m00','org-001','2026-01-12',13,9,2,3,3,1,15000000,35,'2026-01-12 17:52:25');
INSERT INTO "risk_snapshots" VALUES('rsnap-auto-mkc14pts','org-001','2026-01-13',16,10,3,6,6,1,0,0,'2026-01-13 03:25:50');
CREATE TABLE control_risk_mappings (
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
INSERT INTO "control_risk_mappings" VALUES('crm-006','org-001','iso-5.34','risk-003','reduces','partial',80,NULL,1,NULL,'2025-12-31 19:13:17','2025-12-31 19:13:17');
INSERT INTO "control_risk_mappings" VALUES('crm-sql-1','org-001','iso-8.26','risk-pt-mk5ky9tp-5sp4kcdm1','mitigates','partial',85,NULL,1,NULL,'2026-01-08 16:38:14','2026-01-08 16:38:14');
INSERT INTO "control_risk_mappings" VALUES('crm-sql-2','org-001','iso-8.28','risk-pt-mk5ky9tp-5sp4kcdm1','mitigates','partial',90,NULL,1,NULL,'2026-01-08 16:38:14','2026-01-08 16:38:14');
INSERT INTO "control_risk_mappings" VALUES('crm-sql-3','org-001','iso-8.29','risk-pt-mk5ky9tp-5sp4kcdm1','detects','partial',80,NULL,1,NULL,'2026-01-08 16:38:14','2026-01-08 16:38:14');
INSERT INTO "control_risk_mappings" VALUES('crm-xss-1','org-001','iso-8.26','risk-pt-mk5ahg2p-i30tvew59','mitigates','partial',85,NULL,1,NULL,'2026-01-08 16:38:14','2026-01-08 16:38:14');
INSERT INTO "control_risk_mappings" VALUES('crm-xss-2','org-001','iso-8.28','risk-pt-mk5ahg2p-i30tvew59','mitigates','partial',90,NULL,1,NULL,'2026-01-08 16:38:14','2026-01-08 16:38:14');
INSERT INTO "control_risk_mappings" VALUES('crm-xss-3','org-001','iso-8.29','risk-pt-mk5ahg2p-i30tvew59','detects','partial',80,NULL,1,NULL,'2026-01-08 16:38:14','2026-01-08 16:38:14');
INSERT INTO "control_risk_mappings" VALUES('crm-idor-1','org-001','iso-8.3','risk-pt-mk5ahgb4-rk2uloyzz','mitigates','partial',85,NULL,1,NULL,'2026-01-08 16:38:14','2026-01-08 16:38:14');
INSERT INTO "control_risk_mappings" VALUES('crm-idor2-1','org-001','iso-8.3','risk-pt-mk5ahg5t-zdhvlij0x','mitigates','partial',85,NULL,1,NULL,'2026-01-08 16:38:14','2026-01-08 16:38:14');
INSERT INTO "control_risk_mappings" VALUES('crm-idor2-2','org-001','iso-8.26','risk-pt-mk5ahg5t-zdhvlij0x','mitigates','partial',80,NULL,1,NULL,'2026-01-08 16:38:14','2026-01-08 16:38:14');
INSERT INTO "control_risk_mappings" VALUES('crm-pass-1','org-001','iso-8.5','risk-pt-mk5ahg7l-m2ldk99p2','mitigates','full',90,NULL,1,NULL,'2026-01-08 16:38:14','2026-01-08 16:38:14');
INSERT INTO "control_risk_mappings" VALUES('crm-hdr-1','org-001','iso-8.20','risk-pt-mk5ahg4a-1z68w2cyl','mitigates','partial',75,NULL,1,NULL,'2026-01-08 16:38:34','2026-01-08 16:38:34');
INSERT INTO "control_risk_mappings" VALUES('crm-hdr-2','org-001','iso-8.26','risk-pt-mk5ahg4a-1z68w2cyl','mitigates','partial',80,NULL,1,NULL,'2026-01-08 16:38:34','2026-01-08 16:38:34');
INSERT INTO "control_risk_mappings" VALUES('crm-hdr-3','org-001','iso-8.9','risk-pt-mk5ahg4a-1z68w2cyl','mitigates','partial',85,NULL,1,NULL,'2026-01-08 16:38:34','2026-01-08 16:38:34');
INSERT INTO "control_risk_mappings" VALUES('crm-tls-1','org-001','iso-8.24','risk-pt-mk5bpb2f-enbofu5z7','mitigates','full',95,NULL,1,NULL,'2026-01-08 16:38:34','2026-01-08 16:38:34');
INSERT INTO "control_risk_mappings" VALUES('crm-tls-2','org-001','iso-8.20','risk-pt-mk5bpb2f-enbofu5z7','mitigates','partial',80,NULL,1,NULL,'2026-01-08 16:38:34','2026-01-08 16:38:34');
INSERT INTO "control_risk_mappings" VALUES('crm-cookie-1','org-001','iso-8.9','risk-pt-mk5c60wy-1vwnxiox6','mitigates','partial',85,NULL,1,NULL,'2026-01-08 16:38:34','2026-01-08 16:38:34');
INSERT INTO "control_risk_mappings" VALUES('crm-cookie-2','org-001','iso-8.26','risk-pt-mk5c60wy-1vwnxiox6','mitigates','partial',75,NULL,1,NULL,'2026-01-08 16:38:34','2026-01-08 16:38:34');
INSERT INTO "control_risk_mappings" VALUES('crm-php-1','org-001','iso-8.8','risk-pt-mk5c67wi-j47zcqki4','mitigates','partial',90,NULL,1,NULL,'2026-01-08 16:38:34','2026-01-08 16:38:34');
INSERT INTO "control_risk_mappings" VALUES('crm-php-2','org-001','iso-8.9','risk-pt-mk5c67wi-j47zcqki4','mitigates','partial',85,NULL,1,NULL,'2026-01-08 16:38:34','2026-01-08 16:38:34');
INSERT INTO "control_risk_mappings" VALUES('crm-php-3','org-001','iso-8.19','risk-pt-mk5c67wi-j47zcqki4','mitigates','partial',80,NULL,1,NULL,'2026-01-08 16:38:34','2026-01-08 16:38:34');
INSERT INTO "control_risk_mappings" VALUES('crm-http-1','org-001','iso-8.9','risk-pt-mk5c685k-pxp2vjcml','mitigates','partial',85,NULL,1,NULL,'2026-01-08 16:38:52','2026-01-08 16:38:52');
INSERT INTO "control_risk_mappings" VALUES('crm-http-2','org-001','iso-8.20','risk-pt-mk5c685k-pxp2vjcml','mitigates','partial',80,NULL,1,NULL,'2026-01-08 16:38:52','2026-01-08 16:38:52');
INSERT INTO "control_risk_mappings" VALUES('crm-pma-1','org-001','iso-8.8','risk-pt-mk5c65vz-6p4oyv227','mitigates','partial',90,NULL,1,NULL,'2026-01-08 16:38:52','2026-01-08 16:38:52');
INSERT INTO "control_risk_mappings" VALUES('crm-pma-2','org-001','iso-8.9','risk-pt-mk5c65vz-6p4oyv227','mitigates','partial',85,NULL,1,NULL,'2026-01-08 16:38:52','2026-01-08 16:38:52');
INSERT INTO "control_risk_mappings" VALUES('crm-pma-3','org-001','iso-8.18','risk-pt-mk5c65vz-6p4oyv227','mitigates','partial',80,NULL,1,NULL,'2026-01-08 16:38:52','2026-01-08 16:38:52');
INSERT INTO "control_risk_mappings" VALUES('crm-info-1','org-001','iso-8.9','risk-pt-mk5c66mt-6zbl6wq3e','mitigates','partial',90,NULL,1,NULL,'2026-01-08 16:38:52','2026-01-08 16:38:52');
INSERT INTO "control_risk_mappings" VALUES('crm-info-2','org-001','iso-8.12','risk-pt-mk5c66mt-6zbl6wq3e','mitigates','partial',85,NULL,1,NULL,'2026-01-08 16:38:52','2026-01-08 16:38:52');
INSERT INTO "control_risk_mappings" VALUES('crm-001','org-001','iso-8.28','risk-pt-mjshl9q0-kcdq61yd4','mitigates','full',95,NULL,1,NULL,'2026-01-12 17:52:25','2026-01-12 17:52:25');
INSERT INTO "control_risk_mappings" VALUES('crm-002','org-001','iso-8.29','risk-pt-mjshl9q0-kcdq61yd4','detects','partial',85,NULL,1,NULL,'2026-01-12 17:52:25','2026-01-12 17:52:25');
INSERT INTO "control_risk_mappings" VALUES('crm-003','org-001','iso-8.5','risk-004','mitigates','full',95,NULL,1,NULL,'2026-01-12 17:52:25','2026-01-12 17:52:25');
INSERT INTO "control_risk_mappings" VALUES('crm-004','org-001','iso-8.24','risk-002','mitigates','full',90,NULL,1,NULL,'2026-01-12 17:52:25','2026-01-12 17:52:25');
INSERT INTO "control_risk_mappings" VALUES('crm-005','org-001','iso-8.24','risk-003','mitigates','full',95,NULL,1,NULL,'2026-01-12 17:52:25','2026-01-12 17:52:25');
INSERT INTO "control_risk_mappings" VALUES('crm-007','org-001','iso-8.8','risk-005','mitigates','full',95,NULL,1,NULL,'2026-01-12 17:52:25','2026-01-12 17:52:25');
INSERT INTO "control_risk_mappings" VALUES('crm-aud-mkbjlvgw-cvdb69','org-001','iso-6.3','risk-aud-mkbjlv6u-qs6bwv','mitigates','partial',75,'Auto-created from audit finding',1,NULL,'2026-01-12 19:15:18','2026-01-12 19:15:18');
CREATE TABLE control_asset_mappings (
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
CREATE TABLE risk_asset_mappings (
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
CREATE TABLE control_risk_suggestions (
  id TEXT PRIMARY KEY,
  control_category TEXT NOT NULL,     -- ISO 27001 category (e.g., 'Technological', 'Organizational')
  control_subcategory TEXT,           -- More specific (e.g., 'Access Control', 'Cryptography')
  risk_category TEXT NOT NULL,        -- Risk category (e.g., 'vulnerability', 'configuration')
  risk_keywords TEXT,                 -- Comma-separated keywords to match in risk titles
  suggestion_weight INTEGER DEFAULT 50, -- 0-100, higher = stronger suggestion
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "control_risk_suggestions" VALUES('sug-001','Technological','Application Security','vulnerability','SQL injection,XSS,injection,code injection',95,'2025-12-31 19:13:17');
INSERT INTO "control_risk_suggestions" VALUES('sug-002','Technological','Access Control','configuration','MFA,authentication,password,access,unauthorized',90,'2025-12-31 19:13:17');
INSERT INTO "control_risk_suggestions" VALUES('sug-003','Technological','Cryptography','compliance','encryption,unencrypted,PII,data exposure',90,'2025-12-31 19:13:17');
INSERT INTO "control_risk_suggestions" VALUES('sug-004','Technological','Network Security','vulnerability','SSL,TLS,certificate,network,firewall',85,'2025-12-31 19:13:17');
INSERT INTO "control_risk_suggestions" VALUES('sug-005','Technological','Vulnerability Management','vulnerability','CVE,vulnerability,patch,outdated,Log4j',95,'2025-12-31 19:13:17');
INSERT INTO "control_risk_suggestions" VALUES('sug-006','Organizational','Policies','compliance','policy,procedure,compliance,audit',80,'2025-12-31 19:13:17');
INSERT INTO "control_risk_suggestions" VALUES('sug-007','Organizational','Asset Management','configuration','inventory,asset,configuration',75,'2025-12-31 19:13:17');
INSERT INTO "control_risk_suggestions" VALUES('sug-008','Organizational','Incident Response','vulnerability','incident,breach,response,detection',85,'2025-12-31 19:13:17');
INSERT INTO "control_risk_suggestions" VALUES('sug-009','People','Training','compliance','awareness,training,phishing,social engineering',80,'2025-12-31 19:13:17');
INSERT INTO "control_risk_suggestions" VALUES('sug-010','People','Access','configuration','user access,privilege,role,permission',85,'2025-12-31 19:13:17');
INSERT INTO "control_risk_suggestions" VALUES('sug-011','Physical','Physical Security','physical','physical,access,facility,premises',75,'2025-12-31 19:13:17');
INSERT INTO "control_risk_suggestions" VALUES('sug-012','Physical','Environmental','physical','environmental,disaster,fire,flood',70,'2025-12-31 19:13:17');
CREATE TABLE audit_programs (
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
INSERT INTO "audit_programs" VALUES('prog-mkbh0m1r-4fkfns','org-001','Q1 2026 audit plan','this paln for audit HR ',2026,'draft','2026-01-12','2026-01-17',NULL,0,0,'2026-01-12 18:02:48','2026-01-12 18:02:48');
CREATE TABLE audit_engagements (
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
INSERT INTO "audit_engagements" VALUES('eng-mkbh42si-47ebav','org-001','prog-mkbh0m1r-4fkfns','Q1 Internal audit','HR audit ','internal','in_progress','medium',NULL,NULL,NULL,'Mohamed Hitam','2026-01-12','2026-01-17',NULL,'HR',2,2,'2026-01-12 18:05:28','2026-01-12 19:15:17');
CREATE TABLE audit_findings (
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
    updated_at TEXT DEFAULT (datetime('now')), affected_controls TEXT,
    FOREIGN KEY (engagement_id) REFERENCES audit_engagements(id) ON DELETE SET NULL
);
INSERT INTO "audit_findings" VALUES('afnd-mkbhc0rm-hcrgdk','org-001','eng-mkbh42si-47ebav','Clean desk policy not enforced','the users not locked computers and no screen saver configured ','weakness','high','remediated','compliance','clean desk policy ',NULL,NULL,NULL,3,3,'medium','the users should lock computer befor leav office also the screen saver should be implemented ',NULL,NULL,NULL,'Help Dsek unit ','2026-01-24','2026-01-13 04:14:22',NULL,NULL,'risk-aud-mkbhclol-ogqe3q',NULL,NULL,'2026-01-12 18:12:05','2026-01-13 04:14:22','[{"id":"iso-7.7","code":"A.7.7"}]');
INSERT INTO "audit_findings" VALUES('afnd-mkbjlueo-me6tfd','org-001','eng-mkbh42si-47ebav','no security awarance program implemeted','no security awarance program implemeted','non_compliance','medium','remediated','compliance',NULL,NULL,NULL,NULL,3,3,'medium','the security training should implemented',NULL,NULL,NULL,'CISO','2026-01-31','2026-01-13 04:24:44',NULL,NULL,'risk-aud-mkbjlv6u-qs6bwv',NULL,NULL,'2026-01-12 19:15:16','2026-01-13 04:24:44','[{"id":"iso-6.3","code":"A.6.3"}]');
CREATE TABLE audit_evidence (
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
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" VALUES('d1_migrations',10);
CREATE INDEX idx_users_org ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_assets_org ON assets(organization_id);
CREATE INDEX idx_assets_type ON assets(organization_id, asset_type);
CREATE INDEX idx_assets_criticality ON assets(organization_id, criticality);
CREATE INDEX idx_risks_org ON risk_items(organization_id);
CREATE INDEX idx_risks_status ON risk_items(organization_id, status);
CREATE INDEX idx_risks_priority ON risk_items(organization_id, context_priority_score DESC);
CREATE INDEX idx_vendors_org ON vendors(organization_id);
CREATE INDEX idx_vendors_tier ON vendors(organization_id, vendor_tier);
CREATE INDEX idx_vendor_incidents_vendor ON vendor_incidents(vendor_id);
CREATE INDEX idx_audit_logs_org ON audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_maturity_assessments_org ON maturity_assessments(organization_id);
CREATE INDEX idx_maturity_assessments_status ON maturity_assessments(organization_id, status);
CREATE INDEX idx_maturity_assessments_date ON maturity_assessments(organization_id, assessment_date DESC);
CREATE INDEX idx_maturity_responses_assessment ON maturity_responses(assessment_id);
CREATE INDEX idx_maturity_responses_category ON maturity_responses(assessment_id, category_id);
CREATE INDEX idx_maturity_category_scores_assessment ON maturity_category_scores(assessment_id);
CREATE INDEX idx_maturity_actions_assessment ON maturity_improvement_actions(assessment_id);
CREATE INDEX idx_maturity_actions_status ON maturity_improvement_actions(organization_id, status);
CREATE INDEX idx_pentest_sync_log_finding ON pentest_sync_log(source_finding_id);
CREATE INDEX idx_pentest_sync_log_date ON pentest_sync_log(synced_at);
CREATE INDEX idx_pentest_sync_log_status ON pentest_sync_log(status);
CREATE INDEX idx_risk_items_source ON risk_items(risk_source);
CREATE INDEX idx_risk_items_external_ref ON risk_items(external_reference);
CREATE INDEX idx_control_library_framework ON control_library(framework_id);
CREATE INDEX idx_control_library_category ON control_library(category);
CREATE INDEX idx_control_assessments_org ON control_assessments(organization_id);
CREATE INDEX idx_control_assessments_control ON control_assessments(control_library_id);
CREATE INDEX idx_control_assessments_status ON control_assessments(implementation_status);
CREATE INDEX idx_control_mappings_source ON control_mappings(source_framework_id, source_control_id);
CREATE INDEX idx_control_mappings_target ON control_mappings(target_framework_id, target_control_id);
CREATE INDEX idx_compliance_scores_org ON compliance_scores(organization_id);
CREATE INDEX idx_org_applicability ON org_framework_applicability(organization_id);
CREATE INDEX idx_compliance_snapshots_org_fw_date 
ON compliance_snapshots(organization_id, framework_id, snapshot_date);
CREATE INDEX idx_domain_snapshots_org_date 
ON domain_snapshots(organization_id, snapshot_date);
CREATE INDEX idx_risk_snapshots_org_date 
ON risk_snapshots(organization_id, snapshot_date);
CREATE INDEX idx_crm_org_control ON control_risk_mappings(organization_id, control_id);
CREATE INDEX idx_crm_org_risk ON control_risk_mappings(organization_id, risk_id);
CREATE INDEX idx_crm_mapping_type ON control_risk_mappings(mapping_type);
CREATE INDEX idx_cam_org_control ON control_asset_mappings(organization_id, control_id);
CREATE INDEX idx_cam_org_asset ON control_asset_mappings(organization_id, asset_id);
CREATE INDEX idx_ram_org_risk ON risk_asset_mappings(organization_id, risk_id);
CREATE INDEX idx_ram_org_asset ON risk_asset_mappings(organization_id, asset_id);
CREATE INDEX idx_audit_programs_org ON audit_programs(organization_id);
CREATE INDEX idx_audit_programs_year ON audit_programs(year);
CREATE INDEX idx_audit_engagements_org ON audit_engagements(organization_id);
CREATE INDEX idx_audit_engagements_program ON audit_engagements(program_id);
CREATE INDEX idx_audit_engagements_status ON audit_engagements(status);
CREATE INDEX idx_audit_findings_org ON audit_findings(organization_id);
CREATE INDEX idx_audit_findings_engagement ON audit_findings(engagement_id);
CREATE INDEX idx_audit_findings_status ON audit_findings(status);
CREATE INDEX idx_audit_findings_severity ON audit_findings(severity);
CREATE INDEX idx_audit_findings_risk ON audit_findings(related_risk_id);
CREATE VIEW pentest_risks_view AS
SELECT 
    r.id,
    r.organization_id,
    r.title,
    r.description,
    r.category,
    r.subcategory,
    r.inherent_likelihood,
    r.inherent_impact,
    r.inherent_score,
    r.context_priority_score,
    r.status,
    r.remediation_plan,
    r.due_date,
    r.external_reference,
    r.ai_analysis,
    r.discovered_at,
    r.created_at,
    r.updated_at,
    a.name as asset_name,
    a.asset_type,
    a.criticality as asset_criticality,
    
    CASE 
        WHEN r.external_reference LIKE 'pentest:%' 
        THEN substr(r.external_reference, 9, instr(r.external_reference, '|') - 9)
        ELSE NULL 
    END as source_finding_id,
    CASE 
        WHEN r.external_reference LIKE '%project:%' 
        THEN substr(
            r.external_reference, 
            instr(r.external_reference, 'project:') + 8,
            instr(substr(r.external_reference, instr(r.external_reference, 'project:')), '|') - 9
        )
        ELSE NULL 
    END as source_project_code
FROM risk_items r
LEFT JOIN assets a ON r.affected_asset_id = a.id
WHERE r.risk_source = 'penetration_test';
CREATE VIEW pentest_sync_stats AS
SELECT 
    organization_id,
    COUNT(*) as total_risks,
    SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_count,
    SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_count,
    SUM(CASE WHEN status = 'mitigated' THEN 1 ELSE 0 END) as mitigated_count,
    SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_count,
    SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted_count,
    SUM(CASE WHEN inherent_score >= 80 THEN 1 ELSE 0 END) as critical_count,
    SUM(CASE WHEN inherent_score >= 60 AND inherent_score < 80 THEN 1 ELSE 0 END) as high_count,
    SUM(CASE WHEN inherent_score >= 30 AND inherent_score < 60 THEN 1 ELSE 0 END) as medium_count,
    SUM(CASE WHEN inherent_score < 30 THEN 1 ELSE 0 END) as low_count,
    MAX(updated_at) as last_sync_at,
    MIN(created_at) as first_sync_at
FROM risk_items
WHERE risk_source = 'penetration_test'
GROUP BY organization_id;
