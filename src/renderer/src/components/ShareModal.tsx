import { useEffect, useState } from 'react'
import { Copy, Link2, Trash2 } from 'lucide-react'
import Modal from './Modal'
import { useStore } from '../store'
import type { FileMeta, SharedLink, ShareRole } from '@shared/types'

const ROLES: { value: ShareRole; label: string }[] = [
  { value: 'reader', label: 'Lecture seule' },
  { value: 'commenter', label: 'Commentaire' },
  { value: 'writer', label: 'Édition' }
]

export default function ShareModal({
  file,
  onClose
}: {
  file: FileMeta
  onClose: () => void
}): JSX.Element {
  const { toast, loadFiles } = useStore()
  const [role, setRole] = useState<ShareRole>('reader')
  const [existing, setExisting] = useState<SharedLink | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    window.api.share.forFile(file.id).then(setExisting)
  }, [file.id])

  async function create(): Promise<void> {
    setBusy(true)
    try {
      const url = await window.api.share.create(file.id, role)
      setExisting(await window.api.share.forFile(file.id))
      await loadFiles()
      toast('Lien créé et copié dans le presse-papiers', 'success')
      void url
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erreur de partage', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function revoke(): Promise<void> {
    setBusy(true)
    try {
      await window.api.share.revoke(file.id)
      setExisting(null)
      toast('Partage révoqué', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={`Partager « ${file.originalFilename} »`} onClose={onClose}>
      {existing ? (
        <>
          <div className="field">
            <label className="field-label">Lien public actif</label>
            <div className="search-bar">
              <Link2 size={14} style={{ color: 'var(--text-tertiary)' }} />
              <input readOnly value={existing.url} />
              <button
                className="icon-btn"
                onClick={() => {
                  window.api.clipboard.write(existing.url)
                  toast('Lien copié', 'success')
                }}
              >
                <Copy size={14} />
              </button>
            </div>
            <span className="muted" style={{ fontSize: 12 }}>
              Accès : {ROLES.find((r) => r.value === existing.role)?.label}
            </span>
          </div>
          <button className="btn btn-danger" onClick={revoke} disabled={busy}>
            <Trash2 size={14} /> Révoquer le partage
          </button>
        </>
      ) : (
        <>
          <div className="field">
            <label className="field-label">Niveau d'accès</label>
            <select
              className="field-input"
              value={role}
              onChange={(e) => setRole(e.target.value as ShareRole)}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <p className="muted" style={{ fontSize: 12 }}>
            Un lien « toute personne disposant du lien » sera généré sur le Drive du compte
            hébergeant ce fichier. Il sera copié dans le presse-papiers.
          </p>
          <button className="btn btn-primary" onClick={create} disabled={busy}>
            <Link2 size={14} /> Générer le lien
          </button>
        </>
      )}
    </Modal>
  )
}
