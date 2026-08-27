package com.cadence.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlansScreen(
    onNavigateBack: () -> Unit,
    onNavigateToPlan: (String) -> Unit,
    onNewPlan: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Plans") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = onNewPlan) {
                        Icon(Icons.Default.Add, contentDescription = "New plan")
                    }
                },
            )
        },
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(
                    Icons.Default.LibraryBooks,
                    contentDescription = null,
                    modifier = Modifier.size(48.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                )
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "Your plans will appear here",
                    style = MaterialTheme.typography.bodyLarge,
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun IngestScreen(
    initialText: String?,
    onNavigateBack: () -> Unit,
    onPlanCreated: (String) -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("New plan") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentAlignment = Alignment.Center,
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(32.dp),
            ) {
                Icon(
                    Icons.Default.School,
                    contentDescription = null,
                    modifier = Modifier.size(48.dp),
                    tint = MaterialTheme.colorScheme.primary,
                )
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = if (initialText == "PDF_SHARED") "PDF detected — extract text to continue"
                    else "Paste your syllabus or type what you want to learn",
                    style = MaterialTheme.typography.bodyLarge,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
                Spacer(modifier = Modifier.height(24.dp))
                // TODO: Add Textarea + PDF upload + scheduling mode picker
                Button(onClick = { onPlanCreated("demo-plan-id") }) {
                    Text("Build my schedule")
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlanDetailScreen(
    planId: String,
    onNavigateBack: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Plan") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "Plan detail: $planId",
                style = MaterialTheme.typography.bodyLarge,
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TaskDetailScreen(
    taskId: String,
    onNavigateBack: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Task") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "Task detail: $taskId",
                style = MaterialTheme.typography.bodyLarge,
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PodScreen(
    onNavigateBack: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Pod") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(
                    Icons.Default.Group,
                    contentDescription = null,
                    modifier = Modifier.size(48.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                )
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "Join or create a study pod",
                    style = MaterialTheme.typography.bodyLarge,
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AnalyticsScreen(
    onNavigateBack: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Analytics") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(
                    Icons.Default.BarChart,
                    contentDescription = null,
                    modifier = Modifier.size(48.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                )
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "Heatmap + streak + weekly digest",
                    style = MaterialTheme.typography.bodyLarge,
                )
            }
        }
    }
}
