import { useState } from "react"
import { useNavigate } from "react-router"
import { useAuth } from "./useAuth"

export const DEMO_EMAIL = "ziyad@gmail.com"
const DEMO_PASSWORD = "ziyad@gmail.com"
export const DEMO_ERROR = "Demo account unavailable right now — please register."

/**
 * Signs in with the shared demo account through the normal handleLogin flow,
 * then goes to the dashboard. One instance per page, so several buttons share
 * it and only the clicked one (identified by `source`) shows its loading or
 * error state.
 */
export const useDemoLogin = () => {
    const { user, handleLogin } = useAuth()
    const navigate = useNavigate()
    const [pendingSource, setPendingSource] = useState(null)
    const [errorSource, setErrorSource] = useState(null)

    const startDemo = async (source = "default") => {
        if (pendingSource) return
        if (user) {
            navigate("/dashboard")
            return
        }
        setErrorSource(null)
        setPendingSource(source)
        try {
            await handleLogin({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
            navigate("/dashboard")
        } catch {
            setErrorSource(source)
        } finally {
            setPendingSource(null)
        }
    }

    return {
        startDemo,
        isPending: (source) => pendingSource === source,
        isBusy: pendingSource !== null,
        errorFor: (source) => (errorSource === source ? DEMO_ERROR : ""),
    }
}
