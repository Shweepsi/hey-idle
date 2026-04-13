/**
 * Secure logging utility
 * Only logs to console in development mode
 * In production, only critical errors are logged
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: string;
}

class Logger {
  private isDevelopment = import.meta.env.DEV;

  private createLogEntry(
    level: LogLevel,
    message: string,
    data?: any
  ): LogEntry {
    return {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  private shouldLog(level: LogLevel): boolean {
    if (this.isDevelopment) {
      return true; // Log everything in development
    }

    // In production, only log warnings and errors
    return level === 'warn' || level === 'error';
  }

  debug(message: string, data?: any): void {
    if (this.shouldLog('debug')) {
      const entry = this.createLogEntry('debug', message, data);
      console.log(`🐛 [DEBUG] ${entry.message}`, entry.data || '');
    }
  }

  info(message: string, data?: any): void {
    if (this.shouldLog('info')) {
      const entry = this.createLogEntry('info', message, data);
      console.log(`ℹ️ [INFO] ${entry.message}`, entry.data || '');
    }
  }

  warn(message: string, data?: any): void {
    if (this.shouldLog('warn')) {
      const entry = this.createLogEntry('warn', message, data);
      console.warn(`⚠️ [WARN] ${entry.message}`, entry.data || '');
    }
  }

  error(message: string, data?: any): void {
    if (this.shouldLog('error')) {
      const entry = this.createLogEntry('error', message, data);
      console.error(`❌ [ERROR] ${entry.message}`, entry.data || '');

      // In production, could send to external monitoring service
      // this.sendToMonitoring(entry);
    }
  }

  // Security event logging for monitoring
  security(event: string, data?: any): void {
    const entry = this.createLogEntry('error', `SECURITY: ${event}`, data);
    console.error(`🚨 [SECURITY] ${entry.message}`, entry.data || '');

    // Always log security events regardless of environment
    // this.sendToSecurityMonitoring(entry);
  }

  // Private method for future monitoring integration
  // private sendToMonitoring(entry: LogEntry): void {
  //   // Send to external monitoring service like Sentry, LogRocket, etc.
  // }

  // private sendToSecurityMonitoring(entry: LogEntry): void {
  //   // Send security events to security monitoring
  // }
}

export const logger = new Logger();
