(function(){
  var mq = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
  function read(){ try{ return JSON.parse(localStorage.getItem("pazzel_prefs")||"{}"); }catch(e){ return {}; } }
  function apply(){
    var p = read(), d = document.documentElement, t = p.theme || "auto";
    d.dataset.theme = t === "auto" ? (mq && mq.matches ? "dark" : "light") : t;
    d.dataset.size = p.size === "lg" ? "lg" : "normal";
    d.dataset.contrast = p.contrast ? "high" : "normal";
  }
  window.PazzelTheme = {apply: apply}; apply();
  if(mq && mq.addEventListener) mq.addEventListener("change", apply);
})();
