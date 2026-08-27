package app.cadence.feature.analytics

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.cadence.core.common.model.HeatmapDay
import app.cadence.core.common.model.Stats
import app.cadence.core.common.model.TrendPoint
import app.cadence.core.network.api.CadenceApi
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AnalyticsState(
    val stats: Stats = Stats(0, 0, 0.0, 0, 0, 0),
    val heatmap: List<HeatmapDay> = emptyList(),
    val trend: List<TrendPoint> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val viewMode: AnalyticsViewMode = AnalyticsViewMode.HEATMAP,
)

enum class AnalyticsViewMode { HEATMAP, TREND }

@HiltViewModel
class AnalyticsViewModel @Inject constructor(
    private val api: CadenceApi,
) : ViewModel() {

    private val _state = MutableStateFlow(AnalyticsState())
    val state: StateFlow<AnalyticsState> = _state.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true)
            try {
                val stats = api.getStats()
                val heatmap = api.getHeatmap(119)
                val trend = api.getTrend(30)
                _state.value = _state.value.copy(stats = stats, heatmap = heatmap, trend = trend, isLoading = false)
            } catch (e: Exception) {
                _state.value = _state.value.copy(isLoading = false, error = e.message)
            }
        }
    }

    fun setViewMode(mode: AnalyticsViewMode) {
        _state.value = _state.value.copy(viewMode = mode)
    }
}
