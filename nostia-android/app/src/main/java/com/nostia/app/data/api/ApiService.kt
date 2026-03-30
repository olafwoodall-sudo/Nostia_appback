package com.nostia.app.data.api

import com.nostia.app.data.api.models.*
import retrofit2.Response
import retrofit2.http.*

interface ApiService {

    // ── Auth ──────────────────────────────────────────────────────────────────

    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): Response<AuthResponse>

    @POST("auth/register")
    suspend fun register(@Body request: RegisterRequest): Response<AuthResponse>

    // ── Users ─────────────────────────────────────────────────────────────────

    @GET("users/me")
    suspend fun getMe(): Response<User>

    @PUT("users/me")
    suspend fun updateMe(@Body request: UpdateUserRequest): Response<User>

    @GET("users/{id}")
    suspend fun getUserById(@Path("id") id: Int): Response<User>

    @GET("users/search")
    suspend fun searchUsers(@Query("query") query: String): Response<List<User>>

    // ── Trips ─────────────────────────────────────────────────────────────────

    @GET("trips")
    suspend fun getTrips(): Response<List<Trip>>

    @POST("trips")
    suspend fun createTrip(@Body request: CreateTripRequest): Response<Trip>

    @PUT("trips/{id}")
    suspend fun updateTrip(@Path("id") id: Int, @Body request: CreateTripRequest): Response<Trip>

    @DELETE("trips/{id}")
    suspend fun deleteTrip(@Path("id") id: Int): Response<SuccessResponse>

    // ── Friends ───────────────────────────────────────────────────────────────

    @GET("friends")
    suspend fun getFriends(): Response<List<User>>

    @GET("friends/requests")
    suspend fun getFriendRequests(): Response<FriendRequestsResponse>

    @POST("friends/request")
    suspend fun sendFriendRequest(@Body request: SendFriendRequest): Response<FriendRequest>

    @POST("friends/accept/{requestId}")
    suspend fun acceptFriendRequest(@Path("requestId") requestId: Int): Response<SuccessResponse>

    @DELETE("friends/reject/{requestId}")
    suspend fun rejectFriendRequest(@Path("requestId") requestId: Int): Response<SuccessResponse>

    @DELETE("friends/{friendId}")
    suspend fun removeFriend(@Path("friendId") friendId: Int): Response<SuccessResponse>

    @GET("friends/locations")
    suspend fun getFriendLocations(): Response<List<FriendLocation>>

    // ── Adventures ────────────────────────────────────────────────────────────

    @GET("adventures")
    suspend fun getAdventures(
        @Query("search") search: String? = null,
        @Query("category") category: String? = null,
        @Query("difficulty") difficulty: String? = null
    ): Response<List<Adventure>>

    @POST("adventures")
    suspend fun createAdventure(@Body request: CreateAdventureRequest): Response<Adventure>

    // ── Feed ──────────────────────────────────────────────────────────────────

    @GET("feed")
    suspend fun getFeed(@Query("limit") limit: Int? = null): Response<List<Post>>

    @POST("feed")
    suspend fun createPost(@Body request: CreatePostRequest): Response<Post>

    @DELETE("feed/{id}")
    suspend fun deletePost(@Path("id") id: Int): Response<SuccessResponse>

    @POST("feed/{id}/like")
    suspend fun likePost(@Path("id") id: Int): Response<SuccessResponse>

    @DELETE("feed/{id}/like")
    suspend fun unlikePost(@Path("id") id: Int): Response<SuccessResponse>

    @GET("feed/{postId}/comments")
    suspend fun getComments(@Path("postId") postId: Int): Response<List<Comment>>

    @POST("feed/{postId}/comments")
    suspend fun createComment(
        @Path("postId") postId: Int,
        @Body request: CreateCommentRequest
    ): Response<Comment>

    // ── Events ────────────────────────────────────────────────────────────────

    @GET("events/upcoming")
    suspend fun getUpcomingEvents(@Query("limit") limit: Int? = null): Response<List<Event>>

    @GET("events/nearby")
    suspend fun getNearbyEvents(
        @Query("lat") lat: Double,
        @Query("lng") lng: Double,
        @Query("radius") radius: Double? = null
    ): Response<List<Event>>

    // ── Vault ─────────────────────────────────────────────────────────────────

    @GET("vault/trip/{tripId}")
    suspend fun getVaultForTrip(@Path("tripId") tripId: Int): Response<VaultResponse>

    @POST("vault")
    suspend fun createVaultEntry(@Body request: CreateVaultEntryRequest): Response<VaultEntry>

    @PUT("vault/splits/{splitId}/paid")
    suspend fun markSplitPaid(@Path("splitId") splitId: Int): Response<SuccessResponse>

    @POST("vault/splits/{splitId}/payment-intent")
    suspend fun createPaymentIntent(@Path("splitId") splitId: Int): Response<PaymentIntentResponse>

    @DELETE("vault/{id}")
    suspend fun deleteVaultEntry(@Path("id") id: Int): Response<SuccessResponse>

    // ── Notifications ─────────────────────────────────────────────────────────

    @GET("notifications")
    suspend fun getNotifications(@Query("limit") limit: Int? = null): Response<List<Notification>>

    @GET("notifications/unread-count")
    suspend fun getUnreadCount(): Response<UnreadCountResponse>

    @PUT("notifications/{id}/read")
    suspend fun markNotificationRead(@Path("id") id: Int): Response<SuccessResponse>

    @PUT("notifications/read-all")
    suspend fun markAllNotificationsRead(): Response<SuccessResponse>

    // ── Messages ──────────────────────────────────────────────────────────────

    @POST("conversations")
    suspend fun createConversation(@Body request: CreateConversationRequest): Response<Conversation>

    @GET("conversations/{id}/messages")
    suspend fun getMessages(
        @Path("id") conversationId: Int,
        @Query("limit") limit: Int? = null,
        @Query("offset") offset: Int? = null
    ): Response<List<Message>>

    @POST("conversations/{id}/messages")
    suspend fun sendMessage(
        @Path("id") conversationId: Int,
        @Body request: SendMessageRequest
    ): Response<Message>

    @PUT("conversations/{id}/read")
    suspend fun markConversationRead(@Path("id") conversationId: Int): Response<SuccessResponse>

    // ── Consent ───────────────────────────────────────────────────────────────

    @POST("consent")
    suspend fun updateConsent(@Body request: ConsentRequest): Response<ConsentRecord>

    @GET("consent")
    suspend fun getConsent(): Response<ConsentResponse>

    // ── Privacy ───────────────────────────────────────────────────────────────

    @GET("privacy/policy")
    suspend fun getPrivacyPolicy(): Response<PrivacyPolicy>

    @POST("privacy/data-request")
    suspend fun requestDataExport(): Response<DataExportResponse>

    @POST("privacy/delete-data")
    suspend fun deleteAccountData(): Response<SuccessResponse>

    // ── Push Token ────────────────────────────────────────────────────────────

    @POST("push-token")
    suspend fun registerPushToken(@Body request: PushTokenRequest): Response<SuccessResponse>
}
