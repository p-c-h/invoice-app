const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const UserSchema = new Schema({
  username: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  //
  firstName: {
    type: String,
    required: true,
  },
  surname: {
    type: String,
    required: true,
  },
  //
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
  accountingDate: {
    type: Date,
  },
  profileComplete: {
    type: Boolean,
    required: true,
  },
});

module.exports = mongoose.model("User", UserSchema);
