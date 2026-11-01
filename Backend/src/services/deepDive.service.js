const { z } = require("zod")
const { generateStructured } = require("./llm.service")
const { scoreDeepDive } = require("./scoring.service")
const { isUsableQuestion, uniqueStrings } = require("./simulator.service")
const { DEEP_DIVE_CATEGORIES } = require("../models/deepDiveSession.model")

const MAX_FOLLOW_UPS_PER_TOPIC = 2
const REPORT_TIMEOUT_MS = 35000

/**
 * Interview categories in the order they are covered by default. Each has prompt guidance
 * and deterministic fallback questions used when the AI provider is unavailable.
 */
const CATEGORY_META = {
    architecture: {
        label: "Architecture",
        guidance: "overall system design, component boundaries, data flow, and why it is structured that way",
        templates: [
            "Walk me through the architecture of {name}. What are the main components, how do they communicate, and why did you structure it that way?",
            "If you rebuilt {name} today, which architectural decision would you change first, and what trade-off pushed you there originally?",
        ],
    },
    technology_choices: {
        label: "Technology choices",
        guidance: "why each technology was chosen, alternatives considered, and the trade-offs accepted",
        templates: [
            "Why did you choose {tech} for {name}? What alternatives did you consider, and what trade-offs did that decision bring?",
            "What is one limitation of {tech} you ran into while building {name}, and how did you work around it?",
        ],
    },
    database_design: {
        label: "Database design",
        guidance: "data model, relationships, indexing, consistency, and query patterns",
        templates: [
            "How did you model the data in {name}? Walk me through the main collections or tables, their relationships, and the indexes you rely on.",
            "Which query in {name} would get slow first as data grows, and how would you redesign the schema or indexes to fix it?",
        ],
    },
    api_design: {
        label: "API design",
        guidance: "endpoint structure, validation, status codes, pagination, versioning, and contracts with the client",
        templates: [
            "How did you design the API for {name}? How are endpoints structured, how is input validated, and how do errors reach the client?",
            "How would you evolve the API of {name} without breaking existing clients? Give a concrete example of a change you would make.",
        ],
    },
    auth_security: {
        label: "Authentication & security",
        guidance: "authentication and authorization flow, token or session handling, common attacks, and data protection",
        templates: [
            "How does authentication work in {name}, end to end? What would an attacker try first, and how have you protected against it?",
            "How do you make sure a user of {name} can only access their own data? Where exactly is that check enforced?",
        ],
    },
    performance: {
        label: "Performance",
        guidance: "bottlenecks, measurement, caching, query optimisation, and frontend or backend latency",
        templates: [
            "Which part of {name} would be slowest under real usage, and how would you measure and optimise it?",
            "Where could caching help in {name}, what would you cache, and how would you keep it from serving stale data?",
        ],
    },
    scalability: {
        label: "Scalability",
        guidance: "behaviour under load, horizontal scaling, statelessness, queues, and the first thing to break",
        templates: [
            "If {name} suddenly received 10,000 concurrent requests, what would break first and how would you redesign it to cope?",
            "What state does {name} keep on a single server today, and what would you change to run it across several instances?",
        ],
    },
    error_handling: {
        label: "Error handling",
        guidance: "failure modes, retries, timeouts, validation, logging, and what the user sees when something fails",
        templates: [
            "How does {name} behave when an external service or the database is slow or down? What does the user see, and what gets logged?",
            "Give me an example of an error in {name} that you handle explicitly. Why that approach rather than letting it fail?",
        ],
    },
    real_world_scenarios: {
        label: "Real-world scenarios",
        guidance: "production debugging, incidents, monitoring, deployment, and practical engineering judgement",
        templates: [
            "Users report that {name} fails intermittently in production, but you cannot reproduce it locally. How would you debug it step by step?",
            "A deploy of {name} just doubled the error rate. Walk me through the first fifteen minutes of your response.",
        ],
    },
}

const categoryEnum = z.enum(DEEP_DIVE_CATEGORIES)

const projectExtractionSchema = z.object({
    projects: z.array(z.object({
        name: z.string().min(1),
        summary: z.string(),
        technologies: z.array(z.string()),
        highlights: z.array(z.string()),
    })),
})

const openingQuestionSchema = z.object({
    question: z.string().trim().min(20),
    category: categoryEnum,
})

const turnEvaluationSchema = z.object({
    overall: z.number().min(0).max(10),
    understanding: z.number().min(0).max(10),
    technicalDepth: z.number().min(0).max(10),
    accuracy: z.number().min(0).max(10),
    communication: z.number().min(0).max(10),
    feedback: z.string().min(1),
    strengths: z.array(z.string()),
    knowledgeGaps: z.array(z.string()),
    idealAnswer: z.string(),
    nextQuestion: z.string(),
    nextCategory: categoryEnum,
    nextQuestionType: z.enum(["follow_up", "new_topic"]),
    nextDifficulty: z.enum(["easy", "medium", "hard"]),
})

const deepDiveReportSchema = z.object({
    summary: z.string().min(1),
    strengths: z.array(z.string()),
    weakAreas: z.array(z.object({
        area: z.string().min(1),
        reason: z.string(),
        severity: z.enum(["low", "medium", "high"]),
    })),
    importantQuestions: z.array(z.object({
        question: z.string().min(1),
        category: categoryEnum,
        whyItMatters: z.string(),
        suggestedAnswer: z.string().min(1),
    })),
})

function slugify(value) {
    return String(value || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "project"
}

/** Normalise LLM project output: trim, dedupe by slug, and cap list sizes. */
function normalizeProjects(projects = []) {
    const seen = new Set()
    const normalized = []
    for (const project of projects) {
        const name = String(project.name || "").trim().slice(0, 120)
        if (!name) continue
        let projectId = slugify(name)
        while (seen.has(projectId)) projectId = `${projectId}-${seen.size}`
        seen.add(projectId)
        normalized.push({
            projectId,
            name,
            summary: String(project.summary || "").trim().slice(0, 600),
            technologies: uniqueStrings(project.technologies || [], 12),
            highlights: uniqueStrings(project.highlights || [], 6).map((item) => item.slice(0, 300)),
        })
    }
    return normalized.slice(0, 8)
}

/**
 * @description Extract the candidate's projects from their resume and self-description.
 * Throws an LlmError on provider failure; callers decide how to surface it.
 */
async function extractProjects({ resume, selfDescription }) {
    const result = await generateStructured({
        operation: "project_extraction",
        timeoutMs: 25000,
        schema: projectExtractionSchema,
        prompt: `Extract the software projects the candidate describes in their resume and self-description.
Include personal, academic, open-source, hackathon, and work projects. A job or internship counts only if a specific product, system, or feature is described.
For each project return: name (short, as written by the candidate), summary (1-2 sentences on what it does and what was built, written without saying "the candidate"), technologies (languages, frameworks, databases, cloud services, APIs actually mentioned for it), and highlights (concrete claims such as features built, metrics, or responsibilities, copied closely from the text).
Do not invent projects, technologies, or metrics. Return an empty list if there are none.

Resume:
${String(resume || "").slice(0, 12000)}

Self-description:
${String(selfDescription || "").slice(0, 4000)}`,
    })
    return normalizeProjects(result.projects)
}

/** First focus area not yet asked about; once all are covered, the least-asked one. */
function pickNextCategory({ focusAreas, turns = [] }) {
    const areas = focusAreas?.length ? focusAreas : DEEP_DIVE_CATEGORIES
    const counts = new Map(areas.map((area) => [area, 0]))
    for (const turn of turns) if (counts.has(turn.category)) counts.set(turn.category, counts.get(turn.category) + 1)
    return [...counts.entries()].sort((left, right) => left[1] - right[1])[0][0]
}

/** Number of consecutive follow-ups at the end of the turn list. */
function trailingFollowUps(turns = []) {
    let count = 0
    for (let index = turns.length - 1; index >= 0 && turns[index].isFollowUp; index -= 1) count += 1
    return count
}

function fallbackQuestion({ project, category, previousQuestions = [] }) {
    const meta = CATEGORY_META[category] || CATEGORY_META.architecture
    const tech = project.technologies?.[0] || "your main framework"
    // function replacers so "$" in a project name is never treated as a replacement pattern
    const candidates = meta.templates.map((template) => template.replaceAll("{name}", () => project.name).replaceAll("{tech}", () => tech))
    return candidates.find((question) => isUsableQuestion({ question, previousQuestions })) || candidates[candidates.length - 1]
}

function projectBrief(project) {
    return `Project: ${project.name}
Summary: ${project.summary || "Not provided"}
Technologies: ${(project.technologies || []).join(", ") || "Not specified"}
Candidate claims: ${(project.highlights || []).join(" | ") || "None listed"}`
}

const INTERVIEWER_STYLE = `You are a sharp senior engineer running a project deep-dive interview. Your goal is to find out whether the candidate truly built and understands this project or only knows it at a surface level. Ask specific, challenging questions about THIS project (name its technologies and claims), such as why a technology was chosen, what happens under 10,000 concurrent requests, how they would debug a production issue, what they would improve, and what trade-offs they considered. One question at a time, 1-3 sentences, under 60 words, ending with a question mark. Never answer your own question.`

async function generateOpeningQuestion({ project, difficulty, focusAreas }) {
    const category = pickNextCategory({ focusAreas, turns: [] })
    try {
        const result = await generateStructured({
            operation: "deep_dive_opening",
            schema: openingQuestionSchema,
            prompt: `${INTERVIEWER_STYLE}
${projectBrief(project)}
Difficulty: ${difficulty}
Ask the opening question in the "${category}" category (${CATEGORY_META[category].guidance}). Set category to "${category}".`,
        })
        if (isUsableQuestion({ question: result.question })) return { question: result.question, category }
    } catch (error) {
        console.error("[DEEP_DIVE] opening question failed; using template", { code: error.code || error.name })
    }
    return { question: fallbackQuestion({ project, category }), category }
}

/**
 * @description Evaluate an answer and produce the next question. Follow-ups are capped per
 * topic so the interview keeps covering the selected focus areas.
 */
async function evaluateDeepDiveAnswer({ session, turn, answer, needsNextQuestion = true }) {
    const previousQuestions = session.turns.map((item) => item.question)
    const suggestedCategory = pickNextCategory({ focusAreas: session.focusAreas, turns: session.turns })
    const followUps = trailingFollowUps(session.turns)
    const history = session.turns.slice(0, -1).slice(-6).map((item) => ({
        category: item.category,
        question: item.question,
        answer: String(item.answer || "").slice(0, 1200),
        gaps: item.evaluation?.knowledgeGaps || [],
    }))
    let result
    try {
        result = await generateStructured({
            operation: "deep_dive_evaluation",
            timeoutMs: 25000,
            schema: turnEvaluationSchema,
            prompt: `${INTERVIEWER_STYLE}
${projectBrief(session.project)}
Earlier conversation (context only; never repeat these questions): ${JSON.stringify(history)}
Current category: ${turn.category} (${CATEGORY_META[turn.category]?.guidance})
Current question: ${turn.question}
Candidate answer: ${answer}

1. Evaluate the answer from 0 to 10: understanding (do they understand how and why their own project works), technicalDepth (do they go beyond surface level: internals, trade-offs, alternatives), accuracy (are technical statements correct), communication (clear and structured), and overall. Be calibrated: vague, generic, or buzzword answers that could describe any project must not score above 4. List concrete strengths and knowledgeGaps (specific concepts they missed or got wrong). Write feedback (2-3 sentences, direct, addressed to the candidate as "you") and a concise idealAnswer (3-6 sentences) showing what a strong answer about this project would cover.
2. Choose the next question. Follow-ups asked in a row so far: ${followUps} (maximum ${MAX_FOLLOW_UPS_PER_TOPIC}). If the answer revealed a gap or an unverified claim and the maximum is not reached, ask a pointed follow-up in the same category ("${turn.category}") and set nextQuestionType to "follow_up". Otherwise move to the "${suggestedCategory}" category (${CATEGORY_META[suggestedCategory].guidance}) and set nextQuestionType to "new_topic". Set nextCategory accordingly. Raise nextDifficulty after strong answers and lower it after weak ones.`,
        })
    } catch (error) {
        console.error("[DEEP_DIVE] evaluation failed; storing degraded evaluation", { code: error.code || error.name })
        return {
            evaluation: {
                overall: 5, understanding: 5, technicalDepth: 5, accuracy: 5, communication: 5,
                feedback: "Your answer was saved, but automated feedback was unavailable for this question. It is excluded from your final score.",
                strengths: [], knowledgeGaps: [], idealAnswer: "", degraded: true,
            },
            next: needsNextQuestion
                ? { question: fallbackQuestion({ project: session.project, category: suggestedCategory, previousQuestions }), category: suggestedCategory, isFollowUp: false, difficulty: turn.difficulty }
                : null,
        }
    }
    const { nextQuestion, nextCategory, nextQuestionType, nextDifficulty, ...evaluation } = result
    if (!needsNextQuestion) return { evaluation, next: null }
    const followUpAllowed = nextQuestionType === "follow_up" && followUps < MAX_FOLLOW_UPS_PER_TOPIC
    const category = followUpAllowed ? turn.category : (nextQuestionType === "follow_up" ? suggestedCategory : nextCategory)
    const usable = isUsableQuestion({ question: nextQuestion, previousQuestions }) && (nextQuestionType !== "follow_up" || followUpAllowed)
    return {
        evaluation,
        next: {
            question: usable ? nextQuestion : fallbackQuestion({ project: session.project, category, previousQuestions }),
            category,
            isFollowUp: usable && followUpAllowed,
            difficulty: nextDifficulty,
        },
    }
}

/** Deterministic report used when the AI report cannot be generated; built only from stored evaluations. */
function fallbackDeepDiveReport(session, aggregate) {
    const evaluated = session.turns.filter((turn) => turn.answer && turn.evaluation && !turn.evaluation.degraded)
    const weakest = [...evaluated].sort((left, right) => left.evaluation.overall - right.evaluation.overall)
    const weakCategories = aggregate.categoryBreakdown.filter((item) => item.score < 70)
    return {
        source: "fallback",
        ...aggregate,
        summary: evaluated.length
            ? `You answered ${aggregate.answeredCount} question${aggregate.answeredCount === 1 ? "" : "s"} about ${session.project.name}. This summary was built from your per-answer feedback because the detailed AI review was unavailable. Regenerate the report for a full analysis.`
            : "None of your answers could be evaluated, so scores are not available yet. Regenerate the report once the AI service is reachable.",
        strengths: uniqueStrings(evaluated.flatMap((turn) => turn.evaluation.strengths || []), 6),
        weakAreas: weakCategories.map((item) => ({
            area: CATEGORY_META[item.category]?.label || item.category,
            reason: uniqueStrings(evaluated.filter((turn) => turn.category === item.category).flatMap((turn) => turn.evaluation.knowledgeGaps || []), 3).join("; ") || "Answers in this area scored below 70.",
            severity: item.score < 50 ? "high" : "medium",
        })),
        importantQuestions: weakest.slice(0, 5).filter((turn) => turn.evaluation.idealAnswer).map((turn) => ({
            question: turn.question,
            category: turn.category,
            whyItMatters: (turn.evaluation.knowledgeGaps || []).join("; ") || "This answer scored lowest in your session.",
            suggestedAnswer: turn.evaluation.idealAnswer,
        })),
    }
}

async function generateDeepDiveReport({ session }) {
    const aggregate = scoreDeepDive(session.turns)
    const transcript = session.turns.filter((turn) => turn.answer).map((turn) => ({
        category: turn.category,
        isFollowUp: turn.isFollowUp,
        question: turn.question,
        answer: String(turn.answer).slice(0, 2500),
        evaluation: turn.evaluation && !turn.evaluation.degraded
            ? { overall: turn.evaluation.overall, knowledgeGaps: turn.evaluation.knowledgeGaps }
            : "not evaluated",
    }))
    let generated
    try {
        generated = await generateStructured({
            operation: "deep_dive_report",
            timeoutMs: REPORT_TIMEOUT_MS,
            schema: deepDiveReportSchema,
            prompt: `You are a senior engineer writing a preparation report after a project deep-dive interview.
${projectBrief(session.project)}
Scores (0-100, computed from per-answer evaluations; do not contradict them): understanding ${aggregate.projectUnderstandingScore}, technical knowledge ${aggregate.technicalKnowledgeScore}, overall ${aggregate.overallScore}. Category breakdown: ${JSON.stringify(aggregate.categoryBreakdown)}.
Transcript: ${JSON.stringify(transcript)}

Write:
- summary: 2-4 sentences on how well the candidate can defend this project in a real interview.
- strengths: 2-5 specific things they explained well.
- weakAreas: 2-6 areas where they lack understanding, each with a reason tied to the transcript and a severity.
- importantQuestions: 6-8 questions an interviewer is likely to ask about THIS project, prioritising the weak areas and including important questions that were not asked. Each needs its category, whyItMatters (one sentence), and a suggestedAnswer (4-8 sentences, first person, specific to the project's technologies, explaining the reasoning and trade-offs).
Address the candidate directly as "you" throughout; never write "the candidate". Only use technologies and facts present in the project brief or the candidate's answers.`,
        })
    } catch (error) {
        console.error("[DEEP_DIVE] report generation failed; using fallback", { code: error.code || error.name })
        return fallbackDeepDiveReport(session, aggregate)
    }
    return {
        source: "ai",
        ...aggregate,
        summary: generated.summary,
        strengths: generated.strengths.slice(0, 6),
        weakAreas: generated.weakAreas.slice(0, 6),
        importantQuestions: generated.importantQuestions.slice(0, 8),
    }
}

module.exports = {
    CATEGORY_META,
    extractProjects,
    normalizeProjects,
    slugify,
    pickNextCategory,
    trailingFollowUps,
    fallbackQuestion,
    generateOpeningQuestion,
    evaluateDeepDiveAnswer,
    generateDeepDiveReport,
    fallbackDeepDiveReport,
}
