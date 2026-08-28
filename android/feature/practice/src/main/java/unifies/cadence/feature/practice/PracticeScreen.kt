package unifies.cadence.feature.practice

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
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
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import unifies.cadence.core.common.theme.CadenceEmber
import unifies.cadence.core.common.theme.CadenceTerracotta
import unifies.cadence.core.common.theme.StatusOnTrack
import unifies.cadence.core.common.theme.StatusReviewDue

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PracticeScreen(
    viewModel: PracticeViewModel,
    onBack: () -> Unit,
) {
    val state by viewModel.state.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Practice: ${state.topicTitle}") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
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
            // ── Progress bar ────────────────────────────────────
            if (state.questions.isNotEmpty()) {
                LinearProgressIndicator(
                    progress = { (state.questionIndex + 1).toFloat() / state.questions.size },
                    modifier = Modifier.fillMaxWidth().height(6.dp).clip(MaterialTheme.shapes.extraSmall),
                    color = CadenceEmber,
                )
                Text(
                    "Question ${state.questionIndex + 1} of ${state.questions.size}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            // ── Question ────────────────────────────────────────
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f),
                ),
            ) {
                Column(Modifier.padding(16.dp)) {
                    Text("Question", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = state.currentQuestion,
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Medium,
                    )
                }
            }

            // ── Answer form ─────────────────────────────────────
            OutlinedTextField(
                value = state.userAnswer,
                onValueChange = { viewModel.updateAnswer(it) },
                modifier = Modifier.fillMaxWidth().height(180.dp),
                placeholder = { Text("Write your answer here...\n\nBe thorough — the more detail, the better your evaluation.") },
            )

            Button(
                onClick = { viewModel.submitAnswer() },
                enabled = state.userAnswer.isNotBlank() && !state.isEvaluating,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = CadenceEmber),
            ) {
                if (state.isEvaluating) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), color = MaterialTheme.colorScheme.onPrimary, strokeWidth = 2.dp)
                } else {
                    Icon(Icons.Default.Send, null)
                    Spacer(Modifier.width(8.dp))
                    Text("Submit")
                }
            }

            // ── Feedback ────────────────────────────────────────
            AnimatedVisibility(
                visible = state.showFeedback && state.evaluation != null,
                enter = fadeIn() + scaleIn(),
                exit = fadeOut() + scaleOut(),
            ) {
                state.evaluation?.let { eval ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = when {
                                eval.score >= 70 -> StatusOnTrack.copy(alpha = 0.08f)
                                eval.score >= 40 -> StatusReviewDue.copy(alpha = 0.08f)
                                else -> MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.3f)
                            },
                        ),
                    ) {
                        Column(Modifier.padding(16.dp)) {
                            Row {
                                Text("Score: ", style = MaterialTheme.typography.titleLarge)
                                Text(
                                    "${eval.score}/100",
                                    style = MaterialTheme.typography.titleLarge,
                                    fontWeight = FontWeight.Bold,
                                    color = when {
                                        eval.score >= 70 -> StatusOnTrack
                                        eval.score >= 40 -> StatusReviewDue
                                        else -> MaterialTheme.colorScheme.error
                                    },
                                )
                            }
                            Spacer(Modifier.height(12.dp))
                            Text("Feedback", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                            Spacer(Modifier.height(4.dp))
                            Text(eval.feedback, style = MaterialTheme.typography.bodyMedium)
                            eval.improvedAnswer?.let { improved ->
                                Spacer(Modifier.height(12.dp))
                                Text("Suggested Answer", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                                Spacer(Modifier.height(4.dp))
                                Text(improved, style = MaterialTheme.typography.bodyMedium)
                            }
                            Spacer(Modifier.height(12.dp))
                            Button(onClick = { viewModel.nextQuestion() }, modifier = Modifier.fillMaxWidth()) {
                                Text("Next Question")
                            }
                        }
                    }
                }
            }

            // ── History ─────────────────────────────────────────
            if (state.history.isNotEmpty()) {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp)) {
                        Text("Recent Answers", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.height(8.dp))
                        state.history.take(3).forEach { entry ->
                            Row(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                                Surface(
                                    color = when {
                                        entry.score >= 70 -> StatusOnTrack
                                        entry.score >= 40 -> StatusReviewDue
                                        else -> MaterialTheme.colorScheme.error
                                    },
                                    shape = MaterialTheme.shapes.extraSmall,
                                    modifier = Modifier.size(32.dp),
                                ) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Text("${entry.score}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onPrimary, fontWeight = FontWeight.Bold)
                                    }
                                }
                                Spacer(Modifier.width(8.dp))
                                Text(
                                    text = entry.userAnswer.take(60) + if (entry.userAnswer.length > 60) "..." else "",
                                    style = MaterialTheme.typography.bodySmall,
                                    modifier = Modifier.weight(1f),
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}


