package app.cadence.feature.today

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.cadence.core.common.model.DaySchedule
import app.cadence.core.common.model.HeatmapDay
import app.cadence.core.common.model.ScheduleTask
import app.cadence.core.common.model.Stats
import app.cadence.core.common.model.TrendPoint
import app.cadence.core.common.util.DateUtil
import app.cadence.core.network.api.CadenceApi
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class TodayState(
    val today: String = DateUtil.today(),
    val greeting: String = "",
    val tasks: List<ScheduleTask> = emptyList(),
    val stats: Stats = Stats(0, 0, 0.0, 0, 0, 0),
    val heatmap: List<HeatmapDay> = emptyList(),
    val trend: List<TrendPoint> = emptyList(),
    val rolloverTasks: List<ScheduleTask> = emptyList(),
    val isLoading: Boolean = true,
    val error: String? = null,
    val showHeatmap: Boolean = true, // toggle heatmap vs trend
)

@HiltViewModel
class TodayViewModel @Inject constructor(
    private val api: CadenceApi,
) : ViewModel() {

    private val _state = MutableStateFlow(TodayState())
    val state: StateFlow<TodayState> = _state.asStateFlow()

    init {
        loadToday()
    }

    fun loadToday() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            try {
                val today = DateUtil.today()
                val tasks = api.getTodayTasks(today)
                val stats = api.getStats()
                val heatmap = api.getHeatmap(119)
                val trend = api.getTrend(30)
                val rollover = tasks.filter { it.isRollover || it.isCarriedOver }

                _state.value = _state.value.copy(
                    today = today,
                    greeting = generateGreeting(),
                    tasks = tasks,
                    stats = stats,
                    heatmap = heatmap,
                    trend = trend,
                    rolloverTasks = rollover,
                    isLoading = false,
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    error = e.message ?: "Failed to load today",
                )
            }
        }
    }

    fun toggleChartView() {
        _state.value = _state.value.copy(showHeatmap = !_state.value.showHeatmap)
    }

    fun completeTask(taskId: String, actualMinutes: Int? = null) {
        viewModelScope.launch {
            try {
                api.completeTask(taskId, app.cadence.core.common.model.CompleteRequest(actualMinutes))
                loadToday() // Refresh
            } catch (e: Exception) {
                _state.value = _state.value.copy(error = e.message)
            }
        }
    }

    fun skipTask(taskId: String) {
        viewModelScope.launch {
            try {
                api.skipTask(taskId)
                loadToday()
            } catch (e: Exception) {
                _state.value = _state.value.copy(error = e.message)
            }
        }
    }

    private fun generateGreeting(): String {
        val hour = java.time.LocalTime.now().hour
        return when {
            hour < 12 -> "Good morning"
            hour < 17 -> "Good afternoon"
            else -> "Good evening"
        }
    }
}
