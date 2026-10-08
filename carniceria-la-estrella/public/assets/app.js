// Menú móvil, horario en vivo, revelado al hacer scroll y registro del
// service worker. Va en un archivo aparte (y no inline) para poder tener
// una Content-Security-Policy con script-src 'self' (sin 'unsafe-inline'),
// que es la protección real contra inyección de JavaScript. El único
// script que sigue inline es el de una línea del <head> que marca
// <html class="js"> antes del primer pintado — ese se permite en la CSP
// por su hash SHA-256, no por 'unsafe-inline'.
(function () {
  "use strict";

  // --- Menú móvil ---
  var header = document.getElementById("site-header");
  var toggle = document.getElementById("nav-toggle");
  var scrim = document.getElementById("nav-scrim");
  var mainNav = document.getElementById("main-nav");
  var navLinks = document.querySelectorAll("#main-nav a");

  var navMediaQuery = window.matchMedia("(max-width: 900px)");
  // Con el menú cerrado (móvil) el propio <nav> queda inert; con el menú
  // abierto lo que queda inert es el contenido de fondo, para que Tab no
  // llegue a elementos ocultos bajo el scrim.
  var backgroundRegions = document.querySelectorAll("#main, .site-footer, .mobile-action-bar, .back-to-top");
  function syncNavInert() {
    var isOpen = header.classList.contains("nav-open");
    if (navMediaQuery.matches) {
      mainNav.toggleAttribute("inert", !isOpen);
      backgroundRegions.forEach(function (el) { el.toggleAttribute("inert", isOpen); });
    } else {
      mainNav.removeAttribute("inert");
      backgroundRegions.forEach(function (el) { el.removeAttribute("inert"); });
    }
  }
  navMediaQuery.addEventListener("change", syncNavInert);
  syncNavInert();

  function closeNav() {
    header.classList.remove("nav-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Abrir menú de navegación");
    syncNavInert();
  }
  function toggleNav() {
    var isOpen = header.classList.toggle("nav-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute("aria-label", isOpen ? "Cerrar menú de navegación" : "Abrir menú de navegación");
    syncNavInert();
  }
  if (toggle) {
    toggle.addEventListener("click", toggleNav);
    if (scrim) scrim.addEventListener("click", closeNav);
    navLinks.forEach(function (link) {
      link.addEventListener("click", closeNav);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeNav();
    });
  }

  // --- Saltos a una sección de la misma página ---
  // En el móvil el desplazamiento suave puede acabar un poco antes del comienzo de la sección (imágenes que cargan, la barra del navegador
  // que se esconde...). Cuando termina, si no ha llegado, se ajusta; se vuelve a comprobar un instante después. Si la persona toca la
  // pantalla o mueve la rueda, no se hace nada.
  document.addEventListener("click", function (ev) {
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    var a = ev.target.closest && ev.target.closest("a[href]");
    if (!a || (a.target && a.target !== "_self")) return;
    var url;
    try { url = new URL(a.href, location.href); } catch (e) { return; }
    if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash || url.hash === "#") return;
    var destino = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (!destino || destino.id === "top") return;
    var cancelado = false;
    function parar() { cancelado = true; }
    ["wheel", "touchstart", "keydown"].forEach(function (nombre) { addEventListener(nombre, parar, { once: true, passive: true }); });
    function ajustar() {
      if (cancelado) return;
      var margen = parseFloat(getComputedStyle(destino).scrollMarginTop) || 0;
      var d = destino.getBoundingClientRect().top - margen;
      var alFinal = Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 1;
      if (Math.abs(d) > 2 && !(alFinal && d > 0)) scrollBy({ top: d, behavior: "instant" });
    }
    var hecho = false;
    function alTerminar() {
      if (hecho) return;
      hecho = true;
      ajustar();
      setTimeout(ajustar, 300);
      setTimeout(ajustar, 900);
    }
    if ("onscrollend" in window) addEventListener("scrollend", alTerminar, { once: true });
    setTimeout(alTerminar, 1600); // por si el navegador no avisa del final o ya estaba en su sitio
  });

  // --- Revelado al hacer scroll ---
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && reveals.length) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    reveals.forEach(function (el) { observer.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
  }

  // --- Horario: abierto/cerrado ahora ---
  // Se calcula una sola vez, a partir del openingHoursSpecification que ya
  // hay en el JSON-LD del <head> — sin depender de ninguna red, para que
  // no haya ni un instante de página vacía ni de dato desactualizado.
  var dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var dayLabelsEs = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

  function toMinutes(hhmm) {
    var bits = hhmm.split(":");
    return parseInt(bits[0], 10) * 60 + parseInt(bits[1], 10);
  }
  function fmtMinutes(mins) {
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    return h + ":" + (m < 10 ? "0" : "") + m;
  }

  function getOpeningHoursSpec() {
    try {
      var ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (var s = 0; s < ldScripts.length; s++) {
        var ldData = JSON.parse(ldScripts[s].textContent);
        if (ldData["@type"] === "GroceryStore" && ldData.openingHoursSpecification) {
          return ldData.openingHoursSpecification;
        }
      }
    } catch (e) {
      /* silencioso: si el JSON-LD cambiase de forma en el futuro, mejor no
         mostrar nada (o dejar el respaldo estático tal cual) que un error
         o un texto a medias. */
    }
    return null;
  }

  function daySlotsFromSpec(spec) {
    var daySlots = [[], [], [], [], [], [], []];
    spec.forEach(function (rule) {
      rule.dayOfWeek.forEach(function (dayName) {
        var dayIndex = dayNames.indexOf(dayName);
        if (dayIndex === -1) return;
        daySlots[dayIndex].push({ opens: toMinutes(rule.opens), closes: toMinutes(rule.closes) });
      });
    });
    daySlots.forEach(function (slots) { slots.sort(function (a, b) { return a.opens - b.opens; }); });
    return daySlots;
  }

  var statusEl = document.getElementById("open-status");
  var SOON_MINUTES = 30;

  // Hora (y fecha) de Sevilla, no la del navegador de quien visite.
  function nowInSevilla() {
    var weekdayShort = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    var fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Madrid",
      weekday: "short",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
    var parts = {};
    fmt.formatToParts(new Date()).forEach(function (p) { parts[p.type] = p.value; });
    var hour = parts.hour === "24" ? 0 : parseInt(parts.hour, 10);
    return {
      day: weekdayShort[parts.weekday],
      minutes: hour * 60 + parseInt(parts.minute, 10),
    };
  }

  function findNextOpening(daySlots, fromDay, fromMinutes) {
    for (var offset = 0; offset < 8; offset++) {
      var checkDay = (fromDay + offset) % 7;
      var slots = daySlots[checkDay];
      for (var j = 0; j < slots.length; j++) {
        if (offset === 0 && slots[j].opens <= fromMinutes) continue;
        return { day: checkDay, opens: slots[j].opens };
      }
    }
    return null;
  }

  function renderOpenStatus(daySlots) {
    if (!statusEl) return;
    var now = nowInSevilla();
    var nowDay = now.day, nowMinutes = now.minutes;

    var openSlot = daySlots[nowDay].filter(function (sl) {
      return nowMinutes >= sl.opens && nowMinutes < sl.closes;
    })[0];

    statusEl.classList.remove("is-open", "is-closed");
    if (openSlot) {
      var minutesToClose = openSlot.closes - nowMinutes;
      if (minutesToClose <= SOON_MINUTES) {
        statusEl.textContent = "Abierto ahora · cerramos pronto, a las " + fmtMinutes(openSlot.closes);
      } else {
        statusEl.textContent = "Abierto ahora · cierra a las " + fmtMinutes(openSlot.closes);
      }
      statusEl.classList.add("is-open");
    } else {
      var next = findNextOpening(daySlots, nowDay, nowMinutes);
      if (next) {
        if (next.day === nowDay) {
          var minutesToOpen = next.opens - nowMinutes;
          if (minutesToOpen <= SOON_MINUTES) {
            statusEl.textContent = "Cerrado ahora · ¡ya casi! Abrimos en breve, a las " + fmtMinutes(next.opens);
          } else {
            statusEl.textContent = "Cerrado ahora · no te preocupes, abrimos en un rato, a las " + fmtMinutes(next.opens);
          }
        } else if (nowDay === 0 && next.day === 1) {
          statusEl.textContent =
            "Cerrado ahora · hoy domingo no abrimos, el lunes abrimos a las " + fmtMinutes(next.opens) + ". ¡Buen domingo!";
        } else if (next.day === (nowDay + 1) % 7) {
          statusEl.textContent = "Cerrado ahora · hoy ya hemos cerrado, mañana abrimos a las " + fmtMinutes(next.opens);
        } else {
          statusEl.textContent = "Cerrado ahora · abre el " + dayLabelsEs[next.day] + " a las " + fmtMinutes(next.opens);
        }
      } else {
        statusEl.textContent = "Cerrado ahora";
      }
      statusEl.classList.add("is-closed");
    }
  }

  var spec = getOpeningHoursSpec();
  if (spec) {
    var daySlots = daySlotsFromSpec(spec);
    renderOpenStatus(daySlots);
  }

  // --- Sección activa en el menú, mientras se hace scroll ---
  var navSections = [];
  navLinks.forEach(function (link) {
    var id = link.getAttribute("href");
    if (id && id.charAt(0) === "#") {
      var section = document.querySelector(id);
      if (section) navSections.push({ link: link, section: section });
    }
  });
  if ("IntersectionObserver" in window && navSections.length) {
    var navObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var match = navSections.filter(function (ns) { return ns.section === entry.target; })[0];
          if (!match) return;
          navLinks.forEach(function (l) {
            l.classList.remove("is-active");
            l.removeAttribute("aria-current");
          });
          match.link.classList.add("is-active");
          match.link.setAttribute("aria-current", "true");
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    navSections.forEach(function (ns) { navObserver.observe(ns.section); });
  }

  // --- Aviso de sin conexión ---
  var offlineBanner = document.getElementById("offline-banner");
  function syncOfflineBanner() {
    if (!offlineBanner) return;
    offlineBanner.classList.toggle("is-visible", !navigator.onLine);
  }
  window.addEventListener("online", syncOfflineBanner);
  window.addEventListener("offline", syncOfflineBanner);
  syncOfflineBanner();

  // --- Service worker ---
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").catch(function () {
        /* silencioso: no rompemos la carga si falla el registro */
      });
    });
  }
})();
