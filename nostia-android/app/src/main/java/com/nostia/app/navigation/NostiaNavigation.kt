package com.nostia.app.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Work
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.nostia.app.data.api.ApiService
import com.nostia.app.data.auth.TokenManager
import com.nostia.app.ui.screens.AdventuresScreen
import com.nostia.app.ui.screens.AnalyticsScreen
import com.nostia.app.ui.screens.ChatScreen
import com.nostia.app.ui.screens.FriendsMapScreen
import com.nostia.app.ui.screens.FriendsScreen
import com.nostia.app.ui.screens.HomeScreen
import com.nostia.app.ui.screens.LoginScreen
import com.nostia.app.ui.screens.NotificationsScreen
import com.nostia.app.ui.screens.PrivacyScreen
import com.nostia.app.ui.screens.SignupScreen
import com.nostia.app.ui.screens.TripsScreen
import com.nostia.app.ui.screens.VaultScreen
import com.nostia.app.ui.theme.NostiaBorder
import com.nostia.app.ui.theme.NostiaBackground
import com.nostia.app.ui.theme.NostiaPrimary
import com.nostia.app.ui.theme.NostiaSurface
import com.nostia.app.ui.theme.NostiaTextPrimary
import com.nostia.app.ui.theme.NostiaTextSecondary
import kotlinx.coroutines.launch

data class BottomNavItem(
    val route: String,
    val label: String,
    val icon: @Composable () -> Unit
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NostiaNavigation(
    tokenManager: TokenManager,
    apiService: ApiService
) {
    val rootNavController = rememberNavController()
    val isLoggedIn = remember { mutableStateOf(tokenManager.isLoggedIn()) }

    val startDestination = if (isLoggedIn.value) "main" else "login"

    NavHost(
        navController = rootNavController,
        startDestination = startDestination
    ) {
        composable("login") {
            LoginScreen(
                apiService = apiService,
                tokenManager = tokenManager,
                onLoginSuccess = {
                    isLoggedIn.value = true
                    rootNavController.navigate("main") {
                        popUpTo("login") { inclusive = true }
                    }
                },
                onNavigateToSignup = {
                    rootNavController.navigate("signup")
                }
            )
        }

        composable("signup") {
            SignupScreen(
                apiService = apiService,
                tokenManager = tokenManager,
                onRegisterSuccess = {
                    isLoggedIn.value = true
                    rootNavController.navigate("main") {
                        popUpTo("signup") { inclusive = true }
                    }
                },
                onNavigateToLogin = {
                    rootNavController.popBackStack()
                }
            )
        }

        composable("main") {
            MainScreen(
                tokenManager = tokenManager,
                apiService = apiService,
                onLogout = {
                    tokenManager.clearToken()
                    isLoggedIn.value = false
                    rootNavController.navigate("login") {
                        popUpTo("main") { inclusive = true }
                    }
                },
                onUnauthorized = {
                    tokenManager.clearToken()
                    isLoggedIn.value = false
                    rootNavController.navigate("login") {
                        popUpTo("main") { inclusive = true }
                    }
                }
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    tokenManager: TokenManager,
    apiService: ApiService,
    onLogout: () -> Unit,
    onUnauthorized: () -> Unit
) {
    val mainNavController = rememberNavController()
    val scope = rememberCoroutineScope()
    var unreadCount by remember { mutableIntStateOf(0) }

    LaunchedEffect(Unit) {
        try {
            val response = apiService.getUnreadCount()
            if (response.isSuccessful) {
                unreadCount = response.body()?.unreadCount ?: 0
            } else if (response.code() == 401) {
                onUnauthorized()
            }
        } catch (_: Exception) { }
    }

    val bottomNavItems = listOf(
        BottomNavItem(
            route = "home",
            label = "Home",
            icon = { Icon(Icons.Filled.Home, contentDescription = "Home") }
        ),
        BottomNavItem(
            route = "trips",
            label = "Trips",
            icon = { Icon(Icons.Filled.Work, contentDescription = "Trips") }
        ),
        BottomNavItem(
            route = "discover",
            label = "Discover",
            icon = { Icon(Icons.Filled.Explore, contentDescription = "Discover") }
        ),
        BottomNavItem(
            route = "friends",
            label = "Friends",
            icon = { Icon(Icons.Filled.Group, contentDescription = "Friends") }
        ),
        BottomNavItem(
            route = "map",
            label = "Map",
            icon = { Icon(Icons.Filled.Map, contentDescription = "Map") }
        )
    )

    val tabRoutes = bottomNavItems.map { it.route }.toSet()

    val navBackStackEntry by mainNavController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination
    val currentRoute = currentDestination?.route?.substringBefore("/")
    val showBottomBar = currentRoute in tabRoutes

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Nostia", color = NostiaTextPrimary) },
                actions = {
                    IconButton(onClick = {
                        mainNavController.navigate("notifications") {
                            launchSingleTop = true
                        }
                    }) {
                        BadgedBox(badge = {
                            if (unreadCount > 0) {
                                Badge { Text(unreadCount.toString()) }
                            }
                        }) {
                            Icon(
                                Icons.Filled.Notifications,
                                contentDescription = "Notifications",
                                tint = NostiaTextPrimary
                            )
                        }
                    }
                    IconButton(onClick = {
                        mainNavController.navigate("privacy") {
                            launchSingleTop = true
                        }
                    }) {
                        Icon(
                            Icons.Filled.Settings,
                            contentDescription = "Settings",
                            tint = NostiaTextPrimary
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = NostiaSurface
                )
            )
        },
        bottomBar = {
            if (showBottomBar) {
                NavigationBar(
                    containerColor = NostiaSurface,
                    tonalElevation = androidx.compose.ui.unit.Dp.Unspecified
                ) {
                    bottomNavItems.forEach { item ->
                        val selected = currentDestination?.hierarchy?.any { it.route == item.route } == true
                        NavigationBarItem(
                            selected = selected,
                            onClick = {
                                mainNavController.navigate(item.route) {
                                    popUpTo(mainNavController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = item.icon,
                            label = { Text(item.label) },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = NostiaPrimary,
                                selectedTextColor = NostiaPrimary,
                                unselectedIconColor = NostiaTextSecondary,
                                unselectedTextColor = NostiaTextSecondary,
                                indicatorColor = NostiaBackground
                            )
                        )
                    }
                }
            }
        },
        containerColor = NostiaBackground
    ) { paddingValues ->
        Box(modifier = Modifier.padding(paddingValues)) {
            NavHost(
                navController = mainNavController,
                startDestination = "home"
            ) {
                composable("home") {
                    HomeScreen(
                        apiService = apiService,
                        tokenManager = tokenManager,
                        onLogout = onLogout,
                        onUnauthorized = onUnauthorized
                    )
                }

                composable("trips") {
                    TripsScreen(
                        apiService = apiService,
                        onUnauthorized = onUnauthorized,
                        onNavigateToVault = { tripId, tripTitle ->
                            mainNavController.navigate("vault/$tripId/${tripTitle.encodeForNav()}")
                        }
                    )
                }

                composable("discover") {
                    AdventuresScreen(
                        apiService = apiService,
                        onUnauthorized = onUnauthorized
                    )
                }

                composable("friends") {
                    FriendsScreen(
                        apiService = apiService,
                        onUnauthorized = onUnauthorized,
                        onNavigateToChat = { conversationId, friendName ->
                            mainNavController.navigate("chat/$conversationId/${friendName.encodeForNav()}")
                        }
                    )
                }

                composable("map") {
                    FriendsMapScreen(
                        apiService = apiService,
                        onUnauthorized = onUnauthorized
                    )
                }

                composable(
                    route = "vault/{tripId}/{tripTitle}",
                    arguments = listOf(
                        navArgument("tripId") { type = NavType.IntType },
                        navArgument("tripTitle") { type = NavType.StringType }
                    )
                ) { backStackEntry ->
                    VaultScreen(
                        tripId = backStackEntry.arguments?.getInt("tripId") ?: 0,
                        tripTitle = backStackEntry.arguments?.getString("tripTitle") ?: "",
                        apiService = apiService,
                        onUnauthorized = onUnauthorized,
                        onNavigateBack = { mainNavController.popBackStack() }
                    )
                }

                composable(
                    route = "chat/{conversationId}/{friendName}",
                    arguments = listOf(
                        navArgument("conversationId") { type = NavType.IntType },
                        navArgument("friendName") { type = NavType.StringType }
                    )
                ) { backStackEntry ->
                    ChatScreen(
                        conversationId = backStackEntry.arguments?.getInt("conversationId") ?: 0,
                        friendName = backStackEntry.arguments?.getString("friendName") ?: "",
                        apiService = apiService,
                        tokenManager = tokenManager,
                        onUnauthorized = onUnauthorized,
                        onNavigateBack = { mainNavController.popBackStack() }
                    )
                }

                composable("notifications") {
                    NotificationsScreen(
                        apiService = apiService,
                        onUnauthorized = onUnauthorized,
                        onNavigateBack = { mainNavController.popBackStack() },
                        onUnreadCountChanged = { count -> unreadCount = count }
                    )
                }

                composable("privacy") {
                    PrivacyScreen(
                        apiService = apiService,
                        tokenManager = tokenManager,
                        onUnauthorized = onUnauthorized,
                        onNavigateBack = { mainNavController.popBackStack() },
                        onAccountDeleted = onLogout
                    )
                }

                composable("analytics") {
                    AnalyticsScreen(
                        apiService = apiService,
                        onUnauthorized = onUnauthorized,
                        onNavigateBack = { mainNavController.popBackStack() }
                    )
                }
            }
        }
    }
}

private fun String.encodeForNav(): String =
    java.net.URLEncoder.encode(this, "UTF-8")
