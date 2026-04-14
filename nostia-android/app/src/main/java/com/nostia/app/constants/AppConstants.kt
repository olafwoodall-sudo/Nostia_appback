package com.nostia.app.constants

import com.nostia.app.BuildConfig

object AppConstants {
    const val BASE_URL = "http://142.93.116.6:8080/api/"
    val GOOGLE_MAPS_API_KEY: String = BuildConfig.MAPS_API_KEY
    val STRIPE_PUBLISHABLE_KEY: String = BuildConfig.STRIPE_PUBLISHABLE_KEY
    const val JWT_TOKEN_KEY = "jwt_token"
    const val PREFS_FILE_NAME = "nostia_secure_prefs"
}
