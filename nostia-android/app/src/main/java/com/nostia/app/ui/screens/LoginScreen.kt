package com.nostia.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
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
import com.nostia.app.data.api.models.LoginRequest
import com.nostia.app.data.auth.TokenManager
import com.nostia.app.ui.theme.NostiaBackground
import com.nostia.app.ui.theme.NostiaBorder
import com.nostia.app.ui.theme.NostiaPrimary
import com.nostia.app.ui.theme.NostiaSurface
import com.nostia.app.ui.theme.NostiaTextPrimary
import com.nostia.app.ui.theme.NostiaTextSecondary
import kotlinx.coroutines.launch

@Composable
fun LoginScreen(
    apiService: ApiService,
    tokenManager: TokenManager,
    onLoginSuccess: () -> Unit,
    onNavigateToSignup: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(NostiaBackground),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = "Nostia",
                fontSize = 40.sp,
                fontWeight = FontWeight.Bold,
                color = NostiaPrimary
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "Welcome back",
                fontSize = 16.sp,
                color = NostiaTextSecondary
            )

            Spacer(modifier = Modifier.height(40.dp))

            OutlinedTextField(
                value = username,
                onValueChange = { username = it; errorMessage = null },
                label = { Text("Username") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = NostiaPrimary,
                    unfocusedBorderColor = NostiaBorder,
                    focusedLabelColor = NostiaPrimary,
                    unfocusedLabelColor = NostiaTextSecondary,
                    focusedTextColor = NostiaTextPrimary,
                    unfocusedTextColor = NostiaTextPrimary,
                    cursorColor = NostiaPrimary
                )
            )

            Spacer(modifier = Modifier.height(16.dp))

            OutlinedTextField(
                value = password,
                onValueChange = { password = it; errorMessage = null },
                label = { Text("Password") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = NostiaPrimary,
                    unfocusedBorderColor = NostiaBorder,
                    focusedLabelColor = NostiaPrimary,
                    unfocusedLabelColor = NostiaTextSecondary,
                    focusedTextColor = NostiaTextPrimary,
                    unfocusedTextColor = NostiaTextPrimary,
                    cursorColor = NostiaPrimary
                )
            )

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
                    if (username.isBlank() || password.isBlank()) {
                        errorMessage = "Please fill in all fields"
                        return@Button
                    }
                    scope.launch {
                        isLoading = true
                        errorMessage = null
                        try {
                            val response = apiService.login(LoginRequest(username.trim(), password))
                            if (response.isSuccessful) {
                                val body = response.body()
                                if (body != null) {
                                    tokenManager.saveToken(body.token)
                                    onLoginSuccess()
                                } else {
                                    errorMessage = "Unexpected server response"
                                }
                            } else {
                                errorMessage = when (response.code()) {
                                    401 -> "Invalid username or password"
                                    else -> "Login failed (${response.code()})"
                                }
                            }
                        } catch (e: Exception) {
                            errorMessage = "Network error: ${e.message}"
                        } finally {
                            isLoading = false
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
                    Text("Login", fontSize = 16.sp, color = NostiaTextPrimary)
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            TextButton(onClick = onNavigateToSignup) {
                Text(
                    text = "Don't have an account? Sign up",
                    color = NostiaPrimary,
                    fontSize = 14.sp
                )
            }
        }
    }
}
