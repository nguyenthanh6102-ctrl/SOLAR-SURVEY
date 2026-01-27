window.onload = togglePhase;
const canvasStates = {};

// --- 1. QUẢN LÝ GIAO DIỆN & TÍNH TOÁN ---
function togglePhase() {
  const phase = document.getElementById('phase').value;
  const container = document.getElementById('inputAmperage');
  const options3Phase = document.getElementById('options3Phase');
  
  options3Phase.style.display = (phase === "3") ? "flex" : "none";
  container.innerHTML = '';
  const ids = phase === "1" ? ["1"] : ["A", "B", "C"];
  
  ids.forEach(id => {
    const div = document.createElement('div');
    div.className = "box-section-sub";
    div.innerHTML = `
      <label><strong>Ampe Pha ${id}:</strong></label>
      <input type="number" name="ampere${id}" class="amp-input" oninput="calcPower()" placeholder="0" inputmode="decimal">
      <div id="area_img_amp${id}" class="markup-wrapper"></div>
      <div class="upload-zone no-print" style="margin-top:10px;">
        <label class="custom-file-upload-sub">
          <input type="file" accept="image/*" onchange="handlePreview(this)" data-name="img_amp${id}" multiple>
          📸 Ảnh đo Pha ${id}
        </label>
      </div>`;
    container.appendChild(div);
  });
  calcPower();
}

function calcPower() {
  const phase = document.getElementById('phase').value;
  const inputs = document.querySelectorAll('.amp-input');
  let totalAmps = 0;
  inputs.forEach(i => totalAmps += Number(i.value) || 0);
  
  let power = 0;
  let note = "";

  if (phase === "1") {
    power = (totalAmps * 220) / 1000;
    note = "(Công thức: I x 220V)";
  } else {
    const loadType = document.getElementById('loadType').value;
    if (loadType === "unbalanced") {
      power = (totalAmps * 220) / 1000;
      note = "(Tải lệch: Tổng Ampe các pha x 220V)";
    } else {
      const cosPhi = parseFloat(document.getElementById('cosPhi').value) || 0.9;
      const avgAmp = totalAmps / 3;
      power = (1.732 * 380 * avgAmp * cosPhi) / 1000;
      note = `(√3 x 380V x I_tb x Cosφ ${cosPhi})`;
    }
  }
  document.getElementById('instantPowerDisplay').innerText = power.toFixed(2);
  document.getElementById('formulaNote').innerText = note;
}

// --- 2. XỬ LÝ HÌNH ẢNH & CANVAS ---
function handlePreview(input) {
  const categoryName = input.getAttribute('data-name');
  const area = document.getElementById("area_" + categoryName);
  if (!input.files.length) return;
  Array.from(input.files).forEach((file, index) => {
    const reader = new FileReader();
    const uniqueId = categoryName + "_" + Date.now() + "_" + index;
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => { createCanvasItem(area, uniqueId, img, categoryName, null); };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
  input.value = ""; 
}

function createCanvasItem(container, uniqueId, img, categoryName, initialNote) {
    if (!container) return;
    const itemDiv = document.createElement('div');
    itemDiv.id = "item_" + uniqueId;
    itemDiv.className = "markup-container";
    
    itemDiv.innerHTML = `
      <input type="text" class="img-note-input no-print" placeholder="Ghi chú riêng cho ảnh này..." value="${initialNote || ''}" onchange="saveImgNote('${uniqueId}', this.value)">
      <div class="markup-toolbar no-print">
        <button type="button" class="tool-btn active" onclick="setTool('${uniqueId}','pen',this)">🖊️ Vẽ</button>
        <button type="button" class="tool-btn" onclick="setTool('${uniqueId}','arrow',this)">↔️ Mũi tên</button>
        <button type="button" class="tool-btn" onclick="setTool('${uniqueId}','rect',this)">🔲 Khung</button>
        <button type="button" class="tool-btn" onclick="setTool('${uniqueId}','text',this)">🔤 Chữ</button>
        <button type="button" class="tool-btn btn-undo" onclick="undo('${uniqueId}')">↩️ Hoàn tác</button>
        <button type="button" class="tool-btn btn-del-img" onclick="deleteImage('${uniqueId}')">❌ Xóa</button>
      </div>
      <div class="canvas-wrapper"><canvas id="canvas_${uniqueId}"></canvas></div>`;
    container.appendChild(itemDiv);
    
    const canvas = document.getElementById(`canvas_${uniqueId}`);
    const ctx = canvas.getContext('2d');
    
    // SCALE: Giới hạn chiều rộng 600px để gọn giao diện
    const maxW = 600; 
    const scale = Math.min(1, maxW / img.width);
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    canvasStates[uniqueId] = { 
        canvas, ctx, originalImg: img, 
        tool: 'pen', isDrawing: false, 
        category: categoryName,
        note: initialNote || '', 
        history: [ctx.getImageData(0, 0, canvas.width, canvas.height)] 
    };
    setupDrawing(uniqueId);
}

function saveImgNote(id, value) { if(canvasStates[id]) canvasStates[id].note = value; }

function setupDrawing(id) {
  const s = canvasStates[id];
  const cv = s.canvas;
  const getPos = (e) => {
    const r = cv.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - r.left) * (cv.width / r.width), y: (clientY - r.top) * (cv.height / r.height) };
  };

  const drawArrow = (ctx, x1, y1, x2, y2) => {
    const headlen = 15; const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.moveTo(x1, y1); ctx.lineTo(x1 + headlen * Math.cos(angle + Math.PI / 6), y1 + headlen * Math.sin(angle + Math.PI / 6));
    ctx.moveTo(x1, y1); ctx.lineTo(x1 + headlen * Math.cos(angle - Math.PI / 6), y1 + headlen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(x2, y2); ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(x2, y2); ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  };

  const start = (e) => {
    const p = getPos(e);
    if (s.tool === 'text') {
      const text = prompt("Nhập chữ:");
      if (text) {
        const size = prompt("Cỡ chữ:", "30");
        s.ctx.fillStyle = "red"; s.ctx.font = `bold ${size}px Arial`;
        s.ctx.fillText(text, p.x, p.y); saveHistory(id);
      }
      return;
    }
    s.isDrawing = true; s.startX = p.x; s.startY = p.y;
    s.ctx.strokeStyle = "red"; s.ctx.lineWidth = 4;
    s.snapshot = s.ctx.getImageData(0, 0, cv.width, cv.height);
    if(s.tool === 'pen') { s.ctx.beginPath(); s.ctx.moveTo(p.x, p.y); }
  };

  const move = (e) => {
    if (!s.isDrawing) return;
    const p = getPos(e);
    if (s.tool === 'pen') { s.ctx.lineTo(p.x, p.y); s.ctx.stroke(); }
    else {
      s.ctx.putImageData(s.snapshot, 0, 0);
      if (s.tool === 'rect') s.ctx.strokeRect(s.startX, s.startY, p.x - s.startX, p.y - s.startY);
      else if (s.tool === 'arrow') drawArrow(s.ctx, s.startX, s.startY, p.x, p.y);
    }
  };
  const end = () => { if(s.isDrawing) { s.isDrawing = false; saveHistory(id); } };

  cv.addEventListener('mousedown', start); cv.addEventListener('mousemove', move); window.addEventListener('mouseup', end);
  cv.addEventListener('touchstart', (e) => { if(s.tool !== 'text') e.preventDefault(); start(e); }, {passive:false});
  cv.addEventListener('touchmove', (e) => { if(s.tool !== 'text') e.preventDefault(); move(e); }, {passive:false});
  cv.addEventListener('touchend', end);
}

function saveHistory(id) {
    const s = canvasStates[id];
    s.history.push(s.ctx.getImageData(0, 0, s.canvas.width, s.canvas.height));
}

function undo(id) {
    const s = canvasStates[id];
    if (s.history.length > 1) {
        s.history.pop();
        s.ctx.putImageData(s.history[s.history.length - 1], 0, 0);
    }
}

function setTool(id, t, b) {
  if(canvasStates[id]) canvasStates[id].tool = t;
  b.parentElement.querySelectorAll('.tool-btn').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
}

function deleteImage(id) { if(confirm("Xóa ảnh?")) { document.getElementById("item_" + id).remove(); delete canvasStates[id]; } }

// --- 3. XUẤT BÁO CÁO (PDF & WORD) ---
async function exportPDF() {
  const btn = document.querySelector('.btn-pdf');
  const originalText = btn.innerText;
  btn.innerText = "⏳ ĐANG TẠO PDF..."; btn.disabled = true;
  const element = document.getElementById('mainApp');
  element.classList.add('pdf-mode');
  
  // Hiện ghi chú ảnh trong bản in PDF
  document.querySelectorAll('.img-note-input').forEach(el => el.classList.remove('no-print'));

  window.scrollTo(0, 0);
  try {
    const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL('image/jpeg', 0.8);
    const pdf = new jspdf.jsPDF('p', 'mm', 'a4');
    const imgWidth = 210; const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight; let position = 0;
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= 297;
    while (heightLeft > 0) { position = heightLeft - imgHeight; pdf.addPage(); pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight); heightLeft -= 297; }
    pdf.save(`Bao_Cao_Solar_${Date.now()}.pdf`);
  } catch (err) { alert("Lỗi xuất PDF: " + err.message); }
  finally { 
      element.classList.remove('pdf-mode'); 
      document.querySelectorAll('.img-note-input').forEach(el => el.classList.add('no-print'));
      btn.innerText = originalText; btn.disabled = false; 
  }
}

async function exportDOCX() {
    const btn = document.querySelector('.btn-docx');
    btn.innerText = "⏳ ĐANG TẠO WORD..."; btn.disabled = true;
    try {
        const { Document, Packer, Paragraph, ImageRun, HeadingLevel, AlignmentType, TextRun } = docx;
        const phase = document.getElementById('phase').value;
        const notes = {}; 
        document.querySelectorAll('input[type="text"], input[type="number"], select').forEach(i => {
            if(i.name && !i.classList.contains('img-note-input')) notes[i.name] = i.value;
        });
        
        const docChildren = [
            new Paragraph({ text: "BÁO CÁO KHẢO SÁT HIỆN TRƯỜNG", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
            new Paragraph({ text: `Ngày khảo sát: ${new Date().toLocaleDateString('vi-VN')}`, alignment: AlignmentType.CENTER, spacing: { after: 300 } })
        ];

        const addSect = (title, nKey, iKey) => {
            docChildren.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }));
            if(nKey && notes[nKey]) docChildren.push(new Paragraph({ text: `Ghi chú chung: ${notes[nKey]}`, spacing: { after: 150 } }));
            
            for (let id in canvasStates) {
                if (canvasStates[id].category === iKey) {
                    if (canvasStates[id].note) {
                        docChildren.push(new Paragraph({
                            children: [ new TextRun({ text: `Ghi chú ảnh: ${canvasStates[id].note}`, italics: true, color: "555555" }) ],
                            spacing: { before: 100, after: 50 }
                        }));
                    }
                    const buf = Uint8Array.from(atob(canvasStates[id].canvas.toDataURL('image/jpeg', 0.8).split(',')[1]), c => c.charCodeAt(0));
                    docChildren.push(new Paragraph({ children: [new ImageRun({ data: buf, transformation: { width: 500, height: 320 } })], alignment: AlignmentType.CENTER, spacing: { after: 200 } }));
                }
            }
        };

        let elecInfo = `Hệ thống: ${phase} Pha. `;
        if (phase === "3") elecInfo += `Loại tải: ${notes['loadType'] === 'balanced' ? 'Cân bằng' : 'Không cân bằng'}. CosPhi: ${notes['cosPhi']}. `;
        elecInfo += `Công suất tính toán: ${document.getElementById('instantPowerDisplay').innerText} kW`;
        docChildren.push(new Paragraph({ text: "1. THÔNG SỐ ĐIỆN", heading: HeadingLevel.HEADING_2 }));
        docChildren.push(new Paragraph({ text: elecInfo, spacing: { after: 200 } }));

        if(phase==="1") addSect("Đo đạc Pha 1", "ampere1", "img_amp1");
        else { addSect("Pha A", "ampereA", "img_ampA"); addSect("Pha B", "ampereB", "img_ampB"); addSect("Pha C", "ampereC", "img_ampC"); }
        addSect("2. HÌNH ẢNH TỔNG THỂ", "roofNote", "img_roof");
        addSect("3. VỊ TRÍ LẮP INVERTER", "invNote", "img_inv");
        addSect("4. GHI CHÚ KHÁC", "meterNote", "img_meter");

        const docObj = new Document({ sections: [{ children: docChildren }] });
        const blob = await Packer.toBlob(docObj);
        saveAs(blob, `Bao_Cao_Solar_${Date.now()}.docx`);
    } catch (e) { alert("Lỗi xuất Word: " + e.message); }
    finally { btn.innerText = "📝 XUẤT BÁO CÁO WORD"; btn.disabled = false; }
}

// --- 4. IMPORT / EXPORT JSON ---
function exportData() {
  const data = { notes: {}, images: {} };
  document.querySelectorAll('input[type="text"], input[type="number"], select').forEach(i => {
      if(i.name && !i.classList.contains('img-note-input')) data.notes[i.name] = i.value;
  });
  for (let id in canvasStates) {
    const cat = canvasStates[id].category;
    if (!data.images[cat]) data.images[cat] = [];
    data.images[cat].push({ data: canvasStates[id].canvas.toDataURL('image/jpeg', 0.8), note: canvasStates[id].note || '' });
  }
  saveAs(new Blob([JSON.stringify(data)], {type: "application/json"}), `Survey_${Date.now()}.json`);
}

function importData(inp) {
  if (!inp.files.length) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = JSON.parse(e.target.result);
    for (let k in data.notes) { 
        const f = document.querySelector(`[name="${k}"]`); if(f) f.value = data.notes[k]; 
    }
    togglePhase(); 
    setTimeout(() => {
        for (let k in data.notes) { 
            const f = document.querySelector(`[name="${k}"]`); if(f) f.value = data.notes[k]; 
        }
        calcPower();
        document.querySelectorAll('.markup-container').forEach(el => el.remove());
        for (let member in canvasStates) delete canvasStates[member];
        for (let cat in data.images) {
            const area = document.getElementById("area_" + cat);
            if (area && Array.isArray(data.images[cat])) {
                data.images[cat].forEach((imgObj, idx) => {
                    const imgData = typeof imgObj === 'string' ? imgObj : imgObj.data;
                    const imgNote = typeof imgObj === 'string' ? '' : imgObj.note;
                    const img = new Image();
                    img.onload = () => createCanvasItem(area, cat + "_restored_" + idx, img, cat, imgNote);
                    img.src = imgData;
                });
            }
        }
    }, 300);
  };
  reader.readAsText(inp.files[0]);
}
