package unifies.cadence.feature.trackdetail

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Download
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import unifies.cadence.core.common.theme.CadenceEmber
import unifies.cadence.core.common.theme.LevelColors
import unifies.cadence.core.common.theme.StatusOnTrack
import unifies.cadence.core.common.util.DateUtil

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TrackScreen(
    viewModel: TrackViewModel,
    onBack: () -> Unit,
    onExportFlashcards: (String) -> Unit,
) {
    val state by viewModel.state.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(state.board?.planTitle ?: "Plan") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") }
                },
                actions = {
                    IconButton(onClick = { onExportFlashcards(state.board?.planTitle ?: "") }) {
                        Icon(Icons.Default.Download, "Export flashcards")
                    }
                },
            )
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // ── Plan summary ────────────────────────────────────
            state.board?.let { board ->
                item {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(16.dp)) {
                            Text(board.planTitle, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                            Spacer(Modifier.height(8.dp))
                            LinearProgressIndicator(
                                progress = { (board.completionPercent / 100.0).coerceIn(0.0, 1.0).toFloat() },
                                modifier = Modifier.fillMaxWidth().height(10.dp).clip(RoundedCornerShape(5.dp)),
                                color = StatusOnTrack,
                            )
                            Spacer(Modifier.height(4.dp))
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("${board.completedHours}h / ${board.totalHours}h", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text("${String.format("%.0f", board.completionPercent)}%", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold, color = StatusOnTrack)
                            }
                        }
                    }
                }

                // ── Burn-up chart ──────────────────────────────
                item {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(16.dp)) {
                            Text("Burn-up", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                            Spacer(Modifier.height(8.dp))
                            BurnUpChart(board)
                        }
                    }
                }

                // ── Topics ──────────────────────────────────────
                item {
                    Text("Topics", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                }

                items(board.topics) { topic ->
                    TopicCard(topic)
                }

                // ── Schedule ────────────────────────────────────
                if (board.schedule.isNotEmpty()) {
                    item {
                        Text("Schedule", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    }
                    items(board.schedule) { day ->
                        DayScheduleCard(day)
                    }
                }
            }

            // ── Loading ────────────────────────────────────────
            if (state.isLoading) {
                items(4) {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(16.dp)) {
                            Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = RoundedCornerShape(4.dp), modifier = Modifier.fillMaxWidth(0.6f).height(16.dp)) {}
                            Spacer(Modifier.height(8.dp))
                            Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = RoundedCornerShape(4.dp), modifier = Modifier.fillMaxWidth(0.4f).height(12.dp)) {}
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TopicCard(topic: unifies.cadence.core.common.model.TopicProgress) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Surface(
                color = LevelColors.forLevel(topic.level).copy(alpha = 0.15f),
                shape = MaterialTheme.shapes.extraSmall,
            ) {
                Text(
                    text = topic.level.uppercase().take(1),
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                    style = MaterialTheme.typography.labelSmall,
                    color = LevelColors.forLevel(topic.level),
                    fontWeight = FontWeight.Bold,
                )
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(topic.title, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                Text("${topic.completedHours}h / ${topic.estimatedHours}h", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            LinearProgressIndicator(
                progress = { (topic.completionPercent / 100.0).coerceIn(0.0, 1.0).toFloat() },
                modifier = Modifier.width(60.dp).height(6.dp).clip(RoundedCornerShape(3.dp)),
                color = LevelColors.forLevel(topic.level),
            )
        }
    }
}

@Composable
private fun DayScheduleCard(day: unifies.cadence.core.common.model.DaySchedule) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Day ${day.dayNumber}", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                Text(DateUtil.display(DateUtil.parse(day.date)), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Spacer(Modifier.height(4.dp))
            Text("${day.tasks.size} tasks · ${DateUtil.minutesToDisplay(day.totalMinutes)}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            day.tasks.forEach { task ->
                Row(Modifier.padding(top = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Surface(
                        color = when (task.status) {
                            "completed" -> StatusOnTrack
                            else -> MaterialTheme.colorScheme.surfaceVariant
                        },
                        shape = RoundedCornerShape(3.dp),
                        modifier = Modifier.size(6.dp),
                    ) {}
                    Spacer(Modifier.width(8.dp))
                    Text(task.topicTitle, style = MaterialTheme.typography.bodySmall, maxLines = 1)
                }
            }
        }
    }
}

@Composable
private fun BurnUpChart(board: unifies.cadence.core.common.model.TrackBoard) {
    if (board.schedule.isEmpty()) return
    val totalTasks = board.topicCount.toFloat().coerceAtLeast(1f)

    Canvas(modifier = Modifier.fillMaxWidth().height(120.dp)) {
        val stepX = size.width / (board.schedule.size - 1).coerceAtLeast(1)

        // Ideal line (straight)
        drawLine(
            Color.LightGray,
            Offset(0f, size.height),
            Offset(size.width, 0f),
            strokeWidth = 2f,
            pathEffect = androidx.compose.ui.graphics.PathEffect.dashPathEffect(floatArrayOf(8f, 8f)),
        )

        // Actual line
        var completed = 0f
        val points = board.schedule.mapIndexed { idx, day ->
            completed += day.tasks.count { it.status == "completed" }.toFloat()
            Offset(idx * stepX, size.height * (1f - completed / totalTasks))
        }
        for (i in 0 until points.size - 1) {
            drawLine(CadenceEmber, points[i], points[i + 1], 3f, cap = StrokeCap.Round)
        }
        points.forEach { drawCircle(CadenceEmber, 4f, it) }
    }
}
