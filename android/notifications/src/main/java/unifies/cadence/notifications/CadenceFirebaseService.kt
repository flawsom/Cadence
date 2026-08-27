package unifies.cadence.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class CadenceFirebaseService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // Register with backend
        // Handled by WorkManager sync
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        val data = message.data
        val type = data["type"] ?: return
        val title = message.notification?.title ?: data["title"] ?: return
        val body = message.notification?.body ?: data["body"] ?: return
        val deepLink = data["deep_link"]

        val channel = when (type) {
            "daily_digest" -> CHANNEL_DAILY
            "review_due" -> CHANNEL_REVIEWS
            "pod_activity" -> CHANNEL_PODS
            else -> CHANNEL_SYSTEM
        }

        val intent = deepLink?.let { createDeepLinkIntent(it) }
            ?: createMainActivityIntent()

        val pendingIntent = PendingIntent.getActivity(
            this,
            System.currentTimeMillis().toInt(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(this, channel)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(
                when (channel) {
                    CHANNEL_DAILY -> NotificationCompat.PRIORITY_HIGH
                    else -> NotificationCompat.PRIORITY_DEFAULT
                }
            )
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(System.currentTimeMillis().toInt(), notification)
    }

    private fun createDeepLinkIntent(path: String): Intent {
        val uri = Uri.parse("cadence://$path")
        return Intent(Intent.ACTION_VIEW, uri).apply {
            setPackage(packageName)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
    }

    private fun createMainActivityIntent(): Intent {
        return packageManager.getLaunchIntentForPackage(packageName)?.apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        } ?: Intent()
    }

    companion object {
        const val CHANNEL_DAILY = "cadence_daily"
        const val CHANNEL_REVIEWS = "cadence_reviews"
        const val CHANNEL_PODS = "cadence_pods"
        const val CHANNEL_SYSTEM = "cadence_system"

        fun createChannels(context: Context) {
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            val channels = listOf(
                NotificationChannel(CHANNEL_DAILY, "Daily Digest", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "Daily study summary and tasks"
                },
                NotificationChannel(CHANNEL_REVIEWS, "Reviews Due", NotificationManager.IMPORTANCE_DEFAULT).apply {
                    description = "Spaced repetition reminders"
                },
                NotificationChannel(CHANNEL_PODS, "Pod Activity", NotificationManager.IMPORTANCE_LOW).apply {
                    description = "Updates from your study group"
                },
                NotificationChannel(CHANNEL_SYSTEM, "System", NotificationManager.IMPORTANCE_LOW).apply {
                    description = "System notifications"
                },
            )

            manager.createNotificationChannels(channels)
        }
    }
}
