import React, { useState } from 'react';
import PeoplePicker from './PeoplePicker';
import SubidorFotos from './SubidorFotos';
import { crearObservacion, hoyISO } from '../utils/storage';
import { PPF, TURNOS } from '../data/constants';
import { TIPO_EVIDENCIA } from '../utils/sharepointApi';

// ---------------------------------------------------------------------------
// Registro de una observacion PROGRAMADA. Aqui solo se planea: qué se va a
// observar, quién y cuándo. Si se hizo o no se resuelve despues, desde
// "Gestión de observaciones", porque en este momento todavia no ha ocurrido.
// ---------------------------------------------------------------------------

const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200';

const selectCls = `${inputCls} appearance-none pr-9 bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='%2364748b' stroke-width='2' viewBox='0 0 24 24'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='m6 9 6 6 6-6'/%3E%3C/svg%3E")] bg-[length:18px] bg-[right_0.65rem_center] bg-no-repeat`;

/** Bloque numerado: da al formulario un orden de lectura evidente. */
const Seccion = ({ numero, titulo, descripcion, children }) => (
    <section className="px-4 sm:px-6 py-5 border-b border-slate-100 last:border-b-0">
        <div className="flex gap-3 sm:gap-4">
            <span className="hidden sm:grid shrink-0 w-7 h-7 rounded-full bg-slate-900 text-white text-xs font-bold place-items-center mt-0.5">
                {numero}
            </span>
            <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-900 text-sm">
                    <span className="sm:hidden text-slate-400">{numero}. </span>{titulo}
                </h3>
                {descripcion && <p className="text-xs text-slate-500 mt-0.5 mb-4">{descripcion}</p>}
                <div className={descripcion ? '' : 'mt-4'}>{children}</div>
            </div>
        </div>
    </section>
);

const Campo = ({ label, requerido, ayuda, children }) => (
    <label className="block">
        <span className="block text-xs font-semibold text-slate-700 mb-1.5">
            {label} {requerido && <span className="text-red-500">*</span>}
        </span>
        {children}
        {ayuda && <span className="block text-[11px] text-slate-400 mt-1">{ayuda}</span>}
    </label>
);

/** Control segmentado: dos opciones excluyentes, sin desplegar nada. */
const Segmentado = ({ opciones, valor, onChange }) => (
    <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
        {opciones.map(o => (
            <button
                key={o.valor}
                type="button"
                onClick={() => onChange(o.valor)}
                aria-pressed={valor === o.valor}
                className={`py-2 rounded-md text-sm font-semibold transition cursor-pointer ${
                    valor === o.valor
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                }`}
            >
                {o.label}
            </button>
        ))}
    </div>
);

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
    fotosAlCrear: []
};

const RegistroObservacion = ({ usuario, onCreada }) => {
    const [form, setForm] = useState(ESTADO_INICIAL);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const set = (campo, valor) => {
        setError('');
        setForm(prev => {
            const siguiente = { ...prev, [campo]: valor };
            // El turno se deduce de la hora, pero queda editable por si la
            // programacion cae en un cambio de turno.
            if (campo === 'hora') siguiente.turno = turnoPorHora(valor);
            return siguiente;
        });
    };

    const limpiar = () => {
        setForm({ ...ESTADO_INICIAL, fecha: hoyISO() });
        setError('');
    };

    const enviar = async (e) => {
        e.preventDefault();
        if (!form.tarea.trim()) return setError('Escribe la tarea que se va a observar.');
        if (!form.observador) return setError('Selecciona el observador en el directorio.');
        if (!form.ppf) return setError('Selecciona el PPF asociado a la tarea.');
        if (!form.area.trim()) return setError('Indica el área donde se hará la observación.');

        setLoading(true);
        try {
            await crearObservacion(form, usuario);
            limpiar();
            onCreada();
        } catch (err) {
            setError(`No se pudo guardar la observación: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto">
            <div className="mb-5">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Programar una observación</h2>
                <p className="text-sm text-slate-500 mt-1">
                    Define qué se va a observar, quién la hará y cuándo.
                </p>
            </div>

            <form onSubmit={enviar} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="flex items-start gap-3 px-4 sm:px-6 py-3.5 bg-blue-50 border-b border-blue-100">
                    <span className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                    <p className="text-xs text-blue-900 leading-relaxed">
                        La observación queda en estado <strong>Pendiente</strong>. Cuando pase la hora
                        programada, ábrela en <strong>Gestión de observaciones</strong> y márcala como
                        realizada o explica por qué no se hizo.
                    </p>
                </div>

                <Seccion numero={1} titulo="Qué se va a observar" descripcion="La tarea y el protocolo de peligros fatales asociado.">
                    <div className="space-y-4">
                        <Campo label="Tarea a observar" requerido>
                            <input
                                type="text"
                                className={inputCls}
                                value={form.tarea}
                                onChange={(e) => set('tarea', e.target.value)}
                                placeholder="Ej. Cambio de llanta en camión minero"
                            />
                        </Campo>

                        <div className="grid sm:grid-cols-2 gap-4">
                            <Campo label="PPF · Protocolo de Peligros Fatales" requerido>
                                <select
                                    className={selectCls}
                                    value={form.ppf}
                                    onChange={(e) => set('ppf', e.target.value)}
                                >
                                    <option value="">Selecciona un PPF...</option>
                                    {PPF.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </Campo>

                            <Campo label="¿Es una tarea rutinaria?" requerido>
                                <Segmentado
                                    valor={form.rutinario}
                                    onChange={(v) => set('rutinario', v)}
                                    opciones={[{ valor: 'Sí', label: 'Sí' }, { valor: 'No', label: 'No' }]}
                                />
                            </Campo>
                        </div>
                    </div>
                </Seccion>

                <Seccion numero={2} titulo="Quién la realiza" descripcion="Busca al observador en el directorio de la empresa.">
                    <Campo label="Observador" requerido>
                        <PeoplePicker
                            value={form.observador}
                            onChange={(p) => set('observador', p)}
                            placeholder="Busca por nombre o correo..."
                        />
                    </Campo>
                </Seccion>

                <Seccion numero={3} titulo="Cuándo y dónde">
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
                            <Campo label="Turno" ayuda="Se calcula por la hora.">
                                <select
                                    className={selectCls}
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
                                placeholder="Ej. Taller de equipo pesado — Patio 3"
                            />
                        </Campo>
                    </div>
                </Seccion>

                <Seccion
                    numero={4}
                    titulo="Fotos de referencia"
                    descripcion="Opcional. Sirven para identificar el equipo o el área antes de la observación."
                >
                    <SubidorFotos
                        fotos={form.fotosAlCrear}
                        onChange={(fotos) => set('fotosAlCrear', fotos)}
                        usuario={usuario}
                        tipo={TIPO_EVIDENCIA.OBSERVACION}
                    />
                </Seccion>

                {error && (
                    <div className="mx-4 sm:mx-6 mb-4 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                        <span aria-hidden="true">⚠</span>
                        <span>{error}</span>
                    </div>
                )}

                <div className="sticky bottom-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-4 sm:px-6 py-4 bg-slate-50 border-t border-slate-200">
                    <button
                        type="button"
                        onClick={limpiar}
                        className="px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-200 cursor-pointer"
                    >
                        Limpiar
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-5 py-2.5 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-slate-900 text-sm font-bold cursor-pointer disabled:opacity-60 disabled:cursor-wait inline-flex items-center justify-center gap-2"
                    >
                        {loading && <span className="w-4 h-4 border-2 border-slate-900/40 border-t-slate-900 rounded-full animate-spin" />}
                        {loading ? 'Guardando...' : 'Programar observación'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default RegistroObservacion;
