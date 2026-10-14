const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'guru_win_secret_key_8989';
const ADMIN_SECRET = 'guru_admin_pass_2026';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

const users = [];

// होमपेज रूट
app.get('/', (req, res) => {
  const fileLocations = [
    path.join(__dirname, 'index.html'),
    path.join(__dirname, 'public', 'index.html')
  ];
  for (const loc of fileLocations) {
    if (fs.existsSync(loc)) return res.sendFile(loc);
  }
  res.send('<h1>Guru Win Live! index.html upload karein.</h1>');
});

// एडमिन रूट
app.get('/admin.html', (req, res) => {
  const adminLocations = [
    path.join(__dirname, 'admin.html'),
    path.join(__dirname, 'public', 'admin.html')
  ];
  for (const loc of adminLocations) {
    if (fs.existsSync(loc)) return res.sendFile(loc);
  }
  res.send('<h1>admin.html nahi mili!</h1>');
});

// 1. साइनअप API
app.post('/api/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || password.length < 6) {
    return res.status(400).json({ error: 'कम से कम 6 अक्षरों का पासवर्ड डालें।' });
  }
  const exists = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (exists) return res.status(400).json({ error: 'यह खाता पहले से मौजूद है।' });

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = { id: 'u_' + Date.now(), email: email.toLowerCase(), password: hashedPassword, balance: 10000 };
  users.push(newUser);

  const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET);
  res.json({ token, user: { email: newUser.email, balance: newUser.balance } });
});

// 2. लॉगिन API
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(400).json({ error: 'गलत ईमेल या पासवर्ड।' });
  }

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
  res.json({ token, user: { email: user.email, balance: user.balance } });
});

// 3. फ्री रीफिल API
app.post('/api/refill-demo', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'कृपया पहले लॉगिन करें।' });
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = users.find(u => u.id === decoded.id);
    if (!user) return res.status(404).json({ error: 'यूजर नहीं मिला।' });
    user.balance += 5000;
    res.json({ success: true, balance: user.balance });
  } catch (e) {
    res.status(401).json({ error: 'अमान्य टोकन' });
  }
});

// 4. एडमिन APIs
app.get('/api/admin/users', (req, res) => {
  if (req.headers['x-admin-key'] !== ADMIN_SECRET) return res.status(403).json({ error: 'गलत पासवर्ड' });
  res.json({ users: users.map(u => ({ id: u.id, email: u.email, balance: u.balance })) });
});

app.post('/api/admin/update-balance', (req, res) => {
  if (req.headers['x-admin-key'] !== ADMIN_SECRET) return res.status(403).json({ error: 'अनधिकृत' });
  const { userId, amount } = req.body;
  const user = users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'यूजर नहीं मिला' });
  user.balance = Number(amount);
  res.json({ success: true, balance: user.balance });
});

// 5. कलर प्रेडिक्शन इंजन
let colourTimer = 15;
setInterval(() => {
  colourTimer--;
  if (colourTimer <= 0) {
    const result = Math.random() < 0.45 ? 'Green' : (Math.random() < 0.9 ? 'Red' : 'Violet');
    io.emit('colour_round_end', { result });
    colourTimer = 15;
  }
  io.emit('colour_tick', { timer: colourTimer });
}, 1000);

// 6. एविएटर इंजन
let crashTimer = 5;
function runCrashEngine() {
  crashTimer = 5;
  let countdown = setInterval(() => {
    io.emit('crash_waiting', { timer: crashTimer });
    crashTimer--;
    if (crashTimer < 0) {
      clearInterval(countdown);
      startFlight();
    }
  }, 1000);
}

function startFlight() {
  let mult = 1.00;
  const crashPoint = parseFloat((1.1 + Math.random() * 4.5).toFixed(2));
  let flight = setInterval(() => {
    mult = parseFloat((mult + 0.05).toFixed(2));
    io.emit('crash_tick', { multiplier: mult });
    if (mult >= crashPoint) {
      clearInterval(flight);
      io.emit('crash_end', { finalMultiplier: mult });
      setTimeout(runCrashEngine, 3000);
    }
  }, 120);
}
runCrashEngine();

server.listen(PORT, () => {
  console.log(`Guru Win Server Live on port ${PORT}`);
});
