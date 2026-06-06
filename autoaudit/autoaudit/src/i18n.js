// translations.js — Full AR/EN translations for AutoAudit platform

export const T = {
  en: {
    // Nav & Shell
    platform: "GRC Platform",
    dashboard: "Dashboard",
    modules: "Modules",
    frameworks: "Frameworks",
    aiActive: "AI · Live",

    // Module names
    policyGenerator: "Policy Generator",
    aiConsultant: "AI GRC Consultant",
    gapAnalysis: "Gap Analysis",

    // Module descriptions
    policyDesc: "Generate audit-ready policy documents aligned to any compliance framework",
    consultantDesc: "Ask any compliance or security question — domain-expert AI at your fingertips",
    gapDesc: "ISO 27001:2022 structured interview — upload evidence, receive verdicts per control",

    // Module stats
    policyStats: ["5 Frameworks", "20 Policy Types", "Word Export"],
    consultantStats: ["All Frameworks", "Real-time Advice", "Context-aware"],
    gapStats: ["93 Controls", "Evidence Upload", "Live Scoring"],

    // Dashboard
    heroTag: "GRC Intelligence Platform",
    heroTitle: "AI-Powered",
    heroGradient: "Compliance Command Center",
    heroDesc: "Generate audit-ready policies, consult an AI compliance expert, and run structured gap analyses — all powered by AI, no setup required.",
    openModule: "Open",
    statFrameworks: "Compliance Frameworks",
    statControls: "ISO 27001 Controls",
    statPolicies: "Policy Types (ISO+PCI)",
    statFree: "Free · No API Key",

    // Policy Module
    policyTitle: "Policy Generator",
    policySubtitle: "Generate a compliance-aligned policy document with framework control mapping, risk findings and recommended next steps.",
    orgDetails: "Organization Details",
    orgName: "Organization Name",
    orgNamePlaceholder: "e.g. Acme Bank",
    industry: "Industry",
    industryPlaceholder: "Select industry",
    orgSize: "Organization Size",
    orgSizePlaceholder: "Select size",
    complianceFramework: "Compliance Framework",
    frameworkPlaceholder: "Select framework",
    policyType: "Policy Type",
    policyTypePlaceholder: "Select policy type",
    controlsToAssess: "Controls to assess",
    fillAllFields: "Please fill in all fields.",
    generating: "Generating policy…",
    analysingControls: "Analysing framework controls",
    generateBtn: "Generate Policy Document",
    newPolicy: "← New Policy",
    downloadPDF: "⬇ Download PDF",
    parseError: "Could not parse response — please try again.",
    complianceScore: "Compliance Score",
    maturityLevel: "Maturity Level",
    maturityOf: "of 5 maturity stages",
    riskFindings: "Risk Findings",
    frameworkAlignment: "Framework Alignment",
    generatedPolicy: "Generated Policy Document",
    auditFindings: "Audit Findings & Recommendations",
    nextSteps: "Recommended Next Steps",
    effective: "Effective",
    review: "Review",

    // Consultant Module
    consultantTitle: "AI GRC Consultant",
    consultantSubtitle: "Expert cybersecurity & compliance advisor. Ask anything about frameworks, controls, audits, or risk management.",
    consultantGreeting: "👋 Hello! I'm your AI GRC Consultant.\n\nI can help with **ISO 27001**, **NIST CSF**, **PCI-DSS**, **GDPR**, **SOC 2**, risk management, audit preparation, and any other compliance or cybersecurity topic.\n\nWhat would you like to discuss?",
    yourContext: "Your Context",
    optional: "(optional)",
    organization: "Organization",
    orgPlaceholder: "e.g. Acme Bank",
    industryLabel: "Industry",
    industryPlaceholder2: "e.g. Financial Services",
    contextHint: "Providing context makes answers more specific to your situation.",
    quickQuestions: "Quick Questions",
    askPlaceholder: "Ask any compliance or security question…",
    send: "Send",
    online: "Online",
    consultantFrameworks: "ISO 27001 · NIST · PCI-DSS · GDPR · SOC 2",

    // Gap Module
    gapTitle: "ISO 27001:2022 Gap Analysis",
    gapSubtitle: "A structured interview across 16 controls in 4 domains. Upload evidence, get expert verdicts per control, and receive a compliance score.",
    startGap: "🔍 Start Gap Analysis",
    whatToExpect: "What to expect",
    gapExpect: [
      "16 controls across 4 ISO 27001 domains",
      "Upload PDF, image, or Excel as evidence",
      "AI assesses each control: Compliant / Partial / Non-Compliant",
      "Live compliance score tracker",
      "Executive summary at completion"
    ],
    reset: "← Reset",
    hide: "Hide",
    show: "Show",
    tracker: "Tracker",
    isoAssessment: "ISO 27001 Assessment",
    controlsAssessed: "controls assessed",
    liveScore: "Live Score",
    readyToStart: "Ready to start assessment",
    assessingControl: "Assessing control",
    of: "of",
    assessmentComplete: "Assessment complete — ask follow-up questions",
    startAssessment: "🚀 Start ISO 27001 Assessment",
    analyzingEvidence: "Analyzing your evidence",
    evaluating: "Evaluating",
    uploadEvidence: "Upload evidence",
    submit: "Submit",
    typeStart: 'Type "start" to begin the assessment…',
    describeImpl: "Describe your implementation, or upload evidence with 📎…",
    askFollowup: "Ask about any control or remediation steps…",
    typeMessage: "Type a message…",
    assessmentCompleteTitle: "Assessment Complete for",
    finalScore: "Final Score",
    executiveSummary: "Executive Summary",
    verdictCompliant: "Compliant",
    verdictPartial: "Partial",
    verdictNonCompliant: "Non-Compliant",
    finding: "Finding",
    recommendation: "Recommendation",
    gap: "Gap",

    // Quick questions
    quickQ: [
      "What is ISO 27001 and who needs it?",
      "How do I start a SOC 2 audit?",
      "What's the difference between GDPR and CCPA?",
      "How often should we do penetration testing?",
      "What controls are required for PCI-DSS Level 1?",
      "How do I build an incident response plan?",
      "What is a risk treatment plan?",
      "How do I classify data under ISO 27001?",
    ],

    // Industries
    industries: ["Financial Services","Healthcare","E-Commerce / Retail","Technology / SaaS","Government","Manufacturing","Education"],
    orgSizes: ["Small (< 50 employees)","Medium (50-500 employees)","Large (500+ employees)"],
    policyTypes: [
      "Information Security Policy","Acceptable Use Policy","Risk Assessment Policy","Human Resources Security Policy",
      "Access Control Policy","Password Policy",
      "Data Classification Policy","Cryptography Policy","Data Retention & Disposal Policy","Backup & Recovery Policy",
      "Network Security Policy","Physical Security Policy","Asset Management Policy","Logging & Monitoring Policy",
      "Vulnerability Management Policy","Secure Development Policy","Change Management Policy",
      "Incident Response Policy","Business Continuity Policy",
      "Supplier & Third-Party Security Policy"
    ],

    // Maturity levels
    matLevels: ["Initial","Developing","Defined","Managed","Optimising"],

    // Lang toggle
    langToggle: "العربية",
    dir: "ltr",
  },

  ar: {
    // Nav & Shell
    platform: "منصة GRC",
    dashboard: "لوحة التحكم",
    modules: "الوحدات",
    frameworks: "الأطر",
    aiActive: "AI · مباشر",

    // Module names
    policyGenerator: "منشئ السياسات",
    aiConsultant: "مستشار GRC الذكي",
    gapAnalysis: "تحليل الفجوات",

    // Module descriptions
    policyDesc: "إنشاء وثائق سياسات جاهزة للتدقيق ومتوافقة مع أي إطار امتثال",
    consultantDesc: "اسأل أي سؤال حول الامتثال أو الأمن — خبير ذكاء اصطناعي في متناول يدك",
    gapDesc: "مقابلة منظمة لمعيار ISO 27001:2022 — ارفع الأدلة واحصل على أحكام لكل ضابط",

    // Module stats
    policyStats: ["5 أطر", "20 نوع سياسة", "تصدير Word"],
    consultantStats: ["جميع الأطر", "مشورة فورية", "واعٍ بالسياق"],
    gapStats: ["93 ضابطاً", "رفع الأدلة", "تسجيل مباشر"],

    // Dashboard
    heroTag: "منصة ذكاء GRC",
    heroTitle: "مدعوم بالذكاء الاصطناعي",
    heroGradient: "مركز قيادة الامتثال",
    heroDesc: "أنشئ سياسات جاهزة للتدقيق، استشر خبير امتثال ذكياً، وأجرِ تحليلات فجوات منظمة — كل ذلك مجاناً.",
    openModule: "فتح",
    statFrameworks: "أطر الامتثال",
    statControls: "ضوابط ISO 27001",
    statPolicies: "أنواع السياسات",
    statFree: "مجاني · بدون مفتاح API",

    // Policy Module
    policyTitle: "منشئ السياسات",
    policySubtitle: "أنشئ وثيقة سياسة متوافقة مع إطار الامتثال مع تخطيط الضوابط ونتائج المخاطر والخطوات الموصى بها.",
    orgDetails: "تفاصيل المنظمة",
    orgName: "اسم المنظمة",
    orgNamePlaceholder: "مثال: بنك أكمي",
    industry: "القطاع",
    industryPlaceholder: "اختر القطاع",
    orgSize: "حجم المنظمة",
    orgSizePlaceholder: "اختر الحجم",
    complianceFramework: "إطار الامتثال",
    frameworkPlaceholder: "اختر الإطار",
    policyType: "نوع السياسة",
    policyTypePlaceholder: "اختر نوع السياسة",
    controlsToAssess: "الضوابط المراد تقييمها",
    fillAllFields: "يرجى ملء جميع الحقول.",
    generating: "جارٍ إنشاء السياسة…",
    analysingControls: "تحليل ضوابط الإطار",
    generateBtn: "إنشاء وثيقة السياسة",
    newPolicy: "→ سياسة جديدة",
    downloadPDF: "⬇ تحميل PDF",
    parseError: "تعذّر تحليل الاستجابة — يرجى المحاولة مجدداً.",
    complianceScore: "درجة الامتثال",
    maturityLevel: "مستوى النضج",
    maturityOf: "من 5 مراحل نضج",
    riskFindings: "نتائج المخاطر",
    frameworkAlignment: "توافق إطار العمل",
    generatedPolicy: "وثيقة السياسة المُنشأة",
    auditFindings: "نتائج التدقيق والتوصيات",
    nextSteps: "الخطوات التالية الموصى بها",
    effective: "ساري من",
    review: "المراجعة",

    // Consultant Module
    consultantTitle: "مستشار GRC الذكي",
    consultantSubtitle: "مستشار خبير في الأمن السيبراني والامتثال. اسأل أي شيء عن الأطر والضوابط والتدقيق وإدارة المخاطر.",
    consultantGreeting: "👋 مرحباً! أنا مستشار GRC الذكي.\n\nيمكنني المساعدة في **ISO 27001** و**NIST CSF** و**PCI-DSS** و**GDPR** و**SOC 2** وإدارة المخاطر والتحضير للتدقيق وأي موضوع امتثال أو أمن سيبراني.\n\nبم يمكنني مساعدتك؟",
    yourContext: "سياقك",
    optional: "(اختياري)",
    organization: "المنظمة",
    orgPlaceholder: "مثال: بنك أكمي",
    industryLabel: "القطاع",
    industryPlaceholder2: "مثال: الخدمات المالية",
    contextHint: "تقديم السياق يجعل الإجابات أكثر تخصيصاً لوضعك.",
    quickQuestions: "أسئلة سريعة",
    askPlaceholder: "اسأل أي سؤال حول الامتثال أو الأمن السيبراني…",
    send: "إرسال",
    online: "متصل",
    consultantFrameworks: "ISO 27001 · NIST · PCI-DSS · GDPR · SOC 2",

    // Gap Module
    gapTitle: "تحليل فجوات ISO 27001:2022",
    gapSubtitle: "مقابلة منظمة عبر 16 ضابطاً في 4 مجالات. ارفع الأدلة واحصل على أحكام خبراء لكل ضابط ودرجة امتثال.",
    startGap: "🔍 بدء تحليل الفجوات",
    whatToExpect: "ما يمكن توقعه",
    gapExpect: [
      "16 ضابطاً في 4 مجالات لمعيار ISO 27001",
      "رفع ملفات PDF أو صور أو Excel كأدلة",
      "تقييم الذكاء الاصطناعي لكل ضابط: متوافق / جزئي / غير متوافق",
      "متتبع درجة الامتثال المباشر",
      "ملخص تنفيذي عند الانتهاء"
    ],
    reset: "إعادة تعيين →",
    hide: "إخفاء",
    show: "إظهار",
    tracker: "المتتبع",
    isoAssessment: "تقييم ISO 27001",
    controlsAssessed: "ضوابط مُقيَّمة",
    liveScore: "الدرجة المباشرة",
    readyToStart: "جاهز لبدء التقييم",
    assessingControl: "تقييم الضابط",
    of: "من",
    assessmentComplete: "اكتمل التقييم — اسأل أسئلة متابعة",
    startAssessment: "🚀 بدء تقييم ISO 27001",
    analyzingEvidence: "جارٍ تحليل دليلك",
    evaluating: "جارٍ تقييم",
    uploadEvidence: "رفع دليل",
    submit: "إرسال",
    typeStart: 'اكتب "start" للبدء…',
    describeImpl: "صِف تطبيقك، أو ارفع دليلاً بالضغط على 📎…",
    askFollowup: "اسأل عن أي ضابط أو خطوات المعالجة…",
    typeMessage: "اكتب رسالة…",
    assessmentCompleteTitle: "اكتمل التقييم لـ",
    finalScore: "الدرجة النهائية",
    executiveSummary: "الملخص التنفيذي",
    verdictCompliant: "متوافق",
    verdictPartial: "جزئي",
    verdictNonCompliant: "غير متوافق",
    finding: "النتيجة",
    recommendation: "التوصية",
    gap: "الفجوة",

    // Quick questions
    quickQ: [
      "ما هو معيار ISO 27001 ومن يحتاجه؟",
      "كيف أبدأ تدقيق SOC 2؟",
      "ما الفرق بين GDPR وCCPA؟",
      "كم مرة يجب إجراء اختبار الاختراق؟",
      "ما الضوابط المطلوبة لـ PCI-DSS المستوى الأول؟",
      "كيف أبني خطة الاستجابة للحوادث؟",
      "ما هو خطة معالجة المخاطر؟",
      "كيف أصنّف البيانات وفق ISO 27001؟",
    ],

    // Industries
    industries: ["الخدمات المالية","الرعاية الصحية","التجارة الإلكترونية / التجزئة","التكنولوجيا / SaaS","الحكومة","التصنيع","التعليم"],
    orgSizes: ["صغيرة (أقل من 50 موظف)","متوسطة (50-500 موظف)","كبيرة (أكثر من 500 موظف)"],
    policyTypes: [
      "سياسة أمن المعلومات","سياسة الاستخدام المقبول","سياسة تقييم المخاطر","سياسة أمن الموارد البشرية",
      "سياسة التحكم في الوصول","سياسة كلمات المرور",
      "سياسة تصنيف البيانات","سياسة التشفير","سياسة الاحتفاظ بالبيانات والتخلص منها","سياسة النسخ الاحتياطي والاسترداد",
      "سياسة أمن الشبكات","سياسة الأمن المادي","سياسة إدارة الأصول","سياسة التسجيل والمراقبة",
      "سياسة إدارة الثغرات","سياسة التطوير الآمن","سياسة إدارة التغيير",
      "سياسة الاستجابة للحوادث","سياسة استمرارية الأعمال",
      "سياسة أمن الموردين وأطراف ثالثة"
    ],

    // Maturity levels
    matLevels: ["مبدئي","متطور","محدد","مُدار","مُحسَّن"],

    // Lang toggle
    langToggle: "English",
    dir: "rtl",
  }
};

export function useLang() {
  return null; // placeholder — state managed in App
}
