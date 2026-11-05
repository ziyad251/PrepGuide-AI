import { useState } from "react"
import { Navigate } from "react-router"
import { useAuth } from "../hooks/useAuth"

const GuestOnly = ({ children }) => {
    const { user, loading } = useAuth()
    // Only block on the first session check. A later loading flag (from a login
    // attempt) must not unmount the form, or its button/error state is lost.
    const [settled, setSettled] = useState(!loading)
    if (!loading && !settled) setSettled(true)

    if (!settled) {
        return <main className="page-loading" aria-live="polite"><p>Loading…</p></main>
    }

    if (user) {
        return <Navigate to="/dashboard" replace />
    }

    return children
}

export default GuestOnly
