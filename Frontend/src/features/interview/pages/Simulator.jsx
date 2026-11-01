import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { getAllInterviewReports, getSimulatorHistory, startSimulator } from "../services/interview.api"
import ThinkingIndicator from "../../practice/components/ThinkingIndicator"
import { DIFFICULTIES, INTERVIEW_TYPES, SESSION_LENGTHS, errorMessage, formatDate } from "../../practice/utils/format"
import SessionRow from "../../practice/components/SessionRow"
import "../../../style/product.scss"
import "../../practice/style/practice.scss"

const START_MESSAGES = ["Reading your resume and the job description...", "Retrieving your strongest evidence...", "Writing your first question..."]

/**
 * @description Mock interview setup. Reachable from /mock-interview (pick a plan) or
 * /interview/:reportId/simulator (plan preselected).
 */
const Simulator = () => {
    const { reportId: routeReportId } = useParams()
    const navigate = useNavigate()
    const [reports, setReports] = useState([])
    const [reportId, setReportId] = useState(routeReportId || "")
    const [roleOverride, setRoleOverride] = useState(null)
    const [interviewType, setInterviewType] = useState("technical")
    const [difficulty, setDifficulty] = useState("medium")
    const [questionLimit, setQuestionLimit] = useState(8)
    const [activeSession, setActiveSession] = useState(null)
    const [recentSessions, setRecentSessions] = useState([])
    const [loading, setLoading] = useState(true)
    const [starting, setStarting] = useState(false)
    const [error, setError] = useState("")

    useEffect(() => {
        Promise.all([getAllInterviewReports(), getSimulatorHistory({ limit: 5 })])
            .then(([reportResponse, historyResponse]) => {
                const loaded = reportResponse.interviewReports || []
                setReports(loaded)
                setRecentSessions(historyResponse.sessions || [])
                setReportId((current) => current || loaded[0]?._id || "")
            })
            .catch((requestError) => setError(errorMessage(requestError, "We couldn't load your interview plans.")))
            .finally(() => setLoading(false))
    }, [])

    useEffect(() => {
        if (!reportId) return
        let cancelled = false
        getSimulatorHistory({ status: "active", reportId, limit: 1 })
            .then((response) => { if (!cancelled) setActiveSession(response.sessions?.[0] || null) })
            .catch(() => { if (!cancelled) setActiveSession(null) })
        return () => { cancelled = true }
    }, [reportId])

    const selectedReport = reports.find((report) => report._id === reportId)
    const targetRole = roleOverride ?? selectedReport?.title ?? ""

    const begin = async (event) => {
        event.preventDefault()
        if (starting || !reportId) return
        setStarting(true)
        setError("")
        try {
            const response = await startSimulator({ reportId, targetRole: targetRole.trim() || undefined, interviewType, difficulty, questionLimit })
            navigate(`/sessions/${response.session._id}`)
        } catch (requestError) {
            setError(errorMessage(requestError, "Could not start the interview. Please try again."))
            setStarting(false)
        }
    }

    if (loading) return <main className="product-page loading-state"><p className="eyebrow">Mock interview</p><h1>Loading your interview plans...</h1></main>

    if (!reports.length) {
        return (
            <main className="product-page practice-setup">
                <header className="product-header"><div><p className="eyebrow">Mock interview</p><h1>Practice a realistic interview</h1></div></header>
                {error ? <p className="practice-banner practice-banner--error" role="alert">{error}</p> : (
                    <div className="empty-state">
                        <h2>Create an interview plan first</h2>
                        <p>Upload your resume and the job description so the interviewer can tailor every question to you.</p>
                        <Link to="/generate" className="button primary-button">Create a plan</Link>
                    </div>
                )}
            </main>
        )
    }

    return (
        <main className="product-page practice-setup">
            <Link to={routeReportId ? `/interview/${routeReportId}` : "/dashboard"} className="quiet-link">← Back</Link>
            <header className="product-header">
                <div>
                    <p className="eyebrow">Mock interview</p>
                    <h1>Configure your interview</h1>
                    <p>Questions come from your resume and the job description, and follow up on what you actually say.</p>
                </div>
            </header>

            {activeSession && (
                <div className="resume-banner">
                    <div>
                        <strong>You have an unfinished {INTERVIEW_TYPES[activeSession.interviewType]?.label.toLowerCase()} interview</strong>
                        <span>Started {formatDate(activeSession.createdAt)} · {activeSession.difficulty}</span>
                    </div>
                    <Link to={`/sessions/${activeSession._id}`} className="button primary-button">Resume interview</Link>
                </div>
            )}

            <form className="surface setup-card" onSubmit={begin}>
                <div className="setup-row">
                    <label className="setup-field">
                        <span>Interview plan</span>
                        <select value={reportId} onChange={(event) => { setReportId(event.target.value); setRoleOverride(null) }} disabled={starting}>
                            {reports.map((report) => <option key={report._id} value={report._id}>{report.title || "Untitled plan"} · {formatDate(report.createdAt)}</option>)}
                        </select>
                        <small>Uses this plan's resume and job description.</small>
                    </label>
                    <label className="setup-field">
                        <span>Target role</span>
                        <input value={targetRole} onChange={(event) => setRoleOverride(event.target.value)} maxLength={120} placeholder="e.g. Backend Developer" disabled={starting} />
                        <small>Defaults to the role from your plan.</small>
                    </label>
                </div>

                <fieldset className="setup-field">
                    <legend>Interview type</legend>
                    <div className="option-grid">
                        {Object.entries(INTERVIEW_TYPES).map(([value, type]) => (
                            <label key={value} className={`option-card ${interviewType === value ? "is-selected" : ""}`}>
                                <input type="radio" name="interviewType" value={value} checked={interviewType === value} onChange={() => setInterviewType(value)} disabled={starting} />
                                <strong>{type.label}</strong>
                                <span>{type.description}</span>
                            </label>
                        ))}
                    </div>
                </fieldset>

                <div className="setup-row">
                    <div className="setup-field">
                        <span id="difficulty-label">Starting difficulty</span>
                        <div className="segmented" role="radiogroup" aria-labelledby="difficulty-label">
                            {DIFFICULTIES.map((value) => <button type="button" role="radio" aria-checked={difficulty === value} key={value} className={difficulty === value ? "is-selected" : ""} onClick={() => setDifficulty(value)} disabled={starting}>{value}</button>)}
                        </div>
                        <small>Adapts up or down based on your answers.</small>
                    </div>
                    <div className="setup-field">
                        <span id="length-label">Length</span>
                        <div className="segmented" role="radiogroup" aria-labelledby="length-label">
                            {SESSION_LENGTHS.map((option) => <button type="button" role="radio" aria-checked={questionLimit === option.value} key={option.value} className={questionLimit === option.value ? "is-selected" : ""} onClick={() => setQuestionLimit(option.value)} disabled={starting}>{option.label}</button>)}
                        </div>
                        <small>{SESSION_LENGTHS.find((option) => option.value === questionLimit)?.hint}. You can finish early.</small>
                    </div>
                </div>

                {error && <p className="inline-error" role="alert">{error}</p>}
                <div className="setup-footer">
                    {starting ? <ThinkingIndicator messages={START_MESSAGES} /> : <p>You'll get feedback after each answer and a full report with ideal answers when you finish.</p>}
                    <button className="button primary-button" disabled={starting || !reportId}>{starting ? "Preparing..." : "Start interview"}</button>
                </div>
            </form>

            {recentSessions.length > 0 && (
                <section className="report-block">
                    <div className="report-block__heading"><div><p className="eyebrow">Recent</p><h2>Your mock interviews</h2></div><Link to="/history" className="quiet-link">View all</Link></div>
                    <div className="session-list">{recentSessions.map((session) => <SessionRow key={session._id} kind="interview" session={session} />)}</div>
                </section>
            )}
        </main>
    )
}

export default Simulator
