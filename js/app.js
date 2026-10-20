"use strict";
/* =========================================================
   KONFIGURASI — ubah sebelum dipakai di sekolah
   ========================================================= */
const GURU_CODE = "BK-PAZZEL-2026";        // kode pendaftaran akun Guru BK (GANTI!). Ini bukan keamanan sungguhan; lihat halaman Tentang.
const OFFICIAL_URL = "https://laporsapa129.kemenpppa.go.id/";
const MAX_FAIL = 5, LOCK_MS = 30000;

/* =========================================================
   Utilitas
   ========================================================= */
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const mem = {};
const LS = {
  get(k){ try{ return localStorage.getItem(k); }catch(e){ return mem[k] ?? null; } },
  set(k,v){ try{ localStorage.setItem(k,v); }catch(e){ mem[k]=v; } }
};
const SS = {
  get(k){ try{ return sessionStorage.getItem(k); }catch(e){ return mem["s_"+k] ?? null; } },
  set(k,v){ try{ sessionStorage.setItem(k,v); }catch(e){ mem["s_"+k]=v; } },
  del(k){ try{ sessionStorage.removeItem(k); }catch(e){ delete mem["s_"+k]; } }
};
let toastTimer;
function toast(msg){
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(()=>{ t.hidden = true; }, 4500);
}

/* =========================================================
   Akun (hanya di perangkat ini — lihat halaman Tentang)
   ========================================================= */
const b64e = u => btoa(String.fromCharCode(...u));
const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const Auth = {
  users(){ try{ return JSON.parse(LS.get("pazzel_users") || "{}"); }catch(e){ return {}; } },
  save(u){ LS.set("pazzel_users", JSON.stringify(u)); },
  cryptoOK(){ return !!(window.crypto && crypto.subtle); },
  async hash(pw, saltB64){
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({name:"PBKDF2", salt:b64d(saltB64), iterations:150000, hash:"SHA-256"}, key, 256);
    return b64e(new Uint8Array(bits));
  },
  newSalt(){ return b64e(crypto.getRandomValues(new Uint8Array(16))); },
  current(){ const n = SS.get("pazzel_session"); if(!n) return null; const u = this.users()[n]; return u ? {username:n, ...u} : null; },
  fail(){ try{ return JSON.parse(SS.get("pazzel_fail") || '{"n":0,"until":0}'); }catch(e){ return {n:0,until:0}; } },
  validPw(pw, username){
    if(pw.length < 8) return "Kata sandi minimal 8 karakter.";
    if(pw.toLowerCase() === (username||"").toLowerCase()) return "Kata sandi tidak boleh sama dengan nama pengguna.";
    if(!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "Gunakan kombinasi huruf dan angka pada kata sandi.";
    return "";
  },
  async register({nickname, username, role, code, pw, pw2}){
    if(!this.cryptoOK()) return {err:"Browser ini tidak mendukung penyimpanan kata sandi yang aman. Buka PAZZEL lewat https:// atau gunakan browser terbaru."};
    nickname = nickname.trim(); username = username.trim().toLowerCase();
    if(nickname.length < 2 || nickname.length > 20) return {err:"Nama panggilan harus 2–20 karakter."};
    if(!/^[a-z0-9_.]{3,20}$/.test(username)) return {err:"Nama pengguna 3–20 karakter: huruf kecil, angka, titik, atau garis bawah."};
    const users = this.users();
    if(users[username]) return {err:"Nama pengguna itu sudah dipakai. Coba yang lain."};
    if(role === "guru" && code.trim() !== GURU_CODE) return {err:"Kode Guru BK tidak sesuai. Tanyakan kepada penanggung jawab sekolah."};
    const pe = this.validPw(pw, username); if(pe) return {err:pe};
    if(pw !== pw2) return {err:"Konfirmasi kata sandi belum sama."};
    const salt = this.newSalt();
    users[username] = {nickname, role: role === "guru" ? "guru" : "siswa", salt, hash: await this.hash(pw, salt), created: new Date().toISOString(), opened: []};
    this.save(users); SS.set("pazzel_session", username); SS.del("pazzel_fail");
    return {ok:true};
  },
  async login(username, pw){
    if(!this.cryptoOK()) return {err:"Browser ini tidak mendukung login yang aman. Gunakan browser terbaru atau buka lewat https://."};
    const f = this.fail();
    if(f.until > Date.now()) return {err:`Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil((f.until-Date.now())/1000)} detik.`};
    username = username.trim().toLowerCase();
    const u = this.users()[username];
    let ok = false;
    if(u){ ok = (await this.hash(pw, u.salt)) === u.hash; }
    else { await this.hash(pw, b64e(new Uint8Array(16))); } // samakan waktu proses
    if(!ok){
      const n = f.n + 1;
      SS.set("pazzel_fail", JSON.stringify({n: n >= MAX_FAIL ? 0 : n, until: n >= MAX_FAIL ? Date.now()+LOCK_MS : 0}));
      return {err: n >= MAX_FAIL ? "Terlalu banyak percobaan. Tunggu 30 detik lalu coba lagi." : "Nama pengguna atau kata sandi tidak cocok."};
    }
    SS.set("pazzel_session", username); SS.del("pazzel_fail");
    return {ok:true};
  },
  logout(){ SS.del("pazzel_session"); },
  markOpened(key){
    const n = SS.get("pazzel_session"); if(!n) return;
    const users = this.users(); const u = users[n]; if(!u) return;
    u.opened = u.opened || [];
    if(!u.opened.includes(key)){ u.opened.push(key); this.save(users); }
  }
};

/* =========================================================
   Status sementara (hanya di memori halaman; hilang saat dimuat ulang)
   ========================================================= */
const S = { checks:{}, scn:0, picked:{}, myth:{}, boundary:{}, ref:{text:{}, opts:[], q2:[], q3:"", q4:[], done:false}, help:null, trusted:[{r:"",c:""},{r:"",c:""},{r:"",c:""}], tab:"masuk", gchecks:[] };

/* =========================================================
   Alarm
   ========================================================= */
const Alarm = {
  active:false, ctx:null, osc:null, lfo:null, lastFocus:null,
  start(){
    if(this.active) return;                       // tidak boleh ada dua salinan audio
    this.active = true; this.lastFocus = document.activeElement;
    $("#al-fail").hidden = true; $("#al-trustpanel").hidden = true; $("#al-trust").setAttribute("aria-expanded","false");
    $("#alarm-overlay").hidden = false;
    $("#app").inert = true; $("#app").setAttribute("aria-hidden","true");
    $("#al-stop").focus();
    this.playSiren();
    try{ if(navigator.vibrate) navigator.vibrate([400,200,400,200,400,200,400]); }catch(e){}
  },
  playSiren(){
    try{
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) throw new Error("no audio");
      const ctx = new AC();
      const osc = ctx.createOscillator(); osc.type = "sawtooth"; osc.frequency.value = 1000;
      const lfo = ctx.createOscillator(); lfo.type = "triangle"; lfo.frequency.value = 0.9;
      const lg = ctx.createGain(); lg.gain.value = 450;
      lfo.connect(lg); lg.connect(osc.frequency);
      const g = ctx.createGain(); g.gain.value = 0.85;
      const comp = ctx.createDynamicsCompressor();
      osc.connect(g); g.connect(comp); comp.connect(ctx.destination);
      osc.start(); lfo.start();
      this.ctx = ctx; this.osc = osc; this.lfo = lfo;
      const check = () => { if(this.active && ctx.state !== "running") this.audioFail(); };
      if(ctx.resume){ ctx.resume().then(()=>setTimeout(check,300)).catch(()=>this.audioFail()); } else setTimeout(check,300);
    }catch(e){ this.audioFail(); }
  },
  audioFail(){
    const el = $("#al-fail");
    el.innerHTML = "Suara alarm tidak dapat diputar di perangkat ini (mungkin volume mati, mode senyap, atau browser memblokir suara). <strong>Tetap lakukan ini:</strong> menjauhlah ke tempat aman, dekati orang dewasa tepercaya atau tempat yang ramai, dan minta bantuan dengan suaramu. Bahaya langsung? Hubungi 112.";
    el.hidden = false;
  },
  stop(){
    if(!this.active) return;
    try{ this.osc && this.osc.stop(); this.lfo && this.lfo.stop(); }catch(e){}
    try{ this.ctx && this.ctx.close(); }catch(e){}
    this.osc = this.lfo = this.ctx = null; this.active = false;
    try{ if(navigator.vibrate) navigator.vibrate(0); }catch(e){}
    $("#alarm-overlay").hidden = true;
    $("#app").inert = false; $("#app").removeAttribute("aria-hidden");
    if(location.hash !== "#/bantuan") location.hash = "#/bantuan"; else render();
    toast("Alarm dihentikan. Pilihan bantuan ditampilkan di bawah ini.");
    setTimeout(()=>{ const h = $("#main h1"); if(h) h.focus(); }, 60);
  }
};
$("#al-stop").addEventListener("click", ()=>Alarm.stop());
$("#al-trust").addEventListener("click", e=>{
  const p = $("#al-trustpanel"); p.hidden = !p.hidden; e.currentTarget.setAttribute("aria-expanded", String(!p.hidden));
});
document.addEventListener("keydown", e=>{
  if(!Alarm.active) return;
  if(e.key === "Escape"){ Alarm.stop(); return; }
  if(e.key === "Tab"){                                  // jebakan fokus di dalam panel alarm
    const f = $$("#alarm-overlay button, #alarm-overlay a[href]").filter(x=>!x.hidden && x.offsetParent !== null);
    if(!f.length) return;
    const first = f[0], last = f[f.length-1];
    if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  }
});

/* =========================================================
   Data konten
   ========================================================= */
const SIGNS = [
  ["🎁","Hadiah atau uang, lalu menuntut imbalan","Seseorang memberi hadiah, pulsa, item game, atau uang, lalu merasa berhak meminta sesuatu yang tidak kamu inginkan. Hadiah yang tulus tidak datang dengan syarat tersembunyi."],
  ["🤫","Meminta percakapan dirahasiakan","Kamu diminta menyembunyikan hubungan atau obrolan dari orang yang kamu percaya, terutama jika hal itu membuatmu takut atau tidak nyaman. Rahasia yang membuat takut bukan rahasia yang harus dijaga."],
  ["📷","Memaksa meminta foto, video, atau data pribadi","Didesak mengirim foto, video, lokasi, nomor telepon, atau informasi akun. Kamu tidak wajib mengirim apa pun, dan menolak adalah hakmu."],
  ["📍","Mengajak bertemu diam-diam","Mengajak bertemu tanpa sepengetahuan orang dewasa yang dapat melindungimu, atau meminta kamu berbohong tentang ke mana kamu pergi."],
  ["⚠️","Menekan, mengancam, atau membuatmu merasa bersalah","Marah, merajuk, mengancam, atau membuatmu merasa jahat ketika kamu menolak. Tekanan seperti ini bukan tanda orang yang menghargaimu."],
  ["🔗","Menjauhkanmu dari keluarga atau teman","Mengatakan bahwa hanya dia yang mengerti kamu, atau membuatmu ragu pada orang-orang yang mendukungmu."]
];
const CL_SIGNS = [
  "Saya dapat mengenali permintaan yang membuat saya tidak nyaman.",
  "Saya memahami bahwa hadiah tidak membuat seseorang berhak menuntut imbalan.",
  "Saya memahami bahwa permintaan untuk merahasiakan interaksi yang membuat takut dapat menjadi tanda bahaya.",
  "Saya dapat mengenali tekanan, ancaman, atau paksaan.",
  "Saya mengetahui bahwa saya boleh mencari bantuan ketika merasa tidak aman."
];
const CL_PRIV = [
  "Saya menjaga kata sandi dan kode keamanan akun.",
  "Saya berhati-hati membagikan informasi pribadi di internet.",
  "Saya berhak menolak permintaan yang membuat tidak nyaman.",
  "Saya memahami bahwa hadiah tidak berarti saya harus memenuhi permintaan seseorang.",
  "Saya mengetahui bahwa saya dapat meminta bantuan saat merasa takut atau terancam."
];
const CL_ACT = [
  "Saya dapat menolak permintaan yang membuat tidak nyaman jika aman.",
  "Saya mengetahui cara menghentikan interaksi berisiko jika aman dilakukan.",
  "Saya mengetahui siapa yang dapat membantu saya.",
  "Saya memahami bahwa keselamatan lebih penting daripada memenuhi permintaan orang lain."
];
const CL_GURU = [
  "Isi, alur bantuan, dan teks privasi PAZZEL sudah ditinjau bersama pihak yang kompeten dalam perlindungan anak.",
  "Kode pendaftaran Guru BK pada file sudah diganti dan hanya diketahui penanggung jawab.",
  "Nomor dan tautan bantuan (SAPA 129, 112) sudah diperiksa ulang pada sumber resmi.",
  "Sudah ada prosedur tertulis di sekolah jika siswa mengungkapkan pengalaman berisiko (siapa menerima, siapa dilibatkan, kapan orang tua dihubungi, kapan dilaporkan).",
  "Siswa diberi tahu dengan bahasa sederhana bahwa alarm hanya berbunyi di perangkat dan tidak menghubungi siapa pun.",
  "Disepakati bahwa alarm tidak dipakai untuk bercanda, menghukum, atau mempermalukan siswa.",
  "Perangkat sekolah diuji: suara alarm, tombol hentikan, dan tampilan di ponsel."
];
const CL_TOTAL = {signs:CL_SIGNS.length, priv:CL_PRIV.length, act:CL_ACT.length, guru:CL_GURU.length};

const MYTHS = [
  ["“Kalau sudah menerima hadiah, aku harus membalasnya.”","Tidak. Hadiah tidak membuatmu berutang foto, informasi, atau apa pun yang membuatmu tidak nyaman. Kamu boleh mengembalikan, mengabaikan, atau berhenti menerimanya."],
  ["“Kalau aku sudah terlanjur mengirim sesuatu, aku pasti dimarahi dan tidak bisa dibantu.”","Tidak. Yang bersalah adalah orang yang menekan atau mengancam, bukan kamu. Bantuan tetap bisa diminta kapan saja, dan orang dewasa tepercaya ada untuk membantumu, bukan menyalahkanmu."],
  ["“Orang yang baik dan perhatian padaku pasti tidak berbahaya.”","Perhatian bisa tulus, tetapi kadang dipakai untuk membangun kepercayaan sebelum meminta hal yang tidak pantas. Yang perlu diperhatikan adalah permintaannya: apakah membuatmu tidak nyaman, memintamu merahasiakan, atau menekanmu?"],
  ["“Menolak itu tidak sopan.”","Menolak dengan tenang itu hakmu. Orang yang menghargaimu akan menerima penolakanmu."]
];
const BOUNDARY = [
  ["Kata sandi dan kode keamanan","Sebaiknya tidak dibagikan kepada siapa pun, termasuk teman dekat. Orang yang sah tidak akan meminta kode OTP-mu."],
  ["Alamat rumah dan lokasi saat ini","Sebaiknya hanya diketahui keluarga atau orang dewasa tepercaya. Hati-hati dengan fitur berbagi lokasi di aplikasi dan game."],
  ["Nomor telepon","Bagikan hanya kepada orang yang kamu kenal langsung dan percaya. Kamu boleh menolak jika diminta oleh orang yang baru dikenal."],
  ["Foto atau video pribadi","Kamu tidak wajib mengirimnya kepada siapa pun. Foto yang sudah terkirim sulit dikendalikan lagi."],
  ["Nama sekolah dan jadwal harian","Sebaiknya tidak ditampilkan di profil publik. Informasi ini membuat orang asing mudah menemukan keberadaanmu."]
];
const BOUNDARY_OPTS = ["Tidak kubagikan kepada siapa pun","Hanya keluarga / orang dewasa tepercaya","Teman yang kukenal langsung"];

const SCN = [
  { judul:"Hadiah dalam game",
    q:"Seseorang yang kamu kenal melalui internet memberimu hadiah dalam permainan. Setelah itu, ia meminta foto pribadi dan menyuruhmu merahasiakan permintaan tersebut. Kamu merasa tidak nyaman. Apa yang dapat kamu lakukan?",
    opts:[
      ["Mengirim foto karena sudah menerima hadiah.","hati","Banyak orang merasa harus membalas hadiah, dan perasaan itu wajar. Tetapi hadiah bukan utang. Foto yang sudah terkirim sulit dikendalikan dan bisa mengundang permintaan berikutnya. Kalau sudah terlanjur mengirim, itu bukan salahmu, dan kamu tetap bisa meminta bantuan."],
      ["Menolak permintaan jika aman dilakukan.","aman","Menolak adalah hakmu. Cukup singkat dan tegas, tanpa alasan panjang. Jika penolakanmu membuat orang itu marah atau mengancam, jangan berdebat. Hentikan percakapan dan segera cari bantuan."],
      ["Menghentikan percakapan atau memblokir akun jika aman.","aman","Memblokir dan berhenti membalas adalah cara sah untuk melindungi diri. Jika kamu khawatir ia akan bereaksi buruk, ceritakan dulu kepada orang dewasa tepercaya sebelum memutuskan."],
      ["Meminta bantuan guru BK atau orang dewasa tepercaya.","aman","Ini langkah yang sangat baik. Kamu tidak harus menghadapi hal ini sendirian, dan kamu tidak perlu menunggu keadaan menjadi lebih buruk untuk meminta tolong."],
      ["Menyimpan bukti yang relevan secara aman tanpa menyebarkannya.","aman","Tangkapan layar pesan dan nama akun bisa membantu orang dewasa yang menolongmu. Simpan di tempat aman dan jangan kirim ke teman atau media sosial. Jika buktinya berupa foto atau video pribadi, jangan disimpan ulang atau diteruskan; langsung tunjukkan kepada orang dewasa tepercaya."]
    ]},
  { judul:"Ajakan bertemu",
    q:"Seorang kenalan online mengajakmu bertemu langsung dan berpesan agar kamu tidak memberi tahu orang tua atau guru. Kamu penasaran, tetapi juga mulai ragu. Apa yang dapat kamu lakukan?",
    opts:[
      ["Pergi diam-diam karena penasaran.","hati","Rasa penasaran itu manusiawi. Namun bertemu tanpa sepengetahuan orang dewasa membuat tidak ada yang tahu keberadaanmu jika terjadi sesuatu. Permintaan untuk merahasiakan pertemuan adalah tanda bahaya yang layak dipikirkan lagi."],
      ["Menolak ajakan dan tidak membalas lagi.","aman","Kamu tidak wajib bertemu siapa pun. Menolak tanpa alasan panjang sudah cukup."],
      ["Menceritakan ajakan itu kepada orang dewasa tepercaya sebelum memutuskan apa pun.","aman","Bagus. Orang dewasa bisa membantu menilai situasi dan melindungimu. Menceritakannya bukan berarti kamu mengadu atau berbuat salah."],
      ["Mengajak teman untuk menemani secara diam-diam.","hati","Niatmu baik, tetapi teman sebaya sulit melindungimu jika keadaan berubah buruk, dan rahasianya tetap ada. Libatkan orang dewasa tepercaya."],
      ["Melaporkan akun itu ke platform dan memblokirnya jika aman.","aman","Melapor dan memblokir membantu melindungi dirimu dan pengguna lain. Ceritakan juga kepada orang dewasa tepercaya agar kamu tidak sendirian."]
    ]},
  { judul:"Ancaman menyebarkan",
    q:"Seseorang mengancam akan menyebarkan sesuatu tentangmu jika kamu tidak menuruti permintaannya. Kamu takut dan bingung. Apa yang dapat kamu lakukan?",
    opts:[
      ["Menuruti permintaannya supaya ancamannya berhenti.","hati","Rasa takut itu sangat wajar. Namun menuruti ancaman biasanya tidak menghentikannya; tuntutan sering bertambah. Kamu tidak harus menurut, dan masih ada jalan untuk meminta bantuan."],
      ["Tidak mengonfrontasi, menyimpan bukti pesan, dan segera mencari orang dewasa tepercaya.","aman","Keselamatanmu yang utama. Kamu tidak perlu melawan atau berdebat dengan orang yang mengancam. Simpan bukti pesan dan akun, lalu minta bantuan segera."],
      ["Menghubungi guru BK atau mencari jalur pelaporan resmi seperti SAPA 129.","aman","Langkah yang tepat. Kamu tidak perlu membuktikan semuanya sendiri untuk meminta pertolongan."],
      ["Membalas dengan ancaman juga.","hati","Rasa marah bisa dimengerti, tetapi membalas ancaman bisa memperburuk keadaan dan membuatmu semakin terjebak. Lebih aman berhenti berdebat dan meminta bantuan."],
      ["Menghapus semua pesan supaya tidak ketahuan siapa pun.","hati","Rasa malu atau takut membuat banyak orang ingin menghapus semuanya. Padahal pesan itu bisa menjadi bukti yang membantu orang dewasa menolongmu. Kamu tidak perlu malu; yang salah adalah orang yang mengancam."]
    ]}
];
const SCN_EXPL = [
  "Kamu tidak berutang foto atau informasi pribadi kepada siapa pun.",
  "Kamu tidak harus menghadapi ancaman sendirian.",
  "Jika menolak atau memblokir justru meningkatkan bahaya, utamakan keselamatan dan segera cari bantuan.",
  "Kamu tidak perlu mengonfrontasi orang yang mengancammu.",
  "Bukti tidak boleh disebarkan kepada teman atau diunggah ke media sosial."
];

/* =========================================================
   Komponen
   ========================================================= */
function counterText(id){
  const n = (S.checks[id] || []).length;
  return `Kamu mencentang ${n} dari ${CL_TOTAL[id]} pernyataan. Ini hanya penanda saat belajar, bukan skor atau penilaian.`;
}
function checklist(id, title, items){
  const st = S.checks[id] || (S.checks[id] = []);
  return `<fieldset class="checklist"><legend>${esc(title)}</legend>
    ${items.map((t,i)=>`<label class="chk"><input type="checkbox" data-cl="${id}" value="${i}" ${st.includes(i)?"checked":""}><span>${esc(t)}</span></label>`).join("")}
    <p class="counter" id="cnt-${id}" aria-live="polite">${counterText(id)}</p></fieldset>`;
}
function routeBtn(href, label, cls="btn"){ return `<a class="${cls}" href="${href}">${label}</a>`; }

/* =========================================================
   Halaman
   ========================================================= */
function pageHome(){
  const me = Auth.current();
  const flow = [
    ["#/tanda-bahaya","🔎","Kenali tanda bahaya"],
    ["#/privasi","🔒","Pahami privasi &amp; batasan"],
    ["#/tindakan","🧭","Latih tindakan aman"],
    ["#/refleksi","💭","Refleksi setelah puzzle"],
    ["#/bantuan","🤝","Akses bantuan"]
  ];
  return `
  <section class="hero">
    <h1 tabindex="-1">Selamat Datang di PAZZEL!</h1>
    <p class="lead">Selamat menyelesaikan puzzle PAZZEL! Setelah bermain puzzle, kamu dapat mempelajari tanda bahaya, memahami batas privasi, menentukan tindakan yang aman, dan melakukan refleksi. Jika kamu merasa tidak aman atau membutuhkan bantuan, kamu dapat langsung membuka menu bantuan.</p>
    <p class="lead"><strong>Kenali Bahaya, Jaga Privasi, Tentukan Tindakan Aman, Berani Mencari Bantuan.</strong></p>
    <div class="btn-row">
      ${routeBtn("#/tanda-bahaya","Mulai Belajar","btn btn-primary")}
      ${routeBtn("#/refleksi","Refleksi Setelah Puzzle","btn")}
      ${routeBtn("#/bantuan","Meminta Bantuan","btn btn-pink")}
    </div>
  </section>
  <div class="callout pink"><p><strong>Kamu berhak merasa aman, menjaga privasi, menetapkan batasan diri, dan meminta bantuan. Kamu tidak harus menghadapi situasi berbahaya sendirian.</strong></p></div>

  <h2>Alur belajarmu</h2>
  <div class="grid g3" role="list">
    ${flow.map((f,i)=>`<a class="card" role="listitem" href="${f[0]}" style="text-decoration:none;color:inherit"><div class="step-n" aria-hidden="true">${i+1}</div><span class="ico" aria-hidden="true">${f[1]}</span><strong>${f[2]}</strong></a>`).join("")}
  </div>

  <div class="grid g2" style="margin-top:20px">
    <section class="card">
      <h3>🚨 Tentang tombol alarm</h3>
      <p>Tombol merah <strong>ALARM TANDA BAHAYA</strong> ada di semua halaman. Saat ditekan, perangkatmu membunyikan sirene sampai kamu menekan <strong>HENTIKAN ALARM</strong>.</p>
      <p>Alarm <strong>hanya berbunyi di perangkatmu</strong>. Alarm tidak otomatis menghubungi guru, orang tua, atau petugas. Jadi setelah menjauh ke tempat aman, tetap minta bantuan orang dewasa tepercaya.</p>
    </section>
    <section class="card">
      <h3>👤 Akun (boleh dilewati)</h3>
      ${me ? `<p>Halo, <strong>${esc(me.nickname)}</strong>! Kamu sedang masuk sebagai ${me.role==="guru"?"Guru BK":"siswa"}.</p>${routeBtn("#/akun","Buka akunku","btn btn-primary")}`
      : `<p>Kamu bisa masuk untuk melihat kemajuan belajar. <strong>Semua materi, alarm, dan bantuan bisa dipakai tanpa akun.</strong></p>${routeBtn("#/akun","Masuk atau Daftar","btn btn-primary")}`}
      <p class="hint" style="margin-top:10px">Jangan memakai nama lengkap sebagai nama pengguna.</p>
    </section>
  </div>`;
}

function pageSigns(){
  return `
  <h1 tabindex="-1">Mengenali Tanda Bahaya</h1>
  <p class="lead">Beberapa pola perilaku perlu diwaspadai, baik saat bertemu langsung maupun di dunia maya. Ketuk setiap kartu untuk membaca penjelasannya.</p>
  <div>
    ${SIGNS.map(s=>`<details><summary><span aria-hidden="true" style="font-size:1.4rem">${s[0]}</span> ${esc(s[1])}</summary><div class="dbody"><p>${esc(s[2])}</p></div></details>`).join("")}
  </div>
  <div class="callout kuning"><p><strong>Penting:</strong> satu tanda saja tidak otomatis membuktikan terjadinya grooming. Namun setiap perasaan tidak aman atau tidak nyaman layak ditanggapi dengan serius, dan kamu boleh membicarakannya dengan orang dewasa tepercaya.</p></div>

  <h2 style="margin-top:28px">Mitos atau fakta?</h2>
  <p>Ketuk pernyataan untuk melihat penjelasannya. Tidak ada nilai atau skor.</p>
  <div id="myth-root">
    ${MYTHS.map((m,i)=>`<div style="margin:10px 0"><button type="button" class="myth" data-act="myth" data-i="${i}" aria-expanded="${!!S.myth[i]}">${esc(m[0])}</button><div class="myth-ans" ${S.myth[i]?"":"hidden"} id="myth-a-${i}">${esc(m[1])}</div></div>`).join("")}
  </div>

  ${checklist("signs","Checklist Mengenali Tanda Bahaya",CL_SIGNS)}
  <div class="btn-row">${routeBtn("#/privasi","Lanjut: Privasi dan Batasan Diri","btn btn-primary")}${routeBtn("#/bantuan","Meminta Bantuan","btn btn-pink")}</div>`;
}

function pagePrivacy(){
  return `
  <h1 tabindex="-1">Menjaga Privasi dan Batasan Diri</h1>
  <p class="lead">Privasi adalah hak setiap siswa, dan setiap orang berhak menetapkan batasan.</p>
  <div class="grid g2">
    <div class="card"><h3>🔑 Jaga informasi pentingmu</h3><p>Kata sandi, kode keamanan, alamat, lokasi, nomor telepon, dan informasi akun adalah milikmu. Berhati-hatilah saat membagikannya di internet.</p></div>
    <div class="card"><h3>📷 Foto dan video pribadi</h3><p>Kamu tidak wajib mengirim foto atau video pribadi kepada siapa pun.</p></div>
    <div class="card"><h3>✋ Kamu boleh menolak</h3><p>Kamu berhak menolak permintaan, ajakan, percakapan, atau sentuhan yang membuatmu tidak nyaman.</p></div>
    <div class="card"><h3>🗣️ Tidak harus merahasiakan</h3><p>Kamu tidak harus merahasiakan sesuatu yang membuatmu takut atau terancam. Kamu berhak mencari bantuan tanpa merasa malu atau bersalah.</p></div>
  </div>
  <div class="callout pink"><p><strong>Menetapkan batasan bukan berarti kamu tidak sopan. Kamu berhak menjaga diri dan merasa aman.</strong></p></div>

  <h2>Kartu batasanku</h2>
  <p>Pilih seberapa luas kamu mau membagikan tiap hal. Setelah memilih, kamu akan melihat saran. Pilihanmu tidak disimpan.</p>
  <div id="boundary-root">
    ${BOUNDARY.map((b,i)=>`<fieldset><legend>${esc(b[0])}</legend>
      ${BOUNDARY_OPTS.map((o,j)=>`<label class="chk"><input type="radio" name="bd-${i}" data-bd="${i}" value="${j}" ${S.boundary[i]===j?"checked":""}><span>${esc(o)}</span></label>`).join("")}
      <div class="fb aman" id="bd-fb-${i}" role="status" ${S.boundary[i]===undefined?"hidden":""}>Saran: ${esc(b[1])}</div></fieldset>`).join("")}
  </div>

  <h2>Tips pengaturan akun dan game</h2>
  <details><summary>🔐 Akun dan kata sandi</summary><div class="dbody"><ul class="clean"><li>Gunakan kata sandi yang berbeda untuk tiap akun.</li><li>Jangan beri tahu kode OTP atau kode keamanan kepada siapa pun.</li><li>Keluar dari akun saat memakai perangkat bersama.</li></ul></div></details>
  <details><summary>🌐 Profil media sosial dan game</summary><div class="dbody"><ul class="clean"><li>Atur akun menjadi privat jika memungkinkan.</li><li>Hindari memasang nama lengkap, nama sekolah, atau foto seragam di profil publik.</li><li>Terima permintaan pertemanan hanya dari orang yang kamu kenal.</li></ul></div></details>
  <details><summary>📍 Lokasi dan kamera</summary><div class="dbody"><ul class="clean"><li>Matikan berbagi lokasi pada aplikasi yang tidak membutuhkannya.</li><li>Pikirkan dulu sebelum memberi izin kamera dan mikrofon kepada aplikasi.</li></ul></div></details>

  ${checklist("priv","Checklist Prinsip Privasi",CL_PRIV)}
  <div class="btn-row">${routeBtn("#/tindakan","Lanjut: Tindakan yang Aman","btn btn-primary")}${routeBtn("#/bantuan","Meminta Bantuan","btn btn-pink")}</div>`;
}

function pageAction(){
  return `
  <h1 tabindex="-1">Menentukan Tindakan yang Aman</h1>
  <p class="lead">Baca situasinya, lalu coba pilihan tindakan. Kamu boleh mencoba semua pilihan. Tidak ada label korban atau pelaku, dan yang ada hanyalah penjelasan agar kamu bisa memilih langkah yang lebih aman.</p>
  <div id="scn-root"></div>
  <div class="card" id="scn-expl" style="margin-top:18px">
    <h3>Ingat selalu</h3>
    <ul class="clean">${SCN_EXPL.map(t=>`<li>${esc(t)}</li>`).join("")}</ul>
  </div>
  ${checklist("act","Checklist Tindakan Aman",CL_ACT)}
  <div class="btn-row">${routeBtn("#/refleksi","Lanjut: Refleksi Setelah Puzzle","btn btn-primary")}${routeBtn("#/bantuan","Meminta Bantuan","btn btn-pink")}</div>`;
}
function paintScn(focusI){
  const root = $("#scn-root"); if(!root) return;
  const sc = SCN[S.scn]; const picked = S.picked[S.scn] || {last:null, set:[]};
  root.innerHTML = `
    <div class="tabs" role="group" aria-label="Pilih skenario">
      ${SCN.map((x,i)=>`<button type="button" class="tab" data-act="scn-tab" data-i="${i}" aria-pressed="${i===S.scn}">Skenario ${i+1}: ${esc(x.judul)}</button>`).join("")}
    </div>
    <div class="card">
      <h2 style="font-size:1.2rem">Situasi</h2>
      <p>${esc(sc.q)}</p>
      <div role="group" aria-label="Pilihan tindakan">
        ${sc.opts.map((o,i)=>`<button type="button" class="opt" data-act="scn-pick" data-i="${i}" aria-pressed="${picked.set.includes(i)}">${esc(o[0])}</button>`).join("")}
      </div>
      <div id="scn-fb" role="status" aria-live="polite">
        ${picked.last!==null ? (()=>{ const o = sc.opts[picked.last]; return `<div class="fb ${o[1]}"><strong>${o[1]==="aman"?"Langkah yang melindungi dirimu":"Mari pikirkan lagi bersama"}</strong><p style="margin:.4em 0 0">${esc(o[2])}</p></div>`; })() : `<p class="hint">Pilih salah satu tindakan untuk melihat penjelasannya.</p>`}
      </div>
    </div>`;
  if(focusI !== undefined){ const b = $(`[data-act="scn-pick"][data-i="${focusI}"]`, root); if(b) b.focus(); }
}

function pageReflect(){
  const R = S.ref;
  const q2 = ["Memberi hadiah lalu menuntut imbalan","Meminta dirahasiakan","Memaksa meminta foto/data pribadi","Mengajak bertemu diam-diam","Menekan atau mengancam","Menjauhkan dari keluarga/teman","Saya belum yakin"];
  const q3 = ["Supaya tubuh dan datakumu terlindungi","Supaya aku bisa menolak dengan percaya diri","Supaya orang lain menghormati batasanku","Aku belum yakin"];
  const q4 = ["Menolak atau berhenti membalas jika aman","Memblokir atau melaporkan akun","Menyimpan bukti tanpa menyebarkannya","Bercerita kepada orang dewasa tepercaya","Aku belum tahu"];
  const ropts = ["Saya lebih memahami tanda bahaya.","Saya ingin belajar lebih banyak tentang batas privasi.","Saya masih belum yakin bagaimana merespons dengan aman.","Saya ingin berbicara dengan guru BK atau orang dewasa tepercaya.","Saya sedang membutuhkan bantuan.","Saya memilih tidak menjawab."];
  const txt = (k,label,hint) => `<label class="lbl" for="r-${k}">${label}</label><textarea id="r-${k}" data-ref="${k}" maxlength="400" placeholder="(boleh dikosongkan)">${esc(R.text[k]||"")}</textarea>${hint?`<p class="hint">${hint}</p>`:""}`;
  const grp = (name, arr, vals, type) => arr.map((t,i)=>`<label class="chk"><input type="${type}" name="${name}" data-${name}="${i}" ${type==="radio" ? (R[name]===t?"checked":"") : (vals.includes(i)?"checked":"")}><span>${esc(t)}</span></label>`).join("");
  return `
  <h1 tabindex="-1">Refleksi Setelah Puzzle</h1>
  <div class="callout"><p>Selamat menyelesaikan puzzle PAZZEL! Luangkan waktu sejenak untuk merefleksikan hal yang kamu pelajari. <strong>Tidak ada nilai benar atau salah.</strong> Kamu boleh melewati pertanyaan yang tidak ingin kamu jawab.</p></div>
  <div class="callout kuning"><p>Jawabanmu <strong>tidak disimpan dan tidak dikirim</strong> ke mana pun; jawaban hilang saat halaman ditutup atau dimuat ulang. Jangan menulis nama lengkap, alamat, kata sandi, atau data pribadi lain.</p></div>
  <form id="ref-form" novalidate>
    <div class="card" style="margin-bottom:14px"><h3>1. Apa pesan terpenting yang kamu dapatkan setelah menyelesaikan puzzle?</h3>${txt("q1","Jawabanku")}</div>
    <fieldset><legend>2. Tanda bahaya apa yang sekarang lebih kamu pahami?</legend>${grp("q2",q2,R.q2,"checkbox")}</fieldset>
    <fieldset><legend>3. Mengapa penting menjaga privasi dan batasan diri?</legend>${grp("q3",q3,[],"radio")}${txt("q3t","Atau tulis dengan kata-katamu sendiri")}</fieldset>
    <fieldset><legend>4. Apa yang dapat kamu lakukan jika seseorang meminta sesuatu yang membuatmu tidak nyaman?</legend>${grp("q4",q4,R.q4,"checkbox")}</fieldset>
    <div class="card" style="margin-bottom:14px"><h3>5. Siapa yang dapat kamu hubungi jika merasa takut atau tidak aman?</h3>${txt("q5","Jawabanku","Cukup tulis perannya (misalnya “guru BK”, “ibu”), tanpa nomor atau alamat.")}</div>
    <div class="card" style="margin-bottom:14px"><h3>6. Apa satu hal yang ingin kamu lakukan untuk menjaga keselamatan diri?</h3>${txt("q6","Jawabanku")}</div>
    <fieldset id="ref-opts"><legend>Bagaimana perasaanmu sekarang? (boleh pilih lebih dari satu)</legend>
      ${ropts.map((t,i)=>`<label class="chk"><input type="checkbox" data-ropt="${i}" ${R.opts.includes(i)?"checked":""}><span>${esc(t)}</span></label>`).join("")}
    </fieldset>
    <div class="callout pink" id="ref-help" role="status" ${R.opts.includes(3)||R.opts.includes(4)?"":"hidden"}>
      <p><strong>Terima kasih sudah jujur. Kamu tidak sendirian.</strong> Kamu bisa langsung melihat pilihan bantuan sekarang juga.</p>
      <div class="btn-row">${routeBtn("#/bantuan","Buka Menu Meminta Bantuan","btn btn-primary")}</div>
    </div>
    <div class="btn-row"><button type="submit" class="btn btn-primary">Selesai Refleksi</button><button type="button" class="btn" data-act="ref-copy">Salin jawabanku (jika ingin menunjukkan ke orang dewasa)</button></div>
  </form>
  <div id="ref-end" ${R.done?"":"hidden"}>
    <div class="callout hijau" style="margin-top:20px"><p><strong>Terima kasih telah melakukan refleksi.</strong> Kamu berhak merasa aman, menjaga privasi, menolak hal yang membuatmu tidak nyaman, dan mencari bantuan. Kamu tidak harus menghadapi situasi berbahaya sendirian.</p></div>
    <div class="btn-row">${routeBtn("#/tanda-bahaya","Pelajari Lagi","btn")}${routeBtn("#/","Kembali ke Beranda","btn")}${routeBtn("#/bantuan","Aku Ingin Meminta Bantuan","btn btn-pink")}</div>
  </div>`;
}

const HELP_PANELS = {
  dewasa: `<h3>Berbicara dengan orang dewasa tepercaya</h3>
    <p>Orang dewasa tepercaya bisa orang tua atau wali, kakak atau saudara dewasa, wali kelas, atau orang lain yang membuatmu merasa aman. Pilih orang yang akan mendengarkan tanpa menyalahkanmu.</p>
    <p><strong>Kalimat pembuka yang bisa dipakai:</strong></p>
    <ul class="clean"><li>“Aku mau cerita sesuatu yang membuatku tidak nyaman. Boleh minta waktunya sebentar?”</li><li>“Ada orang yang meminta sesuatu dan aku takut. Aku butuh bantuan.”</li></ul>
    <p>Jika orang pertama kurang menanggapi, <strong>coba orang dewasa lain</strong>. Kamu berhak didengar.</p>`,
  bk: `<h3>Meminta bantuan guru BK</h3>
    <p>Guru BK bertugas membantu siswa, dan kamu tidak perlu membuktikan apa pun terlebih dulu. Kamu boleh datang saat istirahat, minta wali kelas mengantarmu, atau menitip pesan: “Aku ingin bertemu guru BK.”</p>
    <p>Kamu tidak harus menceritakan semuanya sekaligus. Mulailah dari apa yang sanggup kamu ceritakan. Jika membawa tangkapan layar pesan, tunjukkan langsung kepada guru BK dan jangan sebarkan ke teman.</p>`,
  resmi: `<h3>Jalur pelaporan resmi</h3>
    <p><strong>SAPA 129</strong> adalah layanan pengaduan kekerasan terhadap perempuan dan anak dari Kementerian PPPA. Kamu bisa membuka laman resminya, atau didampingi orang dewasa tepercaya.</p>
    <div class="btn-row"><a class="btn btn-primary" href="${OFFICIAL_URL}" target="_blank" rel="noopener noreferrer">Buka laman resmi SAPA 129 ↗</a><a class="btn" href="tel:129">Telepon 129</a></div>
    <p class="hint" style="margin-top:12px">PAZZEL tidak mengirim laporan apa pun. Laporan hanya terkirim jika kamu atau orang dewasa yang membantumu mengirimkannya sendiri lewat layanan resmi tersebut.</p>`,
  bahaya: `<div class="callout merah"><h3 style="color:#8f0a12">Jika kamu merasa sedang dalam bahaya</h3>
    <ol style="padding-left:1.2em;margin:0 0 1em"><li>Jika memungkinkan, <strong>menjauhlah ke tempat yang aman</strong>.</li><li>Dekati <strong>orang dewasa tepercaya</strong> atau tempat yang <strong>aman dan ramai</strong> (kantor guru, pos satpam, toko, masjid/gereja).</li><li>Jika ada ancaman langsung, <strong>minta bantuan segera</strong> kepada orang di sekitar atau hubungi layanan darurat.</li></ol>
    <p>Kamu tidak perlu mengisi formulir atau menceritakan seluruh kejadian untuk mendapat bantuan.</p>
    <div class="btn-row"><a class="btn btn-danger" href="tel:112">Telepon 112 (darurat)</a><a class="btn" href="tel:129">Telepon 129 (SAPA)</a><button type="button" class="btn btn-danger" data-act="alarm">🚨 Bunyikan alarm</button></div></div>`
};
function pageHelp(){
  const opts = [["dewasa","🧑‍🤝‍🧑","Saya ingin berbicara dengan orang dewasa tepercaya."],["bk","🏫","Saya ingin meminta bantuan guru BK."],["resmi","📞","Saya ingin mengetahui jalur pelaporan resmi."],["bahaya","🆘","Saya merasa sedang dalam bahaya."]];
  return `
  <h1 tabindex="-1">Meminta Bantuan</h1>
  <div class="callout pink"><p><strong>Jika seseorang membuatmu takut, memaksa, mengancam, atau meminta sesuatu yang membuatmu tidak nyaman, kamu berhak mendapatkan bantuan. Kamu tidak perlu membuktikan semuanya sendiri untuk meminta pertolongan.</strong></p></div>
  <p>Halaman ini bisa dibuka kapan saja, tanpa harus menyelesaikan materi atau mengisi refleksi.</p>
  <div class="grid g2" id="help-opts">
    ${opts.map(o=>`<button type="button" class="opt" style="margin:0" data-act="help-open" data-k="${o[0]}" aria-expanded="${S.help===o[0]}" aria-controls="help-panel"><span class="ico" aria-hidden="true">${o[1]}</span>${esc(o[2])}</button>`).join("")}
  </div>
  <div class="card" id="help-panel" tabindex="-1" style="margin-top:16px" ${S.help?"":"hidden"}>${S.help?HELP_PANELS[S.help]:""}</div>

  <h2 style="margin-top:28px">Kontak tepercaya</h2>
  <div class="grid g2">
    <div class="card"><ul class="clean" style="margin:0"><li>Guru BK atau wali kelas</li><li>Orang tua atau wali (jika aman untuk dihubungi)</li><li>Anggota keluarga dewasa atau orang dewasa tepercaya lainnya</li><li><strong>SAPA 129</strong> — bantuan terkait kekerasan terhadap perempuan dan anak di Indonesia (<a href="tel:129">129</a>; <a href="${OFFICIAL_URL}" target="_blank" rel="noopener noreferrer">laman resmi ↗</a>)</li></ul></div>
    <div class="card"><h3>Peta orang tepercayaku</h3>
      <p class="hint">Catatan ini hanya ada di layar ini: tidak disimpan dan tidak dikirim. Tulis peran dan cara bertemunya saja (misalnya “Bu Sari — guru BK — ruang BK saat istirahat”).</p>
      ${S.trusted.map((t,i)=>`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0"><input type="text" aria-label="Orang tepercaya ${i+1}: peran" data-tr="${i}" data-f="r" placeholder="Siapa / perannya" maxlength="40" value="${esc(t.r)}"><input type="text" aria-label="Orang tepercaya ${i+1}: cara menemui" data-tr="${i}" data-f="c" placeholder="Cara menemui" maxlength="60" value="${esc(t.c)}"></div>`).join("")}
      <button type="button" class="btn btn-small" data-act="tr-copy">Salin daftar</button></div>
  </div>
  <div class="callout biru"><p><strong>Catatan:</strong> PAZZEL tidak mengirim laporan, lokasi, atau pesan kepada siapa pun. Untuk mendapat pertolongan, hubungi orang atau layanan di atas secara langsung.</p></div>`;
}

function pageAbout(){
  return `
  <h1 tabindex="-1">Tentang PAZZEL, Privasi, dan Batasan Fitur</h1>
  <p class="lead">PAZZEL (Clover Safety) adalah media edukasi pendamping puzzle tentang pencegahan child grooming untuk siswa SMP.</p>
  <div class="grid g2">
    <section class="card"><h3>Data apa yang tersimpan?</h3>
      <ul class="clean"><li><strong>Tanpa akun:</strong> tidak ada data pribadi yang disimpan. Hanya pengaturan tampilan (tema, ukuran huruf) yang diingat di perangkat ini.</li><li><strong>Dengan akun:</strong> hanya nama panggilan, nama pengguna, peran, sidik kata sandi (hash), dan daftar halaman materi yang sudah dibuka. Semuanya tersimpan <strong>di browser perangkat ini saja</strong>.</li><li><strong>Tidak pernah disimpan:</strong> jawaban refleksi, centang checklist, pilihan skenario, atau isi “peta orang tepercaya”.</li><li>Tidak ada data yang dikirim ke server mana pun.</li></ul></section>
    <section class="card"><h3>Batasan akun</h3>
      <ul class="clean"><li>Akun hanya berlaku di perangkat dan browser yang sama; tidak bisa dipakai di perangkat lain.</li><li>Membersihkan data browser akan menghapus akun.</li><li>Sesi login berakhir saat tab ditutup, agar aman di komputer bersama.</li><li>Karena tidak memakai server, ini bukan sistem keamanan tingkat lembaga. Peran Guru BK dibuka dengan kode yang bisa dilihat siapa pun yang membuka kode sumber.</li></ul></section>
    <section class="card"><h3>Batasan alarm</h3>
      <ul class="clean"><li>Alarm adalah sinyal suara lokal di perangkat ini.</li><li>Alarm tidak mengirim lokasi, pesan, atau panggilan ke siapa pun.</li><li>Volume mengikuti pengaturan perangkat; website tidak bisa melampaui batas itu.</li><li>Alarm tidak berbunyi otomatis; hanya setelah tombol ditekan.</li></ul></section>
    <section class="card"><h3>Checklist dan refleksi</h3><p>Hanya sarana belajar. Bukan tes, diagnosis, ataupun bukti bahwa seseorang mengalami grooming.</p></section>
  </div>
  <div class="callout kuning"><p>Sebelum dipakai di sekolah, isi, alur bantuan, dan prosedur penanganan sebaiknya ditinjau bersama guru BK atau pihak yang kompeten dalam perlindungan anak.</p></div>`;
}

/* ---- Akun ---- */
function pageAccount(){
  const me = Auth.current();
  if(me) return pageDashboard(me);
  const masuk = S.tab === "masuk";
  return `
  <h1 tabindex="-1">Akun PAZZEL</h1>
  <div class="callout biru"><p><strong>Akun itu opsional.</strong> Semua materi, alarm, dan menu bantuan bisa dipakai tanpa masuk. Akun hanya mencatat halaman materi yang sudah kamu buka.</p></div>
  ${!Auth.cryptoOK()?`<div class="msg err" role="alert">Browser ini membatasi fitur keamanan yang dibutuhkan untuk akun. Buka PAZZEL lewat alamat https:// atau gunakan browser terbaru. Materi dan alarm tetap bisa dipakai.</div>`:""}
  <div class="tabs" role="tablist" aria-label="Masuk atau Daftar">
    <button type="button" class="tab" role="tab" data-act="tab" data-t="masuk" aria-selected="${masuk}">Masuk</button>
    <button type="button" class="tab" role="tab" data-act="tab" data-t="daftar" aria-selected="${!masuk}">Daftar</button>
  </div>
  <div class="card" style="max-width:520px">
  ${masuk ? `
    <form data-form="login" novalidate>
      <label class="lbl" for="l-u">Nama pengguna</label><input id="l-u" type="text" autocomplete="username" autocapitalize="none" required>
      <label class="lbl" for="l-p">Kata sandi</label><input id="l-p" type="password" autocomplete="current-password" required>
      <div id="form-msg" role="alert"></div>
      <div class="btn-row"><button class="btn btn-primary" type="submit">Masuk</button></div>
      <p class="hint" style="margin-top:12px">Lupa kata sandi? Minta Guru BK mengatur ulang kata sandi di perangkat ini.</p>
    </form>` : `
    <form data-form="register" novalidate>
      <label class="lbl" for="r-n">Nama panggilan <span class="hint">(bukan nama lengkap)</span></label><input id="r-n" type="text" maxlength="20" autocomplete="off" required>
      <label class="lbl" for="r-u">Nama pengguna</label><input id="r-u" type="text" maxlength="20" autocomplete="off" autocapitalize="none" aria-describedby="r-u-h" required>
      <p class="hint" id="r-u-h">3–20 karakter: huruf kecil, angka, titik, garis bawah. Jangan memakai nama lengkap, tanggal lahir, atau nomor telepon.</p>
      <fieldset style="margin:14px 0"><legend>Saya mendaftar sebagai</legend>
        <label class="chk"><input type="radio" name="role" value="siswa" checked data-role><span>Siswa</span></label>
        <label class="chk"><input type="radio" name="role" value="guru" data-role><span>Guru BK</span></label>
        <div id="guru-code" hidden><label class="lbl" for="r-c">Kode Guru BK</label><input id="r-c" type="password" autocomplete="off"></div>
      </fieldset>
      <label class="lbl" for="r-p">Kata sandi</label><input id="r-p" type="password" autocomplete="new-password" aria-describedby="r-p-h" required>
      <p class="hint" id="r-p-h">Minimal 8 karakter, kombinasi huruf dan angka. Jangan pakai kata sandi yang sama dengan akun lain.</p>
      <label class="lbl" for="r-p2">Ulangi kata sandi</label><input id="r-p2" type="password" autocomplete="new-password" required>
      <label class="chk" style="margin-top:10px"><input type="checkbox" id="r-ok" required><span>Saya paham akun ini hanya tersimpan di perangkat ini dan tidak dikirim ke mana pun.</span></label>
      <div id="form-msg" role="alert"></div>
      <div class="btn-row"><button class="btn btn-primary" type="submit">Buat akun</button></div>
    </form>`}
  </div>`;
}
function pageDashboard(me){
  const mods = [["tanda-bahaya","Tanda Bahaya"],["privasi","Privasi &amp; Batasan"],["tindakan","Tindakan Aman"],["refleksi","Refleksi"],["bantuan","Bantuan"]];
  const op = me.opened || [];
  const n = mods.filter(m=>op.includes(m[0])).length;
  const tips = ["Kamu boleh berkata “tidak” dengan tenang tanpa alasan panjang.","Rahasia yang membuatmu takut tidak perlu dijaga.","Hadiah tidak membuatmu berutang apa pun.","Simpan pesan yang meresahkan, tunjukkan kepada orang dewasa tepercaya, dan jangan sebarkan.","Kamu boleh meminta bantuan kapan saja, dan tidak perlu menunggu keadaan menjadi parah."];
  const tip = tips[new Date().getDate() % tips.length];
  return `
  <h1 tabindex="-1">Halo, ${esc(me.nickname)}! 👋</h1>
  <p class="lead">Kamu masuk sebagai <span class="tag">${me.role==="guru"?"Guru BK":"Siswa"}</span> dengan nama pengguna <strong>${esc(me.username)}</strong>.</p>
  <div class="grid g2">
    <section class="card"><h2>Kemajuan belajar</h2>
      <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${mods.length}" aria-valuenow="${n}" aria-label="Halaman materi yang sudah dibuka"><i style="width:${n/mods.length*100}%"></i></div>
      <p style="margin:8px 0 12px">${n} dari ${mods.length} halaman sudah kamu buka.</p>
      <div style="display:flex;flex-wrap:wrap;gap:8px">${mods.map(m=>`<span class="pill ${op.includes(m[0])?"done":""}">${op.includes(m[0])?"✓":"○"} ${m[1]}</span>`).join("")}</div>
      <p class="hint" style="margin-top:12px">Yang dicatat hanya halaman yang sudah dibuka. Jawaban refleksi dan checklist tidak disimpan. Ini bukan nilai.</p>
    </section>
    <section class="card"><h2>💡 Pengingat hari ini</h2><p style="font-size:1.1rem">${esc(tip)}</p>
      <div class="btn-row">${routeBtn("#/tanda-bahaya","Lanjut belajar","btn btn-primary")}${routeBtn("#/bantuan","Meminta Bantuan","btn btn-pink")}${me.role==="guru"?routeBtn("#/guru","Panduan Guru BK","btn"):""}</div></section>
  </div>
  <h2 style="margin-top:24px">Pengaturan akun</h2>
  <div class="grid g2">
    <section class="card"><h3>Ganti nama panggilan</h3>
      <form data-form="nick" novalidate><label class="lbl" for="n-n">Nama panggilan baru</label><input id="n-n" type="text" maxlength="20" value="${esc(me.nickname)}"><div class="msg-slot" role="status"></div><div class="btn-row"><button class="btn" type="submit">Simpan</button></div></form></section>
    <section class="card"><h3>Ganti kata sandi</h3>
      <form data-form="pw" novalidate>
        <label class="lbl" for="p-o">Kata sandi lama</label><input id="p-o" type="password" autocomplete="current-password">
        <label class="lbl" for="p-n">Kata sandi baru</label><input id="p-n" type="password" autocomplete="new-password">
        <label class="lbl" for="p-n2">Ulangi kata sandi baru</label><input id="p-n2" type="password" autocomplete="new-password">
        <div class="msg-slot" role="status"></div><div class="btn-row"><button class="btn" type="submit">Ganti kata sandi</button></div></form></section>
  </div>
  <div class="btn-row" style="margin-top:20px"><button type="button" class="btn" data-act="logout">Keluar</button><button type="button" class="btn btn-danger" data-act="del-me">Hapus akunku</button></div>`;
}

/* ---- Guru BK ---- */
function pageGuru(){
  const me = Auth.current();
  if(!me || me.role !== "guru"){
    return `<h1 tabindex="-1">Panduan Guru BK</h1><div class="callout kuning"><p>Halaman ini hanya untuk akun Guru BK. ${me?"Akunmu terdaftar sebagai siswa.":"Silakan masuk terlebih dahulu."}</p></div><div class="btn-row">${routeBtn("#/akun","Ke halaman akun","btn btn-primary")}</div><p>Menu bantuan dan alarm tetap bisa dipakai siapa saja.</p>`;
  }
  const users = Auth.users();
  const rows = Object.entries(users).map(([u,d])=>`<tr><td>${esc(u)}</td><td>${esc(d.nickname)}</td><td>${d.role==="guru"?"Guru BK":"Siswa"}</td><td>${(d.opened||[]).length}/5</td><td>${u===me.username?"<em>(kamu)</em>":`<button type="button" class="btn btn-small" data-act="g-reset" data-u="${esc(u)}">Atur ulang sandi</button> <button type="button" class="btn btn-small btn-danger" data-act="g-del" data-u="${esc(u)}">Hapus</button>`}</td></tr>`).join("");
  return `
  <h1 tabindex="-1">Panduan Guru BK</h1>
  <p class="lead">Ringkasan untuk membantu penggunaan PAZZEL di kelas dan sekolah.</p>
  <div class="callout biru"><p>PAZZEL <strong>tidak mengirim data siswa kepada guru</strong>. Jawaban refleksi dan checklist tidak disimpan, sehingga tidak ada yang bisa dilihat di sini selain daftar akun lokal dan jumlah halaman yang dibuka.</p></div>

  <h2>Saat siswa mengungkapkan pengalaman berisiko</h2>
  <div class="grid g2">
    <div class="card"><h3>Lakukan</h3><ul class="clean"><li>Dengarkan dengan tenang; ucapkan terima kasih karena siswa berani bercerita.</li><li>Tegaskan bahwa ini bukan salah siswa.</li><li>Jelaskan dengan jujur langkah selanjutnya dan siapa yang akan dilibatkan.</li><li>Ikuti prosedur perlindungan anak sekolah dan jalur pelaporan resmi (misalnya SAPA 129).</li><li>Catat fakta secukupnya, simpan dengan aman, dan batasi yang mengetahui.</li></ul></div>
    <div class="card"><h3>Hindari</h3><ul class="clean"><li>Menyalahkan, menghakimi, atau bertanya “kenapa kamu mau?”.</li><li>Meminta siswa mengulang cerita berkali-kali kepada banyak orang.</li><li>Mengonfrontasi terduga pelaku sendirian.</li><li>Meminta atau menyebarkan foto/video pribadi siswa sebagai bukti.</li><li>Menjanjikan kerahasiaan mutlak yang tidak bisa dipenuhi bila ada risiko keselamatan.</li></ul></div>
  </div>

  <h2 style="margin-top:24px">Saran penggunaan di kelas</h2>
  <ol style="padding-left:1.3em"><li>Beri tahu siswa bahwa refleksi tidak dinilai dan boleh dilewati.</li><li>Jelaskan fungsi dan batasan alarm dengan bahasa sederhana.</li><li>Sediakan waktu setelah sesi bagi siswa yang ingin berbicara pribadi.</li><li>Siapkan pendamping saat sesi, karena topiknya bisa membuat sebagian siswa tidak nyaman.</li></ol>

  ${checklist("guru","Checklist kesiapan sekolah (tidak disimpan)",CL_GURU)}

  <h2 style="margin-top:24px">Akun di perangkat ini</h2>
  <div class="card" style="overflow-x:auto"><table class="t"><thead><tr><th scope="col">Nama pengguna</th><th scope="col">Panggilan</th><th scope="col">Peran</th><th scope="col">Halaman dibuka</th><th scope="col">Aksi</th></tr></thead><tbody>${rows}</tbody></table>
  <p class="hint">Atur ulang sandi memberikan kata sandi sementara yang kamu ketik sendiri; sampaikan secara langsung kepada pemilik akun.</p></div>`;
}

/* =========================================================
   Router
   ========================================================= */
const ROUTES = {
  "/": {t:"Beranda PAZZEL", nav:"Beranda PAZZEL", r:pageHome},
  "/tanda-bahaya": {t:"Mengenali Tanda Bahaya", nav:"Mengenali Tanda Bahaya", r:pageSigns, key:"tanda-bahaya"},
  "/privasi": {t:"Menjaga Privasi dan Batasan Diri", nav:"Menjaga Privasi dan Batasan Diri", r:pagePrivacy, key:"privasi"},
  "/tindakan": {t:"Menentukan Tindakan yang Aman", nav:"Menentukan Tindakan yang Aman", r:pageAction, a:()=>paintScn(), key:"tindakan"},
  "/refleksi": {t:"Refleksi Setelah Puzzle", nav:"Refleksi Setelah Puzzle", r:pageReflect, key:"refleksi"},
  "/bantuan": {t:"Meminta Bantuan", nav:"Meminta Bantuan", r:pageHelp, key:"bantuan"},
  "/akun": {t:"Akun", r:pageAccount},
  "/guru": {t:"Panduan Guru BK", r:pageGuru},
  "/tentang": {t:"Tentang dan Privasi", r:pageAbout}
};
function buildNav(cur){
  const me = Auth.current();
  $("#nav-list").innerHTML = Object.entries(ROUTES).filter(([p,r])=>r.nav).map(([p,r])=>`<li><a href="#${p}" ${p===cur?'aria-current="page"':""}>${r.nav}</a></li>`).join("")
    + (me && me.role==="guru" ? `<li><a href="#/guru" ${cur==="/guru"?'aria-current="page"':""}>Panduan Guru BK</a></li>` : "");
  const a = $("#acct-link");
  a.textContent = me ? "👤 " + me.nickname : "Masuk";
  a.setAttribute("aria-label", me ? `Akun: ${me.nickname}` : "Masuk atau daftar (opsional)");
  if(cur === "/akun") a.setAttribute("aria-current","page"); else a.removeAttribute("aria-current");
}
function render(){
  let p = location.hash.replace(/^#/, "") || "/";
  if(!ROUTES[p]) p = "/";
  const r = ROUTES[p];
  $("#main").innerHTML = r.r();
  if(r.a) r.a();
  if(r.key) Auth.markOpened(r.key);
  buildNav(p);
  document.title = r.t + " — PAZZEL";
  $("#nav-main").classList.remove("open"); $("#menu-toggle").setAttribute("aria-expanded","false");
  window.scrollTo(0,0);
  const h = $("#main h1"); if(h){ h.setAttribute("tabindex","-1"); h.focus({preventScroll:true}); }
}
window.addEventListener("hashchange", ()=>{ if(Alarm.active) return; render(); });
$("#menu-toggle").addEventListener("click", e=>{
  const n = $("#nav-main"); const o = n.classList.toggle("open"); e.currentTarget.setAttribute("aria-expanded", String(o));
});

/* =========================================================
   Interaksi (delegasi)
   ========================================================= */
function slotMsg(form, text, ok){
  const el = $("#form-msg") || $(".msg-slot", form);
  if(el) el.innerHTML = text ? `<div class="msg ${ok?"ok":"err"}">${esc(text)}</div>` : "";
}
document.addEventListener("click", async e=>{
  const t = e.target.closest("[data-act]"); if(!t) return;
  const act = t.dataset.act;
  if(act === "alarm"){ Alarm.start(); return; }
  if(act === "myth"){
    const i = +t.dataset.i; S.myth[i] = !S.myth[i];
    t.setAttribute("aria-expanded", String(!!S.myth[i])); $("#myth-a-"+i).hidden = !S.myth[i]; return;
  }
  if(act === "scn-tab"){ S.scn = +t.dataset.i; paintScn(); return; }
  if(act === "scn-pick"){
    const i = +t.dataset.i; const p = S.picked[S.scn] || (S.picked[S.scn] = {last:null,set:[]});
    p.last = i; if(!p.set.includes(i)) p.set.push(i); paintScn(i); return;
  }
  if(act === "help-open"){
    S.help = (S.help === t.dataset.k) ? null : t.dataset.k;
    $$("#help-opts [data-act=help-open]").forEach(b=>b.setAttribute("aria-expanded", String(b.dataset.k === S.help)));
    const pn = $("#help-panel"); pn.hidden = !S.help; pn.innerHTML = S.help ? HELP_PANELS[S.help] : "";
    if(S.help) pn.focus(); return;
  }
  if(act === "tab"){ S.tab = t.dataset.t; render(); return; }
  if(act === "logout"){ Auth.logout(); location.hash = "#/"; render(); toast("Kamu sudah keluar."); return; }
  if(act === "del-me"){
    const me = Auth.current(); if(!me) return;
    if(me.role === "guru" && Object.values(Auth.users()).filter(u=>u.role==="guru").length === 1 && Object.keys(Auth.users()).length > 1){ toast("Kamu satu-satunya Guru BK. Jadikan akun lain Guru BK sebelum menghapus akunmu."); return; }
    if(confirm("Hapus akunmu dari perangkat ini? Tindakan ini tidak bisa dibatalkan.")){
      const u = Auth.users(); delete u[me.username]; Auth.save(u); Auth.logout(); location.hash = "#/"; render(); toast("Akun dihapus.");
    } return;
  }
  if(act === "g-del"){
    const me = Auth.current(); if(!me || me.role!=="guru") return;
    const u = Auth.users(); const name = t.dataset.u;
    if(!u[name]) return;
    if(confirm(`Hapus akun “${name}” dari perangkat ini?`)){ delete u[name]; Auth.save(u); render(); toast("Akun dihapus."); } return;
  }
  if(act === "g-reset"){
    const me = Auth.current(); if(!me || me.role!=="guru") return;
    const name = t.dataset.u; const u = Auth.users(); if(!u[name]) return;
    const pw = prompt(`Ketik kata sandi sementara untuk “${name}” (min. 8 karakter, huruf dan angka):`);
    if(pw === null) return;
    const err = Auth.validPw(pw, name); if(err){ toast(err); return; }
    const salt = Auth.newSalt(); u[name].salt = salt; u[name].hash = await Auth.hash(pw, salt); Auth.save(u);
    toast("Kata sandi diatur ulang. Sampaikan langsung kepada pemilik akun."); return;
  }
  if(act === "ref-copy"){
    const R = S.ref;
    const lines = ["Refleksi PAZZEL (ditulis oleh saya sendiri)"];
    const add = (l,v)=>{ if(v && String(v).trim()) lines.push(l+": "+v); };
    add("1. Pesan terpenting", R.text.q1);
    const q2n = ["Hadiah lalu menuntut imbalan","Meminta dirahasiakan","Memaksa meminta foto/data","Mengajak bertemu diam-diam","Menekan/mengancam","Menjauhkan dari keluarga/teman","Belum yakin"];
    if(R.q2.length) lines.push("2. Tanda bahaya yang kupahami: " + R.q2.map(i=>q2n[i]).join("; "));
    add("3. Pentingnya privasi", R.text.q3t);
    add("5. Orang yang bisa kuhubungi", R.text.q5);
    add("6. Hal yang ingin kulakukan", R.text.q6);
    const text = lines.join("\n");
    try{ await navigator.clipboard.writeText(text); toast("Jawabanmu disalin. Tempelkan hanya jika kamu mau menunjukkannya."); }
    catch(err){ toast("Tidak bisa menyalin otomatis di browser ini."); } return;
  }
  if(act === "tr-copy"){
    const text = S.trusted.filter(x=>x.r||x.c).map(x=>`${x.r} — ${x.c}`).join("\n");
    if(!text){ toast("Isi dulu setidaknya satu baris."); return; }
    try{ await navigator.clipboard.writeText(text); toast("Daftar disalin."); }catch(err){ toast("Tidak bisa menyalin otomatis di browser ini."); } return;
  }
});

document.addEventListener("change", e=>{
  const t = e.target;
  if(t.matches("[data-cl]")){
    const id = t.dataset.cl, v = +t.value; const st = S.checks[id] || (S.checks[id] = []);
    const i = st.indexOf(v);
    if(t.checked && i<0) st.push(v); if(!t.checked && i>=0) st.splice(i,1);
    const c = $("#cnt-"+id); if(c) c.textContent = counterText(id); return;
  }
  if(t.matches("[data-bd]")){
    const i = +t.dataset.bd; S.boundary[i] = +t.value; $("#bd-fb-"+i).hidden = false; return;
  }
  if(t.matches("[data-role]")){ $("#guru-code").hidden = t.value !== "guru"; return; }
  if(t.matches("[data-q2]")){ const i=+t.dataset.q2; const a=S.ref.q2; const k=a.indexOf(i); if(t.checked&&k<0)a.push(i); if(!t.checked&&k>=0)a.splice(k,1); return; }
  if(t.matches("[data-q4]")){ const i=+t.dataset.q4; const a=S.ref.q4; const k=a.indexOf(i); if(t.checked&&k<0)a.push(i); if(!t.checked&&k>=0)a.splice(k,1); return; }
  if(t.matches("[data-q3]")){ S.ref.q3 = t.parentElement.textContent.trim(); return; }
  if(t.matches("[data-ropt]")){
    const i = +t.dataset.ropt; let a = S.ref.opts;
    if(t.checked){
      if(i === 5){ a = S.ref.opts = [5]; $$("[data-ropt]").forEach(x=>{ if(+x.dataset.ropt !== 5) x.checked = false; }); }
      else { a = S.ref.opts = a.filter(x=>x!==5); if(!a.includes(i)) a.push(i); const n = $('[data-ropt="5"]'); if(n) n.checked = false; }
    } else S.ref.opts = a.filter(x=>x!==i);
    $("#ref-help").hidden = !(S.ref.opts.includes(3) || S.ref.opts.includes(4)); return;
  }
});
document.addEventListener("input", e=>{
  const t = e.target;
  if(t.matches("[data-ref]")){ S.ref.text[t.dataset.ref] = t.value; return; }
  if(t.matches("[data-tr]")){ S.trusted[+t.dataset.tr][t.dataset.f] = t.value; }
});

document.addEventListener("submit", async e=>{
  const f = e.target;
  if(f.id === "ref-form"){
    e.preventDefault(); S.ref.done = true; $("#ref-end").hidden = false;
    $("#ref-end").scrollIntoView({behavior:"smooth", block:"center"}); return;
  }
  const kind = f.dataset.form; if(!kind) return;
  e.preventDefault();
  const btn = $("button[type=submit]", f); btn.disabled = true;
  try{
    if(kind === "login"){
      const r = await Auth.login($("#l-u").value, $("#l-p").value);
      if(r.err){ slotMsg(f, r.err, false); return; }
      location.hash = "#/akun"; render(); toast("Selamat datang kembali!");
    }
    else if(kind === "register"){
      if(!$("#r-ok").checked){ slotMsg(f, "Centang pernyataan persetujuan terlebih dahulu.", false); return; }
      const role = ($("input[name=role]:checked", f)||{}).value || "siswa";
      const r = await Auth.register({nickname:$("#r-n").value, username:$("#r-u").value, role, code: ($("#r-c")||{}).value || "", pw:$("#r-p").value, pw2:$("#r-p2").value});
      if(r.err){ slotMsg(f, r.err, false); return; }
      render(); toast("Akun dibuat. Selamat belajar!");
    }
    else if(kind === "nick"){
      const me = Auth.current(); const v = $("#n-n").value.trim();
      if(v.length < 2 || v.length > 20){ slotMsg(f,"Nama panggilan harus 2–20 karakter.",false); return; }
      const u = Auth.users(); u[me.username].nickname = v; Auth.save(u); render(); toast("Nama panggilan diperbarui.");
    }
    else if(kind === "pw"){
      const me = Auth.current(); const u = Auth.users(); const rec = u[me.username];
      if((await Auth.hash($("#p-o").value, rec.salt)) !== rec.hash){ slotMsg(f,"Kata sandi lama tidak cocok.",false); return; }
      const err = Auth.validPw($("#p-n").value, me.username); if(err){ slotMsg(f,err,false); return; }
      if($("#p-n").value !== $("#p-n2").value){ slotMsg(f,"Konfirmasi kata sandi baru belum sama.",false); return; }
      rec.salt = Auth.newSalt(); rec.hash = await Auth.hash($("#p-n").value, rec.salt); Auth.save(u);
      ["#p-o","#p-n","#p-n2"].forEach(s=>{ $(s).value = ""; }); slotMsg(f,"Kata sandi berhasil diganti.",true);
    }
  }catch(err){ slotMsg(f, "Terjadi kesalahan. Coba lagi.", false); }
  finally{ if(btn.isConnected) btn.disabled = false; }
});

render();
