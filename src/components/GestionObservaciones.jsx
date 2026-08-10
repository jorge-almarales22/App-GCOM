import React, { useState, useMemo } from 'react';
import { Avatar } from './PeoplePicker';
import ModalObservacion from './ModalObservacion';
import { hoyISO, puedeGestionar, tieneComentarioAdmin } from '../utils/storage';
import { ESTADOS } from '../data/constants';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const PERIODOS = [
    { id: 'hoy', label: 'Hoy' },
    { id: 'dia', label: 'Por día' },
    { id: 'mes', label: 'Por mes' },
    { id: 'anio', label: 'Por año' }
];

export const filtrarPorPeriodo = (observaciones, periodo, { dia, mes, anio }) => {
    switch (periodo) {
        case 'hoy':
            return observaciones.filter(o => o.fecha === hoyISO());
        case 'dia':
            return observaciones.filter(o => o.fecha === dia);
        case 'mes':
            return observaciones.filter(o => o.fecha?.startsWith(`${anio}-${String(mes).padStart(2, '0')}`));
        case 'anio':
            return observaciones.filter(o => o.fecha?.startsWith(String(anio)));
        default:
            return observaciones;
    }
};

const BadgeEstado = ({ estado, cantidad }) =>
    estado === ESTADOS.CON_HALLAZGOS ? (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full bg-red-100 text-red-800 whitespace-nowrap">
            ⚠ {cantidad} hallazgo{cantidad === 1 ? '' : 's'}
        </span>
    ) : (
        <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 whitespace-nowrap">
            Sin hallazgos
        </span>
    );

const BadgeRealizada = ({ realizada }) =>
    realizada ? (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full bg-green-100 text-green-800 whitespace-nowrap">
            ✓ Realizada
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full bg-orange-100 text-orange-800 whitespace-nowrap">
            ✗ No realizada
        </span>
    );

const GestionObservaciones = ({ usuario, observaciones, onCambio }) => {
    const hoy = new Date();
    const [periodo, setPeriodo] = useState('hoy');
    const [dia, setDia] = useState(hoyISO());
    const [mes, setMes] = useState(hoy.getMonth() + 1);
    const [anio, setAnio] = useState(hoy.getFullYear());
    const [texto, setTexto] = useState('');
    const [fRealizada, setFRealizada] = useState('');
    const [seleccion, setSeleccion] = useState(null);

    const filtradas = useMemo(() => {
        const base = filtrarPorPeriodo(observaciones, periodo, { dia, mes, anio });

        let conFiltros = base;
        if (fRealizada) {
            conFiltros = conFiltros.filter(o => o.realizada === (fRealizada === 'realizada'));
        }

        const q = texto.trim().toLowerCase();
        const conTexto = q
            ? conFiltros.filter(o =>
                [o.tarea, o.ppf, o.area, o.observador?.nombre, o.observador?.email]
                    .some(v => (v || '').toLowerCase().includes(q)))
            : conFiltros;

        return [...conTexto].sort((a, b) =>
            a.fecha === b.fecha ? a.hora.localeCompare(b.hora) : a.fecha.localeCompare(b.fecha));
    }, [observaciones, periodo, dia, mes, anio, texto, fRealizada]);

    const obsAbierta = seleccion ? filtradas.find(o => o.id === seleccion) || observaciones.find(o => o.id === seleccion) : null;

    const conHallazgos = filtradas.filter(o => o.estado === ESTADOS.CON_HALLAZGOS).length;
    const realizadas = filtradas.filter(o => o.realizada).length;

    return (
        <div>
            <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Gestión de observaciones</h2>
                    <p className="text-sm text-slate-500 mt-1">
                        {periodo === 'hoy'
                            ? `Observaciones programadas para hoy, ${hoy.toLocaleDateString('es-CO', { dateStyle: 'long' })}`
                            : 'Consulta histórica de observaciones'}
                    </p>
                </div>
                <div className="flex gap-3 text-center">
                    <div className="px-4 py-2 rounded-xl bg-white border border-slate-200">
                        <p className="text-xl font-bold text-slate-900">{filtradas.length}</p>
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Programadas</p>
                    </div>
                    <div className="px-4 py-2 rounded-xl bg-white border border-slate-200">
                        <p className="text-xl font-bold text-green-600">{realizadas}</p>
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Realizadas</p>
                    </div>
                    <div className="px-4 py-2 rounded-xl bg-white border border-slate-200">
                        <p className="text-xl font-bold text-red-600">{conHallazgos}</p>
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Con hallazgos</p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4 flex flex-wrap items-center gap-3">
                <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                    {PERIODOS.map(p => (
                        <button
                            key={p.id}
                            onClick={() => setPeriodo(p.id)}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                                periodo === p.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                {periodo === 'dia' && (
                    <input
                        type="date"
                        value={dia}
                        onChange={(e) => setDia(e.target.value)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-yellow-500"
                    />
                )}
                {periodo === 'mes' && (
                    <>
                        <select
                            value={mes}
                            onChange={(e) => setMes(Number(e.target.value))}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-yellow-500"
                        >
                            {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                        </select>
                        <input
                            type="number"
                            value={anio}
                            onChange={(e) => setAnio(Number(e.target.value))}
                            className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-yellow-500"
                        />
                    </>
                )}
                {periodo === 'anio' && (
                    <input
                        type="number"
                        value={anio}
                        onChange={(e) => setAnio(Number(e.target.value))}
                        className="w-28 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-yellow-500"
                    />
                )}

                <select
                    value={fRealizada}
                    onChange={(e) => setFRealizada(e.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-yellow-500"
                >
                    <option value="">Todas las observaciones</option>
                    <option value="realizada">Solo realizadas</option>
                    <option value="no-realizada">Solo no realizadas</option>
                </select>

                <input
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    placeholder="Buscar por tarea, PPF, área, observador..."
                    className="flex-1 min-w-[220px] rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-yellow-500"
                />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-left">
                            <tr className="text-[10px] uppercase tracking-wide text-slate-500">
                                <th className="px-4 py-3 font-bold">Hora</th>
                                <th className="px-4 py-3 font-bold">Tarea</th>
                                <th className="px-4 py-3 font-bold">Observador</th>
                                <th className="px-4 py-3 font-bold">PPF</th>
                                <th className="px-4 py-3 font-bold">Área</th>
                                <th className="px-4 py-3 font-bold">Rut.</th>
                                <th className="px-4 py-3 font-bold">Realizada</th>
                                <th className="px-4 py-3 font-bold">Estado</th>
                                <th className="px-4 py-3 font-bold text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtradas.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                                        No hay observaciones para este periodo.
                                    </td>
                                </tr>
                            )}
                            {filtradas.map(o => {
                                const comentada = tieneComentarioAdmin(o);
                                return (
                                    <tr
                                        key={o.id}
                                        className={`hover:bg-slate-50 ${comentada ? 'bg-amber-50/60' : ''}`}
                                    >
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className="font-bold text-slate-900">{o.hora}</span>
                                            <span className="block text-[10px] text-slate-400">
                                                {o.turno} · {o.fecha}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 max-w-[220px]">
                                            <div className="flex items-start gap-2">
                                                {comentada && (
                                                    <span
                                                        title="Comentada por gerencia"
                                                        className="text-amber-500 shrink-0"
                                                    >
                                                        🚩
                                                    </span>
                                                )}
                                                <span className="text-slate-800">{o.tarea}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {o.observador ? (
                                                <div className="flex items-center gap-2 min-w-[160px]">
                                                    <Avatar persona={o.observador} size="w-7 h-7" />
                                                    <span className="leading-tight">
                                                        <span className="block text-xs font-semibold text-slate-800">
                                                            {o.observador.nombre}
                                                        </span>
                                                        <span className="block text-[10px] text-slate-500">
                                                            {o.observador.email}
                                                        </span>
                                                    </span>
                                                </div>
                                            ) : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-600 max-w-[160px]">{o.ppf}</td>
                                        <td className="px-4 py-3 text-xs text-slate-600">{o.area}</td>
                                        <td className="px-4 py-3 text-xs text-slate-600">{o.rutinario}</td>
                                        <td className="px-4 py-3">
                                            <BadgeRealizada realizada={o.realizada} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <BadgeEstado estado={o.estado} cantidad={o.hallazgos?.length || 0} />
                                        </td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            <button
                                                onClick={() => setSeleccion(o.id)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                                                    puedeGestionar(o, usuario)
                                                        ? 'bg-yellow-400 hover:bg-yellow-500 text-slate-900'
                                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                                }`}
                                            >
                                                {puedeGestionar(o, usuario) ? 'Editar' : 'Ver detalle'}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {obsAbierta && (
                <ModalObservacion
                    obs={obsAbierta}
                    usuario={usuario}
                    onCerrar={() => setSeleccion(null)}
                    onCambio={onCambio}
                />
            )}
        </div>
    );
};

export default GestionObservaciones;
