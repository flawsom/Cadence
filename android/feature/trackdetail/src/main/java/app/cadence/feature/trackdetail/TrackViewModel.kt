package app.cadence.feature.trackdetail

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.cadence.core.common.model.DaySchedule
import app.cadence.core.common.model.ScheduleTask
import app.cadence.core.common.model.TopicProgress
import app.cadence.core.common.model.TrackBoard
import app.cadence.core.network.api.CadenceApi
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class TrackState(
    val board: TrackBoard? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class TrackViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val api: CadenceApi,
) : ViewModel() {

    private val planId: String = savedStateHandle["planId"] ?: ""

    private val _state = MutableStateFlow(TrackState())
    val state: StateFlow<TrackState> = _state.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true)
            try {
                val board = api.getTrackBoard(planId)
                _state.value = _state.value.copy(board = board, isLoading = false)
            } catch (e: Exception) {
                _state.value = _state.value.copy(isLoading = false, error = e.message)
            }
        }
    }
}
