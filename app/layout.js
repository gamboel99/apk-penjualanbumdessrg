import "./globals.css";

export const metadata = {
  title: "Sumber Rejeki Gampeng — Dokumen Penjualan",
  description: "PO, Penawaran, Invoice dan Nota",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
