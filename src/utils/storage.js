// ---------------------------------------------------------------------------
// Persistencia temporal en localStorage.
//
// Toda la app pasa por este archivo: ningun componente toca localStorage
// directamente. Cuando existan las listas de SharePoint que haran de BD, solo
// hay que reimplementar estas funciones contra saveToSPList/updateSPListItem y
// el resto de la app no cambia.
// ---------------------------------------------------------------------------
import { ESTADOS } from '../data/constants';

const KEY_OBSERVACIONES = 'gcom_observaciones';
const KEY_NOTIFICACIONES = 'gcom_notificaciones';

const leer = (key) => {
    try {
        return JSON.parse(localStorage.getItem(key)) || [];
    } catch {
        return [];
    }
};

const escribir = (key, data) => localStorage.setItem(key, JSON.stringify(data));

const nuevoId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// Fecha local en formato YYYY-MM-DD. No se usa toISOString porque convierte a
// UTC y en Colombia (UTC-5) las observaciones de la tarde saltarian al dia
// siguiente, sacandolas de la tabla de "hoy".
export const hoyISO = (d = new Date()) => {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// ---------------------------------------------------------------------------
// Observaciones
// ---------------------------------------------------------------------------
export const getObservaciones = () => leer(KEY_OBSERVACIONES);

export const crearObservacion = (datos, usuario) => {
    const obs = {
        id: nuevoId(),
        ...datos,
        estado: ESTADOS.SIN_HALLAZGOS,
        hallazgos: [],
        comentariosAdmin: [],
        creadoPor: usuario.email,
        creadoPorNombre: usuario.nombre,
        creadoEn: new Date().toISOString()
    };
    escribir(KEY_OBSERVACIONES, [obs, ...getObservaciones()]);
    return obs;
};

const actualizar = (id, fn) => {
    const todas = getObservaciones().map(o => (o.id === id ? fn(o) : o));
    escribir(KEY_OBSERVACIONES, todas);
    return todas.find(o => o.id === id);
};

export const agregarHallazgo = (obsId, hallazgo) =>
    actualizar(obsId, (o) => ({
        ...o,
        // El estado lo deriva el hallazgo: en cuanto hay uno, la observacion
        // deja de estar "Sin hallazgos".
        estado: ESTADOS.CON_HALLAZGOS,
        hallazgos: [...(o.hallazgos || []), { id: nuevoId(), creadoEn: new Date().toISOString(), ...hallazgo }]
    }));

export const eliminarHallazgo = (obsId, hallazgoId) =>
    actualizar(obsId, (o) => {
        const hallazgos = (o.hallazgos || []).filter(h => h.id !== hallazgoId);
        return {
            ...o,
            hallazgos,
            estado: hallazgos.length ? ESTADOS.CON_HALLAZGOS : ESTADOS.SIN_HALLAZGOS
        };
    });

export const agregarComentarioAdmin = (obsId, comentario) =>
    actualizar(obsId, (o) => ({
        ...o,
        comentariosAdmin: [
            ...(o.comentariosAdmin || []),
            { id: nuevoId(), creadoEn: new Date().toISOString(), ...comentario }
        ]
    }));

// Solo quien creo la observacion puede gestionarla y agregarle hallazgos.
export const puedeGestionar = (obs, usuario) =>
    !!usuario && (obs.creadoPor || '').toLowerCase() === usuario.email.toLowerCase();

export const tieneComentarioAdmin = (obs) => (obs.comentariosAdmin || []).length > 0;

// ---------------------------------------------------------------------------
// Notificaciones
//
// Bandeja dentro de la app. Cuando exista el flujo de Power Automate del
// proyecto de referencia, notificar() tambien disparara el correo/Teams.
// ---------------------------------------------------------------------------
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
