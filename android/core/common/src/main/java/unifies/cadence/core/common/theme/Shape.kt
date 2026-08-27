package unifies.cadence.core.common.theme

import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import androidx.compose.ui.unit.dp

// ── Expressive Shape System ────────────────────────────────────────────────
// 4dp–50% family. Checkbox morphs RoundedSquare → Circle on completion.
val CadenceShapes = Shapes(
    extraSmall = RoundedCornerShape(4.dp),
    small = RoundedCornerShape(8.dp),
    medium = RoundedCornerShape(12.dp),
    large = RoundedCornerShape(16.dp),
    extraLarge = RoundedCornerShape(24.dp),
    // Expressive overrides
    medium = RoundedCornerShape(20.dp),
)

// ── State-dependent shapes ─────────────────────────────────────────────────
// Used for task checkbox morph animation (square → circle)
object CadenceTaskShapes {
    val unchecked = RoundedCornerShape(6.dp)      // Rounded square
    val checked = CircleShape                      // Circle on completion
}

// ── Card shapes ────────────────────────────────────────────────────────────
object CadenceCardShapes {
    val card = RoundedCornerShape(16.dp)
    val chip = RoundedCornerShape(12.dp)
    val bottomSheet = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
    val dialog = RoundedCornerShape(28.dp)
}
