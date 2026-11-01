/**
 * Deterministic scoring shared by the mock interview and project deep-dive reports.
 * Scores are aggregated from per-answer evaluations so the final numbers are
 * evidence-backed; the LLM only writes the qualitative parts of a report.
 */

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value))

function average(values) {
    const numbers = values.filter((value) => typeof value === "number" && Number.isFinite(value))
    if (!numbers.length) return null
    return numbers.reduce((sum, value) => sum + value, 0) / numbers.length
}

/** Converts a 0-10 average into a rounded 0-100 score (null when nothing was scored). */
function toPercent(value) {
    return value === null ? null : Math.round(clamp(value, 0, 10) * 10)
}

/** Turns that have an answer and a real (non-degraded) evaluation. */
function scoredTurns(turns = []) {
    return turns.filter((turn) => turn.answer && turn.evaluation && !turn.evaluation.degraded)
}

function weightedOverall(scores, weights) {
    let total = 0
    let weightSum = 0
    for (const [key, weight] of Object.entries(weights)) {
        if (typeof scores[key] !== "number") continue
        total += scores[key] * weight
        weightSum += weight
    }
    return weightSum ? Math.round(total / weightSum) : null
}

function readinessVerdict(score) {
    if (score === null || score === undefined) return "insufficient_data"
    if (score >= 80) return "ready"
    if (score >= 60) return "almost_ready"
    return "needs_practice"
}

// HR and behavioural rounds are judged mostly on communication and relevance;
// technical rounds mostly on correctness and problem solving.
const MOCK_INTERVIEW_WEIGHTS = {
    technical: { technicalCorrectness: 0.35, problemSolving: 0.25, communication: 0.2, relevance: 0.2 },
    behavioral: { technicalCorrectness: 0.1, problemSolving: 0.25, communication: 0.35, relevance: 0.3 },
    hr: { technicalCorrectness: 0.05, problemSolving: 0.2, communication: 0.4, relevance: 0.35 },
    mixed: { technicalCorrectness: 0.25, problemSolving: 0.25, communication: 0.25, relevance: 0.25 },
}

/** Aggregate mock-interview dimension scores (0-100) from per-turn evaluations (0-10). */
function scoreMockInterview(turns, interviewType = "technical") {
    const scored = scoredTurns(turns)
    const pick = (key) => toPercent(average(scored.map((turn) => turn.evaluation[key])))
    const scores = {
        technicalCorrectness: pick("technicalAccuracy"),
        communication: pick("clarity"),
        problemSolving: pick("depth"),
        relevance: pick("relevance"),
    }
    const overall = weightedOverall(scores, MOCK_INTERVIEW_WEIGHTS[interviewType] || MOCK_INTERVIEW_WEIGHTS.mixed)
    return {
        overallScore: overall,
        scores,
        answeredCount: turns.filter((turn) => turn.answer).length,
        evaluatedCount: scored.length,
        verdict: readinessVerdict(overall),
    }
}

/** Aggregate project deep-dive scores (0-100) and a per-category breakdown. */
function scoreDeepDive(turns) {
    const scored = scoredTurns(turns)
    const understanding = toPercent(average(scored.map((turn) => turn.evaluation.understanding)))
    const technicalKnowledge = toPercent(average(scored.flatMap((turn) => [turn.evaluation.technicalDepth, turn.evaluation.accuracy])))
    const communication = toPercent(average(scored.map((turn) => turn.evaluation.communication)))
    const byCategory = new Map()
    for (const turn of scored) {
        const entry = byCategory.get(turn.category) || { category: turn.category, values: [], questions: 0 }
        entry.values.push(turn.evaluation.overall)
        entry.questions += 1
        byCategory.set(turn.category, entry)
    }
    const categoryBreakdown = [...byCategory.values()]
        .map(({ category, values, questions }) => ({ category, score: toPercent(average(values)), questions }))
        .sort((left, right) => left.score - right.score)
    const overall = weightedOverall({ understanding, technicalKnowledge, communication }, { understanding: 0.4, technicalKnowledge: 0.45, communication: 0.15 })
    return {
        overallScore: overall,
        projectUnderstandingScore: understanding,
        technicalKnowledgeScore: technicalKnowledge,
        communicationScore: communication,
        categoryBreakdown,
        answeredCount: turns.filter((turn) => turn.answer).length,
        evaluatedCount: scored.length,
        verdict: readinessVerdict(overall),
    }
}

module.exports = { average, toPercent, scoredTurns, weightedOverall, readinessVerdict, scoreMockInterview, scoreDeepDive, MOCK_INTERVIEW_WEIGHTS }
