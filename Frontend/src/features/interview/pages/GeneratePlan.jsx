import { useState } from "react"
import { Link, useNavigate } from "react-router"
import { useInterview } from "../hooks/useInterview"
import GenerationProgress from "../../../components/GenerationProgress"
import "../../../style/product.scss"
import "../style/onboarding.scss"

const GeneratePlan = () => {
    const { generating, generateReport } = useInterview()
    const [jobDescription, setJobDescription] = useState("")
    const [selfDescription, setSelfDescription] = useState("")
    const [error, setError] = useState("")
    const [resumeFile, setResumeFile] = useState(null)
    const navigate = useNavigate()
    const handleGenerateReport = async (event) => {
        event.preventDefault()
        setError("")
        console.log("[SETUP] request sent", { hasResume: Boolean(resumeFile), resumeName: resumeFile?.name || "" })
        try {
            const data = await generateReport({ jobDescription, selfDescription, resumeFile })
            if (data?._id) navigate(`/interview/${data._id}`)
            else setError("Add a job description and a resume or self-description to continue.")
        } catch (requestError) {
            setError(requestError.response?.data?.detail || requestError.response?.data?.message || "The plan could not be generated.")
        }
    }
    if (generating) return <GenerationProgress />
    return <main className="product-page onboarding-page"><Link to="/dashboard" className="quiet-link">← Back to dashboard</Link><header className="product-header onboarding-header"><div><p className="eyebrow">Interview context</p><h1>Set up your preparation plan</h1><p>Give PrepGuide the target role and candidate context it needs to build a focused interview.</p></div></header><form className="onboarding-grid" onSubmit={handleGenerateReport}><section className="surface onboarding-panel"><div className="onboarding-panel__heading"><span>01</span><div><p className="eyebrow">Target role</p><h2>Job description</h2></div></div><label htmlFor="jobDescription">Paste the role requirements<textarea id="jobDescription" value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} placeholder="Paste the full job description here..." maxLength={5000} required /></label><p className="field-hint">The job description becomes part of your adaptive interview context.</p></section><section className="surface onboarding-panel"><div className="onboarding-panel__heading"><span>02</span><div><p className="eyebrow">Candidate context</p><h2>Resume or self-description</h2></div></div><label className="file-field" htmlFor="resume"><span>Upload a PDF resume</span><small>{resumeFile?.name || "PDF only · max 3MB"}</small><input id="resume" type="file" accept=".pdf" onChange={(event) => { const file = event.target.files?.[0] || null; setResumeFile(file); console.log("[SETUP] resume selected", { name: file?.name || "", size: file?.size || 0, type: file?.type || "" }) }} /></label><div className="onboarding-or"><span>or</span></div><label htmlFor="selfDescription">Describe your experience<textarea id="selfDescription" value={selfDescription} onChange={(event) => setSelfDescription(event.target.value)} placeholder="Skills, projects, years of experience, and what you want to improve..." /></label><p className="field-hint">Either a PDF or this description is required.</p></section><div className="onboarding-footer"><div><span className="status-badge status-badge--quiet">Context-aware setup</span><p>Next, your interview will adapt to demonstrated skill evidence.</p></div>{error && <p className="inline-error" role="alert">{error}</p>}<button className="button primary-button" type="submit" disabled={generating}>Generate preparation plan</button></div></form></main>
}
export default GeneratePlan
