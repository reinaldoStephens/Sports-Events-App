import { e as createComponent, f as createAstro, m as maybeRenderHead, h as addAttribute, r as renderTemplate, l as renderComponent } from '../chunks/astro/server_CiWqt42D.mjs';
import 'piccolore';
import { a as actions } from '../chunks/virtual_DQnNVRSy.mjs';
import { s as supabase } from '../chunks/supabase_Cq0gtPaZ.mjs';
import { $ as $$Layout } from '../chunks/Layout_CxxGF-MF.mjs';
import 'clsx';
/* empty css                                 */
export { renderers } from '../renderers.mjs';

const $$Astro$1 = createAstro();
const $$EventCard = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$EventCard;
  const { event, isAdmin = false } = Astro2.props;
  const dateObj = new Date(event.date);
  const formattedDate = dateObj.toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  return renderTemplate`${maybeRenderHead()}<div class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300"> ${event.image_url && renderTemplate`<div class="aspect-video w-full overflow-hidden"> <img${addAttribute(event.image_url, "src")}${addAttribute(event.title, "alt")} class="w-full h-full object-cover transition-transform duration-300 hover:scale-105"> </div>`} <div class="p-4"> <div class="flex justify-between items-start"> <h2 class="text-xl font-bold text-gray-900 mb-2">${event.title}</h2> ${isAdmin && renderTemplate`<div class="flex gap-2"> <a${addAttribute(`/admin/events/${event.id}`, "href")} class="bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1 rounded-md text-sm hover:bg-indigo-100 transition shadow-sm">
Ver Participantes
</a> <a${addAttribute(`/admin?edit=${event.id}`, "href")} class="bg-white text-gray-600 border border-gray-200 px-3 py-1 rounded-md text-sm hover:bg-gray-50 transition shadow-sm">
Editar
</a> </div>`} </div> <p class="text-gray-500 text-sm mb-2 flex items-center"> <span class="mr-2">📅</span> ${formattedDate} </p> <p class="text-gray-500 text-sm mb-4 flex items-center"> <span class="mr-2">📍</span> ${event.location} </p> <p class="text-gray-700 line-clamp-3"> ${event.description} </p> </div> </div>`;
}, "C:/Users/reina/Documents/Practice/Astro/sports-events-app/src/components/EventCard.astro", void 0);

const $$Astro = createAstro();
const $$Index = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Index;
  const createResult = Astro2.getActionResult(actions.createEvent);
  const signoutResult = Astro2.getActionResult(actions.signout);
  if (signoutResult && !signoutResult.error) {
    return Astro2.redirect("/login");
  }
  const page = parseInt(Astro2.url.searchParams.get("page") || "1");
  const search = Astro2.url.searchParams.get("search") || "";
  const now = /* @__PURE__ */ new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
  const startDate = Astro2.url.searchParams.get("startDate") || firstDay;
  const endDate = Astro2.url.searchParams.get("endDate") || lastDay;
  const limit = 25;
  const start = (page - 1) * limit;
  const end = start + limit - 1;
  let query = supabase.from("events").select("*", { count: "exact" });
  if (search) {
    query = query.or(`title.ilike.%${search}%,location.ilike.%${search}%`);
  }
  if (startDate && endDate) {
    query = query.gte("date", startDate).lte("date", `${endDate}T23:59:59`);
  }
  const { data: events, count, error } = await query.order("date", { ascending: true }).range(start, end);
  const totalPages = count ? Math.ceil(count / limit) : 1;
  const editId = Astro2.url.searchParams.get("edit");
  let eventToEdit = null;
  if (editId) {
    const { data } = await supabase.from("events").select("*").eq("id", editId).single();
    eventToEdit = data;
  }
  const isEditMode = !!eventToEdit;
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Admin - Gesti\xF3n de Eventos", "data-astro-cid-u2h3djql": true }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<main class="min-h-screen bg-[#F0F4F8] py-8 px-4 sm:px-6 lg:px-8" data-astro-cid-u2h3djql> <div class="max-w-7xl mx-auto" data-astro-cid-u2h3djql> <!-- Header --> <div class="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4" data-astro-cid-u2h3djql> <h1 class="text-3xl font-bold text-slate-900 tracking-tight" data-astro-cid-u2h3djql>Panel de Administración</h1> <form${addAttribute(actions.signout, "action")} method="POST" data-astro-cid-u2h3djql> <button type="submit" class="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2" data-astro-cid-u2h3djql> <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-astro-cid-u2h3djql><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" data-astro-cid-u2h3djql></path><polyline points="16 17 21 12 16 7" data-astro-cid-u2h3djql></polyline><line x1="21" x2="9" y1="12" y2="12" data-astro-cid-u2h3djql></line></svg>
Cerrar Sesión
</button> </form> </div> <div class="grid grid-cols-1 lg:grid-cols-3 gap-8" data-astro-cid-u2h3djql> <!-- Formulario (Columna Izquierda 1/3) --> <div class="lg:col-span-1" data-astro-cid-u2h3djql> <div class="bg-white p-6 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] sticky top-8 border border-gray-100" data-astro-cid-u2h3djql> <div class="mb-6" data-astro-cid-u2h3djql> <h2 class="text-xl font-bold text-slate-900" data-astro-cid-u2h3djql> ${isEditMode ? "Editar Evento" : "Publicar Nuevo Evento"} </h2> <p class="text-slate-500 text-sm mt-1" data-astro-cid-u2h3djql> ${isEditMode ? "Modifica los detalles del evento." : "Completa los datos para un nuevo evento."} </p> </div> <form method="POST"${addAttribute(actions.createEvent, "action")} enctype="multipart/form-data" class="modern-form space-y-4" data-astro-cid-u2h3djql> ${isEditMode && renderTemplate`<input type="hidden" name="id"${addAttribute(eventToEdit.id, "value")} data-astro-cid-u2h3djql>`} <div class="form-group" data-astro-cid-u2h3djql> <label for="title" data-astro-cid-u2h3djql>Título</label> <input type="text" name="title" id="title" required${addAttribute(eventToEdit?.title, "value")} placeholder="Ej. Torneo Local" data-astro-cid-u2h3djql> </div> <div class="form-group" data-astro-cid-u2h3djql> <label for="date" data-astro-cid-u2h3djql>Fecha</label> <input type="datetime-local" name="date" id="date" required${addAttribute(eventToEdit?.date ? new Date(eventToEdit.date).toISOString().slice(0, 16) : "", "value")} data-astro-cid-u2h3djql> </div> <div class="form-group" data-astro-cid-u2h3djql> <label for="location" data-astro-cid-u2h3djql>Ubicación</label> <input type="text" name="location" id="location" required${addAttribute(eventToEdit?.location, "value")} placeholder="Ej. Estadio Principal" data-astro-cid-u2h3djql> </div> <div class="form-group" data-astro-cid-u2h3djql> <label for="description" data-astro-cid-u2h3djql>Descripción</label> <textarea name="description" id="description" rows="3" placeholder="Detalles..." data-astro-cid-u2h3djql>${eventToEdit?.description}</textarea> </div> <div class="form-group" data-astro-cid-u2h3djql> <label for="image" data-astro-cid-u2h3djql>Imagen</label> ${eventToEdit?.image_url && renderTemplate`<div class="mb-2 p-2 bg-slate-50 rounded border flex items-center gap-2" data-astro-cid-u2h3djql> <img${addAttribute(eventToEdit.image_url, "src")} alt="Current" class="h-10 w-10 object-cover rounded" data-astro-cid-u2h3djql> <span class="text-xs text-gray-500" data-astro-cid-u2h3djql>Actual</span> </div>`} <input type="file" name="image" id="image" accept="image/*" onchange="if(this.files[0] && this.files[0].size > 2 * 1024 * 1024) { alert('La imagen es muy pesada (Max 2MB).'); this.value = ''; }" data-astro-cid-u2h3djql> </div> <div class="pt-2 flex gap-2" data-astro-cid-u2h3djql> <button type="submit" class="submit-btn flex-1" data-astro-cid-u2h3djql> ${isEditMode ? "Guardar" : "Publicar"} </button> ${isEditMode && renderTemplate`<a href="/admin" class="cancel-btn bg-gray-100 flex-none px-4 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-600" data-astro-cid-u2h3djql>
✕
</a>`} </div> ${createResult?.error && renderTemplate`<div class="form-message error" data-astro-cid-u2h3djql>${createResult.error.message}</div>`} ${!createResult?.error && createResult?.data && renderTemplate`<div class="form-message success" data-astro-cid-u2h3djql>Guardado exitosamente!</div>`} </form> </div> </div> <!-- Lista de Eventos (Columna Derecha 2/3) --> <div class="lg:col-span-2 space-y-6" data-astro-cid-u2h3djql> <!-- Filtros y Busqueda --> <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100" data-astro-cid-u2h3djql> <form method="GET" class="flex flex-col xl:flex-row gap-4" data-astro-cid-u2h3djql> <div class="flex-1 relative min-w-[200px]" data-astro-cid-u2h3djql> <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-astro-cid-u2h3djql><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" data-astro-cid-u2h3djql></path></svg> <input type="text" name="search"${addAttribute(search, "value")} placeholder="Buscar..." class="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" data-astro-cid-u2h3djql> </div> <div class="flex gap-2 flex-col sm:flex-row" data-astro-cid-u2h3djql> <div class="flex items-center gap-2" data-astro-cid-u2h3djql> <span class="text-sm text-gray-500" data-astro-cid-u2h3djql>Desde:</span> <input type="date" name="startDate"${addAttribute(startDate, "value")} class="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-600 text-sm" data-astro-cid-u2h3djql> </div> <div class="flex items-center gap-2" data-astro-cid-u2h3djql> <span class="text-sm text-gray-500" data-astro-cid-u2h3djql>Hasta:</span> <input type="date" name="endDate"${addAttribute(endDate, "value")} class="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-600 text-sm" data-astro-cid-u2h3djql> </div> </div> <button type="submit" class="px-6 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors" data-astro-cid-u2h3djql>
Filtrar
</button> ${(search || startDate !== firstDay || endDate !== lastDay) && renderTemplate`<a href="/admin" class="px-4 py-2 border border-gray-200 text-gray-500 font-medium rounded-lg hover:bg-gray-50 flex items-center justify-center text-sm" data-astro-cid-u2h3djql>
Limpiar
</a>`} </form> </div> <div class="flex items-center justify-between" data-astro-cid-u2h3djql> <h2 class="text-xl font-bold text-slate-800" data-astro-cid-u2h3djql>Eventos (${count || 0})</h2> <span class="text-sm text-gray-500" data-astro-cid-u2h3djql>Página ${page} de ${totalPages}</span> </div> <div class="grid grid-cols-1 md:grid-cols-2 gap-6" data-astro-cid-u2h3djql> ${events?.map((event) => renderTemplate`${renderComponent($$result2, "EventCard", $$EventCard, { "event": event, "isAdmin": true, "data-astro-cid-u2h3djql": true })}`)} ${(!events || events.length === 0) && renderTemplate`<div class="col-span-2 py-12 text-center text-gray-500 bg-white rounded-xl border border-dashed border-gray-300" data-astro-cid-u2h3djql>
No se encontraron eventos.
</div>`} </div> <!-- Paginacion --> ${totalPages > 1 && renderTemplate`<div class="flex justify-center gap-2 mt-8" data-astro-cid-u2h3djql> <a${addAttribute(`?page=${page - 1}${search ? `&search=${search}` : ""}&startDate=${startDate}&endDate=${endDate}`, "href")}${addAttribute(`px-4 py-2 border rounded-md text-sm font-medium ${page <= 1 ? "pointer-events-none opacity-50 bg-gray-50 text-gray-400" : "bg-white text-gray-700 hover:bg-gray-50"}`, "class")} data-astro-cid-u2h3djql>
Anterior
</a> <span class="px-4 py-2 text-sm text-gray-600 flex items-center" data-astro-cid-u2h3djql> ${page} / ${totalPages} </span> <a${addAttribute(`?page=${page + 1}${search ? `&search=${search}` : ""}&startDate=${startDate}&endDate=${endDate}`, "href")}${addAttribute(`px-4 py-2 border rounded-md text-sm font-medium ${page >= totalPages ? "pointer-events-none opacity-50 bg-gray-50 text-gray-400" : "bg-white text-gray-700 hover:bg-gray-50"}`, "class")} data-astro-cid-u2h3djql>
Siguiente
</a> </div>`} </div> </div> </div> </main> ` })} `;
}, "C:/Users/reina/Documents/Practice/Astro/sports-events-app/src/pages/admin/index.astro", void 0);

const $$file = "C:/Users/reina/Documents/Practice/Astro/sports-events-app/src/pages/admin/index.astro";
const $$url = "/admin";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
