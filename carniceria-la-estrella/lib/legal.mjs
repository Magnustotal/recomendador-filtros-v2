// Textos legales que dependen de si la tienda está abierta y de los datos del negocio.
// Son un borrador razonable, NO asesoramiento jurídico: conviene que los revise una gestoría
// o un abogado antes de abrir la tienda (ver README, apartado "Revisión legal").

export function textosLegales(ajustes, escapar) {
  const n = ajustes.negocio;
  const nombre = escapar(n.nombre);
  const activa = ajustes.tienda.activa;
  const pendiente = (valor, etiqueta) => (valor ? `<strong>${escapar(valor)}</strong>` : `<mark>[${etiqueta} a completar]</mark>`);

  const datosContacto = `<p>
      Si nos escribes por <strong>WhatsApp</strong> o nos llamas por <strong>teléfono</strong>, tratamos
      los datos que tú mismo nos facilitas por esos medios, solo para responder a tu consulta o gestionar
      tu encargo. No usamos esos datos para enviarte publicidad ni los cedemos a terceros salvo obligación legal.
    </p>`;

  const radio = activa && ajustes.tienda.reparto.activo && ajustes.tienda.reparto.radioKm != null;
  const t = {
    geocodificacion: radio
      ? `      <li><strong>OpenStreetMap (Nominatim)</strong>: si pides reparto a domicilio y tu código postal no está en la lista de la zona, tu dirección de entrega se envía a este servicio para calcular la distancia a la tienda. Solo se usa para eso.</li>`
      : "",
    razonSocial: pendiente(n.razonSocial, "razón social"),
    nif: pendiente(n.nif, "NIF"),
    email: pendiente(n.email, "correo electrónico"),
    // Datos que la Orden de 24 de abril de 2026 (Andalucía, anexo II) manda enseñar donde se venda por internet
    reclamaciones: `Si desea reclamar, puede hacerlo a través de <a href="https://www.consumoresponde.es" target="_blank" rel="noopener">www.consumoresponde.es</a> y dirigirse a: ${pendiente(n.razonSocial, "razón social")}, CIF ${pendiente(n.nif, "NIF")}, ${escapar(n.calle)}, ${escapar(n.cp)} ${escapar(n.localidad)} (${escapar(n.provincia)}), correo electrónico ${pendiente(n.email, "correo electrónico")}. Para más información: <a href="https://www.consumoresponde.es" target="_blank" rel="noopener">www.consumoresponde.es</a>, consumoresponde@juntadeandalucia.es, teléfono gratuito 900 21 50 80.`,
  };

  if (!activa) {
    return {
      ...t,
      datos: `    <p>Esta web no tiene formulario de contacto ni recoge tu email.</p>\n    ${datosContacto}`,
      base: `    <p>La base legal para tratar tus datos es tu consentimiento, que nos das al escribirnos o llamarnos directamente.</p>`,
      conservacion: `    <p>Conservamos los datos de tus mensajes o llamadas solo el tiempo necesario para atender tu consulta o tu encargo. Una vez resuelto, los eliminamos, salvo que una obligación legal nos exija conservarlos más tiempo.</p>`,
      whatsapp: `      <li><strong>WhatsApp (Meta)</strong>: si nos escribes por WhatsApp, esa conversación se rige además por la política de privacidad de WhatsApp.</li>`,
      almacenamiento: `    <p>La web incluye un panel privado de gestión que usa una cookie técnica de sesión, solo para quien administra la web.</p>`,
      objeto: `    <p>
      Este sitio web tiene carácter informativo. Su finalidad es dar a conocer la actividad de
      ${nombre} y facilitar el contacto con el negocio. No se realizan ventas a través de esta web:
      los precios y la disponibilidad de producto se consultan por teléfono, WhatsApp o en persona
      en la tienda.
    </p>`,
      condicionesPedido: "",
      numLegislacion: "7",
    };
  }

  return {
    ...t,
    datos: `    <p>
      Si haces un <strong>pedido en la web</strong>, tratamos los datos que rellenas: nombre, teléfono,
      dirección de entrega (solo si eliges reparto a domicilio), productos pedidos, día y franja horaria,
      forma de pago y comentarios. Los usamos únicamente para preparar y entregar tu pedido y para avisarte
      si hay algún cambio.
    </p>
    <p>
      En la web no se paga ni se guardan datos de tarjeta: el pago se hace al recoger o al recibir el pedido
      (o por Bizum o transferencia, fuera de la web).
    </p>
    ${datosContacto}`,
    base: `    <p>
      La base legal para tratar los datos de tu pedido es que nos los necesitas para que preparemos y
      entreguemos lo que has pedido (ejecución del contrato, art. 6.1.b del RGPD). Para las consultas por
      WhatsApp o teléfono, la base es tu propia petición y consentimiento al contactarnos.
    </p>`,
    conservacion: `    <p>
      Guardamos tus pedidos mientras sean necesarios para gestionar la actividad de la tienda y, después,
      durante los plazos que exija la ley (por ejemplo, obligaciones fiscales y contables). Los pedidos no se
      borran automáticamente. Puedes pedirnos que borremos tus datos en cualquier momento, salvo los que
      debamos conservar por obligación legal.
    </p>`,
    whatsapp: `      <li><strong>WhatsApp (Meta)</strong>: al pulsar el botón para enviar el pedido por WhatsApp, el resumen
        se envía por ese servicio, sujeto a su propia política de privacidad.</li>`,
    almacenamiento: `    <p>
      Para recordar tu pedido mientras eliges productos, la tienda guarda el contenido del carrito en el
      almacenamiento local de tu navegador. No se envía a ningún servidor hasta que confirmas el pedido. Es un
      almacenamiento técnico necesario para el servicio y puedes borrarlo cuando quieras desde los ajustes del
      navegador o con el botón «Vaciar el pedido».
    </p>
    <p>La web incluye también un panel privado de gestión que usa una cookie técnica de sesión, solo para quien administra la web.</p>`,
    objeto: `    <p>
      Este sitio web da a conocer la actividad de ${nombre} y permite hacer pedidos online de los productos
      de la tienda, para recogerlos en el establecimiento o recibirlos a domicilio. El pago no se hace en
      la web: se abona al recoger o al recibir el pedido, o por Bizum o transferencia, según las formas de
      pago que se indican al hacer el pedido.
    </p>`,
    condicionesPedido: `    <h2 id="condiciones-pedidos">7. Condiciones de los pedidos online</h2>
    <ul>
      <li><strong>Precios.</strong> Los precios que ves son finales, con los impuestos incluidos. Los productos sin precio te los confirmamos por WhatsApp o por teléfono.</li>
      <li><strong>Errores de precio.</strong> Si vemos un error evidente en un precio (una errata, por ejemplo), te lo decimos antes de preparar el pedido. Puedes mantenerlo con el precio correcto o cancelarlo sin pagar nada.</li>
      <li><strong>Ofertas y regalos.</strong> Cada oferta y cada regalo por compra indica hasta cuándo vale y con qué condiciones. Cuando anunciamos una rebaja, junto al precio rebajado ponemos el precio anterior: el más bajo que hayamos cobrado por ese producto en los 30 días previos. Los regalos van dentro de tu pedido.</li>
      <li><strong>Peso e importe.</strong> Muchos productos se venden al peso y el peso real puede variar un poco al prepararlos. El importe definitivo se confirma entonces. Si saliera bastante más alto que el estimado, te avisamos antes de cobrarlo para que decidas.</li>
      <li><strong>Confirmación.</strong> Un pedido hecho en la web no está confirmado hasta que ${nombre} lo confirma por WhatsApp o por teléfono. Antes del día y la franja que elegiste te diremos que sí, o que no podemos aceptarlo (porque falta un producto, por ejemplo). Si para entonces no lo hemos confirmado, el pedido no cuenta y no tienes que pagar nada.</li>
      <li><strong>Pago.</strong> Hacer el pedido te obliga a pagarlo cuando lo recojas o lo recibas (o por Bizum o transferencia, según lo que elijas), una vez confirmado.</li>
      <li><strong>Desistimiento.</strong> No puedes desistir de los alimentos que se estropean o caducan rápido (carne y aves frescas, casquería, elaborados frescos) ni de lo que cortamos, picamos o preparamos a tu medida (art. 103, letras c y d, del texto refundido de la Ley General para la Defensa de los Consumidores y Usuarios). En el resto de productos, como vino, conservas, salsas o especias envasadas, sí puedes desistir sin dar ningún motivo durante <strong>14 días naturales</strong> desde que los recibes o los recoges. Avísanos de forma clara: por correo electrónico a ${t.email}, por escrito en ${escapar(n.calle)} (${escapar(n.cp)} ${escapar(n.localidad)}) o con el modelo de formulario de más abajo. Te devolvemos lo que hayas pagado en un máximo de 14 días desde tu aviso, aunque podemos esperar a recibir los productos o a que nos demuestres que los has devuelto. Los costes directos de devolverlos son tuyos. Si dudas de si un producto entra, pregúntanoslo antes de pedir.</li>
      <li><strong>Garantía.</strong> Los productos tienen la garantía legal de conformidad que la ley reconoce a los consumidores. Si algo falla en tu pedido, avísanos y lo arreglamos.</li>
      <li><strong>Bebidas alcohólicas.</strong> No se venden a menores de 18 años. Al pedirlas tienes que confirmar que eres mayor de edad, y en la entrega podemos pedirte que lo demuestres.</li>
      <li><strong>Alergias e intolerancias.</strong> Cada producto indica los alérgenos que lleva. Si es de los que suelen llevarlos (elaborados, embutidos, quesos, salsas, vino…) y no lo indica, pregúntanos antes de pedir, por teléfono o por WhatsApp. Si tienes alguna alergia o intolerancia, cuéntanoslo también en los comentarios del pedido. Al entregarte el pedido tienes a tu disposición la información obligatoria de cada producto.</li>
      <li id="reclamaciones"><strong>Quejas y reclamaciones.</strong> ${t.reclamaciones}</li>
    </ul>
    <h3>Modelo de formulario de desistimiento</h3>
    <p>(Solo si quieres desistir del contrato. Puedes copiarlo y enviarlo; su uso no es obligatorio.)</p>
    <p>
      A la atención de ${t.razonSocial}, ${escapar(n.calle)}, ${escapar(n.cp)} ${escapar(n.localidad)}, correo electrónico ${t.email}:<br>
      Por la presente le comunico que desisto de mi contrato de venta del siguiente bien: …<br>
      Pedido el / recibido el: …<br>
      Nombre del consumidor y usuario: …<br>
      Domicilio del consumidor y usuario: …<br>
      Firma del consumidor y usuario (solo si este formulario se presenta en papel): …<br>
      Fecha: …
    </p>
`,
    numLegislacion: "8",
  };
}
