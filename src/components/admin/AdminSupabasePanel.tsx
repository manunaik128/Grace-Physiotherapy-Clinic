import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Database,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import type { SupabaseStatusResponse } from '../../types/clinic';

export function AdminSupabasePanel({ token }: { token: string }) {
  const [status, setStatus] = useState<SupabaseStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSql, setShowSql] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/supabase/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = (await res.json()) as SupabaseStatusResponse;
        setStatus(json);
        const anyMissing = Object.values(json.tables || {}).some((t) => !t.exists);
        if (anyMissing) {
          setShowSql(true);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/admin/supabase/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as {
        attempted?: number;
        synced?: number;
        lastError?: string | null;
        error?: string;
      };
      if (!res.ok) {
        setSyncMessage(json.error || 'Sync request failed.');
      } else if (json.attempted === 0) {
        setSyncMessage('All appointments are already synced to Supabase.');
      } else if (json.synced === json.attempted) {
        setSyncMessage(`Synced ${json.synced} appointment(s) to Supabase.`);
      } else {
        setSyncMessage(
          `Synced ${json.synced ?? 0} of ${json.attempted ?? 0} appointments.${
            json.lastError ? ` Last error: ${json.lastError}` : ''
          }`
        );
      }
      await loadStatus();
    } finally {
      setSyncing(false);
    }
  };

  const handleCopySql = async () => {
    if (!status?.schemaSql) return;
    await navigator.clipboard.writeText(status.schemaSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  if (loading && !status) {
    return (
      <div className="rounded-2xl bg-white border border-[#252B29]/10 p-6 space-y-3">
        <div className="h-6 w-48 bg-[#F3F3EC] rounded animate-pulse" />
        <div className="h-24 bg-[#F3F3EC] rounded animate-pulse" />
      </div>
    );
  }

  const tableEntries = Object.entries(status?.tables || {});
  const allTablesReady = tableEntries.length > 0 && tableEntries.every(([, info]) => info.exists);
  const projectRef = status?.projectHost?.endsWith('.supabase.co')
    ? status.projectHost.split('.')[0]
    : '';
  const sqlEditorHref = projectRef
    ? `https://supabase.com/dashboard/project/${projectRef}/sql/new`
    : 'https://supabase.com/dashboard';

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white border border-[#252B29]/10 p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EBF2EC] text-[#174D3B] flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-[#252B29]">
                Supabase Database Sync
              </h2>
              <p className="text-xs text-[#252B29]/70 mt-0.5">
                {status?.configured
                  ? `Connected host: ${status.projectHost || 'Configured'}`
                  : 'Supabase environment variables (SUPABASE_URL and key) are not configured.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadStatus()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#252B29]/15 bg-white px-3.5 py-2 text-xs font-semibold text-[#252B29] hover:bg-[#F3F3EC] cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh Status
            </button>
            <button
              type="button"
              onClick={() => void handleSyncNow()}
              disabled={syncing || !status?.configured}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#174D3B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#10382B] disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Unsynced Bookings'}
            </button>
          </div>
        </div>

        {/* Summary Metrics */}
        {status && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl bg-[#FAFAF6] border border-[#252B29]/10 p-4">
              <p className="text-xs text-[#252B29]/60">Synced Bookings</p>
              <p className="mt-1 font-display text-2xl font-bold text-[#174D3B] tabular-nums">
                {status.syncedCount}
              </p>
            </div>
            <div className="rounded-xl bg-[#FAFAF6] border border-[#252B29]/10 p-4">
              <p className="text-xs text-[#252B29]/60">Pending Sync Queue</p>
              <p className="mt-1 font-display text-2xl font-bold text-[#252B29] tabular-nums">
                {status.unsyncedCount}
              </p>
            </div>
            <div className="rounded-xl bg-[#FAFAF6] border border-[#252B29]/10 p-4">
              <p className="text-xs text-[#252B29]/60">Admin Update Sync</p>
              <p className="mt-1 text-sm font-semibold text-[#252B29]">
                {status.hasServiceRole ? 'Full Read/Write Enabled' : 'New Bookings & Enquiries'}
              </p>
              {!status.hasServiceRole && (
                <p className="mt-1 text-[11px] text-[#252B29]/60">
                  Add SUPABASE_SERVICE_ROLE_KEY in Secrets to also push admin status edits back to Supabase.
                </p>
              )}
            </div>
          </div>
        )}

        {syncMessage && (
          <div className="rounded-xl border border-[#174D3B]/20 bg-[#EBF2EC] px-4 py-3 text-xs text-[#174D3B] font-medium">
            {syncMessage}
          </div>
        )}

        {/* Table Readiness Grid */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[#252B29]/60">
            Supabase Table Readiness
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {tableEntries.map(([tableName, info]) => (
              <div
                key={tableName}
                className="flex items-center justify-between rounded-xl border border-[#252B29]/10 bg-[#FAFAF6] px-4 py-3"
              >
                <div className="flex items-center gap-2.5">
                  {info.exists ? (
                    <CheckCircle2 className="w-4 h-4 text-[#174D3B] shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                  )}
                  <span className="font-mono text-xs font-semibold text-[#252B29]">
                    public.{tableName}
                  </span>
                </div>
                <span
                  className={`text-xs font-medium ${
                    info.exists ? 'text-[#174D3B]' : 'text-amber-800'
                  }`}
                >
                  {info.message}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* One-time SQL Setup Callout */}
        {!allTablesReady && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-800 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-950 space-y-1">
                <p className="font-semibold">
                  One-time Supabase SQL setup needed to create your clinic tables
                </p>
                <p>
                  Bookings are currently safeguarded locally and queued for sync. Copy the SQL
                  migration below, run it once in your Supabase SQL Editor, then click{' '}
                  <strong>Sync Unsynced Bookings</strong> above.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* SQL Viewer & Copy */}
        <div className="pt-2 border-t border-[#252B29]/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setShowSql((prev) => !prev)}
              className="text-xs font-semibold text-[#174D3B] hover:underline cursor-pointer"
            >
              {showSql ? 'Hide Supabase SQL Setup Script' : 'Show Supabase SQL Setup Script'}
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleCopySql()}
                disabled={!status?.schemaSql}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#252B29]/15 bg-white px-3 py-1.5 text-xs font-semibold text-[#252B29] hover:bg-[#F3F3EC] cursor-pointer"
              >
                {copiedSql ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#174D3B]" />
                    Copied SQL
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy SQL Migration
                  </>
                )}
              </button>
              <a
                href={sqlEditorHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#174D3B]/10 px-3 py-1.5 text-xs font-semibold text-[#174D3B] hover:bg-[#174D3B]/15"
              >
                Open Supabase SQL Editor
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {showSql && status?.schemaSql && (
            <pre className="mt-3 max-h-80 overflow-auto rounded-xl border border-[#252B29]/10 bg-[#252B29] p-4 text-[11px] leading-relaxed text-[#FAFAF6] font-mono">
              {status.schemaSql}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
