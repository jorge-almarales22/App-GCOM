import React, { useEffect, useState } from 'react';
import PeoplePicker, { Avatar } from './PeoplePicker';
import SubidorFotos, { GaleriaFotos } from './SubidorFotos';
import SelectorPPF from './SelectorPPF';
import { ChipEstado, ChipProgramacion, ChipSolicitud } from './Chips';
import { useAhora } from '../utils/useAhora';
import {
    agregarHallazgo,
    establecerFotos,
    establecerFotosHallazgo,
    eliminarHallazgo,
    agregarComentario,
    comentariosDe,
    cambiarEstadoRealizacion,
    editarObservacion,
    eliminarObservacion,
    solicitarReagendamiento,
    aceptarReagendamiento,
    rechazarReagendamiento,
    puedeGestionar,
    puedeEditar,
    puedeEliminar,
    puedeSolicitarReagendamiento,
    puedeResolverReagendamiento,
    tieneSolicitudAbierta,
    estadoDe,
    esProgramada,
    programacionDe,
    observadoresDe,
    ppfsDe,
    esRealizada,
    hoyISO,
    turnoPorHora
} from '../utils/storage';
import { SEVERIDADES, ESTADO_REALIZACION, REAGENDAMIENTO, TURNOS } from '../data/constants';
import { TIPO_EVIDENCIA } from '../utils/sharepointApi';

// ---------------------------------------------------------------------------
// Ficha de una observacion.
//
// Cada pestaña hace UNA cosa. Antes todo vivia en "Detalle" —estado, edicion,
// reagendamiento, fotos e historial apilados en la misma columna— y no habia
// forma de saber donde mirar. Ahora: Resumen (que es y en que va), Reagendar
// (la negociacion de la fecha), Hallazgos, Evidencias y Comentarios.
// ---------------------------------------------------------------------------

const fmt = (iso) => new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
const fmtFecha = (iso) => new Date(iso).toLocaleDateString('es-CO', { dateStyle: 'long' });

const COLOR_SEVERIDAD = {
    'Bajo': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'Medio': 'bg-amber-100 text-amber-800 border-amber-200',
    'Alto': 'bg-orange-100 text-orange-800 border-orange-200',
    'Crítico': 'bg-red-100 text-red-800 border-red-200'
};

const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200';

const Etiqueta = ({ children, requerido }) => (
    <span className="block text-xs font-semibold text-slate-700 mb-1.5">
        {children} {requerido && <span className="text-red-500">*</span>}
    </span>
);

const Campo = ({ label, requerido, children }) => (
    <label className="block"><Etiqueta requerido={requerido}>{label}</Etiqueta>{children}</label>
);

const Dato = ({ label, valor, ancho = '' }) => (
    <div className={`min-w-0 ${ancho}`}>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm text-slate-800 break-words mt-0.5">{valor || '—'}</p>
    </div>
);

/** Bloque con titulo: da aire y separa temas dentro de una pestaña. */
const Bloque = ({ titulo, descripcion, children, tono = 'blanco' }) => (
    <section className={`rounded-xl border p-4 ${
        tono === 'aviso' ? 'border-violet-200 bg-violet-50'
            : tono === 'riesgo' ? 'border-red-200 bg-red-50/60'
                : 'border-slate-200 bg-white'
    }`}>
        {titulo && (
            <div className="mb-3">
                <h4 className="font-bold text-slate-900 text-sm">{titulo}</h4>
                {descripcion && <p className="text-xs text-slate-500 mt-0.5">{descripcion}</p>}
            </div>
        )}
        {children}
    </section>
);

const Error = ({ children }) => children ? (
    <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{children}</p>
) : null;

const btnPrimario = 'px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-slate-900 text-sm font-bold cursor-pointer disabled:opacity-60';
const btnSecundario = 'px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold cursor-pointer disabled:opacity-60';
const btnTexto = 'px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer';

const ModalObservacion = ({ obs, usuario, onCerrar }) => {
    const [tab, setTab] = useState('resumen');
    const [modo, setModo] = useState(null);        // 'resultado' | 'editar' | 'rechazar'
    const [borrador, setBorrador] = useState(null);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');

    const [formHallazgo, setFormHallazgo] = useState(null);
    const [guardandoHallazgo, setGuardandoHallazgo] = useState(false);
    const [comentario, setComentario] = useState('');
    const ahora = useAhora();

    const gestionable = puedeGestionar(obs, usuario);
    const editable = puedeEditar(obs, usuario);
    const eliminable = puedeEliminar(obs, usuario);
    const estado = estadoDe(obs, ahora);
    const programada = esProgramada(obs);
    const hallazgos = obs.hallazgos || [];
    const comentarios = comentariosDe(obs);
    const observadores = observadoresDe(obs);
    const ppfs = ppfsDe(obs);
    const reagendamientos = obs.reagendamientos || [];
    const solicitud = obs.solicitudReagendamiento;
    const solicitudAbierta = tieneSolicitudAbierta(obs);
    const puedeProponer = puedeSolicitarReagendamiento(obs, usuario);
    const puedeResolver = puedeResolverReagendamiento(obs, usuario);

    const cerrar = () => { setModo(null); setBorrador(null); setError(''); };

    useEffect(() => {
        const alTecla = (e) => { if (e.key === 'Escape') onCerrar(); };
        document.addEventListener('keydown', alTecla);
        return () => document.removeEventListener('keydown', alTecla);
    }, [onCerrar]);

    /** Envoltura comun: apaga el panel y muestra el error si algo falla. */
    const ejecutar = async (accion, alTerminar) => {
        setGuardando(true);
        try {
            await accion();
            setError('');
            alTerminar?.();
        } catch (e) {
            setError(`No se pudo guardar: ${e.message}`);
        } finally {
            setGuardando(false);
        }
    };

    // ---- registrar resultado ----------------------------------------------
    const abrirResultado = () => {
        setError('');
        setModo('resultado');
        setBorrador({
            estado: esRealizada(obs) ? ESTADO_REALIZACION.REALIZADA : ESTADO_REALIZACION.NO_REALIZADA,
            explicacionNoRealizada: obs.explicacionNoRealizada || '',
            comentarioCierre: obs.comentarioCierre || ''
        });
    };

    const guardarResultado = () => ejecutar(
        () => cambiarEstadoRealizacion(obs.id, borrador),
        cerrar
    );

    // ---- editar los datos --------------------------------------------------
    const abrirEdicion = () => {
        setError('');
        setModo('editar');
        setBorrador({
            tarea: obs.tarea || '',
            ppfs,
            rutinario: obs.rutinario || 'Sí',
            programada,
            observadores,
            fecha: obs.fecha || hoyISO(),
            hora: obs.hora || '08:00',
            turno: obs.turno || 'Día',
            area: obs.area || ''
        });
    };

    const guardarEdicion = () => {
        if (!borrador.tarea.trim()) return setError('La tarea no puede quedar vacía.');
        if (!borrador.ppfs.length) return setError('Selecciona al menos un PPF.');
        if (!borrador.area.trim()) return setError('Indica el área de la observación.');
        if (!borrador.hora) return setError('Indica la hora de la observación.');
        if (borrador.programada && !borrador.observadores.length) {
            return setError('Asigna al menos un observador.');
        }
        return ejecutar(() => editarObservacion(obs.id, {
            tarea: borrador.tarea.trim(),
            ppfs: borrador.ppfs,
            ppf: null,
            rutinario: borrador.rutinario,
            programada: borrador.programada,
            observadores: borrador.observadores,
            fecha: borrador.fecha,
            hora: borrador.hora,
            turno: borrador.turno,
            area: borrador.area.trim()
        }, usuario), cerrar);
    };

    // ---- reagendamiento ----------------------------------------------------
    const abrirPropuesta = () => {
        setError('');
        setModo('proponer');
        setBorrador({ fecha: obs.fecha || hoyISO(), hora: obs.hora || '08:00', motivo: '' });
    };

    const enviarPropuesta = () => {
        if (!borrador.fecha || !borrador.hora) return setError('Indica la fecha y la hora que propones.');
        if (!borrador.motivo.trim()) return setError('Explica por qué no se pudo hacer en la fecha original.');
        return ejecutar(
            () => solicitarReagendamiento(obs.id, { ...borrador, motivo: borrador.motivo.trim(), usuario }),
            cerrar
        );
    };

    const aceptar = () => ejecutar(() => aceptarReagendamiento(obs.id, { respuesta: '', usuario }), cerrar);

    const rechazar = () => {
        if (!borrador.respuesta.trim()) return setError('Explica por qué no se acepta la fecha propuesta.');
        return ejecutar(
            () => rechazarReagendamiento(obs.id, { respuesta: borrador.respuesta, usuario }),
            cerrar
        );
    };

    // ---- eliminar ----------------------------------------------------------
    const borrar = async () => {
        if (!confirm(`Se eliminará "${obs.tarea}" con sus hallazgos, evidencias y comentarios.\n\nEsta acción no se puede deshacer. ¿Continuar?`)) return;
        setGuardando(true);
        try {
            await eliminarObservacion(obs.id);
            onCerrar();
        } catch (e) {
            setError(`No se pudo eliminar: ${e.message}`);
            setGuardando(false);
        }
    };

    // ---- hallazgos ---------------------------------------------------------
    const guardarHallazgo = async (e) => {
        e.preventDefault();
        if (!formHallazgo.descripcion.trim()) {
            return setFormHallazgo(f => ({ ...f, error: 'Describe qué se encontró.' }));
        }
        setGuardandoHallazgo(true);
        try {
            await agregarHallazgo(obs.id, {
                descripcion: formHallazgo.descripcion.trim(),
                severidad: formHallazgo.severidad,
                responsables: formHallazgo.responsables,
                fotos: formHallazgo.fotos,
                enIsometrix: formHallazgo.enIsometrix,
                registradoPor: usuario.email,
                registradoPorNombre: usuario.nombre
            });
            setFormHallazgo(null);
        } catch (err) {
            setFormHallazgo(f => ({ ...f, error: `No se pudo guardar: ${err.message}` }));
        } finally {
            setGuardandoHallazgo(false);
        }
    };

    const borrarHallazgo = async (hid) => {
        if (!confirm('¿Eliminar este hallazgo?')) return;
        try {
            await eliminarHallazgo(obs.id, hid);
        } catch (e) {
            alert(`No se pudo eliminar el hallazgo: ${e.message}`);
        }
    };

    // Las galerias se persisten al vuelo. Si SharePoint falla, el almacen ya
    // revirtio el cambio: aqui solo hay que avisar.
    const guardarFotos = (campo, fotos) =>
        establecerFotos(obs.id, campo, fotos).catch(e => alert(`No se pudieron guardar las fotos: ${e.message}`));

    const guardarFotosHallazgo = (hallazgoId, fotos) =>
        establecerFotosHallazgo(obs.id, hallazgoId, fotos).catch(e => alert(`No se pudieron guardar las evidencias: ${e.message}`));

    const guardarComentario = async (e) => {
        e.preventDefault();
        if (!comentario.trim()) return;
        const texto = comentario.trim();
        setComentario('');
        try {
            await agregarComentario(obs.id, { texto, usuario });
        } catch (err) {
            setComentario(texto);
            alert(`No se pudo guardar el comentario: ${err.message}`);
        }
    };

    const fotosReferencia = obs.fotosAlCrear || [];
    const fotosEvidencia = obs.fotosAlRealizar || [];

    const TABS = [
        { id: 'resumen', label: 'Resumen' },
        { id: 'reagendar', label: 'Reagendar', alerta: solicitudAbierta },
        { id: 'hallazgos', label: 'Hallazgos', cuenta: hallazgos.length },
        { id: 'evidencias', label: 'Evidencias', cuenta: fotosReferencia.length + fotosEvidencia.length },
        { id: 'comentarios', label: 'Comentarios', cuenta: comentarios.length }
    ];

    return (
        <div
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-[2px] flex items-end sm:items-center justify-center sm:p-4"
            onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label={`Observación: ${obs.tarea}`}
                className="bg-white w-full sm:max-w-3xl rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] sm:max-h-[88vh] flex flex-col"
            >
                {/* ---- Encabezado: qué es y en qué va ---- */}
                <div className="px-4 sm:px-6 pt-4 pb-0 border-b border-slate-100">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 mb-2">
                                <ChipEstado estado={estado} />
                                <ChipProgramacion obs={obs} />
                                <ChipSolicitud obs={obs} />
                            </div>
                            <h3 className="font-bold text-slate-900 text-base sm:text-lg leading-tight break-words">
                                {obs.tarea}
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                {programada
                                    ? `${fmtFecha(obs.fecha)} · ${obs.hora} · Turno ${obs.turno}`
                                    : `Registrada el ${fmtFecha(obs.fecha)} · ${obs.hora}`}
                                {obs.area && ` · ${obs.area}`}
                            </p>
                        </div>
                        <button
                            onClick={onCerrar}
                            className="shrink-0 w-9 h-9 grid place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 text-2xl leading-none cursor-pointer"
                            aria-label="Cerrar"
                        >
                            ×
                        </button>
                    </div>

                    <nav className="flex gap-1 mt-4 overflow-x-auto">
                        {TABS.map(t => (
                            <button
                                key={t.id}
                                onClick={() => { setTab(t.id); cerrar(); }}
                                className={`px-3 py-2 text-sm font-semibold whitespace-nowrap border-b-2 transition cursor-pointer ${
                                    tab === t.id
                                        ? 'border-yellow-400 text-slate-900'
                                        : 'border-transparent text-slate-400 hover:text-slate-700'
                                }`}
                            >
                                {t.label}
                                {t.alerta && <span className="ml-1.5 inline-block w-2 h-2 rounded-full bg-violet-500 align-middle" />}
                                {!t.alerta && t.cuenta > 0 && (
                                    <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                        {t.cuenta}
                                    </span>
                                )}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="px-4 sm:px-6 py-5 space-y-4 overflow-y-auto flex-1 bg-slate-50/60">
                    {/* ================= RESUMEN ================= */}
                    {tab === 'resumen' && modo === 'editar' && (
                        <Bloque titulo="Editar la tarea" descripcion="Corrige cualquier dato mal digitado.">
                            <div className="space-y-4">
                                <Campo label="Tarea a observar" requerido>
                                    <input className={input} value={borrador.tarea}
                                        onChange={(e) => setBorrador(b => ({ ...b, tarea: e.target.value }))} />
                                </Campo>

                                <Campo label="PPF · Protocolos de Peligros Fatales" requerido>
                                    <SelectorPPF valor={borrador.ppfs} onChange={(v) => setBorrador(b => ({ ...b, ppfs: v }))} />
                                </Campo>

                                <div className="grid sm:grid-cols-3 gap-3">
                                    <Campo label="Área" requerido>
                                        <input className={input} value={borrador.area}
                                            onChange={(e) => setBorrador(b => ({ ...b, area: e.target.value }))} />
                                    </Campo>
                                    <Campo label="Hora" requerido>
                                        <input type="time" className={input} value={borrador.hora}
                                            onChange={(e) => setBorrador(b => ({ ...b, hora: e.target.value, turno: turnoPorHora(e.target.value) }))} />
                                    </Campo>
                                    <Campo label="¿Rutinaria?" requerido>
                                        <select className={input} value={borrador.rutinario}
                                            onChange={(e) => setBorrador(b => ({ ...b, rutinario: e.target.value }))}>
                                            <option value="Sí">Sí</option>
                                            <option value="No">No</option>
                                        </select>
                                    </Campo>
                                </div>

                                <label className={`flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer ${
                                    borrador.programada ? 'border-yellow-300 bg-yellow-50/60' : 'border-slate-200 bg-slate-50'
                                }`}>
                                    <input
                                        type="checkbox"
                                        checked={borrador.programada}
                                        onChange={(e) => setBorrador(b => ({ ...b, programada: e.target.checked }))}
                                        className="w-4 h-4 mt-0.5 accent-yellow-500 cursor-pointer shrink-0"
                                    />
                                    <span>
                                        <span className="block text-xs font-semibold text-slate-800">¿Es programada?</span>
                                        <span className="block text-[11px] text-slate-500 mt-0.5">
                                            {borrador.programada
                                                ? 'Sí. Debe tener observadores y fecha.'
                                                : 'No. Queda solo como registro de la tarea.'}
                                        </span>
                                    </span>
                                </label>

                                {borrador.programada && (
                                    <>
                                        <Campo label="Observadores" requerido>
                                            <PeoplePicker
                                                multiple
                                                value={borrador.observadores}
                                                onChange={(p) => setBorrador(b => ({ ...b, observadores: p }))}
                                                placeholder="Busca por nombre o correo..."
                                            />
                                        </Campo>
                                        <div className="grid grid-cols-2 gap-3">
                                            <Campo label="Fecha" requerido>
                                                <input type="date" className={input} value={borrador.fecha}
                                                    onChange={(e) => setBorrador(b => ({ ...b, fecha: e.target.value }))} />
                                            </Campo>
                                            <Campo label="Turno">
                                                <select className={input} value={borrador.turno}
                                                    onChange={(e) => setBorrador(b => ({ ...b, turno: e.target.value }))}>
                                                    {TURNOS.map(t => <option key={t} value={t}>{t}</option>)}
                                                </select>
                                            </Campo>
                                        </div>
                                    </>
                                )}

                                <Error>{error}</Error>
                                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                                    <button onClick={cerrar} className={btnTexto}>Cancelar</button>
                                    <button onClick={guardarEdicion} disabled={guardando} className={btnPrimario}>
                                        {guardando ? 'Guardando...' : 'Guardar cambios'}
                                    </button>
                                </div>
                            </div>
                        </Bloque>
                    )}

                    {tab === 'resumen' && modo !== 'editar' && (
                        <>
                            <Bloque>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Estado</p>
                                        <p className="text-lg font-bold text-slate-900 mt-0.5">{estado}</p>
                                        {estado === ESTADO_REALIZACION.NO_REALIZADA && programada && (
                                            <p className="text-xs text-red-700 mt-0.5">Venció el plazo sin realizarse.</p>
                                        )}
                                        {estado === ESTADO_REALIZACION.POR_REALIZAR && programada && (
                                            <p className="text-xs text-slate-500 mt-0.5">Vence el {obs.fecha} a las {obs.hora}.</p>
                                        )}
                                    </div>
                                    {modo !== 'resultado' && (
                                        <div className="flex flex-wrap gap-2">
                                            {gestionable && (
                                                <button onClick={abrirResultado} className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer">
                                                    {esRealizada(obs) ? 'Cambiar estado' : 'Registrar resultado'}
                                                </button>
                                            )}
                                            {editable && (
                                                <button onClick={abrirEdicion} className="px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer">
                                                    Editar
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {modo === 'resultado' && (
                                    <div className="mt-4 pt-4 border-t border-slate-200 space-y-4">
                                        <div className="grid sm:grid-cols-2 gap-2">
                                            {[ESTADO_REALIZACION.REALIZADA, ESTADO_REALIZACION.NO_REALIZADA].map(op => (
                                                <button
                                                    key={op}
                                                    type="button"
                                                    onClick={() => setBorrador(b => ({ ...b, estado: op }))}
                                                    aria-pressed={borrador.estado === op}
                                                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-semibold transition cursor-pointer ${
                                                        borrador.estado === op
                                                            ? 'border-slate-900 bg-slate-900 text-white'
                                                            : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
                                                    }`}
                                                >
                                                    <span aria-hidden="true">{op === ESTADO_REALIZACION.REALIZADA ? '✓' : '✕'}</span>
                                                    {op === ESTADO_REALIZACION.REALIZADA ? 'Sí, se realizó' : 'No se realizó'}
                                                </button>
                                            ))}
                                        </div>

                                        {borrador.estado === ESTADO_REALIZACION.REALIZADA ? (
                                            <Campo label="Comentario de cierre (opcional)">
                                                <textarea rows={3} className={input} value={borrador.comentarioCierre}
                                                    onChange={(e) => setBorrador(b => ({ ...b, comentarioCierre: e.target.value }))}
                                                    placeholder="Ej. Se ejecutó con el procedimiento al día." />
                                            </Campo>
                                        ) : (
                                            <Campo label="¿Por qué no se realizó? (opcional)">
                                                <textarea rows={3} className={input} value={borrador.explicacionNoRealizada}
                                                    onChange={(e) => setBorrador(b => ({ ...b, explicacionNoRealizada: e.target.value }))}
                                                    placeholder="Ej. El equipo estuvo fuera de servicio." />
                                            </Campo>
                                        )}

                                        <p className="text-[11px] text-slate-400">
                                            Las fotos van en la pestaña <strong>Evidencias</strong>.
                                        </p>

                                        <Error>{error}</Error>
                                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                                            <button onClick={cerrar} className={btnTexto}>Cancelar</button>
                                            <button onClick={guardarResultado} disabled={guardando} className={btnPrimario}>
                                                {guardando ? 'Guardando...' : 'Guardar estado'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {modo !== 'resultado' && esRealizada(obs) && obs.comentarioCierre && (
                                    <div className="mt-3 pt-3 border-t border-slate-100">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Comentario de cierre</p>
                                        <p className="text-sm text-slate-800">{obs.comentarioCierre}</p>
                                    </div>
                                )}
                                {modo !== 'resultado' && !esRealizada(obs) && obs.explicacionNoRealizada && (
                                    <div className="mt-3 pt-3 border-t border-slate-100">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Motivo</p>
                                        <p className="text-sm text-slate-800">{obs.explicacionNoRealizada}</p>
                                    </div>
                                )}
                            </Bloque>

                            <Bloque titulo="Datos de la tarea">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    <Dato label="Área" valor={obs.area} />
                                    <Dato label="Hora" valor={obs.hora} />
                                    <Dato label="Rutinaria" valor={obs.rutinario} />
                                    <Dato label="Tipo" valor={programacionDe(obs)} />
                                    {programada && <Dato label="Turno" valor={obs.turno} />}
                                    <Dato label="Hallazgos" valor={obs.estado} />
                                </div>
                                <div className="mt-4 pt-4 border-t border-slate-100">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                                        PPF · Protocolos de Peligros Fatales
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {ppfs.length ? ppfs.map(p => (
                                            <span key={p} className="text-[11px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                                {p}
                                            </span>
                                        )) : <span className="text-sm text-slate-400">—</span>}
                                    </div>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-4 pt-3 border-t border-slate-100">
                                    Creada el {fmt(obs.creadoEn)} por {obs.creadoPorNombre}
                                    {obs.editadoEn && ` · Editada por ${obs.editadoPorNombre} el ${fmt(obs.editadoEn)}`}
                                </p>
                            </Bloque>

                            <Bloque titulo={`Observadores${observadores.length > 1 ? ` (${observadores.length})` : ''}`}>
                                {observadores.length ? (
                                    <ul className="space-y-2">
                                        {observadores.map(p => (
                                            <li key={p.email} className="flex items-center gap-3">
                                                <Avatar persona={p} />
                                                <div className="leading-tight min-w-0">
                                                    <p className="text-sm font-semibold text-slate-800 truncate">{p.nombre}</p>
                                                    <p className="text-xs text-slate-500 truncate">{p.email}</p>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-slate-400">Sin observadores asignados.</p>
                                )}
                            </Bloque>

                            {eliminable && (
                                <Bloque tono="riesgo">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-red-900">Eliminar esta observación</p>
                                            <p className="text-[11px] text-red-800/80 mt-0.5">
                                                Borra el registro con sus hallazgos, evidencias y comentarios. No se puede deshacer.
                                            </p>
                                        </div>
                                        <button
                                            onClick={borrar}
                                            disabled={guardando}
                                            className="shrink-0 px-3.5 py-2 rounded-lg border border-red-300 bg-white text-red-700 hover:bg-red-600 hover:text-white hover:border-red-600 text-xs font-bold cursor-pointer disabled:opacity-60 transition"
                                        >
                                            Eliminar
                                        </button>
                                    </div>
                                    {error && !modo && <div className="mt-3"><Error>{error}</Error></div>}
                                </Bloque>
                            )}
                        </>
                    )}

                    {/* ================= REAGENDAR ================= */}
                    {tab === 'reagendar' && (
                        <>
                            {!programada && (
                                <Bloque>
                                    <p className="text-sm text-slate-500">
                                        Esta tarea no está programada: no hay fecha que mover.
                                    </p>
                                </Bloque>
                            )}

                            {programada && solicitudAbierta && (
                                <Bloque tono="aviso" titulo="Fecha propuesta" descripcion={`La propuso ${solicitud.solicitadoPorNombre} el ${fmt(solicitud.creadoEn)}.`}>
                                    <div className="flex flex-wrap items-center gap-4 bg-white rounded-lg border border-violet-200 px-4 py-3">
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Fecha actual</p>
                                            <p className="text-sm text-slate-500 line-through">{obs.fecha} · {obs.hora}</p>
                                        </div>
                                        <span className="text-violet-500 font-bold" aria-hidden="true">→</span>
                                        <div>
                                            <p className="text-[10px] font-bold text-violet-700 uppercase tracking-wide">Propuesta</p>
                                            <p className="text-base font-bold text-slate-900">
                                                {solicitud.fechaPropuesta} · {solicitud.horaPropuesta}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-3">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Motivo</p>
                                        <p className="text-sm text-slate-800">{solicitud.motivo}</p>
                                    </div>

                                    {puedeResolver ? (
                                        modo === 'rechazar' ? (
                                            <div className="mt-4 pt-4 border-t border-violet-200 space-y-3">
                                                <Campo label="¿Por qué no se acepta esta fecha?" requerido>
                                                    <textarea rows={3} autoFocus className={input} value={borrador.respuesta}
                                                        onChange={(e) => setBorrador(b => ({ ...b, respuesta: e.target.value }))}
                                                        placeholder="Ej. Ese día el equipo está en mantenimiento; propón otra fecha." />
                                                </Campo>
                                                <Error>{error}</Error>
                                                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                                                    <button onClick={cerrar} className={btnTexto}>Cancelar</button>
                                                    <button onClick={rechazar} disabled={guardando}
                                                        className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold cursor-pointer disabled:opacity-60">
                                                        {guardando ? 'Enviando...' : 'Rechazar propuesta'}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="mt-4 pt-4 border-t border-violet-200">
                                                <p className="text-xs text-slate-600 mb-2">
                                                    Como jefe de área, decides sobre la fecha que se propone.
                                                </p>
                                                <Error>{error}</Error>
                                                <div className="flex flex-col-reverse sm:flex-row gap-2 mt-2">
                                                    <button
                                                        onClick={() => { setError(''); setModo('rechazar'); setBorrador({ respuesta: '' }); }}
                                                        className={btnSecundario}
                                                    >
                                                        Rechazar
                                                    </button>
                                                    <button onClick={aceptar} disabled={guardando}
                                                        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold cursor-pointer disabled:opacity-60">
                                                        {guardando ? 'Aplicando...' : `Aceptar para el ${solicitud.fechaPropuesta}`}
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    ) : (
                                        <p className="text-[11px] text-violet-700 mt-3">
                                            Esperando la decisión de un jefe de área.
                                        </p>
                                    )}
                                </Bloque>
                            )}

                            {programada && !solicitudAbierta && solicitud && (
                                <Bloque titulo="Última solicitud">
                                    <p className="text-sm text-slate-800">
                                        <span className={`font-bold ${solicitud.estado === REAGENDAMIENTO.ACEPTADO ? 'text-emerald-700' : 'text-red-700'}`}>
                                            {solicitud.estado}
                                        </span>
                                        {' · '}fecha propuesta {solicitud.fechaPropuesta} · {solicitud.horaPropuesta}
                                    </p>
                                    {solicitud.respuesta && <p className="text-sm text-slate-700 mt-1">"{solicitud.respuesta}"</p>}
                                    <p className="text-[11px] text-slate-400 mt-1">
                                        {solicitud.resueltoPorNombre} · {solicitud.resueltoEn && fmt(solicitud.resueltoEn)}
                                    </p>
                                </Bloque>
                            )}

                            {programada && !solicitudAbierta && (
                                puedeProponer ? (
                                    modo === 'proponer' ? (
                                        <Bloque titulo="Proponer una fecha nueva" descripcion="Tú eliges cuándo sí puedes hacerla; el jefe de área acepta o rechaza.">
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <Campo label="Nueva fecha" requerido>
                                                        <input type="date" className={input} value={borrador.fecha}
                                                            onChange={(e) => setBorrador(b => ({ ...b, fecha: e.target.value }))} />
                                                    </Campo>
                                                    <Campo label="Nueva hora" requerido>
                                                        <input type="time" className={input} value={borrador.hora}
                                                            onChange={(e) => setBorrador(b => ({ ...b, hora: e.target.value }))} />
                                                    </Campo>
                                                </div>
                                                <Campo label="¿Por qué no se pudo hacer en la fecha original?" requerido>
                                                    <textarea rows={3} className={input} value={borrador.motivo}
                                                        onChange={(e) => setBorrador(b => ({ ...b, motivo: e.target.value }))}
                                                        placeholder="Ej. El equipo salió a mantenimiento correctivo y no estuvo disponible." />
                                                </Campo>
                                                <Error>{error}</Error>
                                                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                                                    <button onClick={cerrar} className={btnTexto}>Cancelar</button>
                                                    <button onClick={enviarPropuesta} disabled={guardando}
                                                        className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold cursor-pointer disabled:opacity-60">
                                                        {guardando ? 'Enviando...' : 'Enviar propuesta'}
                                                    </button>
                                                </div>
                                            </div>
                                        </Bloque>
                                    ) : (
                                        <Bloque titulo="¿No se pudo hacer?" descripcion="Propón la fecha en la que sí podrás realizarla.">
                                            <button onClick={abrirPropuesta}
                                                className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold cursor-pointer">
                                                Proponer nueva fecha
                                            </button>
                                        </Bloque>
                                    )
                                ) : (
                                    <Bloque>
                                        <p className="text-sm text-slate-500">
                                            {esRealizada(obs)
                                                ? 'La observación ya se realizó: no hay nada que reagendar.'
                                                : 'No hay reagendamientos pendientes.'}
                                        </p>
                                    </Bloque>
                                )
                            )}

                            {reagendamientos.length > 0 && (
                                <Bloque titulo={`Historial de reagendamientos (${reagendamientos.length})`}>
                                    <ul className="space-y-2">
                                        {reagendamientos.map(r => (
                                            <li key={r.id} className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                                                <span className="font-semibold text-slate-800">{r.de}</span> → <span className="font-semibold text-slate-800">{r.a}</span>
                                                {r.motivo && <span className="block text-slate-500 mt-0.5">Motivo: {r.motivo}</span>}
                                                {r.nota && <span className="block text-slate-500 mt-0.5">{r.nota}</span>}
                                                <span className="block text-[10px] text-slate-400 mt-0.5">
                                                    {r.pedidoPorNombre ? `Pedido por ${r.pedidoPorNombre} · ` : ''}
                                                    Aceptado por {r.porNombre} · {fmt(r.creadoEn)}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </Bloque>
                            )}
                        </>
                    )}

                    {/* ================= HALLAZGOS ================= */}
                    {tab === 'hallazgos' && (
                        <>
                            <Bloque>
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <h4 className="font-bold text-slate-900 text-sm">Hallazgos</h4>
                                        <p className="text-xs text-slate-500">Lo que se encontró durante la observación.</p>
                                    </div>
                                    {gestionable && !formHallazgo && (
                                        <button
                                            onClick={() => setFormHallazgo({ descripcion: '', severidad: 'Medio', responsables: [], fotos: [], enIsometrix: false, error: '' })}
                                            className="shrink-0 px-3.5 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-slate-900 text-xs font-bold cursor-pointer"
                                        >
                                            + Nuevo hallazgo
                                        </button>
                                    )}
                                </div>
                            </Bloque>

                            {formHallazgo && (
                                <Bloque titulo="Nuevo hallazgo">
                                    <form onSubmit={guardarHallazgo} className="space-y-4">
                                        <Campo label="¿Qué se encontró?" requerido>
                                            <textarea rows={3} autoFocus className={input} value={formHallazgo.descripcion}
                                                onChange={(e) => setFormHallazgo(f => ({ ...f, descripcion: e.target.value, error: '' }))}
                                                placeholder="Describe la condición o el comportamiento observado..." />
                                        </Campo>

                                        <div>
                                            <Etiqueta>Severidad</Etiqueta>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                {SEVERIDADES.map(s => (
                                                    <button
                                                        key={s}
                                                        type="button"
                                                        onClick={() => setFormHallazgo(f => ({ ...f, severidad: s }))}
                                                        aria-pressed={formHallazgo.severidad === s}
                                                        className={`px-3 py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
                                                            formHallazgo.severidad === s
                                                                ? 'bg-slate-900 text-white border-slate-900'
                                                                : `${COLOR_SEVERIDAD[s]} hover:brightness-95`
                                                        }`}
                                                    >
                                                        {s}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <Etiqueta>Responsables del hallazgo</Etiqueta>
                                            <PeoplePicker
                                                multiple permitirManual
                                                value={formHallazgo.responsables}
                                                onChange={(r) => setFormHallazgo(f => ({ ...f, responsables: r }))}
                                                placeholder="Busca personas en el directorio..."
                                            />
                                        </div>

                                        <div>
                                            <Etiqueta>Evidencias fotográficas <span className="text-slate-400 font-normal">(opcional)</span></Etiqueta>
                                            <SubidorFotos
                                                fotos={formHallazgo.fotos}
                                                onChange={(fotos) => setFormHallazgo(f => ({ ...f, fotos }))}
                                                usuario={usuario}
                                                tipo={TIPO_EVIDENCIA.HALLAZGO}
                                            />
                                        </div>

                                        <label className="flex items-center gap-2.5 cursor-pointer rounded-lg border border-slate-200 bg-slate-50 p-3">
                                            <input
                                                type="checkbox"
                                                checked={formHallazgo.enIsometrix}
                                                onChange={(e) => setFormHallazgo(f => ({ ...f, enIsometrix: e.target.checked }))}
                                                className="w-4 h-4 accent-yellow-500 cursor-pointer shrink-0"
                                            />
                                            <span className="text-xs font-semibold text-slate-700">¿Este hallazgo ya se subió a Isometrix?</span>
                                        </label>

                                        <Error>{formHallazgo.error}</Error>
                                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                                            <button type="button" onClick={() => setFormHallazgo(null)} className={btnTexto}>Cancelar</button>
                                            <button type="submit" disabled={guardandoHallazgo}
                                                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold cursor-pointer disabled:opacity-60">
                                                {guardandoHallazgo ? 'Guardando...' : 'Guardar hallazgo'}
                                            </button>
                                        </div>
                                    </form>
                                </Bloque>
                            )}

                            {hallazgos.length === 0 && !formHallazgo ? (
                                <div className="text-center border border-dashed border-slate-300 rounded-xl py-10 px-4 bg-white">
                                    <p className="text-sm text-slate-500 font-semibold">Sin hallazgos registrados</p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Si la observación no arrojó desviaciones, no hay nada que registrar aquí.
                                    </p>
                                </div>
                            ) : (
                                hallazgos.map(h => (
                                    <Bloque key={h.id}>
                                        <div className="flex items-center justify-between gap-3 mb-3">
                                            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                                                <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${COLOR_SEVERIDAD[h.severidad] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                                    Severidad {h.severidad}
                                                </span>
                                                {h.enIsometrix ? (
                                                    <span className="text-[10px] font-bold px-2 py-1 rounded-full border bg-indigo-50 text-indigo-800 border-indigo-200">
                                                        Cargado en Isometrix
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-500">
                                                        No está en Isometrix
                                                    </span>
                                                )}
                                            </div>
                                            {gestionable && (
                                                <button onClick={() => borrarHallazgo(h.id)}
                                                    className="text-xs text-slate-400 hover:text-red-600 font-semibold cursor-pointer">
                                                    Eliminar
                                                </button>
                                            )}
                                        </div>

                                        <p className="text-sm text-slate-800">{h.descripcion}</p>

                                        {(h.responsables || []).length > 0 && (
                                            <div className="mt-3">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Responsables</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {h.responsables.map(p => (
                                                        <span key={p.email} className="inline-flex items-center gap-2 bg-slate-100 rounded-full pl-1 pr-3 py-1">
                                                            <Avatar persona={p} size="w-6 h-6" />
                                                            <span className="text-xs text-slate-700">
                                                                {p.nombre}{p.manual && <span className="text-slate-400"> · manual</span>}
                                                            </span>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="mt-3">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                                                Evidencias ({(h.fotos || []).length})
                                            </p>
                                            {gestionable ? (
                                                <SubidorFotos
                                                    fotos={h.fotos || []}
                                                    onChange={(fotos) => guardarFotosHallazgo(h.id, fotos)}
                                                    usuario={usuario}
                                                    tipo={TIPO_EVIDENCIA.HALLAZGO}
                                                />
                                            ) : (
                                                (h.fotos || []).length > 0
                                                    ? <GaleriaFotos fotos={h.fotos} compacta />
                                                    : <p className="text-xs text-slate-400">Sin evidencias.</p>
                                            )}
                                        </div>

                                        <p className="text-[10px] text-slate-400 mt-3 pt-2 border-t border-slate-100">
                                            Registrado por {h.registradoPorNombre} · {fmt(h.creadoEn)}
                                        </p>
                                    </Bloque>
                                ))
                            )}
                        </>
                    )}

                    {/* ================= EVIDENCIAS ================= */}
                    {tab === 'evidencias' && (
                        <>
                            <Bloque
                                titulo="Fotos de referencia"
                                descripcion="Sirven para identificar el equipo o el área antes de observar."
                            >
                                {gestionable ? (
                                    <SubidorFotos
                                        fotos={fotosReferencia}
                                        onChange={(fotos) => guardarFotos('fotosAlCrear', fotos)}
                                        usuario={usuario}
                                        tipo={TIPO_EVIDENCIA.OBSERVACION}
                                    />
                                ) : fotosReferencia.length > 0 ? (
                                    <GaleriaFotos fotos={fotosReferencia} />
                                ) : <p className="text-sm text-slate-400">Sin fotos de referencia.</p>}
                            </Bloque>

                            <Bloque
                                titulo="Evidencias de la observación"
                                descripcion="Lo que se registró durante o después de observar."
                            >
                                {gestionable ? (
                                    <SubidorFotos
                                        fotos={fotosEvidencia}
                                        onChange={(fotos) => guardarFotos('fotosAlRealizar', fotos)}
                                        usuario={usuario}
                                        tipo={TIPO_EVIDENCIA.OBSERVACION}
                                    />
                                ) : fotosEvidencia.length > 0 ? (
                                    <GaleriaFotos fotos={fotosEvidencia} />
                                ) : <p className="text-sm text-slate-400">Sin evidencias.</p>}
                            </Bloque>
                        </>
                    )}

                    {/* ================= COMENTARIOS ================= */}
                    {tab === 'comentarios' && (
                        <Bloque
                            titulo="Comentarios adicionales"
                            descripcion="Historial entre quien observa y el jefe de área."
                        >
                            {comentarios.length > 0 ? (
                                <ul className="space-y-3 mb-4">
                                    {comentarios.map(c => {
                                        const esAdminMsg = c.rol === 'admin';
                                        const tono = c.tipo === 'solicitud' ? 'bg-violet-50 border-violet-400'
                                            : c.tipo === 'reagendamiento' ? 'bg-emerald-50 border-emerald-400'
                                                : c.tipo === 'rechazo' ? 'bg-red-50 border-red-400'
                                                    : esAdminMsg ? 'bg-amber-50 border-amber-400' : 'bg-slate-50 border-slate-300';
                                        const titulo = c.tipo === 'solicitud' ? 'Solicitud de reagendamiento'
                                            : c.tipo === 'reagendamiento' ? 'Reagendamiento aceptado'
                                                : c.tipo === 'rechazo' ? 'Reagendamiento rechazado' : null;
                                        return (
                                            <li key={c.id} className={`rounded-xl p-3 border-l-4 ${tono}`}>
                                                {titulo && (
                                                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">{titulo}</p>
                                                )}
                                                <p className="text-sm text-slate-800">{c.texto}</p>
                                                <p className="text-[10px] text-slate-500 mt-1">
                                                    {c.autorNombre}
                                                    {esAdminMsg && <span className="text-amber-700 font-semibold"> · jefe de área</span>}
                                                    {' · '}{fmt(c.creadoEn)}
                                                </p>
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : (
                                <p className="text-sm text-slate-400 mb-4">Todavía no hay comentarios.</p>
                            )}

                            <form onSubmit={guardarComentario} className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-slate-100">
                                <input
                                    value={comentario}
                                    onChange={(e) => setComentario(e.target.value)}
                                    placeholder={usuario.admin ? 'Pregunta por qué no se hizo...' : 'Responde o agrega contexto...'}
                                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                                />
                                <button className="px-4 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-900 text-sm font-bold cursor-pointer">
                                    Comentar
                                </button>
                            </form>
                        </Bloque>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ModalObservacion;
