import { ms } from '../utils/scale';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { analyticsAPI } from '../services/api';

export default function AnalyticsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [dashboard, setDashboard] = useState<any>(null);
  const [heatmap, setHeatmap] = useState<any[]>([]);
  const [featureUsage, setFeatureUsage] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any>(null);
  const [funnels, setFunnels] = useState<any[]>([]);
  const [retention, setRetention] = useState<any[]>([]);

  const getDateRange = () => {
    const end = new Date().toISOString();
    const daysMap: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };
    const days = daysMap[range] || 30;
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    return { startDate: start, endDate: end };
  };

  const loadData = async () => {
    try {
      const params = getDateRange();
      const [dashData, heatData, featureData, sessionData, funnelData, retentionData] =
        await Promise.all([
          analyticsAPI.getDashboard(params).catch(() => null),
          analyticsAPI.getHeatmap(params).catch(() => []),
          analyticsAPI.getFeatureUsage(params).catch(() => []),
          analyticsAPI.getSessions(params).catch(() => null),
          analyticsAPI.getFunnels(params).catch(() => []),
          analyticsAPI.getRetention(params).catch(() => []),
        ]);

      setDashboard(dashData);
      setHeatmap(heatData);
      setFeatureUsage(featureData);
      setSessions(sessionData);
      setFunnels(funnelData);
      setRetention(retentionData);
    } catch (err) {
      console.error('Failed to load analytics', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [range]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleExportReport = async (reportType: string) => {
    try {
      const params = getDateRange();
      const result = await analyticsAPI.purchaseReport({
        reportType,
        ...params,
      });
      await Share.share({
        message: JSON.stringify(result.report, null, 2),
        title: `Nostia ${reportType} Report`,
      });
    } catch (err) {
      console.error('Failed to export report', err);
    }
  };

  const maxFeatureCount =
    featureUsage.length > 0
      ? Math.max(...featureUsage.map((f: any) => f.count || f.totalUsage || 0))
      : 1;

  const maxHeatmapCount =
    heatmap.length > 0
      ? Math.max(...heatmap.map((h: any) => h.eventCount || 0))
      : 1;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />
      }
    >
      {/* Range Selector */}
      <View style={styles.rangeSelector}>
        {(['7d', '30d', '90d'] as const).map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.rangeButton, range === r && styles.rangeButtonActive]}
            onPress={() => setRange(r)}
          >
            <Text style={[styles.rangeButtonText, range === r && styles.rangeButtonTextActive]}>
              {r}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Summary Cards */}
      {dashboard && (
        <View style={styles.summaryGrid}>
          <LinearGradient colors={['#3B82F6', '#2563EB']} style={styles.summaryCard}>
            <Ionicons name="people" size={20} color="#BFDBFE" />
            <Text style={styles.summaryValue}>{dashboard.totalUsers}</Text>
            <Text style={styles.summaryLabel}>Total Users</Text>
          </LinearGradient>
          <LinearGradient colors={['#10B981', '#059669']} style={styles.summaryCard}>
            <Ionicons name="pulse" size={20} color="#A7F3D0" />
            <Text style={styles.summaryValue}>{dashboard.activeUsers}</Text>
            <Text style={styles.summaryLabel}>Active Users</Text>
          </LinearGradient>
          <LinearGradient colors={['#8B5CF6', '#7C3AED']} style={styles.summaryCard}>
            <Ionicons name="trending-up" size={20} color="#DDD6FE" />
            <Text style={styles.summaryValue}>{dashboard.totalEvents}</Text>
            <Text style={styles.summaryLabel}>Total Events</Text>
          </LinearGradient>
          <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.summaryCard}>
            <Ionicons name="time" size={20} color="#FDE68A" />
            <Text style={styles.summaryValue}>
              {dashboard.avgSessionLengthSeconds
                ? `${Math.round(dashboard.avgSessionLengthSeconds / 60)}m`
                : 'N/A'}
            </Text>
            <Text style={styles.summaryLabel}>Avg Session</Text>
          </LinearGradient>
        </View>
      )}

      {/* Location Heatmap */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="location" size={18} color="#EF4444" />
            <Text style={styles.cardTitle}>Location Heatmap</Text>
          </View>
          <TouchableOpacity onPress={() => handleExportReport('daily_region')}>
            <Ionicons name="download-outline" size={18} color="#3B82F6" />
          </TouchableOpacity>
        </View>
        {heatmap.length === 0 ? (
          <Text style={styles.emptyText}>No location data yet</Text>
        ) : (
          heatmap.slice(0, 10).map((region: any, i: number) => (
            <View key={i} style={styles.barRow}>
              <Text style={styles.barLabel} numberOfLines={1}>
                {region.regionBucket}
              </Text>
              <View style={styles.barTrack}>
                <LinearGradient
                  colors={['#F59E0B', '#EF4444']}
                  style={[
                    styles.barFill,
                    { width: `${((region.eventCount || 0) / maxHeatmapCount) * 100}%` as any },
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
              </View>
              <Text style={styles.barValue}>{region.eventCount || 0}</Text>
            </View>
          ))
        )}
      </View>

      {/* Feature Usage */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="trending-up" size={18} color="#10B981" />
            <Text style={styles.cardTitle}>Feature Usage</Text>
          </View>
          <TouchableOpacity onPress={() => handleExportReport('feature_usage')}>
            <Ionicons name="download-outline" size={18} color="#3B82F6" />
          </TouchableOpacity>
        </View>
        {featureUsage.length === 0 ? (
          <Text style={styles.emptyText}>No feature usage data yet</Text>
        ) : (
          featureUsage.slice(0, 10).map((feature: any, i: number) => {
            const count = feature.count || feature.totalUsage || 0;
            return (
              <View key={i} style={styles.barRow}>
                <Text style={styles.barLabel} numberOfLines={1}>
                  {feature.eventName || feature.featureName}
                </Text>
                <View style={styles.barTrack}>
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    style={[
                      styles.barFill,
                      { width: `${(count / maxFeatureCount) * 100}%` as any },
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  />
                </View>
                <Text style={styles.barValue}>{count}</Text>
              </View>
            );
          })
        )}
      </View>

      {/* Session Metrics */}
      {sessions && (
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="time" size={18} color="#F59E0B" />
            <Text style={styles.cardTitle}>Session Metrics</Text>
          </View>
          <View style={styles.sessionGrid}>
            <View style={styles.sessionStat}>
              <Text style={styles.sessionStatValue}>{sessions.totalSessions || 0}</Text>
              <Text style={styles.sessionStatLabel}>Sessions</Text>
            </View>
            <View style={styles.sessionStat}>
              <Text style={styles.sessionStatValue}>
                {sessions.avgDurationSeconds
                  ? `${Math.round(sessions.avgDurationSeconds / 60)}m`
                  : 'N/A'}
              </Text>
              <Text style={styles.sessionStatLabel}>Avg Length</Text>
            </View>
            <View style={styles.sessionStat}>
              <Text style={styles.sessionStatValue}>
                {sessions.avgEventsPerSession
                  ? Math.round(sessions.avgEventsPerSession)
                  : 0}
              </Text>
              <Text style={styles.sessionStatLabel}>Events/Session</Text>
            </View>
          </View>

          {sessions.byPlatform && sessions.byPlatform.length > 0 && (
            <View style={styles.platformRow}>
              <Text style={styles.platformLabel}>By Platform</Text>
              <View style={styles.platformBadges}>
                {sessions.byPlatform.map((p: any, i: number) => (
                  <View key={i} style={styles.platformBadge}>
                    <Text style={styles.platformName}>{p.platform}</Text>
                    <Text style={styles.platformCount}>{p.sessions}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {/* Conversion Funnel */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Conversion Funnel</Text>
          <TouchableOpacity onPress={() => handleExportReport('funnel')}>
            <Ionicons name="download-outline" size={18} color="#3B82F6" />
          </TouchableOpacity>
        </View>
        {funnels.length === 0 ? (
          <Text style={styles.emptyText}>No funnel data yet</Text>
        ) : (
          funnels.map((step: any, i: number) => {
            const maxCount = funnels[0]?.count || 1;
            const pct = maxCount > 0 ? ((step.count / maxCount) * 100).toFixed(1) : '0';
            return (
              <View key={i} style={styles.funnelStep}>
                <View style={styles.funnelStepHeader}>
                  <Text style={styles.funnelStepName}>
                    {(step.step || step.metricName || '').replace(/_/g, ' ')}
                  </Text>
                  <Text style={styles.funnelStepValue}>
                    {step.count} ({pct}%)
                  </Text>
                </View>
                <View style={styles.funnelBarTrack}>
                  <LinearGradient
                    colors={['#3B82F6', '#8B5CF6']}
                    style={[styles.barFill, { width: `${pct}%` as any }]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  />
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Retention Cohorts */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Retention Cohorts</Text>
          <TouchableOpacity onPress={() => handleExportReport('retention')}>
            <Ionicons name="download-outline" size={18} color="#3B82F6" />
          </TouchableOpacity>
        </View>
        {retention.length === 0 ? (
          <Text style={styles.emptyText}>No retention data yet</Text>
        ) : (
          <View style={styles.retentionTable}>
            <View style={styles.retentionHeader}>
              <Text style={[styles.retentionCell, styles.retentionHeaderText, { flex: 2 }]}>
                Metric
              </Text>
              <Text style={[styles.retentionCell, styles.retentionHeaderText]}>Rate</Text>
              <Text style={[styles.retentionCell, styles.retentionHeaderText]}>Cohort</Text>
            </View>
            {retention.slice(0, 12).map((row: any, i: number) => {
              let meta: any = {};
              try {
                meta = row.metadata ? JSON.parse(row.metadata) : {};
              } catch {}
              return (
                <View key={i} style={styles.retentionRow}>
                  <Text style={[styles.retentionCell, { flex: 2, color: '#D1D5DB' }]}>
                    {(row.metricName || '').replace(/_/g, ' ')}
                  </Text>
                  <Text style={[styles.retentionCell, { color: '#FFFFFF' }]}>
                    {(row.retentionRate || row.metricValue || 0).toFixed(1)}%
                  </Text>
                  <Text style={[styles.retentionCell, { color: '#9CA3AF' }]}>
                    {meta.cohortWeek || '-'} ({row.cohortSize || row.sampleSize || 0})
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
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
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  rangeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  rangeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1F2937',
  },
  rangeButtonActive: {
    backgroundColor: '#3B82F6',
  },
  rangeButtonText: {
    fontSize: ms(13),
    fontWeight: '600',
    color: '#9CA3AF',
  },
  rangeButtonTextActive: {
    color: '#FFFFFF',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    width: '47%' as any,
    borderRadius: 12,
    padding: 16,
  },
  summaryValue: {
    fontSize: ms(24),
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: ms(12),
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: ms(16),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyText: {
    fontSize: ms(13),
    color: '#6B7280',
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  barLabel: {
    fontSize: ms(11),
    color: '#9CA3AF',
    width: 90,
  },
  barTrack: {
    flex: 1,
    height: 14,
    backgroundColor: '#374151',
    borderRadius: 7,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 7,
    minWidth: 4,
  },
  barValue: {
    fontSize: ms(11),
    color: '#9CA3AF',
    width: 40,
    textAlign: 'right',
  },
  sessionGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  sessionStat: {
    flex: 1,
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  sessionStatValue: {
    fontSize: ms(18),
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  sessionStatLabel: {
    fontSize: ms(11),
    color: '#9CA3AF',
    marginTop: 4,
  },
  platformRow: {
    marginTop: 12,
  },
  platformLabel: {
    fontSize: ms(11),
    color: '#6B7280',
    marginBottom: 6,
  },
  platformBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#374151',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  platformName: {
    fontSize: ms(12),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  platformCount: {
    fontSize: ms(12),
    color: '#9CA3AF',
  },
  funnelStep: {
    marginBottom: 10,
  },
  funnelStepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  funnelStepName: {
    fontSize: ms(12),
    color: '#9CA3AF',
    textTransform: 'capitalize',
  },
  funnelStepValue: {
    fontSize: ms(12),
    color: '#FFFFFF',
    fontWeight: '600',
  },
  funnelBarTrack: {
    height: 10,
    backgroundColor: '#374151',
    borderRadius: 5,
    overflow: 'hidden',
  },
  retentionTable: {
    marginTop: 4,
  },
  retentionHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  retentionHeaderText: {
    fontSize: ms(12),
    fontWeight: '600',
    color: '#9CA3AF',
  },
  retentionRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  retentionCell: {
    flex: 1,
    fontSize: ms(12),
  },
});
