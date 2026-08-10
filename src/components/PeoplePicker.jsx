import React, { useState, useEffect, useRef } from 'react';
import { buscarPersonas, fotoDe } from '../utils/sharepointApi';

// Avatar por defecto cuando el directorio no tiene foto o la persona se
// agrego manualmente (no existe en el directorio activo).
const AVATAR_FALLBACK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%239ca3af' viewBox='0 0 24 24'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

const esCorreoValido = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export const Avatar = ({ persona, size = 'w-9 h-9' }) => (
    <img
        src={persona.manual ? AVATAR_FALLBACK : fotoDe(persona.email)}
        alt={persona.nombre || persona.email}
        className={`${size} rounded-full object-cover bg-slate-200 border border-slate-300 shrink-0`}
        onError={(e) => { e.target.src = AVATAR_FALLBACK; }}
    />
);

/**
 * Buscador de personas contra el directorio activo de SharePoint.
 *
 * Sobre el picker del proyecto CheckList agrega dos cosas: seleccion multiple
 * con chips y, con `permitirManual`, dar de alta a alguien que no aparece en el
 * directorio (contratistas, terceros). Esas personas quedan marcadas con
 * `manual: true` y solo guardan el correo escrito, sin nombre ni foto.
 *
 * value: { nombre, email, manual } | array de esos objetos si multiple.
 */
const PeoplePicker = ({ value, onChange, multiple = false, permitirManual = false, placeholder, autoFocus }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const wrapperRef = useRef(null);

    const seleccionados = multiple ? (value || []) : (value ? [value] : []);

    useEffect(() => {
        const onClickOutside = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setIsOpen(false);
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    // Debounce de 400ms: sin esto cada tecla dispara una llamada al People
    // Picker, que ademas pide un digest nuevo cada vez.
    useEffect(() => {
        if (query.trim().length < 2) {
            setResults([]);
            return;
        }
        const t = setTimeout(async () => {
            setLoading(true);
            try {
                const encontrados = await buscarPersonas(query.trim());
                setResults(encontrados);
                setIsOpen(true);
            } catch (error) {
                console.error('Error buscando personas:', error);
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 400);
        return () => clearTimeout(t);
    }, [query]);

    const yaEsta = (email) => seleccionados.some(p => p.email === email);

    const seleccionar = (persona) => {
        if (multiple) {
            if (!yaEsta(persona.email)) onChange([...seleccionados, persona]);
        } else {
            onChange(persona);
        }
        setQuery('');
        setResults([]);
        setIsOpen(false);
    };

    const quitar = (email) => {
        if (multiple) onChange(seleccionados.filter(p => p.email !== email));
        else onChange(null);
    };

    // Alta manual: solo se ofrece si lo escrito es un correo y no coincide con
    // ningun resultado del directorio.
    const puedeAgregarManual =
        permitirManual &&
        esCorreoValido(query) &&
        !results.some(r => r.email === query.trim().toLowerCase()) &&
        !yaEsta(query.trim().toLowerCase());

    const agregarManual = () => {
        const email = query.trim().toLowerCase();
        seleccionar({ nombre: email, email, manual: true });
    };

    const onKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (results.length === 1) seleccionar(results[0]);
            else if (puedeAgregarManual) agregarManual();
        }
    };

    const inputVisible = multiple || seleccionados.length === 0;

    return (
        <div className="relative w-full" ref={wrapperRef}>
            {seleccionados.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                    {seleccionados.map(p => (
                        <span
                            key={p.email}
                            className="inline-flex items-center gap-2 bg-slate-100 border border-slate-300 rounded-full pl-1 pr-2 py-1"
                        >
                            <Avatar persona={p} size="w-7 h-7" />
                            <span className="flex flex-col leading-tight">
                                <span className="text-xs font-semibold text-slate-800">{p.nombre}</span>
                                <span className="text-[10px] text-slate-500">
                                    {p.email}{p.manual && ' · agregado manualmente'}
                                </span>
                            </span>
                            <button
                                type="button"
                                onClick={() => quitar(p.email)}
                                className="text-slate-400 hover:text-red-600 font-bold px-1 cursor-pointer"
                                aria-label={`Quitar ${p.nombre}`}
                            >
                                ×
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {inputVisible && (
                <input
                    type="text"
                    autoFocus={autoFocus}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 outline-none"
                    placeholder={placeholder || 'Escribe un nombre o correo...'}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={onKeyDown}
                    onFocus={() => { if (results.length) setIsOpen(true); }}
                />
            )}

            {inputVisible && (
                <p className="text-[11px] text-slate-500 mt-1">
                    Busca en cualquier orden: <span className="font-semibold text-slate-600">Nombre Apellido</span> o{' '}
                    <span className="font-semibold text-slate-600">Apellido, Nombre</span>.
                    {permitirManual && ' Si no aparece en el directorio, escribe su correo completo y presiona Enter.'}
                </p>
            )}

            {loading && (
                <div className="absolute right-3 top-3 w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
            )}

            {isOpen && (results.length > 0 || puedeAgregarManual) && (
                <ul className="absolute z-50 w-full min-w-[280px] bg-white border border-slate-200 rounded-lg mt-1 max-h-64 overflow-y-auto shadow-xl">
                    {results.map(p => (
                        <li key={p.email}>
                            <button
                                type="button"
                                onClick={() => seleccionar(p)}
                                disabled={yaEsta(p.email)}
                                className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100 last:border-0 disabled:opacity-40 cursor-pointer"
                            >
                                <Avatar persona={p} />
                                <span className="flex flex-col leading-tight">
                                    <span className="text-sm font-semibold text-slate-800">{p.nombre}</span>
                                    <span className="text-xs text-slate-500">{p.email}</span>
                                </span>
                            </button>
                        </li>
                    ))}
                    {puedeAgregarManual && (
                        <li>
                            <button
                                type="button"
                                onClick={agregarManual}
                                className="w-full text-left px-3 py-2 bg-yellow-50 hover:bg-yellow-100 flex items-center gap-3 cursor-pointer"
                            >
                                <span className="w-9 h-9 rounded-full bg-yellow-400 text-white grid place-items-center font-bold shrink-0">+</span>
                                <span className="flex flex-col leading-tight">
                                    <span className="text-sm font-semibold text-slate-800">Agregar manualmente</span>
                                    <span className="text-xs text-slate-500">
                                        {query.trim()} · no está en el directorio
                                    </span>
                                </span>
                            </button>
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
};

export default PeoplePicker;
