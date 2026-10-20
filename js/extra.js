"use strict";
/* PAZZEL — fitur tambahan: tampilan, simulasi chat, kuis, kamus, offline (PWA).
   Dimuat setelah app.js dan memakai ROUTES, $, $$, esc, LS, routeBtn miliknya. */
(() => {
/* ---------- Pengaturan tampilan ---------- */
const getP = () => { try{ return JSON.parse(LS.get("pazzel_prefs") || "{}"); }catch(e){ return {}; } };
const setP = (k,v) => { const p = getP(); p[k] = v; LS.set("pazzel_prefs", JSON.stringify(p)); window.PazzelTheme && PazzelTheme.apply(); };
function pageSettings(){
  const p = getP();
  const grp = (k,label,opts,cur) => `<fieldset><legend>${label}</legend><div class="tabs" role="group" aria-label="${label}">${opts.map(([v,l])=>`<button type="button" class="tab" data-x="pref" data-k="${k}" data-v="${v}" aria-pressed="${cur===v}">${l}</button>`).join("")}</div></fieldset>`;
  return `<h1 tabindex="-1">Tampilan &amp; Aksesibilitas</h1>
  <p class="lead">Atur supaya PAZZEL nyaman dibaca. Pengaturan ini hanya tersimpan di perangkat ini dan tidak berisi data pribadi.</p>
  ${grp("theme","Tema",[["auto","Ikuti perangkat"],["light","Terang"],["dark","Gelap"]],p.theme||"auto")}
  ${grp("size","Ukuran huruf",[["normal","Normal"],["lg","Besar"]],p.size||"normal")}
  ${grp("contrast","Kontras",[["0","Normal"],["1","Tinggi"]],p.contrast?"1":"0")}
  <div class="callout biru"><p><strong>Tanpa internet:</strong> setelah dibuka sekali, halaman dan alarm tetap bisa dipakai saat offline. Kamu juga bisa memasangnya lewat menu browser (“Tambahkan ke layar utama”).</p></div>`;
}

/* ---------- Simulasi chat ---------- */
const SIMS = [
 {judul:"Teman baru di game", start:"a", nodes:{
  a:{them:["Hai! Skill-mu keren banget 😎 Mau kukirimi skin langka?","Gratis kok."], ch:[
    {t:"Boleh, makasih!", n:"b", tone:"hati", fb:"Wajar tertarik. Tapi hadiah dari orang yang baru kenal perlu diwaspadai. Perhatikan apa yang diminta setelahnya."},
    {t:"Nggak usah, aku nggak terima hadiah dari orang yang baru kenal.", n:"ok1", tone:"aman", fb:"Menolak sejak awal adalah langkah yang kuat."}]},
  b:{them:["Sama-sama! Pindah chat ke aplikasi lain yuk. Jangan bilang siapa-siapa ya, nanti diganggu orang.","Kirim fotomu dong, biar aku yakin kamu asli."], ch:[
    {t:"Kirim foto biar dia senang.", n:"warn", tone:"hati", fb:"Hadiah bukan utang. Foto yang sudah terkirim sulit dikendalikan, dan permintaan biasanya bertambah."},
    {t:"Aku nggak mau. Kenapa harus dirahasiakan?", n:"c", tone:"aman", fb:"Pertanyaan bagus. Permintaan merahasiakan adalah tanda bahaya."},
    {t:"Aku mau tunjukkan chat ini ke guru BK.", n:"ok2", tone:"aman", fb:"Langkah yang sangat baik. Kamu tidak perlu menghadapinya sendirian."}]},
  c:{them:["Kamu tega? Aku udah kasih hadiah. Kalau kamu nggak mau, aku marah ya."], ch:[
    {t:"Berhenti membalas, blokir, simpan tangkapan layar, lalu cerita ke orang dewasa tepercaya.", n:"ok2", tone:"aman", fb:"Tekanan seperti ini bukan tanda orang yang menghargaimu. Kamu tidak perlu berdebat."},
    {t:"Menurutinya supaya dia tidak marah.", n:"warn", tone:"hati", fb:"Rasa takut itu wajar, tetapi menuruti tekanan biasanya membuat tuntutan bertambah."}]},
  ok1:{end:"aman", title:"Kamu menjaga dirimu", text:"Kamu boleh menolak sejak awal. Jika orang itu terus mendekat, blokir dan ceritakan kepada orang dewasa tepercaya."},
  ok2:{end:"aman", title:"Kamu mengambil langkah melindungi diri", text:"Menghentikan percakapan dan melibatkan orang dewasa tepercaya adalah cara yang tepat. Simpan bukti pesan, jangan sebarkan."},
  warn:{end:"hati", title:"Mari pikirkan lagi bersama", text:"Kalau kamu sudah terlanjur menuruti, itu bukan salahmu. Yang bersalah adalah pihak yang menekan. Kamu tetap bisa meminta bantuan guru BK atau orang dewasa tepercaya kapan saja."}}},
 {judul:"“Kakak kelas” baru", start:"a", nodes:{
  a:{them:["Hai, aku kakak kelas dari sekolah sebelah. Boleh minta nomor HP dan alamat sekolahmu?"], ch:[
    {t:"Kirim saja, kayaknya dia baik.", n:"warn", tone:"hati", fb:"Perhatian bisa tulus, tetapi nomor dan lokasi adalah informasi pribadi yang tidak wajib kamu bagikan."},
    {t:"Aku belum kenal kamu, jadi nggak kasih info pribadi.", n:"b", tone:"aman", fb:"Tegas dan sopan. Menolak adalah hakmu."}]},
  b:{them:["Ih sombong. Ya udah, kalau gitu ketemuan aja di mal, tapi jangan bilang orang tuamu."], ch:[
    {t:"Setuju, diam-diam saja.", n:"warn", tone:"hati", fb:"Bertemu tanpa sepengetahuan orang dewasa membuat tidak ada yang tahu keberadaanmu."},
    {t:"Tidak. Aku akan cerita ke orang tua dan memblokir akun ini.", n:"ok", tone:"aman", fb:"Memblokir dan bercerita melindungimu."}]},
  ok:{end:"aman", title:"Keputusan yang aman", text:"Kamu menolak membagikan data, menolak pertemuan rahasia, dan melibatkan orang dewasa."},
  warn:{end:"hati", title:"Mari pikirkan lagi bersama", text:"Data pribadi dan pertemuan rahasia membuat kamu lebih sulit dilindungi. Kamu bisa berhenti kapan saja dan meminta bantuan."}}}
];
let SIM = {s:0, node:null, log:[], end:null};
function simEnter(id){ const n = SIMS[SIM.s].nodes[id]; SIM.node = id; if(n.end){ SIM.end = n; return; } n.them.forEach(t=>SIM.log.push({k:"them",t})); }
function simReset(){ SIM.log = []; SIM.end = null; simEnter(SIMS[SIM.s].start); }
function pageSim(){
  if(!SIM.node) simReset();
  return `<h1 tabindex="-1">Simulasi Chat</h1>
  <p class="lead">Latihan membalas pesan di lingkungan yang aman. Pilih balasanmu, lihat penjelasannya, dan coba jalur lain kapan saja. Tidak ada nilai.</p><div id="sim-root"></div>`;
}
function paintSim(){
  const root = $("#sim-root"); if(!root) return;
  const n = SIMS[SIM.s].nodes[SIM.node];
  root.innerHTML = `<div class="tabs" role="group" aria-label="Pilih simulasi">${SIMS.map((x,i)=>`<button type="button" class="tab" data-x="sim-tab" data-i="${i}" aria-pressed="${i===SIM.s}">${esc(x.judul)}</button>`).join("")}</div>
  <div class="card"><div class="chat" role="log" aria-live="polite">${SIM.log.map(m=>m.k==="fb"?`<div class="fb ${m.tone}"><p style="margin:0">${esc(m.t)}</p></div>`:`<div class="bub ${m.k}"><span class="sr-only">${m.k==="me"?"Kamu":"Dia"}: </span>${esc(m.t)}</div>`).join("")}</div>
  ${SIM.end?`<div class="callout ${SIM.end.end==="aman"?"hijau":"kuning"}"><p><strong>${esc(SIM.end.title)}</strong></p><p>${esc(SIM.end.text)}</p></div><div class="btn-row"><button type="button" class="btn btn-primary" data-x="sim-reset">Coba jalur lain</button>${routeBtn("#/bantuan","Meminta Bantuan","btn btn-pink")}</div>`
  :`<p class="hint">Apa balasanmu?</p><div role="group" aria-label="Pilihan balasan">${n.ch.map((c,i)=>`<button type="button" class="opt" data-x="sim-pick" data-i="${i}">${esc(c.t)}</button>`).join("")}</div>`}</div>`;
}

/* ---------- Kuis latihan ---------- */
const QUIZ = [
 ["Seseorang yang baru kamu kenal di game memberi hadiah lalu meminta fotomu. Sikap paling aman?",["Mengirim foto sebagai balasan","Menolak, berhenti membalas, dan cerita ke orang dewasa tepercaya","Mengirim foto lalu minta dihapus"],1,"Hadiah bukan utang. Foto yang terkirim sulit dikendalikan."],
 ["Permintaan “ini rahasia kita ya” paling perlu diwaspadai jika…",["membahas kejutan ulang tahun teman","tentang hobi bersama","membuatmu takut atau tidak nyaman"],2,"Rahasia yang membuat takut tidak perlu dijaga."],
 ["Ada yang mengaku petugas dan meminta kode OTP-mu. Sebaiknya…",["Memberikannya supaya cepat selesai","Tidak memberikannya kepada siapa pun","Memberikan setengahnya"],1,"Pihak yang sah tidak akan meminta kode OTP."],
 ["Kamu sudah terlanjur mengirim sesuatu lalu diancam. Siapa yang bersalah?",["Orang yang mengancam","Kamu","Kalian berdua"],0,"Yang bersalah adalah pihak yang menekan. Kamu tetap bisa dibantu."],
 ["Pesan yang meresahkan sebaiknya…",["dihapus agar tidak ketahuan","disimpan aman dan ditunjukkan kepada orang dewasa tepercaya","disebarkan ke grup kelas"],1,"Bukti membantu orang dewasa menolongmu. Jangan disebarkan."],
 ["Kenalan online mengajak bertemu langsung. Langkah terbaik?",["Bercerita dulu kepada orang dewasa tepercaya sebelum memutuskan","Datang diam-diam","Datang bersama teman tanpa memberi tahu orang dewasa"],0,"Orang dewasa membantu menilai situasi dan melindungimu."],
 ["Mana yang BUKAN tanda bahaya?",["Menjauhkanmu dari keluarga","Menuntut imbalan setelah memberi hadiah","Menerima penolakanmu dengan sopan"],2,"Orang yang menghargaimu menerima penolakanmu."],
 ["Layanan resmi pengaduan kekerasan terhadap anak yang disebut di PAZZEL adalah…",["Grup chat kelas","SAPA 129","Kolom komentar publik"],1,"SAPA 129 (Kementerian PPPA). Bahaya langsung: hubungi 112."]
];
let Q = {i:0, sel:null, ok:0};
function pageQuiz(){ return `<h1 tabindex="-1">Kuis Latihan</h1><p class="lead">${QUIZ.length} pertanyaan singkat untuk mengingat materi. Setelah menjawab, kamu langsung melihat penjelasannya. Ini bukan ujian dan tidak disimpan.</p><div id="quiz-root"></div>`; }
function paintQuiz(){
  const root = $("#quiz-root"); if(!root) return;
  if(Q.i >= QUIZ.length){
    root.innerHTML = `<div class="callout hijau"><p><strong>Kuis selesai.</strong> Kamu memilih jawaban yang sesuai saran keselamatan ${Q.ok} dari ${QUIZ.length}. Ini bukan nilai. Ulangi kapan saja, atau baca lagi materinya.</p></div><div class="btn-row"><button type="button" class="btn btn-primary" data-x="quiz-reset">Ulangi kuis</button>${routeBtn("#/tanda-bahaya","Baca materi","btn")}${routeBtn("#/bantuan","Meminta Bantuan","btn btn-pink")}</div>`; return;
  }
  const [q,opts,ans,ex] = QUIZ[Q.i], done = Q.sel !== null;
  root.innerHTML = `<div class="card"><p class="qprog">Pertanyaan ${Q.i+1} dari ${QUIZ.length}</p><h2 style="font-size:1.2rem">${esc(q)}</h2>
  <div role="group" aria-label="Pilihan jawaban">${opts.map((o,i)=>`<button type="button" class="opt" data-x="quiz-pick" data-i="${i}" aria-pressed="${Q.sel===i}" ${done?"disabled":""}>${esc(o)}</button>`).join("")}</div>
  <div role="status" aria-live="polite">${done?`<div class="fb ${Q.sel===ans?"aman":"hati"}"><strong>${Q.sel===ans?"Sesuai saran keselamatan":"Mari pikirkan lagi"}</strong><p style="margin:.4em 0 0">${esc(ex)}</p></div><div class="btn-row"><button type="button" class="btn btn-primary" data-x="quiz-next">${Q.i+1<QUIZ.length?"Pertanyaan berikutnya":"Lihat ringkasan"}</button></div>`:""}</div></div>`;
}

/* ---------- Kamus istilah ---------- */
const TERMS = [
 ["Grooming","Proses ketika seseorang mendekati, membangun kepercayaan, lalu memanipulasi anak atau remaja agar mau melakukan hal yang tidak pantas atau merahasiakannya."],
 ["Akun palsu (catfishing)","Akun yang memakai identitas atau foto orang lain. Seseorang di internet belum tentu sama dengan yang ia akui."],
 ["Pemerasan foto (sextortion)","Ancaman menyebarkan foto atau video pribadi untuk memaksa seseorang menuruti permintaan. Yang bersalah adalah pengancam, bukan korban. Simpan bukti dan segera minta bantuan."],
 ["OTP","Kode sekali pakai untuk masuk atau memverifikasi akun. Jangan berikan kepada siapa pun."],
 ["Phishing","Pesan atau tautan palsu yang memancing kamu menyerahkan kata sandi atau data. Jangan klik tautan dari pengirim yang tidak kamu kenal."],
 ["Doxing","Menyebarkan data pribadi seseorang (alamat, sekolah, nomor telepon) tanpa izin."],
 ["Perundungan siber","Menyakiti, mengejek, atau mengancam seseorang lewat media digital. Kamu boleh melapor dan meminta bantuan."],
 ["Jejak digital","Semua yang pernah diunggah atau dikirim secara daring. Sesuatu yang sudah terkirim sulit ditarik kembali."],
 ["Verifikasi dua langkah","Lapisan keamanan tambahan saat masuk ke akun, misalnya kode di ponsel. Aktifkan jika tersedia."],
 ["Blokir dan lapor","Fitur di aplikasi dan game untuk menghentikan kontak dan melaporkan akun bermasalah."],
 ["Orang dewasa tepercaya","Orang dewasa yang mendengarkan tanpa menyalahkan, misalnya orang tua, wali, wali kelas, atau guru BK."]
];
function pageTerms(){
  return `<h1 tabindex="-1">Kamus Istilah</h1><p class="lead">Arti istilah yang sering muncul saat bermain dan berselancar di internet.</p>
  <label class="lbl" for="term-q">Cari istilah</label><input id="term-q" type="text" autocomplete="off" placeholder="mis. OTP"><p class="hint" id="term-n" role="status" aria-live="polite"></p>
  <div id="terms">${TERMS.map(([a,b])=>`<details data-s="${esc((a+" "+b).toLowerCase())}"><summary>${esc(a)}</summary><div class="dbody"><p>${esc(b)}</p></div></details>`).join("")}</div>`;
}

/* ---------- Rute & beranda ---------- */
ROUTES["/simulasi"] = {t:"Simulasi Chat", nav:"Simulasi Chat", r:pageSim, a:paintSim};
ROUTES["/kuis"] = {t:"Kuis Latihan", nav:"Kuis Latihan", r:pageQuiz, a:paintQuiz};
ROUTES["/kamus"] = {t:"Kamus Istilah", nav:"Kamus Istilah", r:pageTerms};
ROUTES["/tampilan"] = {t:"Tampilan dan Aksesibilitas", r:pageSettings};
const home0 = ROUTES["/"].r;
ROUTES["/"].r = () => home0() + `<h2 style="margin-top:24px">Latihan tambahan</h2><div class="grid g3">
  <a class="card" href="#/simulasi" style="text-decoration:none;color:inherit"><span class="ico" aria-hidden="true">💬</span><strong>Simulasi chat</strong><p class="hint">Latihan membalas pesan yang membuat tidak nyaman.</p></a>
  <a class="card" href="#/kuis" style="text-decoration:none;color:inherit"><span class="ico" aria-hidden="true">📝</span><strong>Kuis latihan</strong><p class="hint">Uji ingatan tanpa nilai.</p></a>
  <a class="card" href="#/kamus" style="text-decoration:none;color:inherit"><span class="ico" aria-hidden="true">📖</span><strong>Kamus istilah</strong><p class="hint">Arti istilah di dunia digital.</p></a></div>`;

/* ---------- Interaksi ---------- */
document.addEventListener("click", e => {
  const t = e.target.closest("[data-x]"); if(!t) return;
  const x = t.dataset.x, i = +t.dataset.i;
  if(x === "pref"){ const k = t.dataset.k; setP(k, k==="contrast" ? t.dataset.v==="1" : t.dataset.v); $$(`[data-x=pref][data-k=${k}]`).forEach(b=>b.setAttribute("aria-pressed", String(b===t))); }
  else if(x === "sim-tab"){ SIM.s = i; simReset(); paintSim(); }
  else if(x === "sim-reset"){ simReset(); paintSim(); }
  else if(x === "sim-pick"){ const c = SIMS[SIM.s].nodes[SIM.node].ch[i]; SIM.log.push({k:"me",t:c.t},{k:"fb",tone:c.tone,t:c.fb}); simEnter(c.n); paintSim(); const b = $("#sim-root .opt, #sim-root [data-x=sim-reset]"); if(b) b.focus({preventScroll:true}); }
  else if(x === "quiz-pick"){ Q.sel = i; if(i === QUIZ[Q.i][2]) Q.ok++; paintQuiz(); const b = $("[data-x=quiz-next]"); if(b) b.focus(); }
  else if(x === "quiz-next"){ Q.i++; Q.sel = null; paintQuiz(); const h = $("#quiz-root .card h2, #quiz-root .callout"); if(h){ h.setAttribute("tabindex","-1"); h.focus(); } }
  else if(x === "quiz-reset"){ Q = {i:0, sel:null, ok:0}; paintQuiz(); }
});
document.addEventListener("input", e => {
  if(e.target.id !== "term-q") return;
  const v = e.target.value.trim().toLowerCase(); let n = 0;
  $$("#terms details").forEach(d => { const m = !v || d.dataset.s.includes(v); d.hidden = !m; if(m) n++; });
  $("#term-n").textContent = v ? (n ? `${n} istilah ditemukan.` : "Istilah tidak ditemukan. Coba kata lain.") : "";
});

/* ---------- Offline (PWA) ---------- */
if("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) navigator.serviceWorker.register("sw.js").catch(()=>{});

render();
})();
