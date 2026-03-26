require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const multer = require('multer');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// ══════════════════════════════════════════════════════════════════
// ⚠️  CONFIGURE YOUR GMAIL BELOW  ⚠️
// ══════════════════════════════════════════════════════════════════
const MAIL_USER = process.env.MAIL_USER || 'brohitchowdary5@gmail.com';
const MAIL_PASS = process.env.MAIL_PASS || 'nifbnpouacvmxuot';

// ══════════════════════════════════════════════════════════════════
// ⚠️  MONGODB CONNECTION STRING  ⚠️
//  Replace with your MongoDB Atlas connection string when deploying
//  OR keep as-is for local MongoDB
// ══════════════════════════════════════════════════════════════════
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smartstay';

// ── Admin Credentials ─────────────────────────────────────────────
const ADMIN_EMAIL = 'bikkinarohitchowdary@gmail.com';
const ADMIN_PASSWORD = 'Rohit@1234';

// ── Mailer ────────────────────────────────────────────────────────
const mailer = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: MAIL_USER,
    pass: MAIL_PASS
  }
});
function sendMail(to, subject, html, attachments = []) {
  mailer.sendMail({ from: `"Smart Stay" <${MAIL_USER}>`, to, subject, html, attachments }, err => {
    if (err) console.error('❌ Mail error:', err.message);
    else console.log(`📧 Email sent to ${to}`);
  });
}

// ── Middleware ────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── MongoDB Connection ────────────────────────────────────────────
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    seedAdmin();
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    console.log('👉 Make sure MongoDB is running: mongod');
    process.exit(1);
  });

// ── Session (stored in MongoDB) ───────────────────────────────────
app.use(session({
  secret: 'smartstay_secret_2024_hostel',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGO_URI, ttl: 3600 }),
  cookie: { secure: false, maxAge: 60 * 60 * 1000 }
}));

// ── File Uploads ──────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(Object.assign(new Error('Only images allowed'), { code: 'INVALID_TYPE' }));
  }
});

// ════════════════════════════════════════════════════════════════════
// MONGODB SCHEMAS
// ════════════════════════════════════════════════════════════════════

const userSchema = new mongoose.Schema({
  _id: { type: String, default: () => uuidv4() },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password_hash: { type: String, required: true },
  room: { type: String, default: '' },
  block: { type: String, default: '' },
  phone: { type: String, default: '' },
  otp: { type: String, default: null },
  otp_expires: { type: Number, default: null },
  role: { type: String, default: 'student', enum: ['student', 'admin'] },
  created_at: { type: Number, default: () => Math.floor(Date.now() / 1000) }
});
const User = mongoose.model('User', userSchema);

const serviceSchema = new mongoose.Schema({
  _id: { type: String, default: () => uuidv4() },
  user_id: { type: String, required: true },
  category: { type: String, required: true },
  description: { type: String, default: '' },
  status: { type: String, default: 'Pending' },
  priority: { type: String, default: 'Normal' },
  block: { type: String, default: '' },
  room: { type: String, default: '' },
  created_at: { type: Number, default: () => Math.floor(Date.now() / 1000) },
  updated_at: { type: Number, default: () => Math.floor(Date.now() / 1000) }
});
const ServiceRequest = mongoose.model('ServiceRequest', serviceSchema);

const bookingSchema = new mongoose.Schema({
  _id: { type: String, default: () => uuidv4() },
  user_id: { type: String, required: true },
  facility: { type: String, required: true },
  date: { type: String, required: true },
  time_slot: { type: String, required: true },
  status: { type: String, default: 'Confirmed' },
  created_at: { type: Number, default: () => Math.floor(Date.now() / 1000) }
});
const Booking = mongoose.model('Booking', bookingSchema);

const lostFoundSchema = new mongoose.Schema({
  _id: { type: String, default: () => uuidv4() },
  user_id: { type: String, required: true },
  type: { type: String, required: true, enum: ['Lost', 'Found'] },
  item_name: { type: String, required: true },
  description: { type: String, default: '' },
  location: { type: String, default: '' },
  image_path: { type: String, default: null },
  status: { type: String, default: 'Open' },
  matched_id: { type: String, default: null },
  created_at: { type: Number, default: () => Math.floor(Date.now() / 1000) }
});
const LostFound = mongoose.model('LostFound', lostFoundSchema);

// ── Seed Admin ────────────────────────────────────────────────────
async function seedAdmin() {
  try {
    const existing = await User.findOne({ email: ADMIN_EMAIL });
    if (!existing) {
      const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await User.create({
        _id: uuidv4(),
        name: 'Admin',
        email: ADMIN_EMAIL,
        password_hash: hash,
        role: 'admin'
      });
      console.log(`✅ Admin seeded: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
    } else {
      console.log(`✅ Admin exists: ${ADMIN_EMAIL}`);
    }
  } catch (err) {
    console.error('Admin seed error:', err.message);
  }
}

// ── Helpers ───────────────────────────────────────────────────────
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();
const validatePassword = p => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_\-+=])[A-Za-z\d@$!%*?&#^()_\-+=]{8,}$/.test(p);
const requireAuth = (req, res, next) => {
  if (req.session?.userId && req.session?.verified) return next();
  res.status(401).json({ error: 'Please log in first.' });
};

// ════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ════════════════════════════════════════════════════════════════════

// REGISTER
app.post('/api/register', async (req, res) => {
  const { name, email, password, room, block, phone } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Name, email and password are required.' });
  if (!validatePassword(password))
    return res.status(400).json({ error: 'Password: min 8 chars, uppercase, lowercase, number, special character.' });
  try {
    const hash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password_hash: hash,
      room: room || '',
      block: block || '',
      phone: phone || ''
    });

    // Send registration confirmation email
    sendMail(
      user.email,
      'Welcome to Smart Stay — Registration Successful 🏨',
      `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;background:#f9f9f9;border-radius:10px;overflow:hidden;border:1px solid #ddd">
        <div style="background:linear-gradient(135deg,#c44b1a,#e8960a);padding:24px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:1.6rem">🏨 Smart Stay</h1>
          <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:0.9rem">Hostel Management System</p>
        </div>
        <div style="padding:28px">
          <h2 style="color:#333;margin-top:0">Welcome, ${user.name}! 🎉</h2>
          <p style="color:#555">Your Smart Stay account has been created successfully.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr style="background:#fff3e0"><td style="padding:10px 14px;font-weight:700;color:#c44b1a;border:1px solid #ffe0b2;width:35%">Full Name</td><td style="padding:10px 14px;border:1px solid #ffe0b2;color:#333">${user.name}</td></tr>
            <tr><td style="padding:10px 14px;font-weight:700;color:#c44b1a;border:1px solid #ffe0b2">Email</td><td style="padding:10px 14px;border:1px solid #ffe0b2;color:#333">${user.email}</td></tr>
            <tr style="background:#fff3e0"><td style="padding:10px 14px;font-weight:700;color:#c44b1a;border:1px solid #ffe0b2">Block</td><td style="padding:10px 14px;border:1px solid #ffe0b2;color:#333">${block || '—'}</td></tr>
            <tr><td style="padding:10px 14px;font-weight:700;color:#c44b1a;border:1px solid #ffe0b2">Room</td><td style="padding:10px 14px;border:1px solid #ffe0b2;color:#333">${room || '—'}</td></tr>
            <tr style="background:#fff3e0"><td style="padding:10px 14px;font-weight:700;color:#c44b1a;border:1px solid #ffe0b2">Phone</td><td style="padding:10px 14px;border:1px solid #ffe0b2;color:#333">${phone || '—'}</td></tr>
          </table>
          <div style="margin-top:20px;padding:14px;background:#e8f5e9;border-radius:8px;border-left:4px solid #4caf50">
            <p style="margin:0;color:#2e7d32;font-weight:600">✅ You can now log in to your hostel portal.</p>
          </div>
        </div>
      </div>`
    );

    res.json({ success: true, message: 'Account created! A confirmation email has been sent. Please login.' });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Email already registered.' });
    console.error(err);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

// LOGIN
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });
  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(401).json({ error: 'Invalid email or password.' });
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid email or password.' });

    // ADMIN BYPASS OTP — direct login
    if (user.role === 'admin') {
      req.session.userId = user._id;
      req.session.userName = user.name;
      req.session.userRole = user.role;
      req.session.verified = true;
      return res.json({ success: true, name: user.name, role: user.role, message: 'Admin login successful' });
    }

    // NORMAL USER → OTP FLOW
    const otp = generateOTP();
    const expires = Date.now() + 5 * 60 * 1000;
    await User.findByIdAndUpdate(user._id, { otp, otp_expires: expires });
    req.session.pendingUserId = user._id.toString();

    sendMail(
      user.email,
      'Your Smart Stay Login OTP 🔐',
      `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;background:#f9f9f9;border-radius:10px;overflow:hidden;border:1px solid #ddd">
        <div style="background:linear-gradient(135deg,#020c02,#0a3a0a);padding:24px;text-align:center">
          <h1 style="color:#00ff41;margin:0;font-family:monospace;font-size:1.4rem">🔐 SMART STAY AUTH</h1>
        </div>
        <div style="padding:28px;text-align:center">
          <p style="color:#555;margin-bottom:8px">Your One-Time Password (OTP) is:</p>
          <div style="font-size:2.8rem;font-weight:900;color:#c44b1a;letter-spacing:12px;font-family:monospace;background:#fff3e0;padding:18px;border-radius:10px;border:2px dashed #e8960a;margin:16px 0">${otp}</div>
          <p style="color:#888;font-size:0.82rem">⏱ Valid for <strong>5 minutes</strong> only. Do not share this OTP.</p>
        </div>
      </div>`
    );

    console.log(`\n🔐 OTP for ${user.email}: ${otp}\n`);
    res.json({ success: true, message: 'OTP sent to your registered email! Check your inbox.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login error.' });
  }
});

// VERIFY OTP
app.post('/api/verify-otp', async (req, res) => {
  const { otp } = req.body;
  if (!req.session.pendingUserId) return res.status(400).json({ error: 'No pending login.' });
  try {
    const user = await User.findById(req.session.pendingUserId);
    if (!user) return res.status(500).json({ error: 'Session error.' });
    if (!user.otp || user.otp !== otp.toString()) return res.status(401).json({ error: 'Invalid OTP.' });
    if (Date.now() > user.otp_expires) return res.status(401).json({ error: 'OTP expired. Login again.' });
    await User.findByIdAndUpdate(user._id, { otp: null, otp_expires: null });
    req.session.userId = user._id.toString();
    req.session.userName = user.name;
    req.session.userRole = user.role;
    req.session.verified = true;
    delete req.session.pendingUserId;
    res.json({ success: true, name: user.name, role: user.role });
  } catch (err) {
    res.status(500).json({ error: 'OTP verification error.' });
  }
});

app.post('/api/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });

app.get('/api/session', (req, res) => {
  if (req.session?.userId && req.session?.verified)
    res.json({ loggedIn: true, name: req.session.userName, role: req.session.userRole, userId: req.session.userId });
  else res.json({ loggedIn: false });
});

app.get('/api/profile', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).select('-password_hash -otp -otp_expires');
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: { id: user._id, name: user.name, email: user.email, room: user.room, block: user.block, phone: user.phone, role: user.role, created_at: user.created_at } });
  } catch (err) { res.status(500).json({ error: 'Error fetching profile.' }); }
});

// ════════════════════════════════════════════════════════════════════
// SERVICE REQUESTS
// ════════════════════════════════════════════════════════════════════

app.post('/api/services', requireAuth, async (req, res) => {
  const { category, description, priority } = req.body;
  if (!category) return res.status(400).json({ error: 'Category required.' });
  try {
    const user = await User.findById(req.session.userId);
    const svc = await ServiceRequest.create({
      user_id: req.session.userId,
      category,
      description: description || '',
      priority: priority || 'Normal',
      block: user?.block || '',
      room: user?.room || ''
    });

    if (user?.email) {
      sendMail(user.email, 'Service Request Received — Smart Stay 🔧',
        `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;background:#f9f9f9;border-radius:10px;overflow:hidden;border:1px solid #ddd">
          <div style="background:linear-gradient(135deg,#c44b1a,#e8960a);padding:20px 24px">
            <h2 style="color:#fff;margin:0">🔧 Service Request Received</h2>
          </div>
          <div style="padding:24px">
            <p style="color:#555">Hi <strong>${user.name}</strong>, your service request has been received.</p>
            <table style="width:100%;border-collapse:collapse;margin:14px 0">
              <tr style="background:#fff3e0"><td style="padding:9px 14px;font-weight:700;color:#c44b1a;border:1px solid #ffe0b2;width:35%">Category</td><td style="padding:9px 14px;border:1px solid #ffe0b2;color:#333">${category}</td></tr>
              <tr><td style="padding:9px 14px;font-weight:700;color:#c44b1a;border:1px solid #ffe0b2">Priority</td><td style="padding:9px 14px;border:1px solid #ffe0b2;color:#333">${priority || 'Normal'}</td></tr>
              <tr style="background:#fff3e0"><td style="padding:9px 14px;font-weight:700;color:#c44b1a;border:1px solid #ffe0b2">Description</td><td style="padding:9px 14px;border:1px solid #ffe0b2;color:#333">${description || '—'}</td></tr>
              <tr><td style="padding:9px 14px;font-weight:700;color:#c44b1a;border:1px solid #ffe0b2">Status</td><td style="padding:9px 14px;border:1px solid #ffe0b2;color:#e8960a;font-weight:700">Pending</td></tr>
            </table>
          </div>
        </div>`
      );
    }
    res.json({ success: true, message: 'Service request submitted! Confirmation email sent.', id: svc._id });
  } catch (err) { res.status(500).json({ error: 'Failed to submit.' }); }
});

app.get('/api/services', requireAuth, async (req, res) => {
  try {
    const isAdmin = req.session.userRole === 'admin';
    let requests;
    if (isAdmin) {
      const svcs = await ServiceRequest.find().sort({ created_at: -1 }).lean();
      const userIds = [...new Set(svcs.map(s => s.user_id))];
      const users = await User.find({ _id: { $in: userIds } }).lean();
      const userMap = {};
      users.forEach(u => { userMap[u._id] = u; });
      requests = svcs.map(s => ({ ...s, id: s._id, user_name: userMap[s.user_id]?.name || '—', user_email: userMap[s.user_id]?.email || '' }));
    } else {
      const svcs = await ServiceRequest.find({ user_id: req.session.userId }).sort({ created_at: -1 }).lean();
      requests = svcs.map(s => ({ ...s, id: s._id }));
    }
    res.json({ requests });
  } catch (err) { res.status(500).json({ error: 'DB error.' }); }
});

app.patch('/api/services/:id', requireAuth, async (req, res) => {
  if (req.session.userRole !== 'admin') return res.status(403).json({ error: 'Admin only.' });
  const { status } = req.body;
  try {
    await ServiceRequest.findByIdAndUpdate(req.params.id, { status, updated_at: Math.floor(Date.now() / 1000) });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Update failed.' }); }
});

// ════════════════════════════════════════════════════════════════════
// FACILITY BOOKINGS
// ════════════════════════════════════════════════════════════════════

app.post('/api/bookings', requireAuth, async (req, res) => {
  const { facility, date, time_slot } = req.body;
  if (!facility || !date || !time_slot) return res.status(400).json({ error: 'All fields required.' });
  try {
    const existing = await Booking.findOne({ facility, date, time_slot, status: 'Confirmed' });
    if (existing) return res.status(409).json({ error: 'This slot is already booked. Choose another time.' });

    const booking = await Booking.create({ user_id: req.session.userId, facility, date, time_slot });

    const user = await User.findById(req.session.userId);
    if (user?.email) {
      sendMail(user.email, `Facility Booking Confirmed — ${facility} 🏋️`,
        `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;background:#f9f9f9;border-radius:10px;overflow:hidden;border:1px solid #ddd">
          <div style="background:linear-gradient(135deg,#1a6b3a,#2e9e5a);padding:20px 24px">
            <h2 style="color:#fff;margin:0">🏋️ Facility Booking Confirmed!</h2>
          </div>
          <div style="padding:24px">
            <p style="color:#555">Hi <strong>${user.name}</strong>, your booking is confirmed.</p>
            <table style="width:100%;border-collapse:collapse;margin:14px 0">
              <tr style="background:#e8f5e9"><td style="padding:9px 14px;font-weight:700;color:#2e7d32;border:1px solid #c8e6c9;width:35%">Facility</td><td style="padding:9px 14px;border:1px solid #c8e6c9;color:#333">${facility}</td></tr>
              <tr><td style="padding:9px 14px;font-weight:700;color:#2e7d32;border:1px solid #c8e6c9">Date</td><td style="padding:9px 14px;border:1px solid #c8e6c9;color:#333">${date}</td></tr>
              <tr style="background:#e8f5e9"><td style="padding:9px 14px;font-weight:700;color:#2e7d32;border:1px solid #c8e6c9">Time Slot</td><td style="padding:9px 14px;border:1px solid #c8e6c9;color:#333">${time_slot}</td></tr>
              <tr><td style="padding:9px 14px;font-weight:700;color:#2e7d32;border:1px solid #c8e6c9">Status</td><td style="padding:9px 14px;border:1px solid #c8e6c9;color:#4caf50;font-weight:700">✅ Confirmed</td></tr>
            </table>
          </div>
        </div>`
      );
    }
    res.json({ success: true, message: `${facility} booked for ${date} at ${time_slot}! Confirmation sent.`, id: booking._id });
  } catch (err) { res.status(500).json({ error: 'Booking failed.' }); }
});

app.get('/api/bookings', requireAuth, async (req, res) => {
  try {
    const isAdmin = req.session.userRole === 'admin';
    let bookings;
    if (isAdmin) {
      const bks = await Booking.find().sort({ date: -1 }).lean();
      const userIds = [...new Set(bks.map(b => b.user_id))];
      const users = await User.find({ _id: { $in: userIds } }).lean();
      const userMap = {};
      users.forEach(u => { userMap[u._id] = u; });
      bookings = bks.map(b => ({ ...b, id: b._id, user_name: userMap[b.user_id]?.name || '—' }));
    } else {
      const bks = await Booking.find({ user_id: req.session.userId }).sort({ date: -1 }).lean();
      bookings = bks.map(b => ({ ...b, id: b._id }));
    }
    res.json({ bookings });
  } catch (err) { res.status(500).json({ error: 'DB error.' }); }
});

app.delete('/api/bookings/:id', requireAuth, async (req, res) => {
  try {
    if (req.session.userRole === 'admin') {
      await Booking.findByIdAndDelete(req.params.id);
    } else {
      await Booking.findOneAndDelete({ _id: req.params.id, user_id: req.session.userId });
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Delete failed.' }); }
});

// ════════════════════════════════════════════════════════════════════
// LOST & FOUND
// ════════════════════════════════════════════════════════════════════

app.post('/api/lost-found', requireAuth, (req, res) => {
  upload.single('image')(req, res, async err => {
    if (err) return res.status(400).json({ error: err.message });
    const { type, item_name, description, location } = req.body;
    if (!type || !item_name) return res.status(400).json({ error: 'Type and item name required.' });
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
    try {
      const item = await LostFound.create({
        user_id: req.session.userId,
        type,
        item_name,
        description: description || '',
        location: location || '',
        image_path: imagePath
      });

      const user = await User.findById(req.session.userId);
      if (user?.email) {
        const isLost = type === 'Lost';
        const attachments = req.file ? [{ filename: req.file.originalname, path: req.file.path }] : [];
        sendMail(
          user.email,
          isLost ? `Lost Item Report Submitted — "${item_name}" 🔍` : `Found Item Report Submitted — "${item_name}" 📦`,
          `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;background:#f9f9f9;border-radius:10px;overflow:hidden;border:1px solid #ddd">
            <div style="background:${isLost ? 'linear-gradient(135deg,#c44b1a,#8b1a1a)' : 'linear-gradient(135deg,#1a6b3a,#2e7d32)'};padding:20px 24px">
              <h2 style="color:#fff;margin:0">${isLost ? '🔍 Lost Item Report Submitted' : '📦 Found Item Report Submitted'}</h2>
            </div>
            <div style="padding:24px">
              <p style="color:#555">Hi <strong>${user.name}</strong>,</p>
              <p style="color:#555">${isLost ? 'Your lost item report has been submitted.' : 'Thank you for reporting a found item!'}</p>
              <table style="width:100%;border-collapse:collapse;margin:14px 0">
                <tr><td style="padding:9px 14px;font-weight:700;border:1px solid #ccc">Type</td><td style="padding:9px 14px;border:1px solid #ccc">${type}</td></tr>
                <tr><td style="padding:9px 14px;font-weight:700;border:1px solid #ccc">Item</td><td style="padding:9px 14px;border:1px solid #ccc">${item_name}</td></tr>
                <tr><td style="padding:9px 14px;font-weight:700;border:1px solid #ccc">Location</td><td style="padding:9px 14px;border:1px solid #ccc">${location || '—'}</td></tr>
                <tr><td style="padding:9px 14px;font-weight:700;border:1px solid #ccc">Description</td><td style="padding:9px 14px;border:1px solid #ccc">${description || '—'}</td></tr>
              </table>
              <p style="color:#888;font-size:0.82rem">${isLost ? 'We will help you find it.' : 'Thank you for your honesty!'}</p>
            </div>
          </div>`,
          attachments
        );
      }

      res.json({ success: true, message: 'Report posted! Confirmation email sent.', id: item._id });
    } catch (err) { res.status(500).json({ error: 'Failed to post.' }); }
  });
});

app.get('/api/lost-found', requireAuth, async (req, res) => {
  try {
    const items = await LostFound.find().sort({ created_at: -1 }).lean();
    const userIds = [...new Set(items.map(i => i.user_id))];
    const users = await User.find({ _id: { $in: userIds } }).lean();
    const userMap = {};
    users.forEach(u => { userMap[u._id] = u; });
    const result = items.map(i => ({
      ...i, id: i._id,
      user_name: userMap[i.user_id]?.name || '—',
      user_phone: userMap[i.user_id]?.phone || '',
      user_owner_id: i.user_id
    }));
    res.json({ items: result });
  } catch (err) { res.status(500).json({ error: 'DB error.' }); }
});

app.patch('/api/lost-found/:id', requireAuth, async (req, res) => {
  const { status } = req.body;
  try {
    if (req.session.userRole === 'admin') {
      await LostFound.findByIdAndUpdate(req.params.id, { status });
    } else {
      await LostFound.findOneAndUpdate({ _id: req.params.id, user_id: req.session.userId }, { status });
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Update failed.' }); }
});

// ════════════════════════════════════════════════════════════════════
// ADMIN STATS
// ════════════════════════════════════════════════════════════════════

app.get('/api/admin/stats', requireAuth, async (req, res) => {
  if (req.session.userRole !== 'admin') return res.status(403).json({ error: 'Admin only.' });
  try {
    const [students, totalRequests, pendingRequests, totalBookings, openLostFound] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      ServiceRequest.countDocuments(),
      ServiceRequest.countDocuments({ status: 'Pending' }),
      Booking.countDocuments(),
      LostFound.countDocuments({ status: 'Open' })
    ]);
    res.json({ stats: { students, totalRequests, pendingRequests, totalBookings, openLostFound } });
  } catch (err) { res.status(500).json({ error: 'Stats error.' }); }
});

// ── Auto-open browser & Start ─────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🏨 Smart Stay running at http://localhost:${PORT}`);
  console.log(`👤 Admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`📧 Mail: ${MAIL_USER}`);
  console.log(`🍃 MongoDB: ${MONGO_URI}\n`);

  const { exec } = require('child_process');
  const url = `http://localhost:${PORT}`;
  const cmd = process.platform === 'win32' ? `start ${url}`
    : process.platform === 'darwin' ? `open ${url}`
    : `xdg-open ${url}`;
  exec(cmd, err => { if (err) console.log(`Open browser manually: ${url}`); });
});
