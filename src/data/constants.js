// ---------------------------------------------------------------------------
// Endpoints de SharePoint. Se reutilizan los mismos sitios que ya usa el
// proyecto CheckList-Cerrejon: la autenticacion sale del sitio de la app y la
// jerarquia organizacional (superintendencias) del sitio raiz de SGIA.
// ---------------------------------------------------------------------------
export const SITE_URL = "https://glencore.sharepoint.com/sites/co-lmn-sgia/checklist";
export const SGIA_SITE_URL = "https://glencore.sharepoint.com/sites/co-lmn-sgia";
export const AC_SITE_URL = "https://glencore.sharepoint.com/sites/co-lmn-sgia/ac";
export const EVIDENCIAS_BASE = "/sites/co-lmn-sgia/ac/SiteAssets/AppGCOM/Evidencias";

// Lista que funciona como fuente oficial de GERENCIA / G_ABREVIADA /
// SUPERINTENDENCIA para toda la organizacion.
export const JERARQUIA_LIST = "JerarquiaL";

// Correos con rol de Administrador. Son los jefes de area: aceptan o rechazan
// las propuestas de reagendamiento y son los unicos que pueden eliminar.
// Se escriben en minuscula porque la comparacion normaliza; el directorio
// devuelve el correo con mayusculas segun como se creo la cuenta
// (Jose.C.Barrios@cerrejon.com) y eso no debe dejar a nadie fuera.
// jorge.almarales.ext es temporal (solo para pruebas).
export const ADMINS = [
    "ernesto.rodriguez@cerrejon.com",
    "jose.c.barrios@cerrejon.com",
    "marco.atencio@cerrejon.com",
    "jorge.almarales.ext@cerrejon.com"
];

/**
 * Deja el correo comparable: sin espacios, en minuscula y sin el prefijo de
 * claims que SharePoint antepone en algunos contextos
 * ("i:0#.f|membership|juan.a.valencia@cerrejon.com").
 */
export const normalizarCorreo = (v) => (v || '').trim().toLowerCase().split('|').pop();

export const esAdmin = (email) => ADMINS.includes(normalizarCorreo(email));

// Nombre visible del gerente, usado en el texto de las notificaciones.
export const ADMIN_PRINCIPAL = {
    email: "marco.atencio@cerrejon.com",
    nombre: "Marco Atencio",
    cargo: "Gerente de Gestión de Activos"
};

// TODO: reemplazar por las tareas reales cuando las entregue la gerencia.
export const TAREAS = [
    "Operación de camión minero (acarreo)",
    "Operación de pala eléctrica / excavadora",
    "Perforación de barrenos",
    "Cargue y voladura de explosivos",
    "Mantenimiento mecánico en taller de equipo pesado",
    "Trabajo en altura sobre estructuras de trituración",
    "Manejo de bandas transportadoras de carbón",
    "Trabajos eléctricos en subestaciones de mina",
    "Operación de tractores de oruga en botadero",
    "Izaje de cargas con grúa",
    "Conducción de vehículos livianos en vías mineras",
    "Trabajo en espacios confinados (silos y tolvas)"
];

export const PPF = [
    "Aislamiento de energía",
    "Trabajo en Altura",
    "Espacios Confinados y Atmósferas potencialmente peligrosas",
    "Equipo Móvil",
    "Falla de Estratos",
    "Seguridad Eléctrica",
    "Respuesta a Emergencias",
    "Grúas e Izaje de Cargas",
    "Incendios y Explosiones",
    "Explosivos y Voladuras",
    "Llantas y Rines",
    "Inundaciones"
];

export const TURNOS = ["Día", "Noche"];

export const ESTADOS = {
    SIN_HALLAZGOS: "Sin hallazgos",
    CON_HALLAZGOS: "Con hallazgos"
};

// Ciclo de vida de una observacion. Tres estados, y solo dos de ellos se
// guardan: una observacion nace POR_REALIZAR y pasa sola a NO_REALIZADA en
// cuanto vence su fecha y hora, sin que nadie tenga que tocarla. REALIZADA es
// la unica transicion que alguien declara (o NO_REALIZADA, para corregir).
export const ESTADO_REALIZACION = {
    POR_REALIZAR: "Por realizar",
    REALIZADA: "Realizada",
    NO_REALIZADA: "No realizada"
};

// Paleta de los tres estados. Azul para lo que todavia tiene plazo, verde para
// lo cumplido y rojo para lo que vencio sin hacerse: aqui el rojo si
// corresponde, porque es la falla que el tablero tiene que hacer evidente.
// Los tres se separan tanto por tono como por claridad, y nunca viajan sin su
// icono y su texto.
export const COLOR_REALIZACION = {
    [ESTADO_REALIZACION.POR_REALIZAR]: "#2a78d6",
    [ESTADO_REALIZACION.REALIZADA]: "#0f7a55",
    [ESTADO_REALIZACION.NO_REALIZADA]: "#c0392b"
};

// Version legible como texto sobre blanco (los tonos de arriba son rellenos).
export const TINTA_REALIZACION = {
    [ESTADO_REALIZACION.POR_REALIZAR]: "#2a78d6",
    [ESTADO_REALIZACION.REALIZADA]: "#0f7a55",
    [ESTADO_REALIZACION.NO_REALIZADA]: "#b02a1e"
};

// Solicitud de reagendamiento. La abre el observador, que es quien sabe cuando
// SI podra hacerla, asi que el propone la fecha nueva. El administrador no
// escoge fecha: solo acepta la propuesta o la rechaza.
export const REAGENDAMIENTO = {
    SOLICITADO: "Solicitado",
    ACEPTADO: "Aceptado",
    RECHAZADO: "Rechazado"
};

// Una tarea relevante puede nacer de dos formas: planeada con anticipacion
// (observadores, fecha, hora y area definidos) o registrada sobre la marcha
// porque ocurrio algo que valia la pena observar. Los registros creados antes
// de esta distincion se consideran programados: en ese momento no habia otra.
export const PROGRAMACION = {
    PROGRAMADA: "Programada",
    NO_PROGRAMADA: "No programada"
};

// Corte binario: azul contra naranja, par validado sobre blanco (CVD ΔE 24.7).
// Ninguno de los dos lados es "malo", asi que el rojo y el verde quedan fuera:
// aqui solo se distingue el origen de la tarea, no su cumplimiento.
export const COLOR_PROGRAMACION = {
    [PROGRAMACION.PROGRAMADA]: "#2a78d6",
    [PROGRAMACION.NO_PROGRAMADA]: "#eb6834"
};

// Version para texto sobre blanco: el naranja de relleno se queda en 3.3:1,
// asi que como tinta se usa el naranja-700.
export const TINTA_PROGRAMACION = {
    [PROGRAMACION.PROGRAMADA]: "#2a78d6",
    [PROGRAMACION.NO_PROGRAMADA]: "#c2410c"
};

export const SEVERIDADES = ["Bajo", "Medio", "Alto", "Crítico"];

// Directorio de demostracion: solo alimenta el buscador de personas cuando la
// API del People Picker no responde (desarrollo local). Dentro de SharePoint
// nunca se usa, ahi manda el directorio activo real.
export const DIRECTORIO_DEMO = [
    { nombre: "Marco Atencio", email: "marco.atencio@cerrejon.com", manual: false },
    { nombre: "Jorge Almarales", email: "jorge.almarales.ext@cerrejon.com", manual: false },
    { nombre: "Carlos Mendoza", email: "carlos.mendoza@cerrejon.com", manual: false },
    { nombre: "Luisa Fernanda Ríos", email: "luisa.rios@cerrejon.com", manual: false },
    { nombre: "Andrés Epiayú", email: "andres.epiayu@cerrejon.com", manual: false },
    { nombre: "Diana Pushaina", email: "diana.pushaina@cerrejon.com", manual: false },
    { nombre: "Ricardo Ospino", email: "ricardo.ospino@cerrejon.com", manual: false },
    { nombre: "Sandra Uriana", email: "sandra.uriana@cerrejon.com", manual: false }
];

// Superintendencias de respaldo: se usan solo si la lista JerarquiaL no
// responde (desarrollo local fuera de la red corporativa, CORS, caida del
// sitio). En produccion siempre gana lo que devuelve SharePoint.
export const SUPERINTENDENCIAS_FALLBACK = [
    "SUPERINTENDENCIA DE MANTENIMIENTO MINA",
    "SUPERINTENDENCIA DE OPERACIONES MINA",
    "SUPERINTENDENCIA DE PERFORACIÓN Y VOLADURA",
    "SUPERINTENDENCIA DE PLANEACIÓN MINERA",
    "SUPERINTENDENCIA DE MANEJO DE CARBÓN",
    "SUPERINTENDENCIA DE FERROCARRIL",
    "SUPERINTENDENCIA DE PUERTO",
    "SUPERINTENDENCIA DE MANTENIMIENTO DE INFRAESTRUCTURA",
    "SUPERINTENDENCIA DE SALUD Y SEGURIDAD",
    "SUPERINTENDENCIA DE GESTIÓN DE ACTIVOS"
];
