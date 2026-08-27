package app.cadence.core.database

import androidx.room.Database
import androidx.room.RoomDatabase
import app.cadence.core.database.dao.TaskDao
import app.cadence.core.database.entity.AnswerHistoryEntity
import app.cadence.core.database.entity.PendingActionEntity
import app.cadence.core.database.entity.PlanEntity
import app.cadence.core.database.entity.PodDigestEntity
import app.cadence.core.database.entity.TaskEntity
import app.cadence.core.database.entity.TopicEntity

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
