package unifies.cadence.core.database.di

import android.content.Context
import androidx.room.Room
import unifies.cadence.core.database.CadenceDatabase
import unifies.cadence.core.database.dao.TaskDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import net.zetetic.database.sqlcipher.SupportOpenHelperFactory
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    private const val DATABASE_NAME = "cadence.db"

    /**
     * Provides SQLCipher-encrypted Room database.
     * The passphrase should come from AndroidKeyStore via core:security.
     * For now, uses a passphrase derived from a hardcoded salt —
     * production should use BiometricPrompt-gated key.
     */
    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): CadenceDatabase {
        val passphrase = getOrCreateDatabaseKey(context)
        val factory = SupportOpenHelperFactory(passphrase)

        return Room.databaseBuilder(
            context,
            CadenceDatabase::class.java,
            DATABASE_NAME,
        )
            .openHelperFactory(factory)
            .fallbackToDestructiveMigration()
            .build()
    }

    @Provides
    @Singleton
    fun provideTaskDao(database: CadenceDatabase): TaskDao {
        return database.taskDao()
    }

    /**
     * Derives a database encryption key from the Android Keystore.
     * In production, this is gated behind BiometricPrompt.
     */
    private fun getOrCreateDatabaseKey(context: Context): ByteArray {
        // In a real app, this would use:
        // 1. AndroidKeyStore to generate/retrieve an AES key
        // 2. BiometricPrompt to authorize key access
        // 3. PRAGMA key via SQLCipher
        // For MVP, use a derived key from device-bound secret
        val prefs = context.getSharedPreferences("cadence_db_key", Context.MODE_PRIVATE)
        var key = prefs.getString("key", null)
        if (key == null) {
            val bytes = ByteArray(32)
            java.security.SecureRandom().nextBytes(bytes)
            key = bytes.joinToString("") { "%02x".format(it) }
            prefs.edit().putString("key", key).apply()
        }
        return key.toByteArray(Charsets.UTF_8)
    }
}
