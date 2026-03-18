import SwiftUI

struct HomeView: View {
    @StateObject private var vm = HomeViewModel()
    @EnvironmentObject var locationManager: LocationManager
    @State private var showLogoutAlert = false
    @EnvironmentObject var authManager: AuthManager

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                // Welcome header
                LinearGradient(colors: [Color.nostiaAccent, Color.nostriaPurple],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
                    .cornerRadius(16)
                    .frame(height: 140)
                    .overlay {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Welcome back,").font(.subheadline).foregroundColor(Color(hex: "E0E7FF"))
                                Text(vm.user?.name ?? "Adventurer")
                                    .font(.system(size: 28, weight: .bold)).foregroundColor(.white)
                                Text("Your next adventure awaits")
                                    .font(.subheadline).foregroundColor(Color(hex: "E0E7FF"))
                            }
                            Spacer()
                            Button {
                                showLogoutAlert = true
                            } label: {
                                Image(systemName: "rectangle.portrait.and.arrow.right")
                                    .font(.title2).foregroundColor(.white).padding(8)
                            }
                        }
                        .padding(20)
                    }

                // Home status card
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Home Status").font(.headline).foregroundColor(.white)
                        Spacer()
                        Button {
                            Task { await vm.toggleHomeStatus() }
                        } label: {
                            Text(vm.user?.isHomeOpen == true ? "🏠 Open" : "🔒 Closed")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundColor(.white)
                                .padding(.horizontal, 16).padding(.vertical, 8)
                                .background(vm.user?.isHomeOpen == true ? Color(hex: "065F46") : Color.nostiaInput)
                                .cornerRadius(20)
                        }
                    }
                    Text(vm.user?.isHomeOpen == true
                         ? "Friends can see you're available to host"
                         : "Toggle to let friends know your home is open")
                        .font(.footnote).foregroundColor(Color.nostiaTextSecond)
                }
                .padding(16)
                .background(Color.nostiaCard)
                .cornerRadius(12)
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.nostriaBorder, lineWidth: 1))

                // Quick stats
                HStack(spacing: 12) {
                    StatCard(icon: "airplane", color: Color.nostiaAccent,
                             count: vm.trips.count, label: "Trips")
                    StatCard(icon: "person.2.fill", color: Color.nostiaSuccess,
                             count: vm.friends.count, label: "Friends")
                    StatCard(icon: "calendar", color: Color.nostiaWarning,
                             count: vm.upcomingEvents.count, label: "Events")
                }

                // Upcoming trips preview
                if !vm.trips.isEmpty {
                    SectionHeader(title: "Upcoming Trips")
                    ForEach(vm.trips.prefix(2)) { trip in
                        TripPreviewCard(trip: trip)
                    }
                }

                // Nearby events (location-based)
                if !vm.nearbyEvents.isEmpty {
                    SectionHeader(title: "Nearby Events")
                    ForEach(vm.nearbyEvents.prefix(3)) { event in
                        EventPreviewCard(event: event)
                    }
                } else if !vm.upcomingEvents.isEmpty {
                    SectionHeader(title: "Upcoming Events")
                    ForEach(vm.upcomingEvents.prefix(2)) { event in
                        EventPreviewCard(event: event)
                    }
                }
            }
            .padding(16)
            .padding(.bottom, 40)
        }
        .background(Color.nostiaBackground)
        .refreshable { await vm.loadAll() }
        .navigationTitle("Nostia")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await vm.loadAll()
            locationManager.requestLocationOnce()
        }
        .onChange(of: locationManager.location) { newLoc in
            guard let loc = newLoc else { return }
            Task { await vm.updateLocation(loc) }
        }
        .alert("Logout", isPresented: $showLogoutAlert) {
            Button("Cancel", role: .cancel) {}
            Button("Logout", role: .destructive) { authManager.logout() }
        } message: {
            Text("Are you sure you want to logout?")
        }
    }
}

// MARK: - Sub-components

struct StatCard: View {
    let icon: String; let color: Color; let count: Int; let label: String
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon).font(.title2).foregroundColor(color)
            Text("\(count)").font(.system(size: 24, weight: .bold)).foregroundColor(.white)
            Text(label).font(.caption).foregroundColor(Color.nostiaTextSecond)
        }
        .frame(maxWidth: .infinity)
        .padding(16)
        .background(Color.nostiaCard)
        .cornerRadius(12)
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.nostriaBorder, lineWidth: 1))
    }
}

struct SectionHeader: View {
    let title: String
    var body: some View {
        Text(title).font(.headline).foregroundColor(.white)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct TripPreviewCard: View {
    let trip: Trip
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(trip.title).font(.headline).foregroundColor(.white)
                    Text(trip.destination).font(.footnote).foregroundColor(Color.nostiaTextSecond)
                }
                Spacer()
                HStack(spacing: 4) {
                    Image(systemName: "person.2").foregroundColor(Color.nostiaTextSecond)
                    Text("\(trip.participantCount)").foregroundColor(Color.nostiaTextSecond)
                }
                .font(.footnote)
            }
            Text(trip.formattedDates).font(.footnote.bold()).foregroundColor(Color.nostiaAccent)
        }
        .padding(16)
        .background(Color.nostiaCard)
        .cornerRadius(12)
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.nostriaBorder, lineWidth: 1))
    }
}

struct EventPreviewCard: View {
    let event: Event
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(event.title).font(.headline).foregroundColor(.white)
                Spacer()
                if let dist = event.formattedDistance {
                    Text(dist).font(.caption.bold()).foregroundColor(.white)
                        .padding(.horizontal, 8).padding(.vertical, 4)
                        .background(Color.nostiaAccent).cornerRadius(12)
                }
            }
            if let loc = event.location {
                Label(loc, systemImage: "location").font(.footnote).foregroundColor(Color.nostiaTextSecond)
            }
            Text(event.formattedDate).font(.footnote.bold()).foregroundColor(Color.nostiaWarning)
        }
        .padding(16)
        .background(Color.nostiaCard)
        .cornerRadius(12)
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.nostriaBorder, lineWidth: 1))
    }
}
