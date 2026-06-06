import { useState, useRef, useEffect, useCallback } from "react";
import { useOrg } from "../App.jsx";

// ═══════════════════════════════════════════════════════════════════════════════
// RAG: In-browser document text extraction
// Supports PDF (via pdfjs-dist), DOCX (via mammoth), and plain text files
// Extracted text is injected directly into the AI audit prompt
// ═══════════════════════════════════════════════════════════════════════════════
async function extractFileText(file) {
  if (!file) return null;
  const ext = "." + file.name.split(".").pop().toLowerCase();

  // Plain text / structured text
  if ([".txt", ".csv", ".md", ".json", ".xml", ".log"].includes(ext)) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = e => resolve((e.target.result || "").slice(0, 8000));
      reader.onerror  = () => resolve(null);
      reader.readAsText(file);
    });
  }

  // PDF — use pdfjs-dist (up to 10 pages, max 8 000 chars)
  if (ext === ".pdf") {
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = "";
      const maxPages = Math.min(pdf.numPages, 10);
      for (let p = 1; p <= maxPages; p++) {
        const page    = await pdf.getPage(p);
        const content = await page.getTextContent();
        text += content.items.map(i => i.str).join(" ") + "\n";
        if (text.length > 8000) break;
      }
      return text.slice(0, 8000).trim() || null;
    } catch (err) {
      console.warn("[RAG] PDF extraction error:", err.message);
      return null;
    }
  }

  // DOCX only — mammoth requires the ZIP-based .docx format
  // Legacy .doc (binary pre-2007) is NOT supported by any browser-side library
  if (ext === ".docx") {
    try {
      const mammoth     = await import("mammoth");
      const arrayBuffer = await file.arrayBuffer();
      const result      = await mammoth.extractRawText({ arrayBuffer });
      const text        = (result.value || "").slice(0, 8000).trim();
      if (text) return text;
      console.warn("[RAG] mammoth returned empty for", file.name);
      return null;
    } catch (err) {
      console.warn("[RAG] DOCX extraction error:", err.message);
      return null;
    }
  }

  // Legacy .doc — not readable in browser (binary format, not ZIP-based)
  if (ext === ".doc") {
    console.info("[RAG] Legacy .doc format — cannot be read in browser. Convert to .pdf or .docx.");
    return "LEGACY_DOC";   // sentinel: file is unreadable, not an error
  }

  // Images / PPT / XLS / other binary formats — no text extraction possible
  return null;
}

// Extractable = browser can read text from these
const EXTRACTABLE_EXTENSIONS = [".pdf", ".docx", ".txt", ".csv", ".md", ".json", ".xml", ".log"];
function canExtractText(file) {
  if (!file) return false;
  const ext = "." + file.name.split(".").pop().toLowerCase();
  return EXTRACTABLE_EXTENSIONS.includes(ext);
}
// Readable-attempt formats — we tried but the format isn't browser-readable
function isLegacyFormat(file) {
  if (!file) return false;
  return ("." + file.name.split(".").pop().toLowerCase()) === ".doc";
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERSION: 2026-04-24-V7 - CONTENT-BASED EVALUATION (not filename-based)
// - Document uploaded + relevant content description = can be Compliant
// - Text-only (no upload) = max Partial (self-declaration)
// ═══════════════════════════════════════════════════════════════════════════════
const GAP_MODULE_VERSION = "2026-04-24-V7-CONTENT-BASED";
console.log(`[GapModule] Version: ${GAP_MODULE_VERSION} - Evidence enforcement ACTIVE`);

// ═══════════════════════════════════════════════════════════════════════════════
// EVIDENCE GUIDANCE MAP - What evidence is expected for each control
// ═══════════════════════════════════════════════════════════════════════════════
const EVIDENCE_GUIDANCE = {
  // A.5 Organizational Controls
  "A.5.1":  { expected: ["Information Security Policy", "ISMS Policy", "Security Policy"], hint: "Information Security Policy document" },
  "A.5.2":  { expected: ["RACI Matrix", "Roles and Responsibilities", "Organization Chart", "Job Description"], hint: "RACI matrix or roles document" },
  "A.5.3":  { expected: ["Segregation of Duties Matrix", "SoD Matrix", "Access Control Matrix"], hint: "Segregation of Duties matrix" },
  "A.5.4":  { expected: ["Management Commitment", "Security Charter", "Board Minutes"], hint: "Management commitment letter or meeting minutes" },
  "A.5.5":  { expected: ["Authority Contact List", "Regulatory Contacts"], hint: "Contact list with authorities" },
  "A.5.6":  { expected: ["Interest Group Membership", "Forum Participation"], hint: "Membership records or participation logs" },
  "A.5.7":  { expected: ["Threat Intelligence", "Threat Report", "Vulnerability Feed"], hint: "Threat intelligence reports or feeds" },
  "A.5.8":  { expected: ["Project Security Checklist", "SDLC Security", "Project Risk Assessment"], hint: "Project security requirements checklist" },
  "A.5.9":  { expected: ["Asset Inventory", "Asset Register", "CMDB"], hint: "Asset inventory/register" },
  "A.5.10": { expected: ["Acceptable Use Policy", "AUP"], hint: "Acceptable Use Policy" },
  "A.5.11": { expected: ["Exit Checklist", "Asset Return Form", "Offboarding"], hint: "Asset return procedure/checklist" },
  "A.5.12": { expected: ["Classification Policy", "Data Classification"], hint: "Information Classification Policy" },
  "A.5.13": { expected: ["Labelling Procedure", "Classification Labels"], hint: "Labelling procedure or examples" },
  "A.5.14": { expected: ["Information Transfer Policy", "Data Transfer"], hint: "Information Transfer Policy" },
  "A.5.15": { expected: ["Access Control Policy", "Access Control Matrix", "ACM"], hint: "Access Control Policy or Matrix" },
  "A.5.16": { expected: ["Identity Management", "IAM Policy", "User Provisioning"], hint: "Identity Management procedure" },
  "A.5.17": { expected: ["Password Policy", "Authentication Policy", "MFA Policy"], hint: "Password/Authentication Policy" },
  "A.5.18": { expected: ["Access Rights Matrix", "User Access Review", "ACM"], hint: "Access rights matrix or review records" },
  "A.5.19": { expected: ["Supplier Security Policy", "Vendor Management"], hint: "Supplier Security Policy" },
  "A.5.20": { expected: ["Supplier Agreement", "NDA", "Security Clauses"], hint: "Supplier agreements with security clauses" },
  "A.5.21": { expected: ["Supply Chain Security", "Third Party Risk"], hint: "Supply chain security requirements" },
  "A.5.22": { expected: ["Supplier Review", "Vendor Assessment"], hint: "Supplier monitoring/review records" },
  "A.5.23": { expected: ["Cloud Security Policy", "Cloud Usage Guidelines"], hint: "Cloud Security Policy" },
  "A.5.24": { expected: ["Incident Response Plan", "IRP", "Incident Management"], hint: "Incident Response Plan" },
  "A.5.25": { expected: ["Incident Classification", "Event Triage"], hint: "Incident classification criteria" },
  "A.5.26": { expected: ["Incident Response Procedure", "Playbook"], hint: "Incident response procedures" },
  "A.5.27": { expected: ["Lessons Learned", "Post-Incident Review"], hint: "Post-incident review records" },
  "A.5.28": { expected: ["Evidence Collection", "Forensics Procedure"], hint: "Evidence collection procedure" },
  "A.5.29": { expected: ["Business Continuity Plan", "BCP"], hint: "Business Continuity Plan" },
  "A.5.30": { expected: ["IT Disaster Recovery", "DRP", "ICT Continuity"], hint: "IT Disaster Recovery Plan" },
  "A.5.31": { expected: ["Legal Register", "Compliance Register"], hint: "Legal/regulatory requirements register" },
  "A.5.32": { expected: ["IPR Policy", "License Management"], hint: "Intellectual property procedures" },
  "A.5.33": { expected: ["Records Management", "Retention Policy"], hint: "Records management procedure" },
  "A.5.34": { expected: ["Privacy Policy", "PII Protection", "GDPR"], hint: "Privacy/PII Protection Policy" },
  "A.5.35": { expected: ["Internal Audit Report", "External Audit", "Assessment"], hint: "Independent security review/audit report" },
  "A.5.36": { expected: ["Compliance Review", "Policy Compliance"], hint: "Compliance review records" },
  "A.5.37": { expected: ["Operating Procedures", "SOP", "Work Instructions"], hint: "Standard Operating Procedures" },
  // A.6 People Controls
  "A.6.1":  { expected: ["Background Check", "Screening Procedure"], hint: "Screening/background check records" },
  "A.6.2":  { expected: ["Employment Contract", "Security Clauses"], hint: "Employment contracts with security terms" },
  "A.6.3":  { expected: ["Security Training", "Awareness Program"], hint: "Security awareness training records" },
  "A.6.4":  { expected: ["Disciplinary Process", "HR Policy"], hint: "Disciplinary procedure" },
  "A.6.5":  { expected: ["Termination Procedure", "Exit Process"], hint: "Termination/exit procedure" },
  "A.6.6":  { expected: ["NDA", "Confidentiality Agreement"], hint: "Confidentiality/NDA agreements" },
  "A.6.7":  { expected: ["Remote Work Policy", "Telework"], hint: "Remote working policy" },
  "A.6.8":  { expected: ["Incident Reporting", "Security Reporting"], hint: "Security event reporting procedure" },
  // A.7 Physical Controls
  "A.7.1":  { expected: ["Physical Security Perimeter", "Site Plan"], hint: "Physical security perimeter documentation" },
  "A.7.2":  { expected: ["Entry Control", "Access Control System"], hint: "Physical entry controls documentation" },
  "A.7.3":  { expected: ["Office Security", "Secure Areas"], hint: "Secure area procedures" },
  "A.7.4":  { expected: ["Physical Security Monitoring", "CCTV"], hint: "Physical monitoring records" },
  "A.7.5":  { expected: ["Environmental Threats", "Natural Disaster"], hint: "Environmental protection measures" },
  "A.7.6":  { expected: ["Secure Area Work", "Clean Desk"], hint: "Secure area working procedures" },
  "A.7.7":  { expected: ["Clear Desk Policy", "Clear Screen"], hint: "Clear desk/screen policy" },
  "A.7.8":  { expected: ["Equipment Siting", "Placement"], hint: "Equipment placement guidelines" },
  "A.7.9":  { expected: ["Asset Off-premises", "Equipment Movement"], hint: "Off-premises asset procedures" },
  "A.7.10": { expected: ["Media Handling", "Storage Media"], hint: "Storage media procedures" },
  "A.7.11": { expected: ["Supporting Utilities", "UPS", "Power"], hint: "Utilities protection records" },
  "A.7.12": { expected: ["Cabling Security", "Network Cabling"], hint: "Cabling security documentation" },
  "A.7.13": { expected: ["Equipment Maintenance", "Maintenance Log"], hint: "Equipment maintenance records" },
  "A.7.14": { expected: ["Disposal", "Secure Disposal", "WEEE"], hint: "Secure disposal records/certificates" },
  // A.8 Technological Controls  
  "A.8.1":  { expected: ["Endpoint Device", "Device Management"], hint: "Endpoint device management policy" },
  "A.8.2":  { expected: ["Privileged Access", "PAM", "Admin Access"], hint: "Privileged access management records" },
  "A.8.3":  { expected: ["Access Restriction", "Least Privilege"], hint: "Information access restrictions" },
  "A.8.4":  { expected: ["Source Code Access", "Repository Access"], hint: "Source code access controls" },
  "A.8.5":  { expected: ["Secure Authentication", "MFA", "SSO"], hint: "Authentication configuration/screenshots" },
  "A.8.6":  { expected: ["Capacity Management", "Resource Monitoring"], hint: "Capacity management records" },
  "A.8.7":  { expected: ["Malware Protection", "Antivirus", "EDR"], hint: "Anti-malware configuration/reports" },
  "A.8.8":  { expected: ["Vulnerability Management", "Patch Management"], hint: "Vulnerability scan reports" },
  "A.8.9":  { expected: ["Configuration Management", "Baseline"], hint: "Configuration standards/baselines" },
  "A.8.10": { expected: ["Information Deletion", "Data Sanitization"], hint: "Data deletion procedures/records" },
  "A.8.11": { expected: ["Data Masking", "Anonymization"], hint: "Data masking procedures" },
  "A.8.12": { expected: ["Data Leakage Prevention", "DLP"], hint: "DLP configuration/reports" },
  "A.8.13": { expected: ["Information Backup", "Backup Policy"], hint: "Backup policy and test records" },
  "A.8.14": { expected: ["System Redundancy", "High Availability"], hint: "Redundancy documentation" },
  "A.8.15": { expected: ["Logging", "Audit Logs", "SIEM"], hint: "Logging configuration/samples" },
  "A.8.16": { expected: ["Monitoring", "Security Monitoring"], hint: "Monitoring dashboards/alerts" },
  "A.8.17": { expected: ["Clock Synchronization", "NTP"], hint: "Time sync configuration" },
  "A.8.18": { expected: ["Privileged Utility", "Admin Tools"], hint: "Privileged utility controls" },
  "A.8.19": { expected: ["Software Installation", "Application Control"], hint: "Software installation procedures" },
  "A.8.20": { expected: ["Network Security", "Firewall", "Segmentation"], hint: "Network security configuration" },
  "A.8.21": { expected: ["Network Services Security", "Secure Protocols"], hint: "Network services security config" },
  "A.8.22": { expected: ["Network Segregation", "VLAN", "Segmentation"], hint: "Network segregation documentation" },
  "A.8.23": { expected: ["Web Filtering", "URL Filter"], hint: "Web filtering configuration" },
  "A.8.24": { expected: ["Cryptography", "Encryption Policy"], hint: "Cryptography/encryption policy" },
  "A.8.25": { expected: ["Secure Development", "SDLC"], hint: "Secure development lifecycle" },
  "A.8.26": { expected: ["Application Security", "Security Requirements"], hint: "Application security requirements" },
  "A.8.27": { expected: ["Secure Architecture", "Security Design"], hint: "Secure system architecture docs" },
  "A.8.28": { expected: ["Secure Coding", "Code Review"], hint: "Secure coding standards/reviews" },
  "A.8.29": { expected: ["Security Testing", "Penetration Test"], hint: "Security testing reports" },
  "A.8.30": { expected: ["Outsourced Development", "Vendor Development"], hint: "Outsourced development security" },
  "A.8.31": { expected: ["Environment Separation", "Dev/Test/Prod"], hint: "Environment separation evidence" },
  "A.8.32": { expected: ["Change Management", "Change Control"], hint: "Change management records" },
  "A.8.33": { expected: ["Test Information", "Test Data"], hint: "Test data protection procedures" },
  "A.8.34": { expected: ["Audit System Protection", "Audit Trail"], hint: "Audit system protection config" },
};

// Get expected evidence hint for a control (for display only - not for validation)
// We DON'T check filename because:
// 1. Companies use different naming (ACM, POL-001, Arabic names, etc.)
// 2. Only the CONTENT matters, not the filename
// 3. AI will evaluate based on user's description of the document
function getEvidenceHint(controlId) {
  const guidance = EVIDENCE_GUIDANCE[controlId];
  return guidance ? guidance.hint : "Relevant policy, procedure, or evidence";
}

// ── Controls (93 total — ISO 27001:2022) ─────────────────────────────────────
const CONTROLS = [
  { domain:"A.5 Organizational Controls", color:"#0ea5e9", items:[
    { id:"A.5.1",  name:"Policies for information security" },
    { id:"A.5.2",  name:"Information security roles and responsibilities" },
    { id:"A.5.3",  name:"Segregation of duties" },
    { id:"A.5.4",  name:"Management responsibilities" },
    { id:"A.5.5",  name:"Contact with authorities" },
    { id:"A.5.6",  name:"Contact with special interest groups" },
    { id:"A.5.7",  name:"Threat intelligence" },
    { id:"A.5.8",  name:"Information security in project management" },
    { id:"A.5.9",  name:"Inventory of information and other associated assets" },
    { id:"A.5.10", name:"Acceptable use of information and other associated assets" },
    { id:"A.5.11", name:"Return of assets" },
    { id:"A.5.12", name:"Classification of information" },
    { id:"A.5.13", name:"Labelling of information" },
    { id:"A.5.14", name:"Information transfer" },
    { id:"A.5.15", name:"Access control" },
    { id:"A.5.16", name:"Identity management" },
    { id:"A.5.17", name:"Authentication information" },
    { id:"A.5.18", name:"Access rights" },
    { id:"A.5.19", name:"Information security in supplier relationships" },
    { id:"A.5.20", name:"Addressing information security within supplier agreements" },
    { id:"A.5.21", name:"Managing information security in the ICT supply chain" },
    { id:"A.5.22", name:"Monitoring, review and change management of supplier services" },
    { id:"A.5.23", name:"Information security for use of cloud services" },
    { id:"A.5.24", name:"Information security incident management planning" },
    { id:"A.5.25", name:"Assessment and decision on information security events" },
    { id:"A.5.26", name:"Response to information security incidents" },
    { id:"A.5.27", name:"Learning from information security incidents" },
    { id:"A.5.28", name:"Collection of evidence" },
    { id:"A.5.29", name:"Information security during disruption" },
    { id:"A.5.30", name:"ICT readiness for business continuity" },
    { id:"A.5.31", name:"Legal, statutory, regulatory and contractual requirements" },
    { id:"A.5.32", name:"Intellectual property rights" },
    { id:"A.5.33", name:"Protection of records" },
    { id:"A.5.34", name:"Privacy and protection of PII" },
    { id:"A.5.35", name:"Independent review of information security" },
    { id:"A.5.36", name:"Compliance with policies, rules and standards" },
    { id:"A.5.37", name:"Documented operating procedures" },
  ]},
  { domain:"A.6 People Controls", color:"#8b5cf6", items:[
    { id:"A.6.1", name:"Screening" },
    { id:"A.6.2", name:"Terms and conditions of employment" },
    { id:"A.6.3", name:"Information security awareness, education and training" },
    { id:"A.6.4", name:"Disciplinary process" },
    { id:"A.6.5", name:"Responsibilities after termination or change of employment" },
    { id:"A.6.6", name:"Confidentiality or non-disclosure agreements" },
    { id:"A.6.7", name:"Remote working" },
    { id:"A.6.8", name:"Information security event reporting" },
  ]},
  { domain:"A.7 Physical Controls", color:"#f59e0b", items:[
    { id:"A.7.1",  name:"Physical security perimeters" },
    { id:"A.7.2",  name:"Physical entry" },
    { id:"A.7.3",  name:"Securing offices, rooms and facilities" },
    { id:"A.7.4",  name:"Physical security monitoring" },
    { id:"A.7.5",  name:"Protecting against physical and environmental threats" },
    { id:"A.7.6",  name:"Working in secure areas" },
    { id:"A.7.7",  name:"Clear desk and clear screen" },
    { id:"A.7.8",  name:"Equipment siting and protection" },
    { id:"A.7.9",  name:"Security of assets off-premises" },
    { id:"A.7.10", name:"Storage media" },
    { id:"A.7.11", name:"Supporting utilities" },
    { id:"A.7.12", name:"Cabling security" },
    { id:"A.7.13", name:"Equipment maintenance" },
    { id:"A.7.14", name:"Secure disposal or re-use of equipment" },
  ]},
  { domain:"A.8 Technological Controls", color:"#10b981", items:[
    { id:"A.8.1",  name:"User endpoint devices" },
    { id:"A.8.2",  name:"Privileged access rights" },
    { id:"A.8.3",  name:"Information access restriction" },
    { id:"A.8.4",  name:"Access to source code" },
    { id:"A.8.5",  name:"Secure authentication" },
    { id:"A.8.6",  name:"Capacity management" },
    { id:"A.8.7",  name:"Protection against malware" },
    { id:"A.8.8",  name:"Management of technical vulnerabilities" },
    { id:"A.8.9",  name:"Configuration management" },
    { id:"A.8.10", name:"Information deletion" },
    { id:"A.8.11", name:"Data masking" },
    { id:"A.8.12", name:"Data leakage prevention" },
    { id:"A.8.13", name:"Information backup" },
    { id:"A.8.14", name:"Redundancy of information processing facilities" },
    { id:"A.8.15", name:"Logging" },
    { id:"A.8.16", name:"Monitoring activities" },
    { id:"A.8.17", name:"Clock synchronisation" },
    { id:"A.8.18", name:"Use of privileged utility programs" },
    { id:"A.8.19", name:"Installation of software on operational systems" },
    { id:"A.8.20", name:"Networks security" },
    { id:"A.8.21", name:"Security of network services" },
    { id:"A.8.22", name:"Segregation of networks" },
    { id:"A.8.23", name:"Web filtering" },
    { id:"A.8.24", name:"Use of cryptography" },
    { id:"A.8.25", name:"Secure development life cycle" },
    { id:"A.8.26", name:"Application security requirements" },
    { id:"A.8.27", name:"Secure system architecture and engineering principles" },
    { id:"A.8.28", name:"Secure coding" },
    { id:"A.8.29", name:"Security testing in development and acceptance" },
    { id:"A.8.30", name:"Outsourced development" },
    { id:"A.8.31", name:"Separation of development, test and production environments" },
    { id:"A.8.32", name:"Change management" },
    { id:"A.8.33", name:"Test information" },
    { id:"A.8.34", name:"Protection of information systems during audit testing" },
  ]},
];

const ALL_CONTROLS = CONTROLS.flatMap(d => d.items);
const TOTAL = ALL_CONTROLS.length; // 93

const VC = { "Compliant":"#22c55e", "Partial":"#eab308", "Non-Compliant":"#ef4444" };
const VB = { "Compliant":"#14532d20","Partial":"#78350f20","Non-Compliant":"#7f1d1d20" };

// ── Evidence types and their audit weight ────────────────────────────────────
const EVIDENCE_TYPES = {
  "document": { label: "Document", labelAr: "مستند", icon: "📄", weight: 1.0, color: "#22c55e" },
  "screenshot": { label: "Screenshot", labelAr: "لقطة شاشة", icon: "📸", weight: 0.7, color: "#0ea5e9" },
  "self_declaration": { label: "Self-Declaration", labelAr: "إقرار ذاتي", icon: "✍️", weight: 0.3, color: "#f59e0b" },
  "none": { label: "No Evidence", labelAr: "بدون دليل", icon: "⚠️", weight: 0.0, color: "#ef4444" },
};

// File extensions that count as proper documents
const DOCUMENT_EXTENSIONS = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".ppt", ".pptx"];
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"];

function getEvidenceType(file) {
  if (!file) return "none";
  const ext = "." + file.name.split(".").pop().toLowerCase();
  if (DOCUMENT_EXTENSIONS.includes(ext)) return "document";
  if (IMAGE_EXTENSIONS.includes(ext)) return "screenshot";
  return "document"; // Default to document for unknown types
}

// ── Session helpers (org-aware for multi-tenant) ────────────────────────────────
const BASE_SESSION_KEY = "autoaudit_gap_session_id";

function getSessionKey(orgId) {
  return orgId ? `${BASE_SESSION_KEY}_${orgId}` : BASE_SESSION_KEY;
}

function genId() {
  return "gap_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
}
function loadStoredId(orgId)   { try { return localStorage.getItem(getSessionKey(orgId)); } catch { return null; } }
function saveStoredId(id, orgId){ try { localStorage.setItem(getSessionKey(orgId), id); } catch {} }
function clearStoredId(orgId)  { try { localStorage.removeItem(getSessionKey(orgId)); } catch {} }

// ── D1 API calls ──────────────────────────────────────────────────────────────
async function dbCreate(id, org_name, industry, size, lang) {
  await fetch("/api/session", { method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ action:"create", id, org_name, industry, size, lang }) });
}
async function dbUpdate(id, phase, ctrl_idx) {
  await fetch("/api/session", { method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ action:"update", id, phase, ctrl_idx }) });
}
async function dbSaveResult(session_id, ctrl_id, ctrl_name, verdict, finding, recommendation, evidence_type) {
  await fetch("/api/session", { method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ action:"result", session_id, ctrl_id, ctrl_name, verdict, finding, recommendation, evidence_type: evidence_type || "none" }) });
}
async function dbUpdateResult(session_id, ctrl_id, verdict, finding, recommendation, evidence_type) {
  await fetch("/api/session", { method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ action:"update-result", session_id, ctrl_id, verdict, finding, recommendation, evidence_type: evidence_type || "none" }) });
}
async function dbSaveMessage(session_id, role, msg_text, extras={}) {
  if (extras.is_status) return; // never persist loading indicators
  await fetch("/api/session", { method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ action:"message", session_id, role, msg_text, ...extras }) });
}
async function dbLoad(id) {
  const res  = await fetch(`/api/session?id=${id}`);
  const data = await res.json();
  return data.ok ? data : null;
}
async function dbDelete(id) {
  await fetch(`/api/session?id=${id}`, { method:"DELETE" });
}

// ── AI helpers ────────────────────────────────────────────────────────────────
async function callAI(prompt) {
  const res  = await fetch("/api/chat", { method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ messages:[{ role:"user", content:prompt }] }) });
  const data = await res.json();
  return (data.content||[]).map(b=>b.text||"").join("");
}

function parseVerdict(raw, evidenceType) {
  const get = key => { const m = raw.match(new RegExp(key+":?\\s*(.+?)(?=\\n[A-Z_]+:|$)","si")); return m ? m[1].trim() : ""; };
  let v = get("VERDICT");
  let aiVerdict = v.includes("Non") ? "Non-Compliant" : v.includes("Partial") ? "Partial" : "Compliant";
  let verdict = aiVerdict;
  let wasOverridden = false;
  
  // ══════════════════════════════════════════════════════════════════════════════════
  // CRITICAL: ABSOLUTE ENFORCEMENT - NO EXCEPTIONS - TEXT ONLY = NEVER COMPLIANT
  // ══════════════════════════════════════════════════════════════════════════════════
  console.log(`[GapModule V4] ENFORCEMENT CHECK: evidenceType=${evidenceType}, AI verdict=${verdict}`);
  
  // RULE: Self-declaration (text-only, no uploaded file) can NEVER be Compliant
  if (evidenceType === "self_declaration" || evidenceType === "none" || !evidenceType) {
    if (verdict === "Compliant") {
      console.warn(`[GapModule V4] ⚠️ DOWNGRADE: ${verdict} → Partial (no documentary evidence)`);
      verdict = "Partial";
      wasOverridden = true;
    }
  }
  
  // No evidence at all = Non-Compliant (no exceptions)
  if (evidenceType === "none" || !evidenceType) {
    verdict = "Non-Compliant";
    wasOverridden = true;
  }
  
  // Get finding and recommendation
  let finding = get("FINDING");
  let recommendation = get("RECOMMENDATION");
  
  // If we overrode the verdict, append explanation
  if (wasOverridden && evidenceType === "self_declaration") {
    finding = finding + " [AUDITOR NOTE: Verdict downgraded from Compliant to Partial - no documentary evidence provided. ISO 27001 certification requires documented evidence, not self-declarations.]";
    recommendation = recommendation + " REQUIRED: Upload formal policy, procedure, or system screenshot to achieve Compliant status.";
  }
  
  console.log(`[GapAnalysis] Evidence: ${evidenceType}, AI Verdict: ${aiVerdict}, Final Verdict: ${verdict}, Overridden: ${wasOverridden}`);
  
  return { 
    verdict, 
    finding,
    recommendation,
    evidenceType: evidenceType || "none",
    wasOverridden
  };
}

function enforceEvidence(verdict, evidenceType) {
  let finalVerdict = verdict;
  let enforced = false;
  if (evidenceType === "self_declaration" && finalVerdict === "Compliant") {
    finalVerdict = "Partial";
    enforced = true;
  }
  if (evidenceType === "none" && finalVerdict !== "Non-Compliant") {
    finalVerdict = "Non-Compliant";
    enforced = true;
  }
  return { verdict: finalVerdict, enforced };
}

function qPrompt(ctrl, lang, org, industry) {
  const note = lang==="ar" ? "Ask in Arabic. Keep control ID in English." : "Ask in English.";
  return `ISO 27001:2022 lead auditor for ${org} (${industry}). ${note}\nAsk ONE specific interview question to assess control ${ctrl.id} - ${ctrl.name}.\nOutput only the question text.`;
}
function aPrompt(ctrl, ans, evidenceType, lang, org, industry, extractedContent) {
  const note = lang==="ar" ? "Respond in Arabic. Keep control IDs and verdict words (Compliant/Partial/Non-Compliant) in English." : "Respond in English.";
  
  // Get expected evidence for this control
  const expectedEvidence = EVIDENCE_GUIDANCE[ctrl.id];
  const expectedHint = expectedEvidence ? expectedEvidence.hint : "Relevant policy, procedure, or evidence";
  
  // CRITICAL: Different prompts based on whether document was uploaded or not
  if (evidenceType === "document" || evidenceType === "screenshot") {

    // ── RAG: Include actual extracted document text when available ──────────
    const ragSection = extractedContent
      ? `\n\n══════════════════════════════════════════════════════════════
📄 ACTUAL DOCUMENT CONTENT (read by AI — RAG):
══════════════════════════════════════════════════════════════
${extractedContent.slice(0, 4000)}
══════════════════════════════════════════════════════════════
IMPORTANT: Base your verdict primarily on the ACTUAL DOCUMENT CONTENT above.
Ignore the user's description if it conflicts with what the document says.`
      : `\n\n[Note: Document text could not be extracted (image/PPT/XLS). Evaluate based on user's description.]`;

    // ── Document governance checks (ISO 27001 Clause 5.2 / 7.5) ────────────
    // All policies/procedures must be: approved by top management, versioned,
    // dated, have an owner, and be communicated to relevant personnel.
    const governanceSection = extractedContent ? `

══════════════════════════════════════════════════════════════
📋 MANDATORY DOCUMENT GOVERNANCE CHECKS (ISO 27001 Cl. 5.2 / 7.5)
══════════════════════════════════════════════════════════════
In addition to content, check the document for these governance elements:
1. MANAGEMENT APPROVAL — Is there a signature, stamp, or named approver (e.g. CEO, CISO, Board)?
2. VERSION CONTROL — Does it have a version number (e.g. v1.0, v2) and an effective/issue date?
3. DOCUMENT OWNER — Is an owner or author identified (name or role)?
4. REVIEW CYCLE — Is there a scheduled review period? Accept ANY of: explicit "reviewed annually" statement, a NEXT REVIEW date field, or a review interval mentioned anywhere in the document.

NOTE: Do NOT check for communication to staff inside the policy document itself. Communication and awareness are separate ISO 27001 controls (A.6.3) assessed with their own evidence (training records, email logs, intranet notices). A policy document is NOT expected to contain communication records.

IMPORTANT INTERPRETATION RULES:
- For element 1 (approval): PDF text extraction CANNOT detect handwritten signatures, wet stamps, or image-based seals. Accept ANY of: (a) CEO/CISO/Board/Director named as approver in a document control table, (b) a statement like "approved by the CEO" or "the Board of Directors approves this policy", (c) a person's name + executive title in an approval context. Do NOT say there is no approval just because you cannot see an image-based signature — it may be present as an image that text extraction cannot read.
- For element 4 (review): A NEXT REVIEW date field IS sufficient evidence of a review schedule.

If ANY of these 4 governance elements are MISSING, note them in your Finding and Recommendation.
A policy missing management approval, version control, or a named owner CANNOT be Compliant under ISO 27001 Clause 5.2 / 7.5.` : `

[Note: Document text could not be extracted — governance elements (approval, version, communication) cannot be verified from the image/description.]`;

    return `You are an ISO 27001:2022 auditor assessing ${org} (${industry}). ${note}

Control: ${ctrl.id} - ${ctrl.name}

══════════════════════════════════════════════════════════════
✅ DOCUMENTARY EVIDENCE HAS BEEN UPLOADED
The user has uploaded a ${evidenceType === "document" ? "document (PDF/DOCX)" : "screenshot/image"} as evidence.
This is REAL EVIDENCE, not a verbal claim.
══════════════════════════════════════════════════════════════

User's Description:
"${ans}"
${ragSection}
${governanceSection}

EVALUATION CRITERIA:
${extractedContent
  ? `Evaluate the ACTUAL DOCUMENT CONTENT against ${ctrl.id} — ${ctrl.name} requirements:
- Does the document formally address the control requirements?
- Are policies, procedures, responsibilities, and scope clearly defined?
- Is the content sufficient for an ISO 27001 certification audit?
- Are ALL 5 governance elements above present (approval, version, owner, communication, review)?`
  : `Evaluate if the described content addresses ${ctrl.id} requirements:
- Does the description indicate the document covers ${ctrl.name}?
- Does it show appropriate controls, policies, or procedures?`}

VERDICT RULES:
- Content fully addresses requirements AND all governance elements present → VERDICT: Compliant
- Content good but governance elements missing (no approval, no version, no communication) → VERDICT: Partial
- Content shows gaps or is irrelevant → VERDICT: Non-Compliant

Reply in this format:
VERDICT: [Compliant OR Partial OR Non-Compliant]
FINDING: [What the document content demonstrates, AND note any missing governance elements (approval stamp, version, communication)]
RECOMMENDATION: [Specific content improvements needed AND any governance gaps to fix — e.g. "Ensure the policy is formally approved by top management and version-controlled"]`;
  }
  
  // NO DOCUMENT UPLOADED - maximum Partial
  return `You are a STRICT ISO 27001:2022 external auditor assessing ${org} (${industry}). ${note}

Control: ${ctrl.id} - ${ctrl.name}
Expected Evidence: ${expectedHint}

══════════════════════════════════════════════════════════════
⚠️ NO DOCUMENT UPLOADED - SELF-DECLARATION ONLY
The user provided only a text answer WITHOUT uploading any document.
For ISO 27001 certification, text claims alone are INSUFFICIENT.
MAXIMUM VERDICT ALLOWED: PARTIAL
══════════════════════════════════════════════════════════════

User's Text Response (Self-Declaration):
"${ans}"

STRICT RULE: Since NO document was uploaded:
- Even if the answer is detailed and well-written → VERDICT: Partial (maximum)
- The user MUST upload documented evidence to achieve Compliant
- State clearly that documentary evidence is required

IMPORTANT — Also remind the user about document governance requirements (ISO 27001 Cl. 5.2 / 7.5):
Any policy, procedure, or framework document submitted as evidence must have ALL of the following:
• Formal approval by top management (signature, stamp, or named approver)
• Version number and effective date
• Identified document owner
• Evidence of communication to relevant staff/end users
• Scheduled review cycle (e.g. annual review)
Without these governance elements, even a well-written policy cannot achieve Compliant status.

Reply in this format:
VERDICT: Partial
FINDING: [Acknowledge what user described, but note that no documentary evidence was provided]
RECOMMENDATION: To achieve Compliant, upload: ${expectedHint}. Ensure the document is formally approved by top management, version-controlled, and communicated to relevant staff.`;
}
function sPrompt(results, org, industry, lang) {
  const c=results.filter(r=>r.verdict==="Compliant").length;
  const p=results.filter(r=>r.verdict==="Partial").length;
  const n=results.filter(r=>r.verdict==="Non-Compliant").length;
  const score=Math.round(((c + p*0.5)/results.length)*100);
  const gaps=results.filter(r=>r.verdict==="Non-Compliant").slice(0,5).map(r=>r.ctrl_id||r.id).join(", ");
  
  // Evidence quality analysis
  const docEvidence = results.filter(r=>r.evidenceType==="document").length;
  const screenshotEvidence = results.filter(r=>r.evidenceType==="screenshot").length;
  const selfDeclare = results.filter(r=>r.evidenceType==="self_declaration").length;
  const noEvidence = results.filter(r=>!r.evidenceType || r.evidenceType==="none").length;
  const evidenceScore = results.length > 0 
    ? Math.round(((docEvidence * 1.0 + screenshotEvidence * 0.7 + selfDeclare * 0.3) / results.length) * 100)
    : 0;
  
  const note=lang==="ar"?"Write entirely in Arabic.":"Write in English.";
  return `ISO 27001:2022 external auditor preparing certification readiness report. ${note}

Organization: ${org} (${industry})

COMPLIANCE SCORE: ${score}%
- Compliant: ${c} controls
- Partial: ${p} controls  
- Non-Compliant: ${n} controls

EVIDENCE QUALITY SCORE: ${evidenceScore}%
- Document evidence provided: ${docEvidence} controls
- Screenshot evidence: ${screenshotEvidence} controls
- Self-declaration only (no evidence): ${selfDeclare} controls
- No evidence: ${noEvidence} controls

TOP GAPS: ${gaps||"none"}

Write a 6-8 sentence executive summary covering:
1. Overall security posture assessment
2. Evidence quality concern (if many self-declarations without documents)
3. Key strengths identified
4. Critical gaps requiring immediate attention
5. Certification readiness assessment (Ready / Needs Work / Not Ready)
6. Primary recommendations for Stage 1 audit preparation

IMPORTANT: If evidence quality score is low (many self-declarations), emphasize that the organization must formalize and document their controls with policies, procedures, and system evidence before certification audit.`;
}

// ── Root component ────────────────────────────────────────────────────────────
export default function GapModule({ t, isRTL, lang }) {
  const { orgId, orgName: urlOrgName } = useOrg(); // Get org context from URL params
  const [view,     setView]     = useState("checking"); // checking | resume | setup | assessment
  const [session,  setSession]  = useState(null);       // loaded D1 session object
  const [draft,    setDraft]    = useState({ orgName: urlOrgName || "", industry:"", size:"" });

  // Update draft when urlOrgName is available
  useEffect(() => {
    if (urlOrgName) {
      setDraft(prev => ({ ...prev, orgName: urlOrgName }));
    }
  }, [urlOrgName]);

  // On mount: check localStorage for a stored session ID (org-aware), try to load from D1
  useEffect(() => {
    const storedId = loadStoredId(orgId);
    if (!storedId) { setView("setup"); return; }
    dbLoad(storedId).then(data => {
      if (data?.session) {
        setSession(data);
        setView("resume");
      } else {
        clearStoredId(orgId);
        setView("setup");
      }
    }).catch(() => { setView("setup"); });
  }, [orgId]);

  function startFresh() {
    const oldId = loadStoredId(orgId);
    if (oldId) dbDelete(oldId);
    clearStoredId(orgId);
    setSession(null);
    setView("setup");
  }

  async function handleStart() {
    const id = genId();
    saveStoredId(id, orgId);
    await dbCreate(id, draft.orgName, draft.industry, draft.size, lang);
    setSession({ session:{ id, org_name:draft.orgName, industry:draft.industry, size:draft.size, lang, phase:"idle", ctrl_idx:0 }, results:[], messages:[] });
    setView("assessment");
  }

  function handleResume() { setView("assessment"); }

  // ── Checking spinner ──
  if (view === "checking") return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:300}}>
      <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
      <div style={{position:"relative",width:40,height:40}}>
        <div style={{position:"absolute",inset:0,borderRadius:"50%",border:"3px solid #1e293b"}}/>
        <div style={{position:"absolute",inset:0,borderRadius:"50%",border:"3px solid transparent",borderTopColor:"#10b981",animation:"sp 0.9s linear infinite"}}/>
      </div>
    </div>
  );

  // ── Resume banner ──
  if (view === "resume" && session?.session) {
    const s = session.session;
    const assessed = session.results?.length || 0;
    const score = assessed ? Math.round(((session.results.filter(r=>r.verdict==="Compliant").length + session.results.filter(r=>r.verdict==="Partial").length * 0.5) / assessed)*100) : 0;
    const scoreColor = score>=75?"#22c55e":score>=50?"#eab308":"#ef4444";
    return (
      <div style={{maxWidth:520}} dir={isRTL?"rtl":"ltr"}>
        <h2 style={{fontSize:22,fontWeight:900,color:"#f1f5f9",marginBottom:6}}>{t.gapTitle}</h2>
        <p style={{color:"#475569",fontSize:13,marginBottom:20}}>{t.gapSubtitle}</p>

        {/* Session card */}
        <div style={{background:"#0f172a",border:"1px solid #10b98140",borderRadius:14,padding:24,marginBottom:14,position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,#10b981,#059669)"}}/>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
            <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,#10b981,#059669)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>💾</div>
            <div>
              <div style={{fontSize:13,fontWeight:800,color:"#f1f5f9"}}>{isRTL?"جلسة محفوظة":"Saved Session Found"}</div>
              <div style={{fontSize:11,color:"#475569"}}>{isRTL?"يمكنك الاستمرار من حيث توقفت":"Continue where you left off"}</div>
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
            {[
              [isRTL?"المنظمة":"Organization", s.org_name],
              [isRTL?"القطاع":"Industry",      s.industry],
              [isRTL?"الضوابط المقيمة":"Assessed", `${assessed} / ${TOTAL}`],
              [isRTL?"الدرجة الحالية":"Score",    `${score}%`],
            ].map(([l,v]) => (
              <div key={l} style={{background:"#080e1c",borderRadius:8,padding:"10px 12px"}}>
                <div style={{fontSize:10,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:3}}>{l}</div>
                <div style={{fontSize:14,fontWeight:800,color: l.includes("Score")||l.includes("الدرجة") ? scoreColor : "#e2e8f0"}}>{v}</div>
              </div>
            ))}
          </div>

          {/* Mini progress bar */}
          <div style={{marginBottom:16}}>
            <div style={{height:6,background:"#1e293b",borderRadius:3,overflow:"hidden"}}>
              <div style={{height:"100%",width:(assessed/TOTAL*100)+"%",background:"linear-gradient(90deg,#10b981,#059669)",borderRadius:3}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:4,fontSize:10,color:"#334155"}}>
              <span>{assessed} {isRTL?"مقيم":"assessed"}</span>
              <span>{TOTAL - assessed} {isRTL?"متبقي":"remaining"}</span>
            </div>
          </div>

          <div style={{display:"flex",gap:10}}>
            <button onClick={handleResume}
              style={{flex:1,padding:"11px",background:"linear-gradient(135deg,#10b981,#059669)",border:"none",borderRadius:9,color:"#fff",fontSize:13,fontWeight:800,cursor:"pointer"}}>
              ▶ {isRTL?"استمر في التقييم":"Resume Assessment"}
            </button>
            <button onClick={startFresh}
              style={{padding:"11px 16px",background:"#1e293b",border:"1px solid #334155",borderRadius:9,color:"#94a3b8",fontSize:13,fontWeight:700,cursor:"pointer"}}>
              {isRTL?"بدء جديد":"New Session"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Setup form ──
  if (view === "setup") return (
    <OrgSetup draft={draft} setDraft={setDraft} onStart={handleStart} t={t} isRTL={isRTL} lang={lang}/>
  );

  // ── Assessment ──
  if (view === "assessment" && session?.session) return (
    <Assessment
      session={session}
      onReset={startFresh}
      t={t} isRTL={isRTL} lang={lang}
    />
  );

  return null;
}

// ── OrgSetup ──────────────────────────────────────────────────────────────────
function OrgSetup({ draft, setDraft, onStart, t, isRTL, lang }) {
  const [loading, setLoading] = useState(false);
  const valid = draft.orgName && draft.industry && draft.size;

  async function handleStart() {
    if (!valid) return;
    setLoading(true);
    await onStart();
    setLoading(false);
  }

  return (
    <div style={{maxWidth:520}} dir={isRTL?"rtl":"ltr"}>
      <div style={{marginBottom:20}}>
        <h2 style={{fontSize:22,fontWeight:900,color:"#f1f5f9",marginBottom:6}}>{t.gapTitle}</h2>
        <p style={{color:"#475569",fontSize:13}}>{t.gapSubtitle}</p>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:20}}>
        {[["93","Controls"],["4","Domains"],["37","Org"],["34","Tech"]].map(([n,l]) => (
          <div key={l} style={{background:"#0f172a",border:"1px solid #1a2744",borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
            <div style={{fontSize:20,fontWeight:900,color:"#10b981"}}>{n}</div>
            <div style={{fontSize:10,color:"#475569"}}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{background:"#0f172a",border:"1px solid #1a2744",borderRadius:14,padding:24,marginBottom:16}}>
        {[[t.orgName,"orgName",t.orgNamePlaceholder],[t.industry,"industry","e.g. Financial Services"],[t.orgSize,"size","e.g. 200 employees"]].map(([label,key,ph]) => (
          <div key={key} style={{marginBottom:14}}>
            <label style={{display:"block",fontSize:11,fontWeight:700,color:"#64748b",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.07em"}}>{label} *</label>
            <input value={draft[key]} onChange={e=>setDraft(d=>({...d,[key]:e.target.value}))} placeholder={ph} dir="auto"
              style={{width:"100%",padding:"10px 13px",border:"1.5px solid #1e293b",borderRadius:9,fontSize:13,background:"#080e1c",color:"#e2e8f0",fontFamily:"inherit",boxSizing:"border-box"}}/>
          </div>
        ))}
        <div style={{background:"#10b98108",border:"1px solid #10b98120",borderRadius:10,padding:14}}>
          <div style={{fontSize:10,fontWeight:700,color:"#10b981",marginBottom:10,textTransform:"uppercase"}}>ISO 27001:2022 — All 4 Domains</div>
          {CONTROLS.map(d=>(
            <div key={d.domain} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
              <div style={{width:3,height:12,borderRadius:2,background:d.color,flexShrink:0}}/>
              <div style={{fontSize:12,color:"#64748b",flex:1}}>{d.domain}</div>
              <span style={{padding:"2px 7px",background:d.color+"15",color:d.color,borderRadius:4,fontSize:10,fontWeight:700}}>{d.items.length}</span>
            </div>
          ))}
        </div>

        {/* D1 badge */}
        <div style={{marginTop:14,padding:"8px 12px",background:"#f59e0b08",border:"1px solid #f59e0b20",borderRadius:8,display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:14}}>💾</span>
          <div style={{fontSize:11,color:"#64748b"}}>
            {isRTL
              ? "سيتم حفظ تقدمك تلقائياً في قاعدة بيانات Cloudflare D1 — يمكنك العودة في أي وقت"
              : "Your progress auto-saves to Cloudflare D1 — return anytime to continue"}
          </div>
        </div>
      </div>

      <button onClick={handleStart} disabled={!valid||loading}
        style={{width:"100%",padding:14,background:valid&&!loading?"linear-gradient(135deg,#10b981,#059669)":"#1e293b",border:"none",borderRadius:11,color:valid&&!loading?"#fff":"#475569",fontSize:14,fontWeight:800,cursor:valid&&!loading?"pointer":"default",fontFamily:"inherit"}}>
        {loading?(isRTL?"جارٍ الإنشاء…":"Creating session…"):(t.startGap+" — 93 "+(lang==="ar"?"ضابطاً":"Controls"))}
      </button>
    </div>
  );
}

// ── Assessment ────────────────────────────────────────────────────────────────
function Assessment({ session: initSession, onReset, t, isRTL, lang }) {
  const sid        = initSession.session.id;
  const form       = { orgName: initSession.session.org_name, industry: initSession.session.industry, size: initSession.session.size };

  // Restore state from D1 data
  const [phase,        setPhase]        = useState(initSession.session.phase || "idle");
  const [ctrlIdx,      setCtrlIdx]      = useState(initSession.session.ctrl_idx || 0);
  const [results,      setResults]      = useState(
    (initSession.results || []).map(r => ({ id:r.ctrl_id, name:r.ctrl_name, verdict:r.verdict, finding:r.finding, recommendation:r.recommendation, evidenceType: r.evidence_type || "none" }))
  );
  const [messages,     setMessages]     = useState(
    (initSession.messages || []).map(m => ({ role:m.role, text:m.msg_text, controlId:m.control_id, controlName:m.control_name, verdict:m.verdict, file:m.file_name }))
  );
  const [input,        setInput]        = useState("");
  const [loading,      setLoading]      = useState(false);
  const [showTracker,  setShowTracker]  = useState(true);
  const [pendingFile,  setPendingFile]  = useState(null);
  const [activeDomain, setActiveDomain] = useState(0);
  const [saveStatus,   setSaveStatus]   = useState("saved"); // saved | saving | error
  // RAG state: extracted text from the currently pending file
  const [extractedText,  setExtractedText]  = useState(null);  // string | null
  const [isExtracting,   setIsExtracting]   = useState(false); // true while PDF/DOCX is being read
  // Evidence library stores {file, text} so reused documents keep their extracted content
  const [evidenceLibrary, setEvidenceLibrary] = useState([]); // {file: File, text: string|null}[]
  const [selectedEvidence, setSelectedEvidence] = useState(null); // {file, text} | null
  // Document governance checklist — 4 items per ISO 27001 Cl. 5.2 / 7.5
  const [govChecklist, setGovChecklist] = useState([false,false,false,false,false]);
  // Re-audit mode — when set, input area targets this previous control instead of advancing
  const [reauditCtrl, setReauditCtrl]   = useState(null); // {id, name} | null
  const fileRef  = useRef(null);

  // ── RAG: Auto-extract text whenever a new file is attached ────────────────
  useEffect(() => {
    if (!pendingFile) { setExtractedText(null); return; }
    setIsExtracting(true);
    setExtractedText(null);
    setGovChecklist([false,false,false,false,false]);
    extractFileText(pendingFile).then(text => {
      setExtractedText(text);
      setIsExtracting(false);
      if (text) {
        console.log(`[RAG] Extracted ${text.length} chars from "${pendingFile.name}"`);
      } else {
        console.log(`[RAG] No text extracted from "${pendingFile.name}" (image or unsupported format)`);
      }
    }).catch(() => {
      setExtractedText(null);
      setIsExtracting(false);
    });
  }, [pendingFile]);

  // Add to evidence library (with extracted text) when file is uploaded
  const addToLibrary = (file, text) => {
    if (file && !evidenceLibrary.some(e => e.file.name === file.name)) {
      setEvidenceLibrary(prev => [...prev, { file, text }]);
      console.log(`[RAG] Added to evidence library: ${file.name} (${text ? text.length + " chars" : "no text"})`);
    }
  };
  const bottomRef = useRef(null);

  const ctrl       = ALL_CONTROLS[ctrlIdx];
  const score      = results.length ? Math.round(((results.filter(r=>r.verdict==="Compliant").length + results.filter(r=>r.verdict==="Partial").length * 0.5) / results.length)*100) : 0;
  const scoreColor = score>=75?"#22c55e":score>=50?"#eab308":"#ef4444";
  const currentDomain = ctrl ? CONTROLS.find(d=>d.items.some(i=>i.id===ctrl.id)) : null;

  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:"smooth"}); }, [messages, loading]);

  // Save indicator helpers
  const withSave = useCallback(async (fn) => {
    setSaveStatus("saving");
    try { await fn(); setSaveStatus("saved"); }
    catch { setSaveStatus("error"); }
  }, []);

  const addMsg = useCallback((role, text, meta={}) => {
    const msg = {role, text, ...meta};
    setMessages(m => [...m, msg]);
    if (!meta.isStatus) {
      withSave(() => dbSaveMessage(sid, role, text, {
        control_id:   meta.controlId   || null,
        control_name: meta.controlName || null,
        verdict:      meta.verdict     || null,
        file_name:    meta.file        || null,
      }));
    }
  }, [sid, withSave]);

  // ── Re-audit: re-run the AI audit for a previously assessed control ──────
  const submitReaudit = async () => {
    if (!reauditCtrl) return;
    const ans  = input.trim();
    const activeFile          = pendingFile || selectedEvidence?.file || null;
    const rawExtracted        = pendingFile ? extractedText : (selectedEvidence?.text || null);
    const activeExtractedText = (rawExtracted === "LEGACY_DOC") ? null : rawExtracted;
    if (!ans && !activeFile) return;

    setLoading(true);
    setInput("");

    const evidenceType = activeFile ? getEvidenceType(activeFile) : "self_declaration";
    const evInfo       = EVIDENCE_TYPES[evidenceType] || EVIDENCE_TYPES.none;
    const evidenceLabel = isRTL ? evInfo.labelAr : evInfo.label;
    const targetCtrl   = ALL_CONTROLS.find(c => c.id === reauditCtrl.id);
    if (!targetCtrl) { setLoading(false); setReauditCtrl(null); return; }

    if (activeFile && pendingFile) addToLibrary(pendingFile, extractedText);

    // Status message
    addMsg("assistant",
      isRTL ? `↺ إعادة تقييم ${reauditCtrl.id}...` : `↺ Re-auditing ${reauditCtrl.id}...`,
      { isStatus: true });

    const userLabel = isRTL
      ? `↺ إعادة تقييم ${reauditCtrl.id}` + (activeFile ? ` — ${activeFile.name}` : "")
      : `↺ Re-audit ${reauditCtrl.id}` + (activeFile ? ` — ${activeFile.name}` : "");
    addMsg("user", ans || userLabel, { file: activeFile?.name });

    const raw         = await callAI(aPrompt(targetCtrl, ans || "evidence uploaded", evidenceType, lang, form.orgName, form.industry, activeExtractedText));
    const parsed      = parseVerdict(raw, evidenceType);
    const { verdict: finalVerdict, enforced } = enforceEvidence(parsed.verdict, evidenceType);
    parsed.verdict    = finalVerdict;

    const isLegacy    = rawExtracted === "LEGACY_DOC";
    const ragLine     = activeExtractedText
      ? "\n📄 Content: " + activeExtractedText.length + " chars read — verdict based on actual content"
      : isLegacy ? "\n📋 Content: Legacy .doc — save as PDF/DOCX for full audit"
      : (evidenceType === "document" || evidenceType === "screenshot")
        ? "\n⚠️ Content: Document not read — verdict based on description only" : "";

    const verdictText =
      "↺ " + (isRTL ? "إعادة تقييم" : "Re-audit") + ": " +
      targetCtrl.id + " - " + targetCtrl.name + "\n\n" +
      (lang==="ar"?"نوع الدليل":"Evidence Type") + ": " + evInfo.icon + " " + evidenceLabel + ragLine + "\n\n" +
      (lang==="ar"?"الحكم":"Verdict") + ": " + finalVerdict + (enforced ? " ⚠️" : "") + "\n\n" +
      (lang==="ar"?"النتيجة":"Finding") + ": " + parsed.finding + "\n\n" +
      (lang==="ar"?"التوصية":"Recommendation") + ": " + parsed.recommendation;

    addMsg("assistant", verdictText, { verdict: finalVerdict, evidenceType, enforced, controlId: targetCtrl.id, controlName: targetCtrl.name });

    // Update result in state and D1, then touch session updated_at
    setResults(prev => prev.map(r => r.id === targetCtrl.id
      ? { ...r, verdict: finalVerdict, finding: parsed.finding, recommendation: parsed.recommendation, evidenceType }
      : r));
    await withSave(() => dbUpdateResult(sid, targetCtrl.id, finalVerdict, parsed.finding, parsed.recommendation, evidenceType));
    await withSave(() => dbUpdate(sid, phase, ctrlIdx));   // refresh session updated_at

    setPendingFile(null); setExtractedText(null); setSelectedEvidence(null);
    setGovChecklist([false,false,false,false,false]);
    setReauditCtrl(null);
    setLoading(false);
  };

  const startAssessment = async () => {
    setPhase("questioning");
    setLoading(true);
    const intro = lang==="ar"
      ? "بدء تقييم ISO 27001:2022 — جميع 93 ضابطاً لـ " + form.orgName + ". لنبدأ:"
      : "Starting full ISO 27001:2022 assessment — all 93 controls for " + form.orgName + ". Let's begin:";
    addMsg("assistant", intro);
    await withSave(() => dbUpdate(sid, "questioning", 0));
    const q = await callAI(qPrompt(ctrl, lang, form.orgName, form.industry));
    addMsg("assistant", q, {controlId:ctrl.id, controlName:ctrl.name});
    setLoading(false);
  };

  const submitAnswer = async () => {
    const ans = input.trim();
    // Use pendingFile, or selectedEvidence from library
    const activeFile          = pendingFile || selectedEvidence?.file || null;
    // Filter out the LEGACY_DOC sentinel so it never reaches the AI prompt
    const rawExtracted        = pendingFile ? extractedText : (selectedEvidence?.text || null);
    const activeExtractedText = (rawExtracted === "LEGACY_DOC") ? null : rawExtracted;

    if (!ans && !activeFile) return;
    setInput("");
    
    // Add new uploads to library for future reuse (with their extracted text)
    if (pendingFile) {
      addToLibrary(pendingFile, extractedText);
    }
    
    // Determine evidence type - CRITICAL: Check for file upload first
    const evidenceType = activeFile 
      ? getEvidenceType(activeFile) 
      : (ans ? "self_declaration" : "none");
    
    console.log(`[RAG] Submit: file=${activeFile?.name || 'NONE'}, evidenceType=${evidenceType}, extractedChars=${activeExtractedText?.length || 0}`);
    
    const fName = activeFile?.name;
    const evInfo = EVIDENCE_TYPES[evidenceType];
    
    // Show evidence type in user message
    const userMsgText = ans || (lang==="ar"?"[دليل مرفوع]":"[Evidence uploaded]");
    addMsg("user", userMsgText, activeFile ? {file:fName, evidenceType} : {evidenceType});
    setPendingFile(null);
    setExtractedText(null);
    setSelectedEvidence(null);
    setLoading(true);
    
    // Show transient status — mention RAG when document text was extracted
    const statusMsg = activeExtractedText
      ? (lang==="ar"?"🔍 قراءة محتوى المستند وتقييمه...":"🔍 Reading document content & evaluating...")
      : evidenceType === "self_declaration"
        ? (lang==="ar"?"⚠️ تقييم بدون دليل موثق...":"⚠️ Evaluating (no document evidence)...")
        : (lang==="ar"?"جاري التقييم...":"Evaluating...");
    setMessages(m => [...m, {role:"assistant", text:statusMsg, isStatus:true}]);

    const raw    = await callAI(aPrompt(ctrl, ans||"evidence uploaded", evidenceType, lang, form.orgName, form.industry, activeExtractedText));
    let parsed = parseVerdict(raw, evidenceType);

    // Apply enforcement rules (self-declaration can't be Compliant; no evidence = Non-Compliant)
    const { verdict: finalVerdict, enforced } = enforceEvidence(parsed.verdict, evidenceType);
    parsed.verdict = finalVerdict;

    // Remove status message
    setMessages(m => m.filter(x => !x.isStatus));

    const newResult = { id:ctrl.id, name:ctrl.name, ...parsed, evidenceType, enforced };
    let nextResults;
    setResults(r => { nextResults = [...r, newResult]; return nextResults; });

    // Enhanced verdict text with evidence type indicator
    const evidenceLabel = lang==="ar" ? evInfo.labelAr : evInfo.label;
    
    // Strong warning when verdict was enforced/downgraded
    let evidenceWarning = "";
    if (enforced || evidenceType === "self_declaration") {
      evidenceWarning = lang==="ar" 
        ? "\n\n🚫 تنبيه المدقق: الإقرار الذاتي (إجابة نصية فقط) لا يمكن أن يحقق تقييم 'متوافق'. لتحقيق الامتثال الكامل، يجب تحميل: سياسة موثقة، إجراء، لقطة شاشة للنظام، أو سجلات."
        : "\n\n🚫 AUDITOR NOTICE: Self-declaration (text-only answer) CANNOT achieve 'Compliant' rating. To achieve full compliance, you MUST upload: documented policy, procedure, system screenshot, or logs.";
    }
    
    // RAG indicator — tells the user whether AI read the document content
    const isLegacy = rawExtracted === "LEGACY_DOC";
    const ragLine = activeExtractedText
      ? (lang==="ar"
          ? "\n📄 المحتوى: تمت قراءة " + activeExtractedText.length + " حرف من المستند — الحكم مبني على محتوى المستند الفعلي"
          : "\n📄 Content: " + activeExtractedText.length + " chars read from document — verdict based on actual content")
      : isLegacy
        ? (lang==="ar"
            ? "\n📋 المحتوى: صيغة .doc القديمة لا يمكن قراءتها — احفظ الملف كـ PDF أو DOCX للحصول على تقييم دقيق"
            : "\n📋 Content: Legacy .doc format — save as PDF or DOCX for AI to read the actual document")
        : (evidenceType === "document" || evidenceType === "screenshot")
          ? (lang==="ar"
              ? "\n⚠️ المحتوى: لم يتم قراءة المستند — الحكم مبني على وصفك فقط"
              : "\n⚠️ Content: Document not read — verdict based on your description only")
          : "";

    const verdictText =
      ctrl.id + " - " + ctrl.name + "\n\n" +
      (lang==="ar"?"نوع الدليل":"Evidence Type") + ": " + evInfo.icon + " " + evidenceLabel + ragLine + "\n\n" +
      (lang==="ar"?"الحكم":"Verdict")       + ": " + finalVerdict + (enforced ? " ⚠️" : "") + "\n\n" +
      (lang==="ar"?"النتيجة":"Finding")     + ": " + parsed.finding       + "\n\n" +
      (lang==="ar"?"التوصية":"Recommendation") + ": " + parsed.recommendation + evidenceWarning;

    addMsg("assistant", verdictText, {verdict:finalVerdict, evidenceType, enforced});

    // Save result to D1 (using enforced verdict)
    await withSave(() => dbSaveResult(sid, ctrl.id, ctrl.name, finalVerdict, parsed.finding, parsed.recommendation, evidenceType));

    const next = ctrlIdx + 1;
    if (next >= TOTAL) {
      setPhase("complete");
      await withSave(() => dbUpdate(sid, "complete", ctrlIdx));
      setTimeout(async () => {
        const finalRes = await new Promise(resolve => setResults(r => { resolve(r); return r; }));
        const sum = await callAI(sPrompt(finalRes, form.orgName, form.industry, lang));
        addMsg("assistant", (lang==="ar"?"اكتمل التقييم! جميع 93 ضابطاً.\n\n":"Assessment complete! All 93 controls.\n\n") + sum);
        setLoading(false);
      }, 200);
    } else {
      setCtrlIdx(next);
      await withSave(() => dbUpdate(sid, "questioning", next));
      const nextCtrl = ALL_CONTROLS[next];
      setActiveDomain(CONTROLS.findIndex(d=>d.items.some(i=>i.id===nextCtrl.id)));
      const q = await callAI(qPrompt(nextCtrl, lang, form.orgName, form.industry));
      addMsg("assistant", q, {controlId:nextCtrl.id, controlName:nextCtrl.name});
      setLoading(false);
    }
  };

  const placeholder = phase==="idle"
    ? (lang==="ar"?"اضغط ابدأ...":"Click Start...")
    : phase==="complete" ? t.askFollowup : t.describeImpl;

  return (
    <div style={{maxWidth:1100}} dir={isRTL?"rtl":"ltr"}>
      <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}} @keyframes sp{to{transform:rotate(360deg)}}`}</style>
      <div style={{display:"grid",gridTemplateColumns:showTracker?"1fr 270px":"1fr",gap:16,alignItems:"flex-start"}}>

        {/* ── Chat panel ── */}
        <div style={{background:"#0f172a",border:"1px solid #1a2744",borderRadius:16,overflow:"hidden"}}>

          {/* Header */}
          <div style={{background:"linear-gradient(135deg,#0f172a,#022c22)",padding:"12px 16px",borderBottom:"1px solid #1a2744",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <div style={{width:34,height:34,borderRadius:"50%",background:"linear-gradient(135deg,#10b981,#059669)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>🔍</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{color:"#f1f5f9",fontWeight:700,fontSize:13}}>ISO 27001:2022 — {form.orgName}</div>
              <div style={{color:"#475569",fontSize:11}}>
                {phase==="complete"?(lang==="ar"?"اكتمل":"Complete"):phase==="idle"?(lang==="ar"?"جاهز":"Ready"):
                  (lang==="ar"?"الضابط ":"Control ")+(ctrlIdx+1)+"/"+TOTAL+(currentDomain?" — "+currentDomain.domain:"")}
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
              {/* Auto-save indicator */}
              <div style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px",background:"#080e1c",borderRadius:5,border:"1px solid #1a2744"}}>
                {saveStatus==="saving" && <div style={{width:6,height:6,borderRadius:"50%",border:"2px solid transparent",borderTopColor:"#f59e0b",animation:"sp 0.8s linear infinite"}}/>}
                {saveStatus==="saved"  && <span style={{color:"#22c55e",fontSize:10}}>●</span>}
                {saveStatus==="error"  && <span style={{color:"#ef4444",fontSize:10}}>●</span>}
                <span style={{fontSize:9,color:saveStatus==="saved"?"#22c55e":saveStatus==="error"?"#ef4444":"#f59e0b",fontWeight:700}}>
                  {saveStatus==="saving"?(isRTL?"حفظ…":"Saving…"):saveStatus==="saved"?(isRTL?"محفوظ":"Saved"):(isRTL?"خطأ":"Error")}
                </span>
              </div>
              <button onClick={()=>setShowTracker(v=>!v)}
                style={{background:"#10b98115",border:"1px solid #10b98130",color:"#10b981",borderRadius:6,padding:"4px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>
                {showTracker?t.hide:t.show} {t.tracker}
              </button>
              <button onClick={onReset}
                style={{background:"#1e293b",border:"1px solid #334155",color:"#94a3b8",borderRadius:6,padding:"4px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>
                {t.reset}
              </button>
            </div>
          </div>

          {/* Progress bar */}
          {phase!=="idle" && (
            <div style={{padding:"6px 12px",background:"#080e1c",borderBottom:"1px solid #1a2744"}}>
              <div style={{display:"flex",gap:1}}>
                {ALL_CONTROLS.map((c,i) => {
                  const r=results.find(x=>x.id===c.id);
                  const isCurr=i===ctrlIdx&&phase!=="complete";
                  const bg=r?(VC[r.verdict]||"#475569"):isCurr?"#0ea5e9":"#1e293b";
                  return <div key={c.id} title={c.id} style={{flex:"0 0 8px",height:6,borderRadius:1,background:bg}}/>;
                })}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:4,fontSize:10,color:"#334155"}}>
                <span>{results.length}/{TOTAL} {lang==="ar"?"مقيم":"assessed"}</span>
                <span style={{color:scoreColor,fontWeight:700}}>{score}%</span>
              </div>
            </div>
          )}

          {/* Messages */}
          <div style={{height:500,overflowY:"auto",padding:16,background:"#080e1c",display:"flex",flexDirection:"column",gap:10}}>
            {messages.length===0 && (
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:16}}>
                <div style={{width:70,height:70,borderRadius:"50%",background:"linear-gradient(135deg,#10b981,#059669)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:30}}>🔍</div>
                <div style={{textAlign:"center"}}>
                  <div style={{color:"#64748b",fontWeight:700,fontSize:15,marginBottom:6}}>{lang==="ar"?"تقييم ISO 27001:2022 الشامل":"Full ISO 27001:2022 Gap Assessment"}</div>
                  <div style={{fontSize:12,color:"#334155"}}>{lang==="ar"?("93 ضابطاً — "+form.orgName):("93 controls — "+form.orgName)}</div>
                  <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:12,flexWrap:"wrap"}}>
                    {CONTROLS.map(d=><span key={d.domain} style={{padding:"3px 10px",background:d.color+"15",color:d.color,borderRadius:4,fontSize:10,fontWeight:700}}>{d.items.length} {d.domain.split(" ")[1]}</span>)}
                  </div>
                  <div style={{marginTop:14,padding:"7px 14px",background:"#10b98110",border:"1px solid #10b98125",borderRadius:8,display:"inline-block"}}>
                    <span style={{fontSize:11,color:"#10b981"}}>💾 {isRTL?"التقدم محفوظ في Cloudflare D1":"Progress auto-saved to Cloudflare D1"}</span>
                  </div>
                </div>
              </div>
            )}
            {messages.map((m,i) => {
              const vc = m.verdict?(VC[m.verdict]||"#475569"):null;
              const vb = m.verdict?(VB[m.verdict]||"#0f172a"):null;
              return (
                <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",alignItems:"flex-end",gap:8}}>
                  {m.role==="assistant" && <div style={{width:26,height:26,borderRadius:"50%",background:"linear-gradient(135deg,#10b981,#059669)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0}}>🔍</div>}
                  <div style={{maxWidth:"82%",padding:"10px 14px",borderRadius:m.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",background:m.role==="user"?"linear-gradient(135deg,#10b981,#059669)":(vb||"#0f172a"),color:"#e2e8f0",fontSize:13,lineHeight:1.7,border:m.role==="assistant"?("1px solid "+(vc?vc+"30":"#1a2744")):"none",whiteSpace:"pre-wrap",direction:"auto"}}>
                    {m.controlId && <div style={{fontSize:10,fontWeight:700,color:"#10b981",marginBottom:6,fontFamily:"monospace"}}>{m.controlId} — {m.controlName}</div>}
                    {m.file      && <div style={{fontSize:10,color:"#22c55e",marginBottom:4}}>📎 {m.file}</div>}
                    {m.text}
                  </div>
                </div>
              );
            })}
            {loading && (
              <div style={{display:"flex",alignItems:"flex-end",gap:8}}>
                <div style={{width:26,height:26,borderRadius:"50%",background:"linear-gradient(135deg,#10b981,#059669)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0}}>🔍</div>
                <div style={{padding:"11px 14px",background:"#0f172a",borderRadius:16,border:"1px solid #1a2744"}}>
                  <div style={{display:"flex",gap:4}}>{[0,1,2].map(j=><div key={j} style={{width:5,height:5,borderRadius:"50%",background:"#475569",animation:`bounce 1s ${j*0.2}s infinite`}}/>)}</div>
                </div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {/* Input area */}
          <div style={{padding:"12px 16px",background:"#0f172a",borderTop:"1px solid #1a2744"}}>
            {/* ── Re-audit mode banner ─────────────────────────────────────────── */}
            {reauditCtrl && (
              <div style={{marginBottom:8,padding:"8px 12px",background:"#8b5cf615",border:"1px solid #8b5cf640",borderRadius:8,display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:14}}>↺</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#a78bfa"}}>
                    {isRTL ? `وضع إعادة التقييم — ${reauditCtrl.id}: ${reauditCtrl.name}` : `Re-audit mode — ${reauditCtrl.id}: ${reauditCtrl.name}`}
                  </div>
                  <div style={{fontSize:10,color:"#64748b",marginTop:2}}>
                    {isRTL ? "أرفق دليلاً محسّناً وأضف وصفاً ثم اضغط إعادة التقييم. لن يتأثر تقدمك الحالي." : "Attach improved evidence, add a description, then submit. Your current progress won't be affected."}
                  </div>
                </div>
                <button onClick={()=>{setReauditCtrl(null);setPendingFile(null);setExtractedText(null);setInput("");}}
                  style={{background:"none",border:"none",color:"#475569",cursor:"pointer",fontSize:16,padding:"2px 4px"}}>×</button>
              </div>
            )}
            {/* Evidence Library - show uploaded documents for reuse */}
            {(phase==="questioning" || reauditCtrl) && evidenceLibrary.length > 0 && !pendingFile && !selectedEvidence && (
              <div style={{marginBottom:8,padding:"8px 12px",background:"#0ea5e908",border:"1px solid #0ea5e925",borderRadius:8}}>
                <div style={{fontSize:11,color:"#0ea5e9",fontWeight:600,marginBottom:6}}>
                  📂 {isRTL ? "مكتبة الأدلة (انقر لإعادة الاستخدام)" : "Evidence Library (click to reuse)"}
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {evidenceLibrary.map((entry, idx) => (
                    <button key={idx}
                      onClick={() => setSelectedEvidence(entry)}
                      style={{padding:"4px 8px",background:"#0ea5e915",border:"1px solid #0ea5e930",borderRadius:5,color:"#0ea5e9",fontSize:10,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>
                      {EVIDENCE_TYPES[getEvidenceType(entry.file)]?.icon}
                      {entry.file.name.length > 20 ? entry.file.name.slice(0,20)+"..." : entry.file.name}
                      {entry.text && <span style={{color:"#22c55e",fontSize:9,marginLeft:2}}>✓ RAG</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* Selected evidence from library */}
            {selectedEvidence && (
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,padding:"6px 10px",background:"#0ea5e915",border:"1px solid #0ea5e930",borderRadius:7}}>
                <span style={{color:"#0ea5e9",fontSize:12}}>📂 {selectedEvidence.file.name}</span>
                <span style={{fontSize:10,color:"#0ea5e9",padding:"2px 6px",background:"#0ea5e915",borderRadius:4}}>
                  {EVIDENCE_TYPES[getEvidenceType(selectedEvidence.file)]?.icon} {EVIDENCE_TYPES[getEvidenceType(selectedEvidence.file)]?.label} (reused)
                </span>
                {selectedEvidence.text && (
                  <span style={{fontSize:9,color:"#22c55e",padding:"2px 5px",background:"#22c55e15",borderRadius:4}}>
                    📄 RAG ready
                  </span>
                )}
                <button onClick={()=>setSelectedEvidence(null)} style={{marginLeft:"auto",background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:16}}>×</button>
              </div>
            )}
            {/* Evidence reminder banner with expected evidence hint */}
            {phase==="questioning" && !pendingFile && !selectedEvidence && ctrl && (
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,padding:"8px 12px",background:"#f59e0b08",border:"1px solid #f59e0b25",borderRadius:8}}>
                <span style={{fontSize:14}}>📎</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,color:"#f59e0b",fontWeight:600}}>
                    {isRTL ? "💡 نصيحة: قم بتحميل دليل للحصول على تقييم 'متوافق'" : "💡 Tip: Upload evidence for 'Compliant' rating"}
                  </div>
                  {EVIDENCE_GUIDANCE[ctrl.id] && (
                    <div style={{fontSize:10,color:"#10b981",marginTop:3,fontWeight:500}}>
                      ✓ {isRTL ? "الدليل المتوقع لـ" : "Expected for"} {ctrl.id}: <strong>{EVIDENCE_GUIDANCE[ctrl.id].hint}</strong>
                    </div>
                  )}
                  <div style={{fontSize:10,color:"#64748b",marginTop:2}}>
                    {isRTL 
                      ? "الإجابات النصية فقط = إقرار ذاتي (الحد الأقصى: جزئي)"
                      : "Text-only answers = Self-declaration (max: Partial)"}
                  </div>
                </div>
              </div>
            )}
            {pendingFile && (
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,padding:"6px 10px",background:"#10b98115",border:"1px solid #10b98130",borderRadius:7,flexWrap:"wrap"}}>
                <span style={{color:"#10b981",fontSize:12}}>📎 {pendingFile.name}</span>
                <span style={{fontSize:10,color:"#22c55e",padding:"2px 6px",background:"#22c55e15",borderRadius:4}}>
                  {EVIDENCE_TYPES[getEvidenceType(pendingFile)]?.icon} {EVIDENCE_TYPES[getEvidenceType(pendingFile)]?.label}
                </span>
                {/* RAG extraction status badge */}
                {isExtracting && (
                  <span style={{fontSize:10,color:"#f59e0b",padding:"2px 6px",background:"#f59e0b15",borderRadius:4,display:"flex",alignItems:"center",gap:4}}>
                    <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",border:"2px solid transparent",borderTopColor:"#f59e0b",animation:"sp 0.8s linear infinite"}}/>
                    {isRTL ? "جارٍ قراءة المستند..." : "Reading document..."}
                  </span>
                )}
                {!isExtracting && extractedText && extractedText !== "LEGACY_DOC" && (
                  <span style={{fontSize:10,color:"#22c55e",padding:"2px 6px",background:"#22c55e10",borderRadius:4}}>
                    📄 {isRTL ? `تمت قراءة ${extractedText.length} حرف` : `${extractedText.length} chars read — AI will audit document content`}
                  </span>
                )}
                {!isExtracting && isLegacyFormat(pendingFile) && (
                  <span style={{fontSize:10,color:"#f59e0b",padding:"2px 6px",background:"#f59e0b15",borderRadius:4}}>
                    📋 {isRTL ? "صيغة .doc القديمة — احفظ كـ PDF أو DOCX حتى يقرأ الذكاء الاصطناعي محتوى المستند" : "Legacy .doc format — save as PDF or DOCX for AI to read content"}
                  </span>
                )}
                {!isExtracting && !isLegacyFormat(pendingFile) && extractedText === null && canExtractText(pendingFile) && (
                  <span style={{fontSize:10,color:"#ef4444",padding:"2px 6px",background:"#ef444415",borderRadius:4,fontWeight:600}}>
                    ⚠️ {isRTL ? "تعذّر قراءة المستند — سيتم التقييم على أساس وصفك فقط" : "Could not read document content — verdict based on description only"}
                  </span>
                )}
                {!isExtracting && extractedText === null && !canExtractText(pendingFile) && !isLegacyFormat(pendingFile) && getEvidenceType(pendingFile) === "document" && (
                  <span style={{fontSize:10,color:"#94a3b8",padding:"2px 6px",background:"#94a3b815",borderRadius:4}}>
                    {isRTL ? "صيغة غير مدعومة — استخدم PDF أو DOCX" : "Format not readable — use PDF or DOCX"}
                  </span>
                )}
                <button onClick={()=>{setPendingFile(null);setExtractedText(null);setGovChecklist([false,false,false,false,false]);}} style={{marginLeft:"auto",background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:16}}>×</button>
              </div>
            )}
            {/* ── Context-aware Evidence Checklist ─────────────────────────────── */}
            {pendingFile && (()=>{
              const ext = "." + pendingFile.name.split(".").pop().toLowerCase();
              const POLICY_EXTS = [".pdf",".doc",".docx",".ppt",".pptx",".txt",".md"];
              const DATA_EXTS   = [".xls",".xlsx",".csv",".json",".xml",".log"];
              const IMG_EXTS    = [".jpg",".jpeg",".png",".gif",".bmp",".webp"];

              let kind, title, ref, items;

              if (POLICY_EXTS.includes(ext)) {
                kind  = "policy";
                title = isRTL ? "قائمة حوكمة الوثيقة (سياسة / إجراء)" : "Policy / Procedure Governance Checklist";
                ref   = "ISO 27001 Cl. 5.2 / 7.5 · ⚠️ Signatures & stamps in PDFs are images — AI uses named approver text";
                items = isRTL ? [
                  "موافقة الإدارة العليا — اسم المعتمد (رئيس تنفيذي / مجلس إدارة / CISO) أو توقيع",
                  "رقم الإصدار والتاريخ الساري (مثال: v1.0 — 2026-01-01)",
                  "مالك الوثيقة محدد (الاسم أو المنصب المسؤول)",
                  "دورة مراجعة دورية محددة (مثال: تُراجع سنوياً أو عند أي تغيير جوهري)",
                ] : [
                  "Management approval — CEO/Board/CISO named as approver or signature present",
                  "Version number & effective date (e.g. v1.0 — 2026-01-01)",
                  "Document owner identified (name or responsible role)",
                  "Review cycle stated (e.g. 'reviewed annually' or a NEXT REVIEW date)",
                ];
              } else if (DATA_EXTS.includes(ext)) {
                kind  = "data";
                title = isRTL ? "قائمة التحقق من السجلات والبيانات" : "Log / Data Evidence Checklist";
                ref   = "ISO 27001 Cl. 8.15 / A.5.33";
                items = isRTL ? [
                  "النطاق الزمني للسجلات ظاهر بوضوح (تاريخ البداية والنهاية)",
                  "مصدر النظام أو التطبيق محدد (اسم النظام / عنوان IP / المنصة)",
                  "الأحداث ذات الصلة بمتطلب التحكم موجودة في السجل",
                  "السجلات مُصدَّرة مباشرة من النظام (غير معدلة يدوياً)",
                  "الحساب أو المستخدم أو النشاط موثق بوضوح",
                ] : [
                  "Date range of the log/data clearly visible (start and end timestamps)",
                  "Source system or application identified (system name / IP / platform)",
                  "Relevant events or entries for this control are present",
                  "Data exported directly from the system — not manually edited",
                  "User, account, or activity clearly identifiable in the records",
                ];
              } else if (IMG_EXTS.includes(ext)) {
                kind  = "screenshot";
                title = isRTL ? "قائمة التحقق من لقطة شاشة نظام تقنية المعلومات" : "IT System Screenshot Checklist";
                ref   = "ISO 27001 Cl. 8 / A.8";
                items = isRTL ? [
                  "اسم النظام أو التطبيق ظاهر في اللقطة (شريط العنوان / الشعار)",
                  "التاريخ والوقت مرئيان (ساعة النظام أو طابع زمني)",
                  "الإعداد أو التكوين أو النشاط ذو الصلة بالمتطلب ظاهر بوضوح",
                  "اسم المستخدم أو الحساب الذي يُجري التكوين مرئي (إن أمكن)",
                  "اللقطة واضحة وقابلة للقراءة (غير ضبابية أو مقطوعة)",
                ] : [
                  "System or application name visible (title bar, logo, or URL)",
                  "Date and time visible — system clock or on-screen timestamp",
                  "Relevant setting, config, or activity for this control clearly shown",
                  "Username or account performing the configuration visible (if applicable)",
                  "Screenshot is clear and fully readable — not blurry or cropped",
                ];
              } else {
                return null; // unsupported type — no checklist
              }

              const checked = govChecklist.filter(Boolean).length;
              const total   = items.length;
              const allOk   = checked === total;
              const icon    = kind === "policy" ? "📋" : kind === "data" ? "📊" : "🖥️";

              return (
                <div style={{marginBottom:8,padding:"10px 14px",background: allOk?"#10b98108":"#f59e0b08",border:`1px solid ${allOk?"#10b98130":"#f59e0b30"}`,borderRadius:9}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                    <span style={{fontSize:11,fontWeight:700,color:allOk?"#10b981":"#f59e0b"}}>
                      {allOk?"✅":icon} {title} — {checked}/{total} {isRTL?"مكتملة":"complete"}
                    </span>
                    <span style={{fontSize:9,color:"#475569"}}>{ref}</span>
                  </div>
                  {items.map((label,i)=>(
                    <label key={i} style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:4,cursor:"pointer"}}>
                      <input type="checkbox" checked={govChecklist[i]||false}
                        onChange={()=>setGovChecklist(prev=>{const n=[...prev];n[i]=!n[i];return n;})}
                        style={{marginTop:2,accentColor:"#10b981",width:13,height:13,flexShrink:0}}/>
                      <span style={{fontSize:11,color:govChecklist[i]?"#10b981":"#94a3b8",textDecoration:govChecklist[i]?"line-through":"none",lineHeight:1.4}}>
                        {label}
                      </span>
                    </label>
                  ))}
                  {!allOk && (
                    <div style={{marginTop:6,fontSize:10,color:"#f59e0b",padding:"4px 8px",background:"#f59e0b10",borderRadius:5}}>
                      {isRTL
                        ? "⚠️ يمكنك المتابعة — سيشير الذكاء الاصطناعي إلى أي عناصر مفقودة في نتائجه."
                        : "⚠️ You can still submit — the AI will flag any missing elements in its finding."}
                    </div>
                  )}
                  {allOk && (
                    <div style={{marginTop:6,fontSize:10,color:"#10b981",padding:"4px 8px",background:"#10b98110",borderRadius:5}}>
                      {isRTL?"🎉 الدليل مستوفٍ لمتطلبات الجودة. جاهز للتقييم.":"🎉 Evidence meets quality requirements. Ready to submit."}
                    </div>
                  )}
                </div>
              );
            })()}
            <div style={{display:"flex",gap:8}}>
              {(phase==="questioning" || reauditCtrl) && <>
                <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp" style={{display:"none"}} onChange={e=>setPendingFile(e.target.files[0])}/>
                <button onClick={()=>fileRef.current?.click()} title={t.uploadEvidence}
                  style={{padding:"10px 12px",background:"#1e293b",border:"1px solid #334155",borderRadius:9,color:"#64748b",fontSize:14,cursor:"pointer",flexShrink:0}}>📎</button>
              </>}
              <input value={input} onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){ reauditCtrl?submitReaudit():phase==="idle"?startAssessment():submitAnswer(); }}}
                placeholder={reauditCtrl?(isRTL?`إعادة تقييم ${reauditCtrl.id} — اكتب وصفاً أو أرفق دليلاً...`:`Re-auditing ${reauditCtrl.id} — describe or attach updated evidence...`):placeholder}
                dir="auto"
                style={{flex:1,padding:"10px 13px",border:`1.5px solid ${reauditCtrl?"#8b5cf650":"#1e293b"}`,borderRadius:9,fontSize:13,background:"#080e1c",color:"#e2e8f0",fontFamily:"inherit"}}/>
              <button
                onClick={reauditCtrl?submitReaudit:phase==="idle"?startAssessment:submitAnswer}
                disabled={loading||isExtracting||(reauditCtrl&&!input.trim()&&!pendingFile&&!selectedEvidence)||(phase==="questioning"&&!reauditCtrl&&!input.trim()&&!pendingFile&&!selectedEvidence)}
                style={{padding:"10px 18px",background:(loading||isExtracting)?"#1e293b":reauditCtrl?"linear-gradient(135deg,#8b5cf6,#7c3aed)":"linear-gradient(135deg,#10b981,#059669)",border:"none",borderRadius:9,color:(loading||isExtracting)?"#475569":"#fff",fontSize:13,fontWeight:700,cursor:(loading||isExtracting)?"default":"pointer",fontFamily:"inherit",flexShrink:0}}>
                {isExtracting?(lang==="ar"?"قراءة...":"Reading..."):reauditCtrl?(lang==="ar"?"↺ إعادة":"↺ Re-audit"):phase==="idle"?(lang==="ar"?"ابدأ":"Start"):t.submit}
              </button>
            </div>
          </div>
        </div>

        {/* ── Tracker panel ── */}
        {showTracker && (
          <div style={{display:"flex",flexDirection:"column",gap:10,maxHeight:"90vh",overflowY:"auto"}}>
            <div style={{background:"#0f172a",border:"1px solid #1a2744",borderRadius:12,padding:16}}>
              <div style={{fontSize:10,fontWeight:700,color:"#334155",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>{t.liveScore}</div>
              <div style={{fontSize:40,fontWeight:900,color:scoreColor,lineHeight:1,marginBottom:6}}>{score}%</div>
              <div style={{height:5,background:"#1e293b",borderRadius:3,overflow:"hidden",marginBottom:8}}>
                <div style={{height:"100%",width:score+"%",background:scoreColor,borderRadius:3,transition:"width 0.5s"}}/>
              </div>
              <div style={{fontSize:11,color:"#475569",marginBottom:10}}>{results.length} / {TOTAL} {t.controlsAssessed}</div>
              <div style={{display:"flex",gap:6}}>
                {[["Compliant","#22c55e","OK"],["Partial","#eab308","~"],["Non-Compliant","#ef4444","X"]].map(([v,c,icon])=>{
                  const n=results.filter(r=>r.verdict===v).length;
                  return (
                    <div key={v} style={{flex:1,textAlign:"center",padding:"6px 4px",background:c+"12",borderRadius:7,border:"1px solid "+c+"25"}}>
                      <div style={{fontSize:18,fontWeight:800,color:c}}>{n}</div>
                      <div style={{fontSize:9,color:"#475569",fontWeight:600}}>{icon}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Evidence Quality Score */}
            {results.length > 0 && (() => {
              const docCount = results.filter(r=>r.evidenceType==="document").length;
              const ssCount = results.filter(r=>r.evidenceType==="screenshot").length;
              const selfCount = results.filter(r=>r.evidenceType==="self_declaration").length;
              const noneCount = results.filter(r=>!r.evidenceType || r.evidenceType==="none").length;
              const evidenceScore = Math.round(((docCount * 1.0 + ssCount * 0.7 + selfCount * 0.3) / results.length) * 100);
              const evColor = evidenceScore >= 70 ? "#22c55e" : evidenceScore >= 40 ? "#f59e0b" : "#ef4444";
              return (
                <div style={{background:"#0f172a",border:"1px solid #1a2744",borderRadius:12,padding:16}}>
                  <div style={{fontSize:10,fontWeight:700,color:"#334155",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>
                    {isRTL ? "جودة الأدلة" : "Evidence Quality"}
                  </div>
                  <div style={{display:"flex",alignItems:"baseline",gap:6,marginBottom:8}}>
                    <div style={{fontSize:28,fontWeight:900,color:evColor,lineHeight:1}}>{evidenceScore}%</div>
                    <div style={{fontSize:10,color:"#475569"}}>{isRTL ? "موثقة" : "Documented"}</div>
                  </div>
                  <div style={{height:4,background:"#1e293b",borderRadius:2,overflow:"hidden",marginBottom:10}}>
                    <div style={{height:"100%",width:evidenceScore+"%",background:evColor,borderRadius:2,transition:"width 0.5s"}}/>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                    {[
                      [EVIDENCE_TYPES.document.icon, isRTL ? "مستندات" : "Documents", docCount, EVIDENCE_TYPES.document.color],
                      [EVIDENCE_TYPES.screenshot.icon, isRTL ? "لقطات" : "Screenshots", ssCount, EVIDENCE_TYPES.screenshot.color],
                      [EVIDENCE_TYPES.self_declaration.icon, isRTL ? "إقرار ذاتي" : "Self-Decl.", selfCount, EVIDENCE_TYPES.self_declaration.color],
                      [EVIDENCE_TYPES.none.icon, isRTL ? "بدون دليل" : "No Evidence", noneCount, EVIDENCE_TYPES.none.color],
                    ].map(([icon, label, count, color]) => (
                      <div key={label} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 6px",background:color+"10",borderRadius:5,border:"1px solid "+color+"25"}}>
                        <span style={{fontSize:11}}>{icon}</span>
                        <span style={{fontSize:10,color:"#64748b",flex:1}}>{label}</span>
                        <span style={{fontSize:12,fontWeight:700,color}}>{count}</span>
                      </div>
                    ))}
                  </div>
                  {selfCount > docCount && results.length >= 5 && (
                    <div style={{marginTop:10,padding:"8px 10px",background:"#f59e0b10",border:"1px solid #f59e0b30",borderRadius:7}}>
                      <div style={{fontSize:10,color:"#f59e0b",lineHeight:1.5}}>
                        ⚠️ {isRTL 
                          ? "معظم الإجابات إقرارات ذاتية. قم بتحميل السياسات والإجراءات للحصول على تقييم متوافق."
                          : "Most responses are self-declarations. Upload policies/procedures for Compliant ratings."}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {CONTROLS.map((d,i)=>(
                <button key={i} onClick={()=>setActiveDomain(i)}
                  style={{padding:"4px 8px",background:activeDomain===i?d.color+"20":"transparent",border:"1px solid "+(activeDomain===i?d.color:"#1a2744"),borderRadius:6,color:activeDomain===i?d.color:"#475569",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                  {d.domain.split(" ")[0]} {d.domain.split(" ")[1]}
                </button>
              ))}
            </div>

            <div style={{background:"#0f172a",border:"1px solid #1a2744",borderRadius:12,padding:"10px 12px"}}>
              <div style={{fontSize:10,fontWeight:700,color:CONTROLS[activeDomain].color,marginBottom:8,textTransform:"uppercase"}}>
                {CONTROLS[activeDomain].domain} — {CONTROLS[activeDomain].items.filter(i=>results.find(r=>r.id===i.id)).length}/{CONTROLS[activeDomain].items.length}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:3,maxHeight:300,overflowY:"auto"}}>
                {CONTROLS[activeDomain].items.map(item=>{
                  const r=results.find(x=>x.id===item.id);
                  const isCurrent=ctrl&&item.id===ctrl.id&&phase==="questioning";
                  const isReauditing=reauditCtrl&&item.id===reauditCtrl.id;
                  const col=isReauditing?"#a78bfa":r?(VC[r.verdict]||"#475569"):isCurrent?"#0ea5e9":"#334155";
                  return (
                    <div key={item.id} style={{display:"flex",alignItems:"center",gap:6,padding:"3px 5px",borderRadius:5,background:isReauditing?"#8b5cf615":isCurrent?"#0ea5e910":"transparent",border:isReauditing?"1px solid #8b5cf640":isCurrent?"1px solid #0ea5e930":"1px solid transparent"}}>
                      <span style={{fontFamily:"monospace",fontSize:9,color:col,fontWeight:700,flexShrink:0,width:38}}>{item.id}</span>
                      <span style={{fontSize:10,color:col,flex:1,lineHeight:1.2}}>{item.name}</span>
                      {r && !isReauditing && <span style={{fontSize:10,color:VC[r.verdict],flexShrink:0}}>{r.verdict==="Compliant"?"OK":r.verdict==="Partial"?"~":"X"}</span>}
                      {isReauditing && <span style={{fontSize:10,color:"#a78bfa",flexShrink:0}}>↺</span>}
                      {r && !isReauditing && !loading && (
                        <button title={isRTL?"إعادة التقييم":"Re-audit this control"}
                          onClick={()=>{ setReauditCtrl({id:item.id,name:item.name}); setPendingFile(null); setExtractedText(null); setInput(""); setGovChecklist([false,false,false,false,false]); }}
                          style={{background:"none",border:"none",color:"#475569",cursor:"pointer",fontSize:11,padding:"1px 3px",lineHeight:1,flexShrink:0,opacity:0.6}}
                          onMouseEnter={e=>e.target.style.color="#a78bfa"}
                          onMouseLeave={e=>e.target.style.color="#475569"}>↺</button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{background:"#0f172a",border:"1px solid #1a2744",borderRadius:12,padding:"12px 14px"}}>
              <div style={{fontSize:10,fontWeight:700,color:"#334155",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>Domain Progress</div>
              {CONTROLS.map(d=>{
                const assessed=d.items.filter(i=>results.find(r=>r.id===i.id)).length;
                return (
                  <div key={d.domain} style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{fontSize:10,color:"#64748b"}}>{d.domain.replace("Controls","").trim()}</span>
                      <span style={{fontSize:10,color:d.color,fontWeight:700}}>{assessed}/{d.items.length}</span>
                    </div>
                    <div style={{height:3,background:"#1e293b",borderRadius:2,overflow:"hidden"}}>
                      <div style={{height:"100%",width:(d.items.length?(assessed/d.items.length*100):0)+"%",background:d.color,borderRadius:2,transition:"width 0.5s"}}/>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Session info */}
            <div style={{background:"#0f172a",border:"1px solid #1a2744",borderRadius:12,padding:"12px 14px"}}>
              <div style={{fontSize:10,fontWeight:700,color:"#334155",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>
                {isRTL?"معلومات الجلسة":"Session"}
              </div>
              <div style={{fontSize:10,color:"#475569",fontFamily:"monospace",marginBottom:6,wordBreak:"break-all"}}>{sid}</div>
              <div style={{display:"flex",alignItems:"center",gap:5}}>
                <span style={{fontSize:9,color:"#22c55e"}}>●</span>
                <span style={{fontSize:10,color:"#475569"}}>Cloudflare D1</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
// Build trigger: 1777050582
