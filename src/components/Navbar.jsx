import React, { useEffect, useState } from 'react';
import { Avatar } from './PeoplePicker';
import Notificaciones from './Notificaciones';

const TABS = [
    { id: 'gestion', label: 'Gestión de observaciones', corto: 'Gestión' },
    { id: 'registro', label: 'Registro programado', corto: 'Registrar' },
    { id: 'metricas', label: 'Gráficas y métricas', corto: 'Métricas' }
];

// Indicador de datos en vivo: confirma que lo que se ve esta al dia sin que el
// usuario tenga que recargar la pantalla.
const EnVivo = ({ sincronizando, ultimaSync }) => {
    const [, tick] = useState(0);

    // La etiqueta es relativa ("hace 12 s"), asi que hay que repintarla aunque
    // no llegue ningun dato nuevo.
    useEffect(() => {
        const t = setInterval(() => tick(n => n + 1), 1000);
        return () => clearInterval(t);
    }, []);

    const segundos = ultimaSync ? Math.max(0, Math.round((Date.now() - ultimaSync.getTime()) / 1000)) : null;

    return (
        <span
            className="hidden md:inline-flex items-center gap-1.5 text-[11px] text-white/60"
            title="La información se actualiza automáticamente cada 3 segundos"
        >
            <span className={`w-1.5 h-1.5 rounded-full ${sincronizando ? 'bg-yellow-400 animate-pulse' : 'bg-emerald-400'}`} />
            {segundos === null ? 'Conectando...' : segundos < 5 ? 'Datos en vivo' : `Actualizado hace ${segundos} s`}
        </span>
    );
};

const Navbar = ({ usuario, vista, onVista, modoDemo, onSalirDemo, sincronizando, ultimaSync }) => (
    <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-4">
            <div className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-yellow-400 text-slate-900 grid place-items-center font-black shrink-0">
                        OS
                    </div>
                    <div className="min-w-0">
                        <h1 className="font-bold leading-tight truncate text-sm sm:text-base">
                            Observaciones de Seguridad
                        </h1>
                        <p className="text-[11px] text-white/50 leading-tight truncate">
                            Gerencia de Gestión de Activos
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <EnVivo sincronizando={sincronizando} ultimaSync={ultimaSync} />
                    <Notificaciones usuario={usuario} />
                    <div className="hidden sm:flex items-center gap-2">
                        <Avatar persona={{ email: usuario.email, nombre: usuario.nombre }} size="w-8 h-8" />
                        <div className="leading-tight">
                            <p className="text-xs font-semibold">{usuario.nombre}</p>
                            <p className="text-[10px] text-white/50">
                                {usuario.admin ? 'Administrador' : 'Supervisor'}
                            </p>
                        </div>
                    </div>
                    <Avatar
                        persona={{ email: usuario.email, nombre: usuario.nombre }}
                        size="w-8 h-8 sm:hidden"
                    />
                    {modoDemo && (
                        <button
                            onClick={onSalirDemo}
                            className="hidden sm:block text-[11px] px-2 py-1 rounded border border-white/20 hover:bg-white/10 cursor-pointer"
                        >
                            Cambiar usuario
                        </button>
                    )}
                </div>
            </div>

            <nav className="flex gap-1 overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
                {TABS.map(t => (
                    <button
                        key={t.id}
                        onClick={() => onVista(t.id)}
                        className={`px-3 sm:px-4 py-2 text-sm font-semibold whitespace-nowrap border-b-2 transition cursor-pointer ${
                            vista === t.id
                                ? 'border-yellow-400 text-yellow-400'
                                : 'border-transparent text-white/60 hover:text-white'
                        }`}
                    >
                        <span className="hidden sm:inline">{t.label}</span>
                        <span className="sm:hidden">{t.corto}</span>
                    </button>
                ))}
            </nav>
        </div>

        {modoDemo && (
            <div className="bg-amber-500/90 text-slate-900 text-[11px] text-center py-1 px-3 font-semibold">
                Modo de pruebas: sin sesión de SharePoint. Los datos se guardan solo en este navegador.
            </div>
        )}
    </header>
);

export default Navbar;
