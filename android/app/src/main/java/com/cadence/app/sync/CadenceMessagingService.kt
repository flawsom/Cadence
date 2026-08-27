package com.cadence.app.sync

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.cadence.app.CadenceApp
import com.cadence.app.MainActivity
import com.cadence.app.R
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * Receives FCM push notifications for:
 * - Review reminders (topics due for spaced repetition)
 * - Daily pod digest
 * - Streak reminders
 */
class CadenceMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        val type = data["type"] ?: return

        val (channelId, title, body) = when (type) {
            "review_reminder" -> Triple(
                CadenceApp.CHANNEL_REVIEWS,
                "📚 Reviews due",
                data["body"] ?: "You have topics to review today"
            )
            "daily_digest" -> Triple(
                CadenceApp.CHANNEL_DIGEST,
                "📊 Daily Digest",
                data["body"] ?: "Here's your pod's activity today"
            )
            "streak_reminder" -> Triple(
                CadenceApp.CHANNEL_STREAK,
                "🔥 Don't break your streak",
                data["body"] ?: "Study today to keep your streak alive"
            )
            else -> return
        }

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("notification_type", type)
        }

        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(System.currentTimeMillis().toInt(), notification)
    }

    override fun onNewToken(token: String) {
        // Re-register with server
        val app = CadenceApp.instance
        app.syncManager.registerDevice(token)
    }
}
