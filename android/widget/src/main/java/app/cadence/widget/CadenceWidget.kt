package app.cadence.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.updateAll
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import app.cadence.core.common.theme.CadenceEmber
import app.cadence.core.common.theme.StatusOnTrack

class CadenceWidget : GlanceAppWidget() {

    override val sizeMode = SizeMode.Single

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        // Fetch real data from local DB
        val tasks = try {
            val db = app.cadence.core.database.di.DatabaseModule.provideDatabase(context)
            val dao = db.taskDao()
            val today = app.cadence.core.common.util.DateUtil.today()
            val pending = dao.getTasksForDate(today)
            val stats = object {
                val reviewsDue = dao.getReviewsDueToday(today)
                val completed = dao.getCompletedCountForDate(today)
            }
            Pair(pending, stats)
        } catch (e: Exception) {
            Pair(emptyList<app.cadence.core.database.entity.TaskEntity>(), null)
        }

        provideContent {
            GlanceTheme {
                WidgetContent(
                    pendingCount = tasks.first.size,
                    reviewsDue = tasks.second?.reviewsDue?.size ?: 0,
                    completedToday = tasks.second?.completed ?: 0,
                    topTasks = tasks.first.take(3).map { it.title },
                )
            }
        }
    }

    @Composable
    private fun WidgetContent(
        pendingCount: Int,
        reviewsDue: Int,
        completedToday: Int,
        topTasks: List<String>,
    ) {
        Box(
            modifier = GlanceModifier
                .fillMaxSize()
                .padding(12.dp)
                .background(ColorProvider(CadenceEmber.copy(alpha = 0.05f)))
                .clickable(actionStartActivity(app.cadence.MainActivity::class.java)),
            contentAlignment = Alignment.Center,
        ) {
            Column(
                modifier = GlanceModifier.fillMaxSize(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // ── Header row ──────────────────────────────────
                Row(
                    modifier = GlanceModifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "Cadence",
                        style = TextStyle(
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                        ),
                    )
                    Spacer(GlanceModifier.width(8.dp))
                    if (reviewsDue > 0) {
                        Text(
                            text = "🔄 $reviewsDue",
                            style = TextStyle(fontSize = 12.sp),
                        )
                    }
                }

                Spacer(GlanceModifier.height(4.dp))

                // ── Tasks remaining ─────────────────────────────
                Text(
                    text = "$pendingCount tasks left today",
                    style = TextStyle(
                        fontSize = 12.sp,
                        color = ColorProvider(StatusOnTrack),
                    ),
                )

                Spacer(GlanceModifier.height(4.dp))

                // ── Top 3 tasks ────────────────────────────────
                topTasks.forEach { task ->
                    Text(
                        text = "• $task",
                        style = TextStyle(fontSize = 11.sp),
                        maxLines = 1,
                    )
                }

                if (topTasks.isEmpty()) {
                    Text(
                        text = "All done! 🎉",
                        style = TextStyle(fontSize = 12.sp),
                    )
                }
            }
        }
    }
}
