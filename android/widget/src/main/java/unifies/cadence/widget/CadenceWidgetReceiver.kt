package unifies.cadence.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import androidx.glance.appwidget.updateAll

/**
 * Bridge between Android's AppWidget framework and Glance.
 * Handles update broadcasts and delegates to [CadenceWidget].
 */
class CadenceWidgetReceiver : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        super.onUpdate(context, appWidgetManager, appWidgetIds)
        // Glance handles the actual rendering via CadenceWidget.provideGlance
    }

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
    }
}
