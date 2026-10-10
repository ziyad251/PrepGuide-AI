import { useState } from "react"
import { Link } from "react-router"
import "../../style/navbar.scss"

const Navbar = ({ variant = "public" }) => {
    const [menuOpen, setMenuOpen] = useState(false)
    return <header className={`site-nav site-nav--${variant}`}><Link to="/" className="site-nav__logo"><span>◒</span> PrepGuide <b>AI</b></Link><nav className="site-nav__links"><Link to="/#how-it-works">How it works</Link><Link to="/login">Sign in</Link><Link to="/register" className="site-nav__cta">Start preparing</Link></nav><button type="button" className="site-nav__menu" onClick={() => setMenuOpen((open) => !open)} aria-label="Toggle navigation">☰</button>{menuOpen && <nav className="site-nav__mobile"><Link to="/#how-it-works" onClick={() => setMenuOpen(false)}>How it works</Link><Link to="/login" onClick={() => setMenuOpen(false)}>Sign in</Link><Link to="/register" onClick={() => setMenuOpen(false)}>Start preparing</Link></nav>}</header>
}

export default Navbar
