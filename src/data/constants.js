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

// Unicos correos con rol de Administrador: pueden comentar cualquier
// observacion. jorge.almarales.ext es temporal (solo para pruebas).
export const ADMINS = [
    "marco.atencio@cerrejon.com",
    "jorge.almarales.ext@cerrejon.com"
];

export const esAdmin = (email) => ADMINS.includes((email || '').toLowerCase());

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

// Ciclo de vida de una observacion programada. Al crearla siempre nace
// PENDIENTE: el supervisor la cierra despues como REALIZADA o NO_REALIZADA
// (esta ultima exige explicar el motivo).
export const ESTADO_REALIZACION = {
    PENDIENTE: "Pendiente",
    REALIZADA: "Realizada",
    NO_REALIZADA: "No realizada"
};

// Paleta de los tres estados. "No realizada" es ambar por decision de negocio:
// no es una falla grave sino una gestion que quedo sin ejecutar, y el rojo se
// reserva para los hallazgos. Como verde y ambar se confunden en vision protan
// cuando comparten claridad, el verde se oscurecio hasta L* ~45 frente al ambar
// en L* ~71: la separacion queda por claridad, no por tono.
// El ambar da 2.4:1 de contraste sobre blanco, bajo el piso de 3:1 para objetos
// graficos; el alivio exigido va incluido en las graficas: cantidad impresa
// dentro de cada segmento, leyenda con icono y texto, y vista de tabla.
export const COLOR_REALIZACION = {
    [ESTADO_REALIZACION.REALIZADA]: "#0f7a55",
    [ESTADO_REALIZACION.PENDIENTE]: "#2a78d6",
    [ESTADO_REALIZACION.NO_REALIZADA]: "#e0a30c"
};

// Version legible como texto sobre blanco (los tonos de arriba son para
// rellenos). El ambar puro no alcanza 4.5:1, asi que se usa ambar-700.
export const TINTA_REALIZACION = {
    [ESTADO_REALIZACION.REALIZADA]: "#0f7a55",
    [ESTADO_REALIZACION.PENDIENTE]: "#2a78d6",
    [ESTADO_REALIZACION.NO_REALIZADA]: "#b45309"
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
