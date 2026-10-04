import { DAYS, DAY_NAMES, TIME_ZONE, fmtDuration, fmtTime, normaliseRows, parsePasted, status, zonedNow } from './schedule.js';

const SUPABASE_URL = 'https://agjbvoosukxfvrritgto.supabase.co';
const SUPABASE_KEY = 'sb_publishable_KOdXB7LW5Ho5hDjsi3GMiw_xdogy5oR';
const EXTRACT_URL = 'https://artha-bench-pro.vercel.app/api/timetable/extract';
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

async function rpc(name, args = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.message || `Request failed (${res.status})`);
  return body;
}

/* ---------------- Public view ---------------- */

let state = { title: 'Class Timetable', term: '', rows: [], has_file: false, updated_at: null };
let fileShownFor = null;

function renderHeader() {
  $('title').textContent = state.title || 'Class Timetable';
  $('term').textContent = state.term || '';
  document.title = state.title || 'Class Timetable';
}

function tick() {
  const date = new Date();
  $('clock-time').textContent = new Intl.DateTimeFormat('en-IN', { timeZone: TIME_ZONE, hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).format(date);
  $('clock-date').textContent = `${new Intl.DateTimeFormat('en-IN', { timeZone: TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date)} · India time`;
  const now = zonedNow(date);
  const s = status(state.rows, now);

  if (!s.hasRows) {
    $('now-subject').textContent = 'No timetable yet';
    $('now-meta').textContent = 'The admin has not published the classes for this term.';
    $('now-bar').hidden = true;
    $('next-subject').textContent = '—';
    $('next-meta').textContent = '';
    $('next-countdown').textContent = '';
  } else {
    if (s.now) {
      $('now-subject').textContent = s.now.subject;
      $('now-meta').textContent = [`${fmtTime(s.now.start)} – ${fmtTime(s.now.end)}`, s.now.teacher, s.now.room].filter(Boolean).join(' · ') + ` · ends in ${fmtDuration(s.now.minutesLeft)}`;
      $('now-bar').hidden = false;
      $('now-bar-fill').style.width = `${Math.round(s.now.progress * 100)}%`;
    } else {
      $('now-subject').textContent = 'No class right now';
      $('now-meta').textContent = s.today.some((r) => r.state === 'later') ? 'Break before the next class.' : s.today.length ? 'Classes are over for today.' : 'No classes today.';
      $('now-bar').hidden = true;
    }
    if (s.next) {
      const when = s.next.dayOffset === 0 ? 'Today' : s.next.dayOffset === 1 ? 'Tomorrow' : DAY_NAMES[s.next.day];
      $('next-subject').textContent = s.next.subject;
      $('next-meta').textContent = [`${when}, ${fmtTime(s.next.start)} – ${fmtTime(s.next.end)}`, s.next.teacher, s.next.room].filter(Boolean).join(' · ');
      $('next-countdown').textContent = `Starts in ${fmtDuration(s.next.inMinutes)}`;
    } else {
      $('next-subject').textContent = 'No upcoming class';
      $('next-meta').textContent = '';
      $('next-countdown').textContent = '';
    }
  }

  $('today-title').textContent = `Today · ${DAY_NAMES[now.day]}`;
  $('today-list').innerHTML = s.today.length
    ? s.today.map((r) => `<li class="${r.state}"><span class="t">${fmtTime(r.start)} – ${fmtTime(r.end)}</span><span class="s">${esc(r.subject)}${r.teacher || r.room ? `<small>${esc([r.teacher, r.room].filter(Boolean).join(' · '))}</small>` : ''}</span></li>`).join('')
    : `<li class="empty">${s.hasRows ? 'No classes today.' : 'Classes will appear here once the timetable is published.'}</li>`;
}

function renderWeek() {
  const rows = normaliseRows(state.rows);
  $('week-section').hidden = rows.length === 0;
  if (!rows.length) return;
  const days = DAYS.filter((d) => rows.some((r) => r.day === d));
  const today = zonedNow().day;
  const max = Math.max(...days.map((d) => rows.filter((r) => r.day === d).length));
  let html = `<thead><tr>${days.map((d) => `<th scope="col">${DAY_NAMES[d]}</th>`).join('')}</tr></thead><tbody>`;
  for (let i = 0; i < max; i += 1) {
    html += `<tr>${days
      .map((d) => {
        const r = rows.filter((x) => x.day === d)[i];
        return `<td class="${d === today ? 'today' : ''}">${r ? `<span class="t">${fmtTime(r.start)}</span>${esc(r.subject)}` : ''}</td>`;
      })
      .join('')}</tr>`;
  }
  $('week-table').innerHTML = `${html}</tbody>`;
}

async function renderFile(target, dataUrl, type) {
  target.innerHTML = '';
  if (type === 'application/pdf') {
    const lib = await waitForPdfJs();
    if (!lib) {
      target.innerHTML = `<p class="hint">This timetable is a PDF. <a href="${dataUrl}" target="_blank" rel="noopener">Open the PDF</a>.</p>`;
      return;
    }
    const pdf = await lib.getDocument({ data: dataUrlToBytes(dataUrl) }).promise;
    for (let p = 1; p <= Math.min(pdf.numPages, 6); p += 1) {
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.setAttribute('aria-label', `Timetable page ${p}`);
      target.appendChild(canvas);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    }
  } else {
    const img = new Image();
    img.src = dataUrl;
    img.alt = 'Official timetable';
    target.appendChild(img);
  }
}

async function loadOfficialFile() {
  $('official-section').hidden = !state.has_file;
  if (!state.has_file || fileShownFor === state.updated_at) return;
  fileShownFor = state.updated_at;
  try {
    const f = await rpc('timetable_file');
    $('official-meta').textContent = f.file_name ? `File: ${f.file_name}` : '';
    await renderFile($('official-view'), f.file_data, f.file_type);
  } catch {
    $('official-view').innerHTML = '<p class="hint">The timetable file could not be loaded. Refresh to try again.</p>';
  }
}

async function loadState() {
  try {
    const s = await rpc('timetable_get');
    if (!s) return;
    const changed = s.updated_at !== state.updated_at;
    state = s;
    if (!changed) return;
    renderHeader();
    renderWeek();
    tick();
    $('updated').textContent = state.updated_at ? `Updated ${new Intl.DateTimeFormat('en-IN', { timeZone: TIME_ZONE, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(state.updated_at))}` : '';
    void loadOfficialFile();
  } catch {
    $('updated').textContent = 'Could not reach the timetable. Showing the last loaded copy.';
  }
}

/* ---------------- Admin ---------------- */

let adminPassword = null;
let draftRows = [];
let newFile = null; // { name, type, dataUrl }

function showView() {
  const admin = location.hash === '#admin';
  $('public-view').hidden = admin;
  $('admin-view').hidden = !admin;
  if (admin && adminPassword) openPanel();
  window.scrollTo(0, 0);
}

function dataUrlToBytes(dataUrl) {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function waitForPdfJs() {
  return new Promise((resolve) => {
    let tries = 0;
    const check = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      } else if (tries++ > 50) resolve(null);
      else setTimeout(check, 100);
    };
    check();
  });
}

const readAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Could not read the file.'));
    r.readAsDataURL(file);
  });

/** Draws an image or the first PDF page to a JPEG no wider than maxSide (for AI reading and compact storage). */
async function toJpeg(dataUrl, type, maxSide = 1800, quality = 0.85) {
  let source;
  if (type === 'application/pdf') {
    const lib = await waitForPdfJs();
    if (!lib) throw new Error('PDF reader did not load.');
    const pdf = await lib.getDocument({ data: dataUrlToBytes(dataUrl) }).promise;
    const page = await pdf.getPage(1);
    const vp = page.getViewport({ scale: 2.5 });
    source = document.createElement('canvas');
    source.width = vp.width;
    source.height = vp.height;
    await page.render({ canvasContext: source.getContext('2d'), viewport: vp }).promise;
  } else {
    source = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not open the image.'));
      img.src = dataUrl;
    });
  }
  const w = source.width || source.naturalWidth;
  const h = source.height || source.naturalHeight;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

function renderRows() {
  const body = $('rows-body');
  body.innerHTML = draftRows
    .map(
      (r, i) => `<tr data-i="${i}">
      <td><select aria-label="Day" data-k="day">${DAYS.map((d) => `<option value="${d}"${r.day === d ? ' selected' : ''}>${d}</option>`).join('')}</select></td>
      <td><input aria-label="Start time" type="time" data-k="start" value="${esc(r.start)}" required></td>
      <td><input aria-label="End time" type="time" data-k="end" value="${esc(r.end)}" required></td>
      <td><input aria-label="Subject" data-k="subject" value="${esc(r.subject)}" maxlength="80" required></td>
      <td><input aria-label="Teacher" data-k="teacher" value="${esc(r.teacher || '')}" maxlength="60"></td>
      <td><input aria-label="Room" data-k="room" value="${esc(r.room || '')}" maxlength="40"></td>
      <td><button type="button" class="x" data-remove="${i}" aria-label="Remove this class">×</button></td>
    </tr>`,
    )
    .join('');
  $('rows-count').textContent = `${draftRows.length} class${draftRows.length === 1 ? '' : 'es'}`;
}

function openPanel() {
  $('login-card').hidden = true;
  $('admin-panel').hidden = false;
  $('edit-title').value = state.title || '';
  $('edit-term').value = state.term || '';
  draftRows = normaliseRows(state.rows).map((r) => ({ ...r }));
  newFile = null;
  $('file-preview').hidden = true;
  $('btn-extract').disabled = !state.has_file;
  $('file-note').textContent = state.has_file ? 'A file is already published. Choose a new one to replace it, or read classes from the current one.' : 'The uploaded file is shown to everyone as the official timetable.';
  renderRows();
}

function wireAdmin() {
  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('login-error').textContent = '';
    const pw = $('admin-password').value;
    try {
      const r = await rpc('timetable_login', { p_password: pw });
      if (!r.ok) {
        $('login-error').textContent = r.error || 'Wrong password.';
        return;
      }
      adminPassword = pw;
      $('admin-password').value = '';
      openPanel();
    } catch (err) {
      $('login-error').textContent = err.message;
    }
  });

  $('edit-file').addEventListener('change', async () => {
    const file = $('edit-file').files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'application/pdf'].includes(file.type)) {
      $('file-note').textContent = 'Choose a PNG, JPG, WebP or PDF file.';
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      $('file-note').textContent = 'That file is over 5 MB. Choose a smaller file.';
      return;
    }
    let dataUrl = await readAsDataUrl(file);
    let type = file.type;
    // Store photos compactly; keep PDFs as they are.
    if (type !== 'application/pdf' && file.size > 900 * 1024) {
      dataUrl = await toJpeg(dataUrl, type, 2200, 0.88);
      type = 'image/jpeg';
    }
    newFile = { name: file.name, type, dataUrl };
    $('file-preview').hidden = false;
    await renderFile($('file-preview'), dataUrl, type);
    $('btn-extract').disabled = false;
    $('file-note').textContent = `Ready to publish: ${file.name}`;
  });

  $('btn-extract').addEventListener('click', async () => {
    const btn = $('btn-extract');
    btn.disabled = true;
    $('extract-note').textContent = 'Reading the timetable…';
    try {
      let source = newFile;
      if (!source) {
        const f = await rpc('timetable_file');
        source = { type: f.file_type, dataUrl: f.file_data };
      }
      const image = await toJpeg(source.dataUrl, source.type, 1800, 0.85);
      const res = await fetch(EXTRACT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: adminPassword, image }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'The timetable could not be read automatically.');
      if (body.rows?.length) {
        draftRows = body.rows;
        renderRows();
      }
      $('extract-note').textContent = body.note || '';
    } catch (err) {
      $('extract-note').textContent = `${err.message} You can add the classes by hand below.`;
    } finally {
      btn.disabled = false;
    }
  });

  $('rows-body').addEventListener('input', (e) => {
    const el = e.target;
    const tr = el.closest('tr');
    if (!tr || !el.dataset.k) return;
    draftRows[Number(tr.dataset.i)][el.dataset.k] = el.value;
  });
  $('rows-body').addEventListener('click', (e) => {
    const i = e.target.dataset?.remove;
    if (i === undefined) return;
    draftRows.splice(Number(i), 1);
    renderRows();
  });
  $('btn-add').addEventListener('click', () => {
    const last = draftRows[draftRows.length - 1];
    draftRows.push({ day: last?.day || 'Mon', start: last?.end || '09:00', end: '', subject: '' });
    renderRows();
    $('rows-body').querySelector('tr:last-child input[data-k="end"]')?.focus();
  });
  $('btn-paste').addEventListener('click', () => {
    const rows = parsePasted($('paste-box').value);
    if (!rows.length) {
      $('publish-note').className = 'bad';
      $('publish-note').textContent = 'No classes found in the pasted text. Use: Day, Start, End, Subject.';
      return;
    }
    draftRows = rows;
    renderRows();
    $('publish-note').className = 'ok';
    $('publish-note').textContent = `${rows.length} classes pasted. Check them, then publish.`;
  });

  $('btn-publish').addEventListener('click', async () => {
    const note = $('publish-note');
    const clean = normaliseRows(draftRows.map((r) => ({ ...r, subject: String(r.subject || '').trim(), teacher: r.teacher?.trim() || undefined, room: r.room?.trim() || undefined })));
    if (clean.length !== draftRows.length) {
      note.className = 'bad';
      note.textContent = `${draftRows.length - clean.length} row(s) are incomplete: each class needs a day, a subject and an end time after its start time.`;
      return;
    }
    $('btn-publish').disabled = true;
    note.className = '';
    note.textContent = 'Publishing…';
    try {
      const r = await rpc('timetable_publish', {
        p_password: adminPassword,
        p_title: $('edit-title').value,
        p_term: $('edit-term').value,
        p_rows: clean,
        p_file_name: newFile?.name ?? null,
        p_file_type: newFile?.type ?? null,
        p_file_data: newFile?.dataUrl ?? null,
        p_keep_file: !newFile,
      });
      if (!r.ok) throw new Error(r.error || 'Could not publish.');
      state = r.state;
      fileShownFor = null;
      newFile = null;
      renderHeader();
      renderWeek();
      tick();
      void loadOfficialFile();
      note.className = 'ok';
      note.textContent = 'Published. Everyone now sees the new timetable.';
    } catch (err) {
      note.className = 'bad';
      note.textContent = err.message;
    } finally {
      $('btn-publish').disabled = false;
    }
  });

  $('pw-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const next = $('pw-new').value;
    try {
      const r = await rpc('timetable_change_password', { p_password: adminPassword, p_new: next });
      if (!r.ok) throw new Error(r.error || 'Could not change the password.');
      adminPassword = next;
      $('pw-new').value = '';
      $('pw-note').textContent = 'Password changed. Use the new password next time.';
    } catch (err) {
      $('pw-note').textContent = err.message;
    }
  });

  $('btn-logout').addEventListener('click', () => {
    adminPassword = null;
    $('admin-panel').hidden = true;
    $('login-card').hidden = false;
    location.hash = '';
  });
}

/* ---------------- Start ---------------- */

wireAdmin();
window.addEventListener('hashchange', showView);
showView();
tick();
void loadState();
setInterval(tick, 1000);
setInterval(() => {
  if (document.visibilityState === 'visible') void loadState();
}, 60_000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void loadState();
});
