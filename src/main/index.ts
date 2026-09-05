import { app, BrowserWindow, shell, ipcMain, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import { initDb } from './db'
import { registerIpc } from './ipc'
import { startScheduler, stopScheduler } from './scheduler'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0d0d0f',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  if (is.dev) {
    // Remonte les logs du renderer dans le terminal pendant le dev.
    // Electron 35 : nouvel objet d'événement { message, level, lineNumber, sourceId }.
    mainWindow.webContents.on(
      'console-message',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (e: any, level?: unknown, message?: unknown, line?: unknown, source?: unknown) => {
        const msg = e && typeof e === 'object' && 'message' in e ? e.message : message
        const src = e && typeof e === 'object' && 'sourceId' in e ? e.sourceId : source
        const ln = e && typeof e === 'object' && 'lineNumber' in e ? e.lineNumber : line
        // eslint-disable-next-line no-console
        console.log(`[renderer] ${msg} (${src}:${ln})`)
        void level
      }
    )
  }
  mainWindow.on('closed', () => {
    mainWindow = null
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.gdrive-backup-manager')
  app.on('browser-window-created', (_, w) => optimizer.watchWindowShortcuts(w))

  // CSP : appliqué au chargement en production (fichier local). En dev, Vite
  // injecte des scripts inline pour le HMR, donc on garde une politique permissive.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const csp = is.dev
      ? "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: ws://localhost:* http://localhost:*; " +
        'style-src \'self\' \'unsafe-inline\' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:'
      : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'"
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp]
      }
    })
  })

  initDb()
  registerIpc()
  createWindow()
  startScheduler()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  if (app.isPackaged) {
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true
    let checked = false
    ipcMain.on('renderer:ready', () => {
      if (checked) return
      checked = true
      autoUpdater.checkForUpdates().catch(() => null)
    })
    setTimeout(() => {
      if (!checked) {
        checked = true
        autoUpdater.checkForUpdates().catch(() => null)
      }
    }, 8000)
  }
})

app.on('window-all-closed', () => {
  stopScheduler()
  if (process.platform !== 'darwin') app.quit()
})
