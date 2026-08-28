package unifies.cadence.feature.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import unifies.cadence.core.common.model.ParseRequest
import unifies.cadence.core.common.model.ParseResponse
import unifies.cadence.core.common.model.Topic
import unifies.cadence.core.database.dao.TaskDao
import unifies.cadence.core.database.entity.PlanEntity
import unifies.cadence.core.database.entity.TaskEntity
import unifies.cadence.core.database.entity.TopicEntity
import unifies.cadence.core.network.api.CadenceApi
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer
import java.util.UUID
import javax.inject.Inject

// ── MVI Contract ───────────────────────────────────────────────────────────

data class IngestState(
    val step: IngestStep = IngestStep.INPUT,
    val syllabusText: String = "",
    val planName: String = "",
    val dailyHours: Double = 2.0,
    val totalDays: Int = 30,
    val schedulingMode: String = "sequential",
    val startDate: String = unifies.cadence.core.common.util.DateUtil.today(),
    val topics: List<Topic> = emptyList(),
    val totalHours: Double = 0.0,
    val estimatedDays: Int = 0,
    val isParsing: Boolean = false,
    val isSaving: Boolean = false,
    val error: String? = null,
    val isShareIntent: Boolean = false,
)

enum class IngestStep {
    INPUT,      // Paste syllabus or upload PDF
    REVIEW,     // Review parsed topics, adjust settings
    PARSING,    // AI is processing
    SAVING,     // Saving to local DB + server
    DONE,       // Plan created
}

sealed class IngestIntent {
    data class UpdateSyllabus(val text: String) : IngestIntent()
    data class UpdatePlanName(val name: String) : IngestIntent()
    data class UpdateDailyHours(val hours: Double) : IngestIntent()
    data class UpdateTotalDays(val days: Int) : IngestIntent()
    data class UpdateSchedulingMode(val mode: String) : IngestIntent()
    data class UpdateStartDate(val date: String) : IngestIntent()
    data class Parsed(val response: ParseResponse) : IngestIntent()
    data class ParseError(val message: String) : IngestIntent()
    object Parse : IngestIntent()
    object Save : IngestIntent()
    object Saved : IngestIntent()
    object Reset : IngestIntent()
    data class ShareIntent(val text: String?) : IngestIntent()
}

// ── ViewModel ──────────────────────────────────────────────────────────────

@HiltViewModel
class IngestViewModel @Inject constructor(
    private val api: CadenceApi,
    private val dao: TaskDao,
) : ViewModel() {

    private val _state = MutableStateFlow(IngestState())
    val state: StateFlow<IngestState> = _state.asStateFlow()

    fun dispatch(intent: IngestIntent) {
        when (intent) {
            is IngestIntent.UpdateSyllabus -> {
                val t = intent
                _state.value { copy(syllabusText = t.text) }
            }
            is IngestIntent.UpdatePlanName -> {
                val n = intent
                _state.value { copy(planName = n.name) }
            }
            is IngestIntent.UpdateDailyHours -> {
                val h = intent
                _state.value { copy(dailyHours = h.hours) }
            }
            is IngestIntent.UpdateTotalDays -> {
                val d = intent
                _state.value { copy(totalDays = d.days) }
            }
            is IngestIntent.UpdateSchedulingMode -> _state.value {
                copy(schedulingMode = intent.mode)
            }
            is IngestIntent.UpdateStartDate -> _state.value {
                copy(startDate = intent.date)
            }
            is IngestIntent.Parsed -> _state.value {
                copy(
                    step = IngestStep.REVIEW,
                    topics = intent.response.topics,
                    totalHours = intent.response.totalHours,
                    estimatedDays = intent.response.estimatedDays,
                    planName = intent.response.title,
                    isParsing = false,
                    error = null,
                )
            }
            is IngestIntent.ParseError -> _state.value {
                copy(step = IngestStep.INPUT, isParsing = false, error = intent.message)
            }
            is IngestIntent.Parse -> parseSyllabus()
            is IngestIntent.Save -> savePlan()
            is IngestIntent.Saved -> _state.value {
                copy(step = IngestStep.DONE, isSaving = false)
            }
            is IngestIntent.Reset -> _state.value = IngestState()
            is IngestIntent.ShareIntent -> _state.value {
                copy(
                    syllabusText = intent.text ?: "",
                    isShareIntent = intent.text != null,
                )
            }
        }
    }

    private fun parseSyllabus() {
        val s = _state.value
        if (s.syllabusText.isBlank()) return

        _state.value = s.copy(step = IngestStep.PARSING, isParsing = true, error = null)

        viewModelScope.launch {
            try {
                val response = api.parseSyllabus(
                    ParseRequest(
                        syllabusText = s.syllabusText,
                        dailyHours = s.dailyHours,
                        totalDays = s.totalDays,
                        schedulingMode = s.schedulingMode,
                        startDate = s.startDate,
                    )
                )
                dispatch(IngestIntent.Parsed(response))
            } catch (e: Exception) {
                dispatch(IngestIntent.ParseError(e.message ?: "Failed to parse syllabus"))
            }
        }
    }

    private fun savePlan() {
        val s = _state.value
        if (s.topics.isEmpty()) return

        _state.value = s.copy(isSaving = true)

        viewModelScope.launch {
            try {
                val planId = UUID.randomUUID().toString()

                val plan = PlanEntity(
                    id = planId,
                    title = s.planName.ifBlank { "My Plan" },
                    totalHours = s.totalHours,
                    topicCount = s.topics.size,
                    dailyHours = s.dailyHours,
                    startDate = s.startDate,
                    createdAt = s.startDate,
                )

                val topicEntities = s.topics.map { topic ->
                    TopicEntity(
                        id = topic.id,
                        planId = planId,
                        title = topic.title,
                        level = topic.level,
                        estimatedHours = topic.estimatedHours,
                        order = topic.order,
                        practice = topic.practice.joinToString(","),
                        challenge = topic.challenge,
                    )
                }

                // TODO: Generate task entities from schedule
                // For now, create placeholder tasks
                val taskEntities = generateScheduleTasks(planId, s)

                dao.replacePlan(plan, topicEntities, taskEntities)
                dispatch(IngestIntent.Saved)
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isSaving = false,
                    error = e.message ?: "Failed to save plan",
                )
            }
        }
    }

    private fun generateScheduleTasks(
        planId: String,
        state: IngestState,
    ): List<TaskEntity> {
        val tasks = mutableListOf<TaskEntity>()
        val startDate = unifies.cadence.core.common.util.DateUtil.parse(state.startDate)
        var currentDate = startDate
        var dayNumber = 1

        for (topic in state.topics) {
            val estimatedMinutes = (topic.estimatedHours * 60).toInt()
            val maxDailyMinutes = (state.dailyHours * 60).toInt()

            // Create learn task
            val learnMinutes = minOf(estimatedMinutes, maxDailyMinutes)
            tasks.add(
                TaskEntity(
                    id = UUID.randomUUID().toString(),
                    title = topic.title,
                    topicId = topic.id,
                    planId = planId,
                    planTitle = state.planName.ifBlank { "My Plan" },
                    level = topic.level,
                    kind = "learn",
                    scheduledDate = unifies.cadence.core.common.util.DateUtil.format(currentDate),
                    estimatedMinutes = learnMinutes,
                    status = "pending",
                    dayNumber = dayNumber,
                )
            )

            // Create practice task if topic has practice problems
            if (topic.practice.isNotEmpty()) {
                tasks.add(
                    TaskEntity(
                        id = UUID.randomUUID().toString(),
                        title = "${topic.title} — Practice",
                        topicId = topic.id,
                        planId = planId,
                        planTitle = state.planName.ifBlank { "My Plan" },
                        level = topic.level,
                        kind = "practice",
                        scheduledDate = unifies.cadence.core.common.util.DateUtil.format(currentDate),
                        estimatedMinutes = minOf(30, maxDailyMinutes - learnMinutes),
                        status = "pending",
                        dayNumber = dayNumber,
                    )
                )
            }

            // Add review task 2 days later
            val reviewDate = currentDate.plusDays(2)
            tasks.add(
                TaskEntity(
                    id = UUID.randomUUID().toString(),
                    title = "Review: ${topic.title}",
                    topicId = topic.id,
                    planId = planId,
                    planTitle = state.planName.ifBlank { "My Plan" },
                    level = topic.level,
                    kind = "review",
                    scheduledDate = unifies.cadence.core.common.util.DateUtil.format(reviewDate),
                    estimatedMinutes = 30,
                    status = "pending",
                    reviewStage = "1st Review",
                    dayNumber = dayNumber + 2,
                )
            )

            dayNumber++
            currentDate = currentDate.plusDays(1)
        }

        return tasks
    }
}

// ── Extension for copy on StateFlow ────────────────────────────────────────

private inline fun MutableStateFlow<IngestState>.value(
    transform: IngestState.() -> IngestState,
) {
    value = value.transform()
}
