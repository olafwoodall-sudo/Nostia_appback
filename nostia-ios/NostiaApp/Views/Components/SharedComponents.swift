import SwiftUI

// MARK: - Avatar View

struct AvatarView: View {
    let initial: String
    let color: Color
    let size: CGFloat

    var body: some View {
        Text(initial)
            .font(.system(size: size * 0.4, weight: .bold))
            .foregroundColor(.white)
            .frame(width: size, height: size)
            .background(color)
            .clipShape(Circle())
    }
}

// MARK: - Loading View

struct LoadingView: View {
    var body: some View {
        VStack {
            ProgressView().tint(Color.nostiaAccent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.nostiaBackground)
    }
}

// MARK: - Empty State View

struct EmptyStateView: View {
    let icon: String
    let text: String
    let sub: String

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 64))
                .foregroundColor(Color.nostiaTextSecond)
            Text(text).font(.title3.bold()).foregroundColor(.white)
            if !sub.isEmpty {
                Text(sub).font(.subheadline).foregroundColor(Color.nostiaTextSecond)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 60)
    }
}

// MARK: - Consent Sheet

struct ConsentSheet: View {
    let onConsent: (Bool, Bool) -> Void
    let onDecline: () -> Void

    @State private var locationConsent = true
    @State private var dataCollectionConsent = true
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    Text("Before you join Nostia, we need your consent to use certain features.")
                        .font(.subheadline).foregroundColor(Color.nostiaTextSecond)

                    ConsentToggle(
                        icon: "location.fill",
                        title: "Location Services",
                        description: "Nostia uses your location to show nearby events and share your position with friends. You can change this at any time.",
                        isOn: $locationConsent
                    )

                    ConsentToggle(
                        icon: "chart.bar.fill",
                        title: "Data Collection",
                        description: "We collect usage data to improve the app experience. All data is anonymized and never sold to third parties.",
                        isOn: $dataCollectionConsent
                    )

                    Text("By tapping \"I Agree\", you confirm you've read and accept our Privacy Policy.")
                        .font(.caption).foregroundColor(Color.nostiaTextMuted)
                        .padding(.top, 8)

                    VStack(spacing: 12) {
                        Button {
                            onConsent(locationConsent, dataCollectionConsent)
                        } label: {
                            HStack {
                                Image(systemName: "checkmark.shield.fill")
                                Text("I Agree")
                            }
                            .font(.headline).foregroundColor(.white)
                            .frame(maxWidth: .infinity).padding(16)
                            .background(Color.nostiaAccent).cornerRadius(12)
                        }

                        Button {
                            onDecline()
                        } label: {
                            Text("Decline")
                                .font(.headline).foregroundColor(Color.nostiaTextSecond)
                                .frame(maxWidth: .infinity).padding(16)
                                .background(Color.nostiaInput).cornerRadius(12)
                        }
                    }
                }
                .padding(24)
            }
            .background(Color.nostiaBackground)
            .navigationTitle("Privacy Consent")
            .navigationBarTitleDisplayMode(.inline)
        }
        .presentationBackground(Color.nostiaBackground)
    }
}

struct ConsentToggle: View {
    let icon: String
    let title: String
    let description: String
    @Binding var isOn: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: icon).foregroundColor(Color.nostiaAccent)
                Text(title).font(.headline).foregroundColor(.white)
                Spacer()
                Toggle("", isOn: $isOn).tint(Color.nostiaAccent).labelsHidden()
            }
            Text(description).font(.footnote).foregroundColor(Color.nostiaTextSecond)
        }
        .padding(16)
        .background(Color.nostiaCard)
        .cornerRadius(12)
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.nostriaBorder, lineWidth: 1))
    }
}

// MARK: - Create Trip Sheet

struct CreateTripSheet: View {
    let onSave: (String, String, String?, String?, String?) async -> Void

    @State private var title = ""
    @State private var destination = ""
    @State private var description = ""
    @State private var startDate = ""
    @State private var endDate = ""
    @State private var isSaving = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    NostiaTextField(label: "Title *", placeholder: "Trip title", text: $title)
                    NostiaTextField(label: "Destination *", placeholder: "Where are you going?", text: $destination)
                    NostiaTextField(label: "Start Date", placeholder: "YYYY-MM-DD", text: $startDate)
                    NostiaTextField(label: "End Date", placeholder: "YYYY-MM-DD", text: $endDate)
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Description").font(.system(size: 14, weight: .semibold))
                            .foregroundColor(Color(hex: "D1D5DB"))
                        TextEditor(text: $description)
                            .frame(minHeight: 80).padding(12)
                            .background(Color.nostiaCard).cornerRadius(12)
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.nostriaBorder, lineWidth: 1))
                            .foregroundColor(.white).scrollContentBackground(.hidden)
                    }
                }
                .padding(20)
            }
            .background(Color.nostiaBackground)
            .navigationTitle("Create Trip")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }.foregroundColor(Color.nostiaAccent)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        isSaving = true
                        Task {
                            await onSave(title, destination,
                                         description.isEmpty ? nil : description,
                                         startDate.isEmpty ? nil : startDate,
                                         endDate.isEmpty ? nil : endDate)
                            isSaving = false
                        }
                    } label: {
                        if isSaving { ProgressView().tint(Color.nostiaAccent) }
                        else { Text("Create").fontWeight(.semibold).foregroundColor(Color.nostiaAccent) }
                    }
                    .disabled(title.isEmpty || destination.isEmpty || isSaving)
                }
            }
        }
        .presentationBackground(Color.nostiaBackground)
    }
}

// MARK: - Create Expense Sheet

struct CreateExpenseSheet: View {
    let tripId: Int
    let onSave: (String, Double, String?, String) async -> Void

    @State private var description = ""
    @State private var amountText = ""
    @State private var category = ""
    @State private var dateText = ""
    @State private var isSaving = false
    @Environment(\.dismiss) private var dismiss

    let categories = ["Food", "Transport", "Accommodation", "Activities", "Shopping", "Other"]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    NostiaTextField(label: "Description *", placeholder: "What was this for?", text: $description)

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Amount *").font(.system(size: 14, weight: .semibold)).foregroundColor(Color(hex: "D1D5DB"))
                        HStack {
                            Text("$").foregroundColor(Color.nostiaTextSecond).font(.title3)
                            TextField("0.00", text: $amountText).keyboardType(.decimalPad).foregroundColor(.white)
                        }
                        .padding(16).background(Color.nostiaCard).cornerRadius(12)
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.nostriaBorder, lineWidth: 1))
                    }

                    NostiaTextField(label: "Date *", placeholder: "YYYY-MM-DD", text: $dateText)

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Category").font(.system(size: 14, weight: .semibold)).foregroundColor(Color(hex: "D1D5DB"))
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(categories, id: \.self) { cat in
                                    FilterChip(title: cat, isActive: category == cat) { category = cat }
                                }
                            }
                        }
                    }
                }
                .padding(20)
            }
            .background(Color.nostiaBackground)
            .navigationTitle("Add Expense")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }.foregroundColor(Color.nostiaAccent)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        guard let amount = Double(amountText), amount > 0, !description.isEmpty, !dateText.isEmpty else { return }
                        isSaving = true
                        Task {
                            await onSave(description, amount, category.isEmpty ? nil : category, dateText)
                            isSaving = false
                        }
                    } label: {
                        if isSaving { ProgressView().tint(Color.nostiaAccent) }
                        else { Text("Add").fontWeight(.semibold).foregroundColor(Color.nostiaAccent) }
                    }
                    .disabled(description.isEmpty || amountText.isEmpty || dateText.isEmpty || isSaving)
                }
            }
        }
        .presentationBackground(Color.nostiaBackground)
        .onAppear {
            let fmt = DateFormatter(); fmt.dateFormat = "yyyy-MM-dd"
            dateText = fmt.string(from: Date())
        }
    }
}
