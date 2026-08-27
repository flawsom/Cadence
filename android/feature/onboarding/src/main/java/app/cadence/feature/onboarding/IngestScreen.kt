package app.cadence.feature.onboarding

import android.content.Intent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.FileUpload
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.School
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import app.cadence.core.common.theme.CadenceEmber
import app.cadence.core.common.theme.CadenceTerracotta
import app.cadence.core.common.theme.LevelColors
import app.cadence.core.common.theme.StatusOnTrack

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun IngestScreen(
    viewModel: IngestViewModel,
    onNavigateToDashboard: () -> Unit,
) {
    val state by viewModel.state.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val context = LocalContext.current

    // Handle share intent
    LaunchedEffect(Unit) {
        val intent = (context as? android.app.Activity)?.intent
        if (intent?.action == Intent.ACTION_SEND) {
            val text = intent.getStringExtra(Intent.EXTRA_TEXT)
            viewModel.dispatch(IngestIntent.ShareIntent(text))
        }
    }

    // Handle errors
    LaunchedEffect(state.error) {
        state.error?.let {
            snackbarHostState.showSnackbar(it)
        }
    }

    // Navigate on completion
    LaunchedEffect(state.step) {
        if (state.step == IngestStep.DONE) {
            onNavigateToDashboard()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        when (state.step) {
                            IngestStep.INPUT -> "Create a plan"
                            IngestStep.REVIEW -> "Review topics"
                            IngestStep.PARSING -> "Processing..."
                            IngestStep.SAVING -> "Saving..."
                            IngestStep.DONE -> "All set!"
                        }
                    )
                },
                navigationIcon = {
                    if (state.step == IngestStep.REVIEW) {
                        IconButton(onClick = { viewModel.dispatch(IngestIntent.Reset) }) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                        }
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { padding ->
        AnimatedContent(
            targetState = state.step,
            modifier = Modifier.padding(padding),
            transitionSpec = {
                slideInVertically { it } + fadeIn() togetherWith slideOutVertically { -it } + fadeOut()
            },
            label = "ingest-step",
        ) { step ->
            when (step) {
                IngestStep.INPUT -> InputStep(
                    state = state,
                    onTextChange = { viewModel.dispatch(IngestIntent.UpdateSyllabus(it)) },
                    onParse = { viewModel.dispatch(IngestIntent.Parse) },
                )
                IngestStep.REVIEW -> ReviewStep(
                    state = state,
                    onNameChange = { viewModel.dispatch(IngestIntent.UpdatePlanName(it)) },
                    onDailyHoursChange = { viewModel.dispatch(IngestIntent.UpdateDailyHours(it)) },
                    onTotalDaysChange = { viewModel.dispatch(IngestIntent.UpdateTotalDays(it)) },
                    onSchedulingModeChange = { viewModel.dispatch(IngestIntent.UpdateSchedulingMode(it)) },
                    onSave = { viewModel.dispatch(IngestIntent.Save) },
                    isSaving = state.isSaving,
                )
                IngestStep.PARSING, IngestStep.SAVING -> LoadingStep(step == IngestStep.PARSING)
                IngestStep.DONE -> Box(Modifier.fillMaxSize())
            }
        }
    }
}

@Composable
private fun InputStep(
    state: IngestState,
    onTextChange: (String) -> Unit,
    onParse: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        // Header
        Text(
            text = "What do you want to learn?",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
        )
        Text(
            text = "Paste a syllabus, upload a PDF, or just type a subject name. We'll build your personalized learning roadmap.",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        // Quick start chips
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("Python", "Data Structures", "Machine Learning", "Web Development").forEach { name ->
                FilterChip(
                    selected = false,
                    onClick = { onTextChange(name) },
                    label = { Text(name) },
                    leadingIcon = {
                        Icon(Icons.Default.Lightbulb, null, Modifier.size(16.dp))
                    },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = CadenceTerracotta.copy(alpha = 0.12f),
                    ),
                )
            }
        }

        // Text input
        OutlinedTextField(
            value = state.syllabusText,
            onValueChange = onTextChange,
            modifier = Modifier
                .fillMaxWidth()
                .height(200.dp),
            placeholder = {
                Text("Paste your syllabus here...\n\nOr just type a subject name like \"Python\" or \"Cloud Computing\"")
            },
            supportingRow = {
                // PDF upload button
                val pdfLauncher = rememberLauncherForActivityResult(
                    contract = ActivityResultContracts.OpenDocument()
                ) { uri ->
                    uri?.let {
                        // TODO: Extract PDF text via pdf.js
                        // For now, show instruction
                    }
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(top = 8.dp),
                ) {
                    Icon(
                        Icons.Default.FileUpload,
                        null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.width(8.dp))
                    TextButton(onClick = { pdfLauncher.launch(arrayOf("application/pdf")) }) {
                        Text("Upload PDF syllabus")
                    }
                }
            },
        )

        // Submit
        Button(
            onClick = onParse,
            modifier = Modifier.fillMaxWidth(),
            enabled = state.syllabusText.isNotBlank() && !state.isParsing,
            colors = ButtonDefaults.buttonColors(
                containerColor = CadenceEmber,
            ),
        ) {
            if (state.isParsing) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = MaterialTheme.colorScheme.onPrimary,
                    strokeWidth = 2.dp,
                )
            } else {
                Icon(Icons.Default.Psychology, null)
                Spacer(Modifier.width(8.dp))
                Text("Generate my roadmap")
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ReviewStep(
    state: IngestState,
    onNameChange: (String) -> Unit,
    onDailyHoursChange: (Double) -> Unit,
    onTotalDaysChange: (Int) -> Unit,
    onSchedulingModeChange: (String) -> Unit,
    onSave: () -> Unit,
    isSaving: Boolean,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        // Summary card
        Card(
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.primaryContainer,
            ),
        ) {
            Column(Modifier.padding(16.dp)) {
                Text(
                    text = state.planName.ifBlank { "Your Plan" },
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(Modifier.height(4.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    AssistChip("${state.topics.size} topics")
                    AssistChip("${String.format("%.1f", state.totalHours)}h total")
                    AssistChip("~${state.estimatedDays} days")
                }
            }
        }

        // Plan name
        OutlinedTextField(
            value = state.planName,
            onValueChange = onNameChange,
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Plan name") },
            leadingIcon = { Icon(Icons.Default.Description, null) },
        )

        // Daily hours slider
        Column {
            Text(
                "Daily study hours: ${String.format("%.1f", state.dailyHours)}h",
                style = MaterialTheme.typography.titleMedium,
            )
            Slider(
                value = state.dailyHours.toFloat(),
                onValueChange = { onDailyHoursChange(it.toDouble()) },
                valueRange = 0.5f..8f,
                steps = 14,
                colors = SliderDefaults.colors(
                    thumbColor = CadenceEmber,
                    activeTrackColor = CadenceEmber,
                ),
            )
        }

        // Scheduling mode
        Text("Scheduling mode", style = MaterialTheme.typography.titleMedium)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(
                selected = state.schedulingMode == "sequential",
                onClick = { onSchedulingModeChange("sequential") },
                label = { Text("Sequential") },
                leadingIcon = if (state.schedulingMode == "sequential") {
                    { Icon(Icons.Default.Check, null, Modifier.size(16.dp)) }
                } else null,
            )
            FilterChip(
                selected = state.schedulingMode == "parallel",
                onClick = { onSchedulingModeChange("parallel") },
                label = { Text("Parallel") },
                leadingIcon = if (state.schedulingMode == "parallel") {
                    { Icon(Icons.Default.Check, null, Modifier.size(16.dp)) }
                } else null,
            )
        }

        // Topics preview
        Text("Topics", style = MaterialTheme.typography.titleMedium)
        state.topics.forEach { topic ->
            Card(
                modifier = Modifier.fillMaxWidth(),
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Surface(
                        color = LevelColors.forLevel(topic.level).copy(alpha = 0.15f),
                        shape = MaterialTheme.shapes.small,
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
                        Text(
                            text = topic.title,
                            style = MaterialTheme.typography.bodyLarge,
                        )
                        Text(
                            text = "${String.format("%.1f", topic.estimatedHours)}h",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }

        Spacer(Modifier.height(8.dp))

        // Save button
        ExtendedFloatingActionButton(
            onClick = onSave,
            modifier = Modifier.fillMaxWidth(),
            containerColor = StatusOnTrack,
            contentColor = MaterialTheme.colorScheme.onPrimary,
            text = { Text(if (isSaving) "Saving..." else "Start learning") },
            icon = { Icon(Icons.Default.School, null) },
        )
    }
}

@Composable
private fun AssistChip(label: String) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant,
        shape = MaterialTheme.shapes.small,
    ) {
        Text(
            text = label,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelMedium,
        )
    }
}

@Composable
private fun LoadingStep(isParsing: Boolean) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            CircularProgressIndicator(
                modifier = Modifier.size(48.dp),
                color = CadenceEmber,
            )
            Spacer(Modifier.height(16.dp))
            Text(
                text = if (isParsing) "Analyzing your syllabus..." else "Creating your plan...",
                style = MaterialTheme.typography.titleMedium,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text = "This usually takes a few seconds",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
