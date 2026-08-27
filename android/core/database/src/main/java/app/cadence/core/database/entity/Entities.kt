package app.cadence.core.database.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import app.cadence.core.common.model.ActionType
import app.cadence.core.common.model.TaskKind
import app.cadence.core.common.model.TaskStatus
import java.time.Instant
import java.time.LocalDate

@Entity(
    tableName = "tasks",
    foreignKeys = [
        ForeignKey(
            entity = PlanEntity::class,
            parentColumns = ["id"],
            childColumns = ["planId"],
            onDelete = ForeignKey.CASCADE,
        )
    ],
    indices = [Index("planId"), Index("scheduledDate"), Index("status")],
)
data class TaskEntity(
    @PrimaryKey val id: String,
    val title: String,
    val topicId: String,
    val planId: String,
    val planTitle: String,
    val level: String,
    val kind: String,            // "learn" | "review" | "practice"
    val scheduledDate: String,   // yyyy-MM-dd
    val estimatedMinutes: Int,
    val actualMinutes: Int? = null,
    val status: String,          // "pending" | "completed" | "skipped"
    val reviewStage: String? = null,
    val dayNumber: Int,
    val isCarriedOver: Boolean = false,
    val isRollover: Boolean = false,
    val serverUpdatedAt: Long = Instant.now().toEpochMilli(),
)

@Entity(tableName = "pending_actions")
data class PendingActionEntity(
    @PrimaryKey val id: String = java.util.UUID.randomUUID().toString(),
    val taskId: String,
    val actionType: String,      // ActionType.name
    val payload: String? = null, // JSON string
    val createdAt: Long = Instant.now().toEpochMilli(),
    val retryCount: Int = 0,
)

@Entity(
    tableName = "plans",
    indices = [Index("createdAt")],
)
data class PlanEntity(
    @PrimaryKey val id: String,
    val title: String,
    val totalHours: Double,
    val topicCount: Int,
    val dailyHours: Double,
    val startDate: String,
    val createdAt: String,
    val color: String = "#B5533C",
)

@Entity(
    tableName = "topics",
    foreignKeys = [
        ForeignKey(
            entity = PlanEntity::class,
            parentColumns = ["id"],
            childColumns = ["planId"],
            onDelete = ForeignKey.CASCADE,
        )
    ],
    indices = [Index("planId")],
)
data class TopicEntity(
    @PrimaryKey val id: String,
    val planId: String,
    val title: String,
    val level: String,
    val estimatedHours: Double,
    val order: Int,
    val practice: String = "[]", // JSON array
    val challenge: String? = null,
)

@Entity(tableName = "answer_history")
data class AnswerHistoryEntity(
    @PrimaryKey val id: String = java.util.UUID.randomUUID().toString(),
    val topicTitle: String,
    val question: String,
    val userAnswer: String,
    val score: Int,
    val feedback: String,
    val improvedAnswer: String? = null,
    val submittedAt: String = LocalDate.now().toString(),
)

@Entity(
    tableName = "pod_digests",
    indices = [Index("digestDate")],
)
data class PodDigestEntity(
    @PrimaryKey val id: String = java.util.UUID.randomUUID().toString(),
    val podId: String,
    val digestDate: String,
    val memberStats: String, // JSON
    val summary: String,
)
