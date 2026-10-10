import { useEffect, useState } from "react"
import { Link } from "react-router"
import { getAllInterviewReports, getInterviewReportById, getSimulatorHistory, recalculateRoadmap } from "../services/interview.api"
import "../../../style/product.scss"
import "../style/intelligence.scss"

const Roadmap = () => {
    const [report, setReport] = useState(null)
    const [sessionId, setSessionId] = useState(null)
    const [loading, setLoading] = useState(true)
    const [updating, setUpdating] = useState(false)
    const [message, setMessage] = useState("")
    useEffect(() => { (async () => { try { const reports = await getAllInterviewReports(); const latest = reports.interviewReports?.[0]; if (latest) { const full = await getInterviewReportById(latest._id); setReport(full.interviewReport) } const sessions = await getSimulatorHistory({ limit: 1 }); setSessionId(sessions.sessions?.[0]?._id || null) } finally { setLoading(false) } })() }, [])
    const update = async () => { if (!sessionId) return; setUpdating(true); setMessage(""); try { const response = await recalculateRoadmap(sessionId); setReport((current) => ({ ...current, preparationPlan: response.preparationPlan })); setMessage(response.message || "Roadmap updated from interview evidence.") } catch { setMessage("We couldn't update the roadmap right now.") } finally { setUpdating(false) } }
    if (loading) return <main className="product-page loading-state"><p className="eyebrow">Preparation system</p><h1>Preparing your roadmap...</h1></main>
    const plan = report?.preparationPlan || []
    return <main className="product-page"><header className="product-header"><div><p className="eyebrow">Preparation system</p><h1>Your preparation roadmap</h1><p>Built from your target role and the interview evidence available so far.</p></div>{sessionId && <button className="button primary-button" onClick={update} disabled={updating}>{updating ? "Updating..." : "Recalculate roadmap"}</button>}</header>{message && <p className="roadmap-message">{message}</p>}{!report || !plan.length ? <div className="empty-state"><h2>Your roadmap will appear after your first plan</h2><p>Generate a target-role plan to create the first preparation sequence.</p><Link to="/generate" className="button primary-button">Create a plan</Link></div> : <div className="roadmap-list-new">{plan.map((day) => <article className="surface roadmap-card" key={day.day}><div className="roadmap-card__number">{String(day.day).padStart(2, "0")}</div><div className="roadmap-card__body"><div className="roadmap-card__heading"><div><p className="eyebrow">{day.priority || "medium"} priority</p><h2>{day.focus}</h2></div><span className="status-badge status-badge--quiet">{day.status || "Not Started"}</span></div><ul>{day.tasks.map((task) => <li key={task}>{task}</li>)}</ul></div></article>)}</div>}</main>
}
export default Roadmap
