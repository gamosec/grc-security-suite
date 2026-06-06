import { useState, useRef, useEffect, useCallback } from "react";
import { useOrg } from "../App.jsx";

// ── System prompts ────────────────────────────────────────────────────────────
const SYS = {
  en: `You are AutoAudit GRC Consultant — a senior cybersecurity and compliance expert with 15+ years experience in ISO 27001, NIST CSF, PCI-DSS, GDPR, and SOC 2.

IMPORTANT: You MUST respond in English only. Do NOT use Arabic.

Give clear, practical, expert-level GRC advice like a trusted advisor. Be specific and actionable. Keep responses concise (3-5 sentences) unless asked for detail. Never invent standards or control numbers.

User question:`,
  ar: `أنت مستشار AutoAudit GRC — خبير أمن سيبراني وامتثال بخبرة تزيد عن 15 عاماً في ISO 27001 وNIST CSF وPCI-DSS وGDPR وSOC 2.

مهم: يجب أن تجيب باللغة العربية فقط. لا تستخدم الإنجليزية.

قدّم مشورة GRC واضحة وعملية كمستشار موثوق. كن محدداً وقابلاً للتنفيذ. اجعل الردود موجزة (3-5 جمل) ما لم يُطلب التفصيل. لا تخترع معايير أو أرقام ضوابط.

سؤال المستخدم:`
};

// ── D1 session helpers (org-aware for multi-tenant) ───────────────────────────
const BASE_CONS_KEY = "autoaudit_consultant_session_id";
function getConsKey(orgId) {
  return orgId ? `${BASE_CONS_KEY}_${orgId}` : BASE_CONS_KEY;
}
function loadConsId(orgId)     { try { return localStorage.getItem(getConsKey(orgId)); } catch { return null; } }
function saveConsId(id, orgId) { try { localStorage.setItem(getConsKey(orgId), id); } catch {} }
function clearConsId(orgId)    { try { localStorage.removeItem(getConsKey(orgId)); } catch {} }
function genConsId()           { return "cons_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8); }

async function dbCreateSession(id, org, industry, lang) {
  try {
    await fetch("/api/consultant-session", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action:"create", id, org, industry, lang })
    });
  } catch {}
}

async function dbUpdateContext(id, org, industry) {
  try {
    await fetch("/api/consultant-session", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action:"update_context", id, org, industry })
    });
  } catch {}
}

async function dbSaveMessage(session_id, role, msg_text) {
  try {
    await fetch("/api/consultant-session", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action:"message", session_id, role, msg_text })
    });
  } catch {}
}

async function dbLoadSession(id) {
  try {
    const res  = await fetch(`/api/consultant-session?id=${id}`);
    const data = await res.json();
    return data.ok ? data : null;
  } catch { return null; }
}

async function dbDeleteSession(id) {
  try { await fetch(`/api/consultant-session?id=${id}`, { method:"DELETE" }); } catch {}
}

// ── Message formatter ─────────────────────────────────────────────────────────
function fmt(text) {
  return text.split("\n").map((line, i, arr) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <span key={i}>
        {parts.map((p, j) =>
          p.startsWith("**") && p.endsWith("**")
            ? <strong key={j}>{p.slice(2, -2)}</strong>
            : p
        )}
        {i < arr.length - 1 && <br />}
      </span>
    );
  });
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ConsultantModule({ t, isRTL, lang }) {
  const { orgId, orgName: urlOrgName } = useOrg(); // Get org context from URL params
  const [messages,    setMessages]    = useState([]);
  const [input,       setInput]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [org,         setOrg]         = useState("");
  const [industry,    setIndustry]    = useState("");
  const [sessionId,   setSessionId]   = useState(null);
  const [initDone,    setInitDone]    = useState(false); // true once D1 check complete
  const [saveStatus,  setSaveStatus]  = useState("idle"); // idle|saving|saved|error
  const [msgCount,    setMsgCount]    = useState(0);
  const bottomRef = useRef(null);
  const contextSaveTimer = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages, loading]);

  // Update org when urlOrgName is available
  useEffect(() => {
    if (urlOrgName && !org) {
      setOrg(urlOrgName);
    }
  }, [urlOrgName]);

  // ── On mount: load or create session (org-aware) ─────────────────────────────────────
  useEffect(() => {
    const storedId = loadConsId(orgId);
    if (!storedId) {
      // First visit — create new session
      const id = genConsId();
      saveConsId(id, orgId);
      setSessionId(id);
      dbCreateSession(id, urlOrgName || "", "", lang);
      setMessages([{ role:"assistant", text:t.consultantGreeting }]);
      setInitDone(true);
      return;
    }

    // Returning visit — try to restore from D1
    dbLoadSession(storedId).then(data => {
      if (data?.session && data.messages?.length > 0) {
        // Restore context
        setOrg(data.session.org || urlOrgName || "");
        setIndustry(data.session.industry || "");
        setSessionId(storedId);

        // Restore messages (skip the initial greeting which is always rebuilt)
        const restored = data.messages.map(m => ({
          role: m.role,
          text: m.msg_text,
        }));
        setMessages(restored);
        setMsgCount(restored.length);
      } else {
        // Session exists in localStorage but no messages in D1 (fresh or cleared)
        setSessionId(storedId);
        dbCreateSession(storedId, urlOrgName || "", "", lang);
        setMessages([{ role:"assistant", text:t.consultantGreeting }]);
      }
      setInitDone(true);
    }).catch(() => {
      setSessionId(storedId);
      setMessages([{ role:"assistant", text:t.consultantGreeting }]);
      setInitDone(true);
    });
  }, [orgId]); // eslint-disable-line

  // ── When lang changes, update greeting only if no real conversation yet ────
  useEffect(() => {
    if (!initDone) return;
    setMessages(prev => {
      // Only update greeting if it's the only message
      if (prev.length === 1 && prev[0].role === "assistant") {
        return [{ role:"assistant", text:t.consultantGreeting }];
      }
      return prev;
    });
  }, [lang]); // eslint-disable-line

  // ── Auto-save context when org/industry changes (debounced 1.5s) ──────────
  useEffect(() => {
    if (!sessionId || !initDone) return;
    clearTimeout(contextSaveTimer.current);
    contextSaveTimer.current = setTimeout(() => {
      dbUpdateContext(sessionId, org, industry);
    }, 1500);
    return () => clearTimeout(contextSaveTimer.current);
  }, [org, industry, sessionId, initDone]);

  // ── Send message ──────────────────────────────────────────────────────────
  const send = useCallback(async (text) => {
    const q = (text || input).trim();
    if (!q || loading) return;
    setInput("");

    const userMsg = { role:"user", text:q };
    setMessages(m => [...m, userMsg]);

    // Save user message to D1
    setSaveStatus("saving");
    if (sessionId) {
      await dbSaveMessage(sessionId, "user", q);
    }

    setLoading(true);
    const ctx    = org ? `\n${lang==="ar"?"السياق":"Context"}: ${org}${industry?" ("+industry+")":""}` : "";
    const prompt = SYS[lang] + ctx + `\n\n"${q}"`;

    try {
      const res   = await fetch("/api/chat", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ messages:[{ role:"user", content:prompt }] })
      });
      const data  = await res.json();
      const reply = (data.content||[]).map(b => b.text||"").join("") || "...";
      const aiMsg = { role:"assistant", text:reply };
      setMessages(m => [...m, aiMsg]);
      setMsgCount(c => c + 2);

      // Save AI reply to D1
      if (sessionId) {
        await dbSaveMessage(sessionId, "assistant", reply);
      }
      setSaveStatus("saved");
    } catch {
      const errMsg = { role:"assistant", text: lang==="ar" ? "خطأ في الاتصال." : "Connection error." };
      setMessages(m => [...m, errMsg]);
      setSaveStatus("error");
    }
    setLoading(false);
  }, [input, loading, sessionId, org, industry, lang]);

  // ── Clear conversation (org-aware) ────────────────────────────────────────────────────
  function clearConversation() {
    if (sessionId) dbDeleteSession(sessionId);
    clearConsId(orgId);
    const newId = genConsId();
    saveConsId(newId, orgId);
    setSessionId(newId);
    dbCreateSession(newId, urlOrgName || org, industry, lang);
    setMessages([{ role:"assistant", text:t.consultantGreeting }]);
    setMsgCount(0);
    setSaveStatus("idle");
  }

  const realMsgCount = messages.filter(m => m.role === "user").length;

  // ── Loading state ─────────────────────────────────────────────────────────
  if (!initDone) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:300}}>
      <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
      <div style={{position:"relative",width:40,height:40}}>
        <div style={{position:"absolute",inset:0,borderRadius:"50%",border:"3px solid #1e293b"}}/>
        <div style={{position:"absolute",inset:0,borderRadius:"50%",border:"3px solid transparent",borderTopColor:"#8b5cf6",animation:"sp 0.9s linear infinite"}}/>
      </div>
    </div>
  );

  return (
    <div style={{maxWidth:900,animation:"fadeUp 0.3s ease"}} dir={isRTL?"rtl":"ltr"}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
        @keyframes sp{to{transform:rotate(360deg)}}
      `}</style>

      <div style={{marginBottom:20}}>
        <h2 style={{fontSize:22,fontWeight:900,color:"#f1f5f9",marginBottom:6}}>{t.consultantTitle}</h2>
        <p style={{color:"#475569",fontSize:13,lineHeight:1.7}}>{t.consultantSubtitle}</p>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 260px",gap:16,alignItems:"flex-start"}}>

        {/* ── Chat panel ── */}
        <div style={{background:"#0f172a",border:"1px solid #1a2744",borderRadius:16,overflow:"hidden"}}>

          {/* Header */}
          <div style={{background:"linear-gradient(135deg,#0f172a,#1e1b4b)",padding:"12px 16px",display:"flex",alignItems:"center",gap:10,borderBottom:"1px solid #1a2744"}}>
            <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,#8b5cf6,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>🤖</div>
            <div style={{flex:1}}>
              <div style={{color:"#f1f5f9",fontWeight:700,fontSize:14}}>{t.aiConsultant}</div>
              <div style={{color:"#475569",fontSize:11}}>{t.consultantFrameworks}</div>
            </div>

            {/* Save status + message count */}
            <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
              {realMsgCount > 0 && (
                <div style={{padding:"3px 8px",background:"#8b5cf615",border:"1px solid #8b5cf630",borderRadius:5,fontSize:10,fontWeight:700,color:"#8b5cf6"}}>
                  {realMsgCount} {isRTL ? "سؤال" : "Q"}
                </div>
              )}
              <div style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px",background:"#080e1c",border:"1px solid #1a2744",borderRadius:5}}>
                {saveStatus==="saving" && <div style={{width:6,height:6,borderRadius:"50%",border:"2px solid transparent",borderTopColor:"#f59e0b",animation:"sp 0.8s linear infinite"}}/>}
                {saveStatus==="saved"  && <span style={{color:"#22c55e",fontSize:10}}>●</span>}
                {saveStatus==="idle"   && <span style={{color:"#334155",fontSize:10}}>●</span>}
                {saveStatus==="error"  && <span style={{color:"#ef4444",fontSize:10}}>●</span>}
                <span style={{fontSize:9,fontWeight:700,color:saveStatus==="saved"?"#22c55e":saveStatus==="saving"?"#f59e0b":saveStatus==="error"?"#ef4444":"#334155"}}>
                  {saveStatus==="saving"?(isRTL?"حفظ…":"Saving…"):saveStatus==="saved"?(isRTL?"محفوظ":"Saved"):"D1"}
                </span>
              </div>
              <div style={{width:7,height:7,borderRadius:"50%",background:"#22c55e"}}/>
              <span style={{color:"#334155",fontSize:11}}>{t.online}</span>
            </div>
          </div>

          {/* Restored session banner */}
          {realMsgCount > 0 && (
            <div style={{padding:"7px 14px",background:"#8b5cf608",borderBottom:"1px solid #1a2744",display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:11,color:"#8b5cf6"}}>💾</span>
              <span style={{fontSize:11,color:"#475569",flex:1}}>
                {isRTL
                  ? `تم استعادة ${realMsgCount} سؤال من الجلسة السابقة`
                  : `${realMsgCount} question${realMsgCount!==1?"s":""} restored from previous session`}
              </span>
              <button onClick={clearConversation}
                style={{fontSize:10,color:"#475569",background:"none",border:"1px solid #1e293b",borderRadius:5,padding:"2px 8px",cursor:"pointer",fontFamily:"inherit"}}>
                {isRTL?"مسح":"Clear"}
              </button>
            </div>
          )}

          {/* Messages */}
          <div style={{height:460,overflowY:"auto",padding:16,background:"#080e1c",display:"flex",flexDirection:"column",gap:10}}>
            {messages.map((m, i) => (
              <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",alignItems:"flex-end",gap:8}}>
                {m.role==="assistant" && (
                  <div style={{width:26,height:26,borderRadius:"50%",background:"linear-gradient(135deg,#8b5cf6,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0}}>🤖</div>
                )}
                <div style={{maxWidth:"78%",padding:"10px 14px",
                  borderRadius:m.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",
                  background:m.role==="user"?"linear-gradient(135deg,#8b5cf6,#7c3aed)":"#0f172a",
                  color:"#e2e8f0",fontSize:13,lineHeight:1.7,
                  border:m.role==="assistant"?"1px solid #1a2744":"none",
                  whiteSpace:"pre-wrap",textAlign:isRTL?"right":"left",direction:"auto"}}>
                  {fmt(m.text)}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{display:"flex",alignItems:"flex-end",gap:8}}>
                <div style={{width:26,height:26,borderRadius:"50%",background:"linear-gradient(135deg,#8b5cf6,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0}}>🤖</div>
                <div style={{padding:"11px 14px",background:"#0f172a",borderRadius:16,border:"1px solid #1a2744"}}>
                  <div style={{display:"flex",gap:4}}>
                    {[0,1,2].map(j => <div key={j} style={{width:5,height:5,borderRadius:"50%",background:"#475569",animation:`bounce 1s ${j*0.2}s infinite`}}/>)}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {/* Input */}
          <div style={{padding:"12px 16px",background:"#0f172a",borderTop:"1px solid #1a2744",display:"flex",gap:8}}>
            <input value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()}
              placeholder={t.askPlaceholder} dir="auto"
              style={{flex:1,padding:"10px 13px",border:"1.5px solid #1e293b",borderRadius:9,fontSize:13,background:"#080e1c",color:"#e2e8f0",fontFamily:"inherit"}}/>
            <button onClick={()=>send()} disabled={loading||!input.trim()}
              style={{padding:"10px 18px",background:loading||!input.trim()?"#1e293b":"linear-gradient(135deg,#8b5cf6,#7c3aed)",border:"none",borderRadius:9,color:loading||!input.trim()?"#475569":"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
              {t.send}
            </button>
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div style={{display:"flex",flexDirection:"column",gap:12}}>

          {/* Context panel */}
          <div style={{background:"#0f172a",border:"1px solid #1a2744",borderRadius:12,padding:16}}>
            <div style={{fontSize:10,fontWeight:700,color:"#334155",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>
              {t.yourContext} <span style={{color:"#1e293b",textTransform:"none"}}>{t.optional}</span>
            </div>
            {[
              [t.organization,   org,      setOrg,      t.orgPlaceholder],
              [t.industryLabel,  industry, setIndustry, t.industryPlaceholder2],
            ].map(([label, val, setter, ph]) => (
              <div key={label} style={{marginBottom:10}}>
                <label style={{fontSize:11,color:"#475569",fontWeight:600,display:"block",marginBottom:5}}>{label}</label>
                <input value={val} onChange={e=>setter(e.target.value)} placeholder={ph} dir="auto"
                  style={{width:"100%",padding:"8px 10px",border:"1px solid #1e293b",borderRadius:7,fontSize:12,background:"#080e1c",color:"#e2e8f0",fontFamily:"inherit"}}/>
              </div>
            ))}
            <div style={{fontSize:10,color:"#334155",lineHeight:1.5}}>{t.contextHint}</div>

            {/* D1 session info */}
            <div style={{marginTop:12,padding:"8px 10px",background:"#080e1c",borderRadius:7,border:"1px solid #1a2744"}}>
              <div style={{fontSize:9,fontWeight:700,color:"#334155",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>
                {isRTL?"الجلسة":"Session"}
              </div>
              <div style={{fontSize:9,color:"#475569",fontFamily:"monospace",wordBreak:"break-all",marginBottom:4}}>{sessionId}</div>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <span style={{fontSize:8,color:"#22c55e"}}>●</span>
                <span style={{fontSize:9,color:"#334155"}}>Cloudflare D1 · {isRTL?"محفوظ تلقائياً":"Auto-saved"}</span>
              </div>
            </div>
          </div>

          {/* Quick questions */}
          <div style={{background:"#0f172a",border:"1px solid #1a2744",borderRadius:12,padding:16}}>
            <div style={{fontSize:10,fontWeight:700,color:"#334155",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>{t.quickQuestions}</div>
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              {t.quickQ.map(q => (
                <button key={q} onClick={()=>send(q)}
                  style={{padding:"7px 10px",background:"transparent",border:"1px solid #1a2744",borderRadius:7,fontSize:11,color:"#64748b",cursor:"pointer",fontFamily:"inherit",textAlign:isRTL?"right":"left",lineHeight:1.4,direction:"auto"}}
                  onMouseOver={e=>e.currentTarget.style.color="#8b5cf6"}
                  onMouseOut={e=>e.currentTarget.style.color="#64748b"}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
