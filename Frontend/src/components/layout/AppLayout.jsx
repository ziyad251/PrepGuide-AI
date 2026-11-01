import { Link, useLocation } from "react-router"
import { useAuth } from "../../features/auth/hooks/useAuth"
import "../../style/app-shell.scss"

const navGroups = [
    { label: "Workspace", items: [{ label: "Dashboard", path: "/dashboard", icon: "⌂" }, { label: "New plan", path: "/generate", icon: "+" }] },
    { label: "Practice", items: [{ label: "Mock interview", path: "/mock-interview", icon: "◎", match: ["/sessions"] }, { label: "Project deep-dive", path: "/deep-dive", icon: "⌘" }] },
    { label: "Intelligence", items: [{ label: "Skills", path: "/skills", icon: "◈" }, { label: "Interview history", path: "/history", icon: "◷" }, { label: "Roadmap", path: "/roadmap", icon: "↗" }] },
    { label: "Quality", items: [{ label: "Evaluation suite", path: "/evaluation-suite", icon: "✓" }] },
]

const AppLayout = ({ children }) => {
    const location = useLocation()
    const { user, handleLogout } = useAuth()
    const isActive = (path, match = []) => location.pathname === path || [path, ...match].some((prefix) => prefix !== "/dashboard" && location.pathname.startsWith(prefix))
    return <div className="app-layout">
        <aside className="sidebar">
            <Link to="/dashboard" className="sidebar__brand"><span className="sidebar__mark">◒</span> PrepGuide <span className="highlight">AI</span></Link>
            {navGroups.map((group) => <div key={group.label} className="sidebar__group"><p className="sidebar__section">{group.label}</p><nav className="sidebar__nav">{group.items.map((item) => <Link key={item.path} to={item.path} className={`sidebar__link ${isActive(item.path, item.match) ? "sidebar__link--active" : ""}`}><span className="sidebar__icon">{item.icon}</span>{item.label}</Link>)}</nav></div>)}
            <div className="sidebar__bottom"><Link to="/profile" className={`sidebar__link ${isActive("/profile") ? "sidebar__link--active" : ""}`}><span className="sidebar__icon">○</span>Profile</Link><div className="sidebar__user"><span className="sidebar__avatar">{(user?.username?.[0] || "U").toUpperCase()}</span><span>{user?.username || "Candidate"}</span></div><button type="button" className="sidebar__logout" onClick={handleLogout}>Sign out</button></div>
        </aside>
        <div className="mobile-topbar"><Link to="/dashboard" className="mobile-topbar__brand">PrepGuide <span className="highlight">AI</span></Link><nav className="mobile-topbar__menu"><Link to="/dashboard">Home</Link><Link to="/mock-interview">Interview</Link><Link to="/deep-dive">Projects</Link><Link to="/skills">Skills</Link><Link to="/profile">Profile</Link></nav></div>
        <main className="app-layout__main">{children}</main>
    </div>
}

export default AppLayout
