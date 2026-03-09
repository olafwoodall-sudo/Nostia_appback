package com.nostia.app.ui.screens

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import com.nostia.app.data.api.models.CreateTripRequest
import com.nostia.app.data.api.models.Trip
import com.nostia.app.ui.theme.NostiaBackground
import com.nostia.app.ui.theme.NostiaBorder
import com.nostia.app.ui.theme.NostiaPrimary
import com.nostia.app.ui.theme.NostiaSurface
import com.nostia.app.ui.theme.NostiaTextPrimary
import com.nostia.app.ui.theme.NostiaTextSecondary
import kotlinx.coroutines.launch

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun TripsScreen(
    apiService: ApiService,
    onUnauthorized: () -> Unit,
    onNavigateToVault: (tripId: Int, tripTitle: String) -> Unit
) {
    val scope = rememberCoroutineScope()
    var trips by remember { mutableStateOf<List<Trip>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var showCreateDialog by remember { mutableStateOf(false) }
    var tripToDelete by remember { mutableStateOf<Trip?>(null) }

    fun loadTrips() {
        scope.launch {
            isLoading = true
            try {
                val response = apiService.getTrips()
                if (response.code() == 401) { onUnauthorized(); return@launch }
                if (response.isSuccessful) trips = response.body() ?: emptyList()
            } catch (_: Exception) {
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(Unit) { loadTrips() }

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showCreateDialog = true },
                containerColor = NostiaPrimary
            ) {
                Icon(Icons.Filled.Add, contentDescription = "Add Trip", tint = NostiaTextPrimary)
            }
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
            } else if (trips.isEmpty()) {
                Column(
                    modifier = Modifier.align(Alignment.Center),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "No trips yet",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = NostiaTextPrimary
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Tap + to create your first trip",
                        fontSize = 14.sp,
                        color = NostiaTextSecondary
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    item {
                        Text(
                            text = "Your Trips",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = NostiaTextPrimary,
                            modifier = Modifier.padding(vertical = 8.dp)
                        )
                    }
                    items(trips) { trip ->
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .combinedClickable(
                                    onClick = { onNavigateToVault(trip.id, trip.title) },
                                    onLongClick = { tripToDelete = trip }
                                ),
                            colors = CardDefaults.cardColors(containerColor = NostiaSurface),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(
                                    text = trip.title,
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = NostiaTextPrimary
                                )
                                if (!trip.destination.isNullOrBlank()) {
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = trip.destination,
                                        fontSize = 14.sp,
                                        color = NostiaTextSecondary
                                    )
                                }
                                if (!trip.description.isNullOrBlank()) {
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = trip.description,
                                        fontSize = 13.sp,
                                        color = NostiaTextSecondary,
                                        maxLines = 2
                                    )
                                }
                                if (!trip.startDate.isNullOrBlank() || !trip.endDate.isNullOrBlank()) {
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = listOfNotNull(trip.startDate, trip.endDate).joinToString(" — "),
                                        fontSize = 12.sp,
                                        color = NostiaPrimary
                                    )
                                }
                                Spacer(modifier = Modifier.height(6.dp))
                                Text(
                                    text = "Long-press to delete · Tap to open vault",
                                    fontSize = 11.sp,
                                    color = NostiaTextSecondary
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    if (showCreateDialog) {
        CreateTripDialog(
            apiService = apiService,
            onDismiss = { showCreateDialog = false },
            onCreated = {
                showCreateDialog = false
                loadTrips()
            }
        )
    }

    if (tripToDelete != null) {
        AlertDialog(
            onDismissRequest = { tripToDelete = null },
            title = { Text("Delete Trip", color = NostiaTextPrimary) },
            text = { Text("Delete \"${tripToDelete!!.title}\"? This cannot be undone.", color = NostiaTextSecondary) },
            confirmButton = {
                Button(
                    onClick = {
                        val id = tripToDelete!!.id
                        tripToDelete = null
                        scope.launch {
                            try {
                                val response = apiService.deleteTrip(id)
                                if (response.code() == 401) { onUnauthorized(); return@launch }
                                if (response.isSuccessful) loadTrips()
                            } catch (_: Exception) { }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = androidx.compose.ui.graphics.Color(0xFFEF4444))
                ) {
                    Text("Delete", color = NostiaTextPrimary)
                }
            },
            dismissButton = {
                TextButton(onClick = { tripToDelete = null }) {
                    Text("Cancel", color = NostiaTextSecondary)
                }
            },
            containerColor = NostiaSurface
        )
    }
}

@Composable
private fun CreateTripDialog(
    apiService: ApiService,
    onDismiss: () -> Unit,
    onCreated: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var title by remember { mutableStateOf("") }
    var destination by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var startDate by remember { mutableStateOf("") }
    var endDate by remember { mutableStateOf("") }
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
        title = { Text("New Trip", color = NostiaTextPrimary, fontWeight = FontWeight.Bold) },
        text = {
            Column {
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("Title *") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = fieldColors
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = destination,
                    onValueChange = { destination = it },
                    label = { Text("Destination") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = fieldColors
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Description") },
                    modifier = Modifier.fillMaxWidth(),
                    maxLines = 3,
                    colors = fieldColors
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = startDate,
                    onValueChange = { startDate = it },
                    label = { Text("Start Date (YYYY-MM-DD)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = fieldColors
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = endDate,
                    onValueChange = { endDate = it },
                    label = { Text("End Date (YYYY-MM-DD)") },
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
                    if (title.isBlank()) {
                        errorMessage = "Title is required"
                        return@Button
                    }
                    scope.launch {
                        isLoading = true
                        errorMessage = null
                        try {
                            val response = apiService.createTrip(
                                CreateTripRequest(
                                    title = title.trim(),
                                    destination = destination.trim(),
                                    description = description.trim(),
                                    startDate = startDate.trim(),
                                    endDate = endDate.trim()
                                )
                            )
                            if (response.isSuccessful) {
                                onCreated()
                            } else {
                                errorMessage = "Failed to create trip (${response.code()})"
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
                else Text("Create", color = NostiaTextPrimary)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = NostiaTextSecondary)
            }
        },
        containerColor = NostiaSurface
    )
}
