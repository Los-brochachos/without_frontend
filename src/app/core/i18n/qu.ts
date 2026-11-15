import { ES } from './es';

/**
 * Runasimi (quechua sureño, Cusco-Collao). Borrador asistido por IA: debe revisarlo un hablante nativo.
 * Las claves que falten aquí se muestran en español.
 */
export const QU: Partial<Record<keyof typeof ES, string>> = {
  'idioma.cambiar': 'Castellano simipi rimay',
  'idioma.corto': 'ES',
  'tema.claro': "K'anchaq rikchayta churay",
  'tema.oscuro': 'Tutayaq rikchayta churay',

  'nav.inicio': 'Qallariy',
  'nav.nosotros': 'Ñuqaykumanta',
  'nav.productos': 'Rurusqakuna',
  'nav.contacto': 'Rimanakuy',
  'nav.registrarse': 'Qillqakuy',
  'nav.iniciarSesion': 'Yaykuy',
  'nav.buscar': 'Maskay',
  'nav.buscarSitio': 'Kay paginapi maskay',
  'nav.buscarDescripcion': "Rurusqaykumanta, yanapayniykumanta, empresamanta, imaynata rimanakunamantapas willakuyta tariy.",
  'nav.buscarPlaceholder': '¿Imatataq maskachkanki? Ej.: oxígeno, mana manchakuy, chanin mañakuy…',
  'nav.cerrarBuscador': 'Maskanata wichqay',
  'nav.explora': 'WITHOUT-ta riqsiy',
  'nav.exploraDescripcion': "Rurusqaykuta, llamk'ayniykutapas riqsiy.",
  'nav.miCuenta': 'Cuentay',
  'nav.miCuentaDescripcion': 'Cliente portalniykiman yaykuy.',
  'nav.servicioCliente': 'Clientekunapaq yanapay',
  'busq.coincidencias': 'tarisqakuna',
  'busq.pagina': 'pagina',
  'busq.paginas': 'paginakuna',
  'busq.sinResultados': 'Manam imatapas tarirqaykuchu:',

  'login.subtitulo': 'Atiendey qhawana sistema',
  'login.plataforma': 'Kamachina llika',
  'login.bienvenido1': 'Yapamanta',
  'login.bienvenido2': 'allinlla hamuy.',
  'login.lema': "Huk kitillamanta atiendey llamk'aykunata kamachiy, qhawariy, allinchaypas.",
  'login.seguro': 'Mana manchakuspa yaykuy',
  'login.seguroDescripcion': "Llamk'ayniykikuna waqaychasqa kachkan.",
  'login.derechos': '© 2026 without · Llapan hayñikuna waqaychasqa',
  'login.claveActualizada': 'Pakasqa simiyki musuqchasqañam. Musuq pakasqa simiykiwan yaykuy.',
  'login.instrucciones': 'Qatinaykipaq willakuyniykikunata qillqay.',
  'login.correo': 'Correo electrónico',
  'login.correoObligatorio': 'Correoqa necesitakunmi.',
  'login.correoInvalido': 'Allin correota qillqay.',
  'login.clave': 'Pakasqa simi',
  'login.clavePlaceholder': 'Pakasqa simiykita qillqay',
  'login.claveObligatoria': 'Pakasqa simiqa necesitakunmi.',
  'login.ingresando': 'Yaykuchkan...',
  'login.ingresar': 'Yaykuy',
  'login.noRegistrado': '¿Manaraqchu qillqasqa kanki?',
  'login.registrate': 'Qillqakuy',
};
