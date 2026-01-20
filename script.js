window.onload = togglePhase;

// 1. Quản lý các ô nhập Ampe (Tối ưu di động)
function togglePhase() {
  const phase = document.getElementById('phase').value;
  const container = document.getElementById('inputAmperage');
  container.innerHTML = '';
  
  const ids = phase === "1" ? ["1"] : ["A", "B", "C"];
  const labels = phase === "1" ? ["Dòng điện (A)"] : ["Dòng Pha A (A)", "Dòng Pha B (A)", "Dòng Pha C (A)"];

  ids.forEach((id, index) => {
    const div = document.createElement('div');
    div.className = "field-group";
    div.innerHTML = `
      <div class="row">
        <div>
          <label>${labels[index]}:</label>
          <input type="number" name="ampere${id}" class="amp-input" oninput="calcPower()" placeholder="0" inputmode="decimal">
        </div>
        <div class="no-print">
          <label>Ảnh đo ${id}:</label>
          <input type="file" accept="image/*" capture="environment" class="img-input" data-name="img_amp${id}" onchange="handlePreview(this)">
        </div>
      </div>
      <div class="preview" id="prev_img_amp${id}"></div>`;
    container.appendChild(div);
  });
}

function calcPower() {
  let totalAmp = 0;
  document.querySelectorAll('.amp-input').forEach(i => totalAmp += Number(i.value) || 0);
  document.getElementById('instantPowerDisplay').innerText = ((totalAmp * 220) / 1000).toFixed(2);
}

function handlePreview(input) {
  const previewDiv = document.getElementById("prev_" + input.getAttribute('data-name'));
  previewDiv.innerHTML = '';
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => { previewDiv.innerHTML = `<img src="${e.target.result}">`; };
    reader.readAsDataURL(input.files[0]);
  }
}

// 2. Nén ảnh Base64
async function processImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * (MAX_WIDTH / img.width);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    };
  });
}

// 3. Lưu & Xuất JSON
document.getElementById('surveyForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const btn = e.target.querySelector('.btn-save');
  btn.innerText = "⏳ ĐANG XỬ LÝ...";
  const data = { phase: document.getElementById('phase').value };
  const formData = new FormData(this);
  formData.forEach((v, k) => { if (typeof v === 'string') data[k] = v; });
  data.instantPower = document.getElementById('instantPowerDisplay').innerText;
  
  const fileInputs = document.querySelectorAll('.img-input');
  for (let input of fileInputs) {
    if (input.files[0]) data[input.getAttribute('data-name')] = await processImage(input.files[0]);
  }
  
  localStorage.setItem("solar_survey_cache", JSON.stringify(data));
  alert("Đã lưu tạm dữ liệu!");
  btn.innerText = "💾 LƯU DỮ LIỆU TẠM";
});

function exportData() {
  const data = localStorage.getItem("solar_survey_cache");
  if (!data) return alert("Hãy Lưu trước khi xuất!");
  const blob = new Blob([data], { type: "application/json" });
  saveAs(blob, `Survey_Data_${new Date().getTime()}.json`);
}

// 4. Import & Xuất Word
let loadedJsonData = null;
function importData(input) {
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      loadedJsonData = JSON.parse(e.target.result);
      document.getElementById('wordActions').style.display = 'block';
      // Fill ngược vào form
      const data = loadedJsonData;
      document.getElementById('phase').value = data.phase;
      togglePhase();
      setTimeout(() => {
        for (let key in data) {
          const field = document.querySelector(`[name="${key}"]`);
          if (field) field.value = data[key];
          if (key.startsWith('img_') && data[key]) {
            const div = document.getElementById("prev_" + key);
            if (div) div.innerHTML = `<img src="${data[key]}">`;
          }
        }
        document.getElementById('instantPowerDisplay').innerText = data.instantPower;
      }, 300);
    } catch(err) { alert("Lỗi đọc file JSON!"); }
  };
  reader.readAsText(input.files[0]);
}

async function generateWord() {
  if (!loadedJsonData) return;
  const btn = document.querySelector('.btn-word');
  btn.innerText = "⏳ Đang tạo file...";
  
  const { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel } = docx;

  function createImg(base64, width = 450) {
    if (!base64) return new Paragraph({ text: "(Không có ảnh)", italic: true });
    const imageBuffer = Uint8Array.from(atob(base64.split(',')[1]), c => c.charCodeAt(0));
    return new Paragraph({
      children: [new ImageRun({ data: imageBuffer, transformation: { width, height: width * 0.75 } })],
      alignment: AlignmentType.CENTER, spacing: { before: 200, after: 200 }
    });
  }

  const children = [
    new Paragraph({ text: "CÔNG TY TNHH CÔNG NGHỆ GP SOLAR", heading: HeadingLevel.HEADING_3 }),
    new Paragraph({ text: "NHẬT KÝ KHẢO SÁT HIỆN TRƯỜNG", heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { before: 400, after: 400 } }),
    new Paragraph({ children: [new TextRun({ text: "Thời gian: ", bold: true }), new TextRun(new Date().toLocaleString())] }),
    new Paragraph({ children: [new TextRun({ text: "Tiền điện TB: ", bold: true }), new TextRun(loadedJsonData.monthlyBill + " VNĐ")] }),
    
    new Paragraph({ text: "1. THÔNG SỐ ĐIỆN", heading: HeadingLevel.HEADING_2, spacing: { before: 400 } }),
  ];

  // Bảng Ampe
  const rows = [new TableRow({ children: [
    new TableCell({ children: [new Paragraph({ text: "Hạng mục", bold: true })] }),
    new TableCell({ children: [new Paragraph({ text: "Giá trị (A)", bold: true })] }),
    new TableCell({ children: [new Paragraph({ text: "Hình ảnh", bold: true })] })
  ]})];

  const ampeIds = loadedJsonData.phase === "1" ? ["1"] : ["A", "B", "C"];
  ampeIds.forEach(id => {
    rows.push(new TableRow({ children: [
      new TableCell({ children: [new Paragraph("Pha " + id)] }),
      new TableCell({ children: [new Paragraph(loadedJsonData["ampere" + id] || "0")] }),
      new TableCell({ children: [createImg(loadedJsonData["img_amp" + id], 120)] })
    ]}));
  });
  children.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
  children.push(new Paragraph({ children: [new TextRun({ text: `=> Tổng công suất tiêu thụ: ${loadedJsonData.instantPower} kW`, bold: true, color: "FF0000" })], spacing: { before: 200 } }));

  // Ảnh hiện trường
  children.push(new Paragraph({ text: "2. HÌNH ẢNH HIỆN TRƯỜNG", heading: HeadingLevel.HEADING_2, spacing: { before: 400 } }));
  const sections = [
    { l: "Lối lên mái", n: "roofAccessNote", i: "img_roof_access" },
    { l: "Vị trí Inverter", n: "inverterLocation", i: "img_inverter" },
    { l: "Đường dây điện", n: "cableLength", i: "img_cable_route" },
    { l: "Kết cấu mái", n: "roofStructure", i: "img_roof_structure" }
  ];

  sections.forEach(s => {
    children.push(new Paragraph({ text: `• ${s.l}:`, bold: true, spacing: { before: 200 } }));
    children.push(new Paragraph({ text: "Ghi chú: " + (loadedJsonData[s.n] || "N/A") }));
    children.push(createImg(loadedJsonData[s.i], 450));
  });

  const doc = new Document({ sections: [{ children }] });
  Packer.toBlob(doc).then(blob => {
    saveAs(blob, `BaoCao_Solar_Word_${new Date().getTime()}.docx`);
    btn.innerText = "📝 TẢI FILE WORD (.DOCX)";
  });
}

// 5. Xuất PDF Ảnh (Giữ nguyên logic cũ)
async function exportPDF() {
  const btn = document.getElementById('btnExportPDF');
  btn.innerText = "⏳ Đang tạo PDF..."; btn.disabled = true;
  const element = document.getElementById('mainApp');
  const clone = element.cloneNode(true);
  clone.classList.add('print-mode');
  
  const orgInputs = element.querySelectorAll('input, select');
  clone.querySelectorAll('input, select').forEach((inp, i) => {
    if(inp.type === 'file') return;
    const div = document.createElement('div'); div.className = 'print-value';
    div.innerText = (inp.tagName === 'SELECT' ? orgInputs[i].options[orgInputs[i].selectedIndex].text : orgInputs[i].value) || "...";
    inp.parentNode.replaceChild(div, inp);
  });

  const wrapper = document.createElement('div');
  wrapper.style.position = 'absolute'; wrapper.style.left = '-9999px';
  wrapper.appendChild(clone); document.body.appendChild(wrapper);

  try {
    const canvas = await html2canvas(clone, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/jpeg', 0.9);
    const pdf = new jspdf.jsPDF('p', 'mm', 'a4');
    const imgH = (canvas.height * 210) / canvas.width;
    let hLeft = imgH, pos = 0;
    pdf.addImage(imgData, 'JPEG', 0, pos, 210, imgH);
    hLeft -= 297;
    while (hLeft > 0) { pos -= 297; hLeft -= 297; pdf.addPage(); pdf.addImage(imgData, 'JPEG', 0, pos, 210, imgH); }
    pdf.save(`BaoCao_Anh_${new Date().getTime()}.pdf`);
  } catch(e) { console.error(e); }
  document.body.removeChild(wrapper);
  btn.innerText = "📄 XUẤT ẢNH BÁO CÁO (PDF)"; btn.disabled = false;
}
