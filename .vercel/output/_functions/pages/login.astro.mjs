import { e as createComponent, f as createAstro, l as renderComponent, k as renderScript, r as renderTemplate, m as maybeRenderHead, h as addAttribute } from '../chunks/astro/server_CiWqt42D.mjs';
import 'piccolore';
import { a as actions } from '../chunks/virtual_DQnNVRSy.mjs';
import { $ as $$Layout } from '../chunks/Layout_CxxGF-MF.mjs';
import { i as isInputError } from '../chunks/astro-designed-error-pages_BU5zBeAq.mjs';
export { renderers } from '../renderers.mjs';

const $$Astro = createAstro();
const $$Login = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Login;
  const result = Astro2.getActionResult(actions.signin);
  if (result?.data?.success) {
    return Astro2.redirect("/admin");
  }
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Admin Login" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8"> <div class="sm:mx-auto sm:w-full sm:max-w-md"> <div class="flex justify-center mb-6"> <div class="w-12 h-12 bg-indigo-600 rounded-b-xl rounded-tr-xl flex items-center justify-center"> <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path> </svg> </div> </div> <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
Inicia sesión en tu cuenta
</h2> <p class="mt-2 text-center text-sm text-gray-600">
Acceso exclusivo para administradores
</p> </div> <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md"> <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100"> <form class="space-y-6"${addAttribute(actions.signin, "action")} method="POST" id="loginForm"> <div> <label for="email" class="block text-sm font-medium text-gray-700">
Correo Electrónico
</label> <div class="mt-1"> <input id="email" name="email" type="email" autocomplete="email" required class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"> <p id="email-error" class="mt-2 text-sm text-red-600 hidden"></p> </div> </div> <div> <label for="password" class="block text-sm font-medium text-gray-700">
Contraseña
</label> <div class="mt-1"> <input id="password" name="password" type="password" autocomplete="current-password" required class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"> </div> </div> ${result?.error && renderTemplate`<div class="rounded-md bg-red-50 p-4"> <div class="flex"> <div class="flex-shrink-0"> <svg class="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"> <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path> </svg> </div> <div class="ml-3"> <h3 class="text-sm font-medium text-red-800">
Error de inicio de sesión
</h3> <div class="mt-2 text-sm text-red-700"> <p>${isInputError(result.error) ? "Datos inv\xE1lidos" : result.error.message}</p> </div> </div> </div> </div>`} <div> <button type="submit" class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors">
Iniciar Sesión
</button> </div> </form> </div> </div> </div> ` })} ${renderScript($$result, "C:/Users/reina/Documents/Practice/Astro/sports-events-app/src/pages/login.astro?astro&type=script&index=0&lang.ts")} ${renderScript($$result, "C:/Users/reina/Documents/Practice/Astro/sports-events-app/src/pages/login.astro?astro&type=script&index=1&lang.ts")}`;
}, "C:/Users/reina/Documents/Practice/Astro/sports-events-app/src/pages/login.astro", void 0);

const $$file = "C:/Users/reina/Documents/Practice/Astro/sports-events-app/src/pages/login.astro";
const $$url = "/login";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Login,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
