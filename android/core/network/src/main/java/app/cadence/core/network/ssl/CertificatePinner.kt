package app.cadence.core.network.ssl

import okhttp3.CertificatePinner

/**
 * Certificate pinning for Cadence API.
 * Backup pin ensures resilience if the primary cert rotates.
 */
object CadenceCertificatePinner {
    /**
     * Certificate pins for production API endpoints.
     * 
     * To get real pins, run:
     *   openssl s_client -connect api.cadence.app:443 < /dev/null 2>/dev/null | \
     *     openssl x509 -pubkey -noout | openssl pkey -pubin -outform der | \
     *     openssl dgst -sha256 -binary | base64
     * 
     * For Convex endpoints, check their docs for pinning guidance.
     * Pins below are placeholders — replace before production release.
     */
    private const val PRIMARY_PIN =
        "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" // TODO: Replace with real pin
    private const val BACKUP_PIN =
        "sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=" // TODO: Replace with real backup pin

    fun create(): CertificatePinner = CertificatePinner.Builder()
        .add("api.cadence.app", PRIMARY_PIN)
        .add("api.cadence.app", BACKUP_PIN)
        .add("blessed-mosquito-123.convex.cloud", PRIMARY_PIN)
        .add("blessed-mosquito-123.convex.cloud", BACKUP_PIN)
        .build()
}
