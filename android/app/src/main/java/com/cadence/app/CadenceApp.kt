package com.cadence.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.cadence.app.data.api.CadenceApi
import com.cadence.app.data.offline.CadenceDatabase
import com.cadence.app.sync.SyncManager

class CadenceApp : Application() {

    lateinit var database: CadenceDatabase
        private set
    lateinit var api: CadenceApi
        private set
    lateinit var syncManager: SyncManager
        private set

    override fun onCreate() {
        super.onCreate()

        instance = this

        database = CadenceDatabase.getInstance(this)
        api = CadenceApi.getInstance()
        syncManager = SyncManager(this, database, api)

        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)

            val reviewChannel = NotificationChannel(
                CHANNEL_REVIEWS,
                "Review Reminders",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Reminds you when topics are due for spaced repetition review"
            }

            val digestChannel = NotificationChannel(
                CHANNEL_DIGEST,
                "Daily Digest",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Daily summary of your pod's activity"
            }

            val streakChannel = NotificationChannel(
                CHANNEL_STREAK,
                "Streak Reminders",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Reminds you to keep your study streak alive"
            }

            manager.createNotificationChannels(
                listOf(reviewChannel, digestChannel, streakChannel)
            )
        }
    }

    companion object {
        const val CHANNEL_REVIEWS = "review_reminders"
        const val CHANNEL_DIGEST = "daily_digest"
        const val CHANNEL_STREAK = "streak_reminders"

        lateinit var instance: CadenceApp
            private set
    }
}
