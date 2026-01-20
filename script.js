// --- LOGIC CƠ BẢN CỦA ỨNG DỤNG ---
window.onload = togglePhase;

function togglePhase() {
  const phase = document.getElementById('phase').value;
  const container = document.getElementById('inputAmperage');
  container.innerHTML = '';
  const count = phase === "1" ? 1 : 3;
  const labels = phase === "1" ? [""] : ["Pha A", "Pha B", "Pha C"];
  const ids = phase === "1" ? ["1"] : ["A", "B", "C"];
  for (let i = 0; i < count; i++) {
    const div = document.createElement('div');
    div.className = "field-group";
    div.innerHTML = `
      <div class="row">
        <div>
          <label>Dòng điện ${labels[i]} (A):</label>
          <input type="number" name="ampere${ids[i]}" class="amp-input" oninput="calcPower()" placeholder="0">
        </div>
        <div class="no-print">
          <label>Ảnh đo ${labels[i]}:</label>
          <input type="file" accept="image/*" capture="environment" class="img-input" data-name="img_amp${ids[i]}" onchange="handlePreview(this)">
        </div>
      </div>
      <div class="preview" id="prev_img_amp${ids[i]}"></div>`;
    container.appendChild(div);
  }
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
    reader.onload = (e) => {
      previewDiv.innerHTML = `<img src="${e.target.result}">`;
    };
    reader.readAsDataURL(input.files[0]);
  }
}

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
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
    };
  });
}

document.getElementById('surveyForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const btn = e.target.querySelector('.btn-save');
  btn.innerText = "⏳ ĐANG LƯU...";
  const data = { phase: document.getElementById('phase').value };
  const formData = new FormData(this);
  formData.forEach((v, k) => { if (typeof v === 'string') data[k] = v; });
  data.instantPower = document.getElementById('instantPowerDisplay').innerText;
  const fileInputs = document.querySelectorAll('.img-input');
  for (let input of fileInputs) {
    if (input.files[0]) data[input.getAttribute('data-name')] = await processImage(input.files[0]);
  }
  localStorage.setItem("solar_survey_cache", JSON.stringify(data));
  alert("Đã lưu dữ liệu!");
  btn.innerText = "💾 LƯU DỮ LIỆU TẠM";
});

function exportData() {
  const data = localStorage.getItem("solar_survey_cache");
  if (!data) return alert("Hãy nhấn Lưu trước!");
  const blob = new Blob([data], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `Solar_${new Date().getTime()}.json`;
  a.click();
}

// --- LOGIC IMPORT & WORD (MỚI) ---
let loadedJsonData = null; // Biến lưu dữ liệu để xuất Word

function importData(input) {
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      // 1. Lưu vào biến toàn cục để dùng cho Word
      loadedJsonData = JSON.parse(e.target.result);
      document.getElementById('wordActions').style.display = 'block';

      // 2. Load ngược lại vào Form (để xem/sửa nếu cần)
      const data = loadedJsonData;
      document.getElementById('phase').value = data.phase;
      togglePhase();
      setTimeout(() => {
        for (let key in data) {
          const field = document.querySelector(`[name="${key}"]`);
          if (field) field.value = data[key];
          if (key.startsWith('img_')) {
            const div = document.getElementById("prev_" + key);
            if (div) div.innerHTML = `<img src="${data[key]}" style="border: 1px solid #333">`;
          }
        }
        document.getElementById('instantPowerDisplay').innerText = data.instantPower;
      }, 200);
    } catch(err) { alert("File lỗi!"); }
  };
  reader.readAsText(input.files[0]);
}

// === TẠO FILE WORD TỪ JSON ===
async function generateWord() {
  if (!loadedJsonData) return alert("Chưa có dữ liệu!");
  const btn = document.querySelector('.btn-word');
  btn.innerText = "⏳ Đang tạo Word..."; btn.disabled = true;

  const { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, BorderStyle } = docx;

  // Helper: Chuyển Base64 thành ảnh trong Word
  function createDocxImage(base64String, width = 400) {
    if (!base64String) return new Paragraph({ text: "(Chưa có ảnh)", italic: true });
    try {
      const cleanBase64 = base64String.split(',')[1];
      const imageBuffer = Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));
      return new Paragraph({
          children: [new ImageRun({ data: imageBuffer, transformation: { width: width, height: width * 0.75 } })],
          alignment: AlignmentType.CENTER, spacing: { after: 200 }
      });
    } catch (e) { return new Paragraph("(Lỗi ảnh)"); }
  }

  // Helper: Dòng thông tin đậm
  const infoLine = (label, val) => new Paragraph({ children: [new TextRun({ text: label, bold: true }), new TextRun(` ${val || "..."}`)], spacing: { after: 100 } });

  // NỘI DUNG WORD
  const children = [];
  
  // Header Công ty
  children.push(new Paragraph({ text: "CÔNG TY TNHH CÔNG NGHỆ GP SOLAR", heading: HeadingLevel.HEADING_3, alignment: AlignmentType.LEFT }));
  children.push(new Paragraph({ text: "Power for life", spacing: { after: 300 } }));

  // Tiêu đề
  children.push(new Paragraph({ text: "NHẬT KÝ KHẢO SÁT", heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 300 } }));
  
  children.push(infoLine("Thời gian xuất báo cáo:", new Date().toLocaleString('vi-VN')));
  children.push(infoLine("Tiền điện trung bình:", loadedJsonData.monthlyBill ? `${Number(loadedJsonData.monthlyBill).toLocaleString('vi-VN')} VNĐ` : "Chưa nhập"));

  // Phần 1: Thông số điện (Bảng)
  children.push(new Paragraph({ text: "1. THÔNG SỐ ĐIỆN", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
  
  const headerRow = new TableRow({
      children: ["Pha", "Dòng (A)", "Hình ảnh"].map(t => new TableCell({ children: [new Paragraph({ text: t, bold: true })], width: { size: 33, type: WidthType.PERCENTAGE } }))
  });

  const rows = [headerRow];
  if (loadedJsonData.phase === "1") {
      rows.push(new TableRow({ children: [
          new TableCell({ children: [new Paragraph("1 Pha")] }),
          new TableCell({ children: [new Paragraph(loadedJsonData.ampere1 || "0")] }),
          new TableCell({ children: [createDocxImage(loadedJsonData.img_amp1, 150)] })
      ]}));
  } else {
      ['A', 'B', 'C'].forEach(p => {
          rows.push(new TableRow({ children: [
              new TableCell({ children: [new Paragraph("Pha " + p)] }),
              new TableCell({ children: [new Paragraph(loadedJsonData[`ampere${p}`] || "0")] }),
              new TableCell({ children: [createDocxImage(loadedJsonData[`img_amp${p}`], 150)] })
          ]}));
      });
  }
  
  children.push(new Table({ rows: rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
  children.push(new Paragraph({ children: [new TextRun({ text: `=> Tổng công suất tức thời: ${loadedJsonData.instantPower || 0} kW`, bold: true, color: "FF0000" })], spacing: { before: 200 } }));

  // Phần 2: Hình ảnh hiện trường
  children.push(new Paragraph({ text: "2. HÌNH ẢNH HIỆN TRƯỜNG", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
  
  const siteItems = [
      { l: "Lối lên mái", n: "roofAccessNote", i: "img_roof_access" },
      { l: "Vị trí Inverter", n: "inverterLocation", i: "img_inverter" },
      { l: "Đường dây diện", n: "cableLength", i: "img_cable_route" },
      { l: "Kết cấu mái", n: "roofStructure", i: "img_roof_structure" }
  ];

  siteItems.forEach(item => {
      children.push(new Paragraph({ text: `• ${item.l}:`, bold: true, spacing: { before: 200 } }));
      children.push(new Paragraph({ text: `Ghi chú: ${loadedJsonData[item.n] || ""}` }));
      children.push(createDocxImage(loadedJsonData[item.i], 450));
  });

  // Xuất file
  const doc = new Document({ sections: [{ children: children }] });
  Packer.toBlob(doc).then(blob => {
      saveAs(blob, `BaoCao_GPSolar_${new Date().getTime()}.docx`);
      btn.innerText = "📝 TẢI FILE WORD (.DOCX)"; btn.disabled = false;
  });
}

// === GIỮ LẠI LOGIC XUẤT ẢNH PDF CŨ ===
async function exportPDF() {
  const { jsPDF } = window.jspdf;
  const element = document.getElementById('mainApp');
  const btnPDF = document.getElementById('btnExportPDF');
  btnPDF.innerText = "⏳ Đang xử lý..."; btnPDF.disabled = true;

  const clone = element.cloneNode(true);
  clone.classList.add('print-mode');
  const inputs = clone.querySelectorAll('input, select');
  const orgInputs = element.querySelectorAll('input, select');
  
  inputs.forEach((inp, i) => {
      if(inp.type === 'file') return;
      const div = document.createElement('div'); div.className = 'print-value';
      div.innerText = (inp.tagName === 'SELECT' ? orgInputs[i].options[orgInputs[i].selectedIndex].text : orgInputs[i].value) || "...";
      inp.parentNode.replaceChild(div, inp);
  });
  
  if(clone.querySelector('.print-header')) clone.querySelector('.print-header').style.display = 'block';
  const wrapper = document.createElement('div');
  wrapper.style.position = 'absolute'; wrapper.style.left = '-9999px'; wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  try {
    const canvas = await html2canvas(clone, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/jpeg', 0.9);
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfH = 297; 
    const imgH = (canvas.height * 210) / canvas.width;
    let heightLeft = imgH, pos = 0;

    pdf.addImage(imgData, 'JPEG', 0, pos, 210, imgH);
    heightLeft -= pdfH;
    while (heightLeft > 0) {
      pos -= pdfH; heightLeft -= pdfH;
      pdf.addPage(); pdf.addImage(imgData, 'JPEG', 0, pos, 210, imgH);
    }
    pdf.save(`BaoCao_Anh_${new Date().getTime()}.pdf`);
  } catch(e) { alert("Lỗi PDF!"); }
  document.body.removeChild(wrapper);
  btnPDF.innerText = "📄 XUẤT ẢNH BÁO CÁO (PDF)"; btnPDF.disabled = false;
}