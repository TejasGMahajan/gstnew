import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-razorpay-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'No signature found' },
        { status: 400 }
      );
    }

    if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
      console.error('RAZORPAY_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error('Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const payload = JSON.parse(body);
    const event = payload.event;

    console.log('Razorpay webhook event:', event);

    if (event === 'payment.captured') {
      const paymentEntity = payload.payload.payment.entity;
      const orderId = paymentEntity.order_id;

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const auth = Buffer.from(
        `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
      ).toString('base64');

      const orderResponse = await fetch(
        `https://api.razorpay.com/v1/orders/${orderId}`,
        {
          headers: {
            Authorization: `Basic ${auth}`
          }
        }
      );

      const orderData = await orderResponse.json();
      const { business_id, plan_type, billing_cycle } = orderData.notes;

      if (!business_id || !plan_type) {
        console.error('Missing business_id or plan_type in order notes');
        return NextResponse.json(
          { error: 'Invalid order data' },
          { status: 400 }
        );
      }

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
          amount_paid: paymentEntity.amount / 100,
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentEntity.id,
          start_date: new Date().toISOString(),
          end_date: endDate.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('business_id', business_id);

      if (updateError) {
        console.error('Subscription update error:', updateError);
        return NextResponse.json(
          { error: 'Failed to update subscription' },
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
        description: `Subscription upgraded to ${plan_type} (${billing_cycle}) via webhook`
      });

      console.log('Subscription updated successfully for business:', business_id);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
