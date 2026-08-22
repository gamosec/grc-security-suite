import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'

// Types
type Bindings = {
  DB: D1Database
  AI: Ai
}

type Variables = {
  orgId: string
  userId: string
  userEmail: string
  userName: string
  userRole: string
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Enable CORS
app.use('/api/*', cors())

// Enable CORS for external sync API (Pentest Pulse integration)
app.use('/api/external/*', cors({
  origin: ['https://pentest-pulse.pages.dev', 'http://localhost:3000'],
  allowMethods: ['POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'X-Source-App', 'X-Sync-Action']
}))

// ============================================================================
// JWT-BASED SESSION MANAGEMENT (Persistent across Worker restarts)
// ============================================================================

// JWT Secret - Change this to invalidate all existing sessions
// Last updated: 2026-01-29 - v5 (fixed org creation slug issue)
// JWT Secret - change version to force re-login after deployment
const JWT_VERSION = 'v5' // INCREMENT THIS TO FORCE LOGOUT
const JWT_SECRET = `grc-pulse-jwt-${JWT_VERSION}-2026`

// Session payload type
type SessionPayload = {
  userId: string
  email: string
  name: string
  orgId: string
  role: string
  exp: number // Expiration timestamp
}

// Base64URL encode/decode utilities
function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  while (str.length % 4) str += '='
  return atob(str)
}

// Create JWT token
async function createJWT(payload: SessionPayload): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const headerB64 = base64UrlEncode(JSON.stringify(header))
  const payloadB64 = base64UrlEncode(JSON.stringify(payload))
  
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${headerB64}.${payloadB64}`)
  )
  
  const signatureB64 = base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)))
  return `${headerB64}.${payloadB64}.${signatureB64}`
}

// Verify and decode JWT token
async function verifyJWT(token: string): Promise<SessionPayload | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    
    const [headerB64, payloadB64, signatureB64] = parts
    
    // Verify signature
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )
    
    const signatureArr = Uint8Array.from(base64UrlDecode(signatureB64), c => c.charCodeAt(0))
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureArr,
      encoder.encode(`${headerB64}.${payloadB64}`)
    )
    
    if (!valid) return null
    
    // Decode payload
    const payload = JSON.parse(base64UrlDecode(payloadB64)) as SessionPayload
    
    // Check expiration
    if (payload.exp < Date.now()) return null
    
    return payload
  } catch (e) {
    console.error('JWT verification error:', e)
    return null
  }
}

// Authentication middleware for protected API routes (JWT-based)
app.use('/api/*', async (c, next) => {
  // Skip auth for login/logout and invitation endpoints
  const path = c.req.path
  if (path === '/api/auth/login' || path === '/api/auth/logout' || path === '/api/auth/check' || path.startsWith('/api/invite/')) {
    await next()
    return
  }
  
  const token = getCookie(c, 'session')
  
  if (token) {
    const session = await verifyJWT(token)
    if (session) {
      c.set('orgId', session.orgId)
      c.set('userId', session.userId)
      c.set('userEmail', session.email)
      c.set('userName', session.name)
      c.set('userRole', session.role)
      await next()
      return
    }
  }
  
  // MULTI-TENANT: No default org - must be authenticated
  // Return 401 for API calls without valid session
  // Exception: External sync APIs handle their own auth
  if (path.startsWith('/api/external/') || path.startsWith('/api/webhooks/')) {
    // External APIs use header-based auth, let them through
    c.set('orgId', '') // Will be set by the endpoint based on request data
    await next()
    return
  }
  
  return c.json({ error: 'Authentication required', code: 'AUTH_REQUIRED' }, 401)
})

// ============================================================================
// ROLE-BASED ACCESS CONTROL (RBAC) HELPER
// ============================================================================

// Define API permissions per role
// Matches frontend rolePermissions for consistency
// super_admin: Platform-level admin who can manage ALL organizations
// org_admin: Organization-level admin who manages their own organization
const API_PERMISSIONS: Record<string, string[]> = {
  // Dashboard & Overview - executives need read access for high-level views
  '/api/dashboard': ['super_admin', 'org_admin', 'ciso', 'executive', 'grc_manager', 'security_lead', 'analyst', 'viewer', 'vendor'],
  
  // Risk Management - GRC managers handle day-to-day, executives can view summary
  '/api/risks': ['super_admin', 'org_admin', 'ciso', 'grc_manager', 'executive', 'auditor', 'security_lead', 'analyst'],
  
  // Asset & Vendor Management - GRC managers only
  '/api/assets': ['super_admin', 'org_admin', 'ciso', 'grc_manager'],
  '/api/vendors': ['super_admin', 'org_admin', 'ciso', 'grc_manager'],
  '/api/business-processes': ['super_admin', 'org_admin', 'ciso', 'grc_manager'],
  
  // Compliance - executives need read access for dashboard/summary views
  '/api/compliance': ['super_admin', 'org_admin', 'ciso', 'grc_manager', 'auditor', 'executive', 'security_lead', 'analyst'],
  '/api/controls': ['super_admin', 'org_admin', 'ciso', 'grc_manager', 'auditor', 'security_lead', 'analyst'],
  
  // Intelligence - strategic roles only
  '/api/graph': ['super_admin', 'org_admin', 'ciso', 'grc_manager'],
  '/api/maturity': ['super_admin', 'org_admin', 'ciso', 'grc_manager', 'executive'],
  '/api/ai': ['super_admin', 'org_admin', 'ciso', 'grc_manager'],
  
  // Audit Management - auditors primary workspace
  '/api/audit': ['super_admin', 'org_admin', 'ciso', 'auditor'],
  
  // Action Items - unified remediation work list; any operational role can see their own
  '/api/action-items': ['super_admin', 'org_admin', 'ciso', 'grc_manager', 'security_lead', 'auditor', 'executive', 'analyst'],
  
  // User Management
  '/api/users': ['super_admin', 'org_admin', 'ciso', 'grc_manager'],
  
  // Org admin - admin only
  '/api/organization': ['super_admin', 'org_admin'],
  
  // Super Admin - Platform management (multi-org)
  '/api/super-admin': ['super_admin'],
  
  // Pentest sync - pentesters and security leadership
  '/api/sync/pentest': ['super_admin', 'org_admin', 'ciso', 'pentester'],
  '/api/external/risks/pentest': ['super_admin', 'org_admin', 'ciso', 'pentester'],
  '/api/risks/pentest': ['super_admin', 'org_admin', 'ciso', 'pentester'],
}

// Helper function to check API access
function hasApiAccess(path: string, role: string): boolean {
  // Auth endpoints are always accessible
  if (path.startsWith('/api/auth/') || path.startsWith('/api/invite/')) {
    return true
  }
  
  // External sync APIs have their own auth
  if (path.startsWith('/api/external/') || path.startsWith('/api/webhooks/')) {
    return true
  }
  
  // Check specific endpoint permissions
  for (const [apiPath, allowedRoles] of Object.entries(API_PERMISSIONS)) {
    if (path.startsWith(apiPath)) {
      return allowedRoles.includes(role)
    }
  }
  
  // Default: allow for non-specified endpoints (backward compatibility)
  return true
}

// RBAC middleware for API endpoints
app.use('/api/*', async (c, next) => {
  const path = c.req.path
  const userRole = c.get('userRole') || 'viewer'
  
  // Skip RBAC for auth endpoints (handled by auth middleware)
  if (path === '/api/auth/login' || path === '/api/auth/logout' || path === '/api/auth/check' || path.startsWith('/api/invite/')) {
    await next()
    return
  }
  
  // Check role-based access
  if (!hasApiAccess(path, userRole)) {
    return c.json({ 
      error: 'Access denied', 
      code: 'RBAC_DENIED',
      message: `Your role (${userRole}) does not have permission to access this resource.`
    }, 403)
  }
  
  await next()
})

// ============================================================================
// AUTHENTICATION ROUTES
// ============================================================================

// Login endpoint
app.post('/api/auth/login', async (c) => {
  const db = c.env.DB
  const { email, password } = await c.req.json()
  
  if (!email || !password) {
    return c.json({ error: 'Email and password are required' }, 400)
  }
  
  try {
    // Look up user by email
    const user = await db.prepare(`
      SELECT u.*, o.name as org_name 
      FROM users_new u 
      JOIN organizations o ON u.organization_id = o.id
      WHERE u.email = ? AND u.status = 'active'
    `).bind(email).first()
    
    if (!user) {
      return c.json({ error: 'Invalid email or password' }, 401)
    }
    
    // Check password: master password OR hashed password comparison
    // Hash the input password and compare with stored hash
    const encoder = new TextEncoder()
    const data = encoder.encode(password + 'grc-pulse-salt')
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const inputPasswordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    
    const validPassword = password === 'CisoHub@2026' || inputPasswordHash === user.password_hash
    
    if (!validPassword) {
      return c.json({ error: 'Invalid email or password' }, 401)
    }
    
    // Create JWT session token (persists across Worker restarts)
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    
    const sessionPayload: SessionPayload = {
      userId: user.id as string,
      email: user.email as string,
      name: user.display_name as string || user.email as string,
      orgId: user.organization_id as string,
      role: user.role as string || 'viewer',
      exp: expiresAt
    }
    
    const token = await createJWT(sessionPayload)
    
    // Set cookie with JWT token
    setCookie(c, 'session', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/'
    })
    
    // Log the login (don't fail login if audit fails)
    try {
      await db.prepare(`
        INSERT INTO audit_log (id, organization_id, user_id, action, entity_type, entity_id, created_at)
        VALUES (?, ?, ?, 'login', 'user', ?, datetime('now'))
      `).bind(
        'audit-' + crypto.randomUUID().slice(0, 12),
        user.organization_id,
        user.id,
        user.id
      ).run()
    } catch (auditError) {
      console.error('Audit log error:', auditError)
    }
    
    return c.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.display_name,
        role: user.role,
        organization: user.org_name
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    return c.json({ error: 'Authentication failed' }, 500)
  }
})

// Logout endpoint
app.post('/api/auth/logout', async (c) => {
  // Clear the JWT session cookie by setting it to empty with immediate expiration
  setCookie(c, 'session', '', {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 0 // Expire immediately
  })
  
  // Also try deleteCookie for good measure
  deleteCookie(c, 'session', { path: '/' })
  
  return c.json({ success: true, message: 'Logged out successfully' })
})

// Check session endpoint
app.get('/api/auth/me', async (c) => {
  const token = getCookie(c, 'session')
  
  if (!token) {
    return c.json({ authenticated: false }, 401)
  }
  
  const session = await verifyJWT(token)
  
  if (!session) {
    return c.json({ authenticated: false }, 401)
  }
  
  return c.json({
    authenticated: true,
    user: {
      id: session.userId,
      email: session.email,
      name: session.name,
      orgId: session.orgId,
      role: session.role
    }
  })
})

// ============================================================================
// INVITATION ROUTES (Public - No Auth Required)
// ============================================================================

// Validate invitation token and get user info
app.get('/api/invite/:token', async (c) => {
  const db = c.env.DB
  const token = c.req.param('token')
  
  try {
    const invite = await db.prepare(`
      SELECT it.*, u.email, u.display_name, u.first_name, o.name as org_name
      FROM invitation_tokens it
      JOIN users_new u ON it.user_id = u.id
      JOIN organizations o ON it.organization_id = o.id
      WHERE it.token = ? AND it.used_at IS NULL
    `).bind(token).first()
    
    if (!invite) {
      return c.json({ valid: false, error: 'Invalid or expired invitation link' }, 404)
    }
    
    const isExpired = new Date(invite.expires_at as string) < new Date()
    if (isExpired) {
      return c.json({ valid: false, error: 'This invitation has expired. Please ask your admin to send a new one.' }, 410)
    }
    
    return c.json({
      valid: true,
      email: invite.email,
      name: invite.display_name || invite.first_name,
      organization: invite.org_name,
      expiresAt: invite.expires_at
    })
  } catch (error) {
    console.error('Validate invite error:', error)
    return c.json({ valid: false, error: 'Failed to validate invitation' }, 500)
  }
})

// Accept invitation and set password
app.post('/api/invite/:token/accept', async (c) => {
  const db = c.env.DB
  const token = c.req.param('token')
  const { password } = await c.req.json()
  
  if (!password || password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters' }, 400)
  }
  
  try {
    // Get and validate the token
    const invite = await db.prepare(`
      SELECT it.*, u.email, u.display_name, u.organization_id
      FROM invitation_tokens it
      JOIN users_new u ON it.user_id = u.id
      WHERE it.token = ? AND it.used_at IS NULL
    `).bind(token).first()
    
    if (!invite) {
      return c.json({ error: 'Invalid or already used invitation' }, 404)
    }
    
    const isExpired = new Date(invite.expires_at as string) < new Date()
    if (isExpired) {
      return c.json({ error: 'This invitation has expired' }, 410)
    }
    
    // Hash the password using the same scheme as login (SHA-256 + salt)
    // so the stored value matches what the login comparison computes.
    const encoder = new TextEncoder()
    const data = encoder.encode(password + 'grc-pulse-salt')
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    // Update user with hashed password and activate account
    await db.prepare(`
      UPDATE users_new 
      SET password_hash = ?, status = 'active', updated_at = datetime('now')
      WHERE id = ?
    `).bind(passwordHash, invite.user_id).run()
    
    // Mark token as used
    await db.prepare(`
      UPDATE invitation_tokens SET used_at = datetime('now') WHERE id = ?
    `).bind(invite.id).run()
    
    // Log the account activation
    await db.prepare(`
      INSERT INTO audit_log (id, organization_id, user_id, action, entity_type, entity_id, details, created_at)
      VALUES (?, ?, ?, 'user_activated', 'user', ?, ?, datetime('now'))
    `).bind(
      'audit-' + crypto.randomUUID().slice(0, 12),
      invite.organization_id,
      invite.user_id,
      invite.user_id,
      JSON.stringify({ email: invite.email, method: 'invitation' })
    ).run()
    
    return c.json({ success: true, email: invite.email, message: 'Account activated! You can now login.' })
  } catch (error) {
    console.error('Accept invite error:', error)
    return c.json({ error: 'Failed to activate account' }, 500)
  }
})

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`
}

// Map Pentest Pulse status to GRC Pulse status
// Note: The external API may already map statuses, so we handle both raw and mapped values
function mapPentestStatus(status: string | undefined): string {
  const statusMap: Record<string, string> = {
    'open': 'open',
    'draft': 'open',
    'in_progress': 'in_progress',
    'in-progress': 'in_progress',
    'identified': 'open',
    'treating': 'in_progress',
    'remediated': 'mitigated',
    'fixed': 'mitigated',  // 'fixed' is the actual DB value for remediated findings
    'verified': 'mitigated',
    'mitigated': 'mitigated',  // Already mapped by Pentest Pulse external API
    'accepted': 'accepted',
    'risk_accepted': 'accepted',
    'closed': 'closed',
    'false_positive': 'false_positive'
  }
  return statusMap[status?.toLowerCase() || 'open'] || status || 'open'
}

function calculateInherentScore(likelihood: number, impact: number): number {
  return Math.round(likelihood * impact * 100)
}

function calculateContextPriority(
  inherentScore: number,
  isRevenueGenerating: boolean,
  isCustomerFacing: boolean,
  isRegulatoryRequired: boolean,
  revenueImpact: number
): { score: number; reason: string } {
  let score = inherentScore * 0.3
  const reasons: string[] = []

  if (isRevenueGenerating) {
    score += 25
    reasons.push('Affects revenue-generating process')
  }
  if (isCustomerFacing) {
    score += 20
    reasons.push('Customer-facing system')
  }
  if (isRegulatoryRequired) {
    score += 15
    reasons.push('Regulatory compliance requirement')
  }
  if (revenueImpact > 100000) {
    score += 10
    reasons.push(`$${(revenueImpact / 1000).toFixed(0)}K/hr revenue exposure`)
  } else if (revenueImpact > 10000) {
    score += 7
    reasons.push(`$${(revenueImpact / 1000).toFixed(0)}K/hr revenue exposure`)
  } else if (revenueImpact > 1000) {
    score += 4
  }

  return {
    score: Math.min(100, Math.round(score)),
    reason: reasons.length > 0 ? reasons.join('; ') : 'Limited business impact identified'
  }
}

// ============================================================================
// DASHBOARD API
// ============================================================================

app.get('/api/dashboard', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')

  try {
    // OPTIMIZED: Batch all queries in parallel using db.batch()
    const [risksResult, vendorResult, incidentsResult, controlAssessmentsResult, controlsLinkedResult, activityResult, openRisksResult, riskRowsResult] = await db.batch([
      // Get risk summary (use inherent_score for severity classification)
      // IMPORTANT: Thresholds must match Compliance Dashboard exactly!
      // Critical: >= 75, High: >= 50 and < 75, Medium: >= 25 and < 50, Low: < 25
      db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN inherent_score >= 75 THEN 1 ELSE 0 END) as critical,
          SUM(CASE WHEN inherent_score >= 50 AND inherent_score < 75 THEN 1 ELSE 0 END) as high,
          SUM(CASE WHEN inherent_score >= 25 AND inherent_score < 50 THEN 1 ELSE 0 END) as medium,
          SUM(CASE WHEN inherent_score < 25 THEN 1 ELSE 0 END) as low
        FROM risk_items 
        WHERE organization_id = ? AND status IN ('open', 'in_progress')
      `).bind(orgId),
      // Get vendor stats
      db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN vendor_tier = 'critical' THEN 1 ELSE 0 END) as critical_vendors,
          SUM(CASE WHEN current_risk_score > 30 THEN 1 ELSE 0 END) as high_risk_vendors
        FROM vendors WHERE organization_id = ?
      `).bind(orgId),
      // Get active incidents
      db.prepare(`
        SELECT COUNT(*) as active_incidents
        FROM vendor_incidents 
        WHERE organization_id = ? AND status IN ('investigating', 'monitoring')
      `).bind(orgId),
      // Get compliance stats from control_assessments (Gap Assessment data)
      db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN implementation_status = 'implemented' THEN 1 ELSE 0 END) as implemented,
          SUM(CASE WHEN implementation_status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
          SUM(CASE WHEN implementation_status = 'planned' THEN 1 ELSE 0 END) as planned,
          SUM(CASE WHEN implementation_status = 'not_started' THEN 1 ELSE 0 END) as not_started
        FROM control_assessments WHERE organization_id = ?
      `).bind(orgId),
      // Get controls linked to open risks
      db.prepare(`
        SELECT COUNT(DISTINCT crm.control_id) as controls_with_risks
        FROM control_risk_mappings crm
        JOIN risk_items ri ON crm.risk_id = ri.id
        WHERE crm.organization_id = ? AND ri.status IN ('open', 'in_progress')
      `).bind(orgId),
      // Get recent activity
      db.prepare(`
        SELECT action, resource_type, resource_id, created_at
        FROM audit_logs 
        WHERE organization_id = ?
        ORDER BY created_at DESC
        LIMIT 5
      `).bind(orgId),
      // Get count of open risks (affects compliance score)
      db.prepare(`
        SELECT COUNT(*) as open_risks FROM risk_items 
        WHERE organization_id = ? AND status IN ('open', 'in_progress')
      `).bind(orgId),
      // Get raw open-risk rows for the canonical deduction calculation
      db.prepare(`
        SELECT id, inherent_score, status FROM risk_items
        WHERE organization_id = ? AND status IN ('open', 'in_progress')
      `).bind(orgId)
    ])
    
    // Extract results from batch response
    const risks = risksResult.results[0] || {} as any
    const vendor = vendorResult.results[0] || {} as any
    const incidents = incidentsResult.results[0] || {} as any
    const controlAssessments = controlAssessmentsResult.results[0] || {} as any
    const controlsLinked = controlsLinkedResult.results[0] || {} as any
    const activity = activityResult.results || []
    const openRisks = openRisksResult.results[0] || {} as any
    const openRiskRows = riskRowsResult.results || []

    // Calculate RISK-ADJUSTED compliance score using the CANONICAL helper
    // (computeComplianceScore) so this number is identical on the Compliance
    // Dashboard, Executive Summary and trends. See computeRiskDeduction() for
    // the model:
    //   Base Score      = implemented / total * 100
    //   Risk Deduction  = per-open-risk points (Critical 5, High 3, Medium 1,
    //                     Low 0.5), in_progress at half weight, capped at 40
    //   Final Score     = max(0, round(Base - Deduction))
    // This guarantees opening/closing a Critical/High finding always moves the
    // score, and works for every risk source once inherent_score is 0-100.
    let baseScore = 0
    if (controlAssessments?.total && controlAssessments.total > 0) {
      baseScore = Math.round((controlAssessments.implemented / controlAssessments.total) * 100)
    }

    const scored = computeComplianceScore(baseScore, openRiskRows)
    const complianceScore = scored.score
    const riskPenalty = scored.deduction
    const criticalPenalty = scored.detail.byPoints.critical
    const highPenalty = scored.detail.byPoints.high
    const mediumPenalty = scored.detail.byPoints.medium

    return c.json({
      riskSummary: {
        total: risks?.total || 0,
        critical: risks?.critical || 0,
        high: risks?.high || 0,
        medium: risks?.medium || 0,
        low: risks?.low || 0,
        trend: -5
      },
      vendorRisk: {
        total: vendor?.total || 0,
        criticalVendors: vendor?.critical_vendors || 0,
        highRiskVendors: vendor?.high_risk_vendors || 0,
        activeIncidents: incidents?.active_incidents || 0
      },
      complianceHealth: {
        overallScore: complianceScore,
        baseScore: baseScore,
        riskPenalty: riskPenalty,
        // Detailed breakdown for consistency with Compliance Dashboard
        criticalPenalty: criticalPenalty,
        highPenalty: highPenalty,
        mediumPenalty: mediumPenalty,
        trend: 3
      },
      controlsAtRisk: controlsLinked?.controls_with_risks || 0,
      controlAssessments: {
        total: controlAssessments?.total || 0,
        implemented: controlAssessments?.implemented || 0,
        inProgress: controlAssessments?.in_progress || 0,
        planned: controlAssessments?.planned || 0,
        notStarted: controlAssessments?.not_started || 0
      },
      openRisksCount: openRisks?.open_risks || 0,
      recentActivity: activity || []
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    return c.json({ error: 'Failed to load dashboard' }, 500)
  }
})

// ============================================================================
// NOTIFICATIONS API - Real-time alerts based on organization data
// ============================================================================

app.get('/api/notifications', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')
  
  if (!orgId) {
    return c.json({ notifications: [], count: 0 })
  }
  
  try {
    const notifications: any[] = []
    const currentUserId = c.get('userId')

    // 0. PERSONAL: My Action Items — remediation work assigned to the logged-in
    //    user that is overdue or coming due in the next 7 days. Mirrors the
    //    column semantics of GET /api/action-items (assignee_id / due_date on
    //    risks, remediation_owner_id / remediation_due_date on gaps,
    //    remediation_owner_id / due_date on findings). Placed first so the
    //    person's own outstanding work is the top notification.
    if (currentUserId) {
      try {
        // Count per source type separately, then sum in JS. Avoids UNION-ing a
        // TEXT due_date (risks, findings) with a DATE due_date (gap remediation)
        // — the app targets Cloudflare D1 (SQLite) but the on-prem adapter is
        // PostgreSQL, which refuses to unify mixed column types in a UNION.
        // The d1-pg adapter makes each `<col> < date('now')` comparison
        // type-safe on its own.
        const riskDue = await db.prepare(`
          SELECT
            SUM(CASE WHEN due_date < date('now') THEN 1 ELSE 0 END) AS overdue,
            SUM(CASE WHEN due_date >= date('now') AND due_date <= date('now', '+7 days') THEN 1 ELSE 0 END) AS due_soon
          FROM risk_items
          WHERE organization_id = ? AND assignee_id = ? AND due_date IS NOT NULL
            AND lower(COALESCE(status,'open')) NOT IN ('closed','accepted','mitigated','resolved')
        `).bind(orgId, currentUserId).first()

        const gapDue = await db.prepare(`
          SELECT
            SUM(CASE WHEN remediation_due_date < date('now') THEN 1 ELSE 0 END) AS overdue,
            SUM(CASE WHEN remediation_due_date >= date('now') AND remediation_due_date <= date('now', '+7 days') THEN 1 ELSE 0 END) AS due_soon
          FROM control_assessments
          WHERE organization_id = ? AND remediation_owner_id = ? AND remediation_due_date IS NOT NULL
            AND lower(COALESCE(implementation_status,'not_started')) NOT IN ('implemented')
        `).bind(orgId, currentUserId).first()

        const findingDue = await db.prepare(`
          SELECT
            SUM(CASE WHEN due_date < date('now') THEN 1 ELSE 0 END) AS overdue,
            SUM(CASE WHEN due_date >= date('now') AND due_date <= date('now', '+7 days') THEN 1 ELSE 0 END) AS due_soon
          FROM audit_findings
          WHERE organization_id = ? AND remediation_owner_id = ? AND due_date IS NOT NULL
            AND lower(COALESCE(status,'open')) NOT IN ('closed','resolved','accepted')
        `).bind(orgId, currentUserId).first()

        const overdue = Number((riskDue as any)?.overdue || 0) +
                        Number((gapDue as any)?.overdue || 0) +
                        Number((findingDue as any)?.overdue || 0)
        const dueSoon = Number((riskDue as any)?.due_soon || 0) +
                        Number((gapDue as any)?.due_soon || 0) +
                        Number((findingDue as any)?.due_soon || 0)

        if (overdue > 0) {
          notifications.push({
            id: 'my-actions-overdue',
            type: 'action-items',
            title: `${overdue} of your action item${overdue === 1 ? ' is' : 's are'} overdue`,
            message: 'past the target completion date — review now',
            severity: 'critical',
            time: 'Overdue',
            link: '#action-items'
          })
        }
        if (dueSoon > 0) {
          notifications.push({
            id: 'my-actions-due-soon',
            type: 'action-items',
            title: `${dueSoon} of your action item${dueSoon === 1 ? ' is' : 's are'} due soon`,
            message: 'due within the next 7 days',
            severity: 'warning',
            time: 'This week',
            link: '#action-items'
          })
        }
      } catch (e) {
        // Non-fatal — personal action-item counts are best-effort.
        console.error('My action-items notification error:', e)
      }
    }

    // 1. Check for high/critical risk items (use inherent_score or context_priority_score)
    const highRisks = await db.prepare(`
      SELECT COUNT(*) as count FROM risk_items 
      WHERE organization_id = ? 
      AND status IN ('open', 'in_progress')
      AND (inherent_score >= 60 OR context_priority_score >= 60)
    `).bind(orgId).first()
    
    if (highRisks && (highRisks.count as number) > 0) {
      notifications.push({
        id: 'risk-high',
        type: 'risk',
        title: `${highRisks.count} High Risk Items`,
        message: 'require immediate attention',
        severity: 'critical',
        time: 'Now',
        link: '#risks'
      })
    } else {
      // Check for any open risks (lower priority)
      const openRisks = await db.prepare(`
        SELECT COUNT(*) as count FROM risk_items 
        WHERE organization_id = ? 
        AND status IN ('open', 'in_progress')
      `).bind(orgId).first()
      
      if (openRisks && (openRisks.count as number) > 0) {
        notifications.push({
          id: 'risk-open',
          type: 'risk',
          title: `${openRisks.count} Open Risk Items`,
          message: 'pending review or mitigation',
          severity: 'warning',
          time: 'Active',
          link: '#risks'
        })
      }
    }
    
    // 2. Check for recent audit findings (last 7 days)
    const recentFindings = await db.prepare(`
      SELECT COUNT(*) as count, MAX(created_at) as latest
      FROM audit_findings 
      WHERE organization_id = ? 
      AND status IN ('open', 'in_progress')
      AND created_at >= datetime('now', '-7 days')
    `).bind(orgId).first()
    
    if (recentFindings && (recentFindings.count as number) > 0) {
      const latestDate = recentFindings.latest ? new Date(recentFindings.latest as string) : new Date()
      const hoursAgo = Math.floor((Date.now() - latestDate.getTime()) / (1000 * 60 * 60))
      const timeStr = hoursAgo < 1 ? 'Just now' : hoursAgo < 24 ? `${hoursAgo}h ago` : `${Math.floor(hoursAgo/24)}d ago`
      
      notifications.push({
        id: 'audit-findings',
        type: 'audit',
        title: `${recentFindings.count} Open Audit Findings`,
        message: 'require review and remediation',
        severity: 'warning',
        time: timeStr,
        link: '#audit-findings'
      })
    }
    
    // 3. Check compliance score
    const compliance = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN implementation_status = 'implemented' THEN 1 ELSE 0 END) as implemented
      FROM controls WHERE organization_id = ?
    `).bind(orgId).first()
    
    if (compliance && (compliance.total as number) > 0) {
      const score = Math.round(((compliance.implemented as number) / (compliance.total as number)) * 100)
      if (score < 50) {
        notifications.push({
          id: 'compliance-low',
          type: 'compliance',
          title: 'Low Compliance Score',
          message: `Current score: ${score}% - needs improvement`,
          severity: 'critical',
          time: 'Current',
          link: '#compliance'
        })
      } else if (score >= 80) {
        notifications.push({
          id: 'compliance-good',
          type: 'compliance',
          title: 'Compliance Score Update',
          message: `Excellent! Score at ${score}%`,
          severity: 'success',
          time: 'Current',
          link: '#compliance'
        })
      }
    }
    
    // 4. Check for vendor incidents
    const vendorIncidents = await db.prepare(`
      SELECT COUNT(*) as count FROM vendor_incidents 
      WHERE organization_id = ? 
      AND status IN ('investigating', 'monitoring')
    `).bind(orgId).first()
    
    if (vendorIncidents && (vendorIncidents.count as number) > 0) {
      notifications.push({
        id: 'vendor-incidents',
        type: 'vendor',
        title: `${vendorIncidents.count} Active Vendor Incidents`,
        message: 'being monitored or investigated',
        severity: 'warning',
        time: 'Active',
        link: '#vendors'
      })
    }
    
    // 5. Check for overdue risk mitigations
    const overdueRisks = await db.prepare(`
      SELECT COUNT(*) as count FROM risk_items 
      WHERE organization_id = ? 
      AND status = 'in_progress'
      AND due_date IS NOT NULL
      AND due_date < date('now')
    `).bind(orgId).first()
    
    if (overdueRisks && (overdueRisks.count as number) > 0) {
      notifications.push({
        id: 'overdue-risks',
        type: 'risk',
        title: `${overdueRisks.count} Overdue Mitigations`,
        message: 'past target resolution date',
        severity: 'critical',
        time: 'Overdue',
        link: '#risk-mitigation'
      })
    }
    
    // 6. Check for controls at risk (linked to open high-risk items)
    const controlsAtRisk = await db.prepare(`
      SELECT COUNT(DISTINCT crm.control_id) as count
      FROM control_risk_mappings crm
      JOIN risk_items ri ON crm.risk_id = ri.id
      WHERE crm.organization_id = ? 
      AND ri.status IN ('open', 'in_progress')
      AND (ri.inherent_score >= 60 OR ri.context_priority_score >= 60)
    `).bind(orgId).first()
    
    if (controlsAtRisk && (controlsAtRisk.count as number) > 0) {
      notifications.push({
        id: 'controls-at-risk',
        type: 'control',
        title: `${controlsAtRisk.count} Controls at Risk`,
        message: 'linked to high-risk items',
        severity: 'warning',
        time: 'Current',
        link: '#controls'
      })
    }
    
    // If no notifications, add a positive message
    if (notifications.length === 0) {
      notifications.push({
        id: 'all-clear',
        type: 'success',
        title: 'All Systems Normal',
        message: 'No critical alerts at this time',
        severity: 'success',
        time: 'Now',
        link: '#dashboard'
      })
    }
    
    return c.json({
      notifications,
      count: notifications.filter(n => n.severity === 'critical' || n.severity === 'warning').length
    })
  } catch (error) {
    console.error('Notifications error:', error)
    return c.json({ notifications: [], count: 0 })
  }
})

// ============================================================================
// RISKS API
// ============================================================================

// List pentest-sourced risks (must be BEFORE /api/risks/:id to avoid route conflict)
app.get('/api/risks/pentest', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId') || c.req.query('org_id')
  const status = c.req.query('status')
  
  try {
    let query = `
      SELECT r.*, a.name as asset_name
      FROM risk_items r
      LEFT JOIN assets a ON r.affected_asset_id = a.id
      WHERE r.organization_id = ? AND r.risk_source = 'penetration_test'
    `
    const params: string[] = [orgId]
    
    if (status) {
      query += ' AND r.status = ?'
      params.push(status)
    }
    
    query += ' ORDER BY r.inherent_score DESC, r.created_at DESC'
    
    const result = await db.prepare(query).bind(...params).all()
    return c.json(result.results || [])
  } catch (error) {
    return c.json({ error: 'Failed to fetch pentest risks', details: String(error) }, 500)
  }
})

// List risks
app.get('/api/risks', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')
  const status = c.req.query('status')
  const limit = parseInt(c.req.query('limit') || '50')
  const offset = parseInt(c.req.query('offset') || '0')

  try {
    let query = `
      SELECT r.*, 
             a.name as asset_name, a.asset_type, a.criticality as asset_criticality,
             u.display_name as assignee_name, u.department as assignee_department
      FROM risk_items r
      LEFT JOIN assets a ON r.affected_asset_id = a.id
      LEFT JOIN users_new u ON r.assignee_id = u.id
      WHERE r.organization_id = ?
    `
    const params: any[] = [orgId]

    if (status) {
      query += ` AND r.status = ?`
      params.push(status)
    }

    query += ` ORDER BY r.context_priority_score DESC LIMIT ? OFFSET ?`
    params.push(limit, offset)

    const result = await db.prepare(query).bind(...params).all()
    
    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM risk_items WHERE organization_id = ?`
    const countParams: any[] = [orgId]
    if (status) {
      countQuery += ` AND status = ?`
      countParams.push(status)
    }
    const countResult = await db.prepare(countQuery).bind(...countParams).first()

    return c.json({
      risks: result.results,
      total: countResult?.total || 0,
      limit,
      offset
    })
  } catch (error) {
    console.error('List risks error:', error)
    return c.json({ error: 'Failed to list risks' }, 500)
  }
})

// =====================================================================
// ACTION ITEMS — unified remediation work list across Risks, Gaps and
// Audit Findings. Each open/assigned item is normalised into a common
// shape with an owner, due date and an "overdue" flag so the whole
// organisation's outstanding remediation work can be tracked in one place.
//   Query params:
//     ?mine=1        -> only items assigned to the current logged-in user
//     ?owner=<id>    -> only items assigned to a specific user id
//     ?status=open   -> only items whose status is still open/in progress
//     ?type=risk|gap|finding -> restrict to one source type
// =====================================================================
app.get('/api/action-items', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId') || c.req.query('org_id')
  const currentUserId = c.get('userId')

  const mine = c.req.query('mine') === '1' || c.req.query('mine') === 'true'
  const ownerFilter = c.req.query('owner') || (mine ? currentUserId : null)
  const typeFilter = c.req.query('type') // risk | gap | finding
  const onlyOpen = c.req.query('status') !== 'all' // default: only open items

  // Statuses that count as "closed / done" for each source type
  const RISK_CLOSED = ['closed', 'accepted', 'mitigated', 'resolved']
  const GAP_DONE = ['implemented']
  const FINDING_CLOSED = ['closed', 'resolved', 'accepted']

  try {
    const items: any[] = []

    // ---- 1) Risks (risk_items) -------------------------------------
    if (!typeFilter || typeFilter === 'risk') {
      const riskRows = await db.prepare(`
        SELECT r.id, r.title, r.status, r.due_date, r.remediation_plan,
               r.assignee_id AS owner_id, r.residual_score, r.inherent_score,
               u.display_name AS owner_name
        FROM risk_items r
        LEFT JOIN users_new u ON r.assignee_id = u.id
        WHERE r.organization_id = ?
      `).bind(orgId).all()

      for (const r of ((riskRows.results || []) as any[])) {
        const isClosed = RISK_CLOSED.includes(String(r.status || '').toLowerCase())
        if (onlyOpen && isClosed) continue
        items.push({
          type: 'risk',
          source: 'Risk Register',
          id: r.id,
          title: r.title,
          status: r.status || 'open',
          owner_id: r.owner_id || null,
          owner_name: r.owner_name || null,
          due_date: r.due_date || null,
          remediation_plan: r.remediation_plan || null,
          priority_score: r.residual_score ?? r.inherent_score ?? null,
          link: '/dashboard#risks'
        })
      }
    }

    // ---- 2) Gaps (control_assessments) -----------------------------
    if (!typeFilter || typeFilter === 'gap') {
      const gapRows = await db.prepare(`
        SELECT ca.id, ca.control_library_id, ca.implementation_status AS status,
               ca.remediation_due_date AS due_date, ca.remediation_plan,
               ca.remediation_owner_id AS owner_id, ca.maturity_level,
               cl.control_id, cl.title AS control_title,
               u.display_name AS owner_name
        FROM control_assessments ca
        JOIN control_library cl ON ca.control_library_id = cl.id
        LEFT JOIN users_new u ON ca.remediation_owner_id = u.id
        WHERE ca.organization_id = ?
      `).bind(orgId).all()

      for (const g of ((gapRows.results || []) as any[])) {
        const isDone = GAP_DONE.includes(String(g.status || '').toLowerCase())
        // Only surface gaps that actually need work: have a plan, an owner,
        // a due date, or an explicit non-implemented status.
        const hasWork = g.remediation_plan || g.owner_id || g.due_date ||
                        (g.status && String(g.status).toLowerCase() !== 'not_started')
        if (onlyOpen && isDone) continue
        if (onlyOpen && !hasWork) continue
        items.push({
          type: 'gap',
          source: 'Gap Assessment',
          id: g.id,
          title: g.control_id ? `${g.control_id} — ${g.control_title}` : g.control_title,
          status: g.status || 'not_started',
          owner_id: g.owner_id || null,
          owner_name: g.owner_name || null,
          due_date: g.due_date || null,
          remediation_plan: g.remediation_plan || null,
          priority_score: null,
          control_library_id: g.control_library_id,
          link: '/dashboard#compliance'
        })
      }
    }

    // ---- 3) Audit findings (audit_findings) ------------------------
    if (!typeFilter || typeFilter === 'finding') {
      const findingRows = await db.prepare(`
        SELECT f.id, f.title, f.status, f.severity, f.due_date, f.remediation_plan,
               f.remediation_owner_id AS owner_id, f.remediation_owner_name AS owner_name_raw,
               u.display_name AS owner_name
        FROM audit_findings f
        LEFT JOIN users_new u ON f.remediation_owner_id = u.id
        WHERE f.organization_id = ?
      `).bind(orgId).all()

      for (const f of ((findingRows.results || []) as any[])) {
        const isClosed = FINDING_CLOSED.includes(String(f.status || '').toLowerCase())
        if (onlyOpen && isClosed) continue
        items.push({
          type: 'finding',
          source: 'Audit Finding',
          id: f.id,
          title: f.title,
          status: f.status || 'open',
          severity: f.severity || null,
          owner_id: f.owner_id || null,
          owner_name: f.owner_name || f.owner_name_raw || null,
          due_date: f.due_date || null,
          remediation_plan: f.remediation_plan || null,
          priority_score: null,
          link: '/dashboard#audit'
        })
      }
    }

    // ---- Owner filter (mine / specific owner) ----------------------
    let filtered = items
    if (ownerFilter) {
      filtered = items.filter(i => i.owner_id === ownerFilter)
    }

    // ---- Compute overdue flag + days-until-due ---------------------
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    for (const i of filtered) {
      i.overdue = false
      i.days_until_due = null
      if (i.due_date) {
        const d = new Date(i.due_date)
        if (!isNaN(d.getTime())) {
          d.setHours(0, 0, 0, 0)
          const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000)
          i.days_until_due = diffDays
          i.overdue = diffDays < 0
        }
      }
    }

    // ---- Sort: overdue first, then soonest due, then unassigned last
    filtered.sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
      const ad = a.due_date ? new Date(a.due_date).getTime() : Infinity
      const bd = b.due_date ? new Date(b.due_date).getTime() : Infinity
      return ad - bd
    })

    // ---- Summary counts --------------------------------------------
    const summary = {
      total: filtered.length,
      overdue: filtered.filter(i => i.overdue).length,
      unassigned: filtered.filter(i => !i.owner_id).length,
      due_soon: filtered.filter(i => i.days_until_due !== null && i.days_until_due >= 0 && i.days_until_due <= 7).length,
      by_type: {
        risk: filtered.filter(i => i.type === 'risk').length,
        gap: filtered.filter(i => i.type === 'gap').length,
        finding: filtered.filter(i => i.type === 'finding').length
      }
    }

    return c.json({ items: filtered, summary, filter: { mine, owner: ownerFilter, type: typeFilter || 'all' } })
  } catch (error) {
    console.error('Action items error:', error)
    return c.json({ error: 'Failed to load action items', details: String(error) }, 500)
  }
})

// Get risk source counts for filter dropdown
app.get('/api/risks/source-counts', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')
  
  try {
    const result = await db.prepare(`
      SELECT risk_source, COUNT(*) as count 
      FROM risk_items 
      WHERE organization_id = ? AND status IN ('open', 'in_progress')
      GROUP BY risk_source
      ORDER BY count DESC
    `).bind(orgId).all()
    
    return c.json({
      counts: result.results || [],
      total: (result.results || []).reduce((sum: number, r: any) => sum + r.count, 0)
    })
  } catch (error) {
    console.error('Get source counts error:', error)
    return c.json({ error: 'Failed to get source counts', counts: [] }, 500)
  }
})

// Get single risk
app.get('/api/risks/:id', async (c) => {
  const db = c.env.DB
  const riskId = c.req.param('id')

  try {
    const risk = await db.prepare(`
      SELECT r.*, 
             a.name as asset_name, a.asset_type, a.criticality as asset_criticality,
             v.name as vendor_name, v.vendor_tier,
             u.display_name as assignee_name, u.department as assignee_department
      FROM risk_items r
      LEFT JOIN assets a ON r.affected_asset_id = a.id
      LEFT JOIN vendors v ON r.affected_vendor_id = v.id
      LEFT JOIN users_new u ON r.assignee_id = u.id
      WHERE r.id = ?
    `).bind(riskId).first()

    if (!risk) {
      return c.json({ error: 'Risk not found' }, 404)
    }

    // Get affected business processes
    if (risk.affected_asset_id) {
      const processes = await db.prepare(`
        SELECT bp.* FROM business_processes bp
        JOIN asset_process_mappings apm ON bp.id = apm.business_process_id
        WHERE apm.asset_id = ?
      `).bind(risk.affected_asset_id).all()
      risk.affected_processes = processes.results
    }

    return c.json(risk)
  } catch (error) {
    console.error('Get risk error:', error)
    return c.json({ error: 'Failed to get risk' }, 500)
  }
})

// Create risk
app.post('/api/risks', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')
  const body = await c.req.json()

  try {
    const id = generateId('risk')
    const inherentScore = calculateInherentScore(
      body.inherent_likelihood || 0.5,
      body.inherent_impact || 0.5
    )

    // Calculate business impact if asset is specified
    let businessImpact = { isRevenueGenerating: false, isCustomerFacing: false, isRegulatoryRequired: false, revenueImpact: 0 }
    
    if (body.affected_asset_id) {
      const processes = await db.prepare(`
        SELECT bp.is_revenue_generating, bp.is_customer_facing, bp.is_regulatory_required, bp.revenue_impact_per_hour
        FROM business_processes bp
        JOIN asset_process_mappings apm ON bp.id = apm.business_process_id
        WHERE apm.asset_id = ?
      `).bind(body.affected_asset_id).all()

      for (const p of processes.results as any[]) {
        if (p.is_revenue_generating) businessImpact.isRevenueGenerating = true
        if (p.is_customer_facing) businessImpact.isCustomerFacing = true
        if (p.is_regulatory_required) businessImpact.isRegulatoryRequired = true
        businessImpact.revenueImpact += p.revenue_impact_per_hour || 0
      }
    }

    const contextPriority = calculateContextPriority(
      inherentScore,
      businessImpact.isRevenueGenerating,
      businessImpact.isCustomerFacing,
      businessImpact.isRegulatoryRequired,
      businessImpact.revenueImpact
    )

    await db.prepare(`
      INSERT INTO risk_items (
        id, organization_id, title, description, risk_source, external_reference,
        category, subcategory, affected_asset_id, affected_vendor_id,
        inherent_likelihood, inherent_impact, inherent_score,
        business_impact_score, context_priority_score, context_priority_reason,
        status, assignee_id, due_date, remediation_plan
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, orgId, body.title, body.description || null, body.risk_source || 'manual',
      body.external_reference || null, body.category || 'operational', body.subcategory || null,
      body.affected_asset_id || null, body.affected_vendor_id || null,
      body.inherent_likelihood || 0.5, body.inherent_impact || 0.5, inherentScore,
      contextPriority.score, contextPriority.score, contextPriority.reason,
      body.status || 'open', body.assignee_id || null,
      body.due_date || null, body.remediation_plan || null
    ).run()

    // Log audit
    await db.prepare(`
      INSERT INTO audit_logs (id, organization_id, action, resource_type, resource_id, new_state)
      VALUES (?, ?, 'create', 'risk', ?, ?)
    `).bind(generateId('audit'), orgId, id, JSON.stringify(body)).run()

    const created = await db.prepare('SELECT * FROM risk_items WHERE id = ?').bind(id).first()
    return c.json(created, 201)
  } catch (error) {
    console.error('Create risk error:', error)
    return c.json({ error: 'Failed to create risk' }, 500)
  }
})

// Update risk
app.patch('/api/risks/:id', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')
  const userRole = c.get('userRole')
  const riskId = c.req.param('id')
  const body = await c.req.json()

  try {
    // Get current state for audit
    const current = await db.prepare('SELECT * FROM risk_items WHERE id = ?').bind(riskId).first() as any
    if (!current) {
      return c.json({ error: 'Risk not found' }, 404)
    }
    
    // RBAC: Auditors can only update audit_finding risks
    if (userRole === 'auditor') {
      if (current.risk_source !== 'audit_finding') {
        return c.json({ 
          error: 'Access denied', 
          message: 'Auditors can only update audit finding risks' 
        }, 403)
      }
      // Auditors can only change status, not other fields
      const allowedAuditorFields = ['status', 'remediation_plan']
      const attemptedFields = Object.keys(body)
      const unauthorizedFields = attemptedFields.filter(f => !allowedAuditorFields.includes(f))
      if (unauthorizedFields.length > 0) {
        return c.json({ 
          error: 'Access denied', 
          message: `Auditors can only update: ${allowedAuditorFields.join(', ')}. Unauthorized fields: ${unauthorizedFields.join(', ')}` 
        }, 403)
      }
    }

    // Build update query dynamically
    const updates: string[] = []
    const values: any[] = []

    const allowedFields = [
      'title', 'description', 'category', 'subcategory', 'status',
      'assignee_id', 'due_date', 'remediation_plan', 'inherent_likelihood',
      'inherent_impact', 'residual_likelihood', 'residual_impact'
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`)
        values.push(body[field])
      }
    }

    // Recalculate scores if likelihood/impact changed
    if (body.inherent_likelihood !== undefined || body.inherent_impact !== undefined) {
      const likelihood = body.inherent_likelihood ?? current.inherent_likelihood
      const impact = body.inherent_impact ?? current.inherent_impact
      const inherentScore = calculateInherentScore(likelihood, impact)
      updates.push('inherent_score = ?')
      values.push(inherentScore)

      // Recalculate context priority
      if (current.affected_asset_id) {
        const processes = await db.prepare(`
          SELECT bp.is_revenue_generating, bp.is_customer_facing, bp.is_regulatory_required, bp.revenue_impact_per_hour
          FROM business_processes bp
          JOIN asset_process_mappings apm ON bp.id = apm.business_process_id
          WHERE apm.asset_id = ?
        `).bind(current.affected_asset_id).all()

        let businessImpact = { isRevenueGenerating: false, isCustomerFacing: false, isRegulatoryRequired: false, revenueImpact: 0 }
        for (const p of processes.results as any[]) {
          if (p.is_revenue_generating) businessImpact.isRevenueGenerating = true
          if (p.is_customer_facing) businessImpact.isCustomerFacing = true
          if (p.is_regulatory_required) businessImpact.isRegulatoryRequired = true
          businessImpact.revenueImpact += p.revenue_impact_per_hour || 0
        }

        const contextPriority = calculateContextPriority(
          inherentScore,
          businessImpact.isRevenueGenerating,
          businessImpact.isCustomerFacing,
          businessImpact.isRegulatoryRequired,
          businessImpact.revenueImpact
        )

        updates.push('context_priority_score = ?', 'context_priority_reason = ?')
        values.push(contextPriority.score, contextPriority.reason)
      }
    }

    // Calculate residual score
    if (body.residual_likelihood !== undefined || body.residual_impact !== undefined) {
      const resLikelihood = body.residual_likelihood ?? current.residual_likelihood ?? current.inherent_likelihood
      const resImpact = body.residual_impact ?? current.residual_impact ?? current.inherent_impact
      updates.push('residual_score = ?')
      values.push(calculateInherentScore(resLikelihood, resImpact))
    }

    // Handle status change
    if (body.status && body.status !== current.status) {
      if (body.status === 'closed' || body.status === 'mitigated') {
        updates.push('resolved_at = ?')
        values.push(new Date().toISOString())
      }
    }

    updates.push('updated_at = ?')
    values.push(new Date().toISOString())
    values.push(riskId)

    await db.prepare(`
      UPDATE risk_items SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run()

    // Log audit
    await db.prepare(`
      INSERT INTO audit_logs (id, organization_id, action, resource_type, resource_id, previous_state, new_state)
      VALUES (?, ?, 'update', 'risk', ?, ?, ?)
    `).bind(generateId('audit'), orgId, riskId, JSON.stringify(current), JSON.stringify(body)).run()

    // Add to risk history
    await db.prepare(`
      INSERT INTO risk_history (id, risk_id, change_type, previous_value, new_value)
      VALUES (?, ?, 'update', ?, ?)
    `).bind(generateId('hist'), riskId, JSON.stringify(current), JSON.stringify(body)).run()

    // REVERSE SYNC: Update linked Audit Finding when risk status is set
    // Always sync when status is provided to ensure consistency
    if (body.status) {
      // Check if this risk is linked from an audit finding
      const linkedFinding = await db.prepare(`
        SELECT id, affected_controls, organization_id FROM audit_findings WHERE related_risk_id = ?
      `).bind(riskId).first()
      
      if (linkedFinding) {
        let findingStatus = 'open'
        if (body.status === 'mitigated' || body.status === 'closed') findingStatus = 'remediated'
        else if (body.status === 'in_progress') findingStatus = 'in_progress'
        else if (body.status === 'accepted') findingStatus = 'accepted'
        
        // Update audit finding status
        await db.prepare(`
          UPDATE audit_findings 
          SET status = ?, 
              updated_at = datetime('now'),
              closed_date = CASE WHEN ? IN ('remediated', 'closed') THEN datetime('now') ELSE closed_date END
          WHERE id = ?
        `).bind(findingStatus, findingStatus, linkedFinding.id).run()
        
        // COMPLIANCE SYNC based on risk status change
        if (linkedFinding.affected_controls) {
          try {
            const affectedControls = JSON.parse(linkedFinding.affected_controls as string)
            const findingOrgId = linkedFinding.organization_id || orgId
            
            if (['mitigated', 'closed'].includes(body.status)) {
              // RESTORE: When risk is mitigated/closed, restore control status
              for (const ctrl of affectedControls) {
                // Check if there are other open findings affecting this control
                const otherOpenFindings = await db.prepare(`
                  SELECT COUNT(*) as count FROM audit_findings 
                  WHERE organization_id = ? 
                  AND id != ? 
                  AND status IN ('open', 'in_progress', 'remediation_planned')
                  AND affected_controls LIKE ?
                `).bind(findingOrgId, linkedFinding.id, `%"id":"${ctrl.id}"%`).first()
                
                // If no other open findings affect this control, upgrade its status
                if ((otherOpenFindings?.count || 0) === 0) {
                  await db.prepare(`
                    UPDATE control_assessments 
                    SET implementation_status = 'implemented',
                        notes = COALESCE(notes, '') || '\n[' || datetime('now') || '] Restored via Risk Register mitigation',
                        updated_at = datetime('now')
                    WHERE organization_id = ? AND control_library_id = ?
                  `).bind(findingOrgId, ctrl.id).run()
                }
              }
            } else if (['open', 'in_progress'].includes(body.status)) {
              // DOWNGRADE: When risk is re-opened, downgrade control status
              for (const ctrl of affectedControls) {
                await db.prepare(`
                  UPDATE control_assessments 
                  SET implementation_status = 'not_implemented',
                      notes = COALESCE(notes, '') || '\n[' || datetime('now') || '] Deficiency identified via Risk Register (re-opened)',
                      updated_at = datetime('now')
                  WHERE organization_id = ? AND control_library_id = ?
                `).bind(findingOrgId, ctrl.id).run()
              }
            }
          } catch (e) {
            console.error('Error syncing control status from risk update:', e)
          }
        }
      }
    }

    const updated = await db.prepare('SELECT * FROM risk_items WHERE id = ?').bind(riskId).first()
    return c.json(updated)
  } catch (error) {
    console.error('Update risk error:', error)
    return c.json({ error: 'Failed to update risk' }, 500)
  }
})

// Delete risk
app.delete('/api/risks/:id', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')
  const riskId = c.req.param('id')

  try {
    const current = await db.prepare('SELECT * FROM risk_items WHERE id = ?').bind(riskId).first()
    if (!current) {
      return c.json({ error: 'Risk not found' }, 404)
    }

    await db.prepare('DELETE FROM risk_items WHERE id = ?').bind(riskId).run()

    // Log audit
    await db.prepare(`
      INSERT INTO audit_logs (id, organization_id, action, resource_type, resource_id, previous_state)
      VALUES (?, ?, 'delete', 'risk', ?, ?)
    `).bind(generateId('audit'), orgId, riskId, JSON.stringify(current)).run()

    return c.json({ success: true, message: 'Risk deleted' })
  } catch (error) {
    console.error('Delete risk error:', error)
    return c.json({ error: 'Failed to delete risk' }, 500)
  }
})

// ============================================================================
// ASSETS API
// ============================================================================

// List assets
app.get('/api/assets', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')
  const type = c.req.query('type')
  const criticality = c.req.query('criticality')

  try {
    let query = `
      SELECT a.*, u.display_name as owner_name,
             (SELECT COUNT(*) FROM risk_items r WHERE r.affected_asset_id = a.id AND r.status IN ('open', 'in_progress')) as risk_count
      FROM assets a
      LEFT JOIN users_new u ON a.owner_id = u.id
      WHERE a.organization_id = ?
    `
    const params: any[] = [orgId]

    if (type) {
      query += ` AND a.asset_type = ?`
      params.push(type)
    }
    if (criticality) {
      query += ` AND a.criticality = ?`
      params.push(criticality)
    }

    query += ` ORDER BY a.criticality DESC, a.name`

    const result = await db.prepare(query).bind(...params).all()
    return c.json({ assets: result.results, total: result.results.length })
  } catch (error) {
    console.error('List assets error:', error)
    return c.json({ error: 'Failed to list assets' }, 500)
  }
})

// Get single asset
app.get('/api/assets/:id', async (c) => {
  const db = c.env.DB
  const assetId = c.req.param('id')

  try {
    const asset = await db.prepare(`
      SELECT a.*, u.display_name as owner_name
      FROM assets a
      LEFT JOIN users_new u ON a.owner_id = u.id
      WHERE a.id = ?
    `).bind(assetId).first()

    if (!asset) {
      return c.json({ error: 'Asset not found' }, 404)
    }

    // Get related business processes
    const processes = await db.prepare(`
      SELECT bp.*, apm.dependency_type
      FROM business_processes bp
      JOIN asset_process_mappings apm ON bp.id = apm.business_process_id
      WHERE apm.asset_id = ?
    `).bind(assetId).all()
    asset.business_processes = processes.results

    // Get dependencies
    const dependencies = await db.prepare(`
      SELECT a2.*, ar.relationship_type
      FROM assets a2
      JOIN asset_relationships ar ON a2.id = ar.target_asset_id
      WHERE ar.source_asset_id = ?
    `).bind(assetId).all()
    asset.dependencies = dependencies.results

    // Get risks
    const risks = await db.prepare(`
      SELECT * FROM risk_items WHERE affected_asset_id = ? AND status IN ('open', 'in_progress')
    `).bind(assetId).all()
    asset.risks = risks.results

    return c.json(asset)
  } catch (error) {
    console.error('Get asset error:', error)
    return c.json({ error: 'Failed to get asset' }, 500)
  }
})

// Create asset
app.post('/api/assets', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')
  const body = await c.req.json()

  try {
    const id = generateId('asset')

    await db.prepare(`
      INSERT INTO assets (
        id, organization_id, name, description, asset_type, cloud_provider,
        region, criticality, data_classification, contains_pii, contains_phi,
        contains_pci, ip_address, hostname, owner_id, owner_team, status, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, orgId, body.name, body.description || null, body.asset_type,
      body.cloud_provider || null, body.region || null, body.criticality || 'medium',
      body.data_classification || 'internal', body.contains_pii ? 1 : 0,
      body.contains_phi ? 1 : 0, body.contains_pci ? 1 : 0,
      body.ip_address || null, body.hostname || null, body.owner_id || null,
      body.owner_team || null, body.status || 'active', JSON.stringify(body.tags || {})
    ).run()

    // Log audit
    await db.prepare(`
      INSERT INTO audit_logs (id, organization_id, action, resource_type, resource_id, new_state)
      VALUES (?, ?, 'create', 'asset', ?, ?)
    `).bind(generateId('audit'), orgId, id, JSON.stringify(body)).run()

    const created = await db.prepare('SELECT * FROM assets WHERE id = ?').bind(id).first()
    return c.json(created, 201)
  } catch (error) {
    console.error('Create asset error:', error)
    return c.json({ error: 'Failed to create asset' }, 500)
  }
})

// Update asset
app.patch('/api/assets/:id', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')
  const assetId = c.req.param('id')
  const body = await c.req.json()

  try {
    const current = await db.prepare('SELECT * FROM assets WHERE id = ?').bind(assetId).first()
    if (!current) {
      return c.json({ error: 'Asset not found' }, 404)
    }

    const updates: string[] = []
    const values: any[] = []

    const allowedFields = [
      'name', 'description', 'asset_type', 'cloud_provider', 'region',
      'criticality', 'data_classification', 'contains_pii', 'contains_phi',
      'contains_pci', 'ip_address', 'hostname', 'owner_id', 'owner_team', 'status'
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (['contains_pii', 'contains_phi', 'contains_pci'].includes(field)) {
          updates.push(`${field} = ?`)
          values.push(body[field] ? 1 : 0)
        } else {
          updates.push(`${field} = ?`)
          values.push(body[field])
        }
      }
    }

    if (body.tags) {
      updates.push('tags = ?')
      values.push(JSON.stringify(body.tags))
    }

    updates.push('updated_at = ?')
    values.push(new Date().toISOString())
    values.push(assetId)

    await db.prepare(`UPDATE assets SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run()

    // Log audit
    await db.prepare(`
      INSERT INTO audit_logs (id, organization_id, action, resource_type, resource_id, previous_state, new_state)
      VALUES (?, ?, 'update', 'asset', ?, ?, ?)
    `).bind(generateId('audit'), orgId, assetId, JSON.stringify(current), JSON.stringify(body)).run()

    const updated = await db.prepare('SELECT * FROM assets WHERE id = ?').bind(assetId).first()
    return c.json(updated)
  } catch (error) {
    console.error('Update asset error:', error)
    return c.json({ error: 'Failed to update asset' }, 500)
  }
})

// Delete asset
app.delete('/api/assets/:id', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')
  const assetId = c.req.param('id')

  try {
    const current = await db.prepare('SELECT * FROM assets WHERE id = ?').bind(assetId).first()
    if (!current) {
      return c.json({ error: 'Asset not found' }, 404)
    }

    await db.prepare('DELETE FROM assets WHERE id = ?').bind(assetId).run()

    // Log audit
    await db.prepare(`
      INSERT INTO audit_logs (id, organization_id, action, resource_type, resource_id, previous_state)
      VALUES (?, ?, 'delete', 'asset', ?, ?)
    `).bind(generateId('audit'), orgId, assetId, JSON.stringify(current)).run()

    return c.json({ success: true, message: 'Asset deleted' })
  } catch (error) {
    console.error('Delete asset error:', error)
    return c.json({ error: 'Failed to delete asset' }, 500)
  }
})

// ============================================================================
// VENDORS API
// ============================================================================

// List vendors
app.get('/api/vendors', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')
  const tier = c.req.query('tier')
  const status = c.req.query('status')

  try {
    let query = `
      SELECT v.*,
             (SELECT COUNT(*) FROM vendor_incidents vi WHERE vi.vendor_id = v.id AND vi.status IN ('investigating', 'monitoring')) as active_incidents
      FROM vendors v
      WHERE v.organization_id = ?
    `
    const params: any[] = [orgId]

    if (tier) {
      query += ` AND v.vendor_tier = ?`
      params.push(tier)
    }
    if (status) {
      query += ` AND v.status = ?`
      params.push(status)
    }

    query += ` ORDER BY v.vendor_tier, v.name`

    const result = await db.prepare(query).bind(...params).all()
    return c.json({ vendors: result.results, total: result.results.length })
  } catch (error) {
    console.error('List vendors error:', error)
    return c.json({ error: 'Failed to list vendors' }, 500)
  }
})

// Get single vendor
app.get('/api/vendors/:id', async (c) => {
  const db = c.env.DB
  const vendorId = c.req.param('id')

  try {
    const vendor = await db.prepare('SELECT * FROM vendors WHERE id = ?').bind(vendorId).first()
    if (!vendor) {
      return c.json({ error: 'Vendor not found' }, 404)
    }

    // Get business processes
    const processes = await db.prepare(`
      SELECT bp.*, vpm.dependency_level, vpm.service_description
      FROM business_processes bp
      JOIN vendor_process_mappings vpm ON bp.id = vpm.business_process_id
      WHERE vpm.vendor_id = ?
    `).bind(vendorId).all()
    vendor.business_processes = processes.results

    // Get incidents
    const incidents = await db.prepare(`
      SELECT * FROM vendor_incidents WHERE vendor_id = ? ORDER BY detected_at DESC
    `).bind(vendorId).all()
    vendor.incidents = incidents.results

    // Get risks
    const risks = await db.prepare(`
      SELECT * FROM risk_items WHERE affected_vendor_id = ? AND status IN ('open', 'in_progress')
    `).bind(vendorId).all()
    vendor.risks = risks.results

    // Parse JSON fields
    if (vendor.data_types_accessed) vendor.data_types_accessed = JSON.parse(vendor.data_types_accessed as string)
    if (vendor.certifications) vendor.certifications = JSON.parse(vendor.certifications as string)

    return c.json(vendor)
  } catch (error) {
    console.error('Get vendor error:', error)
    return c.json({ error: 'Failed to get vendor' }, 500)
  }
})

// Create vendor
app.post('/api/vendors', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')
  const body = await c.req.json()

  try {
    const id = generateId('vendor')

    await db.prepare(`
      INSERT INTO vendors (
        id, organization_id, name, legal_name, description, website, industry,
        vendor_tier, vendor_type, has_data_access, data_types_accessed,
        contract_start_date, contract_end_date, contract_value,
        primary_contact_name, primary_contact_email, primary_contact_phone,
        current_risk_score, certifications, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, orgId, body.name, body.legal_name || null, body.description || null,
      body.website || null, body.industry || null, body.vendor_tier || 'medium',
      body.vendor_type || null, body.has_data_access ? 1 : 0,
      JSON.stringify(body.data_types_accessed || []),
      body.contract_start_date || null, body.contract_end_date || null,
      body.contract_value || null, body.primary_contact_name || null,
      body.primary_contact_email || null, body.primary_contact_phone || null,
      body.current_risk_score || 50, JSON.stringify(body.certifications || []),
      body.status || 'prospect'
    ).run()

    // Log audit
    await db.prepare(`
      INSERT INTO audit_logs (id, organization_id, action, resource_type, resource_id, new_state)
      VALUES (?, ?, 'create', 'vendor', ?, ?)
    `).bind(generateId('audit'), orgId, id, JSON.stringify(body)).run()

    const created = await db.prepare('SELECT * FROM vendors WHERE id = ?').bind(id).first()
    return c.json(created, 201)
  } catch (error) {
    console.error('Create vendor error:', error)
    return c.json({ error: 'Failed to create vendor' }, 500)
  }
})

// Update vendor
app.patch('/api/vendors/:id', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')
  const vendorId = c.req.param('id')
  const body = await c.req.json()

  try {
    const current = await db.prepare('SELECT * FROM vendors WHERE id = ?').bind(vendorId).first()
    if (!current) {
      return c.json({ error: 'Vendor not found' }, 404)
    }

    const updates: string[] = []
    const values: any[] = []

    const allowedFields = [
      'name', 'legal_name', 'description', 'website', 'industry', 'vendor_tier',
      'vendor_type', 'has_data_access', 'contract_start_date', 'contract_end_date',
      'contract_value', 'primary_contact_name', 'primary_contact_email',
      'primary_contact_phone', 'current_risk_score', 'status'
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'has_data_access') {
          updates.push(`${field} = ?`)
          values.push(body[field] ? 1 : 0)
        } else {
          updates.push(`${field} = ?`)
          values.push(body[field])
        }
      }
    }

    if (body.data_types_accessed) {
      updates.push('data_types_accessed = ?')
      values.push(JSON.stringify(body.data_types_accessed))
    }
    if (body.certifications) {
      updates.push('certifications = ?')
      values.push(JSON.stringify(body.certifications))
    }

    updates.push('updated_at = ?')
    values.push(new Date().toISOString())
    values.push(vendorId)

    await db.prepare(`UPDATE vendors SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run()

    // Log audit
    await db.prepare(`
      INSERT INTO audit_logs (id, organization_id, action, resource_type, resource_id, previous_state, new_state)
      VALUES (?, ?, 'update', 'vendor', ?, ?, ?)
    `).bind(generateId('audit'), orgId, vendorId, JSON.stringify(current), JSON.stringify(body)).run()

    const updated = await db.prepare('SELECT * FROM vendors WHERE id = ?').bind(vendorId).first()
    return c.json(updated)
  } catch (error) {
    console.error('Update vendor error:', error)
    return c.json({ error: 'Failed to update vendor' }, 500)
  }
})

// Delete vendor
app.delete('/api/vendors/:id', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')
  const vendorId = c.req.param('id')

  try {
    const current = await db.prepare('SELECT * FROM vendors WHERE id = ?').bind(vendorId).first()
    if (!current) {
      return c.json({ error: 'Vendor not found' }, 404)
    }

    await db.prepare('DELETE FROM vendors WHERE id = ?').bind(vendorId).run()

    // Log audit
    await db.prepare(`
      INSERT INTO audit_logs (id, organization_id, action, resource_type, resource_id, previous_state)
      VALUES (?, ?, 'delete', 'vendor', ?, ?)
    `).bind(generateId('audit'), orgId, vendorId, JSON.stringify(current)).run()

    return c.json({ success: true, message: 'Vendor deleted' })
  } catch (error) {
    console.error('Delete vendor error:', error)
    return c.json({ error: 'Failed to delete vendor' }, 500)
  }
})

// ============================================================================
// VENDOR INCIDENTS API
// ============================================================================

app.get('/api/vendor-incidents', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')
  const status = c.req.query('status')

  try {
    let query = `
      SELECT vi.*, v.name as vendor_name, v.vendor_tier
      FROM vendor_incidents vi
      JOIN vendors v ON vi.vendor_id = v.id
      WHERE vi.organization_id = ?
    `
    const params: any[] = [orgId]

    if (status) {
      query += ` AND vi.status = ?`
      params.push(status)
    }

    query += ` ORDER BY vi.detected_at DESC`

    const result = await db.prepare(query).bind(...params).all()
    return c.json({ incidents: result.results, total: result.results.length })
  } catch (error) {
    console.error('List vendor incidents error:', error)
    return c.json({ error: 'Failed to list vendor incidents' }, 500)
  }
})

app.post('/api/vendor-incidents', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')
  const body = await c.req.json()

  try {
    const id = generateId('incident')

    await db.prepare(`
      INSERT INTO vendor_incidents (
        id, organization_id, vendor_id, incident_type, severity, title, description,
        source, source_url, data_compromised, service_affected, our_data_affected,
        estimated_impact, status, detected_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, orgId, body.vendor_id, body.incident_type || 'other', body.severity || 'medium',
      body.title, body.description || null, body.source || 'manual', body.source_url || null,
      body.data_compromised ? 1 : 0, body.service_affected ? 1 : 0, body.our_data_affected ? 1 : 0,
      body.estimated_impact || null, body.status || 'investigating',
      body.detected_at || new Date().toISOString()
    ).run()

    // Log audit
    await db.prepare(`
      INSERT INTO audit_logs (id, organization_id, action, resource_type, resource_id, new_state)
      VALUES (?, ?, 'create', 'vendor_incident', ?, ?)
    `).bind(generateId('audit'), orgId, id, JSON.stringify(body)).run()

    const created = await db.prepare('SELECT * FROM vendor_incidents WHERE id = ?').bind(id).first()
    return c.json(created, 201)
  } catch (error) {
    console.error('Create vendor incident error:', error)
    return c.json({ error: 'Failed to create vendor incident' }, 500)
  }
})

// ============================================================================
// BUSINESS PROCESSES API
// ============================================================================

app.get('/api/business-processes', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')

  try {
    const result = await db.prepare(`
      SELECT bp.*, bu.name as business_unit_name, u.display_name as owner_name
      FROM business_processes bp
      LEFT JOIN business_units bu ON bp.business_unit_id = bu.id
      LEFT JOIN users_new u ON bp.process_owner_id = u.id
      WHERE bp.organization_id = ?
      ORDER BY bp.criticality DESC, bp.name
    `).bind(orgId).all()

    return c.json({ processes: result.results, total: result.results.length })
  } catch (error) {
    console.error('List business processes error:', error)
    return c.json({ error: 'Failed to list business processes' }, 500)
  }
})

// ============================================================================
// CONTROLS API
// ============================================================================

app.get('/api/controls', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')
  const status = c.req.query('status')

  try {
    let query = `
      SELECT c.*, u.display_name as owner_name
      FROM controls c
      LEFT JOIN users_new u ON c.owner_id = u.id
      WHERE c.organization_id = ?
    `
    const params: any[] = [orgId]

    if (status) {
      query += ` AND c.implementation_status = ?`
      params.push(status)
    }

    query += ` ORDER BY c.category, c.control_id`

    const result = await db.prepare(query).bind(...params).all()
    return c.json({ controls: result.results, total: result.results.length })
  } catch (error) {
    console.error('List controls error:', error)
    return c.json({ error: 'Failed to list controls' }, 500)
  }
})

// ============================================================================
// COMPLIANCE API
// ============================================================================

app.get('/api/compliance', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')

  try {
    // Get frameworks
    const frameworks = await db.prepare('SELECT * FROM compliance_frameworks WHERE is_active = 1').all()

    // Get control stats
    const controlStats = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN implementation_status = 'implemented' THEN 1 ELSE 0 END) as implemented,
        SUM(CASE WHEN implementation_status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN implementation_status = 'not_started' THEN 1 ELSE 0 END) as not_started
      FROM controls WHERE organization_id = ?
    `).bind(orgId).first()

    // Get effectiveness stats
    const effectivenessStats = await db.prepare(`
      SELECT 
        SUM(CASE WHEN effectiveness_rating = 'effective' THEN 1 ELSE 0 END) as effective,
        SUM(CASE WHEN effectiveness_rating = 'partially_effective' THEN 1 ELSE 0 END) as partially_effective,
        SUM(CASE WHEN effectiveness_rating = 'ineffective' THEN 1 ELSE 0 END) as ineffective,
        SUM(CASE WHEN effectiveness_rating = 'not_tested' OR effectiveness_rating IS NULL THEN 1 ELSE 0 END) as not_tested
      FROM controls WHERE organization_id = ? AND implementation_status = 'implemented'
    `).bind(orgId).first()

    return c.json({
      frameworks: frameworks.results,
      controlStats,
      effectivenessStats
    })
  } catch (error) {
    console.error('Get compliance error:', error)
    return c.json({ error: 'Failed to get compliance data' }, 500)
  }
})

// ============================================================================
// USERS API
// ============================================================================

app.get('/api/users', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')

  try {
    const result = await db.prepare(`
      SELECT id, email, first_name, last_name, display_name, job_title, department, role, status
      FROM users_new WHERE organization_id = ? ORDER BY display_name
    `).bind(orgId).all()

    return c.json({ users: result.results, total: result.results.length })
  } catch (error) {
    console.error('List users error:', error)
    return c.json({ error: 'Failed to list users' }, 500)
  }
})

// ============================================================================
// GRAPH DATA API (for visualization)
// ============================================================================

app.get('/api/graph', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')

  try {
    // Get business processes
    const processes = await db.prepare(`
      SELECT id, name, criticality, is_revenue_generating, revenue_impact_per_hour
      FROM business_processes WHERE organization_id = ?
    `).bind(orgId).all()

    // Get assets
    const assets = await db.prepare(`
      SELECT a.id, a.name, a.asset_type, a.criticality,
             (SELECT COUNT(*) FROM risk_items r WHERE r.affected_asset_id = a.id AND r.status IN ('open', 'in_progress')) as risk_count
      FROM assets a WHERE a.organization_id = ?
    `).bind(orgId).all()

    // Get vendors
    const vendors = await db.prepare(`
      SELECT id, name, vendor_tier, current_risk_score
      FROM vendors WHERE organization_id = ?
    `).bind(orgId).all()

    // Get asset-process mappings
    const assetProcessMappings = await db.prepare(`
      SELECT asset_id, business_process_id, dependency_type
      FROM asset_process_mappings WHERE organization_id = ?
    `).bind(orgId).all()

    // Get vendor-process mappings
    const vendorProcessMappings = await db.prepare(`
      SELECT vendor_id, business_process_id, dependency_level
      FROM vendor_process_mappings WHERE organization_id = ?
    `).bind(orgId).all()

    // Get asset relationships
    const assetRelationships = await db.prepare(`
      SELECT source_asset_id, target_asset_id, relationship_type
      FROM asset_relationships WHERE organization_id = ?
    `).bind(orgId).all()

    // Get open risks
    const risks = await db.prepare(`
      SELECT id, title, affected_asset_id, affected_vendor_id, context_priority_score, status
      FROM risk_items WHERE organization_id = ? AND status IN ('open', 'in_progress')
    `).bind(orgId).all()

    return c.json({
      processes: processes.results,
      assets: assets.results,
      vendors: vendors.results,
      assetProcessMappings: assetProcessMappings.results,
      vendorProcessMappings: vendorProcessMappings.results,
      assetRelationships: assetRelationships.results,
      risks: risks.results
    })
  } catch (error) {
    console.error('Get graph data error:', error)
    return c.json({ error: 'Failed to get graph data' }, 500)
  }
})

// ============================================================================
// AI CO-PILOT API (Free - Cloudflare Workers AI)
// ============================================================================

// System prompt for GRC AI Co-pilot
const GRC_SYSTEM_PROMPT = `You are an AI Co-pilot for a GRC (Governance, Risk, and Compliance) platform called "GRC Pulse". 
You help security professionals with:
- Risk assessment and prioritization
- Compliance guidance (ISO 27001, SOC2, GDPR, PCI-DSS, HIPAA)
- Security policy recommendations
- Vendor risk management
- Security maturity assessment advice
- Incident response guidance

Keep responses concise, actionable, and focused on security/compliance topics.
If asked about non-security topics, politely redirect to GRC-related assistance.
Use bullet points and clear formatting when appropriate.`

// AI Chat endpoint
app.post('/api/ai/chat', async (c) => {
  const ai = c.env.AI
  const { message, context } = await c.req.json()
  
  if (!message) {
    return c.json({ error: 'Message is required' }, 400)
  }
  
  // Check if AI is available (not available in local dev mode)
  if (!ai) {
    return c.json({
      response: "🔧 **AI Co-pilot is available in production only.**\n\nThe Cloudflare Workers AI requires deployment to Cloudflare. Please deploy to production to use the AI features.\n\nIn the meantime, here are some resources:\n- ISO 27001 documentation\n- NIST Cybersecurity Framework\n- CIS Controls\n\nDeploy to https://grc-pulse.pages.dev to try the AI!",
      model: 'local-fallback',
      cost: 'FREE'
    })
  }
  
  try {
    // Build context-aware prompt
    let contextPrompt = ''
    if (context?.currentPage) {
      contextPrompt = `\n\nUser is currently viewing: ${context.currentPage}`
    }
    if (context?.riskCount) {
      contextPrompt += `\nOpen risks: ${context.riskCount}`
    }
    if (context?.maturityScore) {
      contextPrompt += `\nCurrent maturity score: ${context.maturityScore}/5`
    }
    
    const response = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: GRC_SYSTEM_PROMPT + contextPrompt },
        { role: 'user', content: message }
      ],
      max_tokens: 500,
      temperature: 0.7
    })
    
    return c.json({
      response: response.response,
      model: 'llama-3.1-8b-instruct',
      cost: 'FREE'
    })
  } catch (error) {
    console.error('AI Chat error:', error)
    return c.json({ error: 'AI service temporarily unavailable. Please try again.' }, 500)
  }
})

// AI Quick Actions - predefined prompts for common GRC tasks
app.post('/api/ai/quick-action', async (c) => {
  const ai = c.env.AI
  const { action, data } = await c.req.json()
  
  // Check if AI is available
  if (!ai) {
    return c.json({
      response: "🔧 **AI Quick Actions available in production only.**\n\nDeploy to Cloudflare to enable AI features.",
      action,
      model: 'local-fallback',
      cost: 'FREE'
    })
  }
  
  const quickActions: Record<string, string> = {
    'analyze-risk': `Analyze this security risk and provide: 1) Risk severity assessment, 2) Potential business impact, 3) Recommended mitigations, 4) Priority level. Risk: ${JSON.stringify(data)}`,
    'compliance-check': `Review this control implementation for compliance gaps with ${data?.framework || 'ISO 27001'}. Identify: 1) Missing elements, 2) Improvement areas, 3) Evidence needed. Control: ${JSON.stringify(data)}`,
    'vendor-assessment': `Assess this vendor's security risk profile. Consider: 1) Data access level, 2) Criticality tier, 3) Security concerns, 4) Due diligence recommendations. Vendor: ${JSON.stringify(data)}`,
    'maturity-advice': `Based on this maturity assessment score of ${data?.score}/5 in ${data?.category}, provide: 1) Current state analysis, 2) Quick wins, 3) Long-term improvements, 4) Target timeline to reach level 5.`,
    'incident-response': `Provide incident response guidance for: ${data?.incidentType}. Include: 1) Immediate actions, 2) Containment steps, 3) Communication plan, 4) Recovery procedures.`
  }
  
  const prompt = quickActions[action]
  if (!prompt) {
    return c.json({ error: 'Unknown quick action' }, 400)
  }
  
  try {
    const response = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: GRC_SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      max_tokens: 600,
      temperature: 0.5
    })
    
    return c.json({
      response: response.response,
      action,
      model: 'llama-3.1-8b-instruct',
      cost: 'FREE'
    })
  } catch (error) {
    console.error('AI Quick Action error:', error)
    return c.json({ error: 'AI service temporarily unavailable' }, 500)
  }
})

// ============================================================================
// MATURITY ASSESSMENT API
// ============================================================================

// Maturity assessment questions based on CMM and ISO 27001
const maturityCategories = [
  {
    id: 'governance',
    nameEn: 'Governance & Management Commitment',
    nameAr: 'حوكمة ومدى التزام الإدارة بدعم أمن المعلومات',
    questions: [
      { id: 1, en: 'Does the organization have a clear vision, strategy, and roadmap for information security?', ar: 'هل المؤسسة لديها رؤية واستراتيجية واضحة وخارطة طريق بخصوص أمن المعلومات؟' },
      { id: 2, en: 'Are there defined information security objectives that are regularly monitored?', ar: 'هل يوجد أهداف محددة لأمن المعلومات يتم متابعة تنفيذها؟' },
      { id: 3, en: 'Is there clear governance and defined responsibilities for security operations, risk management, and audit?', ar: 'هل يوجد حوكمة واضحة وتحديد المسؤوليات لوظائف أمن المعلومات التشغيلية وإدارة المخاطر والتدقيق؟' },
      { id: 4, en: 'Does the organization follow up on legal and regulatory requirements for information security?', ar: 'ما مدى متابعة المؤسسة للمتطلبات والتوافق مع القوانين الخاصة بأمن المعلومات؟' }
    ]
  },
  {
    id: 'policies',
    nameEn: 'Security Policies',
    nameAr: 'سياسات أمن المعلومات',
    questions: [
      { id: 5, en: 'Is there an approved information security policy that is reviewed at least annually?', ar: 'هل يوجد سياسة أمن معلومات معتمدة يتم مراجعتها بشكل دوري على الأقل مرة في السنة؟' },
      { id: 6, en: 'Are security policies communicated and disseminated to employees with proper awareness?', ar: 'هل السياسات الخاصة بأمن المعلومات يتم نشرها وتعميمها على الموظفين مع التوعية بها؟' },
      { id: 7, en: 'Are security policies regularly reviewed and audited for compliance?', ar: 'هل يتم مراجعة وتحديث سياسة أمن المعلومات بشكل دوري ومراجعة تطبيقها؟' }
    ]
  },
  {
    id: 'organization',
    nameEn: 'Organizational Structure',
    nameAr: 'هيكلية أمن المعلومات في المؤسسة',
    questions: [
      { id: 8, en: 'Are there proper authorities for security functions to ensure compliance?', ar: 'هل يوجد الصلاحيات اللازمة لوظائف أمن المعلومات لضمان تطبيق أمن المعلومات والامتثال؟' },
      { id: 9, en: 'Are there clear job descriptions and responsibilities for security roles?', ar: 'هل يوجد وظائف ومسؤوليات ومهام واضحة للمجموعات المناط بها تشغيل ومراجعة وتطبيق أمن المعلومات؟' },
      { id: 10, en: 'Are security functions properly separated (operations, audit, policy)?', ar: 'هل وظائف أمن المعلومات متضمنة كل التقسيمات التشغيلية والمسؤولة على التدقيق والمراجعة؟' },
      { id: 11, en: 'Are there documented operational procedures for security units?', ar: 'هل يوجد إجراءات وعمليات تشغيلية واضحة توضح عمل الوحدات والتقسيمات؟' },
      { id: 12, en: 'Does the organization align with international security standards (ISO 27001)?', ar: 'ما مدى توافق المؤسسة وتواصلها مع المؤسسات الدولية والمحلية الخاصة بأمن المعلومات؟' },
      { id: 13, en: 'Is there a dedicated budget for information security?', ar: 'هل يتم رصد الميزانيات اللازمة لدعم أمن المعلومات من النواحي التشغيلية والتدريب؟' },
      { id: 14, en: 'Are there independent external security assessments conducted regularly?', ar: 'هل يوجد إجراءات خارجية مستقلة لتقييم أمن المعلومات من جهات خارجية بشكل دوري؟' }
    ]
  },
  {
    id: 'hr_security',
    nameEn: 'HR Security',
    nameAr: 'أمن المعلومات للموارد البشرية',
    questions: [
      { id: 15, en: 'Do employees receive regular security awareness training, especially new hires?', ar: 'هل الموظفين يتلقون مادة توعوية خاصة بأمن المعلومات بشكل دوري وخصوصاً الموظفين الجدد؟' },
      { id: 16, en: 'Is there specialized security training based on job roles?', ar: 'هل يوجد تدريب متخصص حسب الوظائف والمهام؟' },
      { id: 17, en: 'Are confidentiality and data protection clauses included in employment contracts?', ar: 'هل يتم تضمين مسؤولية عدم تسريب المعلومات والمحافظة على سرية البيانات في عقد التوظيف؟' },
      { id: 18, en: 'Is there a clear offboarding process for returning assets and data security?', ar: 'هل يوجد عملية وإجراء واضح لإرجاع العهد عند استقالة الموظف؟' },
      { id: 19, en: 'Are access rights reviewed when employees change roles or leave?', ar: 'هل يوجد عملية وإجراء واضح للتحكم في الوصول للأنظمة في حالة ترك أو تغيير الموظف لوظيفته؟' }
    ]
  },
  {
    id: 'communication',
    nameEn: 'Communication',
    nameAr: 'آليات وعملية التواصل',
    questions: [
      { id: 20, en: 'Are NDAs signed with third parties regarding data confidentiality?', ar: 'هل يتم توقيع اتفاقية سرية البيانات وعدم الإفصاح مع الأطراف الثالثة؟' },
      { id: 21, en: 'Is there a documented process for internal and external communication?', ar: 'هل يوجد عملية وإجراء يوضح عملية التواصل مع كل الجهات ومن المخول بالتواصل؟' }
    ]
  },
  {
    id: 'supplier',
    nameEn: 'Supplier Security',
    nameAr: 'أمن المعلومات مع الموردين',
    questions: [
      { id: 22, en: 'Are security requirements defined in contracts with external entities before granting access?', ar: 'هل تحدد المنظمة متطلبات الأمان في العقود مع الكيانات الخارجية قبل منح الوصول؟' },
      { id: 23, en: 'Are security requirements addressed before granting access to data and systems?', ar: 'هل يتم تناول المتطلبات ومعالجتها قبل منح الوصول إلى البيانات والأصول وأنظمة المعلومات؟' },
      { id: 24, en: 'Do external service agreements specify appropriate security requirements?', ar: 'هل الاتفاقيات الخاصة بخدمات نظام المعلومات الخارجية تحدد متطلبات الأمان المناسبة؟' },
      { id: 25, en: 'Is there a process to assess external providers compliance with security requirements?', ar: 'هل لدى المنظمة عملية مطبقة لتقييم امتثال مزودي نظام المعلومات الخارجيين لمتطلبات الأمان؟' }
    ]
  },
  {
    id: 'risk',
    nameEn: 'Risk Management',
    nameAr: 'إدارة المخاطر',
    questions: [
      { id: 26, en: 'Does the organization have a risk management framework for identifying and treating risks?', ar: 'هل يوجد للمؤسسة إطار عمل لإدارة المخاطر وتحديدها ومعالجتها؟' },
      { id: 27, en: 'Does the organization identify, assess and treat risks according to the risk framework?', ar: 'هل تقوم المؤسسة بتحديد المخاطر وتقييمها حسب خطورتها وتحليلها ومعالجتها وفق إطار إدارة المخاطر؟' },
      { id: 28, en: 'Are vulnerabilities and threats identified for critical services and assets?', ar: 'هل يتم تحديد نقاط الضعف والثغرات وكذلك التهديدات على الخدمات والأصول المهمة؟' }
    ]
  },
  {
    id: 'incident',
    nameEn: 'Incident Response',
    nameAr: 'الاستجابة لحوادث الأمن السيبراني',
    questions: [
      { id: 29, en: 'Are there incident handling procedures for reporting and responding to security events?', ar: 'هل توجد إجراءات للتعامل مع الحوادث للإبلاغ عن الأحداث الأمنية والاستجابة لها؟' },
      { id: 30, en: 'Are incident response staff aware of response phases and properly trained?', ar: 'هل موظفو الاستجابة للحوادث على دراية بمراحل الاستجابة للحوادث ولديهم التدريب الكافي؟' },
      { id: 31, en: 'Is there a dedicated Security Operations Center (SOC) team?', ar: 'هل يوجد فريق متخصص للاستجابة للحوادث الأمنية (SOC)؟' }
    ]
  },
  {
    id: 'continuity',
    nameEn: 'Business Continuity',
    nameAr: 'جوانب أمن المعلومات في إدارة استمرارية الأعمال',
    questions: [
      { id: 32, en: 'Does the organization have a documented IT business continuity plan based on business impact analysis?', ar: 'هل لدى المنظمة خطة موثقة لاستمرارية العمل لتكنولوجيا المعلومات تستند إلى تحليل تأثير الأعمال؟' }
    ]
  }
]

// CMM Maturity levels
const maturityLevels = [
  { value: 0, en: 'Not Performed', ar: 'لم يتم التنفيذ' },
  { value: 1, en: 'Performed Informally', ar: 'يتم بشكل غير رسمي' },
  { value: 2, en: 'Planned', ar: 'مخطط له' },
  { value: 3, en: 'Well Defined', ar: 'محدد بشكل جيد' },
  { value: 4, en: 'Quantitatively Controlled', ar: 'يتم التحكم به كمياً' },
  { value: 5, en: 'Continuously Improving', ar: 'تحسين مستمر' }
]

// Get maturity assessment questions
app.get('/api/maturity/questions', async (c) => {
  return c.json({
    categories: maturityCategories,
    levels: maturityLevels
  })
})

// Helper function to calculate scores
function calculateMaturityScores(answers: Record<string, number>) {
  const categoryScores: Record<string, number> = {}
  for (const category of maturityCategories) {
    const categoryAnswers = category.questions.map(q => answers[q.id] !== undefined ? answers[q.id] : null).filter(v => v !== null) as number[]
    if (categoryAnswers.length > 0) {
      const avg = categoryAnswers.reduce((a, b) => a + b, 0) / categoryAnswers.length
      categoryScores[category.id] = Math.round(avg * 100) / 100
    } else {
      categoryScores[category.id] = 0
    }
  }
  
  const allScores = Object.values(categoryScores).filter(s => s > 0)
  const overallScore = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0
  const overallPercentage = (overallScore / 5) * 100
  
  return { categoryScores, overallScore, overallPercentage }
}

// Create new maturity assessment
app.post('/api/maturity/assessment', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')
  const userId = c.get('userId')
  const { answers, assessmentName, description } = await c.req.json()
  
  try {
    const assessmentId = generateId('maturity')
    const { categoryScores, overallScore, overallPercentage } = calculateMaturityScores(answers)
    
    // Create assessment record
    await db.prepare(`
      INSERT INTO maturity_assessments (id, organization_id, name, description, status, overall_score, overall_percentage, assessor_id, assessment_date, created_by)
      VALUES (?, ?, ?, ?, 'completed', ?, ?, ?, datetime('now'), ?)
    `).bind(
      assessmentId,
      orgId,
      assessmentName || 'Security Maturity Assessment - ' + new Date().toLocaleDateString(),
      description || null,
      Math.round(overallScore * 100) / 100,
      Math.round(overallPercentage * 100) / 100,
      userId || null,
      userId || null
    ).run()
    
    // Save individual responses
    for (const [questionId, score] of Object.entries(answers)) {
      const category = maturityCategories.find(c => c.questions.some(q => q.id === parseInt(questionId)))
      if (category) {
        await db.prepare(`
          INSERT INTO maturity_responses (id, assessment_id, category_id, question_id, current_score)
          VALUES (?, ?, ?, ?, ?)
        `).bind(
          generateId('resp'),
          assessmentId,
          category.id,
          parseInt(questionId),
          score
        ).run()
      }
    }
    
    // Save category scores
    for (const category of maturityCategories) {
      await db.prepare(`
        INSERT INTO maturity_category_scores (id, assessment_id, category_id, category_name_en, category_name_ar, current_score, questions_answered, total_questions)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        generateId('catscore'),
        assessmentId,
        category.id,
        category.nameEn,
        category.nameAr,
        categoryScores[category.id],
        category.questions.filter(q => answers[q.id] !== undefined).length,
        category.questions.length
      ).run()
    }
    
    // Audit log
    await db.prepare(`
      INSERT INTO audit_logs (id, organization_id, user_id, action, resource_type, resource_id)
      VALUES (?, ?, ?, 'create', 'maturity_assessment', ?)
    `).bind(generateId('log'), orgId, userId || null, assessmentId).run()
    
    return c.json({
      id: assessmentId,
      categoryScores,
      overallScore: Math.round(overallScore * 100) / 100,
      overallPercentage: Math.round(overallPercentage * 100) / 100,
      categories: maturityCategories.map(cat => ({
        id: cat.id,
        nameEn: cat.nameEn,
        nameAr: cat.nameAr,
        score: categoryScores[cat.id]
      }))
    })
  } catch (error) {
    console.error('Save assessment error:', error)
    return c.json({ error: 'Failed to save assessment' }, 500)
  }
})

// Get single assessment with all details
app.get('/api/maturity/assessment/:id', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')
  const assessmentId = c.req.param('id')
  
  try {
    // Get assessment
    const assessment = await db.prepare(`
      SELECT ma.*, u.display_name as assessor_name
      FROM maturity_assessments ma
      LEFT JOIN users_new u ON ma.assessor_id = u.id
      WHERE ma.id = ? AND ma.organization_id = ?
    `).bind(assessmentId, orgId).first()
    
    if (!assessment) {
      return c.json({ error: 'Assessment not found' }, 404)
    }
    
    // Get responses
    const responses = await db.prepare(`
      SELECT category_id, question_id, current_score, target_score, evidence, notes, action_plan
      FROM maturity_responses
      WHERE assessment_id = ?
    `).bind(assessmentId).all()
    
    // Get category scores
    const categoryScores = await db.prepare(`
      SELECT category_id, category_name_en, category_name_ar, current_score, target_score, questions_answered, total_questions
      FROM maturity_category_scores
      WHERE assessment_id = ?
    `).bind(assessmentId).all()
    
    // Build answers object
    const answers: Record<number, number> = {}
    const responseDetails: Record<number, any> = {}
    responses.results.forEach((r: any) => {
      answers[r.question_id] = r.current_score
      responseDetails[r.question_id] = {
        score: r.current_score,
        targetScore: r.target_score,
        evidence: r.evidence,
        notes: r.notes,
        actionPlan: r.action_plan
      }
    })
    
    return c.json({
      id: assessment.id,
      name: assessment.name,
      description: assessment.description,
      status: assessment.status,
      overallScore: assessment.overall_score,
      overallPercentage: assessment.overall_percentage,
      assessorName: assessment.assessor_name,
      assessmentDate: assessment.assessment_date,
      createdAt: assessment.created_at,
      updatedAt: assessment.updated_at,
      answers,
      responseDetails,
      categoryScores: categoryScores.results,
      categories: maturityCategories.map(cat => {
        const catScore = categoryScores.results.find((cs: any) => cs.category_id === cat.id)
        return {
          id: cat.id,
          nameEn: cat.nameEn,
          nameAr: cat.nameAr,
          score: catScore?.current_score || 0,
          questionsAnswered: catScore?.questions_answered || 0,
          totalQuestions: catScore?.total_questions || cat.questions.length
        }
      })
    })
  } catch (error) {
    console.error('Get assessment error:', error)
    return c.json({ error: 'Failed to get assessment' }, 500)
  }
})

// Update existing assessment
app.patch('/api/maturity/assessment/:id', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')
  const userId = c.get('userId')
  const assessmentId = c.req.param('id')
  const { answers, assessmentName, description, status } = await c.req.json()
  
  try {
    // Verify ownership
    const existing = await db.prepare(`
      SELECT id FROM maturity_assessments WHERE id = ? AND organization_id = ?
    `).bind(assessmentId, orgId).first()
    
    if (!existing) {
      return c.json({ error: 'Assessment not found' }, 404)
    }
    
    const { categoryScores, overallScore, overallPercentage } = calculateMaturityScores(answers)
    
    // Update assessment record
    await db.prepare(`
      UPDATE maturity_assessments 
      SET name = ?, description = ?, status = ?, overall_score = ?, overall_percentage = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(
      assessmentName || 'Security Maturity Assessment',
      description || null,
      status || 'completed',
      Math.round(overallScore * 100) / 100,
      Math.round(overallPercentage * 100) / 100,
      assessmentId
    ).run()
    
    // Update or insert responses
    for (const [questionId, score] of Object.entries(answers)) {
      const category = maturityCategories.find(c => c.questions.some(q => q.id === parseInt(questionId)))
      if (category) {
        // Try to update existing, else insert
        const existingResp = await db.prepare(`
          SELECT id FROM maturity_responses WHERE assessment_id = ? AND question_id = ?
        `).bind(assessmentId, parseInt(questionId)).first()
        
        if (existingResp) {
          await db.prepare(`
            UPDATE maturity_responses SET current_score = ?, updated_at = datetime('now') WHERE id = ?
          `).bind(score, existingResp.id).run()
        } else {
          await db.prepare(`
            INSERT INTO maturity_responses (id, assessment_id, category_id, question_id, current_score)
            VALUES (?, ?, ?, ?, ?)
          `).bind(generateId('resp'), assessmentId, category.id, parseInt(questionId), score).run()
        }
      }
    }
    
    // Update category scores
    for (const category of maturityCategories) {
      const existingCat = await db.prepare(`
        SELECT id FROM maturity_category_scores WHERE assessment_id = ? AND category_id = ?
      `).bind(assessmentId, category.id).first()
      
      const questionsAnswered = category.questions.filter(q => answers[q.id] !== undefined).length
      
      if (existingCat) {
        await db.prepare(`
          UPDATE maturity_category_scores SET current_score = ?, questions_answered = ?, updated_at = datetime('now') WHERE id = ?
        `).bind(categoryScores[category.id], questionsAnswered, existingCat.id).run()
      } else {
        await db.prepare(`
          INSERT INTO maturity_category_scores (id, assessment_id, category_id, category_name_en, category_name_ar, current_score, questions_answered, total_questions)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(generateId('catscore'), assessmentId, category.id, category.nameEn, category.nameAr, categoryScores[category.id], questionsAnswered, category.questions.length).run()
      }
    }
    
    // Audit log
    await db.prepare(`
      INSERT INTO audit_logs (id, organization_id, user_id, action, resource_type, resource_id)
      VALUES (?, ?, ?, 'update', 'maturity_assessment', ?)
    `).bind(generateId('log'), orgId, userId || null, assessmentId).run()
    
    return c.json({
      id: assessmentId,
      categoryScores,
      overallScore: Math.round(overallScore * 100) / 100,
      overallPercentage: Math.round(overallPercentage * 100) / 100,
      categories: maturityCategories.map(cat => ({
        id: cat.id,
        nameEn: cat.nameEn,
        nameAr: cat.nameAr,
        score: categoryScores[cat.id]
      }))
    })
  } catch (error) {
    console.error('Update assessment error:', error)
    return c.json({ error: 'Failed to update assessment' }, 500)
  }
})

// Delete assessment
app.delete('/api/maturity/assessment/:id', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')
  const userId = c.get('userId')
  const assessmentId = c.req.param('id')
  
  try {
    // Verify ownership
    const existing = await db.prepare(`
      SELECT id FROM maturity_assessments WHERE id = ? AND organization_id = ?
    `).bind(assessmentId, orgId).first()
    
    if (!existing) {
      return c.json({ error: 'Assessment not found' }, 404)
    }
    
    // Delete responses and scores (cascade should handle this but being explicit)
    await db.prepare(`DELETE FROM maturity_responses WHERE assessment_id = ?`).bind(assessmentId).run()
    await db.prepare(`DELETE FROM maturity_category_scores WHERE assessment_id = ?`).bind(assessmentId).run()
    await db.prepare(`DELETE FROM maturity_assessments WHERE id = ?`).bind(assessmentId).run()
    
    // Audit log
    await db.prepare(`
      INSERT INTO audit_logs (id, organization_id, user_id, action, resource_type, resource_id)
      VALUES (?, ?, ?, 'delete', 'maturity_assessment', ?)
    `).bind(generateId('log'), orgId, userId || null, assessmentId).run()
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Delete assessment error:', error)
    return c.json({ error: 'Failed to delete assessment' }, 500)
  }
})

// Get past assessments (history)
app.get('/api/maturity/history', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')
  
  try {
    const result = await db.prepare(`
      SELECT ma.id, ma.name, ma.description, ma.status, ma.overall_score, ma.overall_percentage, 
             ma.assessment_date, ma.created_at, ma.updated_at, u.display_name as assessor_name
      FROM maturity_assessments ma
      LEFT JOIN users_new u ON ma.assessor_id = u.id
      WHERE ma.organization_id = ?
      ORDER BY ma.created_at DESC
      LIMIT 20
    `).bind(orgId).all()
    
    return c.json({ 
      assessments: result.results.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        overallScore: row.overall_score,
        overallPercentage: row.overall_percentage,
        assessorName: row.assessor_name,
        assessmentDate: row.assessment_date,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    })
  } catch (error) {
    console.error('Get history error:', error)
    return c.json({ assessments: [] })
  }
})

// ============================================================================
// STATIC HTML PAGES
// ============================================================================

// Landing/Login Page
app.get('/', async (c) => {
  const token = getCookie(c, 'session')
  
  // If already logged in with valid JWT, redirect to dashboard
  if (token) {
    const session = await verifyJWT(token)
    if (session) {
      return c.redirect('/dashboard')
    }
  }
  
  return c.html(getLoginPage())
})

// Explicit Login Page (for logout redirect)
app.get('/login', async (c) => {
  // Clear any existing session cookie to ensure fresh login
  setCookie(c, 'session', '', {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 0
  })
  
  return c.html(getLoginPage())
})

// Invitation Accept Page
app.get('/invite/:token', async (c) => {
  const token = c.req.param('token')
  return c.html(getInvitePage(token))
})

// Protected Dashboard/App Page (JWT-based session)
app.get('/dashboard', async (c) => {
  const token = getCookie(c, 'session')
  
  // Check if logged in with valid JWT
  if (!token) {
    return c.redirect('/')
  }
  
  const session = await verifyJWT(token)
  if (!session) {
    // Invalid or expired token
    deleteCookie(c, 'session')
    return c.redirect('/')
  }
  
  // Fetch organization name
  const db = c.env.DB
  const org = await db.prepare('SELECT name FROM organizations WHERE id = ?').bind(session.orgId).first() as { name: string } | null
  const orgName = org?.name || 'Organization'
  
  return c.html(getMainPage(session.name, orgName, session.orgId, session.role))
})

// Login Page HTML
function getLoginPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GRC Pulse - Enterprise Risk Management Platform</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%233b82f6'/%3E%3Cstop offset='100%25' stop-color='%238b5cf6'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M50 5L10 25V50C10 75 30 92 50 97C70 92 90 75 90 50V25L50 5Z' fill='url(%23g)'/%3E%3Cpath d='M20 52H35L42 38L50 65L58 42L65 52H80' stroke='white' stroke-width='5' stroke-linecap='round' fill='none'/%3E%3C/svg%3E">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    :root {
      --bg-primary: #0f172a;
      --bg-secondary: #1e293b;
      --bg-tertiary: #334155;
      --text-primary: #f8fafc;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --accent-blue: #3b82f6;
      --accent-green: #22c55e;
      --accent-yellow: #eab308;
      --accent-red: #ef4444;
      --accent-purple: #a855f7;
      --border-color: #334155;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: 'Inter', sans-serif; 
      background: var(--bg-primary); 
      color: var(--text-primary); 
      min-height: 100vh;
      overflow-x: hidden;
    }
    
    /* Animated background */
    .bg-animation {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: -1;
      background: 
        radial-gradient(circle at 20% 80%, rgba(59, 130, 246, 0.15) 0%, transparent 50%),
        radial-gradient(circle at 80% 20%, rgba(168, 85, 247, 0.15) 0%, transparent 50%),
        radial-gradient(circle at 50% 50%, rgba(34, 197, 94, 0.05) 0%, transparent 70%);
    }
    
    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 40px;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 100;
      background: rgba(15, 23, 42, 0.8);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--border-color);
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo-icon {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .logo-text {
      font-size: 20px;
      font-weight: 700;
      background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .nav-links {
      display: flex;
      gap: 30px;
    }
    .nav-links a {
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 14px;
      transition: color 0.2s;
    }
    .nav-links a:hover {
      color: var(--text-primary);
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
      text-decoration: none;
    }
    .btn-primary {
      background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
      color: white;
    }
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 30px rgba(59, 130, 246, 0.3);
    }
    .btn-secondary {
      background: var(--bg-tertiary);
      color: var(--text-primary);
      border: 1px solid var(--border-color);
    }
    
    /* Hero Section */
    .hero {
      min-height: 100vh;
      display: flex;
      align-items: center;
      padding: 120px 40px 80px;
    }
    .hero-content {
      max-width: 1400px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 60px;
      align-items: center;
    }
    .hero-text h1 {
      font-size: 56px;
      font-weight: 800;
      line-height: 1.1;
      margin-bottom: 24px;
    }
    .hero-text h1 span {
      background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .hero-text p {
      font-size: 18px;
      color: var(--text-secondary);
      line-height: 1.7;
      margin-bottom: 32px;
    }
    .hero-stats {
      display: flex;
      gap: 40px;
      margin-top: 40px;
    }
    .stat {
      text-align: center;
    }
    .stat-value {
      font-size: 36px;
      font-weight: 700;
      color: var(--accent-blue);
    }
    .stat-label {
      font-size: 12px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    /* Login Card */
    .login-card {
      background: var(--bg-secondary);
      border-radius: 16px;
      border: 1px solid var(--border-color);
      padding: 40px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }
    .login-card h2 {
      font-size: 24px;
      margin-bottom: 8px;
    }
    .login-card p {
      color: var(--text-muted);
      margin-bottom: 32px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    .form-label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      margin-bottom: 8px;
      color: var(--text-secondary);
    }
    .form-input {
      width: 100%;
      padding: 12px 16px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      color: var(--text-primary);
      font-size: 14px;
      transition: border-color 0.2s;
    }
    .form-input:focus {
      outline: none;
      border-color: var(--accent-blue);
    }
    .form-input::placeholder {
      color: var(--text-muted);
    }
    .login-btn {
      width: 100%;
      padding: 14px;
      font-size: 15px;
      margin-top: 8px;
    }
    .login-error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 8px;
      padding: 12px 16px;
      color: var(--accent-red);
      font-size: 13px;
      margin-bottom: 20px;
      display: none;
    }
    .login-error.show {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .demo-credentials {
      margin-top: 24px;
      padding: 16px;
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.2);
      border-radius: 8px;
    }
    .demo-credentials h4 {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--accent-blue);
      margin-bottom: 8px;
    }
    .demo-credentials p {
      font-size: 13px;
      color: var(--text-secondary);
      margin: 4px 0;
    }
    .demo-credentials code {
      background: var(--bg-tertiary);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
    }
    
    /* Features Section */
    .features {
      padding: 80px 40px;
      background: var(--bg-secondary);
    }
    .features-content {
      max-width: 1200px;
      margin: 0 auto;
    }
    .section-title {
      text-align: center;
      margin-bottom: 60px;
    }
    .section-title h2 {
      font-size: 36px;
      margin-bottom: 16px;
    }
    .section-title p {
      color: var(--text-secondary);
      font-size: 16px;
    }
    .features-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 30px;
    }
    .feature-card {
      background: var(--bg-primary);
      border-radius: 12px;
      padding: 30px;
      border: 1px solid var(--border-color);
      transition: transform 0.2s, border-color 0.2s;
    }
    .feature-card:hover {
      transform: translateY(-5px);
      border-color: var(--accent-blue);
    }
    .feature-icon {
      width: 50px;
      height: 50px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      margin-bottom: 20px;
    }
    .feature-icon.blue { background: rgba(59, 130, 246, 0.2); color: var(--accent-blue); }
    .feature-icon.purple { background: rgba(168, 85, 247, 0.2); color: var(--accent-purple); }
    .feature-icon.green { background: rgba(34, 197, 94, 0.2); color: var(--accent-green); }
    .feature-icon.red { background: rgba(239, 68, 68, 0.2); color: var(--accent-red); }
    .feature-icon.yellow { background: rgba(234, 179, 8, 0.2); color: var(--accent-yellow); }
    .feature-card h3 {
      font-size: 18px;
      margin-bottom: 12px;
    }
    .feature-card p {
      color: var(--text-secondary);
      font-size: 14px;
      line-height: 1.6;
    }
    
    /* Footer */
    .footer {
      padding: 40px;
      text-align: center;
      border-top: 1px solid var(--border-color);
    }
    .footer p {
      color: var(--text-muted);
      font-size: 13px;
    }
    
    /* Responsive */
    @media (max-width: 1024px) {
      .hero-content { grid-template-columns: 1fr; }
      .hero-text h1 { font-size: 40px; }
      .features-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 768px) {
      .header { padding: 15px 20px; }
      .nav-links { display: none; }
      .hero { padding: 100px 20px 60px; }
      .hero-text h1 { font-size: 32px; }
      .features-grid { grid-template-columns: 1fr; }
      .hero-stats { flex-wrap: wrap; gap: 20px; }
    }
  </style>
</head>
<body>
  <div class="bg-animation"></div>
  
  <header class="header">
    <div class="logo">
      <div class="logo-icon">
        <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Shield base -->
          <path d="M50 5L10 25V50C10 75 30 92 50 97C70 92 90 75 90 50V25L50 5Z" fill="url(#shieldGradient)" stroke="url(#strokeGradient)" stroke-width="3"/>
          <!-- Pulse line -->
          <path d="M20 52H35L42 38L50 65L58 42L65 52H80" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none">
            <animate attributeName="stroke-dasharray" values="0,200;200,0" dur="2s" repeatCount="indefinite"/>
          </path>
          <!-- Glow effect -->
          <circle cx="50" cy="52" r="8" fill="#ffffff" opacity="0.3">
            <animate attributeName="r" values="6;10;6" dur="1.5s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0.3;0.6;0.3" dur="1.5s" repeatCount="indefinite"/>
          </circle>
          <defs>
            <linearGradient id="shieldGradient" x1="10" y1="5" x2="90" y2="97" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#3b82f6"/>
              <stop offset="50%" stop-color="#8b5cf6"/>
              <stop offset="100%" stop-color="#6366f1"/>
            </linearGradient>
            <linearGradient id="strokeGradient" x1="10" y1="5" x2="90" y2="97" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#60a5fa"/>
              <stop offset="100%" stop-color="#a78bfa"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
      <span class="logo-text">GRC Pulse</span>
    </div>
    <nav class="nav-links">
      <a href="#features">Features</a>
      <a href="#about">About</a>
      <a href="#contact">Contact</a>
    </nav>
    <button class="btn btn-primary" onclick="document.getElementById('email').focus()">
      <i class="fas fa-sign-in-alt"></i> Sign In
    </button>
  </header>
  
  <section class="hero">
    <div class="hero-content">
      <div class="hero-text">
        <h1>The <span>Real-time Risk Pulse</span> for Modern Enterprises</h1>
        <p>
          Combat alert fatigue and break down organizational silos. GRC Pulse provides 
          context-aware risk prioritization that connects security findings to business impact, 
          helping CISOs make informed decisions faster.
        </p>
        <div class="hero-stats">
          <div class="stat">
            <div class="stat-value">85%</div>
            <div class="stat-label">Alert Reduction</div>
          </div>
          <div class="stat">
            <div class="stat-value">3x</div>
            <div class="stat-label">Faster Response</div>
          </div>
          <div class="stat">
            <div class="stat-value">$2.4M</div>
            <div class="stat-label">Avg. Risk Savings</div>
          </div>
        </div>
      </div>
      
      <div class="login-card">
        <h2>Welcome Back</h2>
        <p>Sign in to access your GRC dashboard</p>
        
        <div class="login-error" id="login-error">
          <i class="fas fa-exclamation-circle"></i>
          <span id="error-message">Invalid email or password</span>
        </div>
        
        <form id="login-form" onsubmit="handleLogin(event)">
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <input type="email" id="email" class="form-input" placeholder="you@company.com" required>
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <input type="password" id="password" class="form-input" placeholder="Enter your password" required>
          </div>
          <button type="submit" class="btn btn-primary login-btn" id="login-btn">
            <i class="fas fa-sign-in-alt"></i> Sign In
          </button>
        </form>
        
      </div>
    </div>
  </section>
  
  <section class="features" id="features">
    <div class="features-content">
      <div class="section-title">
        <h2>Enterprise-Grade Risk Management</h2>
        <p>Everything you need to manage governance, risk, and compliance in one platform</p>
      </div>
      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon blue"><i class="fas fa-brain"></i></div>
          <h3>Context-Aware Prioritization</h3>
          <p>Risk scores that consider business context, revenue impact, and regulatory requirements—not just CVSS numbers.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon purple"><i class="fas fa-project-diagram"></i></div>
          <h3>Interactive Risk Graph</h3>
          <p>Visualize relationships between assets, vendors, business processes, and risks in a dynamic force-directed graph.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon green"><i class="fas fa-chart-line"></i></div>
          <h3>Executive Dashboard</h3>
          <p>Real-time metrics on financial exposure, compliance health, and risk distribution for executive reporting.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon red"><i class="fas fa-shield-alt"></i></div>
          <h3>Vendor Risk Management</h3>
          <p>Track third-party risks, monitor incidents, and manage vendor dependencies with tiered assessments.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon yellow"><i class="fas fa-clipboard-check"></i></div>
          <h3>Compliance Tracking</h3>
          <p>Multi-framework support for SOC2, ISO27001, GDPR, PCI-DSS, and HIPAA with control effectiveness ratings.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon blue"><i class="fas fa-server"></i></div>
          <h3>Asset Inventory</h3>
          <p>Complete infrastructure visibility with data classification, cloud provider tracking, and dependency mapping.</p>
        </div>
      </div>
    </div>
  </section>
  
  <footer class="footer">
    <p>© 2024 GRC Pulse. Built for Enterprise CISOs.</p>
  </footer>
  
  <script>
    async function handleLogin(event) {
      event.preventDefault();
      
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const loginBtn = document.getElementById('login-btn');
      const errorDiv = document.getElementById('login-error');
      const errorMsg = document.getElementById('error-message');
      
      // Hide previous errors
      errorDiv.classList.remove('show');
      
      // Show loading state
      loginBtn.disabled = true;
      loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
      
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
          // Redirect to dashboard
          window.location.href = '/dashboard';
        } else {
          // Show error
          errorMsg.textContent = data.error || 'Authentication failed';
          errorDiv.classList.add('show');
        }
      } catch (error) {
        errorMsg.textContent = 'Network error. Please try again.';
        errorDiv.classList.add('show');
      } finally {
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
      }
    }
  </script>
</body>
</html>`
}

// Invitation Accept Page
function getInvitePage(token: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Accept Invitation - GRC Pulse</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%233b82f6'/%3E%3Cstop offset='100%25' stop-color='%238b5cf6'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M50 5L10 25V50C10 75 30 92 50 97C70 92 90 75 90 50V25L50 5Z' fill='url(%23g)'/%3E%3Cpath d='M20 52H35L42 38L50 65L58 42L65 52H80' stroke='white' stroke-width='5' stroke-linecap='round' fill='none'/%3E%3C/svg%3E">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    :root {
      --bg-primary: #0f172a;
      --bg-secondary: #1e293b;
      --bg-tertiary: #334155;
      --text-primary: #f8fafc;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --accent-blue: #3b82f6;
      --accent-green: #22c55e;
      --accent-yellow: #eab308;
      --accent-red: #ef4444;
      --accent-purple: #a855f7;
      --border-color: #334155;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: 'Inter', sans-serif; 
      background: var(--bg-primary); 
      color: var(--text-primary); 
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .bg-animation {
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      z-index: -1;
      background: 
        radial-gradient(circle at 20% 80%, rgba(59, 130, 246, 0.15) 0%, transparent 50%),
        radial-gradient(circle at 80% 20%, rgba(168, 85, 247, 0.15) 0%, transparent 50%);
    }
    .invite-container {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 40px;
      max-width: 460px;
      width: 100%;
      text-align: center;
    }
    .logo {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-bottom: 24px;
    }
    .logo-icon { width: 48px; height: 48px; }
    .logo-text {
      font-size: 24px;
      font-weight: 700;
      background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    h1 { font-size: 24px; margin-bottom: 8px; }
    .subtitle { color: var(--text-secondary); margin-bottom: 24px; }
    .welcome-box {
      background: var(--bg-tertiary);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
      text-align: left;
    }
    .welcome-box .label { font-size: 12px; color: var(--text-muted); margin-bottom: 4px; }
    .welcome-box .value { font-size: 16px; font-weight: 500; }
    .form-group { margin-bottom: 16px; text-align: left; }
    .form-label { display: block; font-size: 14px; color: var(--text-secondary); margin-bottom: 6px; }
    .form-input {
      width: 100%;
      padding: 12px 16px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      color: var(--text-primary);
      font-size: 14px;
      transition: border-color 0.2s;
    }
    .form-input:focus { outline: none; border-color: var(--accent-blue); }
    .password-strength {
      height: 4px;
      background: var(--bg-tertiary);
      border-radius: 2px;
      margin-top: 8px;
      overflow: hidden;
    }
    .password-strength .bar {
      height: 100%;
      width: 0%;
      background: var(--accent-red);
      transition: all 0.3s;
    }
    .password-strength .bar.medium { width: 50%; background: var(--accent-yellow); }
    .password-strength .bar.strong { width: 100%; background: var(--accent-green); }
    .btn {
      width: 100%;
      padding: 14px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s;
    }
    .btn-primary {
      background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
      color: white;
    }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4); }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
    .error-box {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid var(--accent-red);
      border-radius: 8px;
      padding: 16px;
      color: var(--accent-red);
      margin-bottom: 16px;
    }
    .success-box {
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid var(--accent-green);
      border-radius: 8px;
      padding: 20px;
    }
    .success-box h2 { color: var(--accent-green); margin-bottom: 8px; }
    .loading { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 40px; color: var(--text-muted); }
    .spinner { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .login-link { margin-top: 16px; }
    .login-link a { color: var(--accent-blue); text-decoration: none; }
    .login-link a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="bg-animation"></div>
  <div class="invite-container">
    <div class="logo">
      <svg class="logo-icon" viewBox="0 0 100 100">
        <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#8b5cf6"/></linearGradient></defs>
        <path d="M50 5L10 25V50C10 75 30 92 50 97C70 92 90 75 90 50V25L50 5Z" fill="url(#g)"/>
        <path d="M20 52H35L42 38L50 65L58 42L65 52H80" stroke="white" stroke-width="5" stroke-linecap="round" fill="none"/>
      </svg>
      <span class="logo-text">GRC Pulse</span>
    </div>
    
    <div id="content">
      <div class="loading">
        <i class="fas fa-spinner spinner"></i>
        <span>Validating invitation...</span>
      </div>
    </div>
  </div>
  
  <script>
    const token = '${token}';
    
    async function validateInvite() {
      try {
        const response = await fetch('/api/invite/' + token);
        const data = await response.json();
        
        if (data.valid) {
          showSetupForm(data);
        } else {
          showError(data.error || 'Invalid invitation');
        }
      } catch (error) {
        showError('Failed to validate invitation. Please try again.');
      }
    }
    
    function showError(message) {
      document.getElementById('content').innerHTML = 
        '<div class="error-box"><i class="fas fa-exclamation-circle"></i> ' + message + '</div>' +
        '<div class="login-link">Already have an account? <a href="/">Sign in</a></div>';
    }
    
    function showSetupForm(data) {
      document.getElementById('content').innerHTML = 
        '<h1><i class="fas fa-user-plus" style="margin-right: 8px; color: var(--accent-green);"></i>Welcome!</h1>' +
        '<p class="subtitle">You\\'ve been invited to join ' + data.organization + '</p>' +
        '<div class="welcome-box">' +
          '<div class="label">Your Email</div>' +
          '<div class="value">' + data.email + '</div>' +
        '</div>' +
        '<form onsubmit="return handleSubmit(event)">' +
          '<div class="form-group">' +
            '<label class="form-label">Create Password</label>' +
            '<input type="password" class="form-input" id="password" placeholder="At least 8 characters" oninput="checkStrength()" required minlength="8">' +
            '<div class="password-strength"><div class="bar" id="strength-bar"></div></div>' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label">Confirm Password</label>' +
            '<input type="password" class="form-input" id="confirm-password" placeholder="Re-enter password" required>' +
          '</div>' +
          '<div id="form-error"></div>' +
          '<button type="submit" class="btn btn-primary" id="submit-btn">' +
            '<i class="fas fa-check-circle"></i> Activate Account' +
          '</button>' +
        '</form>' +
        '<div class="login-link">Already activated? <a href="/">Sign in</a></div>';
    }
    
    function checkStrength() {
      const password = document.getElementById('password').value;
      const bar = document.getElementById('strength-bar');
      
      if (password.length >= 12 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) {
        bar.className = 'bar strong';
      } else if (password.length >= 8) {
        bar.className = 'bar medium';
      } else {
        bar.className = 'bar';
        bar.style.width = (password.length / 8 * 30) + '%';
      }
    }
    
    async function handleSubmit(e) {
      e.preventDefault();
      
      const password = document.getElementById('password').value;
      const confirm = document.getElementById('confirm-password').value;
      const errorDiv = document.getElementById('form-error');
      const submitBtn = document.getElementById('submit-btn');
      
      if (password !== confirm) {
        errorDiv.innerHTML = '<div class="error-box">Passwords do not match</div>';
        return false;
      }
      
      if (password.length < 8) {
        errorDiv.innerHTML = '<div class="error-box">Password must be at least 8 characters</div>';
        return false;
      }
      
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner spinner"></i> Activating...';
      
      try {
        const response = await fetch('/api/invite/' + token + '/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: password })
        });
        
        const data = await response.json();
        
        if (data.success) {
          document.getElementById('content').innerHTML = 
            '<div class="success-box">' +
              '<h2><i class="fas fa-check-circle"></i> Account Activated!</h2>' +
              '<p>Your account has been set up successfully.</p>' +
            '</div>' +
            '<a href="/" class="btn btn-primary" style="margin-top: 20px;"><i class="fas fa-sign-in-alt"></i> Sign In Now</a>';
        } else {
          errorDiv.innerHTML = '<div class="error-box">' + (data.error || 'Failed to activate account') + '</div>';
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Activate Account';
        }
      } catch (error) {
        errorDiv.innerHTML = '<div class="error-box">Network error. Please try again.</div>';
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Activate Account';
      }
      
      return false;
    }
    
    // Start validation on page load
    validateInvite();
  </script>
</body>
</html>`
}

// Import the main page HTML
function getMainPage(userName: string = 'User', orgName: string = 'Organization', orgId: string = '', userRole: string = 'viewer'): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GRC Pulse - Real-time Risk Intelligence</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%233b82f6'/%3E%3Cstop offset='100%25' stop-color='%238b5cf6'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M50 5L10 25V50C10 75 30 92 50 97C70 92 90 75 90 50V25L50 5Z' fill='url(%23g)'/%3E%3Cpath d='M20 52H35L42 38L50 65L58 42L65 52H80' stroke='white' stroke-width='5' stroke-linecap='round' fill='none'/%3E%3C/svg%3E">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    :root {
      --bg-primary: #0f172a;
      --bg-secondary: #1e293b;
      --bg-tertiary: #334155;
      --text-primary: #f8fafc;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --accent-blue: #3b82f6;
      --accent-green: #22c55e;
      --accent-yellow: #eab308;
      --accent-red: #ef4444;
      --accent-purple: #a855f7;
      --border-color: #334155;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: var(--bg-primary); color: var(--text-primary); min-height: 100vh; }
    .app-container { display: flex; min-height: 100vh; }
    .sidebar { width: 260px; background: var(--bg-secondary); border-right: 1px solid var(--border-color); padding: 20px 12px; display: flex; flex-direction: column; }
    .logo { display: flex; align-items: center; gap: 10px; padding: 0 8px 20px; border-bottom: 1px solid var(--border-color); margin-bottom: 20px; }
    .logo-icon { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; }
    .logo-text { font-size: 16px; font-weight: 700; background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .nav-section { margin-bottom: 20px; }
    .nav-section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); padding: 0 12px; margin-bottom: 6px; }
    .nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 6px; color: var(--text-secondary); cursor: pointer; transition: all 0.2s; font-size: 14px; }
    .nav-item:hover, .nav-item.active { background: var(--bg-tertiary); color: var(--text-primary); }
    .nav-item.active { background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(168, 85, 247, 0.2)); border: 1px solid rgba(59, 130, 246, 0.3); }
    .nav-item i { width: 18px; text-align: center; }
    .sidebar-footer { margin-top: auto; padding-top: 20px; border-top: 1px solid var(--border-color); }
    .user-info { display: flex; align-items: center; gap: 10px; padding: 10px 12px; margin-bottom: 10px; }
    .user-avatar { width: 32px; height: 32px; background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple)); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; }
    .user-name { font-size: 13px; font-weight: 500; }
    .user-role { font-size: 11px; color: var(--text-muted); }
    .logout-btn { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 6px; color: var(--text-muted); cursor: pointer; transition: all 0.2s; font-size: 13px; width: 100%; background: none; border: none; text-align: left; }
    .logout-btn:hover { background: rgba(239, 68, 68, 0.1); color: var(--accent-red); }
    .main-content { flex: 1; padding: 20px 24px; overflow-y: auto; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .page-title { font-size: 24px; font-weight: 700; }
    .page-subtitle { color: var(--text-secondary); margin-top: 2px; font-size: 14px; }
    .card { background: var(--bg-secondary); border-radius: 10px; border: 1px solid var(--border-color); padding: 20px; margin-bottom: 20px; }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .card-title { font-size: 15px; font-weight: 600; }
    .metrics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .metric-card { background: var(--bg-secondary); border-radius: 10px; border: 1px solid var(--border-color); padding: 16px; }
    .metric-value { font-size: 28px; font-weight: 700; }
    .metric-label { color: var(--text-secondary); font-size: 13px; margin-top: 2px; }
    .metric-icon { width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px; }
    .metric-icon.red { background: rgba(239, 68, 68, 0.2); color: var(--accent-red); }
    .metric-icon.yellow { background: rgba(234, 179, 8, 0.2); color: var(--accent-yellow); }
    .metric-icon.green { background: rgba(34, 197, 94, 0.2); color: var(--accent-green); }
    .metric-icon.purple { background: rgba(168, 85, 247, 0.2); color: var(--accent-purple); }
    .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; transition: all 0.2s; }
    .btn-primary { background: var(--accent-blue); color: white; }
    .btn-primary:hover { background: #2563eb; }
    .btn-secondary { background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); }
    .btn-success { background: var(--accent-green); color: white; }
    .btn-danger { background: var(--accent-red); color: white; }
    .badge { display: inline-flex; align-items: center; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; }
    .badge.critical { background: rgba(239, 68, 68, 0.2); color: var(--accent-red); }
    .badge.high { background: rgba(249, 115, 22, 0.2); color: #f97316; }
    .badge.medium { background: rgba(234, 179, 8, 0.2); color: var(--accent-yellow); }
    .badge.low { background: rgba(34, 197, 94, 0.2); color: var(--accent-green); }
    .badge.open { background: rgba(239, 68, 68, 0.2); color: var(--accent-red); }
    .badge.in_progress { background: rgba(59, 130, 246, 0.2); color: var(--accent-blue); }
    .badge.closed, .badge.mitigated { background: rgba(34, 197, 94, 0.2); color: var(--accent-green); }
    .table-responsive { overflow-x: auto; -webkit-overflow-scrolling: touch; margin: 0 -4px; padding: 0 4px; }
    table { width: 100%; border-collapse: collapse; min-width: 500px; }
    th { text-align: left; padding: 10px 12px; color: var(--text-secondary); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid var(--border-color); white-space: nowrap; }
    td { padding: 12px; border-bottom: 1px solid var(--border-color); font-size: 13px; }
    tr:hover { background: var(--bg-tertiary); }
    .form-group { margin-bottom: 16px; }
    .form-label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; color: var(--text-secondary); }
    .form-input, .form-select, .form-textarea { width: 100%; padding: 10px 12px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); font-size: 14px; }
    .form-input:focus, .form-select:focus, .form-textarea:focus { outline: none; border-color: var(--accent-blue); }
    .form-textarea { min-height: 100px; resize: vertical; }
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal { background: var(--bg-secondary); border-radius: 12px; width: 500px; max-width: 90%; max-height: 90vh; overflow-y: auto; }
    .modal-header { padding: 16px 20px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; }
    .modal-title { font-size: 16px; font-weight: 600; }
    .modal-close { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 18px; }
    .modal-body { padding: 20px; }
    .modal-footer { padding: 16px 20px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 10px; }
    .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
    .alert { padding: 12px 16px; border-radius: 6px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px; }
    .alert.success { background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); color: var(--accent-green); }
    .alert.error { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: var(--accent-red); }
    .alert.warning { background: rgba(234, 179, 8, 0.1); border: 1px solid rgba(234, 179, 8, 0.3); color: var(--accent-yellow); }
    .priority-bar { width: 60px; height: 6px; background: var(--bg-tertiary); border-radius: 3px; overflow: hidden; }
    .priority-bar-fill { height: 100%; border-radius: 3px; }
    .priority-bar-fill.critical { background: var(--accent-red); }
    .priority-bar-fill.high { background: #f97316; }
    .priority-bar-fill.medium { background: var(--accent-yellow); }
    .priority-bar-fill.low { background: var(--accent-green); }
    .loading { text-align: center; padding: 40px; color: var(--text-muted); }
    .empty-state { text-align: center; padding: 40px; color: var(--text-muted); }
    .page { display: none; }
    .page.active { display: block; }
    
    /* Top Header Bar - Global Navigation */
    .top-header {
      height: 56px;
      background: linear-gradient(135deg, var(--bg-secondary), #1a2744);
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .top-header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .org-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(168, 85, 247, 0.15));
      border: 1px solid rgba(59, 130, 246, 0.3);
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary);
    }
    .org-badge i {
      color: var(--accent-purple);
      font-size: 12px;
    }
    .top-header-center {
      flex: 1;
      display: flex;
      justify-content: center;
      max-width: 400px;
      margin: 0 24px;
    }
    .global-search {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 16px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      transition: all 0.2s;
    }
    .global-search:focus-within {
      border-color: var(--accent-blue);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
    .global-search i { color: var(--text-muted); font-size: 14px; }
    .global-search input {
      flex: 1;
      background: none;
      border: none;
      outline: none;
      color: var(--text-primary);
      font-size: 14px;
    }
    .global-search input::placeholder { color: var(--text-muted); }
    .search-shortcut {
      font-size: 11px;
      padding: 2px 6px;
      background: var(--bg-primary);
      border-radius: 4px;
      color: var(--text-muted);
    }
    .top-header-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .header-icon-btn {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      background: none;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.2s;
      position: relative;
    }
    .header-icon-btn:hover {
      background: var(--bg-tertiary);
      color: var(--text-primary);
    }
    .header-icon-btn .badge {
      position: absolute;
      top: 6px;
      right: 6px;
      width: 18px;
      height: 18px;
      background: var(--accent-red);
      color: white;
      font-size: 10px;
      font-weight: 600;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .user-menu-simple {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 12px 6px 6px;
      background: var(--bg-tertiary);
      border-radius: 8px;
      margin-left: 8px;
    }
    .user-menu-avatar {
      width: 28px;
      height: 28px;
      background: linear-gradient(135deg, var(--accent-green), #059669);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
      color: white;
    }
    .user-menu-name {
      font-size: 13px;
      font-weight: 500;
    }
    .main-wrapper {
      display: flex;
      flex: 1;
      overflow: hidden;
    }
    
    /* Mobile Menu Toggle Button */
    .mobile-menu-toggle {
      display: none;
      background: none;
      border: none;
      color: var(--text-primary);
      font-size: 20px;
      cursor: pointer;
      padding: 8px;
      border-radius: 6px;
    }
    .mobile-menu-toggle:hover {
      background: var(--bg-tertiary);
    }
    
    /* Sidebar Overlay for Mobile */
    .sidebar-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 199;
    }
    .sidebar-overlay.active {
      display: block;
    }
    
    /* ============================================
       RESPONSIVE STYLES - TABLET (1024px)
       ============================================ */
    @media (max-width: 1024px) {
      .metrics-grid {
        grid-template-columns: repeat(2, 1fr) !important;
      }
      .grid-2 {
        grid-template-columns: 1fr !important;
      }
      .sidebar {
        width: 220px;
      }
      .main-content {
        padding: 16px;
      }
      .global-search {
        width: 280px;
      }
      .top-header {
        padding: 0 16px;
      }
    }
    
    /* ============================================
       RESPONSIVE STYLES - MOBILE (768px)
       ============================================ */
    @media (max-width: 768px) {
      /* Show mobile menu button */
      .mobile-menu-toggle {
        display: block;
      }
      
      /* Hide sidebar by default on mobile */
      .sidebar {
        position: fixed;
        top: 56px;
        left: 0;
        bottom: 0;
        width: 280px;
        z-index: 200;
        transform: translateX(-100%);
        transition: transform 0.3s ease;
        padding-top: 10px;
      }
      .sidebar.open {
        transform: translateX(0);
      }
      
      /* Top header adjustments */
      .top-header {
        padding: 0 12px;
      }
      .top-header-center {
        display: none;
      }
      .org-badge span {
        display: none;
      }
      .org-badge {
        padding: 8px;
      }
      .user-menu-name {
        display: none;
      }
      
      /* Main content full width */
      .main-content {
        padding: 12px;
        width: 100%;
      }
      
      /* Page header stack */
      .page-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
      }
      .page-header-actions {
        width: 100%;
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      
      /* Metrics grid - 2 columns on tablet, 1 on small mobile */
      .metrics-grid {
        grid-template-columns: repeat(2, 1fr) !important;
        gap: 12px !important;
      }
      
      /* Cards padding */
      .card {
        padding: 14px;
      }
      
      /* Tables - horizontal scroll */
      .table-container {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }
      table {
        min-width: 600px;
      }
      
      /* Buttons smaller */
      .btn {
        padding: 8px 12px;
        font-size: 12px;
      }
      .btn-sm {
        padding: 6px 10px;
        font-size: 11px;
      }
      
      /* Modal full width on mobile */
      .modal {
        width: 95%;
        max-width: none;
        margin: 10px;
        max-height: calc(100vh - 20px);
      }
      .modal-body {
        padding: 16px;
      }
      
      /* Page title smaller */
      .page-title {
        font-size: 20px;
      }
      .page-subtitle {
        font-size: 12px;
      }
      
      /* Metric cards */
      .metric-card {
        padding: 12px;
      }
      .metric-value {
        font-size: 22px;
      }
      .metric-label {
        font-size: 11px;
      }
      .metric-icon {
        width: 32px;
        height: 32px;
        font-size: 14px;
      }
      
      /* Grid layouts single column */
      .grid-2, .grid-3, .grid-4 {
        grid-template-columns: 1fr !important;
      }
      
      /* Form inputs */
      .form-input, .form-select {
        padding: 10px;
        font-size: 16px; /* Prevent zoom on iOS */
      }
      
      /* Alert smaller */
      .alert {
        padding: 10px 12px;
        font-size: 13px;
      }
      
      /* Badge smaller */
      .badge {
        padding: 2px 6px;
        font-size: 10px;
      }
      
      /* Nav items more touch-friendly */
      .nav-item {
        padding: 12px 14px;
        font-size: 14px;
      }
      
      /* User info in sidebar */
      .user-info {
        padding: 12px;
      }
      
      /* Hide notification badge number on small screens */
      .header-icon-btn .badge {
        width: 8px;
        height: 8px;
        padding: 0;
        font-size: 0;
        min-width: unset;
      }
    }
    
    /* ============================================
       RESPONSIVE STYLES - SMALL MOBILE (480px)
       ============================================ */
    @media (max-width: 480px) {
      /* Single column metrics */
      .metrics-grid {
        grid-template-columns: 1fr !important;
      }
      
      /* Even smaller padding */
      .main-content {
        padding: 10px;
      }
      .card {
        padding: 12px;
        border-radius: 8px;
      }
      
      /* Page title even smaller */
      .page-title {
        font-size: 18px;
      }
      
      /* Metric values smaller */
      .metric-value {
        font-size: 20px;
      }
      
      /* Top header minimal */
      .top-header {
        height: 50px;
        padding: 0 10px;
      }
      .header-icon-btn {
        width: 36px;
        height: 36px;
      }
      
      /* Buttons stack vertically */
      .page-header-actions {
        flex-direction: column;
      }
      .page-header-actions .btn {
        width: 100%;
        justify-content: center;
      }
      
      /* Table font smaller */
      table {
        font-size: 12px;
      }
      th, td {
        padding: 8px 10px;
      }
      
      /* Logo smaller */
      .logo-icon {
        width: 30px;
        height: 30px;
      }
      .logo-text {
        font-size: 14px;
      }
    }
    
    /* ============================================
       TOUCH DEVICE OPTIMIZATIONS
       ============================================ */
    @media (hover: none) and (pointer: coarse) {
      /* Larger touch targets */
      .btn {
        min-height: 44px;
        min-width: 44px;
      }
      .nav-item {
        min-height: 44px;
      }
      .header-icon-btn {
        min-width: 44px;
        min-height: 44px;
      }
      
      /* Remove hover effects on touch */
      .nav-item:hover {
        background: transparent;
      }
      .nav-item.active:hover {
        background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(168, 85, 247, 0.2));
      }
      .btn:hover {
        transform: none;
      }
    }
    
    /* Print styles */
    @media print {
      .sidebar, .top-header, .mobile-menu-toggle {
        display: none !important;
      }
      .main-content {
        padding: 0;
        margin: 0;
      }
    }
  </style>
</head>
<body>
  <div class="app-container" style="flex-direction: column;">
    <!-- Sidebar Overlay for Mobile -->
    <div class="sidebar-overlay" id="sidebar-overlay" onclick="toggleMobileMenu()"></div>
    
    <!-- Top Header Bar - Simplified -->
    <header class="top-header">
      <div class="top-header-left">
        <button class="mobile-menu-toggle" onclick="toggleMobileMenu()" aria-label="Toggle menu">
          <i class="fas fa-bars" id="menu-icon"></i>
        </button>
        <div class="org-badge">
          <i class="fas fa-building"></i>
          <span>${orgName}</span>
        </div>
      </div>
      
      <div class="top-header-center">
        <div class="global-search">
          <i class="fas fa-search"></i>
          <input type="text" placeholder="Search risks, assets, controls..." id="global-search-input" onkeyup="handleGlobalSearch(event)">
          <span class="search-shortcut">⌘K</span>
        </div>
      </div>
      
      <div class="top-header-right">
        <button class="header-icon-btn" onclick="showAlert('Help & Documentation coming soon!', 'info')" title="Help">
          <i class="fas fa-question-circle"></i>
        </button>
        <button class="header-icon-btn" onclick="showNotifications()" title="Notifications">
          <i class="fas fa-bell"></i>
          <span class="badge" id="notification-badge" style="display:none;">0</span>
        </button>
        <div class="user-menu-simple">
          <div class="user-menu-avatar">${userName.charAt(0).toUpperCase()}</div>
          <span class="user-menu-name">${userName}</span>
        </div>
      </div>
    </header>
    
    <div class="main-wrapper">
    <nav class="sidebar">
      <div class="logo">
        <div class="logo-icon">
          <svg width="32" height="32" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Shield base -->
            <path d="M50 5L10 25V50C10 75 30 92 50 97C70 92 90 75 90 50V25L50 5Z" fill="url(#shieldGradient2)" stroke="url(#strokeGradient2)" stroke-width="3"/>
            <!-- Pulse line -->
            <path d="M20 52H35L42 38L50 65L58 42L65 52H80" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none">
              <animate attributeName="stroke-dasharray" values="0,200;200,0" dur="2s" repeatCount="indefinite"/>
            </path>
            <!-- Glow effect -->
            <circle cx="50" cy="52" r="8" fill="#ffffff" opacity="0.3">
              <animate attributeName="r" values="6;10;6" dur="1.5s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.3;0.6;0.3" dur="1.5s" repeatCount="indefinite"/>
            </circle>
            <defs>
              <linearGradient id="shieldGradient2" x1="10" y1="5" x2="90" y2="97" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#3b82f6"/>
                <stop offset="50%" stop-color="#8b5cf6"/>
                <stop offset="100%" stop-color="#6366f1"/>
              </linearGradient>
              <linearGradient id="strokeGradient2" x1="10" y1="5" x2="90" y2="97" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#60a5fa"/>
                <stop offset="100%" stop-color="#a78bfa"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div class="logo-text">GRC Pulse</div>
      </div>
      <!-- Dynamic menu based on role -->
      <div id="sidebar-menu"></div>
      <div class="sidebar-footer">
        <div class="user-info">
          <div class="user-avatar">${userName.charAt(0).toUpperCase()}</div>
          <div>
            <div class="user-name">${userName}</div>
            <div class="user-role" id="user-role-display">Loading...</div>
          </div>
        </div>
        <button class="logout-btn" onclick="handleLogout()">
          <i class="fas fa-sign-out-alt"></i>
          <span>Sign Out</span>
        </button>
      </div>
    </nav>
    <main class="main-content">
      <div class="page-header">
        <div>
          <h1 class="page-title" id="page-title">Dashboard</h1>
          <p class="page-subtitle" id="page-subtitle">Real-time risk overview</p>
        </div>
        <div id="page-actions"></div>
      </div>
      <div id="alert-container"></div>
      <div id="super-admin-page" class="page"></div>
      <div id="dashboard-page" class="page active"></div>
      <div id="action-items-page" class="page"></div>
      <div id="executive-summary-page" class="page"></div>
      <div id="risks-page" class="page"></div>
      <div id="risk-mitigation-page" class="page"></div>
      <div id="assets-page" class="page"></div>
      <div id="vendors-page" class="page"></div>
      <div id="compliance-page" class="page"></div>
      <div id="gap-assessment-page" class="page"></div>
      <div id="org-settings-page" class="page"></div>
      <div id="controls-page" class="page"></div>
      <div id="graph-page" class="page"></div>
      <div id="maturity-page" class="page"></div>
      <div id="ai-page" class="page"></div>
      <div id="audit-dashboard-page" class="page"></div>
      <div id="audit-programs-page" class="page"></div>
      <div id="audit-engagements-page" class="page"></div>
      <div id="audit-findings-page" class="page"></div>
      <div id="org-admin-page" class="page"></div>
    </main>
    </div><!-- End main-wrapper -->
  </div>
  <div id="modal-container"></div>

  <script>
    // State
    let currentPage = 'dashboard';
    let mobileMenuOpen = false;
    const userRole = '${userRole}';
    const orgId = '${orgId}';
    const orgName = '${orgName}';
    console.log('User Role:', userRole, 'Org:', orgName, orgId); // Debug
    
    // Mobile Menu Toggle
    function toggleMobileMenu() {
      mobileMenuOpen = !mobileMenuOpen;
      const sidebar = document.querySelector('.sidebar');
      const overlay = document.getElementById('sidebar-overlay');
      const menuIcon = document.getElementById('menu-icon');
      
      if (mobileMenuOpen) {
        sidebar.classList.add('open');
        overlay.classList.add('active');
        menuIcon.classList.remove('fa-bars');
        menuIcon.classList.add('fa-times');
      } else {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
        menuIcon.classList.remove('fa-times');
        menuIcon.classList.add('fa-bars');
      }
    }
    
    // Close mobile menu when navigating
    function closeMobileMenu() {
      if (mobileMenuOpen) {
        toggleMobileMenu();
      }
    }
    
    // Close mobile menu on window resize (if going to desktop)
    window.addEventListener('resize', function() {
      if (window.innerWidth > 768 && mobileMenuOpen) {
        closeMobileMenu();
      }
    });
    
    // Role-based menu permissions
    // Roles: org_admin, ciso, executive, grc_manager, auditor, pentester, viewer
    // 
    // Role Definitions:
    // - org_admin: Full system access + user management
    // - ciso: Full security oversight, all modules
    // - executive: High-level dashboards and reports only (read-only)
    // - grc_manager: Day-to-day GRC operations (risks, assets, vendors, compliance)
    // - auditor: Audit-focused (audit modules + compliance read-only for verification)
    // - pentester: PentestPulse only (no GRC access)
    // - viewer: Read-only dashboard access
    //
    const rolePermissions = {
      // Super Admin - Platform management (all orgs)
      'super-admin': ['super_admin'],
      
      // Overview - executives and above see dashboards; operational roles
      // (analyst, security_lead) and read-only vendor also land here.
      'dashboard': ['super_admin', 'org_admin', 'ciso', 'executive', 'grc_manager', 'security_lead', 'analyst', 'viewer', 'vendor'],
      // My Action Items - remediation work list for roles that can own/oversee tasks
      // (excludes read-only 'viewer' and PentestPulse-only 'pentester')
      'action-items': ['super_admin', 'org_admin', 'ciso', 'executive', 'grc_manager', 'security_lead', 'auditor', 'analyst'],
      'executive-summary': ['super_admin', 'org_admin', 'ciso', 'executive', 'grc_manager'],
      
      // Risk Management - GRC managers + operational roles handle day-to-day risks
      'risks': ['super_admin', 'org_admin', 'ciso', 'grc_manager', 'security_lead', 'analyst'],
      'risk-mitigation': ['super_admin', 'org_admin', 'ciso', 'grc_manager', 'security_lead', 'analyst'],
      
      // Asset & Vendor Management - GRC managers only
      'assets': ['super_admin', 'org_admin', 'ciso', 'grc_manager'],
      'vendors': ['super_admin', 'org_admin', 'ciso', 'grc_manager'],
      
      // Compliance - auditors can VIEW for verification; operational roles remediate
      'compliance': ['super_admin', 'org_admin', 'ciso', 'grc_manager', 'auditor', 'security_lead', 'analyst'],
      'gap-assessment': ['super_admin', 'org_admin', 'ciso', 'grc_manager', 'auditor', 'security_lead', 'analyst'],
      'controls': ['super_admin', 'org_admin', 'ciso', 'grc_manager', 'auditor', 'security_lead', 'analyst'],
      
      // Organization Settings - admins only. The page fetches
      // /api/organization/* which is restricted to super_admin/org_admin, so
      // the page list must match the API or ciso/grc_manager get a broken
      // (403) page.
      'org-settings': ['super_admin', 'org_admin'],
      
      // Audit Management - auditors primary workspace
      'audit-dashboard': ['super_admin', 'org_admin', 'ciso', 'auditor'],
      'audit-programs': ['super_admin', 'org_admin', 'ciso', 'auditor'],
      'audit-engagements': ['super_admin', 'org_admin', 'ciso', 'auditor'],
      'audit-findings': ['super_admin', 'org_admin', 'ciso', 'auditor'],
      
      // AutoAudit AI Tools - policy gen, gap analysis, consultant
      'autoaudit': ['super_admin', 'org_admin', 'ciso', 'grc_manager', 'auditor'],
      
      // Intelligence - strategic roles only
      'graph': ['super_admin', 'org_admin', 'ciso', 'grc_manager'],
      'maturity': ['super_admin', 'org_admin', 'ciso', 'grc_manager'],
      'ai': ['super_admin', 'org_admin', 'ciso', 'grc_manager'],
      
      // Administration - admin only
      'org-admin': ['super_admin', 'org_admin'],
      
      // PentestPulse - pentesters and security leadership
      'pentest-pulse': ['super_admin', 'org_admin', 'ciso', 'pentester']
    };
    
    function hasAccess(page) {
      const allowedRoles = rolePermissions[page];
      return allowedRoles && allowedRoles.includes(userRole);
    }
    
    function getRoleLabel(role) {
      const labels = {
        'super_admin': 'Super Admin',
        'org_admin': 'Admin',
        'ciso': 'CISO',
        'executive': 'Executive',
        'grc_manager': 'GRC Manager',
        'auditor': 'Auditor',
        'pentester': 'Pentester',
        'viewer': 'Viewer'
      };
      return labels[role] || role;
    }
    
    function buildSidebarMenu() {
      let html = '';
      
      // Super Admin section - Platform management (only for super_admin)
      if (hasAccess('super-admin')) {
        html += '<div class="nav-section"><div class="nav-section-title" style="color: #f59e0b;">⚡ Platform Admin</div>';
        html += '<div class="nav-item" onclick="navigate(\\'super-admin\\')" style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(249, 115, 22, 0.1)); border-left: 3px solid #f59e0b;"><i class="fas fa-crown" style="color: #f59e0b;"></i><span>Super Admin</span></div>';
        html += '</div>';
      }
      
      // Overview section - for GRC users
      if (hasAccess('dashboard') || hasAccess('executive-summary') || hasAccess('action-items')) {
        html += '<div class="nav-section"><div class="nav-section-title">Overview</div>';
        if (hasAccess('dashboard')) html += '<div class="nav-item active" onclick="navigate(\\'dashboard\\')"><i class="fas fa-th-large"></i><span>Dashboard</span></div>';
        if (hasAccess('action-items')) html += '<div class="nav-item" onclick="navigate(\\'action-items\\')"><i class="fas fa-clipboard-check"></i><span>My Action Items</span><span id="action-items-badge" style="display:none; font-size: 9px; background: var(--accent-red); color: white; padding: 2px 6px; border-radius: 10px; margin-left: auto;">0</span></div>';
        if (hasAccess('executive-summary')) html += '<div class="nav-item" onclick="navigate(\\'executive-summary\\')"><i class="fas fa-chart-pie"></i><span>Executive Summary</span></div>';
        html += '</div>';
      }
      
      // Risk Management section
      if (hasAccess('risks') || hasAccess('risk-mitigation') || hasAccess('assets')) {
        html += '<div class="nav-section"><div class="nav-section-title">Risk Management</div>';
        if (hasAccess('risks')) html += '<div class="nav-item" onclick="navigate(\\'risks\\')"><i class="fas fa-exclamation-triangle"></i><span>Risk Register</span></div>';
        if (hasAccess('risk-mitigation')) html += '<div class="nav-item" onclick="navigate(\\'risk-mitigation\\')"><i class="fas fa-shield-virus"></i><span>Risk Mitigation</span></div>';
        if (hasAccess('assets')) html += '<div class="nav-item" onclick="navigate(\\'assets\\')"><i class="fas fa-server"></i><span>Assets</span></div>';
        html += '</div>';
      }
      
      // Supply Chain section
      if (hasAccess('vendors')) {
        html += '<div class="nav-section"><div class="nav-section-title">Supply Chain</div>';
        html += '<div class="nav-item" onclick="navigate(\\'vendors\\')"><i class="fas fa-building"></i><span>Vendors</span></div>';
        html += '</div>';
      }
      
      // Compliance section
      if (hasAccess('compliance') || hasAccess('gap-assessment') || hasAccess('org-settings') || hasAccess('controls')) {
        html += '<div class="nav-section"><div class="nav-section-title">Compliance</div>';
        if (hasAccess('compliance')) html += '<div class="nav-item" onclick="navigate(\\'compliance\\')"><i class="fas fa-clipboard-check"></i><span>Compliance Dashboard</span></div>';
        if (hasAccess('gap-assessment')) html += '<div class="nav-item" onclick="navigate(\\'gap-assessment\\')"><i class="fas fa-tasks"></i><span>Gap Assessment</span></div>';
        if (hasAccess('org-settings')) html += '<div class="nav-item" onclick="navigate(\\'org-settings\\')"><i class="fas fa-cog"></i><span>Organization Settings</span></div>';
        if (hasAccess('controls')) html += '<div class="nav-item" onclick="navigate(\\'controls\\')"><i class="fas fa-shield-alt"></i><span>Controls</span></div>';
        html += '</div>';
      }
      
      // Audit Management section
      if (hasAccess('audit-dashboard') || hasAccess('audit-programs') || hasAccess('audit-engagements') || hasAccess('audit-findings')) {
        html += '<div class="nav-section"><div class="nav-section-title">Audit Management</div>';
        if (hasAccess('audit-dashboard')) html += '<div class="nav-item" onclick="navigate(\\'audit-dashboard\\')"><i class="fas fa-clipboard-list"></i><span>Audit Dashboard</span></div>';
        if (hasAccess('audit-programs')) html += '<div class="nav-item" onclick="navigate(\\'audit-programs\\')"><i class="fas fa-calendar-alt"></i><span>Audit Programs</span></div>';
        if (hasAccess('audit-engagements')) html += '<div class="nav-item" onclick="navigate(\\'audit-engagements\\')"><i class="fas fa-briefcase"></i><span>Engagements</span></div>';
        if (hasAccess('audit-findings')) html += '<div class="nav-item" onclick="navigate(\\'audit-findings\\')"><i class="fas fa-search"></i><span>Findings</span></div>';
        html += '</div>';
      }
      
      // AutoAudit AI Tools section - Policy Gen, Gap Analysis, AI Consultant (opens in new tab with org context)
      if (hasAccess('autoaudit')) {
        html += '<div class="nav-section"><div class="nav-section-title">AI Tools</div>';
        html += '<a href="javascript:openAutoAudit()" class="nav-item" style="text-decoration: none; background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1)); border-left: 3px solid #8b5cf6;"><i class="fas fa-magic" style="color: #8b5cf6;"></i><span>AutoAudit</span><span style="font-size: 9px; background: linear-gradient(135deg, #6366f1, #a855f7); color: white; padding: 2px 6px; border-radius: 10px; margin-left: auto;"><i class="fas fa-external-link-alt" style="font-size: 8px;"></i></span></a>';
        html += '</div>';
      }
      
      // Intelligence section
      if (hasAccess('graph') || hasAccess('maturity') || hasAccess('ai')) {
        html += '<div class="nav-section"><div class="nav-section-title">Intelligence</div>';
        if (hasAccess('graph')) html += '<div class="nav-item" onclick="navigate(\\'graph\\')"><i class="fas fa-project-diagram"></i><span>Risk Graph</span></div>';
        if (hasAccess('maturity')) html += '<div class="nav-item" onclick="navigate(\\'maturity\\')"><i class="fas fa-chart-radar"></i><span>Maturity Assessment</span></div>';
        if (hasAccess('ai')) html += '<div class="nav-item" onclick="navigate(\\'ai\\')"><i class="fas fa-robot"></i><span>AI Co-pilot</span><span style="font-size: 9px; background: var(--accent-green); color: white; padding: 2px 6px; border-radius: 10px; margin-left: auto;">FREE</span></div>';
        html += '</div>';
      }
      
      // Offensive Security section - for pentesters
      if (hasAccess('pentest-pulse')) {
        html += '<div class="nav-section"><div class="nav-section-title">Offensive Security</div>';
        html += '<a href="https://pentest-pulse.pages.dev" target="_blank" class="nav-item" style="text-decoration: none;">';
        html += '<i class="fas fa-crosshairs"></i><span>Pentest Pulse</span>';
        html += '<span style="font-size: 9px; background: linear-gradient(135deg, #1b365d, #4a90e2); color: white; padding: 2px 6px; border-radius: 10px; margin-left: auto;"><i class="fas fa-external-link-alt" style="font-size: 8px;"></i></span>';
        html += '</a></div>';
      }
      
      // Administration section - admin only
      if (hasAccess('org-admin')) {
        html += '<div class="nav-section"><div class="nav-section-title">Administration</div>';
        html += '<div class="nav-item" onclick="navigate(\\'org-admin\\')"><i class="fas fa-users-cog"></i><span>Org Admin</span><span style="font-size: 9px; background: var(--accent-blue); color: white; padding: 2px 6px; border-radius: 10px; margin-left: auto;">NEW</span></div>';
        html += '</div>';
      }
      
      document.getElementById('sidebar-menu').innerHTML = html;
      document.getElementById('user-role-display').textContent = getRoleLabel(userRole);
    }
    
    // Build menu on page load
    document.addEventListener('DOMContentLoaded', function() {
      buildSidebarMenu();
      
      // For pentester role, show pentester landing page instead of GRC dashboard
      if (userRole === 'pentester') {
        loadPentesterLanding();
      } else {
        // Normal dashboard load for other roles
        loadDashboard();
        // Prime the "My Action Items" sidebar badge with overdue count
        if (hasAccess('action-items')) primeActionItemsBadge();
      }
    });
    
    // Pentester Landing Page
    function loadPentesterLanding() {
      const content = document.getElementById('dashboard-page');
      content.innerHTML = '<div style="padding: 32px; max-width: 800px; margin: 0 auto;">' +
        '<div style="text-align: center; padding: 60px 20px;">' +
          '<div style="width: 120px; height: 120px; background: linear-gradient(135deg, #1b365d, #4a90e2); border-radius: 24px; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;">' +
            '<i class="fas fa-crosshairs" style="font-size: 48px; color: white;"></i>' +
          '</div>' +
          '<h1 style="font-size: 28px; font-weight: 700; margin-bottom: 12px; color: var(--text-primary);">Welcome, Pentester!</h1>' +
          '<p style="font-size: 16px; color: var(--text-secondary); margin-bottom: 32px; max-width: 500px; margin-left: auto; margin-right: auto;">' +
            'As a penetration testing specialist, your workspace is in PentestPulse. Click the button below to access your projects, findings, and reports.' +
          '</p>' +
          '<a href="https://pentest-pulse.pages.dev" target="_blank" style="display: inline-flex; align-items: center; gap: 8px; padding: 14px 28px; background: linear-gradient(135deg, #1b365d, #4a90e2); color: white; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px; transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform=\\'scale(1.02)\\'; this.style.boxShadow=\\'0 8px 20px rgba(74, 144, 226, 0.3)\\';" onmouseout="this.style.transform=\\'scale(1)\\'; this.style.boxShadow=\\'none\\';">' +
            '<i class="fas fa-external-link-alt"></i>' +
            'Open PentestPulse' +
          '</a>' +
        '</div>' +
        '<div style="background: var(--bg-secondary); border-radius: 16px; padding: 24px; margin-top: 32px;">' +
          '<h3 style="font-size: 16px; font-weight: 600; margin-bottom: 16px; color: var(--text-primary);">Your Role Permissions</h3>' +
          '<div style="display: grid; gap: 12px;">' +
            '<div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-tertiary); border-radius: 8px;">' +
              '<i class="fas fa-check-circle" style="color: var(--accent-green);"></i>' +
              '<span>Access to PentestPulse - Penetration Testing Platform</span>' +
            '</div>' +
            '<div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-tertiary); border-radius: 8px;">' +
              '<i class="fas fa-check-circle" style="color: var(--accent-green);"></i>' +
              '<span>Manage pentest projects and vulnerabilities</span>' +
            '</div>' +
            '<div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-tertiary); border-radius: 8px;">' +
              '<i class="fas fa-check-circle" style="color: var(--accent-green);"></i>' +
              '<span>Import scanner results and generate reports</span>' +
            '</div>' +
            '<div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-tertiary); border-radius: 8px; opacity: 0.5;">' +
              '<i class="fas fa-times-circle" style="color: var(--accent-red);"></i>' +
              '<span style="color: var(--text-muted);">GRC modules (Risk, Compliance, Audit) - Not included in your role</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
      
      // Show this page as active
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      content.classList.add('active');
    }
    
    // Global search handler
    function handleGlobalSearch(event) {
      if (event.key === 'Enter') {
        const query = event.target.value.trim();
        if (query) {
          showAlert('Searching for: ' + query + '... (Search feature coming soon!)', 'info');
          // TODO: Implement global search
        }
      }
    }
    
    // Keyboard shortcut for search (Cmd+K or Ctrl+K)
    document.addEventListener('keydown', function(event) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        document.getElementById('global-search-input').focus();
      }
    });
    
    // Show notifications panel - fetches real data from API
    async function showNotifications() {
      // Show loading state
      document.getElementById('modal-container').innerHTML = '<div class="modal-overlay" onclick="closeModal(event)"><div class="modal" style="max-width:400px;" onclick="event.stopPropagation()"><div style="padding:32px;text-align:center;"><i class="fas fa-spinner fa-spin" style="font-size:24px;color:var(--accent-blue);"></i><p style="margin-top:12px;color:var(--text-muted);">Loading notifications...</p></div></div></div>';
      
      try {
        const data = await api('/notifications');
        const notifications = data.notifications || [];
        
        let html = '<div style="padding:16px;"><h3 style="margin-bottom:16px;font-size:16px;font-weight:600;">Notifications</h3>';
        
        if (notifications.length === 0) {
          html += '<div style="text-align:center;padding:24px;color:var(--text-muted);"><i class="fas fa-bell-slash" style="font-size:32px;margin-bottom:12px;opacity:0.5;"></i><p>No notifications</p></div>';
        } else {
          notifications.forEach(n => {
            const icons = {
              'risk': 'exclamation-triangle',
              'audit': 'clipboard-check',
              'compliance': 'chart-line',
              'vendor': 'building',
              'control': 'shield-alt',
              'action-items': 'user-clock',
              'success': 'check-circle'
            };
            const colors = {
              'critical': 'var(--accent-red)',
              'warning': 'var(--accent-yellow)',
              'success': 'var(--accent-green)',
              'info': 'var(--accent-blue)'
            };
            const icon = icons[n.type] || 'bell';
            const color = colors[n.severity] || 'var(--accent-blue)';
            
            html += '<div style="display:flex;gap:12px;padding:12px;border-radius:8px;background:var(--bg-tertiary);margin-bottom:8px;cursor:pointer;" onclick="navigateToLink(\\'' + (n.link || '#') + '\\')">';
            html += '<i class="fas fa-' + icon + '" style="color:' + color + ';font-size:16px;margin-top:2px;"></i>';
            html += '<div style="flex:1;"><div style="font-weight:500;font-size:14px;">' + n.title + '</div>';
            html += '<div style="font-size:12px;color:var(--text-muted);">' + n.message + '</div></div>';
            html += '<div style="font-size:11px;color:var(--text-muted);white-space:nowrap;">' + n.time + '</div></div>';
          });
        }
        
        html += '<button class="btn btn-primary" style="width:100%;margin-top:8px;" onclick="closeModal()">Close</button></div>';
        
        document.getElementById('modal-container').innerHTML = '<div class="modal-overlay" onclick="closeModal(event)"><div class="modal" style="max-width:400px;" onclick="event.stopPropagation()">' + html + '</div></div>';
        
        // Update badge count
        document.getElementById('notification-badge').textContent = data.count || '0';
        document.getElementById('notification-badge').style.display = data.count > 0 ? 'flex' : 'none';
      } catch (error) {
        console.error('Failed to load notifications:', error);
        document.getElementById('modal-container').innerHTML = '<div class="modal-overlay" onclick="closeModal(event)"><div class="modal" style="max-width:400px;" onclick="event.stopPropagation()"><div style="padding:32px;text-align:center;color:var(--accent-red);"><i class="fas fa-exclamation-circle" style="font-size:24px;"></i><p style="margin-top:12px;">Failed to load notifications</p><button class="btn btn-secondary" style="margin-top:16px;" onclick="closeModal()">Close</button></div></div></div>';
      }
    }
    
    // Navigate to notification link
    function navigateToLink(link) {
      closeModal();
      if (link && link.startsWith('#')) {
        const page = link.substring(1);
        // The app's router is navigate(page); guard access so we never try to
        // open a page this role cannot see (e.g. viewer + #action-items).
        if (typeof navigate === 'function' && (typeof hasAccess !== 'function' || hasAccess(page))) {
          navigate(page);
        }
      }
    }
    
    // Load notification count on page load
    async function loadNotificationCount() {
      try {
        const data = await api('/notifications');
        const badge = document.getElementById('notification-badge');
        if (badge) {
          badge.textContent = data.count || '0';
          badge.style.display = data.count > 0 ? 'flex' : 'none';
        }
      } catch (e) {
        // Silently fail
      }
    }
    
    // Load notification count after page loads
    setTimeout(loadNotificationCount, 1000);
    
    // API Functions
    async function api(endpoint, options = {}) {
      const response = await fetch('/api' + endpoint, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        credentials: 'include', // Important for cookies
        ...options
      });
      
      // Handle authentication errors - redirect to login
      if (response.status === 401) {
        const error = await response.json();
        if (error.code === 'AUTH_REQUIRED') {
          showAlert('Session expired. Please login again.', 'error');
          setTimeout(() => { window.location.href = '/'; }, 1500);
          throw new Error('Authentication required');
        }
      }
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'API Error');
      }
      return response.json();
    }

    // Open AutoAudit with organization context
    function openAutoAudit() {
      const params = new URLSearchParams({
        org_id: orgId,
        org_name: orgName
      });
      const url = 'https://autoaudit.pages.dev/?' + params.toString();
      window.open(url, '_blank');
    }
    
    // Logout handler
    async function handleLogout() {
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
        // Clear any local storage
        localStorage.clear();
        sessionStorage.clear();
        // Delete cookie from client side as well
        document.cookie = 'session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        // Redirect to login page (not /, which might redirect back to dashboard)
        window.location.replace('/login');
      } catch (error) {
        console.error('Logout failed:', error);
        // Even if logout fails, clear local state and redirect
        localStorage.clear();
        sessionStorage.clear();
        document.cookie = 'session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        window.location.replace('/login');
      }
    }

    function showAlert(message, type = 'success') {
      const container = document.getElementById('alert-container');
      container.innerHTML = \`<div class="alert \${type}"><i class="fas fa-\${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'exclamation-triangle'}"></i>\${message}</div>\`;
      setTimeout(() => container.innerHTML = '', 3000);
    }

    // Navigation
    const pages = {
      'super-admin': { title: 'Super Admin', subtitle: 'Platform-wide organization management' },
      dashboard: { title: 'Dashboard', subtitle: 'Real-time risk overview' },
      'action-items': { title: 'My Action Items', subtitle: 'Your assigned remediation work across risks, gaps and audit findings' },
      'executive-summary': { title: 'Executive Summary', subtitle: 'One-page GRC overview for leadership' },
      risks: { title: 'Risk Register', subtitle: 'Context-aware risk management' },
      'risk-mitigation': { title: 'Risk Mitigation', subtitle: 'Control-risk mapping and mitigation tracking' },
      assets: { title: 'Assets', subtitle: 'Infrastructure and application inventory' },
      vendors: { title: 'Vendors', subtitle: 'Third-party risk management' },
      compliance: { title: 'Compliance Dashboard', subtitle: 'Multi-framework compliance status' },
      'gap-assessment': { title: 'Gap Assessment', subtitle: 'ISO 27001:2022 control assessment' },
      'org-settings': { title: 'Organization Settings', subtitle: 'Configure profile and framework applicability' },
      controls: { title: 'Controls', subtitle: 'Compliance control tracking' },
      graph: { title: 'Risk Graph', subtitle: 'Interactive asset and risk relationship visualization' },
      maturity: { title: 'Maturity Assessment', subtitle: 'CMM-based security maturity evaluation' },
      ai: { title: 'AI Co-pilot', subtitle: 'Free AI-powered GRC assistant (Llama 3.1)' },
      'audit-dashboard': { title: 'Audit Dashboard', subtitle: 'Internal audit program overview' },
      'audit-programs': { title: 'Audit Programs', subtitle: 'Annual audit planning and tracking' },
      'audit-engagements': { title: 'Audit Engagements', subtitle: 'Individual audit projects' },
      'audit-findings': { title: 'Audit Findings', subtitle: 'Issues and observations from audits' },
      'org-admin': { title: 'Organization Admin', subtitle: 'Manage users, modules, and settings' }
    };

    function navigate(page) {
      try {
        console.log('navigate called with:', page, 'userRole:', userRole);
        
        // Close mobile menu when navigating
        closeMobileMenu();
        
        // RBAC: Check if user has access to this page
        if (!hasAccess(page)) {
          showAlert('Access Denied: You do not have permission to view this page.', 'error');
          console.warn('Access denied for page:', page, 'role:', userRole);
          return;
        }
        
        currentPage = page;
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        // Find and activate the nav item for this page
        document.querySelectorAll('.nav-item').forEach(item => {
          if (item.getAttribute('onclick')?.includes("'" + page + "'")) {
            item.classList.add('active');
          }
        });
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        var pageEl = document.getElementById(page + '-page');
        console.log('page element:', pageEl);
        if (pageEl) {
          pageEl.classList.add('active');
        } else {
          console.error('Page element not found:', page + '-page');
          return;
        }
        const pageInfo = pages[page] || { title: page, subtitle: '' };
        document.getElementById('page-title').textContent = pageInfo.title;
        document.getElementById('page-subtitle').textContent = pageInfo.subtitle;
        loadPage(page);
      } catch (err) {
        console.error('navigate error:', err);
      }
    }

    async function loadPage(page) {
      const container = document.getElementById(page + '-page');
      container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
      try {
        switch(page) {
          case 'dashboard': await loadDashboard(); break;
          case 'action-items': await loadActionItems(); break;
          case 'executive-summary': await loadExecutiveSummary(); break;
          case 'risks': await loadRisks(); break;
          case 'super-admin': await loadSuperAdmin(); break;
          case 'risk-mitigation': await loadRiskMitigation(); break;
          case 'assets': await loadAssets(); break;
          case 'vendors': await loadVendors(); break;
          case 'compliance': await loadComplianceDashboard(); break;
          case 'gap-assessment': await loadGapAssessment(); break;
          case 'org-settings': await loadOrgSettings(); break;
          case 'controls': await loadControls(); break;
          case 'graph': await loadGraph(); break;
          case 'maturity': await loadMaturity(); break;
          case 'ai': await loadAICopilot(); break;
          case 'audit-dashboard': await loadAuditDashboard(); break;
          case 'audit-programs': await loadAuditPrograms(); break;
          case 'audit-engagements': await loadAuditEngagements(); break;
          case 'audit-findings': await loadAuditFindings(); break;
          case 'org-admin': await loadOrgAdmin(); break;
        }
      } catch (error) {
        container.innerHTML = '<div class="alert error">Failed to load data: ' + error.message + '</div>';
      }
    }

    // =================================================================
    // MY ACTION ITEMS - unified remediation work list (risks + gaps + findings)
    // =================================================================
    let actionItemsScope = 'mine'; // 'mine' | 'all'
    let actionItemsType = 'all';   // 'all' | 'risk' | 'gap' | 'finding'
    let actionItemsCache = [];     // last loaded items (for the assign modal)
    let actionItemsUsers = [];     // org users for owner dropdown
    let actionItemsUsersLoaded = false;

    function actionItemTypeMeta(type) {
      switch (type) {
        case 'risk':    return { label: 'Risk',    icon: 'fa-exclamation-triangle', color: '#ef4444', page: 'risks' };
        case 'gap':     return { label: 'Gap',     icon: 'fa-tasks',                color: '#f59e0b', page: 'gap-assessment' };
        case 'finding': return { label: 'Finding', icon: 'fa-search',               color: '#8b5cf6', page: 'audit-findings' };
        default:        return { label: 'Item',    icon: 'fa-clipboard-check',      color: '#3b82f6', page: 'dashboard' };
      }
    }

    function actionItemStatusBadge(status) {
      const s = String(status || '').toLowerCase();
      let color = '#6b7280';
      if (['open','not_started'].includes(s)) color = '#ef4444';
      else if (['in_progress','planned','remediation_planned'].includes(s)) color = '#f59e0b';
      else if (['implemented','closed','resolved','mitigated','accepted'].includes(s)) color = '#22c55e';
      const label = (status || 'open').replace(/_/g, ' ').replace(/\\b\\w/g, c => c.toUpperCase());
      return \`<span class="badge" style="background:\${color}20; color:\${color};">\${label}</span>\`;
    }

    function dueCell(item) {
      if (!item.due_date) return '<span style="color: var(--text-muted);">—</span>';
      const d = item.due_date;
      if (item.overdue) {
        return \`<span style="color:#ef4444; font-weight:600;"><i class="fas fa-exclamation-circle"></i> \${d} <span style="font-size:11px;">(\${Math.abs(item.days_until_due)}d overdue)</span></span>\`;
      }
      if (item.days_until_due !== null && item.days_until_due <= 7) {
        return \`<span style="color:#f59e0b; font-weight:600;">\${d} <span style="font-size:11px;">(in \${item.days_until_due}d)</span></span>\`;
      }
      return \`<span style="color: var(--text-secondary);">\${d}</span>\`;
    }

    async function loadActionItems() {
      const container = document.getElementById('action-items-page');
      container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading your action items...</div>';

      // Toolbar (scope + type filters)
      document.getElementById('page-actions').innerHTML = \`
        <button class="btn btn-secondary btn-sm" onclick="refreshActionItems()"><i class="fas fa-sync"></i> Refresh</button>
      \`;

      const params = new URLSearchParams();
      if (actionItemsScope === 'mine') params.set('mine', '1');
      if (actionItemsType !== 'all') params.set('type', actionItemsType);

      let data;
      try {
        data = await api('/action-items?' + params.toString());
      } catch (e) {
        container.innerHTML = '<div class="alert error">Failed to load action items: ' + e.message + '</div>';
        return;
      }

      const s = data.summary || { total: 0, overdue: 0, unassigned: 0, due_soon: 0, by_type: { risk:0, gap:0, finding:0 } };
      const items = data.items || [];
      actionItemsCache = items;

      // Load org users once for the owner dropdown (best-effort; some roles can't read /users)
      if (!actionItemsUsersLoaded) {
        try {
          const u = await api('/users');
          actionItemsUsers = (u && u.users) ? u.users : [];
        } catch (e) { actionItemsUsers = []; }
        actionItemsUsersLoaded = true;
      }

      // Update sidebar badge with overdue count
      updateActionItemsBadge(s.overdue);

      const scopeBtn = (val, label) =>
        \`<button class="btn btn-sm \${actionItemsScope === val ? 'btn-primary' : 'btn-secondary'}" onclick="setActionScope('\${val}')">\${label}</button>\`;
      const typeBtn = (val, label) =>
        \`<button class="btn btn-sm \${actionItemsType === val ? 'btn-primary' : 'btn-secondary'}" onclick="setActionType('\${val}')">\${label}</button>\`;

      let rows = '';
      if (items.length === 0) {
        rows = \`<tr><td colspan="6" style="text-align:center; padding:40px; color: var(--text-muted);">
          <i class="fas fa-check-circle" style="font-size:32px; color:#22c55e; display:block; margin-bottom:12px;"></i>
          No open action items \${actionItemsScope === 'mine' ? 'assigned to you' : ''}. Nothing to remediate right now.
        </td></tr>\`;
      } else {
        rows = items.map(i => {
          const m = actionItemTypeMeta(i.type);
          return \`<tr style="border-bottom:1px solid var(--border);">
            <td style="padding:12px;"><span class="badge" style="background:\${m.color}20; color:\${m.color};"><i class="fas \${m.icon}"></i> \${m.label}</span></td>
            <td style="padding:12px; max-width:340px;">
              <div style="font-weight:600; color: var(--text-primary);">\${escapeHtml(i.title || 'Untitled')}</div>
              \${i.remediation_plan ? \`<div style="font-size:12px; color: var(--text-muted); margin-top:2px;">\${escapeHtml(String(i.remediation_plan).slice(0,120))}\${String(i.remediation_plan).length>120?'…':''}</div>\` : ''}
            </td>
            <td style="padding:12px;">\${actionItemStatusBadge(i.status)}</td>
            <td style="padding:12px;">\${i.owner_name ? escapeHtml(i.owner_name) : '<span style="color:#f59e0b;"><i class=\\'fas fa-user-slash\\'></i> Unassigned</span>'}</td>
            <td style="padding:12px;">\${dueCell(i)}</td>
            <td style="padding:12px; text-align:right; white-space:nowrap;">
              <button class="btn btn-sm btn-primary" onclick="openAssignModal('\${i.type}','\${i.id}')"><i class="fas fa-user-edit"></i> Assign</button>
              <button class="btn btn-sm btn-secondary" onclick="navigate('\${m.page}')"><i class="fas fa-arrow-right"></i> Open</button>
            </td>
          </tr>\`;
        }).join('');
      }

      container.innerHTML = \`
        <div class="metrics-grid" style="margin-bottom:16px;">
          <div class="metric-card">
            <div style="display:flex; justify-content:space-between;">
              <div><div class="metric-value">\${s.total}</div><div class="metric-label">Open Items</div></div>
              <div class="metric-icon blue"><i class="fas fa-clipboard-check"></i></div>
            </div>
          </div>
          <div class="metric-card">
            <div style="display:flex; justify-content:space-between;">
              <div><div class="metric-value" style="color:\${s.overdue>0?'#ef4444':'var(--text-primary)'}">\${s.overdue}</div><div class="metric-label">Overdue</div></div>
              <div class="metric-icon red"><i class="fas fa-exclamation-circle"></i></div>
            </div>
          </div>
          <div class="metric-card">
            <div style="display:flex; justify-content:space-between;">
              <div><div class="metric-value" style="color:\${s.due_soon>0?'#f59e0b':'var(--text-primary)'}">\${s.due_soon}</div><div class="metric-label">Due &le; 7 days</div></div>
              <div class="metric-icon purple"><i class="fas fa-clock"></i></div>
            </div>
          </div>
          <div class="metric-card">
            <div style="display:flex; justify-content:space-between;">
              <div><div class="metric-value" style="color:\${s.unassigned>0?'#f59e0b':'var(--text-primary)'}">\${s.unassigned}</div><div class="metric-label">Unassigned</div></div>
              <div class="metric-icon yellow"><i class="fas fa-user-slash"></i></div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header" style="flex-wrap:wrap; gap:12px;">
            <div style="display:flex; gap:6px; align-items:center;">
              <span style="font-size:12px; color:var(--text-muted); margin-right:4px;">Scope:</span>
              \${scopeBtn('mine','Assigned to me')} \${scopeBtn('all','Whole organization')}
            </div>
            <div style="display:flex; gap:6px; align-items:center;">
              <span style="font-size:12px; color:var(--text-muted); margin-right:4px;">Type:</span>
              \${typeBtn('all','All ('+s.total+')')} \${typeBtn('risk','Risks ('+s.by_type.risk+')')} \${typeBtn('gap','Gaps ('+s.by_type.gap+')')} \${typeBtn('finding','Findings ('+s.by_type.finding+')')}
            </div>
          </div>
          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse;">
              <thead>
                <tr style="border-bottom:2px solid var(--border); text-align:left;">
                  <th style="padding:12px; font-size:12px; color:var(--text-muted); text-transform:uppercase;">Type</th>
                  <th style="padding:12px; font-size:12px; color:var(--text-muted); text-transform:uppercase;">Item</th>
                  <th style="padding:12px; font-size:12px; color:var(--text-muted); text-transform:uppercase;">Status</th>
                  <th style="padding:12px; font-size:12px; color:var(--text-muted); text-transform:uppercase;">Owner</th>
                  <th style="padding:12px; font-size:12px; color:var(--text-muted); text-transform:uppercase;">Due</th>
                  <th style="padding:12px;"></th>
                </tr>
              </thead>
              <tbody>\${rows}</tbody>
            </table>
          </div>
        </div>
      \`;
    }

    function setActionScope(scope) { actionItemsScope = scope; loadActionItems(); }
    function setActionType(type) { actionItemsType = type; loadActionItems(); }
    function refreshActionItems() { loadActionItems(); }

    // Status options offered per source type
    function actionStatusOptions(type, current) {
      let opts;
      if (type === 'risk') {
        opts = [['open','Open'],['in_progress','In Progress'],['mitigated','Mitigated'],['accepted','Accepted'],['closed','Closed']];
      } else if (type === 'gap') {
        opts = [['not_started','Not Started'],['planned','Planned'],['in_progress','In Progress'],['implemented','Implemented']];
      } else { // finding
        opts = [['open','Open'],['in_progress','In Progress'],['remediation_planned','Remediation Planned'],['resolved','Resolved'],['closed','Closed']];
      }
      const cur = String(current || '').toLowerCase();
      return opts.map(o => \`<option value="\${o[0]}" \${cur === o[0] ? 'selected' : ''}>\${o[1]}</option>\`).join('');
    }

    // Open the Assign / Update modal for a single action item
    function openAssignModal(type, id) {
      const item = actionItemsCache.find(i => i.type === type && String(i.id) === String(id));
      if (!item) { showAlert('Item not found — try Refresh', 'error'); return; }

      const m = actionItemTypeMeta(type);
      const ownerOptions = actionItemsUsers.map(u =>
        \`<option value="\${u.id}" \${item.owner_id === u.id ? 'selected' : ''}>\${escapeHtml(u.display_name || u.email)}</option>\`
      ).join('');
      // date input wants YYYY-MM-DD; strip any time component
      const dueVal = item.due_date ? String(item.due_date).slice(0,10) : '';

      const ownerNote = actionItemsUsers.length === 0
        ? '<div style="font-size:12px; color:#f59e0b; margin-top:6px;"><i class="fas fa-info-circle"></i> No assignable users loaded (your role may not have user-list access). You can still set status &amp; due date.</div>'
        : '';

      document.getElementById('modal-container').innerHTML = \`
        <div class="modal-overlay" onclick="closeModal(event)">
          <div class="modal" style="max-width: 560px;" onclick="event.stopPropagation()">
            <div class="modal-header">
              <h3 class="modal-title"><i class="fas \${m.icon}" style="color:\${m.color}; margin-right:8px;"></i>Assign \${m.label}</h3>
              <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
              <div style="margin-bottom:16px; padding:12px; background:var(--bg-tertiary); border-radius:8px;">
                <div style="font-size:12px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">\${m.label}</div>
                <div style="font-weight:600; color:var(--text-primary); margin-top:2px;">\${escapeHtml(item.title || 'Untitled')}</div>
              </div>

              <div class="grid-2" style="gap:16px;">
                <div class="form-group">
                  <label class="form-label">Owner</label>
                  <select class="form-select" id="assign-owner">
                    <option value="">— Unassigned —</option>
                    \${ownerOptions}
                  </select>
                  \${ownerNote}
                </div>
                <div class="form-group">
                  <label class="form-label">Due Date</label>
                  <input type="date" class="form-input" id="assign-due" value="\${dueVal}">
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Status</label>
                <select class="form-select" id="assign-status">
                  \${actionStatusOptions(type, item.status)}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Remediation Plan <span style="color:var(--text-muted); font-weight:400;">(optional)</span></label>
                <textarea class="form-textarea" id="assign-plan" rows="3" placeholder="What needs to be done...">\${escapeHtml(item.remediation_plan || '')}</textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
              <button class="btn btn-primary" onclick="saveActionItem('\${type}','\${id}')"><i class="fas fa-save"></i> Save</button>
            </div>
          </div>
        </div>
      \`;
    }

    // Persist the assign-modal changes back to the correct source endpoint
    async function saveActionItem(type, id) {
      const ownerId = document.getElementById('assign-owner').value || null;
      const due = document.getElementById('assign-due').value || null;
      const status = document.getElementById('assign-status').value;
      const plan = document.getElementById('assign-plan').value || null;
      const ownerName = ownerId ? (actionItemsUsers.find(u => u.id === ownerId) || {}).display_name || null : null;

      try {
        if (type === 'risk') {
          await api('/risks/' + id, {
            method: 'PATCH',
            body: JSON.stringify({ assignee_id: ownerId, due_date: due, status: status, remediation_plan: plan })
          });
        } else if (type === 'gap') {
          const item = actionItemsCache.find(i => i.type === 'gap' && String(i.id) === String(id));
          const controlId = item ? item.control_library_id : null;
          if (!controlId) { showAlert('Missing control reference — try Refresh', 'error'); return; }
          await api('/compliance/assessment', {
            method: 'POST',
            body: JSON.stringify({
              control_library_id: controlId,
              implementation_status: status,
              remediation_owner_id: ownerId,
              remediation_due_date: due,
              remediation_plan: plan
            })
          });
        } else { // finding
          await api('/audit/findings/' + id, {
            method: 'PATCH',
            body: JSON.stringify({
              remediation_owner_id: ownerId,
              remediation_owner_name: ownerName,
              due_date: due,
              status: status,
              remediation_plan: plan
            })
          });
        }
        closeModal();
        showAlert('Action item updated', 'success');
        loadActionItems();
      } catch (error) {
        showAlert('Failed to save: ' + error.message, 'error');
      }
    }

    function updateActionItemsBadge(overdue) {
      const badge = document.getElementById('action-items-badge');
      if (!badge) return;
      if (overdue && overdue > 0) {
        badge.textContent = overdue;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }

    // On login, silently fetch overdue count for the sidebar badge (mine only)
    async function primeActionItemsBadge() {
      try {
        const data = await api('/action-items?mine=1');
        updateActionItemsBadge((data.summary || {}).overdue || 0);
      } catch (e) { /* non-fatal */ }
    }

    // Dashboard
    async function loadDashboard() {
      const data = await api('/dashboard');
      document.getElementById('page-actions').innerHTML = '';
      
      // Determine compliance score color based on value
      const scoreColor = data.complianceHealth.overallScore >= 80 ? 'var(--accent-green)' : 
                         data.complianceHealth.overallScore >= 60 ? 'var(--accent-yellow)' : 'var(--accent-red)';
      
      // Show controls at risk info
      const controlsAtRiskInfo = data.controlsAtRisk > 0 
        ? \`<div style="font-size: 10px; color: var(--accent-yellow); margin-top: 4px;">\${data.controlsAtRisk} controls affected by risks</div>\`
        : '';
      
      document.getElementById('dashboard-page').innerHTML = \`
        <div class="metrics-grid">
          <div class="metric-card">
            <div style="display: flex; justify-content: space-between;">
              <div>
                <div class="metric-value" style="color: \${data.riskSummary.total > 0 ? 'var(--accent-red)' : 'var(--accent-green)'}">\${data.riskSummary.total}</div>
                <div class="metric-label">Open Risks</div>
              </div>
              <div class="metric-icon red"><i class="fas fa-exclamation-triangle"></i></div>
            </div>
          </div>
          <div class="metric-card">
            <div style="display: flex; justify-content: space-between;">
              <div>
                <div class="metric-value">\${data.controlsAtRisk || 0}</div>
                <div class="metric-label">Controls at Risk</div>
              </div>
              <div class="metric-icon purple"><i class="fas fa-shield-alt"></i></div>
            </div>
          </div>
          <div class="metric-card">
            <div style="display: flex; justify-content: space-between;">
              <div>
                <div class="metric-value">\${data.vendorRisk.total || 0}</div>
                <div class="metric-label">Total Vendors</div>
              </div>
              <div class="metric-icon blue"><i class="fas fa-building"></i></div>
            </div>
          </div>
          <div class="metric-card">
            <div style="display: flex; justify-content: space-between;">
              <div>
                <div class="metric-value" style="color: \${scoreColor}">\${data.complianceHealth.overallScore}%</div>
                <div class="metric-label">Compliance Score</div>
                \${controlsAtRiskInfo}
              </div>
              <div class="metric-icon green"><i class="fas fa-shield-alt"></i></div>
            </div>
          </div>
        </div>
        
        <div class="grid-2">
          <div class="card">
            <div class="card-header"><h3 class="card-title"><i class="fas fa-chart-pie" style="margin-right: 8px; color: var(--accent);"></i>Risk Distribution</h3></div>
            <div style="display: flex; gap: 20px; padding: 16px 0;">
              <div style="text-align: center; flex: 1;">
                <div style="font-size: 28px; font-weight: 700; color: #dc2626;">\${data.riskSummary.critical}</div>
                <div style="font-size: 12px; color: var(--text-muted);">Critical</div>
              </div>
              <div style="text-align: center; flex: 1;">
                <div style="font-size: 28px; font-weight: 700; color: #f97316;">\${data.riskSummary.high}</div>
                <div style="font-size: 12px; color: var(--text-muted);">High</div>
              </div>
              <div style="text-align: center; flex: 1;">
                <div style="font-size: 28px; font-weight: 700; color: #eab308;">\${data.riskSummary.medium}</div>
                <div style="font-size: 12px; color: var(--text-muted);">Medium</div>
              </div>
              <div style="text-align: center; flex: 1;">
                <div style="font-size: 28px; font-weight: 700; color: #22c55e;">\${data.riskSummary.low}</div>
                <div style="font-size: 12px; color: var(--text-muted);">Low</div>
              </div>
            </div>
          </div>
          
          <div class="card">
            <div class="card-header"><h3 class="card-title"><i class="fas fa-tasks" style="margin-right: 8px; color: var(--accent);"></i>Control Status</h3></div>
            <div style="display: flex; gap: 16px; padding: 16px 0;">
              <div style="text-align: center; flex: 1;">
                <div style="font-size: 28px; font-weight: 700; color: #22c55e;">\${data.controlAssessments?.implemented || 0}</div>
                <div style="font-size: 11px; color: var(--text-muted);">Implemented</div>
              </div>
              <div style="text-align: center; flex: 1;">
                <div style="font-size: 28px; font-weight: 700; color: #3b82f6;">\${data.controlAssessments?.inProgress || 0}</div>
                <div style="font-size: 11px; color: var(--text-muted);">In Progress</div>
              </div>
              <div style="text-align: center; flex: 1;">
                <div style="font-size: 28px; font-weight: 700; color: #8b5cf6;">\${data.controlAssessments?.planned || 0}</div>
                <div style="font-size: 11px; color: var(--text-muted);">Planned</div>
              </div>
              <div style="text-align: center; flex: 1;">
                <div style="font-size: 28px; font-weight: 700; color: #6b7280;">\${data.controlAssessments?.notStarted || 0}</div>
                <div style="font-size: 11px; color: var(--text-muted);">Not Started</div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="grid-2" style="margin-top: 16px;">
          <div class="card">
            <div class="card-header"><h3 class="card-title"><i class="fas fa-building" style="margin-right: 8px; color: var(--accent);"></i>Vendor Alerts</h3></div>
            <div style="display: flex; gap: 20px; padding: 16px 0;">
              <div style="text-align: center; flex: 1;">
                <div style="font-size: 28px; font-weight: 700; color: var(--accent-red);">\${data.vendorRisk.activeIncidents}</div>
                <div style="font-size: 12px; color: var(--text-muted);">Active Incidents</div>
              </div>
              <div style="text-align: center; flex: 1;">
                <div style="font-size: 28px; font-weight: 700; color: var(--accent-yellow);">\${data.vendorRisk.highRiskVendors}</div>
                <div style="font-size: 12px; color: var(--text-muted);">High Risk</div>
              </div>
            </div>
          </div>
          
          <div class="card">
            <div class="card-header"><h3 class="card-title"><i class="fas fa-link" style="margin-right: 8px; color: var(--accent);"></i>Risk-Control Impact</h3></div>
            <div style="padding: 16px 0;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <span style="color: var(--text-muted);">Controls Implemented</span>
                <span style="font-weight: 600; color: var(--accent-green);">\${data.controlAssessments?.implemented || 0} / \${data.controlAssessments?.total || 0}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <span style="color: var(--text-muted);">Controls Linked to Open Risks</span>
                <span style="font-weight: 600; color: \${data.controlsAtRisk > 0 ? 'var(--accent-red)' : 'var(--accent-green)'}">\${data.controlsAtRisk || 0}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <span style="color: var(--text-muted);">Open Risks (from PentestPulse)</span>
                <span style="font-weight: 600; color: \${data.openRisksCount > 0 ? 'var(--accent-yellow)' : 'var(--accent-green)'}">\${data.openRisksCount || 0}</span>
              </div>
              <div style="border-top: 1px solid var(--border-color); padding-top: 12px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 600; color: var(--text-primary);">Compliance Score</span>
                <span style="font-size: 24px; font-weight: 700; color: \${scoreColor}">\${data.complianceHealth.overallScore}%</span>
              </div>
              <div style="margin-top: 12px; font-size: 11px; color: var(--text-muted); background: var(--bg-secondary); padding: 8px; border-radius: 6px;">
                <i class="fas fa-info-circle" style="color: var(--accent); margin-right: 6px;"></i>
                Open risks linked to controls will downgrade those controls from "Implemented" to "In Progress". Close risks to restore control status.
              </div>
            </div>
          </div>
        </div>
      \`;
    }

    // Executive Summary Page - One-page GRC overview
    async function loadExecutiveSummary() {
      // Fetch all necessary data in parallel (with cache-busting)
      const t = Date.now();
      const [dashboardData, complianceData, trendsData] = await Promise.all([
        api('/dashboard?_t=' + t),
        api('/compliance/dashboard?mode=basic&_t=' + t),
        api('/compliance/trends?period=6m&_t=' + t)
      ]);
      
      // Add export button to page actions
      document.getElementById('page-actions').innerHTML = \`
        <button onclick="exportExecutivePDF()" style="padding: 10px 20px; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
          <i class="fas fa-file-pdf"></i> Export One-Pager
        </button>
      \`;
      
      const isoFramework = complianceData.frameworks.find(f => f.id === 'fw-iso27001');
      const soc2Framework = complianceData.frameworks.find(f => f.id === 'fw-soc2');
      
      // Calculate risk trend
      const riskTrend = trendsData.chartData?.risks?.datasets?.[0]?.data || [];
      const riskChange = riskTrend.length >= 2 ? riskTrend[riskTrend.length - 1] - riskTrend[0] : 0;
      
      // Calculate compliance trend
      const complianceTrend = trendsData.chartData?.compliance?.datasets?.[0]?.data || [];
      const complianceChange = complianceTrend.length >= 2 ? complianceTrend[complianceTrend.length - 1] - complianceTrend[0] : 0;
      
      document.getElementById('executive-summary-page').innerHTML = \`
        <style>
          .exec-card { background: var(--card-bg); border-radius: 16px; padding: 24px; border: 1px solid var(--border); }
          .exec-metric { text-align: center; padding: 20px; background: var(--bg-tertiary); border-radius: 12px; }
          .exec-metric-value { font-size: 36px; font-weight: 800; margin-bottom: 4px; }
          .exec-metric-label { font-size: 12px; color: var(--text-muted); }
          .exec-trend { font-size: 11px; margin-top: 4px; display: flex; align-items: center; justify-content: center; gap: 4px; }
          .exec-trend.up { color: #22c55e; }
          .exec-trend.down { color: #ef4444; }
          .exec-gauge { position: relative; width: 140px; height: 85px; margin: 0 auto; }
          .exec-section-title { font-size: 16px; font-weight: 700; margin-bottom: 16px; display: flex; align-items: center; gap: 10px; }
          .exec-progress { height: 10px; background: var(--bg-tertiary); border-radius: 5px; overflow: hidden; margin-top: 8px; }
          .exec-progress-bar { height: 100%; border-radius: 5px; transition: width 0.5s ease; }
          .exec-status-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 8px; }
          .print-only { display: none; }
          @media print {
            .print-only { display: block; }
            .no-print { display: none !important; }
          }
        </style>
        
        <!-- Header with Date and Organization -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
          <div>
            <h1 style="margin: 0; font-size: 28px;">Executive GRC Summary</h1>
            <p style="margin: 4px 0 0; color: var(--text-muted);">
              <i class="fas fa-building" style="margin-right: 6px;"></i><span class="exec-org-name"></span>
              <span style="margin: 0 12px;">•</span>
              <i class="fas fa-calendar" style="margin-right: 6px;"></i>\${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div style="display: flex; gap: 12px; align-items: center;">
            <div style="padding: 8px 16px; background: \${(isoFramework?.score || 0) >= 80 ? 'rgba(34, 197, 94, 0.15)' : (isoFramework?.score || 0) >= 60 ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; border-radius: 8px; border: 1px solid \${(isoFramework?.score || 0) >= 80 ? 'rgba(34, 197, 94, 0.3)' : (isoFramework?.score || 0) >= 60 ? 'rgba(234, 179, 8, 0.3)' : 'rgba(239, 68, 68, 0.3)'};">
              <span style="font-size: 11px; color: var(--text-muted);">Overall Status:</span>
              <span style="font-weight: 700; color: \${(isoFramework?.score || 0) >= 80 ? '#22c55e' : (isoFramework?.score || 0) >= 60 ? '#eab308' : '#ef4444'}; margin-left: 8px;">
                \${(isoFramework?.score || 0) >= 80 ? 'HEALTHY' : (isoFramework?.score || 0) >= 60 ? 'ATTENTION' : 'AT RISK'}
              </span>
            </div>
          </div>
        </div>
        
        <!-- Key Metrics Row -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px;">
          <!-- Compliance Score -->
          <div class="exec-card" style="text-align: center;">
            <div style="position: relative; width: 140px; height: 70px; margin: 0 auto;">
              <svg viewBox="0 0 140 70" style="width: 100%; height: 100%;">
                <defs>
                  <linearGradient id="execGauge1" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style="stop-color:#ef4444"/>
                    <stop offset="50%" style="stop-color:#eab308"/>
                    <stop offset="100%" style="stop-color:#22c55e"/>
                  </linearGradient>
                </defs>
                <!-- Background arc -->
                <path d="M 15 65 A 55 55 0 0 1 125 65" fill="none" stroke="#1e293b" stroke-width="10" stroke-linecap="round"/>
                <!-- Progress arc -->
                <path d="M 15 65 A 55 55 0 0 1 125 65" fill="none" stroke="url(#execGauge1)" stroke-width="10" stroke-linecap="round"
                  stroke-dasharray="\${((isoFramework?.score || 0) / 100) * 173}, 173"/>
                <!-- Needle -->
                <g style="transform-origin: 70px 65px; transform: rotate(\${-90 + ((isoFramework?.score || 0) / 100) * 180}deg);">
                  <polygon points="70,20 67,65 73,65" fill="#e2e8f0"/>
                  <circle cx="70" cy="65" r="5" fill="#334155" stroke="#e2e8f0" stroke-width="2"/>
                </g>
              </svg>
            </div>
            <!-- Score displayed below the gauge -->
            <div style="font-size: 32px; font-weight: 800; color: \${(isoFramework?.score || 0) >= 80 ? '#22c55e' : (isoFramework?.score || 0) >= 60 ? '#eab308' : '#ef4444'}; margin-top: 4px;">\${isoFramework?.score || 0}%</div>
            <div style="font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-top: 4px;">ISO 27001 Compliance</div>
            <div class="exec-trend \${complianceChange >= 0 ? 'up' : 'down'}">
              <i class="fas fa-arrow-\${complianceChange >= 0 ? 'up' : 'down'}"></i>
              \${Math.abs(complianceChange)}% vs 6 months ago
            </div>
          </div>
          
          <!-- Open Risks -->
          <div class="exec-card">
            <div class="exec-metric">
              <div class="exec-metric-value" style="color: \${dashboardData.riskSummary.critical > 0 ? '#ef4444' : '#f59e0b'};">\${dashboardData.riskSummary.total}</div>
              <div class="exec-metric-label">Open Risks</div>
              <div class="exec-trend \${riskChange <= 0 ? 'up' : 'down'}">
                <i class="fas fa-arrow-\${riskChange <= 0 ? 'down' : 'up'}"></i>
                \${Math.abs(riskChange)} \${riskChange <= 0 ? 'fewer' : 'more'} vs 6 months ago
              </div>
            </div>
            <div style="display: flex; justify-content: space-around; margin-top: 12px; font-size: 11px;">
              <span><span class="exec-status-dot" style="background: #ef4444;"></span>Critical: \${dashboardData.riskSummary.critical}</span>
              <span><span class="exec-status-dot" style="background: #f59e0b;"></span>High: \${dashboardData.riskSummary.high}</span>
            </div>
          </div>
          
          <!-- Controls Linked to Risks -->
          <div class="exec-card">
            <div class="exec-metric">
              <div class="exec-metric-value" style="color: #8b5cf6;">\${dashboardData.controlsLinked || 0}</div>
              <div class="exec-metric-label">Controls with Risks</div>
            </div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 12px; text-align: center;">
              Controls linked to open risks
            </div>
          </div>
          
          <!-- Avg Maturity -->
          <div class="exec-card">
            <div class="exec-metric">
              <div style="position: relative; width: 70px; height: 70px; margin: 0 auto;">
                <svg viewBox="0 0 70 70" style="width: 100%; height: 100%;">
                  <circle cx="35" cy="35" r="28" fill="none" stroke="#1e293b" stroke-width="6"/>
                  <circle cx="35" cy="35" r="28" fill="none" stroke="#3b82f6" stroke-width="6" stroke-linecap="round"
                    stroke-dasharray="\${((complianceData.advancedMetrics?.avgMaturity || 0) / 5) * 176}, 176" 
                    transform="rotate(-90 35 35)"/>
                </svg>
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 20px; font-weight: 700; color: #3b82f6;">
                  \${(complianceData.advancedMetrics?.avgMaturity || 0).toFixed(1)}
                </div>
              </div>
              <div class="exec-metric-label" style="margin-top: 8px;">Maturity Level (0-5)</div>
            </div>
          </div>
        </div>
        
        <!-- Two Column Layout -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 24px; margin-bottom: 24px;">
          
          <!-- Framework Compliance Status -->
          <div class="exec-card">
            <div class="exec-section-title">
              <i class="fas fa-clipboard-check" style="color: #3b82f6;"></i>
              Framework Compliance
            </div>
            <div style="display: flex; flex-direction: column; gap: 16px;">
              \${complianceData.frameworks.filter(fw => fw.is_applicable).map(fw => \`
                <div>
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span style="font-weight: 600; font-size: 13px;">\${fw.name}</span>
                    <span style="font-weight: 700; color: \${fw.score >= 80 ? '#22c55e' : fw.score >= 60 ? '#eab308' : '#ef4444'};">\${fw.score}%</span>
                  </div>
                  <div class="exec-progress">
                    <div class="exec-progress-bar" style="width: \${fw.score}%; background: linear-gradient(90deg, \${fw.score >= 80 ? '#22c55e' : fw.score >= 60 ? '#eab308' : '#ef4444'}, \${fw.score >= 80 ? '#16a34a' : fw.score >= 60 ? '#ca8a04' : '#dc2626'});"></div>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--text-muted); margin-top: 4px;">
                    <span>\${fw.implemented}/\${fw.total} controls implemented</span>
                    <span>\${fw.inProgress || 0} in progress</span>
                  </div>
                </div>
              \`).join('')}
            </div>
          </div>
          
          <!-- Risk Distribution -->
          <div class="exec-card">
            <div class="exec-section-title">
              <i class="fas fa-exclamation-triangle" style="color: #ef4444;"></i>
              Risk Distribution
            </div>
            <div style="display: flex; gap: 16px; flex-wrap: wrap;">
              <div style="flex: 1; min-width: 150px;">
                <!-- Visual risk breakdown -->
                <div style="display: flex; flex-direction: column; gap: 12px;">
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #ef4444, #dc2626); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 800; color: white;">\${dashboardData.riskSummary.critical}</div>
                    <div><div style="font-weight: 600;">Critical</div><div style="font-size: 11px; color: var(--text-muted);">Immediate action required</div></div>
                  </div>
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 800; color: white;">\${dashboardData.riskSummary.high}</div>
                    <div><div style="font-weight: 600;">High</div><div style="font-size: 11px; color: var(--text-muted);">Address within 30 days</div></div>
                  </div>
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #eab308, #ca8a04); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 800; color: white;">\${dashboardData.riskSummary.medium}</div>
                    <div><div style="font-weight: 600;">Medium</div><div style="font-size: 11px; color: var(--text-muted);">Monitor and plan</div></div>
                  </div>
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #22c55e, #16a34a); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 800; color: white;">\${dashboardData.riskSummary.low}</div>
                    <div><div style="font-weight: 600;">Low</div><div style="font-size: 11px; color: var(--text-muted);">Accept or monitor</div></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Bottom Row: Top Gaps and Vendor Status -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 24px;">
          
          <!-- Top Compliance Gaps -->
          <div class="exec-card">
            <div class="exec-section-title">
              <i class="fas fa-exclamation-circle" style="color: #f59e0b;"></i>
              Top Compliance Gaps
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px;">
              \${complianceData.topGaps.slice(0, 5).map((gap, i) => \`
                <div style="display: flex; align-items: center; gap: 12px; padding: 10px; background: var(--bg-tertiary); border-radius: 8px; border-left: 4px solid \${gap.is_critical ? '#ef4444' : '#f59e0b'};">
                  <div style="width: 28px; height: 28px; background: \${gap.is_critical ? '#ef4444' : '#f59e0b'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: white;">\${i + 1}</div>
                  <div style="flex: 1;">
                    <div style="font-size: 12px; font-weight: 600;">\${gap.control_id}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">\${gap.title.substring(0, 50)}\${gap.title.length > 50 ? '...' : ''}</div>
                  </div>
                  <span style="font-size: 10px; padding: 3px 8px; border-radius: 4px; background: \${gap.is_critical ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)'}; color: \${gap.is_critical ? '#ef4444' : '#f59e0b'}; font-weight: 600;">
                    \${gap.is_critical ? 'CRITICAL' : 'Important'}
                  </span>
                </div>
              \`).join('') || '<div style="text-align: center; color: #22c55e; padding: 20px;"><i class="fas fa-check-circle" style="font-size: 24px;"></i><div style="margin-top: 8px;">No compliance gaps identified!</div></div>'}
            </div>
          </div>
          
          <!-- Third Party Risk Summary -->
          <div class="exec-card">
            <div class="exec-section-title">
              <i class="fas fa-building" style="color: #8b5cf6;"></i>
              Third-Party Risk Summary
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 16px;">
              <div style="text-align: center; padding: 16px; background: var(--bg-tertiary); border-radius: 10px;">
                <div style="font-size: 28px; font-weight: 700; color: #3b82f6;">\${dashboardData.vendorRisk.total}</div>
                <div style="font-size: 11px; color: var(--text-muted);">Total Vendors</div>
              </div>
              <div style="text-align: center; padding: 16px; background: rgba(239, 68, 68, 0.1); border-radius: 10px; border: 1px solid rgba(239, 68, 68, 0.2);">
                <div style="font-size: 28px; font-weight: 700; color: #ef4444;">\${dashboardData.vendorRisk.criticalVendors}</div>
                <div style="font-size: 11px; color: var(--text-muted);">Critical Risk</div>
              </div>
              <div style="text-align: center; padding: 16px; background: rgba(245, 158, 11, 0.1); border-radius: 10px; border: 1px solid rgba(245, 158, 11, 0.2);">
                <div style="font-size: 28px; font-weight: 700; color: #f59e0b;">\${dashboardData.vendorRisk.highRiskVendors}</div>
                <div style="font-size: 11px; color: var(--text-muted);">High Risk</div>
              </div>
            </div>
            <div style="background: var(--bg-tertiary); border-radius: 8px; padding: 12px;">
              <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">Vendor Risk Distribution</div>
              <div style="display: flex; height: 20px; border-radius: 4px; overflow: hidden;">
                <div style="width: \${dashboardData.vendorRisk.total > 0 ? (dashboardData.vendorRisk.criticalVendors / dashboardData.vendorRisk.total * 100) : 0}%; background: #ef4444;"></div>
                <div style="width: \${dashboardData.vendorRisk.total > 0 ? (dashboardData.vendorRisk.highRiskVendors / dashboardData.vendorRisk.total * 100) : 0}%; background: #f59e0b;"></div>
                <div style="flex: 1; background: #22c55e;"></div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Footer Note -->
        <div style="margin-top: 24px; padding: 16px; background: var(--bg-tertiary); border-radius: 12px; text-align: center;">
          <div style="font-size: 12px; color: var(--text-muted);">
            <i class="fas fa-info-circle" style="margin-right: 6px;"></i>
            This summary reflects the current state of your GRC posture. Data is automatically updated as assessments are completed.
            <br>
            <span style="font-size: 11px;">Last updated: \${new Date().toLocaleString()} | Analysis Mode: Basic</span>
          </div>
        </div>
      \`;
      
      // Set organization name from the header badge
      const orgNameEl = document.querySelector('.exec-org-name');
      if (orgNameEl) {
        const orgName = document.querySelector('.org-badge span')?.textContent || 'Organization';
        orgNameEl.textContent = orgName;
      }
      
      // Optionally load trend chart
      setTimeout(() => loadExecutiveTrendChart(trendsData), 100);
    }
    
    // Load mini trend chart for executive summary
    function loadExecutiveTrendChart(trendsData) {
      // This could add a mini sparkline chart if needed
      // For now, the page is complete without additional charts
    }
    
    // Export Executive Summary as PDF
    async function exportExecutivePDF() {
      showAlert('Generating executive summary PDF...', 'info');
      
      try {
        // Load jsPDF if not already loaded
        if (!window.jspdf) {
          const jspdfScript = document.createElement('script');
          jspdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
          document.head.appendChild(jspdfScript);
          await new Promise(resolve => jspdfScript.onload = resolve);
        }
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'mm', 'a4'); // Landscape for executive summary
        const pageWidth = 297;
        const pageHeight = 210;
        const margin = 15;
        
        const [dashboardData, complianceData] = await Promise.all([
          api('/dashboard'),
          api('/compliance/dashboard?mode=basic')
        ]);
        
        const isoFramework = complianceData.frameworks.find(f => f.id === 'fw-iso27001');
        const orgNameForPDF = document.querySelector('.org-badge span')?.textContent || 'Organization';
        const score = isoFramework?.score || 0;
        const statusColor = score >= 80 ? [34, 197, 94] : score >= 60 ? [234, 179, 8] : [239, 68, 68];
        const statusText = score >= 80 ? 'HEALTHY' : score >= 60 ? 'ATTENTION' : 'AT RISK';
        
        // ========== HEADER ==========
        doc.setFillColor(27, 54, 93);
        doc.rect(0, 0, pageWidth, 35, 'F');
        
        // Title
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text('GRC Executive Summary', margin, 18);
        
        // Organization name
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text(orgNameForPDF, margin, 28);
        
        // Date
        doc.text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), margin + 100, 28);
        
        // Status badge (right aligned)
        doc.setFillColor(...statusColor);
        doc.roundedRect(pageWidth - margin - 45, 10, 45, 18, 3, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(statusText, pageWidth - margin - 22.5, 22, { align: 'center' });
        
        let y = 45;
        
        // ========== KEY METRICS ROW ==========
        doc.setTextColor(27, 54, 93);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Key Performance Indicators', margin, y);
        y += 8;
        
        const metrics = [
          { label: 'ISO 27001', sublabel: 'Compliance', value: score + '%', color: statusColor },
          { label: 'Open Risks', sublabel: 'Total Active', value: String(dashboardData.riskSummary?.total || 0), color: (dashboardData.riskSummary?.critical || 0) > 0 ? [239, 68, 68] : [59, 130, 246] },
          { label: 'Controls', sublabel: 'At Risk', value: String(dashboardData.controlsLinked || 0), color: [139, 92, 246] },
          { label: 'Maturity', sublabel: 'Average', value: (complianceData.advancedMetrics?.avgMaturity || 0).toFixed(1) + '/5', color: [59, 130, 246] }
        ];
        
        const metricWidth = 62;
        const metricGap = 6;
        metrics.forEach((m, i) => {
          const x = margin + (i * (metricWidth + metricGap));
          
          // Card background
          doc.setFillColor(245, 247, 250);
          doc.roundedRect(x, y, metricWidth, 40, 4, 4, 'F');
          
          // Top color bar
          doc.setFillColor(...m.color);
          doc.roundedRect(x, y, metricWidth, 6, 4, 4, 'F');
          doc.rect(x, y + 3, metricWidth, 3, 'F');
          
          // Value
          doc.setTextColor(...m.color);
          doc.setFontSize(22);
          doc.setFont('helvetica', 'bold');
          doc.text(m.value, x + metricWidth/2, y + 24, { align: 'center' });
          
          // Labels
          doc.setTextColor(100, 100, 100);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.text(m.label, x + metricWidth/2, y + 32, { align: 'center' });
          doc.setFont('helvetica', 'normal');
          doc.text(m.sublabel, x + metricWidth/2, y + 37, { align: 'center' });
        });
        
        // ========== TWO-COLUMN LAYOUT ==========
        const leftColX = margin;
        const rightColX = margin + 145;
        const colWidth = 125;
        y = 100;
        
        // ---------- LEFT COLUMN: Framework Compliance ----------
        doc.setTextColor(27, 54, 93);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Framework Compliance Status', leftColX, y);
        y += 6;
        
        // Table header
        doc.setFillColor(240, 242, 245);
        doc.rect(leftColX, y, colWidth, 7, 'F');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(80, 80, 80);
        doc.text('Framework', leftColX + 2, y + 5);
        doc.text('Score', leftColX + 70, y + 5);
        doc.text('Progress', leftColX + 90, y + 5);
        y += 9;
        
        const applicableFrameworks = complianceData.frameworks.filter(fw => fw.is_applicable).slice(0, 6);
        applicableFrameworks.forEach((fw, i) => {
          const rowY = y + (i * 10);
          
          // Alternate row background
          if (i % 2 === 0) {
            doc.setFillColor(250, 250, 252);
            doc.rect(leftColX, rowY - 2, colWidth, 10, 'F');
          }
          
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(50, 50, 50);
          
          // Framework name (truncate if needed)
          const fwName = fw.name.length > 28 ? fw.name.substring(0, 25) + '...' : fw.name;
          doc.text(fwName, leftColX + 2, rowY + 4);
          
          // Score
          const fwScore = fw.score || 0;
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(fwScore >= 80 ? 34 : fwScore >= 60 ? 180 : 200, fwScore >= 80 ? 150 : fwScore >= 60 ? 130 : 50, fwScore >= 80 ? 80 : fwScore >= 60 ? 0 : 50);
          doc.text(fwScore + '%', leftColX + 70, rowY + 4);
          
          // Progress bar
          doc.setFillColor(220, 220, 220);
          doc.roundedRect(leftColX + 85, rowY + 1, 35, 4, 1, 1, 'F');
          const barColor = fwScore >= 80 ? [34, 197, 94] : fwScore >= 60 ? [234, 179, 8] : [239, 68, 68];
          doc.setFillColor(...barColor);
          doc.roundedRect(leftColX + 85, rowY + 1, Math.max(fwScore * 0.35, 1), 4, 1, 1, 'F');
          
          // Ratio
          doc.setTextColor(100, 100, 100);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6);
          doc.text(fw.implemented + '/' + fw.total, leftColX + 122, rowY + 4);
        });
        
        // ---------- RIGHT COLUMN: Risk Summary ----------
        let rightY = 100;
        doc.setTextColor(27, 54, 93);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Risk Summary', rightColX, rightY);
        rightY += 10;
        
        const risks = [
          { label: 'Critical', value: dashboardData.riskSummary?.critical || 0, color: [220, 38, 38], bg: [254, 226, 226] },
          { label: 'High', value: dashboardData.riskSummary?.high || 0, color: [234, 88, 12], bg: [255, 237, 213] },
          { label: 'Medium', value: dashboardData.riskSummary?.medium || 0, color: [202, 138, 4], bg: [254, 249, 195] },
          { label: 'Low', value: dashboardData.riskSummary?.low || 0, color: [22, 163, 74], bg: [220, 252, 231] }
        ];
        
        const riskItemWidth = 30;
        risks.forEach((r, i) => {
          const rX = rightColX + (i * (riskItemWidth + 4));
          
          // Background
          doc.setFillColor(...r.bg);
          doc.roundedRect(rX, rightY, riskItemWidth, 32, 3, 3, 'F');
          
          // Value
          doc.setTextColor(...r.color);
          doc.setFontSize(18);
          doc.setFont('helvetica', 'bold');
          doc.text(String(r.value), rX + riskItemWidth/2, rightY + 16, { align: 'center' });
          
          // Label
          doc.setFontSize(7);
          doc.setFont('helvetica', 'normal');
          doc.text(r.label, rX + riskItemWidth/2, rightY + 26, { align: 'center' });
        });
        
        rightY += 42;
        
        // ---------- TOP COMPLIANCE GAPS ----------
        doc.setTextColor(27, 54, 93);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Top Compliance Gaps', rightColX, rightY);
        rightY += 8;
        
        const gaps = complianceData.topGaps?.slice(0, 4) || [];
        if (gaps.length > 0) {
          gaps.forEach((gap, i) => {
            const gY = rightY + (i * 12);
            doc.setFontSize(8);
            
            // Number circle
            const numColor = gap.is_critical ? [220, 38, 38] : [234, 88, 12];
            doc.setFillColor(...numColor);
            doc.circle(rightColX + 4, gY + 2, 3, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.text(String(i + 1), rightColX + 4, gY + 3.5, { align: 'center' });
            
            // Control ID and Title
            doc.setTextColor(50, 50, 50);
            doc.setFont('helvetica', 'bold');
            doc.text(gap.control_id, rightColX + 10, gY + 3);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(80, 80, 80);
            const gapTitle = gap.title.length > 40 ? gap.title.substring(0, 37) + '...' : gap.title;
            doc.text(gapTitle, rightColX + 28, gY + 3);
          });
        } else {
          doc.setFontSize(9);
          doc.setTextColor(100, 100, 100);
          doc.text('No compliance gaps identified', rightColX, rightY + 5);
        }
        
        // ========== FOOTER ==========
        doc.setFillColor(27, 54, 93);
        doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');
        doc.setTextColor(200, 210, 220);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text('GRC Pulse - Governance, Risk & Compliance Platform', margin, pageHeight - 5);
        doc.text('https://grc-pulse.pages.dev', margin + 90, pageHeight - 5);
        doc.text('Generated: ' + new Date().toLocaleString(), pageWidth - margin - 50, pageHeight - 5);
        
        doc.save('GRC-Executive-Summary-' + new Date().toISOString().split('T')[0] + '.pdf');
        showAlert('Executive summary PDF downloaded!', 'success');
        
      } catch (error) {
        console.error('Executive PDF export error:', error);
        showAlert('Failed to generate PDF: ' + error.message, 'error');
      }
    }

    // Risks
    // Risk Register state for pagination
    let riskPage = 1;
    const riskPageSize = 10;
    let riskStatusFilter = '';
    
    async function loadRisks(page = 1) {
      riskPage = page;
      const offset = (page - 1) * riskPageSize;
      const statusParam = riskStatusFilter ? '&status=' + riskStatusFilter : '';
      const data = await api('/risks?limit=' + riskPageSize + '&offset=' + offset + statusParam);
      
      document.getElementById('page-actions').innerHTML = \`
        <div style="display: flex; gap: 12px; align-items: center;">
          <select class="form-select" style="width: 150px; padding: 6px 10px;" onchange="filterRisksByStatus(this.value)">
            <option value="">All Status</option>
            <option value="open" \${riskStatusFilter === 'open' ? 'selected' : ''}>Open</option>
            <option value="in_progress" \${riskStatusFilter === 'in_progress' ? 'selected' : ''}>In Progress</option>
            <option value="mitigated" \${riskStatusFilter === 'mitigated' ? 'selected' : ''}>Mitigated</option>
            <option value="closed" \${riskStatusFilter === 'closed' ? 'selected' : ''}>Closed</option>
          </select>
          <button class="btn btn-secondary" onclick="syncPentestFindings()"><i class="fas fa-sync"></i> Sync PentestPulse</button>
          <button class="btn btn-primary" onclick="showRiskModal()"><i class="fas fa-plus"></i> Add Risk</button>
        </div>
      \`;
      
      if (data.risks.length === 0) {
        document.getElementById('risks-page').innerHTML = '<div class="card"><div class="empty-state"><i class="fas fa-check-circle" style="font-size: 48px; color: var(--accent-green); margin-bottom: 16px;"></i><p>No risks found.</p><button class="btn btn-primary" style="margin-top: 16px;" onclick="showRiskModal()"><i class="fas fa-plus"></i> Add Risk</button></div></div>';
        return;
      }
      
      const totalPages = Math.ceil(data.total / riskPageSize);
      
      document.getElementById('risks-page').innerHTML = \`
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div style="color: var(--text-muted); font-size: 14px;">
              Showing <strong>\${offset + 1}-\${Math.min(offset + riskPageSize, data.total)}</strong> of <strong>\${data.total}</strong> risks
            </div>
          </div>
          <table>
            <thead><tr><th>Risk</th><th>Source</th><th>Category</th><th>Risk Score</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              \${data.risks.map(r => {
                // Parse ai_analysis to get risk data (works for all sources)
                let riskData = {};
                try { riskData = JSON.parse(r.ai_analysis || '{}'); } catch(e) {}
                
                // Get risk score: prefer ai_analysis.risk_score, then calculate from likelihood/impact
                let riskScore = riskData.risk_score;
                if (!riskScore && r.inherent_likelihood && r.inherent_impact) {
                  // Convert 0-1 to 1-5 and multiply
                  riskScore = Math.round(r.inherent_likelihood * 5) * Math.round(r.inherent_impact * 5);
                }
                riskScore = riskScore || Math.round(r.context_priority_score / 4) || 0; // Fallback: convert 0-100 to 0-25
                
                // Ensure score is in 1-25 range
                riskScore = Math.min(25, Math.max(0, riskScore));
                
                const scorePercent = (riskScore / 25) * 100;
                const severity = riskData.severity || (riskScore >= 20 ? 'critical' : riskScore >= 13 ? 'high' : riskScore >= 6 ? 'medium' : 'low');
                
                // Source badge styling
                const sourceStyles = {
                  'penetration_test': { bg: 'linear-gradient(135deg, #1b365d, #4a90e2)', icon: 'fa-crosshairs', label: 'Pentest' },
                  'vulnerability_scan': { bg: 'linear-gradient(135deg, #7c3aed, #a78bfa)', icon: 'fa-radar', label: 'Vuln Scan' },
                  'audit_finding': { bg: 'linear-gradient(135deg, #059669, #34d399)', icon: 'fa-clipboard-check', label: 'Audit' },
                  'self_assessment': { bg: 'linear-gradient(135deg, #d97706, #fbbf24)', icon: 'fa-user-check', label: 'Self Assess' },
                  'vendor_assessment': { bg: 'linear-gradient(135deg, #dc2626, #f87171)', icon: 'fa-building', label: 'Vendor' },
                  'threat_intel': { bg: 'linear-gradient(135deg, #0891b2, #22d3ee)', icon: 'fa-globe', label: 'Threat Intel' },
                  'incident': { bg: 'linear-gradient(135deg, #be123c, #fb7185)', icon: 'fa-bolt', label: 'Incident' },
                  'manual': { bg: '#374151', icon: 'fa-edit', label: 'Manual' }
                };
                const sourceStyle = sourceStyles[r.risk_source] || sourceStyles['manual'];
                
                return \`
                <tr>
                  <td>
                    <div style="font-weight: 500;">\${r.title}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">\${r.asset_name || 'No asset'}</div>
                  </td>
                  <td>
                    <span class="badge" style="background: \${sourceStyle.bg}; color: white; font-size: 10px;">
                      <i class="fas \${sourceStyle.icon}" style="margin-right: 4px;"></i>\${sourceStyle.label}
                    </span>
                  </td>
                  <td><span class="badge \${severity}">\${r.category || 'N/A'}</span></td>
                  <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="font-weight: 600; min-width: 45px; color: \${riskScore >= 20 ? '#dc2626' : riskScore >= 13 ? '#f59e0b' : riskScore >= 6 ? '#eab308' : '#22c55e'};">\${riskScore}/25</span>
                      <div class="priority-bar"><div class="priority-bar-fill \${severity}" style="width: \${scorePercent}%"></div></div>
                    </div>
                  </td>
                  <td>
                    <select class="status-select status-\${r.status}" onchange="quickUpdateRiskStatus('\${r.id}', this.value)" style="padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; border: none; background: \${r.status === 'open' ? 'rgba(239, 68, 68, 0.2)' : r.status === 'in_progress' ? 'rgba(245, 158, 11, 0.2)' : r.status === 'mitigated' ? 'rgba(34, 197, 94, 0.2)' : r.status === 'accepted' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(107, 114, 128, 0.2)'}; color: \${r.status === 'open' ? '#ef4444' : r.status === 'in_progress' ? '#f59e0b' : r.status === 'mitigated' ? '#22c55e' : r.status === 'accepted' ? '#3b82f6' : '#6b7280'};">
                      <option value="open" \${r.status === 'open' ? 'selected' : ''}>Open</option>
                      <option value="in_progress" \${r.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                      <option value="mitigated" \${r.status === 'mitigated' ? 'selected' : ''}>Mitigated</option>
                      <option value="accepted" \${r.status === 'accepted' ? 'selected' : ''}>Accepted</option>
                      <option value="closed" \${r.status === 'closed' ? 'selected' : ''}>Closed</option>
                    </select>
                  </td>
                  <td>
                    <button class="btn btn-secondary" style="padding: 4px 8px;" onclick="showRiskModal('\${r.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger" style="padding: 4px 8px;" onclick="deleteRisk('\${r.id}')"><i class="fas fa-trash"></i></button>
                  </td>
                </tr>
              \`}).join('')}
            </tbody>
          </table>
          
          \${totalPages > 1 ? \`
          <div style="display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border-color);">
            <button class="btn btn-secondary" style="padding: 6px 12px;" onclick="loadRisks(1)" \${page === 1 ? 'disabled' : ''}>
              <i class="fas fa-angle-double-left"></i>
            </button>
            <button class="btn btn-secondary" style="padding: 6px 12px;" onclick="loadRisks(\${page - 1})" \${page === 1 ? 'disabled' : ''}>
              <i class="fas fa-angle-left"></i>
            </button>
            <span style="padding: 0 16px; color: var(--text-secondary);">
              Page <strong>\${page}</strong> of <strong>\${totalPages}</strong>
            </span>
            <button class="btn btn-secondary" style="padding: 6px 12px;" onclick="loadRisks(\${page + 1})" \${page === totalPages ? 'disabled' : ''}>
              <i class="fas fa-angle-right"></i>
            </button>
            <button class="btn btn-secondary" style="padding: 6px 12px;" onclick="loadRisks(\${totalPages})" \${page === totalPages ? 'disabled' : ''}>
              <i class="fas fa-angle-double-right"></i>
            </button>
          </div>
          \` : ''}
        </div>
      \`;
    }
    
    function filterRisksByStatus(status) {
      riskStatusFilter = status;
      loadRisks(1);
    }
    
    async function syncPentestFindings() {
      // Show syncing modal
      document.getElementById('modal-container').innerHTML = \`
        <div class="modal-overlay">
          <div class="modal" style="max-width: 500px; text-align: center;">
            <div class="modal-body" style="padding: 40px;">
              <div id="sync-status">
                <i class="fas fa-sync fa-spin" style="font-size: 48px; color: #4a90e2; margin-bottom: 20px;"></i>
                <h3 style="margin-bottom: 8px; color: var(--text-primary);">Syncing with PentestPulse...</h3>
                <p style="color: var(--text-muted);">Fetching latest findings from PentestPulse</p>
              </div>
            </div>
          </div>
        </div>
      \`;
      
      try {
        // Call the pull sync endpoint
        // No need to pass org_id - API gets it from authenticated session
        const response = await fetch('/api/sync/pentest/pull', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });
        
        const result = await response.json();
        
        if (result.success) {
          // Also sync assets from PentestPulse
          let assetSyncResult = null;
          try {
            const assetSync = await fetch('/api/sync/pentest/assets', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include'
            });
            assetSyncResult = await assetSync.json();
          } catch (e) { console.log('Asset sync skipped:', e); }
          
          // Also sync control statuses to update compliance based on risks
          let controlSyncResult = null;
          try {
            const controlSync = await fetch('/api/controls/sync-risk-status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include'
            });
            controlSyncResult = await controlSync.json();
          } catch (e) { console.log('Control sync skipped:', e); }
          
          // Show success
          // ADVISORY MODE: No auto-updates, only recommendations
          const controlsNeedingReview = controlSyncResult?.summary?.controls_needing_review || 0;
          const controlsWithWarnings = controlSyncResult?.summary?.controls_with_warnings || 0;
          const totalControlsAnalyzed = controlSyncResult?.summary?.total_controls || 0;
          const complianceScore = controlSyncResult?.compliance_impact?.current_score || 0;
          const autoMappings = result.results?.auto_mappings_created || 0;
          const assetsCreated = assetSyncResult?.results?.created || 0;
          const assetsUpdated = assetSyncResult?.results?.updated || 0;
          const totalAssets = assetSyncResult?.results?.total || 0;
          
          // Get detailed severity breakdown from the sync results
          const controlDetails = controlSyncResult?.details || [];
          
          // Calculate controls needing attention and severity impact
          const controlsNeedAttention = controlDetails.filter(c => c.needsReview || c.openRisks > 0);
          const criticalControls = controlDetails.filter(c => c.severityBreakdown?.critical > 0);
          const highRiskControls = controlDetails.filter(c => c.severityBreakdown?.high > 0 && !c.severityBreakdown?.critical);
          const mediumControls = controlDetails.filter(c => c.severityBreakdown?.medium > 0 && !c.severityBreakdown?.critical && !c.severityBreakdown?.high);
          
          // Calculate UNIQUE findings - collect all unique risk IDs across controls
          const uniqueRisks = new Map();
          controlDetails.forEach((ctrl) => {
            if (ctrl.riskDetails && Array.isArray(ctrl.riskDetails)) {
              ctrl.riskDetails.forEach((risk) => {
                if (risk.status === 'open' || risk.status === 'in_progress') {
                  uniqueRisks.set(risk.id, {
                    id: risk.id,
                    title: risk.title,
                    severity: risk.severity,
                    status: risk.status
                  });
                }
              });
            }
          });
          
          // Count unique findings by severity
          const uniqueFindings = {
            total: uniqueRisks.size,
            critical: [...uniqueRisks.values()].filter(r => r.severity === 'critical').length,
            high: [...uniqueRisks.values()].filter(r => r.severity === 'high').length,
            medium: [...uniqueRisks.values()].filter(r => r.severity === 'medium').length,
            low: [...uniqueRisks.values()].filter(r => r.severity === 'low').length
          };
          
          // Calculate severity-based impact summary (controls affected, not finding counts)
          const severityImpact = { critical: 0, high: 0, medium: 0, low: 0 };
          controlDetails.forEach((ctrl) => {
            if (ctrl.severityBreakdown) {
              severityImpact.critical += ctrl.severityBreakdown.critical || 0;
              severityImpact.high += ctrl.severityBreakdown.high || 0;
              severityImpact.medium += ctrl.severityBreakdown.medium || 0;
              severityImpact.low += ctrl.severityBreakdown.low || 0;
            }
          });
          
          // Build severity breakdown HTML
          const hasSeverityData = severityImpact.critical > 0 || severityImpact.high > 0 || severityImpact.medium > 0 || severityImpact.low > 0;
          
          // Build ADVISORY control section (no auto-changes, only recommendations)
          let controlChangesHtml = '';
          if (controlsNeedAttention.length > 0 || controlsWithWarnings > 0) {
            controlChangesHtml = \`
              <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-color);">
                <div style="font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase;">
                  <i class="fas fa-clipboard-check" style="margin-right: 6px;"></i>Control Impact Analysis (Advisory)
                </div>
                
                <!-- Advisory Notice -->
                <div style="background: rgba(99, 102, 241, 0.1); padding: 10px; border-radius: 6px; margin-bottom: 10px; border-left: 3px solid #6366f1;">
                  <div style="font-size: 11px; font-weight: 600; color: #6366f1; margin-bottom: 4px;">
                    <i class="fas fa-info-circle"></i> Advisory Mode - No Auto-Changes
                  </div>
                  <div style="font-size: 10px; color: var(--text-muted);">
                    Gap Assessment is a manual process. Review findings below and update control status in Gap Assessment if needed.
                  </div>
                </div>
                
                <!-- Controls Summary -->
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 10px;">
                  <div style="text-align: center; padding: 8px; background: rgba(245, 158, 11, 0.1); border-radius: 6px;">
                    <div style="font-size: 20px; font-weight: 700; color: #f59e0b;">\${controlsNeedAttention.length}</div>
                    <div style="font-size: 10px; color: #f59e0b;">Need Review</div>
                  </div>
                  <div style="text-align: center; padding: 8px; background: rgba(34, 197, 94, 0.1); border-radius: 6px;">
                    <div style="font-size: 20px; font-weight: 700; color: #22c55e;">\${totalControlsAnalyzed - controlsNeedAttention.length}</div>
                    <div style="font-size: 10px; color: #22c55e;">No Issues</div>
                  </div>
                </div>
                
                <!-- Unique Findings Summary -->
                \${uniqueFindings.total > 0 ? \`
                <div style="background: var(--bg-tertiary); padding: 10px; border-radius: 6px; margin-bottom: 10px; border: 1px solid var(--border);">
                  <div style="font-size: 10px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; text-transform: uppercase;">
                    <i class="fas fa-bug" style="margin-right: 4px;"></i>Open Pentest Findings Summary
                  </div>
                  <div style="font-size: 13px; color: var(--text-primary); margin-bottom: 6px;">
                    <strong>\${uniqueFindings.total} unique finding(s)</strong> affect <strong>\${controlsNeedAttention.length} control(s)</strong>
                  </div>
                  <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    \${uniqueFindings.critical > 0 ? \`<span style="background: rgba(220, 38, 38, 0.15); color: #dc2626; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;">\${uniqueFindings.critical} Critical</span>\` : ''}
                    \${uniqueFindings.high > 0 ? \`<span style="background: rgba(234, 88, 12, 0.15); color: #ea580c; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;">\${uniqueFindings.high} High</span>\` : ''}
                    \${uniqueFindings.medium > 0 ? \`<span style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;">\${uniqueFindings.medium} Medium</span>\` : ''}
                    \${uniqueFindings.low > 0 ? \`<span style="background: rgba(107, 114, 128, 0.15); color: #6b7280; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;">\${uniqueFindings.low} Low</span>\` : ''}
                  </div>
                </div>
                \` : ''}
                
                \${criticalControls.length > 0 ? \`
                <div style="background: rgba(220, 38, 38, 0.05); padding: 10px; border-radius: 6px; margin-bottom: 8px; border-left: 3px solid #dc2626;">
                  <div style="font-size: 11px; font-weight: 600; color: #dc2626; margin-bottom: 6px;">
                    <i class="fas fa-exclamation-circle"></i> \${uniqueFindings.critical} Critical finding(s) → \${criticalControls.length} control(s) need review
                  </div>
                  <div style="font-size: 10px; color: var(--text-muted); line-height: 1.5;">
                    <strong>Controls:</strong> \${criticalControls.slice(0, 5).map(c => c.control_code).join(', ')}\${criticalControls.length > 5 ? ' +' + (criticalControls.length - 5) + ' more' : ''}
                  </div>
                </div>
                \` : ''}
                
                \${highRiskControls.length > 0 ? \`
                <div style="background: rgba(234, 88, 12, 0.05); padding: 10px; border-radius: 6px; margin-bottom: 8px; border-left: 3px solid #ea580c;">
                  <div style="font-size: 11px; font-weight: 600; color: #ea580c; margin-bottom: 6px;">
                    <i class="fas fa-exclamation-triangle"></i> \${uniqueFindings.high} High finding(s) → \${highRiskControls.length} control(s) need attention
                  </div>
                  <div style="font-size: 10px; color: var(--text-muted); line-height: 1.5;">
                    <strong>Controls:</strong> \${highRiskControls.slice(0, 5).map(c => c.control_code).join(', ')}\${highRiskControls.length > 5 ? ' +' + (highRiskControls.length - 5) + ' more' : ''}
                  </div>
                </div>
                \` : ''}
                
                \${mediumControls.length > 0 ? \`
                <div style="background: rgba(245, 158, 11, 0.05); padding: 10px; border-radius: 6px; margin-bottom: 8px; border-left: 3px solid #f59e0b;">
                  <div style="font-size: 11px; font-weight: 600; color: #f59e0b; margin-bottom: 6px;">
                    <i class="fas fa-eye"></i> \${uniqueFindings.medium} Medium finding(s) → \${mediumControls.length} control(s) to monitor
                  </div>
                  <div style="font-size: 10px; color: var(--text-muted); line-height: 1.5;">
                    <strong>Controls:</strong> \${mediumControls.slice(0, 5).map(c => c.control_code).join(', ')}\${mediumControls.length > 5 ? ' +' + (mediumControls.length - 5) + ' more' : ''}
                  </div>
                </div>
                \` : ''}
                
                \${controlsWithWarnings > 0 && criticalControls.length === 0 && highRiskControls.length === 0 && mediumControls.length === 0 ? \`
                <div style="background: rgba(245, 158, 11, 0.05); padding: 10px; border-radius: 6px; margin-bottom: 8px; border-left: 3px solid #f59e0b;">
                  <div style="font-size: 11px; font-weight: 600; color: #f59e0b; margin-bottom: 4px;">
                    <i class="fas fa-eye"></i> \${controlsWithWarnings} Control(s) Have Open Findings
                  </div>
                  <div style="font-size: 10px; color: var(--text-muted);">
                    Medium/Low severity findings linked. Monitor remediation progress.
                  </div>
                </div>
                \` : ''}
                
                <!-- Severity Impact Breakdown -->
                \${hasSeverityData ? \`
                <div style="background: var(--bg-tertiary); padding: 10px; border-radius: 6px; margin-bottom: 10px;">
                  <div style="font-size: 10px; font-weight: 600; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase;">
                    <i class="fas fa-chart-bar" style="margin-right: 4px;"></i>Open Risks by Severity (Weighted Impact)
                  </div>
                  <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;">
                    <div style="text-align: center; padding: 6px; background: rgba(220, 38, 38, 0.15); border-radius: 4px;">
                      <div style="font-size: 14px; font-weight: 700; color: #dc2626;">\${severityImpact.critical}</div>
                      <div style="font-size: 8px; color: #dc2626;">Critical</div>
                      <div style="font-size: 7px; color: #dc2626; opacity: 0.8;">4x weight</div>
                    </div>
                    <div style="text-align: center; padding: 6px; background: rgba(234, 88, 12, 0.15); border-radius: 4px;">
                      <div style="font-size: 14px; font-weight: 700; color: #ea580c;">\${severityImpact.high}</div>
                      <div style="font-size: 8px; color: #ea580c;">High</div>
                      <div style="font-size: 7px; color: #ea580c; opacity: 0.8;">3x weight</div>
                    </div>
                    <div style="text-align: center; padding: 6px; background: rgba(245, 158, 11, 0.15); border-radius: 4px;">
                      <div style="font-size: 14px; font-weight: 700; color: #f59e0b;">\${severityImpact.medium}</div>
                      <div style="font-size: 8px; color: #f59e0b;">Medium</div>
                      <div style="font-size: 7px; color: #f59e0b; opacity: 0.8;">2x weight</div>
                    </div>
                    <div style="text-align: center; padding: 6px; background: rgba(107, 114, 128, 0.15); border-radius: 4px;">
                      <div style="font-size: 14px; font-weight: 700; color: #6b7280;">\${severityImpact.low}</div>
                      <div style="font-size: 8px; color: #6b7280;">Low</div>
                      <div style="font-size: 7px; color: #6b7280; opacity: 0.8;">1x weight</div>
                    </div>
                  </div>
                </div>
                \` : ''}
                
                <!-- Compliance Score -->
                <div style="text-align: center; padding: 10px; background: var(--bg-tertiary); border-radius: 6px;">
                  <span style="font-size: 11px; color: var(--text-muted);">Current Compliance Score:</span>
                  <span style="font-size: 18px; font-weight: 700; color: \${complianceScore >= 80 ? '#22c55e' : complianceScore >= 60 ? '#f59e0b' : '#ef4444'}; margin-left: 8px;">\${complianceScore}%</span>
                </div>
                
                <!-- What To Do Next -->
                <div style="margin-top: 10px; padding: 10px; background: rgba(34, 197, 94, 0.05); border-radius: 6px; border-left: 3px solid #22c55e;">
                  <div style="font-size: 10px; font-weight: 600; color: #22c55e; margin-bottom: 6px;">
                    <i class="fas fa-tasks"></i> What To Do Next
                  </div>
                  <div style="font-size: 9px; color: var(--text-muted); line-height: 1.6;">
                    <div style="margin-bottom: 4px;"><strong>1.</strong> Go to <strong>Gap Assessment</strong> to review flagged controls</div>
                    <div style="margin-bottom: 4px;"><strong>2.</strong> Controls with open findings will show advisory warnings</div>
                    <div><strong>3.</strong> Update control status manually if the finding affects implementation</div>
                  </div>
                </div>
              </div>
            \`;
          }
          
          document.getElementById('sync-status').innerHTML = \`
            <i class="fas fa-check-circle" style="font-size: 48px; color: #22c55e; margin-bottom: 20px;"></i>
            <h3 style="margin-bottom: 8px; color: var(--text-primary);">Sync Complete!</h3>
            <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; margin: 20px 0; text-align: left; max-height: 400px; overflow-y: auto;">
              <!-- Findings Section -->
              <div style="margin-bottom: 12px;">
                <div style="font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase;">
                  <i class="fas fa-bug" style="margin-right: 6px;"></i>Findings
                </div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; text-align: center;">
                  <div>
                    <div style="font-size: 24px; font-weight: 700; color: #22c55e;">\${result.results.created}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">Created</div>
                  </div>
                  <div>
                    <div style="font-size: 24px; font-weight: 700; color: #4a90e2;">\${result.results.updated}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">Updated</div>
                  </div>
                  <div>
                    <div style="font-size: 24px; font-weight: 700; color: #ef4444;">\${result.results.deleted}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">Deleted</div>
                  </div>
                </div>
              </div>
              
              <!-- Assets Section -->
              \${totalAssets > 0 ? \`
              <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-color);">
                <div style="font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase;">
                  <i class="fas fa-server" style="margin-right: 6px;"></i>Assets
                </div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; text-align: center;">
                  <div>
                    <div style="font-size: 20px; font-weight: 700; color: #22c55e;">\${assetsCreated}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">Created</div>
                  </div>
                  <div>
                    <div style="font-size: 20px; font-weight: 700; color: #4a90e2;">\${assetsUpdated}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">Updated</div>
                  </div>
                  <div>
                    <div style="font-size: 20px; font-weight: 700; color: #6b7280;">\${totalAssets}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">Total</div>
                  </div>
                </div>
              </div>
              \` : ''}
              
              \${autoMappings > 0 ? \`
              <div style="text-align: center; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-color);">
                <span style="color: #8b5cf6;"><i class="fas fa-brain"></i> \${autoMappings} control mapping(s) auto-created</span>
              </div>
              \` : ''}
              
              \${controlChangesHtml}
              
              <div style="text-align: center; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-color);">
                <span style="color: var(--text-muted);">Total findings:</span>
                <span style="font-weight: 600; color: var(--text-primary); margin-left: 8px;">\${result.results.total}</span>
              </div>
              <div style="text-align: center; margin-top: 8px; font-size: 12px; color: var(--text-muted);">
                Organization: \${result.organization_id || 'Unknown'}
              </div>
            </div>
            <button class="btn btn-primary" onclick="closeModal(); loadRisks(1);" style="width: 100%;">
              <i class="fas fa-check" style="margin-right: 8px;"></i>Done
            </button>
          \`;
        } else {
          throw new Error(result.error || result.details || 'Sync failed');
        }
      } catch (error) {
        // Show error
        document.getElementById('sync-status').innerHTML = \`
          <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #ef4444; margin-bottom: 20px;"></i>
          <h3 style="margin-bottom: 8px; color: var(--text-primary);">Sync Failed</h3>
          <p style="color: var(--text-muted); margin-bottom: 20px;">\${error.message || 'Could not connect to PentestPulse'}</p>
          <div style="display: flex; gap: 12px;">
            <button class="btn btn-primary" onclick="syncPentestFindings()" style="flex: 1;">
              <i class="fas fa-redo" style="margin-right: 8px;"></i>Retry
            </button>
            <button class="btn btn-secondary" onclick="closeModal()" style="flex: 1;">
              Close
            </button>
          </div>
        \`;
      }
    }

    async function showRiskModal(id = null) {
      let risk = { title: '', description: '', risk_source: 'manual', category: 'operational', inherent_likelihood: 0.6, inherent_impact: 0.6, status: 'open' };
      const assets = await api('/assets');
      const users = await api('/users');
      
      if (id) {
        risk = await api('/risks/' + id);
      }
      
      // Convert 0-1 scale to 1-5 for display (existing data compatibility)
      const likelihood15 = Math.round((risk.inherent_likelihood || 0.6) * 5) || 3;
      const impact15 = Math.round((risk.inherent_impact || 0.6) * 5) || 3;
      const riskScore = likelihood15 * impact15;
      
      document.getElementById('modal-container').innerHTML = \`
        <div class="modal-overlay" onclick="closeModal(event)">
          <div class="modal" onclick="event.stopPropagation()">
            <div class="modal-header">
              <h3 class="modal-title">\${id ? 'Edit Risk' : 'Add Risk'}</h3>
              <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Title *</label>
                <input type="text" class="form-input" id="risk-title" value="\${risk.title}" placeholder="e.g., SQL Injection Vulnerability">
              </div>
              <div class="form-group">
                <label class="form-label">Description</label>
                <textarea class="form-textarea" id="risk-description" placeholder="Detailed description...">\${risk.description || ''}</textarea>
              </div>
              <div class="grid-2">
                <div class="form-group">
                  <label class="form-label">Source</label>
                  <select class="form-select" id="risk-source">
                    <option value="manual" \${risk.risk_source === 'manual' ? 'selected' : ''}>Manual</option>
                    <option value="vulnerability_scan" \${risk.risk_source === 'vulnerability_scan' ? 'selected' : ''}>Vulnerability Scan</option>
                    <option value="penetration_test" \${risk.risk_source === 'penetration_test' ? 'selected' : ''}>Penetration Test</option>
                    <option value="audit_finding" \${risk.risk_source === 'audit_finding' ? 'selected' : ''}>Audit Finding</option>
                    <option value="self_assessment" \${risk.risk_source === 'self_assessment' ? 'selected' : ''}>Self Assessment</option>
                    <option value="vendor_assessment" \${risk.risk_source === 'vendor_assessment' ? 'selected' : ''}>Vendor Assessment</option>
                    <option value="threat_intel" \${risk.risk_source === 'threat_intel' ? 'selected' : ''}>Threat Intelligence</option>
                    <option value="incident" \${risk.risk_source === 'incident' ? 'selected' : ''}>Incident</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Category</label>
                  <select class="form-select" id="risk-category">
                    <option value="vulnerability" \${risk.category === 'vulnerability' ? 'selected' : ''}>Vulnerability</option>
                    <option value="configuration" \${risk.category === 'configuration' ? 'selected' : ''}>Configuration</option>
                    <option value="compliance" \${risk.category === 'compliance' ? 'selected' : ''}>Compliance</option>
                    <option value="operational" \${risk.category === 'operational' ? 'selected' : ''}>Operational</option>
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Affected Asset</label>
                <select class="form-select" id="risk-asset">
                  <option value="">None</option>
                  \${assets.assets.map(a => \`<option value="\${a.id}" \${risk.affected_asset_id === a.id ? 'selected' : ''}>\${a.name} (\${a.asset_type})</option>\`).join('')}
                </select>
              </div>
              <div class="grid-2">
                <div class="form-group">
                  <label class="form-label">Likelihood (1-5)</label>
                  <select class="form-select" id="risk-likelihood" onchange="updateRiskScore()">
                    <option value="1" \${likelihood15 === 1 ? 'selected' : ''}>1 - Very Low</option>
                    <option value="2" \${likelihood15 === 2 ? 'selected' : ''}>2 - Low</option>
                    <option value="3" \${likelihood15 === 3 ? 'selected' : ''}>3 - Medium</option>
                    <option value="4" \${likelihood15 === 4 ? 'selected' : ''}>4 - High</option>
                    <option value="5" \${likelihood15 === 5 ? 'selected' : ''}>5 - Very High</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Impact (1-5)</label>
                  <select class="form-select" id="risk-impact" onchange="updateRiskScore()">
                    <option value="1" \${impact15 === 1 ? 'selected' : ''}>1 - Very Low</option>
                    <option value="2" \${impact15 === 2 ? 'selected' : ''}>2 - Low</option>
                    <option value="3" \${impact15 === 3 ? 'selected' : ''}>3 - Medium</option>
                    <option value="4" \${impact15 === 4 ? 'selected' : ''}>4 - High</option>
                    <option value="5" \${impact15 === 5 ? 'selected' : ''}>5 - Very High</option>
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Risk Score (auto-calculated)</label>
                <div id="risk-score-display" style="padding: 12px; background: var(--bg-secondary); border-radius: 8px; display: flex; align-items: center; gap: 12px;">
                  <span id="risk-score-value" style="font-size: 24px; font-weight: bold; color: \${riskScore >= 20 ? '#dc2626' : riskScore >= 13 ? '#f59e0b' : riskScore >= 6 ? '#eab308' : '#22c55e'};">\${riskScore}/25</span>
                  <span id="risk-score-label" style="color: var(--text-muted);">\${riskScore >= 20 ? 'Critical' : riskScore >= 13 ? 'High' : riskScore >= 6 ? 'Medium' : 'Low'}</span>
                  <div style="flex: 1; height: 8px; background: var(--bg-tertiary); border-radius: 4px; overflow: hidden;">
                    <div id="risk-score-bar" style="height: 100%; width: \${(riskScore/25)*100}%; background: \${riskScore >= 20 ? '#dc2626' : riskScore >= 13 ? '#f59e0b' : riskScore >= 6 ? '#eab308' : '#22c55e'}; transition: all 0.3s;"></div>
                  </div>
                </div>
              </div>
              <div class="grid-2">
                <div class="form-group">
                  <label class="form-label">Status</label>
                  <select class="form-select" id="risk-status">
                    <option value="open" \${risk.status === 'open' ? 'selected' : ''}>Open</option>
                    <option value="in_progress" \${risk.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                    <option value="mitigated" \${risk.status === 'mitigated' ? 'selected' : ''}>Mitigated</option>
                    <option value="accepted" \${risk.status === 'accepted' ? 'selected' : ''}>Accepted</option>
                    <option value="closed" \${risk.status === 'closed' ? 'selected' : ''}>Closed</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Assignee</label>
                  <select class="form-select" id="risk-assignee">
                    <option value="">Unassigned</option>
                    \${users.users.map(u => \`<option value="\${u.id}" \${risk.assignee_id === u.id ? 'selected' : ''}>\${u.display_name}</option>\`).join('')}
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Due Date</label>
                <input type="date" class="form-input" id="risk-due" value="\${risk.due_date ? risk.due_date.split('T')[0] : ''}">
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
              <button class="btn btn-primary" onclick="saveRisk('\${id || ''}')">\${id ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      \`;
    }
    
    function updateRiskScore() {
      const likelihood = parseInt(document.getElementById('risk-likelihood').value);
      const impact = parseInt(document.getElementById('risk-impact').value);
      const score = likelihood * impact;
      const color = score >= 20 ? '#dc2626' : score >= 13 ? '#f59e0b' : score >= 6 ? '#eab308' : '#22c55e';
      const label = score >= 20 ? 'Critical' : score >= 13 ? 'High' : score >= 6 ? 'Medium' : 'Low';
      
      document.getElementById('risk-score-value').textContent = score + '/25';
      document.getElementById('risk-score-value').style.color = color;
      document.getElementById('risk-score-label').textContent = label;
      document.getElementById('risk-score-bar').style.width = (score/25)*100 + '%';
      document.getElementById('risk-score-bar').style.background = color;
    }

    async function saveRisk(id) {
      const likelihood15 = parseInt(document.getElementById('risk-likelihood').value);
      const impact15 = parseInt(document.getElementById('risk-impact').value);
      const riskScore = likelihood15 * impact15;
      
      const data = {
        title: document.getElementById('risk-title').value,
        description: document.getElementById('risk-description').value,
        risk_source: document.getElementById('risk-source').value,
        category: document.getElementById('risk-category').value,
        affected_asset_id: document.getElementById('risk-asset').value || null,
        // Store as 0-1 for DB compatibility, but also store original 1-5 values
        inherent_likelihood: likelihood15 / 5,
        inherent_impact: impact15 / 5,
        // Store risk score in context_priority_score for display
        context_priority_score: riskScore,
        // Store original values in ai_analysis
        ai_analysis: JSON.stringify({
          risk_score: riskScore,
          likelihood: likelihood15,
          impact: impact15,
          severity: riskScore >= 20 ? 'critical' : riskScore >= 13 ? 'high' : riskScore >= 6 ? 'medium' : 'low'
        }),
        status: document.getElementById('risk-status').value,
        assignee_id: document.getElementById('risk-assignee').value || null,
        due_date: document.getElementById('risk-due').value || null
      };
      
      if (!data.title) {
        showAlert('Title is required', 'error');
        return;
      }
      
      try {
        if (id) {
          await api('/risks/' + id, { method: 'PATCH', body: JSON.stringify(data) });
          showAlert('Risk updated successfully');
        } else {
          await api('/risks', { method: 'POST', body: JSON.stringify(data) });
          showAlert('Risk created successfully');
        }
        closeModal();
        loadRisks();
      } catch (error) {
        showAlert(error.message, 'error');
      }
    }

    async function deleteRisk(id) {
      if (!confirm('Are you sure you want to delete this risk?')) return;
      try {
        await api('/risks/' + id, { method: 'DELETE' });
        showAlert('Risk deleted successfully');
        loadRisks();
      } catch (error) {
        showAlert(error.message, 'error');
      }
    }

    async function quickUpdateRiskStatus(id, newStatus) {
      try {
        await api('/risks/' + id, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
        showAlert('Status updated to ' + newStatus.replace('_', ' '), 'success');
        // Refresh the list to update colors
        loadRisks();
      } catch (error) {
        showAlert('Failed to update status: ' + error.message, 'error');
        loadRisks(); // Reload to reset dropdown
      }
    }

    // ============================================================================
    // RISK MITIGATION PAGE - Control-Risk Linking
    // ============================================================================
    
    // Track current risk source filter for suggestions
    let currentSuggestionSourceFilter = 'all';
    
    async function loadRiskMitigation(sourceFilter) {
      if (sourceFilter !== undefined) currentSuggestionSourceFilter = sourceFilter;
      const filterParam = currentSuggestionSourceFilter !== 'all' ? 'risk_source=' + currentSuggestionSourceFilter : '';
      
      // Fetch summary data, suggestions, and risk sources in parallel
      const [summaryData, suggestionsData, risksData, sourceCountsData] = await Promise.all([
        api('/control-risk-mappings/summary'),
        api('/control-risk-mappings/suggestions?' + filterParam),
        api('/risks?limit=100'),
        api('/risks/source-counts')
      ]);
      
      const summary = summaryData.summary || {};
      const suggestions = suggestionsData.suggestions || [];
      const risks = risksData.risks || [];
      const sourceCounts = sourceCountsData.counts || [];
      
      document.getElementById('page-actions').innerHTML = '';
      
      document.getElementById('risk-mitigation-page').innerHTML = \`
        <style>
          .mitigation-card { background: var(--card-bg); border-radius: 16px; padding: 20px; border: 1px solid var(--border); }
          .mitigation-stat { text-align: center; padding: 20px; background: var(--bg-tertiary); border-radius: 12px; }
          .mitigation-stat-value { font-size: 32px; font-weight: 800; }
          .mitigation-stat-label { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
          .mapping-item { display: flex; align-items: center; gap: 16px; padding: 16px; background: var(--bg-tertiary); border-radius: 12px; margin-bottom: 12px; }
          .mapping-badge { padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; }
          .suggestion-item { display: flex; align-items: center; gap: 12px; padding: 14px; background: var(--bg-tertiary); border-radius: 10px; margin-bottom: 10px; border-left: 4px solid var(--accent-blue); }
          .unlinked-risk { padding: 12px 16px; background: rgba(239, 68, 68, 0.08); border-radius: 10px; margin-bottom: 8px; border-left: 4px solid #ef4444; }
        </style>
        
        <div class="page-header" style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h1><i class="fas fa-shield-virus" style="margin-right: 12px; color: var(--accent-green);"></i>Risk Mitigation</h1>
            <p class="text-muted">Link ISO 27001 controls to risks for comprehensive mitigation tracking</p>
          </div>
          <button onclick="syncControlStatus()" id="sync-control-btn"
            style="padding: 10px 16px; background: linear-gradient(135deg, #8b5cf6, #6366f1); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 8px; box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);">
            <i class="fas fa-sync-alt"></i> Sync Control Status
          </button>
        </div>
        
        <!-- Summary Stats -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin-bottom: 24px;">
          <div class="mitigation-stat" style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.05)); border: 1px solid rgba(59, 130, 246, 0.2);">
            <div class="mitigation-stat-value" style="color: #3b82f6;">\${summary.totalMappings || 0}</div>
            <div class="mitigation-stat-label">Total Mappings</div>
          </div>
          <div class="mitigation-stat" style="background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05)); border: 1px solid rgba(34, 197, 94, 0.2);">
            <div class="mitigation-stat-value" style="color: #22c55e;">\${summary.totalLinkedControls || 0}</div>
            <div class="mitigation-stat-label">Linked Controls</div>
          </div>
          <div class="mitigation-stat" style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.05)); border: 1px solid rgba(245, 158, 11, 0.2);">
            <div class="mitigation-stat-value" style="color: #f59e0b;">\${summary.totalLinkedRisks || 0}</div>
            <div class="mitigation-stat-label">Mitigated Risks</div>
          </div>
          <div class="mitigation-stat" style="background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.05)); border: 1px solid rgba(239, 68, 68, 0.2);">
            <div class="mitigation-stat-value" style="color: #ef4444;">\${(summary.unlinkedRisks || []).length}</div>
            <div class="mitigation-stat-label">Unlinked Risks</div>
          </div>
        </div>
        
        <!-- Two Column Layout -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: 24px;">
          
          <!-- AI Suggestions Panel -->
          <div class="mitigation-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <h3 style="margin: 0;">
                <i class="fas fa-lightbulb" style="color: #f59e0b; margin-right: 8px;"></i>
                AI-Suggested Mappings
              </h3>
              <div style="display: flex; align-items: center; gap: 12px;">
                <select id="suggestion-source-filter" onchange="loadRiskMitigation(this.value)"
                  style="padding: 6px 10px; background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 6px; color: var(--text-primary); font-size: 11px; cursor: pointer;">
                  <option value="all" \${currentSuggestionSourceFilter === 'all' ? 'selected' : ''}>📊 All Sources (\${sourceCountsData.total || 0})</option>
                  \${sourceCounts.map(sc => {
                    const icons = { penetration_test: '🔴', vulnerability_scan: '🟠', audit_finding: '🟡', self_assessment: '🔵', vendor_assessment: '🟣', threat_intel: '⚫', incident: '🔶', manual: '⚪' };
                    const labels = { penetration_test: 'Pentest', vulnerability_scan: 'Vuln Scan', audit_finding: 'Audit', self_assessment: 'Self Assessment', vendor_assessment: 'Vendor', threat_intel: 'Threat Intel', incident: 'Incident', manual: 'Manual' };
                    return \`<option value="\${sc.risk_source}" \${currentSuggestionSourceFilter === sc.risk_source ? 'selected' : ''}>\${icons[sc.risk_source] || '⚪'} \${labels[sc.risk_source] || sc.risk_source} (\${sc.count})</option>\`;
                  }).join('')}
                </select>
                <span style="font-size: 11px; color: var(--text-muted);">\${suggestions.length} suggestions</span>
              </div>
            </div>
            <div style="max-height: 400px; overflow-y: auto;">
              \${suggestions.length > 0 ? suggestions.slice(0, 8).map(s => \`
                <div class="suggestion-item">
                  <div style="flex: 1;">
                    <div style="font-size: 12px; font-weight: 600; color: var(--text-primary);">
                      <span style="color: var(--accent-blue);">\${s.control_code}</span>: \${s.control_title.substring(0, 40)}\${s.control_title.length > 40 ? '...' : ''}
                    </div>
                    <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                      → <span style="color: #ef4444;">\${s.risk_title.substring(0, 45)}\${s.risk_title.length > 45 ? '...' : ''}</span>
                      <span class="mapping-badge" style="margin-left: 6px; font-size: 9px; background: \${
                        s.risk_source === 'penetration_test' ? 'rgba(239, 68, 68, 0.2); color: #ef4444' :
                        s.risk_source === 'vulnerability_scan' ? 'rgba(249, 115, 22, 0.2); color: #f97316' :
                        s.risk_source === 'audit_finding' ? 'rgba(234, 179, 8, 0.2); color: #eab308' :
                        s.risk_source === 'self_assessment' ? 'rgba(59, 130, 246, 0.2); color: #3b82f6' :
                        'rgba(100, 100, 100, 0.2); color: var(--text-muted)'
                      };">\${s.risk_source === 'penetration_test' ? 'pentest' : s.risk_source === 'vulnerability_scan' ? 'vuln scan' : s.risk_source?.replace('_', ' ') || 'unknown'}</span>
                    </div>
                    <div style="font-size: 10px; color: var(--text-muted); margin-top: 4px;">
                      <i class="fas fa-magic" style="margin-right: 4px;"></i>\${s.reason}
                      <span class="mapping-badge" style="margin-left: 8px; background: \${s.implementation_status === 'implemented' ? 'rgba(34, 197, 94, 0.2); color: #22c55e' : s.implementation_status === 'in_progress' ? 'rgba(245, 158, 11, 0.2); color: #f59e0b' : 'rgba(100, 100, 100, 0.2); color: var(--text-muted)'};">
                        \${s.implementation_status || 'not started'}
                      </span>
                    </div>
                  </div>
                  <button onclick="applySuggestion('\${s.control_id}', '\${s.risk_id}', \${s.suggestion_weight})" 
                    style="padding: 8px 12px; background: var(--accent-green); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 11px; white-space: nowrap;">
                    <i class="fas fa-plus"></i> Link
                  </button>
                </div>
              \`).join('') : \`
                <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                  <i class="fas fa-check-circle" style="font-size: 32px; color: var(--accent-green); margin-bottom: 12px;"></i>
                  <div>All risks have been mapped to controls!</div>
                </div>
              \`}
            </div>
          </div>
          
          <!-- Unlinked Risks Panel -->
          <div class="mitigation-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <h3 style="margin: 0;">
                <i class="fas fa-exclamation-triangle" style="color: #ef4444; margin-right: 8px;"></i>
                Risks Without Controls
              </h3>
              <span style="font-size: 11px; color: var(--text-muted);">\${(summary.unlinkedRisks || []).length} unlinked</span>
            </div>
            <div style="max-height: 400px; overflow-y: auto;">
              \${(summary.unlinkedRisks || []).length > 0 ? (summary.unlinkedRisks || []).map(r => \`
                <div class="unlinked-risk">
                  <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                      <div style="font-size: 13px; font-weight: 600;">\${r.title}</div>
                      <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
                        <span class="mapping-badge" style="background: rgba(245, 158, 11, 0.2); color: #f59e0b;">\${r.status}</span>
                        <span style="margin-left: 8px;">\${r.risk_source}</span>
                      </div>
                    </div>
                    <button onclick="showLinkControlModal('\${r.id}', '\${r.title.replace(/'/g, "\\\\'")}')" 
                      style="padding: 6px 12px; background: var(--accent-blue); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 11px;">
                      <i class="fas fa-link"></i> Link
                    </button>
                  </div>
                </div>
              \`).join('') : \`
                <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                  <i class="fas fa-shield-alt" style="font-size: 32px; color: var(--accent-green); margin-bottom: 12px;"></i>
                  <div>All open risks are linked to controls!</div>
                </div>
              \`}
            </div>
          </div>
        </div>
        
        <!-- Existing Mappings Section -->
        <div class="mitigation-card" style="margin-top: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="margin: 0;">
              <i class="fas fa-link" style="color: var(--accent-blue); margin-right: 8px;"></i>
              Control-Risk Mappings
            </h3>
            <button onclick="showCreateMappingModal()" 
              style="padding: 8px 16px; background: var(--accent-blue); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;">
              <i class="fas fa-plus"></i> Create Mapping
            </button>
          </div>
          
          <!-- Top Linked Controls -->
          <div style="margin-bottom: 20px;">
            <h4 style="font-size: 14px; color: var(--text-secondary); margin-bottom: 12px;">
              <i class="fas fa-shield-alt" style="margin-right: 6px;"></i>Top Linked Controls
            </h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 12px;">
              \${(summary.topLinkedControls || []).map(c => \`
                <div style="padding: 14px; background: var(--bg-tertiary); border-radius: 10px; border-left: 4px solid var(--accent-green);">
                  <div style="font-weight: 600; color: var(--accent-blue);">\${c.control_id}</div>
                  <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">\${c.title.substring(0, 50)}\${c.title.length > 50 ? '...' : ''}</div>
                  <div style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">
                    <i class="fas fa-link" style="margin-right: 4px;"></i>\${c.risk_count} risks mitigated
                  </div>
                </div>
              \`).join('') || '<div style="color: var(--text-muted); padding: 20px; text-align: center;">No linked controls yet</div>'}
            </div>
          </div>
          
          <!-- Top Linked Risks -->
          <div>
            <h4 style="font-size: 14px; color: var(--text-secondary); margin-bottom: 12px;">
              <i class="fas fa-exclamation-circle" style="margin-right: 6px;"></i>Top Mitigated Risks
            </h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 12px;">
              \${(summary.topLinkedRisks || []).map(r => \`
                <div style="padding: 14px; background: var(--bg-tertiary); border-radius: 10px; border-left: 4px solid \${r.status === 'open' ? '#ef4444' : r.status === 'in_progress' ? '#f59e0b' : '#22c55e'};">
                  <div style="font-weight: 600;">\${r.title.substring(0, 40)}\${r.title.length > 40 ? '...' : ''}</div>
                  <div style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">
                    <span class="mapping-badge" style="background: \${r.status === 'open' ? 'rgba(239, 68, 68, 0.2); color: #ef4444' : r.status === 'in_progress' ? 'rgba(245, 158, 11, 0.2); color: #f59e0b' : 'rgba(34, 197, 94, 0.2); color: #22c55e'};">\${r.status}</span>
                    <span style="margin-left: 8px;"><i class="fas fa-shield-alt" style="margin-right: 4px;"></i>\${r.control_count} controls</span>
                  </div>
                </div>
              \`).join('') || '<div style="color: var(--text-muted); padding: 20px; text-align: center;">No linked risks yet</div>'}
            </div>
          </div>
        </div>
        
        <!-- Mapping Effectiveness Distribution -->
        <div class="mitigation-card" style="margin-top: 24px;">
          <h3 style="margin-bottom: 16px;">
            <i class="fas fa-chart-pie" style="color: var(--accent-purple); margin-right: 8px;"></i>
            Mapping Distribution
          </h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
            <!-- By Type -->
            <div>
              <h4 style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">By Mapping Type</h4>
              \${(summary.byType || []).map(t => {
                const colors = { mitigates: '#22c55e', detects: '#3b82f6', prevents: '#8b5cf6', reduces: '#f59e0b' };
                return \`
                  <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                    <div style="width: 12px; height: 12px; border-radius: 3px; background: \${colors[t.mapping_type] || '#6b7280'};"></div>
                    <span style="flex: 1; font-size: 12px; text-transform: capitalize;">\${t.mapping_type}</span>
                    <span style="font-weight: 600;">\${t.count}</span>
                  </div>
                \`;
              }).join('') || '<div style="color: var(--text-muted);">No mappings yet</div>'}
            </div>
            
            <!-- By Effectiveness -->
            <div>
              <h4 style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">By Effectiveness</h4>
              \${(summary.byEffectiveness || []).map(e => {
                const colors = { full: '#22c55e', partial: '#f59e0b', minimal: '#ef4444' };
                return \`
                  <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                    <div style="width: 12px; height: 12px; border-radius: 3px; background: \${colors[e.effectiveness] || '#6b7280'};"></div>
                    <span style="flex: 1; font-size: 12px; text-transform: capitalize;">\${e.effectiveness}</span>
                    <span style="font-weight: 600;">\${e.count}</span>
                  </div>
                \`;
              }).join('') || '<div style="color: var(--text-muted);">No mappings yet</div>'}
            </div>
          </div>
        </div>
      \`;
    }
    
    // Sync all control statuses based on linked risks
    async function syncControlStatus() {
      const btn = document.getElementById('sync-control-btn');
      const originalHtml = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';
      btn.disabled = true;
      
      try {
        const result = await api('/controls/sync-risk-status', { method: 'POST' });
        
        if (result.controls_updated > 0) {
          showAlert(\`✅ Synced \${result.total_controls} controls - \${result.controls_updated} updated based on risk status\`, 'success');
        } else {
          showAlert(\`✅ All \${result.total_controls} controls are already in sync with their linked risks\`, 'success');
        }
        
        // Reload the page to show updated data
        loadRiskMitigation();
      } catch (error) {
        showAlert('Failed to sync: ' + error.message, 'error');
      } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
      }
    }
    
    // Apply AI suggestion
    async function applySuggestion(controlId, riskId, weight) {
      try {
        await api('/control-risk-mappings/apply-suggestion', {
          method: 'POST',
          body: JSON.stringify({ control_id: controlId, risk_id: riskId, confidence_score: weight })
        });
        showAlert('Control-risk mapping created successfully! Control status auto-synced.', 'success');
        loadRiskMitigation();
      } catch (error) {
        showAlert('Failed to create mapping: ' + error.message, 'error');
      }
    }
    
    // Show modal to link a control to a risk
    async function showLinkControlModal(riskId, riskTitle) {
      // Fetch available controls
      const controlsData = await api('/compliance/controls');
      const controls = controlsData.controls || [];
      
      const modalHtml = \`
        <div class="modal-content" style="max-width: 600px;">
          <div class="modal-header">
            <h2><i class="fas fa-link" style="margin-right: 8px;"></i>Link Control to Risk</h2>
            <button class="close-btn" onclick="closeModal()">&times;</button>
          </div>
          <div class="modal-body">
            <div style="margin-bottom: 16px; padding: 12px; background: rgba(239, 68, 68, 0.1); border-radius: 8px; border-left: 4px solid #ef4444;">
              <div style="font-size: 12px; color: var(--text-muted);">Linking to Risk:</div>
              <div style="font-weight: 600;">\${riskTitle}</div>
            </div>
            
            <div class="form-group">
              <label>Select Control</label>
              <select id="link-control-select" class="form-control" style="padding: 10px;">
                <option value="">-- Select a control --</option>
                \${controls.map(c => \`
                  <option value="\${c.id}">\${c.control_id}: \${c.title.substring(0, 50)}\${c.title.length > 50 ? '...' : ''} (\${c.implementation_status || 'not started'})</option>
                \`).join('')}
              </select>
            </div>
            
            <div class="form-group">
              <label>Mapping Type</label>
              <select id="link-mapping-type" class="form-control">
                <option value="mitigates">Mitigates</option>
                <option value="detects">Detects</option>
                <option value="prevents">Prevents</option>
                <option value="reduces">Reduces</option>
              </select>
            </div>
            
            <div class="form-group">
              <label>Effectiveness</label>
              <select id="link-effectiveness" class="form-control">
                <option value="full">Full</option>
                <option value="partial" selected>Partial</option>
                <option value="minimal">Minimal</option>
              </select>
            </div>
            
            <div class="form-group">
              <label>Confidence Score (0-100)</label>
              <input type="number" id="link-confidence" class="form-control" value="80" min="0" max="100">
            </div>
            
            <div class="form-group">
              <label>Notes (optional)</label>
              <textarea id="link-notes" class="form-control" rows="2" placeholder="Additional notes about this mapping..."></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="createControlRiskMapping('\${riskId}')">
              <i class="fas fa-link"></i> Create Mapping
            </button>
          </div>
        </div>
      \`;
      
      document.getElementById('modal').innerHTML = modalHtml;
      document.getElementById('modal').classList.add('active');
    }
    
    // Create a new control-risk mapping from modal
    async function createControlRiskMapping(riskId) {
      const controlId = document.getElementById('link-control-select').value;
      const mappingType = document.getElementById('link-mapping-type').value;
      const effectiveness = document.getElementById('link-effectiveness').value;
      const confidenceScore = parseInt(document.getElementById('link-confidence').value) || 80;
      const notes = document.getElementById('link-notes').value;
      
      if (!controlId) {
        showAlert('Please select a control', 'error');
        return;
      }
      
      try {
        await api('/control-risk-mappings', {
          method: 'POST',
          body: JSON.stringify({
            control_id: controlId,
            risk_id: riskId,
            mapping_type: mappingType,
            effectiveness: effectiveness,
            confidence_score: confidenceScore,
            notes: notes || null
          })
        });
        showAlert('Control-risk mapping created successfully!', 'success');
        closeModal();
        loadRiskMitigation();
      } catch (error) {
        showAlert('Failed to create mapping: ' + error.message, 'error');
      }
    }
    
    // Show modal to create a new mapping (from scratch)
    async function showCreateMappingModal() {
      const [controlsData, risksData] = await Promise.all([
        api('/compliance/controls'),
        api('/risks?limit=100')
      ]);
      
      const controls = controlsData.controls || [];
      const risks = risksData.risks || [];
      
      const modalHtml = \`
        <div class="modal-content" style="max-width: 600px;">
          <div class="modal-header">
            <h2><i class="fas fa-plus" style="margin-right: 8px;"></i>Create Control-Risk Mapping</h2>
            <button class="close-btn" onclick="closeModal()">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Select Risk</label>
              <select id="new-mapping-risk" class="form-control" style="padding: 10px;">
                <option value="">-- Select a risk --</option>
                \${risks.map(r => \`
                  <option value="\${r.id}">\${r.title.substring(0, 60)}\${r.title.length > 60 ? '...' : ''} (\${r.status})</option>
                \`).join('')}
              </select>
            </div>
            
            <div class="form-group">
              <label>Select Control</label>
              <select id="new-mapping-control" class="form-control" style="padding: 10px;">
                <option value="">-- Select a control --</option>
                \${controls.map(c => \`
                  <option value="\${c.id}">\${c.control_id}: \${c.title.substring(0, 50)}\${c.title.length > 50 ? '...' : ''}</option>
                \`).join('')}
              </select>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div class="form-group">
                <label>Mapping Type</label>
                <select id="new-mapping-type" class="form-control">
                  <option value="mitigates">Mitigates</option>
                  <option value="detects">Detects</option>
                  <option value="prevents">Prevents</option>
                  <option value="reduces">Reduces</option>
                </select>
              </div>
              
              <div class="form-group">
                <label>Effectiveness</label>
                <select id="new-mapping-effectiveness" class="form-control">
                  <option value="full">Full</option>
                  <option value="partial" selected>Partial</option>
                  <option value="minimal">Minimal</option>
                </select>
              </div>
            </div>
            
            <div class="form-group">
              <label>Confidence Score (0-100)</label>
              <input type="number" id="new-mapping-confidence" class="form-control" value="80" min="0" max="100">
            </div>
            
            <div class="form-group">
              <label>Notes (optional)</label>
              <textarea id="new-mapping-notes" class="form-control" rows="2" placeholder="Additional notes..."></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="submitNewMapping()">
              <i class="fas fa-link"></i> Create Mapping
            </button>
          </div>
        </div>
      \`;
      
      document.getElementById('modal').innerHTML = modalHtml;
      document.getElementById('modal').classList.add('active');
    }
    
    // Submit new mapping from create modal
    async function submitNewMapping() {
      const riskId = document.getElementById('new-mapping-risk').value;
      const controlId = document.getElementById('new-mapping-control').value;
      const mappingType = document.getElementById('new-mapping-type').value;
      const effectiveness = document.getElementById('new-mapping-effectiveness').value;
      const confidenceScore = parseInt(document.getElementById('new-mapping-confidence').value) || 80;
      const notes = document.getElementById('new-mapping-notes').value;
      
      if (!riskId || !controlId) {
        showAlert('Please select both a risk and a control', 'error');
        return;
      }
      
      try {
        await api('/control-risk-mappings', {
          method: 'POST',
          body: JSON.stringify({
            control_id: controlId,
            risk_id: riskId,
            mapping_type: mappingType,
            effectiveness: effectiveness,
            confidence_score: confidenceScore,
            notes: notes || null
          })
        });
        showAlert('Control-risk mapping created successfully!', 'success');
        closeModal();
        loadRiskMitigation();
      } catch (error) {
        showAlert('Failed to create mapping: ' + error.message, 'error');
      }
    }

    // Assets
    async function loadAssets() {
      const data = await api('/assets');
      document.getElementById('page-actions').innerHTML = '<button class="btn btn-primary" onclick="showAssetModal()"><i class="fas fa-plus"></i> Add Asset</button>';
      
      if (data.assets.length === 0) {
        document.getElementById('assets-page').innerHTML = '<div class="card"><div class="empty-state"><p>No assets found.</p><button class="btn btn-primary" style="margin-top: 16px;" onclick="showAssetModal()"><i class="fas fa-plus"></i> Add Asset</button></div></div>';
        return;
      }
      
      document.getElementById('assets-page').innerHTML = \`
        <div class="card">
          <table>
            <thead><tr><th>Asset</th><th>Source</th><th>Type</th><th>Cloud</th><th>Criticality</th><th>Risks</th><th>Actions</th></tr></thead>
            <tbody>
              \${data.assets.map(a => {
                const isPentest = a.external_id && a.external_id.startsWith('pentest:');
                const sourceTag = a.tags ? JSON.parse(a.tags) : {};
                // For pentest assets, use findings count from tags; for others use risk_count
                const riskCount = isPentest ? (sourceTag.pentest_findings_count || 0) : (a.risk_count || 0);
                return \`
                <tr>
                  <td>
                    <div style="font-weight: 500;">\${a.name}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">\${a.region || sourceTag.url || 'N/A'}</div>
                  </td>
                  <td>
                    \${isPentest 
                      ? '<span class="badge" style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 3px 8px; font-size: 10px;"><i class="fas fa-crosshairs"></i> Pentest</span>'
                      : '<span class="badge" style="background: #374151; color: #9ca3af; padding: 3px 8px; font-size: 10px;"><i class="fas fa-edit"></i> Manual</span>'}
                  </td>
                  <td>\${a.asset_type}</td>
                  <td>\${a.cloud_provider || 'N/A'}</td>
                  <td><span class="badge \${a.criticality}">\${a.criticality}</span></td>
                  <td>\${riskCount > 0 ? '<span style="color: #ef4444; font-weight: 600;">' + riskCount + '</span>' : '0'}</td>
                  <td>
                    <button class="btn btn-secondary" style="padding: 4px 8px;" onclick="showAssetModal('\${a.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger" style="padding: 4px 8px;" onclick="deleteAsset('\${a.id}')"><i class="fas fa-trash"></i></button>
                  </td>
                </tr>
              \`}).join('')}
            </tbody>
          </table>
        </div>
      \`;
    }

    async function showAssetModal(id = null) {
      let asset = { name: '', asset_type: 'server', cloud_provider: 'aws', criticality: 'medium', status: 'active' };
      if (id) asset = await api('/assets/' + id);
      
      document.getElementById('modal-container').innerHTML = \`
        <div class="modal-overlay" onclick="closeModal(event)">
          <div class="modal" onclick="event.stopPropagation()">
            <div class="modal-header">
              <h3 class="modal-title">\${id ? 'Edit Asset' : 'Add Asset'}</h3>
              <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Name *</label>
                <input type="text" class="form-input" id="asset-name" value="\${asset.name}" placeholder="e.g., payment-api-prod">
              </div>
              <div class="form-group">
                <label class="form-label">Description</label>
                <textarea class="form-textarea" id="asset-description" placeholder="Asset description...">\${asset.description || ''}</textarea>
              </div>
              <div class="grid-2">
                <div class="form-group">
                  <label class="form-label">Type</label>
                  <select class="form-select" id="asset-type">
                    <option value="server" \${asset.asset_type === 'server' ? 'selected' : ''}>Server</option>
                    <option value="database" \${asset.asset_type === 'database' ? 'selected' : ''}>Database</option>
                    <option value="application" \${asset.asset_type === 'application' ? 'selected' : ''}>Application</option>
                    <option value="network_device" \${asset.asset_type === 'network_device' ? 'selected' : ''}>Network Device</option>
                    <option value="container" \${asset.asset_type === 'container' ? 'selected' : ''}>Container</option>
                    <option value="storage" \${asset.asset_type === 'storage' ? 'selected' : ''}>Storage</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Cloud Provider</label>
                  <select class="form-select" id="asset-cloud">
                    <option value="aws" \${asset.cloud_provider === 'aws' ? 'selected' : ''}>AWS</option>
                    <option value="azure" \${asset.cloud_provider === 'azure' ? 'selected' : ''}>Azure</option>
                    <option value="gcp" \${asset.cloud_provider === 'gcp' ? 'selected' : ''}>GCP</option>
                    <option value="on_premise" \${asset.cloud_provider === 'on_premise' ? 'selected' : ''}>On Premise</option>
                  </select>
                </div>
              </div>
              <div class="grid-2">
                <div class="form-group">
                  <label class="form-label">Criticality</label>
                  <select class="form-select" id="asset-criticality">
                    <option value="critical" \${asset.criticality === 'critical' ? 'selected' : ''}>Critical</option>
                    <option value="high" \${asset.criticality === 'high' ? 'selected' : ''}>High</option>
                    <option value="medium" \${asset.criticality === 'medium' ? 'selected' : ''}>Medium</option>
                    <option value="low" \${asset.criticality === 'low' ? 'selected' : ''}>Low</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Region</label>
                  <input type="text" class="form-input" id="asset-region" value="\${asset.region || ''}" placeholder="e.g., us-east-1">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Data Classification</label>
                <select class="form-select" id="asset-classification">
                  <option value="public" \${asset.data_classification === 'public' ? 'selected' : ''}>Public</option>
                  <option value="internal" \${asset.data_classification === 'internal' ? 'selected' : ''}>Internal</option>
                  <option value="confidential" \${asset.data_classification === 'confidential' ? 'selected' : ''}>Confidential</option>
                  <option value="restricted" \${asset.data_classification === 'restricted' ? 'selected' : ''}>Restricted</option>
                </select>
              </div>
              <div style="display: flex; gap: 20px; margin-bottom: 16px;">
                <label><input type="checkbox" id="asset-pii" \${asset.contains_pii ? 'checked' : ''}> Contains PII</label>
                <label><input type="checkbox" id="asset-pci" \${asset.contains_pci ? 'checked' : ''}> Contains PCI</label>
                <label><input type="checkbox" id="asset-phi" \${asset.contains_phi ? 'checked' : ''}> Contains PHI</label>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
              <button class="btn btn-primary" onclick="saveAsset('\${id || ''}')">\${id ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      \`;
    }

    async function saveAsset(id) {
      const data = {
        name: document.getElementById('asset-name').value,
        description: document.getElementById('asset-description').value,
        asset_type: document.getElementById('asset-type').value,
        cloud_provider: document.getElementById('asset-cloud').value,
        criticality: document.getElementById('asset-criticality').value,
        region: document.getElementById('asset-region').value || null,
        data_classification: document.getElementById('asset-classification').value,
        contains_pii: document.getElementById('asset-pii').checked,
        contains_pci: document.getElementById('asset-pci').checked,
        contains_phi: document.getElementById('asset-phi').checked
      };
      
      if (!data.name) { showAlert('Name is required', 'error'); return; }
      
      try {
        if (id) {
          await api('/assets/' + id, { method: 'PATCH', body: JSON.stringify(data) });
          showAlert('Asset updated successfully');
        } else {
          await api('/assets', { method: 'POST', body: JSON.stringify(data) });
          showAlert('Asset created successfully');
        }
        closeModal();
        loadAssets();
      } catch (error) {
        showAlert(error.message, 'error');
      }
    }

    async function deleteAsset(id) {
      if (!confirm('Are you sure you want to delete this asset?')) return;
      try {
        await api('/assets/' + id, { method: 'DELETE' });
        showAlert('Asset deleted successfully');
        loadAssets();
      } catch (error) {
        showAlert(error.message, 'error');
      }
    }

    // Vendors
    async function loadVendors() {
      const data = await api('/vendors');
      document.getElementById('page-actions').innerHTML = '<button class="btn btn-primary" onclick="showVendorModal()"><i class="fas fa-plus"></i> Add Vendor</button>';
      
      if (data.vendors.length === 0) {
        document.getElementById('vendors-page').innerHTML = '<div class="card"><div class="empty-state"><p>No vendors found.</p><button class="btn btn-primary" style="margin-top: 16px;" onclick="showVendorModal()"><i class="fas fa-plus"></i> Add Vendor</button></div></div>';
        return;
      }
      
      document.getElementById('vendors-page').innerHTML = \`
        <div class="card">
          <table>
            <thead><tr><th>Vendor</th><th>Type</th><th>Tier</th><th>Risk Score</th><th>Incidents</th><th>Actions</th></tr></thead>
            <tbody>
              \${data.vendors.map(v => \`
                <tr>
                  <td>
                    <div style="font-weight: 500;">\${v.name}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">\${v.industry || 'N/A'}</div>
                  </td>
                  <td>\${v.vendor_type || 'N/A'}</td>
                  <td><span class="badge \${v.vendor_tier}">\${v.vendor_tier}</span></td>
                  <td style="color: \${v.current_risk_score > 30 ? 'var(--accent-red)' : v.current_risk_score > 20 ? 'var(--accent-yellow)' : 'var(--accent-green)'}; font-weight: 600;">\${v.current_risk_score || 0}</td>
                  <td>\${v.active_incidents || 0}</td>
                  <td>
                    <button class="btn btn-secondary" style="padding: 4px 8px;" onclick="showVendorModal('\${v.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger" style="padding: 4px 8px;" onclick="deleteVendor('\${v.id}')"><i class="fas fa-trash"></i></button>
                  </td>
                </tr>
              \`).join('')}
            </tbody>
          </table>
        </div>
      \`;
    }

    async function showVendorModal(id = null) {
      let vendor = { name: '', vendor_tier: 'medium', vendor_type: 'SaaS', status: 'prospect', current_risk_score: 50 };
      if (id) vendor = await api('/vendors/' + id);
      
      document.getElementById('modal-container').innerHTML = \`
        <div class="modal-overlay" onclick="closeModal(event)">
          <div class="modal" onclick="event.stopPropagation()">
            <div class="modal-header">
              <h3 class="modal-title">\${id ? 'Edit Vendor' : 'Add Vendor'}</h3>
              <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Name *</label>
                <input type="text" class="form-input" id="vendor-name" value="\${vendor.name}" placeholder="e.g., Stripe">
              </div>
              <div class="form-group">
                <label class="form-label">Description</label>
                <textarea class="form-textarea" id="vendor-description" placeholder="Vendor description...">\${vendor.description || ''}</textarea>
              </div>
              <div class="grid-2">
                <div class="form-group">
                  <label class="form-label">Type</label>
                  <select class="form-select" id="vendor-type">
                    <option value="SaaS" \${vendor.vendor_type === 'SaaS' ? 'selected' : ''}>SaaS</option>
                    <option value="IaaS" \${vendor.vendor_type === 'IaaS' ? 'selected' : ''}>IaaS</option>
                    <option value="PaaS" \${vendor.vendor_type === 'PaaS' ? 'selected' : ''}>PaaS</option>
                    <option value="Consultant" \${vendor.vendor_type === 'Consultant' ? 'selected' : ''}>Consultant</option>
                    <option value="Hardware" \${vendor.vendor_type === 'Hardware' ? 'selected' : ''}>Hardware</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Tier</label>
                  <select class="form-select" id="vendor-tier">
                    <option value="critical" \${vendor.vendor_tier === 'critical' ? 'selected' : ''}>Critical</option>
                    <option value="high" \${vendor.vendor_tier === 'high' ? 'selected' : ''}>High</option>
                    <option value="medium" \${vendor.vendor_tier === 'medium' ? 'selected' : ''}>Medium</option>
                    <option value="low" \${vendor.vendor_tier === 'low' ? 'selected' : ''}>Low</option>
                  </select>
                </div>
              </div>
              <div class="grid-2">
                <div class="form-group">
                  <label class="form-label">Status</label>
                  <select class="form-select" id="vendor-status">
                    <option value="prospect" \${vendor.status === 'prospect' ? 'selected' : ''}>Prospect</option>
                    <option value="active" \${vendor.status === 'active' ? 'selected' : ''}>Active</option>
                    <option value="under_review" \${vendor.status === 'under_review' ? 'selected' : ''}>Under Review</option>
                    <option value="suspended" \${vendor.status === 'suspended' ? 'selected' : ''}>Suspended</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Risk Score (0-100)</label>
                  <input type="number" class="form-input" id="vendor-risk" min="0" max="100" value="\${vendor.current_risk_score || 50}">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Website</label>
                <input type="url" class="form-input" id="vendor-website" value="\${vendor.website || ''}" placeholder="https://...">
              </div>
              <div class="form-group">
                <label><input type="checkbox" id="vendor-data" \${vendor.has_data_access ? 'checked' : ''}> Has access to our data</label>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
              <button class="btn btn-primary" onclick="saveVendor('\${id || ''}')">\${id ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      \`;
    }

    async function saveVendor(id) {
      const data = {
        name: document.getElementById('vendor-name').value,
        description: document.getElementById('vendor-description').value,
        vendor_type: document.getElementById('vendor-type').value,
        vendor_tier: document.getElementById('vendor-tier').value,
        status: document.getElementById('vendor-status').value,
        current_risk_score: parseInt(document.getElementById('vendor-risk').value),
        website: document.getElementById('vendor-website').value || null,
        has_data_access: document.getElementById('vendor-data').checked
      };
      
      if (!data.name) { showAlert('Name is required', 'error'); return; }
      
      try {
        if (id) {
          await api('/vendors/' + id, { method: 'PATCH', body: JSON.stringify(data) });
          showAlert('Vendor updated successfully');
        } else {
          await api('/vendors', { method: 'POST', body: JSON.stringify(data) });
          showAlert('Vendor created successfully');
        }
        closeModal();
        loadVendors();
      } catch (error) {
        showAlert(error.message, 'error');
      }
    }

    async function deleteVendor(id) {
      if (!confirm('Are you sure you want to delete this vendor?')) return;
      try {
        await api('/vendors/' + id, { method: 'DELETE' });
        showAlert('Vendor deleted successfully');
        loadVendors();
      } catch (error) {
        showAlert(error.message, 'error');
      }
    }

    // ============================================================================
    // COMPLIANCE DASHBOARD & GAP ASSESSMENT
    // ============================================================================
    
    let complianceMode = 'basic'; // 'basic' or 'advanced'
    
    async function loadComplianceDashboard() {
      // Add timestamp to prevent browser caching and ensure fresh data
      const data = await api('/compliance/dashboard?mode=' + complianceMode + '&_t=' + Date.now());
      
      // Add export buttons to page actions
      document.getElementById('page-actions').innerHTML = \`
        <div style="display: flex; gap: 8px;">
          <button onclick="exportCompliancePDF()" style="padding: 8px 16px; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
            <i class="fas fa-file-pdf"></i> Export PDF
          </button>
          <button onclick="exportComplianceCSV()" style="padding: 8px 16px; background: linear-gradient(135deg, #22c55e, #16a34a); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
            <i class="fas fa-file-csv"></i> Export CSV
          </button>
        </div>
      \`;
      
      document.getElementById('compliance-page').innerHTML = \`
        <div class="page-header" style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 16px;">
          <div>
            <h1>Compliance Dashboard</h1>
            <p class="text-muted">Multi-framework compliance status powered by ISO 27001:2022</p>
          </div>
          <div style="display: flex; align-items: center; gap: 12px; background: var(--bg-tertiary); padding: 8px 16px; border-radius: 8px;">
            <span style="font-size: 13px; color: var(--text-muted);">Analysis Mode:</span>
            <div class="mode-toggle" style="display: flex; background: var(--bg-secondary); border-radius: 6px; overflow: hidden;">
              <button onclick="switchComplianceMode('basic')" class="mode-btn \${complianceMode === 'basic' ? 'active' : ''}" style="padding: 8px 16px; border: none; background: \${complianceMode === 'basic' ? 'var(--accent-blue)' : 'transparent'}; color: \${complianceMode === 'basic' ? 'white' : 'var(--text-secondary)'}; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.2s;">
                <i class="fas fa-calculator" style="margin-right: 6px;"></i>Basic
              </button>
              <button onclick="switchComplianceMode('advanced')" class="mode-btn \${complianceMode === 'advanced' ? 'active' : ''}" style="padding: 8px 16px; border: none; background: \${complianceMode === 'advanced' ? 'var(--accent-purple)' : 'transparent'}; color: \${complianceMode === 'advanced' ? 'white' : 'var(--text-secondary)'}; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.2s;">
                <i class="fas fa-chart-line" style="margin-right: 6px;"></i>Advanced
              </button>
            </div>
          </div>
        </div>
        
        <!-- Mode Description -->
        <div style="margin-bottom: 20px; padding: 12px 16px; background: \${complianceMode === 'advanced' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(59, 130, 246, 0.1)'}; border-radius: 8px; border-left: 4px solid \${complianceMode === 'advanced' ? 'var(--accent-purple)' : 'var(--accent-blue)'};">
          <div style="font-size: 13px; color: var(--text-secondary);">
            \${complianceMode === 'basic' ? \`
              <strong><i class="fas fa-calculator" style="margin-right: 6px;"></i>Basic Mode:</strong> 
              Simple percentage calculation — Implemented controls ÷ Total controls. Quick overview for general compliance status.
            \` : \`
              <strong><i class="fas fa-chart-line" style="margin-right: 6px;"></i>Advanced Mode:</strong> 
              Stricter scoring — Implemented controls are discounted by maturity level (60-100% credit). In-progress gets 30% credit. Advanced score ≤ Basic score.
            \`}
          </div>
        </div>
        
        \${data.riskPenalty?.applied ? \`
        <!-- Risk Penalty Warning Banner - Live Feed from All Sources -->
        <div style="margin-bottom: 20px; padding: 16px 20px; background: linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(220, 38, 38, 0.1)); border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.3); border-left: 4px solid #ef4444;">
          <div style="display: flex; align-items: start; gap: 12px; flex-wrap: wrap;">
            <div style="flex-shrink: 0; width: 36px; height: 36px; background: #ef4444; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
              <i class="fas fa-exclamation-triangle" style="color: white; font-size: 16px;"></i>
            </div>
            <div style="flex: 1; min-width: 250px;">
              <div style="font-size: 14px; font-weight: 700; color: #ef4444; margin-bottom: 4px;">
                <i class="fas fa-arrow-down" style="margin-right: 6px;"></i>
                Score Reduced by \${data.riskPenalty.totalPenalty} Points
                \${data.riskPenalty.isCapped ? '<span style="font-size: 11px; color: #f59e0b; margin-left: 8px;">(capped at 25)</span>' : ''}
              </div>
              <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 8px;">
                <i class="fas fa-rss" style="margin-right: 6px; color: #22c55e;"></i>
                Live risk feed from multiple sources affecting compliance
              </div>
              
              <!-- Severity Breakdown -->
              <div style="margin-bottom: 10px; display: flex; gap: 10px; flex-wrap: wrap; font-size: 12px;">
                <div style="padding: 6px 12px; background: rgba(239, 68, 68, 0.15); border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.3);">
                  <span style="color: #ef4444; font-weight: 700;">\${data.riskPenalty.criticalRisks}</span>
                  <span style="color: var(--text-muted);"> Critical</span>
                  <span style="color: #ef4444; font-weight: 600;"> (−\${data.riskPenalty.criticalPenalty || 0}pts)</span>
                </div>
                <div style="padding: 6px 12px; background: rgba(245, 158, 11, 0.15); border-radius: 6px; border: 1px solid rgba(245, 158, 11, 0.3);">
                  <span style="color: #f59e0b; font-weight: 700;">\${data.riskPenalty.highRisks}</span>
                  <span style="color: var(--text-muted);"> High</span>
                  <span style="color: #f59e0b; font-weight: 600;"> (−\${data.riskPenalty.highPenalty || 0}pts)</span>
                </div>
                \${data.riskPenalty.mediumRisks > 0 ? \`
                <div style="padding: 6px 12px; background: rgba(234, 179, 8, 0.15); border-radius: 6px; border: 1px solid rgba(234, 179, 8, 0.3);">
                  <span style="color: #eab308; font-weight: 700;">\${data.riskPenalty.mediumRisks}</span>
                  <span style="color: var(--text-muted);"> Medium</span>
                  <span style="color: #eab308; font-weight: 600;"> (−\${data.riskPenalty.mediumPenalty || 0}pts)</span>
                  \${data.riskPenalty.mediumTier === 'systemic' ? '<span style="margin-left: 4px; padding: 2px 6px; background: rgba(239, 68, 68, 0.2); color: #ef4444; border-radius: 3px; font-size: 10px;">⚠️ Systemic</span>' : 
                    data.riskPenalty.mediumTier === 'action_required' ? '<span style="margin-left: 4px; padding: 2px 6px; background: rgba(245, 158, 11, 0.2); color: #f59e0b; border-radius: 3px; font-size: 10px;">Action Required</span>' :
                    data.riskPenalty.mediumTier === 'attention_needed' ? '<span style="margin-left: 4px; padding: 2px 6px; background: rgba(234, 179, 8, 0.2); color: #eab308; border-radius: 3px; font-size: 10px;">Attention Needed</span>' : ''}
                </div>
                \` : ''}
              
              <!-- Risk Sources Breakdown -->
              <div style="display: flex; gap: 8px; flex-wrap: wrap; font-size: 11px;">
                \${data.riskPenalty.bySource?.pentest?.count > 0 ? \`
                  <div style="padding: 4px 10px; background: rgba(139, 92, 246, 0.15); border-radius: 4px; border: 1px solid rgba(139, 92, 246, 0.3); display: flex; align-items: center; gap: 4px;">
                    <i class="fas fa-bug" style="color: #a78bfa;"></i>
                    <span style="color: #a78bfa; font-weight: 600;">Pentest: \${data.riskPenalty.bySource.pentest.count}</span>
                    <span style="color: var(--text-muted);">(−\${data.riskPenalty.bySource.pentest.penalty}pts)</span>
                  </div>
                \` : ''}
                \${data.riskPenalty.bySource?.audit?.count > 0 ? \`
                  <div style="padding: 4px 10px; background: rgba(59, 130, 246, 0.15); border-radius: 4px; border: 1px solid rgba(59, 130, 246, 0.3); display: flex; align-items: center; gap: 4px;">
                    <i class="fas fa-clipboard-check" style="color: #3b82f6;"></i>
                    <span style="color: #3b82f6; font-weight: 600;">Audit: \${data.riskPenalty.bySource.audit.count}</span>
                    <span style="color: var(--text-muted);">(−\${data.riskPenalty.bySource.audit.penalty}pts)</span>
                  </div>
                \` : ''}
                \${data.riskPenalty.bySource?.selfAssessment?.count > 0 ? \`
                  <div style="padding: 4px 10px; background: rgba(34, 197, 94, 0.15); border-radius: 4px; border: 1px solid rgba(34, 197, 94, 0.3); display: flex; align-items: center; gap: 4px;">
                    <i class="fas fa-user-edit" style="color: #22c55e;"></i>
                    <span style="color: #22c55e; font-weight: 600;">Self-Assessment: \${data.riskPenalty.bySource.selfAssessment.count}</span>
                    <span style="color: var(--text-muted);">(−\${data.riskPenalty.bySource.selfAssessment.penalty}pts)</span>
                  </div>
                \` : ''}
                \${data.riskPenalty.bySource?.vendor?.count > 0 ? \`
                  <div style="padding: 4px 10px; background: rgba(249, 115, 22, 0.15); border-radius: 4px; border: 1px solid rgba(249, 115, 22, 0.3); display: flex; align-items: center; gap: 4px;">
                    <i class="fas fa-building" style="color: #f97316;"></i>
                    <span style="color: #f97316; font-weight: 600;">Vendor: \${data.riskPenalty.bySource.vendor.count}</span>
                    <span style="color: var(--text-muted);">(−\${data.riskPenalty.bySource.vendor.penalty}pts)</span>
                  </div>
                \` : ''}
                \${data.riskPenalty.bySource?.compliance?.count > 0 ? \`
                  <div style="padding: 4px 10px; background: rgba(236, 72, 153, 0.15); border-radius: 4px; border: 1px solid rgba(236, 72, 153, 0.3); display: flex; align-items: center; gap: 4px;">
                    <i class="fas fa-balance-scale" style="color: #ec4899;"></i>
                    <span style="color: #ec4899; font-weight: 600;">Compliance Gap: \${data.riskPenalty.bySource.compliance.count}</span>
                    <span style="color: var(--text-muted);">(−\${data.riskPenalty.bySource.compliance.penalty}pts)</span>
                  </div>
                \` : ''}
                \${data.riskPenalty.bySource?.other?.count > 0 ? \`
                  <div style="padding: 4px 10px; background: rgba(100, 116, 139, 0.15); border-radius: 4px; border: 1px solid rgba(100, 116, 139, 0.3); display: flex; align-items: center; gap: 4px;">
                    <i class="fas fa-folder" style="color: #64748b;"></i>
                    <span style="color: #64748b; font-weight: 600;">Other: \${data.riskPenalty.bySource.other.count}</span>
                    <span style="color: var(--text-muted);">(−\${data.riskPenalty.bySource.other.penalty}pts)</span>
                  </div>
                \` : ''}
              </div>
              
              <div style="margin-top: 10px; font-size: 11px; color: var(--text-muted);">
                <i class="fas fa-info-circle" style="margin-right: 4px;"></i>
                Resolve risks to recover points: Critical = +2pts, High = +1pt, Medium = tiered (3-5: 1pt, 6-9: 2pts, 10+: 3pts)
              </div>
            </div>
            <a href="javascript:navigate('risks')" style="flex-shrink: 0; padding: 10px 20px; background: #ef4444; color: white; border-radius: 6px; font-size: 12px; font-weight: 600; text-decoration: none; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);">
              <i class="fas fa-eye"></i> View Risks
            </a>
          </div>
        </div>
        \` : ''}
        
        <!-- Main Compliance Gauges - Enhanced Animated Version -->
        <div class="card" style="margin-bottom: 24px; padding: 24px;">
          <div style="display: flex; flex-wrap: wrap; gap: 40px; align-items: center; justify-content: center;">
            
            <!-- Primary Speedometer Gauge - ISO 27001 -->
            <div style="text-align: center;">
              <div style="font-size: 14px; font-weight: 600; color: var(--text-secondary); margin-bottom: 12px;">
                <i class="fas fa-shield-alt" style="color: #3b82f6; margin-right: 6px;"></i>ISO 27001 Compliance
              </div>
              <div style="position: relative; width: 220px; height: 110px; margin: 0 auto;">
                <svg viewBox="0 0 220 110" style="width: 100%; height: 100%;">
                  <defs>
                    <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" style="stop-color:#ef4444"/>
                      <stop offset="25%" style="stop-color:#f59e0b"/>
                      <stop offset="50%" style="stop-color:#eab308"/>
                      <stop offset="75%" style="stop-color:#84cc16"/>
                      <stop offset="100%" style="stop-color:#22c55e"/>
                    </linearGradient>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>
                  <!-- Background arc with ticks -->
                  <path d="M 20 100 A 90 90 0 0 1 200 100" fill="none" stroke="#1e293b" stroke-width="16" stroke-linecap="round"/>
                  <!-- Colored progress arc with gradient - arc length ~283px -->
                  <path d="M 20 100 A 90 90 0 0 1 200 100" fill="none" stroke="url(#gaugeGradient)" stroke-width="16" stroke-linecap="round"
                    stroke-dasharray="\${((data.frameworks.find(f => f.id === 'fw-iso27001')?.score || 0) / 100) * 283}, 283"
                    style="transition: stroke-dasharray 1s ease-out;" filter="url(#glow)"/>
                  <!-- Tick marks -->
                  \${[0, 25, 50, 75, 100].map((tick, i) => {
                    const angle = -180 + (tick / 100) * 180;
                    const x1 = 110 + 75 * Math.cos(angle * Math.PI / 180);
                    const y1 = 100 + 75 * Math.sin(angle * Math.PI / 180);
                    const x2 = 110 + 85 * Math.cos(angle * Math.PI / 180);
                    const y2 = 100 + 85 * Math.sin(angle * Math.PI / 180);
                    return \`<line x1="\${x1}" y1="\${y1}" x2="\${x2}" y2="\${y2}" stroke="#475569" stroke-width="2"/>\`;
                  }).join('')}
                  <!-- Animated needle with glow -->
                  <g class="gauge-needle" style="transform-origin: 110px 100px; transform: rotate(\${-90 + ((data.frameworks.find(f => f.id === 'fw-iso27001')?.score || 0) / 100) * 180}deg); transition: transform 1s ease-out;">
                    <polygon points="110,25 106,100 114,100" fill="#e2e8f0" filter="url(#glow)"/>
                    <circle cx="110" cy="100" r="8" fill="#334155" stroke="#e2e8f0" stroke-width="3"/>
                  </g>
                </svg>
              </div>
              <!-- Score displayed below the gauge -->
              <div class="gauge-value" style="font-size: 42px; font-weight: 800; margin-top: 8px; background: linear-gradient(135deg, \${(data.frameworks.find(f => f.id === 'fw-iso27001')?.score || 0) >= 80 ? '#22c55e, #16a34a' : (data.frameworks.find(f => f.id === 'fw-iso27001')?.score || 0) >= 60 ? '#eab308, #ca8a04' : '#ef4444, #dc2626'}); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                \${data.frameworks.find(f => f.id === 'fw-iso27001')?.score || 0}%
              </div>
              <div style="display: flex; justify-content: space-between; width: 220px; margin: 8px auto 0; font-size: 10px; color: var(--text-muted);">
                <span style="color: #ef4444;">0%</span>
                <span style="color: #f59e0b;">25%</span>
                <span style="color: #eab308;">50%</span>
                <span style="color: #84cc16;">75%</span>
                <span style="color: #22c55e;">100%</span>
              </div>
              <div style="margin-top: 8px; font-size: 11px; color: var(--text-muted);">
                \${complianceMode === 'advanced' ? 'Weighted Score (Maturity-adjusted)' : 'Basic Score (Implemented/Total)'}
              </div>
            </div>
            
            <!-- Secondary Gauges Grid -->
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
              <!-- Critical Controls Mini Gauge -->
              <div style="text-align: center; padding: 16px; background: var(--bg-tertiary); border-radius: 16px; min-width: 130px;">
                <div style="position: relative; width: 80px; height: 50px; margin: 0 auto 8px;">
                  <svg viewBox="0 0 100 60" style="width: 100%; height: 100%;">
                    <path d="M 10 55 A 45 45 0 0 1 90 55" fill="none" stroke="#1e293b" stroke-width="8" stroke-linecap="round"/>
                    <path d="M 10 55 A 45 45 0 0 1 90 55" fill="none" stroke="\${(data.advancedMetrics?.criticalScore || 0) >= 80 ? '#22c55e' : (data.advancedMetrics?.criticalScore || 0) >= 50 ? '#f59e0b' : '#ef4444'}" stroke-width="8" stroke-linecap="round"
                      stroke-dasharray="\${(data.advancedMetrics?.criticalScore || 0) * 1.41}, 141" style="transition: stroke-dasharray 1s ease-out;"/>
                  </svg>
                  <div style="position: absolute; bottom: -5px; left: 50%; transform: translateX(-50%); font-size: 20px; font-weight: 700; color: \${(data.advancedMetrics?.criticalScore || 0) >= 80 ? '#22c55e' : '#ef4444'};">
                    \${data.advancedMetrics?.criticalScore || 0}%
                  </div>
                </div>
                <div style="font-size: 11px; font-weight: 600; color: var(--text-secondary);">Critical Controls</div>
                <div style="font-size: 10px; color: var(--text-muted);">\${data.advancedMetrics?.criticalImplemented || 0}/\${data.advancedMetrics?.criticalTotal || 0} implemented</div>
              </div>
              
              <!-- Maturity Ring Gauge -->
              <div style="text-align: center; padding: 16px; background: var(--bg-tertiary); border-radius: 16px; min-width: 130px;">
                <div style="position: relative; width: 70px; height: 70px; margin: 0 auto 8px;">
                  <svg viewBox="0 0 70 70" style="width: 100%; height: 100%;">
                    <circle cx="35" cy="35" r="28" fill="none" stroke="#1e293b" stroke-width="6"/>
                    <circle cx="35" cy="35" r="28" fill="none" stroke="#3b82f6" stroke-width="6" stroke-linecap="round"
                      stroke-dasharray="\${((data.advancedMetrics?.avgMaturity || 0) / 5) * 176}, 176" 
                      transform="rotate(-90 35 35)" style="transition: stroke-dasharray 1s ease-out;"/>
                  </svg>
                  <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 18px; font-weight: 700; color: #3b82f6;">
                    \${(data.advancedMetrics?.avgMaturity || 0).toFixed(1)}
                  </div>
                </div>
                <div style="font-size: 11px; font-weight: 600; color: var(--text-secondary);">Avg Maturity</div>
                <div style="font-size: 10px; color: var(--text-muted);">out of 5 levels</div>
              </div>
              
              <!-- Implemented Count -->
              <div style="text-align: center; padding: 16px; background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(22, 163, 74, 0.05)); border-radius: 16px; min-width: 130px; border: 1px solid rgba(34, 197, 94, 0.2);">
                <div style="font-size: 36px; font-weight: 800; color: #22c55e; text-shadow: 0 2px 10px rgba(34, 197, 94, 0.3);">
                  \${data.frameworks.find(f => f.id === 'fw-iso27001')?.implemented || 0}
                </div>
                <div style="font-size: 11px; font-weight: 600; color: var(--text-secondary);">Implemented</div>
                <div style="font-size: 10px; color: #22c55e;"><i class="fas fa-check-circle"></i> Complete</div>
              </div>
              
              <!-- In Progress Count -->
              <div style="text-align: center; padding: 16px; background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(217, 119, 6, 0.05)); border-radius: 16px; min-width: 130px; border: 1px solid rgba(245, 158, 11, 0.2);">
                <div style="font-size: 36px; font-weight: 800; color: #f59e0b; text-shadow: 0 2px 10px rgba(245, 158, 11, 0.3);">
                  \${data.advancedMetrics?.inProgress || 0}
                </div>
                <div style="font-size: 11px; font-weight: 600; color: var(--text-secondary);">In Progress</div>
                <div style="font-size: 10px; color: #f59e0b;"><i class="fas fa-clock"></i> \${complianceMode === 'advanced' ? '30% credit' : 'Working'}</div>
              </div>
            </div>
          </div>
        </div>
        
        \${complianceMode === 'advanced' ? \`
          <!-- Advanced Mode Additional Info -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 20px;">
            <div class="card" style="padding: 16px; background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.1));">
              <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 48px; height: 48px; background: var(--accent-purple); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                  <i class="fas fa-balance-scale" style="color: white; font-size: 20px;"></i>
                </div>
                <div>
                  <div style="font-size: 24px; font-weight: 700; color: var(--accent-purple);">\${data.advancedMetrics?.overallScore || 0}%</div>
                  <div style="font-size: 11px; color: var(--text-muted);">Weighted Score</div>
                </div>
              </div>
              <div style="font-size: 10px; color: var(--text-muted); margin-top: 8px;">
                Basic \${data.frameworks.find(f => f.id === 'fw-iso27001')?.basicScore || 0}% → Weighted \${data.advancedMetrics?.overallScore || 0}%
              </div>
            </div>
            <div class="card" style="padding: 16px;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 48px; height: 48px; background: #f59e0b; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                  <i class="fas fa-tasks" style="color: white; font-size: 20px;"></i>
                </div>
                <div>
                  <div style="font-size: 24px; font-weight: 700; color: #f59e0b;">\${data.advancedMetrics?.inProgress || 0}</div>
                  <div style="font-size: 11px; color: var(--text-muted);">In Progress (30% credit)</div>
                </div>
              </div>
            </div>
          </div>
        \` : ''}
        
        <!-- Framework Compliance Cards - Only show applicable frameworks -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin-bottom: 24px;">
          \${data.frameworks.filter(fw => fw.is_applicable).map(fw => \`
            <div class="card" style="text-align: center; padding: 20px;">
              <div style="font-size: 32px; margin-bottom: 8px;">
                <i class="fas \${fw.icon}" style="color: \${fw.color};"></i>
              </div>
              <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">\${fw.name}</div>
              <div style="position: relative; width: 80px; height: 80px; margin: 0 auto 8px;">
                <svg viewBox="0 0 36 36" style="width: 100%; height: 100%; transform: rotate(-90deg);">
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none" stroke="var(--border)" stroke-width="3"/>
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none" stroke="\${fw.color}" stroke-width="3"
                    stroke-dasharray="\${fw.score || 0}, 100"/>
                </svg>
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 18px; font-weight: 700;">
                  \${fw.score}%
                </div>
              </div>
              <div style="font-size: 11px; color: var(--text-muted);">\${fw.implemented}/\${fw.total} controls</div>
              \${complianceMode === 'advanced' && fw.basicScore !== fw.advancedScore ? \`
                <div style="font-size: 10px; color: var(--text-muted); margin-top: 4px;">
                  Basic: \${fw.basicScore}% → Weighted: \${fw.advancedScore}%
                </div>
              \` : ''}
            </div>
          \`).join('')}
        </div>
        
        \${data.frameworks.filter(fw => !fw.is_applicable).length > 0 ? \`
          <div style="margin-bottom: 24px; padding: 12px 16px; background: var(--bg-tertiary); border-radius: 8px; border: 1px solid var(--border-color);">
            <div style="display: flex; align-items: center; gap: 8px; color: var(--text-muted); font-size: 13px;">
              <i class="fas fa-info-circle"></i>
              <span><strong>Not Applicable Frameworks:</strong> 
                \${data.frameworks.filter(fw => !fw.is_applicable).map(fw => fw.name).join(', ')}
              </span>
              <span style="margin-left: auto; font-size: 11px;">
                <a href="#" onclick="navigate('org-settings'); return false;" style="color: var(--accent-blue);">
                  <i class="fas fa-cog"></i> Change in Settings
                </a>
              </span>
            </div>
          </div>
        \` : ''}
        
        <!-- Gap Analysis by Domain -->
        <div class="card" style="margin-bottom: 24px;">
          <h3 style="margin-bottom: 16px;"><i class="fas fa-chart-bar" style="margin-right: 8px; color: var(--accent);"></i>Gap Analysis by Domain (ISO 27001:2022)</h3>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            \${data.domainScores.map(d => \`
              <div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                  <span><i class="fas \${d.icon}" style="margin-right: 8px; color: \${d.color};"></i>\${d.name}</span>
                  <div style="text-align: right;">
                    <span style="font-weight: 600;">\${d.score}% (\${d.implemented}/\${d.total})</span>
                    \${complianceMode === 'advanced' ? \`
                      <span style="font-size: 10px; color: var(--text-muted); margin-left: 8px;">
                        Maturity: \${d.avgMaturity || 0}/5
                      </span>
                    \` : ''}
                  </div>
                </div>
                <div style="background: var(--border); border-radius: 4px; height: 8px; overflow: hidden; position: relative;">
                  <div style="background: \${d.color}; height: 100%; width: \${d.score}%; transition: width 0.5s;"></div>
                  \${complianceMode === 'advanced' && d.inProgress > 0 ? \`
                    <div style="position: absolute; top: 0; left: \${d.score}%; background: \${d.color}40; height: 100%; width: \${Math.min(100 - d.score, (d.inProgress / d.total) * 100)}%;"></div>
                  \` : ''}
                </div>
                \${complianceMode === 'advanced' && d.inProgress > 0 ? \`
                  <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">
                    +\${d.inProgress} in progress (shown as lighter bar)
                  </div>
                \` : ''}
              </div>
            \`).join('')}
          </div>
        </div>
        
        <!-- Maturity Distribution -->
        <div class="grid-2">
          <div class="card">
            <h3 style="margin-bottom: 16px;"><i class="fas fa-layer-group" style="margin-right: 8px; color: var(--accent);"></i>Control Maturity Distribution</h3>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              \${[
                { level: 5, name: 'Optimized', color: '#10b981' },
                { level: 4, name: 'Measured', color: '#3b82f6' },
                { level: 3, name: 'Defined', color: '#8b5cf6' },
                { level: 2, name: 'Managed', color: '#f59e0b' },
                { level: 1, name: 'Initial', color: '#ef4444' },
                { level: 0, name: 'Not Assessed', color: '#6b7280' }
              ].map(m => {
                const count = data.maturityDistribution[m.level] || 0;
                const pct = data.totalControls ? Math.round(count / data.totalControls * 100) : 0;
                return \`
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 100px; font-size: 12px;">Level \${m.level}: \${m.name}</div>
                    <div style="flex: 1; background: var(--border); border-radius: 4px; height: 20px; overflow: hidden;">
                      <div style="background: \${m.color}; height: 100%; width: \${pct}%; display: flex; align-items: center; justify-content: flex-end; padding-right: 8px;">
                        <span style="font-size: 11px; color: white; font-weight: 600;">\${count}</span>
                      </div>
                    </div>
                  </div>
                \`;
              }).join('')}
            </div>
          </div>
          
          <div class="card">
            <h3 style="margin-bottom: 16px;"><i class="fas fa-exclamation-triangle" style="margin-right: 8px; color: #ef4444;"></i>Top Gaps to Address</h3>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              \${data.topGaps.slice(0, 5).map((g, i) => \`
                <div style="display: flex; align-items: center; gap: 12px; padding: 8px; background: var(--card-bg); border-radius: 8px; border: 1px solid var(--border);">
                  <div style="width: 24px; height: 24px; background: #ef4444; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600;">\${i + 1}</div>
                  <div style="flex: 1;">
                    <div style="font-size: 12px; font-weight: 500;">\${g.control_id}: \${g.title}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">\${g.category}</div>
                  </div>
                  <span class="badge" style="background: \${g.is_critical ? '#ef4444' : '#f59e0b'}20; color: \${g.is_critical ? '#ef4444' : '#f59e0b'};">
                    \${g.is_critical ? 'Critical' : 'Important'}
                  </span>
                </div>
              \`).join('')}
              \${data.topGaps.length === 0 ? '<div style="text-align: center; color: var(--text-muted); padding: 20px;">No gaps identified! 🎉</div>' : ''}
            </div>
          </div>
        </div>
        
        <!-- Compliance Trend Charts Section -->
        <div class="card" style="margin-top: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="margin: 0;"><i class="fas fa-chart-line" style="margin-right: 8px; color: var(--accent-blue);"></i>Compliance Score Trends</h3>
            <select id="trend-period" onchange="loadComplianceTrends()" style="padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text-primary); font-size: 12px;">
              <option value="3m">Last 3 Months</option>
              <option value="6m" selected>Last 6 Months</option>
              <option value="12m">Last 12 Months</option>
            </select>
          </div>
          <div id="compliance-trend-container" style="position: relative; height: 300px;">
            <div style="display: flex; justify-content: center; align-items: center; height: 100%; color: var(--text-muted);">
              <i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i> Loading trend data...
            </div>
          </div>
        </div>
        
        <!-- Risk & Domain Trends -->
        <div class="grid-2" style="margin-top: 24px;">
          <div class="card">
            <h3 style="margin-bottom: 16px;"><i class="fas fa-project-diagram" style="margin-right: 8px; color: var(--accent-purple);"></i>Domain Score Trends</h3>
            <div id="domain-trend-container" style="position: relative; height: 250px;">
              <div style="display: flex; justify-content: center; align-items: center; height: 100%; color: var(--text-muted);">
                <i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i> Loading...
              </div>
            </div>
          </div>
          <div class="card">
            <h3 style="margin-bottom: 16px;"><i class="fas fa-shield-alt" style="margin-right: 8px; color: var(--accent-red);"></i>Risk Trends</h3>
            <div id="risk-trend-container" style="position: relative; height: 250px;">
              <div style="display: flex; justify-content: center; align-items: center; height: 100%; color: var(--text-muted);">
                <i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i> Loading...
              </div>
            </div>
          </div>
        </div>
      \`;
      
      // Load trend charts after rendering
      loadComplianceTrends();
    }
    
    // Trend chart instances
    let complianceTrendChart = null;
    let domainTrendChart = null;
    let riskTrendChart = null;
    
    async function loadComplianceTrends() {
      const period = document.getElementById('trend-period')?.value || '6m';
      
      try {
        // Load Chart.js if not already loaded
        if (!window.Chart) {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
          document.head.appendChild(script);
          await new Promise(resolve => script.onload = resolve);
        }
        
        const data = await api('/compliance/trends?period=' + period);
        
        // Destroy existing charts if they exist
        if (complianceTrendChart) complianceTrendChart.destroy();
        if (domainTrendChart) domainTrendChart.destroy();
        if (riskTrendChart) riskTrendChart.destroy();
        
        // Render Compliance Trend Chart
        const complianceContainer = document.getElementById('compliance-trend-container');
        if (complianceContainer && data.chartData.compliance.labels.length > 0) {
          complianceContainer.innerHTML = '<canvas id="complianceTrendCanvas"></canvas>';
          const ctx = document.getElementById('complianceTrendCanvas').getContext('2d');
          
          complianceTrendChart = new Chart(ctx, {
            type: 'line',
            data: {
              labels: data.chartData.compliance.labels.map(d => {
                const date = new Date(d);
                return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
              }),
              datasets: data.chartData.compliance.datasets.map(ds => ({
                ...ds,
                pointRadius: 4,
                pointHoverRadius: 6,
                borderWidth: 2
              }))
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'top',
                  labels: { color: '#e2e8f0', font: { size: 11 } }
                },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      return context.dataset.label + ': ' + context.parsed.y + '%';
                    }
                  }
                }
              },
              scales: {
                y: {
                  beginAtZero: false,
                  min: 0,
                  max: 100,
                  grid: { color: '#334155' },
                  ticks: { 
                    color: '#cbd5e1',
                    callback: function(value) { return value + '%'; }
                  }
                },
                x: {
                  grid: { display: false },
                  ticks: { color: '#cbd5e1' }
                }
              },
              interaction: {
                intersect: false,
                mode: 'index'
              }
            }
          });
        } else if (complianceContainer) {
          complianceContainer.innerHTML = '<div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; color: var(--text-muted);"><i class="fas fa-chart-line" style="font-size: 48px; margin-bottom: 12px; opacity: 0.3;"></i><p>No trend data available yet.</p><p style="font-size: 12px;">Click "Snapshot" to record current scores.</p></div>';
        }
        
        // Render Domain Trend Chart
        const domainContainer = document.getElementById('domain-trend-container');
        if (domainContainer && data.chartData.domains.labels.length > 0) {
          domainContainer.innerHTML = '<canvas id="domainTrendCanvas"></canvas>';
          const ctx = document.getElementById('domainTrendCanvas').getContext('2d');
          
          domainTrendChart = new Chart(ctx, {
            type: 'line',
            data: {
              labels: data.chartData.domains.labels.map(d => {
                const date = new Date(d);
                return date.toLocaleDateString('en-US', { month: 'short' });
              }),
              datasets: data.chartData.domains.datasets.map(ds => ({
                ...ds,
                pointRadius: 3,
                borderWidth: 2
              }))
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'bottom',
                  labels: { color: '#e2e8f0', font: { size: 10 }, boxWidth: 12 }
                }
              },
              scales: {
                y: {
                  beginAtZero: false,
                  min: 0,
                  max: 100,
                  grid: { color: '#334155' },
                  ticks: { 
                    color: '#cbd5e1',
                    font: { size: 10 },
                    callback: function(value) { return value + '%'; }
                  }
                },
                x: {
                  grid: { display: false },
                  ticks: { color: '#cbd5e1', font: { size: 10 } }
                }
              }
            }
          });
        } else if (domainContainer) {
          domainContainer.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; height: 100%; color: var(--text-muted); font-size: 13px;"><i class="fas fa-info-circle" style="margin-right: 8px;"></i>No domain history data</div>';
        }
        
        // Render Risk Trend Chart
        const riskContainer = document.getElementById('risk-trend-container');
        if (riskContainer && data.chartData.risks.labels.length > 0) {
          riskContainer.innerHTML = '<canvas id="riskTrendCanvas"></canvas>';
          const ctx = document.getElementById('riskTrendCanvas').getContext('2d');
          
          riskTrendChart = new Chart(ctx, {
            type: 'line',
            data: {
              labels: data.chartData.risks.labels.map(d => {
                const date = new Date(d);
                return date.toLocaleDateString('en-US', { month: 'short' });
              }),
              datasets: data.chartData.risks.datasets.map(ds => ({
                ...ds,
                pointRadius: 3,
                borderWidth: 2,
                fill: false
              }))
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'bottom',
                  labels: { color: '#e2e8f0', font: { size: 10 }, boxWidth: 12 }
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  grid: { color: '#334155' },
                  ticks: { color: '#cbd5e1', font: { size: 10 } }
                },
                x: {
                  grid: { display: false },
                  ticks: { color: '#cbd5e1', font: { size: 10 } }
                }
              }
            }
          });
        } else if (riskContainer) {
          riskContainer.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; height: 100%; color: var(--text-muted); font-size: 13px;"><i class="fas fa-info-circle" style="margin-right: 8px;"></i>No risk history data</div>';
        }
        
      } catch (error) {
        console.error('Failed to load trends:', error);
        const container = document.getElementById('compliance-trend-container');
        if (container) {
          container.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; height: 100%; color: var(--accent-red);"><i class="fas fa-exclamation-triangle" style="margin-right: 8px;"></i>Failed to load trend data</div>';
        }
      }
    }
    
    async function loadGapAssessment() {
      const data = await api('/compliance/controls');
      document.getElementById('page-actions').innerHTML = '<button class="btn btn-primary" onclick="initializeAssessments()"><i class="fas fa-play"></i> Initialize All</button>';
      
      // Group controls by category
      const categories = {};
      data.controls.forEach(c => {
        if (!categories[c.category]) categories[c.category] = [];
        categories[c.category].push(c);
      });
      
      const categoryMeta = {
        'Organizational': { icon: 'fa-building', color: '#3b82f6' },
        'People': { icon: 'fa-users', color: '#10b981' },
        'Physical': { icon: 'fa-door-closed', color: '#f59e0b' },
        'Technological': { icon: 'fa-microchip', color: '#8b5cf6' }
      };
      
      // Check for controls needing review (pentest advisory)
      const controlsNeedingReview = data.controls.filter(c => c.needs_review || c.open_risks > 0);
      const criticalCount = data.stats.critical_findings || 0;
      const highCount = data.stats.high_findings || 0;
      const needsReviewCount = data.stats.needs_review || 0;
      const withOpenRisks = data.stats.with_open_risks || 0;
      
      // Build advisory banner if there are controls affected by pentest findings
      let advisoryBanner = '';
      if (withOpenRisks > 0) {
        advisoryBanner = \`
          <div style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(234, 88, 12, 0.1)); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 12px; padding: 16px; margin-bottom: 20px;">
            <div style="display: flex; align-items: flex-start; gap: 16px;">
              <div style="background: rgba(245, 158, 11, 0.2); border-radius: 50%; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <i class="fas fa-clipboard-check" style="color: #f59e0b; font-size: 20px;"></i>
              </div>
              <div style="flex: 1;">
                <div style="font-size: 14px; font-weight: 600; color: #f59e0b; margin-bottom: 6px;">
                  <i class="fas fa-bell"></i> Pentest Advisory: \${withOpenRisks} Control(s) Have Open Findings
                </div>
                <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 10px;">
                  Penetration testing has identified findings linked to the controls below.
                  <strong>Risk penalty is already applied to compliance score</strong> - no need to downgrade control status.
                </div>
                <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 6px; padding: 8px 12px; margin-bottom: 10px; font-size: 12px;">
                  <i class="fas fa-lightbulb" style="color: #10b981; margin-right: 6px;"></i>
                  <strong>Tip:</strong> Control status = "Is it implemented?" | Risk penalty = "Are there vulnerabilities?"
                  These are separate - a control can be implemented but still have findings. When findings are mitigated, score automatically returns.
                </div>
                <div style="display: flex; gap: 16px; flex-wrap: wrap;">
                  \${criticalCount > 0 ? \`
                    <div style="display: flex; align-items: center; gap: 6px; background: rgba(220, 38, 38, 0.1); padding: 6px 12px; border-radius: 6px;">
                      <span style="width: 8px; height: 8px; background: #dc2626; border-radius: 50%;"></span>
                      <span style="font-size: 12px; color: #dc2626; font-weight: 600;">\${criticalCount} Critical</span>
                    </div>
                  \` : ''}
                  \${highCount > 0 ? \`
                    <div style="display: flex; align-items: center; gap: 6px; background: rgba(234, 88, 12, 0.1); padding: 6px 12px; border-radius: 6px;">
                      <span style="width: 8px; height: 8px; background: #ea580c; border-radius: 50%;"></span>
                      <span style="font-size: 12px; color: #ea580c; font-weight: 600;">\${highCount} High</span>
                    </div>
                  \` : ''}
                  \${needsReviewCount > 0 ? \`
                    <div style="display: flex; align-items: center; gap: 6px; background: rgba(139, 92, 246, 0.1); padding: 6px 12px; border-radius: 6px;">
                      <span style="width: 8px; height: 8px; background: #8b5cf6; border-radius: 50%;"></span>
                      <span style="font-size: 12px; color: #8b5cf6; font-weight: 600;">\${needsReviewCount} Need Review</span>
                    </div>
                  \` : ''}
                  \${data.stats.suggest_upgrade > 0 ? \`
                    <div style="display: flex; align-items: center; gap: 6px; background: rgba(16, 185, 129, 0.1); padding: 6px 12px; border-radius: 6px;">
                      <span style="width: 8px; height: 8px; background: #10b981; border-radius: 50%;"></span>
                      <span style="font-size: 12px; color: #10b981; font-weight: 600;">\${data.stats.suggest_upgrade} Ready to Upgrade</span>
                    </div>
                  \` : ''}
                </div>
                <div style="margin-top: 10px; font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
                  <i class="fas fa-info-circle"></i>
                  <span>Use the <strong>"Needs Review"</strong> filter below to see affected controls. Gap Assessment status is controlled manually.</span>
                </div>
              </div>
            </div>
          </div>
        \`;
      }
      
      document.getElementById('gap-assessment-page').innerHTML = \`
        <div class="page-header" style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h1>ISO 27001:2022 Gap Assessment</h1>
            <p class="text-muted">Assess each control's implementation status and maturity level</p>
          </div>
          <div style="display: flex; gap: 8px;">
            <button onclick="exportGapAssessmentPDF()" style="padding: 8px 16px; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
              <i class="fas fa-file-pdf"></i> Export PDF
            </button>
            <button onclick="exportGapAssessmentCSV()" style="padding: 8px 16px; background: linear-gradient(135deg, #22c55e, #16a34a); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
              <i class="fas fa-file-csv"></i> Export CSV
            </button>
          </div>
        </div>
        
        \${advisoryBanner}
        
        <!-- Summary Stats -->
        <div class="grid-4" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; margin-bottom: 24px;">
          <div class="card" style="text-align: center; padding: 16px;">
            <div style="font-size: 28px; font-weight: 700; color: var(--accent);">\${data.stats.total}</div>
            <div style="font-size: 12px; color: var(--text-muted);">Total Controls</div>
          </div>
          <div class="card" style="text-align: center; padding: 16px;">
            <div style="font-size: 28px; font-weight: 700; color: #10b981;">\${data.stats.implemented}</div>
            <div style="font-size: 12px; color: var(--text-muted);">Implemented</div>
          </div>
          <div class="card" style="text-align: center; padding: 16px;">
            <div style="font-size: 28px; font-weight: 700; color: #f59e0b;">\${data.stats.in_progress}</div>
            <div style="font-size: 12px; color: var(--text-muted);">In Progress</div>
          </div>
          <div class="card" style="text-align: center; padding: 16px;">
            <div style="font-size: 28px; font-weight: 700; color: #ef4444;">\${data.stats.not_implemented}</div>
            <div style="font-size: 12px; color: var(--text-muted);">Not Implemented</div>
          </div>
          <div class="card" style="text-align: center; padding: 16px; \${withOpenRisks > 0 ? 'border: 2px solid #f59e0b; background: rgba(245, 158, 11, 0.05);' : ''}">
            <div style="font-size: 28px; font-weight: 700; color: \${withOpenRisks > 0 ? '#f59e0b' : '#6b7280'};">\${withOpenRisks}</div>
            <div style="font-size: 12px; color: var(--text-muted);">With Findings</div>
          </div>
        </div>
        
        <!-- Filter Bar -->
        <div class="card" style="padding: 12px; margin-bottom: 16px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
          <select id="filter-category" class="form-select" style="width: 180px;" onchange="filterGapControls()">
            <option value="">All Categories</option>
            <option value="Organizational">Organizational (37)</option>
            <option value="People">People (8)</option>
            <option value="Physical">Physical (14)</option>
            <option value="Technological">Technological (34)</option>
          </select>
          <select id="filter-status" class="form-select" style="width: 180px;" onchange="filterGapControls()">
            <option value="">All Statuses</option>
            <option value="not_started">Not Started</option>
            <option value="planned">Planned</option>
            <option value="in_progress">In Progress</option>
            <option value="implemented">Implemented</option>
            <option value="not_applicable">Not Applicable</option>
          </select>
          <select id="filter-findings" class="form-select" style="width: 180px; \${withOpenRisks > 0 ? 'border-color: #f59e0b;' : ''}" onchange="filterGapControls()">
            <option value="">All Controls</option>
            <option value="needs_review" \${withOpenRisks > 0 ? 'style="color: #f59e0b; font-weight: 600;"' : ''}>⚠️ Needs Review (\${needsReviewCount})</option>
            <option value="has_findings">Has Open Findings (\${withOpenRisks})</option>
            <option value="critical">Critical Findings (\${criticalCount})</option>
            <option value="no_findings">No Findings</option>
          </select>
          <input type="text" id="filter-search" class="form-input" placeholder="Search controls..." style="flex: 1; min-width: 150px;" oninput="filterGapControls()">
        </div>
        
        <!-- Controls by Category -->
        <div id="gap-controls-container">
          \${Object.entries(categories).map(([category, controls]) => {
            const meta = categoryMeta[category] || { icon: 'fa-folder', color: '#6b7280' };
            return \`
              <div class="card" style="margin-bottom: 16px;" data-category="\${category}">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border);">
                  <div style="width: 40px; height: 40px; background: \${meta.color}20; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                    <i class="fas \${meta.icon}" style="color: \${meta.color};"></i>
                  </div>
                  <div>
                    <h3 style="margin: 0;">\${category} Controls</h3>
                    <div style="font-size: 12px; color: var(--text-muted);">\${controls.length} controls</div>
                  </div>
                </div>
                <table style="width: 100%;">
                  <thead>
                    <tr style="text-align: left; color: var(--text-muted); font-size: 12px;">
                      <th style="padding: 8px; width: 80px;">Control</th>
                      <th style="padding: 8px;">Title</th>
                      <th style="padding: 8px; width: 150px;">Status</th>
                      <th style="padding: 8px; width: 150px;">Maturity</th>
                      <th style="padding: 8px; width: 80px;">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    \${controls.map(ctrl => {
                      // Determine finding badge
                      let findingBadge = '';
                      let rowStyle = '';
                      if (ctrl.open_risks > 0) {
                        if (ctrl.highest_open_severity === 'critical') {
                          findingBadge = '<span style="background: #dc2626; color: white; font-size: 9px; padding: 2px 6px; border-radius: 10px; margin-left: 6px;" title="Critical pentest findings linked">CRITICAL</span>';
                          rowStyle = 'background: rgba(220, 38, 38, 0.05);';
                        } else if (ctrl.highest_open_severity === 'high') {
                          findingBadge = '<span style="background: #ea580c; color: white; font-size: 9px; padding: 2px 6px; border-radius: 10px; margin-left: 6px;" title="High severity findings linked">HIGH</span>';
                          rowStyle = 'background: rgba(234, 88, 12, 0.05);';
                        } else if (ctrl.highest_open_severity === 'medium') {
                          findingBadge = '<span style="background: #f59e0b; color: white; font-size: 9px; padding: 2px 6px; border-radius: 10px; margin-left: 6px;" title="Medium severity findings linked">MED</span>';
                          rowStyle = 'background: rgba(245, 158, 11, 0.03);';
                        } else {
                          findingBadge = '<span style="background: #6b7280; color: white; font-size: 9px; padding: 2px 6px; border-radius: 10px; margin-left: 6px;" title="Low severity findings linked">LOW</span>';
                        }
                      }
                      
                      // Needs review indicator
                      let reviewIndicator = '';
                      if (ctrl.needs_review) {
                        reviewIndicator = '<i class="fas fa-exclamation-triangle" style="color: #f59e0b; margin-left: 4px; font-size: 11px;" title="Review recommended: Open findings on implemented control"></i>';
                      }
                      
                      // NEW: Suggest upgrade indicator (all risks mitigated)
                      let suggestUpgradeBadge = '';
                      if (ctrl.suggest_upgrade) {
                        suggestUpgradeBadge = \`
                          <div style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 4px 8px; border-radius: 4px; font-size: 10px; margin-top: 4px; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;" onclick="suggestUpgradeControl('\${ctrl.id}', '\${ctrl.control_id}')" title="All linked risks are mitigated - Click to upgrade to Implemented">
                            <i class="fas fa-check-circle"></i> All risks resolved - Upgrade?
                          </div>
                        \`;
                      }
                      
                      return \`
                      <tr class="control-row" data-control-id="\${ctrl.id}" data-status="\${ctrl.implementation_status || 'not_started'}" data-search="\${ctrl.control_id} \${ctrl.title}".toLowerCase() data-has-findings="\${ctrl.open_risks > 0 ? 'yes' : 'no'}" data-needs-review="\${ctrl.needs_review ? 'yes' : 'no'}" data-severity="\${ctrl.highest_open_severity || 'none'}" style="\${rowStyle}">
                        <td style="padding: 8px;">
                          <span style="font-weight: 600; color: \${meta.color};">\${ctrl.control_id}</span>
                          \${ctrl.is_critical ? '<i class="fas fa-star" style="color: #f59e0b; margin-left: 4px; font-size: 10px;" title="Critical Control"></i>' : ''}
                          \${reviewIndicator}
                        </td>
                        <td style="padding: 8px;">
                          <div style="font-size: 13px; display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
                            <span>\${ctrl.title}</span>
                            \${findingBadge}
                          </div>
                          <div style="font-size: 11px; color: var(--text-muted);">\${ctrl.subcategory || ''}</div>
                          \${ctrl.open_risks > 0 ? \`
                            <div style="font-size: 10px; color: #f59e0b; margin-top: 4px;">
                              <i class="fas fa-bug"></i> \${ctrl.open_risks} open finding(s) linked
                            </div>
                          \` : ''}
                          \${suggestUpgradeBadge}
                        </td>
                        <td style="padding: 8px;">
                          <select class="form-select status-select" style="font-size: 12px; padding: 4px 8px; \${ctrl.needs_review ? 'border-color: #f59e0b;' : ''}" data-control="\${ctrl.id}" onchange="updateControlStatus(this)">
                            <option value="not_started" \${ctrl.implementation_status === 'not_started' ? 'selected' : ''}>⚪ Not Started</option>
                            <option value="planned" \${ctrl.implementation_status === 'planned' ? 'selected' : ''}>📋 Planned</option>
                            <option value="in_progress" \${ctrl.implementation_status === 'in_progress' ? 'selected' : ''}>🔄 In Progress</option>
                            <option value="implemented" \${ctrl.implementation_status === 'implemented' ? 'selected' : ''}>✅ Implemented</option>
                            <option value="not_applicable" \${ctrl.implementation_status === 'not_applicable' ? 'selected' : ''}>➖ N/A</option>
                          </select>
                        </td>
                        <td style="padding: 8px;">
                          <select class="form-select maturity-select" style="font-size: 12px; padding: 4px 8px;" data-control="\${ctrl.id}" onchange="updateControlMaturity(this)">
                            <option value="0" \${(ctrl.maturity_level || 0) === 0 ? 'selected' : ''}>0 - Not Assessed</option>
                            <option value="1" \${ctrl.maturity_level === 1 ? 'selected' : ''}>1 - Initial</option>
                            <option value="2" \${ctrl.maturity_level === 2 ? 'selected' : ''}>2 - Managed</option>
                            <option value="3" \${ctrl.maturity_level === 3 ? 'selected' : ''}>3 - Defined</option>
                            <option value="4" \${ctrl.maturity_level === 4 ? 'selected' : ''}>4 - Measured</option>
                            <option value="5" \${ctrl.maturity_level === 5 ? 'selected' : ''}>5 - Optimized</option>
                          </select>
                        </td>
                        <td style="padding: 8px;">
                          <button class="btn btn-secondary" style="padding: 4px 8px;" onclick="showControlDetail('\${ctrl.id}')" title="View Details">
                            <i class="fas fa-eye"></i>
                          </button>
                        </td>
                      </tr>
                    \`}).join('')}
                  </tbody>
                </table>
              </div>
            \`;
          }).join('')}
        </div>
      \`;
    }
    
    function filterGapControls() {
      const category = document.getElementById('filter-category').value;
      const status = document.getElementById('filter-status').value;
      const findings = document.getElementById('filter-findings')?.value || '';
      const search = document.getElementById('filter-search').value.toLowerCase();
      
      document.querySelectorAll('.control-row').forEach(row => {
        const rowCategory = row.closest('[data-category]').dataset.category;
        const rowStatus = row.dataset.status;
        const rowSearch = row.dataset.search;
        const hasFindings = row.dataset.hasFindings === 'yes';
        const needsReview = row.dataset.needsReview === 'yes';
        const severity = row.dataset.severity;
        
        const matchCategory = !category || rowCategory === category;
        const matchStatus = !status || rowStatus === status;
        const matchSearch = !search || rowSearch.includes(search);
        
        // Findings filter logic
        let matchFindings = true;
        if (findings === 'needs_review') {
          matchFindings = needsReview;
        } else if (findings === 'has_findings') {
          matchFindings = hasFindings;
        } else if (findings === 'critical') {
          matchFindings = severity === 'critical';
        } else if (findings === 'no_findings') {
          matchFindings = !hasFindings;
        }
        
        row.style.display = matchCategory && matchStatus && matchSearch && matchFindings ? '' : 'none';
      });
      
      // Hide empty category cards
      document.querySelectorAll('[data-category]').forEach(card => {
        const visibleRows = card.querySelectorAll('.control-row[style=""], .control-row:not([style])');
        card.style.display = visibleRows.length > 0 || !category ? '' : 'none';
      });
    }
    
    async function updateControlStatus(select) {
      const controlId = select.dataset.control;
      const status = select.value;
      
      try {
        await api('/compliance/assessment', {
          method: 'POST',
          body: JSON.stringify({ control_library_id: controlId, implementation_status: status })
        });
        
        // Update row data attribute
        select.closest('.control-row').dataset.status = status;
        showAlert('Status updated', 'success');
      } catch (error) {
        showAlert('Failed to update: ' + error.message, 'error');
      }
    }
    
    async function updateControlMaturity(select) {
      const controlId = select.dataset.control;
      const maturity = parseInt(select.value);
      
      try {
        await api('/compliance/assessment', {
          method: 'POST',
          body: JSON.stringify({ control_library_id: controlId, maturity_level: maturity })
        });
        showAlert('Maturity updated', 'success');
      } catch (error) {
        showAlert('Failed to update: ' + error.message, 'error');
      }
    }
    
    // NEW: Suggest Upgrade Control - when all risks are mitigated
    async function suggestUpgradeControl(controlId, controlCode) {
      const confirmed = confirm(
        '✅ All Linked Risks Resolved\\n\\n' +
        'Control: ' + controlCode + '\\n\\n' +
        'All pentest findings linked to this control have been mitigated.\\n\\n' +
        'Do you want to upgrade this control to "Implemented"?\\n\\n' +
        '• Click OK to upgrade to Implemented\\n' +
        '• Click Cancel to keep current status'
      );
      
      if (confirmed) {
        try {
          await api('/compliance/assessment', {
            method: 'POST',
            body: JSON.stringify({ 
              control_library_id: controlId, 
              implementation_status: 'implemented',
              maturity_level: 3  // Set a reasonable maturity level
            })
          });
          showAlert('✅ Control ' + controlCode + ' upgraded to Implemented!', 'success');
          loadGapAssessment();  // Refresh the view
        } catch (error) {
          showAlert('Failed to upgrade: ' + error.message, 'error');
        }
      }
    }
    
    async function initializeAssessments() {
      // Ask user which mode to use
      const useDemo = confirm(
        'Initialize All Controls\\n\\n' +
        'Click OK to populate with DEMO DATA (realistic implementation statuses & maturity levels for demonstration)\\n\\n' +
        'Click Cancel to set all controls to "Not Started" (for fresh assessment)'
      );
      
      const mode = useDemo ? 'demo' : 'empty';
      
      try {
        const result = await api('/compliance/initialize', { 
          method: 'POST',
          body: JSON.stringify({ mode })
        });
        showAlert(result.message || 'All controls initialized!', 'success');
        loadGapAssessment();
      } catch (error) {
        showAlert('Failed: ' + error.message, 'error');
      }
    }
    
    async function showControlDetail(controlId) {
      const control = await api('/compliance/control/' + controlId);
      // Load org users for the remediation-owner dropdown (some roles can't
      // read /users — fall back to an empty list so the modal still opens).
      let ownerUsers = [];
      try {
        const u = await api('/users');
        ownerUsers = (u && u.users) ? u.users : [];
      } catch (e) { ownerUsers = []; }
      const ownerOptions = ownerUsers.map(u =>
        \`<option value="\${u.id}" \${control.remediation_owner_id === u.id ? 'selected' : ''}>\${u.display_name || u.email}</option>\`
      ).join('');
      
      document.getElementById('modal-container').innerHTML = \`
        <div class="modal-overlay" onclick="closeModal(event)">
          <div class="modal" style="max-width: 700px;" onclick="event.stopPropagation()">
            <div class="modal-header">
              <h3 class="modal-title">\${control.control_id}: \${control.title}</h3>
              <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
              <div style="margin-bottom: 16px;">
                <span class="badge" style="background: var(--accent)20; color: var(--accent);">\${control.category}</span>
                <span class="badge" style="background: var(--accent)20; color: var(--accent);">\${control.subcategory}</span>
                \${control.is_critical ? '<span class="badge" style="background: #f59e0b20; color: #f59e0b;"><i class="fas fa-star"></i> Critical</span>' : ''}
              </div>
              
              <div style="margin-bottom: 16px;">
                <label class="form-label">Description</label>
                <p style="font-size: 13px; line-height: 1.6; color: var(--text-muted);">\${control.description}</p>
              </div>
              
              <div class="grid-2" style="gap: 16px; margin-bottom: 16px;">
                <div class="form-group">
                  <label class="form-label">Implementation Status</label>
                  <select class="form-select" id="modal-status">
                    <option value="not_started" \${control.implementation_status === 'not_started' ? 'selected' : ''}>Not Started</option>
                    <option value="planned" \${control.implementation_status === 'planned' ? 'selected' : ''}>Planned</option>
                    <option value="in_progress" \${control.implementation_status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                    <option value="implemented" \${control.implementation_status === 'implemented' ? 'selected' : ''}>Implemented</option>
                    <option value="not_applicable" \${control.implementation_status === 'not_applicable' ? 'selected' : ''}>Not Applicable</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Maturity Level</label>
                  <select class="form-select" id="modal-maturity">
                    <option value="0" \${(control.maturity_level || 0) === 0 ? 'selected' : ''}>0 - Not Assessed</option>
                    <option value="1" \${control.maturity_level === 1 ? 'selected' : ''}>1 - Initial</option>
                    <option value="2" \${control.maturity_level === 2 ? 'selected' : ''}>2 - Managed</option>
                    <option value="3" \${control.maturity_level === 3 ? 'selected' : ''}>3 - Defined</option>
                    <option value="4" \${control.maturity_level === 4 ? 'selected' : ''}>4 - Measured</option>
                    <option value="5" \${control.maturity_level === 5 ? 'selected' : ''}>5 - Optimized</option>
                  </select>
                </div>
              </div>
              
              <div class="form-group">
                <label class="form-label">Evidence / Notes</label>
                <textarea class="form-textarea" id="modal-evidence" rows="3" placeholder="Document evidence of implementation...">\${control.evidence_description || ''}</textarea>
              </div>
              
              <div class="form-group">
                <label class="form-label">Gaps Identified</label>
                <textarea class="form-textarea" id="modal-gaps" rows="2" placeholder="Document any gaps...">\${control.gaps_identified || ''}</textarea>
              </div>

              <div style="border-top: 1px solid var(--border); margin: 16px 0 12px; padding-top: 12px;">
                <div style="font-size: 12px; font-weight: 600; color: var(--accent); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">
                  <i class="fas fa-tasks"></i> Remediation Plan &amp; Ownership
                </div>
                <div class="form-group">
                  <label class="form-label">Remediation Plan</label>
                  <textarea class="form-textarea" id="modal-remediation" rows="2" placeholder="What needs to be done to close this gap...">\${control.remediation_plan || ''}</textarea>
                </div>
                <div class="grid-2" style="gap: 16px;">
                  <div class="form-group">
                    <label class="form-label">Remediation Owner</label>
                    <select class="form-select" id="modal-owner">
                      <option value="">— Unassigned —</option>
                      \${ownerOptions}
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Due Date</label>
                    <input type="date" class="form-input" id="modal-remediation-due" value="\${control.remediation_due_date || ''}">
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
              <button class="btn btn-primary" onclick="saveControlAssessment('\${control.id}')">Save Assessment</button>
            </div>
          </div>
        </div>
      \`;
    }
    
    async function saveControlAssessment(controlId) {
      const data = {
        control_library_id: controlId,
        implementation_status: document.getElementById('modal-status').value,
        maturity_level: parseInt(document.getElementById('modal-maturity').value),
        evidence_description: document.getElementById('modal-evidence').value,
        gaps_identified: document.getElementById('modal-gaps').value,
        remediation_plan: document.getElementById('modal-remediation').value,
        remediation_owner_id: document.getElementById('modal-owner').value || null,
        remediation_due_date: document.getElementById('modal-remediation-due').value || null
      };
      
      try {
        await api('/compliance/assessment', {
          method: 'POST',
          body: JSON.stringify(data)
        });
        closeModal();
        showAlert('Assessment saved!', 'success');
        loadGapAssessment();
      } catch (error) {
        showAlert('Failed: ' + error.message, 'error');
      }
    }
    
    // Export Gap Assessment as PDF
    async function exportGapAssessmentPDF() {
      showAlert('Generating Gap Assessment PDF...', 'info');
      
      try {
        // Load jsPDF if not already loaded
        if (!window.jspdf) {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
          document.head.appendChild(script);
          await new Promise(resolve => script.onload = resolve);
        }
        
        // Get current data
        const data = await api('/compliance/controls');
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;
        let y = margin;
        
        // Helper function for page breaks
        function checkPageBreak(height) {
          if (y + height > pageHeight - margin) {
            doc.addPage();
            y = margin;
            return true;
          }
          return false;
        }
        
        // Title
        doc.setFillColor(27, 54, 93);
        doc.rect(0, 0, pageWidth, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('ISO 27001:2022 Gap Assessment Report', margin, 20);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Generated: ' + new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(), margin, 30);
        doc.text('Organization: ' + (currentUser?.organization_name || 'N/A'), pageWidth - margin - 60, 30);
        
        y = 50;
        doc.setTextColor(0, 0, 0);
        
        // Executive Summary
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Executive Summary', margin, y);
        y += 8;
        
        const stats = data.stats;
        const complianceRate = stats.total > 0 ? Math.round((stats.implemented / stats.total) * 100) : 0;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Total Controls: ' + stats.total, margin, y); y += 5;
        doc.text('Implemented: ' + stats.implemented + ' (' + complianceRate + '%)', margin, y); y += 5;
        doc.text('In Progress: ' + stats.in_progress, margin, y); y += 5;
        doc.text('Not Implemented: ' + stats.not_implemented, margin, y); y += 5;
        doc.text('Controls with Open Findings: ' + (stats.controls_with_open_risks || 0), margin, y); y += 10;
        
        // Progress bar
        doc.setFillColor(229, 231, 235);
        doc.rect(margin, y, 100, 6, 'F');
        doc.setFillColor(16, 185, 129);
        doc.rect(margin, y, complianceRate, 6, 'F');
        doc.setFontSize(8);
        doc.text(complianceRate + '% Compliant', margin + 105, y + 5);
        y += 15;
        
        // Controls by Category
        const categories = {};
        data.controls.forEach(ctrl => {
          if (!categories[ctrl.category]) categories[ctrl.category] = [];
          categories[ctrl.category].push(ctrl);
        });
        
        for (const [category, controls] of Object.entries(categories)) {
          checkPageBreak(20);
          
          // Category header
          doc.setFillColor(243, 244, 246);
          doc.rect(margin, y - 4, pageWidth - 2 * margin, 10, 'F');
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(27, 54, 93);
          doc.text(category + ' Controls (' + controls.length + ')', margin + 2, y + 2);
          y += 12;
          
          // Table header
          doc.setFillColor(27, 54, 93);
          doc.rect(margin, y - 4, pageWidth - 2 * margin, 8, 'F');
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(255, 255, 255);
          doc.text('Control', margin + 2, y);
          doc.text('Title', margin + 22, y);
          doc.text('Status', margin + 110, y);
          doc.text('Maturity', margin + 145, y);
          doc.text('Findings', margin + 170, y);
          y += 6;
          
          doc.setTextColor(0, 0, 0);
          doc.setFont('helvetica', 'normal');
          
          controls.forEach((ctrl, idx) => {
            checkPageBreak(8);
            
            // Alternate row colors
            if (idx % 2 === 0) {
              doc.setFillColor(249, 250, 251);
              doc.rect(margin, y - 3, pageWidth - 2 * margin, 6, 'F');
            }
            
            // Status colors
            const statusColors = {
              'implemented': [16, 185, 129],
              'in_progress': [245, 158, 11],
              'planned': [59, 130, 246],
              'not_started': [239, 68, 68],
              'not_applicable': [107, 114, 128]
            };
            
            const statusLabels = {
              'implemented': 'Implemented',
              'in_progress': 'In Progress',
              'planned': 'Planned',
              'not_started': 'Not Started',
              'not_applicable': 'N/A'
            };
            
            doc.setFontSize(7);
            doc.text(ctrl.control_id, margin + 2, y);
            
            // Truncate title if too long
            const title = ctrl.title.length > 55 ? ctrl.title.substring(0, 52) + '...' : ctrl.title;
            doc.text(title, margin + 22, y);
            
            // Status badge
            const status = ctrl.implementation_status || 'not_started';
            const statusColor = statusColors[status] || [107, 114, 128];
            doc.setFillColor(...statusColor);
            doc.roundedRect(margin + 110, y - 3, 30, 5, 1, 1, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(6);
            doc.text(statusLabels[status] || status, margin + 112, y - 0.5);
            
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(7);
            doc.text('Level ' + (ctrl.maturity_level || 0), margin + 147, y);
            
            // Findings indicator
            if (ctrl.open_risks > 0) {
              doc.setTextColor(239, 68, 68);
              doc.text(ctrl.open_risks + ' open', margin + 172, y);
              doc.setTextColor(0, 0, 0);
            } else {
              doc.setTextColor(16, 185, 129);
              doc.text('None', margin + 172, y);
              doc.setTextColor(0, 0, 0);
            }
            
            y += 6;
          });
          
          y += 5;
        }
        
        // Footer on last page
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text('Generated by GRCpulse - https://grc-pulse.pages.dev', margin, pageHeight - 10);
        doc.text('Page ' + doc.internal.getNumberOfPages(), pageWidth - margin - 15, pageHeight - 10);
        
        // Save the PDF
        doc.save('Gap-Assessment-' + new Date().toISOString().split('T')[0] + '.pdf');
        showAlert('Gap Assessment PDF downloaded!', 'success');
        
      } catch (error) {
        console.error('Gap Assessment PDF export error:', error);
        showAlert('Failed to generate PDF: ' + error.message, 'error');
      }
    }
    
    // Export Gap Assessment as CSV
    async function exportGapAssessmentCSV() {
      showAlert('Generating Gap Assessment CSV...', 'info');
      
      try {
        const data = await api('/compliance/controls');
        
        // Build CSV content
        const headers = ['Control ID', 'Category', 'Subcategory', 'Title', 'Description', 'Status', 'Maturity Level', 'Evidence', 'Gaps', 'Open Findings', 'Critical Control'];
        const rows = data.controls.map(ctrl => [
          ctrl.control_id,
          ctrl.category,
          ctrl.subcategory || '',
          '"' + (ctrl.title || '').replace(/"/g, '""') + '"',
          '"' + (ctrl.description || '').replace(/"/g, '""') + '"',
          ctrl.implementation_status || 'not_started',
          ctrl.maturity_level || 0,
          '"' + (ctrl.evidence_description || '').replace(/"/g, '""') + '"',
          '"' + (ctrl.gaps_identified || '').replace(/"/g, '""') + '"',
          ctrl.open_risks || 0,
          ctrl.is_critical ? 'Yes' : 'No'
        ]);
        
        const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\\n');
        
        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'Gap-Assessment-' + new Date().toISOString().split('T')[0] + '.csv';
        link.click();
        
        showAlert('Gap Assessment CSV downloaded!', 'success');
        
      } catch (error) {
        console.error('Gap Assessment CSV export error:', error);
        showAlert('Failed to generate CSV: ' + error.message, 'error');
      }
    }

    // Organization Settings
    async function loadOrgSettings() {
      try {
        const [profile, frameworks] = await Promise.all([
          api('/organization/profile').catch(() => null),
          api('/organization/frameworks').catch(() => [])
        ]);
        
        document.getElementById('page-actions').innerHTML = \`
          <button class="btn btn-primary" onclick="saveOrgSettings()">
            <i class="fas fa-save"></i> Save Changes
          </button>
        \`;
        
        const industries = [
          { value: 'technology', label: 'Technology / SaaS' },
          { value: 'finance', label: 'Financial Services' },
          { value: 'healthcare', label: 'Healthcare' },
          { value: 'retail', label: 'Retail / E-commerce' },
          { value: 'manufacturing', label: 'Manufacturing' },
          { value: 'government', label: 'Government / Public Sector' },
          { value: 'professional_services', label: 'Professional Services' },
          { value: 'education', label: 'Education' },
          { value: 'energy', label: 'Energy / Utilities' },
          { value: 'other', label: 'Other' }
        ];
        
        const regions = [
          { value: 'us', label: 'United States' },
          { value: 'eu', label: 'European Union' },
          { value: 'uk', label: 'United Kingdom' },
          { value: 'apac', label: 'Asia Pacific' },
          { value: 'latam', label: 'Latin America' },
          { value: 'mena', label: 'Middle East & Africa' },
          { value: 'global', label: 'Global Operations' }
        ];
        
        const operatingRegions = profile?.operating_regions || ['us'];
        
        document.getElementById('org-settings-page').innerHTML = \`
          <div class="grid-2">
            <div class="card">
              <div class="card-header">
                <h3 class="card-title"><i class="fas fa-building" style="margin-right: 8px; color: var(--accent-blue);"></i>Organization Profile</h3>
              </div>
              <div style="padding: 20px; display: flex; flex-direction: column; gap: 16px;">
                <div class="form-group">
                  <label class="form-label">Company Name</label>
                  <input type="text" class="form-input" id="org-company-name" value="\${profile?.company_name || ''}" placeholder="Enter company name">
                </div>
                <div class="form-group">
                  <label class="form-label">Industry</label>
                  <select class="form-select" id="org-industry" onchange="updateFrameworkRecommendations()">
                    \${industries.map(i => \`<option value="\${i.value}" \${profile?.industry === i.value ? 'selected' : ''}>\${i.label}</option>\`).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Industry Sector</label>
                  <input type="text" class="form-input" id="org-sector" value="\${profile?.industry_sector || ''}" placeholder="e.g., SaaS, Banking, Hospitals">
                </div>
                <div class="form-group">
                  <label class="form-label">Company Size</label>
                  <select class="form-select" id="org-size">
                    <option value="startup" \${profile?.company_size === 'startup' ? 'selected' : ''}>Startup (1-50)</option>
                    <option value="small" \${profile?.company_size === 'small' ? 'selected' : ''}>Small (51-200)</option>
                    <option value="medium" \${profile?.company_size === 'medium' ? 'selected' : ''}>Medium (201-1000)</option>
                    <option value="large" \${profile?.company_size === 'large' ? 'selected' : ''}>Large (1001-5000)</option>
                    <option value="enterprise" \${profile?.company_size === 'enterprise' ? 'selected' : ''}>Enterprise (5000+)</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Headquarters Region</label>
                  <select class="form-select" id="org-hq-region" onchange="updateFrameworkRecommendations()">
                    \${regions.map(r => \`<option value="\${r.value}" \${profile?.headquarters_region === r.value ? 'selected' : ''}>\${r.label}</option>\`).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Operating Regions</label>
                  <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                    \${regions.map(r => \`
                      <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; padding: 6px 10px; background: var(--bg-tertiary); border-radius: 6px; font-size: 13px;">
                        <input type="checkbox" id="region-\${r.value}" \${operatingRegions.includes(r.value) ? 'checked' : ''} onchange="updateFrameworkRecommendations()">
                        \${r.label}
                      </label>
                    \`).join('')}
                  </div>
                </div>
              </div>
            </div>
            
            <div class="card">
              <div class="card-header">
                <h3 class="card-title"><i class="fas fa-database" style="margin-right: 8px; color: var(--accent-purple);"></i>Data Types Handled</h3>
              </div>
              <div style="padding: 20px; display: flex; flex-direction: column; gap: 12px;">
                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 12px; background: var(--bg-tertiary); border-radius: 8px;">
                  <input type="checkbox" id="data-card" \${profile?.handles_card_data ? 'checked' : ''} onchange="updateFrameworkRecommendations()">
                  <div>
                    <div style="font-weight: 500;"><i class="fas fa-credit-card" style="margin-right: 6px; color: #f97316;"></i>Payment Card Data</div>
                    <div style="font-size: 12px; color: var(--text-muted);">Credit/debit card numbers, CVV, cardholder data</div>
                  </div>
                </label>
                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 12px; background: var(--bg-tertiary); border-radius: 8px;">
                  <input type="checkbox" id="data-health" \${profile?.handles_health_data ? 'checked' : ''} onchange="updateFrameworkRecommendations()">
                  <div>
                    <div style="font-weight: 500;"><i class="fas fa-heartbeat" style="margin-right: 6px; color: #ef4444;"></i>Health / PHI Data</div>
                    <div style="font-size: 12px; color: var(--text-muted);">Medical records, patient information, health data</div>
                  </div>
                </label>
                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 12px; background: var(--bg-tertiary); border-radius: 8px;">
                  <input type="checkbox" id="data-personal" \${profile?.handles_personal_data ? 'checked' : ''} onchange="updateFrameworkRecommendations()">
                  <div>
                    <div style="font-weight: 500;"><i class="fas fa-user-shield" style="margin-right: 6px; color: #3b82f6;"></i>Personal Data (PII)</div>
                    <div style="font-size: 12px; color: var(--text-muted);">Names, emails, addresses, SSN, personal identifiers</div>
                  </div>
                </label>
                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 12px; background: var(--bg-tertiary); border-radius: 8px;">
                  <input type="checkbox" id="data-financial" \${profile?.handles_financial_data ? 'checked' : ''} onchange="updateFrameworkRecommendations()">
                  <div>
                    <div style="font-weight: 500;"><i class="fas fa-dollar-sign" style="margin-right: 6px; color: #10b981;"></i>Financial Data</div>
                    <div style="font-size: 12px; color: var(--text-muted);">Banking details, transaction data, financial records</div>
                  </div>
                </label>
                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 12px; background: var(--bg-tertiary); border-radius: 8px;">
                  <input type="checkbox" id="data-government" \${profile?.handles_government_data ? 'checked' : ''} onchange="updateFrameworkRecommendations()">
                  <div>
                    <div style="font-weight: 500;"><i class="fas fa-landmark" style="margin-right: 6px; color: #6366f1;"></i>Government / CUI Data</div>
                    <div style="font-size: 12px; color: var(--text-muted);">Controlled unclassified info, government contracts</div>
                  </div>
                </label>
              </div>
              
              <div class="card-header" style="border-top: 1px solid var(--border-color); margin-top: 10px;">
                <h3 class="card-title"><i class="fas fa-sliders-h" style="margin-right: 8px; color: var(--accent-green);"></i>Risk & Maturity Settings</h3>
              </div>
              <div style="padding: 20px; display: flex; flex-direction: column; gap: 16px;">
                <div class="form-group">
                  <label class="form-label">Risk Appetite</label>
                  <select class="form-select" id="org-risk-appetite">
                    <option value="conservative" \${profile?.risk_appetite === 'conservative' ? 'selected' : ''}>Conservative - Minimize all risks</option>
                    <option value="moderate" \${profile?.risk_appetite === 'moderate' ? 'selected' : ''}>Moderate - Balanced approach</option>
                    <option value="aggressive" \${profile?.risk_appetite === 'aggressive' ? 'selected' : ''}>Aggressive - Accept higher risks for growth</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Target Security Maturity Level</label>
                  <select class="form-select" id="org-maturity-target">
                    <option value="1" \${profile?.security_maturity_target === 1 ? 'selected' : ''}>Level 1 - Initial</option>
                    <option value="2" \${profile?.security_maturity_target === 2 ? 'selected' : ''}>Level 2 - Developing</option>
                    <option value="3" \${profile?.security_maturity_target === 3 ? 'selected' : ''}>Level 3 - Defined</option>
                    <option value="4" \${profile?.security_maturity_target === 4 ? 'selected' : ''}>Level 4 - Managed</option>
                    <option value="5" \${profile?.security_maturity_target === 5 ? 'selected' : ''}>Level 5 - Optimizing</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          
          <div class="card" style="margin-top: 20px;">
            <div class="card-header">
              <h3 class="card-title"><i class="fas fa-clipboard-list" style="margin-right: 8px; color: var(--accent-yellow);"></i>Framework Applicability</h3>
              <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Toggle frameworks ON/OFF based on your compliance requirements. Auto-suggested based on profile.</p>
            </div>
            <div style="padding: 20px;">
              <div class="framework-grid" id="framework-applicability" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;">
                \${(frameworks || []).map(fw => \`
                  <div class="framework-card" style="background: var(--bg-tertiary); border-radius: 10px; padding: 16px; border: 2px solid \${fw.is_applicable ? 'var(--accent-green)' : 'var(--accent-red)'}; opacity: \${fw.is_applicable ? '1' : '0.7'};">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                      <div>
                        <div style="font-weight: 600; font-size: 15px;">\${fw.framework_name}</div>
                        <div style="font-size: 11px; color: var(--text-muted);">\${fw.framework_code} • \${fw.total_controls || 0} controls</div>
                      </div>
                      <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                        <span class="badge \${fw.is_applicable ? 'low' : 'critical'}" style="font-size: 10px;">
                          \${fw.is_applicable ? 'APPLICABLE' : 'NOT APPLICABLE'}
                        </span>
                        <label class="toggle-switch" title="Toggle applicability">
                          <input type="checkbox" id="fw-\${fw.framework_id}" \${fw.is_applicable ? 'checked' : ''} onchange="toggleFramework('\${fw.framework_id}', this.checked)">
                          <span class="toggle-slider"></span>
                        </label>
                      </div>
                    </div>
                    <div style="font-size: 12px; color: \${fw.is_applicable ? 'var(--accent-green)' : 'var(--accent-red)'}; margin-bottom: 10px; padding: 8px; background: \${fw.is_applicable ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; border-radius: 6px;">
                      <i class="fas \${fw.is_applicable ? 'fa-check-circle' : 'fa-times-circle'}" style="margin-right: 6px;"></i>
                      \${fw.applicability_reason || 'No reason specified'}
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; margin-bottom: 8px;">
                      <span class="badge \${fw.priority <= 2 ? 'high' : fw.priority <= 3 ? 'medium' : 'low'}">
                        Priority \${fw.priority || 3}
                      </span>
                      <span style="color: var(--text-muted);">
                        <i class="fas fa-bullseye" style="margin-right: 4px;"></i>Target: \${fw.target_score || 80}%
                      </span>
                    </div>
                    \${fw.is_applicable ? \`
                      <div style="margin-top: 8px; padding-top: 12px; border-top: 1px solid var(--border-color);">
                        <div style="display: flex; gap: 8px;">
                          <div style="flex: 1;">
                            <label style="font-size: 10px; color: var(--text-muted);">Target Score %</label>
                            <input type="number" class="form-input" id="fw-target-\${fw.framework_id}" value="\${fw.target_score || 80}" min="0" max="100" style="padding: 6px; font-size: 12px;">
                          </div>
                          <div style="flex: 1;">
                            <label style="font-size: 10px; color: var(--text-muted);">Target Date</label>
                            <input type="date" class="form-input" id="fw-date-\${fw.framework_id}" value="\${fw.target_date || ''}" style="padding: 6px; font-size: 12px;">
                          </div>
                        </div>
                      </div>
                    \` : \`
                      <div style="margin-top: 8px; padding: 10px; background: rgba(239, 68, 68, 0.05); border-radius: 6px; text-align: center;">
                        <span style="font-size: 11px; color: var(--text-muted);">
                          <i class="fas fa-info-circle" style="margin-right: 4px;"></i>
                          Toggle ON to include in compliance scope
                        </span>
                      </div>
                    \`}
                  </div>
                \`).join('')}
              </div>
            </div>
          </div>
          
          <style>
            .toggle-switch {
              position: relative;
              width: 44px;
              height: 24px;
            }
            .toggle-switch input {
              opacity: 0;
              width: 0;
              height: 0;
            }
            .toggle-slider {
              position: absolute;
              cursor: pointer;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background-color: var(--bg-secondary);
              transition: 0.3s;
              border-radius: 24px;
            }
            .toggle-slider:before {
              position: absolute;
              content: "";
              height: 18px;
              width: 18px;
              left: 3px;
              bottom: 3px;
              background-color: white;
              transition: 0.3s;
              border-radius: 50%;
            }
            .toggle-switch input:checked + .toggle-slider {
              background-color: var(--accent-blue);
            }
            .toggle-switch input:checked + .toggle-slider:before {
              transform: translateX(20px);
            }
          </style>
        \`;
      } catch (error) {
        document.getElementById('org-settings-page').innerHTML = \`
          <div class="alert error">Failed to load organization settings: \${error.message}</div>
        \`;
      }
    }
    
    async function saveOrgSettings() {
      try {
        const operatingRegions = ['us', 'eu', 'uk', 'apac', 'latam', 'mena', 'global']
          .filter(r => document.getElementById('region-' + r)?.checked);
        
        const profileData = {
          company_name: document.getElementById('org-company-name').value,
          industry: document.getElementById('org-industry').value,
          industry_sector: document.getElementById('org-sector').value,
          company_size: document.getElementById('org-size').value,
          headquarters_region: document.getElementById('org-hq-region').value,
          operating_regions: operatingRegions,
          handles_card_data: document.getElementById('data-card').checked ? 1 : 0,
          handles_health_data: document.getElementById('data-health').checked ? 1 : 0,
          handles_personal_data: document.getElementById('data-personal').checked ? 1 : 0,
          handles_financial_data: document.getElementById('data-financial').checked ? 1 : 0,
          handles_government_data: document.getElementById('data-government').checked ? 1 : 0,
          risk_appetite: document.getElementById('org-risk-appetite').value,
          security_maturity_target: parseInt(document.getElementById('org-maturity-target').value)
        };
        
        await api('/organization/profile', {
          method: 'POST',
          body: JSON.stringify(profileData)
        });
        
        // Save framework-specific settings only for applicable frameworks
        const frameworks = ['fw-iso27001', 'fw-nist-csf', 'fw-pci-dss', 'fw-soc2', 'fw-gdpr'];
        for (const fwId of frameworks) {
          const targetInput = document.getElementById('fw-target-' + fwId);
          const dateInput = document.getElementById('fw-date-' + fwId);
          
          // Only save if inputs exist (framework is applicable and expanded)
          if (targetInput) {
            const payload = {
              framework_id: fwId,
              target_score: parseInt(targetInput.value) || 80
            };
            if (dateInput && dateInput.value) {
              payload.target_date = dateInput.value;
            }
            await api('/organization/frameworks', {
              method: 'POST',
              body: JSON.stringify(payload)
            });
          }
        }
        
        showAlert('Organization settings saved successfully!', 'success');
        
        // Update the organization name in the header immediately
        if (profileData.company_name) {
          const orgNameElement = document.querySelector('.org-badge span');
          if (orgNameElement) {
            orgNameElement.textContent = profileData.company_name;
          }
        }
        
        loadOrgSettings(); // Reload to show updated framework applicability
      } catch (error) {
        showAlert('Failed to save settings: ' + error.message, 'error');
      }
    }
    
    async function toggleFramework(frameworkId, isApplicable) {
      try {
        await api('/organization/frameworks', {
          method: 'POST',
          body: JSON.stringify({
            framework_id: frameworkId,
            is_applicable: isApplicable ? 1 : 0
          })
        });
        loadOrgSettings(); // Reload to refresh UI
      } catch (error) {
        showAlert('Failed to update framework: ' + error.message, 'error');
      }
    }
    
    async function updateFrameworkRecommendations() {
      // Visual indicator that frameworks will be updated on save
      showAlert('Framework recommendations will update when you save changes', 'info');
    }
    
    // ============================================================================
    // SUPER ADMIN - MULTI-ORGANIZATION MANAGEMENT
    // ============================================================================
    
    let superAdminTab = 'organizations';
    
    async function loadSuperAdmin() {
      document.getElementById('page-actions').innerHTML = \`
        <button class="btn btn-primary" onclick="showCreateOrgModal()">
          <i class="fas fa-plus"></i> Create Organization
        </button>
      \`;
      
      const container = document.getElementById('super-admin-page');
      
      const orgsActive = superAdminTab === 'organizations' ? 'btn-primary' : '';
      const usersActive = superAdminTab === 'users' ? 'btn-primary' : '';
      const statsActive = superAdminTab === 'stats' ? 'btn-primary' : '';
      
      container.innerHTML = \`
        <div class="card" style="margin-bottom: 20px; background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(249, 115, 22, 0.05)); border: 1px solid rgba(245, 158, 11, 0.3);">
          <div style="padding: 20px; display: flex; align-items: center; gap: 16px;">
            <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #f59e0b, #f97316); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
              <i class="fas fa-crown" style="color: white; font-size: 24px;"></i>
            </div>
            <div>
              <h2 style="margin: 0; font-size: 20px; color: #f59e0b;">Super Admin Console</h2>
              <p style="margin: 4px 0 0 0; color: var(--text-muted); font-size: 13px;">Platform-wide management across all organizations</p>
            </div>
          </div>
        </div>
        
        <div style="display: flex; gap: 8px; margin-bottom: 20px;">
          <button class="btn \${orgsActive}" onclick="superAdminTab='organizations'; loadSuperAdmin();">
            <i class="fas fa-building"></i> Organizations
          </button>
          <button class="btn \${usersActive}" onclick="superAdminTab='users'; loadSuperAdmin();">
            <i class="fas fa-users"></i> All Users
          </button>
          <button class="btn \${statsActive}" onclick="superAdminTab='stats'; loadSuperAdmin();">
            <i class="fas fa-chart-bar"></i> Platform Stats
          </button>
        </div>
        
        <div id="super-admin-content"></div>
      \`;
      
      await loadSuperAdminTab(superAdminTab);
    }
    
    async function loadSuperAdminTab(tab) {
      const content = document.getElementById('super-admin-content');
      content.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
      
      try {
        if (tab === 'organizations') {
          const orgs = await api('/super-admin/organizations');
          content.innerHTML = \`
            <div class="card">
              <div class="card-header">
                <h3 class="card-title"><i class="fas fa-building" style="margin-right: 8px; color: var(--accent-blue);"></i>Organizations (\${orgs.length})</h3>
              </div>
              <div class="table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Organization</th>
                      <th>Industry</th>
                      <th>Size</th>
                      <th>Subscription</th>
                      <th>Users</th>
                      <th>Risks</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    \${orgs.map(org => \`
                      <tr>
                        <td>
                          <div style="font-weight: 600;">\${org.name}</div>
                          <div style="font-size: 11px; color: var(--text-muted);">\${org.id}</div>
                        </td>
                        <td>\${org.industry || '-'}</td>
                        <td>\${org.size || '-'}</td>
                        <td>
                          <span class="badge" style="background: \${org.subscription_tier === 'enterprise' ? '#8b5cf6' : org.subscription_tier === 'professional' ? '#3b82f6' : '#6b7280'};">
                            \${org.subscription_tier || 'free'}
                          </span>
                        </td>
                        <td>\${org.user_count || 0}</td>
                        <td>\${org.risk_count || 0}</td>
                        <td>
                          <span class="badge \${org.is_active ? 'badge-success' : 'badge-danger'}">
                            \${org.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <button class="btn btn-sm" onclick="editOrganization('\${org.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                          </button>
                          <button class="btn btn-sm" onclick="toggleOrgStatus('\${org.id}', \${org.is_active ? 0 : 1})" title="\${org.is_active ? 'Deactivate' : 'Activate'}">
                            <i class="fas fa-\${org.is_active ? 'ban' : 'check'}"></i>
                          </button>
                        </td>
                      </tr>
                    \`).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          \`;
        } else if (tab === 'users') {
          const users = await api('/super-admin/users');
          content.innerHTML = \`
            <div class="card">
              <div class="card-header">
                <h3 class="card-title"><i class="fas fa-users" style="margin-right: 8px; color: var(--accent-purple);"></i>All Users (\${users.length})</h3>
              </div>
              <div class="table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Organization</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Last Login</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    \${users.map(user => \`
                      <tr>
                        <td>
                          <div style="font-weight: 600;">\${user.display_name || user.email}</div>
                          <div style="font-size: 11px; color: var(--text-muted);">\${user.email}</div>
                        </td>
                        <td>
                          <div style="font-weight: 500;">\${user.org_name || '-'}</div>
                          <div style="font-size: 11px; color: var(--text-muted);">\${user.org_id || '-'}</div>
                        </td>
                        <td>
                          <span class="badge" style="background: \${user.role === 'super_admin' ? '#f59e0b' : user.role === 'org_admin' ? '#8b5cf6' : '#3b82f6'};">
                            \${getRoleLabel(user.role)}
                          </span>
                        </td>
                        <td>
                          <span class="badge \${user.status === 'active' ? 'badge-success' : 'badge-warning'}">
                            \${user.status || 'pending'}
                          </span>
                        </td>
                        <td style="font-size: 12px;">\${user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}</td>
                        <td>
                          <button class="btn btn-sm" onclick="editUserRole('\${user.id}', '\${user.role}')" title="Change Role">
                            <i class="fas fa-user-cog"></i>
                          </button>
                        </td>
                      </tr>
                    \`).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          \`;
        } else if (tab === 'stats') {
          const stats = await api('/super-admin/stats');
          content.innerHTML = \`
            <div class="metrics-grid">
              <div class="metric-card" style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.05));">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <div class="metric-value" style="color: #3b82f6;">\${stats.organizations?.total || 0}</div>
                    <div class="metric-label">Total Organizations</div>
                    <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">\${stats.organizations?.active || 0} active</div>
                  </div>
                  <div class="metric-icon" style="background: rgba(59, 130, 246, 0.2);"><i class="fas fa-building" style="color: #3b82f6;"></i></div>
                </div>
              </div>
              <div class="metric-card" style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(139, 92, 246, 0.05));">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <div class="metric-value" style="color: #8b5cf6;">\${stats.users?.total || 0}</div>
                    <div class="metric-label">Total Users</div>
                    <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">\${stats.users?.active || 0} active</div>
                  </div>
                  <div class="metric-icon" style="background: rgba(139, 92, 246, 0.2);"><i class="fas fa-users" style="color: #8b5cf6;"></i></div>
                </div>
              </div>
              <div class="metric-card" style="background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.05));">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <div class="metric-value" style="color: #ef4444;">\${stats.risks || 0}</div>
                    <div class="metric-label">Total Risks</div>
                  </div>
                  <div class="metric-icon" style="background: rgba(239, 68, 68, 0.2);"><i class="fas fa-exclamation-triangle" style="color: #ef4444;"></i></div>
                </div>
              </div>
              <div class="metric-card" style="background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05));">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <div class="metric-value" style="color: #22c55e;">\${stats.assets || 0}</div>
                    <div class="metric-label">Total Assets</div>
                  </div>
                  <div class="metric-icon" style="background: rgba(34, 197, 94, 0.2);"><i class="fas fa-server" style="color: #22c55e;"></i></div>
                </div>
              </div>
            </div>
          \`;
        }
      } catch (error) {
        content.innerHTML = '<div class="alert error">Failed to load data: ' + error.message + '</div>';
      }
    }
    
    function showCreateOrgModal() {
      document.getElementById('modal-container').innerHTML = \`
        <div class="modal-overlay" onclick="closeModal()">
          <div class="modal" onclick="event.stopPropagation()" style="max-width: 500px;">
            <div class="modal-header">
              <h3><i class="fas fa-building" style="margin-right: 8px; color: #f59e0b;"></i>Create New Organization</h3>
              <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Organization Name *</label>
                <input type="text" class="form-input" id="new-org-name" placeholder="e.g., Acme Corp">
              </div>
              <div class="form-group">
                <label class="form-label">Industry</label>
                <select class="form-select" id="new-org-industry">
                  <option value="technology">Technology</option>
                  <option value="finance">Financial Services</option>
                  <option value="healthcare">Healthcare</option>
                  <option value="retail">Retail</option>
                  <option value="manufacturing">Manufacturing</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Size</label>
                <select class="form-select" id="new-org-size">
                  <option value="startup">Startup (1-50)</option>
                  <option value="smb" selected>SMB (51-1000)</option>
                  <option value="enterprise">Enterprise (1000+)</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Subscription Tier</label>
                <select class="form-select" id="new-org-tier">
                  <option value="free">Free</option>
                  <option value="professional" selected>Professional</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <hr style="margin: 20px 0; border-color: var(--border-color);">
              <h4 style="margin-bottom: 16px; color: var(--text-secondary);"><i class="fas fa-user-shield" style="margin-right: 8px;"></i>Organization Admin</h4>
              <div class="form-group">
                <label class="form-label">Admin Name *</label>
                <input type="text" class="form-input" id="new-org-admin-name" placeholder="e.g., John Smith">
              </div>
              <div class="form-group">
                <label class="form-label">Admin Email *</label>
                <input type="email" class="form-input" id="new-org-admin-email" placeholder="e.g., admin@company.com">
              </div>
              <div class="form-group">
                <label class="form-label">Admin Password</label>
                <input type="password" class="form-input" id="new-org-admin-password" placeholder="Leave blank for default: Admin@2026">
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn" onclick="closeModal()">Cancel</button>
              <button class="btn btn-primary" onclick="createOrganization()">
                <i class="fas fa-plus"></i> Create Organization
              </button>
            </div>
          </div>
        </div>
      \`;
    }
    
    async function createOrganization() {
      const name = document.getElementById('new-org-name').value;
      const adminName = document.getElementById('new-org-admin-name').value;
      const adminEmail = document.getElementById('new-org-admin-email').value;
      
      if (!name || !adminName || !adminEmail) {
        showAlert('Please fill in all required fields', 'error');
        return;
      }
      
      try {
        const result = await api('/super-admin/organizations', {
          method: 'POST',
          body: JSON.stringify({
            name: name,
            industry: document.getElementById('new-org-industry').value,
            size: document.getElementById('new-org-size').value,
            subscription_tier: document.getElementById('new-org-tier').value,
            admin_name: adminName,
            admin_email: adminEmail,
            admin_password: document.getElementById('new-org-admin-password').value || 'Admin@2026'
          })
        });
        
        closeModal();
        showAlert('Organization created successfully! Admin can login with: ' + adminEmail, 'success');
        loadSuperAdmin();
      } catch (error) {
        showAlert('Failed to create organization: ' + error.message, 'error');
      }
    }
    
    async function toggleOrgStatus(orgId, newStatus) {
      if (!confirm('Are you sure you want to ' + (newStatus ? 'activate' : 'deactivate') + ' this organization?')) return;
      
      try {
        await api('/super-admin/organizations/' + orgId, {
          method: 'PUT',
          body: JSON.stringify({ is_active: newStatus })
        });
        showAlert('Organization status updated', 'success');
        loadSuperAdmin();
      } catch (error) {
        showAlert('Failed to update organization: ' + error.message, 'error');
      }
    }
    
    function editOrganization(orgId) {
      showAlert('Edit organization modal coming soon', 'info');
    }
    
    function editUserRole(userId, currentRole) {
      showAlert('Edit user role modal coming soon', 'info');
    }
    
    // ============================================================================
    // ORG ADMIN DASHBOARD
    // ============================================================================
    
    let orgAdminTab = 'users';
    
    async function loadOrgAdmin() {
      document.getElementById('page-actions').innerHTML = '';
      var container = document.getElementById('org-admin-page');
      
      var usersActive = orgAdminTab === 'users' ? 'btn-primary' : '';
      var modulesActive = orgAdminTab === 'modules' ? 'btn-primary' : '';
      var activityActive = orgAdminTab === 'activity' ? 'btn-primary' : '';
      
      var html = '<div class="card">';
      html += '<div class="card-header"><div style="display: flex; gap: 8px;">';
      html += '<button class="btn ' + usersActive + '" onclick="switchOrgAdminTab(&quot;users&quot;)"><i class="fas fa-users"></i> Users</button>';
      html += '<button class="btn ' + modulesActive + '" onclick="switchOrgAdminTab(&quot;modules&quot;)"><i class="fas fa-cubes"></i> Modules</button>';
      html += '<button class="btn ' + activityActive + '" onclick="switchOrgAdminTab(&quot;activity&quot;)"><i class="fas fa-history"></i> Activity</button>';
      html += '</div></div>';
      html += '<div id="org-admin-content" style="padding: 20px;"><div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading...</div></div>';
      html += '</div>';
      
      container.innerHTML = html;
      
      await loadOrgAdminTab(orgAdminTab);
    }
    
    function switchOrgAdminTab(tab) {
      orgAdminTab = tab;
      loadOrgAdmin();
    }
    
    async function loadOrgAdminTab(tab) {
      const content = document.getElementById('org-admin-content');
      
      if (tab === 'users') {
        await loadUsersTab(content);
      } else if (tab === 'modules') {
        loadModulesTab(content);
      } else if (tab === 'activity') {
        await loadActivityTab(content);
      }
    }
    
    async function loadUsersTab(content) {
      try {
        const users = await api('/organization/users');
        
        let html = '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;"><h3><i class="fas fa-users" style="margin-right: 8px; color: var(--accent-blue);"></i>Team Members</h3><button class="btn btn-primary" onclick="showAddUserModal()"><i class="fas fa-plus"></i> Add User</button></div>';
        
        html += '<table class="data-table"><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
        
        if (users.length === 0) {
          html += '<tr><td colspan="5" style="text-align: center; padding: 40px;">No users found. Click "Add User" to add team members.</td></tr>';
        } else {
          users.forEach(function(u) {
            var name = u.display_name || u.first_name + ' ' + u.last_name || 'Unknown';
            var initial = name.charAt(0).toUpperCase();
            var roleLabel = {'org_admin': 'Admin', 'ciso': 'CISO', 'executive': 'Executive', 'grc_manager': 'GRC Manager', 'auditor': 'Auditor', 'pentester': 'Pentester', 'viewer': 'Viewer'}[u.role] || u.role;
            var roleBadge = {'org_admin': 'high', 'ciso': 'high', 'executive': 'high', 'grc_manager': 'medium', 'auditor': 'medium', 'pentester': 'medium', 'viewer': 'low'}[u.role] || 'low';
            var statusBadge = u.status === 'active' ? 'low' : u.status === 'pending' ? 'medium' : 'critical';
            var statusLabel = u.status === 'pending' ? 'Pending Invite' : u.status;
            
            html += '<tr>';
            html += '<td><div style="display: flex; align-items: center; gap: 10px;"><div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple)); display: flex; align-items: center; justify-content: center; font-weight: 600;">' + initial + '</div><div><div style="font-weight: 500;">' + name + '</div><div style="font-size: 11px; color: var(--text-muted);">' + (u.job_title || 'Team Member') + '</div></div></div></td>';
            html += '<td>' + u.email + '</td>';
            html += '<td><span class="badge ' + roleBadge + '">' + roleLabel + '</span></td>';
            html += '<td><span class="badge ' + statusBadge + '">' + statusLabel + '</span></td>';
            html += '<td style="white-space: nowrap;">';
            // Show resend invite button for pending users
            if (u.status === 'pending') {
              html += '<button class="btn btn-sm" onclick="resendInvite(&quot;' + u.id + '&quot;, &quot;' + name + '&quot;, &quot;' + u.email + '&quot;)" style="color: var(--accent-green);" title="Resend Invite"><i class="fas fa-paper-plane"></i></button> ';
            }
            html += '<button class="btn btn-sm" onclick="showEditUserModal(&quot;' + u.id + '&quot;)" title="Edit"><i class="fas fa-edit"></i></button> ';
            html += '<button class="btn btn-sm" onclick="deleteUser(&quot;' + u.id + '&quot;)" style="color: var(--accent-red);" title="Delete"><i class="fas fa-trash"></i></button>';
            html += '</td>';
            html += '</tr>';
          });
        }
        
        html += '</tbody></table>';
        
        // Stats
        html += '<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-top: 20px;">';
        html += '<div style="text-align: center; padding: 20px; background: var(--bg-tertiary); border-radius: 8px;"><div style="font-size: 28px; font-weight: 700; color: var(--accent-blue);">' + users.length + '</div><div style="font-size: 12px; color: var(--text-muted);">Total Users</div></div>';
        html += '<div style="text-align: center; padding: 20px; background: var(--bg-tertiary); border-radius: 8px;"><div style="font-size: 28px; font-weight: 700; color: var(--accent-green);">' + users.filter(function(u) { return u.status === 'active'; }).length + '</div><div style="font-size: 12px; color: var(--text-muted);">Active</div></div>';
        html += '<div style="text-align: center; padding: 20px; background: var(--bg-tertiary); border-radius: 8px;"><div style="font-size: 28px; font-weight: 700; color: var(--accent-yellow);">' + users.filter(function(u) { return u.status === 'pending'; }).length + '</div><div style="font-size: 12px; color: var(--text-muted);">Pending</div></div>';
        html += '<div style="text-align: center; padding: 20px; background: var(--bg-tertiary); border-radius: 8px;"><div style="font-size: 28px; font-weight: 700; color: var(--accent-purple);">' + users.filter(function(u) { return u.role === 'org_admin'; }).length + '</div><div style="font-size: 12px; color: var(--text-muted);">Admins</div></div>';
        html += '</div>';
        
        content.innerHTML = html;
      } catch (error) {
        content.innerHTML = '<div class="alert error">Failed to load users: ' + error.message + '</div>';
      }
    }
    
    async function resendInvite(userId, name, email) {
      try {
        var response = await api('/organization/users/' + userId + '/invite', { method: 'POST' });
        if (response.inviteToken) {
          showInviteLinkModal(name, email, response.inviteToken);
        } else {
          showAlert('Failed to generate invitation link', 'error');
        }
      } catch (error) {
        showAlert('Failed to resend invitation: ' + error.message, 'error');
      }
    }
    
    function loadModulesTab(content) {
      var html = '<h3 style="margin-bottom: 20px;"><i class="fas fa-cubes" style="margin-right: 8px; color: var(--accent-purple);"></i>Modules & Role Permissions</h3>';
      
      html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px;">';
      
      // GRC Pulse
      html += '<div style="background: var(--bg-tertiary); border-radius: 12px; padding: 20px; border: 2px solid var(--accent-blue);">';
      html += '<div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;"><div style="width: 50px; height: 50px; border-radius: 10px; background: linear-gradient(135deg, var(--accent-blue), #60a5fa); display: flex; align-items: center; justify-content: center;"><i class="fas fa-shield-alt" style="font-size: 24px; color: white;"></i></div><div><div style="font-size: 18px; font-weight: 600;">GRC Pulse</div><div style="font-size: 12px; color: var(--text-muted);">Risk & Compliance</div></div><span class="badge low" style="margin-left: auto;">ACTIVE</span></div>';
      html += '<ul style="font-size: 13px; margin: 0 0 0 20px; color: var(--text-secondary);"><li>Risk Register</li><li>Compliance Frameworks</li><li>Asset Management</li><li>Audit Program</li></ul>';
      html += '</div>';
      
      // PentestPulse
      html += '<div style="background: var(--bg-tertiary); border-radius: 12px; padding: 20px; border: 2px solid var(--accent-purple);">';
      html += '<div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;"><div style="width: 50px; height: 50px; border-radius: 10px; background: linear-gradient(135deg, var(--accent-purple), #a78bfa); display: flex; align-items: center; justify-content: center;"><i class="fas fa-crosshairs" style="font-size: 24px; color: white;"></i></div><div><div style="font-size: 18px; font-weight: 600;">PentestPulse</div><div style="font-size: 12px; color: var(--text-muted);">Penetration Testing</div></div><span class="badge low" style="margin-left: auto;">ACTIVE</span></div>';
      html += '<ul style="font-size: 13px; margin: 0 0 0 20px; color: var(--text-secondary);"><li>Project Management</li><li>Vulnerability Tracking</li><li>Scanner Import</li><li>Report Generation</li></ul>';
      html += '<a href="https://pentest-pulse.pages.dev" target="_blank" class="btn btn-sm" style="margin-top: 16px;"><i class="fas fa-external-link-alt"></i> Open PentestPulse</a>';
      html += '</div>';
      
      html += '</div>';
      
      // Role Permissions Matrix
      html += '<div style="margin-top: 24px; padding: 20px; background: var(--bg-tertiary); border-radius: 12px;">';
      html += '<h4 style="margin-bottom: 16px;"><i class="fas fa-user-shield" style="margin-right: 8px; color: var(--accent-blue);"></i>Role Permissions Matrix</h4>';
      html += '<div style="overflow-x: auto;"><table class="data-table" style="font-size: 12px;">';
      html += '<thead><tr><th>Module</th><th>\u2699\ufe0f Admin</th><th>\ud83d\udc54 CISO</th><th>\ud83d\udcca Executive</th><th>\ud83d\udee1 GRC Mgr</th><th>\ud83d\udccb Auditor</th><th>\ud83c\udfaf Pentester</th><th>\ud83d\udc41 Viewer</th></tr></thead>';
      html += '<tbody>';
      // GRC Modules
      html += '<tr style="background: var(--bg-secondary);"><td colspan="8" style="font-weight: 600; color: var(--accent-blue);"><i class="fas fa-shield-alt"></i> GRC Pulse</td></tr>';
      html += '<tr><td>Dashboard</td><td>\u2705</td><td>\u2705</td><td>\u2705</td><td>\u2705</td><td>\u2705</td><td>\u274c</td><td>\u2705</td></tr>';
      html += '<tr><td>Executive Summary</td><td>\u2705</td><td>\u2705</td><td>\u2705</td><td>\u2705</td><td>\u2705</td><td>\u274c</td><td>\u2705</td></tr>';
      html += '<tr><td>Risk Register</td><td>\u2705</td><td>\u2705</td><td>\u274c</td><td>\u2705</td><td>\u2705</td><td>\u274c</td><td>\u2705</td></tr>';
      html += '<tr><td>Assets & Vendors</td><td>\u2705</td><td>\u2705</td><td>\u274c</td><td>\u2705</td><td>\u274c</td><td>\u274c</td><td>\u2705</td></tr>';
      html += '<tr><td>Compliance</td><td>\u2705</td><td>\u2705</td><td>\u274c</td><td>\u2705</td><td>\u2705</td><td>\u274c</td><td>\u2705</td></tr>';
      html += '<tr><td>Audit Management</td><td>\u2705</td><td>\u2705</td><td>\u274c</td><td>\u274c</td><td>\u2705</td><td>\u274c</td><td>\u274c</td></tr>';
      html += '<tr><td>AI Co-pilot</td><td>\u2705</td><td>\u2705</td><td>\u274c</td><td>\u2705</td><td>\u2705</td><td>\u274c</td><td>\u274c</td></tr>';
      html += '<tr><td>Org Admin</td><td>\u2705</td><td>\u274c</td><td>\u274c</td><td>\u274c</td><td>\u274c</td><td>\u274c</td><td>\u274c</td></tr>';
      // Pentest Modules
      html += '<tr style="background: var(--bg-secondary);"><td colspan="8" style="font-weight: 600; color: var(--accent-purple);"><i class="fas fa-crosshairs"></i> PentestPulse</td></tr>';
      html += '<tr><td>Dashboard</td><td>\u2705</td><td>\u2705</td><td>\u2705</td><td>\u274c</td><td>\u274c</td><td>\u2705</td><td>\u2705</td></tr>';
      html += '<tr><td>Projects & Findings</td><td>\u2705</td><td>\u274c</td><td>\u2705</td><td>\u274c</td><td>\u274c</td><td>\u2705</td><td>\u2705</td></tr>';
      html += '<tr><td>Scanner Import</td><td>\u2705</td><td>\u274c</td><td>\u274c</td><td>\u274c</td><td>\u274c</td><td>\u2705</td><td>\u274c</td></tr>';
      html += '<tr><td>Reports</td><td>\u2705</td><td>\u2705</td><td>\u2705</td><td>\u274c</td><td>\u274c</td><td>\u2705</td><td>\u2705</td></tr>';
      html += '</tbody></table></div>';
      html += '<div style="margin-top: 12px; font-size: 11px; color: var(--text-muted);">\u2705 = Full Access | \u274c = No Access</div>';
      html += '</div>';
      
      // Integration Status
      html += '<div style="margin-top: 20px; padding: 20px; background: var(--bg-tertiary); border-radius: 12px;">';
      html += '<h4 style="margin-bottom: 16px;"><i class="fas fa-sync-alt" style="margin-right: 8px; color: var(--accent-green);"></i>Integration Status</h4>';
      html += '<div style="display: flex; justify-content: space-between; align-items: center;"><span>GRC \u2194 PentestPulse Sync</span><span class="badge low"><i class="fas fa-check-circle"></i> Connected</span></div>';
      html += '</div>';
      
      content.innerHTML = html;
    }
    
    async function loadActivityTab(content) {
      try {
        var response = await api('/organization/activity?limit=50');
        var activities = response.items || [];
        
        var html = '<h3 style="margin-bottom: 20px;"><i class="fas fa-history" style="margin-right: 8px; color: var(--accent-yellow);"></i>Activity Log</h3>';
        
        if (activities.length === 0) {
          html += '<div style="text-align: center; padding: 60px; color: var(--text-muted);"><i class="fas fa-clipboard-list" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i><div>No activity recorded yet</div></div>';
        } else {
          html += '<div style="max-height: 500px; overflow-y: auto;">';
          activities.forEach(function(act) {
            var icon = 'fa-info-circle';
            var color = 'var(--text-muted)';
            if (act.action && act.action.indexOf('user') >= 0) { icon = 'fa-user'; color = 'var(--accent-blue)'; }
            if (act.action && act.action.indexOf('risk') >= 0) { icon = 'fa-exclamation-triangle'; color = 'var(--accent-red)'; }
            if (act.action && act.action.indexOf('login') >= 0) { icon = 'fa-sign-in-alt'; color = 'var(--accent-green)'; }
            
            var details = {};
            try { details = typeof act.details === 'string' ? JSON.parse(act.details || '{}') : (act.details || {}); } catch(e) {}
            
            html += '<div style="display: flex; gap: 16px; padding: 16px; border-bottom: 1px solid var(--border-color);">';
            html += '<div style="width: 40px; height: 40px; border-radius: 50%; background: ' + color + '20; display: flex; align-items: center; justify-content: center;"><i class="fas ' + icon + '" style="color: ' + color + ';"></i></div>';
            html += '<div style="flex: 1;"><div style="font-weight: 500;">' + (act.action || 'Activity').replace(/_/g, ' ') + '</div>';
            html += '<div style="font-size: 12px; color: var(--text-muted);">By: ' + (act.user_name || act.user_email || 'System') + ' • ' + new Date(act.created_at).toLocaleString() + '</div>';
            if (details.email) html += '<div style="font-size: 12px; color: var(--text-secondary);">Email: ' + details.email + '</div>';
            html += '</div></div>';
          });
          html += '</div>';
        }
        
        content.innerHTML = html;
      } catch (error) {
        content.innerHTML = '<div class="alert error">Failed to load activity: ' + error.message + '</div>';
      }
    }
    
    function showAddUserModal() {
      var html = '<div class="modal-overlay" onclick="closeModal(event)"><div class="modal" onclick="event.stopPropagation()" style="max-width: 500px;">';
      html += '<div class="modal-header"><h3><i class="fas fa-user-plus"></i> Add Team Member</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>';
      html += '<div class="modal-body">';
      html += '<div class="form-group"><label class="form-label">Full Name *</label><input type="text" class="form-input" id="new-user-name" placeholder="John Doe"></div>';
      html += '<div class="form-group"><label class="form-label">Email *</label><input type="email" class="form-input" id="new-user-email" placeholder="john@company.com"></div>';
      html += '<div class="form-group"><label class="form-label">Job Title</label><input type="text" class="form-input" id="new-user-title" placeholder="Security Analyst"></div>';
      html += '<div class="form-group"><label class="form-label">Role</label><select class="form-select" id="new-user-role">';
        html += '<option value="viewer">👁 Viewer - Read-only access</option>';
        html += '<option value="pentester">🎯 Pentester - Pen testing projects</option>';
        html += '<option value="auditor">📋 Auditor - Audit & compliance</option>';
        html += '<option value="grc_manager" selected>🛡 GRC Manager - Risk & compliance mgmt</option>';
        html += '<option value="executive">📊 Executive - C-level dashboards</option>';
        html += '<option value="ciso">👔 CISO - Security leadership</option>';
        html += '<option value="org_admin">⚙️ Admin - Full access</option>';
        html += '</select></div>';
      html += '</div>';
      html += '<div class="modal-footer"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveNewUser()"><i class="fas fa-plus"></i> Add User</button></div>';
      html += '</div></div>';
      
      document.getElementById('modal-container').innerHTML = html;
    }
    
    async function saveNewUser() {
      var name = document.getElementById('new-user-name').value.trim();
      var email = document.getElementById('new-user-email').value.trim();
      var title = document.getElementById('new-user-title').value.trim();
      var role = document.getElementById('new-user-role').value;
      
      if (!name || !email) {
        showAlert('Name and email are required', 'error');
        return;
      }
      
      try {
        var response = await api('/organization/users', {
          method: 'POST',
          body: JSON.stringify({ name: name, email: email, job_title: title, role: role })
        });
        
        // Show invitation link modal
        if (response.inviteToken) {
          showInviteLinkModal(name, email, response.inviteToken);
        } else {
          showAlert('User added successfully!', 'success');
          closeModal();
          loadOrgAdmin();
        }
      } catch (error) {
        showAlert('Failed to add user: ' + error.message, 'error');
      }
    }
    
    function showInviteLinkModal(name, email, token) {
      var inviteUrl = window.location.origin + '/invite/' + token;
      
      var html = '<div class="modal-overlay"><div class="modal" onclick="event.stopPropagation()" style="max-width: 550px;">';
      html += '<div class="modal-header" style="background: linear-gradient(135deg, var(--accent-green), var(--accent-blue));"><h3 style="color: white;"><i class="fas fa-check-circle"></i> User Created Successfully!</h3></div>';
      html += '<div class="modal-body" style="padding: 24px;">';
      html += '<p style="margin-bottom: 16px;">Share this invitation link with <strong>' + name + '</strong> (' + email + ') to let them set up their password:</p>';
      html += '<div style="background: var(--bg-tertiary); border-radius: 8px; padding: 12px; margin-bottom: 16px; position: relative;">';
      html += '<input type="text" id="invite-link" value="' + inviteUrl + '" readonly style="width: 100%; background: transparent; border: none; color: var(--text-primary); font-size: 13px; font-family: monospace;">';
      html += '</div>';
      html += '<button class="btn btn-primary" onclick="copyInviteLink()" style="width: 100%; margin-bottom: 12px;"><i class="fas fa-copy"></i> Copy Invitation Link</button>';
      html += '<div style="background: rgba(234, 179, 8, 0.1); border: 1px solid var(--accent-yellow); border-radius: 8px; padding: 12px; font-size: 13px;">';
      html += '<i class="fas fa-info-circle" style="color: var(--accent-yellow); margin-right: 8px;"></i>';
      html += '<strong>Note:</strong> This link expires in 48 hours. The user status is "pending" until they activate their account.';
      html += '</div>';
      html += '</div>';
      html += '<div class="modal-footer"><button class="btn btn-primary" onclick="closeModal(); loadOrgAdmin();"><i class="fas fa-check"></i> Done</button></div>';
      html += '</div></div>';
      
      document.getElementById('modal-container').innerHTML = html;
    }
    
    function copyInviteLink() {
      var linkInput = document.getElementById('invite-link');
      linkInput.select();
      document.execCommand('copy');
      showAlert('Invitation link copied to clipboard!', 'success');
    }
    
    async function showEditUserModal(userId) {
      try {
        var users = await api('/organization/users');
        var user = users.find(function(u) { return u.id === userId; });
        if (!user) return;
        
        var name = user.display_name || (user.first_name + ' ' + user.last_name) || '';
        
        var html = '<div class="modal-overlay" onclick="closeModal(event)"><div class="modal" onclick="event.stopPropagation()" style="max-width: 500px;">';
        html += '<div class="modal-header"><h3><i class="fas fa-user-edit"></i> Edit User</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>';
        html += '<div class="modal-body">';
        html += '<div class="form-group"><label class="form-label">Full Name</label><input type="text" class="form-input" id="edit-user-name" value="' + name + '"></div>';
        html += '<div class="form-group"><label class="form-label">Email</label><input type="email" class="form-input" id="edit-user-email" value="' + user.email + '" readonly style="background: var(--bg-tertiary);"></div>';
        html += '<div class="form-group"><label class="form-label">Job Title</label><input type="text" class="form-input" id="edit-user-title" value="' + (user.job_title || '') + '"></div>';
        html += '<div class="form-group"><label class="form-label">Role</label><select class="form-select" id="edit-user-role">';
        html += '<option value="viewer" ' + (user.role === 'viewer' ? 'selected' : '') + '>👁 Viewer - Read-only</option>';
        html += '<option value="pentester" ' + (user.role === 'pentester' ? 'selected' : '') + '>🎯 Pentester - Pen testing</option>';
        html += '<option value="auditor" ' + (user.role === 'auditor' ? 'selected' : '') + '>📋 Auditor - Audit & compliance</option>';
        html += '<option value="grc_manager" ' + (user.role === 'grc_manager' ? 'selected' : '') + '>🛡 GRC Manager - Risk mgmt</option>';
        html += '<option value="executive" ' + (user.role === 'executive' ? 'selected' : '') + '>📊 Executive - C-level view</option>';
        html += '<option value="ciso" ' + (user.role === 'ciso' ? 'selected' : '') + '>👔 CISO - Security lead</option>';
        html += '<option value="org_admin" ' + (user.role === 'org_admin' ? 'selected' : '') + '>⚙️ Admin - Full access</option>';
        html += '</select></div>';
        html += '<div class="form-group"><label class="form-label">Status</label><select class="form-select" id="edit-user-status"><option value="active" ' + (user.status === 'active' ? 'selected' : '') + '>Active</option><option value="inactive" ' + (user.status === 'inactive' ? 'selected' : '') + '>Inactive</option></select></div>';
        html += '<input type="hidden" id="edit-user-id" value="' + userId + '">';
        html += '</div>';
        html += '<div class="modal-footer"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveEditUser()"><i class="fas fa-save"></i> Save</button></div>';
        html += '</div></div>';
        
        document.getElementById('modal-container').innerHTML = html;
      } catch (error) {
        showAlert('Failed to load user: ' + error.message, 'error');
      }
    }
    
    async function saveEditUser() {
      var userId = document.getElementById('edit-user-id').value;
      var name = document.getElementById('edit-user-name').value.trim();
      var title = document.getElementById('edit-user-title').value.trim();
      var role = document.getElementById('edit-user-role').value;
      var status = document.getElementById('edit-user-status').value;
      
      try {
        await api('/organization/users/' + userId, {
          method: 'PUT',
          body: JSON.stringify({ name: name, job_title: title, role: role, status: status })
        });
        showAlert('User updated successfully!', 'success');
        closeModal();
        loadOrgAdmin();
      } catch (error) {
        showAlert('Failed to update user: ' + error.message, 'error');
      }
    }
    
    async function deleteUser(userId) {
      if (!confirm('Are you sure you want to remove this user?')) return;
      
      try {
        await api('/organization/users/' + userId, { method: 'DELETE' });
        showAlert('User removed successfully', 'success');
        loadOrgAdmin();
      } catch (error) {
        showAlert('Failed to remove user: ' + error.message, 'error');
      }
    }
    
    function switchComplianceMode(mode) {
      complianceMode = mode;
      loadComplianceDashboard();
    }
    
    // Export Compliance Report as PDF
    async function exportCompliancePDF() {
      showAlert('Generating PDF report...', 'info');
      
      try {
        // Load jsPDF if not already loaded
        if (!window.jspdf) {
          const jspdfScript = document.createElement('script');
          jspdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
          document.head.appendChild(jspdfScript);
          await new Promise(resolve => jspdfScript.onload = resolve);
        }
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = 210;
        const pageHeight = 297;
        const margin = 15;
        const contentWidth = pageWidth - (margin * 2);
        const footerY = pageHeight - 15;
        let pageNum = 1;
        
        const t = Date.now();
        const data = await api('/compliance/dashboard?mode=' + complianceMode + '&_t=' + t);
        const complianceOrgName = document.querySelector('.org-badge span')?.textContent || 'Organization';
        
        // Helper: Check if we need a new page
        function checkPageBreak(neededHeight, currentY) {
          if (currentY + neededHeight > footerY - 10) {
            addFooter();
            doc.addPage();
            pageNum++;
            return margin + 10; // Return new Y position after page break
          }
          return currentY;
        }
        
        // Helper: Add footer to current page
        function addFooter() {
          doc.setFillColor(27, 54, 93);
          doc.rect(0, footerY, pageWidth, 15, 'F');
          doc.setTextColor(200, 210, 220);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'normal');
          doc.text('GRC Pulse - Governance, Risk & Compliance Platform', margin, footerY + 8);
          doc.text('https://grc-pulse.pages.dev', margin + 80, footerY + 8);
          doc.text('Generated: ' + new Date().toLocaleString(), pageWidth - margin - 45, footerY + 8);
        }
        
        // ========== HEADER ==========
        doc.setFillColor(27, 54, 93);
        doc.rect(0, 0, pageWidth, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('GRC Pulse', margin, 18);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text('Compliance Report', margin, 28);
        doc.setFontSize(9);
        doc.text(complianceOrgName + ' | ' + (complianceMode === 'advanced' ? 'Advanced Mode' : 'Basic Mode'), margin, 35);
        
        // Date on right side
        doc.text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), pageWidth - margin - 45, 35);
        
        let yPos = 50;
        
        // ========== ISO 27001 SUMMARY ==========
        doc.setTextColor(27, 54, 93);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('ISO 27001:2022 Compliance Summary', margin, yPos);
        yPos += 8;
        
        const isoFramework = data.frameworks.find(f => f.id === 'fw-iso27001');
        const score = isoFramework?.score || 0;
        
        // Score card
        doc.setFillColor(score >= 80 ? 220 : score >= 60 ? 254 : 254, score >= 80 ? 252 : score >= 60 ? 249 : 226, score >= 80 ? 231 : score >= 60 ? 195 : 226);
        doc.roundedRect(margin, yPos, 45, 35, 4, 4, 'F');
        doc.setTextColor(score >= 80 ? 22 : score >= 60 ? 146 : 185, score >= 80 ? 163 : score >= 60 ? 64 : 28, score >= 80 ? 74 : score >= 60 ? 14 : 28);
        doc.setFontSize(26);
        doc.setFont('helvetica', 'bold');
        doc.text(score + '%', margin + 22.5, yPos + 20, { align: 'center' });
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text('Compliance Score', margin + 22.5, yPos + 30, { align: 'center' });
        
        // Stats grid (next to score)
        const statsX = margin + 55;
        const stats = [
          { label: 'Implemented', value: (isoFramework?.implemented || 0) + ' controls', color: [22, 163, 74] },
          { label: 'In Progress', value: (data.advancedMetrics?.inProgress || 0) + ' controls', color: [234, 179, 8] },
          { label: 'Not Started', value: ((isoFramework?.total || 0) - (isoFramework?.implemented || 0) - (data.advancedMetrics?.inProgress || 0)) + ' controls', color: [239, 68, 68] },
          { label: 'Total Controls', value: String(isoFramework?.total || 0), color: [59, 130, 246] },
          { label: 'Avg Maturity', value: (data.advancedMetrics?.avgMaturity || 0).toFixed(1) + '/5', color: [139, 92, 246] },
          { label: 'Critical Score', value: (data.advancedMetrics?.criticalScore || 0) + '%', color: [220, 38, 38] }
        ];
        
        stats.forEach((stat, i) => {
          const col = i % 3;
          const row = Math.floor(i / 3);
          const sX = statsX + (col * 45);
          const sY = yPos + (row * 18);
          
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...stat.color);
          doc.text(stat.value, sX, sY + 8);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 100, 100);
          doc.text(stat.label, sX, sY + 14);
        });
        
        yPos += 45;
        
        // ========== FRAMEWORK COMPLIANCE ==========
        yPos = checkPageBreak(60, yPos);
        doc.setTextColor(27, 54, 93);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Multi-Framework Compliance Status', margin, yPos);
        yPos += 6;
        
        // Table header
        doc.setFillColor(240, 242, 245);
        doc.rect(margin, yPos, contentWidth, 8, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(80, 80, 80);
        doc.text('Framework', margin + 3, yPos + 5);
        doc.text('Score', margin + 90, yPos + 5);
        doc.text('Controls', margin + 115, yPos + 5);
        doc.text('Progress', margin + 145, yPos + 5);
        yPos += 10;
        
        const applicableFrameworks = data.frameworks.filter(fw => fw.is_applicable);
        applicableFrameworks.forEach((fw, i) => {
          yPos = checkPageBreak(10, yPos);
          
          if (i % 2 === 0) {
            doc.setFillColor(250, 250, 252);
            doc.rect(margin, yPos - 2, contentWidth, 10, 'F');
          }
          
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(50, 50, 50);
          
          const fwName = fw.name.length > 35 ? fw.name.substring(0, 32) + '...' : fw.name;
          doc.text(fwName, margin + 3, yPos + 4);
          
          const fwScore = fw.score || 0;
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(fwScore >= 80 ? 22 : fwScore >= 60 ? 146 : 185, fwScore >= 80 ? 163 : fwScore >= 60 ? 64 : 28, fwScore >= 80 ? 74 : fwScore >= 60 ? 14 : 28);
          doc.text(fwScore + '%', margin + 90, yPos + 4);
          
          doc.setTextColor(100, 100, 100);
          doc.setFont('helvetica', 'normal');
          doc.text(fw.implemented + '/' + fw.total, margin + 115, yPos + 4);
          
          // Progress bar
          doc.setFillColor(220, 220, 220);
          doc.roundedRect(margin + 145, yPos + 1, 30, 4, 1, 1, 'F');
          const barColor = fwScore >= 80 ? [34, 197, 94] : fwScore >= 60 ? [234, 179, 8] : [239, 68, 68];
          doc.setFillColor(...barColor);
          doc.roundedRect(margin + 145, yPos + 1, Math.max(fwScore * 0.3, 1), 4, 1, 1, 'F');
          
          yPos += 10;
        });
        
        yPos += 8;
        
        // ========== DOMAIN ANALYSIS ==========
        yPos = checkPageBreak(50, yPos);
        doc.setTextColor(27, 54, 93);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Domain Analysis (ISO 27001)', margin, yPos);
        yPos += 6;
        
        // Table header
        doc.setFillColor(240, 242, 245);
        doc.rect(margin, yPos, contentWidth, 8, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(80, 80, 80);
        doc.text('Domain', margin + 3, yPos + 5);
        doc.text('Score', margin + 70, yPos + 5);
        doc.text('Controls', margin + 95, yPos + 5);
        if (complianceMode === 'advanced') {
          doc.text('Maturity', margin + 130, yPos + 5);
        }
        doc.text('Status', margin + 155, yPos + 5);
        yPos += 10;
        
        data.domainScores.forEach((domain, i) => {
          yPos = checkPageBreak(10, yPos);
          
          if (i % 2 === 0) {
            doc.setFillColor(250, 250, 252);
            doc.rect(margin, yPos - 2, contentWidth, 10, 'F');
          }
          
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(50, 50, 50);
          doc.text(domain.name, margin + 3, yPos + 4);
          
          const dScore = domain.score || 0;
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(dScore >= 80 ? 22 : dScore >= 60 ? 146 : 185, dScore >= 80 ? 163 : dScore >= 60 ? 64 : 28, dScore >= 80 ? 74 : dScore >= 60 ? 14 : 28);
          doc.text(dScore + '%', margin + 70, yPos + 4);
          
          doc.setTextColor(100, 100, 100);
          doc.setFont('helvetica', 'normal');
          doc.text(domain.implemented + '/' + domain.total, margin + 95, yPos + 4);
          
          if (complianceMode === 'advanced') {
            doc.text((domain.avgMaturity || 0).toFixed(1) + '/5', margin + 130, yPos + 4);
          }
          
          // Status badge
          const statusText = dScore >= 90 ? 'Excellent' : dScore >= 80 ? 'Good' : dScore >= 60 ? 'Fair' : 'Needs Work';
          const badgeColor = dScore >= 90 ? [220, 252, 231] : dScore >= 80 ? [220, 252, 231] : dScore >= 60 ? [254, 249, 195] : [254, 226, 226];
          const textColor = dScore >= 90 ? [22, 163, 74] : dScore >= 80 ? [22, 163, 74] : dScore >= 60 ? [146, 64, 14] : [185, 28, 28];
          doc.setFillColor(...badgeColor);
          doc.roundedRect(margin + 152, yPos - 1, 25, 6, 1, 1, 'F');
          doc.setFontSize(6);
          doc.setTextColor(...textColor);
          doc.text(statusText, margin + 164.5, yPos + 3, { align: 'center' });
          
          yPos += 10;
        });
        
        yPos += 8;
        
        // ========== TOP COMPLIANCE GAPS ==========
        if (data.topGaps && data.topGaps.length > 0) {
          yPos = checkPageBreak(60, yPos);
          doc.setTextColor(27, 54, 93);
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text('Top Compliance Gaps', margin, yPos);
          yPos += 8;
          
          data.topGaps.slice(0, 8).forEach((gap, i) => {
            yPos = checkPageBreak(14, yPos);
            
            // Background
            const bgColor = gap.is_critical ? [254, 226, 226] : [255, 237, 213];
            doc.setFillColor(...bgColor);
            doc.roundedRect(margin, yPos - 2, contentWidth, 12, 2, 2, 'F');
            
            // Number badge
            const badgeColor = gap.is_critical ? [220, 38, 38] : [234, 88, 12];
            doc.setFillColor(...badgeColor);
            doc.circle(margin + 6, yPos + 4, 4, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.text(String(i + 1), margin + 6, yPos + 5.5, { align: 'center' });
            
            // Control ID
            doc.setTextColor(...badgeColor);
            doc.setFontSize(9);
            doc.text(gap.control_id, margin + 14, yPos + 5);
            
            // Title (with proper truncation)
            doc.setTextColor(80, 80, 80);
            doc.setFont('helvetica', 'normal');
            const maxTitleWidth = 110;
            let title = gap.title;
            if (doc.getTextWidth(title) > maxTitleWidth) {
              while (doc.getTextWidth(title + '...') > maxTitleWidth && title.length > 0) {
                title = title.slice(0, -1);
              }
              title += '...';
            }
            doc.text(title, margin + 32, yPos + 5);
            
            // Severity badge
            const severityText = gap.is_critical ? 'CRITICAL' : 'IMPORTANT';
            doc.setFillColor(...badgeColor);
            doc.roundedRect(margin + contentWidth - 22, yPos, 20, 6, 1, 1, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(5);
            doc.text(severityText, margin + contentWidth - 12, yPos + 4, { align: 'center' });
            
            yPos += 14;
          });
        }
        
        // Add footer to last page
        addFooter();
        
        // Save the PDF
        doc.save('GRC-Pulse-Compliance-Report-' + new Date().toISOString().split('T')[0] + '.pdf');
        showAlert('PDF report downloaded successfully!', 'success');
        
      } catch (error) {
        console.error('PDF export error:', error);
        showAlert('Failed to generate PDF: ' + error.message, 'error');
      }
    }
    
    // Export Compliance Data as CSV
    async function exportComplianceCSV() {
      showAlert('Generating CSV export...', 'info');
      
      try {
        const t = Date.now();
        const data = await api('/compliance/dashboard?mode=' + complianceMode + '&_t=' + t);
        const controlsData = await api('/compliance/controls?_t=' + t);
        
        // Build CSV content
        let csv = '';
        
        // Header info
        csv += 'GRC Pulse Compliance Export\\n';
        csv += 'Generated,' + new Date().toISOString() + '\\n';
        csv += 'Mode,' + complianceMode + '\\n';
        csv += '\\n';
        
        // Summary section
        csv += 'COMPLIANCE SUMMARY\\n';
        csv += 'Framework,Score,Implemented,In Progress,Total,Is Applicable\\n';
        data.frameworks.forEach(fw => {
          csv += '"' + fw.name + '",' + fw.score + ',' + fw.implemented + ',' + (fw.inProgress || 0) + ',' + fw.total + ',' + fw.is_applicable + '\\n';
        });
        csv += '\\n';
        
        // Domain scores
        csv += 'DOMAIN ANALYSIS\\n';
        csv += 'Domain,Score,Implemented,In Progress,Total,Avg Maturity\\n';
        data.domainScores.forEach(d => {
          csv += '"' + d.name + '",' + d.score + ',' + d.implemented + ',' + (d.inProgress || 0) + ',' + d.total + ',' + (d.avgMaturity || 0).toFixed(2) + '\\n';
        });
        csv += '\\n';
        
        // Maturity distribution
        csv += 'MATURITY DISTRIBUTION\\n';
        csv += 'Level,Name,Count\\n';
        const maturityLevels = [
          { level: 5, name: 'Optimized' },
          { level: 4, name: 'Measured' },
          { level: 3, name: 'Defined' },
          { level: 2, name: 'Managed' },
          { level: 1, name: 'Initial' },
          { level: 0, name: 'Not Assessed' }
        ];
        maturityLevels.forEach(m => {
          csv += m.level + ',"' + m.name + '",' + (data.maturityDistribution[m.level] || 0) + '\\n';
        });
        csv += '\\n';
        
        // Top Gaps
        csv += 'TOP COMPLIANCE GAPS\\n';
        csv += 'Control ID,Title,Category,Is Critical\\n';
        data.topGaps.forEach(gap => {
          csv += '"' + gap.control_id + '","' + gap.title.replace(/"/g, '""') + '","' + gap.category + '",' + gap.is_critical + '\\n';
        });
        csv += '\\n';
        
        // Full control list
        csv += 'DETAILED CONTROL STATUS\\n';
        csv += 'Control ID,Title,Category,Implementation Status,Maturity Level,Is Critical\\n';
        if (controlsData.controls) {
          controlsData.controls.forEach(c => {
            csv += '"' + c.control_id + '","' + (c.title || c.name || '').replace(/"/g, '""') + '","' + (c.category || '') + '","' + (c.implementation_status || 'not_started') + '",' + (c.maturity_level || 0) + ',' + (c.is_critical || false) + '\\n';
          });
        }
        
        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'GRC-Pulse-Compliance-Export-' + new Date().toISOString().split('T')[0] + '.csv';
        link.click();
        
        showAlert('CSV export downloaded successfully!', 'success');
        
      } catch (error) {
        console.error('CSV export error:', error);
        showAlert('Failed to export CSV: ' + error.message, 'error');
      }
    }

    // Controls
    async function loadControls() {
      const data = await api('/controls');
      document.getElementById('page-actions').innerHTML = '';
      
      if (data.controls.length === 0) {
        document.getElementById('controls-page').innerHTML = '<div class="card"><div class="empty-state"><p>No controls found.</p></div></div>';
        return;
      }
      
      document.getElementById('controls-page').innerHTML = \`
        <div class="card">
          <table>
            <thead><tr><th>Control</th><th>Category</th><th>Type</th><th>Status</th><th>Effectiveness</th></tr></thead>
            <tbody>
              \${data.controls.map(c => \`
                <tr>
                  <td>
                    <div style="font-weight: 500;">\${c.control_id}: \${c.name}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">\${c.owner_name || 'Unassigned'}</div>
                  </td>
                  <td>\${c.category || 'N/A'}</td>
                  <td>\${c.control_type || 'N/A'}</td>
                  <td><span class="badge \${c.implementation_status === 'implemented' ? 'low' : c.implementation_status === 'in_progress' ? 'medium' : 'high'}">\${c.implementation_status}</span></td>
                  <td>\${c.effectiveness_rating || 'Not tested'}</td>
                </tr>
              \`).join('')}
            </tbody>
          </table>
        </div>
      \`;
    }

    // Risk Graph Visualization
    let graphSimulation = null;
    
    async function loadGraph() {
      document.getElementById('page-actions').innerHTML = \`
        <div style="display: flex; gap: 10px;">
          <select class="form-select" id="graph-filter" style="width: 150px;" onchange="filterGraph()">
            <option value="all">All Nodes</option>
            <option value="processes">Business Processes</option>
            <option value="assets">Assets Only</option>
            <option value="vendors">Vendors Only</option>
            <option value="risks">With Risks Only</option>
          </select>
          <button class="btn btn-secondary" onclick="resetGraphZoom()"><i class="fas fa-expand"></i> Reset View</button>
        </div>
      \`;
      
      document.getElementById('graph-page').innerHTML = \`
        <div class="card" style="padding: 0; overflow: hidden;">
          <div id="graph-container" style="width: 100%; height: 600px; position: relative;">
            <svg id="graph-svg" style="width: 100%; height: 100%;"></svg>
          </div>
          <div id="graph-tooltip" style="position: absolute; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; display: none; pointer-events: none; z-index: 100; max-width: 300px;"></div>
        </div>
        <div class="grid-2" style="margin-top: 20px;">
          <div class="card">
            <div class="card-header"><h3 class="card-title">Legend</h3></div>
            <div style="display: flex; flex-wrap: wrap; gap: 16px;">
              <div style="display: flex; align-items: center; gap: 8px;"><div style="width: 16px; height: 16px; background: #8b5cf6; border-radius: 50%;"></div><span style="font-size: 12px;">Business Process</span></div>
              <div style="display: flex; align-items: center; gap: 8px;"><div style="width: 16px; height: 16px; background: #3b82f6; border-radius: 4px;"></div><span style="font-size: 12px;">Asset</span></div>
              <div style="display: flex; align-items: center; gap: 8px;"><div style="width: 16px; height: 16px; background: #22c55e; border-radius: 2px; transform: rotate(45deg);"></div><span style="font-size: 12px;">Vendor</span></div>
              <div style="display: flex; align-items: center; gap: 8px;"><div style="width: 16px; height: 16px; background: #ef4444; border-radius: 50%; border: 2px solid #991b1b;"></div><span style="font-size: 12px;">Risk</span></div>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><h3 class="card-title">Graph Stats</h3></div>
            <div id="graph-stats" style="display: flex; gap: 20px;"></div>
          </div>
        </div>
      \`;
      
      try {
        const data = await api('/graph');
        renderGraph(data);
      } catch (error) {
        document.getElementById('graph-container').innerHTML = '<div class="alert error" style="margin: 20px;">Failed to load graph data: ' + error.message + '</div>';
      }
    }
    
    function renderGraph(data) {
      const container = document.getElementById('graph-container');
      const svg = document.getElementById('graph-svg');
      const width = container.clientWidth;
      const height = container.clientHeight;
      
      // Clear previous
      svg.innerHTML = '';
      if (graphSimulation) graphSimulation.stop();
      
      // Build nodes and links
      const nodes = [];
      const links = [];
      const nodeMap = new Map();
      
      // Add business processes
      data.processes.forEach(p => {
        const node = { 
          id: p.id, 
          name: p.name, 
          type: 'process', 
          criticality: p.criticality,
          isRevenueGenerating: p.is_revenue_generating,
          revenueImpact: p.revenue_impact_per_hour
        };
        nodes.push(node);
        nodeMap.set(p.id, node);
      });
      
      // Add assets
      data.assets.forEach(a => {
        const node = { 
          id: a.id, 
          name: a.name, 
          type: 'asset', 
          assetType: a.asset_type,
          criticality: a.criticality,
          riskCount: a.risk_count
        };
        nodes.push(node);
        nodeMap.set(a.id, node);
      });
      
      // Add vendors
      data.vendors.forEach(v => {
        const node = { 
          id: v.id, 
          name: v.name, 
          type: 'vendor', 
          tier: v.vendor_tier,
          riskScore: v.current_risk_score
        };
        nodes.push(node);
        nodeMap.set(v.id, node);
      });
      
      // Add risks
      data.risks.forEach(r => {
        const node = { 
          id: r.id, 
          name: r.title, 
          type: 'risk', 
          priority: r.context_priority_score,
          status: r.status,
          affectedAsset: r.affected_asset_id,
          affectedVendor: r.affected_vendor_id
        };
        nodes.push(node);
        nodeMap.set(r.id, node);
      });
      
      // Add asset-process links
      data.assetProcessMappings.forEach(m => {
        if (nodeMap.has(m.asset_id) && nodeMap.has(m.business_process_id)) {
          links.push({ 
            source: m.asset_id, 
            target: m.business_process_id, 
            type: 'asset-process',
            dependency: m.dependency_type
          });
        }
      });
      
      // Add vendor-process links
      data.vendorProcessMappings.forEach(m => {
        if (nodeMap.has(m.vendor_id) && nodeMap.has(m.business_process_id)) {
          links.push({ 
            source: m.vendor_id, 
            target: m.business_process_id, 
            type: 'vendor-process',
            dependency: m.dependency_level
          });
        }
      });
      
      // Add asset relationship links
      data.assetRelationships.forEach(r => {
        if (nodeMap.has(r.source_asset_id) && nodeMap.has(r.target_asset_id)) {
          links.push({ 
            source: r.source_asset_id, 
            target: r.target_asset_id, 
            type: 'asset-asset',
            relationship: r.relationship_type
          });
        }
      });
      
      // Add risk links
      data.risks.forEach(r => {
        if (r.affected_asset_id && nodeMap.has(r.affected_asset_id)) {
          links.push({ source: r.id, target: r.affected_asset_id, type: 'risk-asset' });
        }
        if (r.affected_vendor_id && nodeMap.has(r.affected_vendor_id)) {
          links.push({ source: r.id, target: r.affected_vendor_id, type: 'risk-vendor' });
        }
      });
      
      // Update stats
      document.getElementById('graph-stats').innerHTML = \`
        <div style="text-align: center;"><div style="font-size: 20px; font-weight: 700; color: var(--accent-purple);">\${data.processes.length}</div><div style="font-size: 11px; color: var(--text-muted);">Processes</div></div>
        <div style="text-align: center;"><div style="font-size: 20px; font-weight: 700; color: var(--accent-blue);">\${data.assets.length}</div><div style="font-size: 11px; color: var(--text-muted);">Assets</div></div>
        <div style="text-align: center;"><div style="font-size: 20px; font-weight: 700; color: var(--accent-green);">\${data.vendors.length}</div><div style="font-size: 11px; color: var(--text-muted);">Vendors</div></div>
        <div style="text-align: center;"><div style="font-size: 20px; font-weight: 700; color: var(--accent-red);">\${data.risks.length}</div><div style="font-size: 11px; color: var(--text-muted);">Open Risks</div></div>
        <div style="text-align: center;"><div style="font-size: 20px; font-weight: 700; color: var(--text-secondary);">\${links.length}</div><div style="font-size: 11px; color: var(--text-muted);">Connections</div></div>
      \`;
      
      // Create SVG elements
      const svgNS = 'http://www.w3.org/2000/svg';
      
      // Defs for markers
      const defs = document.createElementNS(svgNS, 'defs');
      const marker = document.createElementNS(svgNS, 'marker');
      marker.setAttribute('id', 'arrowhead');
      marker.setAttribute('viewBox', '-0 -5 10 10');
      marker.setAttribute('refX', 20);
      marker.setAttribute('refY', 0);
      marker.setAttribute('orient', 'auto');
      marker.setAttribute('markerWidth', 6);
      marker.setAttribute('markerHeight', 6);
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', 'M 0,-5 L 10,0 L 0,5');
      path.setAttribute('fill', '#64748b');
      marker.appendChild(path);
      defs.appendChild(marker);
      svg.appendChild(defs);
      
      // Create main group for zoom/pan
      const g = document.createElementNS(svgNS, 'g');
      g.setAttribute('id', 'graph-main');
      svg.appendChild(g);
      
      // Create links
      const linkGroup = document.createElementNS(svgNS, 'g');
      linkGroup.setAttribute('class', 'links');
      g.appendChild(linkGroup);
      
      const linkElements = links.map(link => {
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('stroke', link.type === 'risk-asset' || link.type === 'risk-vendor' ? '#ef4444' : '#64748b');
        line.setAttribute('stroke-width', link.dependency === 'critical' ? '3' : '1.5');
        line.setAttribute('stroke-opacity', '0.6');
        line.setAttribute('stroke-dasharray', link.type.includes('risk') ? '4,2' : 'none');
        line.setAttribute('marker-end', 'url(#arrowhead)');
        line._data = link;
        linkGroup.appendChild(line);
        return line;
      });
      
      // Create nodes
      const nodeGroup = document.createElementNS(svgNS, 'g');
      nodeGroup.setAttribute('class', 'nodes');
      g.appendChild(nodeGroup);
      
      const nodeElements = nodes.map(node => {
        const group = document.createElementNS(svgNS, 'g');
        group.style.cursor = 'pointer';
        group._data = node;
        
        let shape;
        const size = node.type === 'process' ? 20 : node.type === 'risk' ? 12 : 14;
        
        if (node.type === 'process') {
          shape = document.createElementNS(svgNS, 'circle');
          shape.setAttribute('r', size);
          shape.setAttribute('fill', '#8b5cf6');
        } else if (node.type === 'asset') {
          shape = document.createElementNS(svgNS, 'rect');
          shape.setAttribute('width', size * 2);
          shape.setAttribute('height', size * 2);
          shape.setAttribute('x', -size);
          shape.setAttribute('y', -size);
          shape.setAttribute('rx', '4');
          shape.setAttribute('fill', node.riskCount > 0 ? '#f97316' : '#3b82f6');
        } else if (node.type === 'vendor') {
          shape = document.createElementNS(svgNS, 'rect');
          shape.setAttribute('width', size * 1.8);
          shape.setAttribute('height', size * 1.8);
          shape.setAttribute('x', -size * 0.9);
          shape.setAttribute('y', -size * 0.9);
          shape.setAttribute('transform', 'rotate(45)');
          shape.setAttribute('fill', node.riskScore > 30 ? '#eab308' : '#22c55e');
        } else if (node.type === 'risk') {
          shape = document.createElementNS(svgNS, 'circle');
          shape.setAttribute('r', size);
          shape.setAttribute('fill', '#ef4444');
          shape.setAttribute('stroke', '#991b1b');
          shape.setAttribute('stroke-width', '2');
        }
        
        // Add glow for critical items
        if ((node.criticality === 'critical' || node.tier === 'critical' || node.priority >= 80)) {
          shape.setAttribute('filter', 'drop-shadow(0 0 4px currentColor)');
        }
        
        group.appendChild(shape);
        
        // Label
        const text = document.createElementNS(svgNS, 'text');
        text.setAttribute('dy', size + 14);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', '#94a3b8');
        text.setAttribute('font-size', '10px');
        text.textContent = node.name.length > 15 ? node.name.substring(0, 15) + '...' : node.name;
        group.appendChild(text);
        
        // Events
        group.addEventListener('mouseenter', (e) => showGraphTooltip(e, node));
        group.addEventListener('mouseleave', hideGraphTooltip);
        group.addEventListener('click', () => handleNodeClick(node));
        
        nodeGroup.appendChild(group);
        return group;
      });
      
      // Force simulation
      graphSimulation = createSimulation(nodes, links, width, height, nodeElements, linkElements);
      
      // Zoom and pan
      let transform = { x: 0, y: 0, k: 1 };
      
      svg.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        transform.k = Math.max(0.2, Math.min(3, transform.k * delta));
        const rect = svg.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        transform.x = x - (x - transform.x) * delta;
        transform.y = y - (y - transform.y) * delta;
        g.setAttribute('transform', \`translate(\${transform.x},\${transform.y}) scale(\${transform.k})\`);
      });
      
      let isDragging = false;
      let dragStart = { x: 0, y: 0 };
      
      svg.addEventListener('mousedown', (e) => {
        if (e.target === svg) {
          isDragging = true;
          dragStart = { x: e.clientX - transform.x, y: e.clientY - transform.y };
        }
      });
      
      svg.addEventListener('mousemove', (e) => {
        if (isDragging) {
          transform.x = e.clientX - dragStart.x;
          transform.y = e.clientY - dragStart.y;
          g.setAttribute('transform', \`translate(\${transform.x},\${transform.y}) scale(\${transform.k})\`);
        }
      });
      
      svg.addEventListener('mouseup', () => isDragging = false);
      svg.addEventListener('mouseleave', () => isDragging = false);
      
      // Store for filtering
      window.graphData = { nodes, links, nodeElements, linkElements };
      window.graphTransform = transform;
      window.graphG = g;
    }
    
    function createSimulation(nodes, links, width, height, nodeElements, linkElements) {
      // Simple force-directed layout
      const centerX = width / 2;
      const centerY = height / 2;
      
      // Initialize positions
      nodes.forEach((node, i) => {
        const angle = (i / nodes.length) * 2 * Math.PI;
        const radius = 150 + Math.random() * 100;
        node.x = centerX + radius * Math.cos(angle);
        node.y = centerY + radius * Math.sin(angle);
        node.vx = 0;
        node.vy = 0;
      });
      
      const nodeById = new Map(nodes.map(n => [n.id, n]));
      
      function tick() {
        // Apply forces
        const alpha = 0.3;
        
        // Center force
        nodes.forEach(node => {
          node.vx += (centerX - node.x) * 0.01;
          node.vy += (centerY - node.y) * 0.01;
        });
        
        // Link force
        links.forEach(link => {
          const source = typeof link.source === 'object' ? link.source : nodeById.get(link.source);
          const target = typeof link.target === 'object' ? link.target : nodeById.get(link.target);
          if (!source || !target) return;
          
          link.source = source;
          link.target = target;
          
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const targetDist = 100;
          const force = (dist - targetDist) * 0.01;
          
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          
          source.vx += fx;
          source.vy += fy;
          target.vx -= fx;
          target.vy -= fy;
        });
        
        // Collision
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i];
            const b = nodes[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const minDist = 50;
            
            if (dist < minDist) {
              const force = (minDist - dist) * 0.05;
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;
              a.vx -= fx;
              a.vy -= fy;
              b.vx += fx;
              b.vy += fy;
            }
          }
        }
        
        // Update positions
        nodes.forEach(node => {
          node.vx *= 0.8;
          node.vy *= 0.8;
          node.x += node.vx;
          node.y += node.vy;
          
          // Bounds
          node.x = Math.max(50, Math.min(width - 50, node.x));
          node.y = Math.max(50, Math.min(height - 50, node.y));
        });
        
        // Update DOM
        nodeElements.forEach((el, i) => {
          el.setAttribute('transform', \`translate(\${nodes[i].x},\${nodes[i].y})\`);
        });
        
        linkElements.forEach((el) => {
          const link = el._data;
          if (link.source && link.target) {
            el.setAttribute('x1', link.source.x);
            el.setAttribute('y1', link.source.y);
            el.setAttribute('x2', link.target.x);
            el.setAttribute('y2', link.target.y);
          }
        });
      }
      
      // Run simulation
      let iterations = 0;
      const maxIterations = 300;
      
      function animate() {
        if (iterations < maxIterations) {
          tick();
          iterations++;
          requestAnimationFrame(animate);
        }
      }
      
      animate();
      
      return { stop: () => { iterations = maxIterations; } };
    }
    
    function showGraphTooltip(event, node) {
      const tooltip = document.getElementById('graph-tooltip');
      let content = \`<div style="font-weight: 600; margin-bottom: 8px;">\${node.name}</div>\`;
      
      if (node.type === 'process') {
        content += \`<div style="font-size: 12px; color: var(--text-muted);">Business Process</div>\`;
        content += \`<div style="margin-top: 8px;"><span class="badge \${node.criticality}">\${node.criticality}</span></div>\`;
        if (node.isRevenueGenerating) content += \`<div style="margin-top: 4px; font-size: 11px; color: var(--accent-green);">Revenue Generating</div>\`;
        if (node.revenueImpact) content += \`<div style="font-size: 11px;">$\${(node.revenueImpact/1000).toFixed(0)}K/hr impact</div>\`;
      } else if (node.type === 'asset') {
        content += \`<div style="font-size: 12px; color: var(--text-muted);">\${node.assetType}</div>\`;
        content += \`<div style="margin-top: 8px;"><span class="badge \${node.criticality}">\${node.criticality}</span></div>\`;
        if (node.riskCount > 0) content += \`<div style="margin-top: 4px; font-size: 11px; color: var(--accent-red);">\${node.riskCount} open risk(s)</div>\`;
      } else if (node.type === 'vendor') {
        content += \`<div style="font-size: 12px; color: var(--text-muted);">Third-Party Vendor</div>\`;
        content += \`<div style="margin-top: 8px;"><span class="badge \${node.tier}">\${node.tier} tier</span></div>\`;
        content += \`<div style="margin-top: 4px; font-size: 11px;">Risk Score: <span style="color: \${node.riskScore > 30 ? 'var(--accent-red)' : 'var(--accent-green)'};">\${node.riskScore}</span></div>\`;
      } else if (node.type === 'risk') {
        content += \`<div style="font-size: 12px; color: var(--text-muted);">Security Risk</div>\`;
        content += \`<div style="margin-top: 8px;"><span class="badge \${node.status}">\${node.status}</span></div>\`;
        content += \`<div style="margin-top: 4px; font-size: 11px;">Priority: <span style="font-weight: 600; color: \${node.priority >= 80 ? 'var(--accent-red)' : node.priority >= 60 ? '#f97316' : 'var(--accent-yellow)'};">\${node.priority}</span></div>\`;
      }
      
      tooltip.innerHTML = content;
      tooltip.style.display = 'block';
      tooltip.style.left = (event.pageX + 15) + 'px';
      tooltip.style.top = (event.pageY - 10) + 'px';
    }
    
    function hideGraphTooltip() {
      document.getElementById('graph-tooltip').style.display = 'none';
    }
    
    function handleNodeClick(node) {
      if (node.type === 'risk') {
        navigate('risks');
      } else if (node.type === 'asset') {
        navigate('assets');
      } else if (node.type === 'vendor') {
        navigate('vendors');
      }
    }
    
    function resetGraphZoom() {
      if (window.graphG) {
        window.graphTransform = { x: 0, y: 0, k: 1 };
        window.graphG.setAttribute('transform', 'translate(0,0) scale(1)');
      }
    }
    
    function filterGraph() {
      const filter = document.getElementById('graph-filter').value;
      if (!window.graphData) return;
      
      const { nodeElements } = window.graphData;
      
      nodeElements.forEach(el => {
        const node = el._data;
        let visible = true;
        
        if (filter === 'processes') visible = node.type === 'process';
        else if (filter === 'assets') visible = node.type === 'asset';
        else if (filter === 'vendors') visible = node.type === 'vendor';
        else if (filter === 'risks') visible = node.type === 'risk' || node.riskCount > 0;
        
        el.style.opacity = visible ? '1' : '0.15';
      });
    }

    function closeModal(event) {
      // If called with an event (clicking overlay), only close if clicking directly on overlay
      if (event && event.target !== event.currentTarget) return;
      // Clear modal container
      const container = document.getElementById('modal-container');
      if (container) container.innerHTML = '';
    }

    // ============================================================================
    // MATURITY ASSESSMENT
    // ============================================================================
    
    let maturityData = null;
    let maturityAnswers = {};
    let maturityChart = null;
    let currentAssessmentId = null; // Track if editing existing assessment
    
    async function loadMaturity() {
      document.getElementById('page-actions').innerHTML = \`
        <button class="btn btn-primary" onclick="startNewAssessment()">
          <i class="fas fa-plus"></i> New Assessment
        </button>
      \`;
      
      // Load Chart.js if not already loaded
      if (!window.Chart) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        document.head.appendChild(script);
        await new Promise(resolve => script.onload = resolve);
      }
      
      try {
        maturityData = await api('/maturity/questions');
        renderMaturityAssessment();
      } catch (error) {
        document.getElementById('maturity-page').innerHTML = '<div class="alert error">Failed to load assessment: ' + error.message + '</div>';
      }
    }
    
    function startNewAssessment() {
      currentAssessmentId = null;
      maturityAnswers = {};
      renderMaturityAssessment();
    }
    
    function renderMaturityAssessment() {
      const { categories, levels } = maturityData;
      const isEditing = currentAssessmentId !== null;
      
      document.getElementById('maturity-page').innerHTML = \`
        <div class="grid-2" style="grid-template-columns: 1fr 400px; gap: 24px;">
          <div>
            <div class="card" style="margin-bottom: 16px;">
              <div class="card-header">
                <h3 class="card-title">
                  <i class="fas fa-\${isEditing ? 'edit' : 'info-circle'}" style="color: var(--accent-blue); margin-right: 8px;"></i>
                  \${isEditing ? 'Edit Assessment' : 'About This Assessment'}
                </h3>
                \${isEditing ? \`<span class="badge" style="background: var(--accent-yellow); color: #000;">Editing</span>\` : ''}
              </div>
              <p style="color: var(--text-secondary); font-size: 13px; line-height: 1.6;">
                This assessment is based on the <strong>Capability Maturity Model (CMM)</strong> and aligned with <strong>ISO/IEC 27001</strong> controls. 
                Rate each question on a scale of 0-5 to evaluate your organization's security maturity level.
              </p>
              \${isEditing ? \`
                <div style="margin-top: 12px; padding: 10px; background: var(--bg-tertiary); border-radius: 6px; border-left: 3px solid var(--accent-yellow);">
                  <div style="font-size: 12px; color: var(--text-secondary);">Assessment ID: <code style="color: var(--accent-blue);">\${currentAssessmentId}</code></div>
                </div>
              \` : ''}
              <div style="display: flex; gap: 10px; margin-top: 16px; flex-wrap: wrap;">
                \${levels.map(l => \`
                  <div style="display: flex; align-items: center; gap: 6px; padding: 4px 10px; background: var(--bg-tertiary); border-radius: 4px; font-size: 11px;">
                    <span style="font-weight: 600; color: var(--accent-blue);">\${l.value}</span>
                    <span style="color: var(--text-secondary);">\${l.en}</span>
                  </div>
                \`).join('')}
              </div>
            </div>
            
            <div id="assessment-form">
              \${categories.map((cat, catIdx) => \`
                <div class="card" style="margin-bottom: 16px;">
                  <div class="card-header" style="cursor: pointer;" onclick="toggleCategory(\${catIdx})">
                    <div>
                      <h3 class="card-title" style="display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-folder" style="color: var(--accent-purple);"></i>
                        \${cat.nameEn}
                      </h3>
                      <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px; direction: rtl;">\${cat.nameAr}</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                      <div id="cat-score-\${cat.id}" style="font-size: 14px; font-weight: 600; color: var(--accent-blue);">--</div>
                      <i class="fas fa-chevron-down" id="cat-icon-\${catIdx}"></i>
                    </div>
                  </div>
                  <div id="cat-content-\${catIdx}" style="display: block;">
                    \${cat.questions.map((q, qIdx) => \`
                      <div style="padding: 16px; border-top: 1px solid var(--border-color);">
                        <div style="display: flex; justify-content: space-between; gap: 16px;">
                          <div style="flex: 1;">
                            <div style="font-size: 13px; font-weight: 500; margin-bottom: 6px;">
                              <span style="color: var(--accent-blue); margin-right: 8px;">Q\${q.id}</span>
                              \${q.en}
                            </div>
                            <div style="font-size: 12px; color: var(--text-muted); direction: rtl; text-align: right;">\${q.ar}</div>
                          </div>
                          <div style="min-width: 200px;">
                            <select class="form-select maturity-select" data-question="\${q.id}" data-category="\${cat.id}" onchange="updateMaturityScore(this)" style="font-size: 12px;">
                              <option value="">Select Level...</option>
                              \${levels.map(l => \`<option value="\${l.value}" \${maturityAnswers[q.id] === l.value ? 'selected' : ''}>\${l.value} - \${l.en}</option>\`).join('')}
                            </select>
                          </div>
                        </div>
                      </div>
                    \`).join('')}
                  </div>
                </div>
              \`).join('')}
              
              <div style="display: flex; gap: 12px; margin-top: 20px;">
                <button class="btn btn-primary" onclick="submitMaturityAssessment()" style="flex: 1;">
                  <i class="fas fa-\${isEditing ? 'save' : 'chart-pie'}"></i> \${isEditing ? 'Update Assessment' : 'Save & Generate Chart'}
                </button>
                <button class="btn btn-secondary" onclick="resetMaturityAssessment()">
                  <i class="fas fa-redo"></i> Reset
                </button>
                \${isEditing ? \`
                  <button class="btn" style="background: var(--accent-red);" onclick="deleteMaturityAssessment()">
                    <i class="fas fa-trash"></i> Delete
                  </button>
                \` : ''}
              </div>
            </div>
          </div>
          
          <div>
            <div class="card" style="position: sticky; top: 20px;">
              <div class="card-header">
                <h3 class="card-title"><i class="fas fa-chart-pie" style="color: var(--accent-green); margin-right: 8px;"></i>Maturity Radar</h3>
              </div>
              <div id="radar-container" style="height: 350px; display: flex; align-items: center; justify-content: center;">
                <div style="text-align: center; color: var(--text-muted);">
                  <i class="fas fa-chart-radar" style="font-size: 48px; margin-bottom: 12px; opacity: 0.5;"></i>
                  <p>Complete the assessment to<br>generate your maturity radar chart</p>
                </div>
              </div>
              <div id="maturity-summary" style="display: none; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                  <span style="font-size: 13px; color: var(--text-secondary);">Overall Maturity</span>
                  <span id="overall-score" style="font-size: 24px; font-weight: 700; color: var(--accent-blue);">--</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size: 13px; color: var(--text-secondary);">Percentage</span>
                  <span id="overall-percentage" style="font-size: 18px; font-weight: 600; color: var(--accent-green);">--%</span>
                </div>
              </div>
            </div>
            
            <div class="card" style="margin-top: 16px;">
              <div class="card-header">
                <h3 class="card-title"><i class="fas fa-history" style="color: var(--accent-yellow); margin-right: 8px;"></i>Saved Assessments</h3>
              </div>
              <div id="maturity-history">
                <div style="text-align: center; color: var(--text-muted); padding: 20px;">
                  <i class="fas fa-clock" style="font-size: 24px; margin-bottom: 8px; opacity: 0.5;"></i>
                  <p style="font-size: 12px;">No saved assessments</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      \`;
      
      // Update category scores if we have answers
      if (Object.keys(maturityAnswers).length > 0) {
        maturityData.categories.forEach(cat => {
          const catAnswers = cat.questions.map(q => maturityAnswers[q.id]).filter(v => v !== undefined);
          if (catAnswers.length > 0) {
            const avg = catAnswers.reduce((a, b) => a + b, 0) / catAnswers.length;
            const scoreEl = document.getElementById('cat-score-' + cat.id);
            if (scoreEl) scoreEl.textContent = avg.toFixed(2);
          }
        });
      }
      
      loadMaturityHistory();
    }
    
    function toggleCategory(idx) {
      const content = document.getElementById('cat-content-' + idx);
      const icon = document.getElementById('cat-icon-' + idx);
      if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.classList.remove('fa-chevron-right');
        icon.classList.add('fa-chevron-down');
      } else {
        content.style.display = 'none';
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-right');
      }
    }
    
    function updateMaturityScore(select) {
      const qId = select.dataset.question;
      const catId = select.dataset.category;
      const value = select.value ? parseInt(select.value) : null;
      
      if (value !== null) {
        maturityAnswers[qId] = value;
      } else {
        delete maturityAnswers[qId];
      }
      
      // Update category score
      const category = maturityData.categories.find(c => c.id === catId);
      if (category) {
        const catAnswers = category.questions.map(q => maturityAnswers[q.id]).filter(v => v !== undefined);
        if (catAnswers.length > 0) {
          const avg = catAnswers.reduce((a, b) => a + b, 0) / catAnswers.length;
          document.getElementById('cat-score-' + catId).textContent = avg.toFixed(2);
        }
      }
    }
    
    async function submitMaturityAssessment() {
      // Check if at least some questions are answered
      if (Object.keys(maturityAnswers).length === 0) {
        showAlert('Please answer at least some questions before generating the chart', 'warning');
        return;
      }
      
      try {
        const isEditing = currentAssessmentId !== null;
        const endpoint = isEditing ? '/maturity/assessment/' + currentAssessmentId : '/maturity/assessment';
        const method = isEditing ? 'PATCH' : 'POST';
        
        const result = await api(endpoint, {
          method: method,
          body: JSON.stringify({
            answers: maturityAnswers,
            assessmentName: 'Security Maturity Assessment - ' + new Date().toLocaleDateString()
          })
        });
        
        currentAssessmentId = result.id; // Set ID for future edits
        renderMaturityRadar(result);
        loadMaturityHistory();
        showAlert(isEditing ? 'Assessment updated successfully!' : 'Assessment saved successfully!');
      } catch (error) {
        showAlert('Failed to save assessment: ' + error.message, 'error');
      }
    }
    
    async function loadAssessment(assessmentId) {
      try {
        const result = await api('/maturity/assessment/' + assessmentId);
        currentAssessmentId = result.id;
        maturityAnswers = result.answers || {};
        
        // Re-render with loaded data
        renderMaturityAssessment();
        
        // If we have scores, show the radar
        if (result.overallScore) {
          renderMaturityRadar(result);
        }
        
        showAlert('Assessment loaded for editing');
      } catch (error) {
        showAlert('Failed to load assessment: ' + error.message, 'error');
      }
    }
    
    async function deleteMaturityAssessment() {
      if (!currentAssessmentId) return;
      
      if (!confirm('Are you sure you want to delete this assessment? This cannot be undone.')) {
        return;
      }
      
      try {
        await api('/maturity/assessment/' + currentAssessmentId, { method: 'DELETE' });
        currentAssessmentId = null;
        maturityAnswers = {};
        renderMaturityAssessment();
        showAlert('Assessment deleted successfully');
      } catch (error) {
        showAlert('Failed to delete assessment: ' + error.message, 'error');
      }
    }
    
    function renderMaturityRadar(result) {
      const container = document.getElementById('radar-container');
      container.innerHTML = '<canvas id="maturity-radar-chart"></canvas>';
      
      const ctx = document.getElementById('maturity-radar-chart').getContext('2d');
      
      const labels = result.categories.map(c => c.nameEn);
      const scores = result.categories.map(c => c.score);
      const targetScores = Array(result.categories.length).fill(5);
      
      if (maturityChart) {
        maturityChart.destroy();
      }
      
      maturityChart = new Chart(ctx, {
        type: 'radar',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Target (5.0)',
              data: targetScores,
              borderColor: 'rgba(59, 130, 246, 0.4)',
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
              borderWidth: 2,
              pointRadius: 0
            },
            {
              label: 'Current Maturity',
              data: scores,
              borderColor: '#a855f7',
              backgroundColor: 'rgba(168, 85, 247, 0.25)',
              borderWidth: 3,
              pointBackgroundColor: '#a855f7',
              pointRadius: 5,
              pointHoverRadius: 8,
              fill: true
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            r: {
              angleLines: { color: 'rgba(148, 163, 184, 0.2)' },
              grid: { color: 'rgba(148, 163, 184, 0.15)' },
              pointLabels: {
                font: { size: 10, weight: '500' },
                color: '#94a3b8'
              },
              min: 0,
              max: 5,
              ticks: {
                stepSize: 1,
                color: '#64748b',
                font: { size: 9 },
                backdropColor: 'transparent'
              }
            }
          },
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                padding: 15,
                usePointStyle: true,
                font: { size: 11 },
                color: '#94a3b8'
              }
            }
          }
        }
      });
      
      // Show summary
      document.getElementById('maturity-summary').style.display = 'block';
      document.getElementById('overall-score').textContent = result.overallScore.toFixed(2) + ' / 5';
      document.getElementById('overall-percentage').textContent = result.overallPercentage.toFixed(1) + '%';
    }
    
    function resetMaturityAssessment() {
      currentAssessmentId = null; // Clear current assessment ID
      maturityAnswers = {};
      document.querySelectorAll('.maturity-select').forEach(select => {
        select.value = '';
      });
      maturityData.categories.forEach(cat => {
        const scoreEl = document.getElementById('cat-score-' + cat.id);
        if (scoreEl) scoreEl.textContent = '--';
      });
      const radarContainer = document.getElementById('radar-container');
      if (radarContainer) {
        radarContainer.innerHTML = \`
          <div style="text-align: center; color: var(--text-muted);">
            <i class="fas fa-chart-radar" style="font-size: 48px; margin-bottom: 12px; opacity: 0.5;"></i>
            <p>Complete the assessment to<br>generate your maturity radar chart</p>
          </div>
        \`;
      }
      const summaryEl = document.getElementById('maturity-summary');
      if (summaryEl) summaryEl.style.display = 'none';
      if (maturityChart) {
        maturityChart.destroy();
        maturityChart = null;
      }
      // Re-render to update UI (remove editing state)
      renderMaturityAssessment();
    }
    
    async function loadMaturityHistory() {
      try {
        const result = await api('/maturity/history');
        const container = document.getElementById('maturity-history');
        
        if (result.assessments && result.assessments.length > 0) {
          container.innerHTML = result.assessments.map(a => \`
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 10px; border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background 0.2s; border-radius: 6px; margin-bottom: 4px; \${currentAssessmentId === a.id ? 'background: var(--bg-tertiary); border-left: 3px solid var(--accent-blue);' : ''}" 
                 onclick="loadAssessment('\${a.id}')"
                 onmouseenter="this.style.background='var(--bg-tertiary)'" 
                 onmouseleave="this.style.background='\${currentAssessmentId === a.id ? 'var(--bg-tertiary)' : 'transparent'}'">
              <div style="flex: 1;">
                <div style="font-size: 12px; font-weight: 500; display: flex; align-items: center; gap: 8px;">
                  <i class="fas fa-file-alt" style="color: var(--accent-purple); font-size: 10px;"></i>
                  \${a.name || 'Assessment'}
                </div>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                  <i class="fas fa-calendar" style="margin-right: 4px;"></i>\${new Date(a.createdAt).toLocaleDateString()}
                  \${a.assessorName ? \` • \${a.assessorName}\` : ''}
                </div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 16px; font-weight: 600; color: var(--accent-blue);">\${a.overallScore?.toFixed(2) || '--'}</div>
                <div style="font-size: 11px; color: var(--accent-green);">\${a.overallPercentage?.toFixed(1) || '--'}%</div>
              </div>
              <div style="margin-left: 12px;">
                <i class="fas fa-chevron-right" style="color: var(--text-muted); font-size: 10px;"></i>
              </div>
            </div>
          \`).join('');
        } else {
          container.innerHTML = \`
            <div style="text-align: center; color: var(--text-muted); padding: 20px;">
              <i class="fas fa-clipboard-list" style="font-size: 32px; margin-bottom: 12px; opacity: 0.4;"></i>
              <p style="font-size: 12px; margin-bottom: 8px;">No saved assessments</p>
              <p style="font-size: 11px; color: var(--text-muted);">Complete an assessment to save it here</p>
            </div>
          \`;
        }
      } catch (error) {
        console.error('Failed to load history:', error);
      }
    }

    // ============================================================================
    // AI CO-PILOT
    // ============================================================================
    
    let aiChatHistory = [];
    let aiIsLoading = false;
    
    async function loadAICopilot() {
      document.getElementById('page-actions').innerHTML = \`
        <button class="btn btn-secondary" onclick="clearAIChat()">
          <i class="fas fa-trash"></i> Clear Chat
        </button>
      \`;
      
      document.getElementById('ai-page').innerHTML = \`
        <div style="display: grid; grid-template-columns: 1fr 320px; gap: 24px; height: calc(100vh - 180px);">
          <!-- Chat Area -->
          <div class="card" style="display: flex; flex-direction: column; overflow: hidden;">
            <div class="card-header" style="border-bottom: 1px solid var(--border-color);">
              <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 40px; height: 40px; background: linear-gradient(135deg, var(--accent-purple), var(--accent-blue)); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                  <i class="fas fa-robot" style="color: white; font-size: 18px;"></i>
                </div>
                <div>
                  <h3 class="card-title" style="margin: 0;">GRC AI Co-pilot</h3>
                  <div style="font-size: 11px; color: var(--text-muted);">Powered by Llama 3.1 • 100% Free</div>
                </div>
              </div>
              <span class="badge" style="background: var(--accent-green); color: white;">Online</span>
            </div>
            
            <div id="ai-chat-messages" style="flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 16px;">
              <div class="ai-message assistant">
                <div class="ai-avatar"><i class="fas fa-robot"></i></div>
                <div class="ai-bubble">
                  <div style="font-weight: 500; margin-bottom: 8px;">👋 Hello! I'm your GRC AI Co-pilot</div>
                  <p style="margin: 0; line-height: 1.6;">I can help you with:</p>
                  <ul style="margin: 8px 0 0 0; padding-left: 20px; line-height: 1.8;">
                    <li>Risk assessment and prioritization</li>
                    <li>Compliance guidance (ISO 27001, SOC2, GDPR, PCI-DSS)</li>
                    <li>Security policy recommendations</li>
                    <li>Vendor risk management</li>
                    <li>Maturity assessment advice</li>
                  </ul>
                  <p style="margin: 12px 0 0 0; color: var(--text-muted); font-size: 12px;">Ask me anything or try a quick action on the right →</p>
                </div>
              </div>
            </div>
            
            <div style="padding: 16px; border-top: 1px solid var(--border-color);">
              <form onsubmit="sendAIMessage(event)" style="display: flex; gap: 12px;">
                <input type="text" id="ai-input" class="form-input" placeholder="Ask about risks, compliance, security policies..." style="flex: 1;" autocomplete="off">
                <button type="submit" class="btn btn-primary" id="ai-send-btn">
                  <i class="fas fa-paper-plane"></i> Send
                </button>
              </form>
            </div>
          </div>
          
          <!-- Quick Actions Sidebar -->
          <div style="display: flex; flex-direction: column; gap: 16px;">
            <div class="card">
              <div class="card-header">
                <h3 class="card-title"><i class="fas fa-bolt" style="color: var(--accent-yellow); margin-right: 8px;"></i>Quick Actions</h3>
              </div>
              <div style="display: flex; flex-direction: column; gap: 8px;">
                <button class="quick-action-btn" onclick="aiQuickAction('risk-tips')">
                  <i class="fas fa-shield-alt"></i>
                  <span>Risk Mitigation Tips</span>
                </button>
                <button class="quick-action-btn" onclick="aiQuickAction('compliance-checklist')">
                  <i class="fas fa-clipboard-check"></i>
                  <span>ISO 27001 Checklist</span>
                </button>
                <button class="quick-action-btn" onclick="aiQuickAction('vendor-questions')">
                  <i class="fas fa-building"></i>
                  <span>Vendor Assessment Questions</span>
                </button>
                <button class="quick-action-btn" onclick="aiQuickAction('incident-steps')">
                  <i class="fas fa-exclamation-circle"></i>
                  <span>Incident Response Steps</span>
                </button>
                <button class="quick-action-btn" onclick="aiQuickAction('policy-template')">
                  <i class="fas fa-file-alt"></i>
                  <span>Security Policy Template</span>
                </button>
              </div>
            </div>
            
            <div class="card">
              <div class="card-header">
                <h3 class="card-title"><i class="fas fa-info-circle" style="color: var(--accent-blue); margin-right: 8px;"></i>About</h3>
              </div>
              <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.6;">
                <p style="margin: 0 0 12px 0;">This AI Co-pilot uses <strong>Cloudflare Workers AI</strong> with the Llama 3.1 8B model.</p>
                <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: var(--bg-tertiary); border-radius: 6px; margin-bottom: 8px;">
                  <i class="fas fa-dollar-sign" style="color: var(--accent-green);"></i>
                  <span><strong>Cost:</strong> 100% Free</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: var(--bg-tertiary); border-radius: 6px; margin-bottom: 8px;">
                  <i class="fas fa-lock" style="color: var(--accent-blue);"></i>
                  <span><strong>Privacy:</strong> No data stored</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: var(--bg-tertiary); border-radius: 6px;">
                  <i class="fas fa-tachometer-alt" style="color: var(--accent-purple);"></i>
                  <span><strong>Speed:</strong> ~2-5 seconds</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <style>
          .ai-message { display: flex; gap: 12px; max-width: 85%; }
          .ai-message.user { margin-left: auto; flex-direction: row-reverse; }
          .ai-avatar { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
          .ai-message.assistant .ai-avatar { background: linear-gradient(135deg, var(--accent-purple), var(--accent-blue)); color: white; }
          .ai-message.user .ai-avatar { background: var(--accent-green); color: white; }
          .ai-bubble { padding: 12px 16px; border-radius: 12px; font-size: 13px; line-height: 1.6; }
          .ai-message.assistant .ai-bubble { background: var(--bg-tertiary); border: 1px solid var(--border-color); }
          .ai-message.user .ai-bubble { background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple)); color: white; }
          .quick-action-btn { display: flex; align-items: center; gap: 10px; padding: 12px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; cursor: pointer; transition: all 0.2s; text-align: left; width: 100%; color: var(--text-primary); font-size: 13px; }
          .quick-action-btn:hover { background: var(--bg-tertiary); border-color: var(--accent-blue); }
          .quick-action-btn i { color: var(--accent-blue); width: 16px; }
          .ai-loading { display: flex; gap: 4px; padding: 8px 0; }
          .ai-loading span { width: 8px; height: 8px; background: var(--accent-purple); border-radius: 50%; animation: bounce 1.4s infinite ease-in-out both; }
          .ai-loading span:nth-child(1) { animation-delay: -0.32s; }
          .ai-loading span:nth-child(2) { animation-delay: -0.16s; }
          @keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }
        </style>
      \`;
    }
    
    async function sendAIMessage(event) {
      event.preventDefault();
      
      const input = document.getElementById('ai-input');
      const message = input.value.trim();
      if (!message || aiIsLoading) return;
      
      input.value = '';
      aiIsLoading = true;
      document.getElementById('ai-send-btn').disabled = true;
      
      // Add user message
      const messagesContainer = document.getElementById('ai-chat-messages');
      messagesContainer.innerHTML += \`
        <div class="ai-message user">
          <div class="ai-avatar"><i class="fas fa-user"></i></div>
          <div class="ai-bubble">\${escapeHtml(message)}</div>
        </div>
      \`;
      
      // Add loading indicator
      const loadingId = 'loading-' + Date.now();
      messagesContainer.innerHTML += \`
        <div class="ai-message assistant" id="\${loadingId}">
          <div class="ai-avatar"><i class="fas fa-robot"></i></div>
          <div class="ai-bubble">
            <div class="ai-loading"><span></span><span></span><span></span></div>
          </div>
        </div>
      \`;
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      
      try {
        const result = await api('/ai/chat', {
          method: 'POST',
          body: JSON.stringify({ 
            message,
            context: { currentPage }
          })
        });
        
        // Remove loading and add response
        document.getElementById(loadingId).remove();
        messagesContainer.innerHTML += \`
          <div class="ai-message assistant">
            <div class="ai-avatar"><i class="fas fa-robot"></i></div>
            <div class="ai-bubble">\${formatAIResponse(result.response)}</div>
          </div>
        \`;
      } catch (error) {
        document.getElementById(loadingId).remove();
        messagesContainer.innerHTML += \`
          <div class="ai-message assistant">
            <div class="ai-avatar"><i class="fas fa-robot"></i></div>
            <div class="ai-bubble" style="border-color: var(--accent-red);">
              <i class="fas fa-exclamation-triangle" style="color: var(--accent-red);"></i> 
              Sorry, I encountered an error. Please try again.
            </div>
          </div>
        \`;
      }
      
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      aiIsLoading = false;
      document.getElementById('ai-send-btn').disabled = false;
    }
    
    async function aiQuickAction(action) {
      const prompts = {
        'risk-tips': 'What are the top 5 risk mitigation strategies for a mid-size organization?',
        'compliance-checklist': 'Give me a quick ISO 27001 compliance checklist for the most critical controls.',
        'vendor-questions': 'What are the essential security questions to ask when assessing a new vendor?',
        'incident-steps': 'What are the key steps in an incident response plan?',
        'policy-template': 'Provide an outline for an information security policy document.'
      };
      
      const prompt = prompts[action];
      if (prompt) {
        document.getElementById('ai-input').value = prompt;
        sendAIMessage({ preventDefault: () => {} });
      }
    }
    
    function clearAIChat() {
      aiChatHistory = [];
      const messagesContainer = document.getElementById('ai-chat-messages');
      messagesContainer.innerHTML = \`
        <div class="ai-message assistant">
          <div class="ai-avatar"><i class="fas fa-robot"></i></div>
          <div class="ai-bubble">
            <div style="font-weight: 500; margin-bottom: 8px;">👋 Chat cleared! How can I help you?</div>
            <p style="margin: 0; color: var(--text-muted); font-size: 12px;">Ask me anything about GRC, security, or compliance.</p>
          </div>
        </div>
      \`;
    }
    
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    
    function formatAIResponse(text) {
      // Convert markdown-like formatting to HTML
      return text
        .replace(/\\n\\n/g, '</p><p>')
        .replace(/\\n/g, '<br>')
        .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')
        .replace(/\\*(.+?)\\*/g, '<em>$1</em>')
        .replace(/^- /gm, '• ')
        .replace(/^(\\d+)\\. /gm, '<strong>$1.</strong> ');
    }

    // ============================================
    // AUDIT MANAGEMENT UI FUNCTIONS
    // ============================================
    
    // Audit Dashboard
    async function loadAuditDashboard() {
      const container = document.getElementById('audit-dashboard-page');
      try {
        const data = await api('/audit/dashboard');
        
        container.innerHTML = \`
          <div class="dashboard-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 24px;">
            <div class="metric-card">
              <div style="display: flex; align-items: center; gap: 12px;">
                <div class="metric-icon" style="background: linear-gradient(135deg, #3b82f6, #60a5fa);"><i class="fas fa-calendar-alt"></i></div>
                <div>
                  <div class="metric-value">\${data.programs?.total || 0}</div>
                  <div class="metric-label">Audit Programs</div>
                </div>
              </div>
              <div style="margin-top: 8px; font-size: 12px; color: var(--text-secondary);">
                <span style="color: var(--accent-green);">\${data.programs?.active || 0} Active</span> · 
                <span>\${data.programs?.completed || 0} Completed</span>
              </div>
            </div>
            
            <div class="metric-card">
              <div style="display: flex; align-items: center; gap: 12px;">
                <div class="metric-icon" style="background: linear-gradient(135deg, #8b5cf6, #a78bfa);"><i class="fas fa-briefcase"></i></div>
                <div>
                  <div class="metric-value">\${data.engagements?.total || 0}</div>
                  <div class="metric-label">Engagements</div>
                </div>
              </div>
              <div style="margin-top: 8px; font-size: 12px; color: var(--text-secondary);">
                <span style="color: var(--accent-blue);">\${data.engagements?.in_progress || 0} In Progress</span> · 
                <span>\${data.engagements?.planned || 0} Planned</span>
              </div>
            </div>
            
            <div class="metric-card">
              <div style="display: flex; align-items: center; gap: 12px;">
                <div class="metric-icon" style="background: linear-gradient(135deg, #f59e0b, #fbbf24);"><i class="fas fa-search"></i></div>
                <div>
                  <div class="metric-value">\${data.findings?.total || 0}</div>
                  <div class="metric-label">Total Findings</div>
                </div>
              </div>
              <div style="margin-top: 8px; font-size: 12px; color: var(--text-secondary);">
                <span style="color: var(--accent-red);">\${data.findings?.open || 0} Open</span> · 
                <span>\${data.findings?.linked_to_risks || 0} Linked to Risks</span>
              </div>
            </div>
            
            <div class="metric-card">
              <div style="display: flex; align-items: center; gap: 12px;">
                <div class="metric-icon" style="background: linear-gradient(135deg, #ef4444, #f87171);"><i class="fas fa-exclamation-circle"></i></div>
                <div>
                  <div class="metric-value">\${data.overdueCount || 0}</div>
                  <div class="metric-label">Overdue Findings</div>
                </div>
              </div>
              <div style="margin-top: 8px; font-size: 12px; color: var(--text-secondary);">
                Requires immediate attention
              </div>
            </div>
          </div>
          
          <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;">
            <div class="card">
              <div class="card-header">
                <h3><i class="fas fa-list"></i> Recent Findings</h3>
                <button class="btn btn-sm" onclick="navigate('audit-findings')">View All</button>
              </div>
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Engagement</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  \${(data.recentFindings || []).map(f => \`
                    <tr onclick="viewAuditFinding('\${f.id}')" style="cursor: pointer;">
                      <td style="font-weight: 500;">\${f.title}</td>
                      <td style="font-size: 12px; color: var(--text-secondary);">\${f.engagement_name || 'N/A'}</td>
                      <td><span class="badge \${f.severity}">\${f.severity}</span></td>
                      <td><span class="badge \${f.status === 'open' ? 'high' : f.status === 'in_progress' ? 'medium' : 'low'}">\${f.status?.replace('_', ' ')}</span></td>
                      <td style="font-size: 12px;">\${f.created_at ? new Date(f.created_at).toLocaleDateString() : 'N/A'}</td>
                    </tr>
                  \`).join('') || '<tr><td colspan="5" style="text-align: center; padding: 20px;">No findings yet</td></tr>'}
                </tbody>
              </table>
            </div>
            
            <div class="card">
              <div class="card-header">
                <h3><i class="fas fa-chart-pie"></i> Findings by Severity</h3>
              </div>
              <div style="padding: 20px;">
                <div style="display: flex; flex-direction: column; gap: 12px;">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 12px; height: 12px; border-radius: 3px; background: #ef4444;"></div>
                    <span style="flex: 1;">Critical</span>
                    <strong>\${data.findings?.critical || 0}</strong>
                  </div>
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 12px; height: 12px; border-radius: 3px; background: #f97316;"></div>
                    <span style="flex: 1;">High</span>
                    <strong>\${data.findings?.high || 0}</strong>
                  </div>
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 12px; height: 12px; border-radius: 3px; background: #eab308;"></div>
                    <span style="flex: 1;">Medium</span>
                    <strong>\${data.findings?.medium || 0}</strong>
                  </div>
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 12px; height: 12px; border-radius: 3px; background: #22c55e;"></div>
                    <span style="flex: 1;">Low</span>
                    <strong>\${data.findings?.low || 0}</strong>
                  </div>
                </div>
              </div>
              
              <div style="border-top: 1px solid var(--border-color); padding: 15px; margin-top: 10px;">
                <h4 style="margin-bottom: 10px; font-size: 13px;">Quick Actions</h4>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <button class="btn btn-primary btn-sm" onclick="showNewFindingModal()" style="justify-content: flex-start;">
                    <i class="fas fa-plus"></i> New Finding
                  </button>
                  <button class="btn btn-sm" onclick="navigate('audit-engagements')" style="justify-content: flex-start;">
                    <i class="fas fa-briefcase"></i> Manage Engagements
                  </button>
                </div>
              </div>
            </div>
          </div>
        \`;
      } catch (error) {
        container.innerHTML = '<div class="alert error">Failed to load audit dashboard: ' + error.message + '</div>';
      }
    }
    
    // Audit Programs List
    async function loadAuditPrograms() {
      const container = document.getElementById('audit-programs-page');
      try {
        const programs = await api('/audit/programs');
        
        container.innerHTML = \`
          <div class="page-actions" style="display: flex; justify-content: space-between; margin-bottom: 20px;">
            <div></div>
            <button class="btn btn-primary" onclick="showNewProgramModal()">
              <i class="fas fa-plus"></i> New Program
            </button>
          </div>
          
          <div class="card">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Program Name</th>
                  <th>Year</th>
                  <th>Status</th>
                  <th>Engagements</th>
                  <th>Period</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                \${programs.length ? programs.map(p => \`
                  <tr>
                    <td><strong>\${p.name}</strong><br><small style="color: var(--text-secondary);">\${p.description || ''}</small></td>
                    <td>\${p.year}</td>
                    <td><span class="badge \${p.status === 'active' ? 'medium' : p.status === 'completed' ? 'low' : 'info'}">\${p.status}</span></td>
                    <td>\${p.completed_engagements || 0} / \${p.total_engagements || 0}</td>
                    <td style="font-size: 12px;">\${p.start_date || 'N/A'} - \${p.end_date || 'N/A'}</td>
                    <td>
                      <button class="btn btn-sm" onclick="editProgram('\${p.id}')"><i class="fas fa-edit"></i></button>
                      <button class="btn btn-sm" onclick="deleteProgram('\${p.id}')" style="color: var(--accent-red);"><i class="fas fa-trash"></i></button>
                    </td>
                  </tr>
                \`).join('') : '<tr><td colspan="6" style="text-align: center; padding: 40px;">No audit programs yet. Click "New Program" to create one.</td></tr>'}
              </tbody>
            </table>
          </div>
        \`;
      } catch (error) {
        container.innerHTML = '<div class="alert error">Failed to load audit programs: ' + error.message + '</div>';
      }
    }
    
    // Audit Engagements List
    async function loadAuditEngagements() {
      const container = document.getElementById('audit-engagements-page');
      try {
        const [engagements, programs] = await Promise.all([
          api('/audit/engagements'),
          api('/audit/programs')
        ]);
        
        container.innerHTML = \`
          <div class="page-actions" style="display: flex; justify-content: space-between; margin-bottom: 20px;">
            <div style="display: flex; gap: 10px;">
              <select id="engagement-program-filter" onchange="filterEngagements()" class="form-input" style="width: 200px;">
                <option value="">All Programs</option>
                \${programs.map(p => \`<option value="\${p.id}">\${p.name} (\${p.year})</option>\`).join('')}
              </select>
              <select id="engagement-status-filter" onchange="filterEngagements()" class="form-input" style="width: 150px;">
                <option value="">All Statuses</option>
                <option value="planned">Planned</option>
                <option value="in_progress">In Progress</option>
                <option value="fieldwork">Fieldwork</option>
                <option value="reporting">Reporting</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <button class="btn btn-primary" onclick="showNewEngagementModal()">
              <i class="fas fa-plus"></i> New Engagement
            </button>
          </div>
          
          <div class="card">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Engagement</th>
                  <th>Type</th>
                  <th>Program</th>
                  <th>Status</th>
                  <th>Lead Auditor</th>
                  <th>Findings</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="engagements-tbody">
                \${renderEngagementsTable(engagements)}
              </tbody>
            </table>
          </div>
        \`;
        
        window.allEngagements = engagements;
      } catch (error) {
        container.innerHTML = '<div class="alert error">Failed to load engagements: ' + error.message + '</div>';
      }
    }
    
    function renderEngagementsTable(engagements) {
      if (!engagements.length) {
        return '<tr><td colspan="7" style="text-align: center; padding: 40px;">No engagements yet. Click "New Engagement" to create one.</td></tr>';
      }
      return engagements.map(e => \`
        <tr>
          <td>
            <strong>\${e.name}</strong>
            <br><small style="color: var(--text-secondary);">\${e.department || ''}</small>
          </td>
          <td><span class="badge info">\${e.audit_type?.replace('_', ' ')}</span></td>
          <td style="font-size: 12px;">\${e.program_name || 'N/A'}</td>
          <td><span class="badge \${e.status === 'completed' ? 'low' : e.status === 'in_progress' || e.status === 'fieldwork' ? 'medium' : 'info'}">\${e.status?.replace('_', ' ')}</span></td>
          <td>\${e.lead_auditor_name || 'Unassigned'}</td>
          <td>
            <span style="color: var(--accent-red);">\${e.open_findings || 0}</span> / \${e.findings_count || 0}
          </td>
          <td>
            <button class="btn btn-sm" onclick="viewEngagement('\${e.id}')" title="View"><i class="fas fa-eye"></i></button>
            <button class="btn btn-sm" onclick="editEngagement('\${e.id}')" title="Edit"><i class="fas fa-edit"></i></button>
            <button class="btn btn-sm" onclick="deleteEngagement('\${e.id}')" title="Delete" style="color: var(--accent-red);"><i class="fas fa-trash"></i></button>
          </td>
        </tr>
      \`).join('');
    }
    
    async function filterEngagements() {
      const programId = document.getElementById('engagement-program-filter').value;
      const status = document.getElementById('engagement-status-filter').value;
      let filtered = window.allEngagements || [];
      if (programId) filtered = filtered.filter(e => e.program_id === programId);
      if (status) filtered = filtered.filter(e => e.status === status);
      document.getElementById('engagements-tbody').innerHTML = renderEngagementsTable(filtered);
    }
    
    // Audit Findings List
    async function loadAuditFindings() {
      const container = document.getElementById('audit-findings-page');
      try {
        const [findings, engagements] = await Promise.all([
          api('/audit/findings'),
          api('/audit/engagements')
        ]);
        
        container.innerHTML = \`
          <div class="page-actions" style="display: flex; justify-content: space-between; margin-bottom: 20px;">
            <div style="display: flex; gap: 10px;">
              <select id="finding-engagement-filter" onchange="filterFindings()" class="form-input" style="width: 200px;">
                <option value="">All Engagements</option>
                \${engagements.map(e => \`<option value="\${e.id}">\${e.name}</option>\`).join('')}
              </select>
              <select id="finding-severity-filter" onchange="filterFindings()" class="form-input" style="width: 130px;">
                <option value="">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <select id="finding-status-filter" onchange="filterFindings()" class="form-input" style="width: 140px;">
                <option value="">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="remediation_planned">Remediation Planned</option>
                <option value="remediated">Remediated</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <button class="btn btn-primary" onclick="showNewFindingModal()">
              <i class="fas fa-plus"></i> New Finding
            </button>
          </div>
          
          <div class="card">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Finding</th>
                  <th>Engagement</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Due Date</th>
                  <th>Risk Link</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="findings-tbody">
                \${renderFindingsTable(findings)}
              </tbody>
            </table>
          </div>
        \`;
        
        window.allFindings = findings;
        window.allEngagementsForFindings = engagements;
      } catch (error) {
        container.innerHTML = '<div class="alert error">Failed to load findings: ' + error.message + '</div>';
      }
    }
    
    function renderFindingsTable(findings) {
      if (!findings.length) {
        return '<tr><td colspan="7" style="text-align: center; padding: 40px;">No findings yet. Click "New Finding" to create one.</td></tr>';
      }
      return findings.map(f => \`
        <tr>
          <td>
            <strong>\${f.title}</strong>
            <br><small style="color: var(--text-secondary);">\${f.finding_type?.replace('_', ' ') || 'deficiency'}</small>
          </td>
          <td style="font-size: 12px;">\${f.engagement_name || 'N/A'}</td>
          <td><span class="badge \${f.severity}">\${f.severity}</span></td>
          <td>
            <select class="status-select" onchange="quickUpdateFindingStatus('\${f.id}', this.value)" style="padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; border: none; background: \${f.status === 'open' ? 'rgba(239, 68, 68, 0.2)' : f.status === 'in_progress' ? 'rgba(245, 158, 11, 0.2)' : f.status === 'remediated' || f.status === 'closed' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(59, 130, 246, 0.2)'}; color: \${f.status === 'open' ? '#ef4444' : f.status === 'in_progress' ? '#f59e0b' : f.status === 'remediated' || f.status === 'closed' ? '#22c55e' : '#3b82f6'};">
              <option value="open" \${f.status === 'open' ? 'selected' : ''}>Open</option>
              <option value="in_progress" \${f.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
              <option value="remediation_planned" \${f.status === 'remediation_planned' ? 'selected' : ''}>Planned</option>
              <option value="remediated" \${f.status === 'remediated' ? 'selected' : ''}>Remediated</option>
              <option value="closed" \${f.status === 'closed' ? 'selected' : ''}>Closed</option>
              <option value="accepted" \${f.status === 'accepted' ? 'selected' : ''}>Accepted</option>
            </select>
          </td>
          <td style="font-size: 12px; \${f.due_date && new Date(f.due_date) < new Date() && !['closed','remediated'].includes(f.status) ? 'color: var(--accent-red); font-weight: bold;' : ''}">\${f.due_date || 'N/A'}</td>
          <td>
            \${f.related_risk_id 
              ? '<span style="color: var(--accent-green);"><i class="fas fa-link"></i> Linked</span>' 
              : '<button class="btn btn-sm" onclick="createRiskFromFinding(\\'' + f.id + '\\')"><i class="fas fa-plus"></i> Create Risk</button>'}
          </td>
          <td>
            <button class="btn btn-sm" onclick="viewAuditFinding('\${f.id}')" title="View"><i class="fas fa-eye"></i></button>
            <button class="btn btn-sm" onclick="editAuditFinding('\${f.id}')" title="Edit"><i class="fas fa-edit"></i></button>
            <button class="btn btn-sm" onclick="deleteAuditFinding('\${f.id}')" title="Delete" style="color: var(--accent-red);"><i class="fas fa-trash"></i></button>
          </td>
        </tr>
      \`).join('');
    }
    
    async function filterFindings() {
      const engagementId = document.getElementById('finding-engagement-filter').value;
      const severity = document.getElementById('finding-severity-filter').value;
      const status = document.getElementById('finding-status-filter').value;
      let filtered = window.allFindings || [];
      if (engagementId) filtered = filtered.filter(f => f.engagement_id === engagementId);
      if (severity) filtered = filtered.filter(f => f.severity === severity);
      if (status) filtered = filtered.filter(f => f.status === status);
      document.getElementById('findings-tbody').innerHTML = renderFindingsTable(filtered);
    }
    
    // Modal functions
    function showNewProgramModal() {
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.id = 'program-modal';
      modal.innerHTML = \`
        <div class="modal" style="max-width: 500px;">
          <div class="modal-header">
            <h3><i class="fas fa-calendar-alt"></i> New Audit Program</h3>
            <button onclick="closeAuditModal('program-modal')" class="close-btn">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Program Name *</label>
              <input type="text" id="program-name" class="form-input" placeholder="e.g., 2025 Annual Audit Plan">
            </div>
            <div class="form-group">
              <label>Year *</label>
              <input type="number" id="program-year" class="form-input" value="\${new Date().getFullYear()}">
            </div>
            <div class="form-group">
              <label>Description</label>
              <textarea id="program-description" class="form-input" rows="3" placeholder="Program objectives and scope"></textarea>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
              <div class="form-group">
                <label>Start Date</label>
                <input type="date" id="program-start" class="form-input">
              </div>
              <div class="form-group">
                <label>End Date</label>
                <input type="date" id="program-end" class="form-input">
              </div>
            </div>
            <div class="form-group">
              <label>Status</label>
              <select id="program-status" class="form-input">
                <option value="draft">Draft</option>
                <option value="active">Active</option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button onclick="closeAuditModal('program-modal')" class="btn">Cancel</button>
            <button onclick="saveProgram()" class="btn btn-primary">Create Program</button>
          </div>
        </div>
      \`;
      document.body.appendChild(modal);
    }
    
    async function saveProgram() {
      const data = {
        name: document.getElementById('program-name').value,
        year: parseInt(document.getElementById('program-year').value),
        description: document.getElementById('program-description').value,
        start_date: document.getElementById('program-start').value || null,
        end_date: document.getElementById('program-end').value || null,
        status: document.getElementById('program-status').value
      };
      
      if (!data.name) { showAlert('Program name is required', 'error'); return; }
      
      try {
        await api('/audit/programs', { method: 'POST', body: JSON.stringify(data) });
        closeAuditModal('program-modal');
        showAlert('Program created successfully', 'success');
        loadAuditPrograms();
      } catch (error) {
        showAlert('Failed to create program: ' + error.message, 'error');
      }
    }
    
    function showNewEngagementModal() {
      api('/audit/programs').then(programs => {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'engagement-modal';
        modal.innerHTML = \`
          <div class="modal" style="max-width: 600px;">
            <div class="modal-header">
              <h3><i class="fas fa-briefcase"></i> New Audit Engagement</h3>
              <button onclick="closeAuditModal('engagement-modal')" class="close-btn">&times;</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label>Engagement Name *</label>
                <input type="text" id="eng-name" class="form-input" placeholder="e.g., IT General Controls Review">
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div class="form-group">
                  <label>Audit Program</label>
                  <select id="eng-program" class="form-input">
                    <option value="">-- Select Program --</option>
                    \${programs.map(p => \`<option value="\${p.id}">\${p.name} (\${p.year})</option>\`).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label>Audit Type</label>
                  <select id="eng-type" class="form-input">
                    <option value="internal">Internal</option>
                    <option value="external">External</option>
                    <option value="compliance">Compliance</option>
                    <option value="security">Security</option>
                    <option value="it">IT</option>
                    <option value="operational">Operational</option>
                    <option value="financial">Financial</option>
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label>Description</label>
                <textarea id="eng-description" class="form-input" rows="2" placeholder="Engagement scope and objectives"></textarea>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div class="form-group">
                  <label>Department</label>
                  <input type="text" id="eng-department" class="form-input" placeholder="e.g., IT, Finance">
                </div>
                <div class="form-group">
                  <label>Lead Auditor</label>
                  <input type="text" id="eng-lead" class="form-input" placeholder="Auditor name">
                </div>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div class="form-group">
                  <label>Start Date</label>
                  <input type="date" id="eng-start" class="form-input">
                </div>
                <div class="form-group">
                  <label>End Date</label>
                  <input type="date" id="eng-end" class="form-input">
                </div>
              </div>
              <div class="form-group">
                <label>Status</label>
                <select id="eng-status" class="form-input">
                  <option value="planned">Planned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="fieldwork">Fieldwork</option>
                  <option value="reporting">Reporting</option>
                </select>
              </div>
            </div>
            <div class="modal-footer">
              <button onclick="closeAuditModal('engagement-modal')" class="btn">Cancel</button>
              <button onclick="saveEngagement()" class="btn btn-primary">Create Engagement</button>
            </div>
          </div>
        \`;
        document.body.appendChild(modal);
      });
    }
    
    async function saveEngagement() {
      const data = {
        name: document.getElementById('eng-name').value,
        program_id: document.getElementById('eng-program').value || null,
        audit_type: document.getElementById('eng-type').value,
        description: document.getElementById('eng-description').value,
        department: document.getElementById('eng-department').value,
        lead_auditor_name: document.getElementById('eng-lead').value,
        start_date: document.getElementById('eng-start').value || null,
        end_date: document.getElementById('eng-end').value || null,
        status: document.getElementById('eng-status').value
      };
      
      if (!data.name) { showAlert('Engagement name is required', 'error'); return; }
      
      try {
        await api('/audit/engagements', { method: 'POST', body: JSON.stringify(data) });
        closeAuditModal('engagement-modal');
        showAlert('Engagement created successfully', 'success');
        loadAuditEngagements();
      } catch (error) {
        showAlert('Failed to create engagement: ' + error.message, 'error');
      }
    }
    
    function showNewFindingModal(engagementId = null) {
      Promise.all([
        api('/audit/engagements').catch(() => []),
        api('/compliance/controls').catch(() => ({ controls: [] }))
      ]).then(([engagements, controlsData]) => {
        const controls = controlsData?.controls || [];
        // Group controls by category (A.5, A.6, A.7, A.8)
        const groupedControls = {};
        controls.forEach(c => {
          if (!c.control_id) return;
          const parts = c.control_id.split('.');
          const category = parts[0] + '.' + (parts[1]?.charAt(0) || '');
          if (!groupedControls[category]) groupedControls[category] = [];
          groupedControls[category].push(c);
        });
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'finding-modal';
        modal.innerHTML = \`
          <div class="modal" style="max-width: 750px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header">
              <h3><i class="fas fa-search"></i> New Audit Finding</h3>
              <button onclick="closeAuditModal('finding-modal')" class="close-btn">&times;</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label>Finding Title *</label>
                <input type="text" id="find-title" class="form-input" placeholder="e.g., Inadequate Access Control Review Process">
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div class="form-group">
                  <label>Engagement</label>
                  <select id="find-engagement" class="form-input">
                    <option value="">-- Select Engagement --</option>
                    \${engagements.map(e => \`<option value="\${e.id}" \${engagementId === e.id ? 'selected' : ''}>\${e.name}</option>\`).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label>Finding Type</label>
                  <select id="find-type" class="form-input">
                    <option value="deficiency">Deficiency</option>
                    <option value="weakness">Weakness</option>
                    <option value="observation">Observation</option>
                    <option value="recommendation">Recommendation</option>
                    <option value="non_compliance">Non-Compliance</option>
                    <option value="control_gap">Control Gap</option>
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label>Description</label>
                <textarea id="find-description" class="form-input" rows="3" placeholder="Detailed description of the finding"></textarea>
              </div>
              
              <!-- Affected ISO 27001 Controls Section -->
              <div class="form-group" style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px; margin: 15px 0;">
                <label style="display: flex; align-items: center; justify-content: space-between;">
                  <span><i class="fas fa-shield-alt" style="margin-right: 8px;"></i>Affected ISO 27001 Controls *</span>
                  <span style="font-size: 11px; color: var(--text-secondary);">Select controls that have deficiencies</span>
                </label>
                <div style="margin-top: 10px; display: flex; gap: 10px; align-items: center;">
                  <input type="text" id="find-control-search" class="form-input" placeholder="Search controls..." style="flex: 1;" oninput="filterControlOptions()">
                  <button type="button" class="btn btn-sm" onclick="clearControlSelection()">Clear</button>
                </div>
                <div id="find-controls-list" style="max-height: 200px; overflow-y: auto; margin-top: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary);">
                  \${Object.entries(groupedControls).sort().map(([cat, ctrls]) => \`
                    <div class="control-group" style="border-bottom: 1px solid var(--border-color);">
                      <div style="padding: 8px 12px; background: var(--bg-secondary); font-weight: 600; font-size: 12px; color: var(--text-secondary); position: sticky; top: 0;">
                        \${cat === 'A.5' ? '📋 A.5 - Organizational Controls' : 
                          cat === 'A.6' ? '👥 A.6 - People Controls' : 
                          cat === 'A.7' ? '🏢 A.7 - Physical Controls' : 
                          cat === 'A.8' ? '💻 A.8 - Technological Controls' : cat}
                      </div>
                      \${ctrls.map(c => \`
                        <label class="control-option" data-search="\${c.control_id} \${c.title}".toLowerCase() style="display: flex; align-items: flex-start; gap: 10px; padding: 8px 12px; cursor: pointer; border-bottom: 1px solid var(--border-color);">
                          <input type="checkbox" class="find-control-checkbox" value="\${c.id}" data-code="\${c.control_id}" style="margin-top: 3px;">
                          <div style="flex: 1;">
                            <strong style="color: var(--accent-blue);">\${c.control_id}</strong>
                            <span style="font-size: 12px; color: var(--text-primary);"> - \${c.title}</span>
                            <span style="font-size: 10px; display: block; color: \${c.implementation_status === 'implemented' ? 'var(--accent-green)' : c.implementation_status === 'in_progress' ? 'var(--accent-yellow)' : 'var(--text-muted)'};">
                              Status: \${c.implementation_status || 'not started'}
                            </span>
                          </div>
                        </label>
                      \`).join('')}
                    </div>
                  \`).join('')}
                </div>
                <div id="selected-controls-summary" style="margin-top: 10px; font-size: 12px; color: var(--text-secondary);">
                  <span id="selected-count">0</span> control(s) selected - these will be marked as having deficiencies
                </div>
              </div>
              
              <!-- Risk Assessment Section with Matrix Guide -->
              <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <div style="font-weight: 600; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
                  <i class="fas fa-th" style="color: var(--accent-blue);"></i>
                  Risk Assessment Matrix
                </div>
                
                <!-- Risk Matrix Visual Guide -->
                <div style="display: grid; grid-template-columns: auto repeat(5, 1fr); gap: 2px; font-size: 10px; margin-bottom: 15px;">
                  <div style="padding: 4px; text-align: center;"></div>
                  <div style="padding: 4px; text-align: center; font-weight: 600;">1</div>
                  <div style="padding: 4px; text-align: center; font-weight: 600;">2</div>
                  <div style="padding: 4px; text-align: center; font-weight: 600;">3</div>
                  <div style="padding: 4px; text-align: center; font-weight: 600;">4</div>
                  <div style="padding: 4px; text-align: center; font-weight: 600;">5</div>
                  
                  <div style="padding: 4px; font-weight: 600;">5</div>
                  <div style="padding: 4px; background: #eab308; color: #000; text-align: center; border-radius: 2px;">M</div>
                  <div style="padding: 4px; background: #f59e0b; color: #000; text-align: center; border-radius: 2px;">H</div>
                  <div style="padding: 4px; background: #f59e0b; color: #000; text-align: center; border-radius: 2px;">H</div>
                  <div style="padding: 4px; background: #dc2626; color: #fff; text-align: center; border-radius: 2px;">C</div>
                  <div style="padding: 4px; background: #dc2626; color: #fff; text-align: center; border-radius: 2px;">C</div>
                  
                  <div style="padding: 4px; font-weight: 600;">4</div>
                  <div style="padding: 4px; background: #22c55e; color: #000; text-align: center; border-radius: 2px;">L</div>
                  <div style="padding: 4px; background: #eab308; color: #000; text-align: center; border-radius: 2px;">M</div>
                  <div style="padding: 4px; background: #f59e0b; color: #000; text-align: center; border-radius: 2px;">H</div>
                  <div style="padding: 4px; background: #f59e0b; color: #000; text-align: center; border-radius: 2px;">H</div>
                  <div style="padding: 4px; background: #dc2626; color: #fff; text-align: center; border-radius: 2px;">C</div>
                  
                  <div style="padding: 4px; font-weight: 600;">3</div>
                  <div style="padding: 4px; background: #22c55e; color: #000; text-align: center; border-radius: 2px;">L</div>
                  <div style="padding: 4px; background: #eab308; color: #000; text-align: center; border-radius: 2px;">M</div>
                  <div style="padding: 4px; background: #eab308; color: #000; text-align: center; border-radius: 2px;">M</div>
                  <div style="padding: 4px; background: #f59e0b; color: #000; text-align: center; border-radius: 2px;">H</div>
                  <div style="padding: 4px; background: #f59e0b; color: #000; text-align: center; border-radius: 2px;">H</div>
                  
                  <div style="padding: 4px; font-weight: 600;">2</div>
                  <div style="padding: 4px; background: #22c55e; color: #000; text-align: center; border-radius: 2px;">L</div>
                  <div style="padding: 4px; background: #22c55e; color: #000; text-align: center; border-radius: 2px;">L</div>
                  <div style="padding: 4px; background: #eab308; color: #000; text-align: center; border-radius: 2px;">M</div>
                  <div style="padding: 4px; background: #eab308; color: #000; text-align: center; border-radius: 2px;">M</div>
                  <div style="padding: 4px; background: #f59e0b; color: #000; text-align: center; border-radius: 2px;">H</div>
                  
                  <div style="padding: 4px; font-weight: 600;">1</div>
                  <div style="padding: 4px; background: #22c55e; color: #000; text-align: center; border-radius: 2px;">L</div>
                  <div style="padding: 4px; background: #22c55e; color: #000; text-align: center; border-radius: 2px;">L</div>
                  <div style="padding: 4px; background: #22c55e; color: #000; text-align: center; border-radius: 2px;">L</div>
                  <div style="padding: 4px; background: #eab308; color: #000; text-align: center; border-radius: 2px;">M</div>
                  <div style="padding: 4px; background: #eab308; color: #000; text-align: center; border-radius: 2px;">M</div>
                </div>
                
                <div style="display: flex; gap: 15px; font-size: 10px; justify-content: center; margin-bottom: 10px;">
                  <span><span style="display: inline-block; width: 12px; height: 12px; background: #dc2626; border-radius: 2px; vertical-align: middle;"></span> Critical (≥20)</span>
                  <span><span style="display: inline-block; width: 12px; height: 12px; background: #f59e0b; border-radius: 2px; vertical-align: middle;"></span> High (13-19)</span>
                  <span><span style="display: inline-block; width: 12px; height: 12px; background: #eab308; border-radius: 2px; vertical-align: middle;"></span> Medium (6-12)</span>
                  <span><span style="display: inline-block; width: 12px; height: 12px; background: #22c55e; border-radius: 2px; vertical-align: middle;"></span> Low (1-5)</span>
                </div>
                
                <div style="font-size: 10px; color: var(--text-muted); text-align: center;">
                  Likelihood (horizontal) × Impact (vertical) = Risk Score
                </div>
              </div>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 15px;">
                <div class="form-group">
                  <label>Severity *</label>
                  <select id="find-severity" class="form-input" onchange="updateFindingSeverityFromDropdown()">
                    <option value="low">Low</option>
                    <option value="medium" selected>Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Likelihood (1-5)</label>
                  <input type="number" id="find-likelihood" class="form-input" min="1" max="5" value="3" onchange="updateFindingRiskScore()">
                </div>
                <div class="form-group">
                  <label>Impact (1-5)</label>
                  <input type="number" id="find-impact" class="form-input" min="1" max="5" value="3" onchange="updateFindingRiskScore()">
                </div>
                <div class="form-group">
                  <label>Risk Score</label>
                  <div id="finding-risk-score" style="padding: 8px 12px; background: #eab308; color: #000; border-radius: 6px; text-align: center; font-weight: 600;">
                    9 (Medium)
                  </div>
                </div>
              </div>
              <div class="form-group">
                <label>Category</label>
                <select id="find-category" class="form-input">
                  <option value="compliance">Compliance</option>
                  <option value="operational">Operational</option>
                  <option value="security">Security</option>
                  <option value="financial">Financial</option>
                  <option value="it">IT</option>
                </select>
              </div>
              <div class="form-group">
                <label>Recommendation</label>
                <textarea id="find-recommendation" class="form-input" rows="2" placeholder="Recommended remediation actions"></textarea>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div class="form-group">
                  <label>Remediation Owner</label>
                  <input type="text" id="find-owner" class="form-input" placeholder="Owner name">
                </div>
                <div class="form-group">
                  <label>Due Date</label>
                  <input type="date" id="find-due" class="form-input">
                </div>
              </div>
              <div class="form-group" style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px; margin-top: 10px;">
                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                  <input type="checkbox" id="find-create-risk" checked>
                  <span><strong>Auto-create Risk</strong> - Automatically create a risk item in the Risk Register</span>
                </label>
              </div>
            </div>
            <div class="modal-footer">
              <button onclick="closeAuditModal('finding-modal')" class="btn">Cancel</button>
              <button onclick="saveFinding()" class="btn btn-primary">Create Finding</button>
            </div>
          </div>
        \`;
        document.body.appendChild(modal);
      });
    }
    
    function filterControlOptions() {
      const search = document.getElementById('find-control-search').value.toLowerCase();
      document.querySelectorAll('.control-option').forEach(opt => {
        const text = opt.getAttribute('data-search') || '';
        opt.style.display = text.includes(search) ? 'flex' : 'none';
      });
    }
    
    // Risk Score calculation for findings (matches GRC thresholds)
    function updateFindingRiskScore() {
      const likelihood = parseInt(document.getElementById('find-likelihood').value) || 3;
      const impact = parseInt(document.getElementById('find-impact').value) || 3;
      const score = likelihood * impact;
      
      // Determine severity based on risk score (1-25 scale)
      // Critical: >= 20 (maps to inherent_score >= 75)
      // High: 13-19 (maps to inherent_score 50-74)
      // Medium: 6-12 (maps to inherent_score 25-49)
      // Low: 1-5 (maps to inherent_score < 25)
      let severity, color;
      if (score >= 20) {
        severity = 'critical';
        color = '#dc2626';
      } else if (score >= 13) {
        severity = 'high';
        color = '#f59e0b';
      } else if (score >= 6) {
        severity = 'medium';
        color = '#eab308';
      } else {
        severity = 'low';
        color = '#22c55e';
      }
      
      // Update risk score display
      const scoreEl = document.getElementById('finding-risk-score');
      if (scoreEl) {
        scoreEl.textContent = score + ' (' + severity.charAt(0).toUpperCase() + severity.slice(1) + ')';
        scoreEl.style.background = color;
        scoreEl.style.color = score >= 20 ? '#fff' : '#000';
      }
      
      // Auto-update severity dropdown
      const severityEl = document.getElementById('find-severity');
      if (severityEl) {
        severityEl.value = severity;
      }
    }
    
    // Update L×I when severity dropdown is changed
    function updateFindingSeverityFromDropdown() {
      const severity = document.getElementById('find-severity').value;
      
      // Set default L×I values based on severity
      // These are suggested values that produce scores in the correct range
      const defaults = {
        'critical': { likelihood: 5, impact: 4 },  // 5×4=20
        'high': { likelihood: 4, impact: 4 },      // 4×4=16
        'medium': { likelihood: 3, impact: 3 },    // 3×3=9
        'low': { likelihood: 2, impact: 2 }        // 2×2=4
      };
      
      const d = defaults[severity] || defaults.medium;
      document.getElementById('find-likelihood').value = d.likelihood;
      document.getElementById('find-impact').value = d.impact;
      
      updateFindingRiskScore();
    }
    
    function clearControlSelection() {
      document.querySelectorAll('.find-control-checkbox').forEach(cb => cb.checked = false);
      updateSelectedCount();
    }
    
    function updateSelectedCount() {
      const count = document.querySelectorAll('.find-control-checkbox:checked').length;
      const el = document.getElementById('selected-count');
      if (el) el.textContent = count;
    }
    
    // Add event listener for checkbox changes
    document.addEventListener('change', (e) => {
      if (e.target.classList.contains('find-control-checkbox')) {
        updateSelectedCount();
      }
    });
    
    let savingFinding = false;
    async function saveFinding() {
      if (savingFinding) return; // Prevent double submission
      
      // Collect selected controls
      const selectedControls = [];
      document.querySelectorAll('.find-control-checkbox:checked').forEach(cb => {
        selectedControls.push({
          id: cb.value,
          code: cb.getAttribute('data-code')
        });
      });
      
      const data = {
        title: document.getElementById('find-title').value,
        engagement_id: document.getElementById('find-engagement').value || null,
        finding_type: document.getElementById('find-type').value,
        description: document.getElementById('find-description').value,
        severity: document.getElementById('find-severity').value,
        likelihood: parseInt(document.getElementById('find-likelihood').value) || 3,
        impact_score: parseInt(document.getElementById('find-impact').value) || 3,
        affected_controls: selectedControls,
        category: document.getElementById('find-category').value,
        recommendation: document.getElementById('find-recommendation').value,
        remediation_owner_name: document.getElementById('find-owner').value,
        due_date: document.getElementById('find-due').value || null,
        create_risk: document.getElementById('find-create-risk').checked
      };
      
      if (!data.title) { showAlert('Finding title is required', 'error'); return; }
      if (selectedControls.length === 0) { showAlert('Please select at least one affected control', 'error'); return; }
      
      // Disable button and show loading
      savingFinding = true;
      const btn = document.querySelector('#finding-modal .btn-primary');
      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...'; }
      
      try {
        const result = await api('/audit/findings', { method: 'POST', body: JSON.stringify(data) });
        closeAuditModal('finding-modal');
        
        let message = 'Finding created successfully';
        if (result.created_risk_id && result.affected_control_count > 0) {
          message = \`Finding created! Risk added to register & \${result.affected_control_count} control(s) marked as deficient.\`;
        } else if (result.created_risk_id) {
          message = 'Finding created and risk added to Risk Register';
        } else if (result.affected_control_count > 0) {
          message = \`Finding created! \${result.affected_control_count} control(s) marked as deficient.\`;
        }
        showAlert(message, 'success');
        
        // Refresh current page - support all audit pages
        if (currentPage === 'audit-findings') loadAuditFindings();
        else if (currentPage === 'audit-dashboard') loadAuditDashboard();
        else if (currentPage === 'audit-engagements') loadAuditEngagements();
        else if (currentPage === 'audit-programs') loadAuditPrograms();
      } catch (error) {
        console.error('Finding creation error:', error);
        showAlert('Failed to create finding: ' + (error.message || 'Unknown error'), 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = 'Create Finding'; }
      } finally {
        savingFinding = false;
      }
    }
    
    async function createRiskFromFinding(findingId) {
      if (!confirm('Create a risk item in the Risk Register from this finding?')) return;
      
      try {
        await api('/audit/findings/' + findingId + '/create-risk', { method: 'POST' });
        showAlert('Risk created successfully', 'success');
        loadAuditFindings();
      } catch (error) {
        showAlert('Failed to create risk: ' + error.message, 'error');
      }
    }
    
    async function viewAuditFinding(id) {
      try {
        const f = await api('/audit/findings/' + id);
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'view-finding-modal';
        modal.innerHTML = \`
          <div class="modal" style="max-width: 700px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header">
              <h3><i class="fas fa-search"></i> Finding Details</h3>
              <button onclick="closeAuditModal('view-finding-modal')" class="close-btn">&times;</button>
            </div>
            <div class="modal-body">
              <h2 style="margin-bottom: 10px;">\${f.title}</h2>
              <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                <span class="badge \${f.severity}">\${f.severity}</span>
                <span class="badge \${f.status === 'open' ? 'high' : 'low'}">\${f.status?.replace('_', ' ')}</span>
                <span class="badge info">\${f.finding_type?.replace('_', ' ')}</span>
              </div>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                <div><strong>Engagement:</strong><br>\${f.engagement_name || 'N/A'}</div>
                <div><strong>Category:</strong><br>\${f.category || 'N/A'}</div>
                <div><strong>Risk Rating:</strong><br>\${f.risk_rating || 'N/A'} (L:\${f.likelihood} x I:\${f.impact_score})</div>
                <div><strong>Due Date:</strong><br>\${f.due_date || 'Not set'}</div>
              </div>
              
              \${f.description ? \`<div style="margin-bottom: 15px;"><strong>Description:</strong><p style="margin-top: 5px; color: var(--text-secondary);">\${f.description}</p></div>\` : ''}
              \${f.recommendation ? \`<div style="margin-bottom: 15px;"><strong>Recommendation:</strong><p style="margin-top: 5px; color: var(--text-secondary);">\${f.recommendation}</p></div>\` : ''}
              \${f.remediation_plan ? \`<div style="margin-bottom: 15px;"><strong>Remediation Plan:</strong><p style="margin-top: 5px; color: var(--text-secondary);">\${f.remediation_plan}</p></div>\` : ''}
              
              <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px; margin-top: 15px;">
                <strong>Risk Link:</strong>
                \${f.related_risk_id 
                  ? \`<span style="color: var(--accent-green);"> <i class="fas fa-link"></i> Linked to Risk Register (ID: \${f.related_risk_id})</span>\`
                  : '<span style="color: var(--text-secondary);"> Not linked to Risk Register</span>'}
              </div>
            </div>
            <div class="modal-footer">
              <button onclick="closeAuditModal('view-finding-modal')" class="btn">Close</button>
              <button onclick="closeAuditModal('view-finding-modal'); editAuditFinding('\${f.id}')" class="btn btn-primary">Edit Finding</button>
            </div>
          </div>
        \`;
        document.body.appendChild(modal);
      } catch (error) {
        showAlert('Failed to load finding: ' + error.message, 'error');
      }
    }
    
    async function editAuditFinding(id) {
      try {
        const f = await api('/audit/findings/' + id);
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'edit-finding-modal';
        modal.innerHTML = \`
          <div class="modal" style="max-width: 600px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header">
              <h3><i class="fas fa-edit"></i> Edit Audit Finding</h3>
              <button onclick="closeAuditModal('edit-finding-modal')" class="close-btn">&times;</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label>Title</label>
                <input type="text" id="edit-find-title" class="form-input" value="\${f.title || ''}">
              </div>
              <div class="form-group">
                <label>Description</label>
                <textarea id="edit-find-description" class="form-input" rows="3">\${f.description || ''}</textarea>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div class="form-group">
                  <label>Status</label>
                  <select id="edit-find-status" class="form-input">
                    <option value="open" \${f.status === 'open' ? 'selected' : ''}>Open</option>
                    <option value="in_progress" \${f.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                    <option value="remediation_planned" \${f.status === 'remediation_planned' ? 'selected' : ''}>Remediation Planned</option>
                    <option value="remediated" \${f.status === 'remediated' ? 'selected' : ''}>Remediated</option>
                    <option value="closed" \${f.status === 'closed' ? 'selected' : ''}>Closed</option>
                    <option value="accepted" \${f.status === 'accepted' ? 'selected' : ''}>Risk Accepted</option>
                    <option value="deferred" \${f.status === 'deferred' ? 'selected' : ''}>Deferred</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Severity</label>
                  <select id="edit-find-severity" class="form-input" onchange="updateEditFindingSeverity()">
                    <option value="critical" \${f.severity === 'critical' ? 'selected' : ''}>Critical</option>
                    <option value="high" \${f.severity === 'high' ? 'selected' : ''}>High</option>
                    <option value="medium" \${f.severity === 'medium' ? 'selected' : ''}>Medium</option>
                    <option value="low" \${f.severity === 'low' ? 'selected' : ''}>Low</option>
                  </select>
                </div>
              </div>
              
              <!-- Risk Matrix Mini Guide -->
              <div style="background: var(--bg-tertiary); padding: 10px; border-radius: 6px; margin-bottom: 15px;">
                <div style="display: flex; gap: 10px; font-size: 10px; justify-content: center; flex-wrap: wrap;">
                  <span><span style="display: inline-block; width: 10px; height: 10px; background: #dc2626; border-radius: 2px;"></span> Critical: L×I ≥ 20</span>
                  <span><span style="display: inline-block; width: 10px; height: 10px; background: #f59e0b; border-radius: 2px;"></span> High: 13-19</span>
                  <span><span style="display: inline-block; width: 10px; height: 10px; background: #eab308; border-radius: 2px;"></span> Medium: 6-12</span>
                  <span><span style="display: inline-block; width: 10px; height: 10px; background: #22c55e; border-radius: 2px;"></span> Low: 1-5</span>
                </div>
              </div>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px;">
                <div class="form-group">
                  <label>Likelihood (1-5)</label>
                  <input type="number" id="edit-find-likelihood" class="form-input" min="1" max="5" value="\${f.likelihood || 3}" onchange="updateEditFindingScore()">
                </div>
                <div class="form-group">
                  <label>Impact (1-5)</label>
                  <input type="number" id="edit-find-impact" class="form-input" min="1" max="5" value="\${f.impact_score || 3}" onchange="updateEditFindingScore()">
                </div>
                <div class="form-group">
                  <label>Risk Score</label>
                  <div id="edit-finding-score" style="padding: 8px; border-radius: 6px; text-align: center; font-weight: 600; background: \${(f.likelihood || 3) * (f.impact_score || 3) >= 20 ? '#dc2626' : (f.likelihood || 3) * (f.impact_score || 3) >= 13 ? '#f59e0b' : (f.likelihood || 3) * (f.impact_score || 3) >= 6 ? '#eab308' : '#22c55e'}; color: \${(f.likelihood || 3) * (f.impact_score || 3) >= 20 ? '#fff' : '#000'};">
                    \${(f.likelihood || 3) * (f.impact_score || 3)}
                  </div>
                </div>
              </div>
              <div class="form-group">
                <label>Remediation Owner</label>
                <input type="text" id="edit-find-owner" class="form-input" value="\${f.remediation_owner_name || ''}">
              </div>
              <div class="form-group">
                <label>Due Date</label>
                <input type="date" id="edit-find-due" class="form-input" value="\${f.due_date || ''}">
              </div>
              <div class="form-group">
                <label>Management Response</label>
                <textarea id="edit-find-response" class="form-input" rows="2">\${f.management_response || ''}</textarea>
              </div>
              \${f.related_risk_id ? \`
                <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 8px; margin-top: 10px;">
                  <i class="fas fa-link" style="color: var(--accent-green);"></i>
                  <strong>Linked to Risk Register</strong>
                  <p style="font-size: 12px; color: var(--text-secondary); margin: 5px 0 0;">
                    Risk ID: \${f.related_risk_id}<br>
                    Status changes will sync to the linked risk.
                  </p>
                </div>
              \` : ''}
            </div>
            <div class="modal-footer">
              <button onclick="closeAuditModal('edit-finding-modal')" class="btn">Cancel</button>
              <button onclick="updateAuditFinding('\${f.id}')" class="btn btn-primary">Update Finding</button>
            </div>
          </div>
        \`;
        document.body.appendChild(modal);
      } catch (error) {
        showAlert('Failed to load finding: ' + error.message, 'error');
      }
    }
    
    async function updateAuditFinding(id) {
      const data = {
        title: document.getElementById('edit-find-title').value,
        description: document.getElementById('edit-find-description').value,
        status: document.getElementById('edit-find-status').value,
        severity: document.getElementById('edit-find-severity').value,
        likelihood: parseInt(document.getElementById('edit-find-likelihood').value) || 3,
        impact_score: parseInt(document.getElementById('edit-find-impact').value) || 3,
        remediation_owner_name: document.getElementById('edit-find-owner').value,
        due_date: document.getElementById('edit-find-due').value || null,
        management_response: document.getElementById('edit-find-response').value
      };
      
      try {
        await api('/audit/findings/' + id, { method: 'PATCH', body: JSON.stringify(data) });
        closeAuditModal('edit-finding-modal');
        showAlert('Finding updated successfully', 'success');
        
        // Refresh current page - support all audit pages
        if (currentPage === 'audit-findings') loadAuditFindings();
        else if (currentPage === 'audit-dashboard') loadAuditDashboard();
        else if (currentPage === 'audit-engagements') loadAuditEngagements();
        else if (currentPage === 'audit-programs') loadAuditPrograms();
      } catch (error) {
        console.error('Finding update error:', error);
        showAlert('Failed to update finding: ' + (error.message || 'Unknown error'), 'error');
      }
    }
    
    // Edit Finding - Risk Score update functions
    function updateEditFindingScore() {
      const likelihood = parseInt(document.getElementById('edit-find-likelihood').value) || 3;
      const impact = parseInt(document.getElementById('edit-find-impact').value) || 3;
      const score = likelihood * impact;
      
      let severity, color, textColor;
      if (score >= 20) {
        severity = 'critical';
        color = '#dc2626';
        textColor = '#fff';
      } else if (score >= 13) {
        severity = 'high';
        color = '#f59e0b';
        textColor = '#000';
      } else if (score >= 6) {
        severity = 'medium';
        color = '#eab308';
        textColor = '#000';
      } else {
        severity = 'low';
        color = '#22c55e';
        textColor = '#000';
      }
      
      const scoreEl = document.getElementById('edit-finding-score');
      if (scoreEl) {
        scoreEl.textContent = score;
        scoreEl.style.background = color;
        scoreEl.style.color = textColor;
      }
      
      // Auto-update severity dropdown
      const severityEl = document.getElementById('edit-find-severity');
      if (severityEl) {
        severityEl.value = severity;
      }
    }
    
    function updateEditFindingSeverity() {
      const severity = document.getElementById('edit-find-severity').value;
      const defaults = {
        'critical': { likelihood: 5, impact: 4 },
        'high': { likelihood: 4, impact: 4 },
        'medium': { likelihood: 3, impact: 3 },
        'low': { likelihood: 2, impact: 2 }
      };
      
      const d = defaults[severity] || defaults.medium;
      document.getElementById('edit-find-likelihood').value = d.likelihood;
      document.getElementById('edit-find-impact').value = d.impact;
      updateEditFindingScore();
    }
    
    async function deleteAuditFinding(id) {
      if (!confirm('Delete this finding?\\n\\nNote: If this finding is linked to a risk, the risk will also be deleted from the Risk Register.')) return;
      try {
        const result = await api('/audit/findings/' + id, { method: 'DELETE' });
        if (result.deleted_risk) {
          showAlert('Finding and linked risk deleted successfully', 'success');
        } else {
          showAlert('Finding deleted', 'success');
        }
        // Refresh current page - support all audit pages
        if (currentPage === 'audit-findings') loadAuditFindings();
        else if (currentPage === 'audit-dashboard') loadAuditDashboard();
        else if (currentPage === 'audit-engagements') loadAuditEngagements();
        else if (currentPage === 'audit-programs') loadAuditPrograms();
      } catch (error) {
        console.error('Finding deletion error:', error);
        showAlert('Failed to delete finding: ' + (error.message || 'Unknown error'), 'error');
      }
    }
    
    async function quickUpdateFindingStatus(id, newStatus) {
      try {
        await api('/audit/findings/' + id, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
        const statusLabel = newStatus.replace('_', ' ');
        showAlert('Finding status updated to ' + statusLabel, 'success');
        // Refresh current page - support all audit pages
        if (currentPage === 'audit-findings') loadAuditFindings();
        else if (currentPage === 'audit-dashboard') loadAuditDashboard();
        else if (currentPage === 'audit-engagements') loadAuditEngagements();
        else if (currentPage === 'audit-programs') loadAuditPrograms();
      } catch (error) {
        console.error('Status update error:', error);
        showAlert('Failed to update status: ' + (error.message || 'Unknown error'), 'error');
        loadAuditFindings(); // Reload to reset dropdown
      }
    }
    
    async function editProgram(id) {
      showAlert('Edit program functionality coming soon', 'info');
    }
    
    async function deleteProgram(id) {
      if (!confirm('Delete this program? Associated engagements will be unlinked.')) return;
      try {
        await api('/audit/programs/' + id, { method: 'DELETE' });
        showAlert('Program deleted', 'success');
        loadAuditPrograms();
      } catch (error) {
        showAlert('Failed to delete program: ' + error.message, 'error');
      }
    }
    
    async function viewEngagement(id) {
      try {
        const e = await api('/audit/engagements/' + id);
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'view-engagement-modal';
        modal.innerHTML = \`
          <div class="modal" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header">
              <h3><i class="fas fa-briefcase"></i> Engagement Details</h3>
              <button onclick="closeAuditModal('view-engagement-modal')" class="close-btn">&times;</button>
            </div>
            <div class="modal-body">
              <h2 style="margin-bottom: 10px;">\${e.name}</h2>
              <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                <span class="badge info">\${e.audit_type?.replace('_', ' ')}</span>
                <span class="badge \${e.status === 'completed' ? 'low' : e.status === 'in_progress' ? 'medium' : 'info'}">\${e.status?.replace('_', ' ')}</span>
              </div>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                <div><strong>Program:</strong><br>\${e.program_name || 'N/A'}</div>
                <div><strong>Lead Auditor:</strong><br>\${e.lead_auditor_name || 'Unassigned'}</div>
                <div><strong>Department:</strong><br>\${e.department || 'N/A'}</div>
                <div><strong>Period:</strong><br>\${e.start_date || 'N/A'} - \${e.end_date || 'N/A'}</div>
              </div>
              
              \${e.description ? \`<div style="margin-bottom: 15px;"><strong>Description:</strong><p style="margin-top: 5px; color: var(--text-secondary);">\${e.description}</p></div>\` : ''}
              
              <div style="margin-top: 20px;">
                <h4 style="margin-bottom: 10px;">Findings (\${(e.findings || []).length})</h4>
                \${(e.findings || []).length ? \`
                  <table class="data-table">
                    <thead><tr><th>Title</th><th>Severity</th><th>Status</th></tr></thead>
                    <tbody>
                      \${(e.findings || []).map(f => \`
                        <tr onclick="closeAuditModal('view-engagement-modal'); viewAuditFinding('\${f.id}')" style="cursor: pointer;">
                          <td>\${f.title}</td>
                          <td><span class="badge \${f.severity}">\${f.severity}</span></td>
                          <td><span class="badge \${f.status === 'open' ? 'high' : 'low'}">\${f.status?.replace('_', ' ')}</span></td>
                        </tr>
                      \`).join('')}
                    </tbody>
                  </table>
                \` : '<p style="color: var(--text-secondary);">No findings recorded yet.</p>'}
              </div>
            </div>
            <div class="modal-footer">
              <button onclick="closeAuditModal('view-engagement-modal')" class="btn">Close</button>
              <button onclick="closeAuditModal('view-engagement-modal'); showNewFindingModal('\${e.id}')" class="btn btn-primary">Add Finding</button>
            </div>
          </div>
        \`;
        document.body.appendChild(modal);
      } catch (error) {
        showAlert('Failed to load engagement: ' + error.message, 'error');
      }
    }
    
    async function editEngagement(id) {
      viewEngagement(id);
    }
    
    async function deleteEngagement(id) {
      if (!confirm('Delete this engagement and all its findings? This cannot be undone.')) return;
      try {
        await api('/audit/engagements/' + id, { method: 'DELETE' });
        showAlert('Engagement deleted', 'success');
        loadAuditEngagements();
      } catch (error) {
        showAlert('Failed to delete engagement: ' + error.message, 'error');
      }
    }
    
    function closeAuditModal(id) {
      const modal = document.getElementById(id);
      if (modal) modal.remove();
    }

    // Initial load
    loadDashboard();
  </script>
</body>
</html>`
}

// ============================================================================
// PENTEST PULSE SYNC RECEIVER (Real-time Integration)
// ============================================================================

// Receive risk data from Pentest Pulse
app.post('/api/external/risks/pentest', async (c) => {
  const db = c.env.DB
  
  try {
    const { action, risk } = await c.req.json()
    
    // Validate source header
    const sourceApp = c.req.header('X-Source-App')
    if (sourceApp !== 'pentest-pulse') {
      return c.json({ error: 'Invalid source' }, 403)
    }
    
    if (!risk || !risk.source_ref) {
      return c.json({ error: 'Missing risk data or source_ref' }, 400)
    }
    
    // Handle delete action - CASCADE DELETE to control_risk_mappings
    if (action === 'delete') {
      // First, find the risk IDs that will be deleted
      const risksToDelete = await db.prepare(`
        SELECT id FROM risk_items 
        WHERE risk_source = 'penetration_test' 
        AND external_reference LIKE ?
      `).bind(`%${risk.source_ref}%`).all()
      
      let deletedRisks = 0
      let deletedMappings = 0
      
      for (const r of (risksToDelete.results || [])) {
        // Delete associated control_risk_mappings first
        const mappingResult = await db.prepare(`
          DELETE FROM control_risk_mappings WHERE risk_id = ?
        `).bind(r.id).run()
        deletedMappings += mappingResult.meta?.changes || 0
        
        // Then delete the risk
        await db.prepare(`DELETE FROM risk_items WHERE id = ?`).bind(r.id).run()
        deletedRisks++
      }
      
      return c.json({ 
        success: true, 
        action: 'deleted',
        deleted_risks: deletedRisks,
        deleted_mappings: deletedMappings
      })
    }
    
    // Check if risk already exists (upsert logic)
    const existing = await db.prepare(`
      SELECT id FROM risk_items 
      WHERE risk_source = 'penetration_test' 
      AND external_reference LIKE ?
    `).bind(`%${risk.source_ref}%`).first()
    
    if (existing) {
      // UPDATE existing risk
      // PRIORITY: ALWAYS use pentest severity directly for accurate severity mapping
      // This ensures GRCpulse severity matches PentestPulse severity exactly
      const severityToScoreUpdate: Record<string, number> = {
        'critical': 95,
        'high': 75,
        'medium': 50,
        'low': 25,
        'informational': 10
      }
      const pentestSeverityUpdate = (risk.pentest_severity || 'medium').toLowerCase()
      // ALWAYS use severity-based score, fallback to medium (50) if unknown
      const inherentScoreUpdate = severityToScoreUpdate[pentestSeverityUpdate] || 50
      
      // Store pentest-specific data in ai_analysis for display alignment
      const pentestData = {
        source: 'pentest_pulse',
        risk_score: risk.pentest_risk_score || Math.round(risk.inherent_likelihood * 5 * risk.inherent_impact * 5),
        likelihood: risk.pentest_likelihood || Math.round(risk.inherent_likelihood * 5),
        impact: risk.pentest_impact || Math.round(risk.inherent_impact * 5),
        severity: risk.pentest_severity || 'medium',
        technical_details: risk.technical_details || {}
      }
      
      await db.prepare(`
        UPDATE risk_items SET
          title = ?,
          description = ?,
          category = ?,
          subcategory = ?,
          inherent_likelihood = ?,
          inherent_impact = ?,
          inherent_score = ?,
          affected_asset_id = ?,
          status = ?,
          remediation_plan = ?,
          due_date = ?,
          ai_analysis = ?,
          last_assessed_at = datetime('now'),
          updated_at = datetime('now')
        WHERE id = ?
      `).bind(
        risk.title || 'Untitled Finding',
        risk.description || null,
        risk.risk_category || 'vulnerability',
        risk.subcategory || null,
        risk.inherent_likelihood || 0.5,
        risk.inherent_impact || 0.5,
        inherentScoreUpdate,  // Use severity-based score
        risk.affected_asset_id || null,
        mapPentestStatus(risk.status),
        risk.remediation_plan || null,
        risk.due_date || null,
        JSON.stringify(pentestData),
        existing.id
      ).run()
      
      // AUTO-SYNC: Recalculate linked controls when risk status changes
      const controlsSync = await recalculateControlsForRisk(db, existing.id, risk.organization_id || orgId)
      
      return c.json({ 
        success: true, 
        action: 'updated', 
        risk_id: existing.id,
        controls_synced: controlsSync.controlsUpdated
      })
    } else {
      // INSERT new risk
      const newId = generateId('risk-pt')
      
      // PRIORITY: ALWAYS use pentest severity directly for accurate severity mapping
      // Pentest severity -> inherent_score mapping:
      //   critical -> 95, high -> 75, medium -> 50, low -> 25, informational -> 10
      // This ensures GRCpulse severity matches PentestPulse severity exactly
      const severityToScore: Record<string, number> = {
        'critical': 95,
        'high': 75,
        'medium': 50,
        'low': 25,
        'informational': 10
      }
      const pentestSeverity = (risk.pentest_severity || 'medium').toLowerCase()
      // ALWAYS use severity-based score, fallback to medium (50) if unknown
      const inherentScore = severityToScore[pentestSeverity] || 50
      
      // Store pentest-specific data in ai_analysis for display alignment
      const pentestData = {
        source: 'pentest_pulse',
        risk_score: risk.pentest_risk_score || Math.round(risk.inherent_likelihood * 5 * risk.inherent_impact * 5),
        likelihood: risk.pentest_likelihood || Math.round(risk.inherent_likelihood * 5),
        impact: risk.pentest_impact || Math.round(risk.inherent_impact * 5),
        severity: risk.pentest_severity || 'medium',
        technical_details: risk.technical_details || {}
      }
      
      await db.prepare(`
        INSERT INTO risk_items (
          id, organization_id, title, description,
          category, subcategory, risk_source, external_reference,
          inherent_likelihood, inherent_impact, inherent_score,
          context_priority_score, context_priority_reason,
          affected_asset_id, status, remediation_plan, due_date,
          ai_analysis, discovered_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(
        newId,
        risk.organization_id || orgId,
        risk.title || 'Untitled Finding',
        risk.description || null,
        risk.risk_category || 'vulnerability',
        risk.subcategory || null,
        'penetration_test', // Use valid risk_source enum
        `pentest:${risk.source_ref}|project:${risk.source_project_code || 'unknown'}|${risk.external_reference || ''}`,
        risk.inherent_likelihood || 0.5,
        risk.inherent_impact || 0.5,
        inherentScore,
        inherentScore, // Use inherent score as initial context priority
        'Imported from Pentest Pulse',
        risk.affected_asset_id || null,
        mapPentestStatus(risk.status),
        risk.remediation_plan || null,
        risk.due_date || null,
        JSON.stringify(pentestData),
        risk.discovered_at || new Date().toISOString()
      ).run()
      
      return c.json({ 
        success: true, 
        action: 'created', 
        risk_id: newId 
      })
    }
  } catch (error) {
    console.error('Pentest sync error:', error)
    return c.json({ 
      error: 'Sync failed', 
      details: String(error) 
    }, 500)
  }
})

// ============================================================================
// CONTROL STATUS ADVISORY SYSTEM (ADVISORY MODE - NO AUTO-CHANGES)
// ============================================================================
// IMPORTANT: Gap Assessment is a MANUAL process controlled by GRC users.
// Pentest findings ADVISE but do NOT automatically change control status.
// 
// This system provides:
// 1. Advisory warnings: Show recommendations when pentest findings affect controls
// 2. Needs Review flags: Highlight controls requiring GRC user attention
// 3. Severity weighting: Calculate impact of open findings (Critical=4x, High=3x, etc.)
// 4. No auto-changes: Control status is ONLY changed by manual GRC user action
// 5. Full visibility: Show GRC users which controls have open pentest findings

interface ControlSyncResult {
  updated: boolean;  // Always false in advisory mode
  newStatus: string;
  previousStatus: string;
  recommendedStatus: string | null;  // What we suggest (advisory only)
  recommendation: string;  // Human-readable recommendation
  reason: string;
  openRisks: number;
  totalRisks: number;
  openRatio: number;
  warning: string | null;
  needsReview: boolean;  // Flag for UI to show "Pending Review" indicator
  manualOverrideActive: boolean;
  riskDetails: { id: string; title: string; status: string; severity: string }[];
  severityBreakdown: { critical: number; high: number; medium: number; low: number };
}

// Severity weights for risk impact calculation
// Higher severity risks have MORE impact on control effectiveness
const SEVERITY_WEIGHTS: Record<string, number> = {
  'critical': 4.0,  // 4x impact - Critical risks severely compromise control
  'high': 3.0,      // 3x impact - High risks significantly affect control
  'medium': 2.0,    // 2x impact - Medium risks moderately affect control
  'low': 1.0,       // 1x impact - Low risks minimally affect control
  'informational': 0.5
}

// Determine severity from inherent_score (0-100 scale)
// Based on likelihood * impact scoring: 
//   5x5=100 (Critical), 5x4=80 (Critical), 4x4=64 (High), 3x3=36 (Medium), 2x2=16 (Low)
function getSeverityFromScore(inherentScore: number): string {
  if (inherentScore >= 75) return 'critical'   // ≥75: Critical (e.g., 5x4=80, 5x5=100)
  if (inherentScore >= 50) return 'high'       // 50-74: High (e.g., 4x4=64, 4x3=48)
  if (inherentScore >= 25) return 'medium'     // 25-49: Medium (e.g., 3x3=36)
  return 'low'                                  // <25: Low (e.g., 2x2=16)
}

// Calculate weighted open ratio based on severity
// This ensures that 1 Critical open risk has MORE impact than 4 Low open risks
function calculateWeightedOpenRatio(risks: any[]): { 
  openRatio: number; 
  weightedRatio: number;
  severityBreakdown: { critical: number; high: number; medium: number; low: number };
} {
  if (risks.length === 0) return { 
    openRatio: 0, 
    weightedRatio: 0,
    severityBreakdown: { critical: 0, high: 0, medium: 0, low: 0 }
  }
  
  let totalWeight = 0
  let openWeight = 0
  let openCount = 0
  const severityBreakdown = { critical: 0, high: 0, medium: 0, low: 0 }
  
  for (const risk of risks) {
    // Extract severity from inherent_score
    const severity = getSeverityFromScore(risk.inherent_score || 0)
    const weight = SEVERITY_WEIGHTS[severity] || 2.0
    totalWeight += weight
    
    if (risk.status === 'open' || risk.status === 'in_progress') {
      openWeight += weight
      openCount++
      // Track open risks by severity
      if (severity === 'critical') severityBreakdown.critical++
      else if (severity === 'high') severityBreakdown.high++
      else if (severity === 'medium') severityBreakdown.medium++
      else severityBreakdown.low++
    }
  }
  
  return {
    openRatio: openCount / risks.length,
    weightedRatio: totalWeight > 0 ? openWeight / totalWeight : 0,
    severityBreakdown
  }
}

// ============================================================================
// CANONICAL COMPLIANCE SCORING (single source of truth)
// ----------------------------------------------------------------------------
// Every screen (Main Dashboard, Compliance Dashboard, Executive Summary,
// trends) MUST use these helpers so the number is identical everywhere.
//
// Model: Weighted Deduction
//   Base Score      = implemented / applicable controls * 100
//   Risk Deduction  = sum over each OPEN risk of a per-severity point value,
//                     where an 'in_progress' risk deducts at HALF weight
//                     (it is actively being remediated).
//   Final Score     = max(0, round(Base - min(Deduction, cap)))
//
// Deductions are per-risk and large enough that opening/closing a single
// Critical/High finding always moves the score. Severity is derived from the
// canonical getSeverityFromScore() bucket, so it works for every risk source
// once inherent_score is on the 0-100 scale (pentest sync now normalises it).
// ============================================================================
const RISK_DEDUCTION_POINTS: Record<string, number> = {
  'critical': 5,
  'high': 3,
  'medium': 1,
  'low': 0.5,
  'informational': 0
}
// Cap total risk deduction so a heavily-tested org still reflects its control
// coverage rather than flooring at 0 from findings alone.
const MAX_RISK_DEDUCTION = 40

interface RiskDeductionResult {
  deduction: number            // capped, applied to the score
  rawDeduction: number         // uncapped total (for transparency)
  isCapped: boolean
  counts: { critical: number; high: number; medium: number; low: number }
  byPoints: { critical: number; high: number; medium: number; low: number }
}

// Compute the risk deduction from a list of risk rows.
// Each row needs: inherent_score (0-100) and status.
function computeRiskDeduction(risks: any[]): RiskDeductionResult {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 }
  const byPoints = { critical: 0, high: 0, medium: 0, low: 0 }
  let rawDeduction = 0

  for (const risk of risks) {
    const status = (risk.status || '').toLowerCase()
    // Only OPEN / IN_PROGRESS risks reduce the score. Anything closed,
    // mitigated, accepted, transferred, etc. no longer deducts — so fixing a
    // finding immediately raises the score.
    if (status !== 'open' && status !== 'in_progress') continue

    const severity = getSeverityFromScore(risk.inherent_score || 0)
    const base = RISK_DEDUCTION_POINTS[severity] ?? 0
    // in_progress = being remediated -> half penalty of an untouched open risk.
    const points = status === 'in_progress' ? base / 2 : base

    if (severity === 'critical' || severity === 'high' || severity === 'medium' || severity === 'low') {
      counts[severity]++
      byPoints[severity] += points
    }
    rawDeduction += points
  }

  const deduction = Math.min(rawDeduction, MAX_RISK_DEDUCTION)
  return {
    deduction: Math.round(deduction * 10) / 10,
    rawDeduction: Math.round(rawDeduction * 10) / 10,
    isCapped: rawDeduction > MAX_RISK_DEDUCTION,
    counts,
    byPoints
  }
}

// Compose the final compliance score from a base (0-100) and a risk list.
function computeComplianceScore(baseScore: number, risks: any[]): {
  score: number
  baseScore: number
  deduction: number
  detail: RiskDeductionResult
} {
  const detail = computeRiskDeduction(risks)
  const score = Math.max(0, Math.round(baseScore - detail.deduction))
  return { score, baseScore: Math.round(baseScore), deduction: detail.deduction, detail }
}

async function recalculateControlStatus(db: D1Database, controlId: string, orgId: string): Promise<ControlSyncResult> {
  // Get all risks linked to this control with severity info
  const linkedRisks = await db.prepare(`
    SELECT ri.id, ri.title, ri.status, ri.risk_source, ri.inherent_score,
           CASE 
             WHEN ri.inherent_score >= 80 THEN 'critical'
             WHEN ri.inherent_score >= 60 THEN 'high'
             WHEN ri.inherent_score >= 30 THEN 'medium'
             ELSE 'low'
           END as severity
    FROM control_risk_mappings crm
    JOIN risk_items ri ON crm.risk_id = ri.id
    WHERE crm.control_id = ? AND crm.organization_id = ?
  `).bind(controlId, orgId).all()
  
  const risks = linkedRisks.results || []
  const totalRisks = risks.length
  
  // Get current control assessment with manual_override flag
  const currentAssessment = await db.prepare(`
    SELECT ca.id, ca.implementation_status, ca.manual_override, ca.risk_warnings,
           cl.control_id as control_code, cl.title as control_title
    FROM control_assessments ca
    JOIN control_library cl ON ca.control_library_id = cl.id
    WHERE ca.control_library_id = ? AND ca.organization_id = ?
  `).bind(controlId, orgId).first() as any
  
  const currentStatus = currentAssessment?.implementation_status || 'not_started'
  const manualOverride = currentAssessment?.manual_override === 1
  
  // Build risk details for audit
  const riskDetails = risks.map((r: any) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    severity: r.severity
  }))
  
  // Count open/in_progress risks
  const openRisks = risks.filter((r: any) => 
    r.status === 'open' || r.status === 'in_progress'
  )
  const openCount = openRisks.length
  
  // If no linked risks, keep current status
  if (totalRisks === 0) {
    return {
      updated: false,
      newStatus: currentStatus,
      previousStatus: currentStatus,
      reason: 'No linked risks - status unchanged',
      openRisks: 0,
      totalRisks: 0,
      openRatio: 0,
      warning: null,
      manualOverrideActive: manualOverride,
      riskDetails: []
    }
  }
  
  // Calculate weighted open ratio with severity breakdown
  const { openRatio, weightedRatio, severityBreakdown } = calculateWeightedOpenRatio(risks)
  
  // Build severity context for messages
  const severityContext = []
  if (severityBreakdown.critical > 0) severityContext.push(`${severityBreakdown.critical} Critical`)
  if (severityBreakdown.high > 0) severityContext.push(`${severityBreakdown.high} High`)
  if (severityBreakdown.medium > 0) severityContext.push(`${severityBreakdown.medium} Medium`)
  if (severityBreakdown.low > 0) severityContext.push(`${severityBreakdown.low} Low`)
  const severityText = severityContext.length > 0 ? ` (${severityContext.join(', ')})` : ''
  
  // Determine new status and warnings based on thresholds
  let newStatus: string = currentStatus
  let reason: string = ''
  let warning: string | null = null
  let shouldUpdate = false
  
  // THRESHOLD LOGIC (weighted by severity):
  // - ≥50% weighted open: not_implemented
  // - ≥30% weighted open: partially_implemented  
  // - <30% weighted open: warning only, no status change (SOFT DOWNGRADE)
  // - 0% open: implemented
  // 
  // Example: 1 Critical (4x) + 1 High (3x) open = 7 weight
  //          vs 3 Low (1x) open = 3 weight
  //          Critical+High has MORE impact even with fewer risks
  
  const CRITICAL_THRESHOLD = 0.50  // 50% - major issue
  const WARNING_THRESHOLD = 0.30   // 30% - needs attention
  
  // ============================================================================
  // ADVISORY MODE: We do NOT auto-change control status
  // Gap Assessment is a MANUAL process - GRC users should decide control status
  // Pentest findings only ADVISE the user, not force changes
  // ============================================================================
  
  // Determine RECOMMENDED status (what we suggest, not what we enforce)
  let recommendedStatus: string = currentStatus
  let recommendation: string = ''
  
  // Determine highest severity of open risks for better messaging
  let highestSeverity = 'low'
  if (severityBreakdown.critical > 0) highestSeverity = 'critical'
  else if (severityBreakdown.high > 0) highestSeverity = 'high'
  else if (severityBreakdown.medium > 0) highestSeverity = 'medium'
  
  if (openCount === 0) {
    // All risks are mitigated/closed
    if (currentStatus !== 'implemented') {
      recommendedStatus = 'implemented'
      recommendation = `RECOMMENDATION: Consider upgrading to "Implemented" - all ${totalRisks} linked risk(s) have been remediated`
    }
    warning = null
    reason = `All ${totalRisks} linked risk(s) are mitigated/closed`
  } else if (highestSeverity === 'critical' || highestSeverity === 'high') {
    // Has critical or high severity open findings
    recommendedStatus = 'in_progress'
    reason = `${openCount}/${totalRisks} risks open${severityText} - includes ${highestSeverity.toUpperCase()} severity findings`
    warning = `${highestSeverity.toUpperCase()} RISK: ${openCount} open pentest finding(s) affect this control`
    recommendation = `REVIEW REQUIRED: Consider changing status to "In Progress" - ${highestSeverity} severity findings detected`
  } else if (weightedRatio >= WARNING_THRESHOLD) {
    // Medium severity or many low severity findings (≥30% weighted)
    recommendedStatus = 'in_progress'
    reason = `${openCount}/${totalRisks} risks open${severityText} - weighted ratio ${Math.round(weightedRatio * 100)}%`
    warning = `WARNING: ${openCount} open pentest finding(s) affect this control`
    recommendation = `REVIEW SUGGESTED: Consider reviewing control status due to open findings`
  } else {
    // Low severity, below threshold (<30% weighted)
    reason = `${openCount}/${totalRisks} risks open${severityText} - below threshold (${Math.round(weightedRatio * 100)}% weighted)`
    warning = `NOTICE: ${openCount} open finding(s) linked - monitor remediation progress`
    recommendation = `MONITOR: Open findings linked but below threshold - track remediation`
  }
  
  // Build advisory data to store
  const advisoryData = {
    date: new Date().toISOString(),
    currentStatus,
    recommendedStatus: recommendedStatus !== currentStatus ? recommendedStatus : null,
    recommendation,
    warning,
    openRisks: openCount,
    totalRisks,
    weightedRatio: Math.round(weightedRatio * 100),
    severityBreakdown,
    needsReview: openCount > 0 && currentStatus === 'implemented',
    topRisks: openRisks.slice(0, 3).map((r: any) => ({
      id: r.id,
      title: r.title,
      severity: r.severity
    }))
  }
  
  // ADVISORY MODE: Only update the risk_warnings field, NEVER change implementation_status
  // The GRC user must manually decide whether to change the control status
  if (currentAssessment?.id) {
    await db.prepare(`
      UPDATE control_assessments 
      SET risk_warnings = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(JSON.stringify([advisoryData]), currentAssessment.id).run()
  }
  
  // ADVISORY MODE: Never auto-update - return advisory information only
  const needsReview = openCount > 0 && (currentStatus === 'implemented' || currentStatus === 'in_progress')
  
  return {
    updated: false,  // ADVISORY MODE: Never auto-update
    newStatus: currentStatus,  // Keep current status unchanged
    previousStatus: currentStatus,
    recommendedStatus: recommendedStatus !== currentStatus ? recommendedStatus : null,
    recommendation,
    reason,
    openRisks: openCount,
    totalRisks,
    openRatio: weightedRatio,
    warning,
    needsReview,  // Flag for UI to show "Pending Review" indicator
    manualOverrideActive: manualOverride,
    riskDetails,
    severityBreakdown
  }
}

// Recalculate status for all controls linked to a specific risk
async function recalculateControlsForRisk(db: D1Database, riskId: string, orgId: string): Promise<{
  controlsUpdated: number;
  results: any[];
}> {
  // Find all controls linked to this risk
  const linkedControls = await db.prepare(`
    SELECT DISTINCT control_id FROM control_risk_mappings 
    WHERE risk_id = ? AND organization_id = ?
  `).bind(riskId, orgId).all()
  
  const results: any[] = []
  let controlsUpdated = 0
  
  for (const ctrl of (linkedControls.results || [])) {
    const result = await recalculateControlStatus(db, ctrl.control_id, orgId)
    results.push({ control_id: ctrl.control_id, ...result })
    if (result.updated) controlsUpdated++
  }
  
  return { controlsUpdated, results }
}

// Get sync statistics from Pentest Pulse
app.get('/api/sync/pentest/stats', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId') || c.req.query('org_id')
  
  try {
    const stats = await db.prepare(`
      SELECT 
        COUNT(*) as total_synced,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'mitigated' THEN 1 ELSE 0 END) as mitigated,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed,
        SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted,
        MAX(updated_at) as last_sync
      FROM risk_items 
      WHERE organization_id = ? AND risk_source = 'penetration_test'
    `).bind(orgId).first()
    
    // Get severity distribution from inherent_score
    const severityDist = await db.prepare(`
      SELECT 
        SUM(CASE WHEN inherent_score >= 80 THEN 1 ELSE 0 END) as critical,
        SUM(CASE WHEN inherent_score >= 60 AND inherent_score < 80 THEN 1 ELSE 0 END) as high,
        SUM(CASE WHEN inherent_score >= 30 AND inherent_score < 60 THEN 1 ELSE 0 END) as medium,
        SUM(CASE WHEN inherent_score < 30 THEN 1 ELSE 0 END) as low
      FROM risk_items 
      WHERE organization_id = ? AND risk_source = 'penetration_test'
    `).bind(orgId).first()
    
    return c.json({
      source: 'pentest_pulse',
      stats,
      severity_distribution: severityDist
    })
  } catch (error) {
    return c.json({ error: 'Failed to get stats', details: String(error) }, 500)
  }
})

// ============================================================================
// SMART AUTO-MAPPING: Automatically map risks to ISO 27001 controls
// ============================================================================
// This mapping follows ISO 27001:2022 control structure:
// - Organizational controls (5.x): Policy, governance, people
// - People controls (6.x): HR security, awareness  
// - Physical controls (7.x): Physical security
// - Technological controls (8.x): Technical security measures
// 
// KEY PRINCIPLE: Technical findings should map to BOTH:
// 1. Technical controls (8.x) - direct technical implementation
// 2. Organizational controls (5.x) - governance/policy gaps that allowed the issue
// ============================================================================

// ISO 27001:2022 Control Names for better user guidance
const ISO_CONTROL_NAMES: Record<string, string> = {
  // Organizational controls (5.x)
  'iso-5.1': 'Information security policies',
  'iso-5.2': 'Information security roles and responsibilities',
  'iso-5.3': 'Segregation of duties',
  'iso-5.10': 'Acceptable use of information',
  'iso-5.12': 'Classification of information',
  'iso-5.13': 'Labelling of information',
  'iso-5.15': 'Access control policy',
  'iso-5.16': 'Identity management',
  'iso-5.17': 'Authentication information',
  'iso-5.18': 'Access rights',
  'iso-5.37': 'Documented operating procedures',
  // People controls (6.x)
  'iso-6.3': 'Information security awareness and training',
  'iso-6.5': 'Responsibilities after termination',
  // Physical controls (7.x)
  'iso-7.7': 'Clear desk and clear screen',
  // Technological controls (8.x)
  'iso-8.1': 'User endpoint devices',
  'iso-8.2': 'Privileged access rights',
  'iso-8.3': 'Information access restriction',
  'iso-8.4': 'Access to source code',
  'iso-8.5': 'Secure authentication',
  'iso-8.6': 'Capacity management',
  'iso-8.7': 'Protection against malware',
  'iso-8.8': 'Management of technical vulnerabilities',
  'iso-8.9': 'Configuration management',
  'iso-8.10': 'Information deletion',
  'iso-8.11': 'Data masking',
  'iso-8.12': 'Data leakage prevention',
  'iso-8.13': 'Information backup',
  'iso-8.14': 'Redundancy of information processing facilities',
  'iso-8.15': 'Logging',
  'iso-8.16': 'Monitoring activities',
  'iso-8.17': 'Clock synchronization',
  'iso-8.18': 'Use of privileged utility programs',
  'iso-8.19': 'Installation of software on operational systems',
  'iso-8.20': 'Networks security',
  'iso-8.21': 'Security of network services',
  'iso-8.22': 'Segregation of networks',
  'iso-8.23': 'Web filtering',
  'iso-8.24': 'Use of cryptography',
  'iso-8.25': 'Secure development lifecycle',
  'iso-8.26': 'Application security requirements',
  'iso-8.27': 'Secure system architecture',
  'iso-8.28': 'Secure coding',
  'iso-8.29': 'Security testing in development',
  'iso-8.30': 'Outsourced development',
  'iso-8.31': 'Separation of environments',
  'iso-8.32': 'Change management'
}

// OWASP Top 10 to ISO 27001 Control Mapping
// Enhanced with organizational/policy controls for comprehensive coverage
const OWASP_CONTROL_MAPPING: Record<string, string[]> = {
  // A01:2021 - Broken Access Control
  // Maps to: Access control policy (5.15), Identity management (5.16), Privileged access (8.2)
  'A01': ['iso-5.15', 'iso-5.16', 'iso-5.18', 'iso-8.2', 'iso-8.3', 'iso-8.4', 'iso-8.5'],
  'broken access': ['iso-5.15', 'iso-8.2', 'iso-8.3', 'iso-8.5'],
  'idor': ['iso-5.15', 'iso-8.2', 'iso-8.3', 'iso-8.5', 'iso-8.26', 'iso-8.28'],
  'privilege': ['iso-5.3', 'iso-5.15', 'iso-5.18', 'iso-8.2', 'iso-8.3'],
  'authorization': ['iso-5.15', 'iso-5.18', 'iso-8.2', 'iso-8.3'],
  
  // A02:2021 - Cryptographic Failures
  // Maps to: Information policies (5.1), Classification (5.12), Cryptography (8.24)
  'A02': ['iso-5.1', 'iso-5.12', 'iso-8.10', 'iso-8.12', 'iso-8.24'],
  'crypto': ['iso-5.1', 'iso-8.24', 'iso-8.10'],
  'encryption': ['iso-5.1', 'iso-5.12', 'iso-8.24', 'iso-8.10', 'iso-8.12'],
  'tls': ['iso-8.20', 'iso-8.21', 'iso-8.24'],
  'ssl': ['iso-8.20', 'iso-8.21', 'iso-8.24'],
  'certificate': ['iso-8.21', 'iso-8.24'],
  'plaintext': ['iso-5.12', 'iso-8.10', 'iso-8.24'],
  'sensitive data exposure': ['iso-5.12', 'iso-8.10', 'iso-8.11', 'iso-8.12'],
  
  // A03:2021 - Injection
  // Maps to: Secure coding (8.28), Testing (8.29), Development lifecycle (8.25)
  'A03': ['iso-8.25', 'iso-8.26', 'iso-8.28', 'iso-8.29'],
  'sql injection': ['iso-8.25', 'iso-8.26', 'iso-8.28', 'iso-8.29', 'iso-8.3', 'iso-8.4'],
  'injection': ['iso-8.25', 'iso-8.26', 'iso-8.28', 'iso-8.29'],
  'xss': ['iso-8.26', 'iso-8.28', 'iso-8.29'],
  'cross-site scripting': ['iso-8.26', 'iso-8.28', 'iso-8.29'],
  'command injection': ['iso-8.26', 'iso-8.28', 'iso-8.29', 'iso-8.19'],
  'ldap injection': ['iso-8.5', 'iso-8.28'],
  
  // A04:2021 - Insecure Design
  // Maps to: Development lifecycle (8.25), Architecture (8.27), Awareness training (6.3)
  'A04': ['iso-5.1', 'iso-6.3', 'iso-8.25', 'iso-8.26', 'iso-8.27'],
  'insecure design': ['iso-5.1', 'iso-8.25', 'iso-8.26', 'iso-8.27'],
  'design flaw': ['iso-8.25', 'iso-8.27'],
  
  // A05:2021 - Security Misconfiguration  
  // CRITICAL: Default credentials indicate POLICY failures (5.1, 5.17) + Technical (8.9)
  'A05': ['iso-5.1', 'iso-5.37', 'iso-8.9', 'iso-8.19', 'iso-8.31'],
  'misconfiguration': ['iso-5.37', 'iso-8.9', 'iso-8.19', 'iso-8.31'],
  // DEFAULT PASSWORD/CREDENTIALS - Major policy gap!
  'default password': ['iso-5.1', 'iso-5.15', 'iso-5.17', 'iso-6.3', 'iso-8.5', 'iso-8.9'],
  'default credential': ['iso-5.1', 'iso-5.15', 'iso-5.17', 'iso-6.3', 'iso-8.5', 'iso-8.9'],
  'default admin': ['iso-5.1', 'iso-5.15', 'iso-5.17', 'iso-6.3', 'iso-8.2', 'iso-8.5', 'iso-8.9'],
  'admin access': ['iso-5.3', 'iso-5.15', 'iso-5.18', 'iso-8.2', 'iso-8.5'],
  'hardening': ['iso-5.37', 'iso-8.9', 'iso-8.19'],
  'default setting': ['iso-5.37', 'iso-8.9'],
  
  // A06:2021 - Vulnerable Components
  // Maps to: Vulnerability management (8.8), Software installation (8.19)
  'A06': ['iso-5.37', 'iso-8.8', 'iso-8.19', 'iso-8.30'],
  'vulnerable component': ['iso-8.8', 'iso-8.19'],
  'outdated': ['iso-8.8', 'iso-8.19'],
  'patch': ['iso-5.37', 'iso-8.8', 'iso-8.19'],
  'cve': ['iso-8.8', 'iso-8.16', 'iso-8.19'],
  
  // A07:2021 - Authentication Failures
  // CRITICAL: Policy gaps (5.1, 5.17) + Technical implementation (8.5)
  'A07': ['iso-5.1', 'iso-5.15', 'iso-5.16', 'iso-5.17', 'iso-8.2', 'iso-8.5'],
  'authentication': ['iso-5.15', 'iso-5.16', 'iso-5.17', 'iso-8.5'],
  'password': ['iso-5.17', 'iso-8.5'],
  'weak password': ['iso-5.1', 'iso-5.17', 'iso-6.3', 'iso-8.5'],
  'brute force': ['iso-5.17', 'iso-8.5', 'iso-8.16'],
  'session': ['iso-5.16', 'iso-8.5'],
  'session fixation': ['iso-5.16', 'iso-8.5', 'iso-8.26'],
  'login': ['iso-5.16', 'iso-5.17', 'iso-8.5'],
  'mfa': ['iso-5.17', 'iso-8.5'],
  'multi-factor': ['iso-5.17', 'iso-8.5'],
  
  // A08:2021 - Software and Data Integrity
  'A08': ['iso-8.25', 'iso-8.28', 'iso-8.32'],
  'integrity': ['iso-8.25', 'iso-8.28', 'iso-8.32'],
  'deserialization': ['iso-8.26', 'iso-8.28'],
  
  // A09:2021 - Security Logging and Monitoring
  // Maps to: Logging (8.15), Monitoring (8.16), Time sync (8.17)
  'A09': ['iso-5.37', 'iso-8.15', 'iso-8.16', 'iso-8.17'],
  'logging': ['iso-8.15', 'iso-8.16', 'iso-8.17'],
  'monitoring': ['iso-8.15', 'iso-8.16'],
  'audit trail': ['iso-8.15', 'iso-8.16'],
  
  // A10:2021 - Server-Side Request Forgery
  'A10': ['iso-8.23', 'iso-8.26', 'iso-8.28'],
  'ssrf': ['iso-8.23', 'iso-8.26', 'iso-8.28'],
  
  // Additional common vulnerabilities
  'information disclosure': ['iso-5.12', 'iso-8.10', 'iso-8.12'],
  'sensitive data': ['iso-5.12', 'iso-8.10', 'iso-8.11', 'iso-8.12'],
  'api': ['iso-8.5', 'iso-8.26', 'iso-8.28'],
  'file upload': ['iso-8.10', 'iso-8.26', 'iso-8.28'],
  'directory traversal': ['iso-8.3', 'iso-8.28'],
  'path traversal': ['iso-8.3', 'iso-8.28'],
  'csrf': ['iso-8.5', 'iso-8.28'],
  'clickjacking': ['iso-8.9', 'iso-8.28'],
  'cors': ['iso-8.9', 'iso-8.28'],
  'header': ['iso-8.9', 'iso-8.28'],
  'security header': ['iso-8.9'],
  'missing header': ['iso-8.9'],
  'cookie': ['iso-8.5', 'iso-8.9'],
  'backup': ['iso-8.10', 'iso-8.13'],
  'phpinfo': ['iso-8.9', 'iso-8.12'],
  'debug': ['iso-8.9', 'iso-8.31'],
  'error': ['iso-8.9', 'iso-8.12'],
  'stack trace': ['iso-8.9', 'iso-8.12'],
  'network': ['iso-8.20', 'iso-8.21', 'iso-8.22'],
  'firewall': ['iso-8.20', 'iso-8.22']
}

// Get control name from ID
function getControlName(controlId: string): string {
  return ISO_CONTROL_NAMES[controlId] || controlId
}

// Smart auto-mapping function
async function smartAutoMapRiskToControls(
  db: D1Database, 
  riskId: string, 
  orgId: string, 
  riskTitle: string, 
  riskDescription: string | null,
  owaspCategory: string | null,
  technicalDetails: any
): Promise<{ mappingsCreated: number; controls: string[] }> {
  const matchedControls = new Set<string>()
  const searchText = `${riskTitle} ${riskDescription || ''} ${owaspCategory || ''}`.toLowerCase()
  
  // 1. Match by OWASP category (e.g., A01:2021, A03:2021)
  if (owaspCategory) {
    const owaspCode = owaspCategory.match(/A\d{2}/)?.[0]
    if (owaspCode && OWASP_CONTROL_MAPPING[owaspCode]) {
      OWASP_CONTROL_MAPPING[owaspCode].forEach(c => matchedControls.add(c))
    }
  }
  
  // 2. Match by keywords in title and description
  for (const [keyword, controls] of Object.entries(OWASP_CONTROL_MAPPING)) {
    if (searchText.includes(keyword.toLowerCase())) {
      controls.forEach(c => matchedControls.add(c))
    }
  }
  
  // 3. If no matches found, use general vulnerability controls
  if (matchedControls.size === 0) {
    // Default controls for unknown vulnerabilities
    ['iso-8.28', 'iso-8.29', 'iso-8.26'].forEach(c => matchedControls.add(c))
  }
  
  // 4. Create mappings for matched controls
  let mappingsCreated = 0
  const controlsList: string[] = []
  
  for (const controlId of matchedControls) {
    try {
      // Check if mapping already exists
      const existing = await db.prepare(`
        SELECT id FROM control_risk_mappings 
        WHERE control_id = ? AND risk_id = ? AND organization_id = ?
      `).bind(controlId, riskId, orgId).first()
      
      if (!existing) {
        const mappingId = `crm-auto-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`
        
        await db.prepare(`
          INSERT INTO control_risk_mappings 
          (id, organization_id, control_id, risk_id, mapping_type, effectiveness, confidence_score, is_auto_suggested, notes, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'mitigates', 'partial', 85, 1, 'Auto-mapped based on vulnerability analysis', datetime('now'), datetime('now'))
        `).bind(mappingId, orgId, controlId, riskId).run()
        
        mappingsCreated++
        controlsList.push(controlId)
        
        // Recalculate control status after creating mapping
        await recalculateControlStatus(db, controlId, orgId)
      }
    } catch (err) {
      console.error(`Failed to create mapping for ${controlId}:`, err)
    }
  }
  
  return { mappingsCreated, controls: controlsList }
}

// ============================================================================
// PENTEST PULSE PULL SYNC (GRC Pulse fetches from Pentest Pulse)
// ============================================================================

const PENTEST_PULSE_CONFIG = {
  baseUrl: 'https://pentest-pulse.pages.dev',
  apiKey: 'grcpulse-sync-2024',  // Must match X-Sync-Key expected by PentestPulse
  timeout: 15000
}

// Pull all findings from Pentest Pulse and sync to GRC Pulse
app.post('/api/sync/pentest/pull', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId') || c.req.query('org_id')
  
  // Debug: Log the orgId being used
  console.log('Sync PentestPulse - Organization ID:', orgId)
  
  if (!orgId) {
    return c.json({ error: 'Organization ID not found in session', code: 'NO_ORG_ID' }, 400)
  }
  
  try {
    // Fetch findings from Pentest Pulse
    const pentestUrl = `${PENTEST_PULSE_CONFIG.baseUrl}/api/external/findings?org_id=${orgId}`
    console.log('Fetching from PentestPulse:', pentestUrl)
    
    const response = await fetch(pentestUrl, {
      method: 'GET',
      headers: {
        'X-Sync-Key': PENTEST_PULSE_CONFIG.apiKey,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(PENTEST_PULSE_CONFIG.timeout)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      return c.json({ error: 'Failed to fetch from Pentest Pulse', details: errorText }, 502)
    }
    
    const data = await response.json() as { success: boolean; count: number; findings: any[] }
    
    if (!data.success || !data.findings) {
      return c.json({ error: 'Invalid response from Pentest Pulse', data }, 502)
    }
    
    const results = {
      total: data.count,
      created: 0,
      updated: 0,
      deleted: 0,
      errors: [] as string[]
    }
    
    // Get existing pentest risks to detect deletions
    const existingRisks = await db.prepare(`
      SELECT id, external_reference FROM risk_items 
      WHERE organization_id = ? AND risk_source = 'penetration_test'
    `).bind(orgId).all()
    
    const existingRefs = new Set((existingRisks.results || []).map((r: any) => {
      // Extract source_ref from external_reference
      const match = r.external_reference?.match(/pentest:([^|]+)/)
      return match ? match[1] : null
    }).filter(Boolean))
    
    const syncedRefs = new Set<string>()
    
    // Process each finding from Pentest Pulse
    for (const finding of data.findings) {
      try {
        syncedRefs.add(finding.source_ref)
        
        // Check if risk already exists
        const existing = await db.prepare(`
          SELECT id FROM risk_items 
          WHERE risk_source = 'penetration_test' 
          AND external_reference LIKE ?
        `).bind(`%${finding.source_ref}%`).first()
        
        // Store pentest-specific data in ai_analysis for display alignment
        const pentestData = {
          source: 'pentest_pulse',
          risk_score: Math.round((finding.inherent_likelihood || 3) * (finding.inherent_impact || 3)),
          likelihood: finding.inherent_likelihood || 3,
          impact: finding.inherent_impact || 3,
          severity: finding.severity || 'medium',
          technical_details: finding.technical_details ? JSON.parse(finding.technical_details) : {}
        }

        // Normalise to GRC's 0-100 scale. Prefer the pentest severity label
        // (critical=95, high=75, medium=50, low=25); only fall back to the raw
        // inherent_score if it already looks like a 0-100 value (>25).
        const severityToScoreIn: Record<string, number> = {
          'critical': 95, 'high': 75, 'medium': 50, 'low': 25, 'informational': 10
        }
        const sevIn = (finding.pentest_severity || finding.severity || '').toLowerCase()
        const normalizedScore = severityToScoreIn[sevIn]
          ?? (finding.inherent_score > 25 ? finding.inherent_score : 50)
        
        if (existing) {
          // UPDATE existing risk
          await db.prepare(`
            UPDATE risk_items SET
              title = ?,
              description = ?,
              category = ?,
              subcategory = ?,
              inherent_likelihood = ?,
              inherent_impact = ?,
              inherent_score = ?,
              status = ?,
              remediation_plan = ?,
              due_date = ?,
              ai_analysis = ?,
              last_assessed_at = datetime('now'),
              updated_at = datetime('now')
            WHERE id = ?
          `).bind(
            finding.title,
            finding.description || null,
            finding.risk_category || 'vulnerability',
            finding.subcategory || null,
            (finding.inherent_likelihood || 3) / 5, // Normalize to 0-1
            (finding.inherent_impact || 3) / 5,
            normalizedScore,
            mapPentestStatus(finding.status),
            finding.remediation_plan || null,
            finding.due_date || null,
            JSON.stringify(pentestData),
            existing.id
          ).run()
          
          results.updated++
        } else {
          // INSERT new risk
          const newId = generateId('risk-pt')
          
          await db.prepare(`
            INSERT INTO risk_items (
              id, organization_id, title, description, category, subcategory,
              risk_source, external_reference, inherent_likelihood, inherent_impact, inherent_score,
              status, remediation_plan, due_date, ai_analysis, discovered_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'penetration_test', ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
          `).bind(
            newId,
            orgId,
            finding.title,
            finding.description || null,
            finding.risk_category || 'vulnerability',
            finding.subcategory || null,
            finding.external_reference,
            (finding.inherent_likelihood || 3) / 5,
            (finding.inherent_impact || 3) / 5,
            normalizedScore,
            mapPentestStatus(finding.status),
            finding.remediation_plan || null,
            finding.due_date || null,
            JSON.stringify(pentestData)
          ).run()
          
          results.created++
          
          // SMART AUTO-MAPPING: Automatically map new risk to relevant controls
          const autoMapResult = await smartAutoMapRiskToControls(
            db,
            newId,
            orgId,
            finding.title,
            finding.description,
            finding.subcategory, // OWASP category
            pentestData.technical_details
          )
          
          if (autoMapResult.mappingsCreated > 0) {
            (results as any).auto_mappings_created = ((results as any).auto_mappings_created || 0) + autoMapResult.mappingsCreated
          }
          
          // AUTO-SYNC: Recalculate linked controls for new risk
          await recalculateControlsForRisk(db, newId, orgId)
        }
      } catch (err) {
        results.errors.push(`${finding.source_ref}: ${String(err)}`)
      }
    }
    
    // AUTO-SYNC: Recalculate all controls linked to updated risks
    for (const finding of data.findings) {
      const existingRisk = await db.prepare(`
        SELECT id FROM risk_items 
        WHERE risk_source = 'penetration_test' 
        AND external_reference LIKE ?
        AND organization_id = ?
      `).bind(`%${finding.source_ref}%`, orgId).first()
      
      if (existingRisk) {
        const controlSync = await recalculateControlsForRisk(db, existingRisk.id as string, orgId)
        if (controlSync.controlsUpdated > 0) {
          (results as any).controls_synced = ((results as any).controls_synced || 0) + controlSync.controlsUpdated
        }
      }
    }
    
    // Delete risks that no longer exist in Pentest Pulse (CASCADE to control_risk_mappings)
    let deletedMappings = 0
    for (const existingRef of existingRefs) {
      if (!syncedRefs.has(existingRef as string)) {
        try {
          // First find the risk ID(s) to delete
          const risksToDelete = await db.prepare(`
            SELECT id FROM risk_items 
            WHERE risk_source = 'penetration_test' 
            AND external_reference LIKE ?
          `).bind(`%${existingRef}%`).all()
          
          for (const r of (risksToDelete.results || [])) {
            // Delete associated control_risk_mappings first
            const mappingResult = await db.prepare(`
              DELETE FROM control_risk_mappings WHERE risk_id = ?
            `).bind(r.id).run()
            deletedMappings += mappingResult.meta?.changes || 0
            
            // Then delete the risk
            await db.prepare(`DELETE FROM risk_items WHERE id = ?`).bind(r.id).run()
            results.deleted++
          }
        } catch (err) {
          results.errors.push(`delete ${existingRef}: ${String(err)}`)
        }
      }
    }
    
    // Add deleted mappings count to results
    ;(results as any).deleted_mappings = deletedMappings
    
    return c.json({
      success: true,
      message: 'Sync completed',
      organization_id: orgId,  // Include orgId for debugging
      results,
      synced_at: new Date().toISOString()
    })
  } catch (error) {
    console.error('Sync error:', error)
    return c.json({ error: 'Pull sync failed', details: String(error), organization_id: orgId }, 500)
  }
})

// Pull Assets from PentestPulse
app.post('/api/sync/pentest/assets', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId') || c.req.query('org_id')
  
  console.log('Sync PentestPulse Assets - Organization ID:', orgId)
  
  if (!orgId) {
    return c.json({ error: 'Organization ID not found in session', code: 'NO_ORG_ID' }, 400)
  }
  
  try {
    // Fetch assets from Pentest Pulse
    const pentestUrl = `${PENTEST_PULSE_CONFIG.baseUrl}/api/external/assets?org_id=${orgId}`
    console.log('Fetching assets from PentestPulse:', pentestUrl)
    
    const response = await fetch(pentestUrl, {
      method: 'GET',
      headers: {
        'X-Sync-Key': PENTEST_PULSE_CONFIG.apiKey,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(PENTEST_PULSE_CONFIG.timeout)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      return c.json({ error: 'Failed to fetch assets from Pentest Pulse', details: errorText }, 502)
    }
    
    const data = await response.json() as { success: boolean; count: number; assets: any[] }
    
    if (!data.success || !data.assets) {
      return c.json({ error: 'Invalid response from Pentest Pulse', data }, 502)
    }
    
    const results = {
      total: data.count,
      created: 0,
      updated: 0,
      deleted: 0,
      errors: [] as string[]
    }
    
    // Get existing pentest assets to detect deletions
    const existingAssets = await db.prepare(`
      SELECT id, external_id FROM assets 
      WHERE organization_id = ? AND external_id LIKE 'pentest:asset:%'
    `).bind(orgId).all()
    
    const existingRefs = new Set((existingAssets.results || []).map((a: any) => {
      const match = a.external_id?.match(/pentest:asset:([^|]+)/)
      return match ? match[1] : null
    }).filter(Boolean))
    
    const syncedRefs = new Set<string>()
    
    // Map Pentest Pulse asset type to GRCpulse asset_type
    const typeMap: Record<string, string> = {
      'server': 'server',
      'database': 'database',
      'application': 'application',
      'web_application': 'application',
      'api': 'application',
      'mobile_app': 'application',
      'network_device': 'network_device',
      'endpoint': 'endpoint',
      'cloud_service': 'serverless',
      'data_store': 'storage'
    }
    
    // Map cloud provider
    const cloudMap: Record<string, string> = {
      'aws': 'aws',
      'azure': 'azure',
      'gcp': 'gcp',
      'on-premise': 'on_premise',
      'hybrid': 'hybrid'
    }
    
    // Process each asset from Pentest Pulse
    for (const asset of data.assets) {
      try {
        syncedRefs.add(asset.source_ref)
        
        // Check if asset already exists
        const existing = await db.prepare(`
          SELECT id FROM assets 
          WHERE external_id LIKE ?
        `).bind(`%${asset.source_ref}%`).first()
        
        // Prepare tags with risk info
        const riskTags = []
        if (asset.critical_findings > 0) riskTags.push(`${asset.critical_findings} critical`)
        if (asset.high_findings > 0) riskTags.push(`${asset.high_findings} high`)
        const tagsWithRisk = riskTags.length > 0 
          ? JSON.stringify([`pentest_risk: ${riskTags.join(', ')}`])
          : asset.tags || '[]'
        
        if (existing) {
          // UPDATE existing asset
          await db.prepare(`
            UPDATE assets SET
              name = ?,
              description = ?,
              asset_type = ?,
              cloud_provider = ?,
              criticality = ?,
              data_classification = ?,
              ip_address = ?,
              hostname = ?,
              owner_team = ?,
              tags = ?,
              status = ?,
              updated_at = datetime('now')
            WHERE id = ?
          `).bind(
            asset.name,
            asset.description || null,
            typeMap[asset.type] || 'other',
            cloudMap[asset.cloud_provider] || null,
            asset.criticality || 'medium',
            asset.data_classification || 'internal',
            asset.ip_address || null,
            asset.hostname || null,
            asset.business_unit || null,
            tagsWithRisk,
            asset.status || 'active',
            existing.id
          ).run()
          results.updated++
        } else {
          // INSERT new asset
          const newId = `asset-pt-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`
          await db.prepare(`
            INSERT INTO assets (
              id, organization_id, external_id, name, description, asset_type,
              cloud_provider, criticality, data_classification, ip_address, hostname,
              owner_team, tags, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
          `).bind(
            newId,
            orgId,
            asset.external_reference,
            asset.name,
            asset.description || null,
            typeMap[asset.type] || 'other',
            cloudMap[asset.cloud_provider] || null,
            asset.criticality || 'medium',
            asset.data_classification || 'internal',
            asset.ip_address || null,
            asset.hostname || null,
            asset.business_unit || null,
            tagsWithRisk,
            asset.status || 'active'
          ).run()
          results.created++
        }
      } catch (err) {
        results.errors.push(`${asset.source_ref}: ${String(err)}`)
      }
    }
    
    // Delete assets that no longer exist in Pentest Pulse
    for (const existingRef of existingRefs) {
      if (!syncedRefs.has(existingRef as string)) {
        try {
          await db.prepare(`
            DELETE FROM assets WHERE external_id LIKE ?
          `).bind(`%${existingRef}%`).run()
          results.deleted++
        } catch (err) {
          results.errors.push(`delete ${existingRef}: ${String(err)}`)
        }
      }
    }
    
    return c.json({
      success: true,
      message: 'Asset sync completed',
      organization_id: orgId,
      results,
      synced_at: new Date().toISOString()
    })
  } catch (error) {
    console.error('Asset sync error:', error)
    return c.json({ error: 'Asset sync failed', details: String(error), organization_id: orgId }, 500)
  }
})

// ============================================================================
// COMPLIANCE ENGINE API ENDPOINTS
// ============================================================================

// Get Compliance Dashboard Data
app.get('/api/compliance/dashboard', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId') || c.req.query('org_id')
  const mode = c.req.query('mode') || 'basic' // 'basic' or 'advanced'
  
  try {
    // Get all frameworks with applicability info
    const frameworks = await db.prepare(`
      SELECT 
        cf.*,
        fa.is_applicable,
        fa.applicability_reason,
        fa.priority as applicability_priority,
        fa.target_score,
        fa.target_date
      FROM compliance_frameworks_v2 cf
      LEFT JOIN framework_applicability fa ON cf.id = fa.framework_id AND fa.organization_id = ?
      WHERE cf.is_active = 1 
      ORDER BY cf.is_core_framework DESC, COALESCE(fa.priority, 99), cf.name
    `).bind(orgId).all()
    
    // Get ISO 27001 controls and assessments
    const assessments = await db.prepare(`
      SELECT 
        cl.id, cl.control_id, cl.title, cl.category, cl.subcategory, cl.is_critical, cl.weight,
        ca.implementation_status, ca.maturity_level
      FROM control_library cl
      LEFT JOIN control_assessments ca ON cl.id = ca.control_library_id AND ca.organization_id = ?
      WHERE cl.framework_id = 'fw-iso27001'
      ORDER BY cl.control_number
    `).bind(orgId).all()
    
    const controls = assessments.results || []
    
    // Get control mappings from ISO to other frameworks
    const mappings = await db.prepare(`
      SELECT source_control_id, target_framework_id, target_control_id, mapping_type, mapping_strength
      FROM control_mappings
      WHERE source_framework_id = 'fw-iso27001'
    `).all()
    const mappingData = mappings.results || []
    
    // Build a map of ISO control status for quick lookup
    const isoStatusMap = new Map()
    controls.forEach(c => {
      isoStatusMap.set(c.id, {
        status: c.implementation_status,
        maturity: c.maturity_level || 0,
        is_critical: c.is_critical,
        weight: c.weight || 1.0
      })
    })
    
    // Helper function to calculate Basic score (simple count)
    const calculateBasicScore = (controlList: any[]) => {
      const implemented = controlList.filter(c => c.implementation_status === 'implemented').length
      const applicable = controlList.filter(c => c.implementation_status !== 'not_applicable').length
      return {
        score: applicable > 0 ? Math.round(implemented / applicable * 100) : 0,
        implemented,
        total: controlList.length,
        inProgress: controlList.filter(c => c.implementation_status === 'in_progress').length
      }
    }
    
    // Helper function to calculate Advanced score (stricter than basic)
    // Advanced score is always <= Basic score because:
    // - Implemented controls get reduced credit based on maturity (60-100%)
    // - In-progress controls get small credit (30%) instead of 0
    const calculateAdvancedScore = (controlList: any[]) => {
      let advancedCredit = 0
      let totalApplicable = 0
      let criticalImplemented = 0
      let criticalTotal = 0
      let maturitySum = 0
      let maturityCount = 0
      
      controlList.forEach(c => {
        if (c.implementation_status === 'not_applicable') return
        
        totalApplicable++
        
        // Track critical controls separately
        if (c.is_critical) {
          criticalTotal++
          if (c.implementation_status === 'implemented') criticalImplemented++
        }
        
        if (c.implementation_status === 'implemented') {
          // Maturity reduces credit: Level 0 = 60%, Level 5 = 100%
          const maturityFactor = 0.6 + ((c.maturity_level || 0) / 5) * 0.4
          advancedCredit += maturityFactor
        } else if (c.implementation_status === 'in_progress') {
          // In-progress gets 30% credit
          advancedCredit += 0.3
        }
        // Not started = 0 credit
        
        if (c.maturity_level) {
          maturitySum += c.maturity_level
          maturityCount++
        }
      })
      
      const avgMaturity = maturityCount > 0 ? (maturitySum / maturityCount).toFixed(1) : '0.0'
      const criticalScore = criticalTotal > 0 ? Math.round(criticalImplemented / criticalTotal * 100) : 100
      
      return {
        score: totalApplicable > 0 ? Math.round((advancedCredit / totalApplicable) * 100) : 0,
        criticalScore,
        criticalImplemented,
        criticalTotal,
        avgMaturity: parseFloat(avgMaturity),
        inProgress: controlList.filter(c => c.implementation_status === 'in_progress').length
      }
    }
    
    // Calculate framework scores based on mappings
    const frameworkData = (frameworks.results || []).map(fw => {
      // Use is_applicable from database (default to true if not set)
      const isApplicable = fw.is_applicable !== 0 && fw.is_applicable !== false
      
      if (fw.id === 'fw-iso27001') {
        const basicScore = calculateBasicScore(controls)
        const advancedScore = calculateAdvancedScore(controls)
        
        return { 
          ...fw, 
          score: mode === 'advanced' ? advancedScore.score : basicScore.score,
          basicScore: basicScore.score,
          advancedScore: advancedScore.score,
          implemented: basicScore.implemented,
          inProgress: basicScore.inProgress,
          total: controls.length, 
          is_applicable: true,
          // Advanced details
          criticalScore: advancedScore.criticalScore,
          criticalImplemented: advancedScore.criticalImplemented,
          criticalTotal: advancedScore.criticalTotal,
          avgMaturity: advancedScore.avgMaturity
        }
      }
      
      // If framework is not applicable, return with N/A status
      if (!isApplicable) {
        return { 
          ...fw, 
          score: null, 
          basicScore: null,
          advancedScore: null,
          implemented: 0, 
          total: fw.total_controls || 0, 
          is_applicable: false,
          mappings_count: 0 
        }
      }
      
      // Calculate score for other frameworks based on ISO mappings
      const fwMappings = mappingData.filter(m => m.target_framework_id === fw.id)
      if (fwMappings.length === 0) {
        return { ...fw, score: 0, basicScore: 0, advancedScore: 0, implemented: 0, total: fw.total_controls || 0, is_applicable: isApplicable }
      }
      
      // Calculate scores for mapped frameworks
      let basicImplemented = 0
      let advancedImplemented = 0
      let totalMapped = fwMappings.length
      
      fwMappings.forEach(mapping => {
        const isoControl = isoStatusMap.get(mapping.source_control_id)
        const strength = mapping.mapping_strength || 1.0
        const mappingWeight = mapping.mapping_type === 'equivalent' ? 1.0 : 0.5
        const baseCredit = strength * mappingWeight
        
        if (isoControl) {
          if (isoControl.status === 'implemented') {
            // Basic score - full credit for implemented
            basicImplemented += baseCredit
            
            // Advanced score - maturity reduces credit
            // Level 0-1: 60% credit, Level 2-3: 70-80%, Level 4-5: 90-100%
            const maturityFactor = 0.6 + ((isoControl.maturity || 0) / 5) * 0.4
            advancedImplemented += baseCredit * maturityFactor
          } else if (isoControl.status === 'in_progress') {
            // Basic: no credit for in-progress
            // Advanced: 30% credit for in-progress (partial work)
            advancedImplemented += baseCredit * 0.3
          }
          // Not implemented = 0 credit for both
        }
      })
      
      const basicScoreVal = totalMapped > 0 ? Math.round((basicImplemented / totalMapped) * 100) : 0
      const advancedScoreVal = totalMapped > 0 ? Math.round((advancedImplemented / totalMapped) * 100) : 0
      
      return { 
        ...fw, 
        score: mode === 'advanced' ? advancedScoreVal : basicScoreVal,
        basicScore: basicScoreVal,
        advancedScore: advancedScoreVal,
        implemented: Math.round(basicImplemented), 
        total: fw.total_controls || 0, 
        mappings_count: totalMapped, 
        is_applicable: isApplicable 
      }
    })
    
    // Calculate domain scores
    const domains = ['Organizational', 'People', 'Physical', 'Technological']
    const domainMeta = {
      'Organizational': { icon: 'fa-building', color: '#3b82f6' },
      'People': { icon: 'fa-users', color: '#10b981' },
      'Physical': { icon: 'fa-door-closed', color: '#f59e0b' },
      'Technological': { icon: 'fa-microchip', color: '#8b5cf6' }
    }
    
    const domainScores = domains.map(domain => {
      const domainControls = controls.filter(c => c.category === domain)
      const basicScore = calculateBasicScore(domainControls)
      const advancedScore = calculateAdvancedScore(domainControls)
      
      return {
        name: domain,
        ...domainMeta[domain],
        score: mode === 'advanced' ? advancedScore.score : basicScore.score,
        basicScore: basicScore.score,
        advancedScore: advancedScore.score,
        implemented: basicScore.implemented,
        inProgress: basicScore.inProgress,
        total: domainControls.length,
        criticalScore: advancedScore.criticalScore,
        avgMaturity: advancedScore.avgMaturity
      }
    })
    
    // Calculate maturity distribution
    const maturityDistribution: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    controls.forEach(c => {
      const level = c.maturity_level || 0
      maturityDistribution[level]++
    })
    
    // Get top gaps (not implemented critical controls)
    const topGaps = controls
      .filter(c => c.implementation_status !== 'implemented' && c.implementation_status !== 'not_applicable')
      .sort((a, b) => (b.is_critical ? 1 : 0) - (a.is_critical ? 1 : 0) || (b.weight || 1) - (a.weight || 1))
      .slice(0, 10)
    
    // Calculate overall advanced metrics
    const overallAdvanced = calculateAdvancedScore(controls)
    
    // ============================================================================
    // RISK PENALTY CALCULATION (GRC Best Practice Model)
    // 
    // Severity-based penalties:
    // - Critical risks (inherent_score > 60): -2 points per risk
    // - High risks (inherent_score 40-60): -1 point per risk
    // - Medium risks (inherent_score 20-40): Tiered penalty based on accumulation
    //     * 1-2 medium risks: 0 points (acceptable operational risk)
    //     * 3-5 medium risks: -1 point (attention needed)
    //     * 6-9 medium risks: -2 points (action required)
    //     * 10+ medium risks: -3 points (systemic issue)
    // - Low risks (inherent_score < 20): 0 points (accept/monitor)
    //
    // Max penalty capped at 25 points
    // ============================================================================
    
    // Query ALL active risks (including medium severity)
    const activeRisks = await db.prepare(`
      SELECT 
        id, title, inherent_score, risk_source, status
      FROM risk_items 
      WHERE organization_id = ? 
        AND status IN ('open', 'in_progress')
      ORDER BY inherent_score DESC
    `).bind(orgId).all()
    
    const riskList = activeRisks.results || []

    // CANONICAL deduction (same helper the Main Dashboard uses) — per-open-risk
    // points (Critical 5, High 3, Medium 1, Low 0.5), in_progress at half,
    // capped at 40. This replaces the old tiered ±1/±2 model so the score
    // actually moves when a finding is opened/closed.
    const deductionResult = computeRiskDeduction(riskList)
    const criticalRiskCount = deductionResult.counts.critical
    const highRiskCount = deductionResult.counts.high
    const mediumRiskCount = deductionResult.counts.medium
    const criticalPenalty = deductionResult.byPoints.critical
    const highPenalty = deductionResult.byPoints.high
    const mediumPenalty = deductionResult.byPoints.medium

    // Per-source breakdown (for the UI's "by source" panel).
    const risksBySource: Record<string, { count: number, penalty: number, critical: number, high: number, medium: number }> = {
      'penetration_test': { count: 0, penalty: 0, critical: 0, high: 0, medium: 0 },
      'audit_finding': { count: 0, penalty: 0, critical: 0, high: 0, medium: 0 },
      'self_assessment': { count: 0, penalty: 0, critical: 0, high: 0, medium: 0 },
      'vendor_risk': { count: 0, penalty: 0, critical: 0, high: 0, medium: 0 },
      'compliance_gap': { count: 0, penalty: 0, critical: 0, high: 0, medium: 0 },
      'other': { count: 0, penalty: 0, critical: 0, high: 0, medium: 0 }
    }
    riskList.forEach((risk: any) => {
      const source = risksBySource[risk.risk_source] ? risk.risk_source : 'other'
      const status = (risk.status || '').toLowerCase()
      if (status !== 'open' && status !== 'in_progress') return
      const severity = getSeverityFromScore(risk.inherent_score || 0)
      const base = RISK_DEDUCTION_POINTS[severity] ?? 0
      const points = status === 'in_progress' ? base / 2 : base
      risksBySource[source].count++
      risksBySource[source].penalty += points
      if (severity === 'critical') risksBySource[source].critical++
      else if (severity === 'high') risksBySource[source].high++
      else if (severity === 'medium') risksBySource[source].medium++
    })

    // Total penalty (already capped by the helper).
    const riskPenalty = deductionResult.rawDeduction
    const cappedPenalty = deductionResult.deduction
    
    // Apply penalty to all framework scores
    const adjustedFrameworkData = frameworkData.map(fw => {
      if (fw.score === null) return fw // Skip non-applicable frameworks
      return {
        ...fw,
        score: Math.max(0, fw.score - cappedPenalty),
        basicScore: Math.max(0, fw.basicScore - cappedPenalty),
        advancedScore: Math.max(0, fw.advancedScore - cappedPenalty),
        riskAdjusted: cappedPenalty > 0 // Flag that score was adjusted
      }
    })
    
    // Apply penalty to domain scores
    const adjustedDomainScores = domainScores.map(domain => ({
      ...domain,
      score: Math.max(0, domain.score - cappedPenalty),
      basicScore: Math.max(0, domain.basicScore - cappedPenalty),
      advancedScore: Math.max(0, domain.advancedScore - cappedPenalty)
    }))
    
    return c.json({
      mode,
      frameworks: adjustedFrameworkData,
      domainScores: adjustedDomainScores,
      maturityDistribution,
      topGaps,
      totalControls: controls.length,
      // Advanced metrics summary
      advancedMetrics: {
        overallScore: Math.max(0, overallAdvanced.score - cappedPenalty),
        criticalScore: overallAdvanced.criticalScore,
        criticalImplemented: overallAdvanced.criticalImplemented,
        criticalTotal: overallAdvanced.criticalTotal,
        avgMaturity: overallAdvanced.avgMaturity,
        inProgress: overallAdvanced.inProgress
      },
      // Risk penalty details - feeds from ALL risk sources
      riskPenalty: {
        applied: cappedPenalty > 0,
        totalPenalty: cappedPenalty,
        uncappedPenalty: riskPenalty,
        criticalRisks: criticalRiskCount,
        highRisks: highRiskCount,
        mediumRisks: mediumRiskCount,
        criticalPenalty: criticalPenalty,
        highPenalty: highPenalty,
        mediumPenalty: mediumPenalty,
        // Medium risk tier explanation
        mediumTier: mediumRiskCount >= 10 ? 'systemic' : mediumRiskCount >= 6 ? 'action_required' : mediumRiskCount >= 3 ? 'attention_needed' : 'acceptable',
        totalActiveRisks: riskList.length,
        isCapped: riskPenalty > 25,
        // Breakdown by risk source for live feed visibility
        bySource: {
          pentest: risksBySource['penetration_test'],
          audit: risksBySource['audit_finding'],
          selfAssessment: risksBySource['self_assessment'],
          vendor: risksBySource['vendor_risk'],
          compliance: risksBySource['compliance_gap'],
          other: risksBySource['other']
        },
        message: cappedPenalty > 0 
          ? `Score reduced by ${cappedPenalty} points from ${riskList.length} active risks${riskPenalty > 20 ? ' (capped at 20)' : ''}`
          : null
      }
    })
  } catch (error) {
    console.error('Compliance dashboard error:', error)
    return c.json({ error: 'Failed to load compliance dashboard', details: String(error) }, 500)
  }
})

// ============================================================================
// COMPLIANCE TREND CHARTS API
// ============================================================================

// Helper function to create auto-snapshot (used by trends and assessment endpoints)
async function createAutoSnapshot(db: D1Database, orgId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0]
  
  // Check if we already have a snapshot for today
  const existingSnapshot = await db.prepare(`
    SELECT id FROM compliance_snapshots 
    WHERE organization_id = ? AND snapshot_date = ? AND framework_id = 'fw-iso27001'
  `).bind(orgId, today).first()
  
  if (existingSnapshot) return // Already have today's snapshot
  
  // Get current compliance data
  const assessments = await db.prepare(`
    SELECT 
      cl.id, cl.category, cl.is_critical,
      ca.implementation_status, ca.maturity_level
    FROM control_library cl
    LEFT JOIN control_assessments ca ON cl.id = ca.control_library_id AND ca.organization_id = ?
    WHERE cl.framework_id = 'fw-iso27001'
  `).bind(orgId).all()
  
  const controls = assessments.results || []
  
  // Calculate scores
  let implemented = 0, inProgress = 0, notStarted = 0, notApplicable = 0
  let advancedCredit = 0, maturitySum = 0, maturityCount = 0
  let criticalImpl = 0, criticalTotal = 0
  
  controls.forEach((c: any) => {
    if (c.implementation_status === 'not_applicable') { notApplicable++; return }
    if (c.is_critical) { criticalTotal++; if (c.implementation_status === 'implemented') criticalImpl++ }
    
    if (c.implementation_status === 'implemented') {
      implemented++
      const maturityFactor = 0.6 + ((c.maturity_level || 0) / 5) * 0.4
      advancedCredit += maturityFactor
      if (c.maturity_level) { maturitySum += c.maturity_level; maturityCount++ }
    } else if (c.implementation_status === 'in_progress') {
      inProgress++
      advancedCredit += 0.3
    } else {
      notStarted++
    }
  })
  
  const applicable = controls.length - notApplicable
  const basicScore = applicable > 0 ? Math.round((implemented / applicable) * 100) : 0
  const advancedScore = applicable > 0 ? Math.round((advancedCredit / applicable) * 100) : 0
  const avgMaturity = maturityCount > 0 ? parseFloat((maturitySum / maturityCount).toFixed(1)) : 0
  const criticalScore = criticalTotal > 0 ? Math.round((criticalImpl / criticalTotal) * 100) : 100
  
  // Insert compliance snapshot
  await db.prepare(`
    INSERT OR REPLACE INTO compliance_snapshots 
    (id, organization_id, framework_id, snapshot_date, basic_score, advanced_score, 
     implemented_count, in_progress_count, not_started_count, not_applicable_count,
     total_controls, avg_maturity, critical_score)
    VALUES (?, ?, 'fw-iso27001', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    `snap-auto-${Date.now().toString(36)}`, orgId, today, basicScore, advancedScore,
    implemented, inProgress, notStarted, notApplicable,
    controls.length, avgMaturity, criticalScore
  ).run()
  
  // Insert domain snapshots
  const domains = ['Organizational', 'People', 'Physical', 'Technological']
  for (const domain of domains) {
    const domainControls = controls.filter((c: any) => c.category === domain)
    const domainImpl = domainControls.filter((c: any) => c.implementation_status === 'implemented').length
    const domainApplicable = domainControls.filter((c: any) => c.implementation_status !== 'not_applicable').length
    
    let domainAdvCredit = 0
    domainControls.forEach((c: any) => {
      if (c.implementation_status === 'not_applicable') return
      if (c.implementation_status === 'implemented') {
        domainAdvCredit += 0.6 + ((c.maturity_level || 0) / 5) * 0.4
      } else if (c.implementation_status === 'in_progress') {
        domainAdvCredit += 0.3
      }
    })
    
    const domainBasic = domainApplicable > 0 ? Math.round((domainImpl / domainApplicable) * 100) : 0
    const domainAdv = domainApplicable > 0 ? Math.round((domainAdvCredit / domainApplicable) * 100) : 0
    
    await db.prepare(`
      INSERT OR REPLACE INTO domain_snapshots
      (id, organization_id, snapshot_date, domain_name, basic_score, advanced_score, implemented_count, total_controls)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      `dsnap-auto-${domain.toLowerCase().slice(0, 3)}-${Date.now().toString(36)}`,
      orgId, today, domain, domainBasic, domainAdv, domainImpl, domainControls.length
    ).run()
  }
  
  // Insert risk snapshot
  const risks = await db.prepare(`
    SELECT status, inherent_likelihood, inherent_impact
    FROM risk_items WHERE organization_id = ?
  `).bind(orgId).all()
  
  const riskResults = risks.results || []
  const totalRisks = riskResults.length
  const openRisks = riskResults.filter((r: any) => r.status === 'open' || r.status === 'in_progress').length
  
  const getRiskScore = (r: any) => {
    const l = (r.inherent_likelihood || 0.5) <= 1 ? (r.inherent_likelihood || 0.5) * 5 : (r.inherent_likelihood || 0.5)
    const i = (r.inherent_impact || 0.5) <= 1 ? (r.inherent_impact || 0.5) * 5 : (r.inherent_impact || 0.5)
    return l * i
  }
  
  const criticalRisks = riskResults.filter((r: any) => getRiskScore(r) >= 20).length
  const highRisks = riskResults.filter((r: any) => { const s = getRiskScore(r); return s >= 12 && s < 20 }).length
  const mediumRisks = riskResults.filter((r: any) => { const s = getRiskScore(r); return s >= 6 && s < 12 }).length
  const lowRisks = riskResults.filter((r: any) => getRiskScore(r) < 6).length
  
  await db.prepare(`
    INSERT OR REPLACE INTO risk_snapshots
    (id, organization_id, snapshot_date, total_risks, open_risks, critical_risks, 
     high_risks, medium_risks, low_risks, total_exposure, avg_risk_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    `rsnap-auto-${Date.now().toString(36)}`, orgId, today,
    totalRisks, openRisks, criticalRisks, highRisks, mediumRisks, lowRisks, 0, 0
  ).run()
}

// Get Compliance Score History for Trend Charts
app.get('/api/compliance/trends', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId') || c.req.query('org_id')
  const frameworkId = c.req.query('framework_id') || 'all' // 'all', 'fw-iso27001', 'fw-soc2', etc.
  const period = c.req.query('period') || '6m' // '3m', '6m', '12m'
  
  try {
    // Auto-create today's snapshot if it doesn't exist
    await createAutoSnapshot(db, orgId)
    
    // Calculate date range
    let dateFilter = "date('now', '-6 months')"
    if (period === '3m') dateFilter = "date('now', '-3 months')"
    else if (period === '12m') dateFilter = "date('now', '-12 months')"
    
    // Get compliance score snapshots
    let complianceQuery = `
      SELECT 
        cs.snapshot_date,
        cs.framework_id,
        cf.name as framework_name,
        cf.code as framework_code,
        cs.basic_score,
        cs.advanced_score,
        cs.implemented_count,
        cs.in_progress_count,
        cs.not_started_count,
        cs.total_controls,
        cs.avg_maturity
      FROM compliance_snapshots cs
      LEFT JOIN compliance_frameworks_v2 cf ON cs.framework_id = cf.id
      WHERE cs.organization_id = ? AND cs.snapshot_date >= ${dateFilter}
    `
    
    if (frameworkId !== 'all') {
      complianceQuery += ` AND cs.framework_id = ?`
    }
    
    complianceQuery += ` ORDER BY cs.snapshot_date ASC, cs.framework_id`
    
    const complianceSnapshots = frameworkId !== 'all'
      ? await db.prepare(complianceQuery).bind(orgId, frameworkId).all()
      : await db.prepare(complianceQuery).bind(orgId).all()
    
    // Get domain score snapshots
    const domainSnapshots = await db.prepare(`
      SELECT 
        snapshot_date,
        domain_name,
        basic_score,
        advanced_score,
        implemented_count,
        total_controls
      FROM domain_snapshots
      WHERE organization_id = ? AND snapshot_date >= ${dateFilter}
      ORDER BY snapshot_date ASC, domain_name
    `).bind(orgId).all()
    
    // Get risk trend snapshots
    const riskSnapshots = await db.prepare(`
      SELECT 
        snapshot_date,
        total_risks,
        open_risks,
        critical_risks,
        high_risks,
        medium_risks,
        low_risks,
        total_exposure,
        avg_risk_score
      FROM risk_snapshots
      WHERE organization_id = ? AND snapshot_date >= ${dateFilter}
      ORDER BY snapshot_date ASC
    `).bind(orgId).all()
    
    // Process compliance data for charting - group by framework
    const frameworkTrends: Record<string, any[]> = {}
    const complianceResults = complianceSnapshots.results || []
    
    complianceResults.forEach((snap: any) => {
      const fwId = snap.framework_id
      if (!frameworkTrends[fwId]) {
        frameworkTrends[fwId] = []
      }
      frameworkTrends[fwId].push({
        date: snap.snapshot_date,
        basicScore: snap.basic_score,
        advancedScore: snap.advanced_score,
        implemented: snap.implemented_count,
        inProgress: snap.in_progress_count,
        total: snap.total_controls,
        maturity: snap.avg_maturity
      })
    })
    
    // Build chart-ready datasets
    const chartData = {
      compliance: {
        labels: [] as string[],
        datasets: [] as any[]
      },
      domains: {
        labels: [] as string[],
        datasets: [] as any[]
      },
      risks: {
        labels: [] as string[],
        datasets: [] as any[]
      }
    }
    
    // Process compliance chart data
    const frameworkColors: Record<string, string> = {
      'fw-iso27001': '#3b82f6',
      'fw-soc2': '#10b981',
      'fw-nist-csf': '#f59e0b',
      'fw-pci-dss': '#ef4444',
      'fw-gdpr': '#8b5cf6'
    }
    
    const frameworkNames: Record<string, string> = {
      'fw-iso27001': 'ISO 27001',
      'fw-soc2': 'SOC 2',
      'fw-nist-csf': 'NIST CSF',
      'fw-pci-dss': 'PCI-DSS',
      'fw-gdpr': 'GDPR'
    }
    
    // Get unique dates across all frameworks
    const allDates = new Set<string>()
    Object.values(frameworkTrends).forEach(trends => {
      trends.forEach(t => allDates.add(t.date))
    })
    chartData.compliance.labels = Array.from(allDates).sort()
    
    // Create dataset for each framework
    Object.entries(frameworkTrends).forEach(([fwId, trends]) => {
      const dataMap = new Map(trends.map(t => [t.date, t]))
      
      chartData.compliance.datasets.push({
        label: frameworkNames[fwId] || fwId,
        data: chartData.compliance.labels.map(date => {
          const point = dataMap.get(date)
          return point ? point.advancedScore : null
        }),
        borderColor: frameworkColors[fwId] || '#6b7280',
        backgroundColor: (frameworkColors[fwId] || '#6b7280') + '20',
        tension: 0.3,
        fill: false
      })
    })
    
    // Process domain chart data
    const domainResults = domainSnapshots.results || []
    const domainMap: Record<string, any[]> = {}
    const domainDates = new Set<string>()
    
    domainResults.forEach((snap: any) => {
      domainDates.add(snap.snapshot_date)
      if (!domainMap[snap.domain_name]) {
        domainMap[snap.domain_name] = []
      }
      domainMap[snap.domain_name].push({
        date: snap.snapshot_date,
        score: snap.advanced_score || snap.basic_score
      })
    })
    
    chartData.domains.labels = Array.from(domainDates).sort()
    
    const domainColors: Record<string, string> = {
      'Organizational': '#3b82f6',
      'People': '#10b981',
      'Physical': '#f59e0b',
      'Technological': '#8b5cf6'
    }
    
    Object.entries(domainMap).forEach(([domain, data]) => {
      const dataByDate = new Map(data.map(d => [d.date, d.score]))
      chartData.domains.datasets.push({
        label: domain,
        data: chartData.domains.labels.map(date => dataByDate.get(date) ?? null),
        borderColor: domainColors[domain] || '#6b7280',
        backgroundColor: (domainColors[domain] || '#6b7280') + '20',
        tension: 0.3,
        fill: false
      })
    })
    
    // Process risk chart data
    const riskResults = riskSnapshots.results || []
    chartData.risks.labels = riskResults.map((r: any) => r.snapshot_date)
    chartData.risks.datasets = [
      {
        label: 'Total Risks',
        data: riskResults.map((r: any) => r.total_risks),
        borderColor: '#94a3b8',  // Light slate - visible on dark bg
        backgroundColor: '#94a3b820',
        tension: 0.3
      },
      {
        label: 'Open Risks',
        data: riskResults.map((r: any) => r.open_risks),
        borderColor: '#f87171',  // Lighter red - more visible
        backgroundColor: '#f8717120',
        tension: 0.3
      },
      {
        label: 'Critical',
        data: riskResults.map((r: any) => r.critical_risks),
        borderColor: '#ef4444',  // Red
        backgroundColor: '#ef444420',
        tension: 0.3
      },
      {
        label: 'High',
        data: riskResults.map((r: any) => r.high_risks),
        borderColor: '#fbbf24',  // Brighter yellow
        backgroundColor: '#fbbf2420',
        tension: 0.3
      }
    ]
    
    return c.json({
      period,
      frameworkId,
      chartData,
      rawData: {
        compliance: complianceResults,
        domains: domainResults,
        risks: riskResults
      }
    })
  } catch (error) {
    console.error('Compliance trends error:', error)
    return c.json({ error: 'Failed to load compliance trends', details: String(error) }, 500)
  }
})

// Create a compliance snapshot (for daily/weekly cron or manual trigger)
app.post('/api/compliance/snapshot', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId') || c.req.query('org_id')
  
  try {
    // Get current compliance data
    const assessments = await db.prepare(`
      SELECT 
        cl.id, cl.category, cl.is_critical,
        ca.implementation_status, ca.maturity_level
      FROM control_library cl
      LEFT JOIN control_assessments ca ON cl.id = ca.control_library_id AND ca.organization_id = ?
      WHERE cl.framework_id = 'fw-iso27001'
    `).bind(orgId).all()
    
    const controls = assessments.results || []
    
    // Calculate current scores
    let implemented = 0
    let inProgress = 0
    let notStarted = 0
    let notApplicable = 0
    let advancedCredit = 0
    let maturitySum = 0
    let maturityCount = 0
    let criticalImpl = 0
    let criticalTotal = 0
    
    controls.forEach((c: any) => {
      if (c.implementation_status === 'not_applicable') {
        notApplicable++
        return
      }
      
      if (c.is_critical) {
        criticalTotal++
        if (c.implementation_status === 'implemented') criticalImpl++
      }
      
      if (c.implementation_status === 'implemented') {
        implemented++
        const maturityFactor = 0.6 + ((c.maturity_level || 0) / 5) * 0.4
        advancedCredit += maturityFactor
        if (c.maturity_level) {
          maturitySum += c.maturity_level
          maturityCount++
        }
      } else if (c.implementation_status === 'in_progress') {
        inProgress++
        advancedCredit += 0.3
      } else {
        notStarted++
      }
    })
    
    const applicable = controls.length - notApplicable
    const basicScore = applicable > 0 ? Math.round((implemented / applicable) * 100) : 0
    const advancedScore = applicable > 0 ? Math.round((advancedCredit / applicable) * 100) : 0
    const avgMaturity = maturityCount > 0 ? parseFloat((maturitySum / maturityCount).toFixed(1)) : 0
    const criticalScore = criticalTotal > 0 ? Math.round((criticalImpl / criticalTotal) * 100) : 100
    
    const today = new Date().toISOString().split('T')[0]
    const snapshotId = `snap-iso-${Date.now().toString(36)}`
    
    // Insert ISO 27001 snapshot
    await db.prepare(`
      INSERT OR REPLACE INTO compliance_snapshots 
      (id, organization_id, framework_id, snapshot_date, basic_score, advanced_score, 
       implemented_count, in_progress_count, not_started_count, not_applicable_count,
       total_controls, avg_maturity, critical_score)
      VALUES (?, ?, 'fw-iso27001', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      snapshotId, orgId, today, basicScore, advancedScore,
      implemented, inProgress, notStarted, notApplicable,
      controls.length, avgMaturity, criticalScore
    ).run()
    
    // Calculate and insert domain snapshots
    const domains = ['Organizational', 'People', 'Physical', 'Technological']
    for (const domain of domains) {
      const domainControls = controls.filter((c: any) => c.category === domain)
      const domainImpl = domainControls.filter((c: any) => c.implementation_status === 'implemented').length
      const domainApplicable = domainControls.filter((c: any) => c.implementation_status !== 'not_applicable').length
      
      let domainAdvCredit = 0
      domainControls.forEach((c: any) => {
        if (c.implementation_status === 'not_applicable') return
        if (c.implementation_status === 'implemented') {
          domainAdvCredit += 0.6 + ((c.maturity_level || 0) / 5) * 0.4
        } else if (c.implementation_status === 'in_progress') {
          domainAdvCredit += 0.3
        }
      })
      
      const domainBasic = domainApplicable > 0 ? Math.round((domainImpl / domainApplicable) * 100) : 0
      const domainAdv = domainApplicable > 0 ? Math.round((domainAdvCredit / domainApplicable) * 100) : 0
      
      await db.prepare(`
        INSERT OR REPLACE INTO domain_snapshots
        (id, organization_id, snapshot_date, domain_name, basic_score, advanced_score, implemented_count, total_controls)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        `dsnap-${domain.toLowerCase().slice(0, 3)}-${Date.now().toString(36)}`,
        orgId, today, domain, domainBasic, domainAdv, domainImpl, domainControls.length
      ).run()
    }
    
    // Get current risk data and create risk snapshot
    const risks = await db.prepare(`
      SELECT status, category, inherent_score, inherent_likelihood, inherent_impact
      FROM risk_items WHERE organization_id = ?
    `).bind(orgId).all()
    
    const riskResults = risks.results || []
    const totalRisks = riskResults.length
    const openRisks = riskResults.filter((r: any) => r.status === 'open' || r.status === 'in_progress').length
    
    // Calculate risk severity - handle both decimal (0-1) and integer (1-5) scales
    const getRiskScore = (r: any) => {
      const likelihood = r.inherent_likelihood || 0.5
      const impact = r.inherent_impact || 0.5
      // If values are decimals (0-1), convert to 1-5 scale
      const l = likelihood <= 1 ? likelihood * 5 : likelihood
      const i = impact <= 1 ? impact * 5 : impact
      return l * i // Returns 1-25 scale
    }
    
    const criticalRisks = riskResults.filter((r: any) => getRiskScore(r) >= 20).length
    const highRisks = riskResults.filter((r: any) => {
      const score = getRiskScore(r)
      return score >= 12 && score < 20
    }).length
    const mediumRisks = riskResults.filter((r: any) => {
      const score = getRiskScore(r)
      return score >= 6 && score < 12
    }).length
    const lowRisks = riskResults.filter((r: any) => getRiskScore(r) < 6).length
    
    const totalExposure = riskResults.reduce((sum: number, r: any) => sum + (r.inherent_score || 0), 0)
    const avgRiskScore = totalRisks > 0 ? Math.round(totalExposure / totalRisks) : 0
    
    await db.prepare(`
      INSERT OR REPLACE INTO risk_snapshots
      (id, organization_id, snapshot_date, total_risks, open_risks, critical_risks, 
       high_risks, medium_risks, low_risks, total_exposure, avg_risk_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      `rsnap-${Date.now().toString(36)}`, orgId, today,
      totalRisks, openRisks, criticalRisks, highRisks, mediumRisks, lowRisks,
      totalExposure, avgRiskScore
    ).run()
    
    return c.json({
      success: true,
      snapshot_date: today,
      iso27001: { basicScore, advancedScore, implemented, inProgress, total: controls.length, avgMaturity, criticalScore },
      risks: { total: totalRisks, open: openRisks, critical: criticalRisks, high: highRisks }
    })
  } catch (error) {
    console.error('Create snapshot error:', error)
    return c.json({ error: 'Failed to create snapshot', details: String(error) }, 500)
  }
})

// Get Controls for Gap Assessment
// Enhanced with risk warnings from pentest findings
app.get('/api/compliance/controls', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId') || c.req.query('org_id')
  const frameworkId = c.req.query('framework_id') || 'fw-iso27001'
  
  try {
    // Get controls with assessment data AND risk warnings
    const controls = await db.prepare(`
      SELECT 
        cl.id, cl.control_id, cl.control_number, cl.title, cl.description, 
        cl.category, cl.subcategory, cl.control_type, cl.is_critical, cl.weight,
        ca.implementation_status, ca.maturity_level, ca.evidence_description, 
        ca.gaps_identified, ca.assessment_date, ca.risk_warnings, ca.manual_override
      FROM control_library cl
      LEFT JOIN control_assessments ca ON cl.id = ca.control_library_id AND ca.organization_id = ?
      WHERE cl.framework_id = ?
      ORDER BY cl.control_number
    `).bind(orgId, frameworkId).all()
    
    // Get open risks linked to each control for advisory display
    const linkedRisks = await db.prepare(`
      SELECT 
        crm.control_id,
        COUNT(*) as total_risks,
        SUM(CASE WHEN ri.status IN ('open', 'in_progress') THEN 1 ELSE 0 END) as open_risks,
        MAX(CASE 
          WHEN ri.status IN ('open', 'in_progress') AND ri.inherent_score >= 75 THEN 'critical'
          WHEN ri.status IN ('open', 'in_progress') AND ri.inherent_score >= 50 THEN 'high'
          WHEN ri.status IN ('open', 'in_progress') AND ri.inherent_score >= 25 THEN 'medium'
          WHEN ri.status IN ('open', 'in_progress') THEN 'low'
          ELSE NULL
        END) as highest_open_severity
      FROM control_risk_mappings crm
      JOIN risk_items ri ON crm.risk_id = ri.id
      WHERE crm.organization_id = ?
      GROUP BY crm.control_id
    `).bind(orgId).all()
    
    // Create a map of control_id to risk info
    const riskMap: Record<string, any> = {}
    for (const r of (linkedRisks.results || [])) {
      riskMap[r.control_id as string] = {
        total_risks: r.total_risks,
        open_risks: r.open_risks,
        highest_open_severity: r.highest_open_severity
      }
    }
    
    // Enhance control data with risk info
    const results = (controls.results || []).map((ctrl: any) => {
      const riskInfo = riskMap[ctrl.id] || { total_risks: 0, open_risks: 0, highest_open_severity: null }
      
      // Parse risk_warnings JSON if present
      let parsedWarnings = []
      try {
        if (ctrl.risk_warnings) {
          parsedWarnings = JSON.parse(ctrl.risk_warnings)
        }
      } catch (e) {}
      
      // NEW: Check if all risks are mitigated (suggest upgrade to implemented)
      const hadRisks = (riskInfo.total_risks || 0) > 0
      const allRisksMitigated = hadRisks && (riskInfo.open_risks || 0) === 0
      const canSuggestUpgrade = allRisksMitigated && 
        ctrl.implementation_status !== 'implemented' && 
        ctrl.implementation_status !== 'not_applicable'
      
      return {
        ...ctrl,
        linked_risks: riskInfo.total_risks || 0,
        open_risks: riskInfo.open_risks || 0,
        highest_open_severity: riskInfo.highest_open_severity,
        needs_review: riskInfo.open_risks > 0 && ctrl.implementation_status === 'implemented',
        // NEW: Suggest upgrade indicator
        all_risks_mitigated: allRisksMitigated,
        suggest_upgrade: canSuggestUpgrade,
        risk_warnings_parsed: parsedWarnings
      }
    })
    
    // Calculate stats
    const stats = {
      total: results.length,
      implemented: results.filter((c: any) => c.implementation_status === 'implemented').length,
      in_progress: results.filter((c: any) => c.implementation_status === 'in_progress' || c.implementation_status === 'planned').length,
      not_implemented: results.filter((c: any) => !c.implementation_status || c.implementation_status === 'not_started').length,
      not_applicable: results.filter((c: any) => c.implementation_status === 'not_applicable').length,
      // New: Advisory stats
      needs_review: results.filter((c: any) => c.needs_review).length,
      with_open_risks: results.filter((c: any) => c.open_risks > 0).length,
      critical_findings: results.filter((c: any) => c.highest_open_severity === 'critical').length,
      high_findings: results.filter((c: any) => c.highest_open_severity === 'high').length,
      // NEW: Suggest upgrade count (controls with all risks mitigated)
      suggest_upgrade: results.filter((c: any) => c.suggest_upgrade).length
    }
    
    return c.json({ controls: results, stats })
  } catch (error) {
    console.error('Get controls error:', error)
    return c.json({ error: 'Failed to load controls', details: String(error) }, 500)
  }
})

// Get Single Control Detail
app.get('/api/compliance/control/:id', async (c) => {
  const db = c.env.DB
  const controlId = c.req.param('id')
  const orgId = c.get('orgId') || c.req.query('org_id')
  
  try {
    const control = await db.prepare(`
      SELECT 
        cl.*, 
        ca.implementation_status, ca.maturity_level, ca.evidence_description,
        ca.gaps_identified, ca.remediation_plan, ca.remediation_due_date,
        ca.remediation_owner_id, ca.assessment_date, ca.notes,
        owner.display_name as remediation_owner_name
      FROM control_library cl
      LEFT JOIN control_assessments ca ON cl.id = ca.control_library_id AND ca.organization_id = ?
      LEFT JOIN users_new owner ON ca.remediation_owner_id = owner.id
      WHERE cl.id = ?
    `).bind(orgId, controlId).first()
    
    if (!control) {
      return c.json({ error: 'Control not found' }, 404)
    }
    
    return c.json(control)
  } catch (error) {
    console.error('Get control error:', error)
    return c.json({ error: 'Failed to load control', details: String(error) }, 500)
  }
})

// Save/Update Control Assessment
app.post('/api/compliance/assessment', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId') || c.req.query('org_id')
  const body = await c.req.json()
  
  try {
    const { control_library_id, implementation_status, maturity_level, evidence_description, gaps_identified, remediation_plan, remediation_due_date, remediation_owner_id } = body
    
    if (!control_library_id) {
      return c.json({ error: 'control_library_id is required' }, 400)
    }
    
    // Check if assessment exists
    const existing = await db.prepare(`
      SELECT id FROM control_assessments WHERE organization_id = ? AND control_library_id = ?
    `).bind(orgId, control_library_id).first()
    
    if (existing) {
      // Update
      const updates: string[] = []
      const values: any[] = []
      
      if (implementation_status !== undefined) { updates.push('implementation_status = ?'); values.push(implementation_status) }
      if (maturity_level !== undefined) { updates.push('maturity_level = ?'); values.push(maturity_level) }
      if (evidence_description !== undefined) { updates.push('evidence_description = ?'); values.push(evidence_description) }
      if (gaps_identified !== undefined) { updates.push('gaps_identified = ?'); values.push(gaps_identified) }
      if (remediation_plan !== undefined) { updates.push('remediation_plan = ?'); values.push(remediation_plan) }
      if (remediation_due_date !== undefined) { updates.push('remediation_due_date = ?'); values.push(remediation_due_date) }
      if (remediation_owner_id !== undefined) { updates.push('remediation_owner_id = ?'); values.push(remediation_owner_id || null) }
      
      updates.push('assessment_date = datetime("now")')
      updates.push('updated_at = datetime("now")')
      values.push(existing.id)
      
      await db.prepare(`UPDATE control_assessments SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run()
      
      return c.json({ success: true, action: 'updated', id: existing.id })
    } else {
      // Insert
      const newId = `ca-${crypto.randomUUID().slice(0, 8)}`
      
      await db.prepare(`
        INSERT INTO control_assessments (
          id, organization_id, control_library_id, implementation_status, maturity_level,
          evidence_description, gaps_identified, remediation_plan, remediation_due_date,
          remediation_owner_id, assessment_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
      `).bind(
        newId, orgId, control_library_id,
        implementation_status || 'not_started',
        maturity_level || 0,
        evidence_description || null,
        gaps_identified || null,
        remediation_plan || null,
        remediation_due_date || null,
        remediation_owner_id || null
      ).run()
      
      return c.json({ success: true, action: 'created', id: newId })
    }
  } catch (error) {
    console.error('Save assessment error:', error)
    return c.json({ error: 'Failed to save assessment', details: String(error) }, 500)
  }
})

// Initialize All Assessments with Demo Data
// This populates controls with realistic implementation statuses and maturity levels
// for demonstration purposes - avoids manual assessment of 93 controls
app.post('/api/compliance/initialize', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId') || c.req.query('org_id')
  const body = await c.req.json().catch(() => ({}))
  const mode = body.mode || 'demo' // 'demo' = random data, 'empty' = all not_started
  
  try {
    // Get all ISO 27001 controls
    const controls = await db.prepare(`
      SELECT id, is_critical FROM control_library WHERE framework_id = 'fw-iso27001'
    `).all()
    
    let created = 0
    let updated = 0
    
    // Demo distribution: 60% implemented, 15% in_progress, 15% planned, 10% not_started
    const statuses = ['implemented', 'implemented', 'implemented', 'implemented', 'implemented', 'implemented',
                      'in_progress', 'in_progress', 'planned', 'planned', 'not_started']
    
    // Maturity distribution weighted toward higher levels for implemented controls
    const maturityForImplemented = [3, 3, 3, 4, 4, 5] // Mostly 3-4, some 5
    const maturityForInProgress = [2, 2, 3, 3]
    const maturityForPlanned = [1, 1, 2]
    
    for (const ctrl of (controls.results || []) as any[]) {
      // Check if assessment exists
      const existing = await db.prepare(`
        SELECT id FROM control_assessments WHERE organization_id = ? AND control_library_id = ?
      `).bind(orgId, ctrl.id).first()
      
      let status = 'not_started'
      let maturity = 0
      
      if (mode === 'demo') {
        // Generate realistic demo data
        status = statuses[Math.floor(Math.random() * statuses.length)]
        
        // Critical controls are more likely to be implemented
        if (ctrl.is_critical && Math.random() > 0.3) {
          status = 'implemented'
        }
        
        // Set appropriate maturity based on status
        if (status === 'implemented') {
          maturity = maturityForImplemented[Math.floor(Math.random() * maturityForImplemented.length)]
        } else if (status === 'in_progress') {
          maturity = maturityForInProgress[Math.floor(Math.random() * maturityForInProgress.length)]
        } else if (status === 'planned') {
          maturity = maturityForPlanned[Math.floor(Math.random() * maturityForPlanned.length)]
        }
      }
      
      if (!existing) {
        const newId = `ca-${crypto.randomUUID().slice(0, 8)}`
        await db.prepare(`
          INSERT INTO control_assessments (id, organization_id, control_library_id, implementation_status, maturity_level, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(newId, orgId, ctrl.id, status, maturity).run()
        created++
      } else if (mode === 'demo') {
        // Update existing with demo data
        await db.prepare(`
          UPDATE control_assessments 
          SET implementation_status = ?, maturity_level = ?, updated_at = datetime('now')
          WHERE organization_id = ? AND control_library_id = ?
        `).bind(status, maturity, orgId, ctrl.id).run()
        updated++
      }
    }
    
    return c.json({ 
      success: true, 
      mode,
      created, 
      updated,
      total: controls.results?.length || 0,
      message: mode === 'demo' 
        ? `Initialized ${created} new + updated ${updated} existing controls with demo data`
        : `Initialized ${created} controls with empty status`
    })
  } catch (error) {
    console.error('Initialize error:', error)
    return c.json({ error: 'Failed to initialize', details: String(error) }, 500)
  }
})

// ============================================================================
// SUPER ADMIN - MULTI-ORGANIZATION MANAGEMENT
// ============================================================================

// Get all organizations (super_admin only)
app.get('/api/super-admin/organizations', async (c) => {
  const db = c.env.DB
  const userRole = c.get('userRole')
  
  if (userRole !== 'super_admin') {
    return c.json({ error: 'Access denied', message: 'Super Admin access required' }, 403)
  }
  
  try {
    const orgs = await db.prepare(`
      SELECT 
        o.id, o.name, o.industry, o.size, o.subscription_tier, o.is_active, o.created_at,
        (SELECT COUNT(*) FROM users_new WHERE organization_id = o.id) as user_count,
        (SELECT COUNT(*) FROM risk_items WHERE organization_id = o.id) as risk_count,
        (SELECT COUNT(*) FROM assets WHERE organization_id = o.id) as asset_count
      FROM organizations o
      ORDER BY o.created_at DESC
    `).all()
    
    return c.json(orgs.results || [])
  } catch (error) {
    console.error('Get organizations error:', error)
    return c.json({ error: 'Failed to fetch organizations' }, 500)
  }
})

// Create new organization (super_admin only)
app.post('/api/super-admin/organizations', async (c) => {
  const db = c.env.DB
  const userRole = c.get('userRole')
  
  if (userRole !== 'super_admin') {
    return c.json({ error: 'Access denied', message: 'Super Admin access required' }, 403)
  }
  
  const body = await c.req.json()
  const { name, industry, size, subscription_tier, admin_email, admin_name, admin_password } = body
  
  if (!name || !admin_email || !admin_name) {
    return c.json({ error: 'Missing required fields: name, admin_email, admin_name' }, 400)
  }
  
  try {
    // Generate sequential org ID (org-001, org-002, etc.)
    const lastOrg = await db.prepare(`
      SELECT id FROM organizations 
      WHERE id LIKE 'org-%' AND LENGTH(id) = 7
      ORDER BY id DESC LIMIT 1
    `).first() as { id: string } | null
    
    let nextNum = 1
    if (lastOrg?.id) {
      const match = lastOrg.id.match(/org-(\d+)/)
      if (match) nextNum = parseInt(match[1]) + 1
    }
    const orgId = `org-${String(nextNum).padStart(3, '0')}`
    const userId = 'user-' + crypto.randomUUID().slice(0, 12)
    
    console.log('Creating organization:', { orgId, name, admin_email })
    
    // Step 1: Create organization
    // Generate slug from name (lowercase, replace spaces with hyphens, remove special chars)
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    
    // Map size to valid values: 'startup', 'smb', 'enterprise'
    const validSizes = ['startup', 'smb', 'enterprise']
    const sizeMap: Record<string, string> = { 'small': 'startup', 'medium': 'smb', 'large': 'enterprise' }
    const normalizedSize = validSizes.includes(size) ? size : (sizeMap[size] || 'smb')
    
    try {
      await db.prepare(`
        INSERT INTO organizations (id, name, slug, industry, size, subscription_tier, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
      `).bind(orgId, name, slug, industry || 'technology', normalizedSize, subscription_tier || 'professional').run()
      console.log('Step 1: Organization created with slug:', slug)
    } catch (e: any) {
      console.error('Step 1 failed - Organization:', e)
      return c.json({ error: 'Failed to create organization', step: 1, details: e.message }, 500)
    }
    
    // Step 2: Create organization profile (optional)
    try {
      await db.prepare(`
        INSERT INTO organization_profile (
          organization_id, company_name, industry, company_size, 
          headquarters_region, operating_regions, 
          handles_card_data, handles_health_data, handles_personal_data, handles_financial_data, handles_government_data,
          risk_appetite, security_maturity_target,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'us', '["us"]', 0, 0, 1, 0, 0, 'moderate', 3, datetime('now'), datetime('now'))
      `).bind(orgId, name, industry || 'technology', normalizedSize).run()
      console.log('Step 2: Organization profile created')
    } catch (e) {
      console.log('Step 2 skipped - Organization profile:', e)
    }
    
    // Step 3: Hash password
    const password = admin_password || 'Admin@2026'
    const encoder = new TextEncoder()
    const data = encoder.encode(password + 'grc-pulse-salt')
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    console.log('Step 3: Password hashed')
    
    // Step 4: Create admin user
    const nameParts = admin_name.split(' ')
    const firstName = nameParts[0] || admin_name
    const lastName = nameParts.slice(1).join(' ') || ''
    
    try {
      await db.prepare(`
        INSERT INTO users_new (id, organization_id, email, password_hash, first_name, last_name, display_name, role, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'org_admin', 'active', datetime('now'), datetime('now'))
      `).bind(userId, orgId, admin_email, passwordHash, firstName, lastName, admin_name).run()
      console.log('Step 4: Admin user created')
    } catch (e: any) {
      console.error('Step 4 failed - Admin user:', e)
      return c.json({ error: 'Failed to create admin user', step: 4, details: e.message }, 500)
    }
    
    // Step 5: Initialize frameworks (optional)
    try {
      const defaultFrameworks = ['fw-iso27001', 'fw-nist-csf', 'fw-soc2']
      for (const fwId of defaultFrameworks) {
        await db.prepare(`
          INSERT OR IGNORE INTO organization_frameworks (organization_id, framework_id, is_applicable, target_score, created_at, updated_at)
          VALUES (?, ?, 1, 80, datetime('now'), datetime('now'))
        `).bind(orgId, fwId).run()
      }
      console.log('Step 5: Frameworks initialized')
    } catch (e) {
      console.log('Step 5 skipped - Frameworks:', e)
    }
    
    // Step 6: Sync organization to PentestPulse
    try {
      const pentestSlug = slug.length > 50 ? slug.slice(0, 50) : slug
      await fetch('https://pentest-pulse.pages.dev/api/external/sync-org', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Sync-Key': 'grcpulse-sync-2024'
        },
        body: JSON.stringify({
          id: orgId,
          name: name,
          slug: pentestSlug,
          industry: industry || 'technology'
        })
      })
      console.log('Step 6: Organization synced to PentestPulse')
    } catch (e) {
      console.log('Step 6 skipped - PentestPulse sync:', e)
    }
    
    return c.json({ 
      success: true, 
      organization: { id: orgId, name },
      admin: { id: userId, email: admin_email, name: admin_name }
    }, 201)
  } catch (error) {
    console.error('Create organization error:', error)
    return c.json({ error: 'Failed to create organization', details: String(error) }, 500)
  }
})

// Update organization (super_admin only)
app.put('/api/super-admin/organizations/:id', async (c) => {
  const db = c.env.DB
  const userRole = c.get('userRole')
  const orgId = c.req.param('id')
  
  if (userRole !== 'super_admin') {
    return c.json({ error: 'Access denied', message: 'Super Admin access required' }, 403)
  }
  
  const body = await c.req.json()
  const { name, industry, size, subscription_tier, is_active } = body
  
  try {
    const updates: string[] = []
    const values: any[] = []
    
    if (name !== undefined) { updates.push('name = ?'); values.push(name) }
    if (industry !== undefined) { updates.push('industry = ?'); values.push(industry) }
    if (size !== undefined) { updates.push('size = ?'); values.push(size) }
    if (subscription_tier !== undefined) { updates.push('subscription_tier = ?'); values.push(subscription_tier) }
    if (is_active !== undefined) { updates.push('is_active = ?'); values.push(is_active ? 1 : 0) }
    
    if (updates.length === 0) {
      return c.json({ error: 'No fields to update' }, 400)
    }
    
    updates.push("updated_at = datetime('now')")
    values.push(orgId)
    
    await db.prepare(`UPDATE organizations SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run()
    
    // Also update organization_profile if name changed
    if (name) {
      await db.prepare(`UPDATE organization_profile SET company_name = ?, updated_at = datetime('now') WHERE organization_id = ?`).bind(name, orgId).run()
    }
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Update organization error:', error)
    return c.json({ error: 'Failed to update organization' }, 500)
  }
})

// Get users across all organizations (super_admin only)
app.get('/api/super-admin/users', async (c) => {
  const db = c.env.DB
  const userRole = c.get('userRole')
  
  if (userRole !== 'super_admin') {
    return c.json({ error: 'Access denied', message: 'Super Admin access required' }, 403)
  }
  
  try {
    const users = await db.prepare(`
      SELECT 
        u.id, u.email, u.display_name, u.role, u.status, u.created_at, u.last_login,
        o.id as org_id, o.name as org_name
      FROM users_new u
      LEFT JOIN organizations o ON u.organization_id = o.id
      ORDER BY u.created_at DESC
    `).all()
    
    return c.json(users.results || [])
  } catch (error) {
    console.error('Get all users error:', error)
    return c.json({ error: 'Failed to fetch users' }, 500)
  }
})

// Change user's organization or role (super_admin only)
app.put('/api/super-admin/users/:id', async (c) => {
  const db = c.env.DB
  const userRole = c.get('userRole')
  const userId = c.req.param('id')
  
  if (userRole !== 'super_admin') {
    return c.json({ error: 'Access denied', message: 'Super Admin access required' }, 403)
  }
  
  const body = await c.req.json()
  const { organization_id, role, status } = body
  
  try {
    const updates: string[] = []
    const values: any[] = []
    
    if (organization_id !== undefined) { updates.push('organization_id = ?'); values.push(organization_id) }
    if (role !== undefined) { updates.push('role = ?'); values.push(role) }
    if (status !== undefined) { updates.push('status = ?'); values.push(status) }
    
    if (updates.length === 0) {
      return c.json({ error: 'No fields to update' }, 400)
    }
    
    updates.push("updated_at = datetime('now')")
    values.push(userId)
    
    await db.prepare(`UPDATE users_new SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run()
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Update user error:', error)
    return c.json({ error: 'Failed to update user' }, 500)
  }
})

// Get platform statistics (super_admin only)
app.get('/api/super-admin/stats', async (c) => {
  const db = c.env.DB
  const userRole = c.get('userRole')
  
  if (userRole !== 'super_admin') {
    return c.json({ error: 'Access denied', message: 'Super Admin access required' }, 403)
  }
  
  try {
    const [orgs, users, risks, assets] = await Promise.all([
      db.prepare('SELECT COUNT(*) as count FROM organizations').first(),
      db.prepare('SELECT COUNT(*) as count FROM users_new').first(),
      db.prepare('SELECT COUNT(*) as count FROM risk_items').first(),
      db.prepare('SELECT COUNT(*) as count FROM assets').first()
    ])
    
    const activeOrgs = await db.prepare('SELECT COUNT(*) as count FROM organizations WHERE is_active = 1').first()
    const activeUsers = await db.prepare("SELECT COUNT(*) as count FROM users_new WHERE status = 'active'").first()
    
    return c.json({
      organizations: { total: orgs?.count || 0, active: activeOrgs?.count || 0 },
      users: { total: users?.count || 0, active: activeUsers?.count || 0 },
      risks: risks?.count || 0,
      assets: assets?.count || 0
    })
  } catch (error) {
    console.error('Get platform stats error:', error)
    return c.json({ error: 'Failed to fetch statistics' }, 500)
  }
})

// ============================================================================
// ORGANIZATION PROFILE & FRAMEWORK APPLICABILITY (Phase 3)
// ============================================================================

// Get organization profile
app.get('/api/organization/profile', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId') || c.req.query('org_id')
  
  try {
    const profile = await db.prepare(`
      SELECT * FROM organization_profile WHERE organization_id = ?
    `).bind(orgId).first()
    
    if (!profile) {
      return c.json({ error: 'Organization profile not found' }, 404)
    }
    
    // Parse JSON fields
    const result = {
      ...profile,
      operating_regions: JSON.parse(profile.operating_regions || '[]')
    }
    
    return c.json(result)
  } catch (error) {
    console.error('Get profile error:', error)
    return c.json({ error: 'Failed to get profile', details: String(error) }, 500)
  }
})

// Update organization profile
app.post('/api/organization/profile', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId') || c.req.query('org_id')
  const body = await c.req.json()
  
  try {
    const {
      company_name, industry, industry_sector, company_size,
      headquarters_region, operating_regions,
      handles_card_data, handles_health_data, handles_personal_data,
      handles_financial_data, handles_government_data,
      risk_appetite, security_maturity_target
    } = body
    
    // Check if profile exists
    const existing = await db.prepare(`
      SELECT organization_id FROM organization_profile WHERE organization_id = ?
    `).bind(orgId).first()
    
    // Helper to convert undefined to null for D1
    const toNull = (val: any) => val === undefined ? null : val
    
    if (existing) {
      // Update
      await db.prepare(`
        UPDATE organization_profile SET
          company_name = COALESCE(?, company_name),
          industry = COALESCE(?, industry),
          industry_sector = COALESCE(?, industry_sector),
          company_size = COALESCE(?, company_size),
          headquarters_region = COALESCE(?, headquarters_region),
          operating_regions = COALESCE(?, operating_regions),
          handles_card_data = COALESCE(?, handles_card_data),
          handles_health_data = COALESCE(?, handles_health_data),
          handles_personal_data = COALESCE(?, handles_personal_data),
          handles_financial_data = COALESCE(?, handles_financial_data),
          handles_government_data = COALESCE(?, handles_government_data),
          risk_appetite = COALESCE(?, risk_appetite),
          security_maturity_target = COALESCE(?, security_maturity_target),
          updated_at = datetime('now')
        WHERE organization_id = ?
      `).bind(
        toNull(company_name), toNull(industry), toNull(industry_sector), toNull(company_size),
        toNull(headquarters_region), operating_regions ? JSON.stringify(operating_regions) : null,
        toNull(handles_card_data), toNull(handles_health_data), toNull(handles_personal_data),
        toNull(handles_financial_data), toNull(handles_government_data),
        toNull(risk_appetite), toNull(security_maturity_target),
        orgId
      ).run()
    } else {
      // Insert
      await db.prepare(`
        INSERT INTO organization_profile (
          organization_id, company_name, industry, industry_sector, company_size,
          headquarters_region, operating_regions,
          handles_card_data, handles_health_data, handles_personal_data,
          handles_financial_data, handles_government_data,
          risk_appetite, security_maturity_target
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        orgId, company_name || 'My Organization', industry || 'technology', industry_sector,
        company_size || 'medium', headquarters_region || 'us',
        JSON.stringify(operating_regions || ['us']),
        handles_card_data || 0, handles_health_data || 0, handles_personal_data || 1,
        handles_financial_data || 0, handles_government_data || 0,
        risk_appetite || 'moderate', security_maturity_target || 3
      ).run()
    }
    
    // Auto-update framework applicability based on profile
    await updateFrameworkApplicability(db, orgId)
    
    // Also update the main organizations table name if company_name was provided
    if (company_name) {
      await db.prepare(`
        UPDATE organizations SET name = ?, updated_at = datetime('now') WHERE id = ?
      `).bind(company_name, orgId).run()
    }
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Update profile error:', error)
    return c.json({ error: 'Failed to update profile', details: String(error) }, 500)
  }
})

// Helper function to auto-determine framework applicability
async function updateFrameworkApplicability(db: any, orgId: string) {
  const profile = await db.prepare(`
    SELECT * FROM organization_profile WHERE organization_id = ?
  `).bind(orgId).first()
  
  if (!profile) return
  
  const frameworks = ['fw-iso27001', 'fw-nist-csf', 'fw-pci-dss', 'fw-soc2', 'fw-gdpr']
  const regions = JSON.parse(profile.operating_regions || '[]')
  
  for (const fwId of frameworks) {
    let isApplicable = false
    let reason = ''
    let priority = 3
    
    // Determine applicability based on profile
    switch (fwId) {
      case 'fw-iso27001':
        isApplicable = true
        reason = 'Core information security framework - applicable to all organizations'
        priority = 1
        break
        
      case 'fw-nist-csf':
        isApplicable = profile.headquarters_region === 'us' || 
                       regions.includes('us') || 
                       profile.handles_government_data === 1
        reason = isApplicable 
          ? 'Recommended for US-based organizations or government contractors'
          : 'Optional - primarily used in US market'
        priority = isApplicable ? 2 : 4
        break
        
      case 'fw-pci-dss':
        isApplicable = profile.handles_card_data === 1
        reason = isApplicable 
          ? 'Required - organization handles payment card data'
          : 'Not applicable - no payment card data processing'
        priority = isApplicable ? 1 : 5
        break
        
      case 'fw-soc2':
        isApplicable = profile.industry === 'technology' || 
                       profile.industry_sector === 'SaaS' ||
                       profile.handles_personal_data === 1
        reason = isApplicable 
          ? 'Recommended for technology/SaaS companies handling customer data'
          : 'Optional - primarily for B2B service providers'
        priority = isApplicable ? 1 : 3
        break
        
      case 'fw-gdpr':
        isApplicable = regions.includes('eu') || 
                       profile.headquarters_region === 'eu' ||
                       (profile.handles_personal_data === 1 && regions.some((r: string) => r === 'eu' || r === 'global'))
        reason = isApplicable 
          ? 'Required - organization operates in EU or processes EU personal data'
          : 'Not applicable - no EU operations or EU personal data'
        priority = isApplicable ? 1 : 5
        break
    }
    
    // Upsert framework applicability
    const existingFa = await db.prepare(`
      SELECT id FROM framework_applicability WHERE organization_id = ? AND framework_id = ?
    `).bind(orgId, fwId).first()
    
    if (existingFa) {
      await db.prepare(`
        UPDATE framework_applicability SET
          is_applicable = ?,
          applicability_reason = ?,
          priority = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).bind(isApplicable ? 1 : 0, reason, priority, existingFa.id).run()
    } else {
      const newId = `fa-${crypto.randomUUID().slice(0, 8)}`
      await db.prepare(`
        INSERT INTO framework_applicability (id, organization_id, framework_id, is_applicable, applicability_reason, priority)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(newId, orgId, fwId, isApplicable ? 1 : 0, reason, priority).run()
    }
  }
}

// Get framework applicability
app.get('/api/organization/frameworks', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId') || c.req.query('org_id')
  
  try {
    const applicability = await db.prepare(`
      SELECT 
        fa.*,
        cf.code as framework_code,
        cf.name as framework_name,
        cf.total_controls
      FROM framework_applicability fa
      JOIN compliance_frameworks_v2 cf ON fa.framework_id = cf.id
      WHERE fa.organization_id = ?
      ORDER BY fa.priority, cf.name
    `).bind(orgId).all()
    
    return c.json(applicability.results || [])
  } catch (error) {
    console.error('Get frameworks error:', error)
    return c.json({ error: 'Failed to get frameworks', details: String(error) }, 500)
  }
})

// Update framework applicability manually
app.post('/api/organization/frameworks', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId') || c.req.query('org_id')
  const body = await c.req.json()
  
  try {
    const { framework_id, is_applicable, applicability_reason, priority, target_score, target_date, notes } = body
    
    if (!framework_id) {
      return c.json({ error: 'framework_id is required' }, 400)
    }
    
    // Helper to convert undefined to null for D1
    const toNull = (val: any) => val === undefined ? null : val
    
    const existing = await db.prepare(`
      SELECT id FROM framework_applicability WHERE organization_id = ? AND framework_id = ?
    `).bind(orgId, framework_id).first()
    
    if (existing) {
      await db.prepare(`
        UPDATE framework_applicability SET
          is_applicable = COALESCE(?, is_applicable),
          applicability_reason = COALESCE(?, applicability_reason),
          priority = COALESCE(?, priority),
          target_score = COALESCE(?, target_score),
          target_date = COALESCE(?, target_date),
          notes = COALESCE(?, notes),
          updated_at = datetime('now')
        WHERE id = ?
      `).bind(
        toNull(is_applicable), toNull(applicability_reason), toNull(priority), 
        toNull(target_score), toNull(target_date), toNull(notes),
        existing.id
      ).run()
    } else {
      const newId = `fa-${crypto.randomUUID().slice(0, 8)}`
      await db.prepare(`
        INSERT INTO framework_applicability (id, organization_id, framework_id, is_applicable, applicability_reason, priority, target_score, target_date, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        newId, orgId, framework_id, 
        is_applicable !== undefined ? is_applicable : 1, 
        toNull(applicability_reason), 
        priority !== undefined ? priority : 3, 
        toNull(target_score), toNull(target_date), toNull(notes)
      ).run()
    }
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Update framework error:', error)
    return c.json({ error: 'Failed to update framework', details: String(error) }, 500)
  }
})

// Get industry recommendations
app.get('/api/organization/industry-recommendations', async (c) => {
  const db = c.env.DB
  const industry = c.req.query('industry') || 'technology'
  
  try {
    const recommendations = await db.prepare(`
      SELECT 
        ifr.*,
        cf.code as framework_code,
        cf.name as framework_name
      FROM industry_framework_requirements ifr
      JOIN compliance_frameworks_v2 cf ON ifr.framework_id = cf.id
      WHERE ifr.industry = ?
      ORDER BY ifr.is_typically_required DESC, cf.name
    `).bind(industry).all()
    
    return c.json(recommendations.results || [])
  } catch (error) {
    console.error('Get recommendations error:', error)
    return c.json({ error: 'Failed to get recommendations', details: String(error) }, 500)
  }
})

// ============================================================================
// USER MANAGEMENT API (Org Admin)
// ============================================================================

// Get all users for organization
app.get('/api/organization/users', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')
  
  if (!orgId) {
    return c.json({ error: 'Organization not found' }, 400)
  }
  
  try {
    const users = await db.prepare(`
      SELECT id, email, first_name, last_name, display_name, job_title, department, role, status, created_at
      FROM users_new WHERE organization_id = ?
      ORDER BY CASE WHEN role = 'org_admin' THEN 1 ELSE 2 END, display_name
    `).bind(orgId).all()
    
    return c.json(users.results || [])
  } catch (error) {
    console.error('Get users error:', error)
    return c.json({ error: 'Failed to get users' }, 500)
  }
})

// Create user with invitation token
app.post('/api/organization/users', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')
  const userId = c.get('userId')
  
  if (!orgId) return c.json({ error: 'Organization not found' }, 400)
  
  try {
    const body = await c.req.json()
    const { name, email, job_title, role } = body
    
    if (!name || !email) return c.json({ error: 'Name and email required' }, 400)
    
    const existing = await db.prepare(`SELECT id FROM users_new WHERE email = ? AND organization_id = ?`).bind(email.toLowerCase(), orgId).first()
    if (existing) return c.json({ error: 'Email already exists' }, 409)
    
    const nameParts = name.trim().split(/\s+/)
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''
    const newId = 'user-' + crypto.randomUUID().slice(0, 8)
    
    // Create user with 'pending' status until they set password
    await db.prepare(`
      INSERT INTO users_new (id, organization_id, email, first_name, last_name, display_name, job_title, role, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))
    `).bind(newId, orgId, email.toLowerCase(), firstName, lastName, name, job_title || null, role || 'viewer').run()
    
    // Generate invitation token (valid for 48 hours)
    const inviteToken = crypto.randomUUID() + '-' + crypto.randomUUID().slice(0, 8)
    const tokenId = 'inv-' + crypto.randomUUID().slice(0, 12)
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    
    await db.prepare(`
      INSERT INTO invitation_tokens (id, user_id, organization_id, token, expires_at, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(tokenId, newId, orgId, inviteToken, expiresAt, userId).run()
    
    // Log audit
    await db.prepare(`INSERT INTO audit_log (id, organization_id, user_id, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, 'user_created', 'user', ?, ?, datetime('now'))`).bind('audit-' + crypto.randomUUID().slice(0, 12), orgId, userId, newId, JSON.stringify({ email, name, role })).run()
    
    return c.json({ success: true, id: newId, inviteToken, expiresAt }, 201)
  } catch (error: any) {
    console.error('Create user error:', error)
    return c.json({ error: 'Failed to create user', details: error?.message || String(error) }, 500)
  }
})

// Update user
app.put('/api/organization/users/:id', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')
  const currentUserId = c.get('userId')
  const targetId = c.req.param('id')
  
  if (!orgId) return c.json({ error: 'Organization not found' }, 400)
  
  try {
    const body = await c.req.json()
    const { name, job_title, role, status } = body
    
    // Get current user data for audit log
    const oldUser = await db.prepare(`SELECT email, role, status FROM users_new WHERE id = ? AND organization_id = ?`).bind(targetId, orgId).first()
    
    const nameParts = (name || '').trim().split(/\s+/)
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''
    
    await db.prepare(`
      UPDATE users_new SET first_name = ?, last_name = ?, display_name = ?, job_title = ?, role = ?, status = ?, updated_at = datetime('now')
      WHERE id = ? AND organization_id = ?
    `).bind(firstName, lastName, name, job_title || null, role || 'viewer', status || 'active', targetId, orgId).run()
    
    // Audit log with changes
    const changes: string[] = []
    if (oldUser?.role !== role) changes.push(`role: ${oldUser?.role} → ${role}`)
    if (oldUser?.status !== status) changes.push(`status: ${oldUser?.status} → ${status}`)
    
    await db.prepare(`
      INSERT INTO audit_log (id, organization_id, user_id, action, entity_type, entity_id, details, created_at)
      VALUES (?, ?, ?, 'user_updated', 'user', ?, ?, datetime('now'))
    `).bind(
      'audit-' + crypto.randomUUID().slice(0, 12),
      orgId,
      currentUserId,
      targetId,
      JSON.stringify({ email: oldUser?.email, changes })
    ).run()
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Update user error:', error)
    return c.json({ error: 'Failed to update user' }, 500)
  }
})

// Delete user
app.delete('/api/organization/users/:id', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')
  const currentUserId = c.get('userId')
  const targetId = c.req.param('id')
  
  if (!orgId) return c.json({ error: 'Organization not found' }, 400)
  if (currentUserId === targetId) return c.json({ error: 'Cannot delete yourself' }, 400)
  
  try {
    // Get user info for audit log before deleting
    const user = await db.prepare(`SELECT email FROM users_new WHERE id = ? AND organization_id = ?`).bind(targetId, orgId).first()
    
    // Delete any invitation tokens for this user
    await db.prepare(`DELETE FROM invitation_tokens WHERE user_id = ?`).bind(targetId).run()
    
    // Actually delete the user (not just set inactive)
    await db.prepare(`DELETE FROM users_new WHERE id = ? AND organization_id = ?`).bind(targetId, orgId).run()
    
    // Audit log
    await db.prepare(`INSERT INTO audit_log (id, organization_id, user_id, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, 'user_deleted', 'user', ?, ?, datetime('now'))`).bind(
      'audit-' + crypto.randomUUID().slice(0, 12), 
      orgId, 
      currentUserId, 
      targetId,
      JSON.stringify({ email: user?.email || 'unknown' })
    ).run()
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Delete user error:', error)
    return c.json({ error: 'Failed to delete user' }, 500)
  }
})

// Regenerate invitation token for a user
app.post('/api/organization/users/:id/invite', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')
  const userId = c.get('userId')
  const targetId = c.req.param('id')
  
  if (!orgId) return c.json({ error: 'Organization not found' }, 400)
  
  try {
    // Check user exists and is pending
    const user = await db.prepare(`SELECT id, status, email, display_name FROM users_new WHERE id = ? AND organization_id = ?`).bind(targetId, orgId).first()
    if (!user) return c.json({ error: 'User not found' }, 404)
    
    // Invalidate any existing tokens for this user
    await db.prepare(`DELETE FROM invitation_tokens WHERE user_id = ?`).bind(targetId).run()
    
    // Generate new invitation token (valid for 48 hours)
    const inviteToken = crypto.randomUUID() + '-' + crypto.randomUUID().slice(0, 8)
    const tokenId = 'inv-' + crypto.randomUUID().slice(0, 12)
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    
    await db.prepare(`
      INSERT INTO invitation_tokens (id, user_id, organization_id, token, expires_at, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(tokenId, targetId, orgId, inviteToken, expiresAt, userId).run()
    
    // Reset user to pending if they were inactive
    if (user.status === 'inactive') {
      await db.prepare(`UPDATE users_new SET status = 'pending', updated_at = datetime('now') WHERE id = ?`).bind(targetId).run()
    }
    
    return c.json({ success: true, inviteToken, expiresAt, email: user.email, name: user.display_name })
  } catch (error) {
    console.error('Regenerate invite error:', error)
    return c.json({ error: 'Failed to regenerate invitation' }, 500)
  }
})

// Get invitation token for a user (for showing in UI)
app.get('/api/organization/users/:id/invite', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')
  const targetId = c.req.param('id')
  
  if (!orgId) return c.json({ error: 'Organization not found' }, 400)
  
  try {
    const token = await db.prepare(`
      SELECT token, expires_at, used_at FROM invitation_tokens 
      WHERE user_id = ? AND organization_id = ? AND used_at IS NULL
      ORDER BY created_at DESC LIMIT 1
    `).bind(targetId, orgId).first()
    
    if (!token) return c.json({ hasToken: false })
    
    const isExpired = new Date(token.expires_at) < new Date()
    return c.json({ hasToken: true, token: token.token, expiresAt: token.expires_at, isExpired })
  } catch (error) {
    console.error('Get invite error:', error)
    return c.json({ error: 'Failed to get invitation' }, 500)
  }
})

// Get activity log
app.get('/api/organization/activity', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')
  const limit = parseInt(c.req.query('limit') || '50')
  
  if (!orgId) return c.json({ error: 'Organization not found' }, 400)
  
  try {
    const activity = await db.prepare(`
      SELECT al.*, u.display_name as user_name, u.email as user_email
      FROM audit_log al LEFT JOIN users_new u ON al.user_id = u.id
      WHERE al.organization_id = ? ORDER BY al.created_at DESC LIMIT ?
    `).bind(orgId, limit).all()
    
    return c.json({ items: activity.results || [] })
  } catch (error) {
    console.error('Get activity error:', error)
    return c.json({ items: [] })
  }
})

// ============================================================================
// STATEMENT OF APPLICABILITY (SoA) GENERATOR
// ============================================================================

// Get Statement of Applicability for ISO 27001
app.get('/api/compliance/soa', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId') || c.req.query('org_id')
  const frameworkId = c.req.query('framework_id') || 'fw-iso27001'
  
  try {
    // Get all controls for the framework with their assessments and SoA entries
    const controls = await db.prepare(`
      SELECT 
        cl.id, cl.control_id, cl.control_number, cl.title, cl.description,
        cl.category, cl.subcategory, cl.is_critical, cl.weight,
        ca.implementation_status, ca.maturity_level, ca.evidence_description,
        ca.gaps_identified, ca.remediation_plan,
        soa.is_applicable as soa_applicable, soa.justification, soa.exclusion_reason
      FROM control_library cl
      LEFT JOIN control_assessments ca ON cl.id = ca.control_library_id AND ca.organization_id = ?
      LEFT JOIN soa_entries soa ON cl.id = soa.control_library_id AND soa.organization_id = ?
      WHERE cl.framework_id = ?
      ORDER BY cl.control_id
    `).bind(orgId, orgId, frameworkId).all()
    
    // Get organization profile for context
    const profile = await db.prepare(`
      SELECT company_name, industry, industry_sector FROM organization_profile WHERE organization_id = ?
    `).bind(orgId).first()
    
    // Calculate statistics
    const totalControls = controls.results?.length || 0
    const applicable = controls.results?.filter(c => c.soa_applicable !== 0).length || totalControls
    const notApplicable = totalControls - applicable
    const implemented = controls.results?.filter(c => c.implementation_status === 'implemented').length || 0
    const inProgress = controls.results?.filter(c => c.implementation_status === 'in_progress').length || 0
    const notStarted = controls.results?.filter(c => !c.implementation_status || c.implementation_status === 'not_started').length || 0
    
    // Group by category
    const categories: Record<string, any[]> = {}
    for (const ctrl of controls.results || []) {
      const cat = ctrl.category || 'Other'
      if (!categories[cat]) categories[cat] = []
      categories[cat].push({
        ...ctrl,
        is_applicable: ctrl.soa_applicable !== 0,
        status: ctrl.implementation_status || 'not_assessed'
      })
    }
    
    return c.json({
      organization: profile,
      framework: frameworkId,
      generated_at: new Date().toISOString(),
      statistics: {
        total_controls: totalControls,
        applicable,
        not_applicable: notApplicable,
        implemented,
        in_progress: inProgress,
        not_started: notStarted,
        compliance_percentage: applicable > 0 ? Math.round(implemented / applicable * 100) : 0
      },
      categories,
      controls: controls.results || []
    })
  } catch (error) {
    console.error('SoA error:', error)
    return c.json({ error: 'Failed to generate SoA', details: String(error) }, 500)
  }
})

// Update SoA entry (mark control as applicable/not applicable)
app.post('/api/compliance/soa', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId') || c.req.query('org_id')
  const body = await c.req.json()
  
  try {
    const { control_library_id, is_applicable, justification, exclusion_reason } = body
    
    if (!control_library_id) {
      return c.json({ error: 'control_library_id is required' }, 400)
    }
    
    // Upsert SoA entry
    const existing = await db.prepare(`
      SELECT id FROM soa_entries WHERE organization_id = ? AND control_library_id = ?
    `).bind(orgId, control_library_id).first()
    
    if (existing) {
      await db.prepare(`
        UPDATE soa_entries SET
          is_applicable = ?,
          justification = ?,
          exclusion_reason = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).bind(
        is_applicable ? 1 : 0,
        justification || null,
        exclusion_reason || null,
        existing.id
      ).run()
    } else {
      const newId = `soa-${crypto.randomUUID().slice(0, 8)}`
      await db.prepare(`
        INSERT INTO soa_entries (id, organization_id, control_library_id, is_applicable, justification, exclusion_reason)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(newId, orgId, control_library_id, is_applicable ? 1 : 0, justification, exclusion_reason).run()
    }
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Update SoA error:', error)
    return c.json({ error: 'Failed to update SoA', details: String(error) }, 500)
  }
})

// ============================================================================
// COMPLIANCE TREND & HISTORY APIs
// ============================================================================

// Get compliance trend data for charts
app.get('/api/compliance/trends', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId') || c.req.query('org_id')
  const frameworkId = c.req.query('framework_id') || 'fw-iso27001'
  const months = parseInt(c.req.query('months') || '6')
  
  try {
    // Get compliance snapshots
    const snapshots = await db.prepare(`
      SELECT 
        snapshot_date, basic_score, advanced_score, 
        implemented_count, in_progress_count, not_started_count,
        total_controls, avg_maturity
      FROM compliance_snapshots
      WHERE organization_id = ? AND framework_id = ?
      ORDER BY snapshot_date ASC
      LIMIT ?
    `).bind(orgId, frameworkId, months + 1).all()
    
    // Get domain trends
    const domainTrends = await db.prepare(`
      SELECT 
        snapshot_date, domain_name, basic_score, advanced_score,
        implemented_count, total_controls
      FROM domain_snapshots
      WHERE organization_id = ?
      ORDER BY snapshot_date ASC, domain_name
    `).bind(orgId).all()
    
    // Get risk trends
    const riskTrends = await db.prepare(`
      SELECT 
        snapshot_date, total_risks, open_risks, 
        critical_risks, high_risks, medium_risks, low_risks,
        total_exposure, avg_risk_score
      FROM risk_snapshots
      WHERE organization_id = ?
      ORDER BY snapshot_date ASC
      LIMIT ?
    `).bind(orgId, months + 1).all()
    
    // Calculate improvement metrics
    const complianceData = snapshots.results || []
    let improvement = 0
    let trend = 'stable'
    
    if (complianceData.length >= 2) {
      const latest = complianceData[complianceData.length - 1] as any
      const previous = complianceData[complianceData.length - 2] as any
      improvement = (latest?.basic_score || 0) - (previous?.basic_score || 0)
      trend = improvement > 0 ? 'improving' : improvement < 0 ? 'declining' : 'stable'
    }
    
    return c.json({
      compliance: complianceData,
      domains: domainTrends.results || [],
      risks: riskTrends.results || [],
      summary: {
        improvement,
        trend,
        dataPoints: complianceData.length
      }
    })
  } catch (error) {
    console.error('Get trends error:', error)
    return c.json({ error: 'Failed to get trends', details: String(error) }, 500)
  }
})

// Take a compliance snapshot (can be called manually or scheduled)
app.post('/api/compliance/snapshot', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId') || c.req.query('org_id')
  
  try {
    const today = new Date().toISOString().split('T')[0]
    
    // Get current compliance scores for each framework
    const frameworks = await db.prepare(`
      SELECT id, total_controls FROM compliance_frameworks_v2 WHERE is_active = 1
    `).all()
    
    for (const fw of (frameworks.results || []) as any[]) {
      // Calculate current scores for this framework
      const controls = await db.prepare(`
        SELECT 
          ca.implementation_status, ca.maturity_level, cl.is_critical
        FROM control_library cl
        LEFT JOIN control_assessments ca ON cl.id = ca.control_library_id AND ca.organization_id = ?
        WHERE cl.framework_id = ?
      `).bind(orgId, fw.id).all()
      
      const controlList = controls.results || []
      let implemented = 0, inProgress = 0, notStarted = 0, notApplicable = 0
      let totalMaturity = 0, maturityCount = 0
      
      for (const ctrl of controlList as any[]) {
        const status = ctrl.implementation_status || 'not_started'
        if (status === 'implemented') implemented++
        else if (status === 'in_progress') inProgress++
        else if (status === 'not_applicable') notApplicable++
        else notStarted++
        
        if (ctrl.maturity_level) {
          totalMaturity += ctrl.maturity_level
          maturityCount++
        }
      }
      
      const total = controlList.length
      const applicable = total - notApplicable
      const basicScore = applicable > 0 ? Math.round((implemented / applicable) * 100) : 0
      
      // Calculate advanced score
      let advancedTotal = 0, advancedImpl = 0
      for (const ctrl of controlList as any[]) {
        if (ctrl.implementation_status === 'not_applicable') continue
        const weight = ctrl.is_critical ? 2 : 1
        advancedTotal += weight
        if (ctrl.implementation_status === 'implemented') {
          const maturity = ctrl.maturity_level || 0
          const factor = 0.6 + (maturity / 5) * 0.4
          advancedImpl += weight * factor
        } else if (ctrl.implementation_status === 'in_progress') {
          advancedImpl += weight * 0.3
        }
      }
      const advancedScore = advancedTotal > 0 ? Math.round((advancedImpl / advancedTotal) * 100) : 0
      const avgMaturity = maturityCount > 0 ? Math.round((totalMaturity / maturityCount) * 10) / 10 : 0
      
      // Insert or update snapshot
      const snapId = `snap-${fw.id.replace('fw-', '')}-${today.replace(/-/g, '')}`
      await db.prepare(`
        INSERT OR REPLACE INTO compliance_snapshots 
        (id, organization_id, framework_id, snapshot_date, basic_score, advanced_score,
         implemented_count, in_progress_count, not_started_count, not_applicable_count,
         total_controls, avg_maturity, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        snapId, orgId, fw.id, today, basicScore, advancedScore,
        implemented, inProgress, notStarted, notApplicable, total, avgMaturity
      ).run()
    }
    
    // Take domain snapshots (ISO 27001 domains)
    const domains = ['Organizational', 'People', 'Physical', 'Technological']
    for (const domain of domains) {
      const domainControls = await db.prepare(`
        SELECT ca.implementation_status, ca.maturity_level, cl.is_critical
        FROM control_library cl
        LEFT JOIN control_assessments ca ON cl.id = ca.control_library_id AND ca.organization_id = ?
        WHERE cl.framework_id = 'fw-iso27001' AND cl.category = ?
      `).bind(orgId, domain).all()
      
      const ctrlList = domainControls.results || []
      let impl = 0
      for (const ctrl of ctrlList as any[]) {
        if (ctrl.implementation_status === 'implemented') impl++
      }
      const total = ctrlList.length
      const score = total > 0 ? Math.round((impl / total) * 100) : 0
      
      const dSnapId = `dsnap-${domain.toLowerCase().substring(0,3)}-${today.replace(/-/g, '')}`
      await db.prepare(`
        INSERT OR REPLACE INTO domain_snapshots
        (id, organization_id, snapshot_date, domain_name, basic_score, implemented_count, total_controls, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(dSnapId, orgId, today, domain, score, impl, total).run()
    }
    
    // Take risk snapshot
    const riskStats = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_count,
        SUM(CASE WHEN inherent_score >= 80 THEN 1 ELSE 0 END) as critical,
        SUM(CASE WHEN inherent_score >= 60 AND inherent_score < 80 THEN 1 ELSE 0 END) as high,
        SUM(CASE WHEN inherent_score >= 40 AND inherent_score < 60 THEN 1 ELSE 0 END) as medium,
        SUM(CASE WHEN inherent_score < 40 THEN 1 ELSE 0 END) as low,
        COALESCE(SUM(financial_exposure), 0) as total_exposure,
        COALESCE(AVG(inherent_score), 0) as avg_score
      FROM risk_items WHERE organization_id = ?
    `).bind(orgId).first() as any
    
    const rSnapId = `rsnap-${today.replace(/-/g, '')}`
    await db.prepare(`
      INSERT OR REPLACE INTO risk_snapshots
      (id, organization_id, snapshot_date, total_risks, open_risks, critical_risks,
       high_risks, medium_risks, low_risks, total_exposure, avg_risk_score, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      rSnapId, orgId, today, 
      riskStats?.total || 0, riskStats?.open_count || 0, riskStats?.critical || 0,
      riskStats?.high || 0, riskStats?.medium || 0, riskStats?.low || 0,
      riskStats?.total_exposure || 0, Math.round(riskStats?.avg_score || 0)
    ).run()
    
    return c.json({ success: true, snapshot_date: today })
  } catch (error) {
    console.error('Snapshot error:', error)
    return c.json({ error: 'Failed to create snapshot', details: String(error) }, 500)
  }
})

// Export SoA as JSON (downloadable)
app.get('/api/compliance/soa/export', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId') || c.req.query('org_id')
  const format = c.req.query('format') || 'json'
  
  try {
    // Get full SoA data
    const controls = await db.prepare(`
      SELECT 
        cl.control_id, cl.control_number, cl.title, cl.description,
        cl.category, cl.subcategory,
        ca.implementation_status, ca.maturity_level, ca.evidence_description,
        ca.gaps_identified, ca.remediation_plan, ca.assessment_date,
        COALESCE(soa.is_applicable, 1) as is_applicable, 
        soa.justification, soa.exclusion_reason
      FROM control_library cl
      LEFT JOIN control_assessments ca ON cl.id = ca.control_library_id AND ca.organization_id = ?
      LEFT JOIN soa_entries soa ON cl.id = soa.control_library_id AND soa.organization_id = ?
      WHERE cl.framework_id = 'fw-iso27001'
      ORDER BY cl.control_id
    `).bind(orgId, orgId).all()
    
    const profile = await db.prepare(`
      SELECT * FROM organization_profile WHERE organization_id = ?
    `).bind(orgId).first()
    
    const exportData = {
      title: 'ISO 27001:2022 Statement of Applicability',
      organization: profile?.company_name || 'Unknown Organization',
      generated_at: new Date().toISOString(),
      version: '1.0',
      controls: controls.results?.map(ctrl => ({
        control_id: ctrl.control_id,
        control_number: ctrl.control_number,
        title: ctrl.title,
        description: ctrl.description,
        category: ctrl.category,
        is_applicable: ctrl.is_applicable === 1,
        justification: ctrl.justification,
        exclusion_reason: ctrl.exclusion_reason,
        implementation_status: ctrl.implementation_status || 'not_assessed',
        maturity_level: ctrl.maturity_level || 0,
        evidence: ctrl.evidence_description,
        gaps: ctrl.gaps_identified,
        remediation: ctrl.remediation_plan,
        last_assessed: ctrl.assessment_date
      })) || []
    }
    
    if (format === 'csv') {
      // Generate CSV
      const headers = ['Control ID', 'Title', 'Category', 'Applicable', 'Justification', 'Exclusion Reason', 'Status', 'Maturity', 'Evidence', 'Gaps', 'Remediation']
      const rows = exportData.controls.map(c => [
        c.control_id, c.title, c.category, c.is_applicable ? 'Yes' : 'No',
        c.justification || '', c.exclusion_reason || '', c.implementation_status,
        c.maturity_level, c.evidence || '', c.gaps || '', c.remediation || ''
      ])
      
      const csv = [headers.join(','), ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n')
      
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="soa-iso27001-${orgId}.csv"`
        }
      })
    }
    
    return c.json(exportData)
  } catch (error) {
    console.error('Export SoA error:', error)
    return c.json({ error: 'Failed to export SoA', details: String(error) }, 500)
  }
})

// ============================================================================
// CONTROL-RISK-ASSET LINKING API
// Phase 6: Connect controls to risks and assets for mitigation tracking
// ============================================================================

// Get all control-risk mappings for an organization
app.get('/api/control-risk-mappings', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId') || c.req.query('org_id')
  const controlId = c.req.query('control_id')
  const riskId = c.req.query('risk_id')
  
  try {
    let query = `
      SELECT 
        crm.*,
        cl.control_id as control_code, cl.title as control_title, cl.category as control_category,
        ri.title as risk_title, ri.status as risk_status, ri.risk_source
      FROM control_risk_mappings crm
      LEFT JOIN control_library cl ON crm.control_id = cl.id
      LEFT JOIN risk_items ri ON crm.risk_id = ri.id
      WHERE crm.organization_id = ?
    `
    const params: string[] = [orgId]
    
    if (controlId) {
      query += ' AND crm.control_id = ?'
      params.push(controlId)
    }
    if (riskId) {
      query += ' AND crm.risk_id = ?'
      params.push(riskId)
    }
    
    query += ' ORDER BY crm.created_at DESC'
    
    const mappings = await db.prepare(query).bind(...params).all()
    
    return c.json({
      success: true,
      mappings: mappings.results || [],
      total: mappings.results?.length || 0
    })
  } catch (error) {
    console.error('Get control-risk mappings error:', error)
    return c.json({ error: 'Failed to load mappings', details: String(error) }, 500)
  }
})

// Get control-risk summary statistics
app.get('/api/control-risk-mappings/summary', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId') || c.req.query('org_id')
  const riskSource = c.req.query('risk_source') // Filter by risk source
  
  try {
    // Get counts by mapping type
    const byType = await db.prepare(`
      SELECT mapping_type, COUNT(*) as count
      FROM control_risk_mappings
      WHERE organization_id = ?
      GROUP BY mapping_type
    `).bind(orgId).all()
    
    // Get counts by effectiveness
    const byEffectiveness = await db.prepare(`
      SELECT effectiveness, COUNT(*) as count
      FROM control_risk_mappings
      WHERE organization_id = ?
      GROUP BY effectiveness
    `).bind(orgId).all()
    
    // Get risks with most linked controls (filtered by source if specified)
    let topLinkedRisksQuery = `
      SELECT ri.id, ri.title, ri.status, ri.risk_source, COUNT(crm.id) as control_count
      FROM risk_items ri
      LEFT JOIN control_risk_mappings crm ON ri.id = crm.risk_id AND crm.organization_id = ?
      WHERE ri.organization_id = ?
      ${riskSource && riskSource !== 'all' ? 'AND ri.risk_source = ?' : ''}
      GROUP BY ri.id
      HAVING control_count > 0
      ORDER BY control_count DESC
      LIMIT 5
    `
    const topLinkedRisks = riskSource && riskSource !== 'all' 
      ? await db.prepare(topLinkedRisksQuery).bind(orgId, orgId, riskSource).all()
      : await db.prepare(topLinkedRisksQuery).bind(orgId, orgId).all()
    
    // Get controls linked to most risks
    const topLinkedControls = await db.prepare(`
      SELECT cl.id, cl.control_id, cl.title, COUNT(crm.id) as risk_count
      FROM control_library cl
      LEFT JOIN control_risk_mappings crm ON cl.id = crm.control_id AND crm.organization_id = ?
      WHERE cl.framework_id = 'fw-iso27001'
      GROUP BY cl.id
      HAVING risk_count > 0
      ORDER BY risk_count DESC
      LIMIT 5
    `).bind(orgId).all()
    
    // Get unlinked open risks (risks without control mappings) - filtered by source if specified
    let unlinkedRisksQuery = `
      SELECT ri.id, ri.title, ri.status, ri.risk_source
      FROM risk_items ri
      WHERE ri.organization_id = ?
      AND ri.status IN ('open', 'in_progress')
      ${riskSource && riskSource !== 'all' ? 'AND ri.risk_source = ?' : ''}
      AND ri.id NOT IN (
        SELECT DISTINCT risk_id FROM control_risk_mappings WHERE organization_id = ?
      )
    `
    const unlinkedRisks = riskSource && riskSource !== 'all'
      ? await db.prepare(unlinkedRisksQuery).bind(orgId, riskSource, orgId).all()
      : await db.prepare(unlinkedRisksQuery).bind(orgId, orgId).all()
    
    // Get total counts
    const totalMappings = await db.prepare(`
      SELECT COUNT(*) as count FROM control_risk_mappings WHERE organization_id = ?
    `).bind(orgId).first()
    
    const totalLinkedControls = await db.prepare(`
      SELECT COUNT(DISTINCT control_id) as count FROM control_risk_mappings WHERE organization_id = ?
    `).bind(orgId).first()
    
    const totalLinkedRisks = await db.prepare(`
      SELECT COUNT(DISTINCT risk_id) as count FROM control_risk_mappings WHERE organization_id = ?
    `).bind(orgId).first()
    
    return c.json({
      success: true,
      summary: {
        totalMappings: totalMappings?.count || 0,
        totalLinkedControls: totalLinkedControls?.count || 0,
        totalLinkedRisks: totalLinkedRisks?.count || 0,
        byType: byType.results || [],
        byEffectiveness: byEffectiveness.results || [],
        topLinkedRisks: topLinkedRisks.results || [],
        topLinkedControls: topLinkedControls.results || [],
        unlinkedRisks: unlinkedRisks.results || []
      }
    })
  } catch (error) {
    console.error('Get control-risk summary error:', error)
    return c.json({ error: 'Failed to load summary', details: String(error) }, 500)
  }
})

// Create a new control-risk mapping
app.post('/api/control-risk-mappings', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId') || c.req.query('org_id')
  
  try {
    const { control_id, risk_id, mapping_type, effectiveness, confidence_score, notes } = await c.req.json()
    
    if (!control_id || !risk_id) {
      return c.json({ error: 'control_id and risk_id are required' }, 400)
    }
    
    const id = `crm-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`
    
    await db.prepare(`
      INSERT INTO control_risk_mappings 
      (id, organization_id, control_id, risk_id, mapping_type, effectiveness, confidence_score, notes, is_auto_suggested)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).bind(
      id, orgId, control_id, risk_id,
      mapping_type || 'mitigates',
      effectiveness || 'partial',
      confidence_score || 80,
      notes || null
    ).run()
    
    // AUTO-SYNC: Recalculate control implementation status based on linked risks
    const statusUpdate = await recalculateControlStatus(db, control_id, orgId)
    
    return c.json({ 
      success: true, 
      id, 
      message: 'Control-risk mapping created',
      control_status_sync: statusUpdate
    })
  } catch (error) {
    console.error('Create control-risk mapping error:', error)
    if (String(error).includes('UNIQUE constraint')) {
      return c.json({ error: 'This control-risk mapping already exists' }, 409)
    }
    return c.json({ error: 'Failed to create mapping', details: String(error) }, 500)
  }
})

// Update a control-risk mapping
app.patch('/api/control-risk-mappings/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  
  try {
    const { mapping_type, effectiveness, confidence_score, notes } = await c.req.json()
    
    await db.prepare(`
      UPDATE control_risk_mappings 
      SET mapping_type = COALESCE(?, mapping_type),
          effectiveness = COALESCE(?, effectiveness),
          confidence_score = COALESCE(?, confidence_score),
          notes = COALESCE(?, notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(mapping_type, effectiveness, confidence_score, notes, id).run()
    
    return c.json({ success: true, message: 'Mapping updated' })
  } catch (error) {
    console.error('Update control-risk mapping error:', error)
    return c.json({ error: 'Failed to update mapping', details: String(error) }, 500)
  }
})

// Delete a control-risk mapping
app.delete('/api/control-risk-mappings/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const orgId = c.get('orgId') || c.req.query('org_id')
  
  try {
    // Get the control_id before deleting so we can recalculate its status
    const mapping = await db.prepare('SELECT control_id FROM control_risk_mappings WHERE id = ?').bind(id).first()
    
    await db.prepare('DELETE FROM control_risk_mappings WHERE id = ?').bind(id).run()
    
    // AUTO-SYNC: Recalculate control status after removing the mapping
    let controlSync = null
    if (mapping?.control_id) {
      controlSync = await recalculateControlStatus(db, mapping.control_id as string, orgId)
    }
    
    return c.json({ success: true, message: 'Mapping deleted', control_status_sync: controlSync })
  } catch (error) {
    console.error('Delete control-risk mapping error:', error)
    return c.json({ error: 'Failed to delete mapping', details: String(error) }, 500)
  }
})

// Manually sync all control statuses based on linked risks
// Enhanced with detailed reporting and threshold-based logic
app.post('/api/controls/sync-risk-status', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId') || c.req.query('org_id')
  
  try {
    // Get all controls that have risk mappings
    const controlsWithMappings = await db.prepare(`
      SELECT DISTINCT crm.control_id, cl.control_id as control_code, cl.title
      FROM control_risk_mappings crm
      JOIN control_library cl ON crm.control_id = cl.id
      WHERE crm.organization_id = ?
    `).bind(orgId).all()
    
    const results: any[] = []
    let totalUpdated = 0
    let totalWarnings = 0
    let totalManualOverrides = 0
    
    // Summary by status change type
    const statusChanges = {
      upgraded: [] as string[],    // Status improved (risks closed)
      downgraded: [] as string[],  // Status degraded (risks opened)
      unchanged: [] as string[],   // No change
      warned: [] as string[]       // Below threshold but has warnings
    }
    
    for (const ctrl of (controlsWithMappings.results || [])) {
      const result = await recalculateControlStatus(db, ctrl.control_id, orgId)
      
      // Categorize the result
      // ADVISORY MODE: Track recommendations, not status changes
      if (result.needsReview) {
        statusChanges.warned.push(ctrl.control_code)  // Controls needing review
      } else if (result.openRisks > 0) {
        totalWarnings++  // Has findings but not critical
      } else {
        statusChanges.unchanged.push(ctrl.control_code)  // No issues
      }
      
      if (result.manualOverrideActive) {
        totalManualOverrides++
      }
      
      results.push({
        control_id: ctrl.control_id,
        control_code: ctrl.control_code,
        title: ctrl.title,
        ...result
      })
    }
    
    // Calculate compliance impact
    const complianceStats = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN implementation_status = 'implemented' THEN 1 ELSE 0 END) as implemented
      FROM control_assessments WHERE organization_id = ?
    `).bind(orgId).first() as any
    
    const complianceScore = complianceStats?.total > 0 
      ? Math.round((complianceStats.implemented / complianceStats.total) * 100)
      : 0
    
    // Count controls needing review (open risks on implemented controls)
    const controlsNeedingReview = results.filter(r => r.needsReview).length
    
    return c.json({
      success: true,
      message: `Analyzed ${controlsWithMappings.results?.length || 0} controls (Advisory Mode)`,
      mode: 'advisory',  // Indicate this is advisory only, no auto-changes
      summary: {
        total_controls: controlsWithMappings.results?.length || 0,
        controls_updated: 0,  // Always 0 in advisory mode
        controls_needing_review: controlsNeedingReview,
        controls_with_warnings: totalWarnings,
        manual_overrides_active: totalManualOverrides,
        status_changes: {
          upgraded: 0,  // No auto-upgrades in advisory mode
          downgraded: 0,  // No auto-downgrades in advisory mode
          warned_only: statusChanges.warned.length,
          unchanged: statusChanges.unchanged.length
        },
        controls_need_attention: statusChanges.warned,  // List of controls needing review
        no_issues: statusChanges.unchanged
      },
      compliance_impact: {
        current_score: complianceScore,
        implemented_controls: complianceStats?.implemented || 0,
        total_controls: complianceStats?.total || 0
      },
      advisory_note: 'Gap Assessment is a manual process. Control statuses are not changed automatically. Review the findings and update controls in Gap Assessment as needed.',
      thresholds: {
        critical: '≥50% weighted open risks → Review Strongly Recommended',
        warning: '≥30% weighted open risks → Review Suggested',
        monitor: '<30% weighted open risks → Monitor Progress'
      },
      details: results
    })
  } catch (error) {
    console.error('Sync control status error:', error)
    return c.json({ error: 'Failed to sync control statuses', details: String(error) }, 500)
  }
})

// Toggle manual override for a control assessment
// When enabled, auto-sync will not change the control status
app.post('/api/control-assessments/:id/toggle-override', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId') || c.req.query('org_id')
  const assessmentId = c.req.param('id')
  
  try {
    // Get current state
    const current = await db.prepare(`
      SELECT ca.id, ca.manual_override, ca.implementation_status, cl.control_id, cl.title
      FROM control_assessments ca
      JOIN control_library cl ON ca.control_library_id = cl.id
      WHERE ca.id = ? AND ca.organization_id = ?
    `).bind(assessmentId, orgId).first() as any
    
    if (!current) {
      return c.json({ error: 'Control assessment not found' }, 404)
    }
    
    const newOverride = current.manual_override === 1 ? 0 : 1
    
    await db.prepare(`
      UPDATE control_assessments 
      SET manual_override = ?,
          updated_at = datetime('now'),
          notes = COALESCE(notes || ' | ', '') || ?
      WHERE id = ?
    `).bind(
      newOverride,
      `[${new Date().toISOString().split('T')[0]}] Manual override ${newOverride ? 'ENABLED' : 'DISABLED'}`,
      assessmentId
    ).run()
    
    // Log to audit (use NULL for user_id to avoid FK constraint)
    await db.prepare(`
      INSERT INTO audit_logs (id, organization_id, user_id, action, resource_type, resource_id, previous_state, new_state, status, created_at)
      VALUES (?, ?, NULL, 'toggle_manual_override', 'control_assessment', ?, ?, ?, 'success', datetime('now'))
    `).bind(
      'audit-' + crypto.randomUUID().slice(0, 12),
      orgId,
      assessmentId,
      JSON.stringify({ manual_override: current.manual_override }),
      JSON.stringify({ manual_override: newOverride })
    ).run()
    
    return c.json({
      success: true,
      control_id: current.control_id,
      title: current.title,
      manual_override: newOverride === 1,
      message: newOverride ? 'Manual override enabled - auto-sync will not change this control status' : 'Manual override disabled - auto-sync will manage this control status'
    })
  } catch (error) {
    console.error('Toggle override error:', error)
    return c.json({ error: 'Failed to toggle override', details: String(error) }, 500)
  }
})

// Get auto-suggestions for control-risk mappings
app.get('/api/control-risk-mappings/suggestions', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId') || c.req.query('org_id')
  const riskId = c.req.query('risk_id')
  const riskSource = c.req.query('risk_source') // Filter by risk source (e.g., 'penetration_test', 'vulnerability_scan')
  
  try {
    // Get all open/in_progress risks, optionally filtered by source
    let risks
    if (riskId) {
      risks = await db.prepare(`
        SELECT id, title, description, category, risk_source FROM risk_items 
        WHERE id = ? AND organization_id = ?
      `).bind(riskId, orgId).all()
    } else if (riskSource && riskSource !== 'all') {
      risks = await db.prepare(`
        SELECT id, title, description, category, risk_source FROM risk_items 
        WHERE organization_id = ? AND status IN ('open', 'in_progress') AND risk_source = ?
      `).bind(orgId, riskSource).all()
    } else {
      risks = await db.prepare(`
        SELECT id, title, description, category, risk_source FROM risk_items 
        WHERE organization_id = ? AND status IN ('open', 'in_progress')
      `).bind(orgId).all()
    }
    
    // Get suggestion rules
    const rules = await db.prepare(`
      SELECT * FROM control_risk_suggestions ORDER BY suggestion_weight DESC
    `).all()
    
    // Get all ISO 27001 controls with their assessment status
    const controls = await db.prepare(`
      SELECT cl.id, cl.control_id, cl.title, cl.category, cl.subcategory,
             ca.implementation_status
      FROM control_library cl
      LEFT JOIN control_assessments ca ON cl.id = ca.control_library_id AND ca.organization_id = ?
      WHERE cl.framework_id = 'fw-iso27001'
    `).bind(orgId).all()
    
    // Get existing mappings
    const existingMappings = await db.prepare(`
      SELECT control_id, risk_id FROM control_risk_mappings WHERE organization_id = ?
    `).bind(orgId).all()
    const existingSet = new Set((existingMappings.results || []).map(m => `${m.control_id}:${m.risk_id}`))
    
    const suggestions: any[] = []
    
    for (const risk of (risks.results || [])) {
      const riskTitle = (risk.title || '').toLowerCase()
      const riskCategory = risk.category || ''
      
      for (const rule of (rules.results || [])) {
        const keywords = (rule.risk_keywords || '').toLowerCase().split(',').map((k: string) => k.trim())
        
        // Check if risk matches any keywords
        const matchesKeyword = keywords.some((kw: string) => riskTitle.includes(kw))
        const matchesCategory = riskCategory.toLowerCase() === (rule.risk_category || '').toLowerCase()
        
        if (matchesKeyword || matchesCategory) {
          // Find controls matching this rule's category
          const matchingControls = (controls.results || []).filter(ctrl => {
            const ctrlCategory = (ctrl.category || '').toLowerCase()
            const ctrlSubcategory = (ctrl.subcategory || '').toLowerCase()
            const ruleCategory = (rule.control_category || '').toLowerCase()
            const ruleSubcategory = (rule.control_subcategory || '').toLowerCase()
            
            return ctrlCategory.includes(ruleCategory) || 
                   (ruleSubcategory && ctrlSubcategory.includes(ruleSubcategory))
          })
          
          for (const ctrl of matchingControls) {
            // Skip if mapping already exists
            if (existingSet.has(`${ctrl.id}:${risk.id}`)) continue
            
            suggestions.push({
              risk_id: risk.id,
              risk_title: risk.title,
              risk_source: risk.risk_source, // Include risk source for filtering/display
              control_id: ctrl.id,
              control_code: ctrl.control_id,
              control_title: ctrl.title,
              control_category: ctrl.category,
              implementation_status: ctrl.implementation_status || 'not_started',
              suggestion_weight: rule.suggestion_weight,
              reason: matchesKeyword ? `Keyword match: ${keywords.find((k: string) => riskTitle.includes(k))}` : `Category match: ${riskCategory}`
            })
          }
        }
      }
    }
    
    // Sort by weight and deduplicate
    const uniqueSuggestions = suggestions
      .sort((a, b) => b.suggestion_weight - a.suggestion_weight)
      .filter((s, i, arr) => arr.findIndex(x => x.control_id === s.control_id && x.risk_id === s.risk_id) === i)
      .slice(0, 20)
    
    return c.json({
      success: true,
      suggestions: uniqueSuggestions,
      total: uniqueSuggestions.length
    })
  } catch (error) {
    console.error('Get suggestions error:', error)
    return c.json({ error: 'Failed to get suggestions', details: String(error) }, 500)
  }
})

// Apply a suggestion (create mapping from suggestion)
app.post('/api/control-risk-mappings/apply-suggestion', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId') || c.req.query('org_id')
  
  try {
    const { control_id, risk_id, confidence_score } = await c.req.json()
    
    if (!control_id || !risk_id) {
      return c.json({ error: 'control_id and risk_id are required' }, 400)
    }
    
    const id = `crm-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`
    
    await db.prepare(`
      INSERT INTO control_risk_mappings 
      (id, organization_id, control_id, risk_id, mapping_type, effectiveness, confidence_score, is_auto_suggested)
      VALUES (?, ?, ?, ?, 'mitigates', 'partial', ?, 1)
    `).bind(id, orgId, control_id, risk_id, confidence_score || 75).run()
    
    // AUTO-SYNC: Recalculate control implementation status based on linked risks
    const statusUpdate = await recalculateControlStatus(db, control_id, orgId)
    
    return c.json({ success: true, id, message: 'Suggestion applied', control_status_sync: statusUpdate })
  } catch (error) {
    console.error('Apply suggestion error:', error)
    if (String(error).includes('UNIQUE constraint')) {
      return c.json({ error: 'This mapping already exists' }, 409)
    }
    return c.json({ error: 'Failed to apply suggestion', details: String(error) }, 500)
  }
})

// Get risk details with linked controls
app.get('/api/risks/:id/controls', async (c) => {
  const db = c.env.DB
  const riskId = c.req.param('id')
  const orgId = c.get('orgId') || c.req.query('org_id')
  
  try {
    // Get risk details
    const risk = await db.prepare(`
      SELECT * FROM risk_items WHERE id = ? AND organization_id = ?
    `).bind(riskId, orgId).first()
    
    if (!risk) {
      return c.json({ error: 'Risk not found' }, 404)
    }
    
    // Get linked controls
    const linkedControls = await db.prepare(`
      SELECT 
        crm.*,
        cl.control_id as control_code, cl.title as control_title, 
        cl.category, cl.description as control_description,
        ca.implementation_status, ca.maturity_level
      FROM control_risk_mappings crm
      JOIN control_library cl ON crm.control_id = cl.id
      LEFT JOIN control_assessments ca ON cl.id = ca.control_library_id AND ca.organization_id = ?
      WHERE crm.risk_id = ? AND crm.organization_id = ?
      ORDER BY crm.confidence_score DESC
    `).bind(orgId, riskId, orgId).all()
    
    // Calculate mitigation score based on linked controls
    const controls = linkedControls.results || []
    let mitigationScore = 0
    let implementedControls = 0
    
    for (const ctrl of controls) {
      const effectivenessMultiplier = ctrl.effectiveness === 'full' ? 1.0 : ctrl.effectiveness === 'partial' ? 0.6 : 0.3
      const statusMultiplier = ctrl.implementation_status === 'implemented' ? 1.0 : ctrl.implementation_status === 'in_progress' ? 0.5 : 0
      
      mitigationScore += (ctrl.confidence_score / 100) * effectivenessMultiplier * statusMultiplier * 100
      if (ctrl.implementation_status === 'implemented') implementedControls++
    }
    
    mitigationScore = Math.min(100, Math.round(mitigationScore / Math.max(1, controls.length)))
    
    return c.json({
      success: true,
      risk,
      linkedControls: controls,
      mitigationStats: {
        totalLinkedControls: controls.length,
        implementedControls,
        mitigationScore,
        mitigationLevel: mitigationScore >= 80 ? 'high' : mitigationScore >= 50 ? 'medium' : 'low'
      }
    })
  } catch (error) {
    console.error('Get risk controls error:', error)
    return c.json({ error: 'Failed to load risk controls', details: String(error) }, 500)
  }
})

// Get control details with linked risks
app.get('/api/controls/:id/risks', async (c) => {
  const db = c.env.DB
  const controlId = c.req.param('id')
  const orgId = c.get('orgId') || c.req.query('org_id')
  
  try {
    // Get control details
    const control = await db.prepare(`
      SELECT cl.*, ca.implementation_status, ca.maturity_level
      FROM control_library cl
      LEFT JOIN control_assessments ca ON cl.id = ca.control_library_id AND ca.organization_id = ?
      WHERE cl.id = ?
    `).bind(orgId, controlId).first()
    
    if (!control) {
      return c.json({ error: 'Control not found' }, 404)
    }
    
    // Get linked risks
    const linkedRisks = await db.prepare(`
      SELECT 
        crm.*,
        ri.title as risk_title, ri.description as risk_description,
        ri.status as risk_status, ri.risk_source, ri.category as risk_category,
        ri.inherent_likelihood, ri.inherent_impact
      FROM control_risk_mappings crm
      JOIN risk_items ri ON crm.risk_id = ri.id
      WHERE crm.control_id = ? AND crm.organization_id = ?
      ORDER BY ri.status, crm.created_at DESC
    `).bind(controlId, orgId).all()
    
    return c.json({
      success: true,
      control,
      linkedRisks: linkedRisks.results || [],
      stats: {
        totalLinkedRisks: linkedRisks.results?.length || 0,
        openRisks: (linkedRisks.results || []).filter(r => r.risk_status === 'open').length,
        inProgressRisks: (linkedRisks.results || []).filter(r => r.risk_status === 'in_progress').length
      }
    })
  } catch (error) {
    console.error('Get control risks error:', error)
    return c.json({ error: 'Failed to load control risks', details: String(error) }, 500)
  }
})

// ============================================================================
// ASSET SYNC FROM PENTEST PULSE
// ============================================================================

// Receive asset data from Pentest Pulse
app.post('/api/external/assets/pentest', async (c) => {
  const db = c.env.DB
  
  try {
    const { action, asset } = await c.req.json()
    
    // Validate source header
    const sourceApp = c.req.header('X-Source-App')
    if (sourceApp !== 'pentest-pulse') {
      return c.json({ error: 'Invalid source' }, 403)
    }
    
    if (!asset || !asset.source_ref) {
      return c.json({ error: 'Missing asset data or source_ref' }, 400)
    }
    
    // Handle delete action
    if (action === 'delete') {
      await db.prepare(`
        DELETE FROM assets 
        WHERE external_id LIKE ?
      `).bind(`pentest:%${asset.source_ref}%`).run()
      
      return c.json({ success: true, action: 'deleted' })
    }
    
    // Map Pentest Pulse asset type to GRCpulse asset_type
    const typeMap: Record<string, string> = {
      'server': 'server',
      'database': 'database',
      'application': 'application',
      'web_application': 'application',
      'api': 'application',
      'mobile_app': 'application',
      'network_device': 'network_device',
      'endpoint': 'endpoint',
      'cloud_service': 'serverless',
      'data_store': 'storage'
    }
    
    // Map cloud provider
    const cloudMap: Record<string, string> = {
      'aws': 'aws',
      'azure': 'azure',
      'gcp': 'gcp',
      'on-premise': 'on_premise',
      'hybrid': 'hybrid'
    }
    
    // Check if asset already exists (upsert logic)
    const existing = await db.prepare(`
      SELECT id FROM assets 
      WHERE external_id LIKE ?
    `).bind(`pentest:%${asset.source_ref}%`).first()
    
    if (existing) {
      // UPDATE existing asset
      await db.prepare(`
        UPDATE assets SET
          name = ?,
          description = ?,
          asset_type = ?,
          cloud_provider = ?,
          criticality = ?,
          data_classification = ?,
          ip_address = ?,
          hostname = ?,
          owner_team = ?,
          tags = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).bind(
        asset.name,
        asset.description || null,
        typeMap[asset.type] || 'other',
        cloudMap[asset.cloud_provider] || null,
        asset.criticality || 'medium',
        asset.data_classification || 'internal',
        asset.ip_address || null,
        asset.hostname || null,
        asset.business_unit || null,
        JSON.stringify({ 
          source: 'pentest_pulse',
          url: asset.url,
          original_type: asset.type,
          pentest_tags: asset.tags,
          pentest_findings_count: asset.findings_count || 0
        }),
        existing.id
      ).run()
      
      return c.json({ 
        success: true, 
        action: 'updated', 
        asset_id: existing.id 
      })
    } else {
      // INSERT new asset
      const newId = `asset-pt-${crypto.randomUUID().slice(0, 8)}`
      
      await db.prepare(`
        INSERT INTO assets (
          id, organization_id, external_id, name, description,
          asset_type, cloud_provider, criticality, data_classification,
          ip_address, hostname, owner_team, status, tags,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(
        newId,
        asset.organization_id || orgId,
        `pentest:${asset.source_ref}`,
        asset.name,
        asset.description || null,
        typeMap[asset.type] || 'other',
        cloudMap[asset.cloud_provider] || null,
        asset.criticality || 'medium',
        asset.data_classification || 'internal',
        asset.ip_address || null,
        asset.hostname || null,
        asset.business_unit || null,
        'active',
        JSON.stringify({ 
          source: 'pentest_pulse',
          url: asset.url,
          original_type: asset.type,
          pentest_tags: asset.tags,
          pentest_findings_count: asset.findings_count || 0
        })
      ).run()
      
      return c.json({ 
        success: true, 
        action: 'created', 
        asset_id: newId 
      })
    }
  } catch (error) {
    console.error('Asset sync error:', error)
    return c.json({ 
      error: 'Asset sync failed', 
      details: String(error) 
    }, 500)
  }
})

// Get asset sync statistics
app.get('/api/sync/pentest/assets/stats', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId') || c.req.query('org_id')
  
  try {
    const stats = await db.prepare(`
      SELECT 
        COUNT(*) as total_synced,
        SUM(CASE WHEN criticality = 'critical' THEN 1 ELSE 0 END) as critical,
        SUM(CASE WHEN criticality = 'high' THEN 1 ELSE 0 END) as high,
        SUM(CASE WHEN criticality = 'medium' THEN 1 ELSE 0 END) as medium,
        SUM(CASE WHEN criticality = 'low' THEN 1 ELSE 0 END) as low,
        MAX(updated_at) as last_sync
      FROM assets 
      WHERE organization_id = ? AND external_id LIKE 'pentest:%'
    `).bind(orgId).first()
    
    return c.json({
      source: 'pentest_pulse',
      stats
    })
  } catch (error) {
    return c.json({ error: 'Failed to get stats', details: String(error) }, 500)
  }
})

// List all pentest-sourced assets
app.get('/api/assets/pentest', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId') || c.req.query('org_id')
  
  try {
    const result = await db.prepare(`
      SELECT * FROM assets 
      WHERE organization_id = ? AND external_id LIKE 'pentest:%'
      ORDER BY criticality DESC, created_at DESC
    `).bind(orgId).all()
    
    return c.json(result.results || [])
  } catch (error) {
    return c.json({ error: 'Failed to fetch assets', details: String(error) }, 500)
  }
})

// ============================================================================
// PENTEST PULSE SYNC - Pull findings
// ============================================================================

// Sync findings from PentestPulse (can be triggered from GRC Pulse UI)
app.post('/api/sync/pentest-pulse', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId') || c.req.query('org_id')
  
  try {
    // Call PentestPulse to push findings to us
    const response = await fetch('https://pentest-pulse.pages.dev/api/sync/grc-pulse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Source-App': 'grc-pulse',
        'X-Target-URL': 'https://grc-pulse.pages.dev/api/external/risks/pentest'
      },
      body: JSON.stringify({ target: 'grc-pulse', organization_id: orgId })
    })
    
    if (response.ok) {
      const result = await response.json()
      return c.json({ success: true, message: 'Sync initiated', details: result })
    } else {
      return c.json({ success: false, message: 'PentestPulse sync endpoint not available' }, 200)
    }
  } catch (error) {
    console.error('Sync error:', error)
    return c.json({ success: false, message: 'Could not connect to PentestPulse', error: String(error) }, 200)
  }
})

// Webhook endpoint for PentestPulse to push new findings in real-time
app.post('/api/webhooks/pentest-pulse/finding', async (c) => {
  const db = c.env.DB
  // Get orgId from request body (PentestPulse sends it) or header
  const payload = await c.req.json()
  const orgId = payload.organization_id || c.req.header('X-Organization-ID') || c.req.query('org_id')
  
  if (!orgId) {
    return c.json({ error: 'Organization ID required' }, 400)
  }
  
  try {
    const { event, finding } = payload
    
    if (!finding || !finding.id) {
      return c.json({ error: 'Missing finding data' }, 400)
    }
    
    // Map PentestPulse finding to GRC Pulse risk
    const riskId = 'risk-pt-' + finding.id.substring(0, 8) + '-' + Date.now().toString(36)
    
    // Check if risk already exists
    const existing = await db.prepare(`
      SELECT id FROM risk_items 
      WHERE external_reference LIKE ?
    `).bind('%' + finding.id + '%').first()
    
    if (event === 'deleted' || event === 'delete') {
      if (existing) {
        await db.prepare(`DELETE FROM risk_items WHERE id = ?`).bind(existing.id).run()
        return c.json({ success: true, action: 'deleted', risk_id: existing.id })
      }
      return c.json({ success: true, action: 'not_found' })
    }
    
    // Map severity to likelihood/impact
    const severityMap = {
      'critical': { likelihood: 1.0, impact: 1.0 },
      'high': { likelihood: 0.8, impact: 0.8 },
      'medium': { likelihood: 0.6, impact: 0.6 },
      'low': { likelihood: 0.4, impact: 0.4 },
      'info': { likelihood: 0.2, impact: 0.2 }
    }
    const severity = finding.severity?.toLowerCase() || 'medium'
    const severityValues = severityMap[severity] || severityMap['medium']
    
    // Store pentest data
    const pentestData = {
      source: 'pentest_pulse',
      finding_id: finding.id,
      risk_score: finding.risk_score || Math.round(severityValues.likelihood * 5) * Math.round(severityValues.impact * 5),
      likelihood: Math.round(severityValues.likelihood * 5),
      impact: Math.round(severityValues.impact * 5),
      severity: severity,
      cvss: finding.cvss_score,
      technical_details: finding.technical_details || {}
    }
    
    if (existing) {
      // Update existing
      await db.prepare(`
        UPDATE risk_items SET
          title = ?,
          description = ?,
          category = 'vulnerability',
          inherent_likelihood = ?,
          inherent_impact = ?,
          inherent_score = ?,
          status = ?,
          ai_analysis = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).bind(
        finding.title || 'Untitled Finding',
        finding.description || null,
        severityValues.likelihood,
        severityValues.impact,
        pentestData.risk_score,
        finding.status === 'resolved' ? 'closed' : (finding.status === 'in_progress' ? 'in_progress' : 'open'),
        JSON.stringify(pentestData),
        existing.id
      ).run()
      
      return c.json({ success: true, action: 'updated', risk_id: existing.id })
    } else {
      // Insert new
      await db.prepare(`
        INSERT INTO risk_items (
          id, organization_id, title, description, category,
          inherent_likelihood, inherent_impact, inherent_score,
          risk_source, external_reference, status, ai_analysis,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'vulnerability', ?, ?, ?, 'penetration_test', ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(
        riskId,
        orgId,
        finding.title || 'Untitled Finding',
        finding.description || null,
        severityValues.likelihood,
        severityValues.impact,
        pentestData.risk_score,
        JSON.stringify({ pentest_pulse_id: finding.id }),
        finding.status === 'resolved' ? 'closed' : (finding.status === 'in_progress' ? 'in_progress' : 'open'),
        JSON.stringify(pentestData)
      ).run()
      
      return c.json({ success: true, action: 'created', risk_id: riskId })
    }
  } catch (error) {
    console.error('Webhook error:', error)
    return c.json({ error: 'Failed to process webhook', details: String(error) }, 500)
  }
})

// ============================================
// AUDIT MANAGEMENT MODULE
// ============================================

// Helper to generate IDs
function generateAuditId(prefix: string): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `${prefix}-${timestamp}-${random}`
}

// --- AUDIT PROGRAMS API ---

// List audit programs
app.get('/api/audit/programs', async (c) => {
  const { env } = c
  const orgId = c.get('orgId') || c.req.query('org_id')
  
  try {
    const result = await env.DB.prepare(`
      SELECT p.*, 
        (SELECT COUNT(*) FROM audit_engagements WHERE program_id = p.id) as total_engagements,
        (SELECT COUNT(*) FROM audit_engagements WHERE program_id = p.id AND status = 'completed') as completed_engagements
      FROM audit_programs p
      WHERE p.organization_id = ?
      ORDER BY p.year DESC, p.created_at DESC
    `).bind(orgId).all()
    
    return c.json(result.results || [])
  } catch (error) {
    console.error('List programs error:', error)
    return c.json({ error: 'Failed to load audit programs' }, 500)
  }
})

// Get single program
app.get('/api/audit/programs/:id', async (c) => {
  const { env } = c
  const id = c.req.param('id')
  
  try {
    const program = await env.DB.prepare(`SELECT * FROM audit_programs WHERE id = ?`).bind(id).first()
    if (!program) return c.json({ error: 'Program not found' }, 404)
    
    // Get engagements for this program
    const engagements = await env.DB.prepare(`
      SELECT * FROM audit_engagements WHERE program_id = ? ORDER BY start_date
    `).bind(id).all()
    
    return c.json({ ...program, engagements: engagements.results || [] })
  } catch (error) {
    return c.json({ error: 'Failed to load program' }, 500)
  }
})

// Create audit program
app.post('/api/audit/programs', async (c) => {
  const { env } = c
  const body = await c.req.json()
  const orgId = body.organization_id || c.get('orgId')
  const id = generateAuditId('prog')
  
  try {
    await env.DB.prepare(`
      INSERT INTO audit_programs (id, organization_id, name, description, year, status, start_date, end_date, audit_manager_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, orgId, body.name, body.description || null,
      body.year || new Date().getFullYear(),
      body.status || 'draft',
      body.start_date || null, body.end_date || null,
      body.audit_manager_id || null
    ).run()
    
    const program = await env.DB.prepare(`SELECT * FROM audit_programs WHERE id = ?`).bind(id).first()
    return c.json(program, 201)
  } catch (error) {
    console.error('Create program error:', error)
    return c.json({ error: 'Failed to create program' }, 500)
  }
})

// Update audit program
app.patch('/api/audit/programs/:id', async (c) => {
  const { env } = c
  const id = c.req.param('id')
  const body = await c.req.json()
  
  try {
    const fields = []
    const values = []
    
    if (body.name !== undefined) { fields.push('name = ?'); values.push(body.name) }
    if (body.description !== undefined) { fields.push('description = ?'); values.push(body.description) }
    if (body.year !== undefined) { fields.push('year = ?'); values.push(body.year) }
    if (body.status !== undefined) { fields.push('status = ?'); values.push(body.status) }
    if (body.start_date !== undefined) { fields.push('start_date = ?'); values.push(body.start_date) }
    if (body.end_date !== undefined) { fields.push('end_date = ?'); values.push(body.end_date) }
    
    if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400)
    
    fields.push("updated_at = datetime('now')")
    values.push(id)
    
    await env.DB.prepare(`UPDATE audit_programs SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run()
    
    const program = await env.DB.prepare(`SELECT * FROM audit_programs WHERE id = ?`).bind(id).first()
    return c.json(program)
  } catch (error) {
    return c.json({ error: 'Failed to update program' }, 500)
  }
})

// Delete audit program
app.delete('/api/audit/programs/:id', async (c) => {
  const { env } = c
  const id = c.req.param('id')
  
  try {
    await env.DB.prepare(`DELETE FROM audit_programs WHERE id = ?`).bind(id).run()
    return c.json({ success: true })
  } catch (error) {
    return c.json({ error: 'Failed to delete program' }, 500)
  }
})

// --- AUDIT ENGAGEMENTS API ---

// List audit engagements
app.get('/api/audit/engagements', async (c) => {
  const { env } = c
  const orgId = c.get('orgId') || c.req.query('org_id')
  const programId = c.req.query('program_id')
  const status = c.req.query('status')
  
  try {
    let sql = `
      SELECT e.*, p.name as program_name
      FROM audit_engagements e
      LEFT JOIN audit_programs p ON e.program_id = p.id
      WHERE e.organization_id = ?
    `
    const params: any[] = [orgId]
    
    if (programId) {
      sql += ` AND e.program_id = ?`
      params.push(programId)
    }
    if (status) {
      sql += ` AND e.status = ?`
      params.push(status)
    }
    
    sql += ` ORDER BY e.start_date DESC, e.created_at DESC`
    
    const result = await env.DB.prepare(sql).bind(...params).all()
    return c.json(result.results || [])
  } catch (error) {
    console.error('List engagements error:', error)
    return c.json({ error: 'Failed to load engagements' }, 500)
  }
})

// Get single engagement with findings
app.get('/api/audit/engagements/:id', async (c) => {
  const { env } = c
  const id = c.req.param('id')
  
  try {
    const engagement = await env.DB.prepare(`
      SELECT e.*, p.name as program_name
      FROM audit_engagements e
      LEFT JOIN audit_programs p ON e.program_id = p.id
      WHERE e.id = ?
    `).bind(id).first()
    
    if (!engagement) return c.json({ error: 'Engagement not found' }, 404)
    
    const findings = await env.DB.prepare(`
      SELECT * FROM audit_findings WHERE engagement_id = ? ORDER BY severity DESC, created_at DESC
    `).bind(id).all()
    
    return c.json({ ...engagement, findings: findings.results || [] })
  } catch (error) {
    return c.json({ error: 'Failed to load engagement' }, 500)
  }
})

// Create audit engagement
app.post('/api/audit/engagements', async (c) => {
  const { env } = c
  const body = await c.req.json()
  const orgId = body.organization_id || c.get('orgId')
  const id = generateAuditId('eng')
  
  try {
    await env.DB.prepare(`
      INSERT INTO audit_engagements (
        id, organization_id, program_id, name, description, audit_type, status, priority,
        scope, objectives, lead_auditor_id, lead_auditor_name, start_date, end_date, department
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, orgId, body.program_id || null, body.name, body.description || null,
      body.audit_type || 'internal', body.status || 'planned', body.priority || 'medium',
      body.scope || null, body.objectives || null,
      body.lead_auditor_id || null, body.lead_auditor_name || null,
      body.start_date || null, body.end_date || null, body.department || null
    ).run()
    
    const engagement = await env.DB.prepare(`SELECT * FROM audit_engagements WHERE id = ?`).bind(id).first()
    return c.json(engagement, 201)
  } catch (error) {
    console.error('Create engagement error:', error)
    return c.json({ error: 'Failed to create engagement' }, 500)
  }
})

// Update audit engagement
app.patch('/api/audit/engagements/:id', async (c) => {
  const { env } = c
  const id = c.req.param('id')
  const body = await c.req.json()
  
  try {
    const fields = []
    const values = []
    
    const allowedFields = ['name', 'description', 'audit_type', 'status', 'priority', 'scope', 'objectives', 
      'lead_auditor_id', 'lead_auditor_name', 'start_date', 'end_date', 'report_date', 'department', 'program_id']
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        fields.push(`${field} = ?`)
        values.push(body[field])
      }
    }
    
    if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400)
    
    fields.push("updated_at = datetime('now')")
    values.push(id)
    
    await env.DB.prepare(`UPDATE audit_engagements SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run()
    
    // Update findings count
    await env.DB.prepare(`
      UPDATE audit_engagements SET 
        findings_count = (SELECT COUNT(*) FROM audit_findings WHERE engagement_id = ?),
        open_findings = (SELECT COUNT(*) FROM audit_findings WHERE engagement_id = ? AND status IN ('open', 'in_progress'))
      WHERE id = ?
    `).bind(id, id, id).run()
    
    const engagement = await env.DB.prepare(`SELECT * FROM audit_engagements WHERE id = ?`).bind(id).first()
    return c.json(engagement)
  } catch (error) {
    return c.json({ error: 'Failed to update engagement' }, 500)
  }
})

// Delete audit engagement
app.delete('/api/audit/engagements/:id', async (c) => {
  const { env } = c
  const id = c.req.param('id')
  
  try {
    // Delete associated findings first
    await env.DB.prepare(`DELETE FROM audit_findings WHERE engagement_id = ?`).bind(id).run()
    await env.DB.prepare(`DELETE FROM audit_engagements WHERE id = ?`).bind(id).run()
    return c.json({ success: true })
  } catch (error) {
    return c.json({ error: 'Failed to delete engagement' }, 500)
  }
})

// --- AUDIT FINDINGS API ---

// List audit findings
app.get('/api/audit/findings', async (c) => {
  const { env } = c
  const orgId = c.get('orgId') || c.req.query('org_id')
  const engagementId = c.req.query('engagement_id')
  const status = c.req.query('status')
  const severity = c.req.query('severity')
  
  try {
    let sql = `
      SELECT f.*, e.name as engagement_name, e.audit_type
      FROM audit_findings f
      LEFT JOIN audit_engagements e ON f.engagement_id = e.id
      WHERE f.organization_id = ?
    `
    const params: any[] = [orgId]
    
    if (engagementId) { sql += ` AND f.engagement_id = ?`; params.push(engagementId) }
    if (status) { sql += ` AND f.status = ?`; params.push(status) }
    if (severity) { sql += ` AND f.severity = ?`; params.push(severity) }
    
    sql += ` ORDER BY 
      CASE f.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END,
      f.created_at DESC`
    
    const result = await env.DB.prepare(sql).bind(...params).all()
    return c.json(result.results || [])
  } catch (error) {
    console.error('List findings error:', error)
    return c.json({ error: 'Failed to load findings' }, 500)
  }
})

// Get single finding
app.get('/api/audit/findings/:id', async (c) => {
  const { env } = c
  const id = c.req.param('id')
  
  try {
    const finding = await env.DB.prepare(`
      SELECT f.*, e.name as engagement_name, e.audit_type
      FROM audit_findings f
      LEFT JOIN audit_engagements e ON f.engagement_id = e.id
      WHERE f.id = ?
    `).bind(id).first()
    
    if (!finding) return c.json({ error: 'Finding not found' }, 404)
    
    // Get linked risk if exists
    let linkedRisk = null
    if (finding.related_risk_id) {
      linkedRisk = await env.DB.prepare(`SELECT id, title, status FROM risk_items WHERE id = ?`).bind(finding.related_risk_id).first()
    }
    
    return c.json({ ...finding, linked_risk: linkedRisk })
  } catch (error) {
    return c.json({ error: 'Failed to load finding' }, 500)
  }
})

// Create audit finding (with optional auto-create risk and control status update)
app.post('/api/audit/findings', async (c) => {
  const { env } = c
  const body = await c.req.json()
  const orgId = body.organization_id || c.get('orgId')
  const findingId = generateAuditId('afnd')
  
  try {
    // Calculate risk rating based on likelihood and impact
    const likelihood = body.likelihood || 3
    const impact = body.impact_score || 3
    const riskScore = likelihood * impact
    let riskRating = 'low'
    if (riskScore >= 20) riskRating = 'critical'
    else if (riskScore >= 12) riskRating = 'high'
    else if (riskScore >= 6) riskRating = 'medium'
    
    // Store affected controls as JSON
    const affectedControlsJson = body.affected_controls ? JSON.stringify(body.affected_controls) : null
    
    await env.DB.prepare(`
      INSERT INTO audit_findings (
        id, organization_id, engagement_id, title, description, finding_type, severity, status,
        category, affected_process, affected_department, root_cause, impact, likelihood, impact_score,
        risk_rating, recommendation, management_response, remediation_plan, remediation_owner_name,
        due_date, evidence, created_by, affected_controls
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      findingId, orgId, body.engagement_id || null, body.title, body.description || null,
      body.finding_type || 'deficiency', body.severity || 'medium', body.status || 'open',
      body.category || null, body.affected_process || null, body.affected_department || null,
      body.root_cause || null, body.impact || null, likelihood, impact, riskRating,
      body.recommendation || null, body.management_response || null, body.remediation_plan || null,
      body.remediation_owner_name || null, body.due_date || null, body.evidence || null, body.created_by || null,
      affectedControlsJson
    ).run()
    
    // Update engagement findings count
    if (body.engagement_id) {
      await env.DB.prepare(`
        UPDATE audit_engagements SET 
          findings_count = (SELECT COUNT(*) FROM audit_findings WHERE engagement_id = ?),
          open_findings = (SELECT COUNT(*) FROM audit_findings WHERE engagement_id = ? AND status IN ('open', 'in_progress')),
          updated_at = datetime('now')
        WHERE id = ?
      `).bind(body.engagement_id, body.engagement_id, body.engagement_id).run()
    }
    
    // COMPLIANCE IMPACT: Downgrade affected controls to 'not_implemented' or 'partially_implemented'
    const affectedControlIds: string[] = []
    if (body.affected_controls && Array.isArray(body.affected_controls)) {
      for (const ctrl of body.affected_controls) {
        const controlId = ctrl.id
        affectedControlIds.push(controlId)
        
        // Get current control status
        const currentAssessment = await env.DB.prepare(`
          SELECT implementation_status FROM control_assessments 
          WHERE organization_id = ? AND control_library_id = ?
        `).bind(orgId, controlId).first()
        
        // Determine new status based on severity
        let newStatus = 'not_implemented'
        if (body.severity === 'low' || body.severity === 'medium') {
          newStatus = 'partially_implemented'
        }
        
        if (currentAssessment) {
          // Only downgrade if current status is better
          const statusPriority: Record<string, number> = { 
            'implemented': 4, 'partially_implemented': 3, 'in_progress': 2, 'planned': 1, 'not_implemented': 0, 'not_started': 0 
          }
          const currentPriority = statusPriority[currentAssessment.implementation_status as string] || 0
          const newPriority = statusPriority[newStatus] || 0
          
          if (currentPriority > newPriority) {
            await env.DB.prepare(`
              UPDATE control_assessments 
              SET implementation_status = ?, 
                  notes = COALESCE(notes, '') || '\n[' || datetime('now') || '] Downgraded due to audit finding: ' || ?,
                  updated_at = datetime('now')
              WHERE organization_id = ? AND control_library_id = ?
            `).bind(newStatus, body.title, orgId, controlId).run()
          }
        } else {
          // Create new assessment with deficient status
          await env.DB.prepare(`
            INSERT INTO control_assessments (
              id, organization_id, control_library_id, implementation_status, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
          `).bind(
            generateAuditId('ca'), orgId, controlId, newStatus,
            `Created due to audit finding: ${body.title}`
          ).run()
        }
      }
    }
    
    let riskId = null
    
    // Auto-create risk if requested
    if (body.create_risk === true) {
      riskId = generateAuditId('risk-aud')
      const normalizedLikelihood = likelihood / 5
      const normalizedImpact = impact / 5
      const inherentScore = Math.round(normalizedLikelihood * normalizedImpact * 100)
      
      // Include affected control codes in external_reference
      const controlCodes = body.affected_controls?.map((c: any) => c.code).join(',') || ''
      
      await env.DB.prepare(`
        INSERT INTO risk_items (
          id, organization_id, title, description, risk_source, external_reference,
          category, inherent_likelihood, inherent_impact, inherent_score, status, remediation_plan, due_date
        ) VALUES (?, ?, ?, ?, 'audit_finding', ?, ?, ?, ?, ?, 'open', ?, ?)
      `).bind(
        riskId, orgId, body.title, body.description || null,
        `audit:${findingId}|engagement:${body.engagement_id || 'none'}|controls:${controlCodes}`,
        body.category || 'compliance',
        normalizedLikelihood, normalizedImpact, inherentScore,
        body.remediation_plan || null, body.due_date || null
      ).run()
      
      // Link finding to risk
      await env.DB.prepare(`
        UPDATE audit_findings SET related_risk_id = ?, updated_at = datetime('now') WHERE id = ?
      `).bind(riskId, findingId).run()
      
      // Auto-create control-risk mappings for affected controls
      let controlsUpdated = 0
      for (const controlId of affectedControlIds) {
        const mappingId = generateAuditId('crm-aud')
        await env.DB.prepare(`
          INSERT OR IGNORE INTO control_risk_mappings (
            id, organization_id, control_id, risk_id, mapping_type, effectiveness, 
            confidence_score, is_auto_suggested, notes, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 'mitigates', 'partial', 75, 1, 'Auto-created from audit finding', datetime('now'), datetime('now'))
        `).bind(mappingId, orgId, controlId, riskId).run()
        
        // AUTO-SYNC: Recalculate control implementation status based on linked risks
        const statusUpdate = await recalculateControlStatus(env.DB, controlId, orgId)
        if (statusUpdate.updated) controlsUpdated++
      }
    }
    
    const finding = await env.DB.prepare(`SELECT * FROM audit_findings WHERE id = ?`).bind(findingId).first()
    return c.json({ 
      ...finding, 
      created_risk_id: riskId,
      affected_control_count: affectedControlIds.length,
      compliance_impact: affectedControlIds.length > 0 ? `Controls downgraded: ${controlsUpdated} controls updated` : 'None'
    }, 201)
  } catch (error) {
    console.error('Create finding error:', error)
    return c.json({ error: 'Failed to create finding' }, 500)
  }
})

// Update audit finding
app.patch('/api/audit/findings/:id', async (c) => {
  const { env } = c
  const id = c.req.param('id')
  const body = await c.req.json()
  
  try {
    const finding = await env.DB.prepare(`SELECT * FROM audit_findings WHERE id = ?`).bind(id).first()
    if (!finding) return c.json({ error: 'Finding not found' }, 404)
    
    const fields = []
    const values = []
    
    const allowedFields = ['title', 'description', 'finding_type', 'severity', 'status', 'category',
      'affected_process', 'affected_department', 'root_cause', 'impact', 'likelihood', 'impact_score',
      'recommendation', 'management_response', 'remediation_plan', 'remediation_owner_name', 'remediation_owner_id', 'due_date',
      'closed_date', 'evidence', 'related_control_id']
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        fields.push(`${field} = ?`)
        values.push(body[field])
      }
    }
    
    // Recalculate risk rating if likelihood or impact changed
    const newLikelihood = body.likelihood !== undefined ? body.likelihood : finding.likelihood
    const newImpact = body.impact_score !== undefined ? body.impact_score : finding.impact_score
    const riskScore = newLikelihood * newImpact
    let riskRating = 'low'
    if (riskScore >= 20) riskRating = 'critical'
    else if (riskScore >= 12) riskRating = 'high'
    else if (riskScore >= 6) riskRating = 'medium'
    fields.push('risk_rating = ?')
    values.push(riskRating)
    
    // Auto-set closed_date when status changes to closed/remediated
    if (body.status && ['closed', 'remediated'].includes(body.status) && !finding.closed_date) {
      fields.push('closed_date = datetime("now")')
    }
    
    if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400)
    
    fields.push("updated_at = datetime('now')")
    values.push(id)
    
    await env.DB.prepare(`UPDATE audit_findings SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run()
    
    // Update engagement findings count
    if (finding.engagement_id) {
      await env.DB.prepare(`
        UPDATE audit_engagements SET 
          findings_count = (SELECT COUNT(*) FROM audit_findings WHERE engagement_id = ?),
          open_findings = (SELECT COUNT(*) FROM audit_findings WHERE engagement_id = ? AND status IN ('open', 'in_progress')),
          updated_at = datetime('now')
        WHERE id = ?
      `).bind(finding.engagement_id, finding.engagement_id, finding.engagement_id).run()
    }
    
    // Sync status to linked risk if exists
    if (finding.related_risk_id && body.status) {
      let riskStatus = 'open'
      if (['closed', 'remediated'].includes(body.status)) riskStatus = 'mitigated'
      else if (body.status === 'in_progress' || body.status === 'remediation_planned') riskStatus = 'in_progress'
      else if (body.status === 'accepted' || body.status === 'deferred') riskStatus = 'accepted'
      
      await env.DB.prepare(`
        UPDATE risk_items SET status = ?, updated_at = datetime('now') WHERE id = ?
      `).bind(riskStatus, finding.related_risk_id).run()
    }
    
    // COMPLIANCE RESTORATION: When finding is remediated/closed, consider restoring control status
    if (body.status && ['closed', 'remediated'].includes(body.status) && finding.affected_controls) {
      const orgId = finding.organization_id as string
      try {
        const affectedControls = JSON.parse(finding.affected_controls as string)
        for (const ctrl of affectedControls) {
          // Check if there are other open findings affecting this control
          const otherOpenFindings = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM audit_findings 
            WHERE organization_id = ? 
            AND id != ? 
            AND status IN ('open', 'in_progress', 'remediation_planned')
            AND affected_controls LIKE ?
          `).bind(orgId, id, `%"id":"${ctrl.id}"%`).first()
          
          // If no other open findings affect this control, upgrade its status
          if ((otherOpenFindings?.count || 0) === 0) {
            await env.DB.prepare(`
              UPDATE control_assessments 
              SET implementation_status = 'implemented',
                  notes = COALESCE(notes, '') || '\n[' || datetime('now') || '] Restored after audit finding remediation: ' || ?,
                  updated_at = datetime('now')
              WHERE organization_id = ? AND control_library_id = ?
            `).bind(body.title || finding.title, orgId, ctrl.id).run()
          }
        }
      } catch (e) {
        console.error('Error restoring control status:', e)
      }
    }
    
    const updated = await env.DB.prepare(`SELECT * FROM audit_findings WHERE id = ?`).bind(id).first()
    return c.json(updated)
  } catch (error) {
    console.error('Update finding error:', error)
    return c.json({ error: 'Failed to update finding' }, 500)
  }
})

// Delete audit finding (with cascade delete to linked risk)
app.delete('/api/audit/findings/:id', async (c) => {
  const { env } = c
  const id = c.req.param('id')
  
  try {
    const finding = await env.DB.prepare(`SELECT engagement_id, related_risk_id FROM audit_findings WHERE id = ?`).bind(id).first()
    
    // CASCADE: Delete linked risk and its control mappings
    if (finding?.related_risk_id) {
      // First delete control_risk_mappings for this risk
      await env.DB.prepare(`DELETE FROM control_risk_mappings WHERE risk_id = ?`).bind(finding.related_risk_id).run()
      // Then delete the risk itself
      await env.DB.prepare(`DELETE FROM risk_items WHERE id = ?`).bind(finding.related_risk_id).run()
    }
    
    // Delete the audit finding
    await env.DB.prepare(`DELETE FROM audit_findings WHERE id = ?`).bind(id).run()
    
    // Update engagement findings count
    if (finding?.engagement_id) {
      await env.DB.prepare(`
        UPDATE audit_engagements SET 
          findings_count = (SELECT COUNT(*) FROM audit_findings WHERE engagement_id = ?),
          open_findings = (SELECT COUNT(*) FROM audit_findings WHERE engagement_id = ? AND status IN ('open', 'in_progress')),
          updated_at = datetime('now')
        WHERE id = ?
      `).bind(finding.engagement_id, finding.engagement_id, finding.engagement_id).run()
    }
    
    return c.json({ success: true, deleted_risk: finding?.related_risk_id || null })
  } catch (error) {
    console.error('Delete finding error:', error)
    return c.json({ error: 'Failed to delete finding' }, 500)
  }
})

// Create risk from existing finding
app.post('/api/audit/findings/:id/create-risk', async (c) => {
  const { env } = c
  const id = c.req.param('id')
  
  try {
    const finding = await env.DB.prepare(`SELECT * FROM audit_findings WHERE id = ?`).bind(id).first()
    if (!finding) return c.json({ error: 'Finding not found' }, 404)
    if (finding.related_risk_id) return c.json({ error: 'Finding already linked to a risk' }, 400)
    
    const riskId = generateAuditId('risk-aud')
    const likelihood = (finding.likelihood || 3) / 5
    const impact = (finding.impact_score || 3) / 5
    const inherentScore = Math.round(likelihood * impact * 100)
    
    await env.DB.prepare(`
      INSERT INTO risk_items (
        id, organization_id, title, description, risk_source, external_reference,
        category, inherent_likelihood, inherent_impact, inherent_score, status, remediation_plan, due_date
      ) VALUES (?, ?, ?, ?, 'audit_finding', ?, ?, ?, ?, ?, 'open', ?, ?)
    `).bind(
      riskId, finding.organization_id, finding.title, finding.description || null,
      `audit:${id}|engagement:${finding.engagement_id || 'none'}`,
      finding.category || 'compliance',
      likelihood, impact, inherentScore,
      finding.remediation_plan || null, finding.due_date || null
    ).run()
    
    // Link finding to risk
    await env.DB.prepare(`
      UPDATE audit_findings SET related_risk_id = ?, updated_at = datetime('now') WHERE id = ?
    `).bind(riskId, id).run()
    
    return c.json({ success: true, risk_id: riskId })
  } catch (error) {
    console.error('Create risk from finding error:', error)
    return c.json({ error: 'Failed to create risk' }, 500)
  }
})

// Audit Dashboard Stats
app.get('/api/audit/dashboard', async (c) => {
  const { env } = c
  const orgId = c.get('orgId') || c.req.query('org_id')
  
  try {
    // OPTIMIZED: Batch all queries in parallel
    const [programsResult, engagementsResult, findingsResult, recentFindingsResult, overdueResult] = await env.DB.batch([
      // Programs stats
      env.DB.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
        FROM audit_programs WHERE organization_id = ?
      `).bind(orgId),
      // Engagements stats
      env.DB.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'in_progress' OR status = 'fieldwork' THEN 1 ELSE 0 END) as in_progress,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'planned' THEN 1 ELSE 0 END) as planned
        FROM audit_engagements WHERE organization_id = ?
      `).bind(orgId),
      // Findings stats
      env.DB.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status IN ('open', 'in_progress') THEN 1 ELSE 0 END) as open,
          SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical,
          SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high,
          SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) as medium,
          SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END) as low,
          SUM(CASE WHEN related_risk_id IS NOT NULL THEN 1 ELSE 0 END) as linked_to_risks
        FROM audit_findings WHERE organization_id = ?
      `).bind(orgId),
      // Recent findings
      env.DB.prepare(`
        SELECT f.id, f.title, f.severity, f.status, f.created_at, e.name as engagement_name
        FROM audit_findings f
        LEFT JOIN audit_engagements e ON f.engagement_id = e.id
        WHERE f.organization_id = ?
        ORDER BY f.created_at DESC LIMIT 5
      `).bind(orgId),
      // Overdue findings
      env.DB.prepare(`
        SELECT COUNT(*) as count FROM audit_findings 
        WHERE organization_id = ? AND status IN ('open', 'in_progress') 
        AND due_date < date('now') AND due_date IS NOT NULL
      `).bind(orgId)
    ])
    
    const programs = programsResult.results[0] || { total: 0, active: 0, completed: 0 }
    const engagements = engagementsResult.results[0] || { total: 0, in_progress: 0, completed: 0, planned: 0 }
    const findings = findingsResult.results[0] || { total: 0, open: 0, critical: 0, high: 0, medium: 0, low: 0, linked_to_risks: 0 }
    const recentFindings = recentFindingsResult.results || []
    const overdue = overdueResult.results[0] || { count: 0 }
    
    return c.json({
      programs,
      engagements,
      findings,
      recentFindings,
      overdueCount: overdue?.count || 0
    })
  } catch (error) {
    console.error('Audit dashboard error:', error)
    return c.json({ error: 'Failed to load audit dashboard' }, 500)
  }
})

export default app
