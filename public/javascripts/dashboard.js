const bars = document.getElementById("bars");
const menu = document.getElementById("menu");

bars.addEventListener("click", () => {
  if (menu.style.maxHeight === "") {
    menu.style.maxHeight = "500px";
  } else if (menu.style.maxHeight !== "") {
    menu.style.maxHeight = "";
  }
});
