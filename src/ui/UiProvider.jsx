import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import Modal from '../components/Modal.jsx'

const UiContext = createContext(null)
let nextId = 1

export function UiProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [dialog, setDialog] = useState(null)

  const toast = useCallback((message, kind = 'info') => {
    const id = nextId++
    setToasts((t) => [...t.slice(-3), { id, message, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 3500)
  }, [])

  // confirm({ title, message, confirmLabel, danger, requireText }) -> Promise<boolean>
  const confirm = useCallback((options) => new Promise((resolve) => setDialog({ ...options, resolve })), [])

  const answer = (result) => {
    dialog?.resolve(result)
    setDialog(null)
  }

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm])
  return (
    <UiContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.kind}`}>
            {t.message}
          </div>
        ))}
      </div>
      {dialog && <ConfirmModal dialog={dialog} onAnswer={answer} />}
    </UiContext.Provider>
  )
}

function ConfirmModal({ dialog, onAnswer }) {
  const [typed, setTyped] = useState('')
  const needs = dialog.requireText
  const enabled = !needs || typed.trim().toLowerCase() === needs.trim().toLowerCase()
  return (
    <Modal
      title={dialog.title}
      small
      onClose={() => onAnswer(false)}
      footer={
        <>
          <button className="btn btn--ghost" onClick={() => onAnswer(false)}>
            {dialog.cancelLabel ?? 'Cancelar'}
          </button>
          <button
            className={`btn ${dialog.danger ? 'btn--danger' : 'btn--primary'}`}
            disabled={!enabled}
            onClick={() => onAnswer(true)}
          >
            {dialog.confirmLabel ?? 'Confirmar'}
          </button>
        </>
      }
    >
      <p className="modal__text">{dialog.message}</p>
      {needs && (
        <label className="field">
          <span>
            Para confirmar, digite <strong>{needs}</strong>
          </span>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
        </label>
      )}
    </Modal>
  )
}

export const useUi = () => useContext(UiContext)
