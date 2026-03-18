import SwiftUI

struct ChatView: View {
    let conversationId: Int
    let friendName: String

    @StateObject private var vm = ChatViewModel()
    @State private var scrollProxy: ScrollViewProxy?

    var body: some View {
        VStack(spacing: 0) {
            // Messages list
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 0) {
                        if vm.isLoading {
                            ProgressView().tint(Color.nostiaAccent).padding(40)
                        } else if vm.messages.isEmpty {
                            EmptyStateView(icon: "bubble.left.and.bubble.right",
                                           text: "No messages yet",
                                           sub: "Send a message to start the conversation!")
                                .padding(.top, 60)
                        } else {
                            ForEach(Array(vm.messages.enumerated()), id: \.element.id) { idx, msg in
                                let showDate = idx == 0 ||
                                    !Calendar.current.isDate(
                                        ISO8601DateFormatter().date(from: msg.createdAt) ?? Date(),
                                        inSameDayAs: ISO8601DateFormatter().date(from: vm.messages[idx - 1].createdAt) ?? Date()
                                    )
                                VStack(spacing: 0) {
                                    if showDate {
                                        Text(msg.dayString)
                                            .font(.caption).foregroundColor(Color.nostiaTextMuted)
                                            .padding(.horizontal, 12).padding(.vertical, 4)
                                            .background(Color.nostiaCard).cornerRadius(12)
                                            .padding(.vertical, 12)
                                    }
                                    MessageBubble(message: msg, isFromMe: vm.isFromMe(msg))
                                }
                            }
                        }
                        Color.clear.frame(height: 1).id("bottom")
                    }
                    .padding(.horizontal, 16)
                }
                .onChange(of: vm.messages.count) { _ in
                    withAnimation { proxy.scrollTo("bottom") }
                }
                .onAppear {
                    proxy.scrollTo("bottom")
                }
            }

            // Input bar
            VStack(spacing: 0) {
                Divider().background(Color.nostriaBorder)
                HStack(alignment: .bottom, spacing: 12) {
                    TextField("Type a message...", text: $vm.newMessage, axis: .vertical)
                        .lineLimit(1...5)
                        .padding(.horizontal, 16).padding(.vertical, 10)
                        .background(Color.nostiaInput).cornerRadius(20)
                        .foregroundColor(.white)

                    Button {
                        Task { await vm.send(conversationId: conversationId) }
                    } label: {
                        if vm.isSending {
                            ProgressView().tint(.white)
                                .frame(width: 44, height: 44)
                        } else {
                            Image(systemName: "paperplane.fill")
                                .foregroundColor(.white)
                                .frame(width: 44, height: 44)
                                .background(vm.newMessage.trimmingCharacters(in: .whitespaces).isEmpty
                                            ? Color(hex: "4B5563") : Color.nostiaAccent)
                                .clipShape(Circle())
                        }
                    }
                    .disabled(vm.newMessage.trimmingCharacters(in: .whitespaces).isEmpty || vm.isSending)
                }
                .padding(12)
                .background(Color.nostiaCard)
            }
        }
        .background(Color.nostiaBackground)
        .navigationTitle(friendName)
        .navigationBarTitleDisplayMode(.inline)
        .task { await vm.initialize(conversationId: conversationId) }
        .onDisappear { vm.stopPolling() }
    }
}

struct MessageBubble: View {
    let message: Message
    let isFromMe: Bool

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            if isFromMe { Spacer(minLength: 60) }
            if !isFromMe {
                AvatarView(initial: String(message.senderName.prefix(1)).uppercased(),
                           color: Color.nostiaInput, size: 28)
            }
            VStack(alignment: isFromMe ? .trailing : .leading, spacing: 4) {
                Text(message.content)
                    .font(.body)
                    .foregroundColor(.white)
                    .padding(.horizontal, 16).padding(.vertical, 10)
                    .background(isFromMe ? Color.nostiaAccent : Color.nostiaInput)
                    .cornerRadius(18)
                    .clipShape(
                        UnevenRoundedRectangle(
                            topLeadingRadius: 18, bottomLeadingRadius: isFromMe ? 18 : 4,
                            bottomTrailingRadius: isFromMe ? 4 : 18, topTrailingRadius: 18
                        )
                    )
                Text(message.timeFormatted)
                    .font(.system(size: 10)).foregroundColor(Color.nostiaTextMuted)
            }
            if !isFromMe { Spacer(minLength: 60) }
        }
        .padding(.vertical, 4)
    }
}
