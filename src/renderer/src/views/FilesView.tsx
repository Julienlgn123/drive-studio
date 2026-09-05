import { useEffect, useMemo, useState } from 'react'
import {
  Search,
  Upload,
  Download,
  Share2,
  Trash2,
  Info,
  FileArchive,
  MoreVertical,
  FolderInput
} from 'lucide-react'
import { useStore } from '../store'
import ContextMenu from '../components/ContextMenu'
import FileInfoModal from '../components/FileInfoModal'
import ShareModal from '../components/ShareModal'
import {
  formatBytes,
  formatRelative,
  accountColor,
  mimeCategory
} from '../lib/format'
import type { FileMeta } from '@shared/types'

interface Props {
  folderId?: string | null
}

export default function FilesView({ folderId }: Props): JSX.Element {
  const { files, accounts, folders, loadFiles, loadFolders, loadDashboard, toast } = useStore()
  const [search, setSearch] = useState('')
  const [accountFilter, setAccountFilter] = useState<string>('')
  const [catFilter, setCatFilter] = useState<string>('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [menu, setMenu] = useState<{ x: number; y: number; file: FileMeta } | null>(null)
  const [infoFile, setInfoFile] = useState<FileMeta | null>(null)
  const [shareFile, setShareFile] = useState<FileMeta | null>(null)

  const folder = folders.find((f) => f.id === folderId)

  useEffect(() => {
    loadFiles()
    setSelected(new Set())
  }, [folderId])

  const rows = useMemo(() => {
    let base = folderId ? files.filter((f) => f.folderIds?.includes(folderId)) : files
    if (accountFilter) base = base.filter((f) => f.accountId === accountFilter)
    if (catFilter) base = base.filter((f) => mimeCategory(f.mimeType) === catFilter)
    const q = search.toLowerCase().trim()
    if (q) base = base.filter((f) => f.originalFilename.toLowerCase().includes(q))
    return base
  }, [files, folderId, accountFilter, catFilter, search])

  function toggle(id: string): void {
    setSelected((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  async function pickUpload(): Promise<void> {
    try {
      const res = await window.api.files.pickAndUpload()
      if (res.length) {
        if (folderId) {
          for (const f of res) await window.api.folders.addFile(folderId, f.id)
        }
        await Promise.all([loadFiles(), loadFolders(), loadDashboard()])
        toast(`${res.length} fichier(s) envoyé(s)`, 'success')
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Échec upload', 'error')
    }
  }

  async function download(f: FileMeta): Promise<void> {
    try {
      const res = await window.api.files.download(f.id)
      if (res) toast(res.verified ? 'Téléchargé · checksum vérifié ✓' : 'Téléchargé', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Échec téléchargement', 'error')
    }
  }

  async function del(f: FileMeta): Promise<void> {
    if (!window.confirm(`Supprimer « ${f.originalFilename} » de Google Drive ? Irréversible.`)) return
    try {
      await window.api.files.delete(f.id)
      await Promise.all([loadFiles(), loadFolders(), loadDashboard()])
      toast('Fichier supprimé', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Échec suppression', 'error')
    }
  }

  async function exportSelected(zip: boolean): Promise<void> {
    const ids = [...selected]
    if (!ids.length) return
    try {
      const res = await window.api.files.export(ids, zip)
      if (res) {
        toast(
          `${res.count} fichier(s) exporté(s)` +
            (res.verified ? ` · ${res.verified} vérifié(s)` : '') +
            (res.failed ? ` · ${res.failed} en échec` : ''),
          res.failed ? 'error' : 'success'
        )
        setSelected(new Set())
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Échec export', 'error')
    }
  }

  async function addToFolder(f: FileMeta, fid: string): Promise<void> {
    await window.api.folders.addFile(fid, f.id)
    await Promise.all([loadFiles(), loadFolders()])
    toast('Ajouté au dossier', 'success')
  }

  return (
    <div className="view-scroll">
      <div className="page-header">
        <div className="page-header-left">
          <span className="page-header-title">
            {folder ? `${folder.emoji} ${folder.name}` : 'Tous les fichiers'}
          </span>
          <span className="muted" style={{ fontSize: 13 }}>
            {rows.length} fichier{rows.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="page-header-right">
          {selected.size > 0 && (
            <>
              <span className="muted" style={{ fontSize: 12 }}>
                {selected.size} sélectionné(s)
              </span>
              <button className="btn btn-sm btn-secondary" onClick={() => exportSelected(false)}>
                <Download size={13} /> Exporter
              </button>
              <button className="btn btn-sm btn-secondary" onClick={() => exportSelected(true)}>
                <FileArchive size={13} /> ZIP
              </button>
            </>
          )}
          <button className="btn btn-primary" onClick={pickUpload}>
            <Upload size={15} /> Ajouter
          </button>
        </div>
      </div>

      <div className="view-pad col" style={{ gap: 14 }}>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <div className="search-bar" style={{ flex: 1, minWidth: 220 }}>
            <Search size={14} style={{ color: 'var(--text-tertiary)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un fichier…"
            />
          </div>
          <select
            className="field-input"
            style={{ width: 'auto' }}
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
          >
            <option value="">Tous les comptes</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.email}
              </option>
            ))}
          </select>
          <select
            className="field-input"
            style={{ width: 'auto' }}
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
          >
            <option value="">Tous les types</option>
            <option value="image">Images</option>
            <option value="video">Vidéos</option>
            <option value="audio">Audio</option>
            <option value="document">Documents</option>
            <option value="archive">Archives</option>
            <option value="autre">Autre</option>
          </select>
        </div>

        {rows.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📄</div>
            <div className="empty-state-title">Aucun fichier</div>
            <div className="empty-state-desc">
              Glisse-dépose des fichiers dans la fenêtre ou clique sur « Ajouter ». L'app choisit
              automatiquement le compte principal le plus libre.
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th style={{ width: 32 }}></th>
                  <th>Nom</th>
                  <th style={{ width: 90 }}>Taille</th>
                  <th style={{ width: 110 }}>Type</th>
                  <th style={{ width: 190 }}>Compte</th>
                  <th style={{ width: 130 }}>Ajouté</th>
                  <th style={{ width: 90 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((f) => {
                  const accIndex = accounts.findIndex((a) => a.id === f.accountId)
                  const acc = accounts[accIndex]
                  return (
                    <tr
                      key={f.id}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        setMenu({ x: e.clientX, y: e.clientY, file: f })
                      }}
                    >
                      <td>
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={selected.has(f.id)}
                          onChange={() => toggle(f.id)}
                        />
                      </td>
                      <td>
                        <div className="cell-name">
                          <span>{f.originalFilename}</span>
                          {f.replicatedOn.length > 0 && (
                            <span
                              className="badge"
                              style={{ background: 'var(--success-dim)', color: 'var(--success)' }}
                              title={`Répliqué sur ${f.replicatedOn.length} compte(s)`}
                            >
                              ×{f.replicatedOn.length + 1}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{formatBytes(f.fileSize)}</td>
                      <td style={{ textTransform: 'capitalize' }}>{mimeCategory(f.mimeType)}</td>
                      <td>
                        <span className="account-tag">
                          <span
                            className="dot"
                            style={{ background: accountColor(accIndex < 0 ? 0 : accIndex) }}
                          />
                          {acc?.email.split('@')[0] ?? '—'}
                        </span>
                      </td>
                      <td>{formatRelative(f.uploadedAt)}</td>
                      <td>
                        <div className="cell-actions">
                          <button className="icon-btn" onClick={() => download(f)} data-tooltip="Télécharger">
                            <Download size={14} />
                          </button>
                          <button
                            className="icon-btn"
                            onClick={(e) => {
                              const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                              setMenu({ x: r.left, y: r.bottom, file: f })
                            }}
                          >
                            <MoreVertical size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: 'Détails', icon: <Info size={14} />, onClick: () => setInfoFile(menu.file) },
            {
              label: 'Télécharger',
              icon: <Download size={14} />,
              onClick: () => download(menu.file)
            },
            { label: 'Partager', icon: <Share2 size={14} />, onClick: () => setShareFile(menu.file) },
            ...folders.map((fld) => ({
              label: `Ajouter à ${fld.emoji} ${fld.name}`,
              icon: <FolderInput size={14} />,
              onClick: () => addToFolder(menu.file, fld.id)
            })),
            {
              label: 'Supprimer',
              icon: <Trash2 size={14} />,
              danger: true,
              onClick: () => del(menu.file)
            }
          ]}
        />
      )}

      {infoFile && <FileInfoModal file={infoFile} onClose={() => setInfoFile(null)} />}
      {shareFile && <ShareModal file={shareFile} onClose={() => setShareFile(null)} />}
    </div>
  )
}
