package unifies.cadence.core.security

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import unifies.cadence.core.network.auth.TokenProvider
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Thread-safe token storage backed by EncryptedSharedPreferences (AES-256-GCM).
 * Implements [TokenProvider] so the network layer can consume it transparently.
 */
@Singleton
class TokenStore @Inject constructor(
    @ApplicationContext private val context: Context,
) : TokenProvider {

    private val masterKey by lazy {
        MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .setUserAuthenticationRequired(false) // Biometric gating is separate
            .build()
    }

    private val prefs by lazy {
        EncryptedSharedPreferences.create(
            context,
            "cadence_tokens",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    override suspend fun getAccessToken(): String? {
        val expiresAt = prefs.getLong(KEY_ACCESS_EXPIRES, 0)
        return if (System.currentTimeMillis() < expiresAt) {
            prefs.getString(KEY_ACCESS_TOKEN, null)
        } else {
            null // Expired
        }
    }

    override suspend fun getRefreshToken(): String? {
        return prefs.getString(KEY_REFRESH_TOKEN, null)
    }

    override suspend fun saveTokens(accessToken: String, refreshToken: String, expiresIn: Long) {
        prefs.edit().apply {
            putString(KEY_ACCESS_TOKEN, accessToken)
            putString(KEY_REFRESH_TOKEN, refreshToken)
            putLong(KEY_ACCESS_EXPIRES, System.currentTimeMillis() + expiresIn * 1000)
            apply()
        }
    }

    override suspend fun refreshAccessToken(): String? {
        val refreshToken = prefs.getString(KEY_REFRESH_TOKEN, null) ?: return null
        // The actual refresh logic is handled by the auth screen/ViewModel
        // This just returns the cached access token if still valid
        return getAccessToken()
    }

    override suspend fun clearTokens() {
        prefs.edit().clear().apply()
    }

    override suspend fun isLoggedIn(): Boolean {
        return getAccessToken() != null || prefs.getString(KEY_REFRESH_TOKEN, null) != null
    }

    fun getOAuthCodeVerifier(): String {
        val existing = prefs.getString(KEY_CODE_VERIFIER, null)
        if (existing != null) return existing

        val bytes = ByteArray(128)
        java.security.SecureRandom().nextBytes(bytes)
        val verifier = android.util.Base64.encodeToString(
            bytes,
            android.util.Base64.URL_SAFE or android.util.Base64.NO_WRAP or android.util.Base64.NO_PADDING,
        )
        prefs.edit().putString(KEY_CODE_VERIFIER, verifier).apply()
        return verifier
    }

    companion object {
        private const val KEY_ACCESS_TOKEN = "access_token"
        private const val KEY_REFRESH_TOKEN = "refresh_token"
        private const val KEY_ACCESS_EXPIRES = "access_expires"
        private const val KEY_CODE_VERIFIER = "code_verifier"
    }
}
