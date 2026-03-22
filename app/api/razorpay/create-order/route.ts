import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Server-side plan amount map (in paise). Never trust client-sent amounts.
const PLAN_AMOUNTS: Record<string, number> = {
  pro:        99900,   // ₹999
  enterprise: 299900,  // ₹2,999
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Pricing page sends { plan, businessId }
    const plan       = body.plan       as string | undefined;
    const businessId = body.businessId as string | undefined;

    if (!plan || !businessId) {
      return NextResponse.json({ error: 'plan and businessId are required' }, { status: 400 });
    }

    const amount = PLAN_AMOUNTS[plan];
    if (!amount) {
      return NextResponse.json({ error: `Unknown plan: ${plan}` }, { status: 400 });
    }

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return NextResponse.json({ error: 'Razorpay credentials not configured' }, { status: 500 });
    }

    const auth = Buffer.from(
      `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
    ).toString('base64');

    const orderData = {
      amount,
      currency: 'INR',
      receipt: `receipt_${businessId}_${Date.now()}`,
      notes: {
        business_id:   businessId,
        plan_type:     plan,
        billing_cycle: 'annual',
      },
    };

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Basic ${auth}`,
      },
      body: JSON.stringify(orderData),
    });

    const order = await response.json();

    if (!response.ok) {
      throw new Error(order.error?.description || 'Failed to create order');
    }

    return NextResponse.json(order);
  } catch (error: unknown) {
    console.error('[razorpay/create-order] error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
