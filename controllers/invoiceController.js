const { body, validationResult } = require("express-validator");
const async = require("async");
const Buyer = require("../models/buyer");
const Invoice = require("../models/invoice");
// const PDFDocument = require("pdfkit");
const PDFDocument = require("pdfkit-table");
const path = require("path");

function adjacent(date) {
  const months = [
    "styczeń",
    "luty",
    "marzec",
    "kwiecień",
    "maj",
    "czerwiec",
    "lipiec",
    "sierpień",
    "wrzesień",
    "październik",
    "listopad",
    "grudzień",
  ];
  let month = date.getMonth() + 2; //Dla samego getMonth() jest 6 czyli lipiec, dodac jeden jest 7 czyli sierpien
  let year = date.getFullYear();
  const arr = [];
  if (month > 11) {
    month = 0;
    year++;
  }
  for (n = 0; n < 4; n++) {
    month--;
    if (month < 0) {
      month = 11;
      year--;
    }
    arr.push({
      word: months[month] + " " + year,
      num: year + "-" + month,
    });
  }
  return arr;
}

exports.invoice_create_get = (req, res, next) => {
  const accountingDate = req.user.accountingDate;
  const userId = req.user._id;
  const month = accountingDate.getMonth();
  const year = accountingDate.getFullYear();

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);

  let invoiceNumber;

  ///// MOCK DATA :
  const invoiceData = {
    animal: "cat",
  };
  const dateCreated = "1999-10-01";
  const transactionDate = "1999-10-01";
  /////

  async.parallel(
    [
      function (callback) {
        Invoice.aggregate([
          {
            $match: {
              userId: userId,
              transactionDate: {
                $gte: start,
                $lt: end,
              },
            },
          },
          {
            $group: {
              _id: null,
              maxNumber: { $max: "$invoiceNumber" },
            },
          },
        ]).exec(callback);
      },
      function (callback) {
        Buyer.find({ userId: req.user._id })
          .sort([["businessName", "ascending"]])
          .exec(callback);
      },
    ],
    function (err, results) {
      if (err) {
        return next(err);
      }
      // results eg: [Array(0), Array(1)]
      if (results[0].length) {
        invoiceNumber = results[0][0].maxNumber + 1;
      } else {
        invoiceNumber = 1;
      }

      res.render("invoice_form", {
        user: req.user,
        dateCreated,
        transactionDate,
        ////////
        buyerList: results[1],
        invoiceNumber,
        whatIsThis: results,
        month: month + 1,
        year,
        monthsArr: adjacent(accountingDate),
        ////////
        cat: null,
        accountingDate,
      });
    }
  );
};

function validateDynamicInputs(fieldBases, data, arr) {
  data.fsetIds.split(",").forEach((number) => {
    const obj = {};
    fieldBases.forEach((fieldBase) => {
      body(`${fieldBase}${number}`)
        .notEmpty()
        .trim()
        .escape()
        .withMessage(`Pole: "${fieldBase}${number}" musi być uzupełnione.`);
      obj[`${fieldBase}`] = data[`${fieldBase}${number}`];
    });
    arr.push(obj);
  });
}

const invoiceValidators = [
  body("dateCreated")
    .notEmpty()
    .trim()
    .escape()
    .withMessage('Pole: "Data wystawienia" musi być uzupełnione.')
    .custom((value, { req }) => {
      if (req.body.transactionDate > value) {
        throw new Error(
          "Data wystawienia nie może być wcześniejsza niż data sprzedaży."
        );
      }
      return true;
    }),
  body("transactionDate")
    .notEmpty()
    .trim()
    .escape()
    .withMessage('Pole: "Data sprzedaży" musi być uzupełnione.'),
  body("paymentDue")
    .notEmpty()
    .trim()
    .escape()
    .withMessage('Pole: "Termin płatności" musi być uzupełnione.')
    .custom((value, { req }) => {
      if (req.body.transactionDate > value) {
        throw new Error(
          "Termin płatności nie może być wcześniejszy niż data sprzedaży."
        );
      }
      return true;
    }),
  body("issuePlace")
    .trim()
    .notEmpty()
    .escape()
    .withMessage('Pole: "Miejsce wystawienia faktury" musi być uzupełnione.'),
  body("paymentMethod")
    .trim()
    .notEmpty()
    .escape()
    .withMessage('Pole: "Sposób zapłaty" musi być uzupełnione.'),
];

exports.invoice_create_post = [
  ...invoiceValidators,
  body("buyerId").notEmpty().trim().escape().withMessage("Wskaż nabywcę."),

  (req, res, next) => {
    const fieldsetsArr = [];
    validateDynamicInputs(
      [
        "itemName",
        "gtu",
        "itemQuantity",
        "unit",
        "singleItemPrice",
        "priceType",
        "taxRate",
      ],
      req.body,
      fieldsetsArr
    );

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      invoiceNumber,
      dateCreated,
      transactionDate,
      paymentDue,
      issuePlace,
      paymentMethod,
      netTotal,
      taxTotal,
      grossTotal,
    } = req.body;

    const { businessName, nip, adress, areaCode, city, bankAccountNumber } =
      req.user;

    Buyer.findOne({
      userId: req.user._id,
      _id: req.body.buyerId,
    }).exec(function (err, results) {
      if (err) {
        return next(err);
      }
      const invoice = new Invoice({
        userId: req.user._id,
        userDetails: {
          businessName,
          nip,
          adress,
          areaCode,
          city,
          bankAccountNumber,
        },
        invoiceNumber,
        dateCreated,
        transactionDate,
        paymentDue,
        buyer: {
          businessName: results.businessName,
          nip: results.nip,
          adress: results.adress,
          areaCode: results.areaCode,
          city: results.city,
        },
        issuePlace,
        paymentMethod,
        invoiceItems: fieldsetsArr,
        totals: {
          netTotal,
          taxTotal,
          grossTotal,
        },
      });
      invoice.save((err, result) => {
        if (err) {
          return res.status(500).json({ error: err });
        } else {
          res.redirect(`/faktury/${result._id}`);
        }
      });
    });

    // if (typeof req.params.invoiceId !== "undefined") {
    //   invoice._id = req.params.invoiceId;
    //   Invoice.findByIdAndUpdate(
    //     req.params.invoiceId,
    //     invoice,
    //     {},
    //     (err, theivoice) => {
    //       if (err) {
    //         return next(err);
    //       }
    //       res.redirect(`/faktury/${req.params.invoiceId}`);
    //     }
    //   );
    //   return;
    // }
  },
];

exports.invoice_list = function (req, res, next) {
  const year = Number(req.params.year);
  const month = Number(req.params.month);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);

  Invoice.find({
    userId: req.user._id,
    transactionDate: {
      $gte: start,
      $lt: end,
    },
  })
    .lean()
    .sort([["invoiceNumber", "descending"]])
    .exec((err, invoices) => {
      if (err) {
        return next(err);
      }
      res.render("invoice_list", {
        user: req.user,
        year,
        month,
        invoices,
      });
    });
};

exports.invoice_detail = function (req, res, next) {
  Invoice.findOne({ _id: req.params.invoiceId, userId: req.user._id })
    .populate("buyer")
    .exec((err, result) => {
      if (err) {
        return next(err);
      }
      return res.render("invoice_detail", {
        user: req.user,
        invoice: result,
        month: result.transactionDate.getMonth() + 1,
        year: result.transactionDate.getFullYear(),
      });
    });
};

exports.invoice_pdf = function (req, res, next) {
  const formatDate = (d) =>
    [
      d.getDate().toString().padStart(2, "0"),
      (d.getMonth() + 1).toString().padStart(2, "0"),
      d.getFullYear(),
    ].join("-");

  const doc = new PDFDocument();

  // http://pdfkit.org/demo/browser.html

  res.setHeader("Content-Disposition", 'attachment; filename="my-file.pdf"');

  Invoice.findOne({ _id: req.params.invoiceId, userId: req.user._id }).exec(
    (err, result) => {
      if (err) {
        return next(err);
      }
      const {
        dateCreated,
        invoiceNumber,
        transactionDate,
        paymentMethod,
        paymentDue,
      } = result;

      const month = result.transactionDate.getMonth() + 1;
      const year = result.transactionDate.getFullYear();

      const fontsPath = path.join(__dirname, "..", "fonts");
      const fontPath = path.join(fontsPath, "Roboto-Regular.ttf");

      doc.registerFont("Roboto", fontPath);

      doc.font("Roboto");
      doc.y = 30;
      doc
        .fontSize(8)
        .text(`Wystawiono dnia ${formatDate(dateCreated)}, Kielce`);
      doc.moveDown();

      let xPos = (doc.x = 300);
      doc
        .fontSize(12)
        .text(`Faktura VAT nr ${invoiceNumber + "/" + month + "/" + year}`)
        .moveDown(0.5);
      let yPos = doc.y;
      let offset = 150;

      doc.text("Data sprzedaży:");

      doc.text(formatDate(transactionDate), xPos + offset, yPos);
      yPos = doc.y;

      doc.text("Sposób zapłaty:", xPos);

      doc.text(
        paymentMethod === "transfer" ? "Przelew" : "Gotówka",
        xPos + offset,
        yPos
      );

      yPos = doc.y;
      doc.text("Termin płatności:", xPos);
      doc
        .text(`${formatDate(paymentDue)}`, xPos + offset, yPos)

        .moveDown(0.5);

      xPos = doc.x = 72;
      yPos = doc.y;
      offset = 250;
      doc.fontSize(16).text("Sprzedawca:");
      doc.text("Nabywca:", xPos + offset, yPos).moveDown(0.5);
      yPos = doc.y;
      doc.fontSize(12).text("businessName", xPos);
      doc.text("businessName2", xPos + offset, yPos);
      yPos = doc.y;
      doc.text("adress", xPos);
      doc.text("adress2", xPos + offset, yPos);
      yPos = doc.y;
      doc.text("areaCode + city", xPos);
      doc.text("areaCode2 + city2", xPos + offset, yPos);
      yPos = doc.y;
      doc.text("NIP", xPos);
      doc.text("NIP2", xPos + offset, yPos).moveDown(0.5);
      doc.fontSize(16).text("Pozycje faktury", xPos).moveDown(0.5);

      const table = {
        // title: "Title",
        // subtitle: "Subtitle",
        headers: [
          "Lp.",
          "Nazwa towaru lub usługi",
          "Ilość",
          "Jedn.",
          "Cena",
          "Wartość",
          "Stawka VAT",
        ],
        rows: [["1", "12%", "+1.12%", "4", "5", "6", "7"]],
      };
      // A4 595.28 x 841.89 (portrait) (about width sizes)
      // width
      doc.table(table, {
        width: 300,
      });
      // done!
      doc.pipe(res);
      doc.end();
    }
  );

  // Note that the default page size in PDFKit is letter size (8.5 x 11 inches), which corresponds to 612 x 792 points. However, you can also set a custom page size using the doc.page.size property, which accepts an array of two values representing the width and height of the page in points. For example:
};

exports.invoice_update_get = function (req, res, next) {
  async.parallel(
    {
      invoice(callback) {
        Invoice.findOne({
          _id: req.params.invoiceId,
          userId: req.user._id,
        }).exec(callback);
      },
      buyers(callback) {
        Buyer.find(callback);
      },
    },
    (err, results) => {
      if (err) {
        return next(err);
      }
      const month = results.invoice.transactionDate.getMonth() + 1;
      const year = results.invoice.transactionDate.getFullYear();
      res.render("invoice_form", {
        user: req.user,
        invoice: results.invoice,
        month,
        year,
        buyerList: results.buyers,
      });
    }
  );
};

exports.invoice_update_post = [
  ...invoiceValidators,
  body("buyerId").trim().escape(),
  (req, res, next) => {
    const fieldsetsArr = [];
    validateDynamicInputs(
      [
        "itemName",
        "gtu",
        "itemQuantity",
        "unit",
        "singleItemPrice",
        "priceType",
        "taxRate",
      ],
      req.body,
      fieldsetsArr
    );

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      invoiceNumber,
      dateCreated,
      transactionDate,
      paymentDue,
      issuePlace,
      paymentMethod,
      netTotal,
      taxTotal,
      grossTotal,
    } = req.body;

    const { businessName, nip, adress, areaCode, city, bankAccountNumber } =
      req.user;

    const invoice = new Invoice({
      _id: req.params.invoiceId,
      userId: req.user._id,
      userDetails: {
        businessName,
        nip,
        adress,
        areaCode,
        city,
        bankAccountNumber,
      },
      invoiceNumber,
      dateCreated,
      transactionDate,
      paymentDue,
      issuePlace,
      paymentMethod,
      invoiceItems: fieldsetsArr,
      totals: {
        netTotal,
        taxTotal,
        grossTotal,
      },
    });

    if (req.body.buyerId) {
      Buyer.findOne({
        userId: req.user._id,
        _id: req.body.buyerId,
      }).exec(function (err, results) {
        if (err) {
          return next(err);
        }
        invoice.buyer = {
          businessName: results.businessName,
          nip: results.nip,
          adress: results.adress,
          areaCode: results.areaCode,
          city: results.city,
        };

        Invoice.findByIdAndUpdate(req.params.invoiceId, invoice, {}, (err) => {
          if (err) {
            return next(err);
          }
          return res.redirect(`/faktury/${req.params.invoiceId}`);
        });
      });
    } else {
      Invoice.findByIdAndUpdate(req.params.invoiceId, invoice, {}, (err) => {
        if (err) {
          return next(err);
        }
        return res.redirect(`/faktury/${req.params.invoiceId}`);
      });
    }
  },
];

exports.invoice_delete_post = (req, res, next) => {
  Invoice.findByIdAndRemove(req.params.invoiceId, (err) => {
    if (err) {
      return next(err);
    }
    res.redirect(`/lista-faktur/${req.params.year}/${req.params.month}`);
  });
};
