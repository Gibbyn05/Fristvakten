import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SubscriptionCard } from "@/components/SubscriptionCard";

export default async function SubscriptionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const subscriptions = await prisma.subscription.findMany({
    where: { userId: session.user.id },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  const active = subscriptions.filter((s) => s.status === "active");
  const canceled = subscriptions.filter((s) => s.status !== "active");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Abonnementer</h1>
        <p className="text-slate-500 text-sm mt-1">
          Alle dine registrerte abonnementer
        </p>
      </div>

      {/* Needs review */}
      {active.filter((s) => s.confidence < 0.8).length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-600 mb-3">
            Trenger bekreftelse
          </h2>
          <div className="space-y-3">
            {active
              .filter((s) => s.confidence < 0.8)
              .map((sub) => (
                <SubscriptionCard key={sub.id} sub={sub} showConfirmPrompt editable />
              ))}
          </div>
        </section>
      )}

      {/* Active */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">
          Aktive ({active.length})
        </h2>
        {active.length === 0 ? (
          <p className="text-sm text-slate-400 italic">Ingen aktive abonnementer.</p>
        ) : (
          <div className="space-y-3">
            {active
              .filter((s) => s.confidence >= 0.8)
              .map((sub) => (
                <SubscriptionCard key={sub.id} sub={sub} editable />
              ))}
          </div>
        )}
      </section>

      {/* Canceled */}
      {canceled.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">
            Avsluttede ({canceled.length})
          </h2>
          <div className="space-y-3 opacity-60">
            {canceled.map((sub) => (
              <SubscriptionCard key={sub.id} sub={sub} />
            ))}
          </div>
        </section>
      )}

      {subscriptions.length === 0 && (
        <div className="card text-center py-12">
          <div className="text-4xl mb-4">📋</div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Ingen abonnementer registrert
          </h3>
          <p className="text-slate-500 text-sm">
            Videresend en e-postkvittering til din Fristvakt-adresse for å komme i gang.
          </p>
        </div>
      )}
    </div>
  );
}
