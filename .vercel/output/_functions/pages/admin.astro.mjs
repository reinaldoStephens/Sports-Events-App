import { e as createComponent, f as createAstro, m as maybeRenderHead, h as addAttribute, r as renderTemplate, k as renderComponent } from '../chunks/astro/server_DmY11HuA.mjs';
import 'piccolore';
import { a as actions, s as supabase } from '../chunks/supabase_CS-9eM7J.mjs';
import { $ as $$Layout } from '../chunks/Layout_Cxedq6Qk.mjs';
import 'clsx';
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
  return renderTemplate`${maybeRenderHead()}<div class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300"> ${event.image_url && renderTemplate`<div class="aspect-video w-full overflow-hidden"> <img${addAttribute(event.image_url, "src")}${addAttribute(event.title, "alt")} class="w-full h-full object-cover transition-transform duration-300 hover:scale-105"> </div>`} <div class="p-4"> <div class="flex justify-between items-start"> <h2 class="text-xl font-bold text-gray-900 mb-2">${event.title}</h2> ${isAdmin && renderTemplate`<a${addAttribute(`/admin?edit=${event.id}`, "href")} class="bg-blue-100 text-blue-600 px-3 py-1 rounded text-sm hover:bg-blue-200 transition">
Editar
</a>`} </div> <p class="text-gray-500 text-sm mb-2 flex items-center"> <span class="mr-2">📅</span> ${formattedDate} </p> <p class="text-gray-500 text-sm mb-4 flex items-center"> <span class="mr-2">📍</span> ${event.location} </p> <p class="text-gray-700 line-clamp-3"> ${event.description} </p> </div> </div>`;
}, "C:/Users/reina/Documents/Practice/Astro/sports-events-app/src/components/EventCard.astro", void 0);

const $$Astro = createAstro();
const $$Index = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Index;
  const result = Astro2.getActionResult(actions.createEvent);
  const { data: events } = await supabase.from("events").select("*").order("date", { ascending: true });
  const editId = Astro2.url.searchParams.get("edit");
  let eventToEdit = null;
  if (editId) {
    const { data } = await supabase.from("events").select("*").eq("id", editId).single();
    eventToEdit = data;
  }
  const isEditMode = !!eventToEdit;
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Admin - Gesti\xF3n de Eventos" }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<main class="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8"> <div class="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8"> <!-- Formulario (Columna Izquierda) --> <div class="lg:col-span-1"> <div class="bg-white p-6 rounded-lg shadow sticky top-8"> <h2 class="text-2xl font-bold mb-6">${isEditMode ? "Editar Evento" : "Crear Nuevo Evento"}</h2> <form method="POST"${addAttribute(actions.createEvent, "action")} enctype="multipart/form-data" class="space-y-4"> ${isEditMode && renderTemplate`<input type="hidden" name="id"${addAttribute(eventToEdit.id, "value")}>`} <div> <label for="title" class="block text-sm font-medium text-gray-700">Título</label> <input type="text" name="title" id="title" required${addAttribute(eventToEdit?.title, "value")} class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"> </div> <div> <label for="date" class="block text-sm font-medium text-gray-700">Fecha</label> <input type="datetime-local" name="date" id="date" required${addAttribute(eventToEdit?.date ? new Date(eventToEdit.date).toISOString().slice(0, 16) : "", "value")} class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"> </div> <div> <label for="location" class="block text-sm font-medium text-gray-700">Ubicación</label> <input type="text" name="location" id="location" required${addAttribute(eventToEdit?.location, "value")} class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"> </div> <div> <label for="description" class="block text-sm font-medium text-gray-700">Descripción</label> <textarea name="description" id="description" rows="3" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border">${eventToEdit?.description}</textarea> </div> <div> <label for="image" class="block text-sm font-medium text-gray-700">Imagen</label> ${eventToEdit?.image_url && renderTemplate`<div class="mb-2"> <p class="text-xs text-gray-500">Imagen actual:</p> <img${addAttribute(eventToEdit.image_url, "src")} alt="Current" class="h-20 object-cover rounded mt-1"> </div>`} <input type="file" name="image" id="image" accept="image/*" class="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"> </div> <div class="flex gap-2"> <button type="submit" class="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"> ${isEditMode ? "Guardar Cambios" : "Publicar Evento"} </button> ${isEditMode && renderTemplate`<a href="/admin" class="flex-none px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 text-center flex items-center">
Cancelar
</a>`} </div> ${result?.error && renderTemplate`<div class="p-2 bg-red-100 text-red-700 text-sm rounded">${result.error.message}</div>`} ${!result?.error && result?.data && renderTemplate`<div class="p-2 bg-green-100 text-green-700 text-sm rounded">
Evento ${result.data.event?.title} guadado exitosamente!
</div>`} </form> </div> </div> <!-- Lista de Eventos (Columna Derecha) --> <div class="lg:col-span-2"> <h2 class="text-2xl font-bold mb-6">Eventos Publicados</h2> <div class="grid grid-cols-1 md:grid-cols-2 gap-6"> ${events?.map((event) => renderTemplate`${renderComponent($$result2, "EventCard", $$EventCard, { "event": event, "isAdmin": true })}`)} ${(!events || events.length === 0) && renderTemplate`<p class="text-gray-500 text-center col-span-2 py-8">No hay eventos publicados aún.</p>`} </div> </div> </div> </main> ` })}`;
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
