const flash = require("connect-flash");
const express = require("express");
const router = express.Router();
const user_controller = require("../controllers/userController");
const invoice_controller = require("../controllers/invoiceController");
const buyer_controller = require("../controllers/buyerController");

//
const test_controller = require("../controllers/testController");
//

const User = require("../models/user");

router.get("/", function (req, res, next) {
  if (req.user) {
    const accountingDate = req.user.accountingDate;
    const year = accountingDate.getFullYear();
    const month = accountingDate.getMonth();
    res.redirect(`/lista-faktur/${year}/${month + 1}`);
  } else {
    res.render("login", {
      title: "Logowanie",
      message: req.flash("error"),
    });
  }
});

router.get("/rejestracja", user_controller.user_create_get);

router.post("/rejestracja", user_controller.user_create_post);

router.all("*", function (req, res, next) {
  if (!req.user) res.redirect("/");
  else next();
});

// PROTECTED ROUTES due to routes order

router.get("/lista-faktur/:year/:month", invoice_controller.invoice_list);

router.get("/wystaw-fakture", invoice_controller.invoice_create_get);

router.post("/wystaw-fakture", invoice_controller.invoice_create_post);

router.get("/faktury/:invoiceId", invoice_controller.invoice_detail);

router.get("/faktury/:invoiceId/pdf", invoice_controller.invoice_pdf);

router.get("/faktury/:invoiceId/edytuj", invoice_controller.invoice_update_get);

router.post(
  "/faktury/:invoiceId/edytuj",
  invoice_controller.invoice_update_post
);

router.post(
  "/faktury/:year/:month/:invoiceId/usun",
  invoice_controller.invoice_delete_post
);

router.post("/nowy-kontrahent", buyer_controller.buyer_create_post);

router.get("/kontrahenci", buyer_controller.buyers_list);

router.get("/uzytkownik", user_controller.user_detail_get);

router.post("/uzytkownik", user_controller.user_detail_update_post);

router.post("/miesiac-ksiegowy", user_controller.user_accountingdate_update);

module.exports = router;
