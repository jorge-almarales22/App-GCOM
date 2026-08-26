import React, { useState } from 'react';
import PeoplePicker from './PeoplePicker';
import SubidorFotos from './SubidorFotos';
import SelectorPPF from './SelectorPPF';
import SelectorMultiple from './SelectorMultiple';
import { crearObservacion, hoyISO, turnoPorHora } from '../utils/storage';
import { TURNOS } from '../data/constants';
import { TIPO_EVIDENCIA } from '../utils/sharepointApi';

// ---------------------------------------------------------------------------
// Registro de una tarea relevante en seguridad.
//
// Toda tarea —programada o no— dice QUE se observa, DONDE y CUANDO: una no
// programada tambien puede quedar para dentro de tres dias. Lo que agrega
// marcarla como programada es a QUIENES se les asigna y las fotos de
// referencia, que es lo unico que exige planearla con anticipacion.
// ---------------------------------------------------------------------------

const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200';

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

const ESTADO_INICIAL = {
    tarea: '',
    observadores: [],
    ppfs: [],
    rutinario: 'Sí',
    programada: false,
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

    /**
     * Una no programada guarda lo mismo que se escribio arriba —incluida su
     * fecha, que puede ser de aqui a tres dias— pero sin observadores
     * asignados ni fotos de referencia: el observador es quien la registra,
     * porque nadie mas pudo haber visto esa tarea.
     */
    const cuerpoDelRegistro = () => {
        if (form.programada) return form;
        return {
            tarea: form.tarea,
            ppfs: form.ppfs,
            rutinario: form.rutinario,
            programada: false,
            fecha: form.fecha,
            hora: form.hora,
            turno: form.turno,
            observadores: [{ nombre: usuario.nombre, email: usuario.email, manual: false }],
            area: form.area,
            fotosAlCrear: []
        };
    };

    const enviar = async (e) => {
        e.preventDefault();
        if (!form.tarea.trim()) return setError('Escribe la tarea que se va a observar.');
        if (!form.ppfs.length) return setError('Selecciona al menos un PPF asociado a la tarea.');
        if (!form.area.trim()) return setError('Indica el área donde se hará la observación.');
        if (!form.fecha) return setError('Indica el día de la observación.');
        if (!form.hora) return setError('Indica la hora de la observación.');
        if (form.programada && !form.observadores.length) {
            return setError('Asigna al menos un observador en el directorio.');
        }

        setLoading(true);
        try {
            await crearObservacion(cuerpoDelRegistro(), usuario);
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
            <form onSubmit={enviar} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <Seccion
                    numero={1}
                    titulo="Registro de Tarea Relevante en seguridad"
                    descripcion="La tarea, sus protocolos de peligros fatales, dónde y a qué hora se observa."
                >
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

                        <Campo label="PPF · Protocolos de Peligros Fatales" requerido>
                            <SelectorPPF valor={form.ppfs} onChange={(v) => set('ppfs', v)} />
                        </Campo>

                        <Campo label="Área" requerido>
                            <input
                                type="text"
                                className={inputCls}
                                value={form.area}
                                onChange={(e) => set('area', e.target.value)}
                                placeholder="Ej. Taller de equipo pesado — Patio 3"
                            />
                        </Campo>

                        {/* Dia y hora para cualquier tarea: una no programada
                            tambien puede quedar para dentro de tres dias. */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <Campo label="Día de la observación" requerido>
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
                                <SelectorMultiple
                                    opciones={TURNOS}
                                    valor={form.turno}
                                    onChange={(v) => set('turno', v)}
                                    ancho="w-full"
                                />
                            </Campo>
                            <Campo label="¿Es rutinaria?" requerido>
                                <Segmentado
                                    valor={form.rutinario}
                                    onChange={(v) => set('rutinario', v)}
                                    opciones={[{ valor: 'Sí', label: 'Sí' }, { valor: 'No', label: 'No' }]}
                                />
                            </Campo>
                        </div>

                        {/* Este check decide el tamaño del formulario: sin el, lo
                            anterior es todo lo que hay que llenar. */}
                        <div className={`rounded-lg border p-3 transition ${
                            form.programada ? 'border-yellow-300 bg-yellow-50/60' : 'border-slate-200 bg-slate-50'
                        }`}>
                            <label className="flex items-start gap-2.5 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.programada}
                                    onChange={(e) => set('programada', e.target.checked)}
                                    className="w-4 h-4 mt-0.5 accent-yellow-500 cursor-pointer shrink-0"
                                />
                                <span>
                                    <span className="block text-xs font-semibold text-slate-800">
                                        ¿Es programada?
                                    </span>
                                    <span className="block text-[11px] text-slate-500 mt-0.5">
                                        {form.programada
                                            ? 'Sí. Indica abajo a quiénes se les asigna.'
                                            : 'No. Queda registrada a tu nombre con lo que acabas de escribir.'}
                                    </span>
                                </span>
                            </label>
                        </div>
                    </div>
                </Seccion>

                {form.programada && (
                    <>
                        <Seccion
                            numero={2}
                            titulo="Quiénes la realizan"
                            descripcion="Busca en el directorio de la empresa. Puedes asignar más de un observador."
                        >
                            <Campo label="Observadores" requerido>
                                <PeoplePicker
                                    multiple
                                    value={form.observadores}
                                    onChange={(p) => set('observadores', p)}
                                    placeholder="Busca por nombre o correo..."
                                />
                            </Campo>
                        </Seccion>

                        <Seccion
                            numero={3}
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
                    </>
                )}

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
                        {loading
                            ? 'Guardando...'
                            : form.programada ? 'Programar observación' : 'Registrar tarea'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default RegistroObservacion;
