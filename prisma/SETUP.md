# Stage 1: apply the order foundation with Prisma 7

The schema, migrations and generated client are prepared. No migration has been
applied to your connected database by this task. Apply the migration before
running the changed app: its queries now depend on the new columns.

## What is included

- `0_init`: the original schema, for establishing migration history.
- `202609190001_order_foundation`: deals and their products, coupons, archiving,
  order types, table/delivery details, discounts, cash/change, completion time,
  and immutable order-item snapshots.
- `baseline.prisma`: the original schema, retained only for the comparison below.
  Make future model edits in `schema.prisma`, not in this baseline.

## Your existing database (the expected path for this project)

1. Stop the running app while applying this coordinated schema/code update.
   Use a Neon branch or backup of the existing database first.
2. Check that `DATABASE_URL` points to the database you intend to update.
   `prisma.config.ts` loads `.env`; Next.js can override that with `.env.local`.
   Ensure both commands and the app target the same database. Keep URLs private.
3. From `D:\code\pos`, inspect the migration status and compare your database with
   the original schema:

   ```powershell
   npx prisma migrate status
   npx prisma migrate diff --from-config-datasource --to-schema prisma/baseline.prisma --exit-code
   ```

   The status command can report pending migrations or missing migration history
   at this point. The **diff** must report no difference (exit code 0). Exit code 2
   means the database differs; exit code 1 means the check failed. If it differs,
   stop and reconcile the actual schema before marking anything as applied.
   Also stop if status shows pre-existing migration history absent from this repo;
   recover that history rather than replacing it with this baseline.
4. If the original tables already exist, match `baseline.prisma`, and have no
   previous migration history, register the baseline **once**:

   ```powershell
   npx prisma migrate resolve --applied 0_init
   ```

   This records that your existing tables are already present. It does not
   recreate them. Skip this command if `0_init` is already recorded as applied.
5. Apply the prepared migration and regenerate the local client:

   ```powershell
   npx prisma migrate deploy
   npx prisma generate
   npx prisma migrate status
   ```

6. Verify and restart:

   ```powershell
   npm test
   npx tsc --noEmit
   npm run dev
   ```

Do not use `migrate reset`, `db push --force-reset`, or accept a reset prompt for
this existing database. Use the prepared migration rather than `db push`: the SQL
backfills existing rows before making the new fields required.

Official reference: [Prisma 7 baselining](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/baselining).

## A completely empty database

Do **not** mark the baseline as applied. Both migrations must execute:

```powershell
npx prisma migrate deploy
npx prisma generate
```

## Existing data and compatibility

- Existing order totals and item unit prices are unchanged. Subtotal is backfilled
  from the recorded order total, with zero discount.
- Item names, category names and preparation flags are copied from the current
  catalog. Names that were changed before this migration cannot be reconstructed.
- Historical order type, cash received and completion time remain null because
  they were never recorded. Reporting must distinguish unknown data and explicitly
  choose a timestamp fallback for those old orders.
- Historical line totals use recorded unit price times quantity; existing
  discrepancies between line sums and recorded order totals are not silently fixed.
- The terminal accepts products and active deals and records order details,
  manual discounts or coupons, and cash received/change. Every new order records
  dine-in, takeaway, or delivery; cash orders require enough received cash.
- Orders needing no preparation complete immediately. Other orders stay in the
  existing kitchen pipeline; completion time is saved when marked completed.

## Developer contract for later stages

- `submitCheckout` in terminal actions is the new server entry point. It validates
  unknown input, reads the signed session and rechecks the account role in the DB.
- Deal components and ordinary products share an aggregated stock requirement.
  Stock decrements and order writes run together in a serializable transaction,
  with retries for serialization conflicts. Failed validation never saves an order.
- Money uses integer paisa for calculations and Prisma Decimal for storage.
  Percentage discounts round half up. Item discounts and deal revenue use a
  largest-remainder allocation so their sum is exactly the order amount.
- `Order.items` includes deal components for kitchen/inventory reporting.
  `Order.deals` holds the sold deal name, unit price and quantity. Component
  `lineSubtotal`/`lineTotal` are authoritative; do not multiply their rounded
  `priceAtTime` to calculate deal revenue or sum deal rows a second time.
- Receipt/dashboard readers use `productName`, `categoryName`,
  `requiresPreparation` and stored line totals instead of live catalog values.
- Coupon codes are uppercase with 1–40 letters, digits, hyphens or underscores.
  Expiry is an absolute timestamp and invalid at or after that instant; the coupon
  UI should convert restaurant-local expiry input to UTC. Minimum subtotal is
  evaluated before discounts. A fixed discount above the subtotal is rejected.
- Manual availability and stock are independent at checkout. Menu forms preserve
  the manual switch when changing stock.
- Product/category and deal archiving are implemented. Sold deals keep immutable
  `OrderDeal` snapshots; unused deals can be deleted permanently.

## Verification limits

Unit tests cover calculations and checkout orchestration with a transaction
double. They do not prove PostgreSQL locking, rollback, or migration behavior.
Run `npm run test:menu:db`, `npm run test:deals:db`, and
`npm run test:checkout:db` for opt-in Neon checks; all intentionally roll back
every fixture and mutation.
After migrating a disposable Neon branch, verify a regular sale, a mixed
deal/product sale, failed cash/coupon validation, simultaneous sales for the last
unit, old receipts, and failed-checkout rollback before using the changes live.

Future development migrations can be created with `npx prisma migrate dev --name
descriptive_name` against a development database after this baseline is applied.
Review generated SQL and use `npx prisma migrate deploy` for deployment.
