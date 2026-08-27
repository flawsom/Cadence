package com.cadence.app.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

// ── Brand Colors (per PRD §5) ─────────────────────────────────────────

// Terracotta seed — run through Material Color Utilities
val Terracotta = Color(0xFFB5533C)
val TerracottaLight = Color(0xFFD4775E)
val TerracottaDark = Color(0xFF8A3D2B)

// Forest green — on-pace and completed states
val ForestGreen = Color(0xFF3F6F52)
val ForestGreenLight = Color(0xFF5A9A6F)

// Amber — behind-pace or caution (NOT red per P5)
val CautionAmber = Color(0xFFA4772A)
val CautionAmberLight = Color(0xFFC99B3E)

// Surface
val WarmWhite = Color(0xFFFDFCFA)
val WarmDarkSurface = Color(0xFF1C1B1A)

// ── Light Scheme ───────────────────────────────────────────────────────

private val LightColorScheme = lightColorScheme(
    primary = Terracotta,
    onPrimary = Color.White,
    primaryContainer = TerracottaLight,
    onPrimaryContainer = TerracottaDark,

    secondary = ForestGreen,
    onSecondary = Color.White,
    secondaryContainer = ForestGreenLight,
    onSecondaryContainer = Color(0xFF1B3624),

    tertiary = CautionAmber,
    onTertiary = Color.White,
    tertiaryContainer = CautionAmberLight,
    onTertiaryContainer = Color(0xFF3D2E0F),

    background = WarmWhite,
    onBackground = Color(0xFF1C1B1A),
    surface = WarmWhite,
    onSurface = Color(0xFF1C1B1A),
    surfaceVariant = Color(0xFFF5F0ED),
    onSurfaceVariant = Color(0xFF4A4543),

    error = Color(0xFFBA1A1A),
    onError = Color.White,
)

// ── Dark Scheme ────────────────────────────────────────────────────────

private val DarkColorScheme = darkColorScheme(
    primary = TerracottaLight,
    onPrimary = TerracottaDark,
    primaryContainer = Terracotta,
    onPrimaryContainer = Color(0xFFFFDBD1),

    secondary = ForestGreenLight,
    onSecondary = Color(0xFF1B3624),
    secondaryContainer = ForestGreen,
    onSecondaryContainer = Color(0xFFC8E8D2),

    tertiary = CautionAmberLight,
    onTertiary = Color(0xFF3D2E0F),
    tertiaryContainer = CautionAmber,
    onTertiaryContainer = Color(0xFFFFDEA1),

    background = WarmDarkSurface,
    onBackground = Color(0xFFE8E2DF),
    surface = WarmDarkSurface,
    onSurface = Color(0xFFE8E2DF),
    surfaceVariant = Color(0xFF2A2523),
    onSurfaceVariant = Color(0xFFCCC4C1),

    error = Color(0xFFFFB4AB),
    onError = Color(0xFF690005),
)

// ── Dynamic Color (Material You) — opt-in per PRD §5 ──────────────────

@Composable
fun CadenceTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = false, // Off by default per PRD §5
    content: @Composable () -> Unit,
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context)
            else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = CadenceTypography,
        content = content,
    )
}
