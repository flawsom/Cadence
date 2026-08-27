package unifies.cadence.feature.practice

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import unifies.cadence.core.common.model.EvaluationResult
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

data class PracticeState(
    val topicTitle: String = "",
    val currentQuestion: String = "",
    val questionIndex: Int = 0,
    val questions: List<String> = emptyList(),
    val userAnswer: String = "",
    val isEvaluating: Boolean = false,
    val evaluation: EvaluationResult? = null,
    val showFeedback: Boolean = false,
    val history: List<AnswerHistoryEntity> = emptyList(),
    val error: String? = null,
)

@HiltViewModel
class PracticeViewModel @Inject constructor(
    private val api: CadenceApi,
    private val dao: TaskDao,
) : ViewModel() {

    private val _state = MutableStateFlow(PracticeState())
    val state: StateFlow<PracticeState> = _state.asStateFlow()

    fun loadQuestions(topicTitle: String, questions: List<String>) {
        _state.value = PracticeState(
            topicTitle = topicTitle,
            questions = questions,
            currentQuestion = questions.firstOrNull() ?: "",
        )
        loadHistory(topicTitle)
    }

    private fun loadHistory(topicTitle: String) {
        viewModelScope.launch {
            dao.getAnswerHistoryForTopic(topicTitle).collect { history ->
                _state.value = _state.value.copy(history = history)
            }
        }
    }

    fun updateAnswer(answer: String) {
        _state.value = _state.value.copy(userAnswer = answer)
    }

    fun submitAnswer() {
        val s = _state.value
        if (s.userAnswer.isBlank()) return

        _state.value = s.copy(isEvaluating = true)

        viewModelScope.launch {
            try {
                val result = api.evaluateAnswer(
                    mapOf(
                        "answer" to s.userAnswer,
                        "topicTitle" to s.topicTitle,
                        "question" to s.currentQuestion,
                        "domain" to detectDomain(s.topicTitle),
                    )
                )

                dao.insertAnswerHistory(
                    AnswerHistoryEntity(
                        id = UUID.randomUUID().toString(),
                        topicTitle = s.topicTitle,
                        question = s.currentQuestion,
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
                _state.value = _state.value.copy(isEvaluating = false, error = e.message)
            }
        }
    }

    fun nextQuestion() {
        val s = _state.value
        val nextIdx = s.questionIndex + 1
        if (nextIdx < s.questions.size) {
            _state.value = s.copy(
                questionIndex = nextIdx,
                currentQuestion = s.questions[nextIdx],
                userAnswer = "",
                evaluation = null,
                showFeedback = false,
            )
        }
    }

    fun dismissFeedback() {
        _state.value = _state.value.copy(showFeedback = false, evaluation = null, userAnswer = "")
    }

    private fun detectDomain(title: String): String {
        val lower = title.lowercase()
        return when {
            lower.containsAny("python", "java", "code", "program", "algorithm") -> "programming"
            lower.containsAny("math", "calculus", "algebra", "probability", "statistics", "transform", "laplace", "fourier") -> "mathematics"
            lower.containsAny("cloud", "network", "distributed", "server") -> "systems"
            lower.containsAny("machine learning", "neural", "ai", "regression") -> "ml"
            lower.containsAny("image", "processing", "vision", "signal") -> "signal"
            else -> "general"
        }
    }
}

private fun String.containsAny(vararg terms: String): Boolean = terms.any { contains(it) }
