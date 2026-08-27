package unifies.cadence.core.common.model

import kotlinx.serialization.Serializable
import java.time.Instant
import java.time.LocalDate

// ── Enums ──────────────────────────────────────────────────────────────────

enum class TaskStatus {
    PENDING, COMPLETED, SKIPPED
}

enum class TaskKind {
    LEARN, REVIEW, PRACTICE
}

enum class Level {
    FOUNDATIONS, CORE, ADVANCED;

    companion object {
        fun fromString(s: String): Level = when (s.lowercase()) {
            "foundations" -> FOUNDATIONS
            "core" -> CORE
            "advanced" -> ADVANCED
            else -> CORE
        }
    }
}

enum class ActionType {
    COMPLETE, SKIP, EDIT_ESTIMATE
}

enum class SyncState {
    IDLE, SYNCING, SYNCED, FAILED, OFFLINE
}

enum class ReviewStage(val label: String) {
    FIRST("1st Review"),
    SECOND("2nd Review"),
    THIRD("3rd Review"),
    FOURTH("4th Review"),
    FIFTH("5th Review"),
    MATURE("Mature");

    companion object {
        fun forIndex(i: Int): ReviewStage = entries.getOrElse(i) { MATURE }
    }
}

// ── Core domain models ─────────────────────────────────────────────────────

@Serializable
data class Plan(
    val id: String,
    val title: String,
    val totalHours: Double,
    val topicCount: Int,
    val dailyHours: Double,
    val startDate: String, // yyyy-MM-dd
    val createdAt: String,
    val color: String = "#B5533C",
)

@Serializable
data class Topic(
    val id: String,
    val planId: String,
    val title: String,
    val level: String,         // "foundations" | "core" | "advanced"
    val estimatedHours: Double,
    val order: Int,
    val practice: List<String> = emptyList(),
    val challenge: String? = null,
)

@Serializable
data class ScheduleTask(
    val taskId: String,
    val topicId: String,
    val topicTitle: String,
    val planId: String,
    val planTitle: String,
    val level: String,
    val kind: String,          // "learn" | "review" | "practice"
    val date: String,          // yyyy-MM-dd
    val estimatedMinutes: Int,
    val actualMinutes: Int? = null,
    val status: String,        // "pending" | "completed" | "skipped"
    val reviewStage: String? = null,
    val dayNumber: Int,
    val isCarriedOver: Boolean = false,
    val isRollover: Boolean = false,
    val practice: List<String> = emptyList(),
    val challenge: String? = null,
)

@Serializable
data class DaySchedule(
    val date: String,
    val dayNumber: Int,
    val tasks: List<ScheduleTask>,
    val totalMinutes: Int,
    val completedMinutes: Int,
)

@Serializable
data class TrackBoard(
    val planId: String,
    val planTitle: String,
    val topicCount: Int,
    val totalHours: Double,
    val completedHours: Double,
    val completionPercent: Double,
    val topics: List<TopicProgress>,
    val schedule: List<DaySchedule>,
)

@Serializable
data class TopicProgress(
    val topicId: String,
    val title: String,
    val level: String,
    val estimatedHours: Double,
    val completedHours: Double,
    val status: String,         // "pending" | "in_progress" | "completed"
    val completionPercent: Double,
)

// ── Analytics models ───────────────────────────────────────────────────────

@Serializable
data class HeatmapDay(
    val date: String,
    val minutes: Int,
    val tasksCompleted: Int,
)

@Serializable
data class TrendPoint(
    val date: String,
    val tasksCompleted: Int,
    val minutesStudied: Int,
)

@Serializable
data class Stats(
    val streak: Int,
    val longestStreak: Int,
    val totalHours: Double,
    val totalTasksCompleted: Int,
    val reviewsDueToday: Int,
    val activePlans: Int,
)

// ── Practice / Evaluation models ───────────────────────────────────────────

@Serializable
data class PracticeProblem(
    val question: String,
    val isChallenge: Boolean = false,
)

@Serializable
data class EvaluationResult(
    val score: Int,              // 0–100
    val feedback: String,        // Markdown with KaTeX + Mermaid
    val improvedAnswer: String? = null,
    val diagramType: String? = null,
    val diagramCode: String? = null,
    val domain: String? = null,
)

@Serializable
data class AnswerHistory(
    val id: String,
    val topicTitle: String,
    val question: String,
    val userAnswer: String,
    val score: Int,
    val feedback: String,
    val improvedAnswer: String? = null,
    val submittedAt: String,
)

// ── Pod models ─────────────────────────────────────────────────────────────

@Serializable
data class Pod(
    val id: String,
    val name: String,
    val inviteCode: String,
    val memberCount: Int,
    val createdAt: String,
)

@Serializable
data class PodMember(
    val userId: String,
    val displayName: String,
    val email: String,
    val isCurrentUser: Boolean = false,
)

@Serializable
data class PodBoard(
    val userId: String,
    val displayName: String,
    val totalMinutes: Int,
    val tasksCompleted: Int,
    val streak: Int,
    val completionPercent: Double,
    val dailyMinutes: List<TrendPoint>,
)

@Serializable
data class PodDigest(
    val digestDate: String,
    val memberStats: List<PodMemberStats>,
    val summary: String,
)

@Serializable
data class PodMemberStats(
    val userId: String,
    val displayName: String,
    val hoursStudied: Double,
    val tasksCompleted: Int,
    val topTopic: String?,
)

// ── API request/response models ────────────────────────────────────────────

@Serializable
data class ParseRequest(
    val syllabusText: String,
    val dailyHours: Double,
    val totalDays: Int,
    val schedulingMode: String,   // "parallel" | "sequential"
    val startDate: String,
)

@Serializable
data class ParseResponse(
    val planId: String,
    val title: String,
    val topics: List<Topic>,
    val totalHours: Double,
    val estimatedDays: Int,
    val schedule: List<DaySchedule>,
)

@Serializable
data class CompleteRequest(
    val actualMinutes: Int? = null,
)

@Serializable
data class TaskResponse(
    val task: ScheduleTask,
    val reviewsSpawned: Int = 0,
    val stats: Stats,
)

@Serializable
data class DeviceRegisterRequest(
    val token: String,
    val platform: String = "android",
)
