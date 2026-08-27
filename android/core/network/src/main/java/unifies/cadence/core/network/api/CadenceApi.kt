package unifies.cadence.core.network.api

import unifies.cadence.core.common.model.CompleteRequest
import unifies.cadence.core.common.model.DaySchedule
import unifies.cadence.core.common.model.DeviceRegisterRequest
import unifies.cadence.core.common.model.EvaluationResult
import unifies.cadence.core.common.model.HeatmapDay
import unifies.cadence.core.common.model.ParseRequest
import unifies.cadence.core.common.model.ParseResponse
import unifies.cadence.core.common.model.Plan
import unifies.cadence.core.common.model.Pod
import unifies.cadence.core.common.model.PodBoard
import unifies.cadence.core.common.model.PodDigest
import unifies.cadence.core.common.model.PodMember
import unifies.cadence.core.common.model.ScheduleTask
import unifies.cadence.core.common.model.Stats
import unifies.cadence.core.common.model.TaskResponse
import unifies.cadence.core.common.model.Topic
import unifies.cadence.core.common.model.TrackBoard
import unifies.cadence.core.common.model.TrendPoint
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface CadenceApi {

    // ── Plans ──────────────────────────────────────────────────────────

    @POST("api/syllabi/parse")
    suspend fun parseSyllabus(@Body req: ParseRequest): ParseResponse

    @GET("api/plans")
    suspend fun getPlans(): List<Plan>

    @GET("api/plans/{id}")
    suspend fun getPlan(@Path("id") id: String): Plan

    @GET("api/plans/{id}/topics")
    suspend fun getTopics(@Path("id") id: String): List<Topic>

    @GET("api/plans/{id}/schedule")
    suspend fun getSchedule(
        @Path("id") id: String,
        @Query("date") date: String? = null,
    ): List<DaySchedule>

    @DELETE("api/plans/{id}")
    suspend fun deletePlan(@Path("id") id: String)

    // ── Tasks ──────────────────────────────────────────────────────────

    @GET("api/tasks/today")
    suspend fun getTodayTasks(
        @Query("date") date: String,
    ): List<ScheduleTask>

    @GET("api/tasks/board")
    suspend fun getBoard(
        @Query("date") date: String,
    ): List<DaySchedule>

    @POST("api/tasks/{id}/complete")
    suspend fun completeTask(
        @Path("id") id: String,
        @Body req: CompleteRequest = CompleteRequest(),
    ): TaskResponse

    @POST("api/tasks/{id}/skip")
    suspend fun skipTask(@Path("id") id: String): TaskResponse

    // ── Reviews ────────────────────────────────────────────────────────

    @GET("api/reviews/due")
    suspend fun getDueReviews(
        @Query("date") date: String,
    ): List<ScheduleTask>

    // ── Practice ───────────────────────────────────────────────────────

    @POST("api/evaluate")
    suspend fun evaluateAnswer(
        @Body req: Map<String, String>,
    ): EvaluationResult

    // ── Analytics ──────────────────────────────────────────────────────

    @GET("api/analytics/stats")
    suspend fun getStats(): Stats

    @GET("api/analytics/heatmap")
    suspend fun getHeatmap(
        @Query("days") days: Int = 119,
    ): List<HeatmapDay>

    @GET("api/analytics/trend")
    suspend fun getTrend(
        @Query("days") days: Int = 30,
    ): List<TrendPoint>

    // ── Track (single plan deep-dive) ──────────────────────────────────

    @GET("api/tracks/{id}")
    suspend fun getTrackBoard(@Path("id") id: String): TrackBoard

    // ── Pods ───────────────────────────────────────────────────────────

    @GET("api/pods")
    suspend fun getPods(): List<Pod>

    @POST("api/pods")
    suspend fun createPod(@Body req: Map<String, String>): Pod

    @POST("api/pods/join")
    suspend fun joinPod(@Body req: Map<String, String>): Pod

    @DELETE("api/pods/{id}/leave")
    suspend fun leavePod(@Path("id") id: String)

    @GET("api/pods/{id}/members")
    suspend fun getPodMembers(@Path("id") id: String): List<PodMember>

    @GET("api/pods/{id}/boards")
    suspend fun getPodBoards(@Path("id") id: String): List<PodBoard>

    @GET("api/pods/{id}/digest")
    suspend fun getPodDigest(@Path("id") id: String): PodDigest?

    @POST("api/pods/{id}/checkin")
    suspend fun podCheckin(@Path("id") id: String): Map<String, Any>

    // ── Auth ───────────────────────────────────────────────────────────

    @POST("api/auth/token")
    suspend fun exchangeToken(@Body req: Map<String, String>): TokenResponse

    @POST("api/auth/refresh")
    suspend fun refreshToken(@Body req: Map<String, String>): TokenResponse

    // ── Devices ────────────────────────────────────────────────────────

    @POST("api/devices/register")
    suspend fun registerDevice(@Body req: DeviceRegisterRequest)

    @DELETE("api/devices/{token}")
    suspend fun unregisterDevice(@Path("token") token: String)

    // ── Answer history ─────────────────────────────────────────────────

    @GET("api/answers/history")
    suspend fun getAnswerHistory(
        @Query("topicId") topicId: String? = null,
        @Query("limit") limit: Int = 50,
    ): List<Map<String, Any>>
}

// ── Token response ─────────────────────────────────────────────────────────

data class TokenResponse(
    val accessToken: String,
    val refreshToken: String,
    val expiresIn: Long,
    val tokenType: String = "Bearer",
)
