import SwiftUI

struct LoginView: View {
    @StateObject private var vm = AuthViewModel()
    @State private var username = ""
    @State private var password = ""
    @State private var showPassword = false

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                // Header gradient
                LinearGradient(
                    colors: [Color.nostiaAccent, Color.nostriaPurple],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .frame(maxWidth: .infinity)
                .frame(height: 280)
                .overlay {
                    VStack(spacing: 12) {
                        Image(systemName: "safari.fill")
                            .font(.system(size: 64))
                            .foregroundColor(.white)
                        Text("Welcome Back")
                            .font(.system(size: 32, weight: .bold))
                            .foregroundColor(.white)
                        Text("Sign in to continue your adventure")
                            .font(.subheadline)
                            .foregroundColor(Color(hex: "E0E7FF"))
                    }
                }

                // Form
                VStack(spacing: 20) {
                    if let err = vm.errorMessage {
                        Text(err)
                            .font(.footnote)
                            .foregroundColor(Color.nostriaDanger)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(12)
                            .background(Color.nostriaDanger.opacity(0.15))
                            .cornerRadius(8)
                    }

                    NostiaTextField(label: "Username", placeholder: "Enter your username", text: $username)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)

                    NostiaSecureField(label: "Password", placeholder: "Enter your password", text: $password)

                    Button {
                        Task { await vm.login(username: username, password: password) }
                    } label: {
                        HStack(spacing: 8) {
                            if vm.isLoading {
                                ProgressView().tint(.white)
                            } else {
                                Image(systemName: "arrow.right.circle.fill")
                                Text("Login")
                            }
                        }
                        .font(.system(size: 18, weight: .bold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(18)
                        .background(
                            LinearGradient(colors: [Color.nostiaAccent, Color.nostriaPurple],
                                           startPoint: .leading, endPoint: .trailing)
                        )
                        .cornerRadius(12)
                    }
                    .disabled(vm.isLoading)

                    Divider().background(Color.nostriaBorder)

                    NavigationLink(destination: SignupView()) {
                        HStack(spacing: 4) {
                            Text("Don't have an account?").foregroundColor(Color.nostiaTextSecond)
                            Text("Sign Up").fontWeight(.bold).foregroundColor(Color.nostiaAccent)
                        }
                        .font(.subheadline)
                    }
                }
                .padding(24)
            }
        }
        .background(Color.nostiaBackground)
        .scrollBounceBehavior(.basedOnSize)
        .navigationBarHidden(true)
    }
}

// MARK: - Shared Input Components

struct NostiaTextField: View {
    let label: String
    let placeholder: String
    @Binding var text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(Color(hex: "D1D5DB"))
            TextField(placeholder, text: $text)
                .padding(16)
                .background(Color.nostiaCard)
                .cornerRadius(12)
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.nostriaBorder, lineWidth: 1))
                .foregroundColor(.white)
        }
    }
}

struct NostiaSecureField: View {
    let label: String
    let placeholder: String
    @Binding var text: String
    @State private var show = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(Color(hex: "D1D5DB"))
            HStack {
                Group {
                    if show { TextField(placeholder, text: $text) }
                    else { SecureField(placeholder, text: $text) }
                }
                .foregroundColor(.white)
                Button { show.toggle() } label: {
                    Image(systemName: show ? "eye.slash" : "eye").foregroundColor(Color.nostiaTextMuted)
                }
            }
            .padding(16)
            .background(Color.nostiaCard)
            .cornerRadius(12)
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.nostriaBorder, lineWidth: 1))
        }
    }
}
