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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import com.nostia.app.data.api.models.Adventure
import com.nostia.app.data.api.models.CreateAdventureRequest
import com.nostia.app.data.api.models.CreatePostRequest
import com.nostia.app.data.api.models.Post
import com.nostia.app.ui.theme.NostiaBackground
import com.nostia.app.ui.theme.NostiaBorder
import com.nostia.app.ui.theme.NostiaPrimary
import com.nostia.app.ui.theme.NostiaSurface
import com.nostia.app.ui.theme.NostiaTextPrimary
import com.nostia.app.ui.theme.NostiaTextSecondary
import kotlinx.coroutines.launch

private val adventureCategories = listOf("All", "Hiking", "Cycling", "Water Sports", "Travel", "Urban")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdventuresScreen(
    apiService: ApiService,
    onUnauthorized: () -> Unit
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    val tabs = listOf("Adventures", "Feed")

    var showCreateAdventure by remember { mutableStateOf(false) }

    Scaffold(
        floatingActionButton = {
            when (selectedTab) {
                0 -> FloatingActionButton(
                    onClick = { showCreateAdventure = true },
                    containerColor = NostiaPrimary
                ) {
                    Icon(Icons.Filled.Add, contentDescription = "New Adventure", tint = NostiaTextPrimary)
                }
                1 -> FloatingActionButton(
                    onClick = { /* handled inside FeedTab */ },
                    containerColor = NostiaPrimary
                ) {
                    Icon(Icons.Filled.Add, contentDescription = "New Post", tint = NostiaTextPrimary)
                }
            }
        },
        containerColor = NostiaBackground
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(NostiaBackground)
                .padding(paddingValues)
        ) {
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
                                text = title,
                                color = if (selectedTab == index) NostiaPrimary else NostiaTextSecondary
                            )
                        }
                    )
                }
            }

            when (selectedTab) {
                0 -> AdventuresTab(apiService = apiService, onUnauthorized = onUnauthorized)
                1 -> FeedTab(apiService = apiService, onUnauthorized = onUnauthorized)
            }

            if (showCreateAdventure) {
                CreateAdventureDialog(
                    apiService = apiService,
                    onDismiss = { showCreateAdventure = false },
                    onCreated = { showCreateAdventure = false }
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AdventuresTab(apiService: ApiService, onUnauthorized: () -> Unit) {
    val scope = rememberCoroutineScope()
    var adventures by remember { mutableStateOf<List<Adventure>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var selectedCategory by remember { mutableStateOf("All") }

    fun loadAdventures(category: String) {
        scope.launch {
            isLoading = true
            try {
                val response = apiService.getAdventures(
                    category = if (category == "All") null else category
                )
                if (response.code() == 401) { onUnauthorized(); return@launch }
                if (response.isSuccessful) adventures = response.body() ?: emptyList()
            } catch (_: Exception) {
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(Unit) { loadAdventures("All") }

    Column(modifier = Modifier.fillMaxSize()) {
        LazyRow(
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(adventureCategories) { category ->
                FilterChip(
                    selected = selectedCategory == category,
                    onClick = {
                        selectedCategory = category
                        loadAdventures(category)
                    },
                    label = { Text(category) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = NostiaPrimary,
                        selectedLabelColor = NostiaTextPrimary,
                        containerColor = NostiaSurface,
                        labelColor = NostiaTextSecondary
                    )
                )
            }
        }

        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = NostiaPrimary)
            }
        } else if (adventures.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No adventures found", color = NostiaTextSecondary)
            }
        } else {
            LazyColumn(
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(adventures) { adventure ->
                    AdventureCard(adventure = adventure)
                }
            }
        }
    }
}

@Composable
private fun AdventureCard(adventure: Adventure) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = NostiaSurface),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = adventure.title,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = NostiaTextPrimary,
                    modifier = Modifier.weight(1f)
                )
                if (!adventure.difficulty.isNullOrBlank()) {
                    Text(
                        text = adventure.difficulty,
                        fontSize = 12.sp,
                        color = NostiaPrimary,
                        modifier = Modifier.padding(start = 8.dp)
                    )
                }
            }
            if (!adventure.category.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(text = adventure.category, fontSize = 12.sp, color = NostiaTextSecondary)
            }
            if (!adventure.description.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(6.dp))
                Text(text = adventure.description, fontSize = 13.sp, color = NostiaTextSecondary, maxLines = 3)
            }
            if (!adventure.location.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(text = adventure.location, fontSize = 12.sp, color = NostiaTextSecondary)
            }
        }
    }
}

@Composable
private fun FeedTab(apiService: ApiService, onUnauthorized: () -> Unit) {
    val scope = rememberCoroutineScope()
    var posts by remember { mutableStateOf<List<Post>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var showCreatePost by remember { mutableStateOf(false) }

    fun loadFeed() {
        scope.launch {
            isLoading = true
            try {
                val response = apiService.getFeed(limit = 20)
                if (response.code() == 401) { onUnauthorized(); return@launch }
                if (response.isSuccessful) posts = response.body() ?: emptyList()
            } catch (_: Exception) {
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(Unit) { loadFeed() }

    Box(modifier = Modifier.fillMaxSize()) {
        if (isLoading) {
            CircularProgressIndicator(
                modifier = Modifier.align(Alignment.Center),
                color = NostiaPrimary
            )
        } else {
            LazyColumn(
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                item {
                    Button(
                        onClick = { showCreatePost = true },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = NostiaSurface)
                    ) {
                        Text("+ Share something...", color = NostiaTextSecondary)
                    }
                }
                if (posts.isEmpty()) {
                    item {
                        Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                            Text("No posts yet. Be the first!", color = NostiaTextSecondary)
                        }
                    }
                } else {
                    items(posts) { post ->
                        PostCard(
                            post = post,
                            apiService = apiService,
                            onLikeToggled = { loadFeed() }
                        )
                    }
                }
            }
        }
    }

    if (showCreatePost) {
        CreatePostDialog(
            apiService = apiService,
            onDismiss = { showCreatePost = false },
            onCreated = {
                showCreatePost = false
                loadFeed()
            }
        )
    }
}

@Composable
private fun PostCard(
    post: Post,
    apiService: ApiService,
    onLikeToggled: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var liked by remember { mutableStateOf(post.likedByMe ?: false) }
    var likeCount by remember { mutableIntStateOf(post.likesCount ?: 0) }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = NostiaSurface),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = post.author?.name ?: post.author?.username ?: "Unknown",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = NostiaTextPrimary
                    )
                    Text(
                        text = post.createdAt ?: "",
                        fontSize = 11.sp,
                        color = NostiaTextSecondary
                    )
                }
            }
            if (!post.content.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(text = post.content, fontSize = 14.sp, color = NostiaTextPrimary)
            }
            Spacer(modifier = Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(
                    onClick = {
                        scope.launch {
                            try {
                                if (liked) {
                                    apiService.unlikePost(post.id)
                                    liked = false
                                    likeCount--
                                } else {
                                    apiService.likePost(post.id)
                                    liked = true
                                    likeCount++
                                }
                            } catch (_: Exception) { }
                        }
                    },
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        if (liked) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder,
                        contentDescription = "Like",
                        tint = if (liked) androidx.compose.ui.graphics.Color(0xFFEF4444) else NostiaTextSecondary,
                        modifier = Modifier.size(20.dp)
                    )
                }
                Text(
                    text = "$likeCount",
                    fontSize = 13.sp,
                    color = NostiaTextSecondary
                )
                Spacer(modifier = Modifier.size(16.dp))
                Text(
                    text = "${post.commentsCount ?: 0} comments",
                    fontSize = 13.sp,
                    color = NostiaTextSecondary
                )
            }
        }
    }
}

@Composable
private fun CreateAdventureDialog(
    apiService: ApiService,
    onDismiss: () -> Unit,
    onCreated: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var title by remember { mutableStateOf("") }
    var location by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("") }
    var difficulty by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }

    val categories = listOf("hiking", "climbing", "water-sports", "camping", "cycling", "other")
    val difficulties = listOf("easy", "moderate", "hard", "expert")

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("New Adventure", color = NostiaTextPrimary, fontWeight = FontWeight.Bold) },
        text = {
            androidx.compose.foundation.lazy.LazyColumn(
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item {
                    OutlinedTextField(
                        value = title,
                        onValueChange = { title = it },
                        label = { Text("Title *") },
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
                }
                item {
                    OutlinedTextField(
                        value = location,
                        onValueChange = { location = it },
                        label = { Text("Location *") },
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
                }
                item {
                    OutlinedTextField(
                        value = description,
                        onValueChange = { description = it },
                        label = { Text("Description") },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 2,
                        maxLines = 4,
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
                }
                item {
                    Text("Category", color = NostiaTextSecondary, fontSize = 12.sp)
                    Spacer(modifier = Modifier.height(4.dp))
                    androidx.compose.foundation.lazy.LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        items(categories) { cat ->
                            FilterChip(
                                selected = category == cat,
                                onClick = { category = if (category == cat) "" else cat },
                                label = { Text(cat.replaceFirstChar { it.uppercase() }) },
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
                item {
                    Text("Difficulty", color = NostiaTextSecondary, fontSize = 12.sp)
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        difficulties.forEach { diff ->
                            FilterChip(
                                selected = difficulty == diff,
                                onClick = { difficulty = if (difficulty == diff) "" else diff },
                                label = { Text(diff.replaceFirstChar { it.uppercase() }) },
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
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (title.isBlank() || location.isBlank()) return@Button
                    scope.launch {
                        isLoading = true
                        try {
                            val response = apiService.createAdventure(
                                CreateAdventureRequest(
                                    title = title.trim(),
                                    location = location.trim(),
                                    description = description.trim().ifBlank { null },
                                    category = category.ifBlank { null },
                                    difficulty = difficulty.ifBlank { null }
                                )
                            )
                            if (response.isSuccessful) onCreated()
                        } catch (_: Exception) {
                        } finally {
                            isLoading = false
                        }
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = NostiaPrimary),
                enabled = !isLoading && title.isNotBlank() && location.isNotBlank()
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
            TextButton(onClick = onDismiss) { Text("Cancel", color = NostiaTextSecondary) }
        },
        containerColor = NostiaSurface
    )
}

@Composable
private fun CreatePostDialog(
    apiService: ApiService,
    onDismiss: () -> Unit,
    onCreated: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var content by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("New Post", color = NostiaTextPrimary, fontWeight = FontWeight.Bold) },
        text = {
            OutlinedTextField(
                value = content,
                onValueChange = { content = it },
                label = { Text("What's on your mind?") },
                modifier = Modifier.fillMaxWidth(),
                maxLines = 6,
                minLines = 3,
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
        },
        confirmButton = {
            Button(
                onClick = {
                    if (content.isBlank()) return@Button
                    scope.launch {
                        isLoading = true
                        try {
                            val response = apiService.createPost(
                                CreatePostRequest(content = content.trim(), imageData = null, relatedTripId = null)
                            )
                            if (response.isSuccessful) onCreated()
                        } catch (_: Exception) {
                        } finally {
                            isLoading = false
                        }
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = NostiaPrimary),
                enabled = !isLoading && content.isNotBlank()
            ) {
                if (isLoading) CircularProgressIndicator(
                    color = NostiaTextPrimary,
                    strokeWidth = 2.dp,
                    modifier = Modifier.size(18.dp)
                )
                else Text("Post", color = NostiaTextPrimary)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel", color = NostiaTextSecondary) }
        },
        containerColor = NostiaSurface
    )
}
