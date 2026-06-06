-- =====================================================
-- PHASE 2: FRAMEWORK CONTROL MAPPINGS
-- Maps ISO 27001:2022 controls to NIST CSF, PCI-DSS, SOC2, GDPR
-- =====================================================

-- First, add controls for other frameworks
-- NIST CSF 2.0 Categories (organize by function)
INSERT OR IGNORE INTO control_library (id, framework_id, control_id, title, description, category, subcategory, guidance, is_critical)
VALUES
-- GOVERN Function
('nist-gv.oc-01', 'fw-nist-csf', 'GV.OC-01', 'Organizational Context', 'The circumstances surrounding the organizations cybersecurity risk management decisions are understood', 'Govern', 'Organizational Context', 'Document business context, mission, stakeholders', 1),
('nist-gv.rm-01', 'fw-nist-csf', 'GV.RM-01', 'Risk Management Strategy', 'Risk management objectives are established and communicated', 'Govern', 'Risk Management Strategy', 'Establish risk appetite and tolerance', 1),
('nist-gv.rm-02', 'fw-nist-csf', 'GV.RM-02', 'Risk Management Priorities', 'Risk appetite and risk tolerance statements are established, communicated, and maintained', 'Govern', 'Risk Management Strategy', 'Document risk thresholds', 1),
('nist-gv.rr-01', 'fw-nist-csf', 'GV.RR-01', 'Roles and Responsibilities', 'Organizational leadership is responsible and accountable for cybersecurity risk', 'Govern', 'Roles and Responsibilities', 'Define cybersecurity roles', 1),
('nist-gv.po-01', 'fw-nist-csf', 'GV.PO-01', 'Cybersecurity Policy', 'Policy for managing cybersecurity risks is established based on organizational context', 'Govern', 'Policy', 'Develop cybersecurity policies', 1),
('nist-gv.sc-01', 'fw-nist-csf', 'GV.SC-01', 'Supply Chain Risk Management', 'Cyber supply chain risk management processes are identified and managed', 'Govern', 'Supply Chain Risk Management', 'Manage third-party risks', 1),
-- IDENTIFY Function
('nist-id.am-01', 'fw-nist-csf', 'ID.AM-01', 'Asset Inventory', 'Inventories of hardware managed by the organization are maintained', 'Identify', 'Asset Management', 'Maintain hardware asset inventory', 1),
('nist-id.am-02', 'fw-nist-csf', 'ID.AM-02', 'Software Inventory', 'Inventories of software, services, and systems are maintained', 'Identify', 'Asset Management', 'Maintain software asset inventory', 1),
('nist-id.am-03', 'fw-nist-csf', 'ID.AM-03', 'Data Inventory', 'Network communication and data flows are maintained', 'Identify', 'Asset Management', 'Document data flows', 1),
('nist-id.am-07', 'fw-nist-csf', 'ID.AM-07', 'Asset Criticality', 'Inventories of services provided by suppliers are maintained', 'Identify', 'Asset Management', 'Classify asset criticality', 1),
('nist-id.ra-01', 'fw-nist-csf', 'ID.RA-01', 'Vulnerability Identification', 'Vulnerabilities in assets are identified, validated, and recorded', 'Identify', 'Risk Assessment', 'Perform vulnerability assessments', 1),
('nist-id.ra-02', 'fw-nist-csf', 'ID.RA-02', 'Threat Intelligence', 'Cyber threat intelligence is received from information sharing forums', 'Identify', 'Risk Assessment', 'Monitor threat intelligence', 0),
('nist-id.ra-05', 'fw-nist-csf', 'ID.RA-05', 'Risk Assessment', 'Threats and vulnerabilities are used to understand inherent risk', 'Identify', 'Risk Assessment', 'Conduct risk assessments', 1),
('nist-id.im-01', 'fw-nist-csf', 'ID.IM-01', 'Improvement Identification', 'Improvements are identified from security tests and exercises', 'Identify', 'Improvement', 'Conduct security testing', 0),
-- PROTECT Function
('nist-pr.aa-01', 'fw-nist-csf', 'PR.AA-01', 'Identity Management', 'Identities and credentials for authorized users are managed', 'Protect', 'Identity Management', 'Manage identities', 1),
('nist-pr.aa-02', 'fw-nist-csf', 'PR.AA-02', 'Authentication', 'Identities are proofed and bound to credentials', 'Protect', 'Identity Management', 'Implement authentication', 1),
('nist-pr.aa-03', 'fw-nist-csf', 'PR.AA-03', 'Access Provisioning', 'Users, services, and hardware are authenticated', 'Protect', 'Identity Management', 'Manage access provisioning', 1),
('nist-pr.aa-05', 'fw-nist-csf', 'PR.AA-05', 'Access Control', 'Access permissions, entitlements, and authorizations are defined', 'Protect', 'Identity Management', 'Implement access controls', 1),
('nist-pr.at-01', 'fw-nist-csf', 'PR.AT-01', 'Security Awareness', 'Personnel are provided awareness and training', 'Protect', 'Awareness and Training', 'Conduct security training', 1),
('nist-pr.at-02', 'fw-nist-csf', 'PR.AT-02', 'Privileged Users Training', 'Individuals in specialized roles are provided training', 'Protect', 'Awareness and Training', 'Train privileged users', 0),
('nist-pr.ds-01', 'fw-nist-csf', 'PR.DS-01', 'Data Protection', 'The confidentiality and integrity of data-at-rest are protected', 'Protect', 'Data Security', 'Protect data at rest', 1),
('nist-pr.ds-02', 'fw-nist-csf', 'PR.DS-02', 'Data in Transit', 'The confidentiality and integrity of data-in-transit are protected', 'Protect', 'Data Security', 'Protect data in transit', 1),
('nist-pr.ds-10', 'fw-nist-csf', 'PR.DS-10', 'Data Integrity', 'The confidentiality and integrity of data-in-use are protected', 'Protect', 'Data Security', 'Protect data in use', 1),
('nist-pr.ps-01', 'fw-nist-csf', 'PR.PS-01', 'Configuration Management', 'Configuration management practices are established', 'Protect', 'Platform Security', 'Manage configurations', 1),
('nist-pr.ps-02', 'fw-nist-csf', 'PR.PS-02', 'Software Maintenance', 'Software is maintained, replaced, and removed', 'Protect', 'Platform Security', 'Maintain software', 1),
('nist-pr.ps-04', 'fw-nist-csf', 'PR.PS-04', 'Log Management', 'Log records are generated and made available', 'Protect', 'Platform Security', 'Implement logging', 1),
('nist-pr.ir-01', 'fw-nist-csf', 'PR.IR-01', 'Incident Response', 'Incident response plans are established and maintained', 'Protect', 'Infrastructure Resilience', 'Plan incident response', 1),
('nist-pr.ir-02', 'fw-nist-csf', 'PR.IR-02', 'Backup Recovery', 'Backup and recovery data are maintained and tested', 'Protect', 'Infrastructure Resilience', 'Implement backup/recovery', 1),
-- DETECT Function
('nist-de.cm-01', 'fw-nist-csf', 'DE.CM-01', 'Network Monitoring', 'Networks are monitored to find potentially adverse events', 'Detect', 'Continuous Monitoring', 'Monitor networks', 1),
('nist-de.cm-02', 'fw-nist-csf', 'DE.CM-02', 'Physical Environment Monitoring', 'The physical environment is monitored', 'Detect', 'Continuous Monitoring', 'Monitor physical environment', 0),
('nist-de.cm-03', 'fw-nist-csf', 'DE.CM-03', 'Personnel Activity Monitoring', 'Personnel activity and technology usage are monitored', 'Detect', 'Continuous Monitoring', 'Monitor user activity', 0),
('nist-de.cm-06', 'fw-nist-csf', 'DE.CM-06', 'External Service Monitoring', 'External service provider activity is monitored', 'Detect', 'Continuous Monitoring', 'Monitor third parties', 0),
('nist-de.cm-09', 'fw-nist-csf', 'DE.CM-09', 'Computing Hardware Monitoring', 'Computing hardware and software are monitored', 'Detect', 'Continuous Monitoring', 'Monitor endpoints', 1),
('nist-de.ae-02', 'fw-nist-csf', 'DE.AE-02', 'Event Analysis', 'Potentially adverse events are analyzed', 'Detect', 'Adverse Event Analysis', 'Analyze security events', 1),
('nist-de.ae-06', 'fw-nist-csf', 'DE.AE-06', 'Event Correlation', 'Information on adverse events is correlated', 'Detect', 'Adverse Event Analysis', 'Correlate events', 0),
-- RESPOND Function
('nist-rs.ma-01', 'fw-nist-csf', 'RS.MA-01', 'Incident Management', 'The incident response plan is executed', 'Respond', 'Incident Management', 'Execute IR plan', 1),
('nist-rs.ma-02', 'fw-nist-csf', 'RS.MA-02', 'Incident Triage', 'Incident reports are triaged and validated', 'Respond', 'Incident Management', 'Triage incidents', 1),
('nist-rs.ma-03', 'fw-nist-csf', 'RS.MA-03', 'Incident Categorization', 'Incidents are categorized and prioritized', 'Respond', 'Incident Management', 'Categorize incidents', 0),
('nist-rs.an-03', 'fw-nist-csf', 'RS.AN-03', 'Forensic Analysis', 'Analysis is performed to establish what has taken place', 'Respond', 'Incident Analysis', 'Conduct forensics', 0),
('nist-rs.an-06', 'fw-nist-csf', 'RS.AN-06', 'Root Cause Analysis', 'Actions performed during investigation are recorded', 'Respond', 'Incident Analysis', 'Document investigations', 0),
('nist-rs.co-02', 'fw-nist-csf', 'RS.CO-02', 'Incident Communication', 'Stakeholders are notified of incidents', 'Respond', 'Incident Communication', 'Notify stakeholders', 1),
('nist-rs.mi-01', 'fw-nist-csf', 'RS.MI-01', 'Incident Containment', 'Incidents are contained', 'Respond', 'Incident Mitigation', 'Contain incidents', 1),
('nist-rs.mi-02', 'fw-nist-csf', 'RS.MI-02', 'Incident Eradication', 'Incidents are eradicated', 'Respond', 'Incident Mitigation', 'Eradicate threats', 1),
-- RECOVER Function
('nist-rc.rp-01', 'fw-nist-csf', 'RC.RP-01', 'Recovery Execution', 'The recovery portion of the incident response plan is executed', 'Recover', 'Recovery Execution', 'Execute recovery', 1),
('nist-rc.rp-03', 'fw-nist-csf', 'RC.RP-03', 'Backup Recovery', 'The integrity of backups is verified', 'Recover', 'Recovery Execution', 'Verify backups', 1),
('nist-rc.rp-05', 'fw-nist-csf', 'RC.RP-05', 'Post-Incident Review', 'Systems and services are restored', 'Recover', 'Recovery Execution', 'Verify restoration', 0),
('nist-rc.co-03', 'fw-nist-csf', 'RC.CO-03', 'Recovery Communication', 'Recovery activities and progress are communicated', 'Recover', 'Recovery Communication', 'Communicate recovery', 0);

-- PCI-DSS v4.0 Requirements
INSERT OR IGNORE INTO control_library (id, framework_id, control_id, title, description, category, subcategory, guidance, is_critical)
VALUES
('pci-1.1', 'fw-pci-dss', '1.1', 'Network Security Policies', 'Processes for installing and maintaining network security controls are defined', 'Build Secure Network', 'Network Security Controls', 'Document network security controls', 1),
('pci-1.2', 'fw-pci-dss', '1.2', 'NSC Configuration Standards', 'Network security controls are configured and maintained', 'Build Secure Network', 'Network Security Controls', 'Configure network security', 1),
('pci-1.3', 'fw-pci-dss', '1.3', 'Network Access Restriction', 'Network access to and from the CDE is restricted', 'Build Secure Network', 'Network Security Controls', 'Restrict CDE access', 1),
('pci-1.4', 'fw-pci-dss', '1.4', 'Trusted Network Connections', 'Connections between trusted and untrusted networks are controlled', 'Build Secure Network', 'Network Security Controls', 'Control network connections', 1),
('pci-2.1', 'fw-pci-dss', '2.1', 'Secure Configuration Processes', 'Processes for applying secure configurations are defined', 'Build Secure Network', 'Secure Configurations', 'Document secure configurations', 1),
('pci-2.2', 'fw-pci-dss', '2.2', 'System Configuration Standards', 'System components are configured and managed securely', 'Build Secure Network', 'Secure Configurations', 'Implement secure configurations', 1),
('pci-3.1', 'fw-pci-dss', '3.1', 'Account Data Protection Processes', 'Processes for protecting stored account data are defined', 'Protect Account Data', 'Stored Account Data', 'Document data protection', 1),
('pci-3.2', 'fw-pci-dss', '3.2', 'Storage Limitation', 'Storage of account data is kept to a minimum', 'Protect Account Data', 'Stored Account Data', 'Minimize data storage', 1),
('pci-3.3', 'fw-pci-dss', '3.3', 'SAD Protection', 'Sensitive authentication data is not stored after authorization', 'Protect Account Data', 'Stored Account Data', 'Prevent SAD storage', 1),
('pci-3.4', 'fw-pci-dss', '3.4', 'PAN Display Restriction', 'Access to displays of full PAN is restricted', 'Protect Account Data', 'Stored Account Data', 'Restrict PAN display', 1),
('pci-3.5', 'fw-pci-dss', '3.5', 'PAN Protection', 'PAN is secured wherever it is stored', 'Protect Account Data', 'Stored Account Data', 'Secure stored PAN', 1),
('pci-3.6', 'fw-pci-dss', '3.6', 'Key Management', 'Cryptographic keys are secured', 'Protect Account Data', 'Stored Account Data', 'Manage encryption keys', 1),
('pci-4.1', 'fw-pci-dss', '4.1', 'Transmission Protection Processes', 'Processes for protecting cardholder data during transmission are defined', 'Protect Account Data', 'Data in Transit', 'Document transmission security', 1),
('pci-4.2', 'fw-pci-dss', '4.2', 'PAN Protection in Transit', 'PAN is protected with strong cryptography during transmission', 'Protect Account Data', 'Data in Transit', 'Encrypt PAN in transit', 1),
('pci-5.1', 'fw-pci-dss', '5.1', 'Malware Protection Processes', 'Processes for protecting from malware are defined', 'Vulnerability Management', 'Malware Protection', 'Document malware protection', 1),
('pci-5.2', 'fw-pci-dss', '5.2', 'Anti-Malware Deployment', 'Malware is prevented, detected and addressed', 'Vulnerability Management', 'Malware Protection', 'Deploy anti-malware', 1),
('pci-5.3', 'fw-pci-dss', '5.3', 'Anti-Malware Mechanisms', 'Anti-malware mechanisms are active and maintained', 'Vulnerability Management', 'Malware Protection', 'Maintain anti-malware', 1),
('pci-6.1', 'fw-pci-dss', '6.1', 'Secure Development Processes', 'Processes for developing secure systems are defined', 'Vulnerability Management', 'Secure Development', 'Document SDLC security', 1),
('pci-6.2', 'fw-pci-dss', '6.2', 'Bespoke Software Security', 'Custom software is developed securely', 'Vulnerability Management', 'Secure Development', 'Secure custom software', 1),
('pci-6.3', 'fw-pci-dss', '6.3', 'Security Vulnerabilities', 'Security vulnerabilities are identified and addressed', 'Vulnerability Management', 'Secure Development', 'Manage vulnerabilities', 1),
('pci-6.4', 'fw-pci-dss', '6.4', 'Web Application Security', 'Web applications are protected against attacks', 'Vulnerability Management', 'Secure Development', 'Secure web apps', 1),
('pci-6.5', 'fw-pci-dss', '6.5', 'Change Management', 'Changes are managed securely', 'Vulnerability Management', 'Secure Development', 'Manage changes', 1),
('pci-7.1', 'fw-pci-dss', '7.1', 'Access Control Processes', 'Processes for restricting access are defined', 'Access Control', 'Restrict Access', 'Document access control', 1),
('pci-7.2', 'fw-pci-dss', '7.2', 'Access Establishment', 'Access is appropriately defined and assigned', 'Access Control', 'Restrict Access', 'Assign access appropriately', 1),
('pci-7.3', 'fw-pci-dss', '7.3', 'Access Systems', 'Access is managed via access control systems', 'Access Control', 'Restrict Access', 'Implement access systems', 1),
('pci-8.1', 'fw-pci-dss', '8.1', 'User Identification Processes', 'Processes for identifying users are defined', 'Access Control', 'User Authentication', 'Document ID management', 1),
('pci-8.2', 'fw-pci-dss', '8.2', 'User Identification', 'User identification is strictly managed', 'Access Control', 'User Authentication', 'Manage user IDs', 1),
('pci-8.3', 'fw-pci-dss', '8.3', 'Strong Authentication', 'Strong authentication is established', 'Access Control', 'User Authentication', 'Implement strong auth', 1),
('pci-8.4', 'fw-pci-dss', '8.4', 'MFA Implementation', 'MFA is implemented for CDE access', 'Access Control', 'User Authentication', 'Deploy MFA', 1),
('pci-9.1', 'fw-pci-dss', '9.1', 'Physical Access Processes', 'Processes for restricting physical access are defined', 'Access Control', 'Physical Access', 'Document physical access', 1),
('pci-9.2', 'fw-pci-dss', '9.2', 'Physical Access Controls', 'Physical access controls manage entry', 'Access Control', 'Physical Access', 'Implement physical controls', 1),
('pci-9.4', 'fw-pci-dss', '9.4', 'Media Security', 'Media is securely stored and destroyed', 'Access Control', 'Physical Access', 'Secure media', 1),
('pci-10.1', 'fw-pci-dss', '10.1', 'Logging Processes', 'Processes for logging and monitoring are defined', 'Monitoring and Testing', 'Logging', 'Document logging', 1),
('pci-10.2', 'fw-pci-dss', '10.2', 'Audit Log Implementation', 'Audit logs are implemented', 'Monitoring and Testing', 'Logging', 'Implement audit logs', 1),
('pci-10.3', 'fw-pci-dss', '10.3', 'Audit Log Protection', 'Audit logs are protected', 'Monitoring and Testing', 'Logging', 'Protect audit logs', 1),
('pci-10.4', 'fw-pci-dss', '10.4', 'Audit Log Review', 'Audit logs are reviewed', 'Monitoring and Testing', 'Logging', 'Review audit logs', 1),
('pci-10.5', 'fw-pci-dss', '10.5', 'Audit Log History', 'Audit log history is retained', 'Monitoring and Testing', 'Logging', 'Retain audit logs', 1),
('pci-10.6', 'fw-pci-dss', '10.6', 'Time Synchronization', 'Time-synchronization is implemented', 'Monitoring and Testing', 'Logging', 'Synchronize time', 1),
('pci-11.1', 'fw-pci-dss', '11.1', 'Security Testing Processes', 'Processes for testing security are defined', 'Monitoring and Testing', 'Security Testing', 'Document security testing', 1),
('pci-11.3', 'fw-pci-dss', '11.3', 'Vulnerability Scanning', 'Vulnerabilities are regularly identified', 'Monitoring and Testing', 'Security Testing', 'Conduct vulnerability scans', 1),
('pci-11.4', 'fw-pci-dss', '11.4', 'Penetration Testing', 'Penetration testing is regularly performed', 'Monitoring and Testing', 'Security Testing', 'Perform penetration tests', 1),
('pci-11.5', 'fw-pci-dss', '11.5', 'Change Detection', 'Intrusions and file changes are detected', 'Monitoring and Testing', 'Security Testing', 'Detect changes/intrusions', 1),
('pci-12.1', 'fw-pci-dss', '12.1', 'Security Policy', 'A comprehensive security policy is established', 'Information Security Policy', 'Policy', 'Establish security policy', 1),
('pci-12.2', 'fw-pci-dss', '12.2', 'Acceptable Use', 'Acceptable use policies are implemented', 'Information Security Policy', 'Policy', 'Define acceptable use', 1),
('pci-12.3', 'fw-pci-dss', '12.3', 'Risk Assessment', 'Risks to the CDE are managed', 'Information Security Policy', 'Policy', 'Manage risks', 1),
('pci-12.4', 'fw-pci-dss', '12.4', 'PCI DSS Responsibilities', 'PCI DSS compliance is managed', 'Information Security Policy', 'Policy', 'Manage PCI compliance', 1),
('pci-12.5', 'fw-pci-dss', '12.5', 'PCI DSS Scope', 'PCI DSS scope is documented', 'Information Security Policy', 'Policy', 'Document scope', 1),
('pci-12.6', 'fw-pci-dss', '12.6', 'Security Awareness', 'Security awareness education is ongoing', 'Information Security Policy', 'Policy', 'Train employees', 1),
('pci-12.7', 'fw-pci-dss', '12.7', 'Personnel Screening', 'Personnel are screened', 'Information Security Policy', 'Policy', 'Screen personnel', 0),
('pci-12.8', 'fw-pci-dss', '12.8', 'Third-Party Risk', 'Third-party risks are managed', 'Information Security Policy', 'Policy', 'Manage third parties', 1),
('pci-12.10', 'fw-pci-dss', '12.10', 'Incident Response', 'Security incidents are responded to immediately', 'Information Security Policy', 'Policy', 'Respond to incidents', 1);

-- SOC 2 Trust Service Criteria
INSERT OR IGNORE INTO control_library (id, framework_id, control_id, title, description, category, subcategory, guidance, is_critical)
VALUES
('soc2-cc1.1', 'fw-soc2', 'CC1.1', 'Control Environment', 'The entity demonstrates commitment to integrity', 'Common Criteria', 'Control Environment', 'Establish tone at the top', 1),
('soc2-cc1.2', 'fw-soc2', 'CC1.2', 'Board Independence', 'Board demonstrates independence from management', 'Common Criteria', 'Control Environment', 'Ensure board independence', 0),
('soc2-cc1.3', 'fw-soc2', 'CC1.3', 'Organizational Structure', 'Management establishes structures and reporting lines', 'Common Criteria', 'Control Environment', 'Define organizational structure', 1),
('soc2-cc1.4', 'fw-soc2', 'CC1.4', 'Commitment to Competence', 'Entity demonstrates commitment to attract competent individuals', 'Common Criteria', 'Control Environment', 'Hire and develop talent', 1),
('soc2-cc1.5', 'fw-soc2', 'CC1.5', 'Accountability', 'Entity holds individuals accountable', 'Common Criteria', 'Control Environment', 'Enforce accountability', 1),
('soc2-cc2.1', 'fw-soc2', 'CC2.1', 'Internal Communication', 'Entity uses relevant quality information', 'Common Criteria', 'Communication and Information', 'Use quality information', 1),
('soc2-cc2.2', 'fw-soc2', 'CC2.2', 'Internal Information', 'Entity internally communicates information', 'Common Criteria', 'Communication and Information', 'Communicate internally', 1),
('soc2-cc2.3', 'fw-soc2', 'CC2.3', 'External Communication', 'Entity communicates with external parties', 'Common Criteria', 'Communication and Information', 'Communicate externally', 0),
('soc2-cc3.1', 'fw-soc2', 'CC3.1', 'Risk Objectives', 'Entity specifies objectives with sufficient clarity', 'Common Criteria', 'Risk Assessment', 'Define clear objectives', 1),
('soc2-cc3.2', 'fw-soc2', 'CC3.2', 'Risk Identification', 'Entity identifies risks to objectives', 'Common Criteria', 'Risk Assessment', 'Identify risks', 1),
('soc2-cc3.3', 'fw-soc2', 'CC3.3', 'Fraud Risk', 'Entity considers fraud in assessing risks', 'Common Criteria', 'Risk Assessment', 'Assess fraud risk', 0),
('soc2-cc3.4', 'fw-soc2', 'CC3.4', 'Change Management', 'Entity identifies and assesses changes', 'Common Criteria', 'Risk Assessment', 'Manage changes', 1),
('soc2-cc4.1', 'fw-soc2', 'CC4.1', 'Ongoing Evaluations', 'Entity performs ongoing evaluations', 'Common Criteria', 'Monitoring Activities', 'Perform ongoing evaluations', 1),
('soc2-cc4.2', 'fw-soc2', 'CC4.2', 'Deficiency Evaluation', 'Entity evaluates and communicates deficiencies', 'Common Criteria', 'Monitoring Activities', 'Address deficiencies', 1),
('soc2-cc5.1', 'fw-soc2', 'CC5.1', 'Control Selection', 'Entity selects and develops control activities', 'Common Criteria', 'Control Activities', 'Select controls', 1),
('soc2-cc5.2', 'fw-soc2', 'CC5.2', 'Technology Controls', 'Entity develops general controls over technology', 'Common Criteria', 'Control Activities', 'Implement technology controls', 1),
('soc2-cc5.3', 'fw-soc2', 'CC5.3', 'Policy Deployment', 'Entity deploys control activities through policies', 'Common Criteria', 'Control Activities', 'Deploy policies', 1),
('soc2-cc6.1', 'fw-soc2', 'CC6.1', 'Logical Access', 'Entity implements logical access security', 'Common Criteria', 'Logical and Physical Access', 'Implement access controls', 1),
('soc2-cc6.2', 'fw-soc2', 'CC6.2', 'Access Registration', 'Entity registers and authorizes users', 'Common Criteria', 'Logical and Physical Access', 'Register users', 1),
('soc2-cc6.3', 'fw-soc2', 'CC6.3', 'Access Removal', 'Entity removes access to protected assets', 'Common Criteria', 'Logical and Physical Access', 'Remove access', 1),
('soc2-cc6.4', 'fw-soc2', 'CC6.4', 'Access Review', 'Entity restricts physical access', 'Common Criteria', 'Logical and Physical Access', 'Restrict physical access', 0),
('soc2-cc6.5', 'fw-soc2', 'CC6.5', 'Asset Disposal', 'Entity discontinues protections over physical assets', 'Common Criteria', 'Logical and Physical Access', 'Dispose assets securely', 0),
('soc2-cc6.6', 'fw-soc2', 'CC6.6', 'Boundary Protection', 'Entity implements logical access security measures', 'Common Criteria', 'Logical and Physical Access', 'Protect boundaries', 1),
('soc2-cc6.7', 'fw-soc2', 'CC6.7', 'Transmission Protection', 'Entity restricts transmission of information', 'Common Criteria', 'Logical and Physical Access', 'Protect data transmission', 1),
('soc2-cc6.8', 'fw-soc2', 'CC6.8', 'Malware Prevention', 'Entity implements controls to prevent malware', 'Common Criteria', 'Logical and Physical Access', 'Prevent malware', 1),
('soc2-cc7.1', 'fw-soc2', 'CC7.1', 'Configuration Management', 'Entity uses detection and monitoring procedures', 'Common Criteria', 'System Operations', 'Manage configurations', 1),
('soc2-cc7.2', 'fw-soc2', 'CC7.2', 'Security Monitoring', 'Entity monitors system components', 'Common Criteria', 'System Operations', 'Monitor systems', 1),
('soc2-cc7.3', 'fw-soc2', 'CC7.3', 'Event Analysis', 'Entity evaluates security events', 'Common Criteria', 'System Operations', 'Analyze events', 1),
('soc2-cc7.4', 'fw-soc2', 'CC7.4', 'Incident Response', 'Entity responds to identified security incidents', 'Common Criteria', 'System Operations', 'Respond to incidents', 1),
('soc2-cc7.5', 'fw-soc2', 'CC7.5', 'Incident Recovery', 'Entity recovers from identified security incidents', 'Common Criteria', 'System Operations', 'Recover from incidents', 1),
('soc2-cc8.1', 'fw-soc2', 'CC8.1', 'Change Management Process', 'Entity authorizes and manages changes', 'Common Criteria', 'Change Management', 'Manage system changes', 1),
('soc2-cc9.1', 'fw-soc2', 'CC9.1', 'Risk Mitigation', 'Entity identifies and develops risk mitigation', 'Common Criteria', 'Risk Mitigation', 'Mitigate risks', 1),
('soc2-cc9.2', 'fw-soc2', 'CC9.2', 'Third-Party Risk', 'Entity assesses risks associated with vendors', 'Common Criteria', 'Risk Mitigation', 'Manage vendor risk', 1),
('soc2-a1.1', 'fw-soc2', 'A1.1', 'Capacity Management', 'Entity maintains and monitors processing capacity', 'Availability', 'System Availability', 'Manage capacity', 1),
('soc2-a1.2', 'fw-soc2', 'A1.2', 'Environmental Protections', 'Entity implements environmental protections', 'Availability', 'System Availability', 'Implement environmental controls', 0),
('soc2-a1.3', 'fw-soc2', 'A1.3', 'Recovery Procedures', 'Entity tests recovery plan procedures', 'Availability', 'System Availability', 'Test recovery procedures', 1),
('soc2-c1.1', 'fw-soc2', 'C1.1', 'Confidential Information', 'Entity identifies and maintains confidential information', 'Confidentiality', 'Protection of Confidential Information', 'Identify confidential data', 1),
('soc2-c1.2', 'fw-soc2', 'C1.2', 'Disposal of Confidential Information', 'Entity disposes of confidential information', 'Confidentiality', 'Protection of Confidential Information', 'Dispose confidential data', 0),
('soc2-pi1.1', 'fw-soc2', 'PI1.1', 'Processing Definition', 'Entity uses relevant quality information', 'Processing Integrity', 'System Processing', 'Define processing requirements', 1),
('soc2-pi1.2', 'fw-soc2', 'PI1.2', 'Input Validation', 'Entity implements policies over system inputs', 'Processing Integrity', 'System Processing', 'Validate inputs', 1),
('soc2-pi1.3', 'fw-soc2', 'PI1.3', 'Processing Accuracy', 'Entity implements policies over system processing', 'Processing Integrity', 'System Processing', 'Ensure processing accuracy', 1),
('soc2-p1.1', 'fw-soc2', 'P1.1', 'Privacy Notice', 'Entity provides notice about privacy practices', 'Privacy', 'Privacy Notice', 'Provide privacy notice', 1),
('soc2-p2.1', 'fw-soc2', 'P2.1', 'Consent', 'Entity communicates choices about data use', 'Privacy', 'Choice and Consent', 'Obtain consent', 1),
('soc2-p3.1', 'fw-soc2', 'P3.1', 'Collection Limitation', 'Entity collects data only for identified purposes', 'Privacy', 'Collection', 'Limit collection', 1),
('soc2-p4.1', 'fw-soc2', 'P4.1', 'Use Limitation', 'Entity limits use of personal information', 'Privacy', 'Use, Retention, and Disposal', 'Limit use', 1),
('soc2-p5.1', 'fw-soc2', 'P5.1', 'Data Subject Access', 'Entity grants data subjects access to their data', 'Privacy', 'Access', 'Provide data access', 1),
('soc2-p6.1', 'fw-soc2', 'P6.1', 'Third-Party Disclosure', 'Entity discloses data only for identified purposes', 'Privacy', 'Disclosure to Third Parties', 'Limit disclosure', 1),
('soc2-p8.1', 'fw-soc2', 'P8.1', 'Privacy Monitoring', 'Entity monitors compliance with privacy commitments', 'Privacy', 'Monitoring and Enforcement', 'Monitor privacy compliance', 1);

-- GDPR Key Articles
INSERT OR IGNORE INTO control_library (id, framework_id, control_id, title, description, category, subcategory, guidance, is_critical)
VALUES
('gdpr-5.1', 'fw-gdpr', 'Art.5.1', 'Data Processing Principles', 'Personal data shall be processed lawfully, fairly and transparently', 'Principles', 'Lawfulness', 'Ensure lawful processing', 1),
('gdpr-5.2', 'fw-gdpr', 'Art.5.2', 'Accountability', 'Controller shall demonstrate compliance', 'Principles', 'Accountability', 'Demonstrate compliance', 1),
('gdpr-6', 'fw-gdpr', 'Art.6', 'Lawfulness of Processing', 'Processing shall be lawful with legal basis', 'Principles', 'Legal Basis', 'Establish legal basis', 1),
('gdpr-7', 'fw-gdpr', 'Art.7', 'Conditions for Consent', 'Controller shall demonstrate consent', 'Principles', 'Consent', 'Demonstrate consent', 1),
('gdpr-9', 'fw-gdpr', 'Art.9', 'Special Categories', 'Processing of special categories shall be prohibited except...', 'Principles', 'Special Categories', 'Protect special categories', 1),
('gdpr-12', 'fw-gdpr', 'Art.12', 'Transparent Information', 'Controller shall provide information in a concise manner', 'Data Subject Rights', 'Transparency', 'Provide clear information', 1),
('gdpr-13', 'fw-gdpr', 'Art.13', 'Information at Collection', 'Controller shall provide information when collecting data', 'Data Subject Rights', 'Privacy Notice', 'Inform at collection', 1),
('gdpr-14', 'fw-gdpr', 'Art.14', 'Information Not From Subject', 'Controller shall provide info for indirect collection', 'Data Subject Rights', 'Privacy Notice', 'Inform for indirect collection', 0),
('gdpr-15', 'fw-gdpr', 'Art.15', 'Right of Access', 'Data subject has right to obtain confirmation', 'Data Subject Rights', 'Access', 'Provide data access', 1),
('gdpr-16', 'fw-gdpr', 'Art.16', 'Right to Rectification', 'Data subject has right to rectification', 'Data Subject Rights', 'Rectification', 'Enable data correction', 1),
('gdpr-17', 'fw-gdpr', 'Art.17', 'Right to Erasure', 'Data subject has right to erasure', 'Data Subject Rights', 'Erasure', 'Enable data deletion', 1),
('gdpr-18', 'fw-gdpr', 'Art.18', 'Right to Restriction', 'Data subject has right to restriction', 'Data Subject Rights', 'Restriction', 'Enable processing restriction', 0),
('gdpr-20', 'fw-gdpr', 'Art.20', 'Right to Data Portability', 'Data subject has right to receive data', 'Data Subject Rights', 'Portability', 'Enable data portability', 1),
('gdpr-21', 'fw-gdpr', 'Art.21', 'Right to Object', 'Data subject has right to object', 'Data Subject Rights', 'Objection', 'Handle objections', 1),
('gdpr-22', 'fw-gdpr', 'Art.22', 'Automated Decision-Making', 'Data subject has right regarding automated decisions', 'Data Subject Rights', 'Automated Decisions', 'Address automated decisions', 0),
('gdpr-24', 'fw-gdpr', 'Art.24', 'Controller Responsibility', 'Controller shall implement appropriate measures', 'Controller/Processor', 'Controller Obligations', 'Implement appropriate measures', 1),
('gdpr-25', 'fw-gdpr', 'Art.25', 'Data Protection by Design', 'Controller shall implement data protection by design', 'Controller/Processor', 'Privacy by Design', 'Design for privacy', 1),
('gdpr-28', 'fw-gdpr', 'Art.28', 'Processor', 'Controller shall use only adequate processors', 'Controller/Processor', 'Processor Requirements', 'Manage processors', 1),
('gdpr-30', 'fw-gdpr', 'Art.30', 'Records of Processing', 'Controller shall maintain records of processing', 'Controller/Processor', 'Records', 'Maintain processing records', 1),
('gdpr-32', 'fw-gdpr', 'Art.32', 'Security of Processing', 'Controller shall implement appropriate security measures', 'Controller/Processor', 'Security', 'Implement security measures', 1),
('gdpr-33', 'fw-gdpr', 'Art.33', 'Breach Notification to Authority', 'Controller shall notify authority of breaches', 'Controller/Processor', 'Breach Notification', 'Notify authority of breaches', 1),
('gdpr-34', 'fw-gdpr', 'Art.34', 'Breach Communication to Subject', 'Controller shall communicate high-risk breaches to subjects', 'Controller/Processor', 'Breach Notification', 'Notify subjects of breaches', 1),
('gdpr-35', 'fw-gdpr', 'Art.35', 'Data Protection Impact Assessment', 'Controller shall carry out DPIA for high-risk processing', 'Controller/Processor', 'DPIA', 'Conduct DPIAs', 1),
('gdpr-37', 'fw-gdpr', 'Art.37', 'Data Protection Officer', 'Controller shall designate DPO when required', 'Controller/Processor', 'DPO', 'Appoint DPO if required', 0),
('gdpr-44', 'fw-gdpr', 'Art.44', 'Transfer Principles', 'Transfers to third countries shall comply with conditions', 'International Transfers', 'General Principle', 'Ensure lawful transfers', 1),
('gdpr-46', 'fw-gdpr', 'Art.46', 'Appropriate Safeguards', 'Controller may transfer with appropriate safeguards', 'International Transfers', 'Safeguards', 'Implement transfer safeguards', 1);

-- =====================================================
-- CONTROL MAPPINGS: ISO 27001 -> Other Frameworks
-- =====================================================

-- Clear existing mappings
DELETE FROM control_mappings WHERE source_framework_id = 'fw-iso27001';

-- ISO 27001 A.5 (Organizational) -> NIST CSF, PCI-DSS, SOC2, GDPR
INSERT INTO control_mappings (id, source_framework_id, source_control_id, target_framework_id, target_control_id, mapping_type, notes) VALUES
-- A.5.1 Policies for information security
('map-5.1-nist-gv', 'fw-iso27001', 'iso-5.1', 'fw-nist-csf', 'nist-gv.po-01', 'equivalent', 'Both require establishing security policies'),
('map-5.1-pci-12', 'fw-iso27001', 'iso-5.1', 'fw-pci-dss', 'pci-12.1', 'equivalent', 'Both require comprehensive security policy'),
('map-5.1-soc2', 'fw-iso27001', 'iso-5.1', 'fw-soc2', 'soc2-cc5.3', 'equivalent', 'Both require policy deployment'),
('map-5.1-gdpr', 'fw-iso27001', 'iso-5.1', 'fw-gdpr', 'gdpr-24', 'partial', 'GDPR requires appropriate measures'),
-- A.5.2 Information security roles
('map-5.2-nist', 'fw-iso27001', 'iso-5.2', 'fw-nist-csf', 'nist-gv.rr-01', 'equivalent', 'Both require defining security roles'),
('map-5.2-soc2', 'fw-iso27001', 'iso-5.2', 'fw-soc2', 'soc2-cc1.3', 'equivalent', 'Both require organizational structure'),
-- A.5.3 Segregation of duties
('map-5.3-pci', 'fw-iso27001', 'iso-5.3', 'fw-pci-dss', 'pci-7.2', 'partial', 'PCI requires appropriate access'),
('map-5.3-soc2', 'fw-iso27001', 'iso-5.3', 'fw-soc2', 'soc2-cc5.1', 'partial', 'SOC2 requires control selection'),
-- A.5.4 Management responsibilities
('map-5.4-soc2', 'fw-iso27001', 'iso-5.4', 'fw-soc2', 'soc2-cc1.1', 'equivalent', 'Both require management commitment'),
('map-5.4-gdpr', 'fw-iso27001', 'iso-5.4', 'fw-gdpr', 'gdpr-5.2', 'partial', 'GDPR accountability'),
-- A.5.5 Contact with authorities
('map-5.5-gdpr', 'fw-iso27001', 'iso-5.5', 'fw-gdpr', 'gdpr-33', 'partial', 'GDPR requires notification'),
-- A.5.7 Threat intelligence
('map-5.7-nist', 'fw-iso27001', 'iso-5.7', 'fw-nist-csf', 'nist-id.ra-02', 'equivalent', 'Both require threat intelligence'),
-- A.5.8 Security in project management
('map-5.8-pci', 'fw-iso27001', 'iso-5.8', 'fw-pci-dss', 'pci-6.1', 'partial', 'PCI requires secure development'),
('map-5.8-soc2', 'fw-iso27001', 'iso-5.8', 'fw-soc2', 'soc2-cc8.1', 'partial', 'SOC2 requires change management'),
-- A.5.9 Inventory of information
('map-5.9-nist', 'fw-iso27001', 'iso-5.9', 'fw-nist-csf', 'nist-id.am-02', 'equivalent', 'Both require asset inventory'),
('map-5.9-pci', 'fw-iso27001', 'iso-5.9', 'fw-pci-dss', 'pci-12.5', 'partial', 'PCI requires scope documentation'),
('map-5.9-soc2', 'fw-iso27001', 'iso-5.9', 'fw-soc2', 'soc2-cc6.1', 'partial', 'SOC2 requires logical access'),
('map-5.9-gdpr', 'fw-iso27001', 'iso-5.9', 'fw-gdpr', 'gdpr-30', 'partial', 'GDPR requires records'),
-- A.5.10 Acceptable use
('map-5.10-pci', 'fw-iso27001', 'iso-5.10', 'fw-pci-dss', 'pci-12.2', 'equivalent', 'Both require acceptable use policies'),
('map-5.10-soc2', 'fw-iso27001', 'iso-5.10', 'fw-soc2', 'soc2-cc1.4', 'partial', 'SOC2 requires competence'),
-- A.5.12 Classification of information
('map-5.12-nist', 'fw-iso27001', 'iso-5.12', 'fw-nist-csf', 'nist-id.am-07', 'partial', 'NIST requires asset criticality'),
('map-5.12-pci', 'fw-iso27001', 'iso-5.12', 'fw-pci-dss', 'pci-3.1', 'partial', 'PCI requires data classification'),
('map-5.12-soc2', 'fw-iso27001', 'iso-5.12', 'fw-soc2', 'soc2-c1.1', 'equivalent', 'Both require identifying confidential info'),
('map-5.12-gdpr', 'fw-iso27001', 'iso-5.12', 'fw-gdpr', 'gdpr-9', 'partial', 'GDPR requires special category'),
-- A.5.14 Information transfer
('map-5.14-nist', 'fw-iso27001', 'iso-5.14', 'fw-nist-csf', 'nist-pr.ds-02', 'equivalent', 'Both require data-in-transit protection'),
('map-5.14-pci', 'fw-iso27001', 'iso-5.14', 'fw-pci-dss', 'pci-4.2', 'equivalent', 'Both require encryption in transit'),
('map-5.14-soc2', 'fw-iso27001', 'iso-5.14', 'fw-soc2', 'soc2-cc6.7', 'equivalent', 'Both require transmission protection'),
-- A.5.15 Access control
('map-5.15-nist', 'fw-iso27001', 'iso-5.15', 'fw-nist-csf', 'nist-pr.aa-05', 'equivalent', 'Both require access control'),
('map-5.15-pci', 'fw-iso27001', 'iso-5.15', 'fw-pci-dss', 'pci-7.1', 'equivalent', 'Both require access restriction'),
('map-5.15-soc2', 'fw-iso27001', 'iso-5.15', 'fw-soc2', 'soc2-cc6.1', 'equivalent', 'Both require logical access'),
-- A.5.16 Identity management
('map-5.16-nist', 'fw-iso27001', 'iso-5.16', 'fw-nist-csf', 'nist-pr.aa-01', 'equivalent', 'Both require identity management'),
('map-5.16-pci', 'fw-iso27001', 'iso-5.16', 'fw-pci-dss', 'pci-8.2', 'equivalent', 'Both require user identification'),
('map-5.16-soc2', 'fw-iso27001', 'iso-5.16', 'fw-soc2', 'soc2-cc6.2', 'equivalent', 'Both require user registration'),
-- A.5.17 Authentication information
('map-5.17-nist', 'fw-iso27001', 'iso-5.17', 'fw-nist-csf', 'nist-pr.aa-02', 'equivalent', 'Both require authentication'),
('map-5.17-pci', 'fw-iso27001', 'iso-5.17', 'fw-pci-dss', 'pci-8.3', 'equivalent', 'Both require strong authentication'),
('map-5.17-soc2', 'fw-iso27001', 'iso-5.17', 'fw-soc2', 'soc2-cc6.1', 'partial', 'SOC2 requires access security'),
-- A.5.18 Access rights
('map-5.18-pci', 'fw-iso27001', 'iso-5.18', 'fw-pci-dss', 'pci-7.2', 'equivalent', 'Both require appropriate access'),
('map-5.18-soc2', 'fw-iso27001', 'iso-5.18', 'fw-soc2', 'soc2-cc6.3', 'partial', 'SOC2 requires access removal'),
-- A.5.19 Supplier security
('map-5.19-nist', 'fw-iso27001', 'iso-5.19', 'fw-nist-csf', 'nist-gv.sc-01', 'equivalent', 'Both require supply chain risk'),
('map-5.19-pci', 'fw-iso27001', 'iso-5.19', 'fw-pci-dss', 'pci-12.8', 'equivalent', 'Both require third-party risk'),
('map-5.19-soc2', 'fw-iso27001', 'iso-5.19', 'fw-soc2', 'soc2-cc9.2', 'equivalent', 'Both require vendor risk'),
('map-5.19-gdpr', 'fw-iso27001', 'iso-5.19', 'fw-gdpr', 'gdpr-28', 'equivalent', 'Both require processor management'),
-- A.5.24 Incident management
('map-5.24-nist', 'fw-iso27001', 'iso-5.24', 'fw-nist-csf', 'nist-pr.ir-01', 'equivalent', 'Both require incident response'),
('map-5.24-pci', 'fw-iso27001', 'iso-5.24', 'fw-pci-dss', 'pci-12.10', 'equivalent', 'Both require incident response'),
('map-5.24-soc2', 'fw-iso27001', 'iso-5.24', 'fw-soc2', 'soc2-cc7.4', 'equivalent', 'Both require incident response'),
('map-5.24-gdpr', 'fw-iso27001', 'iso-5.24', 'fw-gdpr', 'gdpr-33', 'partial', 'GDPR requires breach notification'),
-- A.5.26 Incident response
('map-5.26-nist', 'fw-iso27001', 'iso-5.26', 'fw-nist-csf', 'nist-rs.ma-01', 'equivalent', 'Both require incident management'),
('map-5.26-soc2', 'fw-iso27001', 'iso-5.26', 'fw-soc2', 'soc2-cc7.4', 'equivalent', 'Both require incident response'),
-- A.5.29 Security during disruption
('map-5.29-nist', 'fw-iso27001', 'iso-5.29', 'fw-nist-csf', 'nist-pr.ir-02', 'equivalent', 'Both require backup/recovery'),
('map-5.29-soc2', 'fw-iso27001', 'iso-5.29', 'fw-soc2', 'soc2-a1.3', 'equivalent', 'Both require recovery procedures'),
-- A.5.30 ICT readiness for BC
('map-5.30-nist', 'fw-iso27001', 'iso-5.30', 'fw-nist-csf', 'nist-rc.rp-01', 'equivalent', 'Both require recovery execution'),
('map-5.30-soc2', 'fw-iso27001', 'iso-5.30', 'fw-soc2', 'soc2-cc7.5', 'equivalent', 'Both require incident recovery'),
-- A.5.31 Legal requirements
('map-5.31-pci', 'fw-iso27001', 'iso-5.31', 'fw-pci-dss', 'pci-12.4', 'partial', 'PCI requires compliance management'),
('map-5.31-gdpr', 'fw-iso27001', 'iso-5.31', 'fw-gdpr', 'gdpr-5.2', 'partial', 'GDPR requires demonstrating compliance'),
-- A.5.34 Privacy and PII protection
('map-5.34-soc2', 'fw-iso27001', 'iso-5.34', 'fw-soc2', 'soc2-p1.1', 'equivalent', 'Both require privacy notice'),
('map-5.34-gdpr', 'fw-iso27001', 'iso-5.34', 'fw-gdpr', 'gdpr-5.1', 'equivalent', 'Both require lawful processing'),
-- A.5.35 Independent review
('map-5.35-soc2', 'fw-iso27001', 'iso-5.35', 'fw-soc2', 'soc2-cc4.1', 'equivalent', 'Both require evaluations'),
-- A.5.36 Compliance with policies
('map-5.36-soc2', 'fw-iso27001', 'iso-5.36', 'fw-soc2', 'soc2-cc4.2', 'partial', 'SOC2 requires deficiency evaluation');

-- ISO 27001 A.6 (People) -> Other frameworks
INSERT INTO control_mappings (id, source_framework_id, source_control_id, target_framework_id, target_control_id, mapping_type, notes) VALUES
-- A.6.1 Screening
('map-6.1-pci', 'fw-iso27001', 'iso-6.1', 'fw-pci-dss', 'pci-12.7', 'equivalent', 'Both require personnel screening'),
('map-6.1-soc2', 'fw-iso27001', 'iso-6.1', 'fw-soc2', 'soc2-cc1.4', 'partial', 'SOC2 requires competent individuals'),
-- A.6.2 Terms of employment
('map-6.2-soc2', 'fw-iso27001', 'iso-6.2', 'fw-soc2', 'soc2-cc1.5', 'partial', 'SOC2 requires accountability'),
-- A.6.3 Awareness, education, training
('map-6.3-nist', 'fw-iso27001', 'iso-6.3', 'fw-nist-csf', 'nist-pr.at-01', 'equivalent', 'Both require security awareness'),
('map-6.3-pci', 'fw-iso27001', 'iso-6.3', 'fw-pci-dss', 'pci-12.6', 'equivalent', 'Both require security awareness'),
('map-6.3-soc2', 'fw-iso27001', 'iso-6.3', 'fw-soc2', 'soc2-cc1.4', 'partial', 'SOC2 requires competence'),
-- A.6.4 Disciplinary process
('map-6.4-soc2', 'fw-iso27001', 'iso-6.4', 'fw-soc2', 'soc2-cc1.5', 'equivalent', 'Both require accountability'),
-- A.6.5 Responsibilities after termination
('map-6.5-pci', 'fw-iso27001', 'iso-6.5', 'fw-pci-dss', 'pci-8.2', 'partial', 'PCI requires user ID management'),
('map-6.5-soc2', 'fw-iso27001', 'iso-6.5', 'fw-soc2', 'soc2-cc6.3', 'equivalent', 'Both require access removal'),
-- A.6.6 Confidentiality agreements
('map-6.6-soc2', 'fw-iso27001', 'iso-6.6', 'fw-soc2', 'soc2-c1.1', 'partial', 'SOC2 requires confidential info protection'),
('map-6.6-gdpr', 'fw-iso27001', 'iso-6.6', 'fw-gdpr', 'gdpr-28', 'partial', 'GDPR requires processor confidentiality'),
-- A.6.7 Remote working
('map-6.7-nist', 'fw-iso27001', 'iso-6.7', 'fw-nist-csf', 'nist-pr.aa-05', 'partial', 'NIST covers access controls'),
-- A.6.8 Information security event reporting
('map-6.8-pci', 'fw-iso27001', 'iso-6.8', 'fw-pci-dss', 'pci-12.10', 'partial', 'PCI requires incident response'),
('map-6.8-soc2', 'fw-iso27001', 'iso-6.8', 'fw-soc2', 'soc2-cc7.3', 'partial', 'SOC2 requires event analysis'),
('map-6.8-gdpr', 'fw-iso27001', 'iso-6.8', 'fw-gdpr', 'gdpr-33', 'partial', 'GDPR requires breach notification');

-- ISO 27001 A.7 (Physical) -> Other frameworks
INSERT INTO control_mappings (id, source_framework_id, source_control_id, target_framework_id, target_control_id, mapping_type, notes) VALUES
-- A.7.1 Physical security perimeters
('map-7.1-pci', 'fw-iso27001', 'iso-7.1', 'fw-pci-dss', 'pci-9.2', 'equivalent', 'Both require physical access controls'),
('map-7.1-soc2', 'fw-iso27001', 'iso-7.1', 'fw-soc2', 'soc2-cc6.4', 'equivalent', 'Both require physical access restriction'),
-- A.7.2 Physical entry
('map-7.2-pci', 'fw-iso27001', 'iso-7.2', 'fw-pci-dss', 'pci-9.2', 'equivalent', 'Both require physical entry controls'),
('map-7.2-soc2', 'fw-iso27001', 'iso-7.2', 'fw-soc2', 'soc2-cc6.4', 'equivalent', 'Both require physical access restriction'),
-- A.7.3 Securing offices
('map-7.3-nist', 'fw-iso27001', 'iso-7.3', 'fw-nist-csf', 'nist-de.cm-02', 'partial', 'NIST covers physical monitoring'),
-- A.7.4 Physical security monitoring
('map-7.4-nist', 'fw-iso27001', 'iso-7.4', 'fw-nist-csf', 'nist-de.cm-02', 'equivalent', 'Both require physical monitoring'),
-- A.7.5 Protecting against threats
('map-7.5-soc2', 'fw-iso27001', 'iso-7.5', 'fw-soc2', 'soc2-a1.2', 'equivalent', 'Both require environmental protections'),
-- A.7.7 Clear desk/screen
('map-7.7-pci', 'fw-iso27001', 'iso-7.7', 'fw-pci-dss', 'pci-3.4', 'partial', 'PCI requires PAN display restriction'),
-- A.7.9 Security of assets off-premises
('map-7.9-pci', 'fw-iso27001', 'iso-7.9', 'fw-pci-dss', 'pci-9.4', 'partial', 'PCI requires media security'),
-- A.7.10 Storage media
('map-7.10-pci', 'fw-iso27001', 'iso-7.10', 'fw-pci-dss', 'pci-9.4', 'equivalent', 'Both require media security'),
('map-7.10-soc2', 'fw-iso27001', 'iso-7.10', 'fw-soc2', 'soc2-cc6.5', 'equivalent', 'Both require secure disposal'),
-- A.7.13 Equipment maintenance
('map-7.13-nist', 'fw-iso27001', 'iso-7.13', 'fw-nist-csf', 'nist-pr.ps-02', 'partial', 'NIST covers software maintenance'),
-- A.7.14 Secure disposal
('map-7.14-pci', 'fw-iso27001', 'iso-7.14', 'fw-pci-dss', 'pci-9.4', 'partial', 'PCI requires media destruction'),
('map-7.14-soc2', 'fw-iso27001', 'iso-7.14', 'fw-soc2', 'soc2-cc6.5', 'equivalent', 'Both require secure disposal'),
('map-7.14-gdpr', 'fw-iso27001', 'iso-7.14', 'fw-gdpr', 'gdpr-17', 'partial', 'GDPR requires erasure capability');

-- ISO 27001 A.8 (Technological) -> Other frameworks
INSERT INTO control_mappings (id, source_framework_id, source_control_id, target_framework_id, target_control_id, mapping_type, notes) VALUES
-- A.8.1 User endpoint devices
('map-8.1-nist', 'fw-iso27001', 'iso-8.1', 'fw-nist-csf', 'nist-de.cm-09', 'equivalent', 'Both require endpoint monitoring'),
('map-8.1-pci', 'fw-iso27001', 'iso-8.1', 'fw-pci-dss', 'pci-2.2', 'partial', 'PCI requires secure configurations'),
-- A.8.2 Privileged access rights
('map-8.2-nist', 'fw-iso27001', 'iso-8.2', 'fw-nist-csf', 'nist-pr.at-02', 'partial', 'NIST requires privileged user training'),
('map-8.2-pci', 'fw-iso27001', 'iso-8.2', 'fw-pci-dss', 'pci-7.2', 'equivalent', 'Both require appropriate access'),
('map-8.2-soc2', 'fw-iso27001', 'iso-8.2', 'fw-soc2', 'soc2-cc6.1', 'equivalent', 'Both require access control'),
-- A.8.3 Information access restriction
('map-8.3-pci', 'fw-iso27001', 'iso-8.3', 'fw-pci-dss', 'pci-7.3', 'equivalent', 'Both require access control systems'),
('map-8.3-soc2', 'fw-iso27001', 'iso-8.3', 'fw-soc2', 'soc2-cc6.1', 'equivalent', 'Both require logical access'),
-- A.8.4 Access to source code
('map-8.4-pci', 'fw-iso27001', 'iso-8.4', 'fw-pci-dss', 'pci-6.2', 'partial', 'PCI requires secure custom software'),
-- A.8.5 Secure authentication
('map-8.5-nist', 'fw-iso27001', 'iso-8.5', 'fw-nist-csf', 'nist-pr.aa-02', 'equivalent', 'Both require authentication'),
('map-8.5-pci', 'fw-iso27001', 'iso-8.5', 'fw-pci-dss', 'pci-8.3', 'equivalent', 'Both require strong authentication'),
('map-8.5-pci-mfa', 'fw-iso27001', 'iso-8.5', 'fw-pci-dss', 'pci-8.4', 'partial', 'PCI requires MFA'),
('map-8.5-soc2', 'fw-iso27001', 'iso-8.5', 'fw-soc2', 'soc2-cc6.1', 'partial', 'SOC2 requires access security'),
-- A.8.6 Capacity management
('map-8.6-soc2', 'fw-iso27001', 'iso-8.6', 'fw-soc2', 'soc2-a1.1', 'equivalent', 'Both require capacity management'),
-- A.8.7 Protection against malware
('map-8.7-nist', 'fw-iso27001', 'iso-8.7', 'fw-nist-csf', 'nist-de.cm-09', 'partial', 'NIST covers endpoint monitoring'),
('map-8.7-pci', 'fw-iso27001', 'iso-8.7', 'fw-pci-dss', 'pci-5.2', 'equivalent', 'Both require malware protection'),
('map-8.7-soc2', 'fw-iso27001', 'iso-8.7', 'fw-soc2', 'soc2-cc6.8', 'equivalent', 'Both require malware prevention'),
-- A.8.8 Technical vulnerability management
('map-8.8-nist', 'fw-iso27001', 'iso-8.8', 'fw-nist-csf', 'nist-id.ra-01', 'equivalent', 'Both require vulnerability identification'),
('map-8.8-pci', 'fw-iso27001', 'iso-8.8', 'fw-pci-dss', 'pci-6.3', 'equivalent', 'Both require vulnerability management'),
('map-8.8-pci-scan', 'fw-iso27001', 'iso-8.8', 'fw-pci-dss', 'pci-11.3', 'equivalent', 'Both require vulnerability scanning'),
-- A.8.9 Configuration management
('map-8.9-nist', 'fw-iso27001', 'iso-8.9', 'fw-nist-csf', 'nist-pr.ps-01', 'equivalent', 'Both require configuration management'),
('map-8.9-pci', 'fw-iso27001', 'iso-8.9', 'fw-pci-dss', 'pci-2.2', 'equivalent', 'Both require secure configurations'),
('map-8.9-soc2', 'fw-iso27001', 'iso-8.9', 'fw-soc2', 'soc2-cc7.1', 'equivalent', 'Both require configuration management'),
-- A.8.10 Information deletion
('map-8.10-pci', 'fw-iso27001', 'iso-8.10', 'fw-pci-dss', 'pci-3.2', 'partial', 'PCI requires minimizing data storage'),
('map-8.10-soc2', 'fw-iso27001', 'iso-8.10', 'fw-soc2', 'soc2-c1.2', 'equivalent', 'Both require confidential info disposal'),
('map-8.10-gdpr', 'fw-iso27001', 'iso-8.10', 'fw-gdpr', 'gdpr-17', 'equivalent', 'Both require erasure/deletion'),
-- A.8.11 Data masking
('map-8.11-pci', 'fw-iso27001', 'iso-8.11', 'fw-pci-dss', 'pci-3.4', 'equivalent', 'Both require data masking/protection'),
-- A.8.12 Data leakage prevention
('map-8.12-pci', 'fw-iso27001', 'iso-8.12', 'fw-pci-dss', 'pci-3.5', 'partial', 'PCI requires PAN protection'),
('map-8.12-soc2', 'fw-iso27001', 'iso-8.12', 'fw-soc2', 'soc2-c1.1', 'partial', 'SOC2 requires confidential info protection'),
-- A.8.13 Information backup
('map-8.13-nist', 'fw-iso27001', 'iso-8.13', 'fw-nist-csf', 'nist-pr.ir-02', 'equivalent', 'Both require backup'),
('map-8.13-soc2', 'fw-iso27001', 'iso-8.13', 'fw-soc2', 'soc2-a1.3', 'partial', 'SOC2 requires recovery procedures'),
-- A.8.14 Redundancy
('map-8.14-soc2', 'fw-iso27001', 'iso-8.14', 'fw-soc2', 'soc2-a1.1', 'partial', 'SOC2 requires capacity management'),
-- A.8.15 Logging
('map-8.15-nist', 'fw-iso27001', 'iso-8.15', 'fw-nist-csf', 'nist-pr.ps-04', 'equivalent', 'Both require log management'),
('map-8.15-pci', 'fw-iso27001', 'iso-8.15', 'fw-pci-dss', 'pci-10.2', 'equivalent', 'Both require audit logs'),
('map-8.15-soc2', 'fw-iso27001', 'iso-8.15', 'fw-soc2', 'soc2-cc7.2', 'partial', 'SOC2 requires security monitoring'),
-- A.8.16 Monitoring activities
('map-8.16-nist', 'fw-iso27001', 'iso-8.16', 'fw-nist-csf', 'nist-de.cm-01', 'equivalent', 'Both require network monitoring'),
('map-8.16-pci', 'fw-iso27001', 'iso-8.16', 'fw-pci-dss', 'pci-10.4', 'equivalent', 'Both require log review'),
('map-8.16-soc2', 'fw-iso27001', 'iso-8.16', 'fw-soc2', 'soc2-cc7.2', 'equivalent', 'Both require system monitoring'),
-- A.8.17 Clock synchronization
('map-8.17-pci', 'fw-iso27001', 'iso-8.17', 'fw-pci-dss', 'pci-10.6', 'equivalent', 'Both require time synchronization'),
-- A.8.18 Privileged utility programs
('map-8.18-pci', 'fw-iso27001', 'iso-8.18', 'fw-pci-dss', 'pci-7.2', 'partial', 'PCI requires access control'),
-- A.8.20 Network security
('map-8.20-nist', 'fw-iso27001', 'iso-8.20', 'fw-nist-csf', 'nist-pr.aa-05', 'partial', 'NIST covers access permissions'),
('map-8.20-pci', 'fw-iso27001', 'iso-8.20', 'fw-pci-dss', 'pci-1.2', 'equivalent', 'Both require network security'),
('map-8.20-soc2', 'fw-iso27001', 'iso-8.20', 'fw-soc2', 'soc2-cc6.6', 'equivalent', 'Both require boundary protection'),
-- A.8.21 Security of network services
('map-8.21-pci', 'fw-iso27001', 'iso-8.21', 'fw-pci-dss', 'pci-1.3', 'partial', 'PCI requires network access restriction'),
-- A.8.22 Segregation of networks
('map-8.22-pci', 'fw-iso27001', 'iso-8.22', 'fw-pci-dss', 'pci-1.3', 'equivalent', 'Both require network segmentation'),
('map-8.22-soc2', 'fw-iso27001', 'iso-8.22', 'fw-soc2', 'soc2-cc6.6', 'partial', 'SOC2 requires boundary protection'),
-- A.8.24 Cryptography
('map-8.24-nist', 'fw-iso27001', 'iso-8.24', 'fw-nist-csf', 'nist-pr.ds-01', 'partial', 'NIST covers data-at-rest protection'),
('map-8.24-pci', 'fw-iso27001', 'iso-8.24', 'fw-pci-dss', 'pci-3.5', 'equivalent', 'Both require cryptographic protection'),
('map-8.24-pci-key', 'fw-iso27001', 'iso-8.24', 'fw-pci-dss', 'pci-3.6', 'equivalent', 'Both require key management'),
-- A.8.25 Secure development lifecycle
('map-8.25-pci', 'fw-iso27001', 'iso-8.25', 'fw-pci-dss', 'pci-6.1', 'equivalent', 'Both require secure SDLC'),
('map-8.25-soc2', 'fw-iso27001', 'iso-8.25', 'fw-soc2', 'soc2-cc8.1', 'equivalent', 'Both require change management'),
-- A.8.26 Application security requirements
('map-8.26-pci', 'fw-iso27001', 'iso-8.26', 'fw-pci-dss', 'pci-6.2', 'equivalent', 'Both require secure software development'),
-- A.8.27 Secure system architecture
('map-8.27-pci', 'fw-iso27001', 'iso-8.27', 'fw-pci-dss', 'pci-2.2', 'partial', 'PCI requires secure configurations'),
('map-8.27-gdpr', 'fw-iso27001', 'iso-8.27', 'fw-gdpr', 'gdpr-25', 'partial', 'GDPR requires privacy by design'),
-- A.8.28 Secure coding
('map-8.28-pci', 'fw-iso27001', 'iso-8.28', 'fw-pci-dss', 'pci-6.2', 'equivalent', 'Both require secure coding'),
-- A.8.29 Security testing
('map-8.29-pci', 'fw-iso27001', 'iso-8.29', 'fw-pci-dss', 'pci-11.4', 'equivalent', 'Both require penetration testing'),
('map-8.29-nist', 'fw-iso27001', 'iso-8.29', 'fw-nist-csf', 'nist-id.im-01', 'equivalent', 'Both require security testing'),
-- A.8.30 Outsourced development
('map-8.30-pci', 'fw-iso27001', 'iso-8.30', 'fw-pci-dss', 'pci-6.5', 'partial', 'PCI requires change management'),
('map-8.30-soc2', 'fw-iso27001', 'iso-8.30', 'fw-soc2', 'soc2-cc9.2', 'partial', 'SOC2 covers third-party risk'),
-- A.8.31 Separation of environments
('map-8.31-pci', 'fw-iso27001', 'iso-8.31', 'fw-pci-dss', 'pci-6.5', 'partial', 'PCI requires change management'),
('map-8.31-soc2', 'fw-iso27001', 'iso-8.31', 'fw-soc2', 'soc2-cc8.1', 'partial', 'SOC2 covers change management'),
-- A.8.32 Change management
('map-8.32-pci', 'fw-iso27001', 'iso-8.32', 'fw-pci-dss', 'pci-6.5', 'equivalent', 'Both require change management'),
('map-8.32-soc2', 'fw-iso27001', 'iso-8.32', 'fw-soc2', 'soc2-cc8.1', 'equivalent', 'Both require change management');

-- Update framework totals
UPDATE compliance_frameworks_v2 SET total_controls = (SELECT COUNT(*) FROM control_library WHERE framework_id = 'fw-nist-csf') WHERE id = 'fw-nist-csf';
UPDATE compliance_frameworks_v2 SET total_controls = (SELECT COUNT(*) FROM control_library WHERE framework_id = 'fw-pci-dss') WHERE id = 'fw-pci-dss';
UPDATE compliance_frameworks_v2 SET total_controls = (SELECT COUNT(*) FROM control_library WHERE framework_id = 'fw-soc2') WHERE id = 'fw-soc2';
UPDATE compliance_frameworks_v2 SET total_controls = (SELECT COUNT(*) FROM control_library WHERE framework_id = 'fw-gdpr') WHERE id = 'fw-gdpr';
