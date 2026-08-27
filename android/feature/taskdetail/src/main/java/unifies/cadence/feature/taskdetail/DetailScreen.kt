package unifies.cadence.feature.taskdetail

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.togetherWith
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import unifies.cadence.core.common.theme.CadenceEmber
import unifies.cadence.core.common.theme.CadenceTerracotta
import unifies.cadence.core.common.theme.LevelColors
import unifies.cadence.core.common.theme.StatusBehind
import unifies.cadence.core.common.theme.StatusOnTrack
import unifies.cadence.core.common.theme.StatusReviewDue
import unifies.cadence.core.common.util.DateUtil

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DetailScreen(
    viewModel: DetailViewModel,
    onBack: () -> Unit,
) {
    val state by viewModel.state.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(state.task?.topicTitle ?: "Task") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.skipTask(); onBack() }) {
                        Icon(Icons.Default.SkipNext, "Skip")
                    }
                },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // ── Task Info Card ──────────────────────────────────
            state.task?.let { task ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = LevelColors.forLevel(task.level).copy(alpha = 0.08f),
                    ),
                ) {
                    Column(Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Surface(
                                color = LevelColors.forLevel(task.level).copy(alpha = 0.15f),
                                shape = MaterialTheme.shapes.extraSmall,
                            ) {
                                Text(
                                    text = task.level.uppercase(),
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = LevelColors.forLevel(task.level),
                                    fontWeight = FontWeight.Bold,
                                )
                            }
                            Spacer(Modifier.width(8.dp))
                            Text(
                                text = task.kind.replaceFirstChar { it.uppercase() },
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        Spacer(Modifier.height(8.dp))
                        Text(
                            text = "Day ${task.dayNumber} · ${DateUtil.minutesToDisplay(task.estimatedMinutes)}",
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        if (task.reviewStage != null) {
                            Text(
                                text = task.reviewStage,
                                style = MaterialTheme.typography.bodySmall,
                                color = StatusReviewDue,
                            )
                        }
                    }
                }
            }

            // ── Timer ───────────────────────────────────────────
            Card(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Column {
                        Text(
                            text = formatTimer(state.timerSeconds),
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            "Elapsed",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilledIconButton(
                            onClick = {
                                if (state.isTimerRunning) viewModel.stopTimer()
                                else viewModel.startTimer()
                            },
                        ) {
                            Icon(
                                if (state.isTimerRunning) Icons.Default.Pause else Icons.Default.PlayArrow,
                                contentDescription = if (state.isTimerRunning) "Pause" else "Start",
                            )
                        }
                    }
                }
            }

            // ── Practice Problems ───────────────────────────────
            if (state.practice.isNotEmpty()) {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp)) {
                        Text(
                            "Practice Problems",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Spacer(Modifier.height(8.dp))
                        state.practice.forEachIndexed { idx, problem ->
                            Text(
                                text = "${idx + 1}. $problem",
                                style = MaterialTheme.typography.bodyMedium,
                                modifier = Modifier.padding(vertical = 4.dp),
                            )
                        }

                        if (state.challenge != null) {
                            Spacer(Modifier.height(12.dp))
                            HorizontalDivider()
                            Spacer(Modifier.height(12.dp))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Surface(
                                    color = CadenceEmber.copy(alpha = 0.1f),
                                    shape = MaterialTheme.shapes.extraSmall,
                                ) {
                                    Text(
                                        "🏆 CHALLENGE",
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                        style = MaterialTheme.typography.labelSmall,
                                        color = CadenceEmber,
                                        fontWeight = FontWeight.Bold,
                                    )
                                }
                            }
                            Spacer(Modifier.height(4.dp))
                            Text(
                                text = state.challenge,
                                style = MaterialTheme.typography.bodyMedium,
                            )
                        }
                    }
                }
            }

            // ── Answer Form ─────────────────────────────────────
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp)) {
                    Text(
                        "Your Answer",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(
                        value = state.userAnswer,
                        onValueChange = { viewModel.updateAnswer(it) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(150.dp),
                        placeholder = { Text("Write your answer here...\n\nExplain in detail. The more thorough, the better your evaluation.") },
                    )
                    Spacer(Modifier.height(8.dp))
                    Button(
                        onClick = { viewModel.submitAnswer() },
                        enabled = state.userAnswer.isNotBlank() && !state.isEvaluating,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = CadenceEmber),
                    ) {
                        if (state.isEvaluating) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(18.dp),
                                color = MaterialTheme.colorScheme.onPrimary,
                                strokeWidth = 2.dp,
                            )
                        } else {
                            Icon(Icons.Default.Send, null)
                            Spacer(Modifier.width(8.dp))
                            Text("Submit for evaluation")
                        }
                    }
                }
            }

            // ── Answer History ──────────────────────────────────
            if (state.answerHistory.isNotEmpty()) {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.History, null, Modifier.size(20.dp))
                            Spacer(Modifier.width(8.dp))
                            Text(
                                "Answer History",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                        Spacer(Modifier.height(8.dp))
                        state.answerHistory.take(5).forEach { entry ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Surface(
                                    color = when {
                                        entry.score >= 70 -> StatusOnTrack
                                        entry.score >= 40 -> StatusReviewDue
                                        else -> StatusBehind
                                    },
                                    shape = MaterialTheme.shapes.extraSmall,
                                    modifier = Modifier.size(32.dp),
                                ) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Text(
                                            "${entry.score}",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.onPrimary,
                                            fontWeight = FontWeight.Bold,
                                        )
                                    }
                                }
                                Spacer(Modifier.width(8.dp))
                                Column(Modifier.weight(1f)) {
                                    Text(
                                        text = entry.userAnswer.take(80) + if (entry.userAnswer.length > 80) "..." else "",
                                        style = MaterialTheme.typography.bodySmall,
                                        maxLines = 1,
                                    )
                                    Text(
                                        text = entry.submittedAt,
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // ── Complete Button ─────────────────────────────────
            ExtendedFloatingActionButton(
                onClick = {
                    viewModel.completeTask()
                    onBack()
                },
                modifier = Modifier.fillMaxWidth(),
                containerColor = StatusOnTrack,
                contentColor = MaterialTheme.colorScheme.onPrimary,
                text = { Text("Mark as complete") },
                icon = { Icon(Icons.Default.CheckCircle, null) },
            )

            Spacer(Modifier.height(48.dp))
        }
    }
}

@Composable
private fun FilledIconButton(onClick: () -> Unit, content: @Composable () -> Unit) {
    Surface(
        onClick = onClick,
        shape = MaterialTheme.shapes.medium,
        color = CadenceEmber,
        modifier = Modifier.size(48.dp),
    ) {
        Box(contentAlignment = Alignment.Center) {
            content()
        }
    }
}

private fun formatTimer(seconds: Int): String {
    val h = seconds / 3600
    val m = (seconds % 3600) / 60
    val s = seconds % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s)
    else "%02d:%02d".format(m, s)
}
