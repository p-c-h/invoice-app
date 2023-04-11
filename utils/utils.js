function formatPrice(arg) {
  return Number(arg).toFixed(2).replace(".", ",");
}

module.exports = {
  formatPrice,
};
