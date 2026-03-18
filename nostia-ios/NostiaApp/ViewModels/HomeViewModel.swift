import Foundation
import CoreLocation

@MainActor
final class HomeViewModel: ObservableObject {
    @Published var user: User?
    @Published var trips: [Trip] = []
    @Published var upcomingEvents: [Event] = []
    @Published var nearbyEvents: [Event] = []
    @Published var friends: [Friend] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    func loadAll() async {
        isLoading = true
        errorMessage = nil
        async let userData = AuthAPI.shared.getMe()
        async let tripsData = TripsAPI.shared.getAll()
        async let eventsData = AdventuresAPI.shared.getUpcomingEvents(limit: 5)
        async let friendsData = FriendsAPI.shared.getAll()

        do {
            let (u, t, e, f) = try await (userData, tripsData, eventsData, friendsData)
            user = u
            trips = t
            upcomingEvents = e
            friends = f
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func updateLocation(_ location: CLLocation) async {
        do {
            _ = try await AuthAPI.shared.updateMe([
                "latitude": location.coordinate.latitude,
                "longitude": location.coordinate.longitude
            ])
            let nearby = try await AdventuresAPI.shared.getNearbyEvents(
                lat: location.coordinate.latitude,
                lng: location.coordinate.longitude,
                radius: 50
            )
            nearbyEvents = nearby
        } catch {
            print("Location update failed: \(error.localizedDescription)")
        }
    }

    func toggleHomeStatus() async {
        guard let u = user else { return }
        let newStatus = u.isHomeOpen ? "closed" : "open"
        do {
            let updated = try await AuthAPI.shared.updateMe(["homeStatus": newStatus])
            user = updated
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
