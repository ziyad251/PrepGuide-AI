import { useState } from "react"
import { Link } from "react-router"
import DemoButton from "../../features/auth/components/DemoButton"
import "../../style/navbar.scss"

const links = [
    { label: "How it works", href: "#how-it-works" },
    { label: "Features", href: "#features" },
]

/** Public site header. `demo` is a shared useDemoLogin() instance from the page. */
const Navbar = ({ demo }) => {
    const [menuOpen, setMenuOpen] = useState(false)
    const close = () => setMenuOpen(false)

    return (
        <header className="site-nav">
            <div className="site-nav__inner">
                <Link to="/" className="site-nav__logo" onClick={close}>PrepGuide</Link>

                <nav className="site-nav__links" aria-label="Primary">
                    {links.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}
                </nav>

                <div className="site-nav__actions">
                    <Link to="/login" className="site-nav__login">Log in</Link>
                    {demo && <DemoButton demo={demo} source="nav" className="site-nav__demo" showError={false} />}
                </div>

                <button
                    type="button"
                    className="site-nav__menu"
                    onClick={() => setMenuOpen((open) => !open)}
                    aria-expanded={menuOpen}
                    aria-controls="site-nav-mobile"
                >
                    {menuOpen ? "Close" : "Menu"}
                </button>
            </div>

            {menuOpen && (
                <nav id="site-nav-mobile" className="site-nav__mobile" aria-label="Mobile">
                    {links.map((link) => <a key={link.href} href={link.href} onClick={close}>{link.label}</a>)}
                    <Link to="/login" onClick={close}>Log in</Link>
                    <Link to="/register" onClick={close}>Create an account</Link>
                    {demo && <DemoButton demo={demo} source="nav-mobile" />}
                </nav>
            )}
            {demo?.errorFor("nav") && <p className="site-nav__error" role="alert">{demo.errorFor("nav")}</p>}
        </header>
    )
}

export default Navbar
