import 'piccolore';
import { p as decodeKey } from './chunks/astro/server_CiWqt42D.mjs';
import 'clsx';
import './chunks/astro-designed-error-pages_BU5zBeAq.mjs';
import 'es-module-lexer';
import { N as NOOP_MIDDLEWARE_FN } from './chunks/noop-middleware_DfW9QhDi.mjs';

function sanitizeParams(params) {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => {
      if (typeof value === "string") {
        return [key, value.normalize().replace(/#/g, "%23").replace(/\?/g, "%3F")];
      }
      return [key, value];
    })
  );
}
function getParameter(part, params) {
  if (part.spread) {
    return params[part.content.slice(3)] || "";
  }
  if (part.dynamic) {
    if (!params[part.content]) {
      throw new TypeError(`Missing parameter: ${part.content}`);
    }
    return params[part.content];
  }
  return part.content.normalize().replace(/\?/g, "%3F").replace(/#/g, "%23").replace(/%5B/g, "[").replace(/%5D/g, "]");
}
function getSegment(segment, params) {
  const segmentPath = segment.map((part) => getParameter(part, params)).join("");
  return segmentPath ? "/" + segmentPath : "";
}
function getRouteGenerator(segments, addTrailingSlash) {
  return (params) => {
    const sanitizedParams = sanitizeParams(params);
    let trailing = "";
    if (addTrailingSlash === "always" && segments.length) {
      trailing = "/";
    }
    const path = segments.map((segment) => getSegment(segment, sanitizedParams)).join("") + trailing;
    return path || "/";
  };
}

function deserializeRouteData(rawRouteData) {
  return {
    route: rawRouteData.route,
    type: rawRouteData.type,
    pattern: new RegExp(rawRouteData.pattern),
    params: rawRouteData.params,
    component: rawRouteData.component,
    generate: getRouteGenerator(rawRouteData.segments, rawRouteData._meta.trailingSlash),
    pathname: rawRouteData.pathname || void 0,
    segments: rawRouteData.segments,
    prerender: rawRouteData.prerender,
    redirect: rawRouteData.redirect,
    redirectRoute: rawRouteData.redirectRoute ? deserializeRouteData(rawRouteData.redirectRoute) : void 0,
    fallbackRoutes: rawRouteData.fallbackRoutes.map((fallback) => {
      return deserializeRouteData(fallback);
    }),
    isIndex: rawRouteData.isIndex,
    origin: rawRouteData.origin
  };
}

function deserializeManifest(serializedManifest) {
  const routes = [];
  for (const serializedRoute of serializedManifest.routes) {
    routes.push({
      ...serializedRoute,
      routeData: deserializeRouteData(serializedRoute.routeData)
    });
    const route = serializedRoute;
    route.routeData = deserializeRouteData(serializedRoute.routeData);
  }
  const assets = new Set(serializedManifest.assets);
  const componentMetadata = new Map(serializedManifest.componentMetadata);
  const inlinedScripts = new Map(serializedManifest.inlinedScripts);
  const clientDirectives = new Map(serializedManifest.clientDirectives);
  const serverIslandNameMap = new Map(serializedManifest.serverIslandNameMap);
  const key = decodeKey(serializedManifest.key);
  return {
    // in case user middleware exists, this no-op middleware will be reassigned (see plugin-ssr.ts)
    middleware() {
      return { onRequest: NOOP_MIDDLEWARE_FN };
    },
    ...serializedManifest,
    assets,
    componentMetadata,
    inlinedScripts,
    clientDirectives,
    routes,
    serverIslandNameMap,
    key
  };
}

const manifest = deserializeManifest({"hrefRoot":"file:///C:/Users/reina/Documents/Practice/Astro/sports-events-app/","cacheDir":"file:///C:/Users/reina/Documents/Practice/Astro/sports-events-app/node_modules/.astro/","outDir":"file:///C:/Users/reina/Documents/Practice/Astro/sports-events-app/dist/","srcDir":"file:///C:/Users/reina/Documents/Practice/Astro/sports-events-app/src/","publicDir":"file:///C:/Users/reina/Documents/Practice/Astro/sports-events-app/public/","buildClientDir":"file:///C:/Users/reina/Documents/Practice/Astro/sports-events-app/dist/client/","buildServerDir":"file:///C:/Users/reina/Documents/Practice/Astro/sports-events-app/dist/server/","adapterName":"@astrojs/vercel","routes":[{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"type":"page","component":"_server-islands.astro","params":["name"],"segments":[[{"content":"_server-islands","dynamic":false,"spread":false}],[{"content":"name","dynamic":true,"spread":false}]],"pattern":"^\\/_server-islands\\/([^/]+?)\\/?$","prerender":false,"isIndex":false,"fallbackRoutes":[],"route":"/_server-islands/[name]","origin":"internal","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"type":"endpoint","isIndex":false,"route":"/_image","pattern":"^\\/_image\\/?$","segments":[[{"content":"_image","dynamic":false,"spread":false}]],"params":[],"component":"node_modules/astro/dist/assets/endpoint/generic.js","pathname":"/_image","prerender":false,"fallbackRoutes":[],"origin":"internal","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"type":"endpoint","isIndex":false,"route":"/_actions/[...path]","pattern":"^\\/_actions(?:\\/(.*?))?\\/?$","segments":[[{"content":"_actions","dynamic":false,"spread":false}],[{"content":"...path","dynamic":true,"spread":true}]],"params":["...path"],"component":"node_modules/astro/dist/actions/runtime/route.js","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"internal","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[{"type":"external","src":"/_astro/_id_.Daxced5R.css"},{"type":"inline","content":"dialog[data-astro-cid-2rglmqlr][open]{animation:zoomIn .2s ease-out}@keyframes zoomIn{0%{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}\n"}],"routeData":{"route":"/admin/events/[id]","isIndex":false,"type":"page","pattern":"^\\/admin\\/events\\/([^/]+?)\\/?$","segments":[[{"content":"admin","dynamic":false,"spread":false}],[{"content":"events","dynamic":false,"spread":false}],[{"content":"id","dynamic":true,"spread":false}]],"params":["id"],"component":"src/pages/admin/events/[id].astro","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[{"type":"external","src":"/_astro/_id_.Daxced5R.css"},{"type":"inline","content":":root{--primary-color: #175fe5;--border-color: #cbd5e1;--radius: 8px}.form-group[data-astro-cid-u2h3djql]{display:flex;flex-direction:column;gap:.5rem}.form-group[data-astro-cid-u2h3djql] label[data-astro-cid-u2h3djql]{font-size:.875rem;font-weight:500;color:#1e293b}input[data-astro-cid-u2h3djql][type=text],input[data-astro-cid-u2h3djql][type=datetime-local],textarea[data-astro-cid-u2h3djql],input[data-astro-cid-u2h3djql][type=file]{width:100%;padding:.6rem .8rem;border:1px solid var(--border-color);border-radius:var(--radius);font-size:.9rem;outline:none;transition:all .2s}input[data-astro-cid-u2h3djql]:focus,textarea[data-astro-cid-u2h3djql]:focus{border-color:var(--primary-color);box-shadow:0 0 0 2px #175fe51a}textarea[data-astro-cid-u2h3djql]{field-sizing:content;min-height:4rem;max-height:12rem}.submit-btn[data-astro-cid-u2h3djql]{background-color:var(--primary-color);color:#fff;padding:.75rem;border-radius:var(--radius);font-weight:600;font-size:.9rem;border:none;cursor:pointer;transition:background-color .2s}.submit-btn[data-astro-cid-u2h3djql]:hover{background-color:#124cb8}.form-message[data-astro-cid-u2h3djql]{padding:.75rem;border-radius:var(--radius);font-size:.85rem;margin-top:1rem}.form-message[data-astro-cid-u2h3djql].error{background-color:#fef2f2;color:#b91c1c;border:1px solid #fecaca}.form-message[data-astro-cid-u2h3djql].success{background-color:#f0fdf4;color:#15803d;border:1px solid #bbf7d0}\n"}],"routeData":{"route":"/admin","isIndex":true,"type":"page","pattern":"^\\/admin\\/?$","segments":[[{"content":"admin","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/admin/index.astro","pathname":"/admin","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[{"type":"external","src":"/_astro/_id_.Daxced5R.css"}],"routeData":{"route":"/login","isIndex":false,"type":"page","pattern":"^\\/login\\/?$","segments":[[{"content":"login","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/login.astro","pathname":"/login","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[{"type":"external","src":"/_astro/_id_.Daxced5R.css"},{"type":"inline","content":"[data-astro-cid-j7pv25f6]::-webkit-scrollbar{width:8px}[data-astro-cid-j7pv25f6]::-webkit-scrollbar-track{background:#f1f1f1}[data-astro-cid-j7pv25f6]::-webkit-scrollbar-thumb{background:#d4d4d8;border-radius:4px}[data-astro-cid-j7pv25f6]::-webkit-scrollbar-thumb:hover{background:#a1a1aa}\ndialog[data-astro-cid-2rglmqlr][open]{animation:zoomIn .2s ease-out}@keyframes zoomIn{0%{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}\n"}],"routeData":{"route":"/","isIndex":true,"type":"page","pattern":"^\\/$","segments":[],"params":[],"component":"src/pages/index.astro","pathname":"/","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}}],"base":"/","trailingSlash":"ignore","compressHTML":true,"componentMetadata":[["C:/Users/reina/Documents/Practice/Astro/sports-events-app/src/pages/admin/events/[id].astro",{"propagation":"none","containsHead":true}],["C:/Users/reina/Documents/Practice/Astro/sports-events-app/src/pages/admin/index.astro",{"propagation":"none","containsHead":true}],["C:/Users/reina/Documents/Practice/Astro/sports-events-app/src/pages/index.astro",{"propagation":"none","containsHead":true}],["C:/Users/reina/Documents/Practice/Astro/sports-events-app/src/pages/login.astro",{"propagation":"none","containsHead":true}]],"renderers":[],"clientDirectives":[["idle","(()=>{var l=(n,t)=>{let i=async()=>{await(await n())()},e=typeof t.value==\"object\"?t.value:void 0,s={timeout:e==null?void 0:e.timeout};\"requestIdleCallback\"in window?window.requestIdleCallback(i,s):setTimeout(i,s.timeout||200)};(self.Astro||(self.Astro={})).idle=l;window.dispatchEvent(new Event(\"astro:idle\"));})();"],["load","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).load=e;window.dispatchEvent(new Event(\"astro:load\"));})();"],["media","(()=>{var n=(a,t)=>{let i=async()=>{await(await a())()};if(t.value){let e=matchMedia(t.value);e.matches?i():e.addEventListener(\"change\",i,{once:!0})}};(self.Astro||(self.Astro={})).media=n;window.dispatchEvent(new Event(\"astro:media\"));})();"],["only","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).only=e;window.dispatchEvent(new Event(\"astro:only\"));})();"],["visible","(()=>{var a=(s,i,o)=>{let r=async()=>{await(await s())()},t=typeof i.value==\"object\"?i.value:void 0,c={rootMargin:t==null?void 0:t.rootMargin},n=new IntersectionObserver(e=>{for(let l of e)if(l.isIntersecting){n.disconnect(),r();break}},c);for(let e of o.children)n.observe(e)};(self.Astro||(self.Astro={})).visible=a;window.dispatchEvent(new Event(\"astro:visible\"));})();"]],"entryModules":{"\u0000astro-internal:middleware":"_astro-internal_middleware.mjs","\u0000virtual:astro:actions/entrypoint":"entrypoint.mjs","\u0000@astro-page:node_modules/astro/dist/actions/runtime/route@_@js":"pages/_actions/_---path_.astro.mjs","\u0000@astro-page:src/pages/admin/events/[id]@_@astro":"pages/admin/events/_id_.astro.mjs","\u0000@astro-page:src/pages/admin/index@_@astro":"pages/admin.astro.mjs","\u0000@astro-page:src/pages/login@_@astro":"pages/login.astro.mjs","\u0000@astro-page:src/pages/index@_@astro":"pages/index.astro.mjs","\u0000@astrojs-ssr-virtual-entry":"entry.mjs","\u0000@astro-renderers":"renderers.mjs","\u0000@astro-page:node_modules/astro/dist/assets/endpoint/generic@_@js":"pages/_image.astro.mjs","\u0000@astrojs-ssr-adapter":"_@astrojs-ssr-adapter.mjs","\u0000@astrojs-manifest":"manifest_CLofd4zd.mjs","C:/Users/reina/Documents/Practice/Astro/sports-events-app/node_modules/astro/dist/assets/services/sharp.js":"chunks/sharp_rzbKj3NU.mjs","C:/Users/reina/Documents/Practice/Astro/sports-events-app/src/pages/admin/events/[id].astro?astro&type=script&index=0&lang.ts":"_astro/_id_.astro_astro_type_script_index_0_lang.s_CO6gSL.js","C:/Users/reina/Documents/Practice/Astro/sports-events-app/src/pages/login.astro?astro&type=script&index=0&lang.ts":"_astro/login.astro_astro_type_script_index_0_lang.DxOMf39v.js","C:/Users/reina/Documents/Practice/Astro/sports-events-app/src/pages/login.astro?astro&type=script&index=1&lang.ts":"_astro/login.astro_astro_type_script_index_1_lang.DpV7YdRM.js","C:/Users/reina/Documents/Practice/Astro/sports-events-app/src/components/RegistrationModal.astro?astro&type=script&index=0&lang.ts":"_astro/RegistrationModal.astro_astro_type_script_index_0_lang.BpV1TdZE.js","C:/Users/reina/Documents/Practice/Astro/sports-events-app/src/components/ToastNotification.astro?astro&type=script&index=0&lang.ts":"_astro/ToastNotification.astro_astro_type_script_index_0_lang.B28IgEnh.js","C:/Users/reina/Documents/Practice/Astro/sports-events-app/src/components/ConfirmationModal.astro?astro&type=script&index=0&lang.ts":"_astro/ConfirmationModal.astro_astro_type_script_index_0_lang.DcGgHI-F.js","astro:scripts/before-hydration.js":""},"inlinedScripts":[["C:/Users/reina/Documents/Practice/Astro/sports-events-app/src/components/ToastNotification.astro?astro&type=script&index=0&lang.ts","window.showToast=(i,l=\"success\")=>{const s=document.getElementById(\"toast-container\"),n=document.getElementById(\"toast-template\");if(!s||!n){console.error(\"Toast container or template not found\");return}const e=n.content.cloneNode(!0),t=e.querySelector(\".toast\"),r=e.querySelector(\".toast-message\");if(!t||!r){console.error(\"Toast elements not found in template\");return}r.textContent=i;const c=e.querySelector(\".icon-success\"),a=e.querySelector(\".icon-error\"),o=e.querySelector(\"div.inline-flex\");if(!c||!a||!o){console.error(\"Toast icon elements not found\");return}l===\"success\"?(c.classList.remove(\"hidden\"),o.classList.add(\"bg-green-100\",\"text-green-500\"),o.classList.remove(\"bg-red-100\",\"text-red-500\")):(a.classList.remove(\"hidden\"),o.classList.remove(\"bg-green-100\",\"text-green-500\",\"dark:bg-green-800\",\"dark:text-green-200\"),o.classList.add(\"bg-red-100\",\"text-red-500\",\"dark:bg-red-800\",\"dark:text-red-200\")),s.appendChild(t),requestAnimationFrame(()=>{t.classList.remove(\"translate-x-full\",\"opacity-0\")}),setTimeout(()=>{t.classList.add(\"translate-x-full\",\"opacity-0\"),setTimeout(()=>{t.remove()},300)},3e3)};"],["C:/Users/reina/Documents/Practice/Astro/sports-events-app/src/components/ConfirmationModal.astro?astro&type=script&index=0&lang.ts","let n=null;window.showConfirm=(o,l,i)=>{const t=document.getElementById(\"confirmation-modal\"),d=document.getElementById(\"modal-title\"),c=document.getElementById(\"modal-desc\"),e=document.getElementById(\"confirm-btn\");if(!t||!d||!c||!e){console.error(\"Modal elements not found\");return}o&&(d.textContent=o),l&&(c.textContent=l),n=i;const m=e.cloneNode(!0);e.parentNode?.replaceChild(m,e),m.addEventListener(\"click\",()=>{n&&n(),t.close()}),t.showModal()};"]],"assets":["/_astro/_id_.Daxced5R.css","/favicon.svg","/_astro/client.B9YBqyHK.js","/_astro/login.astro_astro_type_script_index_0_lang.DxOMf39v.js","/_astro/login.astro_astro_type_script_index_1_lang.DpV7YdRM.js","/_astro/RegistrationModal.astro_astro_type_script_index_0_lang.BpV1TdZE.js","/_astro/virtual.BIXjcra2.js","/_astro/_id_.astro_astro_type_script_index_0_lang.s_CO6gSL.js"],"buildFormat":"directory","checkOrigin":true,"allowedDomains":[],"serverIslandNameMap":[],"key":"wCrKn9BIx6RDDVDb56AoVTh/KQfsrvP75JNlMW76z0M="});
if (manifest.sessionConfig) manifest.sessionConfig.driverModule = null;

export { manifest };
