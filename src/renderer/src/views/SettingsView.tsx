import { Moon, Sun, Wand2, RefreshCw } from 'lucide-react'
import { useStore } from '../store'
import GoogleSetup from '../components/GoogleSetup'
import { formatRelative } from '../lib/format'

export default function SettingsView(): JSX.Element {
  const { settings, accounts, lastSyncAt, syncing, setTheme, syncQuotas } = useStore()

  function reopenWizard(): void {
    // Réaffiche l'assistant : il apparaît tant qu'il reste des étapes à faire.
    useStore.setState({ onboardingDismissed: false })
  }

  return (
    <div className="view-scroll">
      <div className="page-header">
        <span className="page-header-title">Réglages</span>
      </div>

      <div className="view-pad col" style={{ gap: 24, maxWidth: 660 }}>
        {/* Assistant */}
        <div className="card col" style={{ gap: 12 }}>
          <span className="section-label" style={{ marginBottom: 0 }}>
            Prise en main
          </span>
          <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
            L'assistant te guide pas à pas : identifiants Google, ajout d'un compte, rôles.
          </p>
          <button className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={reopenWizard}>
            <Wand2 size={14} /> Ouvrir l'assistant de configuration
          </button>
        </div>

        {/* Thème */}
        <div className="card col" style={{ gap: 12 }}>
          <span className="section-label" style={{ marginBottom: 0 }}>
            Apparence
          </span>
          <div className="row" style={{ gap: 8 }}>
            <button
              className={`btn ${settings.theme !== 'light' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTheme('dark')}
            >
              <Moon size={14} /> Sombre
            </button>
            <button
              className={`btn ${settings.theme === 'light' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTheme('light')}
            >
              <Sun size={14} /> Clair
            </button>
          </div>
        </div>

        {/* Synchronisation */}
        <div className="card col" style={{ gap: 12 }}>
          <span className="section-label" style={{ marginBottom: 0 }}>
            Synchronisation
          </span>
          <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
            Les quotas et les fichiers de chaque compte sont rafraîchis automatiquement au
            démarrage, toutes les 2 minutes, et au retour sur la fenêtre. Dernière synchro :{' '}
            <b>{accounts.length ? formatRelative(lastSyncAt) : 'aucun compte'}</b>.
          </p>
          <button
            className="btn btn-secondary"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => syncQuotas()}
            disabled={syncing || accounts.length === 0}
          >
            <RefreshCw size={14} style={syncing ? { animation: 'spin 0.7s linear infinite' } : undefined} />
            Synchroniser maintenant
          </button>
        </div>

        {/* Google OAuth */}
        <div className="card col" style={{ gap: 12 }}>
          <span className="section-label" style={{ marginBottom: 0 }}>
            Identifiants Google OAuth
          </span>
          <GoogleSetup />
        </div>

        <p className="muted" style={{ fontSize: 12 }}>
          Drive Backup Manager · 100 % local · aucun serveur cloud.
        </p>
      </div>
    </div>
  )
}
