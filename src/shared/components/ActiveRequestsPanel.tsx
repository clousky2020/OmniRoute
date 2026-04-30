"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type ActiveRequestRow = {
  model: string;
  provider: string;
  account: string;
  startedAt: number;
  runningTimeMs: number;
  count: number;
  clientEndpoint?: string | null;
  clientRequest?: unknown;
  providerRequest?: unknown;
  providerUrl?: string | null;
};

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export default function ActiveRequestsPanel() {
  const t = useTranslations("logs");
  const [rows, setRows] = useState<ActiveRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRow, setSelectedRow] = useState<ActiveRequestRow | null>(null);
  const [clearing, setClearing] = useState(false);
  const [mounted, setMounted] = useState(false);

  const handleClearAll = async () => {
    if (clearing) return;
    setClearing(true);
    try {
      const res = await fetch("/api/logs/active", { method: "DELETE" });
      if (res.ok) {
        setRows([]);
      }
    } catch (error) {
      console.error("Failed to clear pending requests:", error);
    } finally {
      setClearing(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/logs/active", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setRows(Array.isArray(data.activeRequests) ? data.activeRequests : []);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load active requests:", error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    const interval = setInterval(load, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // SSR: return null to avoid hydration mismatch
  if (!mounted) {
    return null;
  }

  // Client: hide if no active requests after loading
  if (!loading && rows.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-main">
            {t("runningRequests")}
          </h3>
          <p className="text-xs text-text-muted">{t("runningRequestsDesc")}</p>
        </div>
        <div className="inline-flex items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            {loading ? t("loading") : t("activeCount", { count: rows.length })}
          </div>
          {rows.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              disabled={clearing}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-medium text-text-muted transition-colors hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 disabled:opacity-50"
              title={t("clearPendingRequests")}
            >
              <span className="material-symbols-outlined text-[14px]">delete</span>
              {clearing ? t("clearing") : t("clearAll")}
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-sidebar/40 text-left text-xs uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t("model")}</th>
              <th className="px-4 py-3 font-medium">{t("provider")}</th>
              <th className="px-4 py-3 font-medium">{t("account")}</th>
              <th className="px-4 py-3 font-medium">{t("elapsed")}</th>
              <th className="px-4 py-3 font-medium">{t("count")}</th>
              <th className="px-4 py-3 font-medium">{t("payloads")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.account}:${row.provider}:${row.model}:${row.startedAt}`}
                className="border-t border-border/60"
              >
                <td className="px-4 py-3 font-medium text-text-main">{row.model}</td>
                <td className="px-4 py-3 text-text-muted">{row.provider}</td>
                <td className="px-4 py-3 text-text-muted">{row.account}</td>
                <td className="px-4 py-3 text-text-muted">{formatDuration(row.runningTimeMs)}</td>
                <td className="px-4 py-3 text-text-muted">{row.count}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setSelectedRow(row)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-medium text-text-muted transition-colors hover:bg-sidebar/40 hover:text-text-main"
                  >
                    <span className="material-symbols-outlined text-[14px]">visibility</span>
                    {t("viewPayloads")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-border bg-surface shadow-xl">
            <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h4 className="text-lg font-semibold text-text-main">
                  {selectedRow.provider} / {selectedRow.model}
                </h4>
                <p className="mt-1 text-sm text-text-muted">
                  {t("runningRequestDetailMeta", {
                    account: selectedRow.account,
                    elapsed: formatDuration(selectedRow.runningTimeMs),
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                className="rounded-full border border-border p-2 text-text-muted transition-colors hover:bg-sidebar/40 hover:text-text-main"
                aria-label={t("close")}
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="grid gap-4 overflow-y-auto px-5 py-5 md:grid-cols-2">
              <section className="rounded-xl border border-border bg-bg-subtle p-4">
                <div className="mb-3">
                  <h5 className="text-sm font-semibold text-text-main">{t("clientPayload")}</h5>
                  <p className="mt-1 text-xs text-text-muted">
                    {selectedRow.clientEndpoint || t("notAvailable")}
                  </p>
                </div>
                <pre className="overflow-x-auto rounded-lg border border-border/70 bg-bg p-3 text-xs text-text-muted">
                  {JSON.stringify(selectedRow.clientRequest || {}, null, 2)}
                </pre>
              </section>

              <section className="rounded-xl border border-border bg-bg-subtle p-4">
                <div className="mb-3">
                  <h5 className="text-sm font-semibold text-text-main">{t("upstreamPayload")}</h5>
                  <p className="mt-1 break-all text-xs text-text-muted">
                    {selectedRow.providerUrl || t("upstreamNotSentYet")}
                  </p>
                </div>
                <pre className="overflow-x-auto rounded-lg border border-border/70 bg-bg p-3 text-xs text-text-muted">
                  {JSON.stringify(selectedRow.providerRequest || {}, null, 2)}
                </pre>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
