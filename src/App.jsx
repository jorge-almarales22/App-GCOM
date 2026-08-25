import React, { useState, useEffect, useRef } from 'react';
import { getCurrentUser, fetchSuperintendencias } from './utils/sharepointApi';
import { getObservaciones, inicializarCache, refrescarObservaciones, suscribir } from './utils/storage';
import { esAdmin, SUPERINTENDENCIAS_FALLBACK } from './data/constants';
import Navbar from './components/Navbar';
import RegistroObservacion from './components/RegistroObservacion';
import GestionObservaciones from './components/GestionObservaciones';
import Metricas from './components/Metricas';
import LoginDemo from './components/LoginDemo';

const KEY_USUARIO_DEMO = 'gcom_usuario_demo';
const INTERVALO_REFRESCO = 3000;

const App = () => {
    const [usuario, setUsuario] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [modoDemo, setModoDemo] = useState(false);
    const [superintendencias, setSuperintendencias] = useState(SUPERINTENDENCIAS_FALLBACK);
    // La app abre en el registro: es la accion mas frecuente del dia a dia.
    const [vista, setVista] = useState('registro');

    // El almacen avisa por suscripcion en cuanto cambia algo (lo escriba este
    // usuario o lo traiga el refresco), asi que ningun modulo tiene que pedir
    // una recarga ni el usuario volver a abrir la pantalla.
    const [observaciones, setObservaciones] = useState(getObservaciones);
    const [sincronizando, setSincronizando] = useState(false);
    const [ultimaSync, setUltimaSync] = useState(null);
    const montado = useRef(true);

    useEffect(() => {
        montado.current = true;
        return () => { montado.current = false; };
    }, []);

    useEffect(() => suscribir(setObservaciones), []);

    useEffect(() => {
        const iniciar = async () => {
            const spUser = await getCurrentUser();
            if (spUser) {
                setUsuario({ ...spUser, admin: esAdmin(spUser.email) });
            } else {
                setModoDemo(true);
                const guardado = localStorage.getItem(KEY_USUARIO_DEMO);
                if (guardado) {
                    const u = JSON.parse(guardado);
                    setUsuario({ ...u, admin: esAdmin(u.email) });
                }
            }
            const { superintendencias: sup } = await fetchSuperintendencias();
            setSuperintendencias(sup);
            await inicializarCache();
            setUltimaSync(new Date());
            setCargando(false);
        };
        iniciar();
    }, []);

    // Sondeo cada 3s contra SharePoint. Se encadena con setTimeout (no
    // setInterval) para no lanzar una peticion nueva si la anterior todavia no
    // ha respondido, y se detiene con la pestaña oculta para no gastar red.
    useEffect(() => {
        if (cargando) return;
        let temporizador;
        let vivo = true;

        const ciclo = async () => {
            if (!document.hidden) {
                setSincronizando(true);
                await refrescarObservaciones();
                if (!vivo) return;
                setSincronizando(false);
                setUltimaSync(new Date());
            }
            if (vivo) temporizador = setTimeout(ciclo, INTERVALO_REFRESCO);
        };

        temporizador = setTimeout(ciclo, INTERVALO_REFRESCO);
        return () => { vivo = false; clearTimeout(temporizador); };
    }, [cargando]);

    const entrarDemo = (u) => {
        localStorage.setItem(KEY_USUARIO_DEMO, JSON.stringify(u));
        setUsuario({ ...u, admin: esAdmin(u.email) });
    };

    const salirDemo = () => {
        localStorage.removeItem(KEY_USUARIO_DEMO);
        setUsuario(null);
    };

    if (cargando) {
        return (
            <div className="min-h-full grid place-items-center bg-slate-50 text-slate-600">
                <div className="text-center">
                    <div className="w-10 h-10 mx-auto mb-4 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                    <p className="font-semibold">Autenticando con Microsoft 365...</p>
                </div>
            </div>
        );
    }

    if (!usuario) return <LoginDemo onEntrar={entrarDemo} />;

    return (
        <div className="min-h-full bg-slate-50 flex flex-col">
            <Navbar
                usuario={usuario}
                vista={vista}
                onVista={setVista}
                modoDemo={modoDemo}
                onSalirDemo={salirDemo}
                sincronizando={sincronizando}
                ultimaSync={ultimaSync}
            />

            <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
                {vista === 'registro' && (
                    <RegistroObservacion usuario={usuario} onCreada={() => setVista('gestion')} />
                )}
                {vista === 'gestion' && (
                    <GestionObservaciones usuario={usuario} observaciones={observaciones} />
                )}
                {vista === 'metricas' && (
                    <Metricas observaciones={observaciones} superintendencias={superintendencias} usuario={usuario} />
                )}
            </main>

            <footer className="text-center text-xs text-slate-400 py-4 px-4">
                Gerencia de Gestión de Activos · Observaciones de Seguridad
            </footer>
        </div>
    );
};

export default App;
