pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "Cadence"

include(":app")
include(":core:common")
include(":core:network")
include(":core:database")
include(":core:security")
include(":feature:onboarding")
include(":feature:today")
include(":feature:taskdetail")
include(":feature:trackdetail")
include(":feature:pods")
include(":feature:practice")
include(":feature:analytics")
include(":feature:settings")
include(":sync")
include(":widget")
include(":notifications")
