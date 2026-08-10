import { ESTADOS, ESTADO_REALIZACION } from '../data/constants';
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
        comentariosAdmin: [],
        fotosAlCrear: datos.fotosAlCrear || [],
        fotosAlRealizar: [],
        // Se programa: nace pendiente hasta que el supervisor la cierre.
        estadoRealizacion: ESTADO_REALIZACION.PENDIENTE,
        realizada: false,
        explicacionNoRealizada: '',
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
// Estado de realizacion
// ---------------------------------------------------------------------------

/**
 * Estado de una observacion tolerante a los registros viejos, que solo tenian
 * el booleano `realizada`: si ese registro traia motivo, era una no realizada;
 * si no, se considera pendiente.
 */
export const estadoDe = (obs) => {
    if (obs?.estadoRealizacion) return obs.estadoRealizacion;
    if (obs?.realizada) return ESTADO_REALIZACION.REALIZADA;
    if ((obs?.explicacionNoRealizada || '').trim()) return ESTADO_REALIZACION.NO_REALIZADA;
    return ESTADO_REALIZACION.PENDIENTE;
};

export const esRealizada = (obs) => estadoDe(obs) === ESTADO_REALIZACION.REALIZADA;
export const esPendiente = (obs) => estadoDe(obs) === ESTADO_REALIZACION.PENDIENTE;

/** Pendiente cuya hora programada ya paso: es lo que el supervisor debe cerrar. */
export const estaVencida = (obs, ahora = new Date()) => {
    if (!esPendiente(obs) || !obs.fecha) return false;
    return new Date(`${obs.fecha}T${obs.hora || '23:59'}`) < ahora;
};

/** Cierra (o reabre) una observacion. `realizada` se mantiene por compatibilidad. */
export const cambiarEstadoRealizacion = async (obsId, { estado, explicacionNoRealizada = '', fotosAlRealizar }) =>
    actualizarEnCache(obsId, (o) => ({
        ...o,
        estadoRealizacion: estado,
        realizada: estado === ESTADO_REALIZACION.REALIZADA,
        explicacionNoRealizada: estado === ESTADO_REALIZACION.NO_REALIZADA ? explicacionNoRealizada : '',
        fotosAlRealizar: fotosAlRealizar ?? (o.fotosAlRealizar || [])
    }));

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

export const agregarComentarioAdmin = async (obsId, comentario) =>
    actualizarEnCache(obsId, (o) => ({
        ...o,
        comentariosAdmin: [
            ...(o.comentariosAdmin || []),
            { id: nuevoId(), creadoEn: new Date().toISOString(), ...comentario }
        ]
    }));

export const puedeGestionar = (obs, usuario) => {
    if (!usuario) return false;
    const esCreador = (obs.creadoPor || '').toLowerCase() === usuario.email.toLowerCase();
    const esAdmin = usuario.admin;
    return esCreador || esAdmin;
};

export const puedeEditar = puedeGestionar;

export const tieneComentarioAdmin = (obs) => (obs.comentariosAdmin || []).length > 0;

// Notificaciones
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
        .filter(n => n.paraEmail === (email || '').toLowerCase())
        .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));

export const notificar = ({ paraEmail, titulo, mensaje, obsId }) => {
    if (!paraEmail) return;
    const n = {
        id: nuevoId(),
        paraEmail: paraEmail.toLowerCase(),
        titulo,
        mensaje,
        obsId,
        leida: false,
        creadoEn: new Date().toISOString()
    };
    escribir(KEY_NOTIFICACIONES, [n, ...leer(KEY_NOTIFICACIONES)]);
};

export const marcarNotificacionesLeidas = (email) => {
    const target = (email || '').toLowerCase();
    escribir(
        KEY_NOTIFICACIONES,
        leer(KEY_NOTIFICACIONES).map(n => (n.paraEmail === target ? { ...n, leida: true } : n))
    );
};
