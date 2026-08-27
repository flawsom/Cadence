package unifies.cadence.core.database

import androidx.room.Database
import androidx.room.RoomDatabase
import unifies.cadence.core.database.dao.TaskDao
import unifies.cadence.core.database.entity.AnswerHistoryEntity
import unifies.cadence.core.database.entity.PendingActionEntity
import unifies.cadence.core.database.entity.PlanEntity
import unifies.cadence.core.database.entity.PodDigestEntity
import unifies.cadence.core.database.entity.TaskEntity
import unifies.cadence.core.database.entity.TopicEntity

@Database(
    entities = [
        TaskEntity::class,
        PendingActionEntity::class,
        PlanEntity::class,
        TopicEntity::class,
        AnswerHistoryEntity::class,
        PodDigestEntity::class,
    ],
    version = 1,
    exportSchema = true,
)
abstract class CadenceDatabase : RoomDatabase() {
    abstract fun taskDao(): TaskDao
}
