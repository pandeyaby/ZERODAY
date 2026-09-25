window.addEventListener("load", () => {
  const name = decodeURIComponent(location.hash.slice(1));
  document.getElementById("greeting").textContent = "Hello " + name;
});
