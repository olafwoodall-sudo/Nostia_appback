package com.nostia.app

import android.app.Application
import com.nostia.app.constants.AppConstants
import com.nostia.app.data.api.RetrofitClient
import com.nostia.app.data.auth.TokenManager
import com.nostia.app.location.LocationHelper
import com.stripe.android.PaymentConfiguration

class NostiaApplication : Application() {

    lateinit var tokenManager: TokenManager
        private set

    lateinit var retrofitClient: RetrofitClient
        private set

    lateinit var locationHelper: LocationHelper
        private set

    override fun onCreate() {
        super.onCreate()
        tokenManager = TokenManager(applicationContext)
        retrofitClient = RetrofitClient(tokenManager)
        locationHelper = LocationHelper(applicationContext)
        PaymentConfiguration.init(applicationContext, AppConstants.STRIPE_PUBLISHABLE_KEY)
    }
}
