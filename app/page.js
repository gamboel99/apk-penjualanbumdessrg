'use client';

import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const BUSINESS = {
  name: "SUMBER REJEKI GAMPENG",
  owner: "Bibi Ainia Merazunnisyah",
  address: "Jln Raya Kediri Kertosono KM. 4, Kecamatan Gampeng, Kabupaten Kediri",
  phone: "085708830108",
  email: "Bumdesrejekigampeng@gmail.com",
};

const TYPES = {
  PO: { label: "Purchase Order", prefix: "PO" },
  PENAWARAN: { label: "Surat Penawaran", prefix: "PNW" },
  INVOICE: { label: "Invoice", prefix: "INV" },
  NOTA: { label: "Nota", prefix: "NOTA" },
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const rupiah = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

function makeItem() {
  return { name: "", qty: 1, unit: "pcs", price: 0 };
}

export default function Home() {
  const [type, setType] = useState("PO");
  const [date, setDate] = useState(todayISO());
  const [customer, setCustomer] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
  });
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [items, setItems] = useState([makeItem()]);
  const [sequences, setSequences] = useState({ PO: 0, PNW: 0, INV: 0, NOTA: 0 });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("srg_sequences");
      if (raw) setSequences(JSON.parse(raw));
    } catch {}
  }, []);

  const sequence = sequences[TYPES[type].prefix] || 0;
  const previewNumber = `${TYPES[type].prefix}/${String(sequence + 1).padStart(4, "0")}/SRG/${new Date(date).getFullYear()}`;

  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + Number(i.qty || 0) * Number(i.price || 0), 0),
    [items]
  );
  const discountValue = Math.max(0, Number(discount || 0));
  const afterDiscount = Math.max(0, subtotal - discountValue);
  const taxValue = afterDiscount * (Number(tax || 0) / 100);
  const grandTotal = afterDiscount + taxValue;

  function updateItem(index, key, value) {
    setItems((old) => old.map((it, i) => (i === index ? { ...it, [key]: value } : it)));
  }

  function addItem() {
    setItems((old) => [...old, makeItem()]);
  }

  function removeItem(index) {
    setItems((old) => (old.length === 1 ? old : old.filter((_, i) => i !== index)));
  }

  function commitNumber() {
    const prefix = TYPES[type].prefix;
    const next = { ...sequences, [prefix]: (sequences[prefix] || 0) + 1 };
    setSequences(next);
    localStorage.setItem("srg_sequences", JSON.stringify(next));
    setSaved(true);
    return `${prefix}/${String(next[prefix]).padStart(4, "0")}/SRG/${new Date(date).getFullYear()}`;
  }

  function buildPDF(number, action = "save") {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const margin = 14;

    // Dot-matrix style: monospace font + dotted separators.
    doc.setFont("courier", "bold");
    doc.setFontSize(17);
    doc.text(BUSINESS.name, margin, 17);
    doc.setFont("courier", "normal");
    doc.setFontSize(9);
    doc.text(BUSINESS.owner, margin, 23);
    doc.text(BUSINESS.address, margin, 28);
    doc.text(`Telp. ${BUSINESS.phone} | ${BUSINESS.email}`, margin, 33);

    try {
      doc.addImage("/logo-srg.jpeg", "JPEG", W - 43, 10, 28, 28);
    } catch {}

    doc.setLineDashPattern([1, 1], 0);
    doc.line(margin, 38, W - margin, 38);
    doc.setLineDashPattern([], 0);

    doc.setFont("courier", "bold");
    doc.setFontSize(14);
    doc.text(TYPES[type].label.toUpperCase(), margin, 47);
    doc.setFont("courier", "normal");
    doc.setFontSize(9);
    doc.text(`No. ${number}`, margin, 53);
    doc.text(`Tanggal: ${new Date(date).toLocaleDateString("id-ID")}`, margin, 58);

    doc.setFont("courier", "bold");
    doc.text("KEPADA:", margin, 68);
    doc.setFont("courier", "normal");
    doc.text(customer.name || "-", margin, 73);
    doc.text(customer.address || "-", margin, 78);
    doc.text(customer.phone ? `Telp. ${customer.phone}` : "", margin, 83);

    autoTable(doc, {
      startY: 90,
      margin: { left: margin, right: margin },
      theme: "plain",
      head: [["NO", "URAIAN", "QTY", "SAT", "HARGA", "JUMLAH"]],
      body: items.map((it, i) => [
        i + 1,
        it.name || "-",
        Number(it.qty || 0),
        it.unit || "-",
        rupiah(it.price),
        rupiah(Number(it.qty || 0) * Number(it.price || 0)),
      ]),
      styles: {
        font: "courier",
        fontSize: 8.5,
        cellPadding: 2,
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
      },
      headStyles: {
        font: "courier",
        fontStyle: "bold",
        fillColor: [245, 245, 245],
        textColor: [0, 0, 0],
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 65 },
        2: { cellWidth: 15, halign: "right" },
        3: { cellWidth: 18 },
        4: { cellWidth: 32, halign: "right" },
        5: { cellWidth: 36, halign: "right" },
      },
    });

    let y = doc.lastAutoTable.finalY + 7;
    doc.setFont("courier", "normal");
    doc.text(`Subtotal       : ${rupiah(subtotal)}`, W - 82, y);
    y += 5;
    doc.text(`Potongan       : ${rupiah(discountValue)}`, W - 82, y);
    y += 5;
    doc.text(`Pajak ${Number(tax || 0)}%       : ${rupiah(taxValue)}`, W - 82, y);
    y += 6;
    doc.setFont("courier", "bold");
    doc.text(`TOTAL          : ${rupiah(grandTotal)}`, W - 82, y);

    y += 10;
    doc.setFont("courier", "normal");
    doc.text("Catatan:", margin, y);
    y += 5;
    const noteLines = doc.splitTextToSize(notes || "-", W - 2 * margin);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 5 + 10;

    doc.text("Hormat kami,", W - 58, y);
    y += 18;
    doc.setFont("courier", "bold");
    doc.text(BUSINESS.owner, W - 72, y);

    doc.setFont("courier", "normal");
    doc.setFontSize(7);
    doc.text("Dokumen dibuat secara elektronik oleh Sistem Sumber Rejeki Gampeng.", margin, 286);

    const filename = `${TYPES[type].prefix}-${number.replaceAll("/", "-")}.pdf`;
    if (action === "blob") return { blob: doc.output("blob"), filename };
    doc.save(filename);
    return { blob: doc.output("blob"), filename };
  }

  async function generateAndSave() {
    const number = commitNumber();
    buildPDF(number, "save");
  }

  async function sendWhatsApp() {
    const number = commitNumber();
    const { blob, filename } = buildPDF(number, "blob");
    const message = `Dokumen ${TYPES[type].label} ${number} dari ${BUSINESS.name}. Total ${rupiah(grandTotal)}.`;
    let shared = false;

    try {
      const file = new File([blob], filename, { type: "application/pdf" });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: TYPES[type].label, text: message, files: [file] });
        shared = true;
      }
    } catch {}

    if (!shared) {
      const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(url, "_blank", "noopener,noreferrer");
      alert("WhatsApp dibuka. Jika PDF belum ikut terlampir, gunakan tombol Download PDF lalu lampirkan file tersebut di WhatsApp.");
    }
  }

  function printDocument() {
    const number = commitNumber();
    const { blob } = buildPDF(number, "blob");
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (w) setTimeout(() => w.print(), 1200);
  }

  function resetForm() {
    setCustomer({ name: "", address: "", phone: "", email: "" });
    setNotes("");
    setDiscount(0);
    setTax(0);
    setItems([makeItem()]);
    setSaved(false);
  }

  return (
    <main className="page">
      <header className="topbar">
        <div className="brand">
          <img src="/logo-srg.jpeg" alt="Logo Sumber Rejeki Gampeng" />
          <div>
            <div className="brand-title">SUMBER REJEKI GAMPENG</div>
            <div className="brand-sub">Sistem Dokumen Penjualan • PO • Penawaran • Invoice • Nota</div>
          </div>
        </div>
        <div className="status">{saved ? "✓ NOMOR TERSIMPAN" : "SIAP DIGUNAKAN"}</div>
      </header>

      <section className="layout">
        <div className="panel form-panel">
          <div className="panel-head">
            <div>
              <h1>Buat Dokumen</h1>
              <p>Isi data transaksi, lalu cetak atau buat PDF.</p>
            </div>
          </div>

          <div className="grid2">
            <label>Jenis Dokumen
              <select value={type} onChange={(e) => setType(e.target.value)}>
                {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </label>
            <label>Tanggal
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
          </div>

          <div className="number-box">
            <span>NOMOR BERIKUTNYA</span>
            <strong>{previewNumber}</strong>
          </div>

          <h2>Data Pelanggan</h2>
          <div className="grid2">
            <label>Nama / Instansi
              <input value={customer.name} onChange={(e) => setCustomer({...customer, name: e.target.value})} placeholder="Nama pelanggan / instansi" />
            </label>
            <label>No. WhatsApp
              <input value={customer.phone} onChange={(e) => setCustomer({...customer, phone: e.target.value})} placeholder="08xxxxxxxxxx" />
            </label>
          </div>
          <label>Alamat
            <textarea rows="2" value={customer.address} onChange={(e) => setCustomer({...customer, address: e.target.value})} placeholder="Alamat pelanggan" />
          </label>

          <h2>Rincian Barang / Jasa</h2>
          <div className="items">
            {items.map((it, i) => (
              <div className="item-row" key={i}>
                <input className="item-name" value={it.name} onChange={(e) => updateItem(i, "name", e.target.value)} placeholder="Nama barang / jasa" />
                <input className="qty" type="number" min="0" value={it.qty} onChange={(e) => updateItem(i, "qty", e.target.value)} />
                <input className="unit" value={it.unit} onChange={(e) => updateItem(i, "unit", e.target.value)} placeholder="sat" />
                <input className="price" type="number" min="0" value={it.price} onChange={(e) => updateItem(i, "price", e.target.value)} placeholder="Harga" />
                <button className="remove" onClick={() => removeItem(i)} title="Hapus">×</button>
              </div>
            ))}
          </div>
          <button className="secondary" onClick={addItem}>＋ Tambah Barang</button>

          <div className="grid3 totals-input">
            <label>Potongan (Rp)
              <input type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </label>
            <label>Pajak (%)
              <input type="number" min="0" step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} />
            </label>
            <div className="grand"><span>TOTAL</span><strong>{rupiah(grandTotal)}</strong></div>
          </div>

          <label>Catatan
            <textarea rows="3" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Syarat pembayaran, rekening, ucapan, dll." />
          </label>

          <div className="actions">
            <button className="primary" onClick={generateAndSave}>⬇ Download PDF</button>
            <button className="wa" onClick={sendWhatsApp}>☏ Kirim via WhatsApp</button>
            <button className="print" onClick={printDocument}>⎙ Cetak</button>
            <button className="secondary" onClick={resetForm}>Reset</button>
          </div>
          <div className="hint">
            Nomor otomatis tersimpan di browser ini. Setiap kali tombol PDF/WhatsApp/Cetak digunakan, nomor berikutnya akan naik satu.
          </div>
        </div>

        <div className="panel preview-panel">
          <div className="preview-title">PREVIEW • DOT MATRIX</div>
          <div className="paper">
            <div className="paper-head">
              <img src="/logo-srg.jpeg" alt="" />
              <div>
                <div className="paper-business">{BUSINESS.name}</div>
                <div>{BUSINESS.owner}</div>
                <div>{BUSINESS.address}</div>
                <div>{BUSINESS.phone} • {BUSINESS.email}</div>
              </div>
            </div>
            <div className="dots"></div>
            <div className="doc-title">{TYPES[type].label.toUpperCase()}</div>
            <div>No. {previewNumber}</div>
            <div>Tanggal: {new Date(date).toLocaleDateString("id-ID")}</div>
            <br />
            <div><b>KEPADA:</b> {customer.name || "........................................"}</div>
            <div>{customer.address || "........................................"}</div>
            <div className="dots"></div>
            <table>
              <thead><tr><th>NO</th><th>URAIAN</th><th>QTY</th><th>HARGA</th><th>JUMLAH</th></tr></thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td><td>{it.name || "-"}</td><td>{it.qty} {it.unit}</td>
                    <td className="right">{rupiah(it.price)}</td>
                    <td className="right">{rupiah(Number(it.qty || 0) * Number(it.price || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="dots"></div>
            <div className="summary">
              <div>Subtotal <span>{rupiah(subtotal)}</span></div>
              <div>Potongan <span>{rupiah(discountValue)}</span></div>
              <div>Pajak {tax}% <span>{rupiah(taxValue)}</span></div>
              <div className="total-line">TOTAL <span>{rupiah(grandTotal)}</span></div>
            </div>
            <div className="dots"></div>
            <div>Catatan: {notes || "-"}</div>
            <div className="sign">Hormat kami,<br /><br /><b>{BUSINESS.owner}</b></div>
          </div>
        </div>
      </section>

      <footer>
        Sumber Rejeki Gampeng • Jln Raya Kediri Kertosono KM. 4, Kecamatan Gampeng, Kabupaten Kediri • {BUSINESS.phone}
      </footer>
    </main>
  );
}
