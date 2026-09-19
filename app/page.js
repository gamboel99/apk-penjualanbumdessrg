'use client';

import { useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const BUSINESS = {
  name: 'SUMBER REJEKI GAMPENG',
  owner: 'Bibi Ainia Merazunnisyah',
  address: 'Jln Raya Kediri Kertosono KM. 4, Kecamatan Gampeng, Kabupaten Kediri',
  phone: '085708830108',
  email: 'Bumdesrejekigampeng@gmail.com',
};

const NAV = [
  ['dashboard', '⌂', 'Dashboard'],
  ['master', '▣', 'Master Barang'],
  ['purchases', '↓', 'Pembelian / Barang Masuk'],
  ['sales', '↑', 'Penjualan & Pembayaran'],
  ['documents', '▤', 'Dokumen'],
  ['inventory', '◫', 'Persediaan'],
  ['reports', '▥', 'Laporan'],
];

const emptyDB = {
  products: [], purchases: [], sales: [], payments: [], documents: [], stockMoves: [], opname: [],
  sequences: { PO: 0, PNW: 0, INV: 0, NOTA: 0 },
};

const today = () => new Date().toISOString().slice(0, 10);
const money = (v) => Math.round(Number(v || 0));
const rupiah = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(money(v));
const uid = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const copy = (v) => JSON.parse(JSON.stringify(v));
const fmtDate = (d) => d ? new Date(`${d}T00:00:00`).toLocaleDateString('id-ID') : '-';

function blankLine() { return { productId: '', name: '', qty: 1, unit: 'pcs', price: 0 }; }
function calcTotal(items, discount, tax) {
  const subtotal = items.reduce((s, x) => s + money(x.qty) * money(x.price), 0);
  const disc = Math.min(Math.max(0, money(discount)), subtotal);
  const base = subtotal - disc;
  const taxValue = Math.round(base * (Number(tax || 0) / 100));
  return { subtotal, discount: disc, taxValue, total: base + taxValue };
}

export default function Home() {
  const [db, setDb] = useState(emptyDB);
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState('dashboard');
  const [notice, setNotice] = useState('');

  const [productForm, setProductForm] = useState({ code: '', name: '', unit: 'pcs', buyPrice: '', sellPrice: '', openingStock: '', minStock: '' });
  const [editingProduct, setEditingProduct] = useState(null);
  const [productSearch, setProductSearch] = useState('');

  const [purchase, setPurchase] = useState({ date: today(), supplier: '', poRef: '', items: [blankLine()], notes: '' });
  const [sale, setSale] = useState({ date: today(), customer: { name: '', phone: '', address: '' }, items: [blankLine()], discount: 0, tax: 0, payment: 0, method: 'Transfer', notes: '' });
  const [documentForm, setDocumentForm] = useState({ type: 'PO', date: today(), party: { name: '', phone: '', address: '' }, items: [blankLine()], discount: 0, tax: 0, notes: '' });
  const [payment, setPayment] = useState({ saleId: '', date: today(), amount: '', method: 'Transfer' });
  const [opname, setOpname] = useState({ date: today(), productId: '', physical: '' });
  const [reportRange, setReportRange] = useState('all');
  const [searchSales, setSearchSales] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const value = await idbRead();
        if (active && value) setDb({ ...emptyDB, ...value, sequences: { ...emptyDB.sequences, ...(value.sequences || {}) } });
      } catch (e) { console.error(e); }
      if (active) setReady(true);
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => { if (ready) idbWrite(db); }, [db, ready]);
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(''), 3500); return () => clearTimeout(t); }, [notice]);

  const stock = useMemo(() => {
    const m = Object.fromEntries(db.products.map(p => [p.id, money(p.openingStock)]));
    db.stockMoves.forEach(move => { m[move.productId] = money(m[move.productId]) + money(move.qty); });
    return m;
  }, [db.products, db.stockMoves]);

  const totals = useMemo(() => ({
    sales: db.sales.reduce((s, x) => s + money(x.total), 0),
    purchases: db.purchases.reduce((s, x) => s + money(x.total), 0),
    receivable: db.sales.reduce((s, x) => s + Math.max(0, money(x.total) - money(x.paid)), 0),
    low: db.products.filter(p => money(stock[p.id]) <= money(p.minStock)).length,
  }), [db.sales, db.purchases, db.products, stock]);

  const saleTotal = useMemo(() => calcTotal(sale.items, sale.discount, sale.tax), [sale.items, sale.discount, sale.tax]);
  const purchaseTotal = useMemo(() => calcTotal(purchase.items, 0, 0), [purchase.items]);
  const docTotal = useMemo(() => calcTotal(documentForm.items, documentForm.discount, documentForm.tax), [documentForm.items, documentForm.discount, documentForm.tax]);

  function notify(msg) { setNotice(msg); }
  function nextNumber(prefix, date) {
    const next = money(db.sequences[prefix]) + 1;
    const year = new Date(`${date}T00:00:00`).getFullYear();
    return { number: `${prefix}/${String(next).padStart(4, '0')}/SRG/${year}`, next };
  }
  function commitSequence(prefix, date) {
    const result = nextNumber(prefix, date);
    setDb(d => ({ ...d, sequences: { ...d.sequences, [prefix]: result.next } }));
    return result.number;
  }
  function productById(id) { return db.products.find(p => p.id === id); }
  function updateLine(setter, index, key, value) { setter(old => ({ ...old, items: old.items.map((x, i) => i === index ? { ...x, [key]: value } : x) })); }
  function chooseProduct(setter, index, id) {
    const p = productById(id);
    setter(old => ({ ...old, items: old.items.map((x, i) => i === index ? { ...x, productId: id, name: p?.name || '', unit: p?.unit || 'pcs', price: p?.sellPrice || 0 } : x) }));
  }
  function addLine(setter) { setter(old => ({ ...old, items: [...old.items, blankLine()] })); }
  function removeLine(setter, index) { setter(old => ({ ...old, items: old.items.length === 1 ? old.items : old.items.filter((_, i) => i !== index) })); }
  function validStockLines(lines, strict = true) {
    if (!lines.length) return false;
    return lines.every(x => x.productId && money(x.qty) > 0 && (!strict || money(x.qty) <= money(stock[x.productId])));
  }

  function resetSale() { setSale({ date: today(), customer: { name: '', phone: '', address: '' }, items: [blankLine()], discount: 0, tax: 0, payment: 0, method: 'Transfer', notes: '' }); }
  function resetPurchase() { setPurchase({ date: today(), supplier: '', poRef: '', items: [blankLine()], notes: '' }); }

  function saveProduct(e) {
    e.preventDefault();
    const f = productForm;
    if (!f.name.trim()) return notify('Nama barang wajib diisi.');
    if (editingProduct) {
      setDb(d => ({ ...d, products: d.products.map(p => p.id === editingProduct ? { ...p, code: f.code || p.code, name: f.name.trim(), unit: f.unit || 'pcs', buyPrice: money(f.buyPrice), sellPrice: money(f.sellPrice), minStock: money(f.minStock) } : p) }));
      notify(`Master barang ${f.name} diperbarui.`);
    } else {
      const code = f.code.trim() || `BRG${String(db.products.length + 1).padStart(4, '0')}`;
      if (db.products.some(p => p.code.toLowerCase() === code.toLowerCase())) return notify('Kode barang sudah digunakan.');
      const p = { id: uid('prd'), code, name: f.name.trim(), unit: f.unit || 'pcs', buyPrice: money(f.buyPrice), sellPrice: money(f.sellPrice), openingStock: money(f.openingStock), minStock: money(f.minStock) };
      setDb(d => ({ ...d, products: [...d.products, p] }));
      notify(`Barang ${p.name} berhasil ditambahkan.`);
    }
    setProductForm({ code: '', name: '', unit: 'pcs', buyPrice: '', sellPrice: '', openingStock: '', minStock: '' });
    setEditingProduct(null);
  }
  function editProduct(p) { setEditingProduct(p.id); setProductForm({ code: p.code, name: p.name, unit: p.unit, buyPrice: p.buyPrice, sellPrice: p.sellPrice, openingStock: p.openingStock, minStock: p.minStock }); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function deleteProduct(p) {
    if (db.stockMoves.some(m => m.productId === p.id) || db.sales.some(s => s.items.some(i => i.productId === p.id)) || db.purchases.some(x => x.items.some(i => i.productId === p.id))) return notify('Barang yang sudah dipakai dalam transaksi tidak boleh dihapus.');
    if (!window.confirm(`Hapus ${p.name} dari Master Barang?`)) return;
    setDb(d => ({ ...d, products: d.products.filter(x => x.id !== p.id) }));
    notify('Barang dihapus.');
  }

  function savePurchase() {
    if (!purchase.supplier.trim()) return notify('Supplier wajib diisi.');
    if (!validStockLines(purchase.items, false)) return notify('Pilih barang dari Master Barang dan isi jumlah.');
    const number = commitSequence('PO', purchase.date);
    const record = { id: uid('pur'), number, date: purchase.date, supplier: purchase.supplier.trim(), poRef: purchase.poRef.trim(), items: copy(purchase.items), total: purchaseTotal.total, notes: purchase.notes };
    const moves = purchase.items.map(i => ({ id: uid('move'), date: purchase.date, productId: i.productId, qty: money(i.qty), ref: number, kind: 'PEMBELIAN', note: purchase.poRef ? `PO ${purchase.poRef}` : '' }));
    setDb(d => ({ ...d, purchases: [record, ...d.purchases], stockMoves: [...moves, ...d.stockMoves], documents: [{ id: uid('doc'), number, type: 'PO', date: purchase.date, party: { name: purchase.supplier }, items: copy(purchase.items), total: purchaseTotal.total, notes: purchase.notes }, ...d.documents] }));
    notify(`Barang masuk ${number} tersimpan. Stok bertambah otomatis.`);
    resetPurchase();
  }

  function saveSale() {
    if (!sale.customer.name.trim()) return notify('Nama pelanggan wajib diisi.');
    if (!validStockLines(sale.items, true)) return notify('Pastikan semua barang berasal dari Master Barang dan stok mencukupi.');
    if (saleTotal.total <= 0) return notify('Total penjualan harus lebih dari nol.');
    const initialPayment = Math.min(Math.max(0, money(sale.payment)), saleTotal.total);
    const saleNumber = commitSequence('NOTA', sale.date);
    const remaining = saleTotal.total - initialPayment;
    const invoiceNumber = remaining > 0 ? commitSequence('INV', sale.date) : '';
    const saleRecord = { id: uid('sale'), number: saleNumber, invoiceNumber, date: sale.date, customer: copy(sale.customer), items: copy(sale.items), subtotal: saleTotal.subtotal, discount: saleTotal.discount, taxValue: saleTotal.taxValue, total: saleTotal.total, paid: initialPayment, status: remaining === 0 ? 'LUNAS' : initialPayment > 0 ? 'SEBAGIAN / DP' : 'BELUM LUNAS', notes: sale.notes };
    const moves = sale.items.map(i => ({ id: uid('move'), date: sale.date, productId: i.productId, qty: -money(i.qty), ref: saleNumber, kind: 'PENJUALAN', note: 'Barang keluar' }));
    const docs = [];
    const paymentsToAdd = [];
    if (initialPayment > 0) {
      docs.push({ id: uid('doc'), number: saleNumber, type: 'NOTA', date: sale.date, party: copy(sale.customer), items: copy(sale.items), total: initialPayment, paymentAmount: initialPayment, relatedSaleId: saleRecord.id, fullTotal: saleTotal.total, remaining, notes: `Pembayaran DP/uang muka untuk transaksi ${saleNumber}.` });
      paymentsToAdd.push({ id: uid('pay'), saleId: saleRecord.id, number: saleNumber, date: sale.date, amount: initialPayment, method: sale.method });
    }
    if (remaining > 0) {
      docs.push({ id: uid('doc'), number: invoiceNumber, type: 'INVOICE', date: sale.date, party: copy(sale.customer), items: copy(sale.items), subtotal: saleTotal.subtotal, discount: saleTotal.discount, taxValue: saleTotal.taxValue, fullTotal: saleTotal.total, total: remaining, paid: initialPayment, remaining, relatedSaleId: saleRecord.id, notes: sale.notes });
    }
    setDb(d => ({ ...d, sales: [saleRecord, ...d.sales], payments: [...paymentsToAdd, ...d.payments], stockMoves: [...moves, ...d.stockMoves], documents: [...docs, ...d.documents] }));
    notify(`Penjualan ${saleNumber} tersimpan. ${initialPayment ? `Nota pembayaran ${rupiah(initialPayment)} dibuat. ` : ''}${remaining > 0 ? `Invoice sisa ${rupiah(remaining)} dibuat.` : 'Transaksi langsung LUNAS; tidak ada sisa invoice.'}`);
    resetSale();
  }

  function recordPayment() {
    const s = db.sales.find(x => x.id === payment.saleId);
    const amount = money(payment.amount);
    if (!s || amount <= 0) return notify('Pilih transaksi dan isi jumlah pembayaran.');
    const remaining = Math.max(0, money(s.total) - money(s.paid));
    if (remaining <= 0) return notify('Transaksi ini sudah lunas.');
    if (amount > remaining) return notify(`Pembayaran tidak boleh melebihi sisa ${rupiah(remaining)}.`);
    const notaNumber = commitSequence('NOTA', payment.date);
    const newPaid = money(s.paid) + amount;
    const newRemaining = money(s.total) - newPaid;
    const newStatus = newRemaining === 0 ? 'LUNAS' : 'SEBAGIAN / DP';
    const payRecord = { id: uid('pay'), saleId: s.id, number: notaNumber, date: payment.date, amount, method: payment.method };
    const doc = { id: uid('doc'), number: notaNumber, type: 'NOTA', date: payment.date, party: copy(s.customer), items: copy(s.items), total: amount, paymentAmount: amount, relatedSaleId: s.id, fullTotal: s.total, remaining: newRemaining, notes: `Pembayaran ${payment.method}. Transaksi ${s.number}. Sisa setelah pembayaran ${rupiah(newRemaining)}.` };
    setDb(d => ({ ...d, payments: [payRecord, ...d.payments], sales: d.sales.map(x => x.id === s.id ? { ...x, paid: newPaid, status: newStatus } : x), documents: [doc, ...d.documents].map(x => x.type === 'INVOICE' && x.relatedSaleId === s.id ? { ...x, total: newRemaining, paid: newPaid, remaining: newRemaining } : x) }));
    setPayment({ saleId: '', date: today(), amount: '', method: 'Transfer' });
    notify(`Nota ${notaNumber} dibuat. ${newRemaining ? `Sisa ${rupiah(newRemaining)}.` : 'Transaksi LUNAS.'}`);
  }

  function saveStandaloneDocument() {
    const prefix = documentForm.type === 'PO' ? 'PO' : 'PNW';
    if (!documentForm.party.name.trim()) return notify('Nama pelanggan/supplier wajib diisi.');
    if (!documentForm.items.some(x => x.name.trim() && money(x.qty) > 0)) return notify('Minimal satu barang harus diisi.');
    const number = commitSequence(prefix, documentForm.date);
    const total = docTotal.total;
    const doc = { id: uid('doc'), number, type: documentForm.type, date: documentForm.date, party: copy(documentForm.party), items: copy(documentForm.items), subtotal: docTotal.subtotal, discount: docTotal.discount, taxValue: docTotal.taxValue, total, notes: documentForm.notes };
    setDb(d => ({ ...d, documents: [doc, ...d.documents] }));
    setDocumentForm({ type: documentForm.type, date: today(), party: { name: '', phone: '', address: '' }, items: [blankLine()], discount: 0, tax: 0, notes: '' });
    notify(`${documentForm.type === 'PO' ? 'PO' : 'Penawaran'} ${number} tersimpan tanpa mengubah stok.`);
  }

  function saveOpname() {
    const p = productById(opname.productId); const physical = money(opname.physical);
    if (!p || opname.physical === '') return notify('Pilih barang dan isi stok fisik.');
    const system = money(stock[p.id]); const diff = physical - system;
    const move = { id: uid('move'), date: opname.date, productId: p.id, qty: diff, ref: `OPNAME/${opname.date}`, kind: 'STOCK OPNAME', note: `Sistem ${system}; fisik ${physical}; selisih ${diff}` };
    setDb(d => ({ ...d, stockMoves: [move, ...d.stockMoves], opname: [{ ...move, systemStock: system, physicalStock: physical, difference: diff }, ...d.opname] }));
    setOpname({ date: today(), productId: '', physical: '' });
    notify(`Stock opname tersimpan. Penyesuaian ${diff >= 0 ? '+' : ''}${diff}.`);
  }

  function deleteTransaction(kind, id) {
    if (!window.confirm('Hapus transaksi ini? Untuk menjaga audit stok, penghapusan transaksi belum didukung. Gunakan koreksi/stock opname.')) return;
    notify('Penghapusan transaksi diblokir agar kartu stok tetap dapat diaudit.');
  }

  function filteredProducts() {
    const q = productSearch.toLowerCase();
    return db.products.filter(p => `${p.code} ${p.name} ${p.unit}`.toLowerCase().includes(q));
  }
  const filteredSales = db.sales.filter(s => `${s.number} ${s.customer?.name || ''}`.toLowerCase().includes(searchSales.toLowerCase()));
  const activeSale = db.sales.find(s => s.id === payment.saleId);

  function render() {
    if (!ready) return <div className="loading-screen"><div className="loader-card"><img src="/logo-srg.jpeg"/><strong>Memuat Sumber Rejeki Gampeng…</strong></div></div>;
    return <div className="app-shell">
      <header className="topbar">
        <div className="brand"><img src="/logo-srg.jpeg" alt="Logo SRG"/><div><div className="brand-title">SUMBER REJEKI GAMPENG</div><div className="brand-sub">Administrasi Penjualan • Pembelian • Persediaan</div></div></div>
        <div className="db-badge"><span className="dot"/> DATABASE LOKAL AKTIF</div>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <div className="nav-label">MENU UTAMA</div>
          {NAV.map(([id, icon, label]) => <button key={id} className={`nav-btn ${page === id ? 'active' : ''} ${id === 'master' ? 'master-nav' : ''}`} onClick={() => setPage(id)}><span>{icon}</span>{label}</button>)}
          <div className="side-note"><b>Alur sistem</b><br/>Master Barang → Transaksi → Stok → Pembayaran → Laporan</div>
        </aside>
        <main className="main-content">
          {notice && <div className="notice">✓ {notice}</div>}
          {page === 'dashboard' && <Dashboard db={db} stock={stock} totals={totals} setPage={setPage}/>} 
          {page === 'master' && <Master products={filteredProducts()} stock={stock} form={productForm} setForm={setProductForm} save={saveProduct} edit={editProduct} remove={deleteProduct} editing={editingProduct} cancel={() => {setEditingProduct(null);setProductForm({ code: '', name: '', unit: 'pcs', buyPrice: '', sellPrice: '', openingStock: '', minStock: ''});}} search={productSearch} setSearch={setProductSearch}/>} 
          {page === 'purchases' && <Purchases purchases={db.purchases} purchase={purchase} setPurchase={setPurchase} products={db.products} stock={stock} total={purchaseTotal} addLine={addLine} removeLine={removeLine} updateLine={updateLine} chooseProduct={chooseProduct} save={savePurchase} />} 
          {page === 'sales' && <Sales sale={sale} setSale={setSale} products={db.products} stock={stock} total={saleTotal} addLine={addLine} removeLine={removeLine} updateLine={updateLine} chooseProduct={chooseProduct} save={saveSale} sales={filteredSales} search={searchSales} setSearch={setSearchSales} payment={payment} setPayment={setPayment} activeSale={activeSale} recordPayment={recordPayment}/>} 
          {page === 'documents' && <Documents documents={db.documents} db={db}/>} 
          {page === 'inventory' && <Inventory products={db.products} stock={stock} moves={db.stockMoves} opname={db.opname} form={opname} setForm={setOpname} save={saveOpname}/>} 
          {page === 'reports' && <Reports db={db} stock={stock} totals={totals} range={reportRange} setRange={setReportRange}/>} 
        </main>
      </div>
      <footer>© {new Date().getFullYear()} Sumber Rejeki Gampeng • Sistem Administrasi Internal</footer>
    </div>;
  }
  return render();
}

function Dashboard({ db, stock, totals, setPage }) {
  const latest = db.sales.slice(0, 5);
  const low = db.products.filter(p => money(stock[p.id]) <= money(p.minStock)).slice(0, 6);
  const max = Math.max(1, ...db.sales.slice(0, 7).map(x => money(x.total)));
  return <>
    <PageTitle title="Dashboard" sub="Ringkasan aktivitas Sumber Rejeki Gampeng." actions={<button className="btn primary" onClick={() => setPage('master')}>＋ Tambah Barang</button>}/>
    <div className="stat-grid">
      <Stat label="Penjualan" value={rupiah(totals.sales)} tone="blue" icon="↑"/>
      <Stat label="Pembelian" value={rupiah(totals.purchases)} tone="green" icon="↓"/>
      <Stat label="Piutang / Sisa" value={rupiah(totals.receivable)} tone="orange" icon="Rp"/>
      <Stat label="Stok Menipis" value={`${totals.low} item`} tone="red" icon="!"/>
    </div>
    <div className="dashboard-grid">
      <section className="panel chart-panel"><PanelHead title="Penjualan Terbaru" sub="Nilai transaksi terbaru"/><div className="bar-chart">{latest.length ? latest.map(s => <div className="bar-row" key={s.id}><div className="bar-label"><span>{s.number}</span><b>{rupiah(s.total)}</b></div><div className="bar-track"><i style={{width:`${Math.max(5, money(s.total)/max*100)}%`}}/></div></div>) : <Empty text="Belum ada transaksi penjualan."/>}</div></section>
      <section className="panel"><PanelHead title="Stok Menipis" sub="Perlu diperhatikan"/><div className="low-list">{low.length ? low.map(p => <div className="low-row" key={p.id}><div><b>{p.name}</b><small>{p.code} • min. {p.minStock} {p.unit}</small></div><strong>{money(stock[p.id])} {p.unit}</strong></div>) : <Empty text="Tidak ada stok menipis."/>}</div></section>
    </div>
    <section className="panel"><PanelHead title="Alur Kerja" sub="Semua transaksi saling terhubung"/><div className="flow"><span>MASTER BARANG</span><b>→</b><span>PEMBELIAN</span><b>→</b><span>STOK</span><b>→</b><span>PENJUALAN</span><b>→</b><span>PEMBAYARAN</span><b>→</b><span>LAPORAN</span></div></section>
  </>;
}

function Master({ products, stock, form, setForm, save, edit, remove, editing, cancel, search, setSearch }) {
  return <><PageTitle title="Master Barang" sub="Pusat data barang. Semua transaksi memilih barang dari sini." actions={<span className="pill blue-pill">{products.length} jenis barang</span>}/>
    <div className="master-layout">
      <section className="panel form-card"><PanelHead title={editing ? 'Edit Barang' : 'Tambah Barang'} sub={editing ? 'Perbarui data master tanpa mengubah histori stok.' : 'Buat data barang sebelum melakukan transaksi.'}/><form onSubmit={save} className="form-grid">
        <Field label="Kode Barang"><input value={form.code} onChange={e=>setForm({...form,code:e.target.value})} placeholder="BRG0001"/></Field>
        <Field label="Nama Barang"><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Contoh: Semen" required/></Field>
        <Field label="Satuan"><input value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})} placeholder="sak / pcs / kg"/></Field>
        <Field label="Harga Beli"><MoneyInput value={form.buyPrice} onChange={v=>setForm({...form,buyPrice:v})}/></Field>
        <Field label="Harga Jual"><MoneyInput value={form.sellPrice} onChange={v=>setForm({...form,sellPrice:v})}/></Field>
        {!editing && <Field label="Stok Awal"><input type="number" min="0" value={form.openingStock} onChange={e=>setForm({...form,openingStock:e.target.value})}/></Field>}
        <Field label="Stok Minimum"><input type="number" min="0" value={form.minStock} onChange={e=>setForm({...form,minStock:e.target.value})}/></Field>
        <div className="form-actions"><button className="btn primary">{editing ? 'Simpan Perubahan' : 'Simpan Barang'}</button>{editing && <button type="button" className="btn secondary" onClick={cancel}>Batal</button>}</div>
      </form></section>
      <section className="panel table-card"><div className="table-toolbar"><PanelHead title="Daftar Barang" sub="Harga dan stok aktual"/><input className="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="⌕ Cari kode / nama barang…"/></div><DataTable headers={['Kode','Nama Barang','Satuan','Harga Beli','Harga Jual','Stok','Minimum','Aksi']} rows={products.map(p=>[p.code,<b>{p.name}</b>,p.unit,rupiah(p.buyPrice),rupiah(p.sellPrice),<strong className={money(stock[p.id])<=money(p.minStock)?'danger-text':''}>{money(stock[p.id])}</strong>,p.minStock,<><button className="mini" onClick={()=>edit(p)}>Edit</button><button className="mini danger-mini" onClick={()=>remove(p)}>Hapus</button></>])}/></section>
    </div>
  </>;
}

function Purchases({ purchases, purchase, setPurchase, products, stock, total, addLine, removeLine, updateLine, chooseProduct, save }) {
  return <><PageTitle title="Pembelian / Barang Masuk" sub="Barang yang disimpan di sini langsung menambah stok."/><section className="panel"><PanelHead title="Input Barang Masuk" sub="PO boleh dicantumkan sebagai referensi. Stok bertambah saat transaksi disimpan."/><div className="form-grid three"><Field label="Tanggal"><input type="date" value={purchase.date} onChange={e=>setPurchase({...purchase,date:e.target.value})}/></Field><Field label="Supplier"><input value={purchase.supplier} onChange={e=>setPurchase({...purchase,supplier:e.target.value})} placeholder="Nama supplier"/></Field><Field label="PO Referensi"><input value={purchase.poRef} onChange={e=>setPurchase({...purchase,poRef:e.target.value})} placeholder="Opsional"/></Field></div><LineEditor lines={purchase.items} products={products} stock={stock} setter={setPurchase} updateLine={updateLine} chooseProduct={chooseProduct} addLine={addLine} removeLine={removeLine} priceKey="buyPrice"/><div className="total-strip"><span>Total Pembelian</span><strong>{rupiah(total.total)}</strong><button className="btn primary" onClick={save}>Simpan Barang Masuk</button></div></section><section className="panel"><PanelHead title="Riwayat Pembelian" sub="Transaksi terbaru"/><DataTable headers={['Tanggal','Nomor','Supplier','Total']} rows={purchases.map(p=>[fmtDate(p.date),p.number,p.supplier,rupiah(p.total)])}/></section></>;
}

function Sales({ sale, setSale, products, stock, total, addLine, removeLine, updateLine, chooseProduct, save, sales, search, setSearch, payment, setPayment, activeSale, recordPayment }) {
  return <><PageTitle title="Penjualan & Pembayaran" sub="Penjualan mengurangi stok. Pembayaran tidak mengurangi stok."/>
    <section className="panel"><PanelHead title="Transaksi Penjualan" sub="Pilih barang dari Master Barang. Stok dicek otomatis."/><div className="form-grid three"><Field label="Tanggal"><input type="date" value={sale.date} onChange={e=>setSale({...sale,date:e.target.value})}/></Field><Field label="Pelanggan"><input value={sale.customer.name} onChange={e=>setSale({...sale,customer:{...sale.customer,name:e.target.value}})} placeholder="Nama pelanggan / instansi"/></Field><Field label="No. WhatsApp"><input value={sale.customer.phone} onChange={e=>setSale({...sale,customer:{...sale.customer,phone:e.target.value}})} placeholder="08xxxxxxxxxx"/></Field></div><Field label="Alamat"><textarea value={sale.customer.address} onChange={e=>setSale({...sale,customer:{...sale.customer,address:e.target.value}})} placeholder="Alamat pelanggan"/></Field><LineEditor lines={sale.items} products={products} stock={stock} setter={setSale} updateLine={updateLine} chooseProduct={chooseProduct} addLine={addLine} removeLine={removeLine} priceKey="sellPrice"/><div className="form-grid three"><Field label="Potongan"><MoneyInput value={sale.discount} onChange={v=>setSale({...sale,discount:v})}/></Field><Field label="Pajak (%)"><input type="number" min="0" value={sale.tax} onChange={e=>setSale({...sale,tax:e.target.value})}/></Field><Field label="Pembayaran Awal / DP"><MoneyInput value={sale.payment} onChange={v=>setSale({...sale,payment:v})}/></Field></div><div className="sale-result"><div><span>Total Penjualan</span><strong>{rupiah(total.total)}</strong></div><div><span>DP / Dibayar</span><strong>{rupiah(Math.min(money(sale.payment),total.total))}</strong></div><div className="remaining"><span>Sisa → Invoice</span><strong>{rupiah(Math.max(0,total.total-money(sale.payment)))}</strong></div><button className="btn primary" onClick={save}>Simpan Penjualan</button></div></section>
    <section className="panel"><PanelHead title="Pembayaran Berikutnya" sub="Gunakan untuk DP lanjutan atau pelunasan."/><div className="form-grid four"><Field label="Transaksi"><select value={payment.saleId} onChange={e=>setPayment({...payment,saleId:e.target.value})}><option value="">Pilih transaksi</option>{sales.filter(s=>money(s.total)>money(s.paid)).map(s=><option key={s.id} value={s.id}>{s.number} — sisa {rupiah(s.total-s.paid)}</option>)}</select></Field><Field label="Tanggal"><input type="date" value={payment.date} onChange={e=>setPayment({...payment,date:e.target.value})}/></Field><Field label="Jumlah"><MoneyInput value={payment.amount} onChange={v=>setPayment({...payment,amount:v})}/></Field><Field label="Metode"><select value={payment.method} onChange={e=>setPayment({...payment,method:e.target.value})}><option>Transfer</option><option>Tunai</option><option>QRIS</option></select></Field></div>{activeSale && <div className="payment-callout"><b>{activeSale.number}</b><span>Total {rupiah(activeSale.total)}</span><span>Sudah dibayar {rupiah(activeSale.paid)}</span><strong>Sisa {rupiah(activeSale.total-activeSale.paid)}</strong><button className="btn primary" onClick={recordPayment}>Buat Nota Pembayaran</button></div>}</section>
    <section className="panel"><div className="table-toolbar"><PanelHead title="Riwayat Penjualan" sub="Invoice selalu menunjukkan sisa tagihan."/><input className="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="⌕ Cari nota / pelanggan…"/></div><DataTable headers={['Tanggal','Nota','Pelanggan','Total','Dibayar','Sisa','Status']} rows={sales.map(s=>[s.date,s.number,s.customer.name,rupiah(s.total),rupiah(s.paid),rupiah(s.total-s.paid),<Status text={s.status}/>])}/></section>
  </>;
}

function Documents({ documents, db }) {
  function download(r) { makePDF(r); }
  return <><PageTitle title="Dokumen" sub="PO, Penawaran, Invoice dan Nota pembayaran yang telah dibuat."/><section className="panel"><div className="doc-tabs"><span className="pill">{documents.filter(d=>d.type==='PO').length} PO</span><span className="pill">{documents.filter(d=>d.type==='PENAWARAN').length} Penawaran</span><span className="pill">{documents.filter(d=>d.type==='INVOICE').length} Invoice</span><span className="pill">{documents.filter(d=>d.type==='NOTA').length} Nota</span></div><DataTable headers={['Tanggal','Nomor','Jenis','Pihak','Nilai','Keterangan','Aksi']} rows={documents.map(d=>[fmtDate(d.date),d.number,<Status text={d.type}/>,d.party?.name||'-',rupiah(d.total),d.type==='INVOICE' ? `Sisa ${rupiah(d.remaining ?? d.total)}` : d.type==='NOTA' ? `Bayar ${rupiah(d.paymentAmount ?? d.total)}` : '-',<button className="mini" onClick={()=>download(d)}>PDF</button>])}/></section></>;
}

function Inventory({ products, stock, moves, opname, form, setForm, save }) {
  return <><PageTitle title="Persediaan" sub="Stok saat ini, kartu pergerakan dan stock opname."/><div className="two-col"><section className="panel"><PanelHead title="Stock Opname" sub="Selisih dicatat sebagai penyesuaian, bukan mengubah histori."/><div className="form-grid"><Field label="Tanggal"><input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></Field><Field label="Barang"><select value={form.productId} onChange={e=>setForm({...form,productId:e.target.value})}><option value="">Pilih barang</option>{products.map(p=><option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}</select></Field><Field label="Stok Fisik"><input type="number" min="0" value={form.physical} onChange={e=>setForm({...form,physical:e.target.value})}/></Field><div className="form-actions"><button className="btn primary" onClick={save}>Simpan Penyesuaian</button></div></div></section><section className="panel"><PanelHead title="Stok Saat Ini" sub="Dihitung dari stok awal + seluruh pergerakan."/><DataTable headers={['Kode','Barang','Stok','Minimum','Status']} rows={products.map(p=>[p.code,p.name,`${money(stock[p.id])} ${p.unit}`,`${p.minStock} ${p.unit}`,<Status text={money(stock[p.id])<=money(p.minStock)?'MENIPIS':'AMAN'}/>])}/></section></div><section className="panel"><PanelHead title="Kartu Pergerakan Stok" sub="Jejak setiap barang masuk, keluar dan penyesuaian."/><DataTable headers={['Tanggal','Referensi','Jenis','Barang','Masuk','Keluar','Saldo']} rows={moves.map(m=>{const relevant=moves.filter(x=>x.productId===m.productId);const idx=relevant.indexOf(m);const saldo=relevant.slice().reverse().slice(0,relevant.length-idx).reduce((s,x)=>s+money(x.qty),0)+money(products.find(p=>p.id===m.productId)?.openingStock);return [fmtDate(m.date),m.ref,m.kind,products.find(p=>p.id===m.productId)?.name||'-',m.qty>0?m.qty:'-',m.qty<0?Math.abs(m.qty):'-',saldo];})}/></section><section className="panel"><PanelHead title="Riwayat Stock Opname" sub="Penyesuaian tetap tersimpan untuk audit."/><DataTable headers={['Tanggal','Barang','Sistem','Fisik','Selisih']} rows={opname.map(o=>[fmtDate(o.date),products.find(p=>p.id===o.productId)?.name||'-',o.systemStock,o.physicalStock,<b>{o.difference>=0?'+':''}{o.difference}</b>])}/></section></>;
}

function Reports({ db, stock, totals, range, setRange }) {
  const start = range === 'month' ? new Date(new Date().getFullYear(), new Date().getMonth(), 1) : range === 'year' ? new Date(new Date().getFullYear(),0,1) : null;
  const inRange = (d) => !start || new Date(`${d}T00:00:00`) >= start;
  const sales = db.sales.filter(s=>inRange(s.date)); const purchases=db.purchases.filter(p=>inRange(p.date));
  return <><PageTitle title="Laporan" sub="Rekap penjualan, pembelian, piutang dan persediaan."/><div className="report-filter"><span>Periode</span><button className={range==='all'?'selected':''} onClick={()=>setRange('all')}>Semua</button><button className={range==='month'?'selected':''} onClick={()=>setRange('month')}>Bulan ini</button><button className={range==='year'?'selected':''} onClick={()=>setRange('year')}>Tahun ini</button></div><div className="stat-grid"><Stat label="Penjualan" value={rupiah(sales.reduce((s,x)=>s+x.total,0))}/><Stat label="Pembelian" value={rupiah(purchases.reduce((s,x)=>s+x.total,0))}/><Stat label="Piutang" value={rupiah(sales.reduce((s,x)=>s+Math.max(0,x.total-x.paid),0))}/><Stat label="Jenis Barang" value={db.products.length}/></div><div className="two-col"><section className="panel"><PanelHead title="Rekap Penjualan"/><DataTable headers={['Tanggal','Nota','Pelanggan','Total','Dibayar','Sisa']} rows={sales.map(s=>[fmtDate(s.date),s.number,s.customer.name,rupiah(s.total),rupiah(s.paid),rupiah(s.total-s.paid)])}/></section><section className="panel"><PanelHead title="Rekap Pembelian"/><DataTable headers={['Tanggal','Nomor','Supplier','Total']} rows={purchases.map(p=>[fmtDate(p.date),p.number,p.supplier,rupiah(p.total)])}/></section></div><section className="panel"><PanelHead title="Nilai Persediaan Berdasarkan Harga Beli" sub="Estimasi: stok aktual × harga beli master."/><DataTable headers={['Kode','Barang','Stok','Harga Beli','Nilai Stok']} rows={db.products.map(p=>[p.code,p.name,money(stock[p.id]),rupiah(p.buyPrice),rupiah(money(stock[p.id])*money(p.buyPrice))])}/></section></>;
}

function LineEditor({ lines, products, stock, setter, updateLine, chooseProduct, addLine, removeLine, priceKey }) {
  return <div className="line-editor"><div className="line-head"><span>Barang dari Master</span><span>Qty</span><span>Satuan</span><span>Harga</span><span/></div>{lines.map((it,i)=><div className="line" key={i}><select value={it.productId} onChange={e=>chooseProduct(setter,i,e.target.value)}><option value="">Pilih barang…</option>{products.map(p=><option key={p.id} value={p.id}>{p.code} — {p.name} (stok {money(stock[p.id])})</option>)}</select><input type="number" min="1" value={it.qty} onChange={e=>updateLine(setter,i,'qty',e.target.value)}/><input value={it.unit} readOnly/><input type="number" min="0" value={it.price || productPrice(products,it.productId,priceKey)} onChange={e=>updateLine(setter,i,'price',e.target.value)}/><button className="remove-line" onClick={()=>removeLine(setter,i)}>×</button></div>)}<button className="btn secondary" onClick={()=>addLine(setter)}>＋ Tambah Barang</button></div>;
}
function productPrice(products,id,key){const p=products.find(x=>x.id===id);return p?.[key]||0;}
function Field({label,children}){return <label className="field"><span>{label}</span>{children}</label>}
function MoneyInput({value,onChange}){return <input type="number" min="0" value={value} onChange={e=>onChange(e.target.value)} placeholder="0"/>}
function PageTitle({title,sub,actions}){return <div className="page-title"><div><h1>{title}</h1><p>{sub}</p></div>{actions}</div>}
function PanelHead({title,sub}){return <div className="panel-head"><div><h2>{title}</h2>{sub&&<p>{sub}</p>}</div></div>}
function Stat({label,value,tone='blue',icon='Rp'}){return <div className={`stat ${tone}`}><div className="stat-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong></div></div>}
function Status({text}){return <span className={`status-pill ${String(text).includes('LUNAS')||text==='AMAN'?'ok':String(text).includes('MENIPIS')||String(text).includes('BELUM')?'warn':'info'}`}>{text}</span>}
function Empty({text}){return <div className="empty">{text}</div>}
function DataTable({headers,rows,emptyText='Belum ada data.'}){return <div className="table-wrap"><table className="data-table"><thead><tr>{headers.map((h,i)=><th key={i}>{h}</th>)}</tr></thead><tbody>{rows.length?rows.map((row,i)=><tr key={i}>{row.map((c,j)=><td key={j}>{c}</td>)}</tr>):<tr><td colSpan={headers.length}><Empty text={emptyText}/></td></tr>}</tbody></table></div>}

function makePDF(r) {
  const typeLabel = r.type === 'PENAWARAN' ? 'SURAT PENAWARAN' : r.type === 'PO' ? 'PURCHASE ORDER' : r.type === 'INVOICE' ? 'INVOICE' : 'NOTA PEMBAYARAN';
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(); const m=14;
  doc.setFont('courier','bold'); doc.setFontSize(16); doc.text(BUSINESS.name,m,17);
  doc.setFont('courier','normal'); doc.setFontSize(8.5); doc.text(BUSINESS.owner,m,22); doc.text(BUSINESS.address,m,27); doc.text(`Telp. ${BUSINESS.phone} | ${BUSINESS.email}`,m,32);
  try { doc.addImage('/logo-srg.jpeg','JPEG',W-43,9,28,28); } catch {}
  doc.setLineDashPattern([1,1],0); doc.line(m,37,W-m,37); doc.setLineDashPattern([],0);
  doc.setFont('courier','bold'); doc.setFontSize(13); doc.text(typeLabel,m,46); doc.setFont('courier','normal'); doc.setFontSize(8.5); doc.text(`No. ${r.number}`,m,52); doc.text(`Tanggal: ${fmtDate(r.date)}`,m,57);
  doc.setFont('courier','bold'); doc.text('KEPADA:',m,67); doc.setFont('courier','normal'); doc.text(r.party?.name||'-',m,72); doc.text(r.party?.address||'-',m,77); if(r.party?.phone) doc.text(`Telp. ${r.party.phone}`,m,82);
  const items = r.items || [];
  autoTable(doc,{startY:89,margin:{left:m,right:m},theme:'plain',head:[['NO','URAIAN','QTY','SAT','HARGA','JUMLAH']],body:items.map((x,i)=>[i+1,x.name||'-',money(x.qty),x.unit||'-',rupiah(x.price),rupiah(money(x.qty)*money(x.price))]),styles:{font:'courier',fontSize:8,cellPadding:2,lineColor:[0,0,0],lineWidth:.15},headStyles:{font:'courier',fontStyle:'bold',fillColor:[245,245,245],textColor:[0,0,0]},columnStyles:{0:{cellWidth:9,halign:'center'},1:{cellWidth:66},2:{cellWidth:15,halign:'right'},3:{cellWidth:17},4:{cellWidth:32,halign:'right'},5:{cellWidth:36,halign:'right'}}});
  let y=(doc.lastAutoTable?.finalY||90)+7; doc.setFont('courier','normal');
  if(r.type==='INVOICE'){ doc.text(`NILAI TRANSAKSI : ${rupiah(r.fullTotal ?? r.total)}`,W-88,y); y+=5; doc.text(`SUDAH DIBAYAR  : ${rupiah(r.paid||0)}`,W-88,y); y+=5; doc.setFont('courier','bold'); doc.text(`SISA TAGIHAN    : ${rupiah(r.remaining ?? r.total)}`,W-88,y); y+=7; }
  else if(r.type==='NOTA'){ doc.text(`TOTAL TRANSAKSI : ${rupiah(r.fullTotal ?? r.total)}`,W-88,y); y+=5; doc.setFont('courier','bold'); doc.text(`PEMBAYARAN      : ${rupiah(r.paymentAmount ?? r.total)}`,W-88,y); y+=5; doc.text(`SISA TAGIHAN    : ${rupiah(r.remaining ?? 0)}`,W-88,y); y+=7; }
  else { doc.text(`SUBTOTAL        : ${rupiah(r.subtotal ?? r.total)}`,W-88,y); y+=5; doc.text(`POTONGAN        : ${rupiah(r.discount||0)}`,W-88,y); y+=5; doc.text(`PAJAK           : ${rupiah(r.taxValue||0)}`,W-88,y); y+=5; doc.setFont('courier','bold'); doc.text(`TOTAL           : ${rupiah(r.total)}`,W-88,y); y+=7; }
  doc.setFont('courier','normal'); doc.text('Catatan:',m,y); y+=5; doc.text(doc.splitTextToSize(r.notes||'-',W-2*m),m,y); y+=18;
  doc.text('Hormat kami,',W-58,y); y+=18; doc.setFont('courier','bold'); doc.text(BUSINESS.owner,W-72,y); doc.setFont('courier','normal'); doc.setFontSize(7); doc.text('Dokumen dibuat secara elektronik oleh Sistem Sumber Rejeki Gampeng.',m,286);
  doc.save(`${r.type}-${r.number.replaceAll('/','-')}.pdf`);
}

function idbOpen(){return new Promise((resolve,reject)=>{const req=indexedDB.open('srg-admin-db',2);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('kv'))req.result.createObjectStore('kv');};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function idbRead(){const db=await idbOpen();return new Promise((resolve,reject)=>{const r=db.transaction('kv','readonly').objectStore('kv').get('db');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function idbWrite(value){try{const db=await idbOpen();const tx=db.transaction('kv','readwrite');tx.objectStore('kv').put(value,'db');}catch(e){console.error(e);}}
