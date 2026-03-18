import { supabase } from '@/lib/supabase/client';

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

interface ErrorLogEntry {
  action: string;
  error_message: string;
  error_stack?: string;
  severity?: ErrorSeverity;
  metadata?: Record<string, any>;
}

/**
 * Central error logger — captures errors to both console and Supabase error_logs table.
 */
export async function logError(
  action: string,
  error: unknown,
  metadata?: Record<string, any>,
  severity: ErrorSeverity = 'error'
) {
  const errorMessage =
    error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  // Always log to console
  console.error(`[${severity.toUpperCase()}] ${action}:`, error);

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from('error_logs').insert({
      user_id: user?.id || null,
      action,
      error_message: errorMessage,
      error_stack: errorStack || null,
      severity,
      metadata: {
        ...metadata,
        url: typeof window !== 'undefined' ? window.location.href : null,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (logErr) {
    // Fail silently — don't let the logger cause more errors
    console.error('[ErrorLogger] Failed to write error log:', logErr);
  }
}

/**
 * Wrapper for common async operations — catches errors and logs them.
 */
export async function withErrorLogging<T>(
  action: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    await logError(action, error, metadata);
    return null;
  }
}
