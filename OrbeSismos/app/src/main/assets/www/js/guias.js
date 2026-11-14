/*
 * Orbe Sismos – guías de supervivencia y herramientas de preparación.
 * Todo funciona sin internet: es justo cuando más falta hace, después de un terremoto.
 * Las recomendaciones siguen las guías de la Cruz Roja, los CDC y las oficinas de gestión del riesgo
 * (UNGRD en Colombia); la app siempre recuerda seguir las indicaciones de las autoridades.
 *
 * sismos.js llama a OrbeGuias.init(api) y delega aquí los botones con data-g y data-guia.
 */
(() => {
  'use strict';

  let A = null; // api de sismos.js: subSheet, store, esc, share, toast, N, NATIVE, closeSheet, openSeguridad, sos, setLowPower
  const PLAY = 'https://play.google.com/store/apps/details?id=com.orbesismos.app';
  const DAY = 86400000;
  const li = a => a.map(x => `<li>${x}</li>`).join('');
  const sec = (t, a) => `<h4>${t}</h4><ul>${li(a)}</ul>`;
  const box = (t, cls = '') => `<div class="explain ${cls}">${t}</div>`;
  const NOTA = `<p class="about">Estas guías no reemplazan las indicaciones de las autoridades de tu país ni un curso de primeros auxilios (la Cruz Roja los ofrece). Ante una emergencia, llama a los números de emergencia.</p>`;

  // =====================================================================
  //  Guías (texto, sin internet)
  // =====================================================================
  const GUIAS = {
    lugares: {
      ico: '📍', title: 'Según dónde estés', sub: 'Qué hacer durante el sismo en cada lugar',
      html: `<div class="guide">
        ${box('La regla de oro en casi todos los lugares: <b>agáchate, cúbrete y sujétate</b> hasta que el movimiento pare. No corras mientras tiembla: la mayoría de heridos se lastiman al moverse o por objetos que caen.')}
        ${sec('🏠 En casa', ['Métete bajo una mesa firme y sujétate de una pata. Si no hay mesa, agáchate junto a una pared interior y cúbrete la cabeza y el cuello con los brazos.', 'Aléjate de ventanas, espejos, lámparas y muebles altos.', 'No salgas hasta que pare: las fachadas, tejas y vidrios caen afuera.'])}
        ${sec('🛏️ En la cama, de noche', ['Quédate acostado boca abajo y cúbrete la cabeza con la almohada.', 'Cuando pare, ponte zapatos antes de caminar: el piso puede tener vidrios. Ten zapatos y linterna junto a la cama.'])}
        ${sec('🏢 En un edificio alto', ['Agáchate, cúbrete y sujétate donde estés. No uses ascensores.', 'Es normal que suenen alarmas y rociadores, y que el edificio se balancee mucho.', 'Baja por las escaleras solo cuando pare el movimiento, con calma y por la derecha.'])}
        ${sec('🚶 En la calle', ['Aléjate de edificios, postes, cables, vallas y árboles.', 'Busca un lugar abierto y agáchate protegiéndote la cabeza.', 'No te refugies bajo puentes ni pasos elevados.'])}
        ${sec('🚗 En el carro', ['Detente con cuidado en un lugar abierto, lejos de puentes, postes y edificios.', 'Quédate dentro con el cinturón puesto hasta que pare.', 'Después, maneja despacio: puede haber grietas, derrumbes y semáforos apagados.'])}
        ${sec('🚌 En el bus o el metro', ['Agárrate fuerte y protégete la cabeza. No te bajes mientras tiembla.', 'Sigue las instrucciones del conductor o del personal. No camines por los rieles.'])}
        ${sec('🏫 En el colegio o la oficina', ['Bajo el pupitre o el escritorio, sujetándote.', 'Sigue el plan de evacuación cuando pare y ve al punto de encuentro.', 'Los padres: no vayan corriendo por los niños; los colegios tienen protocolos y las vías se congestionan.'])}
        ${sec('🛒 En un centro comercial, cine o estadio', ['No corras hacia las salidas: las estampidas causan más heridos que el sismo.', 'Agáchate entre las sillas o junto a una columna y protégete la cabeza.', 'Sal con calma cuando pare, siguiendo las rutas señalizadas.'])}
        ${sec('🌊 En la playa o cerca del mar', ['Si el sismo es fuerte o dura más de 20 segundos, o el mar se retira de golpe: <b>sube a un lugar alto o aléjate de la costa de inmediato</b>, a pie.', 'No esperes la alerta oficial: un tsunami puede llegar en minutos. No vuelvas hasta que las autoridades lo indiquen; llegan varias olas.'])}
        ${sec('⛰️ En la montaña o en una ladera', ['Aléjate de bordes de barrancos, taludes y laderas empinadas: el sismo puede causar derrumbes.', 'Cuidado con piedras que caen y con ríos que traen lodo.'])}
      </div>${NOTA}`
    },
    agua: {
      ico: '💧', title: 'Agua segura', sub: 'Cuánta guardar y cómo hacerla potable',
      html: `<div class="guide">
        ${box('💧 Guarda <b>4 litros por persona al día</b> (2 para beber y 2 para cocinar y asearse), para <b>mínimo 3 días</b>. Lo ideal son 2 semanas. Suma agua para tus mascotas.')}
        ${sec('Cómo guardarla', ['Usa agua embotellada sellada o botellas de plástico para alimentos bien lavadas (no envases de cloro ni de químicos).', 'Llénalas con agua de la llave, ciérralas bien y guárdalas en un lugar fresco y oscuro.', 'Cambia el agua guardada en casa <b>cada 6 meses</b>; la embotellada, según su fecha de vencimiento.'])}
        ${sec('Agua de emergencia que ya tienes en casa', ['El <b>tanque del sanitario</b> (no la taza), si no tiene pastillas ni químicos de limpieza.', 'El <b>calentador de agua</b>: apágalo, déjalo enfriar y abre la llave de abajo.', 'El hielo del congelador.', 'Cierra la llave de paso principal para que no entre agua contaminada a tu casa.', '<b>Nunca bebas</b> agua de inundaciones, piscinas ni radiadores.'])}
        ${sec('🔥 Hacerla potable hirviéndola', ['Si está turbia, déjala reposar y fíltrala con una tela limpia.', 'Hiérvela <b>1 minuto</b> con hervor fuerte. <b>A más de 2.000 metros de altura</b> (Bogotá, Quito, La Paz, Ciudad de México) hiérvela <b>3 minutos</b>.', 'Déjala enfriar tapada y guárdala en envases limpios.'])}
        ${sec('🧴 Hacerla potable con blanqueador (cloro)', ['Usa blanqueador sin aroma, sin detergente, de hipoclorito de sodio al 5–6 %.', 'Agrega <b>2 gotas por cada litro</b> de agua (4 gotas si está turbia o muy fría).', 'Mezcla y espera <b>30 minutos</b>. Debe oler un poco a cloro; si no, repite la dosis y espera 15 minutos más.', 'También sirven las pastillas potabilizadoras, siguiendo las instrucciones del empaque.'])}
        ${sec('Señales de deshidratación', ['Sed fuerte, boca seca, orina oscura o muy poca, mareo, cansancio.', 'En bebés: llanto sin lágrimas, pañales secos por horas, mollera hundida. Busca ayuda médica.', 'No raciones el agua de beber si hace calor: toma lo que necesites y busca más.'])}
      </div>${NOTA}`
    },
    comida: {
      ico: '🥫', title: 'Alimentos', sub: 'Qué guardar y cómo conservar la comida sin luz',
      html: `<div class="guide">
        ${box('🥫 Ten comida para <b>mínimo 3 días</b> que no necesite nevera, cocinarse ni mucha agua. Y un <b>abrelatas manual</b>: sin él, las latas no sirven.')}
        ${sec('Qué guardar', ['Enlatados listos para comer: atún, sardinas, fríjoles, garbanzos, verduras y frutas en lata.', 'Galletas, pan tostado, barras de cereal, avena instantánea, maní y frutos secos.', 'Leche en polvo o en caja (UHT), panela, azúcar, sal.', 'Comida especial para bebés, personas con dietas (diabetes, celiaquía) y mascotas.'])}
        ${sec('Cómo mantenerla al día', ['Escribe la fecha de compra en cada producto.', 'Usa primero lo más viejo y repón lo que gastes ("lo primero que entra es lo primero que sale").', 'Revisa todo <b>cada 6 meses</b> (la app te lo puede recordar en la Mochila).'])}
        ${sec('⚡ Si se va la luz', ['<b>No abras la nevera ni el congelador</b> si no es necesario.', 'La nevera cerrada mantiene el frío unas <b>4 horas</b>. El congelador lleno, unas <b>48 horas</b> (24 si está a medio llenar).', 'Come primero lo de la nevera, después lo del congelador y por último lo de la despensa.'])}
        ${sec('🗑️ Qué botar', ['Carne, pollo, pescado, huevos, leche, quesos blandos y sobras que hayan estado <b>más de 2 horas sin frío</b>.', 'Latas abombadas, oxidadas, abolladas en la unión o que gotean.', 'Todo lo que tocó agua de inundación, aunque esté cerrado (salvo latas que puedas lavar y desinfectar).', '<b>Si dudas, bótalo.</b> Una intoxicación en una emergencia es muy peligrosa.'])}
        ${sec('🔥 Cocinar con seguridad', ['<b>Nunca</b> uses estufas de gas portátiles, carbón, leña ni plantas eléctricas dentro de la casa o en el garaje: el monóxido de carbono mata sin olor.', 'No cocines si sientes olor a gas.', 'Lávate las manos con agua segura o gel antes de comer.'])}
      </div>${NOTA}`
    },
    auxilios: {
      ico: '🩹', title: 'Primeros auxilios', sub: 'Lo básico para ayudar mientras llega la ayuda',
      html: `<div class="guide">
        ${box('⚠️ Primero <b>tu seguridad</b>: no entres a lugares que se pueden caer. Después <b>pide ayuda</b> (llama o envía a alguien) y luego atiende al herido.')}
        ${sec('🩸 Sangrado', ['Presiona <b>fuerte y sin soltar</b> la herida con una tela limpia, por lo menos 10 minutos.', 'Si la tela se empapa, no la quites: pon otra encima y sigue presionando.', 'Si el sangrado de un brazo o pierna no para y es abundante, un torniquete es el último recurso: ajústalo 5 cm arriba de la herida y anota la hora.'])}
        ${sec('🦴 Fracturas y golpes', ['No intentes enderezar el hueso. Inmoviliza la zona en la posición en que está con una tablilla acolchada (cartón, revista, palo) y vendas.', 'Pon frío envuelto en tela por 20 minutos para bajar la hinchazón.', '<b>Si puede haber lesión en el cuello o la espalda</b> (caída fuerte, golpe en la cabeza), no muevas a la persona salvo que corra peligro.'])}
        ${sec('🤕 Golpe en la cabeza', ['Lleva a urgencias si hay pérdida del conocimiento, vómitos, confusión, mucho sueño, dolor de cabeza que empeora o pupilas de distinto tamaño.', 'Vigila a la persona durante 24 horas.'])}
        ${sec('🔥 Quemaduras', ['Pon la zona bajo agua fría (no helada) <b>20 minutos</b>.', 'No uses hielo, crema dental, mantequilla ni pomadas. No revientes las ampollas.', 'Cubre con plástico de cocina limpio o una tela que no suelte pelusa.'])}
        ${sec('🩹 Heridas y cortadas', ['Lávalas con agua segura y jabón; quita la tierra con cuidado.', 'Cubre con gasa limpia y cambia el vendaje cada día.', 'Busca atención si la herida es profunda, está sucia o se pone roja, caliente o con pus (y pregunta por la vacuna del tétanos).'])}
        ${sec('🫁 Si no responde', ['Si respira: ponlo de lado (posición de seguridad) para que no se ahogue, y vigílalo.', 'Si <b>no respira</b> o solo boquea: llama a emergencias y haz <b>compresiones en el centro del pecho</b>, fuerte (unos 5 cm) y rápido (100 a 120 por minuto, al ritmo de "La Macarena" o "Stayin\' Alive"), sin parar hasta que llegue ayuda o despierte.'])}
        ${sec('🧱 Personas atrapadas mucho tiempo', ['Si alguien estuvo varias horas con mucho peso encima (un brazo o una pierna aplastados), avisa a los rescatistas: al liberarlo necesita atención médica inmediata, aunque se vea bien.'])}
        ${sec('😰 Crisis de nervios o pánico', ['Habla despacio y en calma. Lleva a la persona a un lugar tranquilo.', 'Respiren juntos: tomar aire en 4 segundos y botarlo en 6, varias veces.', 'Es normal sentir miedo, temblor o insomnio después de un sismo. Si dura semanas, busca apoyo psicológico.'])}
        ${sec('🧰 Botiquín básico', ['Gasas, vendas, esparadrapo, curitas, guantes, tijeras y pinzas.', 'Suero fisiológico o agua estéril, jabón, alcohol o antiséptico.', 'Analgésicos, antialérgicos, sales de rehidratación y tus medicamentos de siempre.', 'Manta térmica y tapabocas.'])}
      </div>${NOTA}`
    },
    revisar: {
      ico: '🔍', title: 'Revisar la casa después', sub: 'Gas, luz, agua y señales de peligro',
      html: `<div class="guide">
        ${box('Espera a que pare el movimiento y prepárate para <b>réplicas</b>: pueden ser fuertes. Ponte zapatos cerrados y usa linterna, <b>no velas</b>.')}
        ${sec('🔥 Gas', ['Si huele a gas o escuchas un silbido: <b>no prendas luces, fósforos ni encendedores</b>, y no conectes nada.', 'Abre puertas y ventanas, cierra la llave del gas si puedes y sal de la casa.', 'Llama a la empresa de gas o a emergencias <b>desde afuera</b>. No vuelvas a abrir el gas tú mismo: debe hacerlo un técnico.'])}
        ${sec('⚡ Luz', ['Si hay chispas, cables rotos u olor a quemado, baja los tacos (breakers) si puedes hacerlo sin pisar agua.', 'No toques cables caídos en la calle: aléjate y avisa.', 'Desconecta los aparatos para que no se dañen cuando vuelva la energía.'])}
        ${sec('🚰 Agua y alcantarillado', ['Si hay fugas, cierra la llave de paso principal.', 'No uses el sanitario hasta saber que las tuberías del desagüe están bien. Mientras tanto, usa una bolsa dentro de la taza.'])}
        ${sec('🚫 No entres (o sal ya) si ves', ['Grietas en diagonal o en X en muros, columnas o vigas.', 'Columnas dobladas, aplastadas o con el hierro a la vista.', 'Paredes o la casa inclinadas, techos hundidos, escaleras dañadas.', 'Puertas y ventanas que de repente no abren o no cierran.', 'Crujidos, polvo que cae o pedazos que se desprenden.'])}
        ${sec('Después', ['Pide a la alcaldía o a un ingeniero que revise la casa antes de volver a vivir en ella si tiene daños.', 'Toma fotos de los daños para el seguro.', 'Limpia con cuidado vidrios, medicamentos y químicos derramados.'])}
      </div>${NOTA}`
    },
    atrapado: {
      ico: '🧱', title: 'Si quedas atrapado', sub: 'Cómo ayudar a que te encuentren',
      html: `<div class="guide">
        ${box('🧱 Mantén la calma: los equipos de rescate buscan durante días. Ahorra energía, aire y batería.')}
        ${sec('Qué hacer', ['<b>No prendas fósforos ni encendedores</b>: puede haber gas.', 'Cúbrete la boca y la nariz con tela para no respirar polvo.', 'No te muevas sin necesidad: levantas polvo y puedes mover los escombros.', '<b>Golpea tubos o paredes</b> (3 golpes, pausa, 3 golpes) o usa un silbato. Grita solo como último recurso: gastas energía y respiras polvo.', 'Usa la linterna del celular a ratos y envía <b>mensajes de texto</b> con tu ubicación: llegan mejor que las llamadas.', 'Baja el brillo de la pantalla y activa el ahorro de batería.'])}
        ${sec('Si alguien más está atrapado', ['No entres a estructuras dañadas: avisa a los rescatistas exactamente dónde está.', 'Háblale para darle ánimo y pide que golpee para ubicarlo.', 'Quita escombros sueltos solo si es seguro, nunca piezas que sostienen la estructura.'])}
      </div>${NOTA}`
    },
    familia: {
      ico: '👨‍👩‍👧‍👦', title: 'Para cada persona', sub: 'Niños, adultos mayores, bebés y mascotas',
      html: `<div class="guide">
        ${sec('🧒 Niños', ['Enséñales jugando: "agáchate, cúbrete y sujétate" y hagan simulacros juntos.', 'Que sepan su nombre completo, el de sus padres y un teléfono; pon una tarjeta en su mochila.', 'Después del sismo: escúchalos, explícales con palabras sencillas, mantén rutinas y no los expongas a muchas noticias.', 'Es normal que tengan miedo, no quieran dormir solos o vuelvan a orinarse; con paciencia pasa.'])}
        ${sec('👴 Adultos mayores', ['Medicamentos para 7 días y copia de las fórmulas médicas.', 'Gafas, audífonos con pilas, bastón o caminador junto a la cama.', 'Acuerda con un vecino o familiar quién los ayuda a salir.'])}
        ${sec('♿ Personas con discapacidad', ['Arma un plan con su red de apoyo: quién ayuda, cómo y por dónde salir.', 'Ten baterías de repuesto para sillas eléctricas, oxígeno o equipos médicos.', 'Lleva una tarjeta con sus necesidades, medicamentos y cómo comunicarse.'])}
        ${sec('👶 Bebés', ['Leche de fórmula lista para usar (no necesita agua), biberones y agua segura.', 'Pañales, pañitos húmedos, ropa, cobija y un portabebés para tener las manos libres.', 'En el sismo, protégelo con tu cuerpo bajo una mesa o junto a una pared interior.'])}
        ${sec('🤰 Embarazadas', ['Copia del control prenatal y los datos del médico.', 'Si después del sismo hay sangrado, dolor fuerte, contracciones o el bebé se mueve menos, busca atención de inmediato.'])}
        ${sec('🐶 Mascotas', ['Comida y agua para 3 días, correa, transportadora y sus medicamentos.', 'Placa con tu teléfono y una foto tuya con ella (para demostrar que es tuya si se pierde).', 'Durante el sismo no intentes atraparla: protégete tú. Nunca la dejes amarrada o encerrada si hay que evacuar.'])}
      </div>${NOTA}`
    },
    mitos: {
      ico: '🤔', title: 'Mitos y verdades', sub: 'Lo que no hay que hacer, aunque lo digan',
      html: `<div class="guide">
        ${[
          ['El "triángulo de la vida" (acostarse junto a un mueble) salva vidas.', 'Es un mito. Los organismos de rescate recomiendan <b>agacharse, cubrirse y sujetarse</b> bajo una mesa firme.'],
          ['Lo más seguro es pararse bajo el marco de la puerta.', 'En las construcciones de hoy no es más fuerte que otras partes, y la puerta te puede golpear. Mejor bajo una mesa.'],
          ['Hay que salir corriendo apenas empieza a temblar.', 'Falso. La mayoría de heridos se lastiman al correr o por objetos que caen afuera. Sal cuando pare.'],
          ['Los sismos se pueden predecir.', 'Falso. <b>Nadie puede predecir</b> el día, la hora y el lugar de un sismo. Desconfía de cadenas y videos que lo prometan.'],
          ['Hay un "clima de terremoto" (calor, nubes raras).', 'Mito. Los sismos ocurren a kilómetros bajo tierra y no dependen del clima.'],
          ['Los animales avisan antes del sismo.', 'No hay pruebas confiables de que se pueda usar como alerta.'],
          ['Después de un sismo grande ya no vienen más.', 'Falso. Las <b>réplicas</b> pueden durar semanas o meses, y algunas son fuertes.'],
          ['Hay que llamar a todos enseguida.', 'Mejor envía mensajes de texto o por WhatsApp: las llamadas saturan la red que necesitan los rescatistas.'],
          ['Si el mar se retira, es buen momento para ver la playa.', '¡Al contrario! Es la señal de un tsunami: <b>corre a un lugar alto</b> de inmediato.']
        ].map(([m, v]) => `<div class="myth"><p class="m">❌ ${m}</p><p class="v">✅ ${v}</p></div>`).join('')}
      </div>${NOTA}`
    },
    otras: {
      ico: '🌋', title: 'Otras emergencias', sub: 'Deslizamientos, inundaciones, ceniza, incendios y huracanes',
      html: `<div class="guide">
        ${sec('⛰️ Deslizamientos', ['Señales: grietas nuevas en el terreno o en las paredes, árboles o postes que se inclinan, puertas que se traban, ruidos de rocas, agua que brota de la ladera.', 'Si una quebrada baja de repente con lodo o deja de correr, puede venir una <b>avenida torrencial</b>: aléjate del cauce hacia lo alto.', 'Sal de la trayectoria del derrumbe hacia los lados, no hacia abajo. No vuelvas hasta que lo autoricen.'])}
        ${sec('🌊 Inundaciones', ['Sube a lugares altos. <b>No camines ni manejes por agua en movimiento</b>: 15 cm pueden tumbarte y 30 cm arrastran un carro.', 'Desconecta la luz si el agua va a entrar a la casa.', 'El agua de inundación está contaminada: no la bebas ni dejes que los niños jueguen en ella.'])}
        ${sec('🌋 Ceniza volcánica', ['Quédate adentro, cierra puertas y ventanas y tapa las rendijas con toallas húmedas.', 'Si sales, usa tapabocas (ideal N95), gafas y ropa de manga larga. No uses lentes de contacto.', 'Tapa el agua y la comida. Quita la ceniza del techo con cuidado: pesa mucho cuando se moja.', 'Si vives cerca de un río que baja de un volcán nevado, ante una erupción <b>sube a zonas altas</b>: puede bajar una avalancha de lodo (lahar).'])}
        ${sec('🔥 Incendios', ['En casa: sal agachado, por debajo del humo. Toca la puerta antes de abrirla: si está caliente, busca otra salida.', 'Si se te prende la ropa: <b>detente, tírate al piso y rueda</b>, cubriéndote la cara.', 'Incendio forestal cerca: sal temprano cuando lo pidan las autoridades y no regreses por cosas.'])}
        ${sec('🌀 Huracanes y tormentas tropicales', ['Antes: asegura ventanas, techos y objetos sueltos; ten agua, comida, pilas y la mochila lista.', 'Si piden evacuar, hazlo. Si te quedas, ve a un cuarto interior sin ventanas.', 'Si de pronto todo se calma, puede ser el <b>ojo del huracán</b>: el viento volverá, a veces más fuerte.'])}
        ${sec('⚡ Tormentas eléctricas', ['Si escuchas truenos, estás cerca de los rayos: entra a una casa o un carro cerrado.', 'Aléjate de árboles solos, postes, cercas, piscinas y potreros abiertos.', 'Espera 30 minutos después del último trueno para salir.'])}
      </div>${NOTA}`
    }
  };
  const GUIA_ORDEN = ['lugares', 'agua', 'comida', 'auxilios', 'revisar', 'atrapado', 'familia', 'mitos', 'otras'];

  // =====================================================================
  //  Mochila inteligente (con fechas de vencimiento)
  // =====================================================================
  // [nombre, ¿se vence o hay que renovarlo?]
  const MOCHILA = [
    ['Agua (4 litros por persona al día)', true], ['Comida enlatada o no perecedera para 3 días', true], ['Abrelatas manual', false],
    ['Linterna y pilas', true], ['Radio de pilas', false], ['Botiquín de primeros auxilios', true], ['Medicamentos personales', true],
    ['Copia de documentos en bolsa plástica', false], ['Dinero en efectivo', false], ['Silbato', false], ['Cargador portátil (power bank)', true],
    ['Ropa abrigada e impermeable', false], ['Zapatos cerrados', false], ['Mascarillas', false], ['Artículos de higiene', false],
    ['Cobija térmica', false], ['Navaja multiusos', false], ['Copia de llaves', false], ['Lista de contactos en papel', false]
  ];
  const expOf = () => A.store.get('mochilaExp', {});
  function expState(d) {
    if (!d) return null;
    const left = Math.round((Date.parse(d + 'T12:00') - Date.now()) / DAY);
    return left < 0 ? ['vencido', 'bad', left] : left <= 14 ? [`se vence en ${left} día${left === 1 ? '' : 's'}`, 'warn', left] : null;
  }
  function kitAlerts() {
    const e = expOf();
    return Object.keys(e).filter(k => expState(e[k])).length;
  }
  const fmtDay = ms => new Date(ms).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
  function mochila() {
    const ok = A.store.get('mochila', {}), exp = expOf(), rec = A.store.get('recordar', { on: false, next: 0 });
    const done = MOCHILA.filter(([n]) => ok[n]).length;
    const pct = Math.round(done / MOCHILA.length * 100);
    A.subSheet('Mochila de emergencia', `${done} de ${MOCHILA.length} listos · ${pct}%`,
      `<div class="bar"><i style="width:${pct}%"></i></div>
      ${box('🎒 Marca lo que ya tienes. A lo que se vence ponle la fecha y <b>te avisamos 2 semanas antes</b>.')}
      ${MOCHILA.map(([n, perish]) => {
        const st = expState(exp[n]);
        return `<div class="kit-row"><button class="toggle" data-mochila="${A.esc(n)}" role="switch" aria-checked="${!!ok[n]}"><span>${A.esc(n)}${st ? ` <em class="tag ${st[1]}">${st[0]}</em>` : ''}</span><span class="switch"></span></button>
          ${perish ? `<label class="kit-date"><span>Se vence o hay que renovarlo el</span><input type="date" data-g-exp="${A.esc(n)}" value="${A.esc(exp[n] || '')}"></label>` : ''}</div>`;
      }).join('')}
      <h4 class="g-h">Revisión cada 6 meses</h4>
      <button class="toggle" data-g="recordar" role="switch" aria-checked="${!!rec.on}"><span>Recordarme revisar la mochila y el plan<small class="t-sub">${rec.on ? `Próxima revisión: ${fmtDay(rec.next)}` : 'Cambiar el agua y las pilas, revisar fechas y contactos'}</small></span><span class="switch"></span></button>
      <div class="actions"><button class="action" data-g="revisado">✅<br>Ya la revisé</button><button class="action wa" data-g="mochila-compartir">📤<br>Compartir lista</button><button class="action" data-guia="comida">🥫<br>Guía de alimentos</button></div>`);
  }
  function syncKit() {
    if (!A.NATIVE || typeof A.N.setKitReminders !== 'function') return;
    const exp = expOf(), rec = A.store.get('recordar', { on: false, next: 0 });
    A.N.setKitReminders(JSON.stringify({
      items: Object.keys(exp).filter(k => exp[k]).map(k => ({ n: k, exp: Date.parse(exp[k] + 'T09:00') })),
      review: rec.on ? rec.next : 0
    }));
  }

  // =====================================================================
  //  Revisión de la casa
  // =====================================================================
  const CASA = [
    'Muebles altos, bibliotecas y armarios fijos a la pared', 'Calentador y cilindro de gas asegurados con correas', 'Objetos pesados y vidrios en repisas bajas',
    'Espejos y cuadros lejos de las camas', 'Sé cerrar la llave del gas', 'Sé cerrar la llave de paso del agua', 'Sé bajar los tacos (breakers) de la luz',
    'Linterna y zapatos junto a cada cama', 'Extintor en la casa y sé usarlo', 'Pasillos y salidas sin obstáculos', 'Químicos y venenos guardados abajo y bien cerrados',
    'La casa no tiene grietas grandes (o ya la revisó un experto)'
  ];
  function casa() {
    const ok = A.store.get('casa', {});
    const done = CASA.filter(i => ok[i]).length, pct = Math.round(done / CASA.length * 100);
    A.subSheet('Revisión de la casa', `${done} de ${CASA.length} listos · ${pct}%`,
      `<div class="bar"><i style="width:${pct}%"></i></div>
      ${box('🏠 Una casa preparada evita la mayoría de heridos: casi siempre los causan objetos que caen. Marca lo que ya hiciste.')}
      ${CASA.map(i => `<button class="toggle" data-g-casa="${A.esc(i)}" role="switch" aria-checked="${!!ok[i]}"><span>${A.esc(i)}</span><span class="switch"></span></button>`).join('')}
      <p class="about">Para fijar muebles usa escuadras o correas atornilladas a la pared (no al drywall solo). Si tu casa tiene grietas, la alcaldía o un ingeniero pueden revisarla.</p>`);
  }

  // =====================================================================
  //  Test "¿Qué tan preparado estás?" (se comparte por WhatsApp)
  // =====================================================================
  const TEST = [
    ['¿Tienes agua guardada para 3 días (4 litros por persona al día)?', 'agua'],
    ['¿Tienes comida que no necesite nevera para 3 días?', 'comida'],
    ['¿Tienes lista una mochila de emergencia?', 'mochila'],
    ['¿Tu familia acordó un punto de encuentro?', 'plan'],
    ['¿Todos se saben un contacto fuera de la ciudad?', 'plan'],
    ['¿Los muebles altos y el calentador están fijos a la pared?', 'casa'],
    ['¿Sabes cerrar el gas, el agua y la luz de tu casa?', 'revisar'],
    ['¿Tienes botiquín y sabes primeros auxilios básicos?', 'auxilios'],
    ['¿Han hecho un simulacro en el último año?', 'simulacro'],
    ['¿Saben qué hacer durante un sismo en cada lugar?', 'lugares']
  ];
  function testAuto() {
    // Lo que la app ya sabe se marca solo (la persona puede cambiarlo)
    const plan = A.store.get('plan', {}), ok = A.store.get('mochila', {}), c = A.store.get('casa', {});
    const kit = MOCHILA.filter(([n]) => ok[n]).length / MOCHILA.length;
    return { 2: kit >= 0.7, 3: !!plan.encuentro, 4: !!plan.contacto2, 5: !!(c[CASA[0]] && c[CASA[1]]), 6: !!(c[CASA[4]] && c[CASA[5]] && c[CASA[6]]) };
  }
  function testAnswers() {
    const saved = A.store.get('test', null);
    if (saved && saved.a) return saved.a;
    const auto = testAuto();
    return TEST.map((_, i) => !!auto[i]);
  }
  const level = s => s >= 100 ? ['¡Listos para lo que venga! 🏆', 'var(--ok)'] : s >= 80 ? ['Bien preparados 💪', 'var(--ok)'] : s >= 50 ? ['En camino 👍', 'var(--warn)'] : ['Poco preparados ⚠️', 'var(--danger)'];
  function test() {
    const a = testAnswers();
    const score = a.filter(Boolean).length * 10, [lv, col] = level(score);
    const missing = TEST.map((q, i) => [q, i]).filter(([, i]) => !a[i]);
    const toolName = { agua: 'Guía del agua', comida: 'Guía de alimentos', mochila: 'Armar la mochila', plan: 'Hacer el plan familiar', casa: 'Revisar la casa', revisar: 'Revisar la casa después', auxilios: 'Primeros auxilios', simulacro: 'Hacer un simulacro', lugares: 'Según dónde estés' };
    A.subSheet('¿Qué tan preparado estás?', 'Responde con tu familia · 10 preguntas',
      `<div class="score" style="--p:${score};--c:${col}"><div class="ring"><b>${score}</b><small>de 100</small></div><div><b class="lv" style="color:${col}">${lv}</b><p>Cada "sí" suma 10 puntos. Lo que la app ya sabe de tu plan y tu mochila viene marcado.</p></div></div>
      ${TEST.map(([q], i) => `<button class="toggle" data-g-test="${i}" role="switch" aria-checked="${!!a[i]}"><span>${q}</span><span class="switch"></span></button>`).join('')}
      ${missing.length ? `<h4 class="g-h">Para subir tu puntaje</h4><div class="chips-g">${[...new Set(missing.map(([q]) => q[1]))].map(k => `<button class="chip-g" ${k === 'mochila' ? 'data-g="mochila"' : k === 'plan' ? 'data-act="plan"' : k === 'casa' ? 'data-g="casa"' : k === 'simulacro' ? 'data-act="simulacro"' : `data-guia="${k}"`}>${toolName[k]} →</button>`).join('')}</div>` : ''}
      <div class="actions" style="grid-template-columns:1fr"><button class="action wa" data-g="test-compartir">📤<br>Compartir mi resultado por WhatsApp</button></div>`);
  }
  function setTest(i) {
    const a = testAnswers(); a[i] = !a[i];
    A.store.set('test', { a, t: Date.now() });
    const body = document.querySelector('#sheet-body'), top = body.scrollTop;
    test(); body.scrollTop = top;
  }

  // =====================================================================
  //  Modo apagón: linterna, brújula, mensajes por SMS y pantalla negra
  // =====================================================================
  let torchOn = false, compassOn = false;
  const SMS = [
    ['✅ Estoy bien', () => `Estoy bien. ${A.where()}`],
    ['🆘 Necesito ayuda', () => `Necesito ayuda. ${A.where()}`],
    ['🧱 Estoy atrapado', () => `Estoy atrapado. ${A.where()} Avisa a emergencias.`],
    ['📍 Voy al punto de encuentro', () => `Voy al punto de encuentro${A.store.get('plan', {}).encuentro ? ': ' + A.store.get('plan', {}).encuentro : ''}. ${A.where()}`]
  ];
  function apagon() {
    A.subSheet('Modo apagón', 'Funciona sin internet y gasta muy poca batería',
      `<div id="g-bat" class="explain">🔋 Consultando la batería…</div>
      <div class="actions">
        <button class="action ${torchOn ? 'on' : ''}" data-g="linterna">🔦<br>${torchOn ? 'Apagar linterna' : 'Linterna'}</button>
        <button class="action ${compassOn ? 'on' : ''}" data-g="brujula">🧭<br>Brújula</button>
        <button class="action ${document.documentElement.classList.contains('apagon') ? 'on' : ''}" data-g="negro">🌑<br>Pantalla negra</button>
      </div>
      <div id="g-compass" class="compass" ${compassOn ? '' : 'hidden'}><div class="dial"><i class="needle"></i><span class="n">N</span><span class="e">E</span><span class="s">S</span><span class="o">O</span></div><b id="g-deg">–</b></div>
      <h4 class="g-h">Mensajes de texto (SMS)</h4>
      ${box('📩 Cuando no hay internet, los <b>SMS</b> casi siempre llegan. Toca uno, elige a quién enviarlo y listo.')}
      <div class="chips-g">${SMS.map(([t], i) => `<button class="chip-g" data-g-sms="${i}">${t}</button>`).join('')}</div>
      <h4 class="g-h">Para que dure la batería</h4>
      <div class="guide"><ul>${li(['Activa el ahorro de batería del teléfono y baja el brillo.', 'Apaga el wifi, el bluetooth y los datos si no los estás usando; deja la señal para llamadas y SMS.', 'Cierra las apps que no necesitas. Usa el cargador portátil y el del carro.', 'La pantalla negra de Orbe Sismos apaga el globo 3D para gastar mucho menos.'])}</ul></div>
      <div class="actions" style="grid-template-columns:1fr 1fr"><button class="action" data-act="sos">🆘<br>SOS con sirena</button><button class="action" data-act="numeros">☎️<br>Emergencias</button></div>`,
      body => battery(body));
  }
  async function battery() {
    const el = document.getElementById('g-bat'); if (!el) return;
    try {
      const b = await navigator.getBattery();
      const pct = Math.round(b.level * 100);
      el.innerHTML = `🔋 Batería: <b>${pct}%</b>${b.charging ? ' · cargando' : ''}${pct <= 20 && !b.charging ? ' — <b style="color:var(--danger)">muy baja: usa solo lo indispensable</b>' : ''}`;
    } catch (e) { el.remove(); }
  }
  function toggleTorch() {
    torchOn = !torchOn;
    if (A.NATIVE && typeof A.N.torch === 'function') A.N.torch(torchOn);
    else A.toast('🔦 En la app de Android se enciende la linterna del teléfono');
    apagon();
  }
  let lastHeading = null;
  function onOrient(e) {
    let h = null;
    if (typeof e.webkitCompassHeading === 'number') h = e.webkitCompassHeading;
    else if (e.absolute && e.alpha != null) h = 360 - e.alpha;
    if (h == null) return;
    h = (h + 360) % 360;
    if (lastHeading != null && Math.abs(h - lastHeading) < 1) return;
    lastHeading = h;
    const n = document.querySelector('#g-compass .dial'); if (n) n.style.transform = `rotate(${-h}deg)`;
    const d = document.getElementById('g-deg');
    if (d) d.textContent = `${Math.round(h)}° ${['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'][Math.round(h / 45) % 8]}`;
  }
  function toggleCompass() {
    compassOn = !compassOn;
    const ev = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
    if (compassOn) window.addEventListener(ev, onOrient); else window.removeEventListener(ev, onOrient);
    apagon();
    if (compassOn) setTimeout(() => { if (lastHeading == null) { const d = document.getElementById('g-deg'); if (d) d.textContent = 'Mueve el teléfono en forma de 8 para calibrar'; } }, 2500);
  }
  function toggleBlack() {
    const on = !document.documentElement.classList.contains('apagon');
    document.documentElement.classList.toggle('apagon', on);
    A.setLowPower(on);
    A.toast(on ? '🌑 Globo apagado para ahorrar batería' : '🌎 Globo encendido');
    apagon();
  }
  function sendSms(i) {
    const text = SMS[i][1]();
    if (A.NATIVE && typeof A.N.sms === 'function') A.N.sms(text);
    else location.href = 'sms:?body=' + encodeURIComponent(text);
  }

  // =====================================================================
  //  Tarjetas para la pestaña Seguridad
  // =====================================================================
  function cards() {
    const t = A.store.get('test', null), n = kitAlerts();
    const score = t && t.a ? t.a.filter(Boolean).length * 10 : null;
    return {
      test: `<button class="card wide hero" data-g="test"><span class="ico">🛡️</span><b>¿Qué tan preparado estás?</b><small>${score == null ? 'Haz el test con tu familia y compártelo' : `Tu puntaje: <b>${score} de 100</b> · toca para mejorarlo`}</small></button>`,
      mochila: `<button class="card" data-g="mochila"><span class="ico">🎒</span><b>Mochila de emergencia</b><small>${n ? `⚠️ ${n} cosa${n === 1 ? '' : 's'} por vencer` : 'Con fechas de vencimiento'}</small></button>`,
      casa: '<button class="card" data-g="casa"><span class="ico">🏠</span><b>Revisión de la casa</b><small>Evita que te caigan cosas</small></button>',
      apagon: '<button class="card" data-g="apagon"><span class="ico">🔦</span><b>Modo apagón</b><small>Linterna, brújula y SMS sin internet</small></button>',
      guias: GUIA_ORDEN.map((id, i) => { const g = GUIAS[id]; return `<button class="card${GUIA_ORDEN.length % 2 && i === GUIA_ORDEN.length - 1 ? ' wide' : ''}" data-guia="${id}"><span class="ico">${g.ico}</span><b>${g.title}</b><small>${g.sub}</small></button>`; }).join('')
    };
  }

  // =====================================================================
  //  Eventos
  // =====================================================================
  function click(t) {
    const gu = t.closest('[data-guia]');
    if (gu) { const g = GUIAS[gu.dataset.guia]; if (g) A.subSheet(g.title, g.sub, g.html); return true; }
    const ts = t.closest('[data-g-test]'); if (ts) { setTest(+ts.dataset.gTest); return true; }
    const ca = t.closest('[data-g-casa]');
    if (ca) { const ok = A.store.get('casa', {}); ok[ca.dataset.gCasa] = !ok[ca.dataset.gCasa]; A.store.set('casa', ok); const top = document.querySelector('#sheet-body').scrollTop; casa(); document.querySelector('#sheet-body').scrollTop = top; return true; }
    const sm = t.closest('[data-g-sms]'); if (sm) { sendSms(+sm.dataset.gSms); return true; }
    const g = t.closest('[data-g]'); if (!g) return false;
    const act = g.dataset.g;
    if (act === 'test') test();
    else if (act === 'test-compartir') {
      const a = testAnswers(), s = a.filter(Boolean).length * 10;
      A.share(`🛡️ Mi familia está ${s}% preparada para un terremoto ${'🟩'.repeat(s / 10)}${'⬜'.repeat(10 - s / 10)}\n¿Y la tuya? Haz el test gratis en Orbe Sismos:\n${PLAY}`);
    }
    else if (act === 'mochila') mochila();
    else if (act === 'casa') casa();
    else if (act === 'apagon') apagon();
    else if (act === 'linterna') toggleTorch();
    else if (act === 'brujula') toggleCompass();
    else if (act === 'negro') toggleBlack();
    else if (act === 'recordar') {
      const r = A.store.get('recordar', { on: false, next: 0 });
      r.on = !r.on; if (r.on && (!r.next || r.next < Date.now())) r.next = Date.now() + 182 * DAY;
      A.store.set('recordar', r); syncKit(); mochila();
      if (r.on) A.toast(`🔔 Te recordaremos el ${fmtDay(r.next)}`);
    }
    else if (act === 'revisado') {
      const r = A.store.get('recordar', { on: true, next: 0 });
      r.on = true; r.next = Date.now() + 182 * DAY; A.store.set('recordar', r); syncKit(); mochila();
      A.toast('✅ ¡Bien! Próxima revisión en 6 meses');
    }
    else if (act === 'mochila-compartir') {
      const ok = A.store.get('mochila', {});
      A.share(`🎒 Mochila de emergencia\n${MOCHILA.map(([n]) => `${ok[n] ? '✅' : '⬜'} ${n}`).join('\n')}\nArmada con Orbe Sismos: ${PLAY}`);
    }
    return true;
  }
  function change(e) {
    const el = e.target; if (!el.dataset || el.dataset.gExp == null) return;
    const exp = expOf(); exp[el.dataset.gExp] = el.value; if (!el.value) delete exp[el.dataset.gExp];
    A.store.set('mochilaExp', exp); syncKit();
    const st = expState(el.value);
    A.toast(el.value ? (st ? `⚠️ ${st[0]}: cámbialo pronto` : '🔔 Te avisaremos 2 semanas antes de que se venza') : 'Fecha borrada');
  }

  window.OrbeGuias = {
    init(api) {
      A = api;
      document.querySelector('#sheet-body').addEventListener('change', change);
      syncKit();
    },
    click, cards, mochila, guias: GUIAS
  };
})();
