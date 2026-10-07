# Guía rápida del panel (para el carnicero)

Entras en **tu-web/admin/** (la misma dirección de la web, añadiendo `/admin/`) y escribes la contraseña.
En el móvil funciona igual que en el ordenador. Arriba tienes siete pestañas.

## Pedidos

- Aquí aparecen los pedidos que entran por la web, **el más nuevo arriba**. El número rojo de la pestaña son los pedidos en estado *Nuevo* (hasta que cambies su estado).
- Cada pedido muestra el cliente (con enlaces para **llamar** o escribir por **WhatsApp**), si recoge o es reparto, día, franja, los productos con su cantidad, el total y los comentarios.
- Cambia el **Estado** según avances: *Nuevo → Confirmado → Preparado → Entregado* (o *Cancelado*). Se guarda solo.
- La **nota interna** es solo para ti; el cliente no la ve.
- **Descargar Excel (CSV)** baja todos los pedidos para guardarlos o enviarlos a la gestoría.
- Los pedidos **no se borran solos**. Si quieres quitar uno, pulsa *Eliminar pedido* (no se puede deshacer).
- Importante: el cliente envía el pedido por WhatsApp desde su móvil. Si no pulsa ese botón, el pedido queda guardado aquí igualmente, pero él no te habrá escrito; por eso conviene mirar esta pestaña de vez en cuando.

## Productos

- Los productos salen **por categorías**, plegadas: pulsa en el nombre de una categoría para abrirla y verás sus productos; arriba tienes **botones con las categorías** para ir directo a una (como hace el cliente en la tienda). «Abrir todas» y «Cerrar todas» las despliegan o pliegan; el buscador abre solo las que tienen resultados. En el móvil, las herramientas de precios (redondeo, orientativos, fecha) están plegadas bajo «Herramientas de precios».
- **Fecha de precios:** la tienda enseña a los clientes «Precios actualizados por última vez el…». Se pone sola cada vez que cambias un precio. Si has repasado los precios y todos siguen bien, pulsa **«Los precios están al día (hoy)»**. Aceptar de golpe los precios orientativos *no* cambia la fecha (son estimaciones sin revisar).
- **Pie de la web:** abajo del todo aparece «Web actualizada el… · versión…». Es automático; no tienes que hacer nada.
- **Precios orientativos:** cada producto trae un precio sugerido (lo ves en naranja, «Orientativo: 14,90 €/kg»). Son una estimación aproximada, **no verificada**: revísalos con tus precios reales. Hasta que no pulses **Aceptar** (o «Aceptar los N precios orientativos pendientes», que los acepta todos de golpe sin tocar los que ya tengan precio), el cliente sigue viendo «Consultar».
- **Semáforo:** junto a cada precio verás una etiqueta: **verde** (bien), **ámbar** (algo bajo o algo alto) o **rojo** (muy barato, muy caro, o que no cubre tu coste). Si has escrito tu coste mide tu **margen real**; si no, compara con el precio habitual del mercado.
- **Calculadora:** en **Editar → «Ayuda para poner el precio»** puedes (1) escribir el precio tú, (2) calcularlo **desde lo que te cuesta** (coste sin IVA, merma y el recargo que quieras poner encima; suma el IVA y aplica el redondeo ,90) o (3) subir o bajar el orientativo con botones de −10 % a +10 %. Lo que escribas de coste, merma y recargo es **privado**: nunca lo ve el cliente.
- Escribe el **precio** directamente en la casilla de cada producto y sal de ella: se guarda en el momento (verás «✓ Guardado»). **Si el precio que escribes se aleja mucho del que tenía (menos de la mitad o más del doble) o del orientativo, te pregunta «¿Es correcto?»** para pillar erratas (un cero de más, una coma mal puesta): si dices que no, vuelve al de antes.
- Si dejas el precio **vacío**, en la tienda se verá **«Consultar precio»** y el cliente podrá pedirlo igualmente.
- Marca **Agotado** cuando no tengas algo: se sigue viendo, pero no se puede pedir. Al volver a tenerlo, desmárcalo.
- **Redondeo del precio por kilo:** si eliges «Terminar en ,90» (o ,95), cada precio por kilo que guardes se sube al siguiente que acabe así (14,31 → 14,90). No se aplica a lo que se vende por unidades. El botón *Aplicar ahora a todos* cambia todos los precios que ya hay.
- **Editar** abre la ficha completa: nombre, categoría, descripción, si se vende al peso o por unidades, de cuánto en cuánto se puede pedir (250 g por defecto), opciones al pedir (por ejemplo «En filetes», «Picada»), foto, y si es **Oculto** (no aparece en la tienda) o bebida alcohólica (el cliente tendrá que confirmar que es mayor de 18).
- **Fotos por defecto:** cada categoría ya trae su foto y cada pieza muestra el icono de su categoría hasta que subas la suya.
- **Foto:** pulsa *Subir foto* y elige una del móvil o del ordenador (formatos **JPG, PNG o WebP**, del tamaño que sea). Se ajusta sola: si es enorme se reduce y si es muy pequeña se amplía (puede verse algo borrosa); si es diminuta (menos de 120 px) te dirá que uses otra. Además se le quitan los datos ocultos, como la ubicación. Luego pulsa **Guardar**.
- **Ofertas:** se programan en su propia pestaña, **Ofertas** (ver más abajo). En la lista de productos verás una etiqueta como «3x2 hasta el 11/10», y en la ficha de cada producto («Editar») un resumen con un botón que te lleva a la pestaña Ofertas.
- **Añadir producto** crea uno nuevo. Para dejar de ofrecer algo un tiempo, mejor *Oculto* o *Agotado* que *Eliminar*.

## Mercado

Sirve para que el semáforo de los precios se apoye en lo que cuestan **otras tiendas**, no solo en mi estimación. Solo lo ves tú; el cliente no ve nada de esto.

- **Anotar precios:** elige la tienda (Mercadona, Lidl, Aldi…), mira el precio por kilo en su web o en el lineal y escríbelo en cada producto; pulsa **Guardar precios**. Lo que dejes en blanco no se toca. La **fecha** del precio es hoy salvo que la cambies. Con una vez por semana basta.
- Se muestran **30 productos de referencia** (pollo, cerdo, ternera, cordero, picada…). Marca «Mostrar todos los productos al peso» si quieres anotar más.
- **Cómo se usa:** el semáforo coge la **mediana** de las tiendas con precio reciente (hasta 45 días) y te dice cuántas son y de cuándo es la más antigua. Si no hay ninguna reciente, vuelve a la estimación propia.
- **Fuentes:** puedes cambiar cada cuánto repasas cada tienda, quitarla o **añadir otra** (una carnicería online, un mayorista…). Antes de usar la web de otra empresa, mira sus condiciones: aquí solo anotas a mano lo que ves publicado.
- El panel te avisa (y la pestaña **Estado**) si una tienda semanal lleva más de 7 días sin anotarse.

## Ofertas

Aquí programas lo que quieras anunciar. Se activa y se desactiva **solo** en las fechas que pongas (el primer y el último día entran), y en la **portada** y en la **tienda** sale un bloque «**Oferta de la semana**» (si hay una sola cosa) o «**Ofertas de la semana**» (si hay varias): tarjetas con foto, precio y «hasta el…», que en el móvil se deslizan con el dedo. Si no hay nada activo, el bloque no aparece.

- **Crear oferta:** pulsa *Crear oferta*, busca el producto y elígelo en la lista, y escoge el tipo: una **rebaja de precio** (pones el precio de oferta; la tienda enseña tu precio de siempre **tachado** y el de oferta) o un **3x2** (o 2x1, 4x3…: «se lleva 3, se paga 2»; de cada 3 kg se regala 1: 3 kg pagan 2, 4,5 kg pagan 3,5). Las fechas vienen puestas para una semana; cámbialas si quieres.
- **Reglas:** solo una oferta a la vez en cada producto (si dos coinciden en fechas, te avisa); la rebaja necesita que el producto tenga su precio normal y que la oferta sea más barata; el 3x2 también necesita precio. Puedes dejar ofertas **programadas** para más adelante: no se ven hasta su día.
- **La lista:** *Activas hoy*, *Programadas* y *Terminadas* (plegadas, con un botón para borrarlas). Con *Cambiar* modificas una oferta y con *Quitar* la borras.
- **Lo que no sale en el bloque:** un producto agotado o sin precio.
- **El precio tachado lo calcula la web, no tú.** La ley (Ley 7/1996, art. 20) obliga a enseñar el **precio anterior**, que es **el más bajo que hayas aplicado a ese producto en los 30 días anteriores al inicio de la rebaja**. La web guarda el historial de tus precios y ofertas y tacha ese precio, que puede ser distinto de tu precio de ahora (por ejemplo, si lo subiste hace poco). Si una oferta no cuenta como rebaja (porque en esos 30 días ya vendiste más barato, o es la primera vez que pones precio al producto), al crearla te sale un aviso ⚠ y, en la tienda, se cobra lo que programaste pero **sin tachar nada ni llamarla oferta**. Por eso, **dos rebajas seguidas del mismo producto** tienen que dejar 30 días entre una y otra para que la segunda vuelva a tachar el precio de siempre. El historial empieza con esta versión. La ley exceptúa los descuentos que hagas solo para no tirar género próximo a caducar, pero la web no distingue: los cuenta como cualquier otro precio (así el tachado nunca queda más alto de lo debido). **Si pones una oferta por debajo de lo que te cuesta el producto, el panel te avisa**: vender con pérdida puede ser desleal en algunos casos. Conviene que tu gestoría confirme todo esto.
- **Regalo por compra**, más abajo en la misma pestaña: por ejemplo, «por cada 30 € de compra, 250 g de chorizo de regalo». Pulsa *Añadir un regalo*, escribe qué regalas y a partir de cuántos euros, y si quieres las fechas, y **guarda con *Guardar regalos***. «Se repite» regala uno más por cada 30 € (60 € = 2 regalos); si lo desmarcas, es uno solo. Cuenta lo que se paga por los productos (ya con las ofertas, sin el envío). El cliente lo ve en el bloque de ofertas, en su carrito («te faltan X € para tu regalo»), en el mensaje de WhatsApp, y a ti te sale en el pedido. El regalo es solo un texto: tú lo preparas.

## Tienda

Aquí decides cómo funcionan los pedidos:

- **Tienda abierta:** interruptor general. Cerrada, los botones de pedir de la web llevan a WhatsApp, como antes.
- **Aviso:** un mensaje que se ve arriba de la tienda («Esta semana no hay reparto el viernes»).
- **Pedido mínimo, antelación, días de margen y días sin servicio** (festivos, vacaciones).
- **Recogida** y **Reparto**: días y franjas horarias, coste del envío, envío gratis a partir de…, pedido mínimo para reparto.
- **Zona de reparto:** puedes poner una **lista de códigos postales**, un **radio en km** desde la tienda, o las dos cosas. Con solo códigos postales, el cliente tiene que escribir uno de tu lista. Con radio, los códigos de la lista entran siempre y el resto se comprueba por distancia; si el programa no consigue localizar la dirección, el pedido entra igualmente con el aviso **«Dirección por verificar»** para que lo mires tú antes de aceptarlo. La distancia es en línea recta, no por carretera.
- **Formas de pago:** efectivo, tarjeta (solo al recoger), Bizum y transferencia. La web **no cobra**: se paga al recoger o recibir.
- Pulsa **Guardar cambios** abajo. Si algo está mal, te dirá qué campo es.

- **Precios y márgenes** (más abajo): el recargo que sueles poner por defecto (30 % de partida) y el IVA de cada categoría. Los IVA que trae son de partida: confírmalos con tu gestoría.

## Negocio

Nombre, dirección, teléfono, **horario**, mapa y datos para Google. Al guardar, **la web entera se actualiza** (portada, horario, mapa, aviso legal…). Rellena aquí también la **razón social, el NIF y el correo electrónico**: salen en el aviso legal y la política de privacidad, y la ley los pide a quien vende por internet. **Hasta que los pongas, el aviso legal enseña «a completar»; ponlos antes de vender.**

## Estado

Una lista de lo que falta antes de abrir la tienda y un botón para **comprobar que el servidor funciona**. Si algo sale en rojo («FALLA»), avisa a quien mantiene la web.

## Preguntas habituales

- **¿Cambiar la contraseña?** Se hace en Netlify (*Site configuration → Environment variables → ADMIN_PASSWORD*) y luego hay que volver a publicar la web. Si crees que alguien la conoce, cámbiala.
- **¿Me sale «La sesión ha caducado»?** Es normal pasadas unas horas: vuelve a entrar. Lo que tenías sin guardar se pierde.
- **¿Se ven los cambios al momento?** Los de productos y precios, en segundos. Si no ves uno, recarga la página (Ctrl+F5 en ordenador).
- **¿Y si me equivoco con un precio?** Corrígelo y listo; los pedidos ya hechos conservan el precio que tenían.
