# UNPRI Virtual Tour 360° — Panduan Pengelolaan Scene

Dokumentasi ini menjelaskan cara **menambah gambar panorama, menambah atau memperbarui scene, mengatur panah navigasi, serta mengaktifkan navigasi antarlantai** pada Virtual Tour 360° UNPRI. Semua konten dapat diperbarui melalui repository GitHub Pages **`prim25/PrivateAssets`**, tanpa perlu mengubah kode Rails production untuk perubahan data scene.

> **Penting:** Panduan ini mengikuti struktur `scenes.json` dan `unpri-tour.js` berbasis `fetch()` yang telah disiapkan. Pastikan JavaScript di GitHub Pages sudah menggunakan versi yang membaca JSON eksternal, bukan versi lama yang masih menyimpan `var scenes = {...}` secara langsung. Nama path sensitif terhadap huruf besar-kecil.

## 1. Struktur folder

```text
PrivateAssets/
└── assets/
    ├── images/
    │   └── 360/
    │       ├── outdoor_kampus/
    │       │   ├── depan_gedung_unpri.jpg
    │       │   └── gerbang_masuk.jpg
    │       ├── mall/
    │       │   └── pintu_masuk_mall.jpg
    │       └── gedung_utama/
    │           └── lantai_2/
    │               └── koridor.jpg
    ├── data/
    │   └── 360/
    │       └── scenes.json
    ├── css/
    │   └── 360/
    │       └── unpri-tour.css
    └── js/
        └── 360/
            └── unpri-tour.js
```

| Berkas | Tanggung jawab |
| --- | --- |
| `assets/images/360/...` | Gambar panorama equirectangular 360° |
| `assets/data/360/scenes.json` | Identitas scene, judul, gambar, arah awal, hotspot, shortcut, lantai |
| `assets/css/360/unpri-tour.css` | Tampilan Virtual Tour |
| `assets/js/360/unpri-tour.js` | Memuat JSON dan menjalankan Pannellum |
| Rails `landing_pages/tours.html.haml` | Kontainer penampil; **tidak perlu diedit untuk menambah scene** |

Alamat JSON publik setelah GitHub Pages selesai memublikasikan perubahan:

`https://prim25.github.io/PrivateAssets/assets/data/360/scenes.json`

Base URL gambar:

`https://prim25.github.io/PrivateAssets/assets/images/360/`

## 2. Menyiapkan gambar panorama baru

1. Siapkan foto **360° equirectangular** dengan rasio lebar:tinggi **2:1** (contoh: `4096 × 2048` atau `6000 × 3000`). Foto biasa/flat bukan panorama 360° dan akan tampil terdistorsi.
2. Simpan sebagai `.jpg` (umumnya lebih hemat ukuran). Optimalkan kompresi agar unduhan tidak terlalu berat, terutama di ponsel, tanpa mengorbankan detail penting.
3. Gunakan nama file pendek, deskriptif, huruf kecil, dan garis bawah; hindari spasi, misalnya `koridor_lantai_2.jpg`.
4. Letakkan file di folder area yang sesuai, misalnya:
   `assets/images/360/gedung_utama/lantai_2/koridor_lantai_2.jpg`.
5. Setelah push, buka URL publiknya untuk memastikan tidak `404`:
   `https://prim25.github.io/PrivateAssets/assets/images/360/gedung_utama/lantai_2/koridor_lantai_2.jpg`

**Catatan:** Foto harus mendapat izin penggunaan yang sesuai; periksa juga apakah wajah, pelat nomor, atau informasi pribadi perlu diburamkan sebelum dipublikasikan.

## 3. Format `scenes.json`

Contoh struktur ringkas (untuk ilustrasi; **jangan mengganti seluruh konfigurasi yang sudah ada dengan contoh ini**):

```json
{
  "version": 1,
  "firstScene": "depanGedung",
  "panoramaBase": "https://prim25.github.io/PrivateAssets/assets/images/360/",
  "shortcuts": [
    {"sceneId": "depanGedung", "label": "Halaman depan"},
    {"sceneId": "depanMall", "label": "Mall kampus"}
  ],
  "floors": [],
  "scenes": [
    {
      "id": "depanGedung",
      "title": "Halaman Depan",
      "area": "Area Outdoor",
      "image": "outdoor_kampus/depan_gedung_unpri.jpg",
      "pitch": 0,
      "yaw": 0,
      "hfov": 100,
      "hotSpots": [
        {"pitch": -4.0584, "yaw": 166.6648, "sceneId": "gerbangMasuk"}
      ]
    },
    {
      "id": "gerbangMasuk",
      "title": "Gerbang Masuk",
      "area": "Area Outdoor",
      "image": "outdoor_kampus/gerbang_masuk.jpg",
      "pitch": 0,
      "yaw": 0,
      "hfov": 100,
      "hotSpots": [
        {"pitch": -7.1513, "yaw": -82.6201, "sceneId": "depanGedung"}
      ]
    }
  ]
}
```

### Penjelasan field

| Field | Fungsi | Contoh |
| --- | --- | --- |
| `version` | Versi format konfigurasi (informasi) | `1` |
| `firstScene` | ID panorama pembuka | `"depanGedung"` |
| `panoramaBase` | URL dasar semua gambar, diakhiri `/` | `"https://.../images/360/"` |
| `shortcuts` | Tombol pintasan area di atas viewer | `[ {"sceneId":"depanMall","label":"Mall kampus"} ]` |
| `floors` | Daftar tombol lantai; kosongkan bila belum dipakai | `[]` |
| `scenes` | Semua panorama yang tersedia | `[...]` |
| `id` | Identitas scene **unik dan stabil** | `"lobiMall"` |
| `title` | Judul lokasi yang muncul di UI | `"Lobi Mall"` |
| `area` | Nama area/kelompok | `"Mall"` |
| `image` | Path gambar relatif dari `panoramaBase` | `"mall/pintu_masuk_mall.jpg"` |
| `pitch` | Arah vertikal awal, derajat (negatif = bawah) | `0` |
| `yaw` | Arah horizontal awal, derajat | `0` |
| `hfov` | Sudut pandang/zoom awal | `100` |
| `hotSpots` | Panah navigasi ke scene lain | `[{"pitch":-4,"yaw":90,"sceneId":"lobiMall"}]` |

**Aturan wajib:**

- `id` harus **unik**. Jangan mengubah ID scene lama tanpa memperbarui semua `sceneId` yang menunjuk padanya, `firstScene`, `shortcuts`, dan `floors`.
- `image` adalah path relatif seperti `mall/lobi.jpg`, **bukan** URL lengkap, selama menggunakan `panoramaBase`.
- Setiap `hotSpots[].sceneId`, `shortcuts[].sceneId`, dan `floors[].sceneId` harus merujuk ke `scenes[].id` yang tersedia.
- JSON tidak mendukung komentar `//` / `#`, koma terakhir, atau kutip tunggal sebagai pembatas string.
- `hotSpots` boleh `[]` untuk panorama yang belum terhubung.

## 4. Menambah scene baru

Misalnya menambah koridor lantai 2.

**Langkah A — unggah gambar:**

`assets/images/360/gedung_utama/lantai_2/koridor_lantai_2.jpg`

**Langkah B — tambahkan satu objek di akhir array `scenes`**, dengan koma pemisah dari objek sebelumnya:

```json
{
  "id": "lantai2Koridor",
  "title": "Koridor Lantai 2",
  "area": "Gedung Utama · Lantai 2",
  "image": "gedung_utama/lantai_2/koridor_lantai_2.jpg",
  "pitch": 0,
  "yaw": 0,
  "hfov": 100,
  "hotSpots": []
}
```

**Langkah C — buat koneksi** dari panorama lain, misalnya menambahkan hotspot berikut di `hotSpots` scene asal:

```json
{"pitch": -5, "yaw": 90, "sceneId": "lantai2Koridor"}
```

**Langkah D — bila perlu, buat panah kembali** pada scene `lantai2Koridor`:

```json
{"pitch": -5, "yaw": -90, "sceneId": "masukGedung"}
```

Panah balik **tidak dibuat otomatis**. Nilai `pitch`/`yaw` di atas hanya contoh; ukur berdasarkan panorama yang sebenarnya, jangan langsung menganggapnya tepat.

## 5. Mengubah nama, gambar, atau arah awal

Semua perubahan cukup di objek scene yang relevan:

- Mengubah judul: edit `title`.
- Mengubah kelompok area: edit `area`.
- Mengganti foto: upload foto baru, lalu edit `image`; usahakan nama file baru untuk menghindari cache gambar lama.
- Mengubah arah pembuka: edit `yaw` dan `pitch`.
- Mengubah zoom awal: edit `hfov` dalam rentang viewer yang dipakai (saat ini `minHfov: 50`, `maxHfov: 110`).

Jangan ganti `id` hanya karena nama lokasi berubah; `id` adalah referensi navigasi.

## 6. Menentukan posisi panah (hotspot)

Contoh:

```json
{"pitch": -4.6, "yaw": -85.5, "sceneId": "lobiMall"}
```

- `yaw`: posisi horizontal panah. Secara umum sekitar `-180` sampai `180` derajat.
- `pitch`: posisi vertikal panah. Untuk panah jalan biasanya sedikit negatif agar tampil dekat permukaan lantai/jalan.
- `sceneId`: ID tujuan setelah panah diklik.

**Cara kalibrasi yang dianjurkan:** Buka panorama asal, putar ke posisi pintu/jalur yang ingin dituju, lihat nilai pitch/yaw melalui alat kalibrasi/console Pannellum bila tersedia, lalu masukkan nilainya ke JSON. Uji di desktop dan ponsel. Mengganti foto panorama dapat menggeser arah visual; periksa semua hotspot yang menempel pada foto tersebut.

**Contoh koneksi dua arah:**

```text
Scene A (gerbangMasuk)  --panah-->  Scene B (masukGedung)
Scene B (masukGedung)   --panah-->  Scene A (gerbangMasuk)
```

Masing-masing arah memerlukan hotspot di scene asalnya sendiri. Koordinat tiap arah **tidak harus sama**.

## 7. Mengatur shortcut

Shortcut adalah tombol pemilih lokasi yang dibuat dari array `shortcuts`:

```json
"shortcuts": [
  {"sceneId": "depanGedung", "label": "Halaman depan"},
  {"sceneId": "depanMall", "label": "Mall kampus"},
  {"sceneId": "menujuParkiran", "label": "Area parkir"}
]
```

Tambahkan baris jika ingin menampilkan shortcut baru. Pastikan `sceneId` sudah ada di daftar `scenes`.

## 8. Menyiapkan navigasi lantai (opsional)

Untuk saat ini, pertahankan:

```json
"floors": []
```

Saat scene antarlantai sudah tersedia, contoh pengaturannya:

```json
"floors": [
  {"sceneId": "masukGedung", "label": "1"},
  {"sceneId": "lantai2Koridor", "label": "2"}
]
```

Pada implementasi JS saat ini, navigasi lift hanya ditampilkan jika jumlah entri `floors` **lebih dari satu**. Setiap tombol menuju scene masuk lantai yang ditentukan. **Data lantai tidak otomatis membuat sambungan hotspot** antara lantai; tambahkan hotspot jika memang ada jalur navigasi visualnya.

## 9. Validasi sebelum publikasi

**Validasi sintaks JSON** (jalankan di root repository):

```bash
python3 -m json.tool assets/data/360/scenes.json > /dev/null
```

**Validasi ID, target navigasi, dan gambar lokal** (Python 3):

```bash
python3 - <<'PY'
import json
from pathlib import Path

root = Path('assets')
config = json.loads((root / 'data/360/scenes.json').read_text(encoding='utf-8'))
scenes = config['scenes']
ids = [s['id'] for s in scenes]
assert len(ids) == len(set(ids)), 'Ada scene ID duplikat'
assert config['firstScene'] in ids, 'firstScene tidak ditemukan'

for scene in scenes:
    image = Path(scene['image'])
    assert not image.is_absolute() and '..' not in image.parts, scene['image']
    assert (root / 'images/360' / image).is_file(), f"Gambar hilang: {image}"
    for spot in scene.get('hotSpots', []):
        assert spot['sceneId'] in ids, f"Target hotspot tidak ada: {spot['sceneId']}"

for key in ('shortcuts', 'floors'):
    for item in config.get(key, []):
        assert item['sceneId'] in ids, f"Target {key} tidak ada: {item['sceneId']}"

print(f'OK: {len(scenes)} scene dan seluruh referensi valid')
PY
```

Pemeriksaan di atas mengasumsikan folder `assets/images/360` tersedia dalam checkout repository lokal. Jika gambar masih berada di lokasi lain, sesuaikan path terlebih dahulu. Pemeriksaan ini mengecek keberadaan file, bukan kualitas gambar atau ketepatan arah panah.

**Checklist manual sebelum merge/push:**

- [ ] JSON valid dan dapat dibuka di URL GitHub Pages.
- [ ] Semua URL gambar baru berhasil dibuka (bukan `404`).
- [ ] Panorama baru tampil normal (tidak terdistorsi / hitam).
- [ ] Panah menuju lokasi yang benar dan, jika diperlukan, tersedia panah kembali.
- [ ] Shortcut dan lift (jika ada) membuka scene yang benar.
- [ ] Tampilan diuji di desktop dan ponsel.
- [ ] Gambar tidak memuat informasi pribadi yang tidak semestinya dipublikasikan.

## 10. Commit dan publikasi

Contoh perintah Git ketika perubahan sudah diuji:

```bash
git add assets/images/360 assets/data/360/scenes.json
git commit -m "Add panorama koridor lantai 2 and update tour scenes"
git push origin main
```

> Sesuaikan `main` dengan branch yang benar-benar dipakai untuk publikasi GitHub Pages pada repository ini. Tidak semua repo menggunakan branch `main`.

Setelah GitHub Pages memublikasikan commit, cek:

1. `https://prim25.github.io/PrivateAssets/assets/data/360/scenes.json`
2. URL panorama baru.
3. Halaman Virtual Tour UNPRI.

Perubahan data tidak membutuhkan deploy ulang Rails karena HAML hanya menunjuk ke URL JSON tetap. Akan tetapi, ada kemungkinan cache browser/CDN sehingga perubahan tidak langsung terlihat; lakukan hard refresh atau periksa respons jaringan. Untuk perubahan **CSS/JS**, perhatikan parameter versi URL (`?v=...`) yang ada di HAML agar browser tidak mempertahankan file lama.

## 11. Troubleshooting

| Masalah | Pemeriksaan / solusi |
| --- | --- |
| `404` pada gambar | Periksa nama folder, ejaan file, kapitalisasi, dan hasil publikasi GitHub Pages. |
| `404` pada JSON | Pastikan `assets/data/360/scenes.json` ada di branch/folder publikasi GitHub Pages. |
| `Unexpected token` / JSON gagal dibaca | Hapus trailing comma, komentar, dan pastikan string memakai `"` ganda. |
| `firstScene tidak ditemukan` | Samakan `firstScene` dengan salah satu `scenes[].id`. |
| `Target hotspot tidak ditemukan` | Perbaiki `sceneId` yang merujuk ke ID salah/terhapus. |
| Gambar 360° terlihat salah | Verifikasi file memakai proyeksi equirectangular dengan rasio 2:1. |
| Panah terlihat di lokasi tidak tepat | Kalibrasi ulang `pitch` / `yaw` untuk foto panorama saat ini. |
| Scene sudah ditambah tetapi tidak terlihat | Periksa JSON publik, console browser, cache, dan apakah JS yang aktif sudah versi `fetch()` eksternal. |
| Muncul error CORS | Periksa header `Access-Control-Allow-Origin` pada respons JSON dan gambar, serta apakah resource publik dapat diakses melalui HTTPS. |
| Tombol lantai tidak muncul | Isi `floors` dengan **minimal dua** entri berisi `sceneId` valid. |
| Seluruh viewer gagal memuat | Periksa urutan load `tour/application` (Pannellum) sebelum `unpri-tour.js`, Network tab dan Console browser. |

## 12. Praktik pemeliharaan

- Pertahankan `id` scene agar tautan internal tidak terputus.
- Tambah scene baru terlebih dahulu, baru hubungkan hotspot dan shortcut.
- Gunakan folder per area/gedung/lantai agar mudah berkembang.
- Lakukan review/preview sebelum merge ke branch publikasi.
- Hindari menghapus gambar yang masih direferensikan konfigurasi aktif.
- Gunakan riwayat commit Git untuk rollback bila terjadi kesalahan.
- Jangan menyimpan secret, token, credential, atau URL internal privat di JSON publik; **semua file GitHub Pages dapat dibaca publik**.

---

**Ringkasan:** Tambah gambar ke `assets/images/360/` → tambah/edit scene di `assets/data/360/scenes.json` → hubungkan `hotSpots` → validasi → push ke branch GitHub Pages → uji Virtual Tour. **Tidak perlu menyentuh Rails production untuk update konten.**
