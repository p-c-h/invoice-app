const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const InvoiceSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  userDetails: {
    firstName: {
      type: String,
    },
    surname: {
      type: String,
    },
    businessName: {
      type: String,
    },
    nip: {
      type: Number,
    },
    adress: {
      type: String,
    },
    areaCode: {
      type: String,
    },
    city: {
      type: String,
    },
    bankAccountNumber: {
      type: String,
    },
  },
  invoiceNumber: { type: Number, required: true },
  dateCreated: { type: Date, default: Date.now, required: true },
  transactionDate: { type: Date, default: Date.now, required: true },
  paymentDue: {
    type: Date,
    required: true,
  },
  buyer: {
    businessName: {
      type: String,
      required: true,
    },
    nip: {
      type: Number,
      required: true,
    },
    adress: {
      type: String,
      required: true,
    },
    areaCode: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
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
  priceType: {
    type: String,
    enum: ["netto", "brutto"],
    required: true,
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
  paid: {
    type: Number,
    default: 0,
  },
});

module.exports = mongoose.model("Invoice", InvoiceSchema);
