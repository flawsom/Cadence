package unifies.cadence.core.common.theme

import android.os.Build
import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

// ── Static composition locals for design tokens not covered by M3 ─────────
val LocalStatusColors = staticCompositionLocalOf {
    StatusColors(
        onTrack = StatusOnTrack,
        behind = StatusBehind,
        reviewDue = StatusReviewDue,
        completed = StatusCompleted
    )
}

data class StatusColors(
    val onTrack: Color,
    val behind: Color,
    val reviewDue: Color,
    val completed: Color,
)

// ── Level colors ───────────────────────────────────────────────────────────
object LevelColors {
    val foundations = LevelFoundations
    val core = LevelCore
    val advanced = LevelAdvanced

    fun forLevel(level: String): Color = when (level.lowercase()) {
        "foundations" -> foundations
        "core" -> core
        "advanced" -> advanced
        else -> LevelCore
    }
}

// ── Light color scheme ─────────────────────────────────────────────────────
private val LightColorScheme = lightColorScheme(
    primary = CadenceTerracotta,
    onPrimary = Color.White,
    primaryContainer = CadenceTerracottaLight,
    onPrimaryContainer = Color(0xFF3B0E05),
    secondary = Color(0xFF6B8F71),
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFD7E8D9),
    onSecondaryContainer = Color(0xFF0E2412),
    tertiary = Color(0xFF7B61C4),
    onTertiary = Color.White,
    tertiaryContainer = Color(0xFFEDE5FF),
    onTertiaryContainer = Color(0xFF1C0056),
    background = SurfaceLight,
    onBackground = Color(0xFF1C1B19),
    surface = SurfaceLight,
    onSurface = Color(0xFF1C1B19),
    surfaceVariant = SurfaceVariantLight,
    onSurfaceVariant = Color(0xFF494541),
    outline = Color(0xFF7A7571),
    outlineVariant = Color(0xFFCBC4BF),
    error = Color(0xFFBA1A1A),
    onError = Color.White,
    errorContainer = Color(0xFFFFDAD6),
    onErrorContainer = Color(0xFF410002),
    scrim = OverlayScrim,
)

// ── Dark color scheme ──────────────────────────────────────────────────────
private val DarkColorScheme = darkColorScheme(
    primary = CadenceTerracottaDark,
    onPrimary = Color(0xFF5F1708),
    primaryContainer = Color(0xFF7E2E18),
    onPrimaryContainer = CadenceTerracottaLight,
    secondary = Color(0xFFA5CCAB),
    onSecondary = Color(0xFF1E3722),
    secondaryContainer = Color(0xFF354E39),
    onSecondaryContainer = Color(0xFFC1E4C7),
    tertiary = Color(0xFFC9B8FF),
    onTertiary = Color(0xFF312070),
    tertiaryContainer = Color(0xFF48378A),
    onTertiaryContainer = Color(0xFFEDE5FF),
    background = SurfaceDark,
    onBackground = Color(0xFFE6E1DC),
    surface = SurfaceDark,
    onSurface = Color(0xFFE6E1DC),
    surfaceVariant = SurfaceVariantDark,
    onSurfaceVariant = Color(0xFFD9CFC9),
    outline = Color(0xFF948F89),
    outlineVariant = Color(0xFF494541),
    error = Color(0xFFFFB4AB),
    onError = Color(0xFF690005),
    errorContainer = Color(0xFF93000A),
    onErrorContainer = Color(0xFFFFDAD6),
    scrim = OverlayScrim,
)

// ── Theme composable ───────────────────────────────────────────────────────
@Composable
fun CadenceTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = false, // Off by default per spec
    content: @Composable () -> Unit,
) {
    val colorScheme = when {
        // Dynamic Color (Material You) — opt-in only
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as android.app.Activity).window
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
            window.statusBarColor = Color.Transparent.toArgb()
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = CadenceTypography,
        shapes = CadenceShapes,
        content = content,
    )
}
