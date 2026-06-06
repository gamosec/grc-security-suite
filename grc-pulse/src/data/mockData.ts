// ============================================================================
// SENTIENT GRC - MOCK DATA FOR DEMONSTRATION
// ============================================================================

// Risk data with business context
export const risks = [
  {
    id: "risk-001",
    title: "SQL Injection Vulnerability in Payment API",
    description: "Critical SQL injection vulnerability discovered in the payment processing API endpoint",
    category: "vulnerability",
    riskSource: "vulnerability_scan",
    externalReference: "CVE-2024-1234",
    affectedAsset: {
      id: "asset-001",
      name: "payment-api-prod",
      type: "application",
      criticality: "critical"
    },
    inherentLikelihood: 0.8,
    inherentImpact: 0.95,
    inherentScore: 76,
    residualScore: 25,
    businessImpactScore: 95,
    contextPriorityScore: 92,
    contextPriorityReason: "Affects Payment Processing ($50K/hr revenue impact), 3 customer-facing processes",
    financialExposure: 2500000,
    affectedProcesses: [
      { name: "Payment Processing", revenueImpact: 50000, isRevenue: true },
      { name: "Order Management", revenueImpact: 25000, isRevenue: true },
      { name: "Customer Portal", revenueImpact: 10000, isRevenue: true }
    ],
    status: "open",
    dueDate: "2024-12-30",
    assignee: { name: "Sarah Chen", department: "Security" }
  },
  {
    id: "risk-002",
    title: "Outdated SSL Certificate on Customer Portal",
    description: "SSL certificate using deprecated TLS 1.1 protocol",
    category: "configuration",
    riskSource: "audit_finding",
    affectedAsset: {
      id: "asset-002",
      name: "customer-portal",
      type: "application",
      criticality: "high"
    },
    inherentLikelihood: 0.6,
    inherentImpact: 0.7,
    inherentScore: 42,
    residualScore: 15,
    businessImpactScore: 68,
    contextPriorityScore: 71,
    contextPriorityReason: "Customer-facing application, regulatory compliance requirement (PCI-DSS)",
    financialExposure: 500000,
    affectedProcesses: [
      { name: "Customer Portal", revenueImpact: 10000, isRevenue: true },
      { name: "Support Ticketing", revenueImpact: 0, isRevenue: false }
    ],
    status: "in_progress",
    dueDate: "2025-01-15",
    assignee: { name: "Mike Johnson", department: "IT Operations" }
  },
  {
    id: "risk-003",
    title: "Unencrypted PII in Analytics Database",
    description: "Personal identifiable information stored without encryption in the analytics cluster",
    category: "compliance",
    riskSource: "self_assessment",
    affectedAsset: {
      id: "asset-003",
      name: "analytics-db-cluster",
      type: "database",
      criticality: "high"
    },
    inherentLikelihood: 0.4,
    inherentImpact: 0.9,
    inherentScore: 36,
    residualScore: 36,
    businessImpactScore: 82,
    contextPriorityScore: 78,
    contextPriorityReason: "Contains PII, GDPR Article 32 violation, potential €20M fine",
    financialExposure: 20000000,
    affectedProcesses: [
      { name: "Customer Analytics", revenueImpact: 5000, isRevenue: false },
      { name: "Marketing Campaigns", revenueImpact: 15000, isRevenue: true }
    ],
    status: "open",
    dueDate: "2025-02-01",
    assignee: { name: "Emily Davis", department: "Data Protection" }
  },
  {
    id: "risk-004",
    title: "Missing MFA on Admin Accounts",
    description: "Administrative accounts lack multi-factor authentication",
    category: "configuration",
    riskSource: "penetration_test",
    affectedAsset: {
      id: "asset-004",
      name: "identity-provider",
      type: "application",
      criticality: "critical"
    },
    inherentLikelihood: 0.5,
    inherentImpact: 0.85,
    inherentScore: 43,
    residualScore: 20,
    businessImpactScore: 90,
    contextPriorityScore: 85,
    contextPriorityReason: "Gateway to all critical systems, SOC2 CC6.1 control gap",
    financialExposure: 5000000,
    affectedProcesses: [
      { name: "All Business Processes", revenueImpact: 100000, isRevenue: true }
    ],
    status: "in_progress",
    dueDate: "2024-12-28",
    assignee: { name: "James Wilson", department: "Security" }
  },
  {
    id: "risk-005",
    title: "Log4j Vulnerability in Legacy System",
    description: "CVE-2021-44228 (Log4Shell) present in legacy inventory system",
    category: "vulnerability",
    riskSource: "vulnerability_scan",
    externalReference: "CVE-2021-44228",
    affectedAsset: {
      id: "asset-005",
      name: "legacy-inventory",
      type: "application",
      criticality: "medium"
    },
    inherentLikelihood: 0.7,
    inherentImpact: 0.8,
    inherentScore: 56,
    residualScore: 40,
    businessImpactScore: 45,
    contextPriorityScore: 52,
    contextPriorityReason: "Internal system only, no customer data, limited blast radius",
    financialExposure: 100000,
    affectedProcesses: [
      { name: "Inventory Management", revenueImpact: 2000, isRevenue: false }
    ],
    status: "open",
    dueDate: "2025-01-30",
    assignee: { name: "Tom Brown", department: "IT Operations" }
  }
];

// Vendor data
export const vendors = [
  {
    id: "vendor-001",
    name: "Stripe",
    tier: "critical",
    vendorType: "SaaS",
    hasDataAccess: true,
    dataTypesAccessed: ["PCI", "Financial"],
    currentRiskScore: 15,
    certifications: ["SOC2", "PCI_DSS", "ISO27001"],
    status: "active",
    affectedProcesses: ["Payment Processing", "Subscription Management"],
    contractValue: 250000,
    revenueAtRisk: 50000
  },
  {
    id: "vendor-002",
    name: "AWS",
    tier: "critical",
    vendorType: "IaaS",
    hasDataAccess: true,
    dataTypesAccessed: ["PII", "PHI", "Financial", "Proprietary"],
    currentRiskScore: 12,
    certifications: ["SOC2", "ISO27001", "HIPAA", "FedRAMP"],
    status: "active",
    affectedProcesses: ["All Infrastructure", "Data Storage", "Compute"],
    contractValue: 1200000,
    revenueAtRisk: 150000
  },
  {
    id: "vendor-003",
    name: "Salesforce",
    tier: "high",
    vendorType: "SaaS",
    hasDataAccess: true,
    dataTypesAccessed: ["PII", "Financial"],
    currentRiskScore: 18,
    certifications: ["SOC2", "ISO27001"],
    status: "active",
    affectedProcesses: ["Sales Pipeline", "Customer Management"],
    contractValue: 180000,
    revenueAtRisk: 35000
  },
  {
    id: "vendor-004",
    name: "Datadog",
    tier: "medium",
    vendorType: "SaaS",
    hasDataAccess: false,
    dataTypesAccessed: ["Logs", "Metrics"],
    currentRiskScore: 22,
    certifications: ["SOC2"],
    status: "active",
    affectedProcesses: ["Monitoring", "Observability"],
    contractValue: 75000,
    revenueAtRisk: 5000
  },
  {
    id: "vendor-005",
    name: "Acme Consulting",
    tier: "low",
    vendorType: "Consultant",
    hasDataAccess: false,
    dataTypesAccessed: [],
    currentRiskScore: 45,
    certifications: [],
    status: "under_review",
    affectedProcesses: ["Project Management"],
    contractValue: 50000,
    revenueAtRisk: 0
  }
];

// Vendor incidents
export const vendorIncidents = [
  {
    id: "incident-001",
    vendorId: "vendor-003",
    vendorName: "Salesforce",
    incidentType: "outage",
    severity: "high",
    title: "Salesforce Service Degradation - EMEA Region",
    description: "Intermittent connectivity issues affecting EMEA customers",
    source: "vendor_notification",
    detectedAt: "2024-12-23T14:30:00Z",
    status: "monitoring",
    ourDataAffected: false,
    estimatedImpact: "Sales team productivity reduced by 30%"
  },
  {
    id: "incident-002",
    vendorId: "vendor-004",
    vendorName: "Datadog",
    incidentType: "breach",
    severity: "medium",
    title: "Datadog Reports Unauthorized Access to Customer Metadata",
    description: "Third-party accessed customer organization names and billing contacts",
    source: "news",
    sourceUrl: "https://example.com/datadog-incident",
    detectedAt: "2024-12-20T09:00:00Z",
    status: "investigating",
    ourDataAffected: true,
    estimatedImpact: "Organization name and admin email potentially exposed"
  }
];

// Business processes for graph visualization
export const businessProcesses = [
  {
    id: "bp-001",
    name: "Payment Processing",
    criticality: "critical",
    isRevenueGenerating: true,
    isCustomerFacing: true,
    revenueImpactPerHour: 50000,
    rtoHours: 1,
    assets: ["asset-001", "asset-006", "asset-007"],
    vendors: ["vendor-001", "vendor-002"]
  },
  {
    id: "bp-002",
    name: "Customer Portal",
    criticality: "high",
    isRevenueGenerating: true,
    isCustomerFacing: true,
    revenueImpactPerHour: 10000,
    rtoHours: 4,
    assets: ["asset-002", "asset-008"],
    vendors: ["vendor-002"]
  },
  {
    id: "bp-003",
    name: "Order Management",
    criticality: "high",
    isRevenueGenerating: true,
    isCustomerFacing: false,
    revenueImpactPerHour: 25000,
    rtoHours: 2,
    assets: ["asset-001", "asset-009"],
    vendors: ["vendor-002", "vendor-003"]
  },
  {
    id: "bp-004",
    name: "Customer Analytics",
    criticality: "medium",
    isRevenueGenerating: false,
    isCustomerFacing: false,
    revenueImpactPerHour: 5000,
    rtoHours: 24,
    assets: ["asset-003", "asset-010"],
    vendors: ["vendor-002", "vendor-004"]
  },
  {
    id: "bp-005",
    name: "Inventory Management",
    criticality: "medium",
    isRevenueGenerating: false,
    isCustomerFacing: false,
    revenueImpactPerHour: 2000,
    rtoHours: 8,
    assets: ["asset-005"],
    vendors: []
  }
];

// Assets for graph visualization
export const assets = [
  {
    id: "asset-001",
    name: "payment-api-prod",
    type: "application",
    cloudProvider: "aws",
    region: "us-east-1",
    criticality: "critical",
    containsPii: false,
    containsPci: true,
    status: "active",
    dependencies: ["asset-006", "asset-007"],
    riskCount: 1
  },
  {
    id: "asset-002",
    name: "customer-portal",
    type: "application",
    cloudProvider: "aws",
    region: "us-east-1",
    criticality: "high",
    containsPii: true,
    containsPci: false,
    status: "active",
    dependencies: ["asset-008"],
    riskCount: 1
  },
  {
    id: "asset-003",
    name: "analytics-db-cluster",
    type: "database",
    cloudProvider: "aws",
    region: "us-west-2",
    criticality: "high",
    containsPii: true,
    containsPci: false,
    status: "active",
    dependencies: [],
    riskCount: 1
  },
  {
    id: "asset-004",
    name: "identity-provider",
    type: "application",
    cloudProvider: "azure",
    region: "eastus",
    criticality: "critical",
    containsPii: true,
    containsPci: false,
    status: "active",
    dependencies: [],
    riskCount: 1
  },
  {
    id: "asset-005",
    name: "legacy-inventory",
    type: "application",
    cloudProvider: "on_premise",
    region: "datacenter-1",
    criticality: "medium",
    containsPii: false,
    containsPci: false,
    status: "active",
    dependencies: [],
    riskCount: 1
  },
  {
    id: "asset-006",
    name: "payment-db",
    type: "database",
    cloudProvider: "aws",
    region: "us-east-1",
    criticality: "critical",
    containsPii: false,
    containsPci: true,
    status: "active",
    dependencies: [],
    riskCount: 0
  },
  {
    id: "asset-007",
    name: "payment-cache",
    type: "database",
    cloudProvider: "aws",
    region: "us-east-1",
    criticality: "high",
    containsPii: false,
    containsPci: false,
    status: "active",
    dependencies: [],
    riskCount: 0
  }
];

// Compliance frameworks and controls
export const complianceStatus = {
  frameworks: [
    {
      code: "SOC2",
      name: "SOC 2 Type II",
      totalControls: 64,
      implementedControls: 58,
      partialControls: 4,
      gapControls: 2,
      lastAudit: "2024-06-15",
      nextAudit: "2025-06-15"
    },
    {
      code: "ISO27001",
      name: "ISO/IEC 27001:2022",
      totalControls: 93,
      implementedControls: 82,
      partialControls: 8,
      gapControls: 3,
      lastAudit: "2024-03-20",
      nextAudit: "2025-03-20"
    },
    {
      code: "GDPR",
      name: "GDPR",
      totalControls: 45,
      implementedControls: 40,
      partialControls: 3,
      gapControls: 2,
      lastAudit: null,
      nextAudit: null
    },
    {
      code: "PCI_DSS",
      name: "PCI DSS 4.0",
      totalControls: 78,
      implementedControls: 72,
      partialControls: 4,
      gapControls: 2,
      lastAudit: "2024-09-10",
      nextAudit: "2025-09-10"
    }
  ],
  topGaps: [
    { framework: "SOC2", requirement: "CC6.1", title: "Logical Access Security", status: "gap" },
    { framework: "ISO27001", requirement: "A.8.24", title: "Use of Cryptography", status: "gap" },
    { framework: "GDPR", requirement: "Art. 32", title: "Security of Processing", status: "gap" }
  ]
};

// Dashboard metrics
export const dashboardMetrics = {
  riskSummary: {
    critical: 2,
    high: 8,
    medium: 15,
    low: 23,
    total: 48,
    trend: -5, // 5% decrease
    averageAge: 18 // days
  },
  financialExposure: {
    total: 28100000,
    byCategory: {
      vulnerability: 7600000,
      compliance: 20500000,
      configuration: 0
    },
    trend: -12 // 12% decrease
  },
  vendorRisk: {
    criticalVendors: 2,
    highRiskVendors: 1,
    pendingAssessments: 3,
    overdueAssessments: 1,
    activeIncidents: 2
  },
  complianceHealth: {
    overallScore: 89,
    trend: 3,
    upcomingAudits: 2,
    controlsNeedingReview: 12
  },
  recentActivity: [
    { type: "risk_created", title: "New vulnerability detected", time: "2 hours ago" },
    { type: "vendor_incident", title: "Datadog security incident reported", time: "4 hours ago" },
    { type: "control_updated", title: "MFA control implemented", time: "1 day ago" },
    { type: "assessment_completed", title: "Stripe annual assessment completed", time: "2 days ago" },
    { type: "risk_resolved", title: "Legacy encryption issue fixed", time: "3 days ago" }
  ]
};

// Graph nodes and edges for React Flow visualization
export const graphData = {
  nodes: [
    // Business Processes (top layer)
    { id: "bp-001", type: "process", position: { x: 100, y: 50 }, data: { label: "Payment Processing", criticality: "critical", revenue: "$50K/hr" } },
    { id: "bp-002", type: "process", position: { x: 400, y: 50 }, data: { label: "Customer Portal", criticality: "high", revenue: "$10K/hr" } },
    { id: "bp-003", type: "process", position: { x: 700, y: 50 }, data: { label: "Order Management", criticality: "high", revenue: "$25K/hr" } },
    
    // Assets (middle layer)
    { id: "asset-001", type: "asset", position: { x: 50, y: 200 }, data: { label: "payment-api-prod", type: "application", risks: 1 } },
    { id: "asset-006", type: "asset", position: { x: 200, y: 200 }, data: { label: "payment-db", type: "database", risks: 0 } },
    { id: "asset-002", type: "asset", position: { x: 400, y: 200 }, data: { label: "customer-portal", type: "application", risks: 1 } },
    { id: "asset-009", type: "asset", position: { x: 650, y: 200 }, data: { label: "order-service", type: "application", risks: 0 } },
    
    // Vendors (bottom layer)
    { id: "vendor-001", type: "vendor", position: { x: 100, y: 350 }, data: { label: "Stripe", tier: "critical", score: 15 } },
    { id: "vendor-002", type: "vendor", position: { x: 350, y: 350 }, data: { label: "AWS", tier: "critical", score: 12 } },
    { id: "vendor-003", type: "vendor", position: { x: 600, y: 350 }, data: { label: "Salesforce", tier: "high", score: 18 } },
    
    // Risks (overlay)
    { id: "risk-001", type: "risk", position: { x: 50, y: 300 }, data: { label: "SQL Injection", score: 92, status: "open" } }
  ],
  edges: [
    // Process -> Asset relationships
    { id: "e1", source: "bp-001", target: "asset-001", type: "smoothstep", animated: true, label: "uses" },
    { id: "e2", source: "bp-001", target: "asset-006", type: "smoothstep", label: "uses" },
    { id: "e3", source: "bp-002", target: "asset-002", type: "smoothstep", animated: true, label: "uses" },
    { id: "e4", source: "bp-003", target: "asset-009", type: "smoothstep", label: "uses" },
    { id: "e5", source: "bp-003", target: "asset-001", type: "smoothstep", label: "uses" },
    
    // Asset -> Asset dependencies
    { id: "e6", source: "asset-001", target: "asset-006", type: "smoothstep", style: { strokeDasharray: "5,5" }, label: "depends_on" },
    
    // Asset -> Vendor relationships
    { id: "e7", source: "asset-001", target: "vendor-001", type: "smoothstep", label: "provided_by" },
    { id: "e8", source: "asset-001", target: "vendor-002", type: "smoothstep", label: "hosted_on" },
    { id: "e9", source: "asset-002", target: "vendor-002", type: "smoothstep", label: "hosted_on" },
    { id: "e10", source: "asset-009", target: "vendor-003", type: "smoothstep", label: "integrates" },
    
    // Risk -> Asset
    { id: "e11", source: "risk-001", target: "asset-001", type: "smoothstep", style: { stroke: "#ef4444" }, label: "affects" }
  ]
};

// AI Questionnaire sample data
export const questionnaireData = {
  session: {
    id: "session-001",
    name: "Acme Corp Security Assessment RFP",
    status: "in_progress",
    totalQuestions: 45,
    answeredQuestions: 32,
    autoAnsweredQuestions: 28,
    dueDate: "2025-01-15"
  },
  questions: [
    {
      id: "q-001",
      number: "1.1",
      section: "Access Control",
      question: "Does your organization enforce multi-factor authentication (MFA) for all privileged accounts?",
      aiResponse: "Yes, our organization enforces multi-factor authentication (MFA) for all privileged and administrative accounts. We utilize Okta as our identity provider with TOTP-based MFA. All access to production systems, cloud consoles (AWS, Azure), and administrative interfaces requires MFA. This is documented in our Access Control Policy (POL-AC-001) and validated through quarterly access reviews.",
      aiConfidence: 0.95,
      sourcePolicies: ["Access Control Policy", "Identity Management Standard"],
      sourceControls: ["AC-2", "IA-2"],
      isApproved: true,
      reviewedBy: "Sarah Chen"
    },
    {
      id: "q-002",
      number: "1.2",
      section: "Access Control",
      question: "How do you manage and review user access rights?",
      aiResponse: "User access rights are managed through a formal access management process:\n\n1. **Provisioning**: Access is granted based on job role using role-based access control (RBAC)\n2. **Quarterly Reviews**: All access rights are reviewed quarterly by system owners\n3. **Automated Deprovisioning**: Access is automatically revoked within 24 hours of employment termination\n4. **Privileged Access**: Elevated access requires manager and security team approval\n\nThis process is documented in our Identity and Access Management Policy.",
      aiConfidence: 0.88,
      sourcePolicies: ["Identity and Access Management Policy"],
      sourceControls: ["AC-2", "AC-6"],
      isApproved: false,
      reviewedBy: null
    },
    {
      id: "q-003",
      number: "2.1",
      section: "Data Protection",
      question: "How is sensitive data encrypted at rest and in transit?",
      aiResponse: "Our data encryption practices include:\n\n**At Rest:**\n- All databases use AES-256 encryption\n- AWS S3 buckets use SSE-S3 or SSE-KMS encryption\n- Laptop hard drives use BitLocker/FileVault\n\n**In Transit:**\n- TLS 1.3 for all external communications\n- TLS 1.2 minimum for internal services\n- Certificate pinning for mobile applications\n\nEncryption keys are managed through AWS KMS with automatic rotation.",
      aiConfidence: 0.92,
      sourcePolicies: ["Data Protection Policy", "Cryptography Standard"],
      sourceControls: ["SC-8", "SC-28"],
      isApproved: true,
      reviewedBy: "Mike Johnson"
    }
  ]
};
