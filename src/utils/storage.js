import { ESTADOS } from '../data/constants';
import {
    getObservacionesDesdeSharePoint,
    saveObservacionToSharePoint,
    updateObservacionInSharePoint
} from './sharepointApi';

const KEY_NOTIFICACIONES = 'gcom_notificaciones';

// Cache en memoria para las observaciones
let observacionesCache = [];
let cacheLoaded = false;

const nuevoId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const hoyISO = (d = new Date()) => {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// Inicializar cache desde SharePoint
export const inicializarCache = async () => {
    if (!cacheLoaded) {
        observacionesCache = await getObservacionesDesdeSharePoint();
        cacheLoaded = true;
    }
};

export const getObservaciones = () => observacionesCache;

export const crearObservacion = async (datos, usuario) => {
    const obs = {
        id: nuevoId(),
        ...datos,
        estado: ESTADOS.SIN_HALLAZGOS,
        hallazgos: [],
        comentariosAdmin: [],
        fotosAlCrear: [],
        fotosAlRealizar: [],
        realizada: false,
        explicacionNoRealizada: '',
        creadoPor: usuario.email,
        creadoPorNombre: usuario.nombre,
        creadoEn: new Date().toISOString()
    };

    try {
        const spId = await saveObservacionToSharePoint(obs);
        obs._spId = spId;
        observacionesCache = [obs, ...observacionesCache];
        return obs;
    } catch (e) {
        console.error('Error creando observación:', e);
        throw e;
    }
};

const actualizarEnCache = async (id, fn) => {
    const idx = observacionesCache.findIndex(o => o.id === id);
    if (idx === -1) return null;

    const obsActual = observacionesCache[idx];
    const obsActualizada = fn(obsActual);
    observacionesCache[idx] = obsActualizada;

    try {
        if (obsActual._spId) {
            await updateObservacionInSharePoint(obsActual._spId, obsActualizada);
        } else {
            const spId = await saveObservacionToSharePoint(obsActualizada);
            observacionesCache[idx]._spId = spId;
        }
    } catch (e) {
        console.error('Error actualizando observación:', e);
        throw e;
    }

    return obsActualizada;
};

export const actualizarObservacion = async (id, fn) => {
    return actualizarEnCache(id, fn);
};

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

export const agregarFotoHallazgo = async (obsId, hallazgoId, foto) =>
    actualizarEnCache(obsId, (o) => ({
        ...o,
        hallazgos: (o.hallazgos || []).map(h =>
            h.id === hallazgoId
                ? { ...h, fotos: [...(h.fotos || []), foto] }
                : h
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

export const puedeEditar = (obs, usuario) => {
    if (!usuario) return false;
    const esCreador = (obs.creadoPor || '').toLowerCase() === usuario.email.toLowerCase();
    const esAdmin = usuario.admin;
    return esCreador || esAdmin;
};

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
