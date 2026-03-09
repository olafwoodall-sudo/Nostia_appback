package com.nostia.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.core.view.WindowCompat
import com.nostia.app.navigation.NostiaNavigation
import com.nostia.app.ui.theme.NostiaTheme

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        WindowCompat.setDecorFitsSystemWindows(window, false)

        val app = application as NostiaApplication

        setContent {
            NostiaTheme {
                NostiaNavigation(
                    tokenManager = app.tokenManager,
                    apiService = app.retrofitClient.apiService
                )
            }
        }
    }
}
