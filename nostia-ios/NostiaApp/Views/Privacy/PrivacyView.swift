import SwiftUI

struct PrivacyView: View {
    @EnvironmentObject var authManager: AuthManager
    @State private var user: User?
    @State private var consentStatus: ConsentStatus?
    @State private var isLoading = true
    @State private var showDeleteAlert = false
    @State private var showRevokeAlert = false
    @State private var message: String?

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                if isLoading {
                    ProgressView().tint(Color.nostiaAccent).padding(40)
                } else {
                    // Account section
                    SettingsSection(title: "Account") {
                        if let u = user {
                            SettingsRow(icon: "person.fill", label: "Name", value: u.name)
                            SettingsRow(icon: "at", label: "Username", value: "@\(u.username)")
                            if let email = u.email, !email.isEmpty {
                                SettingsRow(icon: "envelope.fill", label: "Email", value: email)
                            }
                        }
                    }

                    // Privacy & Consent section
                    SettingsSection(title: "Privacy & Consent") {
                        SettingsRow(icon: "location.fill",
                                    label: "Location Consent",
                                    value: consentStatus?.locationConsent == true ? "Granted" : "Not granted",
                                    valueColor: consentStatus?.locationConsent == true ? Color.nostiaSuccess : Color.nostriaDanger)
                        SettingsRow(icon: "chart.bar.fill",
                                    label: "Data Collection",
                                    value: consentStatus?.dataCollectionConsent == true ? "Granted" : "Not granted",
                                    valueColor: consentStatus?.dataCollectionConsent == true ? Color.nostiaSuccess : Color.nostriaDanger)

                        Button {
                            showRevokeAlert = true
                        } label: {
                            HStack {
                                Image(systemName: "xmark.shield").foregroundColor(Color.nostriaDanger)
                                Text("Revoke All Consent").foregroundColor(Color.nostriaDanger)
                                Spacer()
                                Image(systemName: "chevron.right").foregroundColor(Color.nostiaTextSecond)
                            }
                            .padding(16)
                        }
                    }

                    // Data section
                    SettingsSection(title: "Your Data") {
                        Button {
                            Task { await requestDataExport() }
                        } label: {
                            HStack {
                                Image(systemName: "square.and.arrow.down").foregroundColor(Color.nostiaAccent)
                                Text("Request Data Export").foregroundColor(.white)
                                Spacer()
                                Image(systemName: "chevron.right").foregroundColor(Color.nostiaTextSecond)
                            }
                            .padding(16)
                        }

                        Button {
                            showDeleteAlert = true
                        } label: {
                            HStack {
                                Image(systemName: "trash.fill").foregroundColor(Color.nostriaDanger)
                                Text("Delete My Data").foregroundColor(Color.nostriaDanger)
                                Spacer()
                                Image(systemName: "chevron.right").foregroundColor(Color.nostiaTextSecond)
                            }
                            .padding(16)
                        }
                    }

                    // Logout
                    Button {
                        authManager.logout()
                    } label: {
                        HStack {
                            Spacer()
                            Image(systemName: "rectangle.portrait.and.arrow.right")
                            Text("Logout")
                            Spacer()
                        }
                        .font(.headline).foregroundColor(.white)
                        .padding(16)
                        .background(Color.nostriaDanger).cornerRadius(12)
                    }

                    if let msg = message {
                        Text(msg).font(.footnote).foregroundColor(Color.nostiaSuccess)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(12).background(Color.nostiaSuccess.opacity(0.1)).cornerRadius(8)
                    }
                }
            }
            .padding(16).padding(.bottom, 40)
        }
        .background(Color.nostiaBackground)
        .task { await loadData() }
        .alert("Revoke Consent", isPresented: $showRevokeAlert) {
            Button("Cancel", role: .cancel) {}
            Button("Revoke", role: .destructive) { Task { await revokeConsent() } }
        } message: {
            Text("This will revoke all consents and you may lose access to some features.")
        }
        .alert("Delete Data", isPresented: $showDeleteAlert) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) { Task { await deleteData() } }
        } message: {
            Text("This will request deletion of all your personal data. This action cannot be undone.")
        }
    }

    func loadData() async {
        isLoading = true
        async let userData = AuthAPI.shared.getMe()
        async let consentData: ConsentStatus? = try? APIClient.shared.request("/consent")
        let (u, c) = await (try? userData, await consentData)
        user = u
        consentStatus = c
        isLoading = false
    }

    func revokeConsent() async {
        try? await APIClient.shared.requestVoid("/consent/revoke", method: "POST")
        message = "Consent revoked."
        await loadData()
    }

    func requestDataExport() async {
        try? await APIClient.shared.requestVoid("/privacy/data-request", method: "POST")
        message = "Data export requested. You'll receive an email when it's ready."
    }

    func deleteData() async {
        try? await APIClient.shared.requestVoid("/privacy/delete-data", method: "POST")
        authManager.logout()
    }
}

struct ConsentStatus: Decodable {
    let locationConsent: Bool?
    let dataCollectionConsent: Bool?
}

struct SettingsSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(title).font(.footnote.bold()).foregroundColor(Color.nostiaTextSecond)
                .padding(.horizontal, 16).padding(.bottom, 6)
            VStack(spacing: 0) {
                content()
            }
            .background(Color.nostiaCard)
            .cornerRadius(12)
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.nostriaBorder, lineWidth: 1))
        }
    }
}

struct SettingsRow: View {
    let icon: String
    let label: String
    let value: String
    var valueColor: Color = Color.nostiaTextSecond

    var body: some View {
        HStack {
            Image(systemName: icon).foregroundColor(Color.nostiaAccent).frame(width: 24)
            Text(label).foregroundColor(.white)
            Spacer()
            Text(value).foregroundColor(valueColor)
        }
        .font(.subheadline)
        .padding(16)
        .overlay(Divider().background(Color.nostriaBorder), alignment: .bottom)
    }
}
