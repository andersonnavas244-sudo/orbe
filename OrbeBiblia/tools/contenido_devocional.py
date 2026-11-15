"""Contenido original de Orbe Biblia: reflexiones del devocional, oraciones por tema, planes por tema y fechas especiales.
Lo usa build_extras.py (que verifica cada referencia contra el texto de la RV1909)."""

# Reflexiones cortas por tema del versículo del día (se rotan durante el año)
REFLEXIONES = {
    'Ánimo': [
        'Hay días en que las fuerzas no alcanzan. Dios no te pide que seas fuerte por tu cuenta: te ofrece su fuerza. Lo que hoy parece una montaña, con Él es un camino. Da el siguiente paso, aunque sea pequeño; no caminas solo.',
        'El desánimo grita que todo seguirá igual, pero la Palabra dice otra cosa. Dios ve tu esfuerzo cuando nadie más lo ve, y nada de lo que haces con amor se pierde. Hoy, levanta la mirada: tu historia no ha terminado.',
        'Josué tenía miedo de una tarea enorme, y Dios no le quitó la tarea: le prometió su compañía. A veces la respuesta no es un camino más fácil, sino la certeza de que Él va contigo. Eso basta para seguir.',
        'No midas tu valor por un mal día. Los fracasos no definen quién eres; Dios sí. Él termina lo que empieza, y su obra en ti sigue en marcha. Respira, ora y vuelve a intentarlo con su ayuda.',
        'Esperar en Dios no es quedarse quieto: es renovar las fuerzas. Las águilas no vuelan agitando las alas sin parar; se dejan llevar por el viento. Hoy, déjate llevar por su gracia.',
        'Alguien cerca de ti también necesita ánimo hoy. Tal vez la mejor manera de levantar tu propio corazón es animar a otro. Comparte una palabra de Dios y verás cómo vuelve a ti multiplicada.',
    ],
    'Fe': [
        'La fe no es tener todas las respuestas, sino confiar en quien las tiene. Puedes no entender lo que está pasando y aun así descansar en que Dios es bueno. Hoy, entrégale lo que no puedes controlar.',
        'Abraham salió sin saber a dónde iba, pero sabía con quién iba. La fe da pasos aunque el camino no esté completo. ¿Qué paso te está pidiendo Dios hoy? Dalo con confianza.',
        'Una fe pequeña en un Dios grande mueve montañas. No necesitas una fe perfecta; necesitas ponerla en el lugar correcto. Lleva tus dudas a Jesús: Él no las rechaza, las transforma.',
        'La fe crece cuando escuchamos la Palabra. Así como el cuerpo necesita alimento, el alma necesita oír a Dios. Unos minutos con la Biblia cada día cambian la manera de ver todo lo demás.',
        'Hay oraciones que parecen no tener respuesta. La fe aprende a esperar: Dios no llega tarde, llega a su tiempo. Mientras esperas, Él está obrando en tu corazón.',
        'Creer también es obedecer en lo pequeño: perdonar, decir la verdad, ayudar. La fe se ve en las decisiones de cada día. Hoy tienes muchas oportunidades de vivirla.',
    ],
    'Amor': [
        'Antes de que hicieras algo bueno o malo, Dios ya te amaba. Su amor no se gana: se recibe. Deja que esa verdad descanse hoy en tu corazón y te quite el peso de tener que demostrar tu valor.',
        'El amor de 1 Corintios 13 no es un sentimiento pasajero: es paciencia, bondad y perdón en lo cotidiano. ¿A quién puedes amar así hoy? Empieza por los de tu casa.',
        'Jesús dijo que nos conocerían por el amor. No por lo que sabemos ni por lo que decimos, sino por cómo tratamos a los demás. Un gesto de amor hoy predica más que mil palabras.',
        'Nada puede separarte del amor de Dios: ni tus errores, ni tus miedos, ni lo que otros digan de ti. Ese amor es tu lugar seguro. Vuelve a él cada vez que te sientas solo.',
        'Amar a veces cuesta: escuchar con paciencia, ceder, pedir perdón. Pero el amor cubre multitud de faltas y construye lo que el orgullo destruye. Elige amar, aunque sea difícil.',
        'Dios amó tanto al mundo que dio lo más valioso. El amor verdadero se entrega. Piensa hoy en una forma concreta de dar: tu tiempo, tu atención o tu ayuda.',
    ],
    'Paz': [
        'La paz de Jesús no depende de que todo esté en orden. Es una calma que llega aun en medio de la tormenta. Hoy, cuando la ansiedad toque la puerta, respóndele con una oración.',
        'Por nada estéis afanosos, dice la Palabra; no porque los problemas no existan, sino porque podemos llevarlos a Dios. Escribe hoy lo que te preocupa y entrégaselo en oración.',
        'El Salmo 23 recuerda que el Pastor nos lleva junto a aguas de reposo. Tal vez hoy necesitas detenerte, respirar y dejar que Él te guíe. El descanso también es obediencia.',
        'Estad quietos y conoced que yo soy Dios. En un mundo que corre, la quietud es un regalo. Dedica hoy cinco minutos al silencio con Dios y deja que Él hable.',
        'La paz también se construye: perdonando, evitando discusiones inútiles, hablando con amabilidad. Bienaventurados los pacificadores. ¿Dónde puedes sembrar paz hoy?',
        'Dios guarda en completa paz a quien en Él persevera. Cuando tu mente da vueltas, vuelve a enfocarla en su fidelidad. Él ha estado contigo antes, y lo estará hoy.',
    ],
    'Familia': [
        'La familia es el primer lugar donde aprendemos a amar y a perdonar. No existe la familia perfecta, pero sí la que pone a Dios en el centro. Hoy, ora por cada persona de tu casa por su nombre.',
        'Yo y mi casa serviremos a Jehová, dijo Josué. Es una decisión que se renueva cada día: en la mesa, en las palabras, en el ejemplo. ¿Qué pequeña costumbre de fe pueden empezar juntos?',
        'Los hijos aprenden más de lo que ven que de lo que oyen. Tu paciencia, tu oración y tu manera de pedir perdón son su mejor escuela. Dios te da la gracia para ser ejemplo.',
        'Soportarse y perdonarse no es debilidad: es amor maduro. Si hay una herida en tu familia, da hoy el primer paso hacia la reconciliación. Dios bendice al que busca la paz.',
        'Honrar a padre y madre es un mandamiento con promesa. Llama hoy a tus padres o a quienes te criaron y agradéceles algo concreto. Un gesto así sana y une.',
        'Mejores son dos que uno: cuando uno cae, el otro lo levanta. Busca hoy a alguien de tu familia y pregúntale cómo está de verdad. Escuchar también es amar.',
    ],
    'Gratitud': [
        'La gratitud cambia la manera de ver el día. Antes de pedir, agradece: por la vida, por el pan, por las personas que amas. Escribe hoy tres cosas por las que das gracias a Dios.',
        'Dad gracias en todo, no por todo. Aun en los días difíciles hay motivos para agradecer: Dios no te ha dejado. La gratitud no niega el dolor; lo ilumina.',
        'Este es el día que hizo Jehová. No es un día cualquiera: es un regalo nuevo. Recíbelo con alegría y búscale el bien que Dios ha escondido en él.',
        'Toda buena dádiva viene de lo alto. Lo que tienes, tus talentos y tus oportunidades son regalos de Dios. La mejor forma de agradecer es usarlos para bendecir a otros.',
        'No olvides ninguno de sus beneficios, dice el Salmo. La memoria agradecida fortalece la fe: recuerda hoy una oración que Dios respondió y dale gracias otra vez.',
        'Un corazón agradecido es un corazón contento. Cuando la queja quiera ganar, cámbiala por una acción de gracias. Verás cómo cambia tu ánimo y el de quienes te rodean.',
    ],
    'Sabiduría': [
        'Fíate de Jehová de todo tu corazón y no te apoyes en tu propia prudencia. Antes de decidir, pregunta a Dios. Él promete enderezar tus veredas cuando lo reconoces en todos tus caminos.',
        'Si a alguno le falta sabiduría, pídala a Dios, que da a todos abundantemente. No hay pregunta demasiado pequeña para Él. Hoy, pídele luz para la decisión que tienes por delante.',
        'La blanda respuesta quita la ira. La sabiduría no siempre está en tener la razón, sino en saber hablar. Antes de responder con enojo, respira y elige palabras que construyan.',
        'Sobre toda cosa guardada, guarda tu corazón. Lo que ves, escuchas y piensas da forma a tu vida. Elige hoy alimentar tu corazón con lo bueno, lo verdadero y lo puro.',
        'El hombre propone su camino, pero Dios dirige sus pasos. Planea con esfuerzo y deja los resultados en sus manos: trabajas con diligencia y descansas con confianza.',
        'Lámpara es a mis pies tu palabra. La Biblia no siempre muestra todo el camino, pero sí el siguiente paso. Lee, obedece lo que entiendes, y Dios te mostrará más.',
    ],
    'Esperanza': [
        'Yo sé los pensamientos que tengo acerca de vosotros: de paz, y no de mal. Aunque hoy no veas la salida, Dios tiene un futuro y una esperanza para ti. No te rindas.',
        'Todas las cosas ayudan a bien a los que aman a Dios. No todo es bueno, pero Dios puede sacar bien de todo. Confía en que Él está escribiendo una historia mayor.',
        'Dios enjugará toda lágrima. El dolor de hoy no es el final de la historia. La esperanza cristiana mira más allá: hacia un día sin muerte, sin llanto y sin dolor.',
        'Las misericordias de Dios son nuevas cada mañana. Ayer pudo ser difícil, pero hoy empieza algo nuevo. Recibe su misericordia y empieza otra vez.',
        'El que comenzó en ti la buena obra, la perfeccionará. Tal vez sientes que avanzas lento, pero Dios no abandona lo que empieza. Tu vida está en buenas manos.',
        'La esperanza no avergüenza, porque el amor de Dios ha sido derramado en nuestros corazones. Cuando la duda llegue, recuerda su amor: es la prueba de que vale la pena esperar.',
    ],
}

ORACIONES_TEMA = {
    'Ánimo': ['Señor, cuando me falten las fuerzas, sé tú mi fortaleza. Ayúdame a dar el siguiente paso confiando en ti. Amén.',
              'Padre, levanta mi ánimo y renueva mi esperanza. Que hoy pueda animar también a alguien más. Amén.'],
    'Fe': ['Señor, aumenta mi fe. Ayúdame a confiar en ti aunque no entienda todo. Amén.',
           'Jesús, pongo en tus manos lo que no puedo controlar. Creo que eres bueno y que estás conmigo. Amén.'],
    'Amor': ['Padre, gracias por amarme sin condiciones. Enséñame a amar a los demás como tú me amas. Amén.',
             'Señor, llena mi corazón de paciencia y bondad, para amar con hechos y no solo con palabras. Amén.'],
    'Paz': ['Jesús, dame tu paz que sobrepasa todo entendimiento. Calma mi mente y mi corazón. Amén.',
            'Señor, te entrego mis preocupaciones. Hazme instrumento de tu paz hoy. Amén.'],
    'Familia': ['Padre, bendice a mi familia. Une nuestros corazones y sé el centro de nuestro hogar. Amén.',
                'Señor, sana las heridas de mi familia y enséñanos a perdonarnos unos a otros. Amén.'],
    'Gratitud': ['Gracias, Señor, por este día y por tantas bendiciones. Que mi vida entera sea una acción de gracias. Amén.',
                 'Padre, abre mis ojos para ver tus regalos de cada día y dame un corazón agradecido. Amén.'],
    'Sabiduría': ['Señor, dame sabiduría para las decisiones de hoy. Guía mis pasos y mis palabras. Amén.',
                  'Padre, que tu Palabra sea lámpara a mis pies. Ayúdame a escuchar antes de hablar. Amén.'],
    'Esperanza': ['Señor, cuando no vea la salida, recuérdame que tienes un futuro para mí. Renueva mi esperanza. Amén.',
                  'Padre, gracias porque tus misericordias son nuevas cada mañana. Ayúdame a empezar otra vez contigo. Amén.'],
}

# Planes por tema: una lectura por día (pasajes)
PLANES_TEMA = [
    ('ansiedad', 'Vencer la ansiedad', '😟', 'Siete días para entregar tus cargas a Dios.',
     ['Filipenses 4:4-9', 'Mateo 6:25-34', '1 Pedro 5:6-11', 'Salmos 23:1-6', 'Isaías 41:8-13', 'Juan 14:1-6', 'Salmos 46:1-11']),
    ('matrimonio', 'Matrimonio con propósito', '💍', 'Catorce días para fortalecer el amor en pareja.',
     ['Génesis 2:18-25', 'Efesios 5:21-33', '1 Corintios 13:1-13', 'Cantares 8:6-7', 'Proverbios 31:10-31', 'Colosenses 3:12-19', '1 Pedro 3:7-12',
      'Eclesiastés 4:9-12', 'Rut 1:16-18', 'Marcos 10:6-9', 'Romanos 12:9-18', 'Filipenses 2:1-5', 'Salmos 127:1-5', 'Proverbios 3:3-6']),
    ('perdon', 'El poder del perdón', '🕊️', 'Siete días para recibir y dar perdón.',
     ['Mateo 6:9-15', 'Mateo 18:21-35', 'Lucas 15:11-32', 'Colosenses 3:12-14', 'Efesios 4:30-32', 'Salmos 103:8-14', '1 Juan 1:5-10']),
    ('finanzas', 'Finanzas con sabiduría', '💰', 'Siete días sobre el dinero, el trabajo y la generosidad.',
     ['Proverbios 3:9-10', 'Mateo 6:19-24', 'Lucas 16:10-13', '1 Timoteo 6:6-10', 'Proverbios 21:5', 'Proverbios 22:1-7', 'Filipenses 4:10-19']),
    ('jovenes', 'Para jóvenes', '🔥', 'Siete días para una fe valiente desde joven.',
     ['1 Timoteo 4:12-16', 'Eclesiastés 12:1-7', 'Salmos 119:9-16', 'Proverbios 3:1-8', '2 Timoteo 2:22-26', 'Jeremías 1:4-10', 'Daniel 1:8-17']),
    ('duelo', 'Consuelo en el dolor', '💧', 'Siete días de esperanza cuando duele el corazón.',
     ['Salmos 34:15-22', 'Juan 11:17-27', '2 Corintios 1:3-7', 'Salmos 23:1-6', '1 Tesalonicenses 4:13-18', 'Apocalipsis 21:1-7', 'Romanos 8:31-39']),
    ('fe', 'Fortalece tu fe', '🙏', 'Siete días con los héroes de la fe.',
     ['Hebreos 11:1-6', 'Génesis 12:1-5', 'Hebreos 11:23-29', 'Josué 6:1-5', '1 Samuel 17:41-50', 'Daniel 6:16-23', 'Marcos 9:20-27']),
]

# Fechas especiales (la Semana Santa se calcula con la fecha de Pascua de cada año)
FECHAS = {
    'navidad': {'t': 'Feliz Navidad', 'e': '🎄', 'lecturas': ['Lucas 2:1-20', 'Isaías 9:6-7', 'Mateo 2:1-12', 'Juan 1:1-14', 'Mateo 1:18-25'],
                'oracion': 'Señor Jesús, gracias por venir al mundo como un niño humilde para salvarnos. Que esta Navidad mi casa se llene de tu paz, tu alegría y tu amor. Amén.',
                'tarjeta': 'navidad'},
    'anonuevo': {'t': 'Feliz Año Nuevo', 'e': '🎆', 'lecturas': ['Isaías 43:18-19', 'Lamentaciones 3:22-23', 'Salmos 90:12-17', 'Filipenses 3:12-14', 'Jeremías 29:11-13'],
                 'oracion': 'Padre, gracias por el año que termina y por todo lo que me enseñaste. Pongo en tus manos este año nuevo: mis planes, mi familia y mis sueños. Guíame cada día. Amén.',
                 'tarjeta': 'anonuevo'},
    'semanasanta': {'t': 'Semana Santa', 'e': '✝️',
                    'dias': [('Domingo de Ramos', 'Mateo 21:1-11'), ('Lunes Santo', 'Marcos 11:15-19'), ('Martes Santo', 'Mateo 22:34-40'),
                             ('Miércoles Santo', 'Mateo 26:14-16'), ('Jueves Santo', 'Juan 13:1-15'), ('Viernes Santo', 'Juan 19:16-30'),
                             ('Sábado Santo', 'Mateo 27:57-66'), ('Domingo de Resurrección', 'Mateo 28:1-10'), ('Lunes de Pascua', 'Lucas 24:13-35')],
                    'oracion': 'Señor Jesús, gracias por tu amor hasta la cruz y por tu victoria sobre la muerte. Que esta Semana Santa renueve mi fe y mi esperanza. Amén.',
                    'tarjeta': 'bendiciones'},
}
