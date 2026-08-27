package app.cadence

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import app.cadence.core.common.theme.CadenceTheme
import app.cadence.feature.analytics.AnalyticsScreen
import app.cadence.feature.analytics.AnalyticsViewModel
import app.cadence.feature.onboarding.IngestScreen
import app.cadence.feature.onboarding.IngestViewModel
import app.cadence.feature.pods.PodsScreen
import app.cadence.feature.pods.PodsViewModel
import app.cadence.feature.practice.PracticeScreen
import app.cadence.feature.practice.PracticeViewModel
import app.cadence.feature.settings.SettingsScreen
import app.cadence.feature.settings.SettingsViewModel
import app.cadence.feature.taskdetail.DetailScreen
import app.cadence.feature.taskdetail.DetailViewModel
import app.cadence.feature.today.TodayScreen
import app.cadence.feature.today.TodayViewModel
import app.cadence.feature.trackdetail.TrackScreen
import app.cadence.feature.trackdetail.TrackViewModel
import app.cadence.notifications.CadenceFirebaseService
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Create notification channels
        CadenceFirebaseService.createChannels(this)

        setContent {
            val settingsViewModel: SettingsViewModel = hiltViewModel()
            val state by settingsViewModel.state.collectAsState()

            CadenceTheme(darkTheme = state.isDarkMode) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    CadenceNavHost()
                }
            }
        }
    }
}

@Composable
fun CadenceNavHost() {
    val navController = rememberNavController()

    NavHost(
        navController = navController,
        startDestination = "onboarding",
        enterTransition = {
            fadeIn(spring(stiffness = Spring.StiffnessMedium)) +
                slideIntoContainer(AnimatedContentTransitionScope.SlideDirection.Start, spring())
        },
        exitTransition = { fadeOut(spring(stiffness = Spring.StiffnessMedium)) },
        popEnterTransition = {
            fadeIn(spring(stiffness = Spring.StiffnessMedium)) +
                slideIntoContainer(AnimatedContentTransitionScope.SlideDirection.End, spring())
        },
        popExitTransition = { fadeOut(spring(stiffness = Spring.StiffnessMedium)) },
    ) {
        // ── Onboarding ────────────────────────────────────────
        composable("onboarding") {
            val viewModel: IngestViewModel = hiltViewModel()
            IngestScreen(
                viewModel = viewModel,
                onNavigateToDashboard = {
                    navController.navigate("dashboard") {
                        popUpTo("onboarding") { inclusive = true }
                    }
                },
            )
        }

        // ── Dashboard (Today) ─────────────────────────────────
        composable("dashboard") {
            val viewModel: TodayViewModel = hiltViewModel()
            TodayScreen(
                viewModel = viewModel,
                onTaskClick = { taskId -> navController.navigate("task/$taskId") },
                onPlanClick = { planId -> navController.navigate("track/$planId") },
            )
        }

        // ── Task Detail ───────────────────────────────────────
        composable(
            "task/{taskId}",
            arguments = listOf(navArgument("taskId") { type = NavType.StringType }),
        ) {
            val viewModel: DetailViewModel = hiltViewModel()
            DetailScreen(
                viewModel = viewModel,
                onBack = { navController.popBackStack() },
            )
        }

        // ── Track Detail ──────────────────────────────────────
        composable(
            "track/{planId}",
            arguments = listOf(navArgument("planId") { type = NavType.StringType }),
        ) {
            val viewModel: TrackViewModel = hiltViewModel()
            TrackScreen(
                viewModel = viewModel,
                onBack = { navController.popBackStack() },
                onExportFlashcards = { /* TODO: Export flashcards */ },
            )
        }

        // ── Pods ──────────────────────────────────────────────
        composable("pods") {
            val viewModel: PodsViewModel = hiltViewModel()
            PodsScreen(viewModel = viewModel)
        }

        // ── Practice ──────────────────────────────────────────
        composable(
            "practice/{topicTitle}",
            arguments = listOf(navArgument("topicTitle") { type = NavType.StringType }),
        ) {
            val viewModel: PracticeViewModel = hiltViewModel()
            PracticeScreen(
                viewModel = viewModel,
                onBack = { navController.popBackStack() },
            )
        }

        // ── Analytics ─────────────────────────────────────────
        composable("analytics") {
            val viewModel: AnalyticsViewModel = hiltViewModel()
            AnalyticsScreen(viewModel = viewModel)
        }

        // ── Settings ──────────────────────────────────────────
        composable("settings") {
            val viewModel: SettingsViewModel = hiltViewModel()
            SettingsScreen(viewModel = viewModel)
        }
    }
}
