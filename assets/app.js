// ATD QAG/LOA Status (repo atd-status): a read-only view of each Redbird ATD device's current FAA approval, with its LOA and QAG.
// Its own copy of the Certification Tracker's ATD Approvals page code (assets/atd.js 3.2), trimmed for
// support colleagues. data/devices.json and docs/ come from tracker-data (scripts/build_atd_status.py);
// everything in them is already public on the Redbird knowledge base.
'use strict';

const SOON_DAYS = 365;     // Expires Soon: 365 days or less to expiry (the tracker keeps four tags)

const ICON = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/></svg>',
  external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v6H4V6h6"/></svg>'
};

let devices = [];
let loaded = false;
let loadError = '';
const main = document.getElementById('main');

// ---- Small helpers ----
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const vLabel = v => v ? 'v' + String(v).replace(/^v\.?\s*/i, '') : '—';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(iso){
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${MONTHS[+m[2] - 1]} ${+m[3]}, ${m[1]}` : '—';
}
function daysUntil(iso){
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(!m) return null;
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - today) / 86400000);
}

// ---- Status: the color tag only ----
const BANDS = {
  current: {label: 'Current', cls: 'sage', hint: 'More than 365 days to expiry'},
  soon: {label: 'Expires Soon', cls: 'gold', hint: '365 days or less to expiry'},
  expired: {label: 'Expired', cls: 'overdue', hint: 'Past its expiration date'}
};
function band(d){
  const n = daysUntil(d.expires);
  if(n === null) return null;
  if(n < 0) return 'expired';
  if(n <= SOON_DAYS) return 'soon';
  return 'current';
}
function bandPill(d){
  const b = BANDS[band(d)];
  return b ? `<span class="pill pill-${b.cls}" title="${b.hint}">${b.label}</span>` : '<span class="muted">—</span>';
}

// ---- Order: BATD first, then AATD; FMX/MCX at the top of AATD, the rest alphabetical ----
const TYPE_ORDER = ['BATD', 'AATD'];
const pinned = d => /\bFMX\b/i.test(d.name) && /\bMCX\b/i.test(d.name);
const typeRank = d => { const i = TYPE_ORDER.indexOf(d.type); return i < 0 ? TYPE_ORDER.length : i; };
function ordered(list){
  return [...list].sort((a, b) => (typeRank(a) - typeRank(b)) || (pinned(b) - pinned(a)) || a.name.localeCompare(b.name, undefined, {numeric: true}));
}
function groups(list){
  const out = [];
  ordered(list).forEach(d => {
    const type = d.type || 'Other';
    if(!out.length || out[out.length - 1].type !== type) out.push({type, devices: []});
    out[out.length - 1].devices.push(d);
  });
  return out;
}

// ---- Routes: #/ · #/d/<id> · #/d/<id>/qag · #/d/<id>/v/<previous version>/<file> ----
function route(){
  const parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  if(parts[0] === 'd' && parts[1]) return {type: 'device', id: parts[1], doc: parts[2] === 'qag' ? 'qag' : parts[2] === 'v' ? 'prev' : 'loa', prev: +parts[3] || 0, file: +parts[4] || 0};
  return {type: 'list'};
}
const deviceHref = (d, doc) => `#/d/${encodeURIComponent(d.id)}${doc === 'qag' ? '/qag' : ''}`;
const fileLabel = l => String(l).replace(/\d{4}-\d{2}-\d{2}/g, fmtDate);
const prevHref = (d, i, f) => `#/d/${encodeURIComponent(d.id)}/v/${i}/${f}`;

// ---- The device list ----
function tableHtml(){
  const list = devices;
  if(!list.length) return `<div class="muted list-empty">No devices yet.</div>`;
  return `
    <div class="atd-table" role="table" aria-label="ATD devices">
      <div class="atd-tr atd-th" role="row"><span role="columnheader">Device</span><span role="columnheader">Approved QAG</span><span role="columnheader">Approved</span><span role="columnheader">Expires</span><span role="columnheader">Status</span></div>
      ${groups(list).map(g => `<div class="atd-group" role="row"><span role="cell">${esc(g.type)} <span class="title-count">(${g.devices.length})</span></span></div>` + g.devices.map(d => `
        <a class="atd-tr" role="row" href="${deviceHref(d)}">
          <span role="cell"><b>${esc(d.name)}</b></span>
          <span role="cell"><span class="cell-label">Approved QAG</span>${vLabel(d.qag)}</span>
          <span role="cell"><span class="cell-label">Approved</span>${fmtDate(d.approved)}</span>
          <span role="cell"><span class="cell-label">Expires</span>${fmtDate(d.expires)}</span>
          <span role="cell"><span class="cell-label">Status</span>${bandPill(d)}</span>
        </a>`).join('')).join('')}
    </div>`;
}

function renderList(){
  document.title = 'ATD QAG/LOA Status';
  main.innerHTML = `
    <div class="detail-head">
      <h2 class="detail-title">ATD Approvals</h2>
    </div>
    <div class="list-hint">Click on device for additional information</div>
    <div id="table">${tableHtml()}</div>
    <div class="muted search-note">Current: more than 365 days to expiry. Expires Soon: 365 days or less. Expired: past the expiry date.</div>`;
}

// ---- One device ----
const isPhone = () => window.matchMedia('(max-width: 720px) and (pointer: coarse)').matches;

function prevDates(p){
  return [p.approved ? 'Approved ' + fmtDate(p.approved) : '', p.expires ? 'expires ' + fmtDate(p.expires) : ''].filter(Boolean).join(', ');
}

// Download name: device, version, document, e.g. "TD_TD2_v3.3_QAG.pdf" or "FMX_LD_SD_MCX_v4.4_LOA_original.pdf".
function downloadName(device, version, label){
  const part = x => String(x || '').replace(/\(([^)]*)\)/g, ' $1').replace(/\d{4}-\d{2}-\d{2}/g, '').replace(/[\/\\:*?"<>|,\s]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return [part(device), vLabel(version), part(label)].filter(Boolean).join('_') + '.pdf';
}

// The PDF without the browser's own toolbar; Open in new window and Download sit above it.
function viewerHtml(title, path, fileName){
  const open = `<a class="btn-text" href="${esc(path)}" target="_blank" rel="noopener">${ICON.external}<span>Open in new window</span></a>`;
  const save = `<a class="btn-text" href="${esc(path)}" download="${esc(fileName)}">${ICON.download}<span>Download</span></a>`;
  if(isPhone()) return `<div class="doc-actions"><a class="open-doc-btn" href="${esc(path)}" target="_blank" rel="noopener">${ICON.file}<span>Open ${esc(title)}</span></a>${save}</div>`;
  return `<div class="doc-actions">${open}${save}</div><iframe class="pdf-frame" src="${esc(path)}#toolbar=0&amp;navpanes=0&amp;view=FitH" title="${esc(title)}"></iframe>`;
}

function renderDevice(r){
  const d = devices.find(x => x.id === r.id);
  if(!d){ main.innerHTML = `<a class="back" href="#/">${ICON.back}ATD Approvals</a><div class="muted list-empty">This device isn't in the list.</div>`; return; }
  document.title = `${d.name} · ATD QAG/LOA Status`;
  const prev = d.previous || [];
  const p = r.doc === 'prev' ? prev[r.prev] : null;
  const pf = p ? (p.files[r.file] || p.files[0]) : null;
  const doc = p ? 'prev' : (d.docs[r.doc] ? r.doc : (d.docs.loa ? 'loa' : 'qag'));
  const field = (label, value) => `<div><div class="fk">${label}</div><div class="fv">${value}</div></div>`;

  let docs;
  if(pf){
    docs = `
      <div class="superseded" role="status"><span><b>Superseded.</b> ${esc(vLabel(p.version))} (${esc(p.devices.join(', '))}), ${esc(fileLabel(pf.label))}. Shown for reference.</span>
        <a href="${deviceHref(d)}">Back to current</a></div>
      ${viewerHtml(`${d.name} ${vLabel(p.version)} ${pf.label}`, pf.path, downloadName(d.name, p.version, pf.label))}`;
  }else{
    const kinds = ['loa', 'qag'].filter(k => d.docs[k]);
    docs = `
      <div class="tabs" role="tablist">${kinds.map(k => `<a class="tab ${k === doc ? 'on' : ''}" role="tab" aria-selected="${k === doc}" href="${deviceHref(d, k)}">${ICON.file} ${k.toUpperCase()}</a>`).join('')}</div>
      ${viewerHtml(`${d.name} ${doc.toUpperCase()}`, d.docs[doc], downloadName(d.name, d.qag, doc.toUpperCase()))}`;
  }

  const prevHtml = prev.length ? `
    <details class="prev" ${p ? 'open' : ''}>
      <summary>Previous versions <span class="title-count">(${prev.length})</span></summary>
      ${prev.map((x, i) => `
        <div class="prev-row ${p === x ? 'on' : ''}">
          <span><b>${esc(vLabel(x.version))}</b> <span class="atd-sub">${esc(x.devices.join(', '))}</span></span>
          <span class="prev-dates">${esc(prevDates(x))}</span>
          <span class="prev-files">${x.files.map((f, j) => `<a href="${prevHref(d, i, j)}">${esc(fileLabel(f.label))}</a>`).join('')}</span>
        </div>`).join('')}
    </details>` : '';

  main.innerHTML = `
    <a class="back" href="#/">${ICON.back}ATD Approvals</a>
    <div class="detail-head">
      <h2 class="detail-title">${esc(d.name)} <span class="title-count">${esc(d.type)}</span></h2>
    </div>
    ${pf ? `<div class="current-note">Current Version: ${vLabel(d.qag)}</div>` : `<div class="field-grid">
      ${field('Approved QAG', vLabel(d.qag))}
      ${field('Approved', fmtDate(d.approved))}
      ${field('Expires', fmtDate(d.expires))}
      ${field('Status', bandPill(d))}
    </div>`}
    ${docs}
    ${prevHtml}`;
}

// ---- Rendering ----
function render(){
  if(!loaded){ main.innerHTML = loadError ? `<div class="muted list-empty">${esc(loadError)}</div>` : '<div class="muted">Loading…</div>'; return; }
  const r = route();
  if(r.type === 'device') renderDevice(r); else renderList();
}

window.addEventListener('hashchange', () => { render(); if(route().type === 'device') window.scrollTo(0, 0); });

async function load(){
  try{
    const data = window.ATD_DATA || await fetch('data/devices.json', {cache: 'no-cache'}).then(r => { if(!r.ok) throw new Error(r.status); return r.json(); });
    devices = Array.isArray(data.devices) ? data.devices : [];
  }catch(e){
    loadError = "Couldn't load the device list. Check your connection and reload the page.";
  }
  loaded = !loadError;
  render();
}
load();

if('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
