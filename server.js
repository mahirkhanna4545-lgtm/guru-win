// खिलाड़ियों के लिए फ्री डेमो कॉइन रीफिल API
app.post('/api/refill-demo', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'कृपया पहले लॉगिन करें।' });

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = users.find(u => u.id === decoded.id);

    if (!user) return res.status(404).json({ error: 'यूजर नहीं मिला।' });

    // हर क्लिक पर 5,000 फ्री डेमो चिप्स जोड़ें
    user.balance += 5000;
    res.json({ success: true, balance: user.balance, message: '₹5,000 डेमो कॉइन्स जोड़े गए!' });
  } catch (err) {
    res.status(401).json({ error: 'अमान्य टोकन।' });
  }
});
