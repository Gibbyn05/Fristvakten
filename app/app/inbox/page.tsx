import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { InboxItem } from "@/components/InboxItem";

export default async function InboxPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const emails = await prisma.inboundEmail.findMany({
    where: { userId: session.user.id },
    orderBy: { receivedAt: "desc" },
    select: {
      id: true,
      from: true,
      subject: true,
      receivedAt: true,
      parseStatus: true,
      parsedJson: true,
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Innboks</h1>
        <p className="text-slate-500 text-sm mt-1">
          Videresentte e-poster og parsestatus
        </p>
      </div>

      {emails.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-4xl mb-4">📭</div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Ingen e-poster mottatt enda
          </h3>
          <p className="text-slate-500 text-sm">
            Videresend en abonnementskvittering til din Fristvakt-adresse.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {emails.map((email) => (
            <InboxItem key={email.id} email={email} />
          ))}
        </div>
      )}
    </div>
  );
}
