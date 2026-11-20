import { removeBackground } from 'https://jsdelivr.net';

const statusEl = document.getElementById('status');
const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
let baseImage = new Image(), maskCanvas = document.createElement('canvas'), maskCtx = maskCanvas.getContext('2d');
let isDrawing = false, currentTab = 'upscale';
const sessions = {};

ort.env.wasm.wasmPaths = "https://jsdelivr.net";

window.switchTab = (tab) => {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach((b, i) => b.classList.toggle('active', ['upscale','removebg','eraser'][i] === tab));
  ['upscale','removebg','eraser'].forEach(t => document.getElementById(`tab-${t}`).classList.toggle('hidden', t !== tab));
  redrawCanvas();
};

document.getElementById('uploadInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    baseImage = new Image();
    baseImage.onload = () => {
      canvas.width = maskCanvas.width = baseImage.width;
      canvas.height = maskCanvas.height = baseImage.height;
      maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      redrawCanvas();
      statusEl.textContent = `Gambar dimuat (${baseImage.width} x ${baseImage.height} px).`;
    };
    baseImage.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

function redrawCanvas() {
  if (!baseImage.src) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);
  if (currentTab === 'eraser') { ctx.save(); ctx.globalAlpha = 0.55; ctx.drawImage(maskCanvas, 0, 0); ctx.restore(); }
}

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  const cx = e.touches ? e.touches[0].clientX : e.clientX, cy = e.touches ? e.touches[0].clientY : e.clientY;
  return { x: (cx - rect.left) * (canvas.width / rect.width), y: (cy - rect.top) * (canvas.height / rect.height) };
}

const startDraw = (e) => { if (currentTab === 'eraser' && baseImage.src) { isDrawing = true; draw(e); } };
const draw = (e) => {
  if (!isDrawing || currentTab !== 'eraser') return;
  e.preventDefault();
  const pos = getPos(e), r = document.getElementById('brushSize').value * (canvas.width / 500);
  maskCtx.fillStyle = '#ff0000'; maskCtx.beginPath(); maskCtx.arc(pos.x, pos.y, r, 0, Math.PI * 2); maskCtx.fill();
  redrawCanvas();
};
const endDraw = () => isDrawing = false;

canvas.addEventListener('mousedown', startDraw); canvas.addEventListener('mousemove', draw); window.addEventListener('mouseup', endDraw);
canvas.addEventListener('touchstart', startDraw, { passive: false }); canvas.addEventListener('touchmove', draw, { passive: false }); window.addEventListener('touchend', endDraw);
window.clearMask = () => { maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height); redrawCanvas(); };

async function getSession(url) {
  if (!sessions[url]) {
    statusEl.textContent = 'Mengunduh model AI (hanya sekali di awal)...';
    sessions[url] = await ort.InferenceSession.create(url, { executionProviders: ['webgpu', 'wasm'] });
  }
  return sessions[url];
}

window.runUpscale = async () => {
  if (!baseImage.src) return alert('Pilih gambar dulu!');
  const btn = document.getElementById('btnUpscale'); btn.disabled = true;
  try {
    const session = await getSession(document.getElementById('upscaleModel').value);
    const scale = parseInt(document.getElementById('outScale').value);
    const srcW = baseImage.width, srcH = baseImage.height;
    const tmpC = document.createElement('canvas'); tmpC.width = srcW; tmpC.height = srcH;
    const tmpCtx = tmpC.getContext('2d'); tmpCtx.drawImage(baseImage, 0, 0);
    const out4x = document.createElement('canvas'); out4x.width = srcW * 4; out4x.height = srcH * 4;
    const outCtx = out4x.getContext('2d');
    const tile = 128, total = Math.ceil(srcW / tile) * Math.ceil(srcH / tile);
    let done = 0;

    for (let y = 0; y < srcH; y += tile) {
      for (let x = 0; x < srcW; x += tile) {
        statusEl.textContent = `Memproses bagian ${++done} dari ${total}...`;
        await new Promise(r => setTimeout(r, 10));
        const w = Math.min(tile, srcW - x), h = Math.min(tile, srcH - y);
        const d = tmpCtx.getImageData(x, y, w, h).data, f = new Float32Array(3 * w * h);
        for (let i = 0; i < w * h; i++) { f[i] = d[i*4]/255; f[w*h+i] = d[i*4+1]/255; f[2*w*h+i] = d[i*4+2]/255; }
        const res = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', f, [1, 3, h, w]) });
        const od = res[session.outputNames[0]].data, ow = w * 4, oh = h * 4, oi = outCtx.createImageData(ow, oh);
        for (let i = 0; i < ow * oh; i++) {
          oi.data[i*4] = Math.min(255, Math.max(0, od[i]*255));
          oi.data[i*4+1] = Math.min(255, Math.max(0, od[ow*oh+i]*255));
          oi.data[i*4+2] = Math.min(255, Math.max(0, od[2*ow*oh+i]*255));
          oi.data[i*4+3] = 255;
        }
        outCtx.putImageData(oi, x * 4, y * 4);
      }
    }
    canvas.width = srcW * scale; canvas.height = srcH * scale;
    ctx.drawImage(out4x, 0, 0, canvas.width, canvas.height);
    statusEl.textContent = `Selesai! Ukuran: ${canvas.width} x ${canvas.height} px.`;
  } catch (e) { statusEl.textContent = 'Error: ' + e.message; }
  btn.disabled = false;
};

window.runRemoveBg = async () => {
  if (!baseImage.src) return alert('Pilih gambar dulu!');
  const btn = document.getElementById('btnRemoveBg'); btn.disabled = true;
  statusEl.textContent = 'Menghapus background...';
  try {
    const blob = await removeBackground(baseImage.src);
    const img = new Image();
    img.onload = () => { canvas.width = img.width; canvas.height = img.height; ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); statusEl.textContent = 'Background dihapus!'; btn.disabled = false; };
    img.src = URL.createObjectURL(blob);
  } catch (e) { statusEl.textContent = 'Error: ' + e.message; btn.disabled = false; }
};

window.runInpaint = async () => {
  if (!baseImage.src) return alert('Pilih gambar dulu!');
  const btn = document.getElementById('btnErase'); btn.disabled = true;
  try {
    const session = await getSession('https://huggingface.co');
    statusEl.textContent = 'Menghapus objek...';
    const sz = 512, cI = document.createElement('canvas'), cM = document.createElement('canvas');
    cI.width = cM.width = sz; cI.height = cM.height = sz;
    const ctxI = cI.getContext('2d'), ctxM = cM.getContext('2d');
    ctxI.drawImage(baseImage, 0, 0, sz, sz); ctxM.drawImage(maskCanvas, 0, 0, sz, sz);
    const dI = ctxI.getImageData(0, 0, sz, sz).data, dM = ctxM.getImageData(0, 0, sz, sz).data;
    const fI = new Float32Array(3*sz*sz), fM = new Float32Array(sz*sz);
    for (let i = 0; i < sz*sz; i++) { fI[i]=dI[i*4]/255; fI[sz*sz+i]=dI[i*4+1]/255; fI[2*sz*sz+i]=dI[i*4+2]/255; fM[i]=dM[i*4+3]>20?1:0; }
    const res = await session.run({ image: new ort.Tensor('float32', fI, [1,3,sz,sz]), mask: new ort.Tensor('float32', fM, [1,1,sz,sz]) });
    const od = res[session.outputNames[0]].data, oi = ctxI.createImageData(sz, sz);
    for (let i = 0; i < sz*sz; i++) { oi.data[i*4]=od[i]; oi.data[i*4+1]=od[sz*sz+i]; oi.data[i*4+2]=od[2*sz*sz+i]; oi.data[i*4+3]=255; }
    ctxI.putImageData(oi, 0, 0);
    canvas.width = baseImage.width; canvas.height = baseImage.height;
    ctx.drawImage(cI, 0, 0, canvas.width, canvas.height);
    statusEl.textContent = 'Objek dihapus!';
  } catch (e) { statusEl.textContent = 'Error: ' + e.message; }
  btn.disabled = false;
};

window.applyResultAsBase = () => { baseImage.src = canvas.toDataURL('image/png'); maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height); statusEl.textContent = 'Hasil diterapkan sebagai gambar utama.'; };
window.downloadResult = () => { if (!baseImage.src) return; const a = document.createElement('a'); a.download = 'hasil-edit.png'; a.href = canvas.toDataURL('image/png'); a.click(); };
  
