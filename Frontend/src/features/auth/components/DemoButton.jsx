/**
 * "Try the demo" button bound to a shared useDemoLogin() instance.
 * The inline error renders under the button that was clicked.
 */
const DemoButton = ({ demo, source, className = "", label = "Try the demo", variant = "primary", showError = true }) => {
    const pending = demo.isPending(source)
    const error = demo.errorFor(source)
    return (
        <span className="demo-button">
            <button
                type="button"
                className={`button ${variant}-button ${className}`}
                onClick={() => demo.startDemo(source)}
                disabled={demo.isBusy}
                aria-busy={pending}
            >
                {pending ? "Signing in…" : label}
            </button>
            {showError && error && <span className="demo-button__error" role="alert">{error}</span>}
        </span>
    )
}

export default DemoButton
