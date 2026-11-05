import { useState } from 'react'
import { useNavigate, Link } from 'react-router'
import "../auth.form.scss"
import { useAuth } from '../hooks/useAuth'
import { useDemoLogin, DEMO_EMAIL } from '../hooks/useDemoLogin'
import { getErrorMessage } from '../services/auth.api'
import DemoButton from '../components/DemoButton'

const Login = () => {

    const { handleLogin } = useAuth()
    const demo = useDemoLogin()
    const navigate = useNavigate()

    const [ email, setEmail ] = useState("")
    const [ password, setPassword ] = useState("")
    const [ submitting, setSubmitting ] = useState(false)
    const [ error, setError ] = useState("")

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError("")
        setSubmitting(true)
        try {
            await handleLogin({ email, password })
            navigate("/dashboard")
        } catch (err) {
            setError(getErrorMessage(err))
        } finally {
            setSubmitting(false)
        }
    }

    const busy = submitting || demo.isBusy

    return (
        <main className="auth-page">
            <header className="auth-page__top">
                <Link to="/" className="auth-page__mark">PrepGuide</Link>
            </header>

            <section className="auth-card" aria-labelledby="login-title">
                <p className="auth-card__kicker">Welcome back</p>
                <h1 id="login-title">Log in</h1>

                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label htmlFor="email">Email</label>
                        <input
                            onChange={(e) => { setEmail(e.target.value) }}
                            value={email}
                            type="email" id="email" name='email' autoComplete="email" required
                            placeholder='you@example.com' />
                    </div>
                    <div className="input-group">
                        <label htmlFor="password">Password</label>
                        <input
                            onChange={(e) => { setPassword(e.target.value) }}
                            value={password}
                            type="password" id="password" name='password' autoComplete="current-password" required
                            placeholder='Your password' />
                    </div>
                    {error && <p className="auth-card__error" role="alert">{error}</p>}
                    <button className='button primary-button auth-card__submit' disabled={busy}>
                        {submitting ? "Logging in…" : "Log in"}
                    </button>
                </form>

                <div className="auth-card__divider"><span>or</span></div>

                <DemoButton demo={demo} source="login" variant="secondary" className="auth-card__demo" />
                <p className="auth-card__note">Demo account: {DEMO_EMAIL}</p>

                <p className="auth-card__switch">Don't have an account? <Link to={"/register"}>Create one</Link></p>
            </section>
        </main>
    )
}

export default Login
