-- ============================================================================
-- MATURITY ASSESSMENT TABLES
-- Proper storage for organizational security maturity assessments
-- Based on CMM (Capability Maturity Model) and ISO 27001
-- ============================================================================

-- Maturity Assessments (main assessment records)
CREATE TABLE IF NOT EXISTS maturity_assessments (
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

-- Maturity Responses (individual question responses)
CREATE TABLE IF NOT EXISTS maturity_responses (
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

-- Maturity Category Scores (pre-calculated category averages)
CREATE TABLE IF NOT EXISTS maturity_category_scores (
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

-- Maturity Improvement Actions (action items from assessments)
CREATE TABLE IF NOT EXISTS maturity_improvement_actions (
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_maturity_assessments_org ON maturity_assessments(organization_id);
CREATE INDEX IF NOT EXISTS idx_maturity_assessments_status ON maturity_assessments(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_maturity_assessments_date ON maturity_assessments(organization_id, assessment_date DESC);
CREATE INDEX IF NOT EXISTS idx_maturity_responses_assessment ON maturity_responses(assessment_id);
CREATE INDEX IF NOT EXISTS idx_maturity_responses_category ON maturity_responses(assessment_id, category_id);
CREATE INDEX IF NOT EXISTS idx_maturity_category_scores_assessment ON maturity_category_scores(assessment_id);
CREATE INDEX IF NOT EXISTS idx_maturity_actions_assessment ON maturity_improvement_actions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_maturity_actions_status ON maturity_improvement_actions(organization_id, status);
