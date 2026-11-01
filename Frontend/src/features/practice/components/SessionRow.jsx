import { Link } from "react-router"
import { INTERVIEW_TYPES, capitalize, formatDate, scoreTone } from "../utils/format"

/** One row in a session history list, for mock interviews (kind="interview") or deep-dives. */
const SessionRow = ({ session, kind, onDelete }) => {
    const completed = session.status === "completed"
    const base = kind === "interview" ? `/sessions/${session._id}` : `/deep-dive/${session._id}`
    const title = kind === "interview" ? session.targetRole : session.project?.name
    const detail = kind === "interview"
        ? `${INTERVIEW_TYPES[session.interviewType]?.label || session.interviewType} interview · ${capitalize(session.difficulty)}`
        : `Project deep-dive · ${capitalize(session.difficulty)}`
    return (
        <article className="surface session-row">
            <div>
                <h3>{title || "Untitled"}</h3>
                <p>{detail} · {formatDate(session.createdAt)}</p>
            </div>
            {completed
                ? <span className={`session-row__score tone-${scoreTone(session.overallScore)}`}>{typeof session.overallScore === "number" ? session.overallScore : "—"}</span>
                : <span className="status-badge status-badge--warning">In progress</span>}
            <div className="session-row__actions">
                <Link className={`button ${completed ? "secondary-button" : "primary-button"}`} to={completed ? `${base}/report` : base}>{completed ? "View report" : "Resume"}</Link>
                {onDelete && <button type="button" className="button secondary-button" onClick={() => onDelete(session)}>Delete</button>}
            </div>
        </article>
    )
}

export default SessionRow
