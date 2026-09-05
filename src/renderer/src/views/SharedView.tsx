import { useEffect, useState } from 'react'
import { Copy, ExternalLink, Trash2, Link2 } from 'lucide-react'
import { useStore } from '../store'
import { formatDate } from '../lib/format'
import type { FileMeta, SharedLink } from '@shared/types'

export default function SharedView(): JSX.Element {
  const { files, loadFiles, toast } = useStore()
  const [links, setLinks] = useState<SharedLink[]>([])

  function refresh(): void {
    window.api.share.list().then(setLinks)
  }
  useEffect(() => {
    refresh()
    loadFiles()
  }, [])

  const fileOf = (id: string): FileMeta | undefined => files.find((f) => f.id === id)

  async function revoke(fileId: string): Promise<void> {
    await window.api.share.revoke(fileId)
    refresh()
    toast('Partage révoqué', 'success')
  }

  return (
    <div className="view-scroll">
      <div className="page-header">
        <span className="page-header-title">Fichiers partagés</span>
        <span className="muted" style={{ fontSize: 13 }}>
          {links.length} lien{links.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="view-pad">
        {links.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🔗</div>
            <div className="empty-state-title">Aucun lien de partage</div>
            <div className="empty-state-desc">
              Depuis Fichiers, clic droit sur un fichier → Partager pour générer un lien public.
            </div>
          </div>
        ) : (
          <div className="col" style={{ gap: 8 }}>
            {links.map((l) => {
              const f = fileOf(l.fileId)
              return (
                <div key={l.id} className="card row" style={{ gap: 12, alignItems: 'center' }}>
                  <Link2 size={16} style={{ color: 'var(--accent-light)', flexShrink: 0 }} />
                  <div className="col" style={{ gap: 2, flex: 1, minWidth: 0 }}>
                    <span style={{ color: 'var(--text-primary)', fontSize: 13 }}>
                      {f?.originalFilename ?? l.fileId}
                    </span>
                    <span className="muted mono" style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.url}
                    </span>
                    <span className="muted" style={{ fontSize: 11 }}>
                      {l.role} · créé le {formatDate(l.createdAt)}
                    </span>
                  </div>
                  <button
                    className="icon-btn"
                    onClick={() => {
                      window.api.clipboard.write(l.url)
                      toast('Lien copié', 'success')
                    }}
                    data-tooltip="Copier"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => window.api.shell.openExternal(l.url)}
                    data-tooltip="Ouvrir"
                  >
                    <ExternalLink size={14} />
                  </button>
                  <button className="icon-btn danger" onClick={() => revoke(l.fileId)} data-tooltip="Révoquer">
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
