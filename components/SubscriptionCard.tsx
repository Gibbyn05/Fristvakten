"use client";

import { useState } from "react";
import { differenceInDays } from "date-fns";
import { useRouter } from "next/navigation";

interface Sub {
  id: string;
  merchantName: string;
  productName: string | null;
  status: string;
  monthlyPrice: number | null;
  currency: string;
  billingCycle: string;
  trialEndDate: Date | string | null;
  nextChargeDate: Date | string | null;
  cancellationLink: string | null;
  confidence: number;
  isUnused: boolean;
}

interface SubscriptionCardProps {
  sub: Sub;
  showConfirmPrompt?: boolean;
  highlight?: "trial" | "charge";
  editable?: boolean;
}

function formatPrice(cents: number | null, currency: string) {
  if (!cents) return "Ukjent pris";
  return `${(cents / 100).toFixed(0)} ${currency}/md`;
}

function daysUntil(date: Date | string | null): number | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return differenceInDays(d, today);
}

function urgencyClass(days: number | null) {
  if (days === null) return "";
  if (days <= 1) return "border-red-300 bg-red-50";
  if (days <= 3) return "border-amber-300 bg-amber-50";
  if (days <= 7) return "border-yellow-200 bg-yellow-50";
  return "";
}

export function SubscriptionCard({
  sub,
  showConfirmPrompt,
  highlight,
  editable,
}: SubscriptionCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState({
    merchantName: sub.merchantName,
    productName: sub.productName ?? "",
    monthlyPrice: sub.monthlyPrice ? String(sub.monthlyPrice / 100) : "",
    currency: sub.currency,
    billingCycle: sub.billingCycle,
  });

  const trialDays = daysUntil(sub.trialEndDate);
  const chargeDays = daysUntil(sub.nextChargeDate);

  const highlightDays =
    highlight === "trial" ? trialDays : highlight === "charge" ? chargeDays : null;

  async function patch(data: Record<string, unknown>) {
    setLoading(true);
    await fetch(`/api/subscriptions/${sub.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setLoading(false);
    router.refresh();
  }

  async function handleConfirm() {
    await patch({
      merchantName: fields.merchantName,
      productName: fields.productName || null,
      monthlyPrice: fields.monthlyPrice
        ? Math.round(parseFloat(fields.monthlyPrice) * 100)
        : null,
      currency: fields.currency,
      billingCycle: fields.billingCycle,
    });
    setEditing(false);
  }

  async function handleCancel() {
    await patch({ status: "canceled" });
  }

  async function handleToggleUnused() {
    await patch({ isUnused: !sub.isUnused });
  }

  async function handleDelete() {
    if (!confirm("Slett dette abonnementet?")) return;
    setLoading(true);
    await fetch(`/api/subscriptions/${sub.id}`, { method: "DELETE" });
    setLoading(false);
    router.refresh();
  }

  const cardClass = `card relative transition-colors ${urgencyClass(highlightDays)} ${sub.status === "canceled" ? "opacity-60" : ""}`;

  return (
    <div className={cardClass}>
      <div className="flex items-start justify-between gap-4">
        {/* Left content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-900">
              {sub.merchantName}
              {sub.productName && (
                <span className="font-normal text-slate-500 ml-1">
                  – {sub.productName}
                </span>
              )}
            </h3>

            {/* Status badges */}
            {sub.status === "canceled" && (
              <span className="badge-gray">Avsluttet</span>
            )}
            {sub.confidence < 0.8 && sub.status === "active" && (
              <span className="badge-warning">Trenger bekreftelse</span>
            )}
            {sub.isUnused && <span className="badge-danger">Ubrukt</span>}
          </div>

          <div className="mt-1 flex items-center gap-3 flex-wrap text-sm text-slate-600">
            <span className="font-medium">
              {formatPrice(sub.monthlyPrice, sub.currency)}
            </span>

            {sub.trialEndDate && trialDays !== null && (
              <span
                className={`font-medium ${trialDays <= 2 ? "text-red-600" : trialDays <= 7 ? "text-amber-600" : "text-slate-600"}`}
              >
                Prøveperiode: {trialDays === 0 ? "utløper i dag" : trialDays === 1 ? "utløper i morgen" : `utløper om ${trialDays} dager`}
              </span>
            )}

            {sub.nextChargeDate && !sub.trialEndDate && chargeDays !== null && chargeDays <= 7 && (
              <span className="text-blue-600 font-medium">
                Betaling om {chargeDays} dager
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        {editable && sub.status === "active" && !editing && (
          <div className="flex items-center gap-2 shrink-0">
            {sub.cancellationLink && (
              <a
                href={sub.cancellationLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary text-xs py-1 px-2"
              >
                Avslutt
              </a>
            )}
            <button
              onClick={() => setEditing(true)}
              className="btn-secondary text-xs py-1 px-2"
              disabled={loading}
            >
              Rediger
            </button>
            <button
              onClick={handleToggleUnused}
              className="btn-secondary text-xs py-1 px-2"
              disabled={loading}
              title={sub.isUnused ? "Merk som brukt" : "Merk som ubrukt"}
            >
              {sub.isUnused ? "Bruker" : "Ubrukt"}
            </button>
          </div>
        )}

        {!editable && !editing && sub.status === "active" && (
          <button
            onClick={handleDelete}
            className="text-slate-400 hover:text-red-500 transition-colors text-xs shrink-0"
            disabled={loading}
          >
            ✕
          </button>
        )}
      </div>

      {/* Edit / confirm form */}
      {(editing || showConfirmPrompt) && sub.status === "active" && (
        <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
          {showConfirmPrompt && !editing && (
            <p className="text-sm text-amber-700 font-medium">
              Bekreft at disse feltene er riktige:
            </p>
          )}

          {editing && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="label">Leverandør</label>
                <input
                  className="input"
                  value={fields.merchantName}
                  onChange={(e) => setFields({ ...fields, merchantName: e.target.value })}
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="label">Produkt</label>
                <input
                  className="input"
                  value={fields.productName}
                  onChange={(e) => setFields({ ...fields, productName: e.target.value })}
                  placeholder="Valgfritt"
                />
              </div>
              <div>
                <label className="label">Pris (kr/md)</label>
                <input
                  className="input"
                  type="number"
                  value={fields.monthlyPrice}
                  onChange={(e) => setFields({ ...fields, monthlyPrice: e.target.value })}
                  placeholder="199"
                />
              </div>
              <div>
                <label className="label">Syklus</label>
                <select
                  className="input"
                  value={fields.billingCycle}
                  onChange={(e) => setFields({ ...fields, billingCycle: e.target.value })}
                >
                  <option value="monthly">Månedlig</option>
                  <option value="yearly">Årlig</option>
                  <option value="unknown">Ukjent</option>
                </select>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={editing ? handleConfirm : () => setEditing(true)}
              className="btn-primary text-xs py-1.5 px-3"
              disabled={loading}
            >
              {loading ? "Lagrer…" : editing ? "Bekreft og lagre" : "Rediger og bekreft"}
            </button>
            {editing && (
              <button
                onClick={() => setEditing(false)}
                className="btn-secondary text-xs py-1.5 px-3"
              >
                Avbryt
              </button>
            )}
            {sub.status === "active" && (
              <button
                onClick={handleCancel}
                className="text-xs text-red-600 hover:underline ml-auto"
                disabled={loading}
              >
                Marker som avsluttet
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
