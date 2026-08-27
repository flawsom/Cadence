package com.cadence.app.data.api

import com.cadence.app.data.model.*
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.*

/**
 * Cadence API client — thin REST bridge to the Convex backend.
 * All business logic lives server-side; this is purely transport.
 */
interface CadenceApi {

    // ── Tasks ──────────────────────────────────────────────────────────

    @GET("tasks/board")
    suspend fun getBoard(@Query("todayKey") todayKey: String): BoardResponse

    @POST("tasks/{id}/complete")
    suspend fun completeTask(
        @Path("id") taskId: String,
        @Body request: CompleteTaskRequest
    ): TaskResponse

    @POST("tasks/sync-rollover")
    suspend fun syncRollover(@Query("todayKey") todayKey: String): RolloverResponse

    // ── Plans ──────────────────────────────────────────────────────────

    @GET("plans")
    suspend fun listPlans(): List<PlanResponse>

    @GET("plans/{id}")
    suspend fun getPlanDetail(@Path("id") planId: String): PlanDetailResponse

    @POST("plans")
    suspend fun createPlan(@Body request: CreatePlanRequest): CreatePlanResponse

    // ── Stats ──────────────────────────────────────────────────────────

    @GET("stats")
    suspend fun getStats(@Query("todayKey") todayKey: String): StatsResponse

    // ── Pods ───────────────────────────────────────────────────────────

    @GET("pods/mine")
    suspend fun getMyPod(@Query("todayKey") todayKey: String): PodResponse?

    @GET("pods/boards")
    suspend fun getPodBoards(
        @Query("todayKey") todayKey: String,
        @Query("windowDays") windowDays: Int = 14
    ): PodBoardsResponse?

    @POST("pods/create")
    suspend fun createPod(@Body request: CreatePodRequest): CreatePodResponse

    @POST("pods/join")
    suspend fun joinPod(@Body request: JoinPodRequest): JoinPodResponse

    @POST("pods/checkin")
    suspend fun checkIn(@Body request: CheckInRequest): CheckInResponse

    // ── Answers / Evaluation ───────────────────────────────────────────

    @POST("answers/submit")
    suspend fun submitAnswer(@Body request: SubmitAnswerRequest): SubmitAnswerResponse

    @GET("answers/by-task")
    suspend fun getAnswers(
        @Query("taskId") taskId: String,
        @Query("problemText") problemText: String
    ): List<AnswerResponse>

    // ── Device Registration ────────────────────────────────────────────

    @POST("devices/register")
    suspend fun registerDevice(@Body request: DeviceRegistrationRequest): Unit

    companion object {
        private const val BASE_URL = "https://blessed-mosquito-123.convex.site/"

        fun getInstance(): CadenceApi {
            return Retrofit.Builder()
                .baseUrl(BASE_URL)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
                .create(CadenceApi::class.java)
        }
    }
}
