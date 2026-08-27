package unifies.cadence.feature.taskdetail

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import unifies.cadence.core.common.model.EvaluationResult
import unifies.cadence.core.common.model.ScheduleTask
import unifies.cadence.core.common.model.Topic
import unifies.cadence.core.database.dao.TaskDao
import unifies.cadence.core.database.entity.AnswerHistoryEntity
import unifies.cadence.core.network.api.CadenceApi
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

data class DetailState(
    val task: ScheduleTask? = null,
    val topics: List<Topic> = emptyList(),
    val practice: List<String> = emptyList(),
    val challenge: String? = null,
    val answerHistory: List<AnswerHistoryEntity> = emptyList(),
    val userAnswer: String = "",
    val isEvaluating: Boolean = false,
    val evaluation: EvaluationResult? = null,
    val isCompleting: Boolean = false,
    val showFeedback: Boolean = false,
    val error: String? = null,
    val timerSeconds: Int = 0,
    val isTimerRunning: Boolean = false,
)

@HiltViewModel
class DetailViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val api: CadenceApi,
    private val dao: TaskDao,
) : ViewModel() {

    private val taskId: String = savedStateHandle["taskId"] ?: ""

    private val _state = MutableStateFlow(DetailState())
    val state: StateFlow<DetailState> = _state.asStateFlow()

    init {
        loadTask()
    }

    private fun loadTask() {
        viewModelScope.launch {
            try {
                // Load from local DB first
                val localTask = dao.getTask(taskId)
                if (localTask != null) {
                    _state.value = _state.value.copy(
                        task = ScheduleTask(
                            taskId = localTask.id,
                            topicId = localTask.topicId,
                            topicTitle = localTask.title,
                            planId = localTask.planId,
                            planTitle = localTask.planTitle,
                            level = localTask.level,
                            kind = localTask.kind,
                            date = localTask.scheduledDate,
                            estimatedMinutes = localTask.estimatedMinutes,
                            status = localTask.status,
                            reviewStage = localTask.reviewStage,
                            dayNumber = localTask.dayNumber,
                            isCarriedOver = localTask.isCarriedOver,
                            isRollover = localTask.isRollover,
                        ),
                    )
                }

                // Load answer history for this topic
                val localTask2 = dao.getTask(taskId)
                if (localTask2 != null) {
                    dao.getAnswerHistoryForTopic(localTask2.title).collect { history ->
                        _state.value = _state.value.copy(answerHistory = history)
                    }
                }
            } catch (e: Exception) {
                _state.value = _state.value.copy(error = e.message)
            }
        }
    }

    fun updateAnswer(answer: String) {
        _state.value = _state.value.copy(userAnswer = answer)
    }

    fun submitAnswer() {
        val s = _state.value
        if (s.userAnswer.isBlank() || s.task == null) return

        _state.value = s.copy(isEvaluating = true)

        viewModelScope.launch {
            try {
                val result = api.evaluateAnswer(
                    mapOf(
                        "answer" to s.userAnswer,
                        "topicTitle" to s.task.topicTitle,
                        "question" to (s.task.topicTitle),
                        "domain" to detectDomain(s.task.topicTitle),
                    )
                )

                // Save to history
                dao.insertAnswerHistory(
                    AnswerHistoryEntity(
                        id = UUID.randomUUID().toString(),
                        topicTitle = s.task.topicTitle,
                        question = s.task.topicTitle,
                        userAnswer = s.userAnswer,
                        score = result.score,
                        feedback = result.feedback,
                        improvedAnswer = result.improvedAnswer,
                    )
                )

                _state.value = _state.value.copy(
                    evaluation = result,
                    isEvaluating = false,
                    showFeedback = true,
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isEvaluating = false,
                    error = e.message,
                )
            }
        }
    }

    fun dismissFeedback() {
        _state.value = _state.value.copy(
            showFeedback = false,
            evaluation = null,
            userAnswer = "",
        )
    }

    fun completeTask() {
        val task = _state.value.task ?: return
        _state.value = _state.value.copy(isCompleting = true)

        viewModelScope.launch {
            try {
                api.completeTask(task.taskId, unifies.cadence.core.common.model.CompleteRequest(_state.value.timerSeconds / 60))
                dao.updateTaskStatus(
                    task.taskId,
                    "completed",
                    _state.value.timerSeconds / 60,
                    System.currentTimeMillis(),
                )
                _state.value = _state.value.copy(isCompleting = false)
            } catch (e: Exception) {
                _state.value = _state.value.copy(isCompleting = false, error = e.message)
            }
        }
    }

    fun skipTask() {
        val task = _state.value.task ?: return
        viewModelScope.launch {
            try {
                api.skipTask(task.taskId)
                dao.updateTaskStatus(task.taskId, "skipped", null, System.currentTimeMillis())
            } catch (e: Exception) {
                _state.value = _state.value.copy(error = e.message)
            }
        }
    }

    fun startTimer() {
        _state.value = _state.value.copy(isTimerRunning = true)
        viewModelScope.launch {
            while (_state.value.isTimerRunning) {
                kotlinx.coroutines.delay(1000)
                _state.value = _state.value.copy(timerSeconds = _state.value.timerSeconds + 1)
            }
        }
    }

    fun stopTimer() {
        _state.value = _state.value.copy(isTimerRunning = false)
    }

    private fun detectDomain(title: String): String {
        val lower = title.lowercase()
        return when {
            lower.containsAny("python", "java", "code", "program", "algorithm", "data structure", "function", "class", "oop") -> "programming"
            lower.containsAny("math", "calculus", "algebra", "probability", "statistics", "transform", "laplace", "fourier") -> "mathematics"
            lower.containsAny("cloud", "network", "distributed", "server", "api", "database", "sql") -> "systems"
            lower.containsAny("machine learning", "neural", "deep learning", "ai", "regression") -> "ml"
            lower.containsAny("image", "processing", "vision", "signal", "wavelet", "compression") -> "signal"
            lower.containsAny("security", "cryptography", "auth", "encryption") -> "security"
            lower.containsAny("web", "html", "css", "javascript", "react", "frontend") -> "web"
            else -> "general"
        }
    }
}

private fun String.containsAny(vararg terms: String): Boolean = terms.any { contains(it) }
