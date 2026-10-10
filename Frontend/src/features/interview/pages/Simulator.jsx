import { useEffect, useRef, useState } from "react"
import { Link, useParams } from "react-router"
import { answerSimulator, getSimulator, recalculateRoadmap, startSimulator } from "../services/interview.api"
import "../../../style/product.scss"
import "../style/active-interview.scss"

const SkillSignal = ({ skill }) => <div className="signal-skill"><div><span>{skill.skill}</span><strong>{skill.status === "unassessed" ? "Not assessed" : `${skill.currentScore}%`}</strong></div>{skill.status !== "unassessed" && <span className="signal-skill__track"><i style={{ width: `${skill.currentScore}%` }} /></span>}</div>

const Evaluation = ({ evaluation }) => <section className="evaluation-card"><div className="evaluation-card__heading"><div><p className="eyebrow">Answer evaluated</p><h2>Evidence from this response</h2></div><strong>{evaluation.overall}<small>/10</small></strong></div><p className="evaluation-card__feedback">{evaluation.feedback}</p><div className="evaluation-scores">{[["Accuracy", evaluation.technicalAccuracy], ["Depth", evaluation.depth], ["Clarity", evaluation.clarity], ["Relevance", evaluation.relevance]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}/10</strong></div>)}</div>{evaluation.skillsAssessed?.length > 0 && <div className="assessment-list"><h3>Skill assessment</h3>{evaluation.skillsAssessed.map((skill) => <article key={skill.skill}><div><strong>{skill.skill}</strong><span>{skill.score}/10 · {Math.round(skill.confidence * 100)}% confidence</span></div>{skill.evidence?.map((item) => <p key={item}><b>Evidence</b>{item}</p>)}{skill.gaps?.map((item) => <p className="assessment-list__gap" key={item}><b>Gap</b>{item}</p>)}</article>)}</div>}<div className="next-signal"><div><span>Next focus</span><strong>{evaluation.nextFocus}</strong></div><div><span>Difficulty</span><strong>{evaluation.nextDifficulty}</strong></div></div></section>

const evidenceLabel = (source) => ["PROJECT", "RESUME", "SKILL"].includes(source) ? "Candidate evidence" : source === "JOB_DESCRIPTION" ? "Job requirement" : ["INTERVIEW_ANSWER", "ASSESSMENT"].includes(source) ? "Previous-answer evidence" : source
const RagEvidence = ({ context = [] }) => <details className="rag-evidence"><summary>Why was this question generated?</summary><p className="rag-evidence__intro">The interviewer connected the strongest candidate evidence to a role requirement. This is source context, not hidden reasoning.</p>{context.length ? <div className="rag-evidence__list">{context.map((item, index) => <article key={`${item.source}-${item.title}-${index}`}><div><strong>{evidenceLabel(item.source)}: {item.title || item.source}</strong><span>{Number(item.relevanceScore || 0).toFixed(2)} relevance</span></div><p>{item.content}</p></article>)}</div> : <p className="muted">No matching evidence was found, so this is a general role question.</p>}</details>

const Simulator = () => {
    const { reportId } = useParams()
    const [setup, setSetup] = useState({ targetRole: "Backend Developer", interviewType: "technical", difficulty: "medium" })
    const [session, setSession] = useState(null)
    const [answer, setAnswer] = useState("")
    const [evaluation, setEvaluation] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [roadmapMessage, setRoadmapMessage] = useState("")
    const startInFlight = useRef(false)

    useEffect(() => {
        const savedSessionId = window.localStorage.getItem(`prepguide-session-${reportId}`)
        if (!savedSessionId) return
        setLoading(true)
        getSimulator(savedSessionId).then((response) => {
            setSession(response.session)
            setEvaluation([...response.session.turns].reverse().find((turn) => turn.evaluation)?.evaluation || null)
        }).catch(() => window.localStorage.removeItem(`prepguide-session-${reportId}`)).finally(() => setLoading(false))
    }, [reportId])

    const begin = async (event) => {
        event.preventDefault()
        if (startInFlight.current) return
        startInFlight.current = true
        const requestId = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        setLoading(true); setError("")
        try { console.log("[SIMULATOR] request sent", { reportId, requestId, setup }); const response = await startSimulator({ ...setup, reportId }); setSession(response.session); setEvaluation(null); window.localStorage.setItem(`prepguide-session-${reportId}`, response.session._id) }
        catch (requestError) { setError(requestError.response?.data?.detail || requestError.response?.data?.message || "Could not start the simulator.") }
        finally { startInFlight.current = false; setLoading(false) }
    }

    const submitAnswer = async (event) => {
        event.preventDefault()
        if (!answer.trim()) return
        setLoading(true); setError("")
        try { const response = await answerSimulator(session._id, answer); setSession(response.session); setEvaluation(response.evaluation); setAnswer("") }
        catch (requestError) { setError(requestError.response?.data?.detail || requestError.response?.data?.message || "Could not evaluate this answer.") }
        finally { setLoading(false) }
    }

    const updateRoadmap = async () => {
        setRoadmapMessage("Updating roadmap...")
        try { const response = await recalculateRoadmap(session._id); setRoadmapMessage(response.message || "Roadmap updated from interview evidence.") }
        catch { setRoadmapMessage("We couldn't update the roadmap right now.") }
    }

    if (!session) return <main className="product-page simulator-setup-page"><Link to={`/interview/${reportId}`} className="quiet-link">Back to report</Link><header className="product-header simulator-setup-header"><div><p className="eyebrow">Practice workspace</p><h1>Start an adaptive interview</h1><p>Every answer changes the next focus using your role context and demonstrated evidence.</p></div></header><form className="surface setup-form" onSubmit={begin}><label>Target role<input value={setup.targetRole} onChange={(event) => setSetup({ ...setup, targetRole: event.target.value })} /></label><fieldset><legend>Interview type</legend><label><input type="radio" name="type" value="technical" checked={setup.interviewType === "technical"} onChange={(event) => setSetup({ ...setup, interviewType: event.target.value })} /> Technical</label><label><input type="radio" name="type" value="behavioral" checked={setup.interviewType === "behavioral"} onChange={(event) => setSetup({ ...setup, interviewType: event.target.value })} /> Behavioral</label><label><input type="radio" name="type" value="mixed" checked={setup.interviewType === "mixed"} onChange={(event) => setSetup({ ...setup, interviewType: event.target.value })} /> Mixed</label></fieldset><label>Difficulty<select value={setup.difficulty} onChange={(event) => setSetup({ ...setup, difficulty: event.target.value })}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>{error && <p className="inline-error" role="alert">{error}</p>}<button className="button primary-button" disabled={loading}>{loading ? "Preparing your interview..." : "Start interview"}</button></form></main>

    const currentTurn = session.turns[session.turns.length - 1]
    const currentFocus = currentTurn.focus || "Current role focus"
    const focusSkill = session.skillProfile.find((skill) => skill.skill.toLowerCase() === currentFocus.toLowerCase())
    const priority = session.topSkillGaps.includes(currentFocus) ? "High" : focusSkill?.importance || "Medium"
    const answeredCount = session.turns.filter((turn) => turn.answer).length
    return <main className="product-page active-interview"><header className="active-interview__header"><div><p className="eyebrow">Live practice</p><h1>{session.targetRole}</h1><p>{session.interviewType} interview · question {answeredCount + 1}</p></div><Link to={`/interview/${reportId}`} className="quiet-link">Exit session</Link></header><div className="active-interview__grid"><aside className="signal-panel surface"><div><p className="eyebrow">Interview signal</p><h2>Why this question?</h2></div><dl className="signal-facts"><div><dt>Current focus</dt><dd>{currentFocus}</dd></div><div><dt>Priority</dt><dd>{priority}</dd></div><div><dt>Evidence</dt><dd>{focusSkill ? `${focusSkill.questionsAsked} assessment${focusSkill.questionsAsked === 1 ? "" : "s"}` : "Not assessed"}</dd></div><div><dt>Confidence</dt><dd>{focusSkill ? `${Math.round((focusSkill.confidence || 0) * 100)}%` : "Not assessed"}</dd></div></dl><div className="signal-divider" /><p className="eyebrow">Current skills</p>{session.skillProfile.slice(0, 7).map((skill) => <SkillSignal key={skill.skill} skill={skill} />)}<button className="button secondary-button signal-roadmap" onClick={updateRoadmap}>Update roadmap</button>{roadmapMessage && <p className="muted">{roadmapMessage}</p>}</aside><section className="question-column"><div className="question-meta"><span>{session.interviewType}</span><span>{currentTurn.difficulty}</span><span>{currentFocus}</span></div><article className="question-card"><p className="eyebrow">Question {answeredCount + 1}</p><h2>{currentTurn.question}</h2></article><RagEvidence context={currentTurn.ragContext} />{evaluation && <Evaluation evaluation={evaluation} />}<form className="answer-editor" onSubmit={submitAnswer}><label htmlFor="answer">Your answer</label><textarea id="answer" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Think aloud. Explain your reasoning, trade-offs, and evidence." rows="9" disabled={loading} /><div className="answer-editor__footer"><span>{answer.length ? `${answer.length} characters` : "Take your time"}</span><button className="button primary-button" disabled={loading || !answer.trim()}>{loading ? "Analyzing your answer..." : "Submit answer"}</button></div>{error && <p className="inline-error" role="alert">{error}</p>}</form></section></div></main>
}

export default Simulator
