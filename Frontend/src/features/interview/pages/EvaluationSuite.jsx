import { useEffect, useState } from "react"
import { Link } from "react-router"
import { getEvaluationSuite, runEvaluationSuite } from "../services/interview.api"
import "../../../style/product.scss"
import "../style/evaluation.scss"

const EvaluationSuite = () => {
    const [runs, setRuns] = useState([])
    const [loading, setLoading] = useState(true)
    const [running, setRunning] = useState(false)
    const [error, setError] = useState("")
    const latest = runs[0]
    useEffect(() => { getEvaluationSuite().then((response) => setRuns(response.runs || [])).catch((requestError) => setError(requestError.response?.data?.message || "We couldn't load evaluation runs.")).finally(() => setLoading(false)) }, [])
    const run = async () => { setRunning(true); setError(""); try { const response = await runEvaluationSuite(); setRuns((previous) => [response.run, ...previous]) } catch (requestError) { setError(requestError.response?.data?.message || "The evaluation suite could not run.") } finally { setRunning(false) } }
    if (loading) return <main className="product-page loading-state"><p className="eyebrow">Quality system</p><h1>Loading evaluation history...</h1></main>
    return <main className="product-page evaluation-page"><header className="product-header"><div><p className="eyebrow">Quality system</p><h1>AI evaluation suite</h1><p>Validate the consistency of PrepGuide's adaptive intelligence with real test runs.</p></div><button className="button primary-button" onClick={run} disabled={running}>{running ? "Running live cases..." : "Run suite"}</button></header>{error && <div className="evaluation-error" role="alert">{error}</div>}{latest ? <><section className="evaluation-summary">{[["Cases", latest.summary.total], ["Passed", latest.summary.passed], ["Pass rate", `${latest.summary.passRate}%`], ["Average score", latest.summary.averageScore]].map(([label, value]) => <div className="surface" key={label}><span>{label}</span><strong>{value}</strong></div>)}</section><section className="evaluation-cases"><div className="evaluation-cases__heading"><div><p className="eyebrow">Latest run</p><h2>Case results</h2></div><span>{new Date(latest.createdAt).toLocaleString()}</span></div>{latest.cases.map((item) => <article key={`${item.name}-${item.timestamp}`} className="surface evaluation-case"><div className={`evaluation-case__status ${item.passed ? "is-pass" : "is-fail"}`}>{item.passed ? "PASS" : "FAIL"}</div><div><p className="eyebrow">{item.category}</p><h3>{item.name}</h3><p><b>Expected</b>{item.expected}</p><small>{item.evidence || item.actual}</small></div><strong>{item.score ? `${item.score}/10` : "—"}</strong></article>)}</section></> : <div className="empty-state"><h2>No evaluation runs yet</h2><p>Run the suite after creating an interview report. Results will come from live evaluation cases.</p><button className="button primary-button" onClick={run} disabled={running}>{running ? "Running..." : "Run first suite"}</button></div>}<Link to="/dashboard" className="quiet-link">Back to dashboard</Link></main>
}
export default EvaluationSuite
