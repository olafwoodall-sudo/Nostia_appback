package com.nostia.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nostia.app.data.api.ApiService
import com.nostia.app.data.api.models.ConsentRequest
import com.nostia.app.data.api.models.UpdateUserRequest
import com.nostia.app.data.api.models.User
import com.nostia.app.data.auth.TokenManager
import com.nostia.app.ui.theme.NostiaBackground
import com.nostia.app.ui.theme.NostiaBorder
import com.nostia.app.ui.theme.NostiaPrimary
import com.nostia.app.ui.theme.NostiaSurface
import com.nostia.app.ui.theme.NostiaTextPrimary
import com.nostia.app.ui.theme.NostiaTextSecondary
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PrivacyScreen(
    apiService: ApiService,
    tokenManager: TokenManager,
    onUnauthorized: () -> Unit,
    onNavigateBack: () -> Unit,
    onAccountDeleted: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var user by remember { mutableStateOf<User?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var locationConsent by remember { mutableStateOf(false) }
    var dataConsent by remember { mutableStateOf(false) }
    var showEditDialog by remember { mutableStateOf(false) }
    var showDeleteDialog by remember { mutableStateOf(false) }
    var statusMessage by remember { mutableStateOf<String?>(null) }

    fun loadData() {
        scope.launch {
            isLoading = true
            try {
                val meResponse = apiService.getMe()
                if (meResponse.code() == 401) { onUnauthorized(); return@launch }
                if (meResponse.isSuccessful) user = meResponse.body()

                val consentResponse = apiService.getConsent()
                if (consentResponse.isSuccessful) {
                    val consent = consentResponse.body()?.consent
                    locationConsent = consent?.locationConsent ?: false
                    dataConsent = consent?.dataCollectionConsent ?: false
                }
            } catch (_: Exception) {
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(Unit) { loadData() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Privacy & Profile", color = NostiaTextPrimary, fontWeight = FontWeight.SemiBold) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = NostiaTextPrimary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = NostiaSurface)
            )
        },
        containerColor = NostiaBackground
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(NostiaBackground)
                .padding(paddingValues)
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.align(Alignment.Center),
                    color = NostiaPrimary
                )
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    // Profile card
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = NostiaSurface),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(16.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(56.dp)
                                        .background(NostiaPrimary, CircleShape),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = ((user?.name?.firstOrNull() ?: user?.username?.firstOrNull() ?: '?')
                                            .uppercaseChar()).toString(),
                                        color = NostiaTextPrimary,
                                        fontSize = 22.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                                Column(
                                    modifier = Modifier
                                        .weight(1f)
                                        .padding(start = 14.dp)
                                ) {
                                    Text(
                                        text = user?.name ?: "",
                                        fontSize = 17.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = NostiaTextPrimary
                                    )
                                    Text(
                                        text = "@${user?.username ?: ""}",
                                        fontSize = 14.sp,
                                        color = NostiaTextSecondary
                                    )
                                    if (!user?.email.isNullOrBlank()) {
                                        Text(text = user!!.email!!, fontSize = 13.sp, color = NostiaTextSecondary)
                                    }
                                }
                                IconButton(onClick = { showEditDialog = true }) {
                                    Icon(Icons.Filled.Edit, contentDescription = "Edit Profile", tint = NostiaPrimary)
                                }
                            }
                        }
                    }

                    // Consent card
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = NostiaSurface),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(
                                    text = "Consent Settings",
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = NostiaTextPrimary
                                )
                                Spacer(modifier = Modifier.height(12.dp))

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text("Location Consent", fontSize = 14.sp, color = NostiaTextPrimary)
                                        Text("Share location with friends", fontSize = 12.sp, color = NostiaTextSecondary)
                                    }
                                    Switch(
                                        checked = locationConsent,
                                        onCheckedChange = { newValue ->
                                            locationConsent = newValue
                                            scope.launch {
                                                try {
                                                    apiService.updateConsent(
                                                        ConsentRequest(locationConsent = newValue, dataCollectionConsent = dataConsent)
                                                    )
                                                    statusMessage = "Consent updated"
                                                } catch (_: Exception) { }
                                            }
                                        },
                                        colors = SwitchDefaults.colors(checkedTrackColor = NostiaPrimary)
                                    )
                                }

                                Spacer(modifier = Modifier.height(8.dp))

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text("Data Collection Consent", fontSize = 14.sp, color = NostiaTextPrimary)
                                        Text("Usage analytics", fontSize = 12.sp, color = NostiaTextSecondary)
                                    }
                                    Switch(
                                        checked = dataConsent,
                                        onCheckedChange = { newValue ->
                                            dataConsent = newValue
                                            scope.launch {
                                                try {
                                                    apiService.updateConsent(
                                                        ConsentRequest(locationConsent = locationConsent, dataCollectionConsent = newValue)
                                                    )
                                                    statusMessage = "Consent updated"
                                                } catch (_: Exception) { }
                                            }
                                        },
                                        colors = SwitchDefaults.colors(checkedTrackColor = NostiaPrimary)
                                    )
                                }
                            }
                        }
                    }

                    // Data actions card
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = NostiaSurface),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(
                                    text = "Data",
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = NostiaTextPrimary
                                )
                                Spacer(modifier = Modifier.height(12.dp))

                                Button(
                                    onClick = {
                                        scope.launch {
                                            try {
                                                val response = apiService.requestDataExport()
                                                if (response.isSuccessful) {
                                                    statusMessage = "Data export requested. Export ID: ${response.body()?.exportId}"
                                                } else {
                                                    statusMessage = "Export request failed (${response.code()})"
                                                }
                                            } catch (_: Exception) {
                                                statusMessage = "Request failed"
                                            }
                                        }
                                    },
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = ButtonDefaults.buttonColors(containerColor = NostiaSurface),
                                    shape = RoundedCornerShape(8.dp)
                                ) {
                                    Text("Request Data Export", color = NostiaPrimary)
                                }

                                Spacer(modifier = Modifier.height(8.dp))

                                Button(
                                    onClick = { showDeleteDialog = true },
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = androidx.compose.ui.graphics.Color(0xFFEF4444)
                                    ),
                                    shape = RoundedCornerShape(8.dp)
                                ) {
                                    Text("Delete Account", color = NostiaTextPrimary)
                                }
                            }
                        }
                    }

                    if (statusMessage != null) {
                        item {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                colors = CardDefaults.cardColors(containerColor = NostiaSurface)
                            ) {
                                Text(
                                    text = statusMessage!!,
                                    color = NostiaPrimary,
                                    fontSize = 13.sp,
                                    modifier = Modifier.padding(12.dp)
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    if (showEditDialog && user != null) {
        EditProfileDialog(
            user = user!!,
            apiService = apiService,
            onDismiss = { showEditDialog = false },
            onSaved = {
                showEditDialog = false
                loadData()
            }
        )
    }

    if (showDeleteDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            title = { Text("Delete Account", color = NostiaTextPrimary) },
            text = {
                Text(
                    "This will permanently delete your account and all associated data. This action cannot be undone.",
                    color = NostiaTextSecondary
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        showDeleteDialog = false
                        scope.launch {
                            try {
                                val response = apiService.deleteAccountData()
                                if (response.isSuccessful) {
                                    tokenManager.clearToken()
                                    onAccountDeleted()
                                }
                            } catch (_: Exception) { }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = androidx.compose.ui.graphics.Color(0xFFEF4444))
                ) {
                    Text("Delete Forever", color = NostiaTextPrimary)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialog = false }) {
                    Text("Cancel", color = NostiaTextSecondary)
                }
            },
            containerColor = NostiaSurface
        )
    }
}

@Composable
private fun EditProfileDialog(
    user: User,
    apiService: ApiService,
    onDismiss: () -> Unit,
    onSaved: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf(user.name) }
    var username by remember { mutableStateOf(user.username) }
    var email by remember { mutableStateOf(user.email ?: "") }
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

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Edit Profile", color = NostiaTextPrimary, fontWeight = FontWeight.Bold) },
        text = {
            Column {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Name") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = fieldColors
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = username,
                    onValueChange = { username = it },
                    label = { Text("Username") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = fieldColors
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Email") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = fieldColors
                )
                if (errorMessage != null) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = errorMessage!!,
                        color = androidx.compose.ui.graphics.Color(0xFFEF4444),
                        fontSize = 13.sp
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    scope.launch {
                        isLoading = true
                        errorMessage = null
                        try {
                            val response = apiService.updateMe(
                                UpdateUserRequest(
                                    name = name.trim().takeIf { it.isNotBlank() },
                                    username = username.trim().takeIf { it.isNotBlank() },
                                    email = email.trim().takeIf { it.isNotBlank() }
                                )
                            )
                            if (response.isSuccessful) {
                                onSaved()
                            } else {
                                errorMessage = "Update failed (${response.code()})"
                            }
                        } catch (e: Exception) {
                            errorMessage = "Error: ${e.message}"
                        } finally {
                            isLoading = false
                        }
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = NostiaPrimary),
                enabled = !isLoading
            ) {
                if (isLoading) CircularProgressIndicator(
                    color = NostiaTextPrimary,
                    strokeWidth = 2.dp,
                    modifier = Modifier.size(18.dp)
                )
                else Text("Save", color = NostiaTextPrimary)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel", color = NostiaTextSecondary) }
        },
        containerColor = NostiaSurface
    )
}
