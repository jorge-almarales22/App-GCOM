import React, { useState } from 'react';
import PeoplePicker, { Avatar } from './PeoplePicker';
import {
    agregarHallazgo,
    eliminarHallazgo,
    agregarComentarioAdmin,
    puedeGestionar,
    notificar
} from '../utils/storage';
import { SEVERIDADES, ADMIN_PRINCIPAL } from '../data/constants';

const fmt = (iso) => new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

const COLOR_SEVERIDAD = {
    'Bajo': 'bg-emerald-100 text-emerald-800',
    'Medio': 'bg-amber-100 text-amber-800',
    'Alto': 'bg-orange-100 text-orange-800',
    'Crítico': 'bg-red-100 text-red-800'
};

const Dato = ({ label, valor }) => (
    <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm text-slate-800">{valor || '—'}</p>
    </div>
);

const ModalObservacion = ({ obs, usuario, onCerrar, onCambio }) => {
    const [descripcion, setDescripcion] = useState('');
    const [severidad, setSeveridad] = useState('Medio');
    const [responsables, setResponsables] = useState([]);
    const [comentario, setComentario] = useState('');
    const [formHallazgoAbierto, setFormHallazgoAbierto] = useState(false);

    const gestionable = puedeGestionar(obs, usuario);

    const guardarHallazgo = (e) => {
        e.preventDefault();
        if (!descripcion.trim()) return;
        agregarHallazgo(obs.id, {
            descripcion: descripcion.trim(),
            severidad,
            responsables,
            registradoPor: usuario.email,
            registradoPorNombre: usuario.nombre
        });
        setDescripcion('');
        setSeveridad('Medio');
        setResponsables([]);
        setFormHallazgoAbierto(false);
        onCambio();
    };

    const guardarComentario = (e) => {
        e.preventDefault();
        if (!comentario.trim()) return;
        agregarComentarioAdmin(obs.id, {
            texto: comentario.trim(),
            autor: usuario.email,
            autorNombre: usuario.nombre
        });
        // Aviso al dueño de la observacion. El texto nombra al gerente porque es
        // quien firma los comentarios de administrador.
        notificar({
            paraEmail: obs.creadoPor,
            titulo: `${ADMIN_PRINCIPAL.nombre}, ${ADMIN_PRINCIPAL.cargo}, comentó tu observación`,
            mensaje: `"${comentario.trim()}" — sobre la observación de ${obs.tarea}.`,
            obsId: obs.id
        });
        setComentario('');
        onCambio();
    };

    const borrarHallazgo = (hid) => {
        if (!confirm('¿Eliminar este hallazgo?')) return;
        eliminarHallazgo(obs.id, hid);
        onCambio();
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-4">
                <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
                    <div className="min-w-0">
                        <h3 className="font-bold text-slate-900 leading-tight">{obs.tarea}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            {obs.fecha} · {obs.hora} · Turno {obs.turno}
                        </p>
                    </div>
                    <button
                        onClick={onCerrar}
                        className="text-slate-400 hover:text-slate-700 text-2xl leading-none cursor-pointer shrink-0"
                        aria-label="Cerrar"
                    >
                        ×
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <section className="grid sm:grid-cols-3 gap-4">
                        <Dato label="PPF" valor={obs.ppf} />
                        <Dato label="Área" valor={obs.area} />
                        <Dato label="Superintendencia" valor={obs.superintendencia} />
                        <Dato label="Rutinario" valor={obs.rutinario} />
                        <Dato label="Estado" valor={obs.estado} />
                        <Dato label="Programada por" valor={obs.creadoPorNombre} />
                    </section>

                    <section>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Observador</p>
                        {obs.observador ? (
                            <div className="flex items-center gap-3">
                                <Avatar persona={obs.observador} />
                                <div className="leading-tight">
                                    <p className="text-sm font-semibold text-slate-800">{obs.observador.nombre}</p>
                                    <p className="text-xs text-slate-500">{obs.observador.email}</p>
                                </div>
                            </div>
                        ) : <p className="text-sm text-slate-400">—</p>}
                    </section>

                    {/* ---- Hallazgos ---- */}
                    <section className="border-t border-slate-100 pt-5">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="font-bold text-slate-900">
                                Hallazgos <span className="text-slate-400 font-normal">({obs.hallazgos?.length || 0})</span>
                            </h4>
                            {gestionable && !formHallazgoAbierto && (
                                <button
                                    onClick={() => setFormHallazgoAbierto(true)}
                                    className="px-3 py-1.5 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-slate-900 text-xs font-bold cursor-pointer"
                                >
                                    + Añadir hallazgo
                                </button>
                            )}
                        </div>

                        {!gestionable && (
                            <p className="text-xs text-slate-400 mb-3">
                                Solo {obs.creadoPorNombre} puede gestionar esta observación.
                            </p>
                        )}

                        {formHallazgoAbierto && (
                            <form onSubmit={guardarHallazgo} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4 mb-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                                        ¿Qué se encontró?
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={descripcion}
                                        onChange={(e) => setDescripcion(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-yellow-500"
                                        placeholder="Describe el hallazgo de la observación..."
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Severidad</label>
                                    <div className="flex flex-wrap gap-2">
                                        {SEVERIDADES.map(s => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => setSeveridad(s)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                                                    severidad === s
                                                        ? 'bg-slate-900 text-white border-slate-900'
                                                        : 'bg-white text-slate-600 border-slate-300'
                                                }`}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                                        Responsables del hallazgo
                                    </label>
                                    <PeoplePicker
                                        multiple
                                        permitirManual
                                        value={responsables}
                                        onChange={setResponsables}
                                        placeholder="Busca personas en el directorio..."
                                    />
                                </div>

                                <div className="flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setFormHallazgoAbierto(false)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 cursor-pointer"
                                    >
                                        Cancelar
                                    </button>
                                    <button className="px-4 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer">
                                        Guardar hallazgo
                                    </button>
                                </div>
                            </form>
                        )}

                        {(obs.hallazgos || []).length === 0 ? (
                            <p className="text-sm text-slate-400">Esta observación no tiene hallazgos registrados.</p>
                        ) : (
                            <ul className="space-y-3">
                                {obs.hallazgos.map(h => (
                                    <li key={h.id} className="border border-slate-200 rounded-xl p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${COLOR_SEVERIDAD[h.severidad] || 'bg-slate-100 text-slate-700'}`}>
                                                {h.severidad}
                                            </span>
                                            {gestionable && (
                                                <button
                                                    onClick={() => borrarHallazgo(h.id)}
                                                    className="text-xs text-slate-400 hover:text-red-600 cursor-pointer"
                                                >
                                                    Eliminar
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-800 mt-2">{h.descripcion}</p>

                                        {(h.responsables || []).length > 0 && (
                                            <div className="mt-3">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                                                    Responsables
                                                </p>
                                                <div className="flex flex-wrap gap-2">
                                                    {h.responsables.map(p => (
                                                        <span
                                                            key={p.email}
                                                            className="inline-flex items-center gap-2 bg-slate-100 rounded-full pl-1 pr-3 py-1"
                                                        >
                                                            <Avatar persona={p} size="w-6 h-6" />
                                                            <span className="text-xs text-slate-700">
                                                                {p.nombre}
                                                                {p.manual && (
                                                                    <span className="text-slate-400"> · manual</span>
                                                                )}
                                                            </span>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <p className="text-[10px] text-slate-400 mt-3">
                                            Registrado por {h.registradoPorNombre} · {fmt(h.creadoEn)}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    {/* ---- Comentarios del administrador ---- */}
                    <section className="border-t border-slate-100 pt-5">
                        <h4 className="font-bold text-slate-900 mb-3">
                            Comentarios de gerencia
                            <span className="text-slate-400 font-normal"> ({obs.comentariosAdmin?.length || 0})</span>
                        </h4>

                        {(obs.comentariosAdmin || []).length > 0 && (
                            <ul className="space-y-3 mb-4">
                                {obs.comentariosAdmin.map(c => (
                                    <li key={c.id} className="bg-amber-50 border-l-4 border-amber-400 rounded-r-xl p-3">
                                        <p className="text-sm text-slate-800">{c.texto}</p>
                                        <p className="text-[10px] text-slate-500 mt-1">
                                            {c.autorNombre} · {fmt(c.creadoEn)}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        )}

                        {usuario.admin ? (
                            <form onSubmit={guardarComentario} className="flex gap-2">
                                <input
                                    value={comentario}
                                    onChange={(e) => setComentario(e.target.value)}
                                    placeholder="Escribe un comentario de administrador..."
                                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500"
                                />
                                <button className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-900 text-sm font-bold cursor-pointer">
                                    Comentar
                                </button>
                            </form>
                        ) : (
                            (obs.comentariosAdmin || []).length === 0 && (
                                <p className="text-sm text-slate-400">Sin comentarios de gerencia.</p>
                            )
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
};

export default ModalObservacion;
