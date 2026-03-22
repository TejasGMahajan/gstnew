import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { jsPDF } from 'jspdf';
import { checkFeatureAccess } from '@/lib/featureGate';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function authenticateCA(
  request: NextRequest,
): Promise<{ userId: string } | null> {
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

  if (!profile || profile.user_type !== 'chartered_accountant') return null;
  return { userId: user.id };
}

// ─── Date formatter ───────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ─── PDF builder ──────────────────────────────────────────────────────────────

function buildPDF(
  business: { business_name: string; gstin?: string | null; business_type?: string | null },
  tasks:    { task_name: string; due_date: string; status: string; task_type?: string | null }[],
  documents:{ file_name: string; category?: string | null; uploaded_at: string }[],
): Buffer {
  const doc     = new jsPDF({ unit: 'mm', format: 'a4' });
  const ML      = 15;   // margin left
  const MR      = 15;   // margin right
  const PW      = 210;  // page width (A4)
  const PH      = 297;  // page height (A4)
  const CW      = PW - ML - MR;
  let   y       = 20;

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const checkPage = (needed = 10) => {
    if (y + needed > PH - 15) { doc.addPage(); y = 20; }
  };

  const setHeading = (text: string, size = 13) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);  // slate-900
    checkPage(size * 0.6 + 4);
    doc.text(text, ML, y);
    y += size * 0.55 + 2;
  };

  const setBody = (text: string, size = 10, color: [number, number, number] = [51, 65, 85]) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, CW) as string[];
    checkPage(lines.length * size * 0.45 + 2);
    doc.text(lines, ML, y);
    y += lines.length * size * 0.45 + 2;
  };

  const hr = (color: [number, number, number] = [203, 213, 225]) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.3);
    doc.line(ML, y, PW - MR, y);
    y += 5;
  };

  const sectionTitle = (text: string) => {
    checkPage(14);
    doc.setFillColor(15, 23, 42);
    doc.rect(ML, y - 4, 3, 10, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(text, ML + 6, y + 2);
    y += 10;
    hr();
  };

  const tableHeader = (cols: { x: number; label: string }[]) => {
    doc.setFillColor(15, 23, 42);
    doc.rect(ML, y - 4, CW, 8, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    for (const c of cols) doc.text(c.label, c.x, y);
    y += 6;
    doc.setTextColor(51, 65, 85);
  };

  // ── Page 1: Cover / header ────────────────────────────────────────────────

  // Top accent bar
  doc.setFillColor(99, 102, 241);  // indigo-500
  doc.rect(0, 0, PW, 6, 'F');

  y = 20;
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(99, 102, 241);
  doc.text('Compliance Report', ML, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${fmtDate(new Date().toISOString())}`, ML, y);
  y += 3;
  hr([226, 232, 240]);

  // Business info card (light background)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(ML, y, CW, 28, 2, 2, 'FD');
  y += 7;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(148, 163, 184);
  doc.text('BUSINESS NAME', ML + 4, y);
  doc.text('GSTIN', ML + 85, y);
  doc.text('TYPE', ML + 135, y);
  y += 5;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(business.business_name, ML + 4, y);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(business.gstin ?? 'Not Registered', ML + 85, y);
  doc.text(business.business_type ?? '—', ML + 135, y);
  y += 14;

  // Summary stat boxes
  const pending  = tasks.filter(t => !['filed', 'acknowledged', 'locked'].includes(t.status));
  const complete = tasks.filter(t => ['filed', 'acknowledged', 'locked'].includes(t.status));

  const statBoxes = [
    { label: 'Total Tasks',      value: String(tasks.length),     color: [99,  102, 241] as [number,number,number] },
    { label: 'Completed',        value: String(complete.length),  color: [16,  185, 129] as [number,number,number] },
    { label: 'Pending',          value: String(pending.length),   color: [245, 158,  11] as [number,number,number] },
    { label: 'Documents',        value: String(documents.length), color: [59,  130, 246] as [number,number,number] },
  ];

  const boxW = (CW - 9) / 4;
  let bx = ML;
  checkPage(20);
  for (const s of statBoxes) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(bx, y, boxW, 18, 2, 2, 'FD');
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...s.color);
    doc.text(s.value, bx + boxW / 2, y + 10, { align: 'center' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(s.label, bx + boxW / 2, y + 16, { align: 'center' });
    bx += boxW + 3;
  }
  y += 24;
  hr([226, 232, 240]);

  // ── Section 1: Compliance Tasks ───────────────────────────────────────────

  sectionTitle(`Compliance Tasks (${tasks.length})`);

  if (tasks.length === 0) {
    setBody('No compliance tasks found.');
  } else {
    const C = { name: ML, type: ML + 68, due: ML + 108, status: ML + 145 };
    tableHeader([
      { x: C.name,   label: 'Task Name' },
      { x: C.type,   label: 'Type' },
      { x: C.due,    label: 'Due Date' },
      { x: C.status, label: 'Status' },
    ]);

    for (const task of tasks) {
      checkPage(8);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);

      const name = task.task_name.length > 38
        ? task.task_name.slice(0, 35) + '…'
        : task.task_name;

      doc.text(name, C.name, y);
      doc.text((task.task_type ?? '—').slice(0, 18), C.type, y);
      doc.text(fmtDate(task.due_date), C.due, y);

      // Coloured status pill
      const statusColors: Record<string, [number, number, number]> = {
        created:            [99,  102, 241],
        awaiting_documents: [245, 158,  11],
        under_review:       [245, 158,  11],
        ready_to_file:      [245, 158,  11],
        filed:              [16,  185, 129],
        acknowledged:       [16,  185, 129],
        locked:             [16,  185, 129],
      };
      const sc = statusColors[task.status] ?? [100, 116, 139];
      doc.setTextColor(...sc);
      doc.text(task.status, C.status, y);
      doc.setTextColor(30, 41, 59);

      y += 7;

      // Light row separator
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.1);
      doc.line(ML, y - 1, PW - MR, y - 1);
    }
  }

  y += 4;

  // ── Section 2: Documents ──────────────────────────────────────────────────

  sectionTitle(`Documents Uploaded (${documents.length})`);

  if (documents.length === 0) {
    setBody('No documents uploaded.');
  } else {
    const C = { name: ML, cat: ML + 100, date: ML + 145 };
    tableHeader([
      { x: C.name, label: 'File Name' },
      { x: C.cat,  label: 'Category' },
      { x: C.date, label: 'Uploaded' },
    ]);

    for (const d of documents) {
      checkPage(8);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);

      const name = d.file_name.length > 55
        ? d.file_name.slice(0, 52) + '…'
        : d.file_name;

      doc.text(name, C.name, y);
      doc.text(d.category ?? '—', C.cat, y);
      doc.text(fmtDate(d.uploaded_at), C.date, y);
      y += 7;

      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.1);
      doc.line(ML, y - 1, PW - MR, y - 1);
    }
  }

  y += 4;

  // ── Section 3: Pending items ──────────────────────────────────────────────

  sectionTitle(`Pending Items (${pending.length})`);

  if (pending.length === 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129);
    checkPage(8);
    doc.text('All compliance tasks are up to date. ✓', ML, y);
    y += 8;
  } else {
    const C = { name: ML, due: ML + 120, status: ML + 155 };
    tableHeader([
      { x: C.name,   label: 'Task Name' },
      { x: C.due,    label: 'Due Date' },
      { x: C.status, label: 'Status' },
    ]);

    for (const t of pending) {
      checkPage(8);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);

      const name = t.task_name.length > 65 ? t.task_name.slice(0, 62) + '…' : t.task_name;
      doc.text(name, C.name, y);
      doc.text(fmtDate(t.due_date), C.due, y);

      doc.setTextColor(245, 158, 11);
      doc.text(t.status, C.status, y);
      doc.setTextColor(30, 41, 59);

      y += 7;
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.1);
      doc.line(ML, y - 1, PW - MR, y - 1);
    }
  }

  // ── Footer on every page ──────────────────────────────────────────────────

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Bottom accent bar
    doc.setFillColor(248, 250, 252);
    doc.rect(0, PH - 12, PW, 12, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(0, PH - 12, PW, PH - 12);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(
      `${business.business_name} · Complifile · Confidential`,
      ML,
      PH - 5,
    );
    doc.text(`Page ${i} of ${totalPages}`, PW - MR, PH - 5, { align: 'right' });
  }

  return Buffer.from(doc.output('arraybuffer'));
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: { businessId: string } },
) {
  const { businessId } = params;

  // 1. Auth — must be a CA
  const caller = await authenticateCA(request);
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Verify CA is linked to this business via client_relationships
  const { data: rel } = await supabaseAdmin
    .from('client_relationships')
    .select('id')
    .eq('ca_profile_id', caller.userId)
    .eq('business_id', businessId)
    .eq('status', 'active')
    .maybeSingle();

  if (!rel) {
    return NextResponse.json(
      { error: 'You are not linked to this business' },
      { status: 403 },
    );
  }

  // 3. Feature gate
  const access = await checkFeatureAccess(businessId, 'export_report');
  if (!access.allowed) {
    return NextResponse.json(
      {
        error:   'upgrade_required',
        message: 'Business must upgrade to export reports',
        plan:    access.plan,
        reason:  access.reason,
      },
      { status: 403 },
    );
  }

  // 4. Fetch data (service_role bypasses RLS — safe in an authenticated server route)
  const [{ data: business, error: bizErr }, { data: tasks }, { data: documents }] =
    await Promise.all([
      supabaseAdmin
        .from('businesses')
        .select('business_name, gstin, business_type, address')
        .eq('id', businessId)
        .single(),

      supabaseAdmin
        .from('compliance_tasks')
        .select('task_name, task_type, due_date, status')
        .eq('business_id', businessId)
        .order('due_date', { ascending: true }),

      supabaseAdmin
        .from('documents')
        .select('file_name, category, uploaded_at')
        .eq('business_id', businessId)
        .order('uploaded_at', { ascending: false }),
    ]);

  if (bizErr || !business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  }

  // 5. Build PDF
  const pdfBuffer = buildPDF(business, tasks ?? [], documents ?? []);

  // 6. Audit log the export (fire-and-forget)
  Promise.resolve(
    supabaseAdmin.from('audit_logs').insert({
      business_id: businessId,
      user_id: caller.userId,
      entity_type: 'business',
      entity_id: businessId,
      action: 'exported',
      description: `Compliance report exported for ${business.business_name}`,
    })
  ).catch((err: unknown) => {
    console.error('[export] audit log failed:', err instanceof Error ? err.message : String(err));
  });

  const safeName = business.business_name
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '');
  const fileName = `${safeName}_Compliance_Report_${new Date().toISOString().slice(0, 10)}.pdf`;

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control':       'no-store',
    },
  });
}

export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
