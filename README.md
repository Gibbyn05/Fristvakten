# Fristvakt

**Fristvakt** ("deadline watcher") is a minimal web app that tracks your subscription trials and upcoming charges. You forward subscription confirmation emails to your unique address, and Fristvakt does the rest.

## Features

- **Unique forward address** for each user
- **Email ingestion** via SendGrid Inbound Parse or Mailgun Routes
- **Smart parsing** of subscription info (merchant, price, trial dates, billing cycle)
- **Dashboard** with monthly totals, trial countdowns, upcoming charges
- **Daily notifications** for trial expiry (7d, 2d, 0d) and upcoming charges (3d)
- **Needs-review workflow** for low-confidence parses (one-click edit)
- **Privacy-first**: raw email text is retained but can be deleted per email

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 App Router + TypeScript |
| Database | Prisma + SQLite (dev) / PostgreSQL (prod) |
| Auth | NextAuth v4 with credentials provider |
| Styling | Tailwind CSS |
| Email out | Nodemailer (SMTP) |
| Email in | SendGrid Inbound Parse or Mailgun |
| Testing | Jest + ts-jest |

---

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url>
cd fristvakt
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

| Variable | Description |
|---|---|
| `DATABASE_URL` | SQLite: `file:./dev.db` or PostgreSQL URL |
| `NEXTAUTH_SECRET` | Random string (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Your app URL, e.g. `http://localhost:3000` |
| `INBOUND_DOMAIN` | Domain for inbound emails, e.g. `inbound.yourdomain.com` |
| `EMAIL_PROVIDER` | `sendgrid` or `mailgun` |
| `SMTP_HOST` | SMTP server for outbound email |
| `SMTP_USER` / `SMTP_PASS` | SMTP credentials |
| `CRON_SECRET` | Secret for the cron endpoint |

### 3. Set up the database

```bash
# Generate Prisma client
npm run db:generate

# Create/migrate database
npm run db:push

# (Optional) Seed with sample data
npm run db:seed
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Setting Up Inbound Email

### Option A: SendGrid Inbound Parse

1. Verify your domain in SendGrid and set up MX records for your `INBOUND_DOMAIN`
2. Go to **Settings → Inbound Parse** in SendGrid
3. Set the Webhook URL to: `https://yourdomain.com/api/inbound-email`
4. Enable **POST the raw, full MIME message**

### Option B: Mailgun Routes

1. Add your domain in Mailgun and configure MX records for `INBOUND_DOMAIN`
2. Create a Route in Mailgun:
   - **Expression**: `match_recipient(".*@yourinbounddomain.com")`
   - **Actions**: Forward to `https://yourdomain.com/api/inbound-email`
3. Set `EMAIL_PROVIDER=mailgun` in your env
4. Set `MAILGUN_WEBHOOK_SECRET` for signature verification

---

## How to Test

### Run unit tests

```bash
npm test
```

### Simulate an inbound email payload

```bash
# SendGrid format
curl -X POST http://localhost:3000/api/inbound-email \
  -F "from=TV2 Play <noreply@tv2.no>" \
  -F "to=<YOUR_LOCAL_PART>@inbound.fristvakt.no" \
  -F "subject=Velkommen til TV2 Play! 3 måneder gratis" \
  -F "text=Hei! Du har nå aktivert 3 måneder gratis TV2 Play Total. Etter prøveperioden vil du bli belastet 299 kr/måned. Første betaling: 15.09.2025. Avslutt: https://tv2.no/cancel/abc"

# Mailgun format
curl -X POST http://localhost:3000/api/inbound-email \
  -F "From=noreply@netflix.com" \
  -F "recipient=<YOUR_LOCAL_PART>@inbound.fristvakt.no" \
  -F "Subject=Your Netflix receipt" \
  -F "body-plain=Your Netflix Standard plan costs \$15.49/month. Next charge: March 15, 2025."
```

Replace `<YOUR_LOCAL_PART>` with the value shown in **Settings** after creating an account.

### Trigger the notification job manually

```bash
# With CRON_SECRET
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/notifications

# Without CRON_SECRET (when env var is empty)
curl http://localhost:3000/api/cron/notifications
```

---

## Deploying to Production

### Vercel

1. Push to GitHub and connect to Vercel
2. Add all environment variables in Vercel dashboard
3. Set `DATABASE_URL` to a PostgreSQL connection string
4. Update `prisma/schema.prisma` datasource to `provider = "postgresql"`
5. Add a cron job in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/notifications",
      "schedule": "0 8 * * *"
    }
  ]
}
```

### Server (systemd)

```bash
# Build
npm run build

# Run migrations
npm run db:migrate:deploy

# Start server
npm start

# Add systemd timer for daily notifications
# /etc/systemd/system/fristvakt-notifications.timer
[Unit]
Description=Fristvakt daily notifications

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
```

---

## Privacy

- Raw email bodies are stored per inbound email record
- Users can delete individual emails via the **Inbox** page
- The `/api/inbox/:id` DELETE endpoint clears `rawText` before deleting the record
- No OAuth access to Gmail/Outlook is used; users forward emails manually

---

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/  NextAuth handler
│   │   ├── register/            User registration
│   │   ├── inbound-email/       Webhook for incoming emails
│   │   ├── subscriptions/       CRUD for subscriptions
│   │   ├── inbox/               Inbox email list + delete
│   │   ├── me/                  Current user info
│   │   └── cron/notifications/  Daily notification job
│   ├── app/                     Authenticated app pages
│   │   ├── dashboard/
│   │   ├── inbox/
│   │   ├── subscriptions/
│   │   └── settings/
│   ├── login/                   Auth pages
│   └── register/
├── components/                  Reusable React components
├── lib/
│   ├── auth.ts                  NextAuth config
│   ├── db.ts                    Prisma client singleton
│   ├── email.ts                 Nodemailer + email templates
│   ├── notifications.ts         Daily notification job logic
│   └── parser.ts                Email parser (heuristics)
├── prisma/
│   ├── schema.prisma            Data model
│   └── seed.ts                  Sample data
└── __tests__/                   Jest unit tests
```
