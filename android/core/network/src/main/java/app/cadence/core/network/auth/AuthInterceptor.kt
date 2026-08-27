package app.cadence.core.network.auth

import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

/**
 * OkHttp interceptor that attaches the Bearer token to every request
 * and handles 401 → refresh → retry transparently.
 */
@Singleton
class AuthInterceptor @Inject constructor(
    private val tokenProvider: TokenProvider,
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()

        // Skip auth for token endpoints
        if (original.url.encodedPath.contains("/auth/")) {
            return chain.proceed(original)
        }

        val token = runBlocking { tokenProvider.getAccessToken() }
            ?: return chain.proceed(original)

        val authenticated = original.newBuilder()
            .header("Authorization", "Bearer $token")
            .build()

        val response = chain.proceed(authenticated)

        // If 401, try refreshing the token once
        if (response.code == 401) {
            response.close()
            val refreshed = runBlocking {
                tokenProvider.refreshAccessToken()
            }
            if (refreshed != null) {
                val retry = original.newBuilder()
                    .header("Authorization", "Bearer $refreshed")
                    .build()
                return chain.proceed(retry)
            }
        }

        return response
    }
}
