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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Message
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.Search
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
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
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
import com.nostia.app.data.api.models.CreateConversationRequest
import com.nostia.app.data.api.models.FriendRequest
import com.nostia.app.data.api.models.SendFriendRequest
import com.nostia.app.data.api.models.User
import com.nostia.app.ui.theme.NostiaBackground
import com.nostia.app.ui.theme.NostiaBorder
import com.nostia.app.ui.theme.NostiaPrimary
import com.nostia.app.ui.theme.NostiaSurface
import com.nostia.app.ui.theme.NostiaTextPrimary
import com.nostia.app.ui.theme.NostiaTextSecondary
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FriendsScreen(
    apiService: ApiService,
    onUnauthorized: () -> Unit,
    onNavigateToChat: (conversationId: Int, friendName: String) -> Unit
) {
    val scope = rememberCoroutineScope()
    var selectedTab by remember { mutableIntStateOf(0) }
    val tabs = listOf("Friends", "Requests")

    var friends by remember { mutableStateOf<List<User>>(emptyList()) }
    var receivedRequests by remember { mutableStateOf<List<FriendRequest>>(emptyList()) }
    var sentRequests by remember { mutableStateOf<List<FriendRequest>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var searchQuery by remember { mutableStateOf("") }
    var searchResults by remember { mutableStateOf<List<User>>(emptyList()) }
    var isSearching by remember { mutableStateOf(false) }
    var searchJob by remember { mutableStateOf<Job?>(null) }

    fun loadFriends() {
        scope.launch {
            isLoading = true
            try {
                val friendsResponse = apiService.getFriends()
                if (friendsResponse.code() == 401) { onUnauthorized(); return@launch }
                if (friendsResponse.isSuccessful) friends = friendsResponse.body() ?: emptyList()

                val requestsResponse = apiService.getFriendRequests()
                if (requestsResponse.isSuccessful) {
                    receivedRequests = requestsResponse.body()?.received ?: emptyList()
                    sentRequests = requestsResponse.body()?.sent ?: emptyList()
                }
            } catch (_: Exception) {
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(Unit) { loadFriends() }

    LaunchedEffect(searchQuery) {
        searchJob?.cancel()
        if (searchQuery.length >= 2) {
            searchJob = scope.launch {
                delay(400)
                isSearching = true
                try {
                    val response = apiService.searchUsers(searchQuery)
                    if (response.isSuccessful) searchResults = response.body() ?: emptyList()
                } catch (_: Exception) {
                } finally {
                    isSearching = false
                }
            }
        } else {
            searchResults = emptyList()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(NostiaBackground)
    ) {
        // Search bar
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            placeholder = { Text("Search users...", color = NostiaTextSecondary) },
            leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null, tint = NostiaTextSecondary) },
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            singleLine = true,
            shape = RoundedCornerShape(24.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = NostiaPrimary,
                unfocusedBorderColor = NostiaBorder,
                focusedTextColor = NostiaTextPrimary,
                unfocusedTextColor = NostiaTextPrimary,
                cursorColor = NostiaPrimary
            )
        )

        if (searchQuery.length >= 2) {
            // Show search results
            if (isSearching) {
                Box(modifier = Modifier.fillMaxWidth().padding(16.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = NostiaPrimary, modifier = Modifier.size(24.dp))
                }
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (searchResults.isEmpty()) {
                        item {
                            Text("No users found", color = NostiaTextSecondary, modifier = Modifier.padding(8.dp))
                        }
                    } else {
                        items(searchResults) { user ->
                            SearchResultCard(
                                user = user,
                                onAddFriend = {
                                    scope.launch {
                                        try {
                                            apiService.sendFriendRequest(SendFriendRequest(user.id))
                                            loadFriends()
                                        } catch (_: Exception) { }
                                    }
                                }
                            )
                        }
                    }
                }
            }
        } else {
            TabRow(
                selectedTabIndex = selectedTab,
                containerColor = NostiaSurface,
                contentColor = NostiaPrimary,
                indicator = { tabPositions ->
                    if (selectedTab < tabPositions.size) {
                        androidx.compose.material3.TabRowDefaults.SecondaryIndicator(
                            modifier = Modifier.tabIndicatorOffset(tabPositions[selectedTab]),
                            color = NostiaPrimary
                        )
                    }
                }
            ) {
                tabs.forEachIndexed { index, title ->
                    Tab(
                        selected = selectedTab == index,
                        onClick = { selectedTab = index },
                        text = {
                            Text(
                                text = if (index == 1 && receivedRequests.isNotEmpty())
                                    "$title (${receivedRequests.size})"
                                else title,
                                color = if (selectedTab == index) NostiaPrimary else NostiaTextSecondary
                            )
                        }
                    )
                }
            }

            if (isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = NostiaPrimary)
                }
            } else {
                when (selectedTab) {
                    0 -> FriendsListTab(
                        friends = friends,
                        apiService = apiService,
                        onNavigateToChat = onNavigateToChat,
                        onFriendRemoved = { loadFriends() }
                    )
                    1 -> RequestsTab(
                        received = receivedRequests,
                        sent = sentRequests,
                        apiService = apiService,
                        onRequestHandled = { loadFriends() }
                    )
                }
            }
        }
    }
}

@Composable
private fun SearchResultCard(user: User, onAddFriend: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = NostiaSurface),
        shape = RoundedCornerShape(10.dp)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .background(NostiaPrimary, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = (user.name.firstOrNull() ?: user.username.firstOrNull() ?: '?').uppercaseChar().toString(),
                    color = NostiaTextPrimary,
                    fontWeight = FontWeight.Bold
                )
            }
            Column(modifier = Modifier.weight(1f).padding(start = 12.dp)) {
                Text(text = user.name, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = NostiaTextPrimary)
                Text(text = "@${user.username}", fontSize = 12.sp, color = NostiaTextSecondary)
            }
            IconButton(onClick = onAddFriend) {
                Icon(Icons.Filled.PersonAdd, contentDescription = "Add Friend", tint = NostiaPrimary)
            }
        }
    }
}

@Composable
private fun FriendsListTab(
    friends: List<User>,
    apiService: ApiService,
    onNavigateToChat: (Int, String) -> Unit,
    onFriendRemoved: () -> Unit
) {
    val scope = rememberCoroutineScope()

    if (friends.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("No friends yet. Search for users to add!", color = NostiaTextSecondary)
        }
        return
    }

    LazyColumn(
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(friends) { friend ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = NostiaSurface),
                shape = RoundedCornerShape(10.dp)
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .background(NostiaPrimary, CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = (friend.name.firstOrNull() ?: friend.username.firstOrNull() ?: '?').uppercaseChar().toString(),
                            color = NostiaTextPrimary,
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp
                        )
                    }
                    Column(modifier = Modifier.weight(1f).padding(start = 12.dp)) {
                        Text(text = friend.name, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = NostiaTextPrimary)
                        Text(text = "@${friend.username}", fontSize = 13.sp, color = NostiaTextSecondary)
                    }
                    IconButton(onClick = {
                        scope.launch {
                            try {
                                val convResponse = apiService.createConversation(
                                    CreateConversationRequest(friend.id)
                                )
                                if (convResponse.isSuccessful) {
                                    val conv = convResponse.body()
                                    if (conv != null) onNavigateToChat(conv.id, friend.name)
                                }
                            } catch (_: Exception) { }
                        }
                    }) {
                        Icon(Icons.Filled.Message, contentDescription = "Message", tint = NostiaPrimary)
                    }
                }
            }
        }
    }
}

@Composable
private fun RequestsTab(
    received: List<FriendRequest>,
    sent: List<FriendRequest>,
    apiService: ApiService,
    onRequestHandled: () -> Unit
) {
    val scope = rememberCoroutineScope()

    LazyColumn(
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        if (received.isNotEmpty()) {
            item {
                Text(
                    text = "Received",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = NostiaTextSecondary,
                    modifier = Modifier.padding(vertical = 4.dp)
                )
            }
            items(received) { request ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = NostiaSurface),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = request.sender?.name ?: "Unknown",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = NostiaTextPrimary
                            )
                            Text(
                                text = "@${request.sender?.username ?: ""}",
                                fontSize = 12.sp,
                                color = NostiaTextSecondary
                            )
                        }
                        IconButton(onClick = {
                            scope.launch {
                                try {
                                    apiService.acceptFriendRequest(request.id)
                                    onRequestHandled()
                                } catch (_: Exception) { }
                            }
                        }) {
                            Icon(Icons.Filled.Check, contentDescription = "Accept", tint = androidx.compose.ui.graphics.Color(0xFF10B981))
                        }
                        IconButton(onClick = {
                            scope.launch {
                                try {
                                    apiService.rejectFriendRequest(request.id)
                                    onRequestHandled()
                                } catch (_: Exception) { }
                            }
                        }) {
                            Icon(Icons.Filled.Close, contentDescription = "Reject", tint = androidx.compose.ui.graphics.Color(0xFFEF4444))
                        }
                    }
                }
            }
        }

        if (sent.isNotEmpty()) {
            item {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Sent",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = NostiaTextSecondary,
                    modifier = Modifier.padding(vertical = 4.dp)
                )
            }
            items(sent) { request ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = NostiaSurface),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = request.receiver?.name ?: "Unknown",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = NostiaTextPrimary
                            )
                            Text(
                                text = "@${request.receiver?.username ?: ""}",
                                fontSize = 12.sp,
                                color = NostiaTextSecondary
                            )
                        }
                        Text(text = "Pending", fontSize = 12.sp, color = NostiaTextSecondary)
                    }
                }
            }
        }

        if (received.isEmpty() && sent.isEmpty()) {
            item {
                Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                    Text("No pending friend requests", color = NostiaTextSecondary)
                }
            }
        }
    }
}
