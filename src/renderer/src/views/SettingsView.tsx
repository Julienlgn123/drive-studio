import { useState } from 'react'
import { Moon, Sun, Check, ExternalLink, KeyRound } from 'lucide-react'
import { useStore } from '../store'

export default function SettingsView(): JSX.Element {
  const { settings, setTheme, loadSettings, loadAll, toast } = useStore()
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [busy, setBusy] = useState(false)

  async function saveGoogle(): Promise<void> {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast('Renseigne le Client ID et le Client Secret', 'error')
      return
    }
    setBusy(true)
    try {
      await window.api.settings.setGoogle(clientId.trim(), clientSecret.trim())
      setClientId('')
      setClientSecret('')
      await Promise.all([loadSettings(), loadAll()])
      toast('Identifiants Google enregistrés (chiffrés)', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function clearGoogle(): Promise<void> {
    await window.api.settings.clearGoogle()
    await loadSettings()
    toast('Identifiants supprimés', 'success')
  }

  return (
    <div className="view-scroll">
      <div className="page-header">
        <span className="page-header-title">Réglages</span>
      </div>

      <div className="view-pad col" style={{ gap: 24, maxWidth: 640 }}>
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

        {/* Google OAuth */}
        <div className="card col" style={{ gap: 12 }}>
          <div className="spread">
            <span className="section-label" style={{ marginBottom: 0 }}>
              Identifiants Google OAuth
            </span>
            {settings.googleConfigured && (
              <span className="status-pill active">
                <Check size={12} /> configuré
              </span>
            )}
          </div>

          <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
            L'application utilise <b>tes propres</b> identifiants OAuth (type « Application de
            bureau »). Ils sont stockés chiffrés localement via le trousseau du système et ne
            quittent jamais ta machine.
          </p>

          <ol className="muted" style={{ fontSize: 12.5, lineHeight: 1.7, paddingLeft: 18 }}>
            <li>
              Ouvre{' '}
              <a onClick={() => window.api.shell.openExternal('https://console.cloud.google.com/')}>
                Google Cloud Console <ExternalLink size={11} style={{ display: 'inline' }} />
              </a>{' '}
              et crée un projet.
            </li>
            <li>APIs &amp; Services → Bibliothèque → active « Google Drive API ».</li>
            <li>
              Écran de consentement OAuth : type « Externe », ajoute ton adresse comme
              utilisateur de test, scopes Drive + userinfo.
            </li>
            <li>
              Identifiants → Créer → ID client OAuth → type <b>Application de bureau</b>.
            </li>
            <li>Copie le Client ID et le Client Secret ci-dessous.</li>
          </ol>

          {settings.googleConfigured ? (
            <button className="btn btn-danger" onClick={clearGoogle}>
              Supprimer les identifiants
            </button>
          ) : (
            <>
              <div className="field">
                <label className="field-label">Client ID</label>
                <input
                  className="field-input mono"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="xxxxx.apps.googleusercontent.com"
                />
              </div>
              <div className="field">
                <label className="field-label">Client Secret</label>
                <input
                  className="field-input mono"
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="GOCSPX-…"
                />
              </div>
              <button className="btn btn-primary" onClick={saveGoogle} disabled={busy}>
                <KeyRound size={14} /> Enregistrer
              </button>
            </>
          )}
        </div>

        <p className="muted" style={{ fontSize: 12 }}>
          Drive Backup Manager · 100 % local · aucun serveur cloud.
        </p>
      </div>
    </div>
  )
}
