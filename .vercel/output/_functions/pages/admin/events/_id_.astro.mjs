import { e as createComponent, m as maybeRenderHead, k as renderScript, r as renderTemplate, f as createAstro, l as renderComponent, h as addAttribute } from '../../../chunks/astro/server_CiWqt42D.mjs';
import 'piccolore';
import { $ as $$Layout } from '../../../chunks/Layout_CxxGF-MF.mjs';
import { createClient } from '@supabase/supabase-js';
import { $ as $$RegistrationModal } from '../../../chunks/RegistrationModal_CCWxPho-.mjs';
import 'clsx';
export { renderers } from '../../../renderers.mjs';

const $$ToastNotification = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${maybeRenderHead()}<div id="toast-container" class="fixed bottom-4 right-4 z-50 flex flex-col gap-2"></div> <template id="toast-template"> <div class="toast flex items-center w-full max-w-xs p-4 text-gray-500 bg-white rounded-lg shadow dark:text-gray-400 dark:bg-gray-800 transition-all duration-300 transform translate-x-full opacity-0" role="alert"> <div class="inline-flex items-center justify-center flex-shrink-0 w-8 h-8 text-green-500 bg-green-100 rounded-lg dark:bg-green-800 dark:text-green-200"> <svg class="w-5 h-5 icon-success hidden" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20"> <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5Zm3.707 8.207-4 4a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L9 10.586l3.293-3.293a1 1 0 0 1 1.414 1.414Z"></path> </svg> <svg class="w-5 h-5 icon-error hidden text-red-500 bg-red-100 rounded-lg" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20"> <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5Zm3.707 11.793a1 1 0 1 1-1.414 1.414L10 11.414l-2.293 2.293a1 1 0 0 1-1.414-1.414L8.586 10 6.293 7.707a1 1 0 0 1 1.414-1.414L10 8.586l2.293-2.293a1 1 0 0 1 1.414 1.414L11.414 10l2.293 2.293Z"></path> </svg> </div> <div class="ml-3 text-sm font-normal toast-message">Item moved successfully.</div> <button type="button" class="ml-auto -mx-1.5 -my-1.5 bg-white text-gray-400 hover:text-gray-900 rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 hover:bg-gray-100 inline-flex items-center justify-center h-8 w-8 dark:text-gray-500 dark:hover:text-white dark:bg-gray-800 dark:hover:bg-gray-700" aria-label="Close" onclick="this.parentElement.remove()"> <span class="sr-only">Close</span> <svg class="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14"> <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"></path> </svg> </button> </div> </template> ${renderScript($$result, "C:/Users/reina/Documents/Practice/Astro/sports-events-app/src/components/ToastNotification.astro?astro&type=script&index=0&lang.ts")}`;
}, "C:/Users/reina/Documents/Practice/Astro/sports-events-app/src/components/ToastNotification.astro", void 0);

const $$ConfirmationModal = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${maybeRenderHead()}<dialog id="confirmation-modal" class="rounded-xl shadow-2xl p-0 backdrop:bg-black/50 backdrop:backdrop-blur-sm w-full max-w-sm m-auto open:animate-fade-in"> <div class="bg-white p-6 rounded-xl"> <div class="mb-4 text-center"> <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4"> <svg class="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path> </svg> </div> <h3 class="text-lg leading-6 font-medium text-gray-900" id="modal-title">Confirmar Acción</h3> <div class="mt-2"> <p class="text-sm text-gray-500" id="modal-desc">¿Estás seguro de que deseas realizar esta acción? No se puede deshacer.</p> </div> </div> <div class="mt-5 sm:mt-6 flex justify-center gap-3"> <button type="button" id="cancel-btn" class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:w-auto sm:text-sm" onclick="document.getElementById('confirmation-modal').close()">
Cancelar
</button> <button type="button" id="confirm-btn" class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none sm:w-auto sm:text-sm">
Confirmar
</button> </div> </div> </dialog> ${renderScript($$result, "C:/Users/reina/Documents/Practice/Astro/sports-events-app/src/components/ConfirmationModal.astro?astro&type=script&index=0&lang.ts")}`;
}, "C:/Users/reina/Documents/Practice/Astro/sports-events-app/src/components/ConfirmationModal.astro", void 0);

const $$Astro = createAstro();
const $$id = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$id;
  const { id } = Astro2.params;
  if (!id) {
    return Astro2.redirect("/admin");
  }
  const supabaseUrl = "https://ipyjwlxkvuozekwvmdug.supabase.co";
  const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWp3bHhrdnVvemVrd3ZtZHVnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzc5ODUwOSwiZXhwIjoyMDgzMzc0NTA5fQ.Q_u9UvUxqcFDjuzmryZp5QX43qKlajrTP4QpIfWrwSA";
  const adminSupabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: event, error: eventError } = await adminSupabase.from("events").select("*").eq("id", id).single();
  if (eventError || !event) {
    console.error("Event not found", eventError);
    return Astro2.redirect("/admin");
  }
  const { data: registrations, error: regError } = await adminSupabase.from("registrations").select("id, registration_date, name, email").eq("event_id", id).order("registration_date", { ascending: false });
  const participants = registrations?.map((reg) => ({
    id: reg.id,
    name: reg.name || "N/A",
    email: reg.email || "N/A",
    date: new Date(reg.registration_date).toLocaleDateString() + " " + new Date(reg.registration_date).toLocaleTimeString(),
    rawDate: reg.registration_date
  })) || [];
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": `Admin - ${event.title}` }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<main class="min-h-screen bg-[#F0F4F8] py-8 px-4 sm:px-6 lg:px-8"> <div class="max-w-5xl mx-auto"> <!-- Breadcrumb --> <nav class="flex mb-8" aria-label="Breadcrumb"> <ol class="inline-flex items-center space-x-1 md:space-x-3"> <li class="inline-flex items-center"> <a href="/admin" class="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600"> <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path></svg>
Admin
</a> </li> <li> <div class="flex items-center"> <svg class="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"></path></svg> <span class="ml-1 text-sm font-medium text-gray-500 md:ml-2">Detalles del Evento</span> </div> </li> </ol> </nav> <!-- Event Header --> <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8"> <div class="relative h-48 sm:h-64"> ${event.image_url ? renderTemplate`<img${addAttribute(event.image_url, "src")}${addAttribute(event.title, "alt")} class="w-full h-full object-cover">` : renderTemplate`<div class="w-full h-full bg-slate-100 flex items-center justify-center"> <span class="text-slate-400 font-medium">Sin imagen</span> </div>`} <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end"> <div class="p-6 md:p-8 text-white"> <h1 class="text-3xl font-bold">${event.title}</h1> <div class="flex items-center gap-4 mt-2 text-sm opacity-90"> <span class="flex items-center gap-1"> <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg> ${new Date(event.date).toLocaleDateString()} ${new Date(event.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} </span> <span class="flex items-center gap-1"> <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg> ${event.location} </span> </div> </div> </div> </div> <div class="p-6 md:p-8"> <h3 class="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Descripción</h3> <p class="text-gray-700 leading-relaxed max-w-3xl"> ${event.description || "Sin descripción."} </p> <div class="mt-6 pt-6 border-t border-gray-100 flex justify-end"> <a${addAttribute(`/admin?edit=${event.id}`, "href")} class="inline-flex items-center px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 text-sm font-medium transition-colors">
Editar Evento
</a> </div> </div> </div> <!-- Participants Section --> <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8"> <div class="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4"> <div> <h2 class="text-xl font-bold text-slate-900">Participantes Registrados</h2> <p class="text-slate-500 text-sm mt-1">Total: ${participants.length}</p> </div> <button${addAttribute(`document.getElementById('register-modal-${event.id}').showModal()`, "onclick")} class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2 transition-colors"> <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
Agregar Participante
</button> </div> <div class="overflow-x-auto"> <table class="w-full text-left text-sm text-gray-500"> <thead class="bg-gray-50 text-gray-700 uppercase font-semibold text-xs"> <tr> <th scope="col" class="px-6 py-3 rounded-l-lg">Nombre</th> <th scope="col" class="px-6 py-3">Email</th> <th scope="col" class="px-6 py-3">Fecha Registro</th> <th scope="col" class="px-6 py-3 rounded-r-lg text-right">Acciones</th> </tr> </thead> <tbody class="divide-y divide-gray-100"> ${participants.map((p) => renderTemplate`<tr class="hover:bg-gray-50 transition-colors"> <td class="px-6 py-4 font-medium text-gray-900">${p.name}</td> <td class="px-6 py-4">${p.email}</td> <td class="px-6 py-4">${p.date}</td> <td class="px-6 py-4 text-right"> <button class="delete-btn text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"${addAttribute(p.id, "data-id")}${addAttribute(p.name, "data-name")} title="Eliminar Registro"> <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg> </button> </td> </tr>`)} ${participants.length === 0 && renderTemplate`<tr> <td colspan="4" class="px-6 py-12 text-center text-gray-400">
No hay participantes registrados aún.
</td> </tr>`} </tbody> </table> </div> </div> ${renderComponent($$result2, "RegistrationModal", $$RegistrationModal, { "eventId": event.id, "eventTitle": event.title })} ${renderComponent($$result2, "ToastNotification", $$ToastNotification, {})} ${renderComponent($$result2, "ConfirmationModal", $$ConfirmationModal, {})} </div> </main> ` })} ${renderScript($$result, "C:/Users/reina/Documents/Practice/Astro/sports-events-app/src/pages/admin/events/[id].astro?astro&type=script&index=0&lang.ts")}`;
}, "C:/Users/reina/Documents/Practice/Astro/sports-events-app/src/pages/admin/events/[id].astro", void 0);
const $$file = "C:/Users/reina/Documents/Practice/Astro/sports-events-app/src/pages/admin/events/[id].astro";
const $$url = "/admin/events/[id]";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$id,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
