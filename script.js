window.onload = togglePhase;
const canvasStates = {};

// 1. QUẢN LÝ Ô NHẬP AMPE
function togglePhase() {
  const phase = document.getElementById('phase').value;
  const container = document.getElementById('inputAmperage');
  container.innerHTML = '';
  const ids = phase === "1" ? ["1"] : ["A", "B", "C"];
  ids.forEach(id => {
    const div = document.createElement('div');
    div.className = "field-group";
    div.innerHTML = `
      <div style="display:flex; gap:12px; margin-bottom:8px;">
        <div style="flex:1"><label>Ampe Pha ${id}:</label>
        <input type="number" name="ampere${id}" class="amp-input" oninput="calcPower()" placeholder="0" inputmode="decimal"></div>
        <div style="flex:1" class="no-print"><label>Ảnh đo ${id}:</label>
        <input type="file" accept="image/*" capture="environment" onchange="handlePreview(this)" data-name="img_amp${id}" multiple></div>
      </div>
      <div id="area_img_amp${id}" class="markup-wrapper"></div>`;
    container.appendChild(div);
  });
}

function calcPower() {
  let total = 0;
  document.querySelectorAll('.amp-input').forEach(i => total += Number(i.value) || 0);
  document.getElementById('instantPowerDisplay').innerText = ((total * 220) / 1000).toFixed(2);
}

// 2. XỬ LÝ NHIỀU ẢNH VÀ VẼ MARKUP
function handlePreview(input) {
  const categoryName = input.getAttribute('data-name');
  const area = document.getElementById("area_" + categoryName);
  
  if (!input.files.length) return;

  Array.from(input.files).forEach((file, index) => {
    const reader = new FileReader();
    const uniqueId = categoryName + "_" + Date.now() + "_" + index;

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const itemDiv = document.createElement('div');
        itemDiv.id = "item_" + uniqueId;
        itemDiv.className = "markup-container";
        itemDiv.innerHTML = `
          <div class="markup-toolbar no-print">
            <button type="button" class="tool-btn active" onclick="setTool('${uniqueId}','pen',this)">🖊️ Vẽ</button>
            <button type="button" class="tool-btn" onclick="setTool('${uniqueId}','rect',this)">🔲 Khung</button>
            <button type="button" class="tool-btn" onclick="clearCanvas('${uniqueId}')">🧹 Xóa vẽ</button>
            <button type="button" class="tool-btn btn-del-img" onclick="deleteImage('${uniqueId}')">❌ Xóa ảnh</button>
          </div>
          <div class="canvas-wrapper"><canvas id="canvas_${uniqueId}"></canvas></div>`;
        
        area.appendChild(itemDiv);

        const canvas = document.getElementById(`canvas_${uniqueId}`);
        const ctx = canvas.getContext('2d');
        const scale = Math.min(1, 1000 / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvasStates[uniqueId] = { canvas, ctx, originalImg: img, tool: 'pen', isDrawing: false, category: categoryName };
        setupDrawing(uniqueId);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
  input.value = ""; // Reset input để có thể chọn lại cùng ảnh nếu muốn
}

function setupDrawing(id) {
  const s = canvasStates[id];
  const cv = s.canvas;
  const getPos = (e) => {
    const r = cv.getBoundingClientRect();
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (x - r.left) * (cv.width / r.width), y: (y - r.top) * (cv.height / r.height) };
  };
  const start = (e) => {
    s.isDrawing = true; const p = getPos(e); s.startX = p.x; s.startY = p.y;
    s.ctx.strokeStyle = "red"; s.ctx.lineWidth = 5; s.ctx.beginPath(); s.ctx.moveTo(p.x, p.y);
    s.snapshot = s.ctx.getImageData(0, 0, cv.width, cv.height);
  };
  const move = (e) => {
    if (!s.isDrawing) return; const p = getPos(e);
    if (s.tool === 'pen') { s.ctx.lineTo(p.x, p.y); s.ctx.stroke(); } 
    else { s.ctx.putImageData(s.snapshot, 0, 0); s.ctx.strokeRect(s.startX, s.startY, p.x - s.startX, p.y - s.startY); }
  };
  cv.addEventListener('mousedown', start); cv.addEventListener('mousemove', move);
  window.addEventListener('mouseup', () => s.isDrawing = false);
  cv.addEventListener('touchstart', (e) => { e.preventDefault(); start(e); }, {passive:false});
  cv.addEventListener('touchmove', (e) => { e.preventDefault(); move(e); }, {passive:false});
}

function setTool(id, t, b) {
  canvasStates[id].tool = t;
  b.parentElement.querySelectorAll('.tool-btn').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
}

function clearCanvas(id) {
  const s = canvasStates[id];
  s.ctx.drawImage(s.originalImg, 0, 0, s.canvas.width, s.canvas.height);
}

function deleteImage(id) {
  if(confirm("Xóa ảnh này?")) {
    document.getElementById("item_" + id).remove();
    delete canvasStates[id];
  }
}

// 3. XUẤT PDF ĐA TRANG
async function exportPDF() {
  const btn = document.querySelector('.btn-pdf');
  btn.innerText = "⏳ ĐANG TẠO PDF...";
  const element = document.getElementById('mainApp');
  element.classList.add('pdf-mode');

  try {
    const canvas = await html2canvas(element, { scale: 2, useCORS: true, windowWidth: 794 });
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jspdf.jsPDF('p', 'mm', 'a4');
    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= 297;
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= 297;
    }
    pdf.save(`BaoCao_GP_Solar_${Date.now()}.pdf`);
  } catch (err) { alert("Lỗi: " + err); } 
  finally { element.classList.remove('pdf-mode'); btn.innerText = "📄 XUẤT PDF BÁO CÁO"; }
}

// 4. LƯU & XUẤT JSON (HỖ TRỢ NHIỀU ẢNH)
function exportData() {
  const data = { 
    phase: document.getElementById('phase').value, 
    power: document.getElementById('instantPowerDisplay').innerText,
    notes: {},
    images: {} // Lưu theo dạng mảng cho mỗi mục
  };
  
  document.querySelectorAll('input[type="text"], input[type="number"]').forEach(i => data.notes[i.name] = i.value);
  
  // Thu thập tất cả ảnh từ canvasStates
  for (let id in canvasStates) {
    const cat = canvasStates[id].category;
    if (!data.images[cat]) data.images[cat] = [];
    data.images[cat].push(canvasStates[id].canvas.toDataURL('image/jpeg', 0.8));
  }
  
  saveAs(new Blob([JSON.stringify(data)], {type: "application/json"}), `SolarData_${Date.now()}.json`);
}

function importData(inp) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = JSON.parse(e.target.result);
    document.getElementById('phase').value = data.phase; togglePhase();
    
    setTimeout(() => {
      // Restore notes
      for (let k in data.notes) {
        const f = document.querySelector(`[name="${k}"]`); if(f) f.value = data.notes[k];
      }
      // Restore images
      for (let cat in data.images) {
        const area = document.getElementById("area_" + cat);
        data.images[cat].forEach((imgData, idx) => {
            const img = new Image();
            img.onload = () => handlePreviewFromData(cat, area, img, idx);
            img.src = imgData;
        });
      }
    }, 300);
  };
  reader.readAsText(inp.files[0]);
}

function handlePreviewFromData(categoryName, area, img, idx) {
    const uniqueId = categoryName + "_old_" + idx;
    const itemDiv = document.createElement('div');
    itemDiv.id = "item_" + uniqueId;
    itemDiv.className = "markup-container";
    itemDiv.innerHTML = `
      <div class="markup-toolbar no-print">
        <button type="button" class="tool-btn active" onclick="setTool('${uniqueId}','pen',this)">🖊️</button>
        <button type="button" class="tool-btn" onclick="clearCanvas('${uniqueId}')">🧹</button>
        <button type="button" class="tool-btn btn-del-img" onclick="deleteImage('${uniqueId}')">❌</button>
      </div>
      <div class="canvas-wrapper"><canvas id="canvas_${uniqueId}"></canvas></div>`;
    area.appendChild(itemDiv);
    const canvas = document.getElementById(`canvas_${uniqueId}`);
    const ctx = canvas.getContext('2d');
    canvas.width = img.width; canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    canvasStates[uniqueId] = { canvas, ctx, originalImg: img, tool: 'pen', isDrawing: false, category: categoryName };
    setupDrawing(uniqueId);
}
