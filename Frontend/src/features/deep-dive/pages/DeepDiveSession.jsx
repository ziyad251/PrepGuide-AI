import { useCallback, useEffect, useState } from "react"
import { Link, Navigate, useNavigate, useParams } from "react-router"
import { answerDeepDive, finishDeepDive, getDeepDive } from "../services/deepDive.api"
import { categoryLabel } from "../categories"
import PracticeSession from "../../practice/components/PracticeSession"
import { errorMessage, scoreTone } from "../../practice/utils/format"
import "../../../style/product.scss"

const EVALUATING_MESSAGES = ["Reading your answer...", "Checking your technical depth...", "Deciding where to probe next..."]

const getFeedback = (turn) => {
    const evaluation = turn.evaluation
    if (!evaluation) return null
    if (evaluation.degraded) return { degraded: true, text: evaluation.feedback }
    return {
        score: evaluation.overall,
        text: evaluation.feedback,
        scores: [["Understanding", evaluation.understanding], ["Depth", evaluation.technicalDepth], ["Accuracy", evaluation.accuracy], ["Clarity", evaluation.communication]],
        strengths: evaluation.strengths,
        gaps: evaluation.knowledgeGaps,
    }
}

const getTurnTags = (turn) => [categoryLabel(turn.category), turn.difficulty, turn.isFollowUp ? "Follow-up" : null].filter(Boolean)

/** Per-category coverage: which focus areas were asked, and the average score so far. */
const CoverageList = ({ session, currentCategory }) => {
    const stats = new Map()
    for (const turn of session.turns) {
        if (!turn.answer) continue
        const entry = stats.get(turn.category) || { count: 0, scores: [] }
        entry.count += 1
        if (turn.evaluation && !turn.evaluation.degraded) entry.scores.push(turn.evaluation.overall)
        stats.set(turn.category, entry)
    }
    return (
        <ul className="coverage-list">
            {session.focusAreas.map((category) => {
                const entry = stats.get(category)
                const average = entry?.scores.length ? Math.round(entry.scores.reduce((sum, value) => sum + value, 0) / entry.scores.length * 10) : null
                const state = category === currentCategory ? "is-current" : entry ? "is-covered" : ""
                return (
                    <li key={category} className={state}>
                        <i aria-hidden="true" />
                        <span>{categoryLabel(category)}</span>
                        {average !== null && <b className={`tone-text-${scoreTone(average)}`}>{average}</b>}
                    </li>
                )
            })}
        </ul>
    )
}

/**
 * @description Live project deep-dive (/deep-dive/:sessionId).
 */
const DeepDiveSession = () => {
    const { sessionId } = useParams()
    const navigate = useNavigate()
    const [session, setSession] = useState(null)
    const [loadError, setLoadError] = useState("")

    const load = useCallback(() => getDeepDive(sessionId)
        .then((response) => setSession(response.session))
        .catch((requestError) => setLoadError(errorMessage(requestError, "We couldn't load this deep-dive."))), [sessionId])

    useEffect(() => { load() }, [load])

    if (loadError) return <main className="product-page"><div className="empty-state"><h2>Deep-dive unavailable</h2><p>{loadError}</p><Link to="/deep-dive" className="button primary-button">Back to deep-dives</Link></div></main>
    if (!session) return <main className="product-page loading-state"><p className="eyebrow">Project deep-dive</p><h1>Loading your session...</h1></main>
    if (session.status === "completed") return <Navigate to={`/deep-dive/${sessionId}/report`} replace />

    const submitAnswer = async (answer) => {
        try {
            const response = await answerDeepDive(sessionId, answer)
            setSession(response.session)
        } catch (requestError) {
            if (requestError.response?.status === 409) { await load(); return }
            throw new Error(errorMessage(requestError, "We couldn't evaluate your answer. Please submit it again."))
        }
    }

    const finish = async () => {
        try {
            await finishDeepDive(sessionId)
            navigate(`/deep-dive/${sessionId}/report`)
        } catch (requestError) {
            throw new Error(errorMessage(requestError, "We couldn't generate your report. Please try again."))
        }
    }

    const currentTurn = session.turns[session.turns.length - 1]
    const currentCategory = currentTurn.answer ? null : currentTurn.category

    const sidebar = (
        <>
            <section className="surface side-card">
                <p className="eyebrow">{session.project.custom ? "Your project" : "From your resume"}</p>
                <h2>{session.project.name}</h2>
                {session.project.summary && <p className="muted">{session.project.summary}</p>}
                {session.project.technologies?.length > 0 && <div className="chip-row">{session.project.technologies.map((tech) => <span className="chip" key={tech}>{tech}</span>)}</div>}
            </section>
            <section className="surface side-card">
                <p className="eyebrow">Coverage</p>
                <h2>Focus areas</h2>
                <CoverageList session={session} currentCategory={currentCategory} />
            </section>
        </>
    )

    return (
        <PracticeSession
            session={session}
            eyebrow="Project deep-dive"
            title={session.project.name}
            subtitle="Explain it like you built it: the why, the trade-offs, and what breaks."
            exitTo="/deep-dive"
            sidebar={sidebar}
            questionTags={[categoryLabel(currentTurn.category), currentTurn.difficulty]}
            getTurnTags={getTurnTags}
            getFeedback={getFeedback}
            onSubmitAnswer={submitAnswer}
            onFinish={finish}
            evaluatingMessages={EVALUATING_MESSAGES}
            placeholder="Be specific to this project: name the components, the data flow, why you chose each tool, and what you would change."
        />
    )
}

export default DeepDiveSession
