'use client';

import React, { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { logError } from '@/lib/errorLogger';

interface BulkImportProps {
  importType: 'clients' | 'transactions';
  onImportComplete?: (results: ImportResult) => void;
}

interface ImportResult {
  total: number;
  success: number;
  errors: { row: number; message: string }[];
}

interface ParsedRow {
  [key: string]: string;
}

const EXPECTED_COLUMNS: Record<string, string[]> = {
  clients: ['business_name', 'gstin', 'email', 'phone', 'business_type'],
  transactions: ['invoice_number', 'date', 'amount', 'tax_amount', 'party_name', 'type'],
};

export default function BulkImport({ importType, onImportComplete }: BulkImportProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);

  const parseCSV = (text: string): { headers: string[]; rows: ParsedRow[] } => {
    const lines = text.split('\n').filter((l) => l.trim());
    if (lines.length < 2) return { headers: [], rows: [] };

    const hdrs = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'));
    const rows: ParsedRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
      const row: ParsedRow = {};
      hdrs.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });
      rows.push(row);
    }

    return { headers: hdrs, rows };
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      toast({ title: 'Invalid File', description: 'Please upload a CSV file.', variant: 'destructive' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const { headers: hdrs, rows } = parseCSV(text);

      if (rows.length === 0) {
        toast({ title: 'Empty File', description: 'No data rows found.', variant: 'destructive' });
        return;
      }

      // Validate columns
      const expected = EXPECTED_COLUMNS[importType];
      const missing = expected.filter((col) => !hdrs.includes(col));
      if (missing.length > 0) {
        toast({
          title: 'Missing Columns',
          description: `Expected columns: ${missing.join(', ')}`,
          variant: 'destructive',
        });
        return;
      }

      setHeaders(hdrs);
      setParsedData(rows);
      setStep('preview');
      toast({ title: 'File Parsed', description: `${rows.length} rows ready for import.` });
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setStep('importing');
    const errors: { row: number; message: string }[] = [];
    let successCount = 0;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (importType === 'clients') {
        for (let i = 0; i < parsedData.length; i++) {
          const row = parsedData[i];
          try {
            const { error } = await supabase.from('businesses').insert({
              business_name: row.business_name,
              gstin: row.gstin || null,
              email: row.email || null,
              phone: row.phone || null,
              business_type: row.business_type || 'proprietorship',
              owner_id: user.id,
            });

            if (error) {
              errors.push({ row: i + 2, message: error.message });
            } else {
              successCount++;
            }
          } catch (err: any) {
            errors.push({ row: i + 2, message: err.message });
          }
        }
      }

      const importResult: ImportResult = {
        total: parsedData.length,
        success: successCount,
        errors,
      };

      setResult(importResult);
      setStep('done');
      onImportComplete?.(importResult);

      toast({
        title: 'Import Complete',
        description: `${successCount} of ${parsedData.length} records imported successfully.`,
      });
    } catch (err: any) {
      await logError('bulk_import', err, { importType });
      toast({ title: 'Import Failed', description: err.message, variant: 'destructive' });
      setStep('preview');
    }
  };

  const resetImport = () => {
    setStep('upload');
    setParsedData([]);
    setHeaders([]);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="w-full space-y-4">
      {step === 'upload' && (
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors">
          <FileSpreadsheet className="h-12 w-12 text-slate-400 mx-auto mb-3" />
          <p className="font-medium text-slate-700 mb-1">Upload CSV File</p>
          <p className="text-sm text-slate-500 mb-4">
            Required columns: {EXPECTED_COLUMNS[importType].join(', ')}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button onClick={() => fileInputRef.current?.click()} className="bg-blue-900 hover:bg-blue-800">
            <Upload className="h-4 w-4 mr-2" /> Select CSV File
          </Button>
          <p className="text-xs text-slate-400 mt-3">
            Download <button className="text-blue-600 underline">sample template</button>
          </p>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-slate-900">{parsedData.length} rows to import</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetImport}>Cancel</Button>
              <Button onClick={handleImport} className="bg-green-600 hover:bg-green-700">
                Import {parsedData.length} Records
              </Button>
            </div>
          </div>

          <div className="border rounded-lg overflow-x-auto max-h-64">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  {headers.slice(0, 5).map((h) => (
                    <TableHead key={h} className="text-xs">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedData.slice(0, 10).map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-xs text-slate-400">{idx + 1}</TableCell>
                    {headers.slice(0, 5).map((h) => (
                      <TableCell key={h} className="text-xs truncate max-w-[150px]">
                        {row[h]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {parsedData.length > 10 && (
              <p className="text-xs text-slate-400 text-center py-2">
                ...and {parsedData.length - 10} more rows
              </p>
            )}
          </div>
        </div>
      )}

      {step === 'importing' && (
        <div className="text-center py-8">
          <Loader2 className="h-12 w-12 text-blue-600 mx-auto mb-3 animate-spin" />
          <p className="font-semibold text-slate-900">Importing records...</p>
          <p className="text-sm text-slate-500">Please don't close this page.</p>
        </div>
      )}

      {step === 'done' && result && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <div>
              <p className="font-semibold text-green-800">Import Complete</p>
              <p className="text-sm text-green-700">
                {result.success} of {result.total} records imported successfully
              </p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <p className="font-semibold text-red-800">{result.errors.length} Errors</p>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {result.errors.map((err, idx) => (
                  <p key={idx} className="text-xs text-red-700">
                    Row {err.row}: {err.message}
                  </p>
                ))}
              </div>
            </div>
          )}

          <Button variant="outline" onClick={resetImport}>Import More</Button>
        </div>
      )}
    </div>
  );
}
