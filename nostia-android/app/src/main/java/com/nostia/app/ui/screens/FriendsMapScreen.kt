package com.nostia.app.ui.screens

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
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
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.MapProperties
import com.google.maps.android.compose.MapUiSettings
import com.google.maps.android.compose.Marker
import com.google.maps.android.compose.MarkerState
import com.google.maps.android.compose.rememberCameraPositionState
import com.nostia.app.data.api.ApiService
import com.nostia.app.data.api.models.FriendLocation
import com.nostia.app.location.LocationHelper
import com.nostia.app.ui.theme.NostiaBackground
import com.nostia.app.ui.theme.NostiaPrimary
import com.nostia.app.ui.theme.NostiaSurface
import com.nostia.app.ui.theme.NostiaTextPrimary
import com.nostia.app.ui.theme.NostiaTextSecondary
import kotlinx.coroutines.launch

@Composable
fun FriendsMapScreen(
    apiService: ApiService,
    onUnauthorized: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val locationHelper = remember { LocationHelper(context) }

    var friendLocations by remember { mutableStateOf<List<FriendLocation>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var selectedFriend by remember { mutableStateOf<FriendLocation?>(null) }
    var userLatLng by remember { mutableStateOf<LatLng?>(null) }
    var hasLocationPermission by remember { mutableStateOf(locationHelper.hasLocationPermission()) }

    val cameraPositionState = rememberCameraPositionState {
        position = CameraPosition.fromLatLngZoom(LatLng(20.0, 0.0), 2f)
    }

    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        hasLocationPermission = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (hasLocationPermission) {
            locationHelper.getCurrentLocation(
                onSuccess = { lat, lng ->
                    userLatLng = LatLng(lat, lng)
                    scope.launch {
                        cameraPositionState.animate(
                            com.google.android.gms.maps.CameraUpdateFactory.newLatLngZoom(LatLng(lat, lng), 10f)
                        )
                    }
                },
                onFailure = { }
            )
        }
    }

    LaunchedEffect(Unit) {
        try {
            val response = apiService.getFriendLocations()
            if (response.code() == 401) { onUnauthorized(); return@LaunchedEffect }
            if (response.isSuccessful) {
                friendLocations = (response.body() ?: emptyList())
                    .filter { it.latitude != null && it.longitude != null }
            }
        } catch (_: Exception) {
        } finally {
            isLoading = false
        }

        if (!hasLocationPermission) {
            locationPermissionLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
        } else {
            locationHelper.getCurrentLocation(
                onSuccess = { lat, lng ->
                    userLatLng = LatLng(lat, lng)
                    scope.launch {
                        cameraPositionState.animate(
                            com.google.android.gms.maps.CameraUpdateFactory.newLatLngZoom(LatLng(lat, lng), 10f)
                        )
                    }
                },
                onFailure = { }
            )
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(NostiaBackground)) {
        if (isLoading) {
            CircularProgressIndicator(
                modifier = Modifier.align(Alignment.Center),
                color = NostiaPrimary
            )
        } else {
            GoogleMap(
                modifier = Modifier.fillMaxSize(),
                cameraPositionState = cameraPositionState,
                properties = MapProperties(
                    isMyLocationEnabled = hasLocationPermission
                ),
                uiSettings = MapUiSettings(
                    myLocationButtonEnabled = hasLocationPermission,
                    zoomControlsEnabled = true
                ),
                onMapClick = { selectedFriend = null }
            ) {
                friendLocations.forEach { friend ->
                    val lat = friend.latitude ?: return@forEach
                    val lng = friend.longitude ?: return@forEach
                    Marker(
                        state = MarkerState(position = LatLng(lat, lng)),
                        title = friend.name,
                        snippet = "@${friend.username}",
                        onClick = {
                            selectedFriend = friend
                            false
                        }
                    )
                }
            }

            // Info card for selected friend
            selectedFriend?.let { friend ->
                Card(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .fillMaxWidth()
                        .padding(16.dp),
                    colors = CardDefaults.cardColors(containerColor = NostiaSurface),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = friend.name,
                            fontSize = 17.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = NostiaTextPrimary
                        )
                        Text(
                            text = "@${friend.username}",
                            fontSize = 13.sp,
                            color = NostiaTextSecondary
                        )
                        if (friend.updatedAt != null) {
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Updated: ${friend.updatedAt}",
                                fontSize = 11.sp,
                                color = NostiaTextSecondary
                            )
                        }
                    }
                }
            }

            if (!hasLocationPermission) {
                Card(
                    modifier = Modifier
                        .align(Alignment.TopCenter)
                        .padding(16.dp),
                    colors = CardDefaults.cardColors(containerColor = NostiaSurface)
                ) {
                    Text(
                        text = "Enable location to see your position on the map",
                        color = NostiaTextSecondary,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(12.dp)
                    )
                }
            }
        }
    }
}
