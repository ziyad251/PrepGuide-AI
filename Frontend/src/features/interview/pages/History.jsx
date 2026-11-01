import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router"
import { getAllInterviewReports } from "../services/interview.api"
import { getSimulatorHistory } from "../services/interview.api"
import { getDeepDiveHistory } from "../../deep-dive/services/deepDive.api"
import SessionRow from "../../practice/components/SessionRow"
import "../../practice/style/practice.scss"
import { ReportPreview } from "../components/ReportMarkdown"
import "../../../style/product.scss"
import "../style/intelligence.scss"

const History = () => {
    const navigate = useNavigate()
    const [reports, setReports] = useState([])
    const [sessions, setSessions] = useState([])
    const [deepDives, setDeepDives] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    useEffect(() => { (async () => { try { const [reportResponse, sessionResponse, deepDiveResponse] = await Promise.all([getAllInterviewReports(), getSimulatorHistory({ limit: 50 }), getDeepDiveHistory({ limit: 50 })]); setReports(reportResponse.interviewReports || []); setSessions(sessionResponse.sessions || []); setDeepDives(deepDiveResponse.sessions || []) } catch (requestError) { setError(requestError.response?.data?.message || "We couldn't load your interview history.") } finally { setLoading(false) } })() }, [])
    if (loading) return <main className="product-page loading-state"><p className="eyebrow">Practice archive</p><h1>Loading your interview history...</h1></main>
    return <main className="product-page"><header className="product-header"><div><p className="eyebrow">Practice archive</p><h1>Interview history</h1><p>Review the plans you created and the adaptive sessions that produced your evidence.</p></div><Link to="/mock-interview" className="button primary-button">Start an interview</Link></header>{error && <div className="empty-state"><h2>We couldn't load your history</h2><p>{error}</p></div>} {!error && <><section className="intelligence-section"><div className="intelligence-section__heading"><div><p className="eyebrow">Preparation context</p><h2>Interview plans</h2></div><span className="intelligence-section__count">{reports.length}</span></div>{reports.length ? <div className="history-list">{reports.map((report) => <article className="surface history-row" key={report._id}><div className="history-row__summary"><h3>{report.title || "Untitled position"}</h3><p>{new Date(report.createdAt).toLocaleDateString()} · Roadmap available in report</p><ReportPreview report={report} /></div><strong>{report.matchScore != null ? `${report.matchScore}%` : "—"}</strong><div className="history-row__actions"><button className="button secondary-button" onClick={() => navigate(`/interview/${report._id}`)}>View report</button><button className="button primary-button" onClick={() => navigate(`/interview/${report._id}/simulator`)}>Practice</button></div></article>)}</div> : <div className="empty-state"><h2>No interview plans yet</h2><p>Start with a target role and job description to create your first preparation context.</p><Link to="/generate" className="button primary-button">Create a plan</Link></div>}</section><section className="intelligence-section"><div className="intelligence-section__heading"><div><p className="eyebrow">Adaptive practice</p><h2>Mock interviews</h2></div><span className="intelligence-section__count">{sessions.length}</span></div>{sessions.length ? <div className="session-list">{sessions.map((session) => <SessionRow key={session._id} kind="interview" session={session} />)}</div> : <div className="empty-state"><h2>No mock interviews yet</h2><p>Complete a session to build a persistent skill profile and get a scored report.</p><Link to="/mock-interview" className="button primary-button">Start a mock interview</Link></div>}</section><section className="intelligence-section"><div className="intelligence-section__heading"><div><p className="eyebrow">Resume projects</p><h2>Project deep-dives</h2></div><span className="intelligence-section__count">{deepDives.length}</span></div>{deepDives.length ? <div className="session-list">{deepDives.map((session) => <SessionRow key={session._id} kind="deep-dive" session={session} />)}</div> : <div className="empty-state"><h2>No deep-dives yet</h2><p>Practise defending a project from your resume against a senior engineer's questions.</p><Link to="/deep-dive" className="button primary-button">Start a deep-dive</Link></div>}</section></>}</main>
}
export default History
