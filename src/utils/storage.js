import { ESTADOS, ESTADO_REALIZACION, PROGRAMACION, REAGENDAMIENTO, ADMINS, normalizarCorreo } from '../data/constants';
import {
    getObservacionesDesdeSharePoint,
    saveObservacionToSharePoint,
    updateObservacionInSharePoint
} from './sharepointApi';

const KEY_NOTIFICACIONES = 'gcom_notificaciones';

// Cache en memoria para las observaciones. Es la unica fuente que leen los
// componentes: toda escritura lo actualiza primero y avisa a los suscriptores,
// y solo despues viaja a SharePoint. Asi la pantalla responde al instante y no
// hay que recargar nada.
let observacionesCache = [];
let cacheLoaded = false;

// Escrituras en vuelo. Mientras haya alguna, el refresco automatico se salta el
// turno: si trajera la lista del servidor justo antes de que termine el POST,
// borraria de la pantalla el cambio que el usuario acaba de hacer.
let escriturasPendientes = 0;

const suscriptores = new Set();

/** Avisa a la UI. Se entrega SIEMPRE un array nuevo para que React vuelva a pintar. */
const emitir = () => {
    observacionesCache = [...observacionesCache];
    suscriptores.forEach(fn => fn(observacionesCache));
};

/** Devuelve la funcion para cancelar la suscripcion. */
export const suscribir = (fn) => {
    suscriptores.add(fn);
    return () => suscriptores.delete(fn);
};

const nuevoId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const hoyISO = (d = new Date()) => {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const horaISO = (d = new Date()) => {
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())}`;
};

export const turnoPorHora = (hora) => {
    const h = parseInt((hora || '').split(':')[0], 10);
    return Number.isNaN(h) || h < 6 || h >= 18 ? 'Noche' : 'Día';
};

// Inicializar cache desde SharePoint
export const inicializarCache = async () => {
    if (cacheLoaded) return;
    try {
        observacionesCache = await getObservacionesDesdeSharePoint();
    } catch (e) {
        console.error('Error leyendo observaciones:', e);
        observacionesCache = [];
    }
    cacheLoaded = true;
    emitir();
};

/**
 * Trae la lista del servidor y repinta solo si algo cambio. Lo llama el
 * temporizador de App.jsx cada pocos segundos, para que un gerente vea los
 * hallazgos y cierres que registran los supervisores sin tocar nada.
 */
export const refrescarObservaciones = async () => {
    if (escriturasPendientes > 0) return false;
    let remotas;
    try {
        remotas = await getObservacionesDesdeSharePoint();
    } catch {
        // Sin red o sin sesion de SharePoint: se conserva lo que ya hay.
        return false;
    }
    // Una escritura pudo arrancar mientras esperabamos la respuesta.
    if (escriturasPendientes > 0) return false;
    if (JSON.stringify(remotas) === JSON.stringify(observacionesCache)) return false;
    observacionesCache = remotas;
    emitir();
    return true;
};

export const getObservaciones = () => observacionesCache;

/** Envuelve una escritura para que el refresco automatico no la pise. */
const persistir = async (fn) => {
    escriturasPendientes += 1;
    try {
        return await fn();
    } finally {
        escriturasPendientes -= 1;
    }
};

export const crearObservacion = async (datos, usuario) => {
    const obs = {
        id: nuevoId(),
        ...datos,
        estado: ESTADOS.SIN_HALLAZGOS,
        hallazgos: [],
        comentarios: [],
        fotosAlCrear: datos.fotosAlCrear || [],
        fotosAlRealizar: [],
        // Sin dato explicito se asume programada, que era lo unico que existia.
        programada: datos.programada !== false,
        observadores: datos.observadores || [],
        // Nace con plazo abierto. Vence sola cuando pase su fecha y hora.
        estadoRealizacion: ESTADO_REALIZACION.POR_REALIZAR,
        realizada: false,
        cerradoEn: null,
        explicacionNoRealizada: '',
        solicitudReagendamiento: null,
        reagendamientos: [],
        creadoPor: usuario.email,
        creadoPorNombre: usuario.nombre,
        creadoEn: new Date().toISOString()
    };

    // Se muestra de inmediato y se corrige si el guardado falla.
    observacionesCache = [obs, ...observacionesCache];
    emitir();

    try {
        const spId = await persistir(() => saveObservacionToSharePoint(obs));
        observacionesCache = observacionesCache.map(o => (o.id === obs.id ? { ...o, _spId: spId } : o));
        emitir();
        return obs;
    } catch (e) {
        console.error('Error creando observación:', e);
        observacionesCache = observacionesCache.filter(o => o.id !== obs.id);
        emitir();
        throw e;
    }
};

const actualizarEnCache = async (id, fn) => {
    const idx = observacionesCache.findIndex(o => o.id === id);
    if (idx === -1) return null;

    const obsActual = observacionesCache[idx];
    const obsActualizada = fn(obsActual);
    observacionesCache = observacionesCache.map(o => (o.id === id ? obsActualizada : o));
    emitir();

    try {
        await persistir(async () => {
            if (obsActual._spId) {
                await updateObservacionInSharePoint(obsActual._spId, obsActualizada);
            } else {
                const spId = await saveObservacionToSharePoint(obsActualizada);
                observacionesCache = observacionesCache.map(o => (o.id === id ? { ...o, _spId: spId } : o));
                emitir();
            }
        });
    } catch (e) {
        console.error('Error actualizando observación:', e);
        // Se revierte para no dejar en pantalla algo que el servidor no tiene.
        observacionesCache = observacionesCache.map(o => (o.id === id ? obsActual : o));
        emitir();
        throw e;
    }

    return obsActualizada;
};

export const actualizarObservacion = async (id, fn) => actualizarEnCache(id, fn);

// ---------------------------------------------------------------------------
// Observadores
//
// Una observacion puede tener varios. Los registros viejos guardaban uno solo
// en `observador`, asi que toda lectura pasa por aqui y nadie mas se entera de
// que existieron las dos formas.
// ---------------------------------------------------------------------------

export const observadoresDe = (obs) => {
    if (Array.isArray(obs?.observadores) && obs.observadores.length) return obs.observadores;
    return obs?.observador ? [obs.observador] : [];
};

export const esObservador = (obs, usuario) => {
    if (!usuario) return false;
    const yo = normalizarCorreo(usuario.email);
    return observadoresDe(obs).some(p => normalizarCorreo(p.email) === yo);
};

export const esCreador = (obs, usuario) =>
    !!usuario && normalizarCorreo(obs?.creadoPor) === normalizarCorreo(usuario.email);

export const nombresObservadores = (obs) =>
    observadoresDe(obs).map(p => p.nombre || p.email).join(', ');

// ---------------------------------------------------------------------------
// Estado de realizacion
//
// Tres estados, pero el reloj decide dos de ellos: una observacion viva esta
// POR_REALIZAR mientras su fecha y hora no lleguen, y pasa a NO_REALIZADA en
// cuanto vencen, sola, sin que nadie la toque. Por eso el estado se DERIVA en
// cada lectura en vez de guardarse: si dependiera de un campo escrito, cada
// observacion vencida tendria que esperar a que alguien abriera la pantalla
// para actualizarse.
//
// Lo unico que se guarda es lo que una persona declara: que se realizo, o que
// no se realizo. `cerradoEn` marca esa declaracion y es lo que distingue un
// "No realizada" dicho por alguien de uno que todavia no ha ocurrido; los
// registros viejos que quedaron en "Pendiente" no lo traen y caen solos en la
// via automatica, que es justo donde deben estar.
// ---------------------------------------------------------------------------

const momentoProgramado = (obs) => new Date(`${obs.fecha}T${obs.hora || '23:59'}`);

/** Alguien ya registro el resultado de esta observacion. */
const tieneResultadoDeclarado = (obs) => !!obs?.cerradoEn;

export const estadoDe = (obs, ahora = new Date()) => {
    if (obs?.estadoRealizacion === ESTADO_REALIZACION.REALIZADA || obs?.realizada === true) {
        return ESTADO_REALIZACION.REALIZADA;
    }
    // "No se realizó" declarado a mano: manda sobre el reloj.
    if (obs?.estadoRealizacion === ESTADO_REALIZACION.NO_REALIZADA && tieneResultadoDeclarado(obs)) {
        return ESTADO_REALIZACION.NO_REALIZADA;
    }
    // Una no programada no tiene plazo que vencer: sigue abierta hasta que
    // alguien la cierre.
    if (!esProgramada(obs)) return ESTADO_REALIZACION.POR_REALIZAR;
    if (!obs?.fecha) return ESTADO_REALIZACION.POR_REALIZAR;
    return momentoProgramado(obs) >= ahora
        ? ESTADO_REALIZACION.POR_REALIZAR
        : ESTADO_REALIZACION.NO_REALIZADA;
};

export const esRealizada = (obs) => estadoDe(obs) === ESTADO_REALIZACION.REALIZADA;

/** Todavia tiene plazo: el observador esta a tiempo de hacerla. */
export const estaPorRealizar = (obs, ahora = new Date()) =>
    estadoDe(obs, ahora) === ESTADO_REALIZACION.POR_REALIZAR;

/**
 * Vencida sin realizar: es el incumplimiento que el tablero del jefe de area
 * tiene que sacar a flote. Coincide con el estado NO_REALIZADA.
 */
export const estaVencida = (obs, ahora = new Date()) =>
    estadoDe(obs, ahora) === ESTADO_REALIZACION.NO_REALIZADA;

/** Los registros anteriores a la distincion no traen el campo: eran programados. */
export const esProgramada = (obs) => obs?.programada !== false;

export const programacionDe = (obs) =>
    esProgramada(obs) ? PROGRAMACION.PROGRAMADA : PROGRAMACION.NO_PROGRAMADA;

/**
 * Una no programada que si se ejecuto suma al cumplimiento igual que una
 * programada. Una no programada que nadie cerro no es nada: ni meta ni logro,
 * y por eso queda fuera de las cuentas.
 */
export const cuentaParaMetricas = (obs) => esProgramada(obs) || esRealizada(obs);

// ---------------------------------------------------------------------------
// Permisos
// ---------------------------------------------------------------------------

/** Cerrar la observacion, cargar hallazgos y evidencias. */
export const puedeGestionar = (obs, usuario) => {
    if (!usuario) return false;
    return usuario.admin || esCreador(obs, usuario) || esObservador(obs, usuario);
};

/** Corregir los datos de la tarea: solo quien la creo y los administradores. */
export const puedeEditar = (obs, usuario) => {
    if (!usuario) return false;
    return usuario.admin || esCreador(obs, usuario);
};

/** Reagendar una observacion vencida: exclusivo de los jefes de area. */
export const puedeReagendar = (obs, usuario) => !!usuario?.admin && !esRealizada(obs);

/** Pedir nueva fecha: el observador asignado (o quien la creo) y solo si no se hizo. */
export const puedeSolicitarReagendamiento = (obs, usuario) => {
    if (!usuario || usuario.admin || esRealizada(obs) || !esProgramada(obs)) return false;
    if (tieneSolicitudAbierta(obs)) return false;
    return esObservador(obs, usuario) || esCreador(obs, usuario);
};

export const tieneSolicitudAbierta = (obs) =>
    obs?.solicitudReagendamiento?.estado === REAGENDAMIENTO.SOLICITADO;

/** Lo que un administrador tiene que resolver: vencidas y solicitudes abiertas. */
export const requiereAtencion = (obs) => estaVencida(obs) || tieneSolicitudAbierta(obs);

// ---------------------------------------------------------------------------
// Cierre, edicion y reagendamiento
// ---------------------------------------------------------------------------

/**
 * Registra el resultado de una observacion. `realizada` se mantiene por
 * compatibilidad con los registros viejos.
 * El motivo solo tiene sentido en una no realizada y el comentario de cierre
 * solo en una realizada: al cambiar de estado se limpia el que ya no aplica.
 */
export const cambiarEstadoRealizacion = async (obsId, { estado, explicacionNoRealizada = '', comentarioCierre = '', fotosAlRealizar }) =>
    actualizarEnCache(obsId, (o) => ({
        ...o,
        estadoRealizacion: estado,
        // Sella la declaracion: sin esto un "No realizada" no se distingue de
        // una observacion que simplemente todavia no ha vencido.
        cerradoEn: new Date().toISOString(),
        realizada: estado === ESTADO_REALIZACION.REALIZADA,
        explicacionNoRealizada: estado === ESTADO_REALIZACION.NO_REALIZADA ? explicacionNoRealizada : '',
        comentarioCierre: estado === ESTADO_REALIZACION.REALIZADA ? comentarioCierre.trim() : '',
        fotosAlRealizar: fotosAlRealizar ?? (o.fotosAlRealizar || [])
    }));

/**
 * Corrige los datos de la tarea. Tambien es el camino para convertir una no
 * programada en programada: al marcarla, el formulario exige observador, fecha,
 * hora y area, que es justo lo que le faltaba.
 */
export const editarObservacion = async (obsId, datos, usuario) =>
    actualizarEnCache(obsId, (o) => ({
        ...o,
        ...datos,
        // `observador` (singular) es del modelo viejo: si se editan los
        // observadores hay que borrarlo o volveria a aparecer al leer.
        observador: null,
        editadoPor: usuario.email,
        editadoPorNombre: usuario.nombre,
        editadoEn: new Date().toISOString()
    }));

/**
 * El observador avisa que no podra hacerla. Queda registrado como comentario
 * —el motivo es obligatorio— y le llega a todos los administradores, que son
 * los unicos que pueden mover la fecha.
 */
export const solicitarReagendamiento = async (obsId, { motivo, usuario }) => {
    const obs = observacionesCache.find(o => o.id === obsId);
    const actualizada = await actualizarEnCache(obsId, (o) => ({
        ...o,
        solicitudReagendamiento: {
            estado: REAGENDAMIENTO.SOLICITADO,
            motivo,
            solicitadoPor: usuario.email,
            solicitadoPorNombre: usuario.nombre,
            creadoEn: new Date().toISOString()
        },
        comentarios: [
            ...comentariosDe(o),
            {
                id: nuevoId(),
                texto: motivo,
                autor: usuario.email,
                autorNombre: usuario.nombre,
                rol: 'observador',
                tipo: 'solicitud',
                creadoEn: new Date().toISOString()
            }
        ]
    }));

    notificarAdmins({
        titulo: `${usuario.nombre} solicita reagendar una observación`,
        mensaje: `"${motivo}" — sobre la observación de ${obs?.tarea || ''}.`,
        obsId
    });

    return actualizada;
};

/**
 * Mueve la observacion a una fecha nueva. Solo administradores. Se guarda de
 * donde venia: sin ese rastro nadie podria auditar cuantas veces se aplazo la
 * misma tarea.
 */
export const reagendar = async (obsId, { fecha, hora, turno, observadores, nota, usuario }) => {
    const actualizada = await actualizarEnCache(obsId, (o) => ({
        ...o,
        fecha,
        hora,
        turno,
        observadores: observadores?.length ? observadores : observadoresDe(o),
        observador: null,
        programada: true,
        // Vuelve a tener plazo: se limpia el sello del cierre anterior.
        estadoRealizacion: ESTADO_REALIZACION.POR_REALIZAR,
        realizada: false,
        cerradoEn: null,
        solicitudReagendamiento: o.solicitudReagendamiento
            ? { ...o.solicitudReagendamiento, estado: REAGENDAMIENTO.ATENDIDO, atendidoEn: new Date().toISOString() }
            : null,
        reagendamientos: [
            ...(o.reagendamientos || []),
            {
                id: nuevoId(),
                de: `${o.fecha} ${o.hora || ''}`.trim(),
                a: `${fecha} ${hora}`,
                nota: (nota || '').trim(),
                por: usuario.email,
                porNombre: usuario.nombre,
                creadoEn: new Date().toISOString()
            }
        ],
        comentarios: [
            ...comentariosDe(o),
            {
                id: nuevoId(),
                texto: `Observación reagendada para el ${fecha} a las ${hora}.${nota ? ` ${nota.trim()}` : ''}`,
                autor: usuario.email,
                autorNombre: usuario.nombre,
                rol: 'admin',
                tipo: 'reagendamiento',
                creadoEn: new Date().toISOString()
            }
        ]
    }));

    const obs = observacionesCache.find(o => o.id === obsId);
    observadoresDe(obs).forEach(p => notificar({
        paraEmail: p.email,
        titulo: 'Tu observación fue reagendada',
        mensaje: `${usuario.nombre} la movió al ${fecha} a las ${hora}: ${obs?.tarea || ''}.`,
        obsId
    }));

    return actualizada;
};

// ---------------------------------------------------------------------------
// Hallazgos y comentarios
// ---------------------------------------------------------------------------

export const agregarHallazgo = async (obsId, hallazgo) =>
    actualizarEnCache(obsId, (o) => ({
        ...o,
        estado: ESTADOS.CON_HALLAZGOS,
        hallazgos: [...(o.hallazgos || []), {
            id: nuevoId(),
            creadoEn: new Date().toISOString(),
            fotos: [],
            ...hallazgo
        }]
    }));

/** Reemplaza la galeria de un hallazgo (sirve para agregar y para quitar). */
export const establecerFotosHallazgo = async (obsId, hallazgoId, fotos) =>
    actualizarEnCache(obsId, (o) => ({
        ...o,
        hallazgos: (o.hallazgos || []).map(h =>
            h.id === hallazgoId ? { ...h, fotos } : h
        )
    }));

export const eliminarHallazgo = async (obsId, hallazgoId) =>
    actualizarEnCache(obsId, (o) => {
        const hallazgos = (o.hallazgos || []).filter(h => h.id !== hallazgoId);
        return {
            ...o,
            hallazgos,
            estado: hallazgos.length ? ESTADOS.CON_HALLAZGOS : ESTADOS.SIN_HALLAZGOS
        };
    });

/**
 * Hilo de "Comentarios adicionales": el observador explica por que no se hizo y
 * el administrador repregunta. Los registros viejos guardaban solo los
 * comentarios del admin en `comentariosAdmin`; se leen como parte del mismo
 * hilo para no perder el historial.
 */
export const comentariosDe = (obs) => {
    if (Array.isArray(obs?.comentarios)) return obs.comentarios;
    return (obs?.comentariosAdmin || []).map(c => ({ ...c, rol: 'admin', tipo: 'comentario' }));
};

export const agregarComentario = async (obsId, { texto, usuario }) =>
    actualizarEnCache(obsId, (o) => ({
        ...o,
        comentarios: [
            ...comentariosDe(o),
            {
                id: nuevoId(),
                texto,
                autor: usuario.email,
                autorNombre: usuario.nombre,
                rol: usuario.admin ? 'admin' : 'observador',
                tipo: 'comentario',
                creadoEn: new Date().toISOString()
            }
        ]
    }));

export const tieneComentarios = (obs) => comentariosDe(obs).length > 0;

// ---------------------------------------------------------------------------
// Notificaciones
// ---------------------------------------------------------------------------
const leer = (key) => {
    try {
        return JSON.parse(localStorage.getItem(key)) || [];
    } catch {
        return [];
    }
};

const escribir = (key, data) => localStorage.setItem(key, JSON.stringify(data));

export const getNotificaciones = (email) =>
    leer(KEY_NOTIFICACIONES)
        .filter(n => n.paraEmail === normalizarCorreo(email))
        .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));

export const notificar = ({ paraEmail, titulo, mensaje, obsId }) => {
    if (!paraEmail) return;
    const n = {
        id: nuevoId(),
        paraEmail: normalizarCorreo(paraEmail),
        titulo,
        mensaje,
        obsId,
        leida: false,
        creadoEn: new Date().toISOString()
    };
    escribir(KEY_NOTIFICACIONES, [n, ...leer(KEY_NOTIFICACIONES)]);
};

/** Un aviso para cada jefe de area: la solicitud la resuelve cualquiera de ellos. */
export const notificarAdmins = ({ titulo, mensaje, obsId }) =>
    ADMINS.forEach(email => notificar({ paraEmail: email, titulo, mensaje, obsId }));

export const marcarNotificacionesLeidas = (email) => {
    const target = normalizarCorreo(email);
    escribir(
        KEY_NOTIFICACIONES,
        leer(KEY_NOTIFICACIONES).map(n => (n.paraEmail === target ? { ...n, leida: true } : n))
    );
};
