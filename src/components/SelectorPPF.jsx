import React from 'react';
import { PPF } from '../data/constants';

/**
 * Seleccion de protocolos de peligros fatales. Una tarea puede tocar varios a
 * la vez (un izaje en altura es Gruas y ademas Trabajo en Altura), asi que se
 * escogen como fichas que se encienden y se apagan.
 *
 * Fichas y no un desplegable multiple: los doce protocolos caben a la vista,
 * se leen completos y en un telefono se marcan con el dedo, sin abrir nada ni
 * pelear con el Ctrl+clic que exige un <select multiple>.
 */
const SelectorPPF = ({ valor = [], onChange }) => {
    const alternar = (ppf) =>
        onChange(valor.includes(ppf) ? valor.filter(p => p !== ppf) : [...valor, ppf]);

    return (
        <div>
            <div className="flex flex-wrap gap-1.5">
                {PPF.map(p => {
                    const activo = valor.includes(p);
                    return (
                        <button
                            key={p}
                            type="button"
                            onClick={() => alternar(p)}
                            aria-pressed={activo}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border text-left transition cursor-pointer ${
                                activo
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                            }`}
                        >
                            <span aria-hidden="true" className={activo ? 'mr-1' : 'mr-1 text-slate-300'}>
                                {activo ? '✓' : '+'}
                            </span>
                            {p}
                        </button>
                    );
                })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
                {valor.length === 0
                    ? 'Selecciona uno o varios protocolos.'
                    : `${valor.length} protocolo${valor.length === 1 ? '' : 's'} seleccionado${valor.length === 1 ? '' : 's'}.`}
            </p>
        </div>
    );
};

export default SelectorPPF;
