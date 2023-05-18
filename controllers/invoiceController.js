const { body, validationResult } = require("express-validator");
const async = require("async");
const Buyer = require("../models/buyer");
const Invoice = require("../models/invoice");
const { formatPrice, formatAccNum } = require("../utils/utils");
const path = require("path");

var pdfMake = require("pdfmake/build/pdfmake.js");
var pdfFonts = require("pdfmake/build/vfs_fonts.js");
pdfMake.vfs = pdfFonts.pdfMake.vfs;

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
        buyerList: results[1],
        invoiceNumber,
        month: month + 1,
        year,
        monthsArr: adjacent(accountingDate),
        accountingDate,
        isInvoiceForm: true,
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
    .withMessage('Pole: "Data sprzedaży" musi być uzupełnione.')
    .custom((value, { req }) => {
      const td = new Date(value);
      const ad = new Date(req.user.accountingDate);
      if (td.getMonth() !== ad.getMonth()) {
        throw new Error(
          `Data sprzedaży musi być zgodna z miesiącem i rokiem księgowym.`
        );
      }
      return true;
    }),
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
  body("priceType")
    .trim()
    .notEmpty()
    .escape()
    .withMessage('Pole: "netto/brutto" musi być uzupełnione.'),
  body("paid").trim().escape(),
];

exports.invoice_create_post = [
  ...invoiceValidators,
  body("buyerId").notEmpty().trim().escape().withMessage("Wskaż nabywcę."),

  (req, res, next) => {
    const fieldsetsArr = [];
    validateDynamicInputs(
      ["itemName", "gtu", "itemQuantity", "unit", "singleItemPrice", "taxRate"],
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
      priceType,
      netTotal,
      taxTotal,
      grossTotal,
      paid,
    } = req.body;

    const {
      firstName,
      surname,
      businessName,
      nip,
      adress,
      areaCode,
      city,
      bankAccountNumber,
    } = req.user;

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
          firstName,
          surname,
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
        priceType,
        invoiceItems: fieldsetsArr,
        totals: {
          netTotal,
          taxTotal,
          grossTotal,
        },
        paid,
      });
      invoice.save((err, result) => {
        if (err) {
          return res.status(500).json({ error: err });
        } else {
          res.redirect(`/faktury/${result._id}`);
        }
      });
    });
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
        formatPrice,
        isInvoiceList: true,
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
        formatPrice,
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

  function round(num) {
    return (Math.round((num + Number.EPSILON) * 100) / 100).toFixed(2);
  }

  Invoice.findOne({ _id: req.params.invoiceId, userId: req.user._id }).exec(
    (err, result) => {
      if (err) {
        return next(err);
      }
      const {
        userDetails,
        invoiceNumber,
        dateCreated,
        transactionDate,
        paymentDue,
        buyer,
        issuePlace,
        paymentMethod,
        priceType,
        invoiceItems,
        totals,
        paid,
      } = result;

      const month = result.transactionDate.getMonth() + 1;
      const year = result.transactionDate.getFullYear();

      const invoiceItemsRows = [];
      let lp = 1;
      const storObj = {};
      const storArr = [];

      invoiceItems.forEach((item) => {
        // POZYCJE FAKTURY table ⬇️
        invoiceItemsRows.push([
          { text: `${lp++}.`, alignment: "center", style: "tableText" },
          {
            text: `${item.itemName}`,
            style: "tableText",
            alignment: "left",
          },
          {
            text: `${item.itemQuantity}`,
            alignment: "right",
            style: "tableText",
          },
          { text: `${item.unit}`, alignment: "right", style: "tableText" },
          {
            text: `${formatPrice(item.singleItemPrice)}`,
            alignment: "right",
            style: "tableText",
          },
          {
            text: `${formatPrice(item.itemQuantity * item.singleItemPrice)}`,
            alignment: "right",
            style: "tableText",
          },
          {
            text: `${item.taxRate * 100}%`,
            alignment: "right",
            style: "tableText",
          },
        ]);
        // PODSUMOWANIE table ⬇️
        if (storObj.hasOwnProperty(item.taxRate)) {
          storObj[item.taxRate] += item.singleItemPrice * item.itemQuantity;
        } else {
          storObj[item.taxRate] =
            Number(item.singleItemPrice) * Number(item.itemQuantity);
        }
      });

      for (const [key, value] of Object.entries(storObj)) {
        const taxRate = Number(key);
        const entryNet =
          priceType === "netto" ? value : round(value) / (1 + taxRate);
        const entryTax = round(entryNet * taxRate);
        const entryGross = Number(entryNet) + Number(entryTax);
        storArr.push([
          "",
          {
            text: `${taxRate * 100}%`,
            style: "tableText",
            alignment: "center",
          },
          { text: `${formatPrice(entryNet)}`, style: "tableText" },
          { text: `${formatPrice(entryTax)}`, style: "tableText" },
          { text: `${formatPrice(entryGross)}`, style: "tableText" },
        ]);
      }

      const docDefinition = {
        content: [
          {
            text: `Wystawiono dnia ${formatDate(dateCreated)}, ${issuePlace}`,
            margin: [0, 0, 0, 20],
          },
          {
            columns: [
              {},
              {
                stack: [
                  {
                    text: `Faktura VAT nr ${
                      invoiceNumber + "/" + month + "/" + year
                    }`,
                    style: "header",
                  },
                  {
                    columns: [
                      {
                        stack: [
                          "Data sprzedaży:",
                          "Sposób zapłaty:",
                          "Termin płatności:",
                        ],
                        width: "auto",
                        fontSize: 11,
                      },
                      {
                        stack: [
                          `${formatDate(transactionDate)}`,
                          `${
                            paymentMethod === "transfer" ? "Przelew" : "Gotówka"
                          }`,
                          `${formatDate(paymentDue)}`,
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
            lineHeight: 1.3,
          },
          {
            columns: [
              {
                stack: [
                  {
                    text: "Sprzedawca:",
                    style: "header",
                  },
                  `${userDetails.businessName}`,
                  `${userDetails.adress}`,
                  `${userDetails.areaCode + " " + userDetails.city}`,
                  `NIP ${userDetails.nip}`,
                ],
                fontSize: 11,
              },
              {
                stack: [
                  {
                    text: "Nabywca:",
                    style: "header",
                  },
                  `${buyer.businessName}`,
                  `${buyer.adress}`,
                  `${buyer.areaCode + " " + buyer.city}`,
                  `NIP ${buyer.nip}`,
                ],
                fontSize: 11,
              },
            ],
          },

          { text: "POZYCJE FAKTURY", style: "header" },
          {
            table: {
              widths: ["auto", "*", "auto", "auto", "auto", "auto", "auto"],
              body: [
                [
                  { text: "Lp.", style: "tableHeader" },
                  {
                    text: "Nazwa towaru lub usługi",
                    style: "tableHeader",
                    alignment: "left",
                  },
                  { text: "Ilość", style: "tableHeader" },
                  { text: "Jedn.", style: "tableHeader" },
                  {
                    stack: ["Cena", `jedn.  ${result.priceType}`],
                    style: "tableHeader",
                  },
                  {
                    stack: ["Wartość", `${result.priceType}`],
                    style: "tableHeader",
                  },
                  { stack: ["Stawka", "VAT"], style: "tableHeader" },
                ],
                ...invoiceItemsRows,
              ],
            },
            layout: {
              fillColor: function (rowIndex, node, columnIndex) {
                return rowIndex % 2 === 0 ? null : "#DDD";
              },
              hLineWidth: function (i, node) {
                return i === 0 || i === node.table.body.length ? 1 : 0;
              },
              vLineWidth: function (i, node) {
                return i === 0 || i === node.table.widths.length ? 1 : 0;
              },
              hLineColor: function (i, node) {
                return i === 0 || i === node.table.body.length
                  ? "#CCC"
                  : "gray";
              },
              vLineColor: function (i, node) {
                return i === 0 || i === node.table.widths.length
                  ? "#CCC"
                  : "gray";
              },
            },
          },
          { text: "PODSUMOWANIE", style: "header" },

          {
            table: {
              widths: ["auto", "*", "*", "*", "*"],
              body: [
                [
                  "",
                  {
                    text: "Stawka VAT",
                    style: "tableText",
                    bold: true,
                    alignment: "center",
                  },
                  { text: "Wartość netto", style: "tableText", bold: true },
                  { text: "VAT", style: "tableText", bold: true },
                  { text: "Wartość brutto", style: "tableText", bold: true },
                ],
                ...storArr,
                [
                  { text: "Razem:", style: "tableText", bold: true },
                  "",
                  {
                    text: `${formatPrice(totals.netTotal)}`,
                    style: "tableText",
                    bold: true,
                  },
                  {
                    text: `${formatPrice(totals.taxTotal)}`,
                    style: "tableText",
                    bold: true,
                  },
                  {
                    text: `${formatPrice(totals.grossTotal)}`,
                    style: "tableText",
                    bold: true,
                  },
                ],
                [
                  { text: "Zapłacono:", style: "tableText", bold: true },
                  {
                    colSpan: 4,
                    text: `${formatPrice(paid)}`,
                    style: "tableText",
                  },
                  "",
                  "",
                  "",
                ],
                [
                  {
                    text: "Pozostało do zapłaty:",
                    style: "tableText",
                    bold: true,
                  },
                  {
                    colSpan: 4,
                    text: `${formatPrice(totals.grossTotal - paid)}`,
                    style: "tableText",
                  },
                  "",
                  "",
                  "",
                ],
                [
                  { text: "Konto bankowe:", style: "tableText", bold: true },
                  {
                    colSpan: 4,
                    text: `${formatAccNum(req.user.bankAccountNumber)}`,
                    style: "tableText",
                  },
                  "",
                  "",
                  "",
                ],
                [
                  { text: "Uwagi:", style: "tableText", bold: true },
                  { colSpan: 4, text: "", style: "tableText" },
                  "",
                  "",
                  "",
                ],
              ],
            },
            layout: {
              fillColor: function (rowIndex, node, columnIndex) {
                return rowIndex % 2 === 0 ? null : "#DDD";
              },
              hLineWidth: function (i, node) {
                return i === 0 || i === node.table.body.length ? 1 : 0;
              },
              vLineWidth: function (i, node) {
                return i === 0 || i === node.table.widths.length ? 1 : 0;
              },
              hLineColor: function (i, node) {
                return i === 0 || i === node.table.body.length
                  ? "#CCC"
                  : "gray";
              },
              vLineColor: function (i, node) {
                return i === 0 || i === node.table.widths.length
                  ? "#CCC"
                  : "gray";
              },
            },
          },
          {
            columns: [
              { text: "Faktura bez podpisu odbiorcy", alignment: "center" },
              {
                stack: [
                  {
                    text: "Osoba upoważniona do wystawienia faktury VAT",
                    alignment: "center",
                  },
                  {
                    text: `${
                      userDetails.firstName + " " + userDetails.surname
                    }`,
                    alignment: "center",
                    bold: true,
                  },
                ],
              },
            ],
            margin: [0, 10],
          },
        ],
        styles: {
          header: {
            fontSize: 16,
            bold: true,
            margin: [0, 10, 0, 5],
          },
          tableHeader: {
            bold: true,
            margin: [0, 5],
            alignment: "right",
          },
          tableText: {
            margin: [0, 5, 0, 5],
            alignment: "right",
          },
        },
        defaultStyle: {
          columnGap: 40,
          fontSize: 10,
        },
      };

      const pdfDoc = pdfMake.createPdf(docDefinition);

      pdfDoc.getBuffer((buffer) => {
        res.writeHead(200, {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename=faktura_${invoiceNumber}_${month}_${year}.pdf`,
          "Content-Length": buffer.length,
        });
        res.end(buffer);
      });
    }
  );
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
      ["itemName", "gtu", "itemQuantity", "unit", "singleItemPrice", "taxRate"],
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
      priceType,
      netTotal,
      taxTotal,
      grossTotal,
      paid,
    } = req.body;

    // ⬇️ Don't want to update user details

    const invoice = new Invoice({
      _id: req.params.invoiceId,
      userId: req.user._id,
      invoiceNumber,
      dateCreated,
      transactionDate,
      paymentDue,
      issuePlace,
      paymentMethod,
      priceType,
      invoiceItems: fieldsetsArr,
      totals: {
        netTotal,
        taxTotal,
        grossTotal,
      },
      paid,
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
