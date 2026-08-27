package com.cadence.app.ui.screens

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cadence.app.data.model.Task
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TodayScreen(
    onNavigateToPlans: () -> Unit,
    onNavigateToPod: () -> Unit,
    onNavigateToTask: (String) -> Unit,
    onNavigateToAnalytics: () -> Unit,
) {
    val todayKey = remember { LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE) }
    val greeting = remember {
        val hour = java.time.LocalTime.now().hour
        when {
            hour < 5 -> "Up late"
            hour < 12 -> "Good morning"
            hour < 18 -> "Good afternoon"
            else -> "Good evening"
        }
    }

    // Mock data — replace with Convex query in production
    val tasks = remember { mutableStateListOf<Task>() }
    val streak = remember { mutableIntStateOf(0) }
    val reviewsDue = remember { mutableIntStateOf(0) }
    val doneHours = remember { mutableDoubleStateOf(0.0) }
    val plannedHours = remember { mutableDoubleStateOf(0.0) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = LocalDate.now().format(
                                DateTimeFormatter.ofPattern("EEEE, MMMM d")
                            ),
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(
                            text = "$greeting.",
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                },
                actions = {
                    IconButton(onClick = onNavigateToAnalytics) {
                        Icon(Icons.Default.BarChart, contentDescription = "Analytics")
                    }
                    IconButton(onClick = onNavigateToPod) {
                        Icon(Icons.Default.Group, contentDescription = "Pod")
                    }
                },
            )
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            // Stats row
            item {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    // Streak chip
                    AssistChip(
                        onClick = {},
                        label = {
                            Text(
                                if (streak.intValue > 0) "🔥 ${streak.intValue}-day streak"
                                else "Start your streak today"
                            )
                        },
                        leadingIcon = {
                            Icon(
                                Icons.Default.LocalFireDepartment,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                            )
                        },
                    )

                    // Reviews chip
                    if (reviewsDue.intValue > 0) {
                        AssistChip(
                            onClick = {},
                            label = {
                                Text("${reviewsDue.intValue} review${if (reviewsDue.intValue > 1) "s" else ""} due")
                            },
                            leadingIcon = {
                                Icon(
                                    Icons.Default.Repeat,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.secondary,
                                )
                            },
                        )
                    }
                }
            }

            // Rollover banner
            if (tasks.any { it.carried }) {
                item {
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.secondaryContainer,
                        ),
                        shape = RoundedCornerShape(16.dp),
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Icon(
                                Icons.Default.Undo,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.secondary,
                            )
                            Text(
                                text = "${tasks.count { it.carried }} rolled forward. Yesterday's leftovers are first in line.",
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                    }
                }
            }

            // Tasks grouped by plan
            val grouped = tasks.groupBy { it.planTitle }
            for ((planTitle, planTasks) in grouped) {
                item {
                    Text(
                        text = planTitle,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                }

                items(planTasks, key = { it.id }) { task ->
                    TaskCard(
                        task = task,
                        onClick = { onNavigateToTask(task.id) },
                        onToggle = { /* toggle completion */ },
                    )
                }
            }

            // Progress footer
            if (tasks.isNotEmpty()) {
                item {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(
                            text = "%.1fh of %.1fh done".format(doneHours.doubleValue, plannedHours.doubleValue),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        val allDone = tasks.isNotEmpty() && tasks.all { it.status == "done" }
                        Text(
                            text = if (allDone) "Day complete. Go live your life."
                            else "${tasks.count { it.status == "done" }}/${tasks.size} checked off",
                            style = MaterialTheme.typography.bodySmall,
                            color = if (allDone) MaterialTheme.colorScheme.primary
                            else MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }

            // Empty state
            if (tasks.isEmpty()) {
                item {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 48.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Icon(
                            Icons.Default.CalendarToday,
                            contentDescription = null,
                            modifier = Modifier.size(48.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "Nothing scheduled today",
                            style = MaterialTheme.typography.headlineSmall,
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Paste a course outline or name what you want to learn.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(onClick = onNavigateToPlans) {
                            Text("Create your first plan")
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun TaskCard(
    task: Task,
    onClick: () -> Unit,
    onToggle: () -> Unit,
) {
    val isDone = task.status == "done"
    val isReview = task.kind == "review"
    val isCarried = task.carried

    val accentColors = listOf(
        MaterialTheme.colorScheme.primary,
        MaterialTheme.colorScheme.secondary,
        MaterialTheme.colorScheme.tertiary,
        MaterialTheme.colorScheme.primaryContainer,
        MaterialTheme.colorScheme.secondaryContainer,
    )
    val accent = accentColors[task.planAccent % accentColors.size]

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = if (isDone) MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
            else MaterialTheme.colorScheme.surface,
        ),
        shape = RoundedCornerShape(16.dp),
    ) {
        Row(
            modifier = Modifier
                .padding(12.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // Checkbox — morphs from rounded square to circle on completion
            Box(
                modifier = Modifier
                    .size(24.dp)
                    .clip(
                        if (isDone) CircleShape
                        else RoundedCornerShape(6.dp)
                    )
                    .background(
                        if (isDone) MaterialTheme.colorScheme.primary
                        else MaterialTheme.colorScheme.surfaceVariant
                    )
                    .clickable(onClick = onToggle),
                contentAlignment = Alignment.Center,
            ) {
                if (isDone) {
                    Icon(
                        Icons.Default.Check,
                        contentDescription = "Done",
                        tint = MaterialTheme.colorScheme.onPrimary,
                        modifier = Modifier.size(16.dp),
                    )
                }
            }

            // Accent bar
            Box(
                modifier = Modifier
                    .width(3.dp)
                    .height(32.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(accent),
            )

            // Content
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = task.title,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                    color = if (isDone) MaterialTheme.colorScheme.onSurfaceVariant
                    else MaterialTheme.colorScheme.onSurface,
                )

                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (isReview) {
                        SuggestionChip(
                            onClick = {},
                            label = { Text("Review", style = MaterialTheme.typography.labelSmall) },
                        )
                    }
                    if (isCarried) {
                        SuggestionChip(
                            onClick = {},
                            label = { Text("Carried", style = MaterialTheme.typography.labelSmall) },
                        )
                    }
                    Text(
                        text = "%.1fh".format(task.hours),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}
