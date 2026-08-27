package app.cadence.feature.settings

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.preferencesDataStore
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.cadence.core.network.api.CadenceApi
import app.cadence.core.security.BiometricHelper
import app.cadence.core.security.TokenStore
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import javax.inject.Inject

private val Context.dataStore by preferencesDataStore(name = "settings")
private val DARK_MODE = booleanPreferencesKey("dark_mode")
private val BIOMETRIC_LOCK = booleanPreferencesKey("biometric_lock")

data class SettingsState(
    val isDarkMode: Boolean = false,
    val isBiometricEnabled: Boolean = false,
    val isSignedIn: Boolean = false,
    val displayName: String = "",
    val email: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val api: CadenceApi,
    private val tokenStore: TokenStore,
    val biometricHelper: BiometricHelper,
) : ViewModel() {

    private val _state = MutableStateFlow(SettingsState())
    val state: StateFlow<SettingsState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            context.dataStore.data.map { prefs ->
                SettingsState(
                    isDarkMode = prefs[DARK_MODE] ?: false,
                    isBiometricEnabled = prefs[BIOMETRIC_LOCK] ?: false,
                    isSignedIn = tokenStore.isLoggedIn(),
                )
            }.collect { _state.value = it }
        }
    }

    fun toggleDarkMode() {
        viewModelScope.launch {
            context.dataStore.edit { prefs ->
                val current = prefs[DARK_MODE] ?: false
                prefs[DARK_MODE] = !current
            }
        }
    }

    fun toggleBiometricLock() {
        viewModelScope.launch {
            context.dataStore.edit { prefs ->
                val current = prefs[BIOMETRIC_LOCK] ?: false
                prefs[BIOMETRIC_LOCK] = !current
            }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            tokenStore.clearTokens()
            _state.value = _state.value.copy(isSignedIn = false)
        }
    }
}
