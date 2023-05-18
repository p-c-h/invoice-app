const { body, validationResult } = require("express-validator");
const Buyer = require("../models/buyer");

exports.buyer_create_post = [
  body("businessName", "Nazwa firmy nie może być pusta.")
    .trim()
    .notEmpty()
    .escape(),

  body("nip", "Pole NIP nie może być puste.").isLength(10).escape(),

  body("adress", "Pole adresu nie może być puste.").trim().notEmpty().escape(),

  body("areaCode", "Pole kodu pocztowego nie może być puste.")
    .trim()
    .notEmpty()
    .escape(),

  body("city", "Pole miasto nie może być puste.").trim().notEmpty().escape(),

  (req, res, next) => {
    const errors = validationResult(req);

    const buyer = new Buyer({
      userId: req.user._id,
      businessName: req.body.businessName,
      nip: req.body.nip,
      adress: req.body.adress,
      areaCode: req.body.areaCode,
      city: req.body.city,
    });

    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    buyer.save((err) => {
      if (err) {
        return next(err);
      }
      return res.json(buyer);
    });
  },
];

exports.buyers_list = (req, res, next) => {
  Buyer.find({ userId: req.user._id })
    .sort([["businessName", "ascending"]])
    .exec(function (err, results) {
      if (err) {
        return res.status(500).json({ error: err }); // If the res.status(500) method is not present, the HTTP status code of the response will default to 200 OK, which indicates that the request was successful. This can be misleading, as it suggests that everything went well on the server, even if an error occurred.
      }
      res.json(results);
    });
};
