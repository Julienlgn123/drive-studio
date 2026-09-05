import {
  addLog,
  createAccount,
  createFileMeta,
  deleteAccount,
  findFileByChecksum,
  getAccount,
  getAccountByEmail,
  getAccounts,
  getFiles,
  updateAccount
} from '../db'
import { getQuota, listFiles } from './drive'
import { revokeAccount, runOAuthFlow } from './oauth'
import type { Account, AccountRole } from '@shared/types'

/** Lance le flow OAuth et enregistre le compte (ou met à jour s'il existe déjà). */
export async function addAccount(): Promise<Account> {
  const { tokens, email } = await runOAuthFlow()

  const existing = getAccountByEmail(email)
  if (existing) {
    // Recolle simplement les nouveaux tokens + quota.
    const q = await getQuota(existing.id).catch(() => null)
    updateAccount(existing.id, {
      status: 'active',
      quotaTotal: q?.total ?? existing.quotaTotal,
      quotaUsed: q?.used ?? existing.quotaUsed,
      lastSync: Date.now()
    })
    addLog({ action: 'account_add', accountId: existing.id, status: 'success', label: email })
    return getAccount(existing.id)!
  }

  const tmp = createAccount({
    email,
    tokens,
    quotaTotal: 0,
    quotaUsed: 0,
    role: getAccounts().length === 0 ? 'primary' : 'primary'
  })

  try {
    const q = await getQuota(tmp.id)
    updateAccount(tmp.id, {
      quotaTotal: q.total,
      quotaUsed: q.used,
      lastSync: Date.now()
    })
  } catch (err) {
    updateAccount(tmp.id, { status: 'error' })
    addLog({
      action: 'account_add',
      accountId: tmp.id,
      status: 'failed',
      label: email,
      errorDetails: err instanceof Error ? err.message : String(err)
    })
    return getAccount(tmp.id)!
  }

  addLog({ action: 'account_add', accountId: tmp.id, status: 'success', label: email })
  return getAccount(tmp.id)!
}

export async function removeAccount(accountId: string): Promise<void> {
  const acc = getAccount(accountId)
  await revokeAccount(accountId)
  deleteAccount(accountId)
  addLog({
    action: 'account_remove',
    accountId: null,
    status: 'success',
    label: acc?.email ?? accountId
  })
}

export function setAccountRole(accountId: string, role: AccountRole): Account {
  updateAccount(accountId, { role })
  return getAccount(accountId)!
}

/** Rafraîchit le quota d'un compte depuis Drive. */
export async function syncAccountQuota(accountId: string): Promise<Account> {
  updateAccount(accountId, { status: 'active' })
  try {
    const q = await getQuota(accountId)
    updateAccount(accountId, {
      quotaTotal: q.total,
      quotaUsed: q.used,
      lastSync: Date.now(),
      status: 'active'
    })
  } catch (err) {
    updateAccount(accountId, { status: 'error' })
    addLog({
      action: 'backup',
      accountId,
      status: 'failed',
      label: 'sync quota',
      errorDetails: err instanceof Error ? err.message : String(err)
    })
    throw err
  }
  return getAccount(accountId)!
}

export async function syncAllQuotas(): Promise<Account[]> {
  for (const acc of getAccounts()) {
    await syncAccountQuota(acc.id).catch(() => null)
  }
  return getAccounts()
}

/**
 * Importe la liste des fichiers déjà présents sur le Drive d'un compte
 * dans files_metadata (utile quand on relie un compte qui contient déjà des données).
 */
export async function importExistingFiles(accountId: string): Promise<number> {
  const remote = await listFiles(accountId)
  const known = new Set(getFiles({ accountId }).map((f) => f.driveFileId))
  let added = 0
  for (const rf of remote) {
    if (known.has(rf.id)) continue
    const checksum = rf.md5Checksum || ''
    // Évite les doublons stricts inter-comptes basés sur le md5.
    if (checksum && findFileByChecksum(checksum)) {
      // On enregistre quand même l'entrée pour ce compte (fichier réellement présent).
    }
    createFileMeta({
      driveFileId: rf.id,
      accountId,
      originalFilename: rf.name,
      fileSize: rf.size,
      mimeType: rf.mimeType,
      checksum
    })
    added++
  }
  addLog({
    action: 'backup',
    accountId,
    status: 'success',
    label: `import : ${added} fichier(s)`
  })
  return added
}
