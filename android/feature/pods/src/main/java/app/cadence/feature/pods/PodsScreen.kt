package app.cadence.feature.pods

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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.cadence.core.common.theme.CadenceEmber
import app.cadence.core.common.theme.CadenceTerracotta
import app.cadence.core.common.theme.StatusOnTrack
import app.cadence.core.common.theme.StatusReviewDue
import app.cadence.core.common.util.DateUtil

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PodsScreen(viewModel: PodsViewModel) {
    val state by viewModel.state.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(title = { Text("Pods") })
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { viewModel.toggleCreateMode() },
                containerColor = CadenceEmber,
            ) {
                Icon(Icons.Default.Add, null)
                Spacer(Modifier.width(8.dp))
                Text(if (state.createMode) "Cancel" else "New Pod")
            }
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // ── Create/Join Form ────────────────────────────────
            if (state.createMode) {
                item {
                    CreatePodCard(
                        name = state.newPodName,
                        onNameChange = { viewModel.updateNewPodName(it) },
                        onCreate = { viewModel.createPod() },
                    )
                }
            }

            // ── Join by Code ────────────────────────────────────
            item {
                JoinPodCard(
                    code = state.joinCode,
                    onCodeChange = { viewModel.updateJoinCode(it) },
                    onJoin = { viewModel.joinPod() },
                )
            }

            // ── Pod selector chips ──────────────────────────────
            if (state.pods.isNotEmpty()) {
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        state.pods.forEach { pod ->
                            FilterChip(
                                selected = state.selectedPod?.id == pod.id,
                                onClick = { viewModel.selectPod(pod) },
                                label = { Text(pod.name) },
                                leadingIcon = if (state.selectedPod?.id == pod.id) {
                                    { Icon(Icons.Default.Check, null, Modifier.size(16.dp)) }
                                } else null,
                            )
                        }
                    }
                }
            }

            // ── Members ─────────────────────────────────────────
            if (state.members.isNotEmpty()) {
                item {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(16.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Group, null, Modifier.size(20.dp))
                                Spacer(Modifier.width(8.dp))
                                Text("Members (${state.members.size})", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                            }
                            Spacer(Modifier.height(8.dp))
                            state.members.forEach { member ->
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Icon(Icons.Default.Person, null, Modifier.size(16.dp))
                                    Spacer(Modifier.width(8.dp))
                                    Text(member.displayName, Modifier.weight(1f))
                                    if (member.isCurrentUser) {
                                        Text("You", style = MaterialTheme.typography.labelSmall, color = CadenceEmber)
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // ── Boards (Comparison) ─────────────────────────────
            if (state.boards.isNotEmpty()) {
                item {
                    Text("Today's Progress", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                }
                items(state.boards) { board ->
                    BoardCard(board)
                }
            }

            // ── Daily Digest ────────────────────────────────────
            state.digest?.let { digest ->
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = StatusReviewDue.copy(alpha = 0.08f),
                        ),
                    ) {
                        Column(Modifier.padding(16.dp)) {
                            Text("Daily Digest", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                            Text(digest.summary, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 8.dp))
                        }
                    }
                }
            }

            // ── Check-in button ─────────────────────────────────
            if (state.selectedPod != null) {
                item {
                    TextButton(
                        onClick = { viewModel.checkin() },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Icon(Icons.Default.Check, null)
                        Spacer(Modifier.width(8.dp))
                        Text("Daily Check-in")
                    }
                }
            }

            // ── Empty state ─────────────────────────────────────
            if (state.pods.isEmpty() && !state.isLoading) {
                item {
                    Box(
                        modifier = Modifier.fillMaxWidth().padding(48.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Default.Group, null, modifier = Modifier.size(64.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f))
                            Spacer(Modifier.height(12.dp))
                            Text("No pods yet", style = MaterialTheme.typography.titleLarge)
                            Text("Create a pod to study with friends", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun BoardCard(board: app.cadence.core.common.model.PodBoard) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(board.displayName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
                if (board.streak > 0) {
                    Text("🔥 ${board.streak}", style = MaterialTheme.typography.labelMedium)
                }
            }
            Spacer(Modifier.height(8.dp))
            LinearProgressIndicator(
                progress = { (board.completionPercent / 100.0).coerceIn(0.0, 1.0).toFloat() },
                modifier = Modifier.fillMaxWidth().height(8.dp).clip(MaterialTheme.shapes.extraSmall),
                color = StatusOnTrack,
            )
            Spacer(Modifier.height(4.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("${board.tasksCompleted} tasks", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text("${String.format("%.1f", board.totalMinutes / 60.0)}h", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun CreatePodCard(
    name: String,
    onNameChange: (String) -> Unit,
    onCreate: () -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            Text("Create a Pod", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = name,
                onValueChange = onNameChange,
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Pod name") },
            )
            Spacer(Modifier.height(8.dp))
            TextButton(onClick = onCreate, enabled = name.isNotBlank()) {
                Text("Create")
            }
        }
    }
}

@Composable
private fun JoinPodCard(
    code: String,
    onCodeChange: (String) -> Unit,
    onJoin: () -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            Text("Join a Pod", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = code,
                onValueChange = onCodeChange,
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Invite code") },
            )
            Spacer(Modifier.height(8.dp))
            TextButton(onClick = onJoin, enabled = code.isNotBlank()) {
                Text("Join")
            }
        }
    }
}
