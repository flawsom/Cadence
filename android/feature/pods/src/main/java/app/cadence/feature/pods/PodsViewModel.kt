package app.cadence.feature.pods

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.cadence.core.common.model.Pod
import app.cadence.core.common.model.PodBoard
import app.cadence.core.common.model.PodDigest
import app.cadence.core.common.model.PodMember
import app.cadence.core.network.api.CadenceApi
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class PodsState(
    val pods: List<Pod> = emptyList(),
    val selectedPod: Pod? = null,
    val members: List<PodMember> = emptyList(),
    val boards: List<PodBoard> = emptyList(),
    val digest: PodDigest? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
    val createMode: Boolean = false,
    val joinCode: String = "",
    val newPodName: String = "",
)

@HiltViewModel
class PodsViewModel @Inject constructor(
    private val api: CadenceApi,
) : ViewModel() {

    private val _state = MutableStateFlow(PodsState())
    val state: StateFlow<PodsState> = _state.asStateFlow()

    init { loadPods() }

    fun loadPods() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true)
            try {
                val pods = api.getPods()
                _state.value = _state.value.copy(pods = pods, isLoading = false)
                if (pods.isNotEmpty() && _state.value.selectedPod == null) {
                    selectPod(pods.first())
                }
            } catch (e: Exception) {
                _state.value = _state.value.copy(isLoading = false, error = e.message)
            }
        }
    }

    fun selectPod(pod: Pod) {
        _state.value = _state.value.copy(selectedPod = pod)
        viewModelScope.launch {
            try {
                val members = api.getPodMembers(pod.id)
                val boards = api.getPodBoards(pod.id)
                val digest = api.getPodDigest(pod.id)
                _state.value = _state.value.copy(members = members, boards = boards, digest = digest)
            } catch (e: Exception) {
                _state.value = _state.value.copy(error = e.message)
            }
        }
    }

    fun createPod() {
        val name = _state.value.newPodName.trim()
        if (name.isBlank()) return
        viewModelScope.launch {
            try {
                api.createPod(mapOf("name" to name))
                _state.value = _state.value.copy(createMode = false, newPodName = "")
                loadPods()
            } catch (e: Exception) {
                _state.value = _state.value.copy(error = e.message)
            }
        }
    }

    fun joinPod() {
        val code = _state.value.joinCode.trim()
        if (code.isBlank()) return
        viewModelScope.launch {
            try {
                api.joinPod(mapOf("inviteCode" to code))
                _state.value = _state.value.copy(joinCode = "")
                loadPods()
            } catch (e: Exception) {
                _state.value = _state.value.copy(error = e.message)
            }
        }
    }

    fun checkin() {
        val pod = _state.value.selectedPod ?: return
        viewModelScope.launch {
            try {
                api.podCheckin(pod.id)
                selectPod(pod) // refresh
            } catch (e: Exception) {
                _state.value = _state.value.copy(error = e.message)
            }
        }
    }

    fun updateNewPodName(name: String) { _state.value = _state.value.copy(newPodName = name) }
    fun updateJoinCode(code: String) { _state.value = _state.value.copy(joinCode = code) }
    fun toggleCreateMode() { _state.value = _state.value.copy(createMode = !_state.value.createMode) }
}
