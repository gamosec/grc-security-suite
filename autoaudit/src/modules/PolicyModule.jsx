import { useState, useEffect } from "react";
import { useOrg } from "../App.jsx";

const FRAMEWORKS = {
  "ISO 27001:2022": { color:"#0ea5e9", badge:"ISO"  },
  "NIST CSF 2.0":   { color:"#8b5cf6", badge:"NIST" },
  "PCI-DSS v4.0":   { color:"#f59e0b", badge:"PCI"  },
  "GDPR":           { color:"#10b981", badge:"GDPR" },
  "SOC 2":          { color:"#ef4444", badge:"SOC2" },
};

// Full ISO 27001:2022 + PCI-DSS v4.0 policy coverage — 20 policies
// Grouped by category for the UI selector
const POLICY_GROUPS = [
  {
    group: "Core & Foundation",
    groupAr: "الأساسية والتأسيسية",
    policies: [
      "Information Security Policy",
      "Acceptable Use Policy",
      "Risk Assessment Policy",
      "Human Resources Security Policy",
    ]
  },
  {
    group: "Access & Identity",
    groupAr: "الوصول والهوية",
    policies: [
      "Access Control Policy",
      "Password Policy",
    ]
  },
  {
    group: "Data Protection",
    groupAr: "حماية البيانات",
    policies: [
      "Data Classification Policy",
      "Cryptography Policy",
      "Data Retention & Disposal Policy",
      "Backup & Recovery Policy",
    ]
  },
  {
    group: "Infrastructure & Operations",
    groupAr: "البنية التحتية والعمليات",
    policies: [
      "Network Security Policy",
      "Physical Security Policy",
      "Asset Management Policy",
      "Logging & Monitoring Policy",
    ]
  },
  {
    group: "Development & Change",
    groupAr: "التطوير والتغيير",
    policies: [
      "Vulnerability Management Policy",
      "Secure Development Policy",
      "Change Management Policy",
    ]
  },
  {
    group: "Incident & Continuity",
    groupAr: "الحوادث والاستمرارية",
    policies: [
      "Incident Response Policy",
      "Business Continuity Policy",
    ]
  },
  {
    group: "Supply Chain",
    groupAr: "سلسلة التوريد",
    policies: [
      "Supplier & Third-Party Security Policy",
    ]
  },
];

const POLICY_CATALOGUE = {
  // ── Core & Foundation ──────────────────────────────────────────────────────
  "Information Security Policy":          { ref:"POL-ISP-001", icon:"🔒", sans:"EISP",                       iso:"A.5.1",   pci:"12.1"  },
  "Acceptable Use Policy":                { ref:"POL-AUP-002", icon:"✅", sans:"Acceptable Use Policy",       iso:"A.5.10",  pci:"12.4"  },
  "Risk Assessment Policy":               { ref:"POL-RAP-003", icon:"⚠️", sans:"Risk Assessment Policy",      iso:"Cl. 6.1", pci:"12.3"  },
  "Human Resources Security Policy":      { ref:"POL-HRP-004", icon:"👥", sans:"Personnel Security Policy",   iso:"A.6",     pci:"12.6"  },
  // ── Access & Identity ──────────────────────────────────────────────────────
  "Access Control Policy":                { ref:"POL-ACP-005", icon:"🔑", sans:"Access Control Policy",       iso:"A.5.15",  pci:"7"     },
  "Password Policy":                      { ref:"POL-PWD-006", icon:"🔐", sans:"Password Protection Policy",  iso:"A.5.17",  pci:"8"     },
  // ── Data Protection ────────────────────────────────────────────────────────
  "Data Classification Policy":           { ref:"POL-DCP-007", icon:"🗂️", sans:"Data Classification Policy",  iso:"A.5.12",  pci:"3"     },
  "Cryptography Policy":                  { ref:"POL-CRP-008", icon:"🔏", sans:"Encryption Policy",            iso:"A.8.24",  pci:"3.5"   },
  "Data Retention & Disposal Policy":     { ref:"POL-DRP-009", icon:"🗑️", sans:"Data Retention Policy",       iso:"A.5.33",  pci:"3.2"   },
  "Backup & Recovery Policy":             { ref:"POL-BRP-010", icon:"💾", sans:"Data Backup Policy",           iso:"A.8.13",  pci:"3.1"   },
  // ── Infrastructure & Operations ────────────────────────────────────────────
  "Network Security Policy":              { ref:"POL-NSP-011", icon:"🌐", sans:"Network Security Policy",      iso:"A.8.20",  pci:"1"     },
  "Physical Security Policy":             { ref:"POL-PSP-012", icon:"🏢", sans:"Physical Security Policy",     iso:"A.7",     pci:"9"     },
  "Asset Management Policy":              { ref:"POL-AMP-013", icon:"📦", sans:"Asset Inventory Policy",       iso:"A.5.9",   pci:"2"     },
  "Logging & Monitoring Policy":          { ref:"POL-LMP-014", icon:"📊", sans:"Audit Logging Policy",         iso:"A.8.15",  pci:"10"    },
  // ── Development & Change ───────────────────────────────────────────────────
  "Vulnerability Management Policy":      { ref:"POL-VMP-015", icon:"🛡️", sans:"Vulnerability Management",    iso:"A.8.8",   pci:"6"     },
  "Secure Development Policy":            { ref:"POL-SDP-016", icon:"💻", sans:"Secure Coding Policy",         iso:"A.8.25",  pci:"6.2"   },
  "Change Management Policy":             { ref:"POL-CMP-017", icon:"🔄", sans:"Change Management Policy",     iso:"A.8.32",  pci:"6.5"   },
  // ── Incident & Continuity ──────────────────────────────────────────────────
  "Incident Response Policy":             { ref:"POL-IRP-018", icon:"🚨", sans:"Incident Response Policy",     iso:"A.5.24",  pci:"12.10" },
  "Business Continuity Policy":           { ref:"POL-BCP-019", icon:"♻️", sans:"Business Continuity Policy",  iso:"A.5.29",  pci:"12.10" },
  // ── Supply Chain ───────────────────────────────────────────────────────────
  "Supplier & Third-Party Security Policy": { ref:"POL-SSP-020", icon:"🤝", sans:"Third-Party Security Policy", iso:"A.5.19", pci:"12.8" },
};

function safeJSON(raw) {
  try {
    let t = raw.trim()
      // Remove markdown code blocks
      .replace(/^```(?:json)?[\r\n]*/i, "")
      .replace(/[\r\n]*```\s*$/i, "")
      // Remove any leading text before JSON
      .replace(/^[^{]*/, "")
      // Remove any trailing text after JSON
      .replace(/}[^}]*$/, "}")
      .trim();
    
    const s = t.indexOf("{"), e = t.lastIndexOf("}");
    if (s < 0 || e < 0) return null;
    
    let jsonStr = t.slice(s, e + 1);
    
    // Fix common LLM JSON issues
    jsonStr = jsonStr
      // Fix trailing commas before } or ]
      .replace(/,\s*([}\]])/g, "$1")
      // Fix unescaped newlines in strings (common issue)
      .replace(/(?<!\\)\\n/g, "\\n")
      // Remove control characters
      .replace(/[\x00-\x1F\x7F]/g, " ");
    
    const obj = JSON.parse(jsonStr);
    
    // Safety net: remove any audit fields even if Llama added them
    ["complianceScore","maturityLevel","frameworkAlignment",
     "riskFindings","auditFindings","findings","gaps"].forEach(k => delete obj[k]);
    return obj;
  } catch (e) { 
    console.error("JSON parse error:", e.message);
    return null; 
  }
}

// ── Policy-specific section templates for better structure ──────────────────
const POLICY_SECTIONS = {
  "Information Security Policy": ["5.1 Information Security Governance", "5.2 Roles and Responsibilities", "5.3 Risk Management", "5.4 Security Awareness and Training", "5.5 Incident Management", "5.6 Compliance and Monitoring"],
  "Acceptable Use Policy": ["5.1 General Use Requirements", "5.2 Email and Communication", "5.3 Internet and Web Access", "5.4 Personal Device Use (BYOD)", "5.5 Social Media Use", "5.6 Monitoring and Privacy"],
  "Risk Assessment Policy": ["5.1 Risk Assessment Process", "5.2 Risk Identification", "5.3 Risk Analysis and Evaluation", "5.4 Risk Treatment", "5.5 Risk Monitoring and Review", "5.6 Risk Documentation"],
  "Human Resources Security Policy": ["5.1 Pre-Employment Screening", "5.2 Terms of Employment", "5.3 Security Awareness Training", "5.4 Disciplinary Process", "5.5 Termination and Change of Employment", "5.6 Confidentiality Agreements"],
  "Access Control Policy": ["5.1 Access Control Principles", "5.2 User Registration and De-registration", "5.3 User Access Provisioning", "5.4 Privileged Access Management", "5.5 Access Review and Recertification", "5.6 Access Revocation"],
  "Password Policy": ["5.1 Password Requirements", "5.2 Password Creation and Complexity", "5.3 Password Storage and Protection", "5.4 Multi-Factor Authentication", "5.5 Account Lockout and Monitoring", "5.6 Password Reset Procedures", "5.7 Service and Privileged Account Passwords"],
  "Data Classification Policy": ["5.1 Classification Levels", "5.2 Classification Process", "5.3 Labeling Requirements", "5.4 Handling Requirements", "5.5 Information Transfer", "5.6 Declassification and Reclassification"],
  "Cryptography Policy": ["5.1 Cryptographic Standards", "5.2 Key Management", "5.3 Encryption Requirements", "5.4 Digital Signatures", "5.5 Certificate Management", "5.6 Cryptographic Hardware"],
  "Data Retention & Disposal Policy": ["5.1 Retention Requirements", "5.2 Retention Periods", "5.3 Data Disposal Methods", "5.4 Media Sanitization", "5.5 Legal Hold Requirements", "5.6 Disposal Documentation"],
  "Backup & Recovery Policy": ["5.1 Backup Requirements", "5.2 Backup Frequency and Types", "5.3 Backup Storage and Protection", "5.4 Backup Testing", "5.5 Recovery Procedures", "5.6 Recovery Time Objectives"],
  "Network Security Policy": ["5.1 Network Architecture", "5.2 Network Segmentation", "5.3 Firewall and Perimeter Security", "5.4 Wireless Network Security", "5.5 Remote Access Security", "5.6 Network Monitoring"],
  "Physical Security Policy": ["5.1 Physical Security Perimeters", "5.2 Physical Entry Controls", "5.3 Securing Work Areas", "5.4 Equipment Security", "5.5 Environmental Controls", "5.6 Visitor Management"],
  "Asset Management Policy": ["5.1 Asset Inventory", "5.2 Asset Ownership", "5.3 Asset Classification", "5.4 Asset Handling", "5.5 Asset Return", "5.6 Asset Disposal"],
  "Logging & Monitoring Policy": ["5.1 Logging Requirements", "5.2 Log Content and Format", "5.3 Log Protection and Retention", "5.4 Security Monitoring", "5.5 Alert and Response", "5.6 Log Review and Analysis"],
  "Vulnerability Management Policy": ["5.1 Vulnerability Identification", "5.2 Vulnerability Assessment", "5.3 Vulnerability Prioritization", "5.4 Remediation Requirements", "5.5 Patch Management", "5.6 Exception Handling"],
  "Secure Development Policy": ["5.1 Secure Development Lifecycle", "5.2 Security Requirements", "5.3 Secure Coding Standards", "5.4 Code Review Requirements", "5.5 Security Testing", "5.6 Deployment Security"],
  "Change Management Policy": ["5.1 Change Request Process", "5.2 Change Classification", "5.3 Change Assessment and Approval", "5.4 Change Implementation", "5.5 Emergency Changes", "5.6 Post-Implementation Review"],
  "Incident Response Policy": ["5.1 Incident Classification", "5.2 Incident Reporting", "5.3 Incident Response Team", "5.4 Incident Handling Procedures", "5.5 Evidence Collection", "5.6 Post-Incident Review"],
  "Business Continuity Policy": ["5.1 Business Impact Analysis", "5.2 Recovery Objectives", "5.3 Business Continuity Plans", "5.4 Testing and Exercises", "5.5 Plan Maintenance", "5.6 Crisis Communication"],
  "Supplier & Third-Party Security Policy": ["5.1 Supplier Assessment", "5.2 Security Requirements in Contracts", "5.3 Supplier Monitoring", "5.4 Cloud Service Security", "5.5 Supply Chain Security", "5.6 Supplier Termination"],
};

// ── ISO 27001:2022 Control Mapping for better policy generation ──────────────
const ISO27001_2022_CONTROLS = {
  "Information Security Policy": ["A.5.1 Policies for information security", "A.5.2 Information security roles and responsibilities", "A.5.3 Segregation of duties", "A.5.4 Management responsibilities"],
  "Acceptable Use Policy": ["A.5.10 Acceptable use of information and assets", "A.5.11 Return of assets", "A.6.7 Remote working", "A.8.1 User endpoint devices"],
  "Risk Assessment Policy": ["A.5.7 Threat intelligence", "A.5.8 Information security in project management", "Clause 6.1 Risk assessment", "Clause 8.2 Risk treatment"],
  "Human Resources Security Policy": ["A.6.1 Screening", "A.6.2 Terms and conditions of employment", "A.6.3 Information security awareness", "A.6.4 Disciplinary process", "A.6.5 Responsibilities after termination"],
  "Access Control Policy": ["A.5.15 Access control", "A.5.16 Identity management", "A.5.18 Access rights", "A.8.2 Privileged access rights", "A.8.3 Information access restriction"],
  "Password Policy": ["A.5.17 Authentication information", "A.8.5 Secure authentication"],
  "Data Classification Policy": ["A.5.12 Classification of information", "A.5.13 Labelling of information", "A.5.14 Information transfer"],
  "Cryptography Policy": ["A.8.24 Use of cryptography"],
  "Data Retention & Disposal Policy": ["A.5.33 Protection of records", "A.8.10 Information deletion", "A.8.11 Data masking", "A.8.12 Data leakage prevention"],
  "Backup & Recovery Policy": ["A.8.13 Information backup", "A.8.14 Redundancy of information processing facilities"],
  "Network Security Policy": ["A.8.20 Networks security", "A.8.21 Security of network services", "A.8.22 Segregation of networks", "A.8.23 Web filtering"],
  "Physical Security Policy": ["A.7.1 Physical security perimeters", "A.7.2 Physical entry", "A.7.3 Securing offices and facilities", "A.7.4 Physical security monitoring", "A.7.5 Protecting against physical and environmental threats"],
  "Asset Management Policy": ["A.5.9 Inventory of information and associated assets", "A.5.10 Acceptable use", "A.5.11 Return of assets", "A.7.9 Security of assets off-premises"],
  "Logging & Monitoring Policy": ["A.8.15 Logging", "A.8.16 Monitoring activities", "A.8.17 Clock synchronization"],
  "Vulnerability Management Policy": ["A.8.8 Management of technical vulnerabilities", "A.8.7 Protection against malware"],
  "Secure Development Policy": ["A.8.25 Secure development life cycle", "A.8.26 Application security requirements", "A.8.27 Secure system architecture", "A.8.28 Secure coding", "A.8.29 Security testing in development"],
  "Change Management Policy": ["A.8.32 Change management", "A.8.9 Configuration management", "A.8.19 Installation of software"],
  "Incident Response Policy": ["A.5.24 Information security incident management planning", "A.5.25 Assessment and decision on events", "A.5.26 Response to incidents", "A.5.27 Learning from incidents", "A.5.28 Collection of evidence"],
  "Business Continuity Policy": ["A.5.29 Information security during disruption", "A.5.30 ICT readiness for business continuity"],
  "Supplier & Third-Party Security Policy": ["A.5.19 Information security in supplier relationships", "A.5.20 Addressing information security within supplier agreements", "A.5.21 Managing information security in the ICT supply chain", "A.5.22 Monitoring and review of supplier services", "A.5.23 Information security for use of cloud services"],
};

// ── Policy-specific definitions for better accuracy ──────────────────────────
const POLICY_DEFINITIONS = {
  "Access Control Policy": [
    { term: "Access Control", definition: "The selective restriction of access to information systems and data based on authorization levels." },
    { term: "Privileged Access", definition: "System access rights that exceed those of a standard user, including administrative, root, or elevated permissions." },
    { term: "Least Privilege", definition: "The principle of providing users only the minimum access rights necessary to perform their job functions." },
    { term: "Role-Based Access Control (RBAC)", definition: "An access control method where permissions are assigned to roles rather than individual users." },
    { term: "Access Recertification", definition: "The periodic review and validation of user access rights to ensure they remain appropriate." }
  ],
  "Incident Response Policy": [
    { term: "Security Incident", definition: "Any event that threatens the confidentiality, integrity, or availability of information assets, or violates security policies." },
    { term: "Security Event", definition: "An observable occurrence in a system or network that may indicate a potential security incident." },
    { term: "Incident Response Team (IRT)", definition: "A designated group responsible for coordinating and executing incident response activities." },
    { term: "Chain of Custody", definition: "The documented process of maintaining and preserving evidence from collection through court presentation." },
    { term: "Incident Severity", definition: "Classification of incidents as Critical (immediate business impact), High (significant impact within 24h), Medium (moderate impact), or Low (minimal impact)." }
  ],
  "Password Policy": [
    { term: "Authentication", definition: "The process of verifying the identity of a user, device, or system before granting access." },
    { term: "Multi-Factor Authentication (MFA)", definition: "Authentication requiring two or more independent credentials: something you know (password), something you have (token/phone), or something you are (biometric)." },
    { term: "Passphrase", definition: "A sequence of 4 or more random words used as a password, typically 16+ characters, easier to remember and more secure than complex passwords." },
    { term: "Password Manager", definition: "An enterprise-approved software application that securely generates, stores, and auto-fills passwords in an encrypted vault (e.g., 1Password, Bitwarden, LastPass)." },
    { term: "Credential Stuffing", definition: "An automated attack using stolen username/password pairs from data breaches to gain unauthorized access to accounts across multiple systems." },
    { term: "Account Lockout", definition: "A security control that temporarily or permanently disables an account after a specified number of consecutive failed authentication attempts." },
    { term: "Privileged Account", definition: "An account with elevated access rights (administrator, root, service accounts) requiring enhanced security controls and monitoring." },
    { term: "Secrets Management", definition: "The practice of securely storing, distributing, and rotating credentials for service accounts and automated processes using specialized tools (e.g., HashiCorp Vault, AWS Secrets Manager)." }
  ],
  "Information Security Policy": [
    { term: "Information Security", definition: "The protection of information and information systems from unauthorized access, use, disclosure, disruption, modification, or destruction." },
    { term: "Confidentiality", definition: "Ensuring information is accessible only to authorized individuals, entities, or processes." },
    { term: "Integrity", definition: "Maintaining the accuracy and completeness of information and processing methods." },
    { term: "Availability", definition: "Ensuring authorized users have timely and reliable access to information and associated assets." },
    { term: "Risk", definition: "The potential for loss or damage when a threat exploits a vulnerability." }
  ],
  "Data Classification Policy": [
    { term: "Public", definition: "Information approved for public release with no restrictions on distribution." },
    { term: "Internal", definition: "Information intended for use within the organization but not publicly available." },
    { term: "Confidential", definition: "Sensitive information that could cause harm if disclosed to unauthorized parties." },
    { term: "Restricted", definition: "Highly sensitive information requiring the strictest protection and limited access." },
    { term: "Data Owner", definition: "The individual or role accountable for the classification and protection of specific data assets." }
  ],
};

// ── Policy-specific roles for better accuracy ──────────────────────────────────
const POLICY_ROLES = {
  "Incident Response Policy": [
    { role: "Board of Directors", responsibility: "Receives briefings on critical incidents and approves incident response strategy" },
    { role: "Chief Executive Officer (CEO)", responsibility: "Authorizes major incident response decisions and external communications" },
    { role: "Chief Information Security Officer (CISO)", responsibility: "Leads incident response program, declares incidents, and coordinates response activities" },
    { role: "Incident Response Team Leader", responsibility: "Coordinates day-to-day incident handling and leads the Incident Response Team" },
    { role: "Security Operations Center (SOC)", responsibility: "Monitors security events 24/7, performs initial triage, and escalates incidents" },
    { role: "IT Operations", responsibility: "Provides technical support for containment, eradication, and recovery activities" },
    { role: "Legal and Compliance", responsibility: "Advises on regulatory notification requirements and legal implications" },
    { role: "Communications/PR", responsibility: "Manages internal and external communications during incidents" },
    { role: "All Employees", responsibility: "Report suspected security incidents immediately and cooperate with investigations" }
  ],
  "Access Control Policy": [
    { role: "Board of Directors", responsibility: "Approves access control strategy and receives reports on access-related risks" },
    { role: "Chief Information Security Officer (CISO)", responsibility: "Develops and maintains access control policy and standards" },
    { role: "Identity and Access Management (IAM) Team", responsibility: "Manages user provisioning, access requests, and recertification processes" },
    { role: "System Owners", responsibility: "Approve access requests for their systems and ensure appropriate access controls" },
    { role: "Data Owners", responsibility: "Define access requirements for data assets and approve data access requests" },
    { role: "IT Operations", responsibility: "Implements and maintains technical access controls and authentication systems" },
    { role: "Human Resources", responsibility: "Notifies IAM of employee status changes and manages access during onboarding/offboarding" },
    { role: "All Employees", responsibility: "Protect their credentials and report unauthorized access attempts" }
  ],
  "Password Policy": [
    { role: "Board of Directors", responsibility: "Approves authentication strategy and receives reports on credential-related security incidents" },
    { role: "Chief Executive Officer (CEO)", responsibility: "Demonstrates leadership commitment by approving this policy and ensuring adequate resources for MFA implementation" },
    { role: "Chief Information Security Officer (CISO)", responsibility: "Develops password and authentication standards; approves exceptions; oversees MFA deployment" },
    { role: "Identity and Access Management (IAM) Team", responsibility: "Implements password policies in identity systems; manages MFA enrollment; monitors authentication failures" },
    { role: "IT Security Operations", responsibility: "Monitors for compromised credentials; responds to account lockouts; investigates brute-force attacks" },
    { role: "IT Service Desk", responsibility: "Verifies user identity before password resets; follows secure reset procedures; escalates suspicious requests" },
    { role: "System Administrators", responsibility: "Configure password policies on systems; manage service account credentials; implement secrets management" },
    { role: "All Employees", responsibility: "Create strong unique passwords; use approved password managers; enable MFA; report suspected compromises immediately" }
  ],
};

// ── Policy-specific guidance for modern standards compliance ──────────────────
const POLICY_GUIDANCE = {
  "Password Policy": `
CRITICAL PASSWORD POLICY REQUIREMENTS (NIST SP 800-63B & ISO 27001:2022 Aligned):
- DO NOT require periodic password changes (e.g., every 90 days) - this is OUTDATED
- DO require password changes ONLY when compromise is suspected or confirmed
- Minimum password length SHALL be 14 characters (not 8 or 12)
- Passphrases of 16+ characters WITHOUT complexity requirements are acceptable and preferred
- MFA SHALL be required for ALL users, not just privileged accounts
- Account lockout SHALL occur after 5 consecutive failed attempts with 15-minute lockout minimum
- Service accounts SHALL use secrets management systems (e.g., HashiCorp Vault) with 25+ character passwords
- Password history SHALL prevent reuse of last 12 passwords
- Users SHALL use enterprise-approved password managers

IMPORTANT: Section 5.5 MUST cover Account Lockout and Monitoring with these requirements:
- Accounts locked after 5 failed attempts
- 15-minute minimum lockout duration
- Alert security team after 3 failed privileged account attempts
- Log all authentication failures for 90 days minimum`,
  
  "default": ""
};

// ── Enhanced Prompt: audit-ready, ISO 27001:2022 compliant ──────────────────────
function makePrompt(f, lang) {
  const ar   = lang === "ar";
  const meta = POLICY_CATALOGUE[f.policyType] || { ref:"POL-001", sans:"Security Policy" };
  const isoControls = ISO27001_2022_CONTROLS[f.policyType] || ["A.5.1 Policies for information security"];
  const isoControlsStr = isoControls.join(", ");
  const sections = POLICY_SECTIONS[f.policyType] || ["5.1 General Requirements", "5.2 Roles and Responsibilities", "5.3 Implementation", "5.4 Monitoring", "5.5 Compliance", "5.6 Review"];
  const definitions = POLICY_DEFINITIONS[f.policyType] || [
    { term: "Confidential", definition: "Information requiring protection from unauthorized disclosure." },
    { term: "Information Asset", definition: "Any data, system, or service with value to the organization." },
    { term: "Security Incident", definition: "An event threatening confidentiality, integrity, or availability." },
    { term: "Third Party", definition: "External entities accessing organizational systems or data." },
    { term: "Compliance", definition: "Adherence to applicable laws, regulations, and policies." }
  ];
  const roles = POLICY_ROLES[f.policyType] || [
    { role: "Board of Directors", responsibility: "Provides strategic oversight and approves security strategy" },
    { role: "Chief Executive Officer (CEO)", responsibility: "Demonstrates leadership commitment by approving this policy and allocating resources" },
    { role: "Chief Information Security Officer (CISO)", responsibility: "Develops, implements, and maintains this policy; reports to Board" },
    { role: "Information Security Manager", responsibility: "Coordinates day-to-day implementation and monitors compliance" },
    { role: "Department Managers", responsibility: "Ensure staff compliance and complete required training" },
    { role: "IT Department", responsibility: "Implements technical controls and security configurations" },
    { role: "Human Resources", responsibility: "Manages security in employment lifecycle and training" },
    { role: "All Employees", responsibility: "Comply with this policy and report incidents immediately" }
  ];
  
  // Dynamic dates: effective = today, review = today + 12 months
  const today = new Date();
  const effectiveDate = today.toISOString().split('T')[0]; // YYYY-MM-DD format
  const reviewDate = new Date(today.setFullYear(today.getFullYear() + 1)).toISOString().split('T')[0];
  
  // Get policy-specific guidance (e.g., for Password Policy)
  const policyGuidance = POLICY_GUIDANCE[f.policyType] || POLICY_GUIDANCE["default"];
  
  // Policy-specific related documents
  const POLICY_RELATED_DOCS = {
    "Password Policy": [
      `${f.orgName} ISMS Manual`,
      `${f.orgName} Access Control Policy`,
      `${f.orgName} Incident Response Procedure`,
      `${f.orgName} Identity and Access Management Procedure`,
      `${f.orgName} MFA Implementation Guide`,
      `${f.orgName} Security Awareness Training Program`
    ],
    "Access Control Policy": [
      `${f.orgName} ISMS Manual`,
      `${f.orgName} Password Policy`,
      `${f.orgName} Data Classification Policy`,
      `${f.orgName} User Access Management Procedure`,
      `${f.orgName} Privileged Access Management Procedure`,
      `${f.orgName} Identity Lifecycle Management Procedure`
    ],
    "Incident Response Policy": [
      `${f.orgName} ISMS Manual`,
      `${f.orgName} Business Continuity Policy`,
      `${f.orgName} Incident Response Procedure`,
      `${f.orgName} Evidence Collection Guidelines`,
      `${f.orgName} Communication Plan`,
      `${f.orgName} Forensic Investigation Procedure`
    ],
    "default": [
      `${f.orgName} ISMS Manual`,
      `${f.orgName} Risk Assessment Procedure`,
      `${f.orgName} Incident Response Procedure`,
      `${f.orgName} Security Awareness Training Program`
    ]
  };
  const relatedDocs = POLICY_RELATED_DOCS[f.policyType] || POLICY_RELATED_DOCS["default"];
  
  // Build section templates for the JSON output
  const sectionTemplates = sections.map((s, idx) => {
    if (idx === 0) {
      return `{
      "sectionTitle": "${s}",
      "statements": [
        "Specific requirement with SHALL and timeframe",
        "Another requirement with measurable metric",
        "Prohibition with MUST NOT",
        "Requirement with specific threshold or SLA"
      ]
    }`;
    }
    return `{
      "sectionTitle": "${s}",
      "statements": ["requirement with SHALL", "requirement with timeframe", "requirement with metric", "prohibition with MUST NOT"]
    }`;
  }).join(",\n    ");

  return `You are a senior information security policy writer with 15+ years experience. Write an audit-ready ${f.policyType} following ISO 27001:2022 standards, NIST guidelines, and SANS Institute template.

${ar ? "Write all text fields in Arabic. Keep codes, control references, and dates in English." : "Write in English."}

Organization: ${f.orgName}
Industry: ${f.industry}
Size: ${f.size}
Framework: ${f.framework}
Relevant ISO 27001:2022 Controls: ${isoControlsStr}
${policyGuidance}

REQUIRED SECTIONS (use these EXACT section titles as sectionTitle values - do NOT add any prefix numbers):
${sections.map(s => `- ${s}`).join("\n")}

REQUIREMENTS FOR AUDIT-READY POLICY:
1. Include 6-8 specific roles with detailed responsibilities
2. Use the REQUIRED SECTIONS listed above as sectionTitle values
3. Each section MUST have 4-5 specific, measurable statements
4. Use SHALL for mandatory requirements, SHOULD for recommendations, MUST NOT for prohibitions
5. Include specific timeframes (e.g., "within 1 hour", "within 24 hours", "within 7 days", "quarterly", "annually")
6. Include specific metrics where applicable (e.g., "minimum 14 characters", "99.9% uptime", "within 4 hours")
7. Include a Leadership Commitment statement in the purpose

Output ONLY this JSON. Start with { and end with }. No other text.

{
  "policyTitle": "Official ${f.policyType} for ${f.orgName}",
  "policyRef": "${meta.ref}",
  "version": "1.0",
  "effectiveDate": "${effectiveDate}",
  "reviewDate": "${reviewDate}",
  "owner": "Chief Information Security Officer (CISO)",
  "approver": "Chief Executive Officer (CEO)",
  "classification": "${ar ? "داخلي — سري" : "Internal — Confidential"}",
  "purpose": "3-4 sentences: why this policy exists, include leadership commitment to information security and alignment with business objectives",
  "scope": "3 sentences: who this applies to (employees, contractors, third parties), what systems/data it covers, and any exclusions",
  "roles": ${JSON.stringify(roles)},
  "policyStatements": [
    ${sectionTemplates}
  ],
  "frameworkMapping": "This policy addresses ${f.framework} controls: ${isoControlsStr}. Each control has been incorporated into the policy statements.",
  "exceptions": "Exceptions MUST be requested in writing, approved by the CISO, documented in the exception register, and reviewed annually. All exceptions expire after 12 months unless renewed.",
  "enforcement": "Violations may result in disciplinary action up to termination. Third parties in violation may have access revoked and contracts terminated.",
  "definitions": ${JSON.stringify(definitions)},
  "relatedDocuments": ${JSON.stringify(relatedDocs)}
}`;
}

// ── Word (.doc) export ────────────────────────────────────────────────────────
function downloadWord(policy, orgName, framework, policyType, lang) {
  const ar  = lang === "ar";
  const dir = ar ? "rtl" : "ltr";
  const fw  = FRAMEWORKS[framework] || { color:"#1B3A6B" };
  const L   = (en, arabic) => ar ? arabic : en;
  const today = new Date().toLocaleDateString(ar ? "ar-SA" : "en-GB",
    { year:"numeric", month:"long", day:"numeric" });

  const sectionsHTML = (policy.policyStatements || []).map((sec, idx) => `
    <h3 style="color:#1B3A6B;font-size:12pt;margin:14pt 0 5pt;padding-bottom:3pt;border-bottom:1px solid #e2e8f0;">
      ${sec.sectionTitle}
    </h3>
    <ul style="margin:0 0 10pt;padding-${ar ? "right" : "left"}:18pt;">
      ${(sec.statements || []).map(s => `<li style="margin-bottom:4pt;line-height:1.65;">${s}</li>`).join("")}
    </ul>`
  ).join("");

  const rolesHTML = (policy.roles || []).map(r => `
    <tr>
      <td style="padding:6pt 10pt;border:1pt solid #d1d5db;font-weight:bold;width:32%;background:#f8fafc;vertical-align:top;">${r.role}</td>
      <td style="padding:6pt 10pt;border:1pt solid #d1d5db;vertical-align:top;">${r.responsibility}</td>
    </tr>`).join("");

  const defsHTML = (policy.definitions || []).map(d => `
    <tr>
      <td style="padding:6pt 10pt;border:1pt solid #d1d5db;font-weight:bold;width:28%;background:#f8fafc;vertical-align:top;">${d.term}</td>
      <td style="padding:6pt 10pt;border:1pt solid #d1d5db;vertical-align:top;">${d.definition}</td>
    </tr>`).join("");

  const relatedHTML = (policy.relatedDocuments || [])
    .map(r => `<li style="margin-bottom:4pt;">${r}</li>`).join("");

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="UTF-8">
  <title>${policy.policyTitle}</title>
  <!--[if gte mso 9]><xml><w:WordDocument>
    <w:View>Print</w:View><w:Zoom>90</w:Zoom>
  </w:WordDocument></xml><![endif]-->
  <style>
    @page { margin: 2.5cm 2.5cm 2cm; }
    body  { font-family:Arial,sans-serif; font-size:11pt; color:#1e293b; direction:${dir}; line-height:1.55; }
    h1    { font-size:19pt; color:#fff; margin:0 0 6pt; }
    h2    { font-size:13pt; color:#1B3A6B; margin:18pt 0 7pt; border-bottom:2pt solid #1B3A6B; padding-bottom:4pt; page-break-after:avoid; }
    h3    { font-size:11.5pt; color:#1B3A6B; margin:12pt 0 4pt; }
    p     { margin:0 0 8pt; }
    table { width:100%; border-collapse:collapse; margin:8pt 0 14pt; font-size:10.5pt; }
    td,th { padding:6pt 10pt; border:1pt solid #d1d5db; vertical-align:top; }
    th    { background:#1B3A6B; color:#fff; font-weight:bold; text-align:${ar ? "right" : "left"}; }
    ul    { margin:4pt 0 10pt; }
    li    { margin-bottom:3pt; line-height:1.6; }
    .cover{ background:#1B3A6B; color:#fff; padding:26pt 30pt 22pt; }
    .cover .sub { font-size:10pt; color:#93c5fd; margin-bottom:6pt; }
    .cover .ref { font-size:9pt; color:#7dd3fc; margin-top:8pt; font-family:monospace; }
    .meta td    { border:none; padding:3pt 8pt; font-size:10pt; }
    .meta .lbl  { font-weight:bold; color:#64748b; font-size:9pt; text-transform:uppercase; letter-spacing:.04em; width:33%; }
    .notice     { background:#fffbeb; border-${ar ? "right" : "left"}:3pt solid #f59e0b; padding:8pt 12pt; margin:8pt 0; font-size:10pt; color:#78350f; }
    .footer     { font-size:8pt; color:#94a3b8; text-align:center; margin-top:28pt; border-top:1pt solid #e2e8f0; padding-top:8pt; }
  </style>
</head>
<body>
<div class="cover">
  <div class="sub">${orgName} &nbsp;·&nbsp; ${policyType}</div>
  <h1>${policy.policyTitle}</h1>
  <div class="ref">${policy.policyRef} &nbsp;·&nbsp; ${L("Version","الإصدار")} ${policy.version} &nbsp;·&nbsp; ${policy.classification}</div>
</div>

<h2>1. ${L("Document Control","معلومات الوثيقة")}</h2>
<table class="meta">
  <tr>
    <td class="lbl">${L("Reference","المرجع")}</td><td>${policy.policyRef}</td>
    <td class="lbl">${L("Version","الإصدار")}</td><td>${policy.version}</td>
  </tr>
  <tr>
    <td class="lbl">${L("Effective","تاريخ السريان")}</td><td>${policy.effectiveDate}</td>
    <td class="lbl">${L("Next Review","المراجعة")}</td><td>${policy.reviewDate}</td>
  </tr>
  <tr>
    <td class="lbl">${L("Owner","المالك")}</td><td>${policy.owner}</td>
    <td class="lbl">${L("Approver","المعتمِد")}</td><td>${policy.approver}</td>
  </tr>
  <tr>
    <td class="lbl">${L("Classification","التصنيف")}</td><td>${policy.classification}</td>
    <td class="lbl">${L("Framework","الإطار")}</td><td>${framework}</td>
  </tr>
</table>

<h2>2. ${L("Purpose","الغرض")}</h2>
<p>${policy.purpose}</p>

<h2>3. ${L("Scope","النطاق")}</h2>
<p>${policy.scope}</p>

<h2>4. ${L("Roles & Responsibilities","الأدوار والمسؤوليات")}</h2>
<table>
  <tr>
    <th style="width:32%">${L("Role","الدور")}</th>
    <th>${L("Responsibility","المسؤولية")}</th>
  </tr>
  ${rolesHTML}
</table>

<h2>5. ${L("Policy Statements","بنود السياسة")}</h2>
<div class="notice">
  ${L("All statements are mandatory. SHALL and MUST indicate required actions; MUST NOT indicates prohibited actions.",
      "جميع البنود إلزامية. يجب تعني الإلزام؛ يُحظر تعني الحظر.")}
</div>
${sectionsHTML}

<h2>${L("Framework Alignment","التوافق التنظيمي")}</h2>
<p><strong>${framework}:</strong> ${policy.frameworkMapping}</p>

<h2>${L("Exceptions","الاستثناءات")}</h2>
<p>${policy.exceptions}</p>

<h2>${L("Enforcement","الإنفاذ")}</h2>
<p>${policy.enforcement}</p>

<h2>${L("Definitions","التعريفات")}</h2>
<table>
  <tr>
    <th style="width:28%">${L("Term","المصطلح")}</th>
    <th>${L("Definition","التعريف")}</th>
  </tr>
  ${defsHTML}
</table>

<h2>${L("Related Documents","الوثائق ذات الصلة")}</h2>
<ul>${relatedHTML}</ul>

<h2>${L("Revision History","سجل المراجعات")}</h2>
<table>
  <tr>
    <th style="width:12%">${L("Version","الإصدار")}</th>
    <th style="width:20%">${L("Date","التاريخ")}</th>
    <th style="width:28%">${L("Author","المؤلف")}</th>
    <th>${L("Description","الوصف")}</th>
  </tr>
  <tr>
    <td>1.0</td>
    <td>${policy.effectiveDate}</td>
    <td>AutoAudit AI</td>
    <td>${L("Initial release","الإصدار الأولي")}</td>
  </tr>
</table>

<div class="footer">
  ${orgName} &nbsp;·&nbsp; ${policy.policyRef} &nbsp;·&nbsp;
  ${L("Internal Confidential — Do not distribute without authorisation",
      "وثيقة داخلية سرية — لا توزع دون إذن")}
   &nbsp;·&nbsp; ${today}
</div>
</body></html>`;

  const blob = new Blob(["\ufeff" + html], { type:"application/msword;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `${orgName.replace(/\s+/g,"_").replace(/[^\w-]/g,"")}_${policy.policyRef}_v1.0.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── D1 policy session helpers (org-aware for multi-tenant) ──────────────────
const BASE_POLICY_KEY = "autoaudit_policy_session_id";
function getPolicyKey(orgId) {
  return orgId ? `${BASE_POLICY_KEY}_${orgId}` : BASE_POLICY_KEY;
}
function loadPolicyId(orgId)    { try { return localStorage.getItem(getPolicyKey(orgId)); } catch { return null; } }
function savePolicyId(id, orgId) { try { localStorage.setItem(getPolicyKey(orgId), id); } catch {} }
function clearPolicyId(orgId)   { try { localStorage.removeItem(getPolicyKey(orgId)); } catch {} }
function genPolicyId()          { return "pol_" + Date.now() + "_" + Math.random().toString(36).slice(2,8); }

async function dbSavePolicy(id, form, result, lang) {
  try {
    await fetch("/api/policy-session", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        action:"save", id,
        org_name:form.orgName, industry:form.industry, size:form.size,
        framework:form.framework, policy_type:form.policyType, lang,
        result
      })
    });
  } catch {}
}
async function dbLoadPolicy(id) {
  try {
    const res  = await fetch("/api/policy-session?id=" + id);
    const data = await res.json();
    return data.ok ? data.policy : null;
  } catch { return null; }
}
async function dbDeletePolicy(id) {
  try { await fetch("/api/policy-session?id=" + id, { method:"DELETE" }); } catch {}
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PolicyModule({ t, isRTL, lang }) {
  const { orgId, orgName: urlOrgName } = useOrg(); // Get org context from URL params
  const [step,      setStep]      = useState("checking"); // checking|resume|form|loading|result
  const [form,      setForm]      = useState({ orgName: urlOrgName || "", industry:"", size:"", framework:"", policyType:"" });
  const [policy,    setPolicy]    = useState(null);
  const [error,     setError]     = useState("");
  const [savedMeta, setSavedMeta] = useState(null); // {orgName, policyType, framework, policyRef, id}
  const [saveStatus,setSaveStatus]= useState("idle"); // idle|saving|saved|error

  const fw      = FRAMEWORKS[form.framework] || { color:"#0ea5e9" };
  const polMeta = POLICY_CATALOGUE[form.policyType] || {};

  // Update form when urlOrgName is available
  useEffect(() => {
    if (urlOrgName) {
      setForm(prev => ({ ...prev, orgName: urlOrgName }));
    }
  }, [urlOrgName]);

  // On mount: check for a saved policy session (org-aware)
  useEffect(() => {
    const storedId = loadPolicyId(orgId);
    if (!storedId) { setStep("form"); return; }
    dbLoadPolicy(storedId).then(session => {
      if (session?.policy) {
        setSavedMeta({
          id:         storedId,
          orgName:    session.org_name,
          policyType: session.policy_type,
          framework:  session.framework,
          policyRef:  session.policy_ref,
          updatedAt:  session.updated_at,
        });
        setStep("resume");
      } else {
        clearPolicyId(orgId);
        setStep("form");
      }
    }).catch(() => setStep("form"));
  }, [orgId]);

  async function generate() {
    if (!form.orgName||!form.industry||!form.size||!form.framework||!form.policyType) {
      setError(t.fillAllFields); return;
    }
    setError(""); setStep("loading");
    try {
      const res    = await fetch("/api/chat", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ messages:[{ role:"user", content:makePrompt(form,lang) }] })
      });
      if (!res.ok) throw new Error("API " + res.status);
      const data   = await res.json();
      const raw    = (data.content||[]).map(b=>b.text||"").join("");
      const parsed = safeJSON(raw);
      if (!parsed||!parsed.policyStatements) throw new Error(t.parseError);

      // Save to D1 (org-aware)
      setSaveStatus("saving");
      const sid = genPolicyId();
      savePolicyId(sid, orgId);
      await dbSavePolicy(sid, form, parsed, lang);
      setSaveStatus("saved");

      setPolicy(parsed); setStep("result");
    } catch(e) { setError("Error: "+e.message); setStep("form"); setSaveStatus("idle"); }
  }

  async function resumeSaved() {
    if (!savedMeta) return;
    setStep("checking");
    const session = await dbLoadPolicy(savedMeta.id);
    if (session?.policy) {
      setForm({
        orgName:    session.org_name,
        industry:   session.industry,
        size:       session.size,
        framework:  session.framework,
        policyType: session.policy_type,
      });
      setPolicy(session.policy);
      setSaveStatus("saved");
      setStep("result");
    } else {
      clearPolicyId(orgId);
      setStep("form");
    }
  }

  function startNew() {
    const oldId = loadPolicyId(orgId);
    if (oldId) dbDeletePolicy(oldId);
    clearPolicyId(orgId);
    setPolicy(null); setSavedMeta(null);
    setForm({ orgName: urlOrgName || "", industry:"", size:"", framework:"", policyType:"" });
    setStep("form");
  }

  function reset() {
    const id = loadPolicyId(orgId);
    if (id) dbDeletePolicy(id);
    clearPolicyId(orgId);
    setStep("form"); setPolicy(null); setError(""); setSaveStatus("idle"); setSavedMeta(null);
    setForm({ orgName: urlOrgName || "", industry:"", size:"", framework:"", policyType:"" });
  }

  // ── small helpers ──
  function Lbl({ children }) {
    return <label style={{display:"block",fontSize:11,fontWeight:700,color:"#64748b",
      marginBottom:6,textTransform:"uppercase",letterSpacing:"0.07em"}}>{children} *</label>;
  }
  function FSelect({ label, value, onChange, options, placeholder }) {
    return (
      <div>
        <Lbl>{label}</Lbl>
        <select value={value} onChange={e=>onChange(e.target.value)}
          style={{width:"100%",padding:"10px 13px",border:"1.5px solid #1e293b",borderRadius:9,
            fontSize:13,background:"#0f172a",color:value?"#e2e8f0":"#475569",
            fontFamily:"inherit",cursor:"pointer",textAlign:isRTL?"right":"left",boxSizing:"border-box"}}>
          <option value="">{placeholder}</option>
          {options.map(o=><option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }
  function Card({ accentColor, icon, title, children }) {
    return (
      <div style={{background:"#0f172a",border:"1px solid #1a2744",borderRadius:12,padding:20,marginBottom:12}}>
        <div style={{fontSize:10,fontWeight:700,color:"#475569",letterSpacing:"0.08em",
          textTransform:"uppercase",marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
          <span style={{width:3,height:13,background:accentColor,borderRadius:2,display:"inline-block"}}/>
          {icon} {title}
        </div>
        {children}
      </div>
    );
  }

  // ── CHECKING spinner ──────────────────────────────────────────────────────
  if (step==="checking") return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:300}}>
      <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
      <div style={{position:"relative",width:40,height:40}}>
        <div style={{position:"absolute",inset:0,borderRadius:"50%",border:"3px solid #1e293b"}}/>
        <div style={{position:"absolute",inset:0,borderRadius:"50%",border:"3px solid transparent",borderTopColor:"#0ea5e9",animation:"sp 0.9s linear infinite"}}/>
      </div>
    </div>
  );

  // ── RESUME banner ──────────────────────────────────────────────────────────
  if (step==="resume" && savedMeta) {
    const savedFw = FRAMEWORKS[savedMeta.framework] || { color:"#0ea5e9", badge:"?" };
    const savedMd = POLICY_CATALOGUE[savedMeta.policyType] || { icon:"📄" };
    const savedDate = savedMeta.updatedAt
      ? new Date(savedMeta.updatedAt).toLocaleDateString(isRTL?"ar-SA":"en-GB",{day:"numeric",month:"short",year:"numeric"})
      : "";
    return (
      <div style={{maxWidth:540}} dir={isRTL?"rtl":"ltr"}>
        <h2 style={{fontSize:22,fontWeight:900,color:"#f1f5f9",marginBottom:6}}>{t.policyTitle}</h2>
        <p style={{color:"#475569",fontSize:13,marginBottom:20}}>
          {isRTL?"أنشئ وثيقة سياسة احترافية وفق قالب SANS.":"Generate a complete professional policy document using the SANS Institute template."}
        </p>

        <div style={{background:"#0f172a",border:"1px solid #0ea5e940",borderRadius:14,padding:24,marginBottom:14,position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,#0ea5e9,#8b5cf6)"}}/>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
            <div style={{width:38,height:38,borderRadius:"50%",background:"linear-gradient(135deg,#0ea5e9,#0284c7)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>💾</div>
            <div>
              <div style={{fontSize:13,fontWeight:800,color:"#f1f5f9"}}>{isRTL?"سياسة محفوظة":"Saved Policy Found"}</div>
              <div style={{fontSize:11,color:"#475569"}}>{isRTL?"يمكنك استعادة وثيقتك الأخيرة":"Restore your last generated document"}</div>
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
            {[
              [isRTL?"المنظمة":"Organization",  savedMeta.orgName],
              [isRTL?"الإطار":"Framework",       savedMeta.framework],
              [isRTL?"نوع السياسة":"Policy",     savedMeta.policyType],
              [isRTL?"المرجع":"Reference",        savedMeta.policyRef || "—"],
            ].map(([l,v])=>(
              <div key={l} style={{background:"#080e1c",borderRadius:8,padding:"10px 12px"}}>
                <div style={{fontSize:10,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:3}}>{l}</div>
                <div style={{fontSize:13,fontWeight:700,color:"#e2e8f0",lineHeight:1.3}}>{v}</div>
              </div>
            ))}
          </div>

          {savedDate && (
            <div style={{fontSize:11,color:"#334155",marginBottom:14,display:"flex",alignItems:"center",gap:5}}>
              <span style={{color:"#22c55e"}}>●</span>
              {isRTL?"آخر حفظ: ":"Last saved: "}{savedDate} · Cloudflare D1
            </div>
          )}

          <div style={{display:"flex",gap:10}}>
            <button onClick={resumeSaved}
              style={{flex:1,padding:"11px",background:"linear-gradient(135deg,#0ea5e9,#0284c7)",border:"none",borderRadius:9,color:"#fff",fontSize:13,fontWeight:800,cursor:"pointer"}}>
              {savedMd.icon} {isRTL?"استعادة السياسة":"Restore Policy"}
            </button>
            <button onClick={startNew}
              style={{padding:"11px 16px",background:"#1e293b",border:"1px solid #334155",borderRadius:9,color:"#94a3b8",fontSize:13,fontWeight:700,cursor:"pointer"}}>
              {isRTL?"سياسة جديدة":"New Policy"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── FORM ──────────────────────────────────────────────────────────────────
  if (step==="form"||step==="loading") return (
    <div style={{maxWidth:680,animation:"fadeUp 0.3s ease"}} dir={isRTL?"rtl":"ltr"}>
      <div style={{marginBottom:22}}>
        <h2 style={{fontSize:22,fontWeight:900,color:"#f1f5f9",marginBottom:6}}>{t.policyTitle}</h2>
        <p style={{color:"#475569",fontSize:13,lineHeight:1.7}}>
          {isRTL
            ? "أنشئ وثيقة سياسة احترافية وفق قالب SANS — مع تصدير Word باسم شركتك."
            : "Generate a complete professional policy document using the SANS Institute template — exported as a branded Word file."}
        </p>
      </div>

      {/* Banner */}
      <div style={{background:"#0f172a",border:"1px solid #1a2744",borderRadius:11,
        padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
        <div style={{width:40,height:40,borderRadius:9,background:"linear-gradient(135deg,#0ea5e9,#0284c7)",
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>📄</div>
        <div style={{flex:1}}>
          <div style={{fontSize:12,fontWeight:800,color:"#e2e8f0"}}>
            {isRTL?"قالب SANS المعياري":"SANS Institute Policy Template"}
          </div>
          <div style={{fontSize:11,color:"#475569",marginTop:2}}>
            {isRTL
              ?"الغرض · النطاق · الأدوار · بنود السياسة · التوافق التنظيمي · التعريفات · سجل المراجعات"
              :"Purpose · Scope · Roles · Policy Statements · Framework Mapping · Definitions · Revision History"}
          </div>
        </div>
        <div style={{padding:"4px 10px",background:"#10b98115",color:"#10b981",
          border:"1px solid #10b98130",borderRadius:6,fontSize:10,fontWeight:700,flexShrink:0}}>
          ⬇ .doc
        </div>
      </div>

      {/* Form card */}
      <div style={{background:"#0f172a",border:"1px solid #1a2744",borderRadius:14,padding:24,marginBottom:16}}>
        <div style={{fontSize:10,fontWeight:800,color:"#334155",letterSpacing:"0.1em",
          textTransform:"uppercase",marginBottom:20,display:"flex",alignItems:"center",gap:8}}>
          <span style={{width:3,height:13,background:"#0ea5e9",borderRadius:2,display:"inline-block"}}/>
          {t.orgDetails}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <div style={{gridColumn:"1/-1"}}>
            <Lbl>{t.orgName}</Lbl>
            <input value={form.orgName} onChange={e=>setForm(f=>({...f,orgName:e.target.value}))}
              placeholder={t.orgNamePlaceholder}
              style={{width:"100%",padding:"10px 13px",border:"1.5px solid #1e293b",borderRadius:9,
                fontSize:13,background:"#0f172a",color:"#e2e8f0",fontFamily:"inherit",
                textAlign:isRTL?"right":"left",boxSizing:"border-box"}}/>
          </div>
          <FSelect label={t.industry}            value={form.industry}   onChange={v=>setForm(f=>({...f,industry:v}))}   options={t.industries}            placeholder={t.industryPlaceholder}/>
          <FSelect label={t.orgSize}             value={form.size}       onChange={v=>setForm(f=>({...f,size:v}))}       options={t.orgSizes}              placeholder={t.orgSizePlaceholder}/>
          <FSelect label={t.complianceFramework} value={form.framework}  onChange={v=>setForm(f=>({...f,framework:v}))}  options={Object.keys(FRAMEWORKS)} placeholder={t.frameworkPlaceholder}/>
        </div>
        {/* Grouped policy type selector — 20 policies across 7 categories */}
        <div style={{marginTop:16}}>
          <label style={{display:"block",fontSize:11,fontWeight:700,color:"#64748b",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.07em"}}>{t.policyType} *</label>
          <select value={form.policyType} onChange={e=>setForm(f=>({...f,policyType:e.target.value}))}
            style={{width:"100%",padding:"10px 13px",border:"1.5px solid #1e293b",borderRadius:9,
              fontSize:13,background:"#0f172a",color:form.policyType?"#e2e8f0":"#475569",
              fontFamily:"inherit",cursor:"pointer",textAlign:isRTL?"right":"left",boxSizing:"border-box"}}>
            <option value="">{t.policyTypePlaceholder}</option>
            {POLICY_GROUPS.map(g=>(
              <optgroup key={g.group} label={isRTL?g.groupAr:g.group}>
                {g.policies.map(p=>(
                  <option key={p} value={p}>{POLICY_CATALOGUE[p]?.icon} {p}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {form.policyType && (
          <div style={{marginTop:14,padding:"12px 14px",background:fw.color+"08",
            border:`1px solid ${fw.color}20`,borderRadius:9,display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontSize:22}}>{polMeta.icon}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:800,color:fw.color}}>
                {polMeta.ref} — {form.policyType}
              </div>
              <div style={{fontSize:11,color:"#475569",marginTop:2,display:"flex",gap:10,flexWrap:"wrap"}}>
                <span>SANS: {polMeta.sans}</span>
                {polMeta.iso&&<span style={{color:"#0ea5e9"}}>ISO {polMeta.iso}</span>}
                {polMeta.pci&&<span style={{color:"#f59e0b"}}>PCI Req.{polMeta.pci}</span>}
                {form.orgName&&<span style={{color:"#64748b"}}>· {form.orgName}</span>}
              </div>
            </div>
            <span style={{padding:"2px 8px",background:fw.color+"20",color:fw.color,
              borderRadius:4,fontSize:10,fontWeight:700}}>{fw.badge}</span>
          </div>
        )}

        {error&&<div style={{marginTop:14,padding:"10px 13px",background:"#7f1d1d20",
          border:"1px solid #ef444440",borderRadius:8,color:"#fca5a5",fontSize:12}}>{error}</div>}
      </div>

      {step==="loading"
        ?<div style={{background:"#0f172a",border:"1px solid #1a2744",borderRadius:14,
            padding:"48px 20px",display:"flex",flexDirection:"column",alignItems:"center",gap:16}}>
           <div style={{position:"relative",width:52,height:52}}>
             <div style={{position:"absolute",inset:0,borderRadius:"50%",border:"3px solid #1e293b"}}/>
             <div style={{position:"absolute",inset:0,borderRadius:"50%",border:"3px solid transparent",
               borderTopColor:"#0ea5e9",animation:"sp 0.9s linear infinite"}}/>
             <div style={{position:"absolute",inset:8,borderRadius:"50%",border:"2px solid transparent",
               borderTopColor:"#8b5cf6",animation:"sp 0.7s linear infinite reverse"}}/>
           </div>
           <div style={{textAlign:"center"}}>
             <div style={{fontWeight:700,color:"#e2e8f0"}}>
               {isRTL?"جارٍ كتابة السياسة…":"Writing policy document…"}
             </div>
             <div style={{fontSize:12,color:"#475569",marginTop:4}}>
               {isRTL?"تطبيق قالب SANS":"Applying SANS template"}
             </div>
           </div>
         </div>
        :<button onClick={generate}
           style={{width:"100%",padding:14,background:"linear-gradient(135deg,#0ea5e9,#0284c7)",
             border:"none",borderRadius:11,color:"#fff",fontSize:14,fontWeight:800,
             cursor:"pointer",fontFamily:"inherit",boxShadow:"0 4px 16px #0ea5e930"}}>
           ▶ {isRTL?"إنشاء وثيقة السياسة":"Generate Policy Document"}
         </button>
      }
    </div>
  );

  // ── RESULT ────────────────────────────────────────────────────────────────
  if (!policy) return null;

  return (
    <div style={{maxWidth:820,animation:"fadeUp 0.3s ease"}} dir={isRTL?"rtl":"ltr"}>

      {/* Action bar */}
      <div style={{display:"flex",gap:10,marginBottom:18,alignItems:"center",flexWrap:"wrap"}}>
        <button onClick={startNew}
          style={{padding:"8px 14px",background:"#0f172a",border:"1px solid #1e293b",
            borderRadius:9,fontSize:12,fontWeight:700,color:"#94a3b8",cursor:"pointer"}}>
          {isRTL?"→ سياسة جديدة":"← New Policy"}
        </button>
        {/* D1 save status */}
        <div style={{display:"flex",alignItems:"center",gap:5,padding:"5px 10px",
          background:"#0f172a",border:"1px solid #1a2744",borderRadius:7}}>
          <style>{`@keyframes sp2{to{transform:rotate(360deg)}}`}</style>
          {saveStatus==="saving" && <div style={{width:6,height:6,borderRadius:"50%",border:"2px solid transparent",borderTopColor:"#f59e0b",animation:"sp2 0.8s linear infinite"}}/>}
          {saveStatus==="saved"  && <span style={{color:"#22c55e",fontSize:10}}>●</span>}
          {saveStatus==="idle"   && <span style={{color:"#475569",fontSize:10}}>●</span>}
          <span style={{fontSize:10,fontWeight:700,color:saveStatus==="saved"?"#22c55e":saveStatus==="saving"?"#f59e0b":"#475569"}}>
            {saveStatus==="saving"?(isRTL?"حفظ…":"Saving…"):saveStatus==="saved"?(isRTL?"محفوظ في D1":"Saved to D1"):"D1"}
          </span>
        </div>
        <div style={{flex:1}}/>
        <button onClick={()=>downloadWord(policy,form.orgName,form.framework,form.policyType,lang)}
          style={{padding:"9px 20px",background:"linear-gradient(135deg,#10b981,#059669)",
            border:"none",borderRadius:9,fontSize:13,fontWeight:800,color:"#fff",
            cursor:"pointer",display:"flex",alignItems:"center",gap:8,boxShadow:"0 4px 14px #10b98130"}}>
          ⬇ {isRTL?"تحميل Word (.doc)":"Download Word (.doc)"}
        </button>
      </div>

      {/* Header */}
      <div style={{background:"linear-gradient(135deg,#0f172a,#1a2744)",border:"1px solid #1e293b",
        borderRadius:14,padding:"26px 28px",marginBottom:14,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-40,right:-40,width:180,height:180,
          background:fw.color+"0a",borderRadius:"50%",pointerEvents:"none"}}/>
        <div style={{position:"relative"}}>
          <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:14}}>
            {[policy.policyRef,`v${policy.version}`,policy.classification,form.framework].map(tag=>(
              <span key={tag} style={{padding:"3px 10px",background:"#ffffff10",color:"#94a3b8",
                borderRadius:5,fontSize:11,fontWeight:700}}>{tag}</span>
            ))}
          </div>
          <div style={{fontSize:21,fontWeight:900,color:"#f1f5f9",marginBottom:5,lineHeight:1.2}}>
            {policy.policyTitle}
          </div>
          <div style={{fontSize:12,color:"#475569",marginBottom:18,fontWeight:600}}>
            {form.orgName} · {form.industry} · {form.size}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
            {[
              [isRTL?"ساري من":"Effective",     policy.effectiveDate],
              [isRTL?"مراجعة":"Review",          policy.reviewDate],
              [isRTL?"مالك السياسة":"Owner",     policy.owner],
              [isRTL?"المعتمِد":"Approver",       policy.approver],
            ].map(([lbl,val])=>(
              <div key={lbl}>
                <div style={{color:"#334155",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em"}}>{lbl}</div>
                <div style={{color:"#cbd5e1",fontSize:11,fontWeight:600,marginTop:3,lineHeight:1.4}}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 1. Purpose */}
      <Card accentColor="#0ea5e9" icon="🎯" title={isRTL?"1. الغرض":"1. Purpose"}>
        <p style={{fontSize:13,color:"#94a3b8",lineHeight:1.8,margin:0}}>{policy.purpose}</p>
      </Card>

      {/* 2. Scope */}
      <Card accentColor="#8b5cf6" icon="🔭" title={isRTL?"2. النطاق":"2. Scope"}>
        <p style={{fontSize:13,color:"#94a3b8",lineHeight:1.8,margin:0}}>{policy.scope}</p>
      </Card>

      {/* 3. Roles */}
      <Card accentColor="#f59e0b" icon="👥" title={isRTL?"3. الأدوار والمسؤوليات":"3. Roles & Responsibilities"}>
        <div style={{display:"flex",flexDirection:"column",gap:7}}>
          {(policy.roles||[]).map((r,i)=>(
            <div key={i} style={{display:"flex",borderRadius:9,overflow:"hidden",border:"1px solid #1a2744"}}>
              <div style={{padding:"10px 14px",background:"#f59e0b10",minWidth:160,fontSize:12,
                fontWeight:800,color:"#f59e0b",flexShrink:0,
                borderRight:isRTL?"none":"1px solid #1a2744",
                borderLeft:isRTL?"1px solid #1a2744":"none"}}>
                {r.role}
              </div>
              <div style={{padding:"10px 14px",fontSize:12,color:"#64748b",lineHeight:1.6,background:"#080e1c"}}>
                {r.responsibility}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 4. Policy Statements */}
      <Card accentColor="#10b981" icon="📋" title={isRTL?"4. بنود السياسة":"4. Policy Statements"}>
        <div style={{padding:"9px 13px",background:"#f59e0b08",border:"1px solid #f59e0b20",
          borderRadius:8,fontSize:11,color:"#f59e0b",marginBottom:14}}>
          {isRTL
            ?"جميع البنود إلزامية — يجب / يُحظر متطلبات غير قابلة للتفاوض."
            :"All statements are mandatory — SHALL / MUST / MUST NOT are non-negotiable requirements."}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {(policy.policyStatements||[]).map((sec,i)=>(
            <div key={i} style={{background:"#080e1c",borderRadius:10,padding:"14px 16px",border:"1px solid #1a2744"}}>
              <div style={{fontSize:13,fontWeight:800,color:"#e2e8f0",marginBottom:10,
                display:"flex",alignItems:"center",gap:8}}>
                <span style={{width:22,height:22,borderRadius:6,background:"#10b98120",
                  display:"inline-flex",alignItems:"center",justifyContent:"center",
                  fontSize:10,fontWeight:800,color:"#10b981",flexShrink:0}}>{i+1}</span>
                {sec.sectionTitle}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:7}}>
                {(sec.statements||[]).map((stmt,j)=>(
                  <div key={j} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                    <span style={{color:"#10b981",fontSize:12,fontWeight:900,flexShrink:0,marginTop:2}}>→</span>
                    <span style={{fontSize:12,color:"#64748b",lineHeight:1.7}}>{stmt}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 5. Framework Mapping */}
      <Card accentColor={fw.color} icon="🗺️"
        title={isRTL?`5. التوافق مع ${form.framework}`:`5. ${form.framework} Framework Mapping`}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
          <span style={{padding:"3px 10px",background:fw.color+"20",color:fw.color,
            borderRadius:5,fontSize:11,fontWeight:700}}>{fw.badge}</span>
        </div>
        <p style={{fontSize:13,color:"#94a3b8",lineHeight:1.8,margin:0}}>{policy.frameworkMapping}</p>
      </Card>

      {/* 6. Exceptions & Enforcement */}
      <Card accentColor="#ef4444" icon="⚖️" title={isRTL?"6. الاستثناءات والإنفاذ":"6. Exceptions & Enforcement"}>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div style={{padding:"12px 14px",background:"#f59e0b08",border:"1px solid #f59e0b25",borderRadius:9}}>
            <div style={{fontSize:11,fontWeight:700,color:"#f59e0b",marginBottom:5,textTransform:"uppercase"}}>
              {isRTL?"الاستثناءات":"Exceptions"}
            </div>
            <p style={{fontSize:12,color:"#94a3b8",lineHeight:1.7,margin:0}}>{policy.exceptions}</p>
          </div>
          <div style={{padding:"12px 14px",background:"#ef444408",border:"1px solid #ef444425",borderRadius:9}}>
            <div style={{fontSize:11,fontWeight:700,color:"#ef4444",marginBottom:5,textTransform:"uppercase"}}>
              {isRTL?"الإنفاذ":"Enforcement"}
            </div>
            <p style={{fontSize:12,color:"#94a3b8",lineHeight:1.7,margin:0}}>{policy.enforcement}</p>
          </div>
        </div>
      </Card>

      {/* 7. Definitions */}
      <Card accentColor="#6366f1" icon="📖" title={isRTL?"7. التعريفات":"7. Definitions"}>
        <div style={{display:"flex",flexDirection:"column",gap:7}}>
          {(policy.definitions||[]).map((d,i)=>(
            <div key={i} style={{display:"flex",borderRadius:8,overflow:"hidden",border:"1px solid #1a2744"}}>
              <div style={{padding:"10px 14px",background:"#6366f110",minWidth:150,fontSize:12,
                fontWeight:800,color:"#6366f1",flexShrink:0,
                borderRight:isRTL?"none":"1px solid #1a2744",
                borderLeft:isRTL?"1px solid #1a2744":"none"}}>
                {d.term}
              </div>
              <div style={{padding:"10px 14px",fontSize:12,color:"#64748b",lineHeight:1.65,background:"#080e1c"}}>
                {d.definition}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 8. Related Documents */}
      <Card accentColor="#0ea5e9" icon="🔗" title={isRTL?"8. الوثائق ذات الصلة":"8. Related Documents"}>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {(policy.relatedDocuments||[]).map((doc,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",
              background:"#080e1c",borderRadius:8,border:"1px solid #1a2744"}}>
              <span style={{color:"#0ea5e9",flexShrink:0}}>📄</span>
              <span style={{fontSize:12,color:"#64748b"}}>{doc}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Download CTA */}
      <div style={{background:"linear-gradient(135deg,#064e3b,#065f46)",border:"1px solid #10b98130",
        borderRadius:12,padding:"18px 22px",display:"flex",alignItems:"center",gap:16,marginTop:4}}>
        <div style={{flex:1}}>
          <div style={{fontWeight:800,color:"#f1f5f9",marginBottom:3}}>
            {isRTL?"الوثيقة جاهزة للتحميل":"Your policy document is ready"}
          </div>
          <div style={{fontSize:11,color:"#6ee7b7"}}>
            {form.orgName} · {polMeta.ref} · Word (.doc)
          </div>
        </div>
        <button onClick={()=>downloadWord(policy,form.orgName,form.framework,form.policyType,lang)}
          style={{padding:"11px 26px",background:"#10b981",border:"none",borderRadius:9,
            color:"#fff",fontSize:13,fontWeight:800,cursor:"pointer",flexShrink:0}}>
          ⬇ {isRTL?"تحميل Word":"Download Word"}
        </button>
      </div>
    </div>
  );
}
