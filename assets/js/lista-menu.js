
(function(){
  "use strict";
  function init(){
    const button=document.querySelector("[data-menu-toggle]");
    const nav=document.querySelector("[data-site-nav]");
    if(!button||!nav)return;
    window.__PUBLIC_MENU_READY__=true;
    let backdrop=document.querySelector(".menu-backdrop");
    if(!backdrop){backdrop=document.createElement("button");backdrop.type="button";backdrop.className="menu-backdrop";backdrop.setAttribute("aria-label","Fechar menu");document.body.appendChild(backdrop)}
    const setOpen=open=>{nav.classList.toggle("open",open);backdrop.classList.toggle("open",open);document.body.classList.toggle("menu-open",open);button.setAttribute("aria-expanded",String(open));button.setAttribute("aria-label",open?"Fechar menu":"Abrir menu")};
    button.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();setOpen(!nav.classList.contains("open"))});
    backdrop.addEventListener("click",()=>setOpen(false));
    nav.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>setOpen(false)));
    document.addEventListener("keydown",e=>{if(e.key==="Escape")setOpen(false)});
    window.addEventListener("resize",()=>{if(window.innerWidth>=760)setOpen(false)});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
