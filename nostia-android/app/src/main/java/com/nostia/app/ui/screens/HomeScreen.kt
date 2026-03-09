package com.nostia.app.ui.screens

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nostia.app.data.api.ApiService
import com.nostia.app.data.api.models.Event
import com.nostia.app.data.api.models.Trip
import com.nostia.app.data.api.models.UpdateUserRequest
import com.nostia.app.data.api.models.User
import com.nostia.app.data.auth.TokenManager
import com.nostia.app.location.LocationHelper
import com.nostia.app.ui.theme.NostiaBackground
import com.nostia.app.ui.theme.NostiaBorder
import com.nostia.app.ui.theme.NostiaPrimary
import com.nostia.app.ui.theme.NostiaSurface
import com.nostia.app.ui.theme.NostiaTextPrimary
import com.nostia.app.ui.theme.NostiaTextSecondary
import kotlinx.coroutines.launch

@Composable
fun HomeScreen(
    apiService: ApiService,
    tokenManager: TokenManager,
    onLogout: () -> Unit,
    onUnauthorized: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val locationHelper = remember { LocationHelper(context) }

    var user by remember { mutableStateOf<User?>(null) }
    var trips by remember { mutableStateOf<List<Trip>>(emptyList()) }
    var friends by remember { mutableStateOf<List<User>>(emptyList()) }
    var nearbyEvents by remember { mutableStateOf<List<Event>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var homeStatusOpen by remember { mutableStateOf(false) }

    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val granted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (granted) {
            locationHelper.getCurrentLocation(
                onSuccess = { lat, lng ->
                    scope.launch {
                        try {
                            apiService.updateMe(UpdateUserRequest(latitude = lat, longitude = lng))
                            val eventsResponse = apiService.getNearbyEvents(lat, lng)
                            if (eventsResponse.isSuccessful) {
                                nearbyEvents = eventsResponse.body() ?: emptyList()
                            }
                        } catch (_: Exception) { }
                    }
                },
                onFailure = { }
            )
        }
    }

    LaunchedEffect(Unit) {
        isLoading = true
        try {
            val userResponse = apiService.getMe()
            if (userResponse.code() == 401) { onUnauthorized(); return@LaunchedEffect }
            if (userResponse.isSuccessful) {
                user = userResponse.body()
                homeStatusOpen = user?.homeStatus == "open"
            }

            val tripsResponse = apiService.getTrips()
            if (tripsResponse.isSuccessful) trips = tripsResponse.body() ?: emptyList()

            val friendsResponse = apiService.getFriends()
            if (friendsResponse.isSuccessful) friends = friendsResponse.body() ?: emptyList()
        } catch (_: Exception) {
        } finally {
            isLoading = false
        }

        if (!locationHelper.hasLocationPermission()) {
            locationPermissionLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
        } else {
            locationHelper.getCurrentLocation(
                onSuccess = { lat, lng ->
                    scope.launch {
                        try {
                            apiService.updateMe(UpdateUserRequest(latitude = lat, longitude = lng))
                            val eventsResponse = apiService.getNearbyEvents(lat, lng)
                            if (eventsResponse.isSuccessful) {
                                nearbyEvents = eventsResponse.body() ?: emptyList()
                            }
                        } catch (_: Exception) { }
                    }
                },
                onFailure = { }
            )
        }
    }

    if (isLoading) {
        Box(
            modifier = Modifier.fillMaxSize().background(NostiaBackground),
            contentAlignment = Alignment.Center
        ) {
            CircularProgressIndicator(color = NostiaPrimary)
        }
        return
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(NostiaBackground)
            .verticalScroll(rememberScrollState())
            .padding(16.dp)
    ) {
        // Welcome Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = NostiaSurface),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "Welcome back,",
                            fontSize = 14.sp,
                            color = NostiaTextSecondary
                        )
                        Text(
                            text = user?.name ?: user?.username ?: "Traveler",
                            fontSize = 22.sp,
                            fontWeight = FontWeight.Bold,
                            color = NostiaTextPrimary
                        )
                    }
                    Button(
                        onClick = onLogout,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = NostiaBackground
                        )
                    ) {
                        Text("Logout", color = NostiaTextSecondary, fontSize = 13.sp)
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Home Status",
                            fontSize = 14.sp,
                            color = NostiaTextPrimary
                        )
                        Text(
                            text = if (homeStatusOpen) "Open — friends can drop by" else "Closed",
                            fontSize = 12.sp,
                            color = NostiaTextSecondary
                        )
                    }
                    Switch(
                        checked = homeStatusOpen,
                        onCheckedChange = { newValue ->
                            homeStatusOpen = newValue
                            scope.launch {
                                try {
                                    apiService.updateMe(
                                        UpdateUserRequest(homeStatus = if (newValue) "open" else "closed")
                                    )
                                } catch (_: Exception) { }
                            }
                        },
                        colors = SwitchDefaults.colors(checkedTrackColor = NostiaPrimary)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Stats Row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            StatCard(
                modifier = Modifier.weight(1f),
                label = "Trips",
                value = trips.size.toString()
            )
            StatCard(
                modifier = Modifier.weight(1f),
                label = "Friends",
                value = friends.size.toString()
            )
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Upcoming Trips
        Text(
            text = "Upcoming Trips",
            fontSize = 18.sp,
            fontWeight = FontWeight.SemiBold,
            color = NostiaTextPrimary
        )

        Spacer(modifier = Modifier.height(8.dp))

        if (trips.isEmpty()) {
            Text(
                text = "No trips yet. Create your first trip!",
                color = NostiaTextSecondary,
                fontSize = 14.sp
            )
        } else {
            trips.take(3).forEach { trip ->
                TripCard(trip = trip)
                Spacer(modifier = Modifier.height(8.dp))
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Nearby Events
        Text(
            text = "Nearby Events",
            fontSize = 18.sp,
            fontWeight = FontWeight.SemiBold,
            color = NostiaTextPrimary
        )

        Spacer(modifier = Modifier.height(8.dp))

        if (nearbyEvents.isEmpty()) {
            Text(
                text = "No events nearby. Enable location to discover events.",
                color = NostiaTextSecondary,
                fontSize = 14.sp
            )
        } else {
            nearbyEvents.take(5).forEach { event ->
                EventCard(event = event)
                Spacer(modifier = Modifier.height(8.dp))
            }
        }

        Spacer(modifier = Modifier.height(16.dp))
    }
}

@Composable
private fun StatCard(modifier: Modifier = Modifier, label: String, value: String) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = NostiaSurface),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = value,
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = NostiaPrimary
            )
            Text(
                text = label,
                fontSize = 13.sp,
                color = NostiaTextSecondary
            )
        }
    }
}

@Composable
private fun TripCard(trip: Trip) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = NostiaSurface),
        shape = RoundedCornerShape(10.dp)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(
                text = trip.title,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = NostiaTextPrimary
            )
            if (!trip.destination.isNullOrBlank()) {
                Text(
                    text = trip.destination,
                    fontSize = 13.sp,
                    color = NostiaTextSecondary
                )
            }
            if (!trip.startDate.isNullOrBlank()) {
                Text(
                    text = trip.startDate,
                    fontSize = 12.sp,
                    color = NostiaTextSecondary
                )
            }
        }
    }
}

@Composable
private fun EventCard(event: Event) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = NostiaSurface),
        shape = RoundedCornerShape(10.dp)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(
                text = event.title,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = NostiaTextPrimary
            )
            if (!event.location.isNullOrBlank()) {
                Text(
                    text = event.location,
                    fontSize = 13.sp,
                    color = NostiaTextSecondary
                )
            }
            if (!event.startDate.isNullOrBlank()) {
                Text(
                    text = event.startDate,
                    fontSize = 12.sp,
                    color = NostiaTextSecondary
                )
            }
        }
    }
}
