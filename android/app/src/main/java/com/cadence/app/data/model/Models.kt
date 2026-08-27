package com.cadence.app.data.model

import com.google.gson.annotations.SerializedName

// ── Tasks ──────────────────────────────────────────────────────────────

data class Task(
    val id: String,
    val title: String,
    val kind: String, // "learn" | "review" | "practice" | "challenge"
    val hours: Double,
    val status: String, // "open" | "done"
    val carried: Boolean = false,
    @SerializedName("reviewStage") val reviewStage: Int? = null,
    @SerializedName("planId") val planId: String,
    @SerializedName("planTitle") val planTitle: String = "",
    @SerializedName("planAccent") val planAccent: Int = 0,
    @SerializedName("practiceProblems") val practiceProblems: List<String>? = null,
    @SerializedName("challengeProblem") val challengeProblem: String? = null,
    @SerializedName("parentTopic") val parentTopic: String? = null,
)

data class BoardResponse(
    val tasks: List<Task>,
    @SerializedName("activePlans") val activePlans: List<PlanSummary>,
    @SerializedName("plannedHours") val plannedHours: Double,
    @SerializedName("doneHours") val doneHours: Double,
    @SerializedName("carriedCount") val carriedCount: Int,
)

data class PlanSummary(
    val id: String,
    val title: String,
)

// ── Plans ──────────────────────────────────────────────────────────────

data class PlanResponse(
    val id: String,
    val title: String,
    @SerializedName("sourceExcerpt") val sourceExcerpt: String,
    @SerializedName("sourceKind") val sourceKind: String,
    @SerializedName("hoursPerDay") val hoursPerDay: Double,
    @SerializedName("targetDays") val targetDays: Int,
    @SerializedName("scheduledDays") val scheduledDays: Int,
    val status: String,
    val topics: List<TopicResponse>,
)

data class TopicResponse(
    val id: String,
    val title: String,
    val hours: Double,
    val level: Int,
)

data class PlanDetailResponse(
    val id: String,
    val title: String,
    @SerializedName("sourceExcerpt") val sourceExcerpt: String,
    @SerializedName("sourceKind") val sourceKind: String,
    @SerializedName("hoursPerDay") val hoursPerDay: Double,
    @SerializedName("targetDays") val targetDays: Int,
    @SerializedName("scheduledDays") val scheduledDays: Int,
    val topics: List<TopicResponse>,
    val days: List<DayResponse>,
)

data class DayResponse(
    @SerializedName("dayKey") val dayKey: String,
    @SerializedName("dayIndex") val dayIndex: Int,
    val tasks: List<Task>,
)

// ── Stats ──────────────────────────────────────────────────────────────

data class StatsResponse(
    val streak: Int,
    @SerializedName("longestStreak") val longestStreak: Int,
    val heatmap: List<HeatmapDay>,
    @SerializedName("reviewsDueToday") val reviewsDueToday: Int,
    @SerializedName("totalHoursCompleted") val totalHoursCompleted: Double,
)

data class HeatmapDay(
    @SerializedName("dayKey") val dayKey: String,
    val hours: Double,
)

// ── Pods ───────────────────────────────────────────────────────────────

data class PodResponse(
    val id: String,
    val name: String,
    val code: String,
    @SerializedName("isOwner") val isOwner: Boolean,
    @SerializedName("todayCheckins") val todayCheckins: Int,
    val members: List<PodMember>,
)

data class PodMember(
    @SerializedName("userId") val userId: String,
    val name: String,
    @SerializedName("isYou") val isYou: Boolean,
    @SerializedName("totalCount") val totalCount: Int,
    @SerializedName("doneCount") val doneCount: Int,
    @SerializedName("plannedHours") val plannedHours: Double,
    @SerializedName("doneHours") val doneHours: Double,
    @SerializedName("checkinNote") val checkinNote: String? = null,
)

data class PodBoardsResponse(
    val id: String,
    val name: String,
    val code: String,
    @SerializedName("dayKeys") val dayKeys: List<String>,
    val members: List<BoardMember>,
)

data class BoardMember(
    @SerializedName("userId") val userId: String,
    val name: String,
    @SerializedName("isYou") val isYou: Boolean,
    val plans: List<MemberPlan>,
    val series: List<DayHours>,
)

data class MemberPlan(
    @SerializedName("planId") val planId: String,
    val title: String,
    val accent: Int,
    @SerializedName("totalTasks") val totalTasks: Int,
    @SerializedName("doneTasks") val doneTasks: Int,
    @SerializedName("plannedHours") val plannedHours: Double,
    @SerializedName("doneHours") val doneHours: Double,
)

data class DayHours(
    @SerializedName("dayKey") val dayKey: String,
    val hours: Double,
)

// ── Answers ────────────────────────────────────────────────────────────

data class AnswerResponse(
    val id: String,
    @SerializedName("userAnswer") val userAnswer: String,
    val score: Int,
    val feedback: FeedbackResponse?,
    @SerializedName("createdAt") val createdAt: Long,
)

data class FeedbackResponse(
    val summary: String,
    val strengths: List<String>,
    val weaknesses: List<String>,
    val explanation: String,
    val diagram: String? = null,
)

// ── Request Bodies ─────────────────────────────────────────────────────

data class CompleteTaskRequest(val done: Boolean, @SerializedName("todayKey") val todayKey: String)
data class TaskResponse(val status: String)

data class RolloverResponse(val moved: Int)

data class CreatePlanRequest(
    val rawInput: String,
    val title: String? = null,
    @SerializedName("hoursPerDay") val hoursPerDay: Double,
    @SerializedName("targetDays") val targetDays: Int,
    @SerializedName("startDayKey") val startDayKey: String,
    @SerializedName("schedulingMode") val schedulingMode: String = "parallel",
)

data class CreatePlanResponse(
    @SerializedName("planId") val planId: String,
    @SerializedName("scheduledDays") val scheduledDays: Int,
)

data class CreatePodRequest(val name: String)
data class CreatePodResponse(val podId: String, val code: String)

data class JoinPodRequest(val code: String)
data class JoinPodResponse(val podId: String, val name: String)

data class CheckInRequest(val note: String, @SerializedName("todayKey") val todayKey: String)
data class CheckInResponse(val cleared: Boolean)

data class SubmitAnswerRequest(
    @SerializedName("taskId") val taskId: String,
    @SerializedName("problemText") val problemText: String,
    @SerializedName("userAnswer") val userAnswer: String,
    @SerializedName("topicContext") val topicContext: String,
)
data class SubmitAnswerResponse(val answerId: String)

data class DeviceRegistrationRequest(
    @SerializedName("fcmToken") val fcmToken: String,
    @SerializedName("platform") val platform: String = "android",
)
