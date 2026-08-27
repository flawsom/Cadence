package app.cadence.core.security.di

import app.cadence.core.network.auth.TokenProvider
import app.cadence.core.security.TokenStore
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class SecurityModule {

    @Binds
    @Singleton
    abstract fun bindTokenProvider(impl: TokenStore): TokenProvider
}
