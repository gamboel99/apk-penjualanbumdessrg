# Sumber Rejeki Gampeng — PO, Penawaran, Invoice & Nota

Aplikasi web sederhana untuk membuat:
- Purchase Order (PO)
- Surat Penawaran
- Invoice
- Nota

Fitur:
- Nomor dokumen otomatis dan berurutan.
- Data usaha sudah terisi sesuai identitas Sumber Rejeki Gampeng.
- Tampilan dokumen bergaya dot-matrix/struk.
- PDF dibuat langsung di browser dengan jsPDF.
- Tombol Cetak, Download PDF, dan Kirim via WhatsApp.
- Data nomor terakhir tersimpan di browser (`localStorage`).
- Tidak membutuhkan database untuk versi satu komputer/browser.

## Jalankan lokal

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`.

## Deploy ke Vercel

1. Upload folder ini ke GitHub.
2. Di Vercel pilih **Add New → Project**.
3. Import repository GitHub tersebut.
4. Framework akan terdeteksi sebagai Next.js.
5. Klik Deploy.

## Catatan nomor otomatis

Versi ini menyimpan nomor terakhir di browser yang digunakan. Jadi cocok untuk satu komputer/admin.

Jika nantinya beberapa petugas harus memakai nomor yang sama secara terpusat, tambahkan database (misalnya Supabase/PostgreSQL) untuk sequence nomor dokumen.

## WhatsApp

Browser modern dapat membuka WhatsApp dengan pesan yang sudah disiapkan. Pada perangkat yang mendukung Web Share API, aplikasi juga mencoba membagikan file PDF sebagai lampiran. Untuk pengiriman PDF otomatis tanpa interaksi pengguna ke nomor WhatsApp tertentu, diperlukan WhatsApp Business Cloud API/backend.
