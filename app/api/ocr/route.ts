import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType } = await req.json();
    if (!imageBase64) return NextResponse.json({ error: 'No image provided' }, { status: 400 });

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const type = allowedTypes.includes(mediaType) ? mediaType : 'image/png';

    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: type as any, data: imageBase64 },
            },
            {
              type: 'text',
              text: `You are a compliance document OCR assistant for Indian businesses. Analyse this document and extract all key information.

First identify the document type from this list:
- GST Invoice / Tax Invoice / e-Invoice
- GSTR-1 / GSTR-3B / GSTR-9 (GST Returns)
- TDS Certificate (Form 16 / Form 16A / Form 26AS)
- TDS Return (Form 24Q / 26Q / 27Q)
- ITR (Income Tax Return) / ITR Acknowledgement
- PF / ESIC Statement or Challan
- ROC Filing / MCA Form
- Balance Sheet / P&L Statement
- Bank Statement
- Aadhaar / PAN / GSTIN Registration Certificate
- Import/Export Document
- Other Compliance Document

Return a JSON object with:
{
  "documentType": "<identified type from list above>",
  "summary": "<1-2 sentence plain English summary of what this document is>",
  "fields": {
    "<field_name>": "<value>"
  },
  "keyDates": [{ "label": "", "date": "" }],
  "keyAmounts": [{ "label": "", "amount": "" }],
  "identifiers": [{ "label": "", "value": "" }],
  "parties": [{ "role": "Seller/Buyer/Employer/Employee/Taxpayer/etc", "name": "", "gstin": "", "pan": "", "address": "" }],
  "lineItems": [{ "description": "", "hsn": "", "qty": "", "rate": "", "amount": "" }],
  "complianceNotes": ["<any important compliance observations>"],
  "warnings": ["<any issues like missing GSTIN, incorrect format, etc>"]
}

Only include fields that have actual values. Return ONLY the JSON, no explanation.`,
            },
          ],
        },
      ],
    });

    const raw = (message.content[0] as any).text as string;
    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
    const extracted = JSON.parse(cleaned);
    return NextResponse.json({ success: true, data: extracted });
  } catch (err: any) {
    console.error('[OCR] Error:', err);
    return NextResponse.json({ error: err.message || 'OCR failed' }, { status: 500 });
  }
}
