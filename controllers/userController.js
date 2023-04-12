const User = require("../models/user");
const { body, validationResult } = require("express-validator");
const passport = require("passport");
const flash = require("connect-flash");

exports.user_create_get = (req, res, next) => {
  if (req.user) {
    const year = req.user.accountingDate.getFullYear();
    const month = req.user.accountingDate.getMonth() + 1;
    return res.redirect(`/lista-faktur/${year}/${month}`);
  }
  return res.render("sign_up", { message: req.flash("info") });
};

exports.user_create_post = [
  body("username")
    .trim()
    .notEmpty()
    .escape()
    .withMessage("Wybierz nazwę użytkownika")
    .isAlphanumeric()
    .withMessage(
      "Nazwa użytkownika może zawieać jedynie litery od A-Z i cyfry od 0-9"
    ),
  body("password")
    .trim()
    .isLength({ min: 6 })
    .escape()
    .withMessage("Hasło musi mieć przynajmniej 6 znaków."),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render("sign_up", {
        errors: errors.array(),
      });
    }

    User.findOne({ username: req.body.username }, (err, results) => {
      if (err) {
        return next(err);
      } else if (results) {
        req.flash("info", "Nazwa użytkownika zajęta.");
        return res.redirect("/rejestracja");
      }

      const td = new Date();
      td.setDate(5); // 1 hour time difference compared to UTC. I have to account for my locale because mongodb store date as UTC timestamp.

      const user = new User({
        username: req.body.username,
        password: req.body.password,
        nip: null,
        businessName: null,
        adress: null,
        areaCode: null,
        city: null,
        bankAccountNumber: null,
        accountingDate: td,
        profileComplete: false,
      });

      user.save((err) => {
        if (err) {
          return next(err);
        }
        res.redirect("/");
      });
    });
  },
];

exports.user_detail_get = (req, res, next) => {
  res.render("user_detail", {
    user: req.user,
  });
};

exports.user_detail_update_post = [
  body("firstName", "Pole imię nie może być puste.").trim().notEmpty().escape(),

  body("surname", "Pole nazwisko nie może być puste.")
    .trim()
    .notEmpty()
    .escape(),

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

  body("bankAccountNumber", "Pole numeru rachunku nie może być puste.")
    .trim()
    .isLength(26)
    .escape()
    .withMessage("Numer konta bankowego powinien mieć 26 cyfr."),

  (req, res, next) => {
    const errors = validationResult(req);

    const user = new User({
      firstName: req.body.firstName,
      surname: req.body.surname,
      businessName: req.body.businessName,
      nip: req.body.nip,
      adress: req.body.adress,
      areaCode: req.body.areaCode,
      city: req.body.city,
      bankAccountNumber: req.body.bankAccountNumber,
      profileComplete: true,
      _id: req.user.id,
    });

    if (!errors.isEmpty()) {
      res.render("user_detail", {
        user,
        errors: errors.array(),
      });
      return;
    }
    User.findByIdAndUpdate(req.user.id, user, {}, (err, theuser) => {
      if (err) {
        return next(err);
      }

      res.redirect("/uzytkownik");
    });
  },
];

exports.user_accountingdate_update = [
  body("accountingDate")
    .notEmpty()
    .trim()
    .escape()
    .withMessage('Pole: "Miesiąc księgowy" musi być uzupełnione.'),
  (req, res, next) => {
    const errors = validationResult(req);
    const arr = req.body.accountingDate.split("-");
    const user = new User({
      accountingDate: new Date(arr[0], arr[1], 5),
      _id: req.user._id,
    });
    if (!errors.isEmpty()) {
      res.render("invoice_form", {
        user: req.user,
        errors: errors.array(),
      });
      return;
    }
    User.findByIdAndUpdate(req.user.id, user, {}, (err) => {
      if (err) {
        return next(err);
      }
      res.redirect("/wystaw-fakture");
    });
  },
];
