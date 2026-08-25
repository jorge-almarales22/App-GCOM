import React, { useEffect, useState } from 'react';
import PeoplePicker, { Avatar } from './PeoplePicker';
import SubidorFotos, { GaleriaFotos } from './SubidorFotos';
import { ChipEstado, ChipProgramacion, ChipSolicitud } from './Chips';
import { useAhora } from '../utils/useAhora';
import {
    agregarHallazgo,
    establecerFotosHallazgo,
    eliminarHallazgo,
    agregarComentario,
    comentariosDe,
    cambiarEstadoRealizacion,
    editarObservacion,
    eliminarObservacion,
    solicitarReagendamiento,
    reagendar,
    puedeGestionar,
    puedeEditar,
    puedeReagendar,
    puedeEliminar,
    puedeSolicitarReagendamiento,
    tieneSolicitudAbierta,
    estadoDe,
    estaVencida,
    esProgramada,
    programacionDe,
    observadoresDe,
    esRealizada,
    hoyISO,
    turnoPorHora
} from '../utils/storage';
import { SEVERIDADES, ESTADO_REALIZACION, PPF, TURNOS } from '../data/constants';
import { TIPO_EVIDENCIA } from '../utils/sharepointApi';

const fmt = (iso) => new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

const COLOR_SEVERIDAD = {
    'Bajo': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'Medio': 'bg-amber-100 text-amber-800 border-amber-200',
    'Alto': 'bg-orange-100 text-orange-800 border-orange-200',
    'Crítico': 'bg-red-100 text-red-800 border-red-200'
};

const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200';

const Dato = ({ label, valor }) => (
    <div className="min-w-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm text-slate-800 break-words">{valor || '—'}</p>
    </div>
);

const Etiqueta = ({ children, requerido }) => (
    <span className="block text-xs font-semibold text-slate-700 mb-1.5">
        {children} {requerido && <span className="text-red-500">*</span>}
    </span>
);

const ModalObservacion = ({ obs, usuario, onCerrar }) => {
    const [tab, setTab] = useState('detalle');
    const [gestion, setGestion] = useState(null);       // panel de cierre abierto
    const [edicion, setEdicion] = useState(null);       // panel de correccion de datos
    const [agenda, setAgenda] = useState(null);         // panel de reagendamiento (admin)
    const [solicitud, setSolicitud] = useState(null);   // panel de solicitud (observador)
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');

    const [formHallazgo, setFormHallazgo] = useState(null);
    const [guardandoHallazgo, setGuardandoHallazgo] = useState(false);
    const [comentario, setComentario] = useState('');
    const ahora = useAhora();

    const gestionable = puedeGestionar(obs, usuario);
    const editable = puedeEditar(obs, usuario);
    const reagendable = puedeReagendar(obs, usuario);
    const eliminable = puedeEliminar(obs, usuario);
    const puedePedir = puedeSolicitarReagendamiento(obs, usuario);
    const estado = estadoDe(obs, ahora);
    const programada = esProgramada(obs);
    const vencida = estaVencida(obs, ahora);
    const hallazgos = obs.hallazgos || [];
    const comentarios = comentariosDe(obs);
    const observadores = observadoresDe(obs);
    const reagendamientos = obs.reagendamientos || [];

    const cerrarPaneles = () => {
        setGestion(null); setEdicion(null); setAgenda(null); setSolicitud(null); setError('');
    };

    useEffect(() => {
        const alTecla = (e) => { if (e.key === 'Escape') onCerrar(); };
        document.addEventListener('keydown', alTecla);
        return () => document.removeEventListener('keydown', alTecla);
    }, [onCerrar]);

    // ---- cierre de la observacion -----------------------------------------
    const abrirGestion = () => {
        cerrarPaneles();
        setGestion({
            estado,
            explicacionNoRealizada: obs.explicacionNoRealizada || '',
            comentarioCierre: obs.comentarioCierre || '',
            fotosAlRealizar: obs.fotosAlRealizar || []
        });
    };

    const guardarGestion = async () => {
        setGuardando(true);
        try {
            await cambiarEstadoRealizacion(obs.id, gestion);
            setGestion(null);
        } catch (e) {
            setError(`No se pudo guardar: ${e.message}`);
        } finally {
            setGuardando(false);
        }
    };

    // ---- correccion de los datos de la tarea -------------------------------
    const abrirEdicion = () => {
        cerrarPaneles();
        setEdicion({
            tarea: obs.tarea || '',
            ppf: obs.ppf || '',
            rutinario: obs.rutinario || 'Sí',
            programada,
            observadores,
            fecha: obs.fecha || hoyISO(),
            hora: obs.hora || '08:00',
            turno: obs.turno || 'Día',
            area: obs.area || ''
        });
    };

    const guardarEdicion = async () => {
        if (!edicion.tarea.trim()) return setError('La tarea no puede quedar vacía.');
        if (!edicion.ppf) return setError('Selecciona el PPF asociado a la tarea.');
        // Al pasar de no programada a programada hay que completar lo que le
        // faltaba: sin observador ni fecha no hay nada que cumplir.
        if (edicion.programada) {
            if (!edicion.observadores.length) return setError('Asigna al menos un observador.');
            if (!edicion.fecha || !edicion.hora) return setError('Indica la fecha y la hora de la observación.');
            if (!edicion.area.trim()) return setError('Indica el área donde se hará la observación.');
        }
        setGuardando(true);
        try {
            await editarObservacion(obs.id, {
                tarea: edicion.tarea.trim(),
                ppf: edicion.ppf,
                rutinario: edicion.rutinario,
                programada: edicion.programada,
                observadores: edicion.observadores,
                fecha: edicion.fecha,
                hora: edicion.hora,
                turno: edicion.turno,
                area: edicion.programada ? edicion.area.trim() : ''
            }, usuario);
            setEdicion(null);
            setError('');
        } catch (e) {
            setError(`No se pudo guardar: ${e.message}`);
        } finally {
            setGuardando(false);
        }
    };

    // ---- reagendamiento ----------------------------------------------------
    const abrirAgenda = () => {
        cerrarPaneles();
        setAgenda({
            fecha: obs.fecha || hoyISO(),
            hora: obs.hora || '08:00',
            turno: obs.turno || 'Día',
            observadores,
            nota: ''
        });
    };

    const guardarAgenda = async () => {
        if (!agenda.fecha || !agenda.hora) return setError('Indica la nueva fecha y hora.');
        if (!agenda.observadores.length) return setError('La observación debe quedar con al menos un observador.');
        setGuardando(true);
        try {
            await reagendar(obs.id, { ...agenda, usuario });
            setAgenda(null);
            setError('');
        } catch (e) {
            setError(`No se pudo reagendar: ${e.message}`);
        } finally {
            setGuardando(false);
        }
    };

    /** Borrado definitivo: no hay papelera, asi que se pide confirmar el nombre. */
    const borrarObservacion = async () => {
        const aviso = `Se eliminará "${obs.tarea}" con sus hallazgos, evidencias y comentarios.\n\nEsta acción no se puede deshacer. ¿Continuar?`;
        if (!confirm(aviso)) return;
        setGuardando(true);
        try {
            await eliminarObservacion(obs.id);
            onCerrar();
        } catch (e) {
            setError(`No se pudo eliminar: ${e.message}`);
            setGuardando(false);
        }
    };

    const guardarSolicitud = async () => {
        if (!solicitud.motivo.trim()) return setError('Explica por qué no se hizo o no se podrá hacer.');
        setGuardando(true);
        try {
            await solicitarReagendamiento(obs.id, { motivo: solicitud.motivo.trim(), usuario });
            setSolicitud(null);
            setError('');
            setTab('comentarios');
        } catch (e) {
            setError(`No se pudo enviar la solicitud: ${e.message}`);
        } finally {
            setGuardando(false);
        }
    };

    // ---- hallazgos ---------------------------------------------------------
    const nuevoFormHallazgo = () => setFormHallazgo({
        descripcion: '', severidad: 'Medio', responsables: [], fotos: [],
        enIsometrix: false, error: ''
    });

    const guardarHallazgo = async (e) => {
        e.preventDefault();
        if (!formHallazgo.descripcion.trim()) {
            setFormHallazgo(f => ({ ...f, error: 'Describe qué se encontró.' }));
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

    // ---- hilo de comentarios adicionales -----------------------------------
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

    const TABS = [
        { id: 'detalle', label: 'Detalle' },
        { id: 'hallazgos', label: 'Hallazgos', cuenta: hallazgos.length },
        { id: 'comentarios', label: 'Comentarios adicionales', corto: 'Comentarios', cuenta: comentarios.length }
    ];

    const panelAbierto = gestion || edicion || agenda || solicitud;

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
                                <ChipProgramacion obs={obs} />
                                <ChipSolicitud obs={obs} />
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
                                {programada
                                    ? `Programada: ${obs.fecha} · ${obs.hora} · Turno ${obs.turno} · ${obs.area}`
                                    : 'Sin programar'}
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                                Creada el {fmt(obs.creadoEn)} por {obs.creadoPorNombre}
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
                                <span className="hidden sm:inline">{t.label}</span>
                                <span className="sm:hidden">{t.corto || t.label}</span>
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
                            {/* Solicitud abierta: es lo que el jefe de area tiene que resolver. */}
                            {tieneSolicitudAbierta(obs) && (
                                <section className="rounded-xl border border-violet-200 bg-violet-50 p-4">
                                    <p className="text-[10px] font-bold text-violet-700 uppercase tracking-wide">
                                        Reagendamiento solicitado
                                    </p>
                                    <p className="text-sm text-slate-800 mt-1">"{obs.solicitudReagendamiento.motivo}"</p>
                                    <p className="text-[11px] text-slate-500 mt-1">
                                        {obs.solicitudReagendamiento.solicitadoPorNombre} · {fmt(obs.solicitudReagendamiento.creadoEn)}
                                    </p>
                                    {!reagendable && (
                                        <p className="text-[11px] text-violet-700 mt-2">
                                            Un jefe de área la revisará y definirá la nueva fecha.
                                        </p>
                                    )}
                                </section>
                            )}

                            {/* Tarjeta de estado: es lo primero que hay que resolver. */}
                            <section className="rounded-xl border border-slate-200 overflow-hidden">
                                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-50">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                                            Estado de la observación
                                        </p>
                                        <p className="text-sm font-semibold text-slate-800 mt-0.5">
                                            {estado}
                                            {vencida && <span className="text-red-700 font-normal"> · venció el plazo sin realizarse</span>}
                                            {estado === ESTADO_REALIZACION.POR_REALIZAR && programada && (
                                                <span className="text-slate-500 font-normal"> · vence el {obs.fecha} a las {obs.hora}</span>
                                            )}
                                        </p>
                                    </div>
                                    {!panelAbierto && (
                                        <div className="flex flex-wrap gap-2">
                                            {gestionable && (
                                                <button
                                                    onClick={abrirGestion}
                                                    className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                                                >
                                                    {esRealizada(obs) ? 'Cambiar estado' : 'Registrar resultado'}
                                                </button>
                                            )}
                                            {editable && (
                                                <button
                                                    onClick={abrirEdicion}
                                                    className="px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-white text-slate-700 text-xs font-bold cursor-pointer"
                                                >
                                                    Editar datos
                                                </button>
                                            )}
                                            {reagendable && (
                                                <button
                                                    onClick={abrirAgenda}
                                                    className="px-3.5 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold cursor-pointer"
                                                >
                                                    Reagendar
                                                </button>
                                            )}
                                            {puedePedir && (
                                                <button
                                                    onClick={() => { cerrarPaneles(); setSolicitud({ motivo: '' }); }}
                                                    className="px-3.5 py-2 rounded-lg border border-violet-300 text-violet-700 hover:bg-violet-50 text-xs font-bold cursor-pointer"
                                                >
                                                    Solicitar reagendamiento
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* -- Registrar resultado -- */}
                                {gestion && (
                                    <div className="p-4 space-y-4 border-t border-slate-200">
                                        <div>
                                            <p className="text-xs font-semibold text-slate-700 mb-2">¿Se realizó la observación?</p>
                                            <div className="grid sm:grid-cols-2 gap-2">
                                                {[ESTADO_REALIZACION.REALIZADA, ESTADO_REALIZACION.NO_REALIZADA].map(op => (
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
                                                        <span aria-hidden="true">{op === ESTADO_REALIZACION.REALIZADA ? '✓' : '✕'}</span>
                                                        {op === ESTADO_REALIZACION.REALIZADA ? 'Sí, se realizó' : 'No se realizó'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {gestion.estado === ESTADO_REALIZACION.NO_REALIZADA && (
                                            <div>
                                                <Etiqueta>¿Por qué no se realizó? <span className="text-slate-400 font-normal">(opcional)</span></Etiqueta>
                                                <textarea
                                                    rows={3}
                                                    value={gestion.explicacionNoRealizada}
                                                    onChange={(e) => setGestion(g => ({ ...g, explicacionNoRealizada: e.target.value }))}
                                                    placeholder="Ej. El equipo estuvo fuera de servicio durante todo el turno."
                                                    className={inputCls}
                                                />
                                                <p className="text-[11px] text-slate-400 mt-1">
                                                    Si necesitas otra fecha, usa <strong>Solicitar reagendamiento</strong>: el jefe de área es
                                                    quien puede moverla.
                                                </p>
                                            </div>
                                        )}

                                        {gestion.estado === ESTADO_REALIZACION.REALIZADA && (
                                            <>
                                                <div>
                                                    <Etiqueta>Comentario de cierre <span className="text-slate-400 font-normal">(opcional)</span></Etiqueta>
                                                    <textarea
                                                        rows={3}
                                                        value={gestion.comentarioCierre}
                                                        onChange={(e) => setGestion(g => ({ ...g, comentarioCierre: e.target.value }))}
                                                        placeholder="Ej. La tarea se ejecutó con el procedimiento al día; se reforzó el uso del arnés."
                                                        className={inputCls}
                                                    />
                                                </div>
                                                <div>
                                                    <Etiqueta>Evidencias de la observación <span className="text-slate-400 font-normal">(opcional)</span></Etiqueta>
                                                    <SubidorFotos
                                                        fotos={gestion.fotosAlRealizar}
                                                        onChange={(fotos) => setGestion(g => ({ ...g, fotosAlRealizar: fotos }))}
                                                        usuario={usuario}
                                                        tipo={TIPO_EVIDENCIA.OBSERVACION}
                                                    />
                                                </div>
                                            </>
                                        )}

                                        {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

                                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                                            <button onClick={cerrarPaneles} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer">
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
                                )}

                                {/* -- Editar los datos de la tarea -- */}
                                {edicion && (
                                    <div className="p-4 space-y-4 border-t border-slate-200">
                                        <p className="text-xs font-semibold text-slate-700">Corregir los datos de la tarea</p>

                                        <label className="block">
                                            <Etiqueta requerido>Tarea a observar</Etiqueta>
                                            <input
                                                className={inputCls}
                                                value={edicion.tarea}
                                                onChange={(e) => setEdicion(f => ({ ...f, tarea: e.target.value }))}
                                            />
                                        </label>

                                        <div className="grid sm:grid-cols-2 gap-4">
                                            <label className="block">
                                                <Etiqueta requerido>PPF</Etiqueta>
                                                <select
                                                    className={inputCls}
                                                    value={edicion.ppf}
                                                    onChange={(e) => setEdicion(f => ({ ...f, ppf: e.target.value }))}
                                                >
                                                    <option value="">Selecciona un PPF...</option>
                                                    {PPF.map(p => <option key={p} value={p}>{p}</option>)}
                                                </select>
                                            </label>
                                            <label className="block">
                                                <Etiqueta requerido>¿Es una tarea rutinaria?</Etiqueta>
                                                <select
                                                    className={inputCls}
                                                    value={edicion.rutinario}
                                                    onChange={(e) => setEdicion(f => ({ ...f, rutinario: e.target.value }))}
                                                >
                                                    <option value="Sí">Sí</option>
                                                    <option value="No">No</option>
                                                </select>
                                            </label>
                                        </div>

                                        {/* Aqui es donde una no programada se convierte en programada. */}
                                        <label className={`flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer ${
                                            edicion.programada ? 'border-yellow-300 bg-yellow-50/60' : 'border-slate-200 bg-slate-50'
                                        }`}>
                                            <input
                                                type="checkbox"
                                                checked={edicion.programada}
                                                onChange={(e) => setEdicion(f => ({ ...f, programada: e.target.checked }))}
                                                className="w-4 h-4 mt-0.5 accent-yellow-500 cursor-pointer shrink-0"
                                            />
                                            <span>
                                                <span className="block text-xs font-semibold text-slate-800">¿Es programada?</span>
                                                <span className="block text-[11px] text-slate-500 mt-0.5">
                                                    {edicion.programada
                                                        ? 'Sí. Debe tener observador, fecha, hora y área.'
                                                        : 'No. Queda solo como registro de la tarea.'}
                                                </span>
                                            </span>
                                        </label>

                                        {edicion.programada && (
                                            <>
                                                <div>
                                                    <Etiqueta requerido>Observadores</Etiqueta>
                                                    <PeoplePicker
                                                        multiple
                                                        value={edicion.observadores}
                                                        onChange={(p) => setEdicion(f => ({ ...f, observadores: p }))}
                                                        placeholder="Busca por nombre o correo..."
                                                    />
                                                </div>

                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                    <label className="block">
                                                        <Etiqueta requerido>Fecha</Etiqueta>
                                                        <input
                                                            type="date"
                                                            className={inputCls}
                                                            value={edicion.fecha}
                                                            onChange={(e) => setEdicion(f => ({ ...f, fecha: e.target.value }))}
                                                        />
                                                    </label>
                                                    <label className="block">
                                                        <Etiqueta requerido>Hora</Etiqueta>
                                                        <input
                                                            type="time"
                                                            className={inputCls}
                                                            value={edicion.hora}
                                                            onChange={(e) => setEdicion(f => ({ ...f, hora: e.target.value, turno: turnoPorHora(e.target.value) }))}
                                                        />
                                                    </label>
                                                    <label className="block">
                                                        <Etiqueta>Turno</Etiqueta>
                                                        <select
                                                            className={inputCls}
                                                            value={edicion.turno}
                                                            onChange={(e) => setEdicion(f => ({ ...f, turno: e.target.value }))}
                                                        >
                                                            {TURNOS.map(t => <option key={t} value={t}>{t}</option>)}
                                                        </select>
                                                    </label>
                                                </div>

                                                <label className="block">
                                                    <Etiqueta requerido>Área</Etiqueta>
                                                    <input
                                                        className={inputCls}
                                                        value={edicion.area}
                                                        onChange={(e) => setEdicion(f => ({ ...f, area: e.target.value }))}
                                                        placeholder="Ej. Taller de equipo pesado — Patio 3"
                                                    />
                                                </label>
                                            </>
                                        )}

                                        {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

                                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                                            <button onClick={cerrarPaneles} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer">
                                                Cancelar
                                            </button>
                                            <button
                                                onClick={guardarEdicion}
                                                disabled={guardando}
                                                className="px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-slate-900 text-sm font-bold cursor-pointer disabled:opacity-60"
                                            >
                                                {guardando ? 'Guardando...' : 'Guardar cambios'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* -- Reagendar (solo jefes de area) -- */}
                                {agenda && (
                                    <div className="p-4 space-y-4 border-t border-slate-200">
                                        <p className="text-xs font-semibold text-slate-700">
                                            Nueva fecha para la observación
                                        </p>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            <label className="block">
                                                <Etiqueta requerido>Fecha</Etiqueta>
                                                <input
                                                    type="date"
                                                    className={inputCls}
                                                    value={agenda.fecha}
                                                    onChange={(e) => setAgenda(f => ({ ...f, fecha: e.target.value }))}
                                                />
                                            </label>
                                            <label className="block">
                                                <Etiqueta requerido>Hora</Etiqueta>
                                                <input
                                                    type="time"
                                                    className={inputCls}
                                                    value={agenda.hora}
                                                    onChange={(e) => setAgenda(f => ({ ...f, hora: e.target.value, turno: turnoPorHora(e.target.value) }))}
                                                />
                                            </label>
                                            <label className="block">
                                                <Etiqueta>Turno</Etiqueta>
                                                <select
                                                    className={inputCls}
                                                    value={agenda.turno}
                                                    onChange={(e) => setAgenda(f => ({ ...f, turno: e.target.value }))}
                                                >
                                                    {TURNOS.map(t => <option key={t} value={t}>{t}</option>)}
                                                </select>
                                            </label>
                                        </div>

                                        <div>
                                            <Etiqueta requerido>Observadores</Etiqueta>
                                            <PeoplePicker
                                                multiple
                                                value={agenda.observadores}
                                                onChange={(p) => setAgenda(f => ({ ...f, observadores: p }))}
                                                placeholder="Cambia o agrega observadores..."
                                            />
                                        </div>

                                        <label className="block">
                                            <Etiqueta>Nota para el observador <span className="text-slate-400 font-normal">(opcional)</span></Etiqueta>
                                            <textarea
                                                rows={2}
                                                className={inputCls}
                                                value={agenda.nota}
                                                onChange={(e) => setAgenda(f => ({ ...f, nota: e.target.value }))}
                                                placeholder="Ej. Se mueve al turno de la noche por disponibilidad del equipo."
                                            />
                                        </label>

                                        {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

                                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                                            <button onClick={cerrarPaneles} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer">
                                                Cancelar
                                            </button>
                                            <button
                                                onClick={guardarAgenda}
                                                disabled={guardando}
                                                className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold cursor-pointer disabled:opacity-60"
                                            >
                                                {guardando ? 'Guardando...' : 'Reagendar observación'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* -- Solicitar reagendamiento (observador) -- */}
                                {solicitud && (
                                    <div className="p-4 space-y-4 border-t border-slate-200">
                                        <div>
                                            <Etiqueta requerido>¿Por qué no se hizo o no se podrá hacer?</Etiqueta>
                                            <textarea
                                                rows={3}
                                                autoFocus
                                                className={inputCls}
                                                value={solicitud.motivo}
                                                onChange={(e) => setSolicitud(f => ({ ...f, motivo: e.target.value }))}
                                                placeholder="Ej. El equipo salió a mantenimiento correctivo y no estará disponible en el turno."
                                            />
                                            <p className="text-[11px] text-slate-400 mt-1">
                                                Queda en <strong>Comentarios adicionales</strong> y le llega a los jefes de área, que son
                                                quienes definen la nueva fecha.
                                            </p>
                                        </div>

                                        {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

                                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                                            <button onClick={cerrarPaneles} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer">
                                                Cancelar
                                            </button>
                                            <button
                                                onClick={guardarSolicitud}
                                                disabled={guardando}
                                                className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold cursor-pointer disabled:opacity-60"
                                            >
                                                {guardando ? 'Enviando...' : 'Enviar solicitud'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {!panelAbierto && (
                                    <>
                                        {!esRealizada(obs) && obs.explicacionNoRealizada && (
                                            <div className="px-4 py-3 border-t border-slate-200">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Motivo</p>
                                                <p className="text-sm text-slate-800">{obs.explicacionNoRealizada}</p>
                                            </div>
                                        )}
                                        {esRealizada(obs) && obs.comentarioCierre && (
                                            <div className="px-4 py-3 border-t border-slate-200">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Comentario de cierre</p>
                                                <p className="text-sm text-slate-800">{obs.comentarioCierre}</p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </section>

                            <section className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                <Dato label="PPF" valor={obs.ppf} />
                                <Dato label="Rutinario" valor={obs.rutinario} />
                                <Dato label="Tipo" valor={programacionDe(obs)} />
                                {programada && <Dato label="Área" valor={obs.area} />}
                                {programada && <Dato label="Turno" valor={obs.turno} />}
                                <Dato label="Hallazgos" valor={obs.estado} />
                                <Dato label="Fecha de creación" valor={fmt(obs.creadoEn)} />
                                <Dato label="Creada por" valor={obs.creadoPorNombre} />
                                {obs.editadoEn && <Dato label="Última edición" valor={`${obs.editadoPorNombre} · ${fmt(obs.editadoEn)}`} />}
                            </section>

                            <section>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">
                                    Observadores {observadores.length > 1 && `(${observadores.length})`}
                                </p>
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
                                    <p className="text-sm text-slate-400">
                                        Sin observador asignado: la tarea no se programó. La registró {obs.creadoPorNombre}.
                                    </p>
                                )}
                            </section>

                            {reagendamientos.length > 0 && (
                                <section>
                                    <h4 className="font-bold text-slate-900 text-sm mb-2">
                                        Historial de reagendamientos
                                        <span className="text-slate-400 font-normal"> ({reagendamientos.length})</span>
                                    </h4>
                                    <ul className="space-y-2">
                                        {reagendamientos.map(r => (
                                            <li key={r.id} className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                                                <span className="font-semibold text-slate-800">{r.de}</span> → <span className="font-semibold text-slate-800">{r.a}</span>
                                                {r.nota && <span className="block text-slate-500 mt-0.5">{r.nota}</span>}
                                                <span className="block text-[10px] text-slate-400 mt-0.5">{r.porNombre} · {fmt(r.creadoEn)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            )}

                            {eliminable && (
                                <section className="rounded-xl border border-red-200 bg-red-50/60 p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-red-900">Eliminar esta observación</p>
                                            <p className="text-[11px] text-red-800/80 mt-0.5">
                                                Borra el registro con sus hallazgos, evidencias y comentarios. No se puede deshacer.
                                            </p>
                                        </div>
                                        <button
                                            onClick={borrarObservacion}
                                            disabled={guardando}
                                            className="shrink-0 px-3.5 py-2 rounded-lg border border-red-300 bg-white text-red-700 hover:bg-red-600 hover:text-white hover:border-red-600 text-xs font-bold cursor-pointer disabled:opacity-60 transition"
                                        >
                                            Eliminar
                                        </button>
                                    </div>
                                    {error && !panelAbierto && (
                                        <p className="text-sm text-red-700 bg-white border border-red-200 rounded-lg px-3 py-2 mt-3">{error}</p>
                                    )}
                                </section>
                            )}

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
                                    Solo el observador asignado, quien la creó o un jefe de área pueden registrar hallazgos.
                                </p>
                            )}

                            {formHallazgo && (
                                <form onSubmit={guardarHallazgo} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4 mb-5">
                                    <div>
                                        <Etiqueta requerido>¿Qué se encontró?</Etiqueta>
                                        <textarea
                                            rows={3}
                                            autoFocus
                                            value={formHallazgo.descripcion}
                                            onChange={(e) => setFormHallazgo(f => ({ ...f, descripcion: e.target.value, error: '' }))}
                                            className={inputCls}
                                            placeholder="Describe la condición o el comportamiento observado..."
                                        />
                                    </div>

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
                                            multiple
                                            permitirManual
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

                                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                                        <label className="flex items-center gap-2.5 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formHallazgo.enIsometrix}
                                                onChange={(e) => setFormHallazgo(f => ({ ...f, enIsometrix: e.target.checked, error: '' }))}
                                                className="w-4 h-4 accent-yellow-500 cursor-pointer shrink-0"
                                            />
                                            <span className="text-xs font-semibold text-slate-700">
                                                ¿Este hallazgo ya se subió a Isometrix?
                                            </span>
                                        </label>
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

                    {/* ---- Comentarios adicionales: hilo entre observador y jefe de area ---- */}
                    {tab === 'comentarios' && (
                        <section>
                            <h4 className="font-bold text-slate-900 mb-1">Comentarios adicionales</h4>
                            <p className="text-xs text-slate-500 mb-4">
                                Aquí el observador explica por qué no se hizo la observación y el jefe de área
                                repregunta lo que necesite antes de decidir si la reagenda.
                            </p>

                            {comentarios.length > 0 ? (
                                <ul className="space-y-3 mb-4">
                                    {comentarios.map(c => {
                                        const esAdminMsg = c.rol === 'admin';
                                        return (
                                            <li
                                                key={c.id}
                                                className={`rounded-xl p-3 border-l-4 ${
                                                    c.tipo === 'solicitud'
                                                        ? 'bg-violet-50 border-violet-400'
                                                        : c.tipo === 'reagendamiento'
                                                            ? 'bg-emerald-50 border-emerald-400'
                                                            : esAdminMsg
                                                                ? 'bg-amber-50 border-amber-400'
                                                                : 'bg-slate-50 border-slate-300'
                                                }`}
                                            >
                                                {c.tipo === 'solicitud' && (
                                                    <p className="text-[10px] font-bold uppercase tracking-wide text-violet-700 mb-1">
                                                        Solicitud de reagendamiento
                                                    </p>
                                                )}
                                                {c.tipo === 'reagendamiento' && (
                                                    <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 mb-1">
                                                        Reagendada
                                                    </p>
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

                            {gestionable ? (
                                <form onSubmit={guardarComentario} className="flex flex-col sm:flex-row gap-2">
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
                            ) : (
                                <p className="text-xs text-slate-400">
                                    Solo el observador asignado, quien la creó o un jefe de área pueden comentar.
                                </p>
                            )}
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ModalObservacion;
