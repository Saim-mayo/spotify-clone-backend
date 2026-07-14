const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({

   userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
   },

   stripeSessionId: {
      type: String,
      default: null
   },

   stripeCustomerId: {
      type: String,
      default: null,
      index: true
   },

   stripeSubscriptionId: {
      type: String,
      default: null,
      index: true
   },

   stripeEventId: {
      type: String,
      default: null
   },

   invoiceId: {
      type: String,
      default: null
   },

   // Not a fixed enum — see user.model.js's `plan` field comment. Plan
   // tiers are whatever Products currently exist in Stripe.
   plan: {
      type: String,
      lowercase: true,
      trim: true,
      required: true
   },

   billingInterval: {
      type: String,
      enum: ['monthly', 'yearly'],
      required: true
   },

   amount: {
      type: Number,
      required: true,
      min: 0
   },

   currency: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
   },

   status: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending'
   }

}, {
   timestamps: true
});

paymentSchema.index({
   userId: 1,
   createdAt: -1
});

/*
 Only real Checkout Sessions must be unique.
 Multiple null values are allowed.
*/
paymentSchema.index(
   { stripeSessionId: 1 },
   {
      unique: true,
      partialFilterExpression: {
         stripeSessionId: {
            $type: "string"
         }
      }
   }
);

paymentSchema.index(
   { stripeEventId: 1 },
   {
      unique: true,
      partialFilterExpression: {
         stripeEventId: { $type: 'string' }
      }
   }
);

paymentSchema.index(
   { invoiceId: 1 },
   {
      unique: true,
      partialFilterExpression: {
         invoiceId: {
            $type: "string"
         }
      }
   }
);

module.exports = mongoose.model('Payment', paymentSchema);