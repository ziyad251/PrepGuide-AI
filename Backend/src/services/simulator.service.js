const { z } = require("zod")
const { generateStructured } = require("./llm.service")

const questionSchema = z.object({
    question: z.string().trim().min(20),
    focus: z.string().trim().min(1),
    difficulty: z.enum(["easy", "medium", "hard"]),
})

const skillInventorySchema = z.object({
    skills: z.array(z.object({
        skill: z.string(),
        category: z.string(),
        importance: z.enum(["low", "medium", "high"]),
        source: z.array(z.enum(["resume", "job_description", "interview", "self_reported"])),
        baselineScore: z.number().min(0).max(100).nullable(),
        confidence: z.number().min(0).max(1),
    })),
})

const evaluationSchema = z.object({
    overall: z.number().min(0).max(10),
    technicalAccuracy: z.number().min(0).max(10),
    depth: z.number().min(0).max(10),
    clarity: z.number().min(0).max(10),
    relevance: z.number().min(0).max(10),
    strengths: z.array(z.string()),
    missingConcepts: z.array(z.string()),
    recommendedTopics: z.array(z.string()),
    feedback: z.string(),
    skillsAssessed: z.array(z.object({
        skill: z.string(),
        category: z.string().optional(),
        score: z.number().min(0).max(10),
        confidence: z.number().min(0).max(1),
        evidence: z.array(z.string()),
        strengths: z.array(z.string()),
        gaps: z.array(z.string()),
    })),
    nextQuestion: z.string(),
    nextFocus: z.string(),
    nextDifficulty: z.enum(["easy", "medium", "hard"]),
})

const candidateSources = new Set(["PROJECT", "RESUME", "SKILL", "INTERVIEW_ANSWER", "ASSESSMENT"])

function evidenceText(item) {
    return String(item?.content || "").trim()
}

function selectGroundingEvidence(retrievedContext = []) {
    const usable = retrievedContext.filter((item) => evidenceText(item))
    const candidateEvidence = usable.filter((item) => candidateSources.has(item.source)).slice(0, 3)
    const jobRequirements = usable.filter((item) => item.source === "JOB_DESCRIPTION").slice(0, 2)
    const previousAnswerEvidence = usable.filter((item) => ["INTERVIEW_ANSWER", "ASSESSMENT"].includes(item.source)).slice(0, 2)
    return { candidateEvidence, jobRequirements, previousAnswerEvidence }
}

function formatEvidence(items, emptyMessage) {
    return items.length
        ? items.map((item, index) => `[${index + 1}] ${item.source} — ${evidenceText(item)}`).join("\n")
        : emptyMessage
}

function buildQuestionContext(retrievedContext = []) {
    const selected = selectGroundingEvidence(retrievedContext)
    return `CANDIDATE EVIDENCE (highest priority; use concrete details from here):
${formatEvidence(selected.candidateEvidence, "None retrieved. Do not invent candidate experience.")}

JOB REQUIREMENT (connect the candidate evidence to this):
${formatEvidence(selected.jobRequirements, "None retrieved.")}

PREVIOUS-ANSWER EVIDENCE (use for a targeted follow-up when present):
${formatEvidence(selected.previousAnswerEvidence, "None retrieved.")}`
}

function groundedFallbackQuestion({ targetRole, focus, retrievedContext = [], previousQuestion, previousQuestions = [] }) {
    const { candidateEvidence, jobRequirements, previousAnswerEvidence } = selectGroundingEvidence(retrievedContext)
    const evidence = previousAnswerEvidence[0] || candidateEvidence[0]
    const requirement = jobRequirements[0]
    if (evidence) {
        const detail = evidenceText(evidence).replace(/\s+/g, " ").slice(0, 110).replace(/[.!?]+$/, "")
        const requirementText = requirement ? ` How would you connect that approach to ${evidenceText(requirement).replace(/\s+/g, " ").slice(0, 90).replace(/[.!?]+$/, "")}?` : ` What trade-offs and tests would you use to make that work reliable?`
        const question = `You described ${detail}. What technical decisions would you make to improve it?${requirementText}`
        if (isUsableQuestion({ question, previousQuestion, previousQuestions, targetRole })) return question
    }
    return roleFallbackQuestion({ targetRole, focus, previousQuestion, previousQuestions })
}

const callJson = async (prompt, schema, fallback) => {
    try {
        return await generateStructured({ prompt, schema })
    } catch (error) {
        console.log("[LLM] EXISTING_FALLBACK_USED")
        console.error("Structured LLM response failed; using fallback", {
            code: error.code || error.name,
            provider: error.provider,
            error: error.message,
        })
        return fallback()
    }
}

const normalizedTokens = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean)

const hasVerbatimAnswerPortion = (question, previousAnswer) => {
        const questionTokens = normalizedTokens(question)
        const answerTokens = normalizedTokens(previousAnswer)
        if (answerTokens.length < 8) return false
        for (let start = 0; start <= answerTokens.length - 8; start += 1) {
            const phrase = answerTokens.slice(start, start + 8).join(" ")
            if (questionTokens.join(" ").includes(phrase)) return true
        }
        return false
    }

const questionQualityIssues = ({ question, previousAnswer }) => {
        const text = String(question || "").trim()
        const issues = []
        if (text.length > 360 || normalizedTokens(text).length > 60) issues.push("too long")
        if (text.split(/[.!?]+/).filter(Boolean).length > 3) issues.push("too many sentences")
        if (!/[?]$/.test(text)) issues.push("not phrased as a question")
        if (/(the candidate should|the candidate must|the interviewer should|based on the job description|for a .{0,80} role\b|the candidate is expected to|the response should)/i.test(text)) issues.push("instruction leakage")
        if (hasVerbatimAnswerPortion(text, previousAnswer)) issues.push("copied previous answer")
        return issues
    }

const generateQuestionJson = async (prompt, { previousAnswer, fallback }) => {
        const startedAt = Date.now()
        const conciseInstruction = `\n\nReturn ONLY the interview question in the question field. Keep it to 1-3 sentences and under 60 words. Do not include role labels, instructions, analysis, retrieved context, or phrases like "the candidate should". Paraphrase any previous answer instead of quoting it. End with a single question mark.`
        let first
        try {
            first = await generateStructured({ prompt, schema: questionSchema, operation: "q1" })
        } catch (error) {
            console.log("[PERF] Q1_QUALITY_CHECK_END", { elapsedMs: 0, passed: false, reason: error.code || error.name })
            if (error.code !== "AI_SCHEMA_VALIDATION_FAILED") {
                console.error("Question generation failed; using grounded fallback", { code: error.code || error.name, provider: error.provider })
                return fallback()
            }
        }
        if (first) {
            const qualityStartedAt = Date.now()
            console.log("[PERF] Q1_QUALITY_CHECK_BEGIN")
            const issues = questionQualityIssues({ question: first.question, previousAnswer })
            console.log("[PERF] Q1_QUALITY_CHECK_END", { elapsedMs: Date.now() - qualityStartedAt, passed: issues.length === 0, issues })
            if (!issues.length) return first
        }
        console.log("[PERF] Q1_RETRY_BEGIN", { reason: first ? "quality_validation" : "schema_validation" })
        const retryStartedAt = Date.now()
        try {
            const retry = await generateStructured({ prompt: `${prompt}${conciseInstruction}`, schema: questionSchema, operation: "q1_retry" })
            const retryElapsedMs = Date.now() - retryStartedAt
            const retryIssues = questionQualityIssues({ question: retry.question, previousAnswer })
            console.log("[PERF] Q1_RETRY_END", { elapsedMs: retryElapsedMs, passed: retryIssues.length === 0, issues: retryIssues })
            if (!retryIssues.length) return retry
        } catch (error) {
            console.log("[PERF] Q1_RETRY_END", { elapsedMs: Date.now() - retryStartedAt, passed: false, reason: error.code || error.name })
            console.error("Question generation failed; using grounded fallback", { code: error.code || error.name, provider: error.provider })
        }
        console.log("[PERF] Q1_GENERATION_END", { elapsedMs: Date.now() - startedAt, fallback: true })
        return fallback()
}

const roleFallbackQuestion = ({ targetRole, focus, previousQuestion, previousQuestions = [] }) => {
    const role = String(targetRole || "").toLowerCase()
    const topic = focus || "core role fundamentals"
    let candidates
    if (role.includes("backend") || role.includes("node") || role.includes("express")) {
        candidates = [
            `How would you design a backend service to handle ${topic} under production load, and which trade-offs matter?`,
            `How would you diagnose and resolve a ${topic} problem in a production API?`,
            `How would you test and monitor ${topic} before deploying an API?`,
        ]
    } else {
        candidates = [
            `How would you solve a realistic production problem involving ${topic}, and how would you justify your technical decisions?`,
            `How would you investigate a production issue involving ${topic} and choose a reliable solution?`,
            `How would you validate and communicate a technical decision about ${topic}?`,
        ]
    }
    return candidates.find((candidate) => isUsableQuestion({ question: candidate, previousQuestion, previousQuestions, targetRole })) || candidates[0]
}

const questionTokens = (question) => new Set(String(question || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter((token) => token.length > 2))
const questionSimilarity = (left, right) => {
    const first = questionTokens(left)
    const second = questionTokens(right)
    if (!first.size || !second.size) return 0
    const intersection = [...first].filter((token) => second.has(token)).length
    return intersection / new Set([...first, ...second]).size
}

function isUsableQuestion({ question, previousQuestion, previousQuestions = [], targetRole }) {
    const text = String(question || "").trim()
    const prefixCount = (text.match(/clarify your approach to/gi) || []).length
    const role = String(targetRole || "").toLowerCase()
    const roleRelevant = !role.includes("backend") || /api|server|node|express|database|sql|auth|service|concurr|system|cache|queue|performance/i.test(text)
    const history = [...previousQuestions, previousQuestion].filter(Boolean)
    return text.length >= 20 && prefixCount === 0 && history.every((previous) => questionSimilarity(text, previous) < 0.72) && roleRelevant
}

function questionUsesCandidateEvidence(question, retrievedContext = []) {
    const { candidateEvidence } = selectGroundingEvidence(retrievedContext)
    if (!candidateEvidence.length) return true
    const questionTokensSet = questionTokens(question)
    const evidenceTokens = new Set(candidateEvidence.flatMap((item) => [...questionTokens(evidenceText(item))]))
    const overlap = [...questionTokensSet].filter((token) => evidenceTokens.has(token))
    return overlap.length > 0
}

async function generateNextQuestion({ targetRole, focus, difficulty, resume, jobDescription, answer, previousQuestion, previousQuestions, retrievedContext = [] }) {
    const startedAt = Date.now()
    const generated = await generateQuestionJson(`Generate ONE new interview question for the target role.
Target role: ${targetRole}
Current focus: ${focus}
Difficulty: ${difficulty}
Candidate's latest answer summary: ${answer}
${buildQuestionContext(retrievedContext)}
First identify the strongest concrete candidate detail and the most relevant job requirement internally. Generate a question that connects those two pieces. Prefer naming the candidate's actual project, technology, implementation detail, or previous answer when present. Do not invent candidate experience or claim the candidate built something unless the candidate evidence supports it. If no candidate evidence exists, ask a clearly hypothetical or general technical question without implying prior use.
The previous question is context only. Do not repeat it, transform it, or use it as a template: ${previousQuestion}
Return one technically meaningful, role-relevant question that tests the current focus.`, {
        previousAnswer: answer,
        fallback: () => ({ question: groundedFallbackQuestion({ targetRole, focus, retrievedContext, previousQuestion, previousQuestions }), focus, difficulty }),
    })
    const question = isUsableQuestion({ question: generated.question, previousQuestion, previousQuestions, targetRole }) && questionUsesCandidateEvidence(generated.question, retrievedContext)
        ? generated
        : { question: groundedFallbackQuestion({ targetRole, focus, retrievedContext, previousQuestion, previousQuestions }), focus, difficulty }
    console.log("QUESTION_GENERATED", { targetRole, currentFocus: focus, previousQuestion, nextFocus: question.focus, generatedQuestion: question.question })
    console.log("[LLM] next question generation timing", { elapsedMs: Date.now() - startedAt })
    return question
}

async function generateSkillInventory({ resume, selfDescription, jobDescription, report }) {
    return callJson(`Build a concise candidate skill inventory for the target role. Only include skills relevant to the job. Normalize aliases such as Node/Node.js and Postgres/PostgreSQL. A resume or self-description is a claim, not demonstrated ability. Resume: ${resume}\nSelf-description: ${selfDescription}\nJob description: ${jobDescription}\nExisting report skill gaps: ${JSON.stringify(report.skillGaps || [])}`, skillInventorySchema, () => ({ skills: (report.skillGaps || []).map((gap) => ({ skill: gap.skill, category: "Role requirement", importance: gap.severity, source: ["job_description"], baselineScore: null, confidence: 0.2 })) }))
}

async function generateOpeningQuestion({ targetRole, interviewType, difficulty, resume, jobDescription, retrievedContext = [] }) {
    const startedAt = Date.now()
    const question = await generateQuestionJson(`Create the opening question for an adaptive ${interviewType} interview.
Role: ${targetRole}
Difficulty: ${difficulty}
${buildQuestionContext(retrievedContext)}
Use the strongest candidate evidence first, then connect it to one relevant job requirement. Prefer a question about the candidate's actual project, technology, or implementation. Do not invent experience. If candidate evidence is insufficient, ask a clearly hypothetical or general technical question. Do not produce a generic textbook question when concrete candidate evidence exists. Ask one realistic question that tests a specific skill. Do not use a generic clarification prefix.`, {
        fallback: () => ({ question: groundedFallbackQuestion({ targetRole, focus: "Core role fundamentals", retrievedContext }), focus: "Core role fundamentals", difficulty }),
    })
    const groundingStartedAt = Date.now()
    console.log("[PERF] Q1_GROUNDING_CHECK_BEGIN")
    const usable = isUsableQuestion({ question: question.question, targetRole })
    const grounded = questionUsesCandidateEvidence(question.question, retrievedContext)
    console.log("[PERF] Q1_GROUNDING_CHECK_END", { elapsedMs: Date.now() - groundingStartedAt, passed: usable && grounded, usable, grounded })
    const groundedQuestion = usable && grounded
        ? question
        : { ...question, question: groundedFallbackQuestion({ targetRole, focus: question.focus, retrievedContext }) }
    console.log("OPENING_QUESTION_GENERATED", { targetRole, currentFocus: groundedQuestion.focus, previousQuestion: null, nextFocus: groundedQuestion.focus, generatedQuestion: groundedQuestion.question })
    console.log("[PERF] Q1_GENERATION_END", { elapsedMs: Date.now() - startedAt, fallback: groundedQuestion.question !== question.question })
    return groundedQuestion
}

async function evaluateAnswer({ session, turn, answer, resume, jobDescription, retrievedContext = [] }) {
    const result = await callJson(`Evaluate the candidate answer and determine the next interview focus.
Role: ${session.targetRole}; type: ${session.interviewType}; current difficulty: ${session.currentDifficulty}
${buildQuestionContext(retrievedContext)}
Previous turns are context only and must never be copied into the next question: ${JSON.stringify(session.turns.map(({ question, answer: previousAnswer, evaluation }) => ({ question, answer: previousAnswer, evaluation })))}
Current question: ${turn.question}
Candidate answer: ${answer}
Score accuracy, depth, clarity, and relevance from 0 to 10. Assess only skills supported by the current answer or retrieved evidence. For every assessed skill, provide answer-grounded evidence, a skill-specific score, and confidence. Do not mark an untested skill as weak. Increase difficulty only when the answer is strong; decrease it when concepts are missing. Keep the next question connected to the missing concepts or the next logical skill.`, evaluationSchema, () => ({
        overall: 5, technicalAccuracy: 5, depth: 5, clarity: 5, relevance: 5,
        strengths: [], missingConcepts: [], recommendedTopics: [], feedback: "The answer was saved, but automated evaluation was unavailable. Please retry this turn.",
        skillsAssessed: [], nextQuestion: roleFallbackQuestion({ targetRole: session.targetRole, focus: "Core role fundamentals" }), nextFocus: "Core role fundamentals", nextDifficulty: session.currentDifficulty,
    }))
    const previousQuestions = session.turns.map(({ question }) => question)
    const nextQuestionIsValid = isUsableQuestion({
        question: result.nextQuestion,
        previousQuestion: turn.question,
        previousQuestions,
        targetRole: session.targetRole,
    }) && questionUsesCandidateEvidence(result.nextQuestion, retrievedContext)
    if (nextQuestionIsValid) return result
    const nextQuestion = await generateNextQuestion({ targetRole: session.targetRole, focus: result.nextFocus, difficulty: result.nextDifficulty, resume, jobDescription, answer, previousQuestion: turn.question, previousQuestions, retrievedContext })
    return { ...result, nextQuestion: nextQuestion.question, nextFocus: nextQuestion.focus, nextDifficulty: nextQuestion.difficulty }
}

module.exports = { generateOpeningQuestion, evaluateAnswer, generateSkillInventory, evaluationSchema, skillInventorySchema, isUsableQuestion, selectGroundingEvidence, buildQuestionContext, groundedFallbackQuestion, questionUsesCandidateEvidence }
