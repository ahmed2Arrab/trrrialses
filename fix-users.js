const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'index.js');
let content = fs.readFileSync(indexPath, 'utf8');

// Replace the old initializeUsers function with the fixed one
const oldFunc = `function initializeUsers() {
  const usersPath = path.join(__dirname, "data", "db", "delta_users.json");

  const users = DEFAULT_USERS.map((user) => ({
    username: user.username,
    role: user.role,
    name: user.name,
    password: bcrypt.hashSync(user.password, 10),
    createdAt: new Date().toISOString(),
  }));

  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

  console.log("\\n✓ تم تهيئة مستخدمي النظام بكلمات مرور مخصصة");
  users.forEach((u) => {
    console.log(\`   • \${u.username} — \${u.name} — \${u.role}\`);
  });
}`;

const newFunc = `function initializeUsers() {
  const usersPath = path.join(__dirname, "data", "db", "delta_users.json");

  if (fs.existsSync(usersPath)) {
    console.log("\\n✓ Users database already exists");
    return;
  }

  const users = DEFAULT_USERS.map((user) => ({
    username: user.username,
    role: user.role,
    name: user.name,
    password: bcrypt.hashSync(user.password, 10),
    createdAt: new Date().toISOString(),
  }));

  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
  console.log("\\n✓ تم تهيئة مستخدمي النظام");
}`;

if (content.includes('تهيئة مستخدمي النظام بكلمات مرور مخصصة')) {
  // Find and replace the function
  const start = content.indexOf('function initializeUsers()');
  const end = content.indexOf('\nfunction getUsers()');
  
  if (start !== -1 && end !== -1) {
    content = content.substring(0, start) + newFunc + '\n' + content.substring(end);
    fs.writeFileSync(indexPath, content);
    console.log('✅ Fixed successfully!');
  } else {
    console.log('❌ Could not find function boundaries');
  }
} else {
  console.log('✅ Already fixed or different content');
}
