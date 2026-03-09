package com.nostia.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nostia.app.data.api.ApiService
import com.nostia.app.data.api.models.RegisterRequest
import com.nostia.app.data.auth.TokenManager
import com.nostia.app.ui.theme.NostiaBackground
import com.nostia.app.ui.theme.NostiaBorder
import com.nostia.app.ui.theme.NostiaPrimary
import com.nostia.app.ui.theme.NostiaTextPrimary
import com.nostia.app.ui.theme.NostiaTextSecondary
import kotlinx.coroutines.launch

@Composable
fun SignupScreen(
    apiService: ApiService,
    tokenManager: TokenManager,
    onRegisterSuccess: () -> Unit,
    onNavigateToLogin: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf("") }
    var username by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var locationConsent by remember { mutableStateOf(false) }
    var dataCollectionConsent by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = NostiaPrimary,
        unfocusedBorderColor = NostiaBorder,
        focusedLabelColor = NostiaPrimary,
        unfocusedLabelColor = NostiaTextSecondary,
        focusedTextColor = NostiaTextPrimary,
        unfocusedTextColor = NostiaTextPrimary,
        cursorColor = NostiaPrimary
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(NostiaBackground)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 32.dp, vertical = 40.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "Create Account",
            fontSize = 32.sp,
            fontWeight = FontWeight.Bold,
            color = NostiaTextPrimary
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "Join the Nostia community",
            fontSize = 15.sp,
            color = NostiaTextSecondary
        )

        Spacer(modifier = Modifier.height(32.dp))

        OutlinedTextField(
            value = name,
            onValueChange = { name = it; errorMessage = null },
            label = { Text("Full Name") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            colors = fieldColors
        )

        Spacer(modifier = Modifier.height(12.dp))

        OutlinedTextField(
            value = username,
            onValueChange = { username = it; errorMessage = null },
            label = { Text("Username") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            colors = fieldColors
        )

        Spacer(modifier = Modifier.height(12.dp))

        OutlinedTextField(
            value = email,
            onValueChange = { email = it; errorMessage = null },
            label = { Text("Email (optional)") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            colors = fieldColors
        )

        Spacer(modifier = Modifier.height(12.dp))

        OutlinedTextField(
            value = password,
            onValueChange = { password = it; errorMessage = null },
            label = { Text("Password") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            colors = fieldColors
        )

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "Consent",
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            color = NostiaTextPrimary,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(12.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Location Consent",
                    fontSize = 14.sp,
                    color = NostiaTextPrimary
                )
                Text(
                    text = "Allow sharing your location with friends",
                    fontSize = 12.sp,
                    color = NostiaTextSecondary
                )
            }
            Switch(
                checked = locationConsent,
                onCheckedChange = { locationConsent = it },
                colors = SwitchDefaults.colors(checkedTrackColor = NostiaPrimary)
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Data Collection Consent",
                    fontSize = 14.sp,
                    color = NostiaTextPrimary
                )
                Text(
                    text = "Allow usage analytics to improve the app",
                    fontSize = 12.sp,
                    color = NostiaTextSecondary
                )
            }
            Switch(
                checked = dataCollectionConsent,
                onCheckedChange = { dataCollectionConsent = it },
                colors = SwitchDefaults.colors(checkedTrackColor = NostiaPrimary)
            )
        }

        if (!locationConsent || !dataCollectionConsent) {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Both consents are required to continue",
                fontSize = 12.sp,
                color = NostiaTextSecondary
            )
        }

        if (errorMessage != null) {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = errorMessage!!,
                color = androidx.compose.ui.graphics.Color(0xFFEF4444),
                fontSize = 14.sp
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        Button(
            onClick = {
                when {
                    name.isBlank() || username.isBlank() || password.isBlank() ->
                        errorMessage = "Please fill in all required fields"
                    !locationConsent ->
                        errorMessage = "Location consent is required"
                    !dataCollectionConsent ->
                        errorMessage = "Data collection consent is required"
                    else -> {
                        scope.launch {
                            isLoading = true
                            errorMessage = null
                            try {
                                val response = apiService.register(
                                    RegisterRequest(
                                        username = username.trim(),
                                        password = password,
                                        name = name.trim(),
                                        email = email.takeIf { it.isNotBlank() },
                                        locationConsent = locationConsent,
                                        dataCollectionConsent = dataCollectionConsent
                                    )
                                )
                                if (response.isSuccessful) {
                                    val body = response.body()
                                    if (body != null) {
                                        tokenManager.saveToken(body.token)
                                        onRegisterSuccess()
                                    } else {
                                        errorMessage = "Unexpected server response"
                                    }
                                } else {
                                    errorMessage = when (response.code()) {
                                        409 -> "Username already taken"
                                        400 -> "Invalid registration data"
                                        else -> "Registration failed (${response.code()})"
                                    }
                                }
                            } catch (e: Exception) {
                                errorMessage = "Network error: ${e.message}"
                            } finally {
                                isLoading = false
                            }
                        }
                    }
                }
            },
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp),
            colors = ButtonDefaults.buttonColors(containerColor = NostiaPrimary),
            enabled = !isLoading
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    color = NostiaTextPrimary,
                    strokeWidth = 2.dp,
                    modifier = Modifier.height(20.dp)
                )
            } else {
                Text("Create Account", fontSize = 16.sp, color = NostiaTextPrimary)
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        TextButton(onClick = onNavigateToLogin) {
            Text(
                text = "Already have an account? Log in",
                color = NostiaPrimary,
                fontSize = 14.sp
            )
        }
    }
}
