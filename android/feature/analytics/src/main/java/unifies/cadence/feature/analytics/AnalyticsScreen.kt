package unifies.cadence.feature.analytics

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import unifies.cadence.core.common.theme.CadenceEmber
import unifies.cadence.core.common.theme.CadenceTerracotta
import unifies.cadence.core.common.theme.StatusBehind
import unifies.cadence.core.common.theme.StatusOnTrack
import unifies.cadence.core.common.theme.StatusReviewDue
import unifies.cadence.core.common.util.DateUtil

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AnalyticsScreen(viewModel: AnalyticsViewModel) {
    val state by viewModel.state.collectAsState()

    Scaffold(
        topBar = { TopAppBar(title = { Text("Analytics") }) },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // ── Stats Grid ──────────────────────────────────────
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                StatTile("🔥", "Streak", "${state.stats.streak} days", CadenceEmber, Modifier.weight(1f))
                StatTile("🏆", "Best", "${state.stats.longestStreak} days", StatusOnTrack, Modifier.weight(1f))
                StatTile("📚", "Total", "${String.format("%.1f", state.stats.totalHours)}h", StatusReviewDue, Modifier.weight(1f))
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                StatTile("✅", "Done", "${state.stats.totalTasksCompleted}", StatusOnTrack, Modifier.weight(1f))
                StatTile("🔄", "Reviews", "${state.stats.reviewsDueToday}", StatusReviewDue, Modifier.weight(1f))
                StatTile("📋", "Plans", "${state.stats.activePlans}", CadenceEmber, Modifier.weight(1f))
            }

            // ── Chart Toggle ────────────────────────────────────
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = state.viewMode == AnalyticsViewMode.HEATMAP,
                    onClick = { viewModel.setViewMode(AnalyticsViewMode.HEATMAP) },
                    label = { Text("Heatmap") },
                )
                FilterChip(
                    selected = state.viewMode == AnalyticsViewMode.TREND,
                    onClick = { viewModel.setViewMode(AnalyticsViewMode.TREND) },
                    label = { Text("Trend") },
                )
            }

            // ── Heatmap ─────────────────────────────────────────
            if (state.viewMode == AnalyticsViewMode.HEATMAP && state.heatmap.isNotEmpty()) {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp)) {
                        Text("Activity (119 days)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.height(12.dp))
                        FullHeatmap(state.heatmap)
                        Spacer(Modifier.height(8.dp))
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Less", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                listOf(0.0f, 0.2f, 0.4f, 0.6f, 0.9f).forEach { alpha ->
                                    Surface(
                                        color = CadenceEmber.copy(alpha = alpha.coerceAtLeast(0.1f)),
                                        shape = RoundedCornerShape(3.dp),
                                        modifier = Modifier.size(14.dp),
                                    ) {}
                                }
                            }
                            Text("More", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }

            // ── Trend ───────────────────────────────────────────
            if (state.viewMode == AnalyticsViewMode.TREND && state.trend.isNotEmpty()) {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp)) {
                        Text("30-Day Trend", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.height(12.dp))
                        FullTrendChart(state.trend)
                    }
                }
            }

            // ── Streak Visualization ────────────────────────────
            if (state.stats.streak > 0) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = CadenceEmber.copy(alpha = 0.08f)),
                ) {
                    Column(Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("🔥", style = MaterialTheme.typography.displaySmall)
                        Text(
                            "${state.stats.streak}-day streak",
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold,
                            color = CadenceEmber,
                        )
                        Text(
                            "Best: ${state.stats.longestStreak} days",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(8.dp))
                        LinearProgressIndicator(
                            progress = { (state.stats.streak.toFloat() / maxOf(state.stats.longestStreak, 1)).coerceIn(0f, 1f) },
                            modifier = Modifier.width(120.dp).height(8.dp).clip(RoundedCornerShape(4.dp)),
                            color = CadenceEmber,
                            trackColor = CadenceEmber.copy(alpha = 0.15f),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun StatTile(emoji: String, label: String, value: String, color: androidx.compose.ui.graphics.Color, modifier: Modifier) {
    Card(modifier = modifier) {
        Column(
            modifier = Modifier.padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(emoji, style = MaterialTheme.typography.titleLarge)
            Spacer(Modifier.height(4.dp))
            Text(value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = color)
            Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun FullHeatmap(data: List<unifies.cadence.core.common.model.HeatmapDay>) {
    val maxMinutes = data.maxOfOrNull { it.minutes }?.coerceAtLeast(1) ?: 1
    val cellSize = 14.dp
    val gap = 3.dp
    val weeks = data.chunked(7)

    Canvas(
        modifier = Modifier
            .fillMaxWidth()
            .height((weeks.size * (cellSize + gap)).coerceAtMost(200.dp)),
    ) {
        weeks.forEachIndexed { weekIdx, week ->
            week.forEachIndexed { dayIdx, day ->
                val intensity = day.minutes.toFloat() / maxMinutes
                val color = when {
                    intensity == 0f -> androidx.compose.ui.graphics.Color.LightGray.copy(alpha = 0.2f)
                    intensity < 0.25f -> CadenceEmber.copy(alpha = 0.2f)
                    intensity < 0.5f -> CadenceEmber.copy(alpha = 0.4f)
                    intensity < 0.75f -> CadenceEmber.copy(alpha = 0.6f)
                    else -> CadenceEmber.copy(alpha = 0.9f)
                }
                drawRect(
                    color = color,
                    topLeft = Offset(weekIdx * (cellSize.toPx() + gap.toPx()), dayIdx * (cellSize.toPx() + gap.toPx())),
                    size = Size(cellSize.toPx(), cellSize.toPx()),
                )
            }
        }
    }
}

@Composable
private fun FullTrendChart(data: List<unifies.cadence.core.common.model.TrendPoint>) {
    if (data.isEmpty()) return
    val maxTasks = data.maxOfOrNull { it.tasksCompleted }?.coerceAtLeast(1) ?: 1

    Canvas(
        modifier = Modifier
            .fillMaxWidth()
            .height(150.dp),
    ) {
        val stepX = size.width / (data.size - 1).coerceAtLeast(1)
        val points = data.mapIndexed { idx, point ->
            Offset(idx * stepX, size.height * (1f - point.tasksCompleted.toFloat() / maxTasks))
        }
        for (i in 0 until points.size - 1) {
            drawLine(CadenceEmber, points[i], points[i + 1], 3f, cap = StrokeCap.Round)
        }
        points.forEach { drawCircle(CadenceEmber, 5f, it) }
    }
}
