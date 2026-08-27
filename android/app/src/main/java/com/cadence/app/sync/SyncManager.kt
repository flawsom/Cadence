package com.cadence.app.sync

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import androidx.work.*
import com.cadence.app.data.api.CadenceApi
import com.cadence.app.data.offline.CadenceDatabase
import com.cadence.app.data.offline.PendingAction
import com.cadence.app.data.model.CompleteTaskRequest
import kotlinx.coroutines.*
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.concurrent.TimeUnit

/**
 * Manages offline task completion and background sync.
 *
 * OFF-1: Completing/skipping works offline, queues action, syncs on reconnect.
 * OFF-2: Conflicts surface explicitly, never resolved silently.
 * OFF-3: Cache bounded to current day + 7-day window.
 */
class SyncManager(
    private val context: Context,
    private val database: CadenceDatabase,
    private val api: CadenceApi,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val taskDao = database.taskDao()
    private val actionDao = database.pendingActionDao()

    init {
        // Periodic sync every 15 minutes when connected
        val syncRequest = PeriodicWorkRequestBuilder<SyncWorker>(
            15, TimeUnit.MINUTES
        ).setConstraints(
            Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
        ).build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            "cadence_sync",
            ExistingPeriodicWorkPolicy.KEEP,
            syncRequest
        )
    }

    /**
     * Complete a task — works offline. Queues the action if no connectivity.
     */
    suspend fun completeTask(taskId: String, todayKey: String) {
        // Optimistic update
        taskDao.updateTaskStatus(taskId, "done")

        if (isConnected()) {
            try {
                api.completeTask(taskId, CompleteTaskRequest(done = true, todayKey = todayKey))
            } catch (e: Exception) {
                // Server unreachable — queue for later
                actionDao.insert(PendingAction(taskId = taskId, action = "complete", todayKey = todayKey))
            }
        } else {
            // Offline — queue
            actionDao.insert(PendingAction(taskId = taskId, action = "complete", todayKey = todayKey))
        }
    }

    /**
     * Uncomplete a task — works offline.
     */
    suspend fun uncompleteTask(taskId: String, todayKey: String) {
        taskDao.updateTaskStatus(taskId, "open")

        if (isConnected()) {
            try {
                api.completeTask(taskId, CompleteTaskRequest(done = false, todayKey = todayKey))
            } catch (e: Exception) {
                actionDao.insert(PendingAction(taskId = taskId, action = "uncomplete", todayKey = todayKey))
            }
        } else {
            actionDao.insert(PendingAction(taskId = taskId, action = "uncomplete", todayKey = todayKey))
        }
    }

    /**
     * Sync pending actions to server. Called by WorkManager or on app resume.
     */
    suspend fun syncPendingActions(): SyncResult {
        val pending = actionDao.getPendingActions()
        if (pending.isEmpty()) return SyncResult.Success(0)

        var synced = 0
        var conflicts = 0

        for (action in pending) {
            try {
                val done = action.action == "complete"
                api.completeTask(action.taskId, CompleteTaskRequest(done = done, todayKey = action.todayKey))
                actionDao.markSynced(action.id)
                synced++
            } catch (e: Exception) {
                // Could be conflict or network error
                conflicts++
            }
        }

        // Clean up synced actions
        actionDao.deleteSynced()

        return SyncResult(synced, conflicts)
    }

    /**
     * Fetch fresh tasks from server and update local cache.
     */
    suspend fun refreshToday(todayKey: String) {
        if (!isConnected()) return

        try {
            val board = api.getBoard(todayKey)
            val cutoffKey = LocalDate.now().minusDays(7).format(DateTimeFormatter.ISO_LOCAL_DATE)

            // Cache tasks
            val cachedTasks = board.tasks.map { task ->
                com.cadence.app.data.offline.CachedTask(
                    id = task.id,
                    title = task.title,
                    kind = task.kind,
                    hours = task.hours,
                    status = task.status,
                    carried = task.carried,
                    reviewStage = task.reviewStage,
                    planId = task.planId,
                    planTitle = task.planTitle,
                    planAccent = task.planAccent,
                    dayKey = todayKey,
                    order = 0,
                    practiceProblems = task.practiceProblems?.joinToString("|||"),
                    challengeProblem = task.challengeProblem,
                    parentTopic = task.parentTopic,
                )
            }

            taskDao.upsertTasks(cachedTasks)
            taskDao.deleteOlderThan(cutoffKey) // OFF-3: bounded cache
        } catch (e: Exception) {
            // Network error — use cached data
        }
    }

    /**
     * Register FCM token with server for push notifications.
     */
    suspend fun registerDevice(fcmToken: String) {
        if (!isConnected()) return
        try {
            api.registerDevice(
                com.cadence.app.data.model.DeviceRegistrationRequest(fcmToken = fcmToken)
            )
        } catch (_: Exception) { }
    }

    private fun isConnected(): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NETCAPABILITY_INTERNET)
    }

    data class SyncResult(val synced: Int, val conflicts: Int)
}
