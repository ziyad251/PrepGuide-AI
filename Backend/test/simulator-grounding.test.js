const test = require("node:test")
const assert = require("node:assert/strict")
const {
    buildQuestionContext,
    groundedFallbackQuestion,
    selectGroundingEvidence,
} = require("../src/services/simulator.service")

const projectEvidence = {
    source: "PROJECT",
    content: "PrepGuide AI uses Node.js, MongoDB, and Gemini APIs for an interview simulator backend.",
}
const jobEvidence = {
    source: "JOB_DESCRIPTION",
    content: "The role requires testing and monitoring production APIs before deploying to AWS.",
}

test("prioritizes concrete project evidence and connects it to the job requirement", () => {
    const question = groundedFallbackQuestion({
        targetRole: "Backend Developer",
        focus: "testing and monitoring",
        retrievedContext: [jobEvidence, projectEvidence],
    })
    assert.match(question, /Node\.js|MongoDB|Gemini|PrepGuide/i)
    assert.match(question, /testing|monitoring|AWS|production/i)
})

test("does not claim unsupported Redis experience", () => {
    const question = groundedFallbackQuestion({
        targetRole: "Backend Developer",
        focus: "caching",
        retrievedContext: [projectEvidence, jobEvidence],
    })
    assert.doesNotMatch(question, /used Redis|built Redis|our Redis/i)
    assert.match(buildQuestionContext([jobEvidence]), /Do not invent candidate experience/i)
})

test("keeps previous-answer evidence available for follow-up grounding", () => {
    const previousAnswer = {
        source: "INTERVIEW_ANSWER",
        content: "I added a retry with exponential backoff around Gemini calls.",
    }
    const selected = selectGroundingEvidence([jobEvidence, projectEvidence, previousAnswer])
    assert.equal(selected.previousAnswerEvidence[0], previousAnswer)
    const question = groundedFallbackQuestion({
        targetRole: "Backend Developer",
        focus: "reliability",
        retrievedContext: [jobEvidence, projectEvidence, previousAnswer],
    })
    assert.match(question, /retry|exponential backoff|Gemini/i)
})
