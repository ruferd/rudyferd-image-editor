import { pipeline, env } from 'https://jsdelivr.net';

env.allowLocalModels = false;

const statusEl = document.getElementById('status');
const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
let baseImage = new Image();
let currentDataUrl = '';
const pipes = {};

window.switchTab = (tab) => {
  const tabs = ['upscale', 'removebg'];
  document.querySelectorAll('.tab-btn').forEach((b, i) => b.classList.toggle('active', tabs[i] === tab));
  tabs.forEach(t => document.getElementById(`tab-${t}`).classList.toggle('hidden', t !== tab));
};

document.getElementById('uploadInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    currentDataUrl = ev.target.result;
    baseImage = new Image();
    baseImage.onload = () => {
      canvas.width = baseImage.width;
      canvas.height = baseImage.height;
      ctx.drawImage(baseImage, 0, 0);
      statusEl.textContent = `Gambar siap (${baseImage.width} x ${baseImage.height} px).`;
    };
    baseImage.src = currentDataUrl;
  };
  reader.readAsDataURL(file);
});

window.runUpscale = async () => {
  if (!currentDataUrl) return alert('Pilih gambar dulu!');
  const btn = document.getElementById('btnUpscale');
  btn.disabled = true;
  const modelId = document.getElementById('upscaleModel').value;
  try {
    if (!pipes[modelId]) {
      statusEl.textContent = 'Mengunduh model Upscaler pertama kali (tunggu 15-30 detik)...';
      pipes[modelId] = await pipeline('image-to-image', modelId);
    }
    statusEl.textContent = 'Sedang memperbesar gambar...';
    const output = await pipes[modelId](currentDataUrl);
    const outCanvas = output.toCanvas();
    canvas.width = outCanvas.width;
    canvas.height = outCanvas.height;
    ctx.drawImage(outCanvas, 0, 0);
    statusEl.textContent = `Selesai! Ukuran baru: ${canvas.width} x ${canvas.height} px.`;
  } catch (err) {
    statusEl.textContent = 'Error Upscale: ' + err.message;
  }
  btn.disabled = false;
};

window.runRemoveBg = async () => {
  if (!currentDataUrl) return alert('Pilih gambar dulu!');
  const btn = document.getElementById('btnRemoveBg');
  btn.disabled = true;
  const modelId = 'briaai/RMBG-1.4';
  try {
    if (!pipes[modelId]) {
      statusEl.textContent = 'Mengunduh model RMBG-1.4 pertama kali (tunggu 15-30 detik)...';
      pipes[modelId] = await pipeline('image-segmentation', modelId);
    }
    statusEl.textContent = 'Menghapus latar belakang...';
    const output = await pipes[modelId](currentDataUrl);
    const maskCanvas = output[0].mask.toCanvas();

    canvas.width = baseImage.width;
    canvas.height = baseImage.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-in';
    ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
    statusEl.textContent = 'Background berhasil dihapus!';
  } catch (err) {
    statusEl.textContent = 'Error Remove BG: ' + err.message;
  }
  btn.disabled = false;
};

window.applyResultAsBase = () => {
  if (!currentDataUrl) return;
  currentDataUrl = canvas.toDataURL('image/png');
  baseImage.src = currentDataUrl;
  statusEl.textContent = 'Hasil diterapkan sebagai gambar utama.';
};

window.downloadResult = () => {
  if (!currentDataUrl) return;
  const a = document.createElement('a');
  a.download = 'hasil-edit-ai.png';
  a.href = canvas.toDataURL('image/png');
  a.click();
};
