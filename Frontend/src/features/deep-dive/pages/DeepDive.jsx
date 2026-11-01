import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate } from "react-router"
import { getAllInterviewReports } from "../../interview/services/interview.api"
import { deleteDeepDive, getDeepDiveHistory, getReportProjects, startDeepDive } from "../services/deepDive.api"
import { CATEGORIES } from "../categories"
import ThinkingIndicator from "../../practice/components/ThinkingIndicator"
import SessionRow from "../../practice/components/SessionRow"
import DeleteConfirmModal from "../../../components/DeleteConfirmModal"
import { DIFFICULTIES, SESSION_LENGTHS, errorMessage, formatDate } from "../../practice/utils/format"
import "../../../style/product.scss"
import "../../practice/style/practice.scss"

const START_MESSAGES = ["Studying your project...", "Planning the interview...", "Writing the first question..."]
const EMPTY_CUSTOM = { name: "", description: "", technologies: "" }

const ProjectCard = ({ project, selected, onSelect }) => (
    <button type="button" className={`project-card ${selected ? "is-selected" : ""}`} onClick={onSelect} aria-pressed={selected}>
        <strong>{project.name}</strong>
        {project.summary && <p>{project.summary}</p>}
        {project.technologies?.length > 0 && <span className="chip-row">{project.technologies.slice(0, 6).map((tech) => <span className="chip" key={tech}>{tech}</span>)}</span>}
    </button>
)

/**
 * @description Project deep-dive hub: choose a resume project and configure the session.
 */
const DeepDive = () => {
    const navigate = useNavigate()
    const [reports, setReports] = useState([])
    const [reportId, setReportId] = useState("")
    const [projects, setProjects] = useState([])
    const [projectsLoading, setProjectsLoading] = useState(false)
    const [projectsError, setProjectsError] = useState("")
    const [selectedId, setSelectedId] = useState("")
    const [useCustom, setUseCustom] = useState(false)
    const [custom, setCustom] = useState(EMPTY_CUSTOM)
    const [focusAreas, setFocusAreas] = useState(CATEGORIES.map((category) => category.id))
    const [difficulty, setDifficulty] = useState("medium")
    const [questionLimit, setQuestionLimit] = useState(8)
    const [sessions, setSessions] = useState([])
    const [loading, setLoading] = useState(true)
    const [starting, setStarting] = useState(false)
    const [error, setError] = useState("")
    const [deleteTarget, setDeleteTarget] = useState(null)
    const [deleting, setDeleting] = useState(false)

    useEffect(() => {
        Promise.all([getAllInterviewReports(), getDeepDiveHistory({ limit: 20 })])
            .then(([reportResponse, historyResponse]) => {
                const loaded = reportResponse.interviewReports || []
                setReports(loaded)
                setReportId(loaded[0]?._id || "")
                setSessions(historyResponse.sessions || [])
            })
            .catch((requestError) => setError(errorMessage(requestError, "We couldn't load your interview plans.")))
            .finally(() => setLoading(false))
    }, [])

    const loadProjects = useCallback(async (id, refresh = false) => {
        setProjectsLoading(true)
        setProjectsError("")
        try {
            const response = await getReportProjects(id, { refresh })
            setProjects(response.projects || [])
            setSelectedId(response.projects?.[0]?.projectId || "")
            setUseCustom(!response.projects?.length)
        } catch (requestError) {
            setProjects([])
            setSelectedId("")
            setUseCustom(true)
            setProjectsError(errorMessage(requestError, "We couldn't read projects from this resume."))
        } finally {
            setProjectsLoading(false)
        }
    }, [])

    useEffect(() => { if (reportId) loadProjects(reportId) }, [reportId, loadProjects])

    const toggleFocus = (id) => setFocusAreas((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])

    const customValid = custom.name.trim().length >= 2 && custom.description.trim().length >= 20
    const canStart = reportId && focusAreas.length > 0 && (useCustom ? customValid : Boolean(selectedId)) && !starting

    const begin = async (event) => {
        event.preventDefault()
        if (!canStart) return
        setStarting(true)
        setError("")
        const payload = { reportId, difficulty, questionLimit, focusAreas }
        if (useCustom) {
            payload.customProject = {
                name: custom.name.trim(),
                description: custom.description.trim(),
                technologies: custom.technologies.split(",").map((tech) => tech.trim()).filter(Boolean).slice(0, 15),
            }
        } else {
            payload.projectId = selectedId
        }
        try {
            const response = await startDeepDive(payload)
            navigate(`/deep-dive/${response.session._id}`)
        } catch (requestError) {
            setError(errorMessage(requestError, "Could not start the deep-dive. Please try again."))
            setStarting(false)
        }
    }

    const confirmDelete = async () => {
        setDeleting(true)
        try {
            await deleteDeepDive(deleteTarget._id)
            setSessions((current) => current.filter((session) => session._id !== deleteTarget._id))
            setDeleteTarget(null)
        } catch (requestError) {
            setError(errorMessage(requestError, "Could not delete that session."))
            setDeleteTarget(null)
        } finally {
            setDeleting(false)
        }
    }

    if (loading) return <main className="product-page loading-state"><p className="eyebrow">Project deep-dive</p><h1>Loading your projects...</h1></main>

    if (!reports.length) {
        return (
            <main className="product-page practice-setup">
                <header className="product-header"><div><p className="eyebrow">Project deep-dive</p><h1>Defend your projects with confidence</h1></div></header>
                {error ? <p className="practice-banner practice-banner--error" role="alert">{error}</p> : (
                    <div className="empty-state">
                        <h2>Upload your resume first</h2>
                        <p>Create an interview plan with your resume so we can find the projects you'll be asked about.</p>
                        <Link to="/generate" className="button primary-button">Create a plan</Link>
                    </div>
                )}
            </main>
        )
    }

    return (
        <main className="product-page practice-setup">
            <header className="product-header">
                <div>
                    <p className="eyebrow">Project deep-dive</p>
                    <h1>Defend your projects with confidence</h1>
                    <p>A senior engineer grills you on one project: architecture, technology choices, scale, security, and production incidents.</p>
                </div>
            </header>

            <form className="surface setup-card" onSubmit={begin}>
                <label className="setup-field">
                    <span>Resume</span>
                    <select value={reportId} onChange={(event) => setReportId(event.target.value)} disabled={starting}>
                        {reports.map((report) => <option key={report._id} value={report._id}>{report.title || "Untitled plan"} · {formatDate(report.createdAt)}</option>)}
                    </select>
                    <small>Projects are read from the resume attached to this plan.</small>
                </label>

                <div className="setup-field">
                    <div className="setup-field__heading">
                        <span>Choose a project</span>
                        {!projectsLoading && <button type="button" className="link-button" onClick={() => loadProjects(reportId, true)} disabled={starting}>Re-scan resume</button>}
                    </div>
                    {projectsError && <p className="practice-banner practice-banner--error" role="alert">{projectsError}</p>}
                    {projectsLoading ? (
                        <div className="project-grid" aria-busy="true"><div className="skeleton" /><div className="skeleton" /><ThinkingIndicator messages={["Reading your resume...", "Finding your projects...", "Listing technologies..."]} /></div>
                    ) : (
                        <div className="project-grid">
                            {projects.map((project) => <ProjectCard key={project.projectId} project={project} selected={!useCustom && selectedId === project.projectId} onSelect={() => { setSelectedId(project.projectId); setUseCustom(false) }} />)}
                            <button type="button" className={`project-card project-card--add ${useCustom ? "is-selected" : ""}`} onClick={() => setUseCustom(true)} aria-pressed={useCustom}>
                                + {projects.length ? "Describe another project" : "Describe a project manually"}
                            </button>
                        </div>
                    )}
                    {!projectsLoading && !projects.length && !projectsError && <small>No projects were found in this resume. Describe one below to continue.</small>}
                    {useCustom && !projectsLoading && (
                        <div className="custom-project">
                            <label className="setup-field"><span>Project name</span><input value={custom.name} onChange={(event) => setCustom({ ...custom, name: event.target.value })} maxLength={120} placeholder="e.g. Realtime chat platform" /></label>
                            <label className="setup-field"><span>What it does and what you built</span><textarea value={custom.description} onChange={(event) => setCustom({ ...custom, description: event.target.value })} maxLength={2000} placeholder="Describe the problem, your role, the architecture, and anything notable (scale, features, metrics)." /><small>At least 20 characters. The more specific, the sharper the questions.</small></label>
                            <label className="setup-field"><span>Technologies</span><input value={custom.technologies} onChange={(event) => setCustom({ ...custom, technologies: event.target.value })} placeholder="React, Node.js, PostgreSQL, Redis" /><small>Comma-separated.</small></label>
                        </div>
                    )}
                </div>

                <div className="setup-field">
                    <span>Focus areas</span>
                    <div className="toggle-chips">
                        {CATEGORIES.map((category) => <button type="button" key={category.id} className={focusAreas.includes(category.id) ? "is-selected" : ""} aria-pressed={focusAreas.includes(category.id)} onClick={() => toggleFocus(category.id)} disabled={starting}>{category.label}</button>)}
                    </div>
                    <small>{focusAreas.length ? `${focusAreas.length} selected. The interviewer covers these in order and follows up where your answers are thin.` : "Select at least one area."}</small>
                </div>

                <div className="setup-row">
                    <div className="setup-field">
                        <span id="dd-difficulty">Difficulty</span>
                        <div className="segmented" role="radiogroup" aria-labelledby="dd-difficulty">
                            {DIFFICULTIES.map((value) => <button type="button" role="radio" aria-checked={difficulty === value} key={value} className={difficulty === value ? "is-selected" : ""} onClick={() => setDifficulty(value)} disabled={starting}>{value}</button>)}
                        </div>
                    </div>
                    <div className="setup-field">
                        <span id="dd-length">Length</span>
                        <div className="segmented" role="radiogroup" aria-labelledby="dd-length">
                            {SESSION_LENGTHS.map((option) => <button type="button" role="radio" aria-checked={questionLimit === option.value} key={option.value} className={questionLimit === option.value ? "is-selected" : ""} onClick={() => setQuestionLimit(option.value)} disabled={starting}>{option.label}</button>)}
                        </div>
                        <small>{SESSION_LENGTHS.find((option) => option.value === questionLimit)?.hint}</small>
                    </div>
                </div>

                {error && <p className="inline-error" role="alert">{error}</p>}
                <div className="setup-footer">
                    {starting ? <ThinkingIndicator messages={START_MESSAGES} /> : <p>Expect "why" questions, scale scenarios, and production incidents. Answer as if the interviewer can read your code.</p>}
                    <button className="button primary-button" disabled={!canStart}>{starting ? "Preparing..." : "Start deep-dive"}</button>
                </div>
            </form>

            {sessions.length > 0 && (
                <section className="report-block">
                    <div className="report-block__heading"><div><p className="eyebrow">History</p><h2>Your deep-dives</h2></div><span>{sessions.length} session{sessions.length === 1 ? "" : "s"}</span></div>
                    <div className="session-list">{sessions.map((session) => <SessionRow key={session._id} kind="deep-dive" session={session} onDelete={setDeleteTarget} />)}</div>
                </section>
            )}

            <DeleteConfirmModal
                open={Boolean(deleteTarget)}
                title="Delete this deep-dive?"
                message="The transcript and report will be permanently deleted."
                onConfirm={confirmDelete}
                onCancel={() => setDeleteTarget(null)}
                busy={deleting}
            />
        </main>
    )
}

export default DeepDive
