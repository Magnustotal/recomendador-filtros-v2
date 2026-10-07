// Panel de comprobaciones (/test.html) — pensado para el negocio o quien
// mantenga la web, no para clientes. Todas las pruebas se hacen en el
// propio navegador contra el sitio ya desplegado, sin llamar a ningún
// servicio externo (coherente con el connect-src 'self' del CSP).
(function () {
  "use strict";

  var PHONE = "34601006290";
  var CATEGORIES = [
    "Vacuno", "Cerdo", "Cerdo ibérico", "Pollo", "Pavo", "Conejo", "Caza",
    "Casquería", "Jamones y paletillas", "Embutidos", "Quesos",
    "Elaborados", "Recova",
  ];
  var PHOTOS = [
    "fachada", "corte-parrilla-4x3", "vacuno", "cerdo", "cerdo-iberico",
    "jamones", "quesos", "pollo", "pavo", "conejo", "embutidos",
    "elaborados", "casqueria", "caza", "huevos",
  ];

  async function headOrGetOk(path) {
    var res = await fetch(path, { method: "GET", cache: "no-store" });
    return res.status === 200;
  }

  async function checkMany(paths) {
    var fails = [];
    for (var i = 0; i < paths.length; i++) {
      var ok = false;
      try { ok = await headOrGetOk(paths[i]); } catch (e) { ok = false; }
      if (!ok) fails.push(paths[i]);
    }
    return fails;
  }

  var CHECKS = [
    {
      name: "Página principal responde",
      run: async function () {
        var res = await fetch("/", { cache: "no-store" });
        return { ok: res.status === 200, detail: "HTTP " + res.status };
      },
    },
    {
      name: "Service worker registrado",
      run: async function () {
        if (!("serviceWorker" in navigator)) {
          return { ok: false, warn: true, detail: "Navegador sin soporte de service worker" };
        }
        var reg = await navigator.serviceWorker.getRegistration("/");
        if (!reg) return { ok: false, warn: true, detail: "Aún sin registrar (normal en la primera visita; recarga la página)" };
        var state = reg.active ? "active" : reg.installing ? "installing" : reg.waiting ? "waiting" : "desconocido";
        return { ok: !!reg.active, detail: "Estado: " + state };
      },
    },
    {
      name: "Manifest de la PWA válido",
      run: async function () {
        var res = await fetch("/manifest.webmanifest", { cache: "no-store" });
        if (res.status !== 200) return { ok: false, detail: "HTTP " + res.status };
        var json = await res.json();
        var ok = !!json.name && Array.isArray(json.icons) && json.icons.length > 0 && !!json.start_url;
        return { ok: ok, detail: ok ? '"' + json.name + '", ' + json.icons.length + " icono(s)" : "faltan campos (name/icons/start_url)" };
      },
    },
    {
      name: "Datos estructurados (JSON-LD) válidos",
      run: async function (homeText) {
        var doc = new DOMParser().parseFromString(homeText, "text/html");
        var scripts = doc.querySelectorAll('script[type="application/ld+json"]');
        if (scripts.length === 0) return { ok: false, detail: "No se encontró ningún bloque JSON-LD" };
        var types = [];
        var phoneOk = true;
        for (var i = 0; i < scripts.length; i++) {
          var data = JSON.parse(scripts[i].textContent); // lanza si el JSON no es válido
          types.push(data["@type"]);
          if (data["@type"] === "GroceryStore" && data.telephone !== "+" + PHONE) phoneOk = false;
        }
        var hasStore = types.indexOf("GroceryStore") !== -1;
        var hasFaq = types.indexOf("FAQPage") !== -1;
        var ok = hasStore && hasFaq && phoneOk;
        return { ok: ok, detail: types.join(", ") + (phoneOk ? "" : " — teléfono inconsistente") };
      },
    },
    {
      name: "Enlaces de WhatsApp consistentes",
      run: async function (homeText) {
        var matches = homeText.match(/wa\.me\/(\d+)/g) || [];
        if (matches.length === 0) return { ok: false, detail: "No se encontró ningún enlace wa.me" };
        var numbers = matches.map(function (m) { return m.replace("wa.me/", ""); });
        var allSame = numbers.every(function (n) { return n === PHONE; });
        return { ok: allSame, detail: matches.length + " enlace(s), número " + (allSame ? numbers[0] + " en todos" : "INCONSISTENTE: " + numbers.join(", ")) };
      },
    },
    {
      name: "Enlaces de teléfono consistentes",
      run: async function (homeText) {
        var matches = homeText.match(/tel:\+(\d+)/g) || [];
        if (matches.length === 0) return { ok: false, detail: "No se encontró ningún enlace tel:" };
        var numbers = matches.map(function (m) { return m.replace("tel:+", ""); });
        var allSame = numbers.every(function (n) { return n === PHONE; });
        return { ok: allSame, detail: matches.length + " enlace(s), número " + (allSame ? numbers[0] + " en todos" : "INCONSISTENTE: " + numbers.join(", ")) };
      },
    },
    {
      name: "Sin formulario de contacto ni email (regresión)",
      run: async function (homeText) {
        var hasForm = /<form[\s>]/i.test(homeText);
        var hasMailto = /mailto:/i.test(homeText);
        var ok = !hasForm && !hasMailto;
        return { ok: ok, detail: ok ? "correcto: el negocio solo atiende por teléfono y WhatsApp" : (hasForm ? "hay un <form> de nuevo en la página — " : "") + (hasMailto ? "hay un enlace mailto: en la página" : "") };
      },
    },
    {
      name: "Las 11 categorías del catálogo están",
      run: async function (homeText) {
        var doc = new DOMParser().parseFromString(homeText, "text/html");
        var headings = Array.prototype.map.call(doc.querySelectorAll("#catalogo h3"), function (h) { return h.textContent.trim(); });
        var missing = CATEGORIES.filter(function (c) { return headings.indexOf(c) === -1; });
        return { ok: missing.length === 0, detail: missing.length === 0 ? headings.length + " fichas encontradas" : "faltan: " + missing.join(", ") };
      },
    },
    {
      name: "Tipografías cargadas",
      run: async function () {
        await document.fonts.ready;
        var checks = {
          "Alex Brush": document.fonts.check('400 1em "Alex Brush"'),
          "Playfair Display": document.fonts.check('700 1em "Playfair Display"'),
          Karla: document.fonts.check('400 1em "Karla"'),
        };
        var missing = Object.keys(checks).filter(function (k) { return !checks[k]; });
        return { ok: missing.length === 0, detail: missing.length === 0 ? "las 3 disponibles" : "no cargó: " + missing.join(", ") };
      },
    },
    {
      name: "Fotos del catálogo cargan",
      run: async function () {
        var paths = PHOTOS.map(function (p) { return "/assets/photos/" + p + ".jpg"; });
        var fails = await checkMany(paths);
        return { ok: fails.length === 0, detail: fails.length === 0 ? paths.length + " fotos, todas OK" : "fallan: " + fails.join(", ") };
      },
    },
    {
      name: "Iconos y PWA responden",
      run: async function () {
        var paths = ["/assets/icon-192.png", "/assets/icon-512.png", "/assets/favicon.svg", "/assets/og-image.png"];
        var fails = await checkMany(paths);
        return { ok: fails.length === 0, detail: fails.length === 0 ? "todos OK" : "fallan: " + fails.join(", ") };
      },
    },
    {
      name: "Páginas legales y auxiliares responden",
      run: async function () {
        var paths = ["/privacidad.html", "/aviso-legal.html", "/offline.html", "/qr.html"];
        var fails = await checkMany(paths);
        return { ok: fails.length === 0, detail: fails.length === 0 ? "todas OK" : "fallan: " + fails.join(", ") };
      },
    },
    {
      name: "robots.txt y sitemap.xml responden",
      run: async function () {
        var fails = await checkMany(["/robots.txt", "/sitemap.xml"]);
        return { ok: fails.length === 0, detail: fails.length === 0 ? "ambos OK" : "fallan: " + fails.join(", ") };
      },
    },
    {
      name: "Tienda: el catálogo y las funciones responden",
      run: async function () {
        var res = await fetch("/api/catalogo", { cache: "no-store" });
        if (res.status !== 200) return { ok: false, detail: "/api/catalogo respondió HTTP " + res.status + ". ¿Se publicó con las funciones (no arrastrando la carpeta)?" };
        var data = await res.json();
        var n = data.productos ? data.productos.length : 0;
        var abierta = data.ajustes && data.ajustes.tienda && data.ajustes.tienda.activa;
        return { ok: n > 0, detail: n + " productos · tienda " + (abierta ? "abierta" : "cerrada (los botones de pedir llevan a WhatsApp)") };
      },
    },
    {
      name: "Tienda y panel: las páginas responden",
      run: async function () {
        var fails = await checkMany(["/tienda", "/admin/", "/assets/tienda.js", "/assets/tienda.css"]);
        return { ok: fails.length === 0, detail: fails.length === 0 ? "todas OK" : "fallan: " + fails.join(", ") };
      },
    },
    {
      name: "Una ruta inexistente da 404",
      run: async function () {
        var res = await fetch("/esta-ruta-no-existe-" + Date.now(), { cache: "no-store" });
        return { ok: res.status === 404, detail: "HTTP " + res.status };
      },
    },
    {
      name: "Zona horaria de Sevilla calculable",
      run: async function () {
        var f = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" });
        var value = f.format(new Date());
        return { ok: /\d/.test(value), detail: "hora local calculada: " + value };
      },
    },
  ];

  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text) e.textContent = text;
    return e;
  }

  function addRow(list, name) {
    var row = el("tr", { class: "test-row" });
    var tdIcon = el("td", { class: "test-icon" }, "…");
    var tdName = el("td", { class: "test-name" }, name);
    var tdDetail = el("td", { class: "test-detail" }, "comprobando…");
    row.appendChild(tdIcon);
    row.appendChild(tdName);
    row.appendChild(tdDetail);
    list.appendChild(row);
    return { row: row, tdIcon: tdIcon, tdDetail: tdDetail };
  }

  function setResult(handle, outcome) {
    var cls = outcome.warn ? "is-warn" : outcome.ok ? "is-ok" : "is-fail";
    handle.row.className = "test-row " + cls;
    handle.tdIcon.textContent = outcome.warn ? "!" : outcome.ok ? "✓" : "✕";
    handle.tdDetail.textContent = outcome.detail;
  }

  async function runAll() {
    var list = document.getElementById("test-list");
    var summary = document.getElementById("test-summary");
    var timestamp = document.getElementById("test-timestamp");
    var rerunBtn = document.getElementById("rerun-btn");
    if (!list || !summary) return;

    list.innerHTML = "";
    if (rerunBtn) rerunBtn.disabled = true;

    var homeText = "";
    try {
      var res = await fetch("/", { cache: "no-store" });
      homeText = await res.text();
    } catch (e) {
      /* algunas pruebas dependen de esto; si falla, esas pruebas fallarán también y quedará reflejado */
    }

    var okCount = 0, warnCount = 0, failCount = 0;
    for (var i = 0; i < CHECKS.length; i++) {
      var check = CHECKS[i];
      var handle = addRow(list, check.name);
      var outcome;
      try {
        outcome = await check.run(homeText);
      } catch (err) {
        outcome = { ok: false, detail: "Error: " + err.message };
      }
      if (outcome.warn) warnCount++;
      else if (outcome.ok) okCount++;
      else failCount++;
      setResult(handle, outcome);
    }

    var total = CHECKS.length;
    var parts = [okCount + " de " + total + " pruebas superadas"];
    if (warnCount) parts.push(warnCount + " aviso(s)");
    if (failCount) parts.push(failCount + " fallo(s)");
    summary.textContent = parts.join(" · ");
    summary.className = "test-summary " + (failCount ? "is-fail" : warnCount ? "is-warn" : "is-ok");
    if (timestamp) timestamp.textContent = "Última comprobación: " + new Date().toLocaleString("es-ES");
    if (rerunBtn) rerunBtn.disabled = false;
  }

  document.addEventListener("DOMContentLoaded", function () {
    var rerunBtn = document.getElementById("rerun-btn");
    if (rerunBtn) rerunBtn.addEventListener("click", runAll);
    runAll();
  });
})();
