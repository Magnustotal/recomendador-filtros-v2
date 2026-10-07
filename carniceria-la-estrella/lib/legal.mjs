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
    condicionesPedido: `    <h2>7. Condiciones de los pedidos online</h2>
    <ul>
      <li><strong>Precios.</strong> Los precios mostrados son precios finales para el consumidor, con los impuestos incluidos. Los productos sin precio se confirman por WhatsApp o teléfono.</li>
      <li><strong>Peso y importe.</strong> Muchos productos se venden al peso. El peso real puede variar ligeramente al prepararlos y el importe definitivo se confirma al preparar el pedido.</li>
      <li><strong>Confirmación.</strong> Un pedido enviado por la web no queda confirmado hasta que ${nombre} lo confirma por WhatsApp o teléfono. Podemos no aceptarlo, por ejemplo, si un producto no está disponible; en ese caso te avisaremos.</li>
      <li><strong>Desistimiento.</strong> Se trata de alimentos frescos que pueden deteriorarse con rapidez y de productos cortados o preparados a medida, por lo que no se aplica el derecho de desistimiento (art. 103 del texto refundido de la Ley General para la Defensa de los Consumidores y Usuarios). Si hay algún problema con tu pedido, avísanos y lo solucionamos.</li>
      <li><strong>Bebidas alcohólicas.</strong> No se venden a menores de 18 años. Al pedirlas debes confirmar que eres mayor de edad y podemos pedirte que lo acredites en la entrega.</li>
      <li><strong>Alergias e intolerancias.</strong> Si tienes alguna alergia o intolerancia, indícalo en los comentarios del pedido o consúltanos antes de pedir.</li>
    </ul>
`,
    numLegislacion: "8",
  };
}
