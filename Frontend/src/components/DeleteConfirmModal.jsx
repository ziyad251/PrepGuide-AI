import ConfirmModal from "./ConfirmModal"

const DeleteConfirmModal = ({ open, title, message, onConfirm, onCancel, busy }) => (
    <ConfirmModal
        open={open}
        title={title}
        message={message}
        onConfirm={onConfirm}
        onCancel={onCancel}
        busy={busy}
        confirmLabel="Delete"
        busyLabel="Deleting..."
        tone="danger"
    />
)

export default DeleteConfirmModal
