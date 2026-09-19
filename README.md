# Sumber Rejeki Gampeng — Administrasi Penjualan & Persediaan v2.0

Aplikasi Next.js untuk administrasi penjualan, pembelian, pembayaran bertahap, dokumen PO/Penawaran/Invoice/Nota, stok, stock opname, dan laporan.

## Logika transaksi utama
- PO/Penawaran tidak mengubah stok.
- Pembelian/Barang Masuk menambah stok.
- Penjualan/barang keluar mengurangi stok satu kali.
- Pembayaran DP tidak mengurangi stok.
- Setiap pembayaran menghasilkan Nota Pembayaran.
- Invoice transaksi menunjukkan sisa tagihan; pada penjualan baru invoice otomatis dibuat sebagai pasangan transaksi.
- Contoh Rp11.750.000 dibayar DP Rp8.000.000 → Nota DP Rp8.000.000 dan sisa Invoice Rp3.750.000. Pembayaran berikutnya menurunkan sisa sampai Rp0/LUNAS.
- Stock Opname membuat transaksi penyesuaian yang tetap tercatat pada kartu stok.

## Penyimpanan
Versi ini memakai IndexedDB sebagai database browser, bukan localStorage. Ini membuat data lebih terstruktur dan tidak bergantung pada ukuran localStorage. Untuk penggunaan multi-perangkat/terpusat, adapter cloud perlu dipasang ke backend/database (misalnya Supabase/Postgres) sebelum aplikasi digunakan sebagai sistem online bersama.

## Menjalankan
```bash
npm install
npm run build
npm start
```

## Catatan penting
Build sudah diuji dengan `npm run build` pada lingkungan pengembangan. Karena database browser bersifat lokal, jangan menganggap data pada komputer A otomatis muncul pada komputer/HP B tanpa konfigurasi database cloud.
