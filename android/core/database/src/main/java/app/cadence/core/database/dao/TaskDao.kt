package app.cadence.core.database.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Update
import app.cadence.core.database.entity.AnswerHistoryEntity
import app.cadence.core.database.entity.PendingActionEntity
import app.cadence.core.database.entity.PlanEntity
import app.cadence.core.database.entity.PodDigestEntity
import app.cadence.core.database.entity.TaskEntity
import app.cadence.core.database.entity.TopicEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface TaskDao {

    // ── Tasks ──────────────────────────────────────────────────────────

    @Query("SELECT * FROM tasks WHERE scheduledDate = :date ORDER BY dayNumber, estimatedMinutes")
    fun getTasksForDate(date: String): Flow<List<TaskEntity>>

    @Query("SELECT * FROM tasks WHERE status = 'pending' AND scheduledDate <= :date ORDER BY scheduledDate")
    fun getOverdueTasks(date: String): Flow<List<TaskEntity>>

    @Query("SELECT * FROM tasks WHERE kind = 'review' AND status = 'pending' AND scheduledDate = :date")
    fun getReviewsDueToday(date: String): Flow<List<TaskEntity>>

    @Query("SELECT * FROM tasks WHERE id = :id")
    suspend fun getTask(id: String): TaskEntity?

    @Query("SELECT * FROM tasks WHERE id = :id")
    fun observeTask(id: String): Flow<TaskEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTask(task: TaskEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTasks(tasks: List<TaskEntity>)

    @Update
    suspend fun updateTask(task: TaskEntity)

    @Query("UPDATE tasks SET status = :status, actualMinutes = :actualMinutes, serverUpdatedAt = :updatedAt WHERE id = :id")
    suspend fun updateTaskStatus(id: String, status: String, actualMinutes: Int?, updatedAt: Long)

    @Delete
    suspend fun deleteTask(task: TaskEntity)

    @Query("DELETE FROM tasks WHERE planId = :planId")
    suspend fun deleteTasksForPlan(planId: String)

    // ── Plans ──────────────────────────────────────────────────────────

    @Query("SELECT * FROM plans ORDER BY createdAt DESC")
    fun getPlans(): Flow<List<PlanEntity>>

    @Query("SELECT * FROM plans WHERE id = :id")
    suspend fun getPlan(id: String): PlanEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPlan(plan: PlanEntity)

    @Delete
    suspend fun deletePlan(plan: PlanEntity)

    @Query("SELECT COUNT(*) FROM plans")
    suspend fun getPlanCount(): Int

    // ── Topics ─────────────────────────────────────────────────────────

    @Query("SELECT * FROM topics WHERE planId = :planId ORDER BY `order`")
    fun getTopicsForPlan(planId: String): Flow<List<TopicEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTopics(topics: List<TopicEntity>)

    // ── Pending Actions (Offline queue) ────────────────────────────────

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPendingAction(action: PendingActionEntity)

    @Query("SELECT * FROM pending_actions ORDER BY createdAt")
    suspend fun getPendingActions(): List<PendingActionEntity>

    @Query("SELECT * FROM pending_actions WHERE id = :id")
    suspend fun getPendingAction(id: String): PendingActionEntity?

    @Update
    suspend fun updatePendingAction(action: PendingActionEntity)

    @Delete
    suspend fun deletePendingAction(action: PendingActionEntity)

    @Query("DELETE FROM pending_actions WHERE id IN (:ids)")
    suspend fun deletePendingActions(ids: List<String>)

    // ── Answer History ─────────────────────────────────────────────────

    @Query("SELECT * FROM answer_history ORDER BY submittedAt DESC LIMIT :limit")
    fun getAnswerHistory(limit: Int = 50): Flow<List<AnswerHistoryEntity>>

    @Query("SELECT * FROM answer_history WHERE topicTitle LIKE '%' || :topicTitle || '%' ORDER BY submittedAt DESC")
    fun getAnswerHistoryForTopic(topicTitle: String): Flow<List<AnswerHistoryEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAnswerHistory(entry: AnswerHistoryEntity)

    // ── Pod Digests ────────────────────────────────────────────────────

    @Query("SELECT * FROM pod_digests WHERE podId = :podId ORDER BY digestDate DESC LIMIT 1")
    fun getLatestDigest(podId: String): Flow<PodDigestEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDigest(digest: PodDigestEntity)

    // ── Stats ──────────────────────────────────────────────────────────

    @Query("SELECT COUNT(*) FROM tasks WHERE status = 'completed' AND scheduledDate = :date")
    suspend fun getCompletedCountForDate(date: String): Int

    @Query("SELECT SUM(actualMinutes) FROM tasks WHERE status = 'completed'")
    suspend fun getTotalMinutesStudied(): Int?

    @Query("SELECT COUNT(*) FROM tasks WHERE status = 'completed'")
    suspend fun getTotalTasksCompleted(): Int

    @Query("SELECT COUNT(*) FROM plans")
    suspend fun getActivePlanCount(): Int

    // ── Bounded cache eviction ─────────────────────────────────────────

    @Query("DELETE FROM tasks WHERE scheduledDate < :beforeDate AND status = 'completed'")
    suspend fun evictOldCompletedTasks(beforeDate: String)

    @Query("SELECT COUNT(*) FROM tasks")
    suspend fun getTaskCount(): Int

    // ── Bulk operations ────────────────────────────────────────────────

    @Transaction
    suspend fun replacePlan(plan: PlanEntity, topics: List<TopicEntity>, tasks: List<TaskEntity>) {
        deleteTasksForPlan(plan.id)
        insertPlan(plan)
        insertTopics(topics)
        insertTasks(tasks)
    }
}
