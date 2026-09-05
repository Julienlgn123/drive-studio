import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  Account,
  AccountRole,
  AppSettings,
  BackupJob,
  BackupMode,
  BackupProgress,
  DashboardStats,
  DriveRevision,
  FileMeta,
  RecentActivity,
  ScheduleFrequency,
  ShareRole,
  SharedLink,
  SyncLog,
  TransferProgress,
  VirtualFolder,
  BackupSchedule
} from '../shared/types'

type FileFilters = {
  accountId?: string
  folderId?: string
  search?: string
  mimePrefix?: string
}

function on<T>(channel: string, cb: (payload: T) => void): () => void {
  const handler = (_: unknown, payload: T): void => cb(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api = {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close')
  },
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    setTheme: (theme: 'dark' | 'light'): Promise<AppSettings> =>
      ipcRenderer.invoke('settings:setTheme', theme),
    setGoogle: (clientId: string, clientSecret: string): Promise<AppSettings> =>
      ipcRenderer.invoke('settings:setGoogle', { clientId, clientSecret }),
    clearGoogle: (): Promise<AppSettings> => ipcRenderer.invoke('settings:clearGoogle'),
    hasGoogle: (): Promise<boolean> => ipcRenderer.invoke('settings:hasGoogle')
  },
  accounts: {
    list: (): Promise<Account[]> => ipcRenderer.invoke('accounts:list'),
    get: (id: string): Promise<Account | null> => ipcRenderer.invoke('accounts:get', id),
    add: (): Promise<Account> => ipcRenderer.invoke('accounts:add'),
    remove: (id: string): Promise<void> => ipcRenderer.invoke('accounts:remove', id),
    setRole: (id: string, role: AccountRole): Promise<Account> =>
      ipcRenderer.invoke('accounts:setRole', id, role),
    sync: (id: string): Promise<Account> => ipcRenderer.invoke('accounts:sync', id),
    syncAll: (): Promise<Account[]> => ipcRenderer.invoke('accounts:syncAll'),
    importFiles: (id: string): Promise<number> => ipcRenderer.invoke('accounts:importFiles', id)
  },
  files: {
    list: (filters?: FileFilters): Promise<FileMeta[]> =>
      ipcRenderer.invoke('files:list', filters),
    get: (id: string): Promise<FileMeta | null> => ipcRenderer.invoke('files:get', id),
    pickAndUpload: (): Promise<FileMeta[]> => ipcRenderer.invoke('files:pickAndUpload'),
    uploadPaths: (paths: string[]): Promise<FileMeta[]> =>
      ipcRenderer.invoke('files:uploadPaths', paths),
    download: (id: string): Promise<{ path: string; verified: boolean } | null> =>
      ipcRenderer.invoke('files:download', id),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('files:delete', id),
    export: (
      ids: string[],
      zip: boolean
    ): Promise<{ path: string; count: number; verified: number; failed: number } | null> =>
      ipcRenderer.invoke('files:export', ids, zip),
    revisions: (id: string): Promise<DriveRevision[]> =>
      ipcRenderer.invoke('files:revisions', id),
    // Résout le chemin réel d'un File droppé sur la fenêtre
    pathForFile: (file: File): string => webUtils.getPathForFile(file)
  },
  share: {
    create: (id: string, role: ShareRole): Promise<string> =>
      ipcRenderer.invoke('share:create', id, role),
    revoke: (id: string): Promise<void> => ipcRenderer.invoke('share:revoke', id),
    list: (): Promise<SharedLink[]> => ipcRenderer.invoke('share:list'),
    forFile: (id: string): Promise<SharedLink | null> => ipcRenderer.invoke('share:forFile', id)
  },
  folders: {
    list: (): Promise<VirtualFolder[]> => ipcRenderer.invoke('folders:list'),
    create: (data: { name: string; emoji: string; color: string }): Promise<VirtualFolder> =>
      ipcRenderer.invoke('folders:create', data),
    update: (
      id: string,
      data: Partial<{ name: string; emoji: string; color: string }>
    ): Promise<boolean> => ipcRenderer.invoke('folders:update', id, data),
    delete: (id: string): Promise<boolean> => ipcRenderer.invoke('folders:delete', id),
    addFile: (folderId: string, fileId: string): Promise<boolean> =>
      ipcRenderer.invoke('folders:addFile', folderId, fileId),
    removeFile: (folderId: string, fileId: string): Promise<boolean> =>
      ipcRenderer.invoke('folders:removeFile', folderId, fileId)
  },
  backup: {
    start: (config: {
      sourceAccountIds: string[]
      targetAccountIds: string[]
      mode: BackupMode
      verify: boolean
    }): Promise<{
      jobIds: string[]
      copied: number
      skipped: number
      failed: number
      errors: { file: string; reason: string }[]
      durationMs: number
    }> => ipcRenderer.invoke('backup:start', config),
    running: (): Promise<boolean> => ipcRenderer.invoke('backup:running'),
    jobs: (): Promise<BackupJob[]> => ipcRenderer.invoke('backup:jobs'),
    job: (id: string): Promise<BackupJob | null> => ipcRenderer.invoke('backup:job', id),
    onProgress: (cb: (p: BackupProgress) => void) => on<BackupProgress>('backup:progress', cb)
  },
  schedules: {
    list: (): Promise<BackupSchedule[]> => ipcRenderer.invoke('schedules:list'),
    create: (data: {
      sourceAccountId: string
      targetAccountId: string
      frequency: ScheduleFrequency
      time: string
      mode: BackupMode
    }): Promise<BackupSchedule> => ipcRenderer.invoke('schedules:create', data),
    update: (
      id: string,
      data: Partial<{
        frequency: ScheduleFrequency
        time: string
        mode: BackupMode
        enabled: boolean
      }>
    ): Promise<boolean> => ipcRenderer.invoke('schedules:update', id, data),
    delete: (id: string): Promise<boolean> => ipcRenderer.invoke('schedules:delete', id)
  },
  logs: {
    list: (filters?: {
      action?: SyncLog['action']
      accountId?: string
      status?: SyncLog['status']
      limit?: number
    }): Promise<SyncLog[]> => ipcRenderer.invoke('logs:list', filters),
    clearOlderThan: (days: number): Promise<number> =>
      ipcRenderer.invoke('logs:clearOlderThan', days)
  },
  dashboard: {
    stats: (): Promise<DashboardStats> => ipcRenderer.invoke('dashboard:stats'),
    recent: (): Promise<RecentActivity[]> => ipcRenderer.invoke('dashboard:recent')
  },
  transfers: {
    onProgress: (cb: (p: TransferProgress) => void) =>
      on<TransferProgress>('transfer:progress', cb)
  },
  shell: {
    openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:openExternal', url)
  },
  clipboard: {
    write: (text: string): Promise<void> => ipcRenderer.invoke('clipboard:write', text)
  },
  app: {
    notifyReady: () => ipcRenderer.send('renderer:ready')
  }
}

contextBridge.exposeInMainWorld('api', api)
export type Api = typeof api
