plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.ksp)
}

android {
    namespace = "unifies.cadence.core.security"
    compileSdk = 36
    defaultConfig { minSdk = 28 }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_21
        targetCompatibility = JavaVersion.VERSION_21
    }
    kotlinOptions { jvmTarget = "21" }
}

dependencies {
    api(project(":core:common"))
    api(project(":core:network"))

    implementation(libs.encrypted.shared.prefs)
    implementation(libs.biometric)
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.core.ktx)
}
