package com.cadence.app.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.cadence.app.CadenceApp
import java.time.LocalDate
import java.time.format.DateTimeFormatter

/**
 * Background worker that syncs pending offline actions to the server.
 * Survives process death via WorkManager (OFF-1).
 */
class SyncWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val app = CadenceApp.instance
        val todayKey = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)

        // Sync pending actions
        val syncResult = app.syncManager.syncPendingActions()

        // Refresh today's tasks
        app.syncManager.refreshToday(todayKey)

        return if (syncResult.conflicts > 0) {
            Result.retry()
        } else {
            Result.success()
        }
    }
}
