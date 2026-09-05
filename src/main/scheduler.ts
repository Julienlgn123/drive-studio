import {
  addLog,
  computeNextRun,
  getDueSchedules,
  getAccount,
  updateSchedule
} from './db'
import { runScheduledBackup, isBackupRunning } from './backup'

let timer: NodeJS.Timeout | null = null

/** Vérifie toutes les 60 s si un backup planifié est dû. */
export function startScheduler(): void {
  if (timer) return
  timer = setInterval(tick, 60_000)
  // Premier passage rapide après le démarrage.
  setTimeout(tick, 10_000)
}

export function stopScheduler(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

async function tick(): Promise<void> {
  if (isBackupRunning()) return
  const due = getDueSchedules()
  for (const sched of due) {
    const src = getAccount(sched.sourceAccountId)
    const tgt = getAccount(sched.targetAccountId)
    if (!src || !tgt) {
      // Compte supprimé : on désactive la planification.
      updateSchedule(sched.id, { enabled: false })
      continue
    }

    try {
      const report = await runScheduledBackup(
        sched.sourceAccountId,
        sched.targetAccountId,
        sched.mode
      )
      addLog({
        action: 'backup',
        accountId: sched.targetAccountId,
        status: report.failed > 0 ? 'failed' : 'success',
        label: `planifié : ${src.email} → ${tgt.email} (${report.copied} copié·s)`
      })
    } catch (err) {
      addLog({
        action: 'backup',
        accountId: sched.targetAccountId,
        status: 'failed',
        label: `planifié : ${src.email} → ${tgt.email}`,
        errorDetails: err instanceof Error ? err.message : String(err)
      })
    } finally {
      updateSchedule(sched.id, {
        lastRun: Date.now(),
        nextRun: computeNextRun(sched.frequency, sched.time)
      })
    }
  }
}
