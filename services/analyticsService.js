const db = require('../database/db');

class AnalyticsService {
  // Round GPS to ~11km grid (0.1 degree) for anonymization
  static bucketRegion(latitude, longitude) {
    if (latitude == null || longitude == null) return null;
    const bucketLat = (Math.round(latitude * 10) / 10).toFixed(1);
    const bucketLng = (Math.round(longitude * 10) / 10).toFixed(1);
    return `grid:${bucketLat},${bucketLng}`;
  }

  // Strip PII from an event object
  static anonymizeEvent(event) {
    const { userId, latitude, longitude, ...anonymized } = event;
    return anonymized;
  }

  // Run aggregation for a specific report type and time window
  static runAggregation(reportType, startDate, endDate) {
    const AnalyticsAggregate = require('../models/AnalyticsAggregate');

    switch (reportType) {
      case 'daily_region':
        return this._aggregateDailyRegion(startDate, endDate);
      case 'feature_usage':
        return this._aggregateFeatureUsage(startDate, endDate);
      case 'retention':
        return this._aggregateRetention(startDate, endDate);
      case 'funnel':
        return this._aggregateFunnel(startDate, endDate);
      default:
        throw new Error(`Unknown report type: ${reportType}`);
    }
  }

  static _aggregateDailyRegion(startDate, endDate) {
    const AnalyticsAggregate = require('../models/AnalyticsAggregate');

    const rows = db.prepare(`
      SELECT
        DATE(createdAt) as date,
        regionBucket,
        COUNT(*) as eventCount,
        COUNT(DISTINCT userId) as uniqueUsers
      FROM analytics_events
      WHERE regionBucket IS NOT NULL AND createdAt BETWEEN ? AND ?
      GROUP BY DATE(createdAt), regionBucket
    `).all(startDate, endDate);

    const stored = [];
    for (const row of rows) {
      stored.push(AnalyticsAggregate.store({
        reportType: 'daily_region',
        periodStart: row.date,
        periodEnd: row.date,
        regionBucket: row.regionBucket,
        metricName: 'active_users',
        metricValue: row.uniqueUsers,
        sampleSize: row.eventCount
      }));
      stored.push(AnalyticsAggregate.store({
        reportType: 'daily_region',
        periodStart: row.date,
        periodEnd: row.date,
        regionBucket: row.regionBucket,
        metricName: 'event_count',
        metricValue: row.eventCount,
        sampleSize: row.eventCount
      }));
    }
    return stored;
  }

  static _aggregateFeatureUsage(startDate, endDate) {
    const AnalyticsAggregate = require('../models/AnalyticsAggregate');

    const rows = db.prepare(`
      SELECT
        eventName,
        COUNT(*) as count,
        COUNT(DISTINCT userId) as uniqueUsers
      FROM analytics_events
      WHERE eventType = 'feature_click' AND createdAt BETWEEN ? AND ?
      GROUP BY eventName
      ORDER BY count DESC
    `).all(startDate, endDate);

    const stored = [];
    for (const row of rows) {
      stored.push(AnalyticsAggregate.store({
        reportType: 'feature_usage',
        periodStart: startDate,
        periodEnd: endDate,
        metricName: row.eventName,
        metricValue: row.count,
        sampleSize: row.uniqueUsers,
        metadata: JSON.stringify({ uniqueUsers: row.uniqueUsers })
      }));
    }
    return stored;
  }

  static _aggregateRetention(startDate, endDate) {
    const AnalyticsAggregate = require('../models/AnalyticsAggregate');

    // Cohort-based: users registered in each week, % active in subsequent weeks
    const cohorts = db.prepare(`
      SELECT
        strftime('%Y-W%W', u.createdAt) as cohortWeek,
        COUNT(DISTINCT u.id) as cohortSize
      FROM users u
      WHERE u.createdAt BETWEEN ? AND ?
      GROUP BY strftime('%Y-W%W', u.createdAt)
    `).all(startDate, endDate);

    const MIN_COHORT_SIZE = 5; // Suppress cohorts smaller than this to prevent re-identification
    const stored = [];
    for (const cohort of cohorts) {
      if (cohort.cohortSize < MIN_COHORT_SIZE) continue;

      // Check activity in subsequent weeks (up to 4 weeks)
      for (let weekOffset = 1; weekOffset <= 4; weekOffset++) {
        const activeCount = db.prepare(`
          SELECT COUNT(DISTINCT ae.userId) as activeUsers
          FROM analytics_events ae
          INNER JOIN users u ON ae.userId = u.id
          WHERE strftime('%Y-W%W', u.createdAt) = ?
            AND ae.createdAt >= datetime(u.createdAt, '+' || ? || ' days')
            AND ae.createdAt < datetime(u.createdAt, '+' || ? || ' days')
        `).get(cohort.cohortWeek, weekOffset * 7, (weekOffset + 1) * 7);

        const retentionRate = cohort.cohortSize > 0
          ? (activeCount.activeUsers / cohort.cohortSize) * 100
          : 0;

        stored.push(AnalyticsAggregate.store({
          reportType: 'retention',
          periodStart: startDate,
          periodEnd: endDate,
          metricName: `week_${weekOffset}_retention`,
          metricValue: retentionRate,
          sampleSize: cohort.cohortSize,
          metadata: JSON.stringify({
            cohortWeek: cohort.cohortWeek,
            cohortSize: cohort.cohortSize,
            activeUsers: activeCount.activeUsers
          })
        }));
      }
    }
    return stored;
  }

  static _aggregateFunnel(startDate, endDate) {
    const AnalyticsAggregate = require('../models/AnalyticsAggregate');

    // Funnel: registered -> first_trip -> first_friend -> first_payment
    const funnelSteps = [
      { name: 'registered', query: `SELECT COUNT(DISTINCT id) as count FROM users WHERE createdAt BETWEEN ? AND ?` },
      { name: 'first_trip', query: `SELECT COUNT(DISTINCT createdBy) as count FROM trips WHERE createdAt BETWEEN ? AND ?` },
      { name: 'first_friend', query: `SELECT COUNT(DISTINCT userId) as count FROM friends WHERE status = 'accepted' AND createdAt BETWEEN ? AND ?` },
      { name: 'first_payment', query: `SELECT COUNT(DISTINCT payerUserId) as count FROM vault_transactions WHERE status = 'succeeded' AND createdAt BETWEEN ? AND ?` }
    ];

    const stored = [];
    for (const step of funnelSteps) {
      const result = db.prepare(step.query).get(startDate, endDate);
      stored.push(AnalyticsAggregate.store({
        reportType: 'funnel',
        periodStart: startDate,
        periodEnd: endDate,
        metricName: step.name,
        metricValue: result.count,
        sampleSize: result.count
      }));
    }
    return stored;
  }

  // Purge raw data beyond retention period
  static purgeExpiredData(retentionDays) {
    const AnalyticsEvent = require('../models/AnalyticsEvent');
    retentionDays = retentionDays || parseInt(process.env.DATA_RETENTION_DAYS) || 90;
    return AnalyticsEvent.purgeOldRawData(retentionDays);
  }

  // Generate dashboard summary
  static getDashboardSummary(startDate, endDate) {
    const totalUsers = db.prepare(`SELECT COUNT(*) as count FROM users`).get().count;

    const activeUsers = db.prepare(`
      SELECT COUNT(DISTINCT userId) as count FROM analytics_sessions
      WHERE startedAt BETWEEN ? AND ?
    `).get(startDate, endDate).count;

    const totalEvents = db.prepare(`
      SELECT COUNT(*) as count FROM analytics_events
      WHERE createdAt BETWEEN ? AND ?
    `).get(startDate, endDate).count;

    const totalSessions = db.prepare(`
      SELECT COUNT(*) as count FROM analytics_sessions
      WHERE startedAt BETWEEN ? AND ?
    `).get(startDate, endDate).count;

    const topRegion = db.prepare(`
      SELECT regionBucket, COUNT(*) as count
      FROM analytics_events
      WHERE regionBucket IS NOT NULL AND createdAt BETWEEN ? AND ?
      GROUP BY regionBucket
      ORDER BY count DESC
      LIMIT 1
    `).get(startDate, endDate);

    const avgSessionLength = db.prepare(`
      SELECT AVG(durationSeconds) as avg
      FROM analytics_sessions
      WHERE startedAt BETWEEN ? AND ? AND durationSeconds IS NOT NULL
    `).get(startDate, endDate);

    return {
      totalUsers,
      activeUsers,
      totalEvents,
      totalSessions,
      topRegion: topRegion ? topRegion.regionBucket : null,
      topRegionCount: topRegion ? topRegion.count : 0,
      avgSessionLengthSeconds: avgSessionLength ? Math.round(avgSessionLength.avg || 0) : 0
    };
  }

  // Generate downloadable report as JSON
  static generateDownloadableReport(reportType, startDate, endDate) {
    const AnalyticsAggregate = require('../models/AnalyticsAggregate');

    const data = AnalyticsAggregate.getByType(reportType, startDate, endDate);

    return {
      reportType,
      periodStart: startDate,
      periodEnd: endDate,
      generatedAt: new Date().toISOString(),
      dataPoints: data.length,
      data
    };
  }
}

module.exports = AnalyticsService;
