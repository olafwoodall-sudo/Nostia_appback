import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useStripe } from '@stripe/stripe-react-native';
import { vaultAPI } from '../services/api';
import CreateExpenseModal from '../components/CreateExpenseModal';

// Mirror of server-side calculateChargedAmount (2.9% + $0.30 Stripe fee passed to payer)
const calculateChargedAmount = (owed: number): number =>
  Math.ceil(((owed + 0.30) / (1 - 0.029)) * 100) / 100;

export default function VaultScreen({ route }: any) {
  const { tripId, tripTitle } = route.params;
  const [vaultData, setVaultData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [payingId, setPayingId] = useState<number | null>(null);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  useEffect(() => {
    loadVaultData();
  }, []);

  const loadVaultData = async () => {
    try {
      setLoading(true);
      const data = await vaultAPI.getTripSummary(tripId);
      setVaultData(data);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to load vault data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadVaultData();
    setRefreshing(false);
  };

  const handleExpenseCreated = () => {
    setShowExpenseModal(false);
    loadVaultData();
  };

  const handleMarkPaid = async (splitId: number) => {
    Alert.alert(
      'Confirm Payment',
      'Confirm that this has been settled outside the app (cash, bank transfer, etc.)?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Settled',
          onPress: async () => {
            try {
              await vaultAPI.markSplitPaid(splitId);
              loadVaultData();
            } catch (error: any) {
              Alert.alert('Error', 'Failed to mark as paid');
            }
          },
        },
      ]
    );
  };

  const handlePayWithCard = async (split: any) => {
    setPayingId(split.id);
    try {
      const { clientSecret, chargedAmount } = await vaultAPI.createSplitPaymentIntent(split.id);

      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'Nostia',
        style: 'alwaysDark',
      });
      if (initError) {
        Alert.alert('Error', initError.message);
        return;
      }

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== 'Canceled') {
          Alert.alert('Payment Failed', presentError.message);
        }
        return;
      }

      Alert.alert(
        'Payment Submitted',
        `$${chargedAmount.toFixed(2)} paid (includes Stripe processing fee). Your split will be marked as paid shortly.`
      );
      loadVaultData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to process payment');
    } finally {
      setPayingId(null);
    }
  };

  const renderBalanceCard = ({ item }: { item: any }) => (
    <View style={styles.balanceCard}>
      <View style={styles.balanceAvatar}>
        <Text style={styles.balanceInitial}>{item.name?.charAt(0) || 'U'}</Text>
      </View>
      <View style={styles.balanceInfo}>
        <Text style={styles.balanceName}>{item.name}</Text>
        <View style={styles.balanceStats}>
          <Text style={styles.balanceLabel}>Paid: </Text>
          <Text style={styles.paidAmount}>${item.paid?.toFixed(2) || '0.00'}</Text>
          <Text style={styles.balanceLabel}> | Owes: </Text>
          <Text style={styles.owesAmount}>${item.owes?.toFixed(2) || '0.00'}</Text>
        </View>
      </View>
      <View style={styles.balanceBadge}>
        <Text
          style={[
            styles.balanceAmount,
            item.balance > 0 ? styles.positiveBalance : styles.negativeBalance,
          ]}
        >
          ${Math.abs(item.balance || 0).toFixed(2)}
        </Text>
        <Text style={styles.balanceStatus}>
          {item.balance > 0 ? 'to collect' : 'to pay'}
        </Text>
      </View>
    </View>
  );

  const renderExpenseCard = ({ item }: { item: any }) => (
    <View style={styles.expenseCard}>
      <View style={styles.expenseHeader}>
        <View style={styles.expenseIcon}>
          <Ionicons name="receipt-outline" size={24} color="#F59E0B" />
        </View>
        <View style={styles.expenseInfo}>
          <Text style={styles.expenseDescription}>{item.description}</Text>
          <Text style={styles.expenseDate}>
            {new Date(item.date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
        </View>
        <View style={styles.expenseAmount}>
          <Text style={styles.expenseTotalAmount}>${item.amount?.toFixed(2)}</Text>
          <Text style={styles.expenseCurrency}>{item.currency}</Text>
        </View>
      </View>

      <View style={styles.expenseMeta}>
        <Text style={styles.paidByText}>
          Paid by <Text style={styles.paidByName}>{item.paidByName}</Text>
        </Text>
        {item.category && (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{item.category}</Text>
          </View>
        )}
      </View>

      {item.splits && item.splits.length > 0 && (
        <View style={styles.splitsContainer}>
          <Text style={styles.splitsTitle}>Splits:</Text>
          {item.splits.map((split: any) => (
            <View key={split.id} style={styles.splitItem}>
              <Text style={styles.splitName}>{split.name}</Text>
              <Text style={styles.splitAmount}>${split.amount?.toFixed(2)}</Text>
              {!split.paid ? (
                <TouchableOpacity
                  style={styles.markPaidButton}
                  onPress={() => handleMarkPaid(split.id)}
                >
                  <Text style={styles.markPaidText}>Confirm Settled</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.paidBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={styles.paidText}>Paid</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3B82F6"
          />
        }
      >
        {/* Summary Card */}
        <LinearGradient
          colors={['#10B981', '#059669']}
          style={styles.summaryCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.summaryTitle}>{tripTitle}</Text>
          <Text style={styles.summaryLabel}>Total Expenses</Text>
          <Text style={styles.summaryAmount}>
            ${vaultData?.totalExpenses?.toFixed(2) || '0.00'}
          </Text>
          <Text style={styles.summaryCount}>
            {vaultData?.entryCount || 0} {vaultData?.entryCount === 1 ? 'entry' : 'entries'}
          </Text>
        </LinearGradient>

        {/* My Dues Section */}
        {vaultData?.unpaidSplits && vaultData.unpaidSplits.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Dues</Text>
            {vaultData.unpaidSplits.map((split: any) => {
              const charged = calculateChargedAmount(split.amount);
              const fee = (charged - split.amount).toFixed(2);
              return (
              <View key={split.id} style={styles.dueCard}>
                <View style={styles.dueInfo}>
                  <Text style={styles.dueDescription}>{split.description}</Text>
                  <Text style={styles.duePaidBy}>Owed to {split.paidByName}</Text>
                  <Text style={styles.dueFeeNote}>+${fee} processing fee</Text>
                </View>
                <View style={styles.dueRight}>
                  <Text style={styles.dueAmount}>${charged.toFixed(2)}</Text>
                  <Text style={styles.dueAmountSub}>you owe ${split.amount?.toFixed(2)}</Text>
                  <TouchableOpacity
                    style={[styles.payCardButton, payingId === split.id && styles.payCardButtonDisabled]}
                    onPress={() => handlePayWithCard(split)}
                    disabled={payingId !== null}
                  >
                    {payingId === split.id ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="card-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={styles.payCardText}>Pay with Card</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
              );
            })}
          </View>
        )}

        {/* Balances Section */}
        {vaultData?.balances && vaultData.balances.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Balances</Text>
            {vaultData.balances.map((balance: any, index: number) => (
              <View key={index}>
                {renderBalanceCard({ item: balance })}
              </View>
            ))}
          </View>
        )}

        {/* Expenses Section */}
        {vaultData?.entries && vaultData.entries.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Expenses</Text>
            {vaultData.entries.map((entry: any) => (
              <View key={entry.id}>
                {renderExpenseCard({ item: entry })}
              </View>
            ))}
          </View>
        )}

        {vaultData?.entries?.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="wallet-outline" size={64} color="#6B7280" />
            <Text style={styles.emptyText}>No expenses yet</Text>
            <Text style={styles.emptySubtext}>Add an expense to start tracking!</Text>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowExpenseModal(true)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#10B981', '#059669']}
          style={styles.fabGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="add" size={32} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>

      <CreateExpenseModal
        visible={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
        onExpenseCreated={handleExpenseCreated}
        tripId={tripId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
  },
  summaryCard: {
    margin: 16,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#D1FAE5',
    marginBottom: 8,
  },
  summaryAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  summaryCount: {
    fontSize: 14,
    color: '#D1FAE5',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  balanceCard: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  balanceAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  balanceInitial: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  balanceInfo: {
    flex: 1,
  },
  balanceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  balanceStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  balanceLabel: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  paidAmount: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
  owesAmount: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '600',
  },
  balanceBadge: {
    alignItems: 'flex-end',
  },
  balanceAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  positiveBalance: {
    color: '#10B981',
  },
  negativeBalance: {
    color: '#EF4444',
  },
  balanceStatus: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  expenseCard: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  expenseHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  expenseIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  expenseInfo: {
    flex: 1,
  },
  expenseDescription: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  expenseDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  expenseAmount: {
    alignItems: 'flex-end',
  },
  expenseTotalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  expenseCurrency: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  expenseMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  paidByText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  paidByName: {
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  categoryBadge: {
    backgroundColor: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    color: '#D1D5DB',
    textTransform: 'capitalize',
  },
  splitsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#374151',
    paddingTop: 12,
  },
  splitsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#9CA3AF',
    marginBottom: 8,
  },
  splitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  splitName: {
    flex: 1,
    fontSize: 14,
    color: '#D1D5DB',
  },
  splitAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
    marginRight: 12,
  },
  markPaidButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  markPaidText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  paidText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
  },
  dueCard: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  dueInfo: {
    flex: 1,
    marginRight: 12,
  },
  dueDescription: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  duePaidBy: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  dueRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  dueFeeNote: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 3,
  },
  dueAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  dueAmountSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: -4,
  },
  payCardButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 110,
    justifyContent: 'center',
  },
  payCardButtonDisabled: {
    opacity: 0.6,
  },
  payCardText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    borderRadius: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
