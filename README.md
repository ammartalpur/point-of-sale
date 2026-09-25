# POS Control

Restaurant point-of-sale application built with Next.js 16, React 19, Prisma 7,
Neon PostgreSQL and Tailwind CSS.

## Features

- Cashier terminal with dine-in, takeaway and delivery orders
- Cash/card payments, discounts, coupons, received cash and change
- Product, category, stock, availability and image management
- Combo/deal management with stock-aware availability
- Kitchen order pipeline and printable kitchen tickets
- Customer receipts with immutable sale snapshots
- Real dashboard metrics, charts, inventory alerts and live order queue

## Local setup

Requires Node.js 20.19 or newer.

```bash
npm ci
cp .env.example .env.local
npm run deploy:migrate
npm run dev
```

Set the variables described in `.env.example` before running migrations. On a
new database, `prisma migrate deploy` applies both committed migrations. On the
existing database used during development, the baseline is already registered;
see `prisma/SETUP.md` for its migration history.

The `/register` page creates the first administrator only. Once any profile
exists, public registration is disabled.

## Deploy to Vercel

1. Push this repository to GitHub, GitLab or Bitbucket and import it into Vercel.
2. Keep the detected framework preset as **Next.js** and the project root as the
   repository root.
3. Set the Node.js version to 20.19 or newer.
4. Add these environment variables for Production and any Preview environment
   that should run the application:

   | Variable | Required | Purpose |
   | --- | --- | --- |
   | `DATABASE_URL` | Yes | Neon pooled PostgreSQL URL ending in the `-pooler` host |
   | `JWT_SECRET` | Yes | Unique random secret of at least 32 characters |
   | `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Optional | Enables direct image uploads |
   | `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | Optional | Cloudinary unsigned upload preset |

   Generate the session secret locally with `openssl rand -base64 32`. Do not
   commit its value. Public Cloudinary variables are included in the browser
   bundle and must never contain a Cloudinary API secret.
5. Apply committed database migrations once before sending production traffic:

   ```bash
   npm run deploy:migrate
   ```

   Run this from a trusted machine or CI job with the production
   `DATABASE_URL`. Database migrations are deliberately separate from the
   Vercel build so Preview deployments cannot modify production schema.
6. Deploy. `postinstall` generates Prisma Client and `npm run build` produces the
   Vercel Next.js output.

For Preview deployments, use a separate Neon branch/database when they may
create or modify data. Environment-variable changes only affect new Vercel
deployments, so redeploy after changing them.

## Verification

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Database integration checks are opt-in and roll back their fixtures:

```bash
npm run test:menu:db
npm run test:deals:db
npm run test:checkout:db
```

`npm run seed:dashboard` writes persistent catalog and sales data. Do not run it
automatically during deployment.
