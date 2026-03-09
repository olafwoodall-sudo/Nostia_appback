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
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nostia.app.data.api.ApiService
import com.nostia.app.data.api.models.Message
import com.nostia.app.data.api.models.SendMessageRequest
import com.nostia.app.data.auth.TokenManager
import com.nostia.app.ui.theme.NostiaBackground
import com.nostia.app.ui.theme.NostiaBorder
import com.nostia.app.ui.theme.NostiaPrimary
import com.nostia.app.ui.theme.NostiaSurface
import com.nostia.app.ui.theme.NostiaTextPrimary
import com.nostia.app.ui.theme.NostiaTextSecondary
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    conversationId: Int,
    friendName: String,
    apiService: ApiService,
    tokenManager: TokenManager,
    onUnauthorized: () -> Unit,
    onNavigateBack: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var messages by remember { mutableStateOf<List<Message>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var messageText by remember { mutableStateOf("") }
    var isSending by remember { mutableStateOf(false) }
    val listState = rememberLazyListState()

    // Determine current user's id by decoding the JWT payload minimally
    // (we rely on senderId matching to determine message alignment)
    // We'll fetch /users/me once to get current userId
    var currentUserId by remember { mutableStateOf<Int?>(null) }

    suspend fun loadMessages() {
        try {
            val response = apiService.getMessages(conversationId, limit = 50)
            if (response.code() == 401) { onUnauthorized(); return }
            if (response.isSuccessful) {
                val newMessages = response.body() ?: emptyList()
                messages = newMessages
            }
        } catch (_: Exception) { }
    }

    LaunchedEffect(Unit) {
        try {
            val meResponse = apiService.getMe()
            if (meResponse.isSuccessful) currentUserId = meResponse.body()?.id
        } catch (_: Exception) { }

        isLoading = true
        loadMessages()
        isLoading = false

        try {
            apiService.markConversationRead(conversationId)
        } catch (_: Exception) { }
    }

    // Auto-scroll to bottom when messages update
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.size - 1)
        }
    }

    // Poll every 5 seconds
    LaunchedEffect(Unit) {
        while (isActive) {
            delay(5_000)
            loadMessages()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(friendName, color = NostiaTextPrimary, fontWeight = FontWeight.SemiBold)
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
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(NostiaBackground)
                .padding(paddingValues)
                .imePadding()
        ) {
            if (isLoading) {
                Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = NostiaPrimary)
                }
            } else {
                LazyColumn(
                    state = listState,
                    modifier = Modifier.weight(1f),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    items(messages) { message ->
                        val isMe = currentUserId != null && (message.senderId == currentUserId ||
                                message.sender?.id == currentUserId)
                        MessageBubble(message = message, isMe = isMe)
                    }
                }
            }

            // Input row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(NostiaSurface)
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = messageText,
                    onValueChange = { messageText = it },
                    placeholder = { Text("Message...", color = NostiaTextSecondary) },
                    modifier = Modifier.weight(1f),
                    maxLines = 4,
                    shape = RoundedCornerShape(24.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = NostiaPrimary,
                        unfocusedBorderColor = NostiaBorder,
                        focusedTextColor = NostiaTextPrimary,
                        unfocusedTextColor = NostiaTextPrimary,
                        cursorColor = NostiaPrimary
                    )
                )
                Spacer(modifier = Modifier.width(8.dp))
                IconButton(
                    onClick = {
                        if (messageText.isBlank() || isSending) return@IconButton
                        val text = messageText.trim()
                        messageText = ""
                        scope.launch {
                            isSending = true
                            try {
                                val response = apiService.sendMessage(
                                    conversationId,
                                    SendMessageRequest(text)
                                )
                                if (response.code() == 401) { onUnauthorized(); return@launch }
                                if (response.isSuccessful) loadMessages()
                            } catch (_: Exception) {
                            } finally {
                                isSending = false
                            }
                        }
                    },
                    enabled = messageText.isNotBlank() && !isSending,
                    modifier = Modifier
                        .size(48.dp)
                        .background(NostiaPrimary, RoundedCornerShape(50))
                ) {
                    if (isSending) {
                        CircularProgressIndicator(
                            color = NostiaTextPrimary,
                            strokeWidth = 2.dp,
                            modifier = Modifier.size(20.dp)
                        )
                    } else {
                        Icon(
                            Icons.AutoMirrored.Filled.Send,
                            contentDescription = "Send",
                            tint = NostiaTextPrimary,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun MessageBubble(message: Message, isMe: Boolean) {
    Box(
        modifier = Modifier.fillMaxWidth(),
        contentAlignment = if (isMe) Alignment.CenterEnd else Alignment.CenterStart
    ) {
        Column(
            horizontalAlignment = if (isMe) Alignment.End else Alignment.Start,
            modifier = Modifier.fillMaxWidth(0.78f)
        ) {
            if (!isMe) {
                Text(
                    text = message.sender?.name ?: message.sender?.username ?: "Unknown",
                    fontSize = 11.sp,
                    color = NostiaTextSecondary,
                    modifier = Modifier.padding(bottom = 2.dp, start = 4.dp)
                )
            }
            Box(
                modifier = Modifier
                    .clip(
                        RoundedCornerShape(
                            topStart = 16.dp,
                            topEnd = 16.dp,
                            bottomStart = if (isMe) 16.dp else 4.dp,
                            bottomEnd = if (isMe) 4.dp else 16.dp
                        )
                    )
                    .background(if (isMe) NostiaPrimary else NostiaSurface)
                    .padding(horizontal = 14.dp, vertical = 10.dp)
            ) {
                Text(
                    text = message.content,
                    fontSize = 14.sp,
                    color = NostiaTextPrimary
                )
            }
            if (!message.createdAt.isNullOrBlank()) {
                Text(
                    text = message.createdAt,
                    fontSize = 10.sp,
                    color = NostiaTextSecondary,
                    modifier = Modifier.padding(top = 2.dp, start = 4.dp, end = 4.dp)
                )
            }
        }
    }
}
