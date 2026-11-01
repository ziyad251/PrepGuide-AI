const test = require("node:test")
const assert = require("node:assert/strict")
const { isUsableQuestion, groundedFallbackQuestion, questionStyleForTurn, fallbackFinalReport } = require("../src/services/simulator.service")
const { scoreMockInterview } = require("../src/services/scoring.service")
const { pickNextCategory, trailingFollowUps, fallbackQuestion, normalizeProjects } = require("../src/services/deepDive.service")

const projectEvidence = { source: "PROJECT", content: "PrepGuide AI uses Node.js, MongoDB, and Gemini APIs for an interview simulator backend." }

test("behavioural questions are not rejected for technical roles", () => {
    const question = "Tell me about a time you disagreed with a teammate. What did you do, and what was the outcome?"
    assert.equal(isUsableQuestion({ question, targetRole: "Backend Developer", interviewType: "technical" }), false)
    assert.equal(isUsableQuestion({ question, targetRole: "Backend Developer", interviewType: "behavioral" }), true)
    assert.equal(isUsableQuestion({ question, targetRole: "Backend Developer", interviewType: "hr" }), true)
})

test("HR fallback questions never ask technical implementation questions", () => {
    const question = groundedFallbackQuestion({ targetRole: "Backend Developer", focus: "caching", retrievedContext: [projectEvidence], interviewType: "hr" })
    assert.doesNotMatch(question, /API|database|cache|production load/i)
})

test("behavioural fallback uses the candidate's own project for a STAR question", () => {
    const question = groundedFallbackQuestion({ targetRole: "Backend Developer", focus: "ownership", retrievedContext: [projectEvidence], interviewType: "behavioral" })
    assert.match(question, /PrepGuide|Node\.js/)
    assert.match(question, /situation|result/i)
})

test("mixed rounds alternate technical and behavioural styles", () => {
    assert.deepEqual([0, 1, 2, 3].map((index) => questionStyleForTurn("mixed", index)), ["technical", "behavioral", "technical", "behavioral"])
    assert.equal(questionStyleForTurn("hr", 3), "hr")
})

test("fallback final report is built only from stored evaluations", () => {
    const session = {
        interviewType: "technical",
        turns: [
            { question: "Explain JWT?", answer: "Signed token", evaluation: { overall: 4, technicalAccuracy: 4, depth: 3, clarity: 6, relevance: 7, strengths: ["Knows JWT is signed"], missingConcepts: ["Token expiry"], recommendedTopics: ["Refresh tokens"], feedback: "Cover expiry." } },
        ],
    }
    const report = fallbackFinalReport(session, scoreMockInterview(session.turns, "technical"))
    assert.equal(report.source, "fallback")
    assert.deepEqual(report.weaknesses, ["Token expiry"])
    assert.deepEqual(report.topicsToRevise.map((item) => item.topic), ["Token expiry", "Refresh tokens"])
    assert.equal(report.idealAnswers.length, 0)
})

test("deep-dive covers unasked focus areas before repeating one", () => {
    const focusAreas = ["architecture", "scalability", "auth_security"]
    assert.equal(pickNextCategory({ focusAreas, turns: [] }), "architecture")
    assert.equal(pickNextCategory({ focusAreas, turns: [{ category: "architecture" }] }), "scalability")
    assert.equal(pickNextCategory({ focusAreas, turns: [{ category: "architecture" }, { category: "scalability" }, { category: "auth_security" }, { category: "architecture" }] }), "scalability")
})

test("counts trailing follow-ups to cap probing on one topic", () => {
    assert.equal(trailingFollowUps([{ isFollowUp: false }, { isFollowUp: true }, { isFollowUp: true }]), 2)
    assert.equal(trailingFollowUps([{ isFollowUp: true }, { isFollowUp: false }]), 0)
})

test("deep-dive template questions name the project and avoid repeats", () => {
    const project = { name: "Cash$App", technologies: ["Express"] }
    const first = fallbackQuestion({ project, category: "technology_choices" })
    assert.match(first, /Cash\$App/)
    assert.match(first, /Express/)
    const second = fallbackQuestion({ project, category: "technology_choices", previousQuestions: [first] })
    assert.notEqual(second, first)
    assert.match(fallbackQuestion({ project, category: "scalability" }), /10,000 concurrent requests/)
})

test("normalises extracted projects with unique ids", () => {
    const projects = normalizeProjects([
        { name: "Chat App", summary: "Realtime chat", technologies: ["Socket.io", "Socket.io"], highlights: [] },
        { name: "Chat App", summary: "Second", technologies: [], highlights: [] },
        { name: "  ", summary: "", technologies: [], highlights: [] },
    ])
    assert.equal(projects.length, 2)
    assert.equal(projects[0].projectId, "chat-app")
    assert.notEqual(projects[1].projectId, projects[0].projectId)
    assert.deepEqual(projects[0].technologies, ["Socket.io"])
})
