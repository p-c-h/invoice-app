const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const BuyerSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
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
});

module.exports = mongoose.model("Buyer", BuyerSchema);
