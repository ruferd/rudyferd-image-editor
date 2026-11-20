const statusEl = document.getElementById('status');
const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
let baseImage = new Image();
let currentDataUrl = '';
const pipes = {};

// 1. Fungsi Pindah Tab (Langsung aktif tanpa tunggu internet)
document.getElementById('btnTabUpscale').addEventListener('click', () => {
  document.getElementById('btnTabUpscale').classList.add('active');
  document.getElementById('btnTabBg').classList.remove('active');
  document.getElementById('tab-upscale').classList.remove('hidden');
  document.getElementById('tab-removebg').classList.add('hidden');
});

document.getElementById('btnTabBg').addEventListener('click', () => {
  document.getElementById('btnTabBg').classList.add('active');
  document.getElementById('btnTabUpscale').classList.remove('active');
  document.getElementById('tab-removebg').classList.remove('hidden');
  document.getElementById('tab-upscale').classList.add('hidden');
});

// 2. Fungsi Unggah & Preview Gambar (Menggunakan .item(0) agar aman)
document.getElementById('uploadInput').addEventListener('change', (e) => {
  const file = e.target.files.item(0);
  if (!file) return;
  statusEl.textContent = 'Membaca gambar...';
  const reader = new FileReader();
  reader.onload = (ev) => {
    currentDataUrl = ev.target.result;
    baseImage = new Image();
    baseImage.onload = () => {
      canvas.width = baseImage.width;
      canvas.height = baseImage.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(baseImage, 0, 0);
      statusEl.textContent = `Gambar siap (${baseImage.width} x ${baseImage.height} px).`;
    };
    baseImage.src = currentDataUrl;
  };
  reader.readAsDataURL(file);
});

// 3. Fungsi Muat Mesin AI Dinamis (Dengan Cadangan 2 Server)
async function getPipeline(task, modelId) {
  if (pipes[modelId]) return pipes[modelId];
  let tf;
  try {
    tf = await import('https://esm.sh');
  } catch (e1) {
    tf = await import('https://jsdelivr.net');
  }
  tf.env.allowLocalModels = false;
  pipes[modelId] = await tf.pipeline(task, modelId);
  return pipes[modelId];
}

// 4. Tombol Upscale
document.getElementById('btnUpscale').addEventListener('click', async () => {
  if (!currentDataUrl) return alert('Pilih gambar terlebih dahulu!');
  const btn = document.getElementById('btnUpscale');
  btn.disabled = true;
  const modelId = document.getElementById('upscaleModel').value;
  try {
    statusEl.textContent = 'Memuat mesin & model Upscaler (tunggu 15-30 detik)...';
    const upscaler = await getPipeline('image-to-image', modelId);
    statusEl.textContent = 'Sedang memperbesar gambar...';
    const output = await upscaler(currentDataUrl);
    const outCanvas = output.toCanvas();
    canvas.width = outCanvas.width;
    canvas.height = outCanvas.height;
    ctx.drawImage(outCanvas, 0, 0);
    statusEl.textContent = `Selesai! Ukuran baru: ${canvas.width} x ${canvas.height} px.`;
  } catch (err) {
    statusEl.textContent = 'Gagal Upscale: ' + err.message;
  }
  btn.disabled = false;
});

// 5. Tombol Hapus Background
document.getElementById('btnRemoveBg').addEventListener('click', async () => {
  if (!currentDataUrl) return alert('Pilih gambar terlebih dahulu!');
  const btn = document.getElementById('btnRemoveBg');
  btn.disabled = true;
  const modelId = 'briaai/RMBG-1.4';
  try {
    statusEl.textContent = 'Memuat model Hapus Background (tunggu 15-30 detik)...';
    const segmenter = await getPipeline('image-segmentation', modelId);
    statusEl.textContent = 'Menghapus latar belakang...';
    const output = await segmenter(currentDataUrl);
    const firstResult = Array.isArray(output) ? output.at(0) : output;
    const maskCanvas = firstResult.mask.toCanvas();

    canvas.width = baseImage.width;
    canvas.height = baseImage.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-in';
    ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
    statusEl.textContent = 'Background berhasil dihapus!';
  } catch (err) {
    statusEl.textContent = 'Gagal Hapus BG: ' + err.message;
  }
  btn.disabled = false;
});

// 6. Tombol Terapkan & Download
document.getElementById('btnApply').addEventListener('click', () => {
  if (!currentDataUrl) return;
  currentDataUrl = canvas.toDataURL('image/png');
  baseImage.src = currentDataUrl;
  statusEl.textContent = 'Hasil diterapkan sebagai gambar utama.';
});

document.getElementById('btnDownload').addEventListener('click', () => {
  if (!currentDataUrl) return;
  const a = document.createElement('a');
  a.download = 'hasil-edit-ai.png';
  a.href = canvas.toDataURL('image/png');
  a.click();
});
