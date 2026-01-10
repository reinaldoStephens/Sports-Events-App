# Sports Events App - Astro & Supabase

Este proyecto es una aplicación de gestión de eventos deportivos construida con **Astro** y **Supabase**. Permite a los administradores crear eventos, gestionar registros y a los usuarios inscribirse en ellos.

## 🚀 Tecnologías

- **Framework:** [Astro](https://astro.build/) (Modo SSR)
- **Base de Datos y Auth:** [Supabase](https://supabase.com/)
- **Estilos:** Tailwind CSS
- **Despliegue:** Vercel

## 📂 Estructura y Funcionamiento Backend

### 1. Middleware (`src/middleware.ts`)
El middleware actúa como una capa de seguridad que se ejecuta antes de cada petición.
- **Protección de Rutas:** Verifica si el usuario intenta acceder a `/admin`.
- **Validación de Sesión:** Lee los tokens de acceso (`sb-access-token`) y refresco (`sb-refresh-token`) de las cookies.
- **Roles:** Consulta la tabla `profiles` en Supabase para asegurar que solo los usuarios con el rol `admin` puedan entrar al panel de administración.
- **Contexto Local:** Si el usuario es válido, se guarda en `context.locals.user` para que esté disponible en todas las páginas de Astro.

### 2. Astro Actions (`src/actions/index.ts`)
Las [Actions](https://docs.astro.build/en/guides/actions/) de Astro son la forma moderna de manejar formularios y lógica de servidor de tipo RPC.
- **Validación con Zod:** Cada acción define un esquema de entrada estricto.
- **Lógica Centralizada:** Aquí se maneja el login (`signin`), el registro de invitados (`registerGuest`), la creación de eventos (`createEvent`) y más.
- **Seguridad:** A diferencia de las llamadas API tradicionales, las Actions se ejecutan siempre en el servidor, protegiendo las llaves secretas.

### 3. Conexión a Supabase (`src/lib/supabase.ts`)
Existen dos formas de conectarse a Supabase en este proyecto según el nivel de privilegios requerido:
- **Cliente Público (`anon`):** Se usa para operaciones que respetan las políticas de seguridad (RLS). Definido en `src/lib/supabase.ts`.
- **Cliente con Service Role:** En las `actions`, se utiliza la `SUPABASE_SERVICE_ROLE_KEY` para realizar operaciones administrativas (como borrar registros o subir imágenes) saltándose las RLS de forma segura en el servidor.

### 4. Seguridad de Nivel de Fila (RLS)
Supabase utiliza **RLS (Row Level Security)**. Esto significa que:
- Por defecto, nadie puede leer ni escribir en las tablas desde el cliente.
- Hemos definido políticas en SQL (ver carpeta `supabase/`) para permitir que el público vea eventos, pero solo el admin pueda modificarlos.
- **Punto Clave:** El backend usa el `service_role` para bypass, pero el frontend siempre debe usar el cliente público para mayor seguridad.

### 5. Gestión de Imágenes (Storage)
Las imágenes de los eventos se suben a un **Bucket de Supabase Storage** llamado `event-images`.
- Las `actions` procesan el archivo `File` enviado desde el formulario.
- Se genera un nombre único para evitar colisiones.
- Se obtiene la `publicUrl` para guardarla en la base de datos.

## 🔑 Variables de Entorno

Crea un archivo `.env` en la raíz con lo siguiente:

```env
PUBLIC_SUPABASE_URL=tu_url_de_supabase
PUBLIC_SUPABASE_ANON_KEY=tu_llave_anon_publica
SUPABASE_SERVICE_ROLE_KEY=tu_llave_secreta_de_servicio (NUNCA EXPONER)
```

> **Importante:** Las variables que empiezan por `PUBLIC_` son accesibles desde el navegador. La `SERVICE_ROLE_KEY` es secreta y solo vive en el servidor.

---

Desarrollado con ❤️ para la gestión de eventos deportivos.
