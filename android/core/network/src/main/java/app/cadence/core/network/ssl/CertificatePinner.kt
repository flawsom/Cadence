package app.cadence.core.network.ssl

import okhttp3.CertificatePinner

/**
 * Certificate pinning for Cadence API.
 * Backup pin ensures resilience if the primary cert rotates.
 */
object CadenceCertificatePinner {
    // SHA-256 pin of the primary certificate
    private const val PRIMARY_PIN =
        "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" // Replace with real pin
    // Backup pin
    private const val BACKUP_PIN =
        "sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=" // Replace with real pin

    fun create(): CertificatePinner = CertificatePinner.Builder()
        .add("api.cadence.app", PRIMARY_PIN)
        .add("api.cadence.app", BACKUP_PIN)
        .add("blessed-mosquito-123.convex.cloud", PRIMARY_PIN)
        .add("blessed-mosquito-123.convex.cloud", BACKUP_PIN)
        .build()
}
