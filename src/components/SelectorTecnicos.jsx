import React from 'react';
import SelectorMultiple from './SelectorMultiple';
import { TALLERES, tecnicosDelTaller } from '../data/tecnicos';

// ---------------------------------------------------------------------------
// Taller y tecnicos a observar. Van juntos porque uno depende del otro: el
// taller decide que tecnicos se pueden escoger, y cambiarlo limpia la
// seleccion para que nadie quede asignado a un taller que no es el suyo.
//
// Con `tallerFijo` el taller se muestra pero no se toca: es el caso de una
// tarea que ya paso su ventana de edicion y solo admite cambiar a quien se
// observa.
// ---------------------------------------------------------------------------

const SelectorTecnicos = ({ taller, tecnicos = [], onChange, tallerFijo = false }) => {
    const opciones = tecnicosDelTaller(taller);

    const quitar = (nombre) => onChange({ taller, tecnicos: tecnicos.filter(t => t !== nombre) });

    return (
        <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
                <div>
                    <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Taller {!tallerFijo && <span className="text-red-500">*</span>}
                    </span>
                    {tallerFijo ? (
                        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                            {taller}
                        </p>
                    ) : (
                        <SelectorMultiple
                            opciones={TALLERES}
                            valor={taller}
                            onChange={(t) => onChange({ taller: t, tecnicos: t === taller ? tecnicos : [] })}
                            etiquetaVacia="Selecciona el taller"
                            ancho="w-full"
                        />
                    )}
                </div>
                <div>
                    <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Técnicos <span className="text-red-500">*</span>
                    </span>
                    {taller ? (
                        <SelectorMultiple
                            multiple
                            opciones={opciones}
                            valor={tecnicos}
                            onChange={(t) => onChange({ taller, tecnicos: t })}
                            etiquetaVacia="Selecciona uno o varios"
                            ancho="w-full"
                        />
                    ) : (
                        <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-400">
                            Primero escoge el taller.
                        </p>
                    )}
                </div>
            </div>

            {/* El boton del desplegable solo dice cuantos van: aqui se ven los
                nombres y se quita cualquiera sin abrir nada. */}
            {tecnicos.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                    {tecnicos.map(t => (
                        <li key={t} className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 rounded-full pl-2.5 pr-1 py-0.5">
                            {t}
                            <button
                                type="button"
                                onClick={() => quitar(t)}
                                aria-label={`Quitar a ${t}`}
                                className="w-4 h-4 grid place-items-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-800 cursor-pointer"
                            >
                                ×
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default SelectorTecnicos;
