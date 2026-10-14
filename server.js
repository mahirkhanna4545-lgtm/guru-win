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

// डेटाबेस (वर्चुअल मेमोरी)
const users = [];

// रूट पर सीधे index.html दिखाना
app.get('/', (req, res) => {
  const publicPath = path.join(__dirname, 'public', 'index.html');
  const rootPath = path.join(__dirname, 'index.html');
  if (fs.existsSync(publicPath)) {
    res.sendFile(publicPath);
  } else if (fs.existsSync(rootPath)) {
    res.sendFile(rootPath);
  } else {
    res.send('index.html file not found!');
  }
});

// एडमिन पेज रूट
app.get('/admin.html', (req, res) => {
  const publicAdmin = path.join(__dirname, 'public', 'admin.html');
  const rootAdmin = path.join(__dirname, 'admin.html');
  if (fs.existsSync(publicAdmin)) {
    res.sendFile(publicAdmin);
  } else if (fs.existsSync(rootAdmin)) {
    res.sendFile(rootAdmin);
  } else {
    res.send('admin.html file not found!');
  }
});

// 1. साइनअप API
app.post('/api/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || password.length < 6) {
    return res.status(400).json({ error: 'कम से कम 6 अक्षरों का पासवर्ड डालें।' });
  }
  const exists = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (exists) return res.status(400).json({ error: 'यह ईमेल पहले से मौजूद है।' });

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = { id: 'user_' + Date.now(), email: email.toLowerCase(), password: hashedPassword, balance: 10000 };
  users.push(newUser);

  const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET);
  res.json({ token, user: { email: newUser.email, balance: newUser.balance } });
});

// 2. लॉगिन API
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return res.status(400).json({ error: 'यूजर नहीं मिला।' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).json({ error: 'गलत पासवर्ड।' });

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
  res.json({ token, user: { email: user.email, balance: user.balance } });
});

// 3. फ्री डेमो रीफिल API (+5,000 कॉइन्स)
app.post('/api/refill-demo', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'कृपया पहले लॉगिन करें।' });

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = users.find(u => u.id === decoded.id);

    if (!user) return res.status(404).json({ error: 'यूजर नहीं मिला।' });

    user.balance += 5000;
    res.json({ success: true, balance: user.balance, message: '₹5,000 डेमो कॉइन्स जोड़े गए!' });
  } catch (err) {
    res.status(401).json({ error: 'अमान्य टोकन।' });
  }
});

// 4. एडमिन API - यूजर लिस्ट देखना
app.get('/api/admin/users', (req, res) => {
  if (req.headers['x-admin-key'] !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'गलत एडमिन पासवर्ड!' });
  }
  res.json({ users: users.map(u => ({ id: u.id, email: u.email, balance: u.balance })) });
});

// 5. एडमिन API - यूजर बैलेंस अपडेट / रीसेट करना
app.post('/api/admin/update-balance', (req, res) => {
  if (req.headers['x-admin-key'] !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'अनधिकृत एक्सेस!' });
  }
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

// गेम इंजन - क्रैश / एविएटर
let crashState = { status: 'waiting', multiplier: 1.00, crashPoint: 0 };
let crashTimer = 5;

function runCrashEngine() {
  crashState.status = 'waiting';
  crashTimer = 5;
  let countdown = setInterval(() => {
    io.emit('crash_waiting', { timer: crashTimer });
    crashTimer--;
    if (crashTimer < 0) {
      clearInterval(countdown);
      startCrashFlight();
    }
  }, 1000);
}

function startCrashFlight() {
  crashState.status = 'running';
  crashState.multiplier = 1.00;
  crashState.crashPoint = parseFloat((1.1 + Math.random() * 4.5).toFixed(2));

  let flightInterval = setInterval(() => {
    crashState.multiplier = parseFloat((crashState.multiplier + 0.05).toFixed(2));
    io.emit('crash_tick', { multiplier: crashState.multiplier });

    if (crashState.multiplier >= crashState.crashPoint) {
      clearInterval(flightInterval);
      crashState.status = 'crashed';
      io.emit('crash_end', { finalMultiplier: crashState.multiplier });
      setTimeout(runCrashEngine, 3000);
    }
  }, 120);
}

runCrashEngine();

// ऑनलाइन प्लेयर ट्रैकिंग
let onlineUsers = 0;
io.on('connection', (socket) => {
  onlineUsers++;
  io.emit('online_count', onlineUsers);
  socket.on('disconnect', () => {
    onlineUsers = Math.max(0, onlineUsers - 1);
    io.emit('online_count', onlineUsers);
  });
});

server.listen(PORT, () => {
  console.log(`Guru Win Server running on port ${PORT}`);
});
