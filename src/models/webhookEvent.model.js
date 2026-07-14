const mongoose = require('mongoose');

const webhookEventSchema = new mongoose.Schema(
   {
      eventId: {
         type: String,
         unique: true,
         required: true
      },
      // Informational only - lets you grep/filter the audit log by
      // event type without joining back to Stripe. Not used for any
      // correctness decision (see the idempotency-model comment at the
      // top of webhook.routes.js) - writes are idempotent by design,
      // this table is no longer a processing gate.
      eventType: {
         type: String,
         default: null
      }
   },
   {
      timestamps: true
   }
);

module.exports = mongoose.model('WebhookEvent', webhookEventSchema);
