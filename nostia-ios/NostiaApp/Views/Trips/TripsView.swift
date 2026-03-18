import SwiftUI

struct TripsView: View {
    @StateObject private var vm = TripsViewModel()
    @State private var showCreateSheet = false
    @State private var editingTrip: Trip?
    @State private var tripToVault: Trip?

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            if vm.isLoading {
                LoadingView()
            } else {
                List {
                    ForEach(vm.trips) { trip in
                        TripCard(trip: trip,
                                 onVault: { tripToVault = trip },
                                 onEdit: { editingTrip = trip },
                                 onDelete: { Task { await vm.deleteTrip(trip.id) } })
                            .listRowBackground(Color.clear)
                            .listRowSeparator(.hidden)
                            .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                    }
                }
                .listStyle(.plain)
                .background(Color.nostiaBackground)
                .refreshable { await vm.loadTrips() }
                .overlay {
                    if vm.trips.isEmpty { EmptyStateView(icon: "airplane", text: "No trips yet", sub: "Create your first adventure!") }
                }
            }

            // FAB
            Button { showCreateSheet = true } label: {
                LinearGradient(colors: [Color.nostiaAccent, Color.nostriaPurple],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
                    .frame(width: 60, height: 60).cornerRadius(30)
                    .overlay(Image(systemName: "plus").font(.title2.bold()).foregroundColor(.white))
                    .shadow(radius: 8)
            }
            .padding(20)
        }
        .background(Color.nostiaBackground)
        .task { await vm.loadTrips() }
        .alert("Error", isPresented: Binding(get: { vm.errorMessage != nil }, set: { if !$0 { vm.errorMessage = nil } })) {
            Button("OK") { vm.errorMessage = nil }
        } message: { Text(vm.errorMessage ?? "") }
        .sheet(isPresented: $showCreateSheet) {
            CreateTripSheet { title, dest, desc, start, end in
                let ok = await vm.createTrip(title: title, destination: dest, description: desc, startDate: start, endDate: end)
                if ok { showCreateSheet = false }
            }
        }
        .sheet(item: $editingTrip) { trip in
            EditTripSheet(trip: trip) { title, dest, desc, start, end in
                let ok = await vm.updateTrip(trip.id, title: title, destination: dest, description: desc, startDate: start, endDate: end)
                if ok { editingTrip = nil }
            }
        }
        .navigationDestination(item: $tripToVault) { trip in
            VaultView(tripId: trip.id, tripTitle: trip.title)
        }
    }
}

struct TripCard: View {
    let trip: Trip
    let onVault: () -> Void
    let onEdit: () -> Void
    let onDelete: () -> Void

    @State private var showDeleteAlert = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(trip.title).font(.headline).foregroundColor(.white)
                    Text(trip.destination).font(.footnote).foregroundColor(Color.nostiaTextSecond)
                }
                Spacer()
                Text(trip.formattedDates)
                    .font(.caption.bold()).foregroundColor(Color(hex: "93C5FD"))
                    .padding(.horizontal, 12).padding(.vertical, 6)
                    .background(Color(hex: "1E3A8A"))
                    .overlay(RoundedRectangle(cornerRadius: 20).stroke(Color.nostiaAccent, lineWidth: 1))
                    .cornerRadius(20)
            }
            if let desc = trip.description, !desc.isEmpty {
                Text(desc).font(.footnote).foregroundColor(Color(hex: "D1D5DB")).lineLimit(2)
            }
            Divider().background(Color.nostriaBorder)
            HStack {
                Label("\(trip.participantCount) people", systemImage: "person.2")
                    .font(.footnote).foregroundColor(Color(hex: "D1D5DB"))
                Spacer()
                HStack(spacing: 12) {
                    Button { onEdit() } label: {
                        Image(systemName: "pencil")
                            .padding(6).background(Color.nostiaInput).cornerRadius(8)
                            .foregroundColor(Color.nostiaTextSecond)
                    }
                    Button { onVault() } label: {
                        Label("Vault", systemImage: "creditcard")
                            .font(.footnote.bold()).foregroundColor(Color.nostiaSuccess)
                    }
                }
            }
        }
        .padding(16)
        .background(Color.nostiaCard)
        .cornerRadius(12)
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.nostriaBorder, lineWidth: 1))
        .contextMenu {
            Button(role: .destructive) { showDeleteAlert = true } label: {
                Label("Delete Trip", systemImage: "trash")
            }
        }
        .alert("Delete Trip", isPresented: $showDeleteAlert) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) { onDelete() }
        } message: {
            Text("Delete \"\(trip.title)\"? All data including expenses will be removed.")
        }
    }
}

struct EditTripSheet: View {
    let trip: Trip
    let onSave: (String, String, String?, String?, String?) async -> Void

    @State private var title: String
    @State private var destination: String
    @State private var description: String
    @State private var startDate: String
    @State private var endDate: String
    @State private var isSaving = false
    @Environment(\.dismiss) private var dismiss

    init(trip: Trip, onSave: @escaping (String, String, String?, String?, String?) async -> Void) {
        self.trip = trip
        self.onSave = onSave
        _title = State(initialValue: trip.title)
        _destination = State(initialValue: trip.destination)
        _description = State(initialValue: trip.description ?? "")
        _startDate = State(initialValue: trip.startDate.flatMap { String($0.prefix(10)) } ?? "")
        _endDate = State(initialValue: trip.endDate.flatMap { String($0.prefix(10)) } ?? "")
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    NostiaTextField(label: "Title *", placeholder: "Trip title", text: $title)
                    NostiaTextField(label: "Destination *", placeholder: "Destination", text: $destination)
                    NostiaTextField(label: "Start Date", placeholder: "YYYY-MM-DD", text: $startDate)
                    NostiaTextField(label: "End Date", placeholder: "YYYY-MM-DD", text: $endDate)
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Description").font(.system(size: 14, weight: .semibold)).foregroundColor(Color(hex: "D1D5DB"))
                        TextEditor(text: $description)
                            .frame(minHeight: 80).padding(12)
                            .background(Color.nostiaCard)
                            .cornerRadius(12)
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.nostriaBorder, lineWidth: 1))
                            .foregroundColor(.white).scrollContentBackground(.hidden)
                    }
                }
                .padding(20)
            }
            .background(Color.nostiaBackground)
            .navigationTitle("Edit Trip")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }.foregroundColor(Color.nostiaAccent)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        isSaving = true
                        Task {
                            await onSave(title, destination, description.isEmpty ? nil : description,
                                         startDate.isEmpty ? nil : startDate,
                                         endDate.isEmpty ? nil : endDate)
                            isSaving = false
                        }
                    } label: {
                        if isSaving { ProgressView().tint(Color.nostiaAccent) }
                        else { Text("Save").fontWeight(.semibold).foregroundColor(Color.nostiaAccent) }
                    }
                    .disabled(title.isEmpty || destination.isEmpty || isSaving)
                }
            }
        }
        .presentationBackground(Color.nostiaBackground)
    }
}
