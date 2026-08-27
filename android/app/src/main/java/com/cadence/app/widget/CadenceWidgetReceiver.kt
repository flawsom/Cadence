package com.cadence.app.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews
import com.cadence.app.R
import com.cadence.app.CadenceApp
import kotlinx.coroutines.*
import java.time.LocalDate
import java.time.format.DateTimeFormatter

/**
 * Home-screen widget showing today's remaining task count and current streak.
 * Built with Jetpack Glance in v1; classic AppWidgetProvider for MVP.
 */
class CadenceWidgetReceiver : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        for (appWidgetId in appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId)
        }
    }

    companion object {
        fun updateWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int,
        ) {
            val views = RemoteViews(context.packageName, R.layout.widget_initial_layout)

            // Launch coroutine to fetch data
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    val app = CadenceApp.instance
                    val todayKey = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
                    val stats = app.api.getStats(todayKey)
                    val board = app.api.getBoard(todayKey)

                    val remaining = board.tasks.count { it.status == "open" }
                    val streak = stats.streak

                    views.setTextViewText(R.id.widget_streak, "🔥 $streak")
                    views.setTextViewText(
                        R.id.widget_tasks,
                        if (remaining > 0) "$remaining tasks left" else "All done! 🎉"
                    )

                    appWidgetManager.updateAppWidget(appWidgetId, views)
                } catch (e: Exception) {
                    views.setTextViewText(R.id.widget_streak, "🔥 —")
                    views.setTextViewText(R.id.widget_tasks, "Tap to sync")
                    appWidgetManager.updateAppWidget(appWidgetId, views)
                }
            }
        }
    }
}
