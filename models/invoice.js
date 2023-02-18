const mongoose = require("mongoose");

const Schema = mongoose.Schema;

// const InvoiceItemSchema = new Schema({
//   itemName: {
//     type: String,
//     required: true,
//   },
//   itemQuantity: {
//     type: Number,
//     required: true,
//   },
//   unit: {
//     type: String,
//     required: true,
//   },
//   vat: {
//     type: Number,
//     required: true,
//     default: 23,
//   },
// });

const InvoiceSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  invoiceNumber: { type: Number, required: true },
  dateCreated: { type: Date, default: Date.now, required: true },
  transactionDate: { type: Date, default: Date.now, required: true },
  paymentDue: {
    type: Date,
    required: true,
  },
  buyer: {
    type: Schema.Types.ObjectId,
    ref: "Buyer",
    // required: true,
  },
  issuePlace: {
    type: String,
    required: true,
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ["transfer", "cash"],
    default: "transfer",
  },
  invoiceItems: {
    type: [
      {
        itemName: {
          type: String,
          required: true,
        },

        gtu: {
          type: String,
          required: true,
        },

        itemQuantity: {
          type: Number,
          min: 1,
          required: true,
        },
        unit: {
          type: String,
          required: true,
        },

        singleItemPrice: {
          type: Number,
          required: true,
        },

        priceType: {
          type: String,
          enum: ["netto", "brutto"],
          default: "netto",
          required: true,
        },

        taxRate: {
          type: Number,
          required: true,
          default: 23,
        },
      },
    ],
    required: true,
  },
  totals: {
    netTotal: { type: Number },
    taxTotal: { type: Number },
    grossTotal: { type: Number },
  },
});

module.exports = mongoose.model("Invoice", InvoiceSchema);
