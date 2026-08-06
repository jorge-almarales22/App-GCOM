# App-GCOM · Observaciones de Seguridad

Aplicación para que la Gerencia de Gestión de Activos programe, gestione y
analice las observaciones de seguridad de cada turno.

## Stack

React 19 + Vite 8 + Tailwind CSS 4. Se publica dentro de SharePoint, por eso
`vite.config.js` usa `base: './'`.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # genera dist/
```

## Módulos

| Vista | Qué hace |
|---|---|
| **Registro programado** | Formulario "Registro de observaciones programadas": tarea, observador, PPF, rutinario, fecha/hora/turno, área, superintendencia. El estado nace en `Sin hallazgos`. |
| **Gestión de observaciones** | Tabla de las observaciones **de hoy** por defecto. Filtros por día / mes / año para el histórico y búsqueda libre. Solo el creador ve "Añadir hallazgos"; el resto ve "Ver detalle". |
| **Gráficas y métricas** | Tablero con una sola fila de filtros (rango de fechas, PPF, área, superintendencia, rutinario, estado) que alimenta todas las gráficas. Cada gráfica tiene su gemelo en tabla. |

### Reglas de negocio

- **Estado derivado**: una observación pasa a `Con hallazgos` en cuanto se le
  registra el primer hallazgo, y vuelve a `Sin hallazgos` si se eliminan todos.
- **Permisos**: solo quien creó la observación puede añadirle hallazgos.
- **Administradores** (`src/data/constants.js` → `ADMINS`): pueden comentar
  cualquier observación. Al comentar, le llega una notificación al creador y la
  fila queda marcada con 🚩 y fondo ámbar.
  `jorge.almarales.ext@cerrejon.com` es admin **temporal** para pruebas.
- **Turno**: se deduce de la hora (06:00–17:59 = Día), y sigue siendo editable.

## Integración con SharePoint

Se reutilizan los patrones del proyecto
[CheckList-Cerrejon](https://github.com/jorge-almarales22/CheckList-Cerrejon)
(rama `DEV`), en `src/utils/sharepointApi.js`:

- **Usuario conectado**: `/_api/web/currentuser`.
- **Directorio activo**: `clientPeoplePickerSearchUser` para el input inteligente,
  y `userphoto.aspx` para la foto de perfil.
- **Superintendencias**: lista `JerarquiaL` del sitio `co-lmn-sgia`, columna
  `SUPERINTENDENCIA`. El nombre real de la columna se resuelve contra `/fields`
  porque SharePoint codifica los títulos visibles en la API REST.
- `saveToSPList` / `updateSPListItem` ya están portadas para cuando existan las
  listas que harán de base de datos.

### Modo de pruebas

Fuera de la red corporativa las llamadas a SharePoint fallan por CORS. La app no
se rompe: cae a un usuario de prueba seleccionable, un directorio de
demostración (`DIRECTORIO_DEMO`) y una lista de superintendencias de respaldo.
Un banner ámbar avisa cuando está en ese modo.

## Persistencia

Hoy todo vive en `localStorage` (`gcom_observaciones`, `gcom_notificaciones`),
detrás de `src/utils/storage.js`. **Ningún componente toca `localStorage`
directamente**: para migrar a listas de SharePoint solo hay que reimplementar
ese archivo.

## Pendientes

- Reemplazar `TAREAS`, `PPF` y `AREAS` en `src/data/constants.js` por los
  catálogos reales.
- Crear las listas de SharePoint y migrar `storage.js`.
- Conectar el flujo de Power Automate para que la notificación al responsable
  también salga por correo/Teams.
- Quitar a `jorge.almarales.ext@cerrejon.com` de `ADMINS`.
