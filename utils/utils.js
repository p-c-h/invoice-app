function formatPrice(arg) {
  return Number(arg).toFixed(2).replace(".", ",");
}

function formatAccNum(accNum) {
  const firstTwo = accNum.slice(0, 2);
  const rest = accNum.slice(2);
  const fours = rest.match(/.{1,4}/g);
  return [firstTwo, ...fours].join(" ");
}

module.exports = {
  formatPrice,
  formatAccNum,
};
