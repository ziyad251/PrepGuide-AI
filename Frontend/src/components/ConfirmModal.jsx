import { useEffect } from "react"
import "../style/modal.scss"

const ConfirmModal = ({ open, title, message, onConfirm, onCancel, busy, confirmLabel = "Confirm", busyLabel = "Working...", cancelLabel = "Cancel", tone = "primary" }) => {
    useEffect(() => {
        if (!open) return undefined
        const onKey = (event) => { if (event.key === "Escape" && !busy) onCancel() }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [open, busy, onCancel])

    if (!open) return null

    return (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title" onClick={() => !busy && onCancel()}>
            <div className="modal" onClick={(event) => event.stopPropagation()}>
                <h3 id="confirm-modal-title">{title}</h3>
                <p>{message}</p>
                <div className="modal__actions">
                    <button type="button" className="button secondary-button" onClick={onCancel} disabled={busy}>
                        {cancelLabel}
                    </button>
                    <button type="button" className={`button primary-button ${tone === "danger" ? "modal__danger" : ""}`} onClick={onConfirm} disabled={busy} autoFocus>
                        {busy ? busyLabel : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default ConfirmModal
