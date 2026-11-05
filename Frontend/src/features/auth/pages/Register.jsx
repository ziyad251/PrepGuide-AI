import { useState } from 'react'
import { useNavigate, Link } from 'react-router'
import "../auth.form.scss"
import { useAuth } from '../hooks/useAuth'
import { getErrorMessage } from '../services/auth.api'

const Register = () => {

    const navigate = useNavigate()
    const [ username, setUsername ] = useState("")
    const [ email, setEmail ] = useState("")
    const [ password, setPassword ] = useState("")
    const [ submitting, setSubmitting ] = useState(false)
    const [ error, setError ] = useState("")

    const { handleRegister } = useAuth()

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError("")
        setSubmitting(true)
        try {
            await handleRegister({ username, email, password })
            navigate("/dashboard")
        } catch (err) {
            setError(getErrorMessage(err))
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <main className="auth-page">
            <header className="auth-page__top">
                <Link to="/" className="auth-page__mark">PrepGuide</Link>
            </header>

            <section className="auth-card" aria-labelledby="register-title">
                <p className="auth-card__kicker">Start preparing</p>
                <h1 id="register-title">Create an account</h1>

                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label htmlFor="username">Username</label>
                        <input
                            onChange={(e) => { setUsername(e.target.value) }}
                            value={username}
                            type="text" id="username" name='username' autoComplete="username" required
                            placeholder='How should we greet you?' />
                    </div>
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
                            type="password" id="password" name='password' autoComplete="new-password" required
                            placeholder='Choose a password' />
                    </div>
                    {error && <p className="auth-card__error" role="alert">{error}</p>}
                    <button className='button primary-button auth-card__submit' disabled={submitting}>
                        {submitting ? "Creating account…" : "Create account"}
                    </button>
                </form>

                <p className="auth-card__switch">Already have an account? <Link to={"/login"}>Log in</Link></p>
            </section>
        </main>
    )
}

export default Register
