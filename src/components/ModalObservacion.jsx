import React, { useState } from 'react';
import PeoplePicker, { Avatar } from './PeoplePicker';
import {
    agregarHallazgo,
    eliminarHallazgo,
    agregarComentarioAdmin,
    puedeGestionar,
    puedeEditar,
    notificar,
    actualizarObservacion
} from '../utils/storage';
import { SEVERIDADES, ADMIN_PRINCIPAL } from '../data/constants';
import { subirFotoEvidencia } from '../utils/sharepointApi';

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
    const [modoEdicion, setModoEdicion] = useState(false);
    const [formEdicion, setFormEdicion] = useState({ realizada: obs.realizada, explicacionNoRealizada: obs.explicacionNoRealizada || '', fotosAlRealizar: obs.fotosAlRealizar || [] });
    const [fotoCargando, setFotoCargando] = useState(false);

    const gestionable = puedeGestionar(obs, usuario);
    const editable = puedeEditar(obs, usuario);

    const guardarHallazgo = async (e) => {
        e.preventDefault();
        if (!descripcion.trim()) return;
        await agregarHallazgo(obs.id, {
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

    const guardarComentario = async (e) => {
        e.preventDefault();
        if (!comentario.trim()) return;
        await agregarComentarioAdmin(obs.id, {
            texto: comentario.trim(),
            autor: usuario.email,
            autorNombre: usuario.nombre
        });
        notificar({
            paraEmail: obs.creadoPor,
            titulo: `${ADMIN_PRINCIPAL.nombre}, ${ADMIN_PRINCIPAL.cargo}, comentó tu observación`,
            mensaje: `"${comentario.trim()}" — sobre la observación de ${obs.tarea}.`,
            obsId: obs.id
        });
        setComentario('');
        onCambio();
    };

    const borrarHallazgo = async (hid) => {
        if (!confirm('¿Eliminar este hallazgo?')) return;
        await eliminarHallazgo(obs.id, hid);
        onCambio();
    };

    const manejarFotoRealizar = async (e) => {
        const archivo = e.target.files?.[0];
        if (!archivo) return;

        setFotoCargando(true);
        try {
            const fotoData = await subirFotoEvidencia(archivo, usuario.nombre);
            setFormEdicion(prev => ({
                ...prev,
                fotosAlRealizar: [...(prev.fotosAlRealizar || []), fotoData]
            }));
        } catch (err) {
            console.error('Error subiendo foto:', err);
        } finally {
            setFotoCargando(false);
        }
    };

    const guardarEdicion = async () => {
        await actualizarObservacion(obs.id, (o) => ({
            ...o,
            realizada: formEdicion.realizada,
            explicacionNoRealizada: formEdicion.explicacionNoRealizada,
            fotosAlRealizar: formEdicion.fotosAlRealizar
        }));
        setModoEdicion(false);
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
                    <div className="flex items-center gap-2 shrink-0">
                        {editable && !modoEdicion && (
                            <button
                                onClick={() => setModoEdicion(true)}
                                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer"
                            >
                                Editar
                            </button>
                        )}
                        <button
                            onClick={onCerrar}
                            className="text-slate-400 hover:text-slate-700 text-2xl leading-none cursor-pointer"
                            aria-label="Cerrar"
                        >
                            ×
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {modoEdicion && editable ? (
                        <section className="border border-blue-200 bg-blue-50 rounded-xl p-4 space-y-4">
                            <h4 className="font-bold text-slate-900">Editar observación</h4>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
                                    ¿Se realizó la observación?
                                </label>
                                <div className="flex gap-2">
                                    {[true, false].map(v => (
                                        <button
                                            key={v ? 'si' : 'no'}
                                            type="button"
                                            onClick={() => setFormEdicion(prev => ({ ...prev, realizada: v }))}
                                            className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition cursor-pointer ${
                                                formEdicion.realizada === v
                                                    ? 'bg-slate-900 text-white border-slate-900'
                                                    : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                                            }`}
                                        >
                                            {v ? 'Sí, se realizó' : 'No se realizó'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {!formEdicion.realizada && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
                                        ¿Por qué no se realizó?
                                    </label>
                                    <textarea
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-yellow-500"
                                        rows={3}
                                        value={formEdicion.explicacionNoRealizada}
                                        onChange={(e) => setFormEdicion(prev => ({ ...prev, explicacionNoRealizada: e.target.value }))}
                                        placeholder="Explica los motivos..."
                                    />
                                </div>
                            )}

                            {formEdicion.realizada && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
                                        Subir fotos de evidencia (hallazgos encontrados)
                                    </label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={(e) => {
                                            const files = e.target.files;
                                            if (files) {
                                                Array.from(files).forEach(file => {
                                                    manejarFotoRealizar({ target: { files: [file] } });
                                                });
                                            }
                                        }}
                                        disabled={fotoCargando}
                                        className="w-full"
                                    />
                                    {fotoCargando && <p className="text-xs text-yellow-600 mt-1">Subiendo foto...</p>}

                                    {formEdicion.fotosAlRealizar.length > 0 && (
                                        <div className="mt-3">
                                            <p className="text-xs font-bold text-slate-600 mb-2">
                                                Fotos cargadas ({formEdicion.fotosAlRealizar.length}):
                                            </p>
                                            <ul className="space-y-2">
                                                {formEdicion.fotosAlRealizar.map((foto, idx) => (
                                                    <li key={idx} className="flex items-center justify-between text-sm bg-white p-2 rounded border border-slate-200">
                                                        <span className="text-slate-700 truncate">{foto.nombre}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setFormEdicion(prev => ({
                                                                ...prev,
                                                                fotosAlRealizar: prev.fotosAlRealizar.filter((_, i) => i !== idx)
                                                            }))}
                                                            className="text-red-600 hover:text-red-800 text-xs font-bold"
                                                        >
                                                            Eliminar
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setModoEdicion(false)}
                                    className="px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={guardarEdicion}
                                    className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 cursor-pointer"
                                >
                                    Guardar cambios
                                </button>
                            </div>
                        </section>
                    ) : null}

                    <section className={modoEdicion ? 'opacity-50 pointer-events-none' : ''}>
                        <div className="grid sm:grid-cols-3 gap-4">
                            <Dato label="PPF" valor={obs.ppf} />
                            <Dato label="Área" valor={obs.area} />
                            <Dato label="Rutinario" valor={obs.rutinario} />
                            <Dato label="Estado" valor={obs.estado} />
                            <Dato label="Realizada" valor={obs.realizada ? 'Sí' : 'No'} />
                            <Dato label="Programada por" valor={obs.creadoPorNombre} />
                        </div>
                        {!obs.realizada && obs.explicacionNoRealizada && (
                            <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg p-3">
                                <p className="text-xs font-bold text-orange-600 uppercase mb-1">Motivo de no realización:</p>
                                <p className="text-sm text-slate-800">{obs.explicacionNoRealizada}</p>
                            </div>
                        )}
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

                    {(obs.fotosAlRealizar || []).length > 0 && (
                        <section className="border-t border-slate-100 pt-5">
                            <h4 className="font-bold text-slate-900 mb-3">
                                Evidencias de realización <span className="text-slate-400 font-normal">({obs.fotosAlRealizar.length})</span>
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {obs.fotosAlRealizar.map((foto, idx) => (
                                    <div key={idx} className="border border-slate-200 rounded-lg overflow-hidden">
                                        <a href={foto.url} target="_blank" rel="noopener noreferrer" className="block hover:opacity-75">
                                            <img src={foto.url} alt={foto.nombre} className="w-full h-32 object-cover" />
                                        </a>
                                        <p className="text-[10px] text-slate-500 p-2 truncate">{foto.nombre}</p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

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
