package unifies.cadence.core.network.ssl

import okhttp3.CertificatePinner

/**
 * Certificate pinning for Cadence API.
 * Backup pin ensures resilience if the primary cert rotates.
 */
object CadenceCertificatePinner {
    // Real SHA-256 pins fetched 2026-08-27 from blessed-mosquito-123.convex.cloud
    // Leaf: convex.cloud (Google Trust Services / WE1)
    private const val LEAF_PIN =
        "sha256/0q8hxMJlQn6kNSxP/WsBd+kJucvhRHja0ysHaI/VZmc="
    // Intermediate: WE1 (Google Trust Services / GTS Root R4)
    private const val INTERMEDIATE_PIN =
        "sha256/kIdp6NNEd8wsugYyyIYFsi1ylMCED3hZbSR8ZFsa/A4="

    fun create(): CertificatePinner = CertificatePinner.Builder()
        .add("blessed-mosquito-123.convex.cloud", LEAF_PIN, INTERMEDIATE_PIN)
        .build()
}
