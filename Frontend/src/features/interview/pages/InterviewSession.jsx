import { useCallback, useEffect, useState } from "react"
import { Link, Navigate, useNavigate, useParams } from "react-router"
import { answerSimulator, finishSimulator, getSimulator, recalculateRoadmap } from "../services/interview.api"
import PracticeSession from "../../practice/components/PracticeSession"
import { INTERVIEW_TYPES, errorMessage } from "../../practice/utils/format"
import "../../../style/product.scss"
import "../style/active-interview.scss"

const EVALUATING_MESSAGES = ["Reading your answer...", "Checking accuracy and depth...", "Choosing a follow-up..."]

const SkillSignal = ({ skill }) => <div className="signal-skill"><div><span>{skill.skill}</span><strong>{skill.status === "unassessed" ? "Not assessed" : `${skill.currentScore}%`}</strong></div>{skill.status !== "unassessed" && <span className="signal-skill__track"><i style={{ width: `${skill.currentScore}%` }} /></span>}</div>

const evidenceLabel = (source) => ["PROJECT", "RESUME", "SKILL"].includes(source) ? "Candidate evidence" : source === "JOB_DESCRIPTION" ? "Job requirement" : ["INTERVIEW_ANSWER", "ASSESSMENT"].includes(source) ? "Previous-answer evidence" : source
const RagEvidence = ({ context = [] }) => <details className="rag-evidence"><summary>Why was this question generated?</summary><p className="rag-evidence__intro">The interviewer connected the strongest candidate evidence to a role requirement. This is source context, not hidden reasoning.</p>{context.length ? <div className="rag-evidence__list">{context.map((item, index) => <article key={`${item.source}-${item.title}-${index}`}><div><strong>{evidenceLabel(item.source)}: {item.title || item.source}</strong><span>{Number(item.relevanceScore || 0).toFixed(2)} relevance</span></div><p>{item.content}</p></article>)}</div> : <p className="muted">No matching evidence was found, so this is a general role question.</p>}</details>

const getFeedback = (turn) => {
    const evaluation = turn.evaluation
    if (!evaluation) return null
    if (evaluation.degraded) return { degraded: true, text: evaluation.feedback }
    return {
        score: evaluation.overall,
        text: evaluation.feedback,
        scores: [["Accuracy", evaluation.technicalAccuracy], ["Depth", evaluation.depth], ["Clarity", evaluation.clarity], ["Relevance", evaluation.relevance]],
        strengths: evaluation.strengths,
        gaps: evaluation.missingConcepts,
    }
}

const getTurnTags = (turn) => [turn.focus, turn.difficulty, turn.isFollowUp ? "Follow-up" : null].filter(Boolean)

/**
 * @description Live mock interview for one session (/sessions/:sessionId).
 */
const InterviewSession = () => {
    const { sessionId } = useParams()
    const navigate = useNavigate()
    const [session, setSession] = useState(null)
    const [loadError, setLoadError] = useState("")
    const [roadmapMessage, setRoadmapMessage] = useState("")

    const load = useCallback(() => getSimulator(sessionId)
        .then((response) => setSession(response.session))
        .catch((requestError) => setLoadError(errorMessage(requestError, "We couldn't load this interview."))), [sessionId])

    useEffect(() => { load() }, [load])

    if (loadError) return <main className="product-page"><div className="empty-state"><h2>Interview unavailable</h2><p>{loadError}</p><Link to="/mock-interview" className="button primary-button">Start a new interview</Link></div></main>
    if (!session) return <main className="product-page loading-state"><p className="eyebrow">Mock interview</p><h1>Loading your interview...</h1></main>
    if (session.status === "completed") return <Navigate to={`/sessions/${sessionId}/report`} replace />

    const submitAnswer = async (answer) => {
        try {
            const response = await answerSimulator(sessionId, answer)
            setSession(response.session)
        } catch (requestError) {
            // 409: already answered elsewhere (another tab); resync instead of showing a dead end
            if (requestError.response?.status === 409) { await load(); return }
            throw new Error(errorMessage(requestError, "We couldn't evaluate your answer. Please submit it again."))
        }
    }

    const finish = async () => {
        try {
            await finishSimulator(sessionId)
            navigate(`/sessions/${sessionId}/report`)
        } catch (requestError) {
            throw new Error(errorMessage(requestError, "We couldn't generate your report. Please try again."))
        }
    }

    const updateRoadmap = async () => {
        setRoadmapMessage("Updating roadmap...")
        try { const response = await recalculateRoadmap(sessionId); setRoadmapMessage(response.message || "Roadmap updated from interview evidence.") }
        catch { setRoadmapMessage("We couldn't update the roadmap right now.") }
    }

    const currentTurn = session.turns[session.turns.length - 1]
    const currentFocus = currentTurn.focus || "Current role focus"
    const focusSkill = session.skillProfile.find((skill) => skill.skill.toLowerCase() === currentFocus.toLowerCase())
    const priority = session.topSkillGaps.includes(currentFocus) ? "High" : focusSkill?.importance || "Medium"
    const typeLabel = INTERVIEW_TYPES[session.interviewType]?.label || session.interviewType

    const sidebar = (
        <div className="signal-panel surface">
            <div><p className="eyebrow">Interview signal</p><h2>Why this question?</h2></div>
            <dl className="signal-facts">
                <div><dt>Current focus</dt><dd>{currentFocus}</dd></div>
                <div><dt>Priority</dt><dd>{priority}</dd></div>
                <div><dt>Difficulty</dt><dd>{currentTurn.difficulty}</dd></div>
                <div><dt>Confidence</dt><dd>{focusSkill ? `${Math.round((focusSkill.confidence || 0) * 100)}%` : "Not assessed"}</dd></div>
            </dl>
            <div className="signal-divider" />
            <p className="eyebrow">Current skills</p>
            {session.skillProfile.length ? session.skillProfile.slice(0, 7).map((skill) => <SkillSignal key={skill.skill} skill={skill} />) : <p className="muted">Skills appear as your answers are assessed.</p>}
            <button type="button" className="button secondary-button signal-roadmap" onClick={updateRoadmap}>Update roadmap</button>
            {roadmapMessage && <p className="muted">{roadmapMessage}</p>}
        </div>
    )

    return (
        <PracticeSession
            session={session}
            eyebrow={`${typeLabel} interview`}
            title={session.targetRole}
            subtitle={`Adaptive ${typeLabel.toLowerCase()} round · started at ${session.difficulty} difficulty`}
            exitTo="/mock-interview"
            sidebar={sidebar}
            questionTags={[currentFocus, currentTurn.difficulty]}
            questionAside={session.interviewType !== "hr" && <RagEvidence context={currentTurn.ragContext} />}
            getTurnTags={getTurnTags}
            getFeedback={getFeedback}
            onSubmitAnswer={submitAnswer}
            onFinish={finish}
            evaluatingMessages={EVALUATING_MESSAGES}
        />
    )
}

export default InterviewSession
