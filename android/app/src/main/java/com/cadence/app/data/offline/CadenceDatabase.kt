package com.cadence.app.data.offline

import android.content.Context
import androidx.room.*
import kotlinx.coroutines.flow.Flow

/**
 * Room database for offline task completion.
 * Caches current day + 7-day window per OFF-3.
 * Pending sync actions survive process death (OFF-1).
 */

@Entity(tableName = "cached_tasks")
data class CachedTask(
    @PrimaryKey val id: String,
    val title: String,
    val kind: String,
    val hours: Double,
    var status: String,
    val carried: Boolean,
    val reviewStage: Int?,
    val planId: String,
    val planTitle: String,
    val planAccent: Int,
    val dayKey: String,
    val order: Int,
    val practiceProblems: String?, // JSON array
    val challengeProblem: String?,
    val parentTopic: String?,
    val cachedAt: Long = System.currentTimeMillis(),
)

@Entity(tableName = "pending_actions")
data class PendingAction(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val taskId: String,
    val action: String, // "complete" | "uncomplete"
    val todayKey: String,
    val createdAt: Long = System.currentTimeMillis(),
    val synced: Boolean = false,
)

@Dao
interface TaskDao {
    @Query("SELECT * FROM cached_tasks WHERE dayKey = :dayKey ORDER BY `order`")
    fun getTasksForDay(dayKey: String): Flow<List<CachedTask>>

    @Query("SELECT * FROM cached_tasks WHERE dayKey = :dayKey ORDER BY `order`")
    suspend fun getTasksForDaySync(dayKey: String): List<CachedTask>

    @Upsert
    suspend fun upsertTasks(tasks: List<CachedTask>)

    @Query("DELETE FROM cached_tasks WHERE dayKey < :cutoffDayKey")
    suspend fun deleteOlderThan(cutoffDayKey: String)

    @Query("UPDATE cached_tasks SET status = :status WHERE id = :taskId")
    suspend fun updateTaskStatus(taskId: String, status: String)

    @Query("SELECT COUNT(*) FROM cached_tasks WHERE dayKey = :dayKey AND status = 'done'")
    fun getDoneCount(dayKey: String): Flow<Int>
}

@Dao
interface PendingActionDao {
    @Query("SELECT * FROM pending_actions WHERE synced = 0 ORDER BY createdAt")
    suspend fun getPendingActions(): List<PendingAction>

    @Insert
    suspend fun insert(action: PendingAction)

    @Query("UPDATE pending_actions SET synced = 1 WHERE id = :id")
    suspend fun markSynced(id: Long)

    @Query("DELETE FROM pending_actions WHERE synced = 1")
    suspend fun deleteSynced()
}

@Database(
    entities = [CachedTask::class, PendingAction::class],
    version = 1,
    exportSchema = false,
)
abstract class CadenceDatabase : RoomDatabase() {
    abstract fun taskDao(): TaskDao
    abstract fun pendingActionDao(): PendingActionDao

    companion object {
        @Volatile
        private var INSTANCE: CadenceDatabase? = null

        fun getInstance(context: Context): CadenceDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    CadenceDatabase::class.java,
                    "cadence.db"
                ).build().also { INSTANCE = it }
            }
        }
    }
}
