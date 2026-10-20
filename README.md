# PAZZEL — Clover Safety

Situs statis (HTML/CSS/JS murni, tanpa build) — siap di-deploy ke Vercel.

## Deploy ke Vercel
**Lewat GitHub:** push folder ini ke repo → vercel.com/new → Import → Framework Preset: *Other* → Deploy (kosongkan Build Command & Output Directory).
**Lewat CLI:** `npm i -g vercel` lalu jalankan `vercel --prod` di folder ini.

## Sebelum dipakai di sekolah
1. Ganti `GURU_CODE` di `js/app.js` (baris awal). Kode ini terlihat di kode sumber, jadi bukan keamanan sungguhan.
2. Periksa ulang nomor/tautan bantuan (SAPA 129, 112) dan tinjau isi bersama guru BK.
3. Setelah mengubah file, naikkan `V` di `sw.js` (mis. `pazzel-v2`) agar cache offline diperbarui.

## Struktur
`index.html` · `css/` · `js/app.js` (inti) · `js/extra.js` (simulasi, kuis, kamus, tampilan, PWA) · `js/theme.js` · `sw.js` · `manifest.webmanifest` · `vercel.json` (header keamanan/CSP)

## Privasi
Tidak ada server dan tidak ada data siswa yang dikirim. Akun & pengaturan tersimpan di browser perangkat masing-masing.
