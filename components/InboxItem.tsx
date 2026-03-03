"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface EmailSummary {
  id: string;
  from: string;
  subject: string;
  receivedAt: Date | string;
  parseStatus: string;
  parsedJson: string | null;
}

interface ParsedResult {
  merchantName?: string;
  monthlyPrice?: number;
  currency?: string;
  trialEndDate?: string;
  nextChargeDate?: string;
  confidence?: number;
  notes?: string[];
}

function statusBadge(status: string) {
  switch (status) {
    case "success":
      return <span className="badge-success">Parseet</span>;
    case "needs_review":
      return <span className="badge-warning">Trenger gjennomgang</span>;
    case "failed":
      return <span className="badge-danger">Feilet</span>;
    default:
      return <span className="badge-gray">{status}</span>;
  }
}

export function InboxItem({ email }: { email: EmailSummary }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  let parsed: ParsedResult | null = null;
  try {
    if (email.parsedJson) parsed = JSON.parse(email.parsedJson);
  } catch {}

  const receivedAt =
    typeof email.receivedAt === "string"
      ? new Date(email.receivedAt)
      : email.receivedAt;

  async function handleDelete() {
    if (!confirm("Slett denne e-posten?")) return;
    setLoading(true);
    await fetch(`/api/inbox/${email.id}`, { method: "DELETE" });
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {statusBadge(email.parseStatus)}
            <span className="text-xs text-slate-400">
              {receivedAt.toLocaleDateString("no-NO")}{" "}
              {receivedAt.toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>

          <p className="font-medium text-slate-900 text-sm leading-snug">
            {email.subject}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{email.from}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-slate-500 hover:text-slate-900"
          >
            {expanded ? "Skjul" : "Detaljer"}
          </button>
          <button
            onClick={handleDelete}
            className="text-slate-400 hover:text-red-500 transition-colors text-xs"
            disabled={loading}
          >
            ✕
          </button>
        </div>
      </div>

      {expanded && parsed && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {parsed.merchantName && (
              <>
                <dt className="text-slate-500">Leverandør</dt>
                <dd className="font-medium text-slate-900">{parsed.merchantName}</dd>
              </>
            )}
            {parsed.monthlyPrice !== undefined && (
              <>
                <dt className="text-slate-500">Månedspris</dt>
                <dd className="font-medium text-slate-900">
                  {(parsed.monthlyPrice / 100).toFixed(0)} {parsed.currency}
                </dd>
              </>
            )}
            {parsed.trialEndDate && (
              <>
                <dt className="text-slate-500">Prøveperiode utløper</dt>
                <dd className="font-medium text-slate-900">
                  {new Date(parsed.trialEndDate).toLocaleDateString("no-NO")}
                </dd>
              </>
            )}
            {parsed.nextChargeDate && (
              <>
                <dt className="text-slate-500">Neste betaling</dt>
                <dd className="font-medium text-slate-900">
                  {new Date(parsed.nextChargeDate).toLocaleDateString("no-NO")}
                </dd>
              </>
            )}
            {parsed.confidence !== undefined && (
              <>
                <dt className="text-slate-500">Konfidenspoeng</dt>
                <dd className="font-medium text-slate-900">
                  {Math.round(parsed.confidence * 100)}%
                </dd>
              </>
            )}
          </dl>

          {parsed.notes && parsed.notes.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-slate-500 mb-1">Notater fra parser:</p>
              <ul className="text-xs text-slate-500 space-y-0.5">
                {parsed.notes.map((note, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <span className="text-brand-500">•</span> {note}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
