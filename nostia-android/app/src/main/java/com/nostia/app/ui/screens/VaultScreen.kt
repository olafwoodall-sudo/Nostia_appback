package com.nostia.app.ui.screens

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nostia.app.constants.AppConstants
import com.nostia.app.data.api.ApiService
import com.nostia.app.data.api.models.CreateVaultEntryRequest
import com.nostia.app.data.api.models.SplitRequest
import com.nostia.app.data.api.models.VaultBalance
import com.nostia.app.data.api.models.VaultEntry
import com.nostia.app.data.api.models.VaultSplit
import com.nostia.app.ui.theme.NostiaBackground
import com.nostia.app.ui.theme.NostiaBorder
import com.nostia.app.ui.theme.NostiaPrimary
import com.nostia.app.ui.theme.NostiaSurface
import com.nostia.app.ui.theme.NostiaTextPrimary
import com.nostia.app.ui.theme.NostiaTextSecondary
import kotlinx.coroutines.launch
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VaultScreen(
    tripId: Int,
    tripTitle: String,
    apiService: ApiService,
    onUnauthorized: () -> Unit,
    onNavigateBack: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    var totalExpenses by remember { mutableStateOf(0.0) }
    var entries by remember { mutableStateOf<List<VaultEntry>>(emptyList()) }
    var balances by remember { mutableStateOf<List<VaultBalance>>(emptyList()) }
    var unpaidSplits by remember { mutableStateOf<List<VaultSplit>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var showAddExpense by remember { mutableStateOf(false) }
    var currentUserId by remember { mutableStateOf<Int?>(null) }

    fun loadVault() {
        scope.launch {
            isLoading = true
            try {
                val response = apiService.getVaultForTrip(tripId)
                if (response.code() == 401) { onUnauthorized(); return@launch }
                if (response.isSuccessful) {
                    val body = response.body()
                    totalExpenses = body?.totalExpenses ?: 0.0
                    entries = body?.entries ?: emptyList()
                    balances = body?.balances ?: emptyList()
                    unpaidSplits = body?.unpaidSplits ?: emptyList()
                }
            } catch (_: Exception) {
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(Unit) {
        try {
            val meResponse = apiService.getMe()
            if (meResponse.isSuccessful) currentUserId = meResponse.body()?.id
        } catch (_: Exception) { }
        loadVault()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "Vault",
                            fontSize = 18.sp,
                            color = NostiaTextPrimary,
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(text = tripTitle, fontSize = 12.sp, color = NostiaTextSecondary)
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = NostiaTextPrimary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = NostiaSurface)
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showAddExpense = true },
                containerColor = NostiaPrimary
            ) {
                Icon(Icons.Filled.Add, contentDescription = "Add Expense", tint = NostiaTextPrimary)
            }
        },
        containerColor = NostiaBackground
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(NostiaBackground)
                .padding(paddingValues)
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.align(Alignment.Center),
                    color = NostiaPrimary
                )
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Total card
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = NostiaPrimary),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Column(
                                modifier = Modifier.padding(16.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text(
                                    text = "Total Expenses",
                                    fontSize = 13.sp,
                                    color = NostiaTextPrimary.copy(alpha = 0.8f)
                                )
                                Text(
                                    text = String.format(Locale.US, "$%.2f", totalExpenses),
                                    fontSize = 32.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = NostiaTextPrimary
                                )
                            }
                        }
                    }

                    // Unpaid splits
                    if (unpaidSplits.isNotEmpty()) {
                        item {
                            SectionHeader("Unpaid Splits")
                        }
                        items(unpaidSplits) { split ->
                            UnpaidSplitCard(
                                split = split,
                                onPayClicked = {
                                    Toast.makeText(
                                        context,
                                        "Stripe payment — configure ${AppConstants.STRIPE_PUBLISHABLE_KEY}",
                                        Toast.LENGTH_LONG
                                    ).show()
                                }
                            )
                        }
                    }

                    // Balances
                    if (balances.isNotEmpty()) {
                        item { SectionHeader("Balances") }
                        items(balances) { balance ->
                            BalanceCard(balance = balance)
                        }
                    }

                    // Expenses list
                    if (entries.isNotEmpty()) {
                        item { SectionHeader("Expenses") }
                        items(entries) { entry ->
                            ExpenseCard(entry = entry)
                        }
                    }

                    if (entries.isEmpty() && unpaidSplits.isEmpty()) {
                        item {
                            Box(
                                modifier = Modifier.fillMaxWidth().padding(32.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("No expenses yet. Tap + to add one.", color = NostiaTextSecondary)
                            }
                        }
                    }
                }
            }
        }
    }

    if (showAddExpense && currentUserId != null) {
        AddExpenseDialog(
            apiService = apiService,
            currentUserId = currentUserId!!,
            tripId = tripId,
            onDismiss = { showAddExpense = false },
            onCreated = {
                showAddExpense = false
                loadVault()
            }
        )
    }
}

@Composable
private fun SectionHeader(text: String) {
    Text(
        text = text,
        fontSize = 16.sp,
        fontWeight = FontWeight.SemiBold,
        color = NostiaTextPrimary,
        modifier = Modifier.padding(vertical = 4.dp)
    )
}

@Composable
private fun UnpaidSplitCard(split: VaultSplit, onPayClicked: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = NostiaSurface),
        shape = RoundedCornerShape(10.dp)
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = split.user?.name ?: split.user?.username ?: "User ${split.userId}",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = NostiaTextPrimary
                )
                Text(
                    text = String.format(Locale.US, "Owes $%.2f", split.amount),
                    fontSize = 13.sp,
                    color = androidx.compose.ui.graphics.Color(0xFFEF4444)
                )
            }
            Button(
                onClick = onPayClicked,
                colors = ButtonDefaults.buttonColors(containerColor = NostiaPrimary),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp)
            ) {
                Text("Pay", color = NostiaTextPrimary, fontSize = 13.sp)
            }
        }
    }
}

@Composable
private fun BalanceCard(balance: VaultBalance) {
    val isPositive = balance.balance >= 0
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = NostiaSurface),
        shape = RoundedCornerShape(10.dp)
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(text = balance.name, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = NostiaTextPrimary)
                Text(text = "@${balance.username}", fontSize = 12.sp, color = NostiaTextSecondary)
            }
            Text(
                text = String.format(Locale.US, "%s$%.2f", if (isPositive) "+" else "", balance.balance),
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = if (isPositive) androidx.compose.ui.graphics.Color(0xFF10B981)
                else androidx.compose.ui.graphics.Color(0xFFEF4444)
            )
        }
    }
}

@Composable
private fun ExpenseCard(entry: VaultEntry) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = NostiaSurface),
        shape = RoundedCornerShape(10.dp)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = entry.description,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = NostiaTextPrimary,
                    modifier = Modifier.weight(1f)
                )
                Text(
                    text = String.format(Locale.US, "$%.2f", entry.amount),
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = NostiaPrimary
                )
            }
            Text(
                text = "Paid by ${entry.paidBy?.name ?: entry.paidBy?.username ?: "Unknown"}",
                fontSize = 12.sp,
                color = NostiaTextSecondary
            )
            if (!entry.createdAt.isNullOrBlank()) {
                Text(text = entry.createdAt, fontSize = 11.sp, color = NostiaTextSecondary)
            }
        }
    }
}

@Composable
private fun AddExpenseDialog(
    apiService: ApiService,
    currentUserId: Int,
    tripId: Int,
    onDismiss: () -> Unit,
    onCreated: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var description by remember { mutableStateOf("") }
    var amount by remember { mutableStateOf("") }
    var currency by remember { mutableStateOf("USD") }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = NostiaPrimary,
        unfocusedBorderColor = NostiaBorder,
        focusedLabelColor = NostiaPrimary,
        unfocusedLabelColor = NostiaTextSecondary,
        focusedTextColor = NostiaTextPrimary,
        unfocusedTextColor = NostiaTextPrimary,
        cursorColor = NostiaPrimary
    )

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add Expense", color = NostiaTextPrimary, fontWeight = FontWeight.Bold) },
        text = {
            Column {
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Description *") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = fieldColors
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = amount,
                    onValueChange = { amount = it },
                    label = { Text("Amount *") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    colors = fieldColors
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = currency,
                    onValueChange = { currency = it },
                    label = { Text("Currency") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = fieldColors
                )
                if (errorMessage != null) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = errorMessage!!,
                        color = androidx.compose.ui.graphics.Color(0xFFEF4444),
                        fontSize = 13.sp
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "You will be recorded as payer. The full amount is split to you.",
                    fontSize = 11.sp,
                    color = NostiaTextSecondary
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val parsedAmount = amount.toDoubleOrNull()
                    when {
                        description.isBlank() -> errorMessage = "Description is required"
                        parsedAmount == null || parsedAmount <= 0 -> errorMessage = "Enter a valid amount"
                        else -> {
                            scope.launch {
                                isLoading = true
                                errorMessage = null
                                try {
                                    val response = apiService.createVaultEntry(
                                        CreateVaultEntryRequest(
                                            description = description.trim(),
                                            amount = parsedAmount,
                                            currency = currency.trim().ifBlank { "USD" },
                                            paidById = currentUserId,
                                            splits = listOf(SplitRequest(userId = currentUserId, amount = parsedAmount))
                                        )
                                    )
                                    if (response.isSuccessful) {
                                        onCreated()
                                    } else {
                                        errorMessage = "Failed to add expense (${response.code()})"
                                    }
                                } catch (e: Exception) {
                                    errorMessage = "Error: ${e.message}"
                                } finally {
                                    isLoading = false
                                }
                            }
                        }
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = NostiaPrimary),
                enabled = !isLoading
            ) {
                if (isLoading) CircularProgressIndicator(
                    color = NostiaTextPrimary,
                    strokeWidth = 2.dp,
                    modifier = Modifier.size(18.dp)
                )
                else Text("Add", color = NostiaTextPrimary)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel", color = NostiaTextSecondary) }
        },
        containerColor = NostiaSurface
    )
}
