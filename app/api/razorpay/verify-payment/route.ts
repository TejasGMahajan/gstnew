import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      business_id
    } = body;

    if (!process.env.RAZORPAY_KEY_SECRET) {
      return NextResponse.json(
        { error: 'Razorpay secret not configured' },
        { status: 500 }
      );
    }

    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const auth = Buffer.from(
      `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
    ).toString('base64');

    const orderResponse = await fetch(
      `https://api.razorpay.com/v1/orders/${razorpay_order_id}`,
      {
        headers: {
          Authorization: `Basic ${auth}`
        }
      }
    );

    const orderData = await orderResponse.json();
    const { plan_type, billing_cycle } = orderData.notes;

    let endDate = new Date();
    if (billing_cycle === 'annual') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else if (billing_cycle === 'quarterly') {
      endDate.setMonth(endDate.getMonth() + 3);
    }

    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        plan_type,
        status: 'active',
        billing_cycle,
        amount_paid: orderData.amount / 100,
        razorpay_order_id,
        razorpay_payment_id,
        start_date: new Date().toISOString(),
        end_date: endDate.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('business_id', business_id);

    if (updateError) {
      console.error('Subscription update error:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update subscription' },
        { status: 500 }
      );
    }

    if (plan_type === 'pro') {
      await supabase
        .from('whatsapp_credits')
        .update({ credits_total: 500, credits_remaining: 500 })
        .eq('business_id', business_id);

      await supabase
        .from('storage_usage')
        .update({ total_mb: 2048 })
        .eq('business_id', business_id);
    } else if (plan_type === 'enterprise') {
      await supabase
        .from('whatsapp_credits')
        .update({ credits_total: 999999, credits_remaining: 999999 })
        .eq('business_id', business_id);

      await supabase
        .from('storage_usage')
        .update({ total_mb: 10240 })
        .eq('business_id', business_id);
    }

    await supabase.from('audit_logs').insert({
      business_id,
      user_id: business_id,
      entity_type: 'subscription',
      entity_id: business_id,
      action: 'updated',
      description: `Subscription upgraded to ${plan_type} (${billing_cycle})`
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Verify payment error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
