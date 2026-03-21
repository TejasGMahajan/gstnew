import { supabase } from '@/lib/supabase/client';
import { logError } from './errorLogger';

/**
 * WhatsApp messaging service framework.
 *
 * In production, integrate with:
 *  - Twilio WhatsApp API: https://www.twilio.com/whatsapp
 *  - Meta Cloud API: https://developers.facebook.com/docs/whatsapp/cloud-api
 *
 * This module handles:
 *  1. Message queue management (whatsapp_logs table)
 *  2. Credit deduction before send
 *  3. Template-based messaging
 *  4. Delivery status tracking
 */

export type WhatsAppMessageType =
  | 'deadline_reminder'
  | 'document_request'
  | 'approval_notification'
  | 'overdue_alert'
  | 'welcome'
  | 'custom';

interface SendMessageOptions {
  businessId: string;
  userId?: string;
  phoneNumber: string;
  messageType: WhatsAppMessageType;
  messageContent: string;
  templateId?: string;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Queue and send a WhatsApp message.
 * Checks credits before sending, deducts on success.
 */
export async function sendWhatsAppMessage(options: SendMessageOptions): Promise<SendResult> {
  const { businessId, userId, phoneNumber, messageType, messageContent, templateId } = options;

  try {
    // 1. Check credits
    const { data: creditCheck } = await supabase.rpc('check_whatsapp_limit', {
      p_business_id: businessId,
    });

    if (creditCheck && !creditCheck.allowed) {
      return { success: false, error: creditCheck.message || 'No WhatsApp credits remaining' };
    }

    // 2. Create log entry with 'queued' status
    const { data: logEntry, error: logError } = await supabase
      .from('whatsapp_logs')
      .insert({
        business_id: businessId,
        user_id: userId || null,
        phone_number: phoneNumber,
        message_type: messageType,
        message_content: messageContent,
        template_id: templateId || null,
        status: 'queued',
      })
      .select()
      .single();

    if (logError) throw logError;

    // 3. Send via provider (placeholder — replace with actual API call)
    const externalResult = await sendViaProvider(phoneNumber, messageContent, templateId);

    // 4. Update log with result
    if (externalResult.success) {
      await supabase
        .from('whatsapp_logs')
        .update({
          status: 'sent',
          external_message_id: externalResult.messageId,
          sent_at: new Date().toISOString(),
        })
        .eq('id', logEntry.id);

      // 5. Deduct credit
      await supabase.rpc('deduct_whatsapp_credit', { p_business_id: businessId });
    } else {
      await supabase
        .from('whatsapp_logs')
        .update({
          status: 'failed',
          error_message: externalResult.error,
        })
        .eq('id', logEntry.id);
    }

    return externalResult;
  } catch (err: unknown) {
    await logError('whatsapp_send', err, { businessId, messageType });
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Placeholder for actual WhatsApp provider integration.
 * Replace with Twilio or Meta API call.
 */
async function sendViaProvider(
  phoneNumber: string,
  messageContent: string,
  templateId?: string
): Promise<SendResult> {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TWILIO INTEGRATION (uncomment when ready):
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //
  // const accountSid = process.env.TWILIO_ACCOUNT_SID;
  // const authToken = process.env.TWILIO_AUTH_TOKEN;
  // const fromNumber = process.env.TWILIO_WHATSAPP_FROM;
  //
  // const response = await fetch(
  //   `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
  //   {
  //     method: 'POST',
  //     headers: {
  //       'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
  //       'Content-Type': 'application/x-www-form-urlencoded',
  //     },
  //     body: new URLSearchParams({
  //       From: `whatsapp:${fromNumber}`,
  //       To: `whatsapp:${phoneNumber}`,
  //       Body: messageContent,
  //     }),
  //   }
  // );
  //
  // const data = await response.json();
  // return { success: response.ok, messageId: data.sid, error: data.message };
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // Development mode: simulate success
  console.log(`[WhatsApp] Would send to ${phoneNumber}: ${messageContent}`);
  return {
    success: true,
    messageId: `dev_${Date.now()}`,
  };
}

/**
 * Pre-built message templates for common compliance notifications.
 */
export const MESSAGE_TEMPLATES = {
  deadline_reminder: (taskName: string, dueDate: string) =>
    `⚠️ Compliance Reminder: "${taskName}" is due on ${dueDate}. Please upload required documents or contact your CA.`,

  document_request: (taskName: string, caName: string) =>
    `📄 Document Request from ${caName}: Please upload documents for "${taskName}" on ComplianceOS.`,

  approval_notification: (taskName: string) =>
    `✅ "${taskName}" has been reviewed by your CA and is ready for filing. Please review and approve.`,

  overdue_alert: (taskName: string, dueDate: string) =>
    `🚨 OVERDUE: "${taskName}" was due on ${dueDate}. Immediate action required to avoid penalties.`,

  welcome: (businessName: string) =>
    `Welcome to ComplianceOS, ${businessName}! Your GST compliance journey starts here. 🚀`,
};
