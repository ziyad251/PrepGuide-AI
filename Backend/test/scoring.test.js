const test = require("node:test")
const assert = require("node:assert/strict")
const { scoreMockInterview, scoreDeepDive, readinessVerdict } = require("../src/services/scoring.service")

const turn = (evaluation, answer = "An answer") => ({ question: "Q?", answer, evaluation })

test("aggregates mock interview dimensions from per-turn evaluations", () => {
    const result = scoreMockInterview([
        turn({ overall: 8, technicalAccuracy: 8, depth: 6, clarity: 7, relevance: 9 }),
        turn({ overall: 6, technicalAccuracy: 6, depth: 4, clarity: 9, relevance: 7 }),
    ], "technical")
    assert.deepEqual(result.scores, { technicalCorrectness: 70, communication: 80, problemSolving: 50, relevance: 80 })
    // technical weights: 0.35*70 + 0.25*50 + 0.2*80 + 0.2*80 = 69
    assert.equal(result.overallScore, 69)
    assert.equal(result.verdict, "almost_ready")
    assert.equal(result.evaluatedCount, 2)
})

test("excludes degraded evaluations and unanswered turns from scoring", () => {
    const result = scoreMockInterview([
        turn({ overall: 9, technicalAccuracy: 9, depth: 9, clarity: 9, relevance: 9 }),
        turn({ overall: 5, technicalAccuracy: 5, depth: 5, clarity: 5, relevance: 5, degraded: true }),
        { question: "Unanswered?" },
    ], "mixed")
    assert.equal(result.overallScore, 90)
    assert.equal(result.answeredCount, 2)
    assert.equal(result.evaluatedCount, 1)
})

test("weights communication more heavily in HR rounds", () => {
    const turns = [turn({ overall: 6, technicalAccuracy: 2, depth: 6, clarity: 9, relevance: 9 })]
    assert.ok(scoreMockInterview(turns, "hr").overallScore > scoreMockInterview(turns, "technical").overallScore)
})

test("returns no score instead of a fake one when nothing was evaluated", () => {
    const result = scoreMockInterview([turn({ overall: 5, degraded: true })], "technical")
    assert.equal(result.overallScore, null)
    assert.equal(result.verdict, "insufficient_data")
})

test("scores deep-dive understanding, knowledge and weakest categories first", () => {
    const result = scoreDeepDive([
        { category: "architecture", answer: "a", evaluation: { overall: 8, understanding: 8, technicalDepth: 7, accuracy: 9, communication: 8 } },
        { category: "scalability", answer: "b", evaluation: { overall: 3, understanding: 4, technicalDepth: 2, accuracy: 4, communication: 6 } },
    ])
    assert.equal(result.projectUnderstandingScore, 60)
    assert.equal(result.technicalKnowledgeScore, 55)
    assert.deepEqual(result.categoryBreakdown.map((item) => item.category), ["scalability", "architecture"])
})

test("maps scores to readiness verdicts", () => {
    assert.equal(readinessVerdict(85), "ready")
    assert.equal(readinessVerdict(60), "almost_ready")
    assert.equal(readinessVerdict(59), "needs_practice")
})
