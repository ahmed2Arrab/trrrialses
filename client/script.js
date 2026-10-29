/**
 * ==========================================
 * TAILWIND CONFIGURATION
 * ==========================================
 */
tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: { sans: ["Cairo", "sans-serif"] },
      colors: {
        brand: { dark: "#0f172a", gold: "#d4af37", bg: "#f8fafc" },
        dash: { primary: "#2c3e50", accent: "#f39c12" },
      },
    },
  },
};

/**
 * ==========================================
 * STATE & STORAGE (Delta System)
 * ==========================================
 */
let clientsDB = [];
let trashDB = [];
let activeClient = null;
let currentPDFAbortController = null;

// Fetch data on page load
async function loadDB() {
  try {
    const res = await fetch("/api/data");
    const data = await res.json();
    clientsDB = data.clientsDB || [];
    trashDB = data.trashDB || [];
    renderDashboard();
  } catch (err) {
    console.error("Failed to load DB from backend:", err);
  }
}

// Call load DB on initialization
loadDB();

async function saveDB() {
  try {
    await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientsDB, trashDB }),
    });
  } catch (err) {
    console.error("Failed to save DB to backend:", err);
  }
}

/**
 * ==========================================
 * BACKUP & RESTORE
 * ==========================================
 */

function downloadBackup() {
  window.location.href = "/api/backup";
}

async function handleRestore(input) {
  const file = input.files[0];
  if (!file) return;

  showConfirmModal(
    "تأكيد استعادة البيانات",
    "تحذير: استعادة النسخة الاحتياطية ستمسح جميع البيانات الحالية وتستبدلها ببيانات النسخة. هل أنت متأكد؟",
    async () => {
      const formData = new FormData();
      formData.append("backup", file);

      try {
        const res = await fetch("/api/restore", {
          method: "POST",
          body: formData,
        });
        const result = await res.json();

        if (result.success) {
          showConfirmModal(
            "تم الاستعادة",
            "تمت استعادة البيانات بنجاح! سيتم إعادة تحميل الصفحة الآن.",
            () => window.location.reload(),
            false,
            "green",
          );
        } else {
          showConfirmModal(
            "فشل في الاستعادة",
            "خطأ: " + (result.error || "فشل غير متوقع في معالجة الملف."),
            () => {},
            true,
            "red",
          );
        }
      } catch (err) {
        console.error("Restore failed:", err);
        showConfirmModal(
          "خطأ في الاتصال",
          "حدث خطأ أثناء محاولة الاتصال بالخادم لاستعادة البيانات.",
          () => {},
          true,
          "red",
        );
      } finally {
        input.value = "";
      }
    },
    true,
    "blue",
  );
}

/**
 * ==========================================
 * AUTHENTICATION
 * ==========================================
 */
function handleLogin() {
  const user = document.getElementById("userInput").value.trim();
  const pass = document.getElementById("passInput").value;
  const authorized = ["فوزي", "محمود", "نجاح", "وليد", "omar"];

  if (authorized.includes(user) && pass === "123456789") {
    document.getElementById("login-wrapper").classList.add("page-hidden");
    document
      .getElementById("dashboard-wrapper")
      .classList.remove("page-hidden");
    document.getElementById("adminName").innerText = user;
    renderDashboard();
  } else {
    document.getElementById("errorMessage").classList.remove("hidden");
  }
}

/**
 * ==========================================
 * DASHBOARD & MAIN VIEWS
 * ==========================================
 */
function renderDashboard(query = "") {
  const tbody = document.getElementById("mainTableBody");
  tbody.innerHTML = "";
  const filtered = clientsDB.filter(
    (c) => c.name.includes(query) || c.plot.includes(query),
  );

  filtered.forEach((c) => {
    const totalTips = c.tips.reduce((acc, t) => acc + parseFloat(t.amount), 0);
    const totalExpenses = (c.expenses || []).reduce(
      (acc, e) => acc + parseFloat(e.amount),
      0,
    );
    const owed = c.paid - totalExpenses;

    tbody.innerHTML += `
      <tr class="hover:bg-gray-50 dark:hover:bg-slate-700 transition group">
        <td class="border-x border-gray-100 dark:border-slate-700">
           ${c.name}
        </td>
        <td class="border-x border-gray-100 dark:border-slate-700">${c.plot}</td>
        <td class="text-red-600 font-black border-x border-gray-100 dark:border-slate-700">${owed.toLocaleString()} ج.م</td>
        <td dir="ltr" class="border-x border-gray-100 dark:border-slate-700 font-bold">${c.phone || "---"}</td>
        <td class="rounded-l-2xl border-r-0 ">
          <div class="flex gap-2 justify-end w-fit">
            <button onclick="openClientPage('${c.id}')" class="bg-gray-100 dark:bg-slate-600 text-gray-700 dark:text-white px-4 py-2 rounded-lg font-bold hover:bg-[#2c3e50] hover:text-white transition">عرض</button>
            <button onclick="deleteClient('${c.id}')" class="bg-red-50 dark:bg-red-900/30 text-red-500 px-3 py-2 rounded-lg font-bold hover:bg-red-500 hover:text-white transition"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      </tr>`;
  });
}

function backToDashboard() {
  document.getElementById("client-wrapper").classList.add("page-hidden");
  document.getElementById("dashboard-wrapper").classList.remove("page-hidden");
  renderDashboard();
}

/**
 * ==========================================
 * CLIENT MANAGEMENT (CRUD)
 * ==========================================
 */
function createNewClient() {
  const name = document.getElementById("newC_Name").value;
  const plot = document.getElementById("newC_Plot").value;
  const total = parseFloat(document.getElementById("newC_Total").value) || 0;

  if (name && plot && total) {
    const newClient = {
      id: Date.now().toString(),
      name,
      plot,
      totalContract: total,
      paid: total,
      phone: "",
      expenses: [],
      tips: [],
      docs: [],
      pdfs: [],
      receipts: [],
    };
    clientsDB.push(newClient);
    saveDB();
    renderDashboard();
    toggleNewClientModal();
    document.getElementById("newC_Name").value = "";
    document.getElementById("newC_Plot").value = "";
    document.getElementById("newC_Total").value = "";
  }
}

function deleteClient(id) {
  showConfirmModal(
    "تأكيد الحذف",
    "هل أنت متأكد من رغبتك في نقل هذا العميل لسلة المهملات؟",
    () => {
      const idx = clientsDB.findIndex((c) => c.id === id);
      if (idx !== -1) {
        trashDB.push(clientsDB.splice(idx, 1)[0]);
        saveDB();
        renderDashboard();
      }
    },
  );
}

function restoreClient(id) {
  const idx = trashDB.findIndex((c) => c.id === id);
  if (idx !== -1) {
    clientsDB.push(trashDB.splice(idx, 1)[0]);
    saveDB();
    renderDashboard();
    openTrashModal();
  }
}

async function permanentDeleteClient(id) {
  showConfirmModal(
    "حذف نهائي",
    "تحذير: سيتم حذف هذا العميل وجميع ملفاته المرفقة نهائياً من النظام. هل أنت متأكد؟",
    async () => {
      try {
        const res = await fetch("/api/permanent-delete-client", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId: id }),
        });
        const data = await res.json();
        if (data.success) {
          trashDB = trashDB.filter((c) => c.id !== id);
          openTrashModal();
        } else {
          alert("فشل الحذف: " + (data.error || "خطأ غير معروف"));
        }
      } catch (err) {
        console.error("Permanent delete failed:", err);
      }
    },
  );
}

/**
 * ==========================================
 * CLIENT DETAILS UI
 * ==========================================
 */
function openClientPage(id) {
  activeClient = clientsDB.find((c) => c.id === id);
  document.getElementById("dashboard-wrapper").classList.add("page-hidden");
  document.getElementById("client-wrapper").classList.remove("page-hidden");

  updateClientDOM();
}

function updateClientDOM() {
  if (!activeClient) return;
  document.getElementById("clientNameText").innerText = activeClient.name;
  document.getElementById("clientPlotText").innerText =
    "قطعة: " + activeClient.plot;
  document.getElementById("clientPhoneText").innerText =
    activeClient.phone || "لا يوجد";
  document.getElementById("totalContractText").innerText =
    activeClient.totalContract.toLocaleString();

  const payments = activeClient.payments || [];
  const totalPaidFromHistory = payments.reduce(
    (acc, p) => acc + parseFloat(p.amount),
    0,
  );
  const effectivePaid =
    payments.length > 0
      ? totalPaidFromHistory + activeClient.paid
      : activeClient.paid || 0;
  const expenses = (activeClient.expenses || []).reduce(
    (acc, e) => acc + parseFloat(e.amount),
    0,
  );

  document.getElementById("paidAmountText").innerText = (
    effectivePaid - expenses
  ).toLocaleString();

  const totalTips = (activeClient.tips || []).reduce(
    (acc, t) => acc + parseFloat(t.amount),
    0,
  );
  document.getElementById("owedAmountText").innerText =
    totalTips.toLocaleString();

  // رندر الجداول
  renderClientExpenses();
  renderClientTips();
  renderClientPayments();
  renderClientDocuments();
  renderClientPDFs();
  renderReceipts(); // تحديث جدول الإيصالات عند فتح الصفحة
}

function renderClientPayments() {
  const container = document.getElementById("newMoneyToOffice");
  if (!container) return;

  const payments = activeClient.payments || [];
  container.innerHTML = payments.length
    ? payments
        .map(
          (p) => `
        <tr class="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition">
          <td class="p-3 font-bold">${p.receiver || "---"}</td>
          <td class="p-3 text-gray-500 text-xs">${p.date || "---"}</td>
          <td class="p-3 text-green-600 font-bold">+${parseFloat(p.amount).toLocaleString()} ج.م</td>
        </tr>`,
        )
        .join("")
    : `<tr><td colspan="3" class="p-4 text-center text-gray-400">لا توجد مدفوعات مسجلة</td></tr>`;
}

function renderClientExpenses() {
  const expenses = activeClient.expenses || [];
  document.getElementById("expensesTableBody").innerHTML = expenses
    .map(
      (e) => `
        <tr class="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition">
          <td class="p-3 font-bold">${e.reason}</td>
          <td class="p-3 text-gray-500 text-xs">${e.date || "---"}</td>
          <td class="p-3 text-red-500 font-bold">-${e.amount} ج.م</td>
        </tr>`,
    )
    .join("");
}

function renderClientTips() {
  const tips = activeClient.tips || [];
  document.getElementById("tipsTableBody").innerHTML = tips
    .map(
      (t) => `
        <tr class="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition">
          <td class="p-3 font-bold">${t.reason}</td>
          <td class="p-3 text-gray-500 dark:text-gray-400 text-xs">${t.payer}</td>
          <td class="p-3 text-gray-500 text-xs">${t.date || "---"}</td>
          <td class="p-3 text-orange-600 font-bold">+${t.amount} ج.م</td>
        </tr>`,
    )
    .join("");
}

function renderClientDocuments() {
  const docs = activeClient.docs || [];
  document.getElementById("documentsTableBody").innerHTML = docs
    .map(
      (d, i) => `
        <tr class="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition">
          <td class="p-4 font-bold text-brand-primary dark:text-gray-200">${d.person}</td>
          <td class="p-4">${d.name}</td>
          <td class="p-4 text-gray-500 dark:text-gray-400">${d.purpose}</td>
          <td class="p-4 font-bold">${d.place}</td>
          <td class="p-4 text-gray-500 text-xs">${d.date || "---"}</td>
          <td class="p-4">
            <button onclick="editDoc(${i})" class="bg-blue-50 text-blue-600 dark:bg-blue-900/30 px-3 py-1 rounded-lg font-bold hover:bg-blue-100 transition"><i class="fas fa-pen"></i> تعديل</button>
          </td>
        </tr>`,
    )
    .join("");
}

function renderClientPDFs() {
  const pdfs = activeClient.pdfs || [];
  const container = document.getElementById("pdfTableBody");
  if (!container) return;

  container.innerHTML = pdfs.length
    ? pdfs
        .map((p) => {
          if (!p) return "";
          const fileName = p.originalName || "";
          const ext = fileName.split(".").pop().toLowerCase();
          let iconClass = "fa-file-alt text-gray-400";
          if (ext === "pdf") iconClass = "fa-file-pdf text-red-500";
          else if (["jpg", "jpeg", "png"].includes(ext))
            iconClass = "fa-file-image text-blue-500";
          else if (ext === "dwg")
            iconClass = "fa-drafting-compass text-orange-500";

          return `
        <tr class="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition">
          <td class="p-3 font-bold flex items-center gap-3">
            <i class="fas ${iconClass} text-xl w-6 text-center"></i>
            <span>${fileName}</span>
          </td>
          <td class="p-3 text-gray-500 text-xs">${p.date || "---"}</td>
          <td class="p-3 text-center">
            <div class="flex gap-2 justify-center">
              <button onclick="previewUploadedPDF('${p.filename}', '${p.originalName}')" class="bg-blue-50 text-blue-600 dark:bg-blue-900/30 px-3 py-1 rounded-lg font-bold hover:bg-blue-500 hover:text-white transition flex items-center gap-1"><i class="fas fa-eye"></i></button>
              <button onclick="downloadPDF('${p.path}', '${p.originalName}')" class="bg-green-50 text-green-600 dark:bg-green-900/30 px-3 py-1 rounded-lg font-bold hover:bg-green-500 hover:text-white transition flex items-center gap-1"><i class="fas fa-download"></i></button>
              <button onclick="deletePDF('${activeClient.id}', '${p.filename}', 'pdfs')" class="bg-red-50 text-red-600 dark:bg-red-900/30 px-3 py-1 rounded-lg font-bold hover:bg-red-500 hover:text-white transition flex items-center gap-1"><i class="fas fa-trash"></i></button>
            </div>
          </td>
        </tr>`;
        })
        .join("")
    : `<tr><td colspan="3" class="p-6 text-center text-gray-400 font-bold">لا توجد ملفات مرفوعة</td></tr>`;
}

// فانكشن رسم جدول الإيصالات الجديدة
function renderReceipts() {
  const container = document.getElementById("receiptTableBody");
  if (!container || !activeClient) return;

  const receipts = activeClient.receipts || [];

  container.innerHTML = receipts.length
    ? receipts
        .map(
          (r) => `
      <tr class="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition">
        <td class="p-3 font-bold flex items-center gap-3">
          <i class="fas fa-file-invoice-dollar text-green-500 text-xl w-6 text-center"></i>
          <span>${r.originalName || r.filename}</span>
        </td>
        <td class="p-3 text-gray-500 text-xs">${r.date || "---"}</td>
        <td class="p-3 text-center">
          <div class="flex gap-2 justify-center">
            <button onclick="previewUploadedPDF('${r.filename}', '${r.originalName}')" class="bg-blue-50 text-blue-600 p-2 rounded-lg hover:bg-blue-500 hover:text-white transition"><i class="fas fa-eye"></i></button>
            <button onclick="downloadPDF('${r.path}', '${r.originalName}')" class="bg-green-50 text-green-600 p-2 rounded-lg hover:bg-green-500 hover:text-white transition"><i class="fas fa-download"></i></button>
            <button onclick="deletePDF('${activeClient.id}', '${r.filename}', 'receipts')" class="bg-red-50 text-red-600 p-2 rounded-lg hover:bg-red-500 hover:text-white transition"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      </tr>`,
        )
        .join("")
    : `<tr><td colspan="3" class="p-6 text-center text-gray-400 font-bold">لا توجد إيصالات</td></tr>`;
}

/**
 * ==========================================
 * FILE ACTIONS
 * ==========================================
 */
async function handleFileUpload(input, type) {
  const file = input.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("clientId", activeClient.id);
  formData.append("fileType", type);

  try {
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const result = await res.json();

    if (result.success) {
      if (type === "receipts") {
        if (!activeClient.receipts) activeClient.receipts = [];
        activeClient.receipts.push(result.file);
        renderReceipts();
      } else {
        if (!activeClient.pdfs) activeClient.pdfs = [];
        activeClient.pdfs.push(result.file);
        renderClientPDFs();
      }
      // alert("تم الرفع بنجاح");
    }
  } catch (err) {
    console.error(err);
    alert("فشل الرفع");
  } finally {
    input.value = "";
  }
}

async function deletePDF(clientId, filename, type = "pdfs") {
  showConfirmModal(
    "تأكيد الحذف",
    "هل أنت متأكد من حذف هذا الملف؟",
    async () => {
      try {
        const res = await fetch("/api/delete-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId, filename, type }),
        });
        const result = await res.json();
        if (result.success) {
          if (type === "receipts") {
            activeClient.receipts = activeClient.receipts.filter(
              (p) => p.filename !== filename,
            );
            renderReceipts();
          } else {
            activeClient.pdfs = activeClient.pdfs.filter(
              (p) => p.filename !== filename,
            );
            renderClientPDFs();
          }
        }
      } catch (err) {
        console.error(err);
      }
    },
  );
}

function downloadPDF(url, originalName) {
  const link = document.createElement("a");
  link.href = url;
  link.download = originalName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function previewUploadedPDF(filename, title) {
  openPDFPreview(title, filename);
}

async function openPDFPreview(title, dataOrUrl) {
  if (currentPDFAbortController) currentPDFAbortController.abort();
  currentPDFAbortController = new AbortController();
  const signal = currentPDFAbortController.signal;

  document.getElementById("pdfPreviewTitle").innerText = title;
  const container = document.getElementById("pdfViewerContainer");
  container.innerHTML = `<div class="flex flex-col items-center justify-center p-20"><i class="fas fa-circle-notch fa-spin fa-3x text-blue-500 mb-4"></i><p class="text-white">جاري التحميل...</p></div>`;
  document.getElementById("pdfPreviewModal").classList.remove("hidden");

  try {
    const response = await fetch("/api/pdf-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: dataOrUrl }),
      signal: signal,
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);

    const binaryString = window.atob(result.data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++)
      bytes[i] = binaryString.charCodeAt(i);

    container.innerHTML = "";
    if (result.contentType.startsWith("image/")) {
      const blob = new Blob([bytes], { type: result.contentType });
      container.innerHTML = `<img src="${URL.createObjectURL(blob)}" class="max-w-full h-auto rounded-lg">`;
    } else if (result.contentType === "application/pdf") {
      const pdfjsLib = window["pdfjs-dist/build/pdf"];
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement("canvas");
        canvas.className = "mb-4 shadow-lg bg-white";
        const context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport: viewport })
          .promise;
        container.appendChild(canvas);
      }
    } else {
      container.innerHTML = `<div class="text-white text-center p-10"><i class="fas fa-file-download text-5xl mb-4"></i><p>هذا الملف لا يدعم المعاينة، يمكنك تحميله.</p></div>`;
    }
  } catch (err) {
    if (err.name !== "AbortError")
      container.innerHTML = `<div class="text-red-500 p-10">خطأ في التحميل</div>`;
  }
}

function closePDFPreview() {
  if (currentPDFAbortController) currentPDFAbortController.abort();
  document.getElementById("pdfPreviewModal").classList.add("hidden");
}

/**
 * ==========================================
 * TRANSACTIONS & MODALS
 * ==========================================
 */
function addExp() {
  const r = document.getElementById("in1").value;
  const a = parseFloat(document.getElementById("in2").value);
  const d = document.getElementById("inExpDate").value;
  if (r && a) {
    if (!activeClient.expenses) activeClient.expenses = [];
    activeClient.expenses.push({ reason: r, amount: a, date: d });
    saveDB();
    updateClientDOM();
    closeSubModal();
  }
}

function addTip() {
  const r = document.getElementById("in1").value;
  const p = document.getElementById("in2").value;
  const a = parseFloat(document.getElementById("in3").value);
  const d = document.getElementById("inTipDate").value;
  if (r && a) {
    if (!activeClient.tips) activeClient.tips = [];
    activeClient.tips.push({ reason: r, payer: p, amount: a, date: d });
    saveDB();
    updateClientDOM();
    closeSubModal();
  }
}

function addNewMoney() {
  const receiver = document.getElementById("in2").value;
  const amount = parseFloat(document.getElementById("in3").value);
  const date = document.getElementById("inNewMoneyDate").value;
  if (receiver && amount) {
    if (!activeClient.payments) activeClient.payments = [];
    activeClient.payments.push({
      id: Date.now().toString(),
      receiver,
      amount,
      date,
    });
    saveDB();
    updateClientDOM();
    closeSubModal();
  }
}

function addDoc() {
  const p = document.getElementById("in1").value;
  const n = document.getElementById("in2").value;
  const g = document.getElementById("in3").value;
  const l = document.getElementById("in4").value;
  const d = document.getElementById("inDocDate").value;
  if (p && n) {
    if (!activeClient.docs) activeClient.docs = [];
    activeClient.docs.push({
      person: p,
      name: n,
      purpose: g,
      place: l,
      date: d,
    });
    saveDB();
    updateClientDOM();
    closeModals();
  }
}

function showSubModal(type, docIdx = null) {
  const div = document.getElementById("subModalContent");
  if (type === "exp") {
    div.innerHTML = `
      <h3 class="font-black text-2xl mb-6 dark:text-white text-center">إضافة مصروف</h3>
      <div class="space-y-4 mb-6">
        <input id="in1" class="w-full px-4 py-2 rounded-xl border-2 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 dark:text-white" placeholder="البيان" />
        <input id="in2" type="number" class="w-full px-4 py-2 rounded-xl border-2 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 dark:text-white" placeholder="المبلغ" />
        <input id="inExpDate" type="date" class="w-full px-4 py-2 rounded-xl border-2 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 dark:text-white" />
      </div>
      <button onclick="addExp()" class="w-full bg-red-500 text-white py-3 rounded-xl font-black text-lg shadow-lg hover:bg-red-600">تسجيل وحفظ</button>
    `;
    document.getElementById("subModal").firstElementChild.className =
      "bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl w-96 text-right relative border-t-4 border-red-500";
  }
  // الاكراميات
  else if (type === "tip") {
    div.innerHTML = `
      <h3 class="font-black text-2xl mb-6 dark:text-white text-center">إضافة إكرامية</h3>
      <div class="space-y-4 mb-6">
        <input id="in1" class="w-full px-4 py-2 rounded-xl border-2 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 dark:text-white" placeholder="المصلحة" />
        <input id="in2" class="w-full px-4 py-2 rounded-xl border-2 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 dark:text-white" placeholder="من سدد؟" />
        <input id="in3" type="number" class="w-full px-4 py-2 rounded-xl border-2 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 dark:text-white" placeholder="المبلغ" />
        <input id="inTipDate" type="date" class="w-full px-4 py-2 rounded-xl border-2 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 dark:text-white" />
      </div>
      <button onclick="addTip()" class="w-full bg-orange-500 text-white py-3 rounded-xl font-black text-lg shadow-lg hover:bg-orange-600">تسجيل وحفظ</button>
    `;
    document.getElementById("subModal").firstElementChild.className =
      "bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl w-96 text-right relative border-t-4 border-orange-500";
  }
  // اضافه مبلغ جديد من العميل
  else if (type === "newMoney") {
    div.innerHTML = `
      <h3 class="font-black text-2xl mb-6 dark:text-white text-center">إضافة مبلغ جديد</h3>
      <div class="space-y-4 mb-6">
        <input id="in2" class="w-full px-4 py-2 rounded-xl border-2 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 dark:text-white" placeholder="من استلم؟" />
        <input id="in3" type="number" class="w-full px-4 py-2 rounded-xl border-2 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 dark:text-white" placeholder="المبلغ" />
        <input id="inNewMoneyDate" type="date" class="w-full px-4 py-2 rounded-xl border-2 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 dark:text-white" />
      </div>
      <button onclick="addNewMoney()" class="w-full bg-orange-500 text-white py-3 rounded-xl font-black text-lg shadow-lg hover:bg-orange-600">تسجيل وحفظ</button>
    `;
    document.getElementById("subModal").firstElementChild.className =
      "bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl w-96 text-right relative border-t-4 border-orange-500";
  }
  // حركة مستند
  else if (type === "doc") {
    const isEdit = docIdx !== null;
    const doc = isEdit
      ? activeClient.docs[docIdx]
      : { person: "", name: "", purpose: "", place: "", date: "" };

    div.innerHTML = `
      <h3 class="font-black text-2xl mb-6 dark:text-white text-center">${isEdit ? "تعديل مستند" : "حركة مستند"}</h3>
      <div class="space-y-4 mb-6">
        <input id="in1" class="w-full px-4 py-2 rounded-xl border-2 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 dark:text-white" placeholder="المستلم" value="${doc.person}" />
        <input id="in2" class="w-full px-4 py-2 rounded-xl border-2 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 dark:text-white" placeholder="اسم الورقة" value="${doc.name}" />
        <input id="in3" class="w-full px-4 py-2 rounded-xl border-2 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 dark:text-white" placeholder="الغرض" value="${doc.purpose}" />
        <input id="in4" class="w-full px-4 py-2 rounded-xl border-2 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 dark:text-white" placeholder="المكان" value="${doc.place}" />
        <input id="inDocDate" type="date" class="w-full px-4 py-2 rounded-xl border-2 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 dark:text-white" value="${doc.date}" />
      </div>
      <button onclick="${isEdit ? `saveEditDoc(${docIdx})` : "addDoc()"}" class="w-full bg-blue-600 text-white py-3 rounded-xl font-black text-lg shadow-lg hover:bg-blue-700">
        ${isEdit ? "حفظ التعديلات" : "تسجيل وحفظ"}
      </button>
    `;
    document.getElementById("subModal").firstElementChild.className =
      "bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl w-96 text-right relative border-t-4 border-blue-500";
  }
  document.getElementById("subModal").classList.remove("hidden");
}

function closeSubModal() {
  document.getElementById("subModal").classList.add("hidden");
}

function closeModals() {
  document.getElementById("subModal").classList.add("hidden");
  document.getElementById("editValueModal").classList.add("hidden");
  document.getElementById("trashModal").classList.add("hidden");
  document.getElementById("newClientModal").classList.add("hidden");
  closeConfirmModal();
}

function toggleDarkMode() {
  document.documentElement.classList.toggle("dark");
  const icon = document.getElementById("themeIcon");
  if (document.documentElement.classList.contains("dark"))
    icon.classList.replace("fa-moon", "fa-sun");
  else icon.classList.replace("fa-sun", "fa-moon");
}

function toggleNewClientModal() {
  document.getElementById("newClientModal").classList.toggle("hidden");
}

function openTrashModal() {
  const list = document.getElementById("trashList");
  list.innerHTML = trashDB.length
    ? trashDB
        .map(
          (c) => `
        <div class="flex justify-between items-center bg-gray-50 dark:bg-slate-700 p-4 rounded-xl border border-gray-100 dark:border-slate-600 mb-3">
            <span class="font-bold dark:text-white">${c.name} - ${c.plot}</span>
            <div class="flex gap-2">
              <button onclick="restoreClient('${c.id}')" class="text-green-600 bg-green-50 px-4 py-2 rounded-lg font-bold">استعادة</button>
              <button onclick="permanentDeleteClient('${c.id}')" class="text-red-600 bg-red-50 px-4 py-2 rounded-lg font-bold">حذف نهائي</button>
            </div>
        </div>`,
        )
        .join("")
    : "<p class='text-center text-gray-500 py-6'>السلة فارغة</p>";
  document.getElementById("trashModal").classList.remove("hidden");
}

function showConfirmModal(
  title,
  message,
  onConfirm,
  showCancel = true,
  type = "red",
) {
  document.getElementById("confirmTitle").innerText = title;
  document.getElementById("confirmMessage").innerText = message;
  const confirmBtn = document.getElementById("confirmBtn");
  const cancelBtn = confirmBtn.nextElementSibling;
  cancelBtn.style.display = showCancel ? "block" : "none";
  document.getElementById("confirmModal").classList.remove("hidden");
  const newBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
  newBtn.addEventListener("click", () => {
    onConfirm();
    closeConfirmModal();
  });
}

function closeConfirmModal() {
  document.getElementById("confirmModal").classList.add("hidden");
}
