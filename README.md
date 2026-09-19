# Sumber Rejeki Gampeng Admin v3.0

Sistem administrasi penjualan, pembelian, pembayaran, dokumen dan persediaan.

## Struktur menu
- Dashboard
- Master Barang
- Pembelian / Barang Masuk
- Penjualan & Pembayaran
- Dokumen
- Persediaan
- Laporan

## Logika transaksi
1. Master Barang menjadi sumber data barang dan harga.
2. Pembelian / Barang Masuk menambah stok.
3. Penjualan mengurangi stok satu kali ketika transaksi disimpan.
4. Pembayaran tidak mengurangi stok.
5. Jika total penjualan Rp11.750.000 dan DP Rp8.000.000, Nota Pembayaran = Rp8.000.000 dan Invoice = Rp3.750.000.
6. Pembayaran berikutnya membuat Nota Pembayaran baru dan memperbarui sisa Invoice.
7. Jika transaksi langsung lunas, tidak dibuat invoice sisa bernilai nol.
8. PO dan Penawaran tidak mengubah stok.
9. Stock Opname mencatat selisih sebagai pergerakan stok yang dapat diaudit.
10. Transaksi yang sudah membentuk histori stok tidak dihapus agar kartu stok tetap dapat ditelusuri.

## Penyimpanan
Versi ini memakai IndexedDB pada browser sebagai penyimpanan lokal. Ini bukan database cloud bersama antar-perangkat. Untuk database online lintas perangkat, diperlukan koneksi database server (misalnya Supabase/Postgres) dan environment variable yang benar.

## Menjalankan
```bash
npm install
npm run dev
```

Untuk production:
```bash
npm run build
npm start
```
