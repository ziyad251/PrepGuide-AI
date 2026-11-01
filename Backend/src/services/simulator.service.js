const { z } = require("zod")
const { generateStructured } = require("./llm.service")
const { scoreMockInterview } = require("./scoring.service")

const TYPE_GUIDANCE = {
    technical: "Technical round: test engineering fundamentals, implementation depth, debugging, and trade-offs for the role.",
    hr: "HR screening round: ask about motivation, career goals, why this role and company, work style, culture fit, handling feedback, and expectations. Do not ask technical implementation questions.",
    behavioral: "Behavioural round: ask situational questions that require a concrete past example (situation, task, action, result), such as conflict, ownership, failure, deadlines, and teamwork. Do not ask technical implementation questions.",
    mixed: "Mixed round: alternate between technical depth questions and behavioural STAR-style questions so both are covered.",
}

const isNonTechnical = (interviewType) => interviewType === "hr" || interviewType === "behavioral"

/** For mixed rounds, alternate technical and behavioural questions by turn index. */
function questionStyleForTurn(interviewType, turnIndex = 0) {
    if (interviewType !== "mixed") return interviewType || "technical"
    return turnIndex % 2 === 0 ? "technical" : "behavioral"
}

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
    nextQuestionType: z.enum(["follow_up", "new_topic"]).optional(),
})

const finalReportSchema = z.object({
    summary: z.string().min(1),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    improvements: z.array(z.string()),
    idealAnswers: z.array(z.object({
        questionNumber: z.number().int().min(1),
        answerSummary: z.string(),
        idealAnswer: z.string().min(1),
        keyPoints: z.array(z.string()),
    })),
    topicsToRevise: z.array(z.object({
        topic: z.string().min(1),
        reason: z.string(),
        priority: z.enum(["low", "medium", "high"]),
    })),
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

function groundedFallbackQuestion({ targetRole, focus, retrievedContext = [], previousQuestion, previousQuestions = [], interviewType = "technical" }) {
    const { candidateEvidence, jobRequirements, previousAnswerEvidence } = selectGroundingEvidence(retrievedContext)
    const evidence = previousAnswerEvidence[0] || candidateEvidence[0]
    const requirement = jobRequirements[0]
    const style = questionStyleForTurn(interviewType, previousQuestions.length)
    if (isNonTechnical(style)) {
        if (style === "behavioral" && candidateEvidence[0]) {
            const detail = evidenceText(candidateEvidence[0]).replace(/\s+/g, " ").slice(0, 90).replace(/[.!?]+$/, "")
            const question = `Thinking about your work on ${detail}, tell me about a difficult moment. What was the situation, what did you do, and what was the result?`
            if (isUsableQuestion({ question, previousQuestion, previousQuestions, targetRole, interviewType: style })) return question
        }
        return roleFallbackQuestion({ targetRole, focus, previousQuestion, previousQuestions, interviewType: style })
    }
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

const HR_FALLBACK_QUESTIONS = [
    "What attracted you to this role, and how does it fit into where you want your career to go over the next few years?",
    "How would your previous teammates describe the way you work, and what feedback have you acted on recently?",
    "What kind of team environment helps you do your best work, and how do you adapt when it is missing?",
    "Why are you looking for a new opportunity now, and what would make you stay in a role long term?",
]

const BEHAVIORAL_FALLBACK_QUESTIONS = [
    "Tell me about a time you disagreed with a teammate on an approach. What was the situation, what did you do, and what was the outcome?",
    "Describe a project where you missed a deadline or something went wrong. What did you learn, and what did you change afterwards?",
    "Tell me about a time you took ownership of a problem nobody else was handling. How did you approach it, and what was the result?",
    "Describe a situation where you had to learn something new quickly to deliver. How did you do it, and how did it go?",
]

const roleFallbackQuestion = ({ targetRole, focus, previousQuestion, previousQuestions = [], interviewType = "technical" }) => {
    const role = String(targetRole || "").toLowerCase()
    const topic = focus || "core role fundamentals"
    let candidates
    if (interviewType === "hr") {
        candidates = HR_FALLBACK_QUESTIONS
    } else if (interviewType === "behavioral") {
        candidates = BEHAVIORAL_FALLBACK_QUESTIONS
    } else if (role.includes("backend") || role.includes("node") || role.includes("express")) {
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
    return candidates.find((candidate) => isUsableQuestion({ question: candidate, previousQuestion, previousQuestions, targetRole, interviewType })) || candidates[0]
}

const questionTokens = (question) => new Set(String(question || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter((token) => token.length > 2))
const questionSimilarity = (left, right) => {
    const first = questionTokens(left)
    const second = questionTokens(right)
    if (!first.size || !second.size) return 0
    const intersection = [...first].filter((token) => second.has(token)).length
    return intersection / new Set([...first, ...second]).size
}

function isUsableQuestion({ question, previousQuestion, previousQuestions = [], targetRole, interviewType = "technical" }) {
    const text = String(question || "").trim()
    const prefixCount = (text.match(/clarify your approach to/gi) || []).length
    const role = String(targetRole || "").toLowerCase()
    // the technical keyword check only applies to technical rounds; HR/behavioural questions are role-relevant by design
    const roleRelevant = interviewType !== "technical" || !role.includes("backend") || /api|server|node|express|database|sql|auth|service|concurr|system|cache|queue|performance/i.test(text)
    const history = [...previousQuestions, previousQuestion].filter(Boolean)
    return text.length >= 20 && prefixCount === 0 && history.every((previous) => questionSimilarity(text, previous) < 0.72) && roleRelevant
}

function questionUsesCandidateEvidence(question, retrievedContext = [], interviewType = "technical") {
    if (interviewType === "hr") return true
    const { candidateEvidence } = selectGroundingEvidence(retrievedContext)
    if (!candidateEvidence.length) return true
    const questionTokensSet = questionTokens(question)
    const evidenceTokens = new Set(candidateEvidence.flatMap((item) => [...questionTokens(evidenceText(item))]))
    const overlap = [...questionTokensSet].filter((token) => evidenceTokens.has(token))
    return overlap.length > 0
}

async function generateNextQuestion({ targetRole, focus, difficulty, resume, jobDescription, answer, previousQuestion, previousQuestions, retrievedContext = [], interviewType = "technical" }) {
    const startedAt = Date.now()
    const generated = await generateQuestionJson(`Generate ONE new interview question for the target role.
Target role: ${targetRole}
Round: ${TYPE_GUIDANCE[questionStyleForTurn(interviewType, previousQuestions.length)] || TYPE_GUIDANCE.technical}
Current focus: ${focus}
Difficulty: ${difficulty}
Candidate's latest answer summary: ${answer}
${buildQuestionContext(retrievedContext)}
${isNonTechnical(questionStyleForTurn(interviewType, previousQuestions.length)) ? "This is a non-technical question: ask about motivation, behaviour, or a real past situation, never about technical implementation. " : ""}First identify the strongest concrete candidate detail and the most relevant job requirement internally. Generate a question that connects those two pieces. Prefer naming the candidate's actual project, technology, implementation detail, or previous answer when present. Do not invent candidate experience or claim the candidate built something unless the candidate evidence supports it. If no candidate evidence exists, ask a clearly hypothetical or general technical question without implying prior use.
The previous question is context only. Do not repeat it, transform it, or use it as a template: ${previousQuestion}
Return one technically meaningful, role-relevant question that tests the current focus.`, {
        previousAnswer: answer,
        fallback: () => ({ question: groundedFallbackQuestion({ targetRole, focus, retrievedContext, previousQuestion, previousQuestions, interviewType }), focus, difficulty }),
    })
    const question = isUsableQuestion({ question: generated.question, previousQuestion, previousQuestions, targetRole, interviewType }) && questionUsesCandidateEvidence(generated.question, retrievedContext, interviewType)
        ? generated
        : { question: groundedFallbackQuestion({ targetRole, focus, retrievedContext, previousQuestion, previousQuestions, interviewType }), focus, difficulty }
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
Round: ${TYPE_GUIDANCE[questionStyleForTurn(interviewType, 0)] || TYPE_GUIDANCE.technical}
${buildQuestionContext(retrievedContext)}
${isNonTechnical(interviewType)
        ? "You may reference the candidate's background for context, but ask about motivation, behaviour, or a real situation, never about how something was technically implemented. Do not invent experience. Ask one realistic question. Do not use a generic clarification prefix."
        : "Use the strongest candidate evidence first, then connect it to one relevant job requirement. Prefer a question about the candidate's actual project, technology, or implementation. Do not invent experience. If candidate evidence is insufficient, ask a clearly hypothetical or general technical question. Do not produce a generic textbook question when concrete candidate evidence exists. Ask one realistic question that tests a specific skill. Do not use a generic clarification prefix."}`, {
        fallback: () => ({ question: groundedFallbackQuestion({ targetRole, focus: "Core role fundamentals", retrievedContext, interviewType }), focus: "Core role fundamentals", difficulty }),
    })
    const groundingStartedAt = Date.now()
    console.log("[PERF] Q1_GROUNDING_CHECK_BEGIN")
    const usable = isUsableQuestion({ question: question.question, targetRole, interviewType })
    const grounded = questionUsesCandidateEvidence(question.question, retrievedContext, interviewType)
    console.log("[PERF] Q1_GROUNDING_CHECK_END", { elapsedMs: Date.now() - groundingStartedAt, passed: usable && grounded, usable, grounded })
    const groundedQuestion = usable && grounded
        ? question
        : { ...question, question: groundedFallbackQuestion({ targetRole, focus: question.focus, retrievedContext, interviewType }) }
    console.log("OPENING_QUESTION_GENERATED", { targetRole, currentFocus: groundedQuestion.focus, previousQuestion: null, nextFocus: groundedQuestion.focus, generatedQuestion: groundedQuestion.question })
    console.log("[PERF] Q1_GENERATION_END", { elapsedMs: Date.now() - startedAt, fallback: groundedQuestion.question !== question.question })
    return groundedQuestion
}

async function evaluateAnswer({ session, turn, answer, resume, jobDescription, retrievedContext = [], needsNextQuestion = true }) {
    const interviewType = session.interviewType
    const nextStyle = questionStyleForTurn(interviewType, session.turns.length)
    const result = await callJson(`Evaluate the candidate answer and determine the next interview focus.
Role: ${session.targetRole}; type: ${interviewType}; current difficulty: ${session.currentDifficulty}
Round guidance: ${TYPE_GUIDANCE[interviewType] || TYPE_GUIDANCE.technical}
The next question must follow this style: ${TYPE_GUIDANCE[nextStyle] || TYPE_GUIDANCE.technical}
${buildQuestionContext(retrievedContext)}
Previous turns are context only and must never be copied into the next question: ${JSON.stringify(session.turns.map(({ question, answer: previousAnswer, evaluation }) => ({ question, answer: previousAnswer, evaluation })))}
Current question: ${turn.question}
Candidate answer: ${answer}
Score from 0 to 10: technicalAccuracy (correctness of facts and reasoning; for HR or behavioural answers, how specific and credible the example is), depth (problem-solving: structure, trade-offs, and reasoning toward a result), clarity (communication: organised, concise, easy to follow), and relevance (does it answer the question that was asked). Be calibrated: a vague or one-line answer must not score above 4. Write feedback addressed directly to the candidate as "you", never "the candidate". Assess only skills supported by the current answer or retrieved evidence. For every assessed skill, provide answer-grounded evidence, a skill-specific score, and confidence. Do not mark an untested skill as weak. Increase difficulty only when the answer is strong; decrease it when concepts are missing. Keep the next question connected to the missing concepts or the next logical skill. If the answer was incomplete or made a claim worth probing, ask a short contextual follow-up that digs into it and set nextQuestionType to "follow_up"; otherwise move to a new topic and set nextQuestionType to "new_topic".`, evaluationSchema, () => ({
        overall: 5, technicalAccuracy: 5, depth: 5, clarity: 5, relevance: 5,
        strengths: [], missingConcepts: [], recommendedTopics: [], feedback: "Your answer was saved, but automated feedback was unavailable for this question. It is excluded from your final score.",
        degraded: true,
        skillsAssessed: [], nextQuestion: roleFallbackQuestion({ targetRole: session.targetRole, focus: "Core role fundamentals", previousQuestions: session.turns.map(({ question }) => question), interviewType: nextStyle }), nextFocus: "Core role fundamentals", nextDifficulty: session.currentDifficulty, nextQuestionType: "new_topic",
    }))
    if (!needsNextQuestion || result.degraded) return result
    const previousQuestions = session.turns.map(({ question }) => question)
    const nextQuestionIsValid = isUsableQuestion({
        question: result.nextQuestion,
        previousQuestion: turn.question,
        previousQuestions,
        targetRole: session.targetRole,
        interviewType: nextStyle,
    }) && questionUsesCandidateEvidence(result.nextQuestion, retrievedContext, nextStyle)
    if (nextQuestionIsValid) return result
    const nextQuestion = await generateNextQuestion({ targetRole: session.targetRole, focus: result.nextFocus, difficulty: result.nextDifficulty, resume, jobDescription, answer, previousQuestion: turn.question, previousQuestions, retrievedContext, interviewType })
    return { ...result, nextQuestion: nextQuestion.question, nextFocus: nextQuestion.focus, nextDifficulty: nextQuestion.difficulty, nextQuestionType: "new_topic" }
}

const REPORT_TIMEOUT_MS = 35000

const uniqueStrings = (values, limit) => [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))].slice(0, limit)

/** Deterministic report used when the AI report cannot be generated; built only from stored evaluations. */
function fallbackFinalReport(session, aggregate) {
    const answered = session.turns.filter((turn) => turn.answer)
    const evaluated = answered.filter((turn) => turn.evaluation && !turn.evaluation.degraded)
    const missing = evaluated.flatMap((turn) => turn.evaluation.missingConcepts || [])
    const weakest = [...evaluated].sort((left, right) => left.evaluation.overall - right.evaluation.overall)
    return {
        source: "fallback",
        ...aggregate,
        summary: evaluated.length
            ? `You answered ${answered.length} question${answered.length === 1 ? "" : "s"}. This summary was built from your per-answer feedback because the detailed AI debrief was unavailable. Regenerate the report to get ideal answers and a full review.`
            : "None of your answers could be evaluated, so a score is not available yet. Regenerate the report once the AI service is reachable.",
        strengths: uniqueStrings(evaluated.flatMap((turn) => turn.evaluation.strengths || []), 6),
        weaknesses: uniqueStrings(missing, 6),
        improvements: uniqueStrings(weakest.map((turn) => turn.evaluation.feedback), 4),
        idealAnswers: [],
        topicsToRevise: uniqueStrings([...missing, ...evaluated.flatMap((turn) => turn.evaluation.recommendedTopics || [])], 6)
            .map((topic, index) => ({ topic, reason: "Flagged as missing or recommended in your answer feedback.", priority: index < 2 ? "high" : "medium" })),
    }
}

/**
 * @description Build the final mock-interview report. Scores are aggregated from stored
 * evaluations; the LLM writes the qualitative debrief. Falls back to a deterministic report.
 */
async function generateFinalReport({ session, report }) {
    const aggregate = scoreMockInterview(session.turns, session.interviewType)
    const transcript = session.turns
        .map((turn, index) => ({ turn, questionNumber: index + 1 }))
        .filter(({ turn }) => turn.answer)
        .map(({ turn, questionNumber }) => ({
            questionNumber,
            question: turn.question,
            answer: String(turn.answer).slice(0, 3000),
            evaluation: turn.evaluation && !turn.evaluation.degraded
                ? { overall: turn.evaluation.overall, feedback: turn.evaluation.feedback, missingConcepts: turn.evaluation.missingConcepts }
                : "not evaluated",
        }))
    let generated
    try {
        generated = await generateStructured({
            operation: "final_report",
            timeoutMs: REPORT_TIMEOUT_MS,
            schema: finalReportSchema,
            prompt: `You are a senior interviewer writing the debrief for a completed ${session.interviewType} mock interview for the role "${session.targetRole}".
Round guidance: ${TYPE_GUIDANCE[session.interviewType] || TYPE_GUIDANCE.technical}
Aggregated scores (0-100, computed from per-answer evaluations; do not contradict them): ${JSON.stringify(aggregate.scores)}; overall ${aggregate.overallScore}.
Job description (context): ${String(report?.jobDescription || "").slice(0, 2500)}
Candidate resume (context; claims, not proof): ${String(report?.resume || report?.selfDescription || "").slice(0, 2500)}
Transcript: ${JSON.stringify(transcript)}

Write a candid, specific debrief grounded only in the transcript:
- summary: 2-4 sentences on overall performance and readiness.
- strengths and weaknesses: 2-5 concrete items each, referencing what the candidate actually said.
- improvements: 3-5 actionable changes to how they answer.
- idealAnswers: one entry per answered question (use its questionNumber) with a one-sentence answerSummary of what they said, a strong model answer (4-8 sentences, first person, as the candidate would say it), and 3-5 keyPoints the ideal answer covers.
- topicsToRevise: 3-6 specific topics, each with a reason tied to the transcript and a priority.
Address the candidate directly as "you" throughout; never write "the candidate". Do not invent experience the candidate did not mention.`,
        })
    } catch (error) {
        console.error("[REPORT] final report generation failed; using fallback", { code: error.code || error.name, provider: error.provider })
        return fallbackFinalReport(session, aggregate)
    }
    const answeredNumbers = new Set(transcript.map((item) => item.questionNumber))
    const idealAnswers = generated.idealAnswers
        .filter((item) => answeredNumbers.has(item.questionNumber))
        .map((item) => {
            const turn = session.turns[item.questionNumber - 1]
            return {
                question: turn.question,
                answerSummary: item.answerSummary,
                idealAnswer: item.idealAnswer,
                keyPoints: item.keyPoints.slice(0, 6),
                score: turn.evaluation && !turn.evaluation.degraded ? turn.evaluation.overall : undefined,
            }
        })
    return {
        source: "ai",
        ...aggregate,
        summary: generated.summary,
        strengths: generated.strengths.slice(0, 6),
        weaknesses: generated.weaknesses.slice(0, 6),
        improvements: generated.improvements.slice(0, 6),
        idealAnswers,
        topicsToRevise: generated.topicsToRevise.slice(0, 8),
    }
}

module.exports = { generateOpeningQuestion, evaluateAnswer, generateSkillInventory, generateFinalReport, fallbackFinalReport, evaluationSchema, skillInventorySchema, finalReportSchema, isUsableQuestion, selectGroundingEvidence, buildQuestionContext, groundedFallbackQuestion, questionUsesCandidateEvidence, questionStyleForTurn, roleFallbackQuestion, callJson, uniqueStrings }
