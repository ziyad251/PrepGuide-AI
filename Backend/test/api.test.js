/**
 * HTTP-level tests for the simulator and deep-dive APIs. They exercise the real Express app,
 * auth middleware, validation, and controllers, with Mongoose model methods stubbed so no
 * database is required. LLM providers are stubbed to simulate outages.
 */
const test = require("node:test")
const assert = require("node:assert/strict")
const jwt = require("jsonwebtoken")

process.env.JWT_SECRET = "test-secret"
delete process.env.OPENROUTER_API_KEY

const app = require("../src/app")
const blacklistModel = require("../src/models/blacklist.model")
const interviewSessionModel = require("../src/models/interviewSession.model")
const interviewReportModel = require("../src/models/interviewReport.model")
const deepDiveSessionModel = require("../src/models/deepDiveSession.model")
const knowledgeDocumentModel = require("../src/models/knowledgeDocument.model")
const { setRequestOverridesForTests } = require("../src/services/llm.service")

const USER_ID = "64b000000000000000000001"
const SESSION_ID = "64b0000000000000000000aa"
const REPORT_ID = "64b0000000000000000000bb"
const token = jwt.sign({ id: USER_ID, username: "candidate" }, process.env.JWT_SECRET)

/** Mimics a Mongoose query: chainable populate/select/lean that resolves to value. */
const query = (value) => {
    const chain = { populate: () => chain, select: () => chain, lean: () => chain, sort: () => chain, skip: () => chain, limit: () => chain, then: (resolve, reject) => Promise.resolve(value).then(resolve, reject) }
    return chain
}

const originals = []
function stub(target, method, implementation) {
    originals.push([target, method, target[method]])
    target[method] = implementation
}

let server
let baseUrl
test.before(async () => {
    await new Promise((resolve) => { server = app.listen(0, resolve) })
    baseUrl = `http://127.0.0.1:${server.address().port}`
})
test.after(() => server.close())
test.beforeEach(() => {
    stub(blacklistModel, "findOne", async () => null)
    stub(knowledgeDocumentModel, "find", () => query([]))
})
test.afterEach(() => {
    while (originals.length) {
        const [target, method, original] = originals.pop()
        target[method] = original
    }
    setRequestOverridesForTests()
})

const providerDown = async () => {
    const error = new Error("service unavailable")
    error.status = 503
    throw error
}

async function call(method, path, body, { auth = true } = {}) {
    const response = await fetch(baseUrl + path, {
        method,
        headers: { "Content-Type": "application/json", ...(auth ? { Cookie: `token=${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
    })
    return { status: response.status, body: await response.json() }
}

function mockSession(overrides = {}) {
    return {
        _id: SESSION_ID,
        user: USER_ID,
        report: { _id: REPORT_ID, resume: "Built PrepGuide with Node.js", jobDescription: "Backend role", selfDescription: "" },
        targetRole: "Backend Developer",
        interviewType: "technical",
        currentDifficulty: "medium",
        status: "active",
        questionLimit: 8,
        skillProfile: [],
        topSkillGaps: [],
        turns: [{ _id: "t1", question: "How does PrepGuide validate API input?", difficulty: "medium" }],
        saved: 0,
        async save() { this.saved += 1 },
        ...overrides,
    }
}

test("rejects unauthenticated requests", async () => {
    const response = await call("GET", `/api/interview/simulator/${SESSION_ID}`, undefined, { auth: false })
    assert.equal(response.status, 401)
})

test("rejects malformed session ids with 400 JSON instead of a server error", async () => {
    const response = await call("GET", "/api/interview/simulator/not-an-id")
    assert.equal(response.status, 400)
    assert.match(response.body.message, /sessionId/)
})

test("scopes session lookups to the authenticated user", async () => {
    let receivedFilter
    stub(interviewSessionModel, "findOne", (filter) => { receivedFilter = filter; return query(null) })
    const response = await call("GET", `/api/interview/simulator/${SESSION_ID}`)
    assert.equal(response.status, 404)
    assert.equal(String(receivedFilter.user), USER_ID)
})

test("validates simulator start payloads", async () => {
    const response = await call("POST", "/api/interview/simulator", { reportId: REPORT_ID, interviewType: "trivia" })
    assert.equal(response.status, 400)
    assert.match(response.body.message, /interviewType/)
})

test("rejects empty answers", async () => {
    const response = await call("POST", `/api/interview/simulator/${SESSION_ID}/answer`, { answer: "   " })
    assert.equal(response.status, 400)
})

test("returns 409 when the same question is submitted twice concurrently", async () => {
    stub(interviewSessionModel, "findOne", () => query(mockSession()))
    stub(interviewSessionModel, "updateOne", async () => ({ modifiedCount: 0 }))
    const response = await call("POST", `/api/interview/simulator/${SESSION_ID}/answer`, { answer: "We validate with zod." })
    assert.equal(response.status, 409)
})

test("stores a degraded evaluation and keeps the interview going when the AI is down", async () => {
    setRequestOverridesForTests({ gemini: providerDown })
    const session = mockSession()
    stub(interviewSessionModel, "findOne", () => query(session))
    stub(interviewSessionModel, "updateOne", async () => ({ modifiedCount: 1 }))
    const response = await call("POST", `/api/interview/simulator/${SESSION_ID}/answer`, { answer: "We validate requests with zod schemas in middleware." })
    assert.equal(response.status, 200)
    assert.equal(response.body.evaluation.degraded, true)
    assert.equal(session.turns.length, 2)
    assert.equal(response.body.readyToFinish, false)
})

test("releases the claimed answer when processing fails so the candidate can resubmit", async () => {
    setRequestOverridesForTests({ gemini: providerDown })
    const updates = []
    stub(interviewSessionModel, "findOne", () => query(mockSession({ async save() { throw new Error("write conflict") } })))
    stub(interviewSessionModel, "updateOne", async (filter, update) => { updates.push(update); return { modifiedCount: 1 } })
    const response = await call("POST", `/api/interview/simulator/${SESSION_ID}/answer`, { answer: "An answer that fails to save." })
    assert.equal(response.status, 502)
    assert.ok(updates.some((update) => update.$unset && "turns.0.answer" in update.$unset))
})

test("stops asking questions once the question limit is reached", async () => {
    setRequestOverridesForTests({ gemini: providerDown })
    const session = mockSession({ questionLimit: 3, turns: [
        { _id: "a", question: "First question about the API?", answer: "a", difficulty: "medium" },
        { _id: "b", question: "Second question about the database?", answer: "b", difficulty: "medium" },
        { _id: "c", question: "Third question about caching layers?", difficulty: "medium" },
    ] })
    stub(interviewSessionModel, "findOne", () => query(session))
    stub(interviewSessionModel, "updateOne", async () => ({ modifiedCount: 1 }))
    const response = await call("POST", `/api/interview/simulator/${SESSION_ID}/answer`, { answer: "Cache reads in Redis with a TTL." })
    assert.equal(response.status, 200)
    assert.equal(response.body.readyToFinish, true)
    assert.equal(session.turns.length, 3)
})

test("finishing produces a fallback report when the AI is down, and refuses an empty interview", async () => {
    setRequestOverridesForTests({ gemini: providerDown })
    let current = mockSession()
    stub(interviewSessionModel, "findOne", () => query(current))
    const empty = await call("POST", `/api/interview/simulator/${SESSION_ID}/finish`, {})
    assert.equal(empty.status, 400)

    current = mockSession({ turns: [
        { question: "Explain JWT?", answer: "Signed token with expiry.", difficulty: "medium", evaluation: { overall: 7, technicalAccuracy: 8, depth: 6, clarity: 8, relevance: 8, strengths: ["Clear"], missingConcepts: ["Refresh rotation"], recommendedTopics: [], feedback: "Good." } },
        { question: "Unanswered follow-up about refresh tokens?", difficulty: "medium" },
    ] })
    const response = await call("POST", `/api/interview/simulator/${SESSION_ID}/finish`, {})
    assert.equal(response.status, 200)
    assert.equal(response.body.session.status, "completed")
    assert.equal(response.body.session.finalReport.source, "fallback")
    // technical weights: 0.35*80 + 0.25*60 + 0.2*80 + 0.2*80 = 75
    assert.equal(response.body.session.finalReport.overallScore, 75)
    assert.equal(response.body.session.turns.length, 1, "trailing unanswered question is dropped")
})

test("deep-dive start requires exactly one of projectId or customProject", async () => {
    const response = await call("POST", "/api/deep-dive", { reportId: REPORT_ID, projectId: "chat", customProject: { name: "Chat", description: "A realtime chat application." } })
    assert.equal(response.status, 400)
})

test("deep-dive projects are served from cache without calling the AI", async () => {
    let aiCalled = false
    setRequestOverridesForTests({ gemini: async () => { aiCalled = true; return "{}" } })
    stub(interviewReportModel, "findOne", () => query({ _id: REPORT_ID, title: "Backend", projectsExtractedAt: new Date(), projects: [{ projectId: "chat", name: "Chat" }] }))
    const response = await call("GET", `/api/deep-dive/reports/${REPORT_ID}/projects`)
    assert.equal(response.status, 200)
    assert.equal(response.body.cached, true)
    assert.equal(aiCalled, false)
})

test("deep-dive project extraction failure returns a recoverable 502", async () => {
    setRequestOverridesForTests({ gemini: providerDown })
    stub(interviewReportModel, "findOne", () => query({ _id: REPORT_ID, title: "Backend", resume: "..." }))
    const response = await call("GET", `/api/deep-dive/reports/${REPORT_ID}/projects`)
    assert.equal(response.status, 502)
    assert.equal(response.body.code, "AI_UNAVAILABLE")
})

test("deep-dive answer falls back to a template question when the AI is down", async () => {
    setRequestOverridesForTests({ gemini: providerDown })
    const session = {
        _id: SESSION_ID,
        status: "active",
        questionLimit: 8,
        focusAreas: ["architecture", "scalability"],
        project: { name: "PrepGuide", technologies: ["Express"] },
        turns: [{ question: "Walk me through the architecture of PrepGuide?", category: "architecture", difficulty: "medium" }],
        async save() {},
    }
    stub(deepDiveSessionModel, "findOne", () => query(session))
    stub(deepDiveSessionModel, "updateOne", async () => ({ modifiedCount: 1 }))
    const response = await call("POST", `/api/deep-dive/${SESSION_ID}/answer`, { answer: "React frontend, Express API, MongoDB." })
    assert.equal(response.status, 200)
    assert.equal(response.body.evaluation.degraded, true)
    assert.equal(session.turns[1].category, "scalability")
    assert.match(session.turns[1].question, /PrepGuide/)
})
