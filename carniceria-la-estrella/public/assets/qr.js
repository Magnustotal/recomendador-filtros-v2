// Botón "Guardar como PDF / imprimir" del cartel (/qr.html).
document.addEventListener("DOMContentLoaded", function () {
  var btn = document.getElementById("print-btn");
  if (btn) btn.addEventListener("click", function () { window.print(); });
});
