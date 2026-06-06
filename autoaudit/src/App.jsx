import { useState, useEffect, createContext, useContext } from "react";
import { T } from "./i18n.js";
import PolicyModule     from "./modules/PolicyModule.jsx";
import ConsultantModule from "./modules/ConsultantModule.jsx";
import GapModule        from "./modules/GapModule.jsx";

export const LangContext = createContext({ lang:"en", t: T.en, setLang:()=>{} });
export function useLang() { return useContext(LangContext); }
export const OrgContext  = createContext({ orgId: null, orgName: null });
export function useOrg() { return useContext(OrgContext); }

function getOrgFromUrl() {
  try {
    const p = new URLSearchParams(window.location.search);
    return { orgId: p.get('org_id')||null, orgName: p.get('org_name') ? decodeURIComponent(p.get('org_name')) : null };
  } catch { return { orgId:null, orgName:null }; }
}

/* ── Shield + pulse-line logo (matches GRC Pulse style) ─────────────────── */
function PulseLogo({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lg-shield" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4f7bff"/>
          <stop offset="100%" stopColor="#8b5cf6"/>
        </linearGradient>
      </defs>
      {/* Shield body */}
      <path d="M20 3L5 9.5V20C5 28.5 11.5 36.3 20 38.5C28.5 36.3 35 28.5 35 20V9.5L20 3Z"
        fill="url(#lg-shield)" opacity="0.22"/>
      <path d="M20 3L5 9.5V20C5 28.5 11.5 36.3 20 38.5C28.5 36.3 35 28.5 35 20V9.5L20 3Z"
        stroke="url(#lg-shield)" strokeWidth="1.5" fill="none"/>
      {/* Pulse / heartbeat line */}
      <polyline
        points="8,21 13,21 15.5,14 18,26 20.5,18 23,21 28,21 32,21"
        stroke="url(#lg-shield)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  );
}

/* ── Professional SVG icon set ───────────────────────────────────────────── */
function Icon({ name, size=18, color="currentColor" }) {
  const s = { width:size, height:size, display:"block", flexShrink:0 };
  switch (name) {
    case "policy": return (
      <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    );
    case "consultant": return (
      <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 8v4l3 3"/>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    );
    case "ai": return (
      <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        <circle cx="12" cy="16" r="1" fill={color}/>
        <path d="M8 16h.01M16 16h.01"/>
      </svg>
    );
    case "gap": return (
      <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    );
    case "home": return (
      <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    );
    case "globe": return (
      <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
    );
    case "shield": return (
      <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    );
    case "grid": return (
      <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    );
    case "check-circle": return (
      <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    );
    case "zap": return (
      <svg style={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    );
    default: return null;
  }
}

export default function App() {
  const [active, setActive]       = useState(null);
  const [lang,   setLang]         = useState("en");
  const [orgContext, setOrgContext] = useState({ orgId:null, orgName:null });
  const t     = T[lang];
  const isRTL = lang === "ar";

  useEffect(() => {
    const org = getOrgFromUrl();
    setOrgContext(org);
    if (org.orgId || org.orgName) console.log('[AutoGRC] Organization context:', org);
  }, []);

  const MODULES = [
    { id:"policy",     icon:"policy", label:t.policyGenerator,  color:"#4f7bff", gradient:"linear-gradient(135deg,#4f7bff,#3b5de8)", desc:t.policyDesc,     stats:t.policyStats },
    { id:"consultant", icon:"ai",     label:t.aiConsultant,     color:"#8b5cf6", gradient:"linear-gradient(135deg,#8b5cf6,#7c3aed)", desc:t.consultantDesc, stats:t.consultantStats },
    { id:"gap",        icon:"gap",    label:t.gapAnalysis,      color:"#10b981", gradient:"linear-gradient(135deg,#10b981,#059669)", desc:t.gapDesc,        stats:t.gapStats },
  ];
  const mod = MODULES.find(m => m.id === active);

  return (
    <OrgContext.Provider value={orgContext}>
    <LangContext.Provider value={{ lang, t, setLang }}>
      <div dir={isRTL ? "rtl" : "ltr"} style={{
        display:"flex", minHeight:"100vh",
        background:"#07091a",
        fontFamily:"'Inter','Segoe UI',system-ui,sans-serif",
        color:"#e2e8f0"
      }}>
        <style>{`
          *, *::before, *::after { box-sizing: border-box; }
          ::-webkit-scrollbar { width: 4px; }
          ::-webkit-scrollbar-track { background: #0b0e1e; }
          ::-webkit-scrollbar-thumb { background: #1e2b4a; border-radius: 2px; }
          ::-webkit-scrollbar-thumb:hover { background: #2d3f6b; }
          @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
          @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.35} }
          @keyframes sp      { to{transform:rotate(360deg)} }
          @keyframes bounce  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
          .nav-btn { transition: all 0.18s ease !important; }
          .nav-btn:hover { background: #121836 !important; }
          .mod-card { transition: all 0.22s ease !important; }
          .mod-card:hover {
            transform: translateY(-4px) !important;
            border-color: var(--c) !important;
            box-shadow: 0 20px 52px rgba(0,0,0,0.6), 0 0 0 1px var(--c-dim) !important;
          }
          input:focus, select:focus, textarea:focus {
            outline: none !important;
            border-color: #4f7bff !important;
            box-shadow: 0 0 0 3px #4f7bff18 !important;
          }
          button:active { transform: scale(0.97) !important; }
          select option { background: #111627; color: #e2e8f0; }
          .lang-btn:hover { background: linear-gradient(135deg,#4f7bff20,#8b5cf620) !important; border-color: #4f7bff44 !important; }
        `}</style>

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <aside style={{
          width:228,
          background:"linear-gradient(180deg,#0b0e20 0%,#080a1a 100%)",
          borderRight: isRTL?"none":"1px solid #151d35",
          borderLeft:  isRTL?"1px solid #151d35":"none",
          display:"flex", flexDirection:"column",
          position:"fixed", top:0,
          [isRTL?"right":"left"]:0,
          bottom:0, zIndex:50
        }}>
          {/* Brand */}
          <div style={{padding:"20px 18px 16px", borderBottom:"1px solid #151d35"}}>
            <div style={{display:"flex", alignItems:"center", gap:11}}>
              <PulseLogo size={38}/>
              <div>
                <div style={{fontWeight:800, fontSize:16, color:"#f1f5f9", letterSpacing:"-0.03em", lineHeight:1.1}}>AutoGRC</div>
                <div style={{
                  fontSize:8.5, fontWeight:600, letterSpacing:"0.08em",
                  textTransform:"uppercase", marginTop:3,
                  background:"linear-gradient(90deg,#4f7bff,#8b5cf6)",
                  WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text"
                }}>Audit Powered by AI</div>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav style={{padding:"16px 10px", flex:1, overflowY:"auto"}}>
            <div style={{fontSize:9, fontWeight:700, color:"#1e2b4a", letterSpacing:"0.14em", textTransform:"uppercase", padding:"0 10px 10px"}}>
              {t.modules}
            </div>

            {MODULES.map(m => {
              const on = active === m.id;
              return (
                <button key={m.id} className="nav-btn" onClick={() => setActive(m.id)}
                  style={{
                    width:"100%", display:"flex", alignItems:"center", gap:10,
                    padding:"10px 10px", borderRadius:10, border:"none",
                    background: on ? `${m.color}14` : "transparent",
                    cursor:"pointer", fontFamily:"inherit", marginBottom:3,
                    textAlign: isRTL?"right":"left",
                    [isRTL?"borderRight":"borderLeft"]: on ? `2px solid ${m.color}` : "2px solid transparent",
                    boxShadow: on ? `inset 0 0 0 1px ${m.color}20` : "none",
                  }}>
                  <div style={{width:28, height:28, borderRadius:7, background: on ? m.color+"20" : "#121836", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.18s"}}>
                    <Icon name={m.icon} size={14} color={on ? m.color : "#3d4e72"}/>
                  </div>
                  <span style={{fontSize:12, fontWeight:600, color: on ? m.color : "#3d4e72", letterSpacing:"-0.01em"}}>{m.label}</span>
                </button>
              );
            })}

            <div style={{fontSize:9, fontWeight:700, color:"#1e2b4a", letterSpacing:"0.14em", textTransform:"uppercase", padding:"18px 10px 10px"}}>
              {isRTL ? "عام" : "General"}
            </div>

            <button className="nav-btn" onClick={() => setActive(null)}
              style={{
                width:"100%", display:"flex", alignItems:"center", gap:10,
                padding:"10px 10px", borderRadius:10, border:"none",
                background: !active ? "#4f7bff14" : "transparent",
                cursor:"pointer", fontFamily:"inherit",
                textAlign: isRTL?"right":"left",
                [isRTL?"borderRight":"borderLeft"]: !active ? "2px solid #4f7bff" : "2px solid transparent",
                boxShadow: !active ? "inset 0 0 0 1px #4f7bff20" : "none",
              }}>
              <div style={{width:28, height:28, borderRadius:7, background: !active ? "#4f7bff20" : "#121836", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.18s"}}>
                <Icon name="grid" size={14} color={!active ? "#4f7bff" : "#3d4e72"}/>
              </div>
              <span style={{fontSize:12, fontWeight:600, color: !active ? "#4f7bff" : "#3d4e72", letterSpacing:"-0.01em"}}>{t.dashboard}</span>
            </button>
          </nav>

          {/* Footer */}
          <div style={{padding:"14px 12px", borderTop:"1px solid #151d35"}}>
            <button className="lang-btn" onClick={() => setLang(l => l==="en"?"ar":"en")}
              style={{
                width:"100%", padding:"8px 10px", marginBottom:14,
                background:"linear-gradient(135deg,#4f7bff12,#8b5cf612)",
                border:"1px solid #4f7bff28", borderRadius:8,
                color:"#4f7bff", fontSize:12, fontWeight:600, cursor:"pointer",
                fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:7,
                transition:"all 0.18s"
              }}>
              <Icon name="globe" size={13} color="#4f7bff"/>
              {t.langToggle}
            </button>

            <div style={{fontSize:9, fontWeight:700, color:"#1e2b4a", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8}}>{t.frameworks}</div>
            <div style={{display:"flex", flexWrap:"wrap", gap:4}}>
              {[["ISO","#4f7bff"],["NIST","#8b5cf6"],["PCI","#f59e0b"],["GDPR","#10b981"],["SOC2","#ef4444"]].map(([b,c]) => (
                <span key={b} style={{padding:"2px 8px", borderRadius:5, background:c+"14", color:c, fontSize:9, fontWeight:700, border:`1px solid ${c}28`, letterSpacing:"0.04em"}}>{b}</span>
              ))}
            </div>
          </div>
        </aside>

        {/* ── Main ────────────────────────────────────────────────────────── */}
        <div style={{[isRTL?"marginRight":"marginLeft"]:228, flex:1, display:"flex", flexDirection:"column", minHeight:"100vh"}}>

          {/* Top bar */}
          <header style={{
            height:52, background:"rgba(7,9,26,0.88)",
            backdropFilter:"blur(14px)", WebkitBackdropFilter:"blur(14px)",
            borderBottom:"1px solid #151d35",
            display:"flex", alignItems:"center", padding:"0 28px", gap:10,
            position:"sticky", top:0, zIndex:40
          }}>
            <span style={{fontSize:12, fontWeight:600, color:"#1e2b4a", letterSpacing:"-0.01em"}}>AutoGRC</span>
            {mod && (
              <>
                <span style={{color:"#1e2b4a", fontSize:14}}>›</span>
                <span style={{fontSize:12, fontWeight:600, color:mod.color, letterSpacing:"-0.01em"}}>{mod.label}</span>
              </>
            )}
            <div style={{flex:1}}/>
            {/* GRC + AI badge — no Cloudflare mention */}
            <div style={{display:"flex", alignItems:"center", gap:8}}>
              <div style={{
                display:"flex", alignItems:"center", gap:6,
                padding:"5px 12px",
                background:"linear-gradient(135deg,#4f7bff10,#8b5cf610)",
                border:"1px solid #4f7bff28", borderRadius:20
              }}>
                <Icon name="zap" size={11} color="#8b5cf6"/>
                <span style={{fontSize:11, fontWeight:600, color:"#7c9ff5", letterSpacing:"0.01em"}}>GRC · Audit AI</span>
              </div>
              <div style={{display:"flex", alignItems:"center", gap:5, padding:"5px 10px", background:"#22c55e10", border:"1px solid #22c55e28", borderRadius:20}}>
                <div style={{width:5, height:5, borderRadius:"50%", background:"#22c55e", animation:"pulse 2s infinite"}}/>
                <span style={{fontSize:10, fontWeight:500, color:"#22c55e"}}>Live</span>
              </div>
            </div>
          </header>

          {/* Content */}
          <main style={{flex:1, padding:"32px", overflowY:"auto", animation:"fadeUp 0.3s ease"}}>
            {!active              && <Dashboard onSelect={setActive} modules={MODULES} t={t} isRTL={isRTL}/>}
            {active==="policy"    && <PolicyModule     t={t} isRTL={isRTL} lang={lang}/>}
            {active==="consultant"&& <ConsultantModule t={t} isRTL={isRTL} lang={lang}/>}
            {active==="gap"       && <GapModule        t={t} isRTL={isRTL} lang={lang}/>}
          </main>
        </div>
      </div>
    </LangContext.Provider>
    </OrgContext.Provider>
  );
}

/* ── Dashboard ──────────────────────────────────────────────────────────────── */
function Dashboard({ onSelect, modules, t, isRTL }) {
  return (
    <div>
      {/* Hero */}
      <div style={{marginBottom:36, animation:"fadeUp 0.4s ease"}}>
        <div style={{
          display:"inline-flex", alignItems:"center", gap:7,
          padding:"5px 14px", borderRadius:20,
          background:"linear-gradient(135deg,#4f7bff12,#8b5cf612)",
          border:"1px solid #4f7bff28", marginBottom:16
        }}>
          <Icon name="zap" size={10} color="#8b5cf6"/>
          <span style={{fontSize:10, fontWeight:700, color:"#7c9ff5", letterSpacing:"0.1em", textTransform:"uppercase"}}>{t.heroTag}</span>
        </div>

        <h1 style={{fontSize:38, fontWeight:900, color:"#f1f5f9", letterSpacing:isRTL?0:"-0.03em", lineHeight:1.15, marginBottom:14}}>
          {t.heroTitle}<br/>
          <span style={{background:"linear-gradient(90deg,#4f7bff,#8b5cf6,#10b981)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text"}}>
            {t.heroGradient}
          </span>
        </h1>
        <p style={{fontSize:14, color:"#3d4e72", maxWidth:520, lineHeight:1.8, fontWeight:400}}>{t.heroDesc}</p>
      </div>

      {/* Module cards */}
      <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:18, marginBottom:28}}>
        {modules.map((m, i) => (
          <div key={m.id} className="mod-card"
            style={{
              "--c":m.color, "--c-dim":m.color+"30",
              background:"linear-gradient(145deg,#0d1125,#0b0f1f)",
              border:"1px solid #151d35", borderRadius:18,
              padding:26, cursor:"pointer", position:"relative", overflow:"hidden",
              animation:`fadeUp 0.45s ease ${i*0.08}s both`
            }}
            onClick={() => onSelect(m.id)}
          >
            <div style={{position:"absolute", top:-50, right:-50, width:150, height:150, background:`radial-gradient(circle,${m.color}10,transparent 68%)`, pointerEvents:"none"}}/>
            <div style={{position:"relative"}}>
              <div style={{
                width:52, height:52, borderRadius:14,
                background:m.gradient, display:"flex", alignItems:"center", justifyContent:"center",
                marginBottom:20, boxShadow:`0 8px 28px ${m.color}38`
              }}>
                <Icon name={m.icon} size={22} color="#fff"/>
              </div>
              <div style={{fontSize:16, fontWeight:700, color:"#f1f5f9", marginBottom:7, letterSpacing:"-0.02em"}}>{m.label}</div>
              <div style={{fontSize:12, color:"#3d4e72", marginBottom:18, lineHeight:1.75}}>{m.desc}</div>
              <div style={{display:"flex", flexWrap:"wrap", gap:5, marginBottom:18}}>
                {m.stats.map(s => (
                  <span key={s} style={{padding:"3px 9px", background:m.color+"12", color:m.color, borderRadius:5, fontSize:10, fontWeight:600, border:`1px solid ${m.color}22`}}>{s}</span>
                ))}
              </div>
              <div style={{display:"flex", alignItems:"center", gap:6, color:m.color, fontSize:12, fontWeight:600}}>
                {t.openModule}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={m.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  {isRTL ? <><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></> : <><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></>}
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div style={{
        background:"linear-gradient(145deg,#0d1125,#0b0f1f)",
        border:"1px solid #151d35", borderRadius:16,
        padding:"22px 28px", display:"flex", gap:0, flexWrap:"wrap",
        animation:"fadeUp 0.5s ease 0.25s both", overflow:"hidden", position:"relative"
      }}>
        <div style={{position:"absolute", top:0, left:0, right:0, height:1, background:"linear-gradient(90deg,transparent,#4f7bff40,#8b5cf640,transparent)"}}/>
        {[["5",t.statFrameworks],["93",t.statControls],["6",t.statPolicies],["100%",t.statFree]].map(([n,l], i) => (
          <div key={l} style={{flex:1, minWidth:120, padding:"6px 20px", borderRight: i<3 ? "1px solid #151d35" : "none"}}>
            <div style={{
              fontSize:30, fontWeight:900, letterSpacing:"-0.04em",
              background:"linear-gradient(135deg,#4f7bff,#8b5cf6)",
              WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text"
            }}>{n}</div>
            <div style={{fontSize:10, color:"#1e2b4a", marginTop:4, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.07em"}}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
