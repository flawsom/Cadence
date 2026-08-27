package app.cadence.core.network.auth

/**
 * Abstraction over token storage and refresh.
 * Implemented in core:security with EncryptedSharedPreferences.
 */
interface TokenProvider {
    suspend fun getAccessToken(): String?
    suspend fun getRefreshToken(): String?
    suspend fun saveTokens(accessToken: String, refreshToken: String, expiresIn: Long)
    suspend fun refreshAccessToken(): String?
    suspend fun clearTokens()
    suspend fun isLoggedIn(): Boolean
}
