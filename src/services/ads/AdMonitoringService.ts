interface AdMetrics {
  totalAttempts: number;
  successfulAds: number;
  failedAds: number;
  errorsByType: Record<string, number>;
  averageLoadTime: number;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  sessionStartTime: number;
}

interface AdPerformanceAlert {
  type: 'HIGH_FAILURE_RATE' | 'UNKNOWN_ERROR_SPIKE' | 'NO_SUCCESS_PERIOD';
  message: string;
  timestamp: number;
  severity: 'warning' | 'critical';
  data?: any;
}

export class AdMonitoringService {
  private static readonly HIGH_FAILURE_THRESHOLD = 0.7; // 70% failure rate
  private static readonly NO_SUCCESS_PERIOD_THRESHOLD = 30 * 60 * 1000; // 30 minutes
  private static readonly UNKNOWN_ERROR_SPIKE_THRESHOLD = 5;

  private static metrics: AdMetrics = {
    totalAttempts: 0,
    successfulAds: 0,
    failedAds: 0,
    errorsByType: {},
    averageLoadTime: 0,
    lastSuccessAt: null,
    lastFailureAt: null,
    sessionStartTime: Date.now(),
  };

  private static alerts: AdPerformanceAlert[] = [];
  private static loadStartTime: number | null = null;

  static startAdLoad(): void {
    this.loadStartTime = Date.now();
  }

  static recordAdSuccess(): void {
    const loadTime = this.loadStartTime ? Date.now() - this.loadStartTime : 0;

    this.metrics.totalAttempts++;
    this.metrics.successfulAds++;
    this.metrics.lastSuccessAt = Date.now();

    // Update average load time
    this.updateAverageLoadTime(loadTime);

    this.loadStartTime = null;

    console.log('[AdMonitoring] ✅ Succès enregistré', {
      loadTime,
      successRate: this.getSuccessRate(),
      totalAttempts: this.metrics.totalAttempts,
    });
  }

  static recordAdFailure(errorCode: string, errorMessage?: string): void {
    this.metrics.totalAttempts++;
    this.metrics.failedAds++;
    this.metrics.lastFailureAt = Date.now();
    this.metrics.errorsByType[errorCode] =
      (this.metrics.errorsByType[errorCode] || 0) + 1;

    this.loadStartTime = null;

    // Check for alerts
    this.checkForAlerts(errorCode);

    console.log('[AdMonitoring] ❌ Échec enregistré', {
      errorCode,
      errorMessage,
      successRate: this.getSuccessRate(),
      totalAttempts: this.metrics.totalAttempts,
      errorsByType: this.metrics.errorsByType,
    });
  }

  private static updateAverageLoadTime(newLoadTime: number): void {
    if (this.metrics.successfulAds === 1) {
      this.metrics.averageLoadTime = newLoadTime;
    } else {
      // Running average
      this.metrics.averageLoadTime =
        (this.metrics.averageLoadTime * (this.metrics.successfulAds - 1) +
          newLoadTime) /
        this.metrics.successfulAds;
    }
  }

  private static checkForAlerts(errorCode: string): void {
    const now = Date.now();

    // High failure rate alert
    const successRate = this.getSuccessRate();
    if (
      this.metrics.totalAttempts >= 5 &&
      successRate < 1 - this.HIGH_FAILURE_THRESHOLD
    ) {
      this.addAlert({
        type: 'HIGH_FAILURE_RATE',
        message: `Taux d'échec élevé: ${Math.round((1 - successRate) * 100)}%`,
        timestamp: now,
        severity: 'critical',
        data: { successRate, totalAttempts: this.metrics.totalAttempts },
      });
    }

    // Unknown error spike alert
    const unknownErrors = this.metrics.errorsByType['UNKNOWN'] || 0;
    if (unknownErrors >= this.UNKNOWN_ERROR_SPIKE_THRESHOLD) {
      this.addAlert({
        type: 'UNKNOWN_ERROR_SPIKE',
        message: `Pic d'erreurs UNKNOWN: ${unknownErrors} erreurs`,
        timestamp: now,
        severity: 'critical',
        data: { unknownErrors, errorCode },
      });
    }

    // No success period alert
    if (
      this.metrics.lastSuccessAt &&
      now - this.metrics.lastSuccessAt > this.NO_SUCCESS_PERIOD_THRESHOLD
    ) {
      this.addAlert({
        type: 'NO_SUCCESS_PERIOD',
        message: `Aucun succès depuis ${Math.round((now - this.metrics.lastSuccessAt) / 60000)} minutes`,
        timestamp: now,
        severity: 'warning',
        data: { lastSuccessAt: this.metrics.lastSuccessAt },
      });
    }
  }

  private static addAlert(alert: AdPerformanceAlert): void {
    // Avoid duplicate alerts of the same type within 5 minutes
    const recentAlert = this.alerts.find(
      (a) =>
        a.type === alert.type && alert.timestamp - a.timestamp < 5 * 60 * 1000
    );

    if (!recentAlert) {
      this.alerts.push(alert);
      console.warn(
        `[AdMonitoring] 🚨 ${alert.severity.toUpperCase()} ALERT:`,
        alert.message,
        alert.data
      );

      // Keep only last 10 alerts
      if (this.alerts.length > 10) {
        this.alerts = this.alerts.slice(-10);
      }
    }
  }

  static getSuccessRate(): number {
    return this.metrics.totalAttempts > 0
      ? this.metrics.successfulAds / this.metrics.totalAttempts
      : 0;
  }

  static getMetrics(): AdMetrics & { successRate: number } {
    return {
      ...this.metrics,
      successRate: this.getSuccessRate(),
    };
  }

  static getAlerts(): AdPerformanceAlert[] {
    return [...this.alerts];
  }

  static getActiveAlerts(): AdPerformanceAlert[] {
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    return this.alerts.filter((alert) => alert.timestamp > fiveMinutesAgo);
  }

  static clearAlerts(): void {
    this.alerts = [];
    console.log('[AdMonitoring] 🧹 Alertes supprimées');
  }

  static resetMetrics(): void {
    this.metrics = {
      totalAttempts: 0,
      successfulAds: 0,
      failedAds: 0,
      errorsByType: {},
      averageLoadTime: 0,
      lastSuccessAt: null,
      lastFailureAt: null,
      sessionStartTime: Date.now(),
    };
    this.alerts = [];
    console.log('[AdMonitoring] 🔄 Métriques réinitialisées');
  }

  static getSessionDuration(): number {
    return Date.now() - this.metrics.sessionStartTime;
  }

  static exportDiagnostics(): any {
    return {
      metrics: this.getMetrics(),
      alerts: this.getAlerts(),
      activeAlerts: this.getActiveAlerts(),
      sessionDuration: this.getSessionDuration(),
      thresholds: {
        highFailureThreshold: this.HIGH_FAILURE_THRESHOLD,
        noSuccessPeriodThreshold: this.NO_SUCCESS_PERIOD_THRESHOLD,
        unknownErrorSpikeThreshold: this.UNKNOWN_ERROR_SPIKE_THRESHOLD,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
