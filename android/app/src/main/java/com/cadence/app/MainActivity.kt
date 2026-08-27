package com.cadence.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.cadence.app.ui.screens.*
import com.cadence.app.ui.theme.CadenceTheme

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            CadenceTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    CadenceNavHost(intent = intent)
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
    }
}

@Composable
fun CadenceNavHost(intent: Intent?) {
    val navController = rememberNavController()
    val sharedPdfText = remember { mutableStateOf<String?>(null) }

    // Handle share-sheet intent
    LaunchedEffect(intent) {
        if (intent?.action == Intent.ACTION_SEND) {
            when (intent.type) {
                "application/pdf" -> {
                    // PDF will be extracted in the ingest screen
                    sharedPdfText.value = "PDF_SHARED"
                }
                "text/plain" -> {
                    sharedPdfText.value = intent.getStringExtra(Intent.EXTRA_TEXT)
                }
            }
        }
    }

    NavHost(
        navController = navController,
        startDestination = "today",
    ) {
        composable("today") {
            TodayScreen(
                onNavigateToPlans = { navController.navigate("plans") },
                onNavigateToPod = { navController.navigate("pod") },
                onNavigateToTask = { taskId -> navController.navigate("task/$taskId") },
                onNavigateToAnalytics = { navController.navigate("analytics") },
            )
        }

        composable("plans") {
            PlansScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToPlan = { planId -> navController.navigate("plan/$planId") },
                onNewPlan = { navController.navigate("ingest") },
            )
        }

        composable("plan/{planId}") { backStackEntry ->
            val planId = backStackEntry.arguments?.getString("planId") ?: return@composable
            PlanDetailScreen(
                planId = planId,
                onNavigateBack = { navController.popBackStack() },
            )
        }

        composable("ingest") {
            IngestScreen(
                initialText = sharedPdfText.value,
                onNavigateBack = { navController.popBackStack() },
                onPlanCreated = { planId ->
                    sharedPdfText.value = null
                    navController.navigate("plan/$planId") {
                        popUpTo("plans") { inclusive = true }
                    }
                },
            )
        }

        composable("task/{taskId}") { backStackEntry ->
            val taskId = backStackEntry.arguments?.getString("taskId") ?: return@composable
            TaskDetailScreen(
                taskId = taskId,
                onNavigateBack = { navController.popBackStack() },
            )
        }

        composable("pod") {
            PodScreen(
                onNavigateBack = { navController.popBackStack() },
            )
        }

        composable("analytics") {
            AnalyticsScreen(
                onNavigateBack = { navController.popBackStack() },
            )
        }
    }
}
