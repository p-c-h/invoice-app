///////
// console.log(invoice_data);
//////

// NEW BUYER POPUP v
const newBuyerForm = document.getElementById("newBuyerForm");
const showPopupBtn = document.getElementById("showPopupBtn");
const overlay = document.getElementById("overlay");
const popup = document.querySelector(".popup");
const confirmPopupBtn = document.getElementById("confirmPopupBtn");
const closePopupBtn = document.getElementById("closePopupBtn");

newBuyerForm.addEventListener("submit", (e) => {
  e.preventDefault(); // prevent.default() is a method in JavaScript that cancels the default behavior of an event. Whether it prevents sending data to the backend depends on the context in which it is used. If prevent.default() is called in the event handler of a form submit event, for example, it would prevent the form data from being sent to the server. However, if the data is being sent to the backend through some other means (such as an XHR request), prevent.default() would have no effect on that.
  const formData = new FormData(newBuyerForm);
  const reorgData = {};
  formData.forEach((value, key) => (reorgData[key] = value)); // convert FormData to JSON | new FormData works really great out of the box if you're able to send your request using the multipart/form-data encoding type. But what often happens is the service that is receiving that data isn't setup to work with that encoding. https://www.seancdavis.com/posts/convert-form-data-to-json/ & https://stackoverflow.com/questions/41431322/how-to-convert-formdata-html5-object-to-json/46774073#46774073
  fetch("http://localhost:3000/nowy-kontrahent", {
    method: "POST",
    body: JSON.stringify(reorgData),
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      displaySelectedBuyer(data);
      getBuyersList();
    })
    .catch((error) => console.error(error));

  popup.style.display = "none";
  overlay.style.display = "none";
});

showPopupBtn.addEventListener("click", () => {
  popup.style.display = "block";
  overlay.style.display = "block";
});

closePopupBtn.addEventListener("click", () => {
  popup.style.display = "none";
  overlay.style.display = "none";
});

// NEW BUYER POPUP ^

// BUYER DROPDOWN v

const dropdown = document.getElementById("dropdown");
const dropdownItems = document.getElementById("dropdownItems");
const buyerInput = document.getElementById("buyerInput");

buyerInput.addEventListener("focus", () => {
  dropdown.style.display = "block";
});

document.addEventListener("click", (e) => {
  if (!e.target.closest("#buyerWrapper")) {
    dropdown.style.display = "none";
  }
});

function populateDropdown(buyers) {
  dropdownItems.innerHTML = "";
  const ul = document.createElement("ul");
  buyers.forEach((buyer) => {
    const li = document.createElement("li");
    li.addEventListener("click", () => {
      buyerInput.value = buyer.businessName;
      buyerInput.select();
      displaySelectedBuyer(buyer);
      dropdown.style.display = "none";
    });
    li.classList.add("dropdownItem");
    li.textContent = buyer.businessName;
    ul.appendChild(li);
  });
  dropdownItems.appendChild(ul);
}

// BUYER DROPDOWN ^

// SORT BUYERS v

buyerInput.addEventListener("input", () => {
  dropdown.style.display = "block";
  const query = buyerInput.value.toLowerCase();
  const result = narrowDown(buyerList, query);
  populateDropdown(result);
});

function narrowDown(arr, query) {
  let result = [];
  arr.forEach((elem) => {
    if (elem.businessName.toLowerCase().slice(0, query.length) === query) {
      result.push(elem);
    }
  });
  return result;
}

// SORT BUYERS ^

// GET BUYER LIST FROM DB v

function getBuyersList() {
  fetch("http://localhost:3000/kontrahenci", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      populateDropdown(data);
    })
    .catch((error) => console.error(error));
}

// GET BUYER LIST FROM DB ^

// DISPLAY SELECTED BUYER v

const buyerSpace = document.getElementById("buyerSpace");
const buyerId = document.getElementById("buyerId");

function displaySelectedBuyer(buyer) {
  const { businessName, nip, adress, areaCode, city } = buyer;
  buyerSpace.innerHTML = `
  <li>${businessName}</li>
  <li>NIP: ${nip}</li>
  <li>${adress}</li>
  <li>${areaCode + " " + city}</li>
  `;
  buyerId.value = buyer._id;
}

// DISPLAY SELECTED BUYER ^

// ADD DAYS v
const dateCreated = document.getElementById("dateCreated");
const paymentDue = document.getElementById("paymentDue");

function addDays(val) {
  const dt = DateTime.fromISO(dateCreated.value);
  const obj = { months: 0, days: 0 };
  if (val === "30") obj.months = 1;
  else obj.days = val;
  paymentDue.value = dt.plus(obj).toISODate();
}
// ADD DAYS ^

// HELPER FUNCTIONS v

function round(num) {
  return (Math.round((num + Number.EPSILON) * 100) / 100).toFixed(2);
}

function splitter(string) {
  const splitString = string.split(/(\d+)/);
  return {
    word: splitString[0],
    num: splitString[1],
  };
}

// HELPER FUNCTIONS ^

// PRICE TYPE v

let priceType = document.getElementById("priceType").value;

function changePriceTypeController(elem) {
  priceType = elem.value;
  Object.values(fieldsets).forEach((fset) => {
    const fsetTotals = calculateFsetTotals(fset);
    fset.totals = fsetTotals;
  });
  displayInvoiceTotals();
  console.log(fieldsets);
}

// PRICE TYPE ^

// FIELDSET v
function selectElement(id, valueToSelect) {
  let element = document.getElementById(id);
  element.value = valueToSelect;
}

const addFsetButton = document.getElementById("addFsetButton");

let fieldsets = {};

let fsetId = 0;

// backup ⬇️
// function addFset(received) {
//   fsetId += 1;

//   const fset = document.createElement("fieldset");

//   fset.id = fsetId;
//   fset.innerHTML = `
//   <label for="itemName${fsetId}">Nazwa towaru lub usługi:</label>
//   <input type="text" id="itemName${fsetId}" name="itemName${fsetId}" onfocusout="storeValue(this)" value="${
//     received === undefined ? "" : received.itemName
//   }" required>

//   <label for="gtu${fsetId}">GTU:</label>
//   <input type="text" id="gtu${fsetId}" name="gtu${fsetId}" onfocusout="storeValue(this)" value="${
//     received === undefined ? "" : received.gtu
//   }" required>

//   <label for="itemQuantity${fsetId}">Ilość:</label>
//   <input type="number" id="itemQuantity${fsetId}" name="itemQuantity${fsetId}" min="1" step="1" onfocusout="focusOutController(this)" value="${
//     received === undefined ? "" : received.itemQuantity
//   }" required>

//   <label for="unit${fsetId}">Jednostka</label>
//   <input type="text" id="unit${fsetId}" name="unit${fsetId}" onfocusout="storeValue(this)" value="${
//     received === undefined ? "" : received.unit
//   }" required>

//   <label for="singleItemPrice${fsetId}">Cena jedn.:</label>
//   <select id="priceType${fsetId}" name="priceType${fsetId}" onchange="focusOutController(this)" value="${
//     received === undefined ? "" : received.priceType
//   }">
//     <option value="netto">netto</option>
//     <option value="brutto">brutto</option>
//   </select>
//   <input type="number" id="singleItemPrice${fsetId}" name="singleItemPrice${fsetId}" min="0" step="0.01" onfocusout="focusOutController(this)" value="${
//     received === undefined ? "" : received.singleItemPrice
//   }" required>

//   Stawka VAT:
//   <select id="taxRate${fsetId}" name="taxRate${fsetId}" onchange="focusOutController(this)" value="${
//     received === undefined ? "" : received.taxRate
//   }">
//     <option value=0.23>23%</option>
//     <option value=0.08>8%</option>
//     <option value=0.05>5%</option>
//     <option value=0>0%</option>
//     <option value=0>zw.</option>
//   </select>

//   <div class="removeButton tooltip">
//     <span>x</span>
//     <span class="tooltiptext">Faktura musi posiadać przynajmniej jedną pozycję</span>
//   </div>
//   `;

//   addFsetButton.before(fset);

//   const removeButton = fset.querySelector(".removeButton");
//   const tooltiptext = fset.querySelector(".tooltiptext");

//   removeButton.addEventListener("mouseover", () => {
//     if (checkIfLast(fieldsets)) {
//       tooltiptext.setAttribute("style", "visibility:visible");
//     } else {
//       return;
//     }
//   });

//   removeButton.addEventListener("click", () => {
//     if (checkIfLast(fieldsets)) {
//       return;
//     } else {
//       removeFset(fset);
//     }
//   });

//   removeButton.addEventListener("mouseout", () => {
//     tooltiptext.setAttribute("style", "visibility:hidden");
//   });

//   if (arguments.length) {
//     selectElement(`priceType${fsetId}`, received.priceType);
//     selectElement(`taxRate${fsetId}`, received.taxRate);
//     // const fsetTotals = calculateFsetTotals(received);
//     // fieldsets[fsetId] = { ...received, totals: { fsetTotals } };
//     fieldsets[fsetId] = received;
//     displayInvoiceTotals("any");
//   } else {
//     fieldsets[fsetId] = {
//       itemQuantity: null,
//       singleItemPrice: null,
//       priceType: "netto",
//       taxRate: 0.23,
//       complete: false,
//     };
//   }
// }

const tbody = document.querySelector("tbody");

function addFset(received) {
  fsetId += 1;

  const fset = document.createElement("tr");

  fset.id = fsetId;
  fset.innerHTML = `<td>
    <input type="text" id="itemName${fsetId}" name="itemName${fsetId}" onfocusout="storeValue(this)" value="${
    received === undefined ? "" : received.itemName
  }" required>
  </td>

  <td>
    <input type="text" id="gtu${fsetId}" name="gtu${fsetId}" onfocusout="storeValue(this)" value="${
    received === undefined ? "" : received.gtu
  }" required>
  </td>

  <td>
    <input type="number" id="itemQuantity${fsetId}" name="itemQuantity${fsetId}" min="1" step="1" onfocusout="focusOutController(this)" value="${
    received === undefined ? "" : received.itemQuantity
  }" required>
  </td>

  <td>
    <input type="text" id="unit${fsetId}" name="unit${fsetId}" onfocusout="storeValue(this)" value="${
    received === undefined ? "" : received.unit
  }" required>
  </td>

  <td>
    <input type="number" id="singleItemPrice${fsetId}" name="singleItemPrice${fsetId}" min="0" step="0.01" onfocusout="focusOutController(this)" value="${
    received === undefined ? "" : received.singleItemPrice
  }" required>
  </td>

  <td>
    <div class="center">
      <select id="taxRate${fsetId}" name="taxRate${fsetId}" onchange="focusOutController(this)" value="${
    received === undefined ? "" : received.taxRate
  }">
        <option value=0.23>23%</option>
        <option value=0.08>8%</option>
        <option value=0.05>5%</option>
        <option value=0>0%</option>
        <option value=0>zw.</option>
      </select>
    </div>
  </td>
  <td>
    <div class="removeButton tooltip">
      <span>❌</span>
      <span class="tooltiptext">Faktura musi posiadać przynajmniej jedną pozycję</span>
    </div>
  </td>
  `;

  // addFsetButton.before(fset);

  tbody.appendChild(fset);

  const removeButton = fset.querySelector(".removeButton");
  const tooltiptext = fset.querySelector(".tooltiptext");

  removeButton.addEventListener("mouseover", () => {
    if (checkIfLast(fieldsets)) {
      tooltiptext.setAttribute("style", "visibility:visible");
    } else {
      return;
    }
  });

  removeButton.addEventListener("click", () => {
    if (checkIfLast(fieldsets)) {
      return;
    } else {
      removeFset(fset);
    }
  });

  removeButton.addEventListener("mouseout", () => {
    tooltiptext.setAttribute("style", "visibility:hidden");
  });

  if (arguments.length) {
    // selectElement(`priceType${fsetId}`, received.priceType);
    selectElement(`taxRate${fsetId}`, received.taxRate);
    // const fsetTotals = calculateFsetTotals(received);
    // fieldsets[fsetId] = { ...received, totals: { fsetTotals } };
    fieldsets[fsetId] = received;
    const fsetTotals = calculateFsetTotals(fieldsets[fsetId]);
    fieldsets[fsetId].totals = fsetTotals;
    displayInvoiceTotals("any");
  } else {
    fieldsets[fsetId] = {
      itemQuantity: null,
      singleItemPrice: null,
      // priceType: "netto",
      taxRate: 0.23,
      complete: false,
    };
  }
}

// FIELDSET ^

// REMOVE FIELDSET v

function checkIfLast(obj) {
  const count = Object.keys(obj).length;
  if (count === 1) return true;
  else return false;
}

function removeFset(fset) {
  delete fieldsets[fset.id];
  fset.remove();
  displayInvoiceTotals();
}

// REMOVE FIELDSET ^

// FOCUS OUT v

function focusOutController(elem) {
  storeValue(elem);
  const id = splitter(elem.id).num;
  const { itemQuantity, singleItemPrice } = fieldsets[id];
  if (itemQuantity === null || singleItemPrice === null) {
    delete fieldsets[id].totals;
  } else {
    const fsetTotals = calculateFsetTotals(fieldsets[id]);
    fieldsets[id].totals = fsetTotals;
  }
  displayInvoiceTotals();
  console.log(fieldsets);
}

function storeValue(elem) {
  const { word, num } = splitter(elem.id);
  fieldsets[num][word] = elem.value;
}

function calculateFsetTotals(fsetData) {
  const { itemQuantity, singleItemPrice, taxRate } = fsetData;
  const singleItemNetPrice =
    priceType === "netto"
      ? singleItemPrice
      : singleItemPrice / (1 + Number(taxRate));
  const fsetNet = itemQuantity * singleItemNetPrice;
  const fsetTax = fsetNet * taxRate;
  const fsetGross = fsetNet + fsetTax;

  return {
    fsetNet,
    fsetTax,
    fsetGross,
  };
}

// FOCUS OUT ^

// INVOICE TOTALS v

const netTotalElem = document.getElementById("netTotalElem");
const taxTotalElem = document.getElementById("taxTotalElem");
const grossTotalElem = document.getElementById("grossTotalElem");

function displayInvoiceTotals(received) {
  if (!arguments.length) {
    const totalsArr = getFsetTotals(fieldsets);
    if (totalsArr.length === 0) {
      netTotalElem.textContent =
        taxTotalElem.textContent =
        grossTotalElem.textContent =
          (0).toFixed(2);
      return;
    }
    const { fsetNet, fsetTax, fsetGross } = calculateInvoiceTotals(
      ...totalsArr
    );
    netTotalElem.textContent = round(fsetNet);
    taxTotalElem.textContent = round(fsetTax);
    grossTotalElem.textContent = round(fsetGross);
  }
}

function getFsetTotals(obj) {
  const totalsArr = [];
  for (const property in obj) {
    const data = obj[property];
    if (Object.hasOwn(data, "totals")) totalsArr.push(data.totals);
  }
  return totalsArr;
}

function calculateInvoiceTotals(...objs) {
  return objs.reduce((a, b) => {
    for (let k in b) {
      if (b.hasOwnProperty(k)) a[k] = (a[k] || 0) + b[k];
    }
    return a;
  }, {});
}

// INVOICE TOTALS ^

// VALIDATION STAGE v

const fsetIds = document.getElementById("fsetIds");
const netTotal = document.getElementById("netTotal");
const taxTotal = document.getElementById("taxTotal");
const grossTotal = document.getElementById("grossTotal");
const invoiceForm = document.getElementById("invoiceForm");
invoiceForm.addEventListener("submit", (e) => {
  fsetIds.value = Object.keys(fieldsets);
  netTotal.value = netTotalElem.textContent;
  taxTotal.value = taxTotalElem.textContent;
  grossTotal.value = grossTotalElem.textContent;
});

// VALIDATION STAGE ^

if (typeof invoiceItems !== "undefined") {
  invoiceItems.forEach((item) => {
    addFset(item);
  });
} else {
  addFset();
}
populateDropdown(buyerList);
