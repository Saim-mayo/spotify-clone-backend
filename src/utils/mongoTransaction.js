const mongoose = require('mongoose');

/**
 * =====================================
 * 🔁 TRANSACTION-LEVEL RETRY
 * =====================================
 * WHY THIS REPLACES THE OLD retryWriteConflict() HELPER:
 * - The old helper retried a single write while staying inside the SAME
 *   Mongo session/transaction that had already thrown a write conflict.
 *   That doesn't work: a write conflict (error 112) inside a multi-
 *   document transaction is a TransientTransactionError, which means the
 *   transaction's snapshot is stale and MongoDB's own driver guidance is
 *   that the ENTIRE transaction must be retried from
 *   `startTransaction()`, not just the operation that happened to throw.
 *   Retrying only the inner write can succeed against a doomed
 *   transaction and then fail (or worse, partially commit) later.
 * - It was also only wired into 2 of the 3 write paths in
 *   payment.service.js, so the most common path (renewals / plan
 *   changes, which look the user up by stripeSubscriptionId) had no
 *   retry coverage at all.
 *
 * USAGE:
 *   await withTransactionRetry(async (session) => {
 *     // ...all your session-scoped reads/writes here...
 *   });
 *
 * The callback receives a fresh ClientSession every attempt. Do NOT
 * perform live external API calls (e.g. Stripe reads) inside the
 * callback — fetch everything you need from Stripe BEFORE calling this,
 * and only do Mongo I/O inside. Holding a transaction open across a
 * network round-trip to a third party is itself a major source of write
 * conflicts under load.
 */
async function withTransactionRetry(fn, { maxAttempts = 3 } = {}) {

   let lastErr;

   for (let attempt = 1; attempt <= maxAttempts; attempt++) {

      const session = await mongoose.startSession();

      try {

         session.startTransaction();

         const result = await fn(session);

         await session.commitTransaction();

         return result;

      } catch (err) {

         lastErr = err;

         if (session.inTransaction()) {
            await session.abortTransaction();
         }

         const isTransient =
            err?.errorLabels?.includes?.('TransientTransactionError') ||
            err?.code === 112;

         if (isTransient && attempt < maxAttempts) {
            console.warn(
               `Retrying transaction after write conflict (${attempt}/${maxAttempts})`
            );
            continue;
         }

         throw err;

      } finally {

         await session.endSession();

      }
   }

   throw lastErr;
}

module.exports = { withTransactionRetry };
