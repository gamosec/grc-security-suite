// GRCAssistant.jsx — Full ISO 27001:2022 GRC Consultant Chatbot
// Handles: interview-style assessment, file uploads (PDF/image/xlsx), evidence analysis, compliance tracking

import { useState, useRef, useEffect } from "react";

const ISO_DOMAINS = [
  {
    id: "A.5", name: "Organizational Controls",
    controls: [
      { id:"A.5.1",  name:"Information Security Policies",         question:"Do you have a formal information security policy approved by management? If yes, please upload it or describe its contents." },
      { id:"A.5.2",  name:"Information Security Roles",            question:"Are information security roles and responsibilities clearly defined and assigned? Who is responsible for security in your org?" },
      { id:"A.5.15", name:"Access Control Policy",                 question:"Do you have a documented access control policy? How do you manage who gets access to what systems?" },
      { id:"A.5.24", name:"Incident Management Planning",          question:"Do you have an incident response plan? How do you detect, report and respond to security incidents?" },
      { id:"A.5.30", name:"ICT Readiness for Business Continuity", question:"Do you have a business continuity or disaster recovery plan for ICT systems?" },
    ]
  },
  {
    id: "A.6", name: "People Controls",
    controls: [
      { id:"A.6.1", name:"Screening",                  question:"Do you conduct background checks on employees before hiring, especially for sensitive roles?" },
      { id:"A.6.3", name:"Information Security Awareness", question:"Do you run regular security awareness training for staff? How often, and what does it cover?" },
      { id:"A.6.5", name:"Responsibilities After Termination", question:"When an employee leaves, how do you revoke their access and handle return of assets?" },
    ]
  },
  {
    id: "A.7", name: "Physical Controls",
    controls: [
      { id:"A.7.1", name:"Physical Security Perimeters", question:"How do you physically secure your offices and data centers? Are there access controls like badges or locks?" },
      { id:"A.7.4", name:"Physical Security Monitoring",  question:"Do you have CCTV or other monitoring in areas with sensitive systems?" },
      { id:"A.7.7", name:"Clear Desk Policy",             question:"Do you have a clear desk/screen policy? How is it enforced?" },
    ]
  },
  {
    id: "A.8", name: "Technological Controls",
    controls: [
      { id:"A.8.2",  name:"Privileged Access Rights",     question:"How do you manage privileged/admin accounts? Is there MFA enforced for admin access?" },
      { id:"A.8.5",  name:"Secure Authentication",        question:"What authentication methods are used across your systems? Is MFA implemented for all users?" },
      { id:"A.8.8",  name:"Vulnerability Management",     question:"Do you have a vulnerability scanning or patch management process? How often do you scan?" },
      { id:"A.8.12", name:"Data Leakage Prevention",      question:"Do you use any DLP tools or controls to prevent sensitive data from leaving the organization?" },
      { id:"A.8.15", name:"Logging and Monitoring",       question:"Do you have centralized logging? Are logs reviewed and alerts set up for suspicious activity?" },
      { id:"A.8.24", name:"Cryptography",                 question:"How do you protect sensitive data at rest and in transit? What encryption standards do you use?" },
    ]
  }
];

const ALL_CONTROLS = ISO_DOMAINS.flatMap(d => d.controls.map(c => ({...c, domain: d.name, domainId: d.id})));
const TOTAL = ALL_CONTROLS.length;

const VERDICT_STYLE = {
  "Compliant":     { bg:"#dcfce7", color:"#166534", dot:"#22c55e", icon:"✓" },
  "Partial":       { bg:"#fef9c3", color:"#854d0e", dot:"#eab308", icon:"~" },
  "Non-Compliant": { bg:"#fee2e2", color:"#991b1b", dot:"#ef4444", icon:"✗" },
  "Pending":       { bg:"#f1f5f9", color:"#64748b", dot:"#94a3b8", icon:"?" },
};

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getMediaType(file) {
  if (file.type === "application/pdf") return "application/pdf";
  if (file.type.startsWith("image/")) return file.type;
  return null; // xlsx etc — treat as text description
}

export default function GRCAssistant({ form }) {
  const [messages, setMessages]           = useState([]);
  const [input, setInput]                 = useState("");
  const [loading, setLoading]             = useState(false);
  const [assessments, setAssessments]     = useState({}); // controlId -> {verdict, summary}
  const [currentIdx, setCurrentIdx]       = useState(0);
  const [phase, setPhase]                 = useState("intro"); // intro | assessing | done
  const [uploadedFile, setUploadedFile]   = useState(null);
  const [showTracker, setShowTracker]     = useState(true);
  const bottomRef  = useRef(null);
  const fileRef    = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:"smooth"}); }, [messages]);

  // Boot greeting
  useEffect(() => {
    setMessages([{
      role: "assistant",
      text: `👋 Hello! I'm your ISO 27001:2022 GRC Consultant for **${form.orgName}**.\n\nI'll conduct a structured assessment across all **${TOTAL} controls** in 4 domains. For each control I'll ask you a question — you can answer in text, or upload evidence (policies, screenshots, reports).\n\nI'll assess each control as **Compliant ✓**, **Partial ~**, or **Non-Compliant ✗** based on your responses and give you actionable recommendations.\n\nReady to begin? Type **"start"** or click below.`,
      type: "intro"
    }]);
  }, []);

  function addMsg(role, text, extra={}) {
    setMessages(m => [...m, { role, text, ...extra }]);
  }

  function currentControl() { return ALL_CONTROLS[currentIdx]; }

  async function askControl(idx) {
    const ctrl = ALL_CONTROLS[idx];
    const domain = ISO_DOMAINS.find(d => d.id === ctrl.domainId);
    const isFirstInDomain = domain.controls[0].id === ctrl.id;
    let text = "";
    if (isFirstInDomain) {
      text += `\n---\n📁 **Domain ${ctrl.domainId}: ${ctrl.domainId === "A.5" ? "Organizational" : ctrl.domainId === "A.6" ? "People" : ctrl.domainId === "A.7" ? "Physical" : "Technological"} Controls** (${domain.controls.length} controls)\n\n`;
    }
    text += `**[${ctrl.id}] ${ctrl.name}** *(${idx+1}/${TOTAL})*\n\n${ctrl.question}\n\n💡 You can type your answer, or upload a document as evidence using the 📎 button.`;
    addMsg("assistant", text, {controlId: ctrl.id});
  }

  async function evaluateControl(ctrl, userAnswer, evidenceInfo) {
    const prompt = `You are a strict ISO 27001:2022 lead auditor conducting a real compliance assessment.

Organization: ${form.orgName} (${form.industry}, ${form.size})
Control: ${ctrl.id} — ${ctrl.name}
Domain: ${ctrl.domain}

Auditor question asked: "${ctrl.question}"

User's response: "${userAnswer}"
${evidenceInfo ? `Evidence provided: ${evidenceInfo}` : "No evidence uploaded."}

Based ONLY on what the user actually told you (not assumptions), assess this control.
Be strict but fair — partial implementation = Partial, not Compliant.

Respond in this EXACT format (no extra text):
VERDICT: [Compliant|Partial|Non-Compliant]
SUMMARY: [1 sentence explaining why]
RECOMMENDATION: [1-2 sentences of specific actionable advice]
GAP: [1 sentence on what is missing, or "None" if Compliant]`;

    const res = await fetch("/api/chat", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ messages:[{role:"user", content: prompt}] })
    });
    const data = await res.json();
    const raw = (data.content||[]).map(b=>b.text||"").join("");

    const verdict = (raw.match(/VERDICT:\s*(Compliant|Partial|Non-Compliant)/i)||[])[1] || "Partial";
    const summary = (raw.match(/SUMMARY:\s*(.+)/i)||[])[1] || "";
    const recommendation = (raw.match(/RECOMMENDATION:\s*(.+)/i)||[])[1] || "";
    const gap = (raw.match(/GAP:\s*(.+)/i)||[])[1] || "";

    return { verdict, summary, recommendation, gap };
  }

  async function analyzeFileWithAI(file, ctrl) {
    const mediaType = getMediaType(file);
    if (!mediaType) {
      return `User uploaded a file named "${file.name}" (${(file.size/1024).toFixed(0)}KB). Treat this as supporting evidence for the control.`;
    }
    try {
      const b64 = await fileToBase64(file);
      const contentBlocks = [
        {
          type: mediaType === "application/pdf" ? "document" : "image",
          source: { type:"base64", media_type: mediaType, data: b64 }
        },
        {
          type: "text",
          text: `This evidence was submitted for ISO 27001:2022 control ${ctrl.id} (${ctrl.name}) by ${form.orgName}. Briefly describe what this document contains that is relevant to this control (2-3 sentences max).`
        }
      ];
      const res = await fetch("/api/chat", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ messages:[{role:"user", content: contentBlocks}] })
      });
      const data = await res.json();
      return (data.content||[]).map(b=>b.text||"").join("") || `File "${file.name}" uploaded as evidence.`;
    } catch(e) {
      return `User uploaded "${file.name}" as evidence.`;
    }
  }

  async function handleSend() {
    const text = input.trim();
    if ((!text && !uploadedFile) || loading) return;
    setLoading(true);
    setInput("");

    // Intro phase
    if (phase === "intro") {
      addMsg("user", text || "Start assessment");
      setUploadedFile(null);
      setPhase("assessing");
      setTimeout(() => askControl(0), 300);
      setLoading(false);
      return;
    }

    // Assessing phase
    if (phase === "assessing") {
      const ctrl = currentControl();
      let evidenceInfo = null;
      let userDisplayText = text || "";

      // Handle file upload
      if (uploadedFile) {
        addMsg("user", text ? `${text}\n\n📎 Evidence: **${uploadedFile.name}**` : `📎 Uploaded evidence: **${uploadedFile.name}**`, {hasFile: true});
        addMsg("assistant", `📄 Analyzing your evidence: **${uploadedFile.name}**...`, {type:"analyzing"});
        evidenceInfo = await analyzeFileWithAI(uploadedFile, ctrl);
        userDisplayText = (text ? text + " " : "") + `[Evidence: ${uploadedFile.name}]`;
        setUploadedFile(null);
      } else {
        addMsg("user", text);
      }

      // Evaluate the control
      addMsg("assistant", `🔍 Evaluating **${ctrl.id} — ${ctrl.name}**...`, {type:"evaluating"});
      try {
        const result = await evaluateControl(ctrl, userDisplayText || "(No verbal response — evidence only)", evidenceInfo);
        const vs = VERDICT_STYLE[result.verdict] || VERDICT_STYLE["Partial"];

        setAssessments(prev => ({...prev, [ctrl.id]: result}));

        const verdictMsg = `**Assessment: ${ctrl.id} — ${ctrl.name}**\n\n` +
          `**Verdict:** ${result.verdict === "Compliant" ? "✅" : result.verdict === "Partial" ? "⚠️" : "❌"} ${result.verdict}\n\n` +
          `**Finding:** ${result.summary}\n\n` +
          (result.gap !== "None" ? `**Gap:** ${result.gap}\n\n` : "") +
          `**Recommendation:** ${result.recommendation}`;

        addMsg("assistant", verdictMsg, {type:"verdict", verdict: result.verdict});

        const nextIdx = currentIdx + 1;
        if (nextIdx >= TOTAL) {
          setPhase("done");
          setTimeout(() => generateFinalReport(), 600);
        } else {
          setCurrentIdx(nextIdx);
          setTimeout(() => askControl(nextIdx), 800);
        }
      } catch(e) {
        addMsg("assistant", "⚠️ Error evaluating this control. Please try again.");
      }
    }
    setLoading(false);
  }

  async function generateFinalReport() {
    const compliant   = Object.values(assessments).filter(a=>a.verdict==="Compliant").length;
    const partial     = Object.values(assessments).filter(a=>a.verdict==="Partial").length;
    const nonCompliant= Object.values(assessments).filter(a=>a.verdict==="Non-Compliant").length;
    const score = Math.round((compliant * 100 + partial * 50) / TOTAL);

    const gaps = Object.entries(assessments)
      .filter(([,a])=>a.verdict!=="Compliant")
      .map(([id,a])=>`${id}: ${a.gap}`)
      .join("; ");

    const prompt = `You are a senior ISO 27001:2022 auditor. Write a brief executive summary (4-5 sentences) for ${form.orgName} based on this assessment:
Score: ${score}/100 | Compliant: ${compliant} | Partial: ${partial} | Non-Compliant: ${nonCompliant} out of ${TOTAL} controls.
Key gaps: ${gaps}
Write as a professional auditor addressing the organization's leadership. Be direct and specific.`;

    const res = await fetch("/api/chat", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ messages:[{role:"user", content: prompt}] })
    });
    const data = await res.json();
    const summary = (data.content||[]).map(b=>b.text||"").join("");

    const compliant2   = Object.values(assessments).filter(a=>a.verdict==="Compliant").length;
    const partial2     = Object.values(assessments).filter(a=>a.verdict==="Partial").length;
    const nonCompliant2= Object.values(assessments).filter(a=>a.verdict==="Non-Compliant").length;
    const score2 = Math.round((compliant2 * 100 + partial2 * 50) / TOTAL);

    addMsg("assistant",
      `🎉 **Assessment Complete for ${form.orgName}**\n\n` +
      `📊 **Final Score: ${score2}/100**\n` +
      `✅ Compliant: ${compliant2} controls\n` +
      `⚠️ Partial: ${partial2} controls\n` +
      `❌ Non-Compliant: ${nonCompliant2} controls\n\n` +
      `**Executive Summary:**\n${summary}\n\n` +
      `You can now ask me follow-up questions about any specific control or remediation steps.`,
      {type:"final"}
    );
    setPhase("followup");
  }

  async function handleFollowup() {
    const text = input.trim();
    if (!text || loading) return;
    setLoading(true);
    setInput("");
    addMsg("user", text);

    const assessed = Object.entries(assessments).map(([id, a]) =>
      `${id}: ${a.verdict} — ${a.summary} | Gap: ${a.gap} | Fix: ${a.recommendation}`
    ).join("\n");

    const prompt = `You are a senior ISO 27001:2022 GRC consultant for ${form.orgName} (${form.industry}).
Full assessment results:
${assessed}

The user asks: "${text}"

Answer as an expert consultant. Be specific, practical, and reference the actual assessment results. Max 150 words.`;

    const res = await fetch("/api/chat", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ messages:[{role:"user", content: prompt}] })
    });
    const data = await res.json();
    const reply = (data.content||[]).map(b=>b.text||"").join("") || "I couldn't generate a response. Please try again.";
    addMsg("assistant", reply);
    setLoading(false);
  }

  function renderMessage(msg, i) {
    const isUser = msg.role === "user";
    const vs = msg.verdict ? VERDICT_STYLE[msg.verdict] : null;

    return (
      <div key={i} style={{display:"flex", justifyContent:isUser?"flex-end":"flex-start", marginBottom:10}}>
        {!isUser && (
          <div style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,#0ea5e9,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0,marginRight:8,marginTop:2}}>🤖</div>
        )}
        <div style={{
          maxWidth:"78%",
          padding: vs ? "12px 14px" : "10px 14px",
          borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
          background: vs ? vs.bg : isUser ? "linear-gradient(135deg,#0ea5e9,#8b5cf6)" : "#fff",
          color: vs ? vs.color : isUser ? "#fff" : "#1e293b",
          fontSize:13, lineHeight:1.65,
          boxShadow:"0 1px 4px rgba(0,0,0,0.08)",
          border: !isUser && !vs ? "1px solid #e2e8f0" : vs ? `1px solid ${vs.dot}40` : "none",
          whiteSpace:"pre-wrap"
        }}>
          {vs && (
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8,paddingBottom:8,borderBottom:`1px solid ${vs.dot}30`}}>
              <span style={{width:18,height:18,borderRadius:"50%",background:vs.dot,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#fff",fontWeight:800}}>{vs.icon}</span>
              <span style={{fontWeight:800,fontSize:12,textTransform:"uppercase",letterSpacing:"0.06em"}}>{msg.verdict}</span>
            </div>
          )}
          {formatText(msg.text)}
        </div>
      </div>
    );
  }

  function formatText(text) {
    return text.split("\n").map((line, i) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <span key={i}>
          {parts.map((p, j) =>
            p.startsWith("**") && p.endsWith("**")
              ? <strong key={j}>{p.slice(2,-2)}</strong>
              : p
          )}
          {i < text.split("\n").length - 1 && <br/>}
        </span>
      );
    });
  }

  // Progress tracker
  const assessed = Object.keys(assessments).length;
  const compliantCount   = Object.values(assessments).filter(a=>a.verdict==="Compliant").length;
  const partialCount     = Object.values(assessments).filter(a=>a.verdict==="Partial").length;
  const nonCompliantCount= Object.values(assessments).filter(a=>a.verdict==="Non-Compliant").length;
  const scoreNow = assessed > 0 ? Math.round((compliantCount*100 + partialCount*50) / TOTAL) : 0;

  return (
    <div style={{display:"flex",gap:16,alignItems:"flex-start",marginTop:20}}>

      {/* Tracker Panel */}
      {showTracker && (
        <div style={{width:240,flexShrink:0,background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,overflow:"hidden",position:"sticky",top:70}}>
          <div style={{background:"linear-gradient(135deg,#0f172a,#1e1b4b)",padding:"14px 16px"}}>
            <div style={{color:"#fff",fontWeight:700,fontSize:13}}>ISO 27001 Assessment</div>
            <div style={{color:"#64748b",fontSize:11,marginTop:2}}>{assessed}/{TOTAL} controls assessed</div>
          </div>

          {assessed > 0 && (
            <div style={{padding:"12px 14px",borderBottom:"1px solid #f1f5f9"}}>
              <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>Live Score</div>
              <div style={{fontSize:28,fontWeight:900,color:scoreNow>=75?"#10b981":scoreNow>=50?"#f59e0b":"#ef4444"}}>{scoreNow}<span style={{fontSize:14,color:"#94a3b8",fontWeight:400}}>/100</span></div>
              <div style={{height:4,background:"#f1f5f9",borderRadius:2,marginTop:8,overflow:"hidden"}}>
                <div style={{height:"100%",width:scoreNow+"%",background:scoreNow>=75?"#10b981":scoreNow>=50?"#f59e0b":"#ef4444",borderRadius:2,transition:"width 0.5s ease"}}/>
              </div>
              <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
                {[["✅",compliantCount,"#22c55e"],["⚠️",partialCount,"#eab308"],["❌",nonCompliantCount,"#ef4444"]].map(([icon,count,color])=>(
                  count>0 && <span key={icon} style={{fontSize:11,color,fontWeight:700}}>{icon} {count}</span>
                ))}
              </div>
            </div>
          )}

          <div style={{padding:"10px 14px",maxHeight:420,overflowY:"auto"}}>
            {ISO_DOMAINS.map(domain => (
              <div key={domain.id} style={{marginBottom:12}}>
                <div style={{fontSize:10,fontWeight:800,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>{domain.id}</div>
                {domain.controls.map(ctrl => {
                  const result = assessments[ctrl.id];
                  const isCurrent = phase==="assessing" && ALL_CONTROLS[currentIdx]?.id === ctrl.id;
                  const vs = result ? VERDICT_STYLE[result.verdict] : null;
                  return (
                    <div key={ctrl.id} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 6px",borderRadius:6,background:isCurrent?"#f0f9ff":"transparent",marginBottom:2}}>
                      <div style={{width:14,height:14,borderRadius:"50%",flexShrink:0,background:vs?vs.dot:isCurrent?"#0ea5e9":"#e2e8f0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:"#fff",fontWeight:800}}>
                        {vs ? vs.icon : isCurrent ? "→" : ""}
                      </div>
                      <div style={{fontSize:11,color:isCurrent?"#0ea5e9":vs?vs.color:"#94a3b8",fontWeight:isCurrent||vs?600:400,lineHeight:1.3}}>{ctrl.id}</div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat Panel */}
      <div style={{flex:1,background:"#fff",border:"1px solid #e2e8f0",borderRadius:16,overflow:"hidden"}}>
        {/* Header */}
        <div style={{background:"linear-gradient(135deg,#0f172a,#1e1b4b)",padding:"14px 18px",display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,#0ea5e9,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🤖</div>
          <div style={{flex:1}}>
            <div style={{color:"#fff",fontWeight:700,fontSize:14}}>GRC Consultant — ISO 27001:2022</div>
            <div style={{color:"#64748b",fontSize:11}}>
              {phase==="intro" ? "Ready to start assessment" :
               phase==="assessing" ? `Assessing control ${currentIdx+1} of ${TOTAL}` :
               phase==="done" || phase==="followup" ? "Assessment complete — ask follow-up questions" :
               ""}
            </div>
          </div>
          <button onClick={()=>setShowTracker(t=>!t)} style={{background:"#ffffff15",border:"none",color:"#94a3b8",borderRadius:6,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>
            {showTracker?"Hide":"Show"} Tracker
          </button>
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:"#22c55e"}}/>
            <span style={{color:"#64748b",fontSize:11}}>Online</span>
          </div>
        </div>

        {/* Progress bar */}
        {phase==="assessing" && (
          <div style={{height:3,background:"#f1f5f9"}}>
            <div style={{height:"100%",width:((currentIdx)/TOTAL*100)+"%",background:"linear-gradient(90deg,#0ea5e9,#8b5cf6)",transition:"width 0.5s ease"}}/>
          </div>
        )}

        {/* Messages */}
        <div style={{height:480,overflowY:"auto",padding:"16px",background:"#f8fafc"}}>
          {messages.map((m,i) => renderMessage(m,i))}
          {loading && (
            <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:36}}>
              <div style={{padding:"10px 14px",background:"#fff",borderRadius:"16px 16px 16px 4px",border:"1px solid #e2e8f0"}}>
                <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}`}</style>
                <div style={{display:"flex",gap:4}}>
                  {[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:"#94a3b8",animation:`bounce 1s ${i*0.2}s infinite`}}/>)}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        {/* Quick-start button */}
        {phase==="intro" && messages.length>0 && (
          <div style={{padding:"8px 16px",background:"#f8fafc",borderTop:"1px solid #f1f5f9",display:"flex",gap:8"}}>
            <button onClick={()=>{setInput("start");setTimeout(handleSend,50);}} style={{padding:"8px 20px",background:"linear-gradient(135deg,#0ea5e9,#8b5cf6)",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              🚀 Start ISO 27001 Assessment
            </button>
          </div>
        )}

        {/* Upload preview */}
        {uploadedFile && (
          <div style={{padding:"8px 16px",background:"#f0f9ff",borderTop:"1px solid #bae6fd",display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:18}}>📎</span>
            <span style={{fontSize:13,color:"#0369a1",fontWeight:600,flex:1}}>{uploadedFile.name} ({(uploadedFile.size/1024).toFixed(0)}KB)</span>
            <button onClick={()=>setUploadedFile(null)} style={{background:"none",border:"none",color:"#94a3b8",cursor:"pointer",fontSize:16}}>✕</button>
          </div>
        )}

        {/* Input area */}
        <div style={{padding:"12px 16px",background:"#fff",borderTop:"1px solid #e2e8f0",display:"flex",gap:8,alignItems:"flex-end"}}>
          <input
            type="file" ref={fileRef} style={{display:"none"}}
            accept=".pdf,.png,.jpg,.jpeg,.xlsx,.csv"
            onChange={e=>{ if(e.target.files[0]) setUploadedFile(e.target.files[0]); e.target.value=""; }}
          />
          {(phase==="assessing"||phase==="followup") && (
            <button onClick={()=>fileRef.current?.click()} title="Upload evidence"
              style={{width:38,height:38,flexShrink:0,background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:10,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>
              📎
            </button>
          )}
          <input
            value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&(phase==="followup"?handleFollowup():handleSend())}
            placeholder={
              phase==="intro" ? "Type \"start\" to begin the assessment…" :
              phase==="assessing" ? "Describe your implementation, or upload evidence with 📎…" :
              phase==="done" || phase==="followup" ? "Ask about any control or remediation steps…" :
              "Type a message…"
            }
            style={{flex:1,padding:"10px 14px",border:"1.5px solid #e2e8f0",borderRadius:10,fontSize:13,outline:"none",fontFamily:"inherit"}}
          />
          <button
            onClick={phase==="followup"?handleFollowup:handleSend}
            disabled={loading || (!input.trim() && !uploadedFile)}
            style={{padding:"10px 18px",background:loading||(!input.trim()&&!uploadedFile)?"#e2e8f0":"linear-gradient(135deg,#0ea5e9,#8b5cf6)",border:"none",borderRadius:10,color:loading||(!input.trim()&&!uploadedFile)?"#94a3b8":"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
            {phase==="assessing" ? "Submit" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
