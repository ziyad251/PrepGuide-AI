import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router"
import { useAuth } from "../../auth/hooks/useAuth"
import { useInterview } from "../hooks/useInterview"
import DeleteConfirmModal from "../../../components/DeleteConfirmModal"
import { getInterviewReportById, getSimulator, getSimulatorHistory } from "../services/interview.api"
import "../../../style/product.scss"

const getReportDisplayTitle = (report) => {
    const candidates = [report?.title, report?.targetRole, report?.jobTitle, report?.roleTitle, report?.role]
    const reportBodyPattern = /(?:^|\n)\s{0,3}#{1,6}\s|executive summary|key strengths|areas for development|final assessment|next steps|recommendation/i
    return candidates.find((value) =>
        typeof value === "string"
        && value.trim()
        && value.length <= 160
        && !reportBodyPattern.test(value)
    )?.trim() || "Interview Report"
}

const Dashboard = () => {
    const { user } = useAuth()
    const { loading, reports, getReports, deleteReport } = useInterview()
    const navigate = useNavigate()
    const [deleteId, setDeleteId] = useState(null)
    const [deleting, setDeleting] = useState(false)
    const [sessions, setSessions] = useState([])
    const [latestSession, setLatestSession] = useState(null)
    const [latestReportDetail, setLatestReportDetail] = useState(null)
    const [error, setError] = useState("")

    useEffect(() => {
        const load = async () => {
            try {
                const history = await getSimulatorHistory({ limit: 20 })
                setSessions(history.sessions || [])
                if (history.sessions?.[0]?._id) {
                    const response = await getSimulator(history.sessions[0]._id)
                    setLatestSession(response.session)
                }
                const loadedReports = await getReports()
                if (loadedReports?.[0]?._id) {
                    const reportResponse = await getInterviewReportById(loadedReports[0]._id)
                    setLatestReportDetail(reportResponse.interviewReport)
                }
            } catch (requestError) {
                setError(requestError.response?.data?.message || "We couldn't load your preparation profile.")
            }
        }
        load()
    }, [])

    const handleDelete = async () => {
        if (!deleteId) return
        setDeleting(true)
        try {
            await deleteReport(deleteId)
            setDeleteId(null)
        } finally {
            setDeleting(false)
        }
    }

    if (loading && reports.length === 0) {
        return (
            <div className="dashboard-page">
                <p className="dashboard-page__loading">Loading dashboard...</p>
            </div>
        )
    }

    const latestReport = latestReportDetail || reports[0]
    const assessedSkills = latestSession?.skillProfile?.filter((skill) => skill.status !== "unassessed") || []

    return (
        <div className="product-page">
            <header className="product-header"><div><p className="eyebrow">Preparation workspace</p><h1>Good morning, {user?.username || "candidate"}</h1><p>Your preparation profile, interview evidence, and next steps in one place.</p></div><Link to="/generate" className="button primary-button">Start an interview</Link></header>
            {error && <div className="surface empty-state"><h2>We couldn't load your preparation profile.</h2><p>{error}</p><button className="button primary-button" onClick={() => window.location.reload()}>Try again</button></div>}
            {!error && <>
                <section className="metric-grid"><div className="surface metric-card"><span className="metric-card__label">Interview reports</span><strong>{reports.length || "—"}</strong><small>{reports.length ? "Saved preparation plans" : "No reports yet"}</small></div><div className="surface metric-card"><span className="metric-card__label">Sessions started</span><strong>{sessions.length || "—"}</strong><small>{sessions.length ? "Adaptive practice sessions" : "Start to create evidence"}</small></div><div className="surface metric-card"><span className="metric-card__label">Skills assessed</span><strong>{assessedSkills.length || "—"}</strong><small>{assessedSkills.length ? "From your latest session" : "Complete an answer first"}</small></div><div className="surface metric-card"><span className="metric-card__label">Roadmap</span><strong>{latestReport?.preparationPlan?.length ? `${latestReport.preparationPlan.length}d` : "—"}</strong><small>{latestReport?.preparationPlan?.length ? "Current preparation plan" : "No roadmap yet"}</small></div></section>
                <section className="dashboard-section"><div className="dashboard-section__heading"><h2>Latest skill signal</h2><Link to="/skills">View skill intelligence</Link></div>{assessedSkills.length ? <div className="skill-overview">{assessedSkills.slice(0, 6).map((skill) => <div className="skill-tile" key={skill.skill}><div className="skill-tile__top"><span>{skill.skill}</span><span className="skill-tile__score">{skill.currentScore}%</span></div><span className="skill-tile__track"><i style={{ width: `${skill.currentScore}%` }} /></span></div>)}</div> : <div className="empty-state"><h2>No skills assessed yet</h2><p>Complete your first adaptive interview to build evidence about your skills.</p><Link to={latestReport ? `/interview/${latestReport._id}/simulator` : "/generate"} className="button primary-button">{latestReport ? "Practice an interview" : "Create a plan"}</Link></div>}</section>
                <section className="dashboard-section"><div className="dashboard-section__heading"><h2>Recent interview plans</h2><Link to="/history">View history</Link></div>{reports.length ? reports.slice(0, 4).map((report) => <article className="surface plan-row" key={report._id}><div><p className="plan-row__title">{getReportDisplayTitle(report)}</p><p className="plan-row__date">{new Date(report.createdAt).toLocaleDateString()}</p></div><span className="plan-row__score">{report.matchScore != null ? `${report.matchScore}% match` : "Match pending"}</span><div className="plan-row__actions"><button className="button secondary-button" onClick={() => navigate(`/interview/${report._id}`)}>View report</button><button className="button primary-button" onClick={() => navigate(`/interview/${report._id}/simulator`)}>Practice</button><button className="button secondary-button" onClick={() => setDeleteId(report._id)}>Delete</button></div></article>) : <div className="empty-state"><h2>Your history is empty</h2><p>Generate a target-role plan to start preparing.</p><Link to="/generate" className="button primary-button">Generate plan</Link></div>}</section>
            </>}

            <DeleteConfirmModal
                open={Boolean(deleteId)}
                title="Delete interview plan?"
                message="Delete this interview plan? This action cannot be undone."
                onConfirm={handleDelete}
                onCancel={() => setDeleteId(null)}
                busy={deleting}
            />
        </div>
    )
}

export default Dashboard
