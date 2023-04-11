const { body, validationResult } = require("express-validator");
const async = require("async");
const Buyer = require("../models/buyer");
const Invoice = require("../models/invoice");
const { formatPrice } = require("../utils/utils");
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
        formatPrice,
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
      } = result;

      const month = result.transactionDate.getMonth() + 1;
      const year = result.transactionDate.getFullYear();

      function formatAccNum(accNum) {
        const firstTwo = accNum.slice(0, 2);
        const rest = accNum.slice(2);
        const fours = rest.match(/.{1,4}/g);
        return [firstTwo, ...fours].join(" ");
      }

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
                    text: `${formatPrice(result.totals.netTotal)}`,
                    style: "tableText",
                    bold: true,
                  },
                  {
                    text: `${formatPrice(result.totals.taxTotal)}`,
                    style: "tableText",
                    bold: true,
                  },
                  {
                    text: `${formatPrice(result.totals.grossTotal)}`,
                    style: "tableText",
                    bold: true,
                  },
                ],
                [
                  { text: "Zapłacono:", style: "tableText", bold: true },
                  { colSpan: 4, text: "0,00", style: "tableText" },
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
                  { colSpan: 4, text: "184,50", style: "tableText" },
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
          "Content-Disposition": "attachment; filename=hello-world.pdf",
          "Content-Length": buffer.length,
        });
        res.end(buffer);
      });
    }
  );

  // const formatDate = (d) =>
  //   [
  //     d.getDate().toString().padStart(2, "0"),
  //     (d.getMonth() + 1).toString().padStart(2, "0"),
  //     d.getFullYear(),
  //   ].join("-");

  // const doc = new PDFDocument();

  // // http://pdfkit.org/demo/browser.html

  // res.setHeader("Content-Disposition", 'attachment; filename="my-file.pdf"');

  // Invoice.findOne({ _id: req.params.invoiceId, userId: req.user._id }).exec(
  //   (err, result) => {
  //     if (err) {
  //       return next(err);
  //     }
  //     const {
  //       dateCreated,
  //       invoiceNumber,
  //       transactionDate,
  //       paymentMethod,
  //       paymentDue,
  //     } = result;

  //     const month = result.transactionDate.getMonth() + 1;
  //     const year = result.transactionDate.getFullYear();

  //     const fontsPath = path.join(__dirname, "..", "fonts");
  //     const fontPath = path.join(fontsPath, "Roboto-Regular.ttf");

  //     doc.registerFont("Roboto", fontPath);

  //     doc.font("Roboto");
  //     doc.y = 30;
  //     doc
  //       .fontSize(8)
  //       .text(`Wystawiono dnia ${formatDate(dateCreated)}, Kielce`);
  //     doc.moveDown();

  //     let xPos = (doc.x = 300);
  //     doc
  //       .fontSize(12)
  //       .text(`Faktura VAT nr ${invoiceNumber + "/" + month + "/" + year}`)
  //       .moveDown(0.5);
  //     let yPos = doc.y;
  //     let offset = 150;

  //     doc.text("Data sprzedaży:");

  //     doc.text(formatDate(transactionDate), xPos + offset, yPos);
  //     yPos = doc.y;

  //     doc.text("Sposób zapłaty:", xPos);

  //     doc.text(
  //       paymentMethod === "transfer" ? "Przelew" : "Gotówka",
  //       xPos + offset,
  //       yPos
  //     );

  //     yPos = doc.y;
  //     doc.text("Termin płatności:", xPos);
  //     doc
  //       .text(`${formatDate(paymentDue)}`, xPos + offset, yPos)

  //       .moveDown(0.5);

  //     xPos = doc.x = 72;
  //     yPos = doc.y;
  //     offset = 250;
  //     doc.fontSize(16).text("Sprzedawca:");
  //     doc.text("Nabywca:", xPos + offset, yPos).moveDown(0.5);
  //     yPos = doc.y;
  //     doc.fontSize(12).text("businessName", xPos);
  //     doc.text("businessName2", xPos + offset, yPos);
  //     yPos = doc.y;
  //     doc.text("adress", xPos);
  //     doc.text("adress2", xPos + offset, yPos);
  //     yPos = doc.y;
  //     doc.text("areaCode + city", xPos);
  //     doc.text("areaCode2 + city2", xPos + offset, yPos);
  //     yPos = doc.y;
  //     doc.text("NIP", xPos);
  //     doc.text("NIP2", xPos + offset, yPos).moveDown(0.5);
  //     doc.fontSize(16).text("Pozycje faktury", xPos).moveDown(0.5);

  //     let lp = 1;
  //     const { invoiceItems, priceType } = result;
  //     invoiceItems.forEach((item) => {
  //       item.lp = lp++;
  //       item.singleItemPrice =
  //         item.singleItemPrice.toFixed(2) + " " + item.priceType;
  //       item.value =
  //         (item.singleItemPrice * item.itemQuantity).toFixed(2) +
  //         " " +
  //         item.priceType;
  //       item.taxRate = item.taxRate * 100 + "%";
  //     });

  //     let table = {
  //       headers: [
  //         { label: "Lp.", property: "lp", width: 20, renderer: null },
  //         {
  //           label: "Nazwa towaru lub usługi",
  //           property: "itemName",
  //           width: 150,
  //           renderer: null,
  //         },
  //         {
  //           label: "Ilość",
  //           property: "itemQuantity",
  //           width: 100,
  //           renderer: null,
  //         },
  //         { label: "Jedn.", property: "unit", width: 100, renderer: null },
  //         {
  //           label: "Cena",
  //           property: "singleItemPrice",
  //           width: 100,
  //           renderer: null,
  //         },
  //         { label: "Wartość", property: "value", width: 100, renderer: null },
  //         {
  //           label: "Stawka VAT",
  //           property: "taxRate",
  //           width: 100,
  //           renderer: null,
  //         },
  //       ],
  //       datas: invoiceItems,
  //     };

  //     doc.table(table, {
  //       prepareHeader: () => doc.font("Roboto").fontSize(8),
  //       prepareRow: () => doc.font("Roboto").fontSize(8),
  //     });

  //     doc.fontSize(16).text("Podsumowanie", xPos).moveDown(0.5);

  //     const obj = {};
  //     const arr = [];

  //     function round(num) {
  //       return (Math.round((num + Number.EPSILON) * 100) / 100).toFixed(2);
  //     }

  //     invoiceItems.forEach((item) => {
  //       if (obj.hasOwnProperty(item.taxRate)) {
  //         obj[item.taxRate] += item.singleItemPrice * item.itemQuantity;
  //       } else {
  //         obj[item.taxRate] =
  //           Number(item.singleItemPrice) * Number(item.itemQuantity);
  //       }
  //     });

  //     for (n = 0; n < Object.keys(obj).length; n++) {
  //       const taxRate = Object.keys(obj)[n];
  //       const fsetNet =
  //         priceType === "netto"
  //           ? Object.values(obj)[n]
  //           : round(Object.values(obj)[n] / (1 + Number(taxRate)));
  //       const fsetTax = round(fsetNet * taxRate);
  //       const fsetGross = (Number(fsetNet) + Number(fsetTax)).toFixed(2);

  //       arr.push({
  //         description: " ",
  //         taxRate: `${taxRate * 100}%`,
  //         fsetNet,
  //         fsetTax,
  //         fsetGross,
  //       });
  //     }

  //     arr.push({
  //       description: "bold:Razem:",
  //       taxRate: " ",
  //       fsetNet: `bold:${result.totals.netTotal.toFixed(2)}`,
  //       fsetTax: `bold:${result.totals.taxTotal.toFixed(2)}`,
  //       fsetGross: `bold:${result.totals.grossTotal.toFixed(2)}`,
  //     });

  //     table = {
  //       headers: [
  //         {
  //           label: " ",
  //           property: "description",
  //           width: 80,
  //           renderer: null,
  //           headerAlign: "center",
  //           align: "right",
  //         },
  //         {
  //           label: "Stawka VAT",
  //           property: "taxRate",
  //           width: 100,
  //           renderer: null,
  //           headerAlign: "center",
  //           align: "center",
  //         },
  //         {
  //           label: "Wartość netto",
  //           property: "fsetNet",
  //           width: 100,
  //           renderer: null,
  //           headerAlign: "right",
  //           align: "right",
  //         },
  //         {
  //           label: "VAT",
  //           property: "fsetTax",
  //           width: 100,
  //           renderer: null,
  //           headerAlign: "right",
  //           align: "right",
  //         },
  //         {
  //           label: "Wartość brutto",
  //           property: "fsetGross",
  //           width: 100,
  //           renderer: null,
  //           headerAlign: "right",
  //           align: "right",
  //         },
  //       ],
  //       datas: arr,
  //     };

  //     doc.table(table, {
  //       prepareHeader: () => doc.font("Roboto").fontSize(11),
  //       prepareRow: () => doc.font("Roboto").fontSize(10),
  //     });

  //     // // A4 595.28 x 841.89 (portrait) (about width sizes)
  //     // // width
  //     // doc.table(table, {
  //     //   columnsSize: [20, 150, 50, 50, 50, 50, 50],
  //     //   prepareHeader: () => doc.font("Roboto").fontSize(8),
  //     //   prepareRow: () => doc.font("Roboto").fontSize(8),
  //     // });
  //     // done!
  //     doc.pipe(res);
  //     doc.end();
  //   }
  // );

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
    // const { businessName, nip, adress, areaCode, city, bankAccountNumber } =
    //   req.user;

    const invoice = new Invoice({
      _id: req.params.invoiceId,
      userId: req.user._id,
      // userDetails: {
      //   businessName,
      //   nip,
      //   adress,
      //   areaCode,
      //   city,
      //   bankAccountNumber,
      // },
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

exports.test_create_get = function (req, res, next) {
  Invoice.findOne({
    _id: "642fbd395cf33cd2b32cb9de",
    userId: req.user._id,
  }).exec((err, result) => {
    if (err) {
      return next(err);
    }
    const {
      dateCreated,
      invoiceNumber,
      transactionDate,
      paymentMethod,
      paymentDue,
      invoiceItems,
      priceType,
    } = result;

    const obj = {};
    const test = [];
    const arr = [];

    function round(num) {
      return (Math.round((num + Number.EPSILON) * 100) / 100).toFixed(2);
    }

    invoiceItems.forEach((item) => {
      if (obj.hasOwnProperty(item.taxRate)) {
        obj[item.taxRate] += item.singleItemPrice * item.itemQuantity;
      } else {
        test.push(item.singleItemPrice);
        test.push(item.quantity);
        obj[item.taxRate] = item.singleItemPrice * item.itemQuantity;
      }
    });

    for (n = 0; n < Object.keys(obj).length; n++) {
      const taxRate = Object.keys(obj)[n];

      const fsetNet =
        priceType === "netto"
          ? Object.values(obj)[n]
          : round(Object.values(obj)[n] / (1 + Number(taxRate)));
      const fsetTax = round(fsetNet * taxRate);

      const fsetGross = Number(fsetNet) + Number(fsetTax);

      arr.push({
        taxRate: `${taxRate * 100}`,
        fsetNet,
        fsetTax,
        fsetGross,
      });
      res.render("test", {
        obj,
        arr,
        test,
      });
    }
  });
};
