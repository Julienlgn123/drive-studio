import { useEffect, useState } from 'react'
import { UserPlus, RefreshCw, Trash2, DownloadCloud, AlertCircle } from 'lucide-react'
import { useStore } from '../store'
import ProgressBar from '../components/ProgressBar'
import { formatBytes, formatRelative, accountColor } from '../lib/format'
import type { Account, AccountRole } from '@shared/types'

export default function AccountsView(): JSX.Element {
  const { accounts, settings, loadAccounts, loadAll, setView, toast } = useStore()
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    loadAccounts()
  }, [])

  async function addAccount(): Promise<void> {
    if (!settings.googleConfigured) {
      toast('Configure d\'abord tes identifiants Google dans Réglages', 'error')
      setView('settings')
      return
    }
    setAdding(true)
    try {
      await window.api.accounts.add()
      await loadAll()
      toast('Compte lié', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Échec de la liaison', 'error')
    } finally {
      setAdding(false)
    }
  }

  async function setRole(id: string, role: AccountRole): Promise<void> {
    await window.api.accounts.setRole(id, role)
    await loadAccounts()
  }

  async function sync(id: string): Promise<void> {
    setBusyId(id)
    try {
      await window.api.accounts.sync(id)
      await loadAll()
      toast('Quota mis à jour', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Échec de la sync', 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function importFiles(id: string): Promise<void> {
    setBusyId(id)
    try {
      const n = await window.api.accounts.importFiles(id)
      await loadAll()
      toast(`${n} fichier(s) importé(s) depuis Drive`, 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Échec de l\'import', 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function remove(id: string, email: string): Promise<void> {
    if (!window.confirm(`Retirer le compte ${email} ? Les fichiers restent sur Google Drive.`)) return
    setBusyId(id)
    try {
      await window.api.accounts.remove(id)
      await loadAll()
      toast('Compte retiré', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="view-scroll">
      <div className="page-header">
        <div className="page-header-left">
          <span className="page-header-title">Comptes Google Drive</span>
          <span className="muted" style={{ fontSize: 13 }}>
            {accounts.length} lié{accounts.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="page-header-right">
          <button className="btn btn-primary" onClick={addAccount} disabled={adding}>
            {adding ? <div className="spinner" style={{ width: 14, height: 14 }} /> : <UserPlus size={15} />}
            {adding ? 'Autorisation…' : 'Ajouter un compte'}
          </button>
        </div>
      </div>

      <div className="view-pad">
        {!settings.googleConfigured && (
          <div
            className="card"
            style={{
              marginBottom: 16,
              borderColor: 'rgba(251,191,36,0.3)',
              background: 'var(--warning-dim)',
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              fontSize: 13,
              color: 'var(--warning)'
            }}
          >
            <AlertCircle size={16} />
            Identifiants OAuth non configurés.
            <button className="btn btn-sm btn-secondary" onClick={() => setView('settings')} style={{ marginLeft: 'auto' }}>
              Configurer
            </button>
          </div>
        )}

        {accounts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👤</div>
            <div className="empty-state-title">Aucun compte lié</div>
            <div className="empty-state-desc">
              Clique sur « Ajouter un compte » : une fenêtre Google s'ouvrira pour autoriser
              l'accès à Drive.
            </div>
          </div>
        ) : (
          <div className="card-grid">
            {accounts.map((a, i) => (
              <AccountCard
                key={a.id}
                account={a}
                index={i}
                busy={busyId === a.id}
                onRole={setRole}
                onSync={sync}
                onImport={importFiles}
                onRemove={remove}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AccountCard({
  account: a,
  index,
  busy,
  onRole,
  onSync,
  onImport,
  onRemove
}: {
  account: Account
  index: number
  busy: boolean
  onRole: (id: string, role: AccountRole) => void
  onSync: (id: string) => void
  onImport: (id: string) => void
  onRemove: (id: string, email: string) => void
}): JSX.Element {
  const ratio = a.quotaTotal > 0 ? a.quotaUsed / a.quotaTotal : 0
  return (
    <div className="account-card">
      <div className="account-card-head">
        <div className="account-avatar" style={{ background: accountColor(index) }}>
          {a.email.slice(0, 1).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="account-email">{a.email}</div>
          <div className="account-meta">Sync {formatRelative(a.lastSync)}</div>
        </div>
        <span className={`status-pill ${a.status}`}>
          {a.status === 'active' ? '✓ actif' : a.status === 'error' ? '✗ erreur' : '⏸ pause'}
        </span>
      </div>

      <div className="col" style={{ gap: 4 }}>
        <div className="spread" style={{ fontSize: 12 }}>
          <span className="muted">
            {formatBytes(a.quotaUsed)} / {formatBytes(a.quotaTotal)}
          </span>
          <span className="muted">
            {a.filesCount ?? 0} fichier{(a.filesCount ?? 0) !== 1 ? 's' : ''}
          </span>
        </div>
        <ProgressBar ratio={ratio} />
      </div>

      <div className="role-toggle">
        <button className={a.role === 'primary' ? 'on' : ''} onClick={() => onRole(a.id, 'primary')}>
          Principal
        </button>
        <button className={a.role === 'backup' ? 'on' : ''} onClick={() => onRole(a.id, 'backup')}>
          Backup
        </button>
      </div>

      <div className="row" style={{ gap: 4 }}>
        <button className="btn btn-sm btn-secondary" onClick={() => onSync(a.id)} disabled={busy}>
          <RefreshCw size={12} /> Sync
        </button>
        <button className="btn btn-sm btn-secondary" onClick={() => onImport(a.id)} disabled={busy}>
          <DownloadCloud size={12} /> Importer
        </button>
        <button
          className="btn btn-sm btn-danger"
          style={{ marginLeft: 'auto' }}
          onClick={() => onRemove(a.id, a.email)}
          disabled={busy}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}
