import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { checkFeatureAccess } from '@/lib/featureGate';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// ─── Constants ────────────────────────────────────────────────────────────────

const GUPSHUP_API_URL = 'https://api.gupshup.io/sm/api/v1/msg';

// These message types bypass the feature/plan check — always send
const ALWAYS_SEND = new Set(['payment_success', 'ca_invite']);

// ─── Validation ───────────────────────────────────────────────────────────────

const RequestSchema = z.object({
  recipientPhone: z
    .string()
    .min(10)
    .max(15)
    .regex(/^\+?[0-9]+$/, 'Phone must contain only digits and an optional leading +'),
  messageType: z.enum([
    'deadline_reminder',
    'document_request',
    'task_complete',
    'payment_success',
    'ca_invite',
  ]),
  data: z.record(z.any()),
  /** Required for plan-gated types; optional for payment_success / ca_invite */
  businessId: z.string().uuid().optional(),
});

type RequestBody = z.infer<typeof RequestSchema>;

// ─── Message builder ──────────────────────────────────────────────────────────

function buildMessage(messageType: string, data: Record<string, string>): string {
  const appLink = data.appLink ?? process.env.NEXT_PUBLIC_APP_URL ?? '';

  switch (messageType) {
    case 'deadline_reminder':
      return (
        `Hi ${data.businessName}, your ${data.taskName} is due on ${data.dueDate}. ` +
        `Please login to upload documents: ${appLink}`
      );

    case 'document_request':
      return (
        `Hi ${data.businessName}, your CA ${data.caName} needs: ${data.docList}. ` +
        `Upload at: ${appLink}`
      );

    case 'task_complete':
      return `Your ${data.taskName} has been marked complete by your CA.`;

    case 'payment_success':
      return `Payment confirmed! Your Pro Plan is active until ${data.validUntil}.`;

    case 'ca_invite':
      return (
        `Your CA ${data.caName} has invited you to ComplianceHub. ` +
        `Join at: ${data.signupLink}`
      );

    default:
      return '';
  }
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function authenticate(
  request: NextRequest,
): Promise<{ userId: string; userType: string } | null> {
  const authHeader = request.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const {
    data: { user },
    error,
  } = await client.auth.getUser(token);
  if (error || !user) return null;

  const { data: profile } = await client
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single();

  if (!profile) return null;
  return { userId: user.id, userType: profile.user_type as string };
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. Auth — only CAs and admins can trigger notifications
  const caller = await authenticate(request);
  if (!caller) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!['chartered_accountant', 'admin'].includes(caller.userType)) {
    return NextResponse.json(
      { success: false, error: 'Only CAs and admins can send notifications' },
      { status: 403 },
    );
  }

  // 2. Parse + validate body
  let body: RequestBody;
  try {
    body = RequestSchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', issues: err.issues },
        { status: 400 },
      );
    }
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { recipientPhone, messageType, data, businessId } = body;

  // 3. Feature gate (skip for always-send types)
  const skipGate = ALWAYS_SEND.has(messageType);

  if (!skipGate) {
    if (!businessId) {
      return NextResponse.json(
        { success: false, error: `businessId is required for message type '${messageType}'` },
        { status: 400 },
      );
    }

    const access = await checkFeatureAccess(businessId, 'whatsapp_reminders');
    if (!access.allowed) {
      return NextResponse.json(
        { success: false, error: access.reason, plan: access.plan },
        { status: 402 },
      );
    }
  }

  // 4. Build message text
  const messageText = buildMessage(messageType, data as Record<string, string>);
  if (!messageText) {
    return NextResponse.json(
      { success: false, error: `Could not build message for type '${messageType}' — check data fields` },
      { status: 400 },
    );
  }

  // 5. Send via Gupshup
  const gupshupKey = process.env.GUPSHUP_API_KEY;
  const gupshupApp = process.env.GUPSHUP_APP_NAME;

  if (!gupshupKey || !gupshupApp) {
    return NextResponse.json(
      { success: false, error: 'WhatsApp gateway not configured on the server' },
      { status: 503 },
    );
  }

  // Ensure E.164-style number (prefix +91 if no country code)
  const phone = recipientPhone.startsWith('+')
    ? recipientPhone
    : `+91${recipientPhone}`;

  const formData = new URLSearchParams({
    channel:     'whatsapp',
    source:      gupshupApp,
    destination: phone,
    message:     JSON.stringify({ type: 'text', text: messageText }),
    'src.name':  gupshupApp,
  });

  let gupshupRes: Response;
  try {
    gupshupRes = await fetch(GUPSHUP_API_URL, {
      method: 'POST',
      headers: {
        apikey:           gupshupKey,
        'Content-Type':   'application/x-www-form-urlencoded',
        'Cache-Control':  'no-cache',
      },
      body: formData.toString(),
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to reach WhatsApp gateway' },
      { status: 502 },
    );
  }

  if (!gupshupRes.ok) {
    const errText = await gupshupRes.text();
    return NextResponse.json(
      { success: false, error: `Gupshup error: ${errText}` },
      { status: 422 },
    );
  }

  const gupshupJson = await gupshupRes.json().catch(() => ({}));
  const messageId: string | undefined =
    gupshupJson?.messageId ??
    gupshupJson?.message?.id ??
    gupshupJson?.response?.id;

  // 6. Deduct 1 credit for paid-plan gated messages
  if (!skipGate && businessId) {
    // Fire-and-forget — don't block the response on a credit deduction failure
    Promise.resolve(
      supabaseAdmin.rpc('deduct_whatsapp_credit', { p_business_id: businessId })
    ).then(({ error }) => {
      if (error) console.error('[whatsapp/route] credit deduction failed:', error.message);
    }).catch((err: unknown) => {
      console.error('[whatsapp/route] credit deduction threw:', err instanceof Error ? err.message : String(err));
    });
  }

  return NextResponse.json({ success: true, messageId });
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
