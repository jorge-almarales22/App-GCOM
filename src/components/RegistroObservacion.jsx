import React, { useState } from 'react';
import PeoplePicker from './PeoplePicker';
import { crearObservacion, hoyISO } from '../utils/storage';
import { PPF, TURNOS, ESTADOS } from '../data/constants';
import { getRequestDigest, subirFotoEvidencia } from '../utils/sharepointApi';

const Campo = ({ label, children, requerido }) => (
    <label className="block">
        <span className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
            {label} {requerido && <span className="text-red-500">*</span>}
        </span>
        {children}
    </label>
);

const inputCls =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200';

const turnoPorHora = (hora) => {
    const h = parseInt((hora || '').split(':')[0], 10);
    return Number.isNaN(h) || h < 6 || h >= 18 ? 'Noche' : 'Día';
};

const ESTADO_INICIAL = {
    tarea: '',
    observador: null,
    ppf: '',
    rutinario: 'Sí',
    fecha: hoyISO(),
    hora: '08:00',
    turno: 'Día',
    area: '',
    realizada: true,
    explicacionNoRealizada: '',
    fotosAlCrear: []
};

const RegistroObservacion = ({ usuario, superintendencias, onCreada }) => {
    const [form, setForm] = useState(ESTADO_INICIAL);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [fotoCargando, setFotoCargando] = useState(false);

    const set = (campo, valor) => {
        setForm(prev => {
            const siguiente = { ...prev, [campo]: valor };
            if (campo === 'hora') siguiente.turno = turnoPorHora(valor);
            return siguiente;
        });
    };

    const manejarFoto = async (e) => {
        const archivo = e.target.files?.[0];
        if (!archivo) return;

        setFotoCargando(true);
        try {
            const fotoData = await subirFotoEvidencia(archivo, usuario.nombre);
            setForm(prev => ({
                ...prev,
                fotosAlCrear: [...(prev.fotosAlCrear || []), fotoData]
            }));
        } catch (err) {
            setError(`Error subiendo foto: ${err.message}`);
        } finally {
            setFotoCargando(false);
        }
    };

    const eliminarFoto = (idx) => {
        setForm(prev => ({
            ...prev,
            fotosAlCrear: prev.fotosAlCrear.filter((_, i) => i !== idx)
        }));
    };

    const enviar = async (e) => {
        e.preventDefault();
        if (!form.observador) {
            setError('Selecciona el observador en el directorio.');
            return;
        }
        if (!form.tarea || !form.ppf || !form.area) {
            setError('Completa todos los campos obligatorios.');
            return;
        }
        if (!form.realizada && !form.explicacionNoRealizada.trim()) {
            setError('Explica por qué no se realizó la observación.');
            return;
        }

        setLoading(true);
        try {
            await crearObservacion(form, usuario);
            setForm({ ...ESTADO_INICIAL, fecha: hoyISO() });
            setError('');
            onCreada();
        } catch (err) {
            setError(`Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto">
            <div className="mb-5">
                <h2 className="text-2xl font-bold text-slate-900">Registro de observaciones programadas</h2>
                <p className="text-sm text-slate-500 mt-1">
                    Programa las observaciones de seguridad que se realizarán en el turno.
                </p>
            </div>

            <form
                onSubmit={enviar}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5"
            >
                <Campo label="Tarea a observar" requerido>
                    <input
                        type="text"
                        className={inputCls}
                        value={form.tarea}
                        onChange={(e) => set('tarea', e.target.value)}
                        placeholder="Describe la tarea a observar..."
                        required
                    />
                </Campo>

                <Campo label="Observador" requerido>
                    <PeoplePicker
                        value={form.observador}
                        onChange={(p) => set('observador', p)}
                        placeholder="Busca por nombre o correo en el directorio..."
                    />
                </Campo>

                <div className="grid sm:grid-cols-2 gap-5">
                    <Campo label="PPF · Protocolo de Peligros Fatales" requerido>
                        <select
                            className={inputCls}
                            value={form.ppf}
                            onChange={(e) => set('ppf', e.target.value)}
                            required
                        >
                            <option value="">Selecciona un PPF...</option>
                            {PPF.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </Campo>

                    <Campo label="¿Es rutinario?" requerido>
                        <div className="flex gap-2">
                            {['Sí', 'No'].map(v => (
                                <button
                                    key={v}
                                    type="button"
                                    onClick={() => set('rutinario', v)}
                                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition cursor-pointer ${
                                        form.rutinario === v
                                            ? 'bg-slate-900 text-white border-slate-900'
                                            : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                                    }`}
                                >
                                    {v}
                                </button>
                            ))}
                        </div>
                    </Campo>
                </div>

                <div className="grid sm:grid-cols-3 gap-5">
                    <Campo label="Fecha" requerido>
                        <input
                            type="date"
                            className={inputCls}
                            value={form.fecha}
                            onChange={(e) => set('fecha', e.target.value)}
                            required
                        />
                    </Campo>

                    <Campo label="Hora" requerido>
                        <input
                            type="time"
                            className={inputCls}
                            value={form.hora}
                            onChange={(e) => set('hora', e.target.value)}
                            required
                        />
                    </Campo>

                    <Campo label="Turno">
                        <select
                            className={inputCls}
                            value={form.turno}
                            onChange={(e) => set('turno', e.target.value)}
                        >
                            {TURNOS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </Campo>
                </div>

                <Campo label="Área" requerido>
                    <input
                        type="text"
                        className={inputCls}
                        value={form.area}
                        onChange={(e) => set('area', e.target.value)}
                        placeholder="Describe el área..."
                        required
                    />
                </Campo>

                <div className="border-t border-slate-100 pt-5">
                    <Campo label="¿Se realizó la observación?" requerido>
                        <div className="flex gap-2">
                            {[true, false].map(v => (
                                <button
                                    key={v ? 'si' : 'no'}
                                    type="button"
                                    onClick={() => set('realizada', v)}
                                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition cursor-pointer ${
                                        form.realizada === v
                                            ? 'bg-slate-900 text-white border-slate-900'
                                            : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                                    }`}
                                >
                                    {v ? 'Sí, se realizó' : 'No se realizó'}
                                </button>
                            ))}
                        </div>
                    </Campo>

                    {!form.realizada && (
                        <div className="mt-4">
                            <Campo label="¿Por qué no se realizó?" requerido>
                                <textarea
                                    className={inputCls}
                                    rows={3}
                                    value={form.explicacionNoRealizada}
                                    onChange={(e) => set('explicacionNoRealizada', e.target.value)}
                                    placeholder="Explica los motivos..."
                                    required
                                />
                            </Campo>
                        </div>
                    )}

                    <div className="mt-4">
                        <Campo label="Subir fotos de evidencia">
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={(e) => {
                                    const files = e.target.files;
                                    if (files) {
                                        Array.from(files).forEach(file => {
                                            manejarFoto({ target: { files: [file] } });
                                        });
                                    }
                                }}
                                disabled={fotoCargando}
                                className="w-full"
                            />
                            {fotoCargando && <p className="text-xs text-yellow-600 mt-1">Subiendo foto...</p>}
                        </Campo>

                        {form.fotosAlCrear.length > 0 && (
                            <div className="mt-3">
                                <p className="text-xs font-bold text-slate-600 mb-2">
                                    Fotos cargadas ({form.fotosAlCrear.length}):
                                </p>
                                <ul className="space-y-2">
                                    {form.fotosAlCrear.map((foto, idx) => (
                                        <li key={idx} className="flex items-center justify-between text-sm bg-slate-50 p-2 rounded">
                                            <span className="text-slate-700 truncate">{foto.nombre}</span>
                                            <button
                                                type="button"
                                                onClick={() => eliminarFoto(idx)}
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
                </div>

                {error && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        {error}
                    </p>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                        type="button"
                        onClick={() => setForm({ ...ESTADO_INICIAL, fecha: hoyISO() })}
                        className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                    >
                        Limpiar
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-5 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-slate-900 text-sm font-bold cursor-pointer disabled:opacity-50"
                    >
                        {loading ? 'Guardando...' : 'Programar observación'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default RegistroObservacion;
