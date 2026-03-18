import SwiftUI

struct MainTabView: View {
    @State private var selectedTab = 0
    @State private var unreadCount = 0
    @State private var showNotifications = false
    @State private var showSettings = false
    @State private var userRole: String = "user"

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                HomeView()
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar { tabBarToolbar }
            }
            .tabItem { Label("Home", systemImage: selectedTab == 0 ? "house.fill" : "house") }
            .tag(0)

            NavigationStack {
                TripsView()
                    .navigationTitle("My Trips")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar { tabBarToolbar }
            }
            .tabItem { Label("Trips", systemImage: selectedTab == 1 ? "airplane" : "airplane") }
            .tag(1)

            NavigationStack {
                AdventuresView()
                    .navigationTitle("Discover")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar { tabBarToolbar }
            }
            .tabItem { Label("Discover", systemImage: selectedTab == 2 ? "safari.fill" : "safari") }
            .tag(2)

            NavigationStack {
                FriendsView()
                    .navigationTitle("Friends")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar { tabBarToolbar }
            }
            .tabItem { Label("Friends", systemImage: selectedTab == 3 ? "person.2.fill" : "person.2") }
            .tag(3)

            NavigationStack {
                FriendsMapView()
                    .navigationTitle("Friends Map")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar { tabBarToolbar }
            }
            .tabItem { Label("Map", systemImage: selectedTab == 4 ? "map.fill" : "map") }
            .tag(4)
        }
        .tint(Color.nostiaAccent)
        .onAppear {
            UITabBar.appearance().barTintColor = UIColor(Color.nostiaCard)
            UITabBar.appearance().backgroundColor = UIColor(Color.nostiaCard)
            UITabBar.appearance().unselectedItemTintColor = UIColor(Color.nostiaTextMuted)
            loadUnreadCount()
        }
        .sheet(isPresented: $showNotifications) {
            NavigationStack {
                NotificationsView()
                    .navigationTitle("Notifications")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .topBarLeading) {
                            Button("Close") { showNotifications = false }
                                .foregroundColor(Color.nostiaAccent)
                        }
                    }
            }
        }
        .sheet(isPresented: $showSettings) {
            NavigationStack {
                PrivacyView()
                    .navigationTitle("Settings")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .topBarLeading) {
                            Button("Close") { showSettings = false }
                                .foregroundColor(Color.nostiaAccent)
                        }
                    }
            }
        }
    }

    @ToolbarContentBuilder
    var tabBarToolbar: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            HStack(spacing: 4) {
                Button {
                    showNotifications = true
                    loadUnreadCount()
                } label: {
                    ZStack(alignment: .topTrailing) {
                        Image(systemName: "bell")
                            .foregroundColor(.white)
                        if unreadCount > 0 {
                            Text(unreadCount > 9 ? "9+" : "\(unreadCount)")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.white)
                                .padding(3)
                                .background(Color.nostriaDanger)
                                .clipShape(Circle())
                                .offset(x: 8, y: -8)
                        }
                    }
                }
                Button { showSettings = true } label: {
                    Image(systemName: "gear").foregroundColor(.white)
                }
            }
        }
    }

    func loadUnreadCount() {
        Task {
            let count = try? await NotificationsAPI.shared.getUnreadCount()
            await MainActor.run { unreadCount = count ?? 0 }
        }
    }
}
