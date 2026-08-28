package unifies.cadence.core.security

import android.content.Context
import android.os.Build
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Biometric authentication helper.
 * Uses CryptoObject with AES/GCM/NoPadding backed by AndroidKeyStore.
 * Falls back to device credential if biometrics are unavailable.
 */
@Singleton
class BiometricHelper @Inject constructor(
    @ApplicationContext private val context: Context,
) {

    private val biometricManager by lazy { BiometricManager.from(context) }

    fun canAuthenticate(): Boolean {
        return biometricManager.canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG or
                BiometricManager.Authenticators.DEVICE_CREDENTIAL
        ) == BiometricManager.BIOMETRIC_SUCCESS
    }

    fun authenticate(
        activity: FragmentActivity,
        title: String = "Authenticate",
        subtitle: String = "Verify your identity to continue",
        onSuccess: (Cipher) -> Unit,
        onError: (Int, String) -> Unit = { _, _ -> },
        onFailed: () -> Unit = {},
    ) {
        val executor = ContextCompat.getMainExecutor(context)

        val callback = object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                super.onAuthenticationSucceeded(result)
                val cipher = result.cryptoObject?.cipher
                if (cipher != null) {
                    onSuccess(cipher)
                } else {
                    onFailed()
                }
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                super.onAuthenticationError(errorCode, errString)
                onError(errorCode, errString.toString())
            }

            override fun onAuthenticationFailed() {
                super.onAuthenticationFailed()
                onFailed()
            }
        }

        val prompt = BiometricPrompt(activity, executor, callback)

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setAllowedAuthenticators(
                BiometricManager.Authenticators.BIOMETRIC_STRONG or
                    BiometricManager.Authenticators.DEVICE_CREDENTIAL
            )
            .build()

        // Create CryptoObject if biometrics are enrolled
        val cryptoObject = if (canAuthenticate()) {
            try {
                val key = getOrCreateKey()
                val cipher = Cipher.getInstance(TRANSFORMATION)
                cipher.init(Cipher.ENCRYPT_MODE, key, GCMParameterSpec(128, IV))
                BiometricPrompt.CryptoObject(cipher)
            } catch (e: Exception) {
                null
            }
        } else {
            null
        }

        if (cryptoObject != null) {
            prompt.authenticate(promptInfo, cryptoObject)
        } else {
            prompt.authenticate(promptInfo)
        }
    }

    private fun getOrCreateKey(): SecretKey {
        val keyStore = java.security.KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        keyStore.getEntry(KEY_ALIAS, null)?.let {
            return (it as java.security.KeyStore.SecretKeyEntry).secretKey
        }

        val keyGen = KeyGenerator.getInstance(
            "AES",
            "AndroidKeyStore",
        ).apply {
            init(
                android.security.keystore.KeyGenParameterSpec.Builder(
                    KEY_ALIAS,
                    android.security.keystore.KeyProperties.PURPOSE_ENCRYPT or android.security.keystore.KeyProperties.PURPOSE_DECRYPT,
                )
                    .setBlockModes(android.security.keystore.KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(android.security.keystore.KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(256)
                    .setUserAuthenticationRequired(false) // Biometric gating is at prompt level
                    .apply {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                            setInvalidatedByBiometricEnrollment(true)
                        }
                    }
                    .build(),
            )
        }
        return keyGen.generateKey()
    }

    companion object {
        private const val KEY_ALIAS = "cadence_bio_key"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
        private val IV = ByteArray(12) { (it + 1).toByte() }
    }
}
