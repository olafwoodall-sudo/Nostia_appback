package com.nostia.app.data.api.models

import com.google.gson.annotations.SerializedName

// ── Auth ──────────────────────────────────────────────────────────────────────

data class LoginRequest(
    val username: String,
    val password: String
)

data class RegisterRequest(
    val username: String,
    val password: String,
    val name: String,
    val email: String?,
    val locationConsent: Boolean,
    val dataCollectionConsent: Boolean
)

data class AuthResponse(
    val token: String,
    val user: User
)

// ── User ──────────────────────────────────────────────────────────────────────

data class User(
    val id: Int,
    val username: String,
    val name: String,
    val email: String?,
    val homeStatus: String?,
    val latitude: Double?,
    val longitude: Double?,
    val role: String?,
    @SerializedName("createdAt") val createdAt: String?
)

data class UpdateUserRequest(
    val name: String? = null,
    val email: String? = null,
    val username: String? = null,
    val homeStatus: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null
)

// ── Trips ─────────────────────────────────────────────────────────────────────

data class Trip(
    val id: Int,
    val title: String,
    val destination: String?,
    val description: String?,
    val startDate: String?,
    val endDate: String?,
    @SerializedName("createdAt") val createdAt: String?
)

data class CreateTripRequest(
    val title: String,
    val destination: String,
    val description: String,
    val startDate: String,
    val endDate: String
)

// ── Friends ───────────────────────────────────────────────────────────────────

data class FriendRequest(
    val id: Int,
    val senderId: Int,
    val receiverId: Int,
    val status: String?,
    @SerializedName("createdAt") val createdAt: String?,
    val sender: User?,
    val receiver: User?
)

data class FriendRequestsResponse(
    val received: List<FriendRequest>,
    val sent: List<FriendRequest>
)

data class SendFriendRequest(
    val friendId: Int
)

data class FriendLocation(
    val id: Int,
    val username: String,
    val name: String,
    val latitude: Double?,
    val longitude: Double?,
    val updatedAt: String?
)

// ── Adventures ────────────────────────────────────────────────────────────────

data class Adventure(
    val id: Int,
    val title: String,
    val description: String?,
    val category: String?,
    val difficulty: String?,
    val location: String?,
    val imageUrl: String?
)

data class CreateAdventureRequest(
    val title: String,
    val location: String,
    val description: String? = null,
    val category: String? = null,
    val difficulty: String? = null
)

// ── Feed ──────────────────────────────────────────────────────────────────────

data class Post(
    val id: Int,
    val content: String?,
    val imageUrl: String?,
    val relatedTripId: Int?,
    @SerializedName("createdAt") val createdAt: String?,
    val author: User?,
    val likesCount: Int?,
    val commentsCount: Int?,
    val likedByMe: Boolean?
)

data class CreatePostRequest(
    val content: String?,
    val imageData: String?,
    val relatedTripId: Int?
)

data class Comment(
    val id: Int,
    val content: String,
    @SerializedName("createdAt") val createdAt: String?,
    val author: User?
)

data class CreateCommentRequest(
    val content: String
)

// ── Events ────────────────────────────────────────────────────────────────────

data class Event(
    val id: Int,
    val title: String,
    val description: String?,
    val location: String?,
    val latitude: Double?,
    val longitude: Double?,
    val startDate: String?,
    val endDate: String?
)

// ── Vault ─────────────────────────────────────────────────────────────────────

data class VaultEntry(
    val id: Int,
    val description: String,
    val amount: Double,
    val currency: String?,
    @SerializedName("createdAt") val createdAt: String?,
    val paidBy: User?,
    val splits: List<VaultSplit>?
)

data class VaultSplit(
    val id: Int,
    val userId: Int,
    val amount: Double,
    val paid: Boolean,
    val user: User?
)

data class VaultBalance(
    val userId: Int,
    val username: String,
    val name: String,
    val balance: Double
)

data class VaultResponse(
    val totalExpenses: Double,
    val entries: List<VaultEntry>,
    val balances: List<VaultBalance>,
    val unpaidSplits: List<VaultSplit>
)

data class CreateVaultEntryRequest(
    val description: String,
    val amount: Double,
    val currency: String,
    val paidById: Int,
    val splits: List<SplitRequest>
)

data class SplitRequest(
    val userId: Int,
    val amount: Double
)

data class PaymentIntentResponse(
    val clientSecret: String,
    val chargedAmount: Double
)

// ── Notifications ─────────────────────────────────────────────────────────────

data class Notification(
    val id: Int,
    val type: String?,
    val message: String,
    val read: Boolean,
    @SerializedName("createdAt") val createdAt: String?,
    val relatedId: Int?
)

data class UnreadCountResponse(
    val unreadCount: Int
)

// ── Messages ──────────────────────────────────────────────────────────────────

data class Conversation(
    val id: Int,
    val participants: List<User>?
)

data class CreateConversationRequest(
    val userId: Int
)

data class Message(
    val id: Int,
    val content: String,
    @SerializedName("createdAt") val createdAt: String?,
    val sender: User?,
    val senderId: Int?
)

data class SendMessageRequest(
    val content: String
)

// ── Consent ───────────────────────────────────────────────────────────────────

data class ConsentRequest(
    val locationConsent: Boolean,
    val dataCollectionConsent: Boolean
)

data class ConsentRecord(
    val locationConsent: Boolean?,
    val dataCollectionConsent: Boolean?,
    val updatedAt: String?
)

data class ConsentResponse(
    val isValid: Boolean,
    val consent: ConsentRecord?
)

// ── Privacy ───────────────────────────────────────────────────────────────────

data class PrivacySection(
    val title: String,
    val content: String
)

data class PrivacyPolicy(
    val version: String,
    val sections: List<PrivacySection>,
    val lastUpdated: String
)

data class DataExportResponse(
    val exportId: String
)

// ── Push Token ────────────────────────────────────────────────────────────────

data class PushTokenRequest(
    val token: String,
    val platform: String
)

// ── Generic ───────────────────────────────────────────────────────────────────

data class SuccessResponse(
    val success: Boolean?,
    val message: String?
)
