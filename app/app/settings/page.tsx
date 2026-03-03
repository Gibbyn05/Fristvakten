import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CopyButton } from "@/components/CopyButton";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, forwardAddressLocalPart: true, createdAt: true },
  });

  if (!user) return null;

  const inboundDomain = process.env.INBOUND_DOMAIN ?? "inbound.fristvakt.no";
  const forwardAddress = `${user.forwardAddressLocalPart}@${inboundDomain}`;

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Innstillinger</h1>
        <p className="text-slate-500 text-sm mt-1">
          Kontodetaljer og din unike videresendingsadresse
        </p>
      </div>

      {/* Forward address */}
      <div className="card space-y-4">
        <h2 className="text-base font-semibold text-slate-900">
          Din Fristvakt-adresse
        </h2>
        <p className="text-sm text-slate-600">
          Videresend abonnementskvitteringer og prøveperiodebekreftelser til denne
          adressen. Fristvakt oppdager automatisk abonnementer og frister.
        </p>

        <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-4 border border-slate-200">
          <code className="flex-1 text-sm font-medium text-brand-700 break-all">
            {forwardAddress}
          </code>
          <CopyButton text={forwardAddress} />
        </div>

        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800 space-y-2">
          <p className="font-semibold">Slik gjør du det:</p>
          <ol className="list-decimal list-inside space-y-1 text-blue-700">
            <li>Motta en abonnementskvittering eller prøveperiodebekreftelse</li>
            <li>Videresend e-posten til adressen over</li>
            <li>Fristvakt registrerer abonnementet automatisk</li>
            <li>Du får påminnelser før prøveperioder utløper og ved kommende betalinger</li>
          </ol>
        </div>
      </div>

      {/* Account info */}
      <div className="card space-y-4">
        <h2 className="text-base font-semibold text-slate-900">Kontoinformasjon</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">E-postadresse</dt>
            <dd className="font-medium text-slate-900">{user.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Konto opprettet</dt>
            <dd className="font-medium text-slate-900">
              {user.createdAt.toLocaleDateString("no-NO")}
            </dd>
          </div>
        </dl>
      </div>

      {/* Supported providers */}
      <div className="card space-y-3">
        <h2 className="text-base font-semibold text-slate-900">
          E-postleverandør-støtte
        </h2>
        <p className="text-sm text-slate-600">
          Tjenesten bruker inkommende e-post via SendGrid eller Mailgun. Sett miljøvariabelen
          <code className="bg-slate-100 px-1 rounded text-xs mx-1">EMAIL_PROVIDER</code>
          til <code className="bg-slate-100 px-1 rounded text-xs">sendgrid</code> eller
          <code className="bg-slate-100 px-1 rounded text-xs mx-1">mailgun</code>.
        </p>
        <p className="text-sm text-slate-600">
          Se README for fullstendig oppsettsguide.
        </p>
      </div>
    </div>
  );
}
