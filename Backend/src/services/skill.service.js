const SOURCE_VALUES = ["resume", "job_description", "interview", "self_reported"]

const normalizeSkill = (value) => {
    const normalized = String(value || "").trim().toLowerCase().replace(/[._\s-]+/g, "")
    const aliases = {
        node: "Node.js",
        nodejs: "Node.js",
        postgres: "PostgreSQL",
        postgresql: "PostgreSQL",
        postgresqldatabase: "PostgreSQL",
        js: "JavaScript",
        javascript: "JavaScript",
        ts: "TypeScript",
        typescript: "TypeScript",
        mongodb: "MongoDB",
        mongo: "MongoDB",
        redis: "Redis",
    }
    return aliases[normalized] || String(value || "").trim()
}

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value))

function normalizeInventory(skills, report) {
    const bySkill = new Map()
    for (const item of skills || []) {
        const skill = normalizeSkill(item.skill)
        if (!skill) continue
        const existing = bySkill.get(skill)
        const sources = [...new Set([...(existing?.source || []), ...(item.source || [])].filter((source) => SOURCE_VALUES.includes(source)))]
        bySkill.set(skill, {
            skill,
            category: item.category || existing?.category || "General",
            importance: item.importance || existing?.importance || "medium",
            source: sources.length ? sources : ["job_description"],
            baselineScore: existing?.baselineScore ?? item.baselineScore ?? 0,
            currentScore: existing?.currentScore ?? item.currentScore ?? null,
            confidence: existing?.confidence ?? item.confidence ?? 0.2,
            evidence: existing?.evidence || [],
            strengths: existing?.strengths || [],
            gaps: existing?.gaps || [],
            questionsAsked: existing?.questionsAsked || 0,
            lastAssessedAt: existing?.lastAssessedAt || null,
            status: existing?.status || "unassessed",
        })
    }
    for (const gap of report.skillGaps || []) {
        const skill = normalizeSkill(gap.skill)
        if (!skill || bySkill.has(skill)) continue
        bySkill.set(skill, {
            skill, category: "Role requirement", importance: gap.severity === "high" ? "high" : "medium",
            source: ["job_description"], baselineScore: 0, currentScore: null, confidence: 0.2,
            evidence: [], strengths: [], gaps: [], questionsAsked: 0, lastAssessedAt: null, status: "unassessed",
        })
    }
    return [...bySkill.values()]
}

function updateSkillProfile(profile, assessments, sessionId, turnId) {
    const bySkill = new Map(profile.map((item) => [normalizeSkill(item.skill), { ...item, skill: normalizeSkill(item.skill) }]))
    const now = new Date()
    for (const assessment of assessments || []) {
        const skill = normalizeSkill(assessment.skill)
        if (!skill || typeof assessment.score !== "number") continue
        const current = bySkill.get(skill) || {
            skill, category: assessment.category || "Interview", importance: "medium", source: ["interview"],
            baselineScore: null, currentScore: null, confidence: 0, evidence: [], strengths: [], gaps: [], questionsAsked: 0,
            lastAssessedAt: null, status: "unassessed",
        }
        const previousScore = typeof current.currentScore === "number" ? current.currentScore : current.baselineScore
        const previousAssessments = current.questionsAsked || 0
        const currentConfidence = clamp(Number(assessment.confidence) || 0.2, 0.1, 1)
        const historicalWeight = previousScore === null || previousScore === undefined ? 0 : Math.max(1, previousAssessments * Math.max(current.confidence || 0.2, 0.2))
        const nextScore = previousScore === null || previousScore === undefined
            ? Math.round(assessment.score * 10)
            : Math.round((previousScore * historicalWeight + assessment.score * 10 * currentConfidence) / (historicalWeight + currentConfidence))
        const evidence = (assessment.evidence || []).map((description) => ({ interviewId: sessionId, questionId: turnId, type: "evidence", description, score: assessment.score, timestamp: now }))
        const gaps = (assessment.gaps || []).map((description) => ({ interviewId: sessionId, questionId: turnId, type: "gap", description, score: assessment.score, timestamp: now }))
        current.source = [...new Set([...(current.source || []), "interview"])]
        current.currentScore = clamp(nextScore, 0, 100)
        current.confidence = clamp(Math.max(current.confidence || 0, currentConfidence) + 0.1, 0, 1)
        current.evidence = [...(current.evidence || []), ...evidence].slice(-20)
        current.strengths = [...new Set([...(current.strengths || []), ...(assessment.strengths || [])])].slice(-10)
        current.gaps = [...(current.gaps || []), ...gaps].slice(-10)
        current.questionsAsked = previousAssessments + 1
        current.lastAssessedAt = now
        current.status = current.currentScore < 70 && current.gaps.length ? "gap" : "assessed"
        bySkill.set(skill, current)
    }
    return [...bySkill.values()]
}

function rankSkillGaps(profile) {
    const importanceWeight = { high: 3, medium: 2, low: 1 }
    return profile
        .filter((item) => item.status === "gap" && typeof item.currentScore === "number")
        .map((item) => ({
            skill: item.skill,
            score: item.currentScore,
            priority: importanceWeight[item.importance] * 3 + (100 - item.currentScore) / 10 + Math.min(item.gaps?.length || 0, 3) + item.confidence,
            reason: `${item.importance} role importance, ${item.gaps?.length || 0} weakness signal(s), confidence ${Math.round(item.confidence * 100)}%`,
        }))
        .sort((left, right) => right.priority - left.priority)
        .slice(0, 5)
}

function selectNextFocus(profile, suggestedFocus) {
    const ranked = rankSkillGaps(profile)
    return ranked[0]?.skill || suggestedFocus || profile.find((item) => item.status === "unassessed")?.skill || "Core role fundamentals"
}

module.exports = { normalizeInventory, updateSkillProfile, rankSkillGaps, selectNextFocus, normalizeSkill }
