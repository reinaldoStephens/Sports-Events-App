---
trigger: always_on
---

Reglas de Configuración (Stack & Arquitectura)
Tecnologías Base: Utiliza exclusivamente Astro para el frontend y Supabase como Backend-as-a-Service (BaaS). El despliegue se realiza en Vercel.

Seguridad de Datos: La base de datos debe estar protegida obligatoriamente mediante Row Level Security (RLS). Ninguna tabla debe ser accesible sin una política de seguridad definida.

Middleware de Acceso: Implementar un Middleware de Astro para centralizar la validación de sesiones de Supabase. Rutas privadas (como /admin/*) deben redirigir al login si no hay una sesión activa.

Estrategia de Renderizado Híbrido:

Utiliza Static Site Generation (SSG) para páginas públicas de alta visibilidad (calendarios generales, tablas de posiciones históricas, landing pages).

Utiliza Server-side Rendering (SSR) para el panel de administración, formularios de carga de resultados y cualquier ruta con datos sensibles o dinámicos en tiempo real.

Reglas de Desarrollo y Código
Tipado Estricto: Utiliza TypeScript de forma rigurosa. Genera y vincula los tipos directamente desde el esquema de Supabase utilizando Database['public']['Tables'] para garantizar la integridad de los datos entre DB y Frontend.

Lógica Server-Side: Toda la lógica crítica (actualización de marcadores, asignación de roles, validaciones complejas) debe ejecutarse en el servidor mediante Astro Actions o API Endpoints. Evita llamadas directas de escritura desde el cliente a Supabase.

Legibilidad: El código debe ser modular, autodocumentado y seguir principios de "Clean Code". Los nombres de funciones y variables deben ser descriptivos en el contexto de administración de torneos.

UI/UX: Utiliza Tailwind CSS para el diseño. Todos los componentes (tablas de posiciones, dashboards, formularios) deben ser 100% responsivos y seguir un enfoque de diseño modular y reutilizable.

Reglas de Optimización y Rendimiento
Eficiencia en Consultas: Prioriza filtros del lado del servidor en las consultas de Supabase (.select().eq()). No traigas datasets masivos para filtrarlos con JavaScript en el cliente.

Vistas de Base de Datos: Para cálculos complejos de torneos (como el cálculo automático de puntos, diferencia de goles y posiciones), prefiere el uso de PostgreSQL Views en Supabase para obtener resultados finales en una sola petición.

Gestión de Estado: Utiliza Nano Stores para el estado global compartido (ej. filtros de búsqueda de torneos o ID del torneo activo) para mantener el bundle de JS lo más ligero posible.

Manejo de Assets: Utiliza el componente <Image /> nativo de Astro para optimizar logos de equipos y fotos. Los archivos pesados deben gestionarse en Supabase Storage con políticas de acceso restringidas a administradores.

Elimina componentes y codigo que no se utilice. 

Pensar siempre que esta pagina debe de servir para otros deportes. De momento nos enfocamos en futbol. 

El usuario es reinaldo9519@gmail.com y el password admin

No duplicar codigo, utilizar componentes en las partes donde se pueda.

No utilizar Alert en cambio usar el componente ConfirmationModal. 

Siempre que se realice una actualizacion en la base de datos que requira refrescar la pagina mostrar el mensaje de notificacion luego de que se recargue la pagina. 

Para los mensajes de feedback usar siempre el componente de ToastNotification.