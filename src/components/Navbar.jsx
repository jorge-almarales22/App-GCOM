import React from 'react';
import { Avatar } from './PeoplePicker';
import Notificaciones from './Notificaciones';

const TABS = [
    { id: 'gestion', label: 'Gestión de observaciones' },
    { id: 'registro', label: 'Registro programado' },
    { id: 'metricas', label: 'Gráficas y métricas' }
];

const Navbar = ({ usuario, vista, onVista, modoDemo, onSalirDemo }) => (
    <header className="bg-slate-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between gap-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-yellow-400 text-slate-900 grid place-items-center font-black shrink-0">
                        OS
                    </div>
                    <div className="min-w-0">
                        <h1 className="font-bold leading-tight truncate">Observaciones de Seguridad</h1>
                        <p className="text-[11px] text-white/50 leading-tight truncate">
                            Gerencia de Gestión de Activos
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
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
                    {modoDemo && (
                        <button
                            onClick={onSalirDemo}
                            className="text-[11px] px-2 py-1 rounded border border-white/20 hover:bg-white/10 cursor-pointer"
                        >
                            Cambiar usuario
                        </button>
                    )}
                </div>
            </div>

            <nav className="flex gap-1 overflow-x-auto">
                {TABS.map(t => (
                    <button
                        key={t.id}
                        onClick={() => onVista(t.id)}
                        className={`px-4 py-2 text-sm font-semibold whitespace-nowrap border-b-2 transition cursor-pointer ${
                            vista === t.id
                                ? 'border-yellow-400 text-yellow-400'
                                : 'border-transparent text-white/60 hover:text-white'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </nav>
        </div>

        {modoDemo && (
            <div className="bg-amber-500/90 text-slate-900 text-[11px] text-center py-1 font-semibold">
                Modo de pruebas: sin sesión de SharePoint. Los datos se guardan solo en este navegador.
            </div>
        )}
    </header>
);

export default Navbar;
