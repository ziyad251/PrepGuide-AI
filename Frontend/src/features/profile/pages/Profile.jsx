import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router"
import { useAuth } from "../../auth/hooks/useAuth"
import { useInterview } from "../../interview/hooks/useInterview"
import "../../../style/product.scss"
import "../style/profile-premium.scss"

const Profile = () => {
    const { user, handleLogout } = useAuth()
    const { reports, getReports, loading } = useInterview()
    const navigate = useNavigate()
    const [error, setError] = useState("")
    useEffect(() => { getReports().catch((requestError) => setError(requestError.response?.data?.message || "We couldn't load your reports.")) }, [])
    const latest = reports[0]
    const logout = async () => { await handleLogout(); navigate("/") }
    return <main className="product-page profile-premium"><header className="profile-premium__hero"><div className="profile-premium__avatar">{(user?.username?.[0] || "U").toUpperCase()}</div><div><p className="eyebrow">Candidate profile</p><h1>{user?.username || "Candidate"}</h1><p>{user?.email || "Email unavailable"}</p></div></header><section className="profile-grid"><div className="surface profile-block"><p className="eyebrow">Account</p><h2>Workspace details</h2><dl><div><dt>Name</dt><dd>{user?.username || "Not available"}</dd></div><div><dt>Email</dt><dd>{user?.email || "Not available"}</dd></div><div><dt>Interview plans</dt><dd>{loading ? "Loading..." : reports.length || "None yet"}</dd></div></dl></div><div className="surface profile-block"><p className="eyebrow">Current context</p><h2>{latest?.title || "No target role yet"}</h2><p className="muted">{latest ? "Your latest generated plan is ready for adaptive practice." : "Create a plan to give your preparation a target role and job description."}</p>{latest ? <Link to={`/interview/${latest._id}/simulator`} className="button primary-button">Practice latest role</Link> : <Link to="/generate" className="button primary-button">Create a plan</Link>}</div></section>{error && <p className="inline-error">{error}</p>}<button type="button" className="button secondary-button profile-logout" onClick={logout}>Sign out</button></main>
}
export default Profile
