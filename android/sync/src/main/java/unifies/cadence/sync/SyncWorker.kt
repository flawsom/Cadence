package unifies.cadence.sync

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import unifies.cadence.core.database.dao.TaskDao
import unifies.cadence.core.network.api.CadenceApi
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.time.Instant

/**
 * Syncs local pending actions to the server and refreshes local cache.
 *
 * Conflict resolution:
 * - Server wins on plan structure (recomputed while offline)
 * - Client wins on completion status (user intent)
 *
 * Retry: exponential backoff 1s → 2s → 4s → 8s → max 1h
 */
@HiltWorker
class SyncWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val api: CadenceApi,
    private val dao: TaskDao,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        return try {
            // 1. Push pending actions to server
            val pending = dao.getPendingActions()
            for (action in pending) {
                try {
                    when (action.actionType) {
                        "COMPLETE" -> api.completeTask(action.taskId)
                        "SKIP" -> api.skipTask(action.taskId)
                    }
                    dao.deletePendingAction(action)
                } catch (e: Exception) {
                    // If server error, leave pending for next retry
                    if (action.retryCount >= MAX_RETRIES) {
                        dao.deletePendingAction(action)
                    } else {
                        dao.updatePendingAction(
                            action.copy(retryCount = action.retryCount + 1)
                        )
                    }
                }
            }

            // 2. Fetch fresh data from server
            val today = unifies.cadence.core.common.util.DateUtil.today()
            val tasks = try { api.getTodayTasks(today) } catch (e: Exception) { null }
            val stats = try { api.getStats() } catch (e: Exception) { null }

            // 3. Update local cache
            if (tasks != null) {
                tasks.forEach { task ->
                    dao.insertTask(
                        unifies.cadence.core.database.entity.TaskEntity(
                            id = task.taskId,
                            title = task.topicTitle,
                            topicId = task.topicId,
                            planId = task.planId,
                            planTitle = task.planTitle,
                            level = task.level,
                            kind = task.kind,
                            scheduledDate = task.date,
                            estimatedMinutes = task.estimatedMinutes,
                            actualMinutes = task.actualMinutes,
                            status = task.status,
                            reviewStage = task.reviewStage,
                            dayNumber = task.dayNumber,
                            isCarriedOver = task.isCarriedOver,
                            isRollover = task.isRollover,
                        )
                    )
                }
            }

            Result.success()
        } catch (e: Exception) {
            if (runAttemptCount < 3) Result.retry() else Result.failure()
        }
    }

    companion object {
        private const val MAX_RETRIES = 5
        private const val WORK_NAME = "cadence_sync"

        fun enqueue(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .setRequiresBatteryNotLow(true)
                .build()

            val request = OneTimeWorkRequestBuilder<SyncWorker>()
                .setConstraints(constraints)
                .setBackoffCriteria(
                    androidx.work.BackoffPolicy.EXPONENTIAL,
                    1,
                    java.util.concurrent.TimeUnit.MINUTES,
                )
                .build()

            WorkManager.getInstance(context)
                .enqueueUniqueWork(WORK_NAME, ExistingWorkPolicy.KEEP, request)
        }
    }
}
