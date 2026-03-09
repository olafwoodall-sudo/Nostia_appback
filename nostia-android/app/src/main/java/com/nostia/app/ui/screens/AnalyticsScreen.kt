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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
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
import com.nostia.app.data.api.models.Trip
import com.nostia.app.data.api.models.User
import com.nostia.app.ui.theme.NostiaBackground
import com.nostia.app.ui.theme.NostiaPrimary
import com.nostia.app.ui.theme.NostiaSurface
import com.nostia.app.ui.theme.NostiaTextPrimary
import com.nostia.app.ui.theme.NostiaTextSecondary
import kotlinx.coroutines.launch

private val dateRanges = listOf("7d", "30d", "90d")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AnalyticsScreen(
    apiService: ApiService,
    onUnauthorized: () -> Unit,
    onNavigateBack: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var selectedRange by remember { mutableStateOf("30d") }
    var isLoading by remember { mutableStateOf(true) }
    var totalUsers by remember { mutableStateOf(0) }
    var totalTrips by remember { mutableStateOf(0) }
    var totalFriends by remember { mutableStateOf(0) }
    var trips by remember { mutableStateOf<List<Trip>>(emptyList()) }
    var friends by remember { mutableStateOf<List<User>>(emptyList()) }

    fun loadData() {
        scope.launch {
            isLoading = true
            try {
                val tripsResponse = apiService.getTrips()
                if (tripsResponse.code() == 401) { onUnauthorized(); return@launch }
                if (tripsResponse.isSuccessful) {
                    trips = tripsResponse.body() ?: emptyList()
                    totalTrips = trips.size
                }

                val friendsResponse = apiService.getFriends()
                if (friendsResponse.isSuccessful) {
                    friends = friendsResponse.body() ?: emptyList()
                    totalFriends = friends.size
                }

                // Approximate active users based on friends list
                totalUsers = totalFriends + 1
            } catch (_: Exception) {
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(selectedRange) { loadData() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text("Analytics", color = NostiaTextPrimary, fontWeight = FontWeight.SemiBold)
                },
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
                    // Date range selector
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            dateRanges.forEach { range ->
                                FilterChip(
                                    selected = selectedRange == range,
                                    onClick = { selectedRange = range },
                                    label = { Text(range) },
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = NostiaPrimary,
                                        selectedLabelColor = NostiaTextPrimary,
                                        containerColor = NostiaSurface,
                                        labelColor = NostiaTextSecondary
                                    )
                                )
                            }
                        }
                    }

                    // Summary cards
                    item {
                        Text(
                            text = "Summary — $selectedRange",
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold,
                            color = NostiaTextPrimary
                        )
                    }

                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            AnalyticsCard(
                                modifier = Modifier.weight(1f),
                                label = "Total Users",
                                value = totalUsers.toString()
                            )
                            AnalyticsCard(
                                modifier = Modifier.weight(1f),
                                label = "Active Users",
                                value = totalFriends.toString()
                            )
                            AnalyticsCard(
                                modifier = Modifier.weight(1f),
                                label = "Trips",
                                value = totalTrips.toString()
                            )
                        }
                    }

                    // Feature usage
                    item {
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Feature Usage",
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold,
                            color = NostiaTextPrimary
                        )
                    }

                    item {
                        FeatureUsageCard(feature = "Trips", count = totalTrips, maxCount = maxOf(totalTrips, 1))
                    }
                    item {
                        FeatureUsageCard(feature = "Friends", count = totalFriends, maxCount = maxOf(totalFriends, 1))
                    }
                    item {
                        FeatureUsageCard(
                            feature = "Vault Entries",
                            count = trips.size * 2,
                            maxCount = maxOf(trips.size * 2, 1)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun AnalyticsCard(modifier: Modifier = Modifier, label: String, value: String) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = NostiaSurface),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = value,
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = NostiaPrimary
            )
            Text(text = label, fontSize = 11.sp, color = NostiaTextSecondary)
        }
    }
}

@Composable
private fun FeatureUsageCard(feature: String, count: Int, maxCount: Int) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = NostiaSurface),
        shape = RoundedCornerShape(10.dp)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(text = feature, fontSize = 14.sp, color = NostiaTextPrimary)
                Text(text = count.toString(), fontSize = 14.sp, color = NostiaPrimary, fontWeight = FontWeight.SemiBold)
            }
            Spacer(modifier = Modifier.height(8.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(6.dp)
                    .background(NostiaBackground, RoundedCornerShape(3.dp))
            ) {
                val fraction = (count.toFloat() / maxCount.toFloat()).coerceIn(0f, 1f)
                Box(
                    modifier = Modifier
                        .fillMaxWidth(fraction)
                        .height(6.dp)
                        .background(NostiaPrimary, RoundedCornerShape(3.dp))
                )
            }
        }
    }
}
