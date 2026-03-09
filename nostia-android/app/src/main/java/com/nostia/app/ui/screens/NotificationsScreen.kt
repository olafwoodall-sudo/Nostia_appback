package com.nostia.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Message
import androidx.compose.material.icons.filled.AttachMoney
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.TravelExplore
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nostia.app.data.api.ApiService
import com.nostia.app.data.api.models.Notification
import com.nostia.app.ui.theme.NostiaBackground
import com.nostia.app.ui.theme.NostiaPrimary
import com.nostia.app.ui.theme.NostiaSurface
import com.nostia.app.ui.theme.NostiaTextPrimary
import com.nostia.app.ui.theme.NostiaTextSecondary
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationsScreen(
    apiService: ApiService,
    onUnauthorized: () -> Unit,
    onNavigateBack: () -> Unit,
    onUnreadCountChanged: (Int) -> Unit
) {
    val scope = rememberCoroutineScope()
    var notifications by remember { mutableStateOf<List<Notification>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }

    fun loadNotifications() {
        scope.launch {
            isLoading = true
            try {
                val response = apiService.getNotifications(limit = 50)
                if (response.code() == 401) { onUnauthorized(); return@launch }
                if (response.isSuccessful) {
                    notifications = response.body() ?: emptyList()
                    val unread = notifications.count { !it.read }
                    onUnreadCountChanged(unread)
                }
            } catch (_: Exception) {
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(Unit) { loadNotifications() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Notifications", color = NostiaTextPrimary, fontWeight = FontWeight.SemiBold) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = NostiaTextPrimary)
                    }
                },
                actions = {
                    TextButton(
                        onClick = {
                            scope.launch {
                                try {
                                    val response = apiService.markAllNotificationsRead()
                                    if (response.isSuccessful) {
                                        loadNotifications()
                                        onUnreadCountChanged(0)
                                    }
                                } catch (_: Exception) { }
                            }
                        }
                    ) {
                        Text("Mark all read", color = NostiaPrimary, fontSize = 13.sp)
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
            } else if (notifications.isEmpty()) {
                Text(
                    text = "No notifications",
                    color = NostiaTextSecondary,
                    modifier = Modifier.align(Alignment.Center)
                )
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    items(notifications) { notification ->
                        NotificationItem(
                            notification = notification,
                            onClick = {
                                if (!notification.read) {
                                    scope.launch {
                                        try {
                                            apiService.markNotificationRead(notification.id)
                                            loadNotifications()
                                        } catch (_: Exception) { }
                                    }
                                }
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun NotificationItem(notification: Notification, onClick: () -> Unit) {
    val icon: ImageVector = when (notification.type) {
        "trip_invite" -> Icons.Filled.TravelExplore
        "friend_request" -> Icons.Filled.PersonAdd
        "payment_received" -> Icons.Filled.AttachMoney
        "message" -> Icons.AutoMirrored.Filled.Message
        else -> Icons.Filled.Notifications
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = if (notification.read) NostiaSurface
            else NostiaSurface.copy(alpha = 0.85f)
        ),
        shape = RoundedCornerShape(10.dp)
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = if (notification.read) NostiaTextSecondary else NostiaPrimary,
                modifier = Modifier.size(24.dp)
            )
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(start = 12.dp)
            ) {
                Text(
                    text = notification.message,
                    fontSize = 14.sp,
                    color = if (notification.read) NostiaTextSecondary else NostiaTextPrimary,
                    fontWeight = if (notification.read) FontWeight.Normal else FontWeight.SemiBold
                )
                if (!notification.createdAt.isNullOrBlank()) {
                    Text(
                        text = notification.createdAt,
                        fontSize = 11.sp,
                        color = NostiaTextSecondary
                    )
                }
            }
            if (!notification.read) {
                Icon(
                    Icons.Filled.CheckCircle,
                    contentDescription = "Unread",
                    tint = NostiaPrimary,
                    modifier = Modifier.size(14.dp)
                )
            }
        }
    }
}
