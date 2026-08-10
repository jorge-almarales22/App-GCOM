import React, { useEffect, useState } from 'react';
import PeoplePicker, { Avatar } from './PeoplePicker';
import SubidorFotos, { GaleriaFotos } from './SubidorFotos';
import {
    agregarHallazgo,
    establecerFotosHallazgo,
    eliminarHallazgo,
    agregarComentarioAdmin,
    cambiarEstadoRealizacion,
    puedeGestionar,
    notificar,
    estadoDe,
    estaVencida
} from '../utils/storage';
import { SEVERIDADES, ADMIN_PRINCIPAL, ESTADO_REALIZACION } from '../data/constants';
import { TIPO_EVIDENCIA } from '../utils/sharepointApi';

const fmt = (iso) => new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

const COLOR_SEVERIDAD = {
    'Bajo': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'Medio': 'bg-amber-100 text-amber-800 border-amber-200',
    'Alto': 'bg-orange-100 text-orange-800 border-orange-200',
    'Crítico': 'bg-red-100 text-red-800 border-red-200'
};

// Cada estado viaja con su icono y su texto: el color nunca es el unico canal.
// "No realizada" va en ambar, no en rojo: el rojo esta reservado a los
// hallazgos, que son el riesgo real.
export const ESTILO_ESTADO = {
    [ESTADO_REALIZACION.PENDIENTE]: { chip: 'bg-blue-50 text-blue-700 border-blue-200', icono: '◷' },
    [ESTADO_REALIZACION.REALIZADA]: { chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', icono: '✓' },
    [ESTADO_REALIZACION.NO_REALIZADA]: { chip: 'bg-amber-50 text-amber-800 border-amber-300', icono: '✕' }
};

export const ChipEstado = ({ estado, className = '' }) => {
    const e = ESTILO_ESTADO[estado] || ESTILO_ESTADO[ESTADO_REALIZACION.PENDIENTE];
    return (
        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full border whitespace-nowrap ${e.chip} ${className}`}>
            <span aria-hidden="true">{e.icono}</span>{estado}
        </span>
    );
};

const Dato = ({ label, valor }) => (
    <div className="min-w-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm text-slate-800 break-words">{valor || '—'}</p>
    </div>
);

const ModalObservacion = ({ obs, usuario, onCerrar }) => {
    const [tab, setTab] = useState('detalle');
    const [gestion, setGestion] = useState(null);       // panel de cierre abierto
    const [guardando, setGuardando] = useState(false);
    const [errorGestion, setErrorGestion] = useState('');

    const [formHallazgo, setFormHallazgo] = useState(null);
    const [guardandoHallazgo, setGuardandoHallazgo] = useState(false);
    const [comentario, setComentario] = useState('');

    const gestionable = puedeGestionar(obs, usuario);
    const estado = estadoDe(obs);
    const vencida = estaVencida(obs);
    const hallazgos = obs.hallazgos || [];
    const comentarios = obs.comentariosAdmin || [];

    useEffect(() => {
        const alTecla = (e) => { if (e.key === 'Escape') onCerrar(); };
        document.addEventListener('keydown', alTecla);
        return () => document.removeEventListener('keydown', alTecla);
    }, [onCerrar]);

    // ---- cierre de la observacion -----------------------------------------
    const abrirGestion = () => {
        setErrorGestion('');
        setGestion({
            estado,
            explicacionNoRealizada: obs.explicacionNoRealizada || '',
            comentarioCierre: obs.comentarioCierre || '',
            fotosAlRealizar: obs.fotosAlRealizar || []
        });
    };

    const guardarGestion = async () => {
        if (gestion.estado === ESTADO_REALIZACION.NO_REALIZADA && !gestion.explicacionNoRealizada.trim()) {
            setErrorGestion('Explica por qué no se realizó la observación.');
            return;
        }
        setGuardando(true);
        try {
            await cambiarEstadoRealizacion(obs.id, gestion);
            setGestion(null);
        } catch (e) {
            setErrorGestion(`No se pudo guardar: ${e.message}`);
        } finally {
            setGuardando(false);
        }
    };

    // ---- hallazgos ---------------------------------------------------------
    const nuevoFormHallazgo = () => setFormHallazgo({
        descripcion: '', severidad: 'Medio', responsables: [], fotos: [],
        enIsometrix: false, numeroIsometrix: '', error: ''
    });

    const guardarHallazgo = async (e) => {
        e.preventDefault();
        if (!formHallazgo.descripcion.trim()) {
            setFormHallazgo(f => ({ ...f, error: 'Describe qué se encontró.' }));
            return;
        }
        // El numero es lo unico que permite rastrear el hallazgo en Isometrix:
        // marcar que se subio sin el numero deja el registro sin trazabilidad.
        if (formHallazgo.enIsometrix && !formHallazgo.numeroIsometrix.trim()) {
            setFormHallazgo(f => ({ ...f, error: 'Escribe el número del hallazgo en Isometrix.' }));
            return;
        }
        setGuardandoHallazgo(true);
        try {
            await agregarHallazgo(obs.id, {
                descripcion: formHallazgo.descripcion.trim(),
                severidad: formHallazgo.severidad,
                responsables: formHallazgo.responsables,
                fotos: formHallazgo.fotos,
                enIsometrix: formHallazgo.enIsometrix,
                numeroIsometrix: formHallazgo.enIsometrix ? formHallazgo.numeroIsometrix.trim() : '',
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

    // La galeria de un hallazgo ya guardado se persiste al vuelo. Si SharePoint
    // falla, el almacen ya revirtio el cambio: aqui solo hay que avisar.
    const guardarFotosHallazgo = (hallazgoId, fotos) => {
        establecerFotosHallazgo(obs.id, hallazgoId, fotos)
            .catch(e => alert(`No se pudieron guardar las evidencias: ${e.message}`));
    };

    // ---- comentarios de gerencia ------------------------------------------
    const guardarComentario = async (e) => {
        e.preventDefault();
        if (!comentario.trim()) return;
        const texto = comentario.trim();
        setComentario('');
        try {
            await agregarComentarioAdmin(obs.id, { texto, autor: usuario.email, autorNombre: usuario.nombre });
            notificar({
                paraEmail: obs.creadoPor,
                titulo: `${ADMIN_PRINCIPAL.nombre}, ${ADMIN_PRINCIPAL.cargo}, comentó tu observación`,
                mensaje: `"${texto}" — sobre la observación de ${obs.tarea}.`,
                obsId: obs.id
            });
        } catch (e) {
            setComentario(texto);
            alert(`No se pudo guardar el comentario: ${e.message}`);
        }
    };

    const TABS = [
        { id: 'detalle', label: 'Detalle' },
        { id: 'hallazgos', label: 'Hallazgos', cuenta: hallazgos.length },
        { id: 'gerencia', label: 'Gerencia', cuenta: comentarios.length }
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
                {/* ---- Encabezado ---- */}
                <div className="px-4 sm:px-6 pt-4 pb-3 border-b border-slate-100">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                                <ChipEstado estado={estado} />
                                {vencida && (
                                    <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                        Fuera de hora
                                    </span>
                                )}
                                {hallazgos.length > 0 && (
                                    <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
                                        ⚠ {hallazgos.length} hallazgo{hallazgos.length === 1 ? '' : 's'}
                                    </span>
                                )}
                            </div>
                            <h3 className="font-bold text-slate-900 text-base sm:text-lg leading-tight break-words">
                                {obs.tarea}
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                {obs.fecha} · {obs.hora} · Turno {obs.turno} · {obs.area}
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

                    <nav className="flex gap-1 mt-4 -mb-3 overflow-x-auto">
                        {TABS.map(t => (
                            <button
                                key={t.id}
                                onClick={() => setTab(t.id)}
                                className={`px-3 py-2 text-sm font-semibold whitespace-nowrap border-b-2 transition cursor-pointer ${
                                    tab === t.id
                                        ? 'border-yellow-400 text-slate-900'
                                        : 'border-transparent text-slate-400 hover:text-slate-700'
                                }`}
                            >
                                {t.label}
                                {t.cuenta > 0 && (
                                    <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                        {t.cuenta}
                                    </span>
                                )}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* ---- Contenido ---- */}
                <div className="px-4 sm:px-6 py-5 space-y-6 overflow-y-auto flex-1">
                    {tab === 'detalle' && (
                        <>
                            {/* Tarjeta de estado: es lo primero que hay que resolver. */}
                            <section className="rounded-xl border border-slate-200 overflow-hidden">
                                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-50">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                                            Estado de la observación
                                        </p>
                                        <p className="text-sm font-semibold text-slate-800 mt-0.5">
                                            {estado}
                                            {vencida && <span className="text-amber-700 font-normal"> · ya pasó la hora programada</span>}
                                        </p>
                                    </div>
                                    {gestionable && !gestion && (
                                        <button
                                            onClick={abrirGestion}
                                            className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                                        >
                                            {estado === ESTADO_REALIZACION.PENDIENTE ? 'Registrar resultado' : 'Cambiar estado'}
                                        </button>
                                    )}
                                </div>

                                {gestion ? (
                                    <div className="p-4 space-y-4 border-t border-slate-200">
                                        <div>
                                            <p className="text-xs font-semibold text-slate-700 mb-2">¿Qué pasó con la observación?</p>
                                            <div className="grid sm:grid-cols-3 gap-2">
                                                {[ESTADO_REALIZACION.PENDIENTE, ESTADO_REALIZACION.REALIZADA, ESTADO_REALIZACION.NO_REALIZADA].map(op => (
                                                    <button
                                                        key={op}
                                                        type="button"
                                                        onClick={() => setGestion(g => ({ ...g, estado: op }))}
                                                        aria-pressed={gestion.estado === op}
                                                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-semibold transition cursor-pointer ${
                                                            gestion.estado === op
                                                                ? 'border-slate-900 bg-slate-900 text-white'
                                                                : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
                                                        }`}
                                                    >
                                                        <span aria-hidden="true">{ESTILO_ESTADO[op].icono}</span>
                                                        {op === ESTADO_REALIZACION.PENDIENTE ? 'Sigue pendiente' : op}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {gestion.estado === ESTADO_REALIZACION.NO_REALIZADA && (
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                                    ¿Por qué no se realizó? <span className="text-red-500">*</span>
                                                </label>
                                                <textarea
                                                    rows={3}
                                                    autoFocus
                                                    value={gestion.explicacionNoRealizada}
                                                    onChange={(e) => setGestion(g => ({ ...g, explicacionNoRealizada: e.target.value }))}
                                                    placeholder="Ej. El equipo estuvo fuera de servicio durante todo el turno."
                                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200"
                                                />
                                            </div>
                                        )}

                                        {gestion.estado === ESTADO_REALIZACION.REALIZADA && (
                                            <>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                                        Comentario de cierre <span className="text-slate-400 font-normal">(opcional)</span>
                                                    </label>
                                                    <textarea
                                                        rows={3}
                                                        value={gestion.comentarioCierre}
                                                        onChange={(e) => setGestion(g => ({ ...g, comentarioCierre: e.target.value }))}
                                                        placeholder="Ej. La tarea se ejecutó con el procedimiento al día; se reforzó el uso del arnés."
                                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200"
                                                    />
                                                </div>

                                                <div>
                                                    <p className="text-xs font-semibold text-slate-700 mb-2">
                                                        Evidencias de la observación <span className="text-slate-400 font-normal">(opcional)</span>
                                                    </p>
                                                    <SubidorFotos
                                                        fotos={gestion.fotosAlRealizar}
                                                        onChange={(fotos) => setGestion(g => ({ ...g, fotosAlRealizar: fotos }))}
                                                        usuario={usuario}
                                                        tipo={TIPO_EVIDENCIA.OBSERVACION}
                                                    />
                                                </div>
                                            </>
                                        )}

                                        {errorGestion && (
                                            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                                {errorGestion}
                                            </p>
                                        )}

                                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                                            <button
                                                onClick={() => { setGestion(null); setErrorGestion(''); }}
                                                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                onClick={guardarGestion}
                                                disabled={guardando}
                                                className="px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-slate-900 text-sm font-bold cursor-pointer disabled:opacity-60"
                                            >
                                                {guardando ? 'Guardando...' : 'Guardar estado'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {estado === ESTADO_REALIZACION.NO_REALIZADA && obs.explicacionNoRealizada && (
                                            <div className="px-4 py-3 border-t border-slate-200">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                                                    Motivo
                                                </p>
                                                <p className="text-sm text-slate-800">{obs.explicacionNoRealizada}</p>
                                            </div>
                                        )}
                                        {estado === ESTADO_REALIZACION.REALIZADA && obs.comentarioCierre && (
                                            <div className="px-4 py-3 border-t border-slate-200">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                                                    Comentario de cierre
                                                </p>
                                                <p className="text-sm text-slate-800">{obs.comentarioCierre}</p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </section>

                            <section className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                <Dato label="PPF" valor={obs.ppf} />
                                <Dato label="Área" valor={obs.area} />
                                <Dato label="Rutinario" valor={obs.rutinario} />
                                <Dato label="Turno" valor={obs.turno} />
                                <Dato label="Hallazgos" valor={obs.estado} />
                                <Dato label="Programada por" valor={obs.creadoPorNombre} />
                            </section>

                            <section>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Observador</p>
                                {obs.observador ? (
                                    <div className="flex items-center gap-3">
                                        <Avatar persona={obs.observador} />
                                        <div className="leading-tight min-w-0">
                                            <p className="text-sm font-semibold text-slate-800 truncate">{obs.observador.nombre}</p>
                                            <p className="text-xs text-slate-500 truncate">{obs.observador.email}</p>
                                        </div>
                                    </div>
                                ) : <p className="text-sm text-slate-400">—</p>}
                            </section>

                            {(obs.fotosAlCrear || []).length > 0 && (
                                <section>
                                    <h4 className="font-bold text-slate-900 text-sm mb-3">
                                        Fotos de referencia
                                        <span className="text-slate-400 font-normal"> ({obs.fotosAlCrear.length})</span>
                                    </h4>
                                    <GaleriaFotos fotos={obs.fotosAlCrear} />
                                </section>
                            )}

                            {(obs.fotosAlRealizar || []).length > 0 && (
                                <section>
                                    <h4 className="font-bold text-slate-900 text-sm mb-3">
                                        Evidencias de la observación
                                        <span className="text-slate-400 font-normal"> ({obs.fotosAlRealizar.length})</span>
                                    </h4>
                                    <GaleriaFotos fotos={obs.fotosAlRealizar} />
                                </section>
                            )}
                        </>
                    )}

                    {/* ---- Hallazgos ---- */}
                    {tab === 'hallazgos' && (
                        <section>
                            <div className="flex items-center justify-between gap-3 mb-4">
                                <div>
                                    <h4 className="font-bold text-slate-900">Hallazgos</h4>
                                    <p className="text-xs text-slate-500">
                                        Lo que se encontró durante la observación, con sus responsables y fotos.
                                    </p>
                                </div>
                                {gestionable && !formHallazgo && (
                                    <button
                                        onClick={nuevoFormHallazgo}
                                        className="shrink-0 px-3.5 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-slate-900 text-xs font-bold cursor-pointer"
                                    >
                                        + Nuevo hallazgo
                                    </button>
                                )}
                            </div>

                            {!gestionable && (
                                <p className="text-xs text-slate-400 mb-3">
                                    Solo {obs.creadoPorNombre} puede registrar hallazgos en esta observación.
                                </p>
                            )}

                            {formHallazgo && (
                                <form onSubmit={guardarHallazgo} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4 mb-5">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                            ¿Qué se encontró? <span className="text-red-500">*</span>
                                        </label>
                                        <textarea
                                            rows={3}
                                            autoFocus
                                            value={formHallazgo.descripcion}
                                            onChange={(e) => setFormHallazgo(f => ({ ...f, descripcion: e.target.value, error: '' }))}
                                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200"
                                            placeholder="Describe la condición o el comportamiento observado..."
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Severidad</label>
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
                                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                            Responsables del hallazgo
                                        </label>
                                        <PeoplePicker
                                            multiple
                                            permitirManual
                                            value={formHallazgo.responsables}
                                            onChange={(r) => setFormHallazgo(f => ({ ...f, responsables: r }))}
                                            placeholder="Busca personas en el directorio..."
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                            Evidencias fotográficas <span className="text-slate-400 font-normal">(opcional)</span>
                                        </label>
                                        <SubidorFotos
                                            fotos={formHallazgo.fotos}
                                            onChange={(fotos) => setFormHallazgo(f => ({ ...f, fotos }))}
                                            usuario={usuario}
                                            tipo={TIPO_EVIDENCIA.HALLAZGO}
                                            ayuda="Se guardan en la carpeta de evidencias identificadas como hallazgo."
                                        />
                                    </div>

                                    {/* Enlace con Isometrix: sin el numero no hay como hacerle
                                        seguimiento al hallazgo en el sistema de salud y seguridad. */}
                                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                                        <label className="flex items-start gap-2.5 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formHallazgo.enIsometrix}
                                                onChange={(e) => setFormHallazgo(f => ({
                                                    ...f,
                                                    enIsometrix: e.target.checked,
                                                    numeroIsometrix: e.target.checked ? f.numeroIsometrix : '',
                                                    error: ''
                                                }))}
                                                className="mt-0.5 w-4 h-4 accent-yellow-500 cursor-pointer"
                                            />
                                            <span>
                                                <span className="block text-xs font-semibold text-slate-700">
                                                    ¿Este hallazgo ya se subió a Isometrix?
                                                </span>
                                                <span className="block text-[11px] text-slate-500 mt-0.5">
                                                    Isometrix es donde se carga la información de salud y seguridad de la mina.
                                                </span>
                                            </span>
                                        </label>

                                        {formHallazgo.enIsometrix && (
                                            <div className="mt-3 pl-7">
                                                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                                    Número del hallazgo en Isometrix <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    autoFocus
                                                    value={formHallazgo.numeroIsometrix}
                                                    onChange={(e) => setFormHallazgo(f => ({ ...f, numeroIsometrix: e.target.value, error: '' }))}
                                                    placeholder="Pega o escribe el número, ej. HZ-2026-01843"
                                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200"
                                                />
                                                <p className="text-[11px] text-slate-400 mt-1">
                                                    Con este número se le hace seguimiento al hallazgo en Isometrix.
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {formHallazgo.error && (
                                        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                            {formHallazgo.error}
                                        </p>
                                    )}

                                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setFormHallazgo(null)}
                                            className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-200 cursor-pointer"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={guardandoHallazgo}
                                            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold cursor-pointer disabled:opacity-60"
                                        >
                                            {guardandoHallazgo ? 'Guardando...' : 'Guardar hallazgo'}
                                        </button>
                                    </div>
                                </form>
                            )}

                            {hallazgos.length === 0 && !formHallazgo ? (
                                <div className="text-center border border-dashed border-slate-300 rounded-xl py-10 px-4">
                                    <p className="text-sm text-slate-500 font-semibold">Sin hallazgos registrados</p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Si la observación no arrojó desviaciones, no hay nada que registrar aquí.
                                    </p>
                                </div>
                            ) : (
                                <ul className="space-y-4">
                                    {hallazgos.map(h => (
                                        <li key={h.id} className="border border-slate-200 rounded-xl overflow-hidden">
                                            <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                                                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${COLOR_SEVERIDAD[h.severidad] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                                        Severidad {h.severidad}
                                                    </span>
                                                    {h.enIsometrix ? (
                                                        <span
                                                            className="text-[10px] font-bold px-2 py-1 rounded-full border bg-indigo-50 text-indigo-800 border-indigo-200"
                                                            title="Cargado en Isometrix"
                                                        >
                                                            Isometrix {h.numeroIsometrix || 'sin número'}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-500">
                                                            No está en Isometrix
                                                        </span>
                                                    )}
                                                </div>
                                                {gestionable && (
                                                    <button
                                                        onClick={() => borrarHallazgo(h.id)}
                                                        className="text-xs text-slate-400 hover:text-red-600 font-semibold cursor-pointer"
                                                    >
                                                        Eliminar
                                                    </button>
                                                )}
                                            </div>

                                            <div className="p-4 space-y-3">
                                                <p className="text-sm text-slate-800">{h.descripcion}</p>

                                                {(h.responsables || []).length > 0 && (
                                                    <div>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Responsables</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {h.responsables.map(p => (
                                                                <span key={p.email} className="inline-flex items-center gap-2 bg-slate-100 rounded-full pl-1 pr-3 py-1">
                                                                    <Avatar persona={p} size="w-6 h-6" />
                                                                    <span className="text-xs text-slate-700">
                                                                        {p.nombre}
                                                                        {p.manual && <span className="text-slate-400"> · manual</span>}
                                                                    </span>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                                                        Evidencias ({(h.fotos || []).length})
                                                    </p>
                                                    {gestionable ? (
                                                        <SubidorFotos
                                                            fotos={h.fotos || []}
                                                            onChange={(fotos) => guardarFotosHallazgo(h.id, fotos)}
                                                            usuario={usuario}
                                                            tipo={TIPO_EVIDENCIA.HALLAZGO}
                                                            ayuda="Se guardan identificadas como evidencia de hallazgo."
                                                        />
                                                    ) : (
                                                        (h.fotos || []).length > 0
                                                            ? <GaleriaFotos fotos={h.fotos} compacta />
                                                            : <p className="text-xs text-slate-400">Sin evidencias.</p>
                                                    )}
                                                </div>

                                                <p className="text-[10px] text-slate-400 pt-1">
                                                    Registrado por {h.registradoPorNombre} · {fmt(h.creadoEn)}
                                                </p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    )}

                    {/* ---- Comentarios de gerencia ---- */}
                    {tab === 'gerencia' && (
                        <section>
                            <h4 className="font-bold text-slate-900 mb-1">Comentarios de gerencia</h4>
                            <p className="text-xs text-slate-500 mb-4">
                                Retroalimentación de la Gerencia de Gestión de Activos sobre esta observación.
                            </p>

                            {comentarios.length > 0 ? (
                                <ul className="space-y-3 mb-4">
                                    {comentarios.map(c => (
                                        <li key={c.id} className="bg-amber-50 border-l-4 border-amber-400 rounded-r-xl p-3">
                                            <p className="text-sm text-slate-800">{c.texto}</p>
                                            <p className="text-[10px] text-slate-500 mt-1">{c.autorNombre} · {fmt(c.creadoEn)}</p>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-slate-400 mb-4">Sin comentarios de gerencia.</p>
                            )}

                            {usuario.admin && (
                                <form onSubmit={guardarComentario} className="flex flex-col sm:flex-row gap-2">
                                    <input
                                        value={comentario}
                                        onChange={(e) => setComentario(e.target.value)}
                                        placeholder="Escribe un comentario para el supervisor..."
                                        className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                                    />
                                    <button className="px-4 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-900 text-sm font-bold cursor-pointer">
                                        Comentar
                                    </button>
                                </form>
                            )}
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ModalObservacion;
