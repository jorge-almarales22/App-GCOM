import React, { useState } from 'react';
import PeoplePicker from './PeoplePicker';
import { crearObservacion, hoyISO } from '../utils/storage';
import { TAREAS, PPF, AREAS, TURNOS, ESTADOS } from '../data/constants';

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

// El turno se deduce de la hora para no obligar al supervisor a elegirlo:
// el turno de dia en la mina va de 06:00 a 17:59.
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
    superintendencia: ''
};

const RegistroObservacion = ({ usuario, superintendencias, onCreada }) => {
    const [form, setForm] = useState(ESTADO_INICIAL);
    const [error, setError] = useState('');

    const set = (campo, valor) => {
        setForm(prev => {
            const siguiente = { ...prev, [campo]: valor };
            // Al mover la hora el turno se recalcula, pero sigue siendo editable.
            if (campo === 'hora') siguiente.turno = turnoPorHora(valor);
            return siguiente;
        });
    };

    const enviar = (e) => {
        e.preventDefault();
        if (!form.observador) {
            setError('Selecciona el observador en el directorio.');
            return;
        }
        if (!form.tarea || !form.ppf || !form.area || !form.superintendencia) {
            setError('Completa todos los campos obligatorios.');
            return;
        }
        crearObservacion(form, usuario);
        setForm({ ...ESTADO_INICIAL, fecha: hoyISO() });
        setError('');
        onCreada();
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
                    <select
                        className={inputCls}
                        value={form.tarea}
                        onChange={(e) => set('tarea', e.target.value)}
                        required
                    >
                        <option value="">Selecciona una tarea...</option>
                        {TAREAS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
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

                <div className="grid sm:grid-cols-2 gap-5">
                    <Campo label="Área" requerido>
                        <select
                            className={inputCls}
                            value={form.area}
                            onChange={(e) => set('area', e.target.value)}
                            required
                        >
                            <option value="">Selecciona un área...</option>
                            {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                    </Campo>

                    <Campo label="Superintendencia" requerido>
                        <select
                            className={inputCls}
                            value={form.superintendencia}
                            onChange={(e) => set('superintendencia', e.target.value)}
                            required
                        >
                            <option value="">Selecciona una superintendencia...</option>
                            {superintendencias.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </Campo>
                </div>

                <Campo label="Estado">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        {ESTADOS.SIN_HALLAZGOS}
                        <span className="text-xs text-slate-400 ml-2">
                            · cambia solo cuando se registren hallazgos
                        </span>
                    </div>
                </Campo>

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
                        className="px-5 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-slate-900 text-sm font-bold cursor-pointer"
                    >
                        Programar observación
                    </button>
                </div>
            </form>
        </div>
    );
};

export default RegistroObservacion;
