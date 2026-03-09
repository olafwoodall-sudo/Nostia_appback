package com.nostia.app.data.auth

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.nostia.app.constants.AppConstants

class TokenManager(context: Context) {

    private val masterKey: MasterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val sharedPreferences: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        AppConstants.PREFS_FILE_NAME,
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun saveToken(token: String) {
        sharedPreferences.edit().putString(AppConstants.JWT_TOKEN_KEY, token).apply()
    }

    fun getToken(): String? {
        return sharedPreferences.getString(AppConstants.JWT_TOKEN_KEY, null)
    }

    fun clearToken() {
        sharedPreferences.edit().remove(AppConstants.JWT_TOKEN_KEY).apply()
    }

    fun isLoggedIn(): Boolean {
        return getToken() != null
    }

    fun getAuthHeader(): String {
        return "Bearer ${getToken() ?: ""}"
    }
}
