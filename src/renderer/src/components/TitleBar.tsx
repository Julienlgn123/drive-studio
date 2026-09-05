import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useStore } from '../store'

export default function TitleBar(): JSX.Element {
  const { loadAll, toast } = useStore()
  const [syncing, setSyncing] = useState(false)

  async function syncAll(): Promise<void> {
    setSyncing(true)
    try {
      await window.api.accounts.syncAll()
      await loadAll()
      toast('Comptes synchronisés', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Échec de la synchronisation', 'error')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="titlebar">
      <div className="titlebar-controls">
        <div className="titlebar-btn close" onClick={() => window.api.window.close()} />
        <div className="titlebar-btn minimize" onClick={() => window.api.window.minimize()} />
        <div className="titlebar-btn maximize" onClick={() => window.api.window.maximize()} />
      </div>

      <span className="titlebar-title">Drive Backup Manager</span>

      <div className="titlebar-actions">
        <button
          className="icon-btn"
          onClick={syncAll}
          disabled={syncing}
          data-tooltip="Synchroniser les quotas"
          data-tooltip-dir="left-down"
        >
          <RefreshCw size={15} className={syncing ? 'spin-anim' : ''} style={syncing ? { animation: 'spin 0.7s linear infinite' } : undefined} />
        </button>
      </div>
    </div>
  )
}
