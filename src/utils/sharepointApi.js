// ---------------------------------------------------------------------------
// Capa de acceso a SharePoint, portada del proyecto CheckList-Cerrejon.
//
// Mientras la data de observaciones viva en localStorage, SharePoint solo se usa
// para dos cosas: saber quien esta conectado y leer catalogos corporativos
// (superintendencias del directorio, personas del directorio activo). Cuando se
// creen las listas que haran de BD, saveToSPList/updateSPListItem ya estan aqui.
// ---------------------------------------------------------------------------
import { SITE_URL, SGIA_SITE_URL, JERARQUIA_LIST, SUPERINTENDENCIAS_FALLBACK, DIRECTORIO_DEMO } from '../data/constants';

const jsonHeaders = { "Accept": "application/json;odata=verbose" };

export const getRequestDigest = async () => {
    const res = await fetch(`${SITE_URL}/_api/contextinfo`, {
        method: 'POST',
        headers: jsonHeaders,
        credentials: 'same-origin'
    });
    const data = await res.json();
    return data.d.GetContextWebInformation.FormDigestValue;
};

export const getEntityType = async (listName) => {
    const res = await fetch(`${SITE_URL}/_api/web/lists/getbytitle('${listName}')`, {
        headers: jsonHeaders,
        credentials: 'same-origin'
    });
    const json = await res.json();
    return json.d.ListItemEntityTypeFullName;
};

export const saveToSPList = async (listName, data, digest) => {
    const entityType = await getEntityType(listName);
    const res = await fetch(`${SITE_URL}/_api/web/lists/getbytitle('${listName}')/items`, {
        method: 'POST',
        headers: {
            ...jsonHeaders,
            "Content-Type": "application/json;odata=verbose",
            "X-RequestDigest": digest
        },
        credentials: 'same-origin',
        body: JSON.stringify({ "__metadata": { "type": entityType }, ...data })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} guardando en ${listName}`);
    return res.json();
};

export const updateSPListItem = async (listName, itemId, data, digest) => {
    const entityType = await getEntityType(listName);
    const res = await fetch(`${SITE_URL}/_api/web/lists/getbytitle('${listName}')/items(${itemId})`, {
        method: 'POST',
        headers: {
            ...jsonHeaders,
            "Content-Type": "application/json;odata=verbose",
            "X-RequestDigest": digest,
            "X-HTTP-Method": "MERGE",
            "If-Match": "*"
        },
        credentials: 'same-origin',
        body: JSON.stringify({ "__metadata": { "type": entityType }, ...data })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} actualizando ${listName}`);
};

// Usuario conectado. Devuelve null si no hay sesion de SharePoint alcanzable
// (desarrollo local), para que App.jsx pueda caer al modo de pruebas.
export const getCurrentUser = async () => {
    try {
        const res = await fetch(`${SITE_URL}/_api/web/currentuser?$select=Email,Title`, {
            headers: jsonHeaders,
            credentials: 'same-origin'
        });
        if (!res.ok) return null;
        const data = await res.json();
        const email = data.d?.Email || data.d?.Title;
        if (!email) return null;
        return { email: email.toLowerCase(), nombre: data.d?.Title || email };
    } catch {
        return null;
    }
};

// URL de la foto de perfil del directorio activo. Misma que usa el
// PeoplePicker del proyecto de referencia.
export const fotoDe = (email, size = 'S') =>
    `https://glencore.sharepoint.com/_layouts/15/userphoto.aspx?size=${size}&accountname=${encodeURIComponent(email || '')}`;

// ---------------------------------------------------------------------------
// Directorio activo: busqueda de personas mientras se escribe.
// ---------------------------------------------------------------------------
export const buscarPersonas = async (query) => {
    try {
        return await buscarEnDirectorio(query);
    } catch {
        // Fuera de la red corporativa el People Picker no responde (CORS).
        // Devolvemos un directorio de demostracion para poder probar la app.
        const q = query.toLowerCase();
        return DIRECTORIO_DEMO.filter(
            p => p.nombre.toLowerCase().includes(q) || p.email.includes(q)
        );
    }
};

const buscarEnDirectorio = async (query) => {
    const digest = await getRequestDigest();
    const res = await fetch(
        `${SITE_URL}/_api/SP.UI.ApplicationPages.ClientPeoplePickerWebServiceInterface.clientPeoplePickerSearchUser`,
        {
            method: 'POST',
            headers: {
                ...jsonHeaders,
                "Content-Type": "application/json;odata=verbose",
                "X-RequestDigest": digest
            },
            credentials: 'same-origin',
            body: JSON.stringify({
                queryParams: {
                    __metadata: { type: "SP.UI.ApplicationPages.ClientPeoplePickerQueryParameters" },
                    AllowEmailAddresses: true,
                    AllowMultipleEntities: false,
                    AllUrlZones: false,
                    MaximumEntitySuggestions: 10,
                    PrincipalSource: 15,
                    PrincipalType: 1,
                    QueryString: query
                }
            })
        }
    );
    const data = await res.json();
    const encontrados = JSON.parse(data.d.ClientPeoplePickerSearchUser);
    return encontrados
        .map(u => ({
            nombre: u.DisplayText,
            email: (u.EntityData?.Email || u.Key || '').toLowerCase(),
            manual: false
        }))
        .filter(p => p.email);
};

// ---------------------------------------------------------------------------
// Lista JerarquiaL: fuente oficial de las superintendencias de la empresa.
//
// SharePoint no acepta el titulo visible de la columna en la API REST (codifica
// los caracteres especiales), asi que primero resolvemos el nombre real contra
// /fields y despues pedimos los items.
// ---------------------------------------------------------------------------
const COL_SUPERINTENDENCIA = 'SUPERINTENDENCIA';

const getFieldName = async (siteUrl, listName, title) => {
    const url = `${siteUrl}/_api/web/lists/getbytitle('${listName}')/fields?$select=Title,EntityPropertyName,InternalName&$filter=Hidden eq false&$top=500`;
    const res = await fetch(url, { headers: jsonHeaders, credentials: 'same-origin' });
    if (!res.ok) throw new Error(`HTTP ${res.status} leyendo columnas de ${listName}`);
    const json = await res.json();
    const fields = json.d?.results || [];
    const norm = (s) => (s || '').trim().toUpperCase();
    const f = fields.find(x => norm(x.Title) === norm(title))
        || fields.find(x => norm(x.InternalName) === norm(title))
        || fields.find(x => norm(x.Title).startsWith(norm(title)));
    return f ? f.EntityPropertyName : title;
};

// Trae todos los items siguiendo la paginacion (el tope duro es 5000 por peticion).
const getAllListItems = async (siteUrl, listName, selectCols) => {
    let url = `${siteUrl}/_api/web/lists/getbytitle('${listName}')/items?$select=${selectCols.join(',')}&$top=5000`;
    const all = [];
    let guard = 0;
    while (url && guard++ < 20) {
        const res = await fetch(url, { headers: jsonHeaders, credentials: 'same-origin' });
        if (!res.ok) throw new Error(`HTTP ${res.status} leyendo ${listName}`);
        const json = await res.json();
        all.push(...(json.d?.results || []));
        url = json.d?.__next || null;
    }
    return all;
};

// En JerarquiaL cada fila es una division, asi que la misma superintendencia se
// repite muchas veces: hay que deduplicar antes de llenar el select.
export const fetchSuperintendencias = async () => {
    try {
        const campo = await getFieldName(SGIA_SITE_URL, JERARQUIA_LIST, COL_SUPERINTENDENCIA);
        const rows = await getAllListItems(SGIA_SITE_URL, JERARQUIA_LIST, [campo]);
        const unicas = [...new Set(rows.map(r => (r[campo] || '').trim()).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b, 'es'));
        if (unicas.length) return { superintendencias: unicas, desdeSharePoint: true };
        return { superintendencias: SUPERINTENDENCIAS_FALLBACK, desdeSharePoint: false };
    } catch {
        // Fuera de la red corporativa esto siempre falla por CORS: seguimos con
        // el respaldo local en vez de dejar el formulario sin opciones.
        return { superintendencias: SUPERINTENDENCIAS_FALLBACK, desdeSharePoint: false };
    }
};

// Un registro viejo puede tener un valor que ya no existe en el catalogo. Lo
// anteponemos para no perderlo al editar.
export const conValorActual = (opciones, valor) =>
    valor && !opciones.includes(valor) ? [valor, ...opciones] : opciones;

// ---------------------------------------------------------------------------
// Base de datos: lista DB_GCOM
// ---------------------------------------------------------------------------
const DB_LIST = 'DB_GCOM';

export const getObservacionesDesdeSharePoint = async () => {
    try {
        const url = `${SGIA_SITE_URL}/_api/web/lists/getbytitle('${DB_LIST}')/items?$select=ID,Data&$top=5000`;
        const res = await fetch(url, { headers: jsonHeaders, credentials: 'same-origin' });
        if (!res.ok) throw new Error(`HTTP ${res.status} leyendo ${DB_LIST}`);
        const json = await res.json();
        const items = json.d?.results || [];
        return items
            .map(item => {
                try {
                    const data = JSON.parse(item.Data || '{}');
                    return { ...data, _spId: item.ID };
                } catch {
                    return null;
                }
            })
            .filter(Boolean);
    } catch (e) {
        console.error('Error leyendo observaciones:', e);
        return [];
    }
};

export const saveObservacionToSharePoint = async (datos) => {
    try {
        const digest = await getRequestDigest();
        const dataJson = JSON.stringify(datos);
        const res = await fetch(`${SGIA_SITE_URL}/_api/web/lists/getbytitle('${DB_LIST}')/items`, {
            method: 'POST',
            headers: {
                ...jsonHeaders,
                "Content-Type": "application/json;odata=verbose",
                "X-RequestDigest": digest
            },
            credentials: 'same-origin',
            body: JSON.stringify({
                "__metadata": { "type": "SP.ListItem" },
                "Data": dataJson
            })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const result = await res.json();
        return result.d.ID;
    } catch (e) {
        console.error('Error guardando observación:', e);
        throw e;
    }
};

export const updateObservacionInSharePoint = async (spId, datos) => {
    try {
        const digest = await getRequestDigest();
        const dataJson = JSON.stringify(datos);
        const res = await fetch(`${SGIA_SITE_URL}/_api/web/lists/getbytitle('${DB_LIST}')/items(${spId})`, {
            method: 'POST',
            headers: {
                ...jsonHeaders,
                "Content-Type": "application/json;odata=verbose",
                "X-RequestDigest": digest,
                "X-HTTP-Method": "MERGE",
                "If-Match": "*"
            },
            credentials: 'same-origin',
            body: JSON.stringify({
                "__metadata": { "type": "SP.ListItem" },
                "Data": dataJson
            })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
        console.error('Error actualizando observación:', e);
        throw e;
    }
};

// ---------------------------------------------------------------------------
// Carga de archivos a carpeta de evidencias
// ---------------------------------------------------------------------------
const EVIDENCIAS_FOLDER = '/sites/co-lmn-sgia/ac/SiteAssets/AppGCOM/Evidencias';

export const subirFotoEvidencia = async (file, nombreResponsable) => {
    try {
        const digest = await getRequestDigest();
        const timestamp = new Date();
        const año = timestamp.getFullYear();
        const mes = String(timestamp.getMonth() + 1).padStart(2, '0');
        const día = String(timestamp.getDate()).padStart(2, '0');
        const hora = String(timestamp.getHours()).padStart(2, '0');
        const nombreArchivo = `${nombreResponsable.replace(/\s+/g, '_')}_${año}${mes}${día}${hora}_${file.name}`;

        const url = `${SP_HOST}/sites/co-lmn-sgia/_api/web/GetFolderByServerRelativeUrl('${EVIDENCIAS_FOLDER}')/Files/add(url='${encodeURIComponent(nombreArchivo)}',overwrite=true)`;

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                "X-RequestDigest": digest,
                "Content-Length": file.size
            },
            credentials: 'same-origin',
            body: file
        });

        if (!res.ok) throw new Error(`HTTP ${res.status} subiendo archivo`);
        const result = await res.json();
        return {
            nombre: nombreArchivo,
            url: result.d.LinkingUrl || `${SP_HOST}/sites/co-lmn-sgia/ac/SiteAssets/AppGCOM/Evidencias/${nombreArchivo}`
        };
    } catch (e) {
        console.error('Error subiendo foto:', e);
        throw e;
    }
};
