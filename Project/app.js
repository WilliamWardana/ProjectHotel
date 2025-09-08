import express from 'express';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import session from 'express-session';
import bodyParser from 'body-parser';
import ejs from 'ejs';
import expressLayouts from 'express-ejs-layouts';
import path from 'path';
import { title } from 'process';
import multer from 'multer';

const app = express();
const __dirname = path.resolve();
const port = 3000;
const upload = multer({ dest: "uploads/" });


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(expressLayouts);
app.set('layout', 'layout/main-layout');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'secretKey',
    resave: false,
    saveUninitialized: false
}));

const db = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'project_hotel',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const userInfo = await db.execute("SELECT * FROM users");

function isLoggedIn(req, res, next) {
    if (req.session.user) return next();
    res.send("Silakan login dulu!");
}

function checkRole(role) {
    return (req, res, next) => {
        if (req.session.user && req.session.user.role === role) {
            return next();
        }
        res.status(403).send("Akses ditolak!");
    };
}

function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString("id-ID", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

app.get('/', (req, res) => {
    res.redirect('/login');
});

app.get('/login', (req, res) => {
    res.render('login', { title: 'Login Page', pageClass: 'login-page' });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    const [rows] = await db.execute("SELECT * FROM users WHERE username=?", [username]);
    if (rows.length === 0) return res.render('login', { error: 'Cek Kembali Username Anda', title: 'Login Page | Error', pageClass: 'login-page' });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.render('login', { error: 'Cek Kembali Password Anda', title: 'Login Page | Error', pageClass: 'login-page' });

    if (user.role == 'admin') {
        req.session.user = { id: user.id, username: user.username, role: user.role };
        res.redirect('/data_user');
    } else if (user.role == 'staff') {
        req.session.user = { id: user.id, username: user.username, role: user.role };
        res.redirect('/staff');
    } else {
        req.session.user = { id: user.id, username: user.username, role: user.role };
        res.redirect('/dashboard');
    }
});

app.get('/data_user', isLoggedIn, async (req, res) => {
    try {
        const [users] = await db.execute("SELECT * FROM users");
        
        res.render('users/data_user', {
            title: 'Admin Page',
            userData: users,
            pageClass: 'admin-page',
            user: req.session.user,
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Terjadi kesalahan server");
    }
});

app.get('/data_user/add_user', isLoggedIn, checkRole('admin'), (req, res) => {
    res.render('users/add_user', {
        title: 'Add User Page',
        pageClass: 'add-user-page',
        user: req.session.user,
        });
});

app.post('/data_user/add_user', isLoggedIn, checkRole('admin'), async (req, res) => {
    const { username, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        await db.execute('INSERT INTO users (username, password, role) VALUES (?, ?, ?)',[username, hashedPassword, role]);
        res.redirect('/data_user');
    } catch (err) {
        console.error(err);
        res.status(500).send("Terjadi kesalahan server");
    }
});

app.get('/data_user/edit_user/:id', isLoggedIn, checkRole('admin'), async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM users WHERE id = ?',
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).send('User tidak ditemukan');
    }

    res.render('users/edit_user', {
      title: 'Edit User Page',
      user: rows[0],
      pageClass: 'edit-user-page',
      user: req.session.user,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Terjadi kesalahan server');
  }
});

app.post('/data_user/edit_user/:id', isLoggedIn, checkRole('admin'), async (req, res) => {
    const { username, password, role } = req.body;
    const { id } = req.params;
    const hashedPassword = await bcrypt.hash(password, 10);

    if (!password) {
        try {
            await db.execute(
                'UPDATE users SET username=?, role=? WHERE id=?',
                [username, role, id]
            );
            res.redirect('/data_user');
        } catch (err) {
            console.error(err);
            res.status(500).send("Terjadi kesalahan server");
        }
    } else {
        try {
            await db.execute(
                'UPDATE users SET username=?, password=?, role=? WHERE id=?',
                [username, hashedPassword, role, id]
            );
            res.redirect('/data_user');
        } catch (err) {
            console.error(err);
            res.status(500).send("Terjadi kesalahan server");
        }
    }
});

app.get('/data_user/delete_user/:id', isLoggedIn, checkRole('admin'), async (req, res) => {
    const { id } = req.params;

    try {
        await db.execute('DELETE FROM users WHERE id=?', [id]);
        res.redirect('/data_user');
    } catch (err) {
        console.error(err);
        res.status(500).send("Terjadi kesalahan server");
    }
});

app.get('/data_kamar', isLoggedIn, checkRole('admin'), async (req, res) => {
    const [kamar] = await db.execute("SELECT * FROM kamar");
    res.render('kamars/data_kamar', {
        title: 'Data Kamar',
        pageClass: 'data-kamar-page',
        kamarData: kamar,
        user: req.session.user,
    });
});

app.get('/data_kamar/add_kamar', isLoggedIn, checkRole('admin'), async (req, res) => {
    const [tipe] = await db.execute("SELECT * FROM tipe_kamar")
    res.render('kamars/add_kamar', {
        title: 'Add Kamar Page',
        pageClass: 'add-kamar-page',
        tipeData: tipe,
        user: req.session.user,
        });
});

app.post('/data_kamar/add_kamar', isLoggedIn, checkRole('admin'), async (req, res) => {
    const { nomor_kamar, tipe_kamar, harga_per_malam } = req.body;

    try {
        await db.execute('INSERT INTO kamar (nomor_kamar, tipe_kamar, harga_per_malam, created_at) VALUES (?, ?, ?, ?)', [nomor_kamar, tipe_kamar, harga_per_malam, new Date()]);
        res.redirect('/data_kamar');
    } catch (err) {
        console.error(err);
        res.status(500).send("Terjadi kesalahan server");
    }
});

app.get('/data_kamar/edit_kamar/:id', isLoggedIn, checkRole('admin'), async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM kamar WHERE id = ?', [req.params.id]);

        if (rows.length === 0) {
            return res.status(404).send('Kamar tidak ditemukan');
        }

        res.render('kamars/edit_kamar', {
            title: 'Edit Kamar Page',
            kamar: rows[0],
            pageClass: 'edit-kamar-page',
            user: req.session.user,
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Terjadi kesalahan server');
    }
});

app.post('/data_kamar/edit_kamar/:id', isLoggedIn, checkRole('admin'), async (req, res) => {
    const { nomor_kamar, tipe_kamar, harga_per_malam, status } = req.body;
    const { id } = req.params;

    try {
        await db.execute(
            'UPDATE kamar SET nomor_kamar=?, tipe_kamar=?, harga_per_malam=?, status=? WHERE id=?',
            [nomor_kamar, tipe_kamar, harga_per_malam, status, id]
        );
        res.redirect('/data_kamar');
    } catch (err) {
        console.error(err);
        res.status(500).send("Terjadi kesalahan server");
    }
});

app.get('/data_kamar/delete_kamar/:id', isLoggedIn, checkRole('admin'), async (req, res) => {
    const { id } = req.params;

    try {
        await db.execute('DELETE FROM kamar WHERE id=?', [id]);
        res.redirect('/data_kamar');
    } catch (err) {
        console.error(err);
        res.status(500).send("Terjadi kesalahan server");
    }
});

app.get('/data_reservasi', isLoggedIn, checkRole('admin'), async (req, res) => {
    try {
        const [reserves] = await db.execute("SELECT * FROM reservasi");

        // Format tanggal sebelum dilempar ke EJS
        const dataWithFormat = reserves.map(r => ({
            ...r,
            checkin: formatDate(r.checkin),
            checkout: formatDate(r.checkout)
        }));

        res.render('reserves/data_reserve', {
            title: 'Data Reservasi',
            pageClass: 'reserves-page',
            reservesData: dataWithFormat,
            user: req.session.user,
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Terjadi kesalahan server");
    }
});

app.get('/staff', isLoggedIn, checkRole('staff'), (req, res) => {
    res.send("Selamat datang di halaman Staff!");
});

app.get('/dashboard', isLoggedIn, checkRole('clients'), async (req, res) => {

    const [kamar] = await db.execute("SELECT * FROM kamar WHERE status='empty'");
    const [tipe] = await db.execute("SELECT * FROM tipe_kamar");

    res.render('dashboard_client', {
        title: 'Dashboard',
        pageClass: 'user-page',
        dataKamar: kamar,
        tipeData: tipe,
        user: req.session.user,
        });
});

app.get('/reservasi', isLoggedIn, checkRole('clients'), async(req, res) => {
    const level = req.query.level;
    const [rows] = await db.execute("SELECT * FROM kamar WHERE tipe_kamar = ? AND status = 'empty' LIMIT 1",[level]);

    if (rows.length === 0) {
        return res.send("<script>alert('Maaf, kamar untuk tipe ini sedang penuh. Silakan pilih tipe kamar lain.'); window.location.href = '/dashboard';</script>");
    }
    
    res.render('reservasi', {
        title: 'Reservasi Page',
        pageClass: 'reservasi-page',
        kamarMap: rows[0],
        user: req.session.user,
    });
});

app.post('/reservasi', isLoggedIn, checkRole('clients'), upload.single('ktp'), async (req, res) => {
    const { tanggal, nama, telepon, email, tipe_kamar, pembayaran, id_kamar} = req.body;
    const ktpFile = req.file;

    if (!ktpFile) {
        return res.send("<script>alert('Gagal mengunggah file KTP. Silakan coba lagi.'); window.location.href = '/reservasi';</script>");
    }

    let checkin = null;
    let checkout = null;
    let total_malam = 0;

    if (tanggal && tanggal.includes(" - ")) {
        [checkin, checkout] = tanggal.split(" - ");

        const start = new Date(checkin);
        const end = new Date(checkout);
        const diffTime = end - start;
        total_malam = diffTime / (1000 * 60 * 60 * 24);
    }

    try { await db.execute('INSERT INTO reservasi (nama_lengkap, telepon, email, foto_ktp, checkin, checkout, total_malam, tipe_kamar, tipe_pembayaran, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [nama, telepon, email, ktpFile.filename, checkin, checkout, total_malam, tipe_kamar, pembayaran, "pending", new Date()]);
        await db.execute('UPDATE kamar SET status=? WHERE id=? AND status="empty" LIMIT 1', ["booked", id_kamar]);
        res.send("<script>alert('Reservasi Berhasil!'); window.location.href = '/dashboard';</script>");
    } catch (err) {
        console.error(err);
        res.status(500).send("Terjadi kesalahan server");
    }
});


app.get('/logout', (req, res) => {
    req.session.destroy
    res.send("<script>alert('Anda telah logout'); window.location.href = '/login?message=Anda telah logout';</script>");
});

app.listen(port, () => console.log(`Server jalan di http://localhost:${port}`));
