package unifies.cadence.feature.today

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
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
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import unifies.cadence.core.common.theme.CadenceEmber
import unifies.cadence.core.common.theme.StatusBehind
import unifies.cadence.core.common.theme.StatusOnTrack
import unifies.cadence.core.common.theme.StatusReviewDue
import unifies.cadence.core.common.util.DateUtil

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TodayScreen(
    viewModel: TodayViewModel,
    onTaskClick: (String) -> Unit,
    onPlanClick: (String) -> Unit,
) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.loadToday()
    }

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = {
                Column {
                    Text(
                        text = "${state.greeting} 👋",
                        style = MaterialTheme.typography.headlineSmall,
                    )
                    Text(
                        text = DateUtil.todayWeekday(),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            },
        )

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(
                start = 16.dp, end = 16.dp, bottom = 100.dp,
            ),
        ) {
            // ── Stats Row ──────────────────────────────────────────
            item {
                StatsRow(state.stats)
            }

            // ── Streak ─────────────────────────────────────────────
            if (state.stats.streak > 0) {
                item {
                    StreakBadge(state.stats)
                }
            }

            // ── Reviews Due Card ───────────────────────────────────
            val reviewsDue = state.tasks.filter { it.kind == "review" && it.status == "pending" }
            if (reviewsDue.isNotEmpty()) {
                item {
                    ReviewTodayCard(
                        reviews = reviewsDue,
                        onReviewClick = onTaskClick,
                    )
                }
            }

            // ── Rollover Banner ────────────────────────────────────
            if (state.rolloverTasks.isNotEmpty()) {
                item {
                    RolloverBanner(count = state.rolloverTasks.size)
                }
            }

            // ── Heatmap / Trend Toggle ─────────────────────────────
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                    ),
                ) {
                    Column(Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                "Progress",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold,
                            )
                            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                FilterChip(
                                    selected = state.showHeatmap,
                                    onClick = { viewModel.toggleChartView() },
                                    label = { Text("Heatmap") },
                                    leadingIcon = {
                                        Icon(Icons.Default.CalendarMonth, null, Modifier.size(16.dp))
                                    },
                                )
                                FilterChip(
                                    selected = !state.showHeatmap,
                                    onClick = { viewModel.toggleChartView() },
                                    label = { Text("Trend") },
                                    leadingIcon = {
                                        Icon(Icons.Default.TrendingUp, null, Modifier.size(16.dp))
                                    },
                                )
                            }
                        }

                        Spacer(Modifier.height(12.dp))

                        AnimatedContent(
                            targetState = state.showHeatmap,
                            transitionSpec = {
                                fadeIn(tween(200)) togetherWith fadeOut(tween(200))
                            },
                            label = "chart",
                        ) { showHeatmap ->
                            if (showHeatmap) {
                                HeatmapChart(state.heatmap)
                            } else {
                                TrendChart(state.trend)
                            }
                        }
                    }
                }
            }

            // ── Tasks ──────────────────────────────────────────────
            val grouped = state.tasks
                .filter { it.kind != "review" } // reviews shown in card above
                .groupBy { it.kind }

            grouped.forEach { (kind, tasks) ->
                item {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(top = 8.dp),
                    ) {
                        Icon(
                            when (kind) {
                                "learn" -> Icons.Default.School
                                "practice" -> Icons.AutoMirrored.Filled.List
                                else -> Icons.Default.School
                            },
                            null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(20.dp),
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(
                            text = kind.replaceFirstChar { it.uppercase() },
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }

                items(tasks, key = { it.taskId }) { task ->
                    TaskItem(
                        task = task,
                        onClick = { onTaskClick(task.taskId) },
                        onComplete = { viewModel.completeTask(task.taskId) },
                        onSkip = { viewModel.skipTask(task.taskId) },
                    )
                }
            }

            // ── Empty state ────────────────────────────────────────
            if (state.tasks.isEmpty() && !state.isLoading) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 48.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                Icons.Default.CheckCircle,
                                null,
                                modifier = Modifier.size(64.dp),
                                tint = StatusOnTrack.copy(alpha = 0.5f),
                            )
                            Spacer(Modifier.height(12.dp))
                            Text(
                                "All done for today!",
                                style = MaterialTheme.typography.titleLarge,
                            )
                            Text(
                                "No tasks scheduled. Enjoy your free time.",
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }

            // ── Loading shimmer ────────────────────────────────────
            if (state.isLoading) {
                items(4) {
                    LoadingShimmer()
                }
            }
        }
    }
}

@Composable
private fun StatsRow(stats: Stats) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        StatCard(
            icon = Icons.Default.LocalFireDepartment,
            value = "${stats.streak}",
            label = "Streak",
            color = CadenceEmber,
            modifier = Modifier.weight(1f),
        )
        StatCard(
            icon = Icons.Default.Repeat,
            value = "${stats.reviewsDueToday}",
            label = "Reviews",
            color = StatusReviewDue,
            modifier = Modifier.weight(1f),
        )
        StatCard(
            icon = Icons.Default.School,
            value = "${String.format("%.1f", stats.totalHours)}h",
            label = "Total",
            color = StatusOnTrack,
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun StatCard(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    value: String,
    label: String,
    color: Color,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(
            containerColor = color.copy(alpha = 0.08f),
        ),
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Icon(icon, null, tint = color, modifier = Modifier.size(24.dp))
            Spacer(Modifier.height(4.dp))
            Text(
                text = value,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = color,
            )
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun StreakBadge(stats: Stats) {
    val infiniteTransition = rememberInfiniteTransition(label = "streak")
    val scale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.05f,
        animationSpec = infiniteRepeatable(
            animation = tween(2000, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "pulse",
    )

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = CadenceEmber.copy(alpha = 0.1f),
        ),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "🔥",
                style = MaterialTheme.typography.displaySmall,
                modifier = Modifier
                    .padding(8.dp)
                    .let { mod ->
                        mod
                    },
            )
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    text = "${stats.streak}-day streak",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    text = "Best: ${stats.longestStreak} days",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (stats.streak > 0) {
                LinearProgressIndicator(
                    progress = { (stats.streak.toFloat() / maxOf(stats.longestStreak, 1)).coerceIn(0f, 1f) },
                    modifier = Modifier
                        .width(80.dp)
                        .height(6.dp)
                        .clip(RoundedCornerShape(3.dp)),
                    color = CadenceEmber,
                    trackColor = CadenceEmber.copy(alpha = 0.15f),
                )
            }
        }
    }
}

@Composable
private fun ReviewTodayCard(
    reviews: List<unifies.cadence.core.common.model.ScheduleTask>,
    onReviewClick: (String) -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = StatusReviewDue.copy(alpha = 0.08f),
        ),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Default.Repeat,
                    null,
                    tint = StatusReviewDue,
                    modifier = Modifier.size(20.dp),
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    "${reviews.size} topic${if (reviews.size > 1) "s" else ""} due for review",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
            }

            Spacer(Modifier.height(8.dp))

            reviews.take(5).forEach { review ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onReviewClick(review.taskId) }
                        .padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Surface(
                        color = StatusReviewDue.copy(alpha = 0.15f),
                        shape = MaterialTheme.shapes.extraSmall,
                    ) {
                        Text(
                            text = review.reviewStage ?: "Review",
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                            style = MaterialTheme.typography.labelSmall,
                            color = StatusReviewDue,
                        )
                    }
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = review.topicTitle,
                        style = MaterialTheme.typography.bodyMedium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }

            if (reviews.size > 5) {
                Text(
                    "+${reviews.size - 5} more",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
    }
}

@Composable
private fun RolloverBanner(count: Int) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = StatusBehind.copy(alpha = 0.08f),
        ),
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                Icons.Default.Repeat,
                null,
                tint = StatusBehind,
                modifier = Modifier.size(20.dp),
            )
            Spacer(Modifier.width(8.dp))
            Text(
                text = "$count task${if (count > 1) "s" else ""} carried over from previous day${if (count > 1) "s" else ""}",
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TaskItem(
    task: unifies.cadence.core.common.model.ScheduleTask,
    onClick: () -> Unit,
    onComplete: () -> Unit,
    onSkip: () -> Unit,
) {
    val dismissState = rememberSwipeToDismissBoxState(
        confirmValueChange = { value ->
            when (value) {
                SwipeToDismissBoxValue.EndToStart -> {
                    onSkip()
                    true
                }
                SwipeToDismissBoxValue.StartToEnd -> {
                    onComplete()
                    true
                }
                else -> false
            }
        },
    )

    val haptic = LocalHapticFeedback.current

    SwipeToDismissBox(
        state = dismissState,
        backgroundContent = {
            val direction = dismissState.dismissDirection

            val color by animateColorAsState(
                when (dismissState.targetValue) {
                    SwipeToDismissBoxValue.StartToEnd -> StatusOnTrack
                    SwipeToDismissBoxValue.EndToStart -> StatusBehind
                    else -> Color.Transparent
                },
                label = "swipe",
            )

            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .clip(RoundedCornerShape(12.dp))
                    .background(color)
                    .padding(horizontal = 20.dp),
                contentAlignment = when (direction) {
                    SwipeToDismissBoxValue.StartToEnd -> Alignment.CenterStart
                    else -> Alignment.CenterEnd
                },
            ) {
                Icon(
                    if (direction == SwipeToDismissBoxValue.StartToEnd) Icons.Default.CheckCircle
                    else Icons.Default.Repeat,
                    contentDescription = null,
                    tint = Color.White,
                )
            }
        },
        enableDismissFromStartToEnd = true,
        enableDismissFromEndToStart = true,
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .clickable {
                    haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    onClick()
                },
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // Status indicator
                Surface(
                    color = when (task.status) {
                        "completed" -> StatusOnTrack
                        "skipped" -> StatusBehind
                        else -> MaterialTheme.colorScheme.surfaceVariant
                    },
                    shape = RoundedCornerShape(6.dp),
                    modifier = Modifier.size(8.dp),
                ) {}

                Spacer(Modifier.width(12.dp))

                Column(Modifier.weight(1f)) {
                    Text(
                        text = task.topicTitle,
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Medium,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(
                            text = DateUtil.minutesToDisplay(task.estimatedMinutes),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        if (task.isRollover || task.isCarriedOver) {
                            Surface(
                                color = StatusBehind.copy(alpha = 0.1f),
                                shape = MaterialTheme.shapes.extraSmall,
                            ) {
                                Text(
                                    "Rollover",
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = StatusBehind,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun HeatmapChart(data: List<unifies.cadence.core.common.model.HeatmapDay>) {
    if (data.isEmpty()) return

    val maxMinutes = data.maxOfOrNull { it.minutes }?.coerceAtLeast(1) ?: 1
    val cellSize = 14.dp
    val gap = 3.dp

    // Group by weeks (7 columns)
    val weeks = data.chunked(7)

    Canvas(
        modifier = Modifier
            .fillMaxWidth()
            .height((weeks.size * (cellSize + gap)).coerceAtMost(120.dp)),
    ) {
        weeks.forEachIndexed { weekIdx, week ->
            week.forEachIndexed { dayIdx, day ->
                val intensity = day.minutes.toFloat() / maxMinutes
                val color = when {
                    intensity == 0f -> Color.LightGray.copy(alpha = 0.2f)
                    intensity < 0.25f -> CadenceEmber.copy(alpha = 0.2f)
                    intensity < 0.5f -> CadenceEmber.copy(alpha = 0.4f)
                    intensity < 0.75f -> CadenceEmber.copy(alpha = 0.6f)
                    else -> CadenceEmber.copy(alpha = 0.9f)
                }

                drawRect(
                    color = color,
                    topLeft = Offset(
                        x = weekIdx * (cellSize.toPx() + gap.toPx()),
                        y = dayIdx * (cellSize.toPx() + gap.toPx()),
                    ),
                    size = androidx.compose.ui.geometry.Size(cellSize.toPx(), cellSize.toPx()),
                )
            }
        }
    }
}

@Composable
private fun TrendChart(data: List<unifies.cadence.core.common.model.TrendPoint>) {
    if (data.isEmpty()) return

    val maxTasks = data.maxOfOrNull { it.tasksCompleted }?.coerceAtLeast(1) ?: 1

    Canvas(
        modifier = Modifier
            .fillMaxWidth()
            .height(100.dp),
    ) {
        val stepX = size.width / (data.size - 1).coerceAtLeast(1)
        val points = data.mapIndexed { idx, point ->
            Offset(
                x = idx * stepX,
                y = size.height * (1f - point.tasksCompleted.toFloat() / maxTasks),
            )
        }

        // Draw line
        for (i in 0 until points.size - 1) {
            drawLine(
                color = CadenceEmber,
                start = points[i],
                end = points[i + 1],
                strokeWidth = 3f,
                cap = StrokeCap.Round,
            )
        }

        // Draw dots
        points.forEach { point ->
            drawCircle(
                color = CadenceEmber,
                radius = 4f,
                center = point,
            )
        }
    }
}

@Composable
private fun LoadingShimmer() {
    val shimmerColor = MaterialTheme.colorScheme.surfaceVariant
    Card(
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp)) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(0.7f)
                    .height(16.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(shimmerColor),
            )
            Spacer(Modifier.height(8.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth(0.4f)
                    .height(12.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(shimmerColor),
            )
        }
    }
}
