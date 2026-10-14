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

// स्टैटिक फोल्डर्स
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// मुख्य पेज (index.html ढूंढना)
app.get('/', (req, res) => {
  const fileLocations = [
    path.join(__dirname, 'index.html'),
    path.join(__dirname, 'public', 'index.html'),
    path.join(process.cwd(), 'index.html'),
    path.join(process.cwd(), 'public', 'index.html')
  ];

  for (const loc of fileLocations) {
    if (fs.existsSync(loc)) {
      return res.sendFile(loc);
    }
  }
  res.send('<h1>Guru Win Server Live hai! Par index.html nahi mili. GitHub check karein.</h1>');
});

// एडमिन पेज
app.get('/admin.html', (req, res) => {
  const adminLocations = [
    path.join(__dirname, 'admin.html'),
    path.join(__dirname, 'public', 'admin.html'),
    path.join(process.cwd(), 'admin.html'),
    path.join(process.cwd(), 'public', 'admin.html')
  ];

  for (const loc of adminLocations) {
    if (fs.existsSync(loc)) {
      return res.sendFile(loc);
    }
  }
  res.send('<h1>Admin file nahi mili!</h1>');
});

// डेटाबेस
const users = [];

// 1. साइनअप
app.post('/api/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || password.length < 6) return res.status(400).json({ error: 'कम से कम 6 अक्षरों का पासवर्ड डालें।' });
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) return res.status(400).json({ error: 'ईमेल पहले से मौजूद है।' });

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = { id: 'u_' + Date.now(), email: email.toLowerCase(), password: hashedPassword, balance: 10000 };
  users.push(newUser);

  const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET);
  res.json({ token, user: { email: newUser.email, balance: newUser.balance } });
});

// 2. लॉगिन
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ error: 'ईमेल या पासवर्ड गलत है।' });

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
  res.json({ token, user: { email: user.email, balance: user.balance } });
});

// 3. फ्री रीफिल
app.post('/api/refill-demo', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'पहले लॉगिन करें।' });
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = users.find(u => u.id === decoded.id);
    if (!user) return res.status(404).json({ error: 'यूजर नहीं मिला।' });
    user.balance += 5000;
    res.json({ success: true, balance: user.balance });
  } catch (e) {
    res.status(401).json({ error: 'टोकन अमान्य है।' });
  }
});

// 4. एडमिन API
app.get('/api/admin/users', (req, res) => {
  if (req.headers['x-admin-key'] !== ADMIN_SECRET) return res.status(403).json({ error: 'गलत पासवर्ड!' });
  res.json({ users: users.map(u => ({ id: u.id, email: u.email, balance: u.balance })) });
});

app.post('/api/admin/update-balance', (req, res) => {
  if (req.headers['x-admin-key'] !== ADMIN_SECRET) return res.status(403).json({ error: 'अनधिकृत!' });
  const { userId, amount } = req.body;
  const user = users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'यूजर नहीं मिला' });
  user.balance = Number(amount);
  res.json({ success: true, balance: user.balance });
});

// गेम इंजन - कलर प्रेडिक्शन
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

// गेम इंजन - एविएटर
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
