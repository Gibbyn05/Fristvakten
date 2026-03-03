import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { differenceInDays } from "date-fns";
import Link from "next/link";
import { SubscriptionCard } from "@/components/SubscriptionCard";

function formatCurrency(cents: number, currency: string) {
  return `${(cents / 100).toFixed(0)} ${currency}`;
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const subscriptions = await prisma.subscription.findMany({
    where: { userId: session.user.id, status: "active" },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Monthly total (normalize yearly / 12)
  const monthlyTotal = subscriptions.reduce((sum, s) => {
    if (!s.monthlyPrice) return sum;
    return sum + s.monthlyPrice;
  }, 0);

  const yearlyTotal = monthlyTotal * 12;

  // Potential savings = unused subscriptions
  const unusedSubs = subscriptions.filter((s) => s.isUnused && s.monthlyPrice);
  const potentialSavings = unusedSubs.reduce(
    (sum, s) => sum + (s.monthlyPrice ?? 0),
    0
  );

  // Trials expiring ≤30 days
  const expiringTrials = subscriptions
    .filter((s) => {
      if (!s.trialEndDate) return false;
      const days = differenceInDays(s.trialEndDate, today);
      return days >= 0 && days <= 30;
    })
    .sort((a, b) => a.trialEndDate!.getTime() - b.trialEndDate!.getTime());

  // Upcoming charges ≤7 days (exclude trials)
  const upcomingCharges = subscriptions
    .filter((s) => {
      if (!s.nextChargeDate || s.trialEndDate) return false;
      const days = differenceInDays(s.nextChargeDate, today);
      return days >= 0 && days <= 7;
    })
    .sort((a, b) => a.nextChargeDate!.getTime() - b.nextChargeDate!.getTime());

  // Needs review
  const needsReview = subscriptions.filter((s) => s.confidence < 0.8);

  const inboundDomain =
    process.env.INBOUND_DOMAIN ?? "inbound.fristvakt.no";

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { forwardAddressLocalPart: true },
  });
  const forwardAddress = user
    ? `${user.forwardAddressLocalPart}@${inboundDomain}`
    : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">
          Oversikt over dine abonnementer og frister
        </p>
      </div>

      {/* Forward address CTA */}
      {forwardAddress && (
        <div className="rounded-xl bg-brand-600 p-5 text-white">
          <p className="text-sm font-medium opacity-90 mb-1">
            Videresend kvitteringer og bekreftelser til:
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <code className="text-lg font-bold bg-white/20 rounded px-3 py-1 break-all">
              {forwardAddress}
            </code>
          </div>
          <p className="text-xs opacity-75 mt-2">
            Vi oppdager abonnementer automatisk fra e-postene du videresender.
          </p>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Månedlig
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {formatCurrency(monthlyTotal, "NOK")}
          </p>
        </div>
        <div className="card text-center">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Årlig
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {formatCurrency(yearlyTotal, "NOK")}
          </p>
        </div>
        <div className="card text-center">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Abonnementer
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {subscriptions.length}
          </p>
        </div>
        <div className="card text-center">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Mulig sparing
          </p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {formatCurrency(potentialSavings, "NOK")}
            <span className="text-sm text-slate-400">/md</span>
          </p>
        </div>
      </div>

      {/* Needs review */}
      {needsReview.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
            Trenger bekreftelse ({needsReview.length})
          </h2>
          <div className="space-y-3">
            {needsReview.map((sub) => (
              <SubscriptionCard key={sub.id} sub={sub} showConfirmPrompt />
            ))}
          </div>
        </section>
      )}

      {/* Expiring trials */}
      <section>
        <h2 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
          Prøveperioder som utløper
        </h2>
        {expiringTrials.length === 0 ? (
          <p className="text-sm text-slate-400 italic">
            Ingen prøveperioder som utløper snart.
          </p>
        ) : (
          <div className="space-y-3">
            {expiringTrials.map((sub) => (
              <SubscriptionCard key={sub.id} sub={sub} highlight="trial" />
            ))}
          </div>
        )}
      </section>

      {/* Upcoming charges */}
      <section>
        <h2 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
          Kommende betalinger (7 dager)
        </h2>
        {upcomingCharges.length === 0 ? (
          <p className="text-sm text-slate-400 italic">
            Ingen betalinger de neste 7 dagene.
          </p>
        ) : (
          <div className="space-y-3">
            {upcomingCharges.map((sub) => (
              <SubscriptionCard key={sub.id} sub={sub} highlight="charge" />
            ))}
          </div>
        )}
      </section>

      {/* Empty state */}
      {subscriptions.length === 0 && (
        <div className="card text-center py-12">
          <div className="text-4xl mb-4">📬</div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Ingen abonnementer enda
          </h3>
          <p className="text-slate-500 text-sm mb-4">
            Videresend en kvittering eller abonnementsbekreftelse til din
            Fristvakt-adresse.
          </p>
          {forwardAddress && (
            <code className="text-sm bg-slate-100 rounded px-3 py-2 text-brand-700 font-medium">
              {forwardAddress}
            </code>
          )}
          <p className="text-xs text-slate-400 mt-4">
            <Link href="/app/settings" className="text-brand-600 hover:underline">
              Se instruksjoner i innstillinger
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
