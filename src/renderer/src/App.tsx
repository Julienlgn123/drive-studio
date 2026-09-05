import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from './store'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import ToastStack from './components/Toast'
import TransfersPanel from './components/TransfersPanel'
import DashboardView from './views/DashboardView'
import FilesView from './views/FilesView'
import AccountsView from './views/AccountsView'
import BackupView from './views/BackupView'
import LogsView from './views/LogsView'
import SettingsView from './views/SettingsView'
import SharedView from './views/SharedView'

export default function App(): JSX.Element {
  const { view, activeFolderId, loadAll, loadFiles, loadFolders, loadDashboard, pushTransfer, toast } =
    useStore()
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    loadAll()
    window.api.app.notifyReady()
    const off = window.api.transfers.onProgress((t) => {
      pushTransfer(t)
      if (t.status === 'done' && t.kind === 'upload') {
        loadFiles()
        loadFolders()
        loadDashboard()
      }
    })
    return off
  }, [])

  // Drag & drop de fichiers n'importe où dans la fenêtre → upload
  useEffect(() => {
    let depth = 0
    function onDragEnter(e: DragEvent): void {
      e.preventDefault()
      if (e.dataTransfer?.types.includes('Files')) {
        depth++
        setDragging(true)
      }
    }
    function onDragOver(e: DragEvent): void {
      e.preventDefault()
    }
    function onDragLeave(e: DragEvent): void {
      e.preventDefault()
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    async function onDrop(e: DragEvent): Promise<void> {
      e.preventDefault()
      depth = 0
      setDragging(false)
      const files = Array.from(e.dataTransfer?.files ?? [])
      if (files.length === 0) return
      const paths = files.map((f) => window.api.files.pathForFile(f)).filter(Boolean)
      if (paths.length === 0) return
      try {
        const res = await window.api.files.uploadPaths(paths)
        const folderId = useStore.getState().activeFolderId
        if (folderId && useStore.getState().view === 'folder') {
          for (const r of res) await window.api.folders.addFile(folderId, r.id)
        }
        await Promise.all([loadFiles(), loadFolders(), loadDashboard()])
        toast(`${res.length} fichier(s) envoyé(s)`, 'success')
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Échec upload', 'error')
      }
    }
    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  return (
    <div className="app">
      <TitleBar />
      <div className="app-body">
        <Sidebar />
        <main className="main">
          <AnimatePresence mode="wait">
            <motion.div
              key={view + (activeFolderId ?? '')}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {view === 'dashboard' && <DashboardView />}
              {view === 'files' && <FilesView />}
              {view === 'folder' && <FilesView folderId={activeFolderId} />}
              {view === 'accounts' && <AccountsView />}
              {view === 'backup' && <BackupView />}
              {view === 'shared' && <SharedView />}
              {view === 'logs' && <LogsView />}
              {view === 'settings' && <SettingsView />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {dragging && <div className="dropzone-overlay">Déposez pour envoyer vers Drive</div>}
      <TransfersPanel />
      <ToastStack />
    </div>
  )
}
