// Genera data/categorias.json y data/productos.default.json (catálogo inicial SIN precios).
// Los nombres de piezas y cortes son los habituales de una carnicería andaluza; los precios,
// las opciones de corte y qué productos se venden de verdad los fija el negocio desde el panel.
//   node scripts/semilla.mjs
import { writeFileSync } from "node:fs";

const categorias = [
  { id: "vacuno", nombre: "Vacuno", grupo: "Carnes frescas", descripcion: "Ternera y vaca: del solomillo al morcillo, cortado al momento." },
  { id: "cerdo", nombre: "Cerdo", grupo: "Carnes frescas", descripcion: "Cerdo blanco: lomo, chuletas, costillas, panceta y el resto del despiece." },
  { id: "cerdo-iberico", nombre: "Cerdo ibérico", grupo: "Carnes frescas", descripcion: "Secreto, presa, pluma, abanico y demás piezas de cerdo ibérico." },
  { id: "cordero", nombre: "Cordero y cabrito", grupo: "Carnes frescas", descripcion: "Lechal, recental y cabrito: pierna, paletilla, chuletas y costillar." },
  { id: "pollo", nombre: "Pollo", grupo: "Carnes frescas", descripcion: "Entero, troceado o por piezas: pechuga, muslo, contramuslo, alitas." },
  { id: "pavo", nombre: "Pavo", grupo: "Carnes frescas", descripcion: "Pechuga, solomillo, muslo y alas de pavo." },
  { id: "conejo", nombre: "Conejo", grupo: "Carnes frescas", descripcion: "Entero, troceado o por piezas." },
  { id: "caza", nombre: "Caza", grupo: "Carnes frescas", descripcion: "Caza de temporada, por encargo." },
  { id: "casqueria", nombre: "Casquería", grupo: "Casquería", descripcion: "Callos, rabo de toro, hígado, mollejas, manitas y demás." },
  { id: "jamones", nombre: "Jamones y paletillas", grupo: "Charcutería y curados", descripcion: "Jamón y paletilla ibérica y serrana, loncheados al momento." },
  { id: "embutidos", nombre: "Embutidos y fiambres", grupo: "Charcutería y curados", descripcion: "Chorizo, salchichón, morcilla, longaniza, chicharrones y fiambres." },
  { id: "quesos", nombre: "Quesos", grupo: "Charcutería y curados", descripcion: "Quesos de oveja y cabra, curados y semicurados." },
  { id: "elaborados", nombre: "Elaborados", grupo: "Elaborados y otros", descripcion: "Hamburguesas, salchichas, pinchitos, flamenquines, San Jacobos, carne picada…" },
  { id: "huevos", nombre: "Huevos (Recova)", grupo: "Elaborados y otros", descripcion: "Huevos camperos y de codorniz." },
  { id: "avios", nombre: "Avíos del puchero", grupo: "Despensa", descripcion: "Huesos, tocino, codillo y todo para el puchero y el cocido." },
  { id: "especias", nombre: "Especias", grupo: "Despensa", descripcion: "Pimentón, pimienta, comino, adobos y sal." },
  { id: "salsas", nombre: "Salsas", grupo: "Despensa", descripcion: "Salsas para carne y barbacoa." },
  { id: "vino", nombre: "Vino", grupo: "Despensa", descripcion: "Tintos, blancos y vinos de Jerez. Solo para mayores de 18 años." },
].map((c, i) => ({ ...c, orden: i + 1 }));

const lista = [];
const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function p(categoria, nombre, descripcion, o = {}) {
  const unidad = o.u ?? "kg";
  lista.push({
    id: slug(`${categoria}-${nombre}`),
    categoria, nombre, descripcion,
    unidad,
    paso: o.paso ?? (unidad === "kg" ? 250 : 1),
    minimo: o.min ?? null,
    maximo: o.max ?? null,
    precio: null,
    agotado: false,
    oculto: false,
    opciones: o.op ?? [],
    foto: null,
    alcohol: !!o.alc,
    alergenos: [],
  });
}

// Opciones de corte frecuentes
const FILETES = ["Fileteado fino", "Fileteado grueso", "En una pieza", "En tacos", "Picado"];
const ASAR = ["En una pieza", "Atado para asar", "Fileteado"];
const GUISAR = ["En tacos para guisar", "En trozos grandes", "En una pieza"];
const CHULETAS = ["Chuletas finas", "Chuletas gruesas"];
const TROCEAR = ["Entero", "Troceado para guisar", "Troceado para freír", "Abierto para barbacoa"];
const LONCHEAR = ["Loncheado fino", "Loncheado grueso", "En taco"];

// ---------- Vacuno ----------
p("vacuno", "Solomillo de ternera", "La pieza más tierna. Para plancha, medallones o entero al horno.", { op: ["En una pieza", "En medallones", "Fileteado"] });
p("vacuno", "Entrecot de ternera", "Lomo alto deshuesado, para plancha o parrilla.", { op: ["Un filete por persona", "Cortado grueso", "En una pieza"] });
p("vacuno", "Chuletón de ternera", "Lomo con hueso, para parrilla u horno.", { paso: 500, op: ["Corte grueso", "Corte medio"] });
p("vacuno", "Lomo bajo de ternera", "Filetes jugosos para plancha.", { op: FILETES });
p("vacuno", "Cadera de ternera", "Magra y tierna, para filetes, brochetas o asado.", { op: [...FILETES, "Para brochetas"] });
p("vacuno", "Tapa de ternera", "Filetes finos para plancha y empanar.", { op: ["Fileteado fino", "Fileteado grueso", "En una pieza", "Para empanar"] });
p("vacuno", "Tapilla de ternera", "Jugosa, para filetes o asado en pieza.", { op: ASAR });
p("vacuno", "Babilla de ternera", "Para filetes finos, empanados y plancha.", { op: ["Fileteado fino", "Para empanar", "En una pieza", "En tacos"] });
p("vacuno", "Contra de ternera", "Filetes finos y guisos cortos.", { op: ["Fileteado fino", "En una pieza", "En tacos"] });
p("vacuno", "Redondo de ternera", "Para asar al horno, mechar o roast beef.", { op: ["En una pieza", "Atado para asar", "Fileteado"] });
p("vacuno", "Aguja de ternera", "Para guisos y filetes económicos.", { op: GUISAR });
p("vacuno", "Espaldilla de ternera", "Para guisos, carne mechada y ragú.", { op: GUISAR });
p("vacuno", "Morcillo de ternera", "Imprescindible para cocidos y guisos de cocción lenta.", { op: ["En una pieza", "Cortado en rodajas (osobuco)", "En tacos"] });
p("vacuno", "Osobuco de ternera", "Rodajas de morcillo con hueso, para guisar.", { op: ["Rodajas gruesas", "Rodajas finas"] });
p("vacuno", "Falda de ternera", "Para guisar, hervir o caldo.", { op: GUISAR });
p("vacuno", "Vacío de ternera", "Para parrilla, entero o fileteado.", { op: ["En una pieza", "Fileteado"] });
p("vacuno", "Entraña de ternera", "Rápida a la plancha o parrilla.", { op: ["En una pieza", "Cortada en tiras"] });
p("vacuno", "Picaña de ternera", "Con su capa de grasa, para parrilla u horno.", { paso: 500, op: ["En una pieza", "Fileteada"] });
p("vacuno", "Costilla de ternera", "Asado de tira y costillar para horno y barbacoa.", { op: ["En tiras", "En una pieza", "Troceada"] });
p("vacuno", "Pecho de ternera", "Para cocido, ropa vieja o cocción lenta.", { op: ["En una pieza", "En tacos"] });
p("vacuno", "Carrillera de ternera", "Se deshace tras una cocción lenta al vino.", { op: ["Enteras", "Limpias"] });
p("vacuno", "Ternera para guisar", "Carne troceada para guisos y estofados.", { op: ["Aguja", "Espaldilla", "Mezcla"] });

// ---------- Cerdo ----------
p("cerdo", "Solomillo de cerdo", "Tierno y magro, entero o en medallones.", { op: ["Entero", "En medallones", "Fileteado"] });
p("cerdo", "Cinta de lomo", "Para filetes, chuletas, asado o adobar.", { op: ["Fileteado fino", "Fileteado grueso", "En una pieza", "Adobada"] });
p("cerdo", "Chuletas de lomo", "Con hueso, para plancha o parrilla.", { op: CHULETAS });
p("cerdo", "Chuletas de aguja", "Jugosas, con algo de grasa, para parrilla.", { op: CHULETAS });
p("cerdo", "Cabeza de lomo", "Con grasa infiltrada, para filetes o asado.", { op: ["Fileteada", "En una pieza", "En tacos"] });
p("cerdo", "Magro de cerdo", "Para guisar, adobar o picar.", { op: ["En tacos", "En una pieza", "Picado"] });
p("cerdo", "Filetes de magra de jamón", "Filetes para plancha, empanar o freír.", { op: ["Fileteado fino", "Fileteado grueso"] });
p("cerdo", "Paletilla de cerdo", "Para asar entera, deshuesar o guisar.", { op: ["Entera", "Deshuesada", "En tacos"] });
p("cerdo", "Pierna de cerdo fresca", "Pierna entera o en trozos para asar.", { paso: 500, op: ["Entera", "Deshuesada", "En trozos"] });
p("cerdo", "Panceta fresca", "En tiras o en trozo, para plancha, horno o guisos.", { op: ["En tiras", "En una pieza", "En tacos"] });
p("cerdo", "Costillas de cerdo", "Costillar para horno, barbacoa o guisos.", { op: ["En una pieza", "En tiras", "Troceadas"] });
p("cerdo", "Costilla con panceta", "Para guisos y caldos.", { op: ["Troceada", "En una pieza"] });
p("cerdo", "Codillo de cerdo", "Fresco, para asar o cocer despacio.", { op: ["Entero", "Troceado"] });
p("cerdo", "Careta de cerdo", "Para guisos y platos tradicionales.", { op: ["Entera", "Troceada"] });
p("cerdo", "Papada de cerdo", "Para guisos y fritos.", {});
p("cerdo", "Cochinillo (por encargo)", "Pieza entera para asar. Pídelo con antelación.", { u: "ud", op: ["Entero", "Partido en cuartos"] });

// ---------- Cerdo ibérico ----------
p("cerdo-iberico", "Secreto ibérico", "Veteado de grasa, jugoso y de sabor intenso. A la plancha o a la brasa.", { op: ["Entero", "Fileteado fino", "Fileteado grueso"] });
p("cerdo-iberico", "Presa ibérica", "Entre la paleta y el cuello, muy jugosa.", { op: ["Entera", "Fileteada", "En medallones"] });
p("cerdo-iberico", "Pluma ibérica", "Triangular, con vetas de grasa. A la plancha o parrilla.", { op: ["Entera", "Fileteada"] });
p("cerdo-iberico", "Abanico ibérico", "Plano y jugoso, para parrilla.", { op: ["Entero", "Fileteado"] });
p("cerdo-iberico", "Lagarto ibérico", "Fino y largo, muy jugoso a la brasa.", { op: ["Entero", "Cortado en trozos"] });
p("cerdo-iberico", "Solomillo ibérico", "Más oscuro y sabroso que el del cerdo blanco.", { op: ["Entero", "En medallones", "Fileteado"] });
p("cerdo-iberico", "Cinta de lomo ibérica", "Para filetes, asado o adobar.", { op: ["Fileteada", "En una pieza"] });
p("cerdo-iberico", "Cabecero de lomo ibérico", "Con grasa infiltrada, jugoso y sabroso.", { op: ["Entero", "Fileteado"] });
p("cerdo-iberico", "Carrillera ibérica", "Para guisos y platos de cuchara.", { op: ["Enteras", "Limpias"] });
p("cerdo-iberico", "Costillas ibéricas", "Para horno, barbacoa o guisos.", { op: ["En una pieza", "Troceadas"] });
p("cerdo-iberico", "Panceta ibérica", "En tiras o en trozo.", { op: ["En tiras", "En una pieza"] });
p("cerdo-iberico", "Papada ibérica", "Jugosa, para plancha y guisos.", {});

// ---------- Cordero y cabrito ----------
p("cordero", "Pierna de cordero lechal", "Para asar al horno, entera o deshuesada.", { paso: 500, op: ["Entera", "Deshuesada", "Partida en trozos"] });
p("cordero", "Paletilla de cordero lechal", "La mejor para asar, tierna y delicada.", { paso: 500, op: ["Entera", "Deshuesada", "Partida en trozos"] });
p("cordero", "Chuletillas de cordero lechal", "Pequeñas, para plancha o parrilla.", { op: ["Sueltas", "En tiras"] });
p("cordero", "Costillar de cordero lechal", "Para asar entero o en tiras.", { op: ["Entero", "En tiras"] });
p("cordero", "Medio cordero lechal (por encargo)", "Medio cordero troceado. Pídelo con antelación.", { u: "ud", op: ["Troceado para asar", "Troceado para guisar"] });
p("cordero", "Pierna de cordero recental", "Para asar, deshuesar o guisar.", { paso: 500, op: ["Entera", "Deshuesada", "Partida en trozos"] });
p("cordero", "Paletilla de cordero recental", "Para horno o guiso.", { paso: 500, op: ["Entera", "Deshuesada", "Partida en trozos"] });
p("cordero", "Chuletas de cordero", "De lomo o de palo, para parrilla.", { op: ["Chuletas de lomo", "Chuletas de palo", "Mezcla"] });
p("cordero", "Costillar de cordero", "Para horno o brasas.", { op: ["Entero", "En tiras"] });
p("cordero", "Cuello de cordero", "Sabroso, para guisos y estofados.", { op: ["En rodajas", "En trozos"] });
p("cordero", "Falda de cordero", "Para guisar y asar despacio.", { op: ["En una pieza", "En trozos"] });
p("cordero", "Cordero para guisar", "Troceado para guisos y caldereta.", { op: ["Trozos pequeños", "Trozos grandes"] });
p("cordero", "Pierna de cabrito lechal", "Para asar entera.", { paso: 500, op: ["Entera", "Partida en trozos"] });
p("cordero", "Paletilla de cabrito lechal", "Tierna, para asar al horno.", { paso: 500, op: ["Entera", "Partida en trozos"] });
p("cordero", "Cabrito lechal (por encargo)", "Cabrito entero o medio. Pídelo con antelación.", { u: "ud", op: ["Entero", "Medio", "Troceado"] });

// ---------- Pollo ----------
p("pollo", "Pollo entero", "Pollo fresco. Precio por pieza, el peso varía.", { u: "ud", op: TROCEAR });
p("pollo", "Medio pollo", "Mitad de pollo.", { u: "ud", op: ["Entero", "Troceado"] });
p("pollo", "Pollo campero", "Pollo de campo, de carne más firme.", { u: "ud", op: TROCEAR });
p("pollo", "Pollo troceado para guisar", "En trozos medianos.", { op: [] });
p("pollo", "Pollo troceado para freír", "En trozos pequeños.", { op: [] });
p("pollo", "Pechuga de pollo", "Entera, para plancha, empanar o rellenar.", { op: ["Entera", "Fileteada fina", "Fileteada gruesa", "En tacos", "En tiras", "Picada"] });
p("pollo", "Filetes de pechuga de pollo", "Ya fileteada.", { op: ["Finos", "Gruesos"] });
p("pollo", "Muslo de pollo", "Con hueso, para guisar, freír o asar.", { op: ["Entero", "Deshuesado"] });
p("pollo", "Contramuslo de pollo", "Con o sin piel y hueso.", { op: ["Con hueso", "Deshuesado", "Sin piel"] });
p("pollo", "Jamoncitos de pollo", "Parte baja del muslo, para horno o fritura.", {});
p("pollo", "Alitas de pollo", "Para freír, horno o barbacoa.", { op: ["Enteras", "Partidas"] });
p("pollo", "Cuartos traseros de pollo", "Muslo y contramuslo juntos.", { op: ["Enteros", "Partidos"] });
p("pollo", "Solomillo de pollo", "Tiras magras, para salteados.", {});
p("pollo", "Carcasa de pollo", "Para caldos.", {});
p("pollo", "Gallina", "Para caldos y cocidos.", { u: "ud", op: ["Entera", "Troceada"] });
p("pollo", "Picantón", "Pequeño y tierno, uno por persona.", { u: "ud", op: ["Entero", "Abierto"] });
p("pollo", "Capón (por encargo)", "Para asar. Pídelo con antelación.", { u: "ud", op: ["Entero"] });
p("pollo", "Codornices", "Para asar o a la plancha.", { u: "ud", op: ["Enteras", "Abiertas"] });

// ---------- Pavo ----------
p("pavo", "Pechuga de pavo", "Magra, entera o en filetes.", { op: ["Entera", "Fileteada fina", "Fileteada gruesa", "En tacos", "Picada"] });
p("pavo", "Solomillo de pavo", "La parte interna de la pechuga, muy tierna.", { op: ["Entero", "En medallones"] });
p("pavo", "Filetes de pavo", "Para plancha o empanar.", { op: ["Finos", "Gruesos"] });
p("pavo", "Muslo de pavo", "Grande y jugoso, para guisar o asar.", { op: ["Entero", "Deshuesado", "Troceado"] });
p("pavo", "Contramuslo de pavo", "Carne más oscura, para guisos.", { op: ["Entero", "Deshuesado"] });
p("pavo", "Alas de pavo", "Para guisar o asar.", {});
p("pavo", "Pavo troceado para guisar", "En trozos.", {});
p("pavo", "Pavo entero (por encargo)", "Para asar. Pídelo con antelación.", { u: "ud", op: ["Entero", "Troceado"] });

// ---------- Conejo ----------
p("conejo", "Conejo entero", "Conejo fresco. Precio por pieza, el peso varía.", { u: "ud", op: ["Entero", "Troceado", "Troceado para paella", "Abierto"] });
p("conejo", "Conejo troceado", "En trozos, para guisar, freír o paella.", { op: ["Para guisar", "Para freír", "Para paella"] });
p("conejo", "Muslos de conejo", "Para escabeche, guisos y fritos.", {});
p("conejo", "Paletillas de conejo", "Finas y tiernas, fritas o al ajillo.", {});
p("conejo", "Lomo de conejo", "Tierno y magro, a la plancha o relleno.", { op: ["Entero", "Abierto en filete"] });
p("conejo", "Costillar de conejo", "Para arroces y guisos.", {});

// ---------- Caza (de temporada, por encargo) ----------
p("caza", "Solomillo de jabalí", "Caza de temporada. Consulta disponibilidad.", { op: ["Entero", "En medallones"] });
p("caza", "Lomo de jabalí", "Caza de temporada. Consulta disponibilidad.", { op: ["Entero", "Fileteado"] });
p("caza", "Jabalí para guisar", "Troceado para guisos y ragú.", { op: ["En tacos"] });
p("caza", "Solomillo de venado", "Caza de temporada. Consulta disponibilidad.", { op: ["Entero", "En medallones"] });
p("caza", "Lomo de venado", "Caza de temporada. Consulta disponibilidad.", { op: ["Entero", "Fileteado"] });
p("caza", "Venado para guisar", "Troceado para guisos y ragú.", { op: ["En tacos"] });
p("caza", "Perdiz", "Caza de temporada. Consulta disponibilidad.", { u: "ud", op: ["Entera", "Abierta"] });
p("caza", "Liebre", "Caza de temporada. Consulta disponibilidad.", { u: "ud", op: ["Entera", "Troceada"] });
p("caza", "Faisán", "Caza de temporada. Consulta disponibilidad.", { u: "ud", op: ["Entero", "Troceado"] });
p("caza", "Paloma", "Caza de temporada. Consulta disponibilidad.", { u: "ud", op: ["Entera", "Abierta"] });

// ---------- Casquería ----------
p("casqueria", "Callos de ternera", "Limpios y listos para cocinar.", {});
p("casqueria", "Rabo de toro", "Para el clásico guiso andaluz de cocción lenta.", { paso: 500, op: ["Troceado", "Entero"] });
p("casqueria", "Pata de ternera", "Para callos y guisos gelatinosos.", { op: ["Entera", "Troceada", "Deshuesada"] });
p("casqueria", "Morro de ternera", "Para callos y guisos.", {});
p("casqueria", "Hígado de ternera", "En filetes o entero.", { op: ["Fileteado", "En una pieza"] });
p("casqueria", "Hígado de cerdo", "En filetes o entero.", { op: ["Fileteado", "En una pieza"] });
p("casqueria", "Riñones de ternera", "Limpios, para salteados y guisos.", {});
p("casqueria", "Riñones de cordero", "Para salteados y a la plancha.", {});
p("casqueria", "Lengua de ternera", "Para cocer, estofar o en salsa.", {});
p("casqueria", "Lengua de cerdo", "Para cocer o estofar.", {});
p("casqueria", "Corazón de ternera", "Para guisos y plancha.", {});
p("casqueria", "Mollejas de ternera", "Para freír o salteadas.", { op: ["Limpias"] });
p("casqueria", "Mollejas de cordero", "Para freír o al ajillo.", { op: ["Limpias"] });
p("casqueria", "Manitas de cerdo", "Para guisos y callos.", { op: ["Enteras", "Partidas"] });
p("casqueria", "Oreja de cerdo", "Para guisar o a la plancha.", {});
p("casqueria", "Morro de cerdo", "Para guisos y callos.", {});
p("casqueria", "Rabo de cerdo", "Para guisos y cocidos.", {});
p("casqueria", "Asadura de cordero", "Hígado, corazón y pulmón de cordero.", {});
p("casqueria", "Gallinejas y entresijos de cordero", "Para freír. Pídelas con antelación.", {});
p("casqueria", "Cabeza de cordero", "Para asar o guisar. Pídela con antelación.", { u: "ud", op: ["Entera", "Partida"] });
p("casqueria", "Higaditos y corazones de pollo", "Para salteados y guisos.", {});
p("casqueria", "Mollejas de pollo", "Para guisos y fritos.", {});

// ---------- Jamones y paletillas ----------
p("jamones", "Jamón ibérico de bellota", "Loncheado a cuchillo o a máquina.", { paso: 100, op: LONCHEAR });
p("jamones", "Jamón ibérico de cebo", "Loncheado o en taco.", { paso: 100, op: LONCHEAR });
p("jamones", "Jamón serrano", "Loncheado o en taco.", { paso: 100, op: LONCHEAR });
p("jamones", "Paleta ibérica de bellota", "Loncheada o en taco.", { paso: 100, op: LONCHEAR });
p("jamones", "Paleta ibérica de cebo", "Loncheada o en taco.", { paso: 100, op: LONCHEAR });
p("jamones", "Paleta serrana", "Loncheada o en taco.", { paso: 100, op: LONCHEAR });
p("jamones", "Lomo ibérico embuchado", "Loncheado o en taco.", { paso: 100, op: LONCHEAR });
p("jamones", "Caña de lomo ibérica", "Loncheada o en pieza.", { paso: 100, op: LONCHEAR });

// ---------- Embutidos y fiambres ----------
p("embutidos", "Chorizo fresco", "Para freír, asar o parrilla.", { op: ["Dulce", "Picante"] });
p("embutidos", "Chorizo curado", "Para tabla, bocadillos o cocinar.", { paso: 100, op: ["Dulce", "Picante", "Loncheado", "En taco"] });
p("embutidos", "Chorizo ibérico", "Curado, loncheado o en taco.", { paso: 100, op: LONCHEAR });
p("embutidos", "Salchichón", "Loncheado o en taco.", { paso: 100, op: LONCHEAR });
p("embutidos", "Salchichón ibérico", "Loncheado o en taco.", { paso: 100, op: LONCHEAR });
p("embutidos", "Morcilla", "Para freír, a la plancha o en guisos.", { op: ["Con cebolla", "De arroz", "Ibérica"] });
p("embutidos", "Longaniza", "Fresca o curada.", { op: ["Fresca", "Curada"] });
p("embutidos", "Butifarra", "Para plancha o parrilla.", {});
p("embutidos", "Morcón", "Para cortar en lonchas o cocinar.", { op: ["Rojo", "Blanco"] });
p("embutidos", "Chicharrones", "Chicharrón prensado o en pieza.", { paso: 100, op: ["Prensado", "En pieza"] });
p("embutidos", "Torreznos", "Panceta curada y adobada, para freír.", { paso: 100, op: ["En tiras", "En taco"] });
p("embutidos", "Bacon", "En lonchas o en tiras.", { paso: 100, op: ["Loncheado", "En tiras", "En taco"] });
p("embutidos", "Sobrasada", "Para untar o cocinar.", { paso: 100, op: [] });
p("embutidos", "Jamón cocido", "Fiambre al corte.", { paso: 100, op: ["Loncheado fino", "Loncheado grueso"] });
p("embutidos", "Pechuga de pavo cocida", "Fiambre al corte.", { paso: 100, op: ["Loncheada fina", "Loncheada gruesa"] });
p("embutidos", "Mortadela", "Fiambre al corte.", { paso: 100, op: ["Loncheada fina", "Loncheada gruesa"] });

// ---------- Quesos ----------
p("quesos", "Queso curado de oveja", "Curado, con sabor intenso.", { paso: 100, op: ["En cuña", "Loncheado", "En taco"] });
p("quesos", "Queso semicurado de oveja", "Suave y mantecoso.", { paso: 100, op: ["En cuña", "Loncheado", "En taco"] });
p("quesos", "Queso manchego", "Curado o semicurado.", { paso: 100, op: ["Curado", "Semicurado", "En cuña", "Loncheado"] });
p("quesos", "Queso de cabra semicurado", "Suave, de cabra.", { paso: 100, op: ["En cuña", "Loncheado"] });
p("quesos", "Queso de cabra curado", "De cabra, curado.", { paso: 100, op: ["En cuña", "Loncheado"] });
p("quesos", "Queso tierno", "Suave y fresco.", { paso: 100, op: ["En cuña", "Loncheado"] });
p("quesos", "Queso fresco", "Para ensaladas y tostas.", { paso: 100, op: [] });
p("quesos", "Queso en aceite", "Curado en aceite de oliva.", { paso: 100, op: [] });

// ---------- Elaborados ----------
p("elaborados", "Hamburguesas de ternera", "Hechas en casa, para plancha o parrilla.", { u: "ud", max: 40, op: [] });
p("elaborados", "Hamburguesas de ternera y cerdo", "Hechas en casa, mixtas.", { u: "ud", max: 40, op: [] });
p("elaborados", "Hamburguesas de cerdo", "Hechas en casa.", { u: "ud", max: 40, op: [] });
p("elaborados", "Hamburguesas de pollo", "Hechas en casa.", { u: "ud", max: 40, op: [] });
p("elaborados", "Salchichas frescas de cerdo", "Para plancha, parrilla o sartén.", { op: [] });
p("elaborados", "Salchichas frescas de pollo", "Para plancha, parrilla o sartén.", { op: [] });
p("elaborados", "Pinchitos morunos de cerdo", "Adobados al estilo andaluz.", { op: ["Amarillos (adobo andaluz)", "Rojos (con pimentón)"] });
p("elaborados", "Pinchitos morunos de pollo", "Adobados al estilo andaluz.", { op: ["Amarillos (adobo andaluz)", "Rojos (con pimentón)"] });
p("elaborados", "Pinchitos de cordero", "Adobados.", { op: ["Amarillos (adobo andaluz)", "Rojos (con pimentón)"] });
p("elaborados", "Brochetas de pollo", "Con verduras o sin ellas.", { u: "ud", max: 40, op: ["Solo carne", "Con verduras"] });
p("elaborados", "Albóndigas", "Caseras, listas para freír o guisar.", { op: ["Mixtas", "De ternera", "De cerdo"] });
p("elaborados", "Carne picada de ternera", "Picada al momento.", { op: ["Una molienda", "Doble molienda"] });
p("elaborados", "Carne picada de cerdo", "Picada al momento.", { op: ["Una molienda", "Doble molienda"] });
p("elaborados", "Carne picada mixta", "Ternera y cerdo, picada al momento.", { op: ["Una molienda", "Doble molienda"] });
p("elaborados", "Carne picada de pollo", "Picada al momento.", { op: [] });
p("elaborados", "Carne picada de pavo", "Picada al momento.", { op: [] });
p("elaborados", "Costillas adobadas", "Listas para horno o barbacoa.", { op: ["En tiras", "Troceadas"] });
p("elaborados", "Lomo adobado", "Para plancha, sartén o horno.", { op: ["Fileteado", "En una pieza"] });
p("elaborados", "Alitas de pollo adobadas", "Para horno, freidora o barbacoa.", { op: ["Adobo al ajillo", "Al pincho moruno", "Barbacoa"] });
p("elaborados", "Lagrimitas de pollo", "Para freír.", {});
p("elaborados", "Filetes de pollo empanados", "Para freír.", {});
p("elaborados", "San Jacobos", "De jamón y queso, para freír.", { u: "ud", max: 40, op: [] });
p("elaborados", "Flamenquines", "Para freír.", { u: "ud", max: 40, op: [] });
p("elaborados", "Pechugas rellenas de bechamel", "Para freír.", { u: "ud", max: 40, op: [] });
p("elaborados", "Cachopo", "Ternera rellena de jamón y queso, para freír.", { u: "ud", max: 20, op: ["De ternera", "De pollo"] });

// ---------- Huevos ----------
p("huevos", "Huevos camperos", "Por docena. Pedido mínimo de media docena.", { u: "ud", paso: 6, min: 6, max: 120, op: [] });
p("huevos", "Huevos de gallina", "Por docena. Pedido mínimo de media docena.", { u: "ud", paso: 6, min: 6, max: 120, op: ["Tamaño M", "Tamaño L"] });
p("huevos", "Huevos de codorniz", "Por bandeja de 12.", { u: "ud", paso: 12, min: 12, max: 120, op: [] });

// ---------- Avíos del puchero ----------
p("avios", "Hueso de caña de ternera", "Para caldos y puchero.", { op: ["Entero", "Partido"] });
p("avios", "Hueso de rodilla", "Para caldos y puchero.", { op: ["Entero", "Partido"] });
p("avios", "Huesos de jamón", "Para dar sabor al puchero.", { op: ["Entero", "Partido"] });
p("avios", "Tocino fresco", "Para el puchero.", { op: ["En una pieza", "En tiras"] });
p("avios", "Tocino salado", "Para el puchero.", { op: ["En una pieza", "En tiras"] });
p("avios", "Codillo salado", "Para el puchero.", { op: ["Entero", "Partido"] });
p("avios", "Costilla salada", "Para el puchero.", { op: ["En una pieza", "Troceada"] });
p("avios", "Espinazo de cerdo", "Para el puchero y guisos.", { op: ["Entero", "Troceado"] });
p("avios", "Gallina para caldo", "Para el puchero.", { u: "ud", op: ["Entera", "Troceada"] });
p("avios", "Morcillo de ternera para puchero", "Para el puchero.", { op: ["En una pieza", "En tacos"] });

// ---------- Especias ----------
for (const [n, d] of [
  ["Pimentón dulce", "Para guisos, adobos y embutidos."],
  ["Pimentón picante", "Para guisos, adobos y embutidos."],
  ["Pimienta negra molida", "Para carnes y salsas."],
  ["Comino molido", "Para carnes, guisos y pinchitos."],
  ["Orégano", "Seco."],
  ["Laurel", "En hoja."],
  ["Ajo en polvo", "Para adobos y rebozados."],
  ["Adobo para pinchitos", "Mezcla de especias para adobar."],
  ["Adobo para carne", "Mezcla de especias para adobar."],
  ["Sal gruesa", "Para asar y cocer."],
  ["Sal en escamas", "Para rematar carnes a la plancha."],
]) p("especias", n, d, { u: "ud", max: 20 });

// ---------- Salsas ----------
for (const [n, d] of [
  ["Mojo picón", "Para carnes y patatas."],
  ["Salsa chimichurri", "Para parrilla y barbacoa."],
  ["Salsa barbacoa", "Para costillas y alitas."],
  ["Salsa de pimienta", "Para chuletón y solomillo."],
  ["Alioli", "Para carnes y patatas."],
  ["Salsa brava", "Para patatas y albóndigas."],
  ["Mostaza", "Antigua o suave."],
]) p("salsas", n, d, { u: "ud", max: 20 });

// ---------- Vino (solo mayores de 18 años) ----------
for (const [n, d] of [
  ["Vino tinto crianza", "Botella de 75 cl."],
  ["Vino tinto joven", "Botella de 75 cl."],
  ["Vino blanco", "Botella de 75 cl."],
  ["Vino rosado", "Botella de 75 cl."],
  ["Fino", "Vino de Jerez. Botella."],
  ["Manzanilla", "Botella."],
  ["Amontillado", "Vino de Jerez. Botella."],
  ["Oloroso", "Vino de Jerez. Botella."],
]) p("vino", n, d, { u: "ud", max: 24, alc: true });

// ---------- Orden y comprobaciones ----------
const ids = new Set();
lista.forEach((x, i) => {
  if (ids.has(x.id)) throw new Error("id repetido: " + x.id);
  ids.add(x.id);
  x.orden = i + 1;
});
for (const x of lista) if (!categorias.some((c) => c.id === x.categoria)) throw new Error("categoría desconocida " + x.categoria);

writeFileSync(new URL("../data/categorias.json", import.meta.url), JSON.stringify(categorias, null, 2) + "\n");
writeFileSync(new URL("../data/productos.default.json", import.meta.url), JSON.stringify(lista, null, 2) + "\n");
console.log(`${categorias.length} categorías, ${lista.length} productos`);
const porCat = {}; for (const x of lista) porCat[x.categoria] = (porCat[x.categoria] || 0) + 1; console.log(porCat);
