window.addEventListener("load", () => {
  const name = decodeURIComponent(location.hash.slice(1));
  document.getElementById("greeting").innerHTML = "<h2>Hello " + name + "</h2>";
});
