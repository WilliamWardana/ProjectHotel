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
        res.redirect('/user');
    }
});

app.get('/data_user', isLoggedIn, async (req, res) => {
    try {
        const [users] = await db.execute("SELECT * FROM users");
        
        res.render('users/data_user', {
            title: 'Admin Page',
            userData: users,
            pageClass: 'admin-page',
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Terjadi kesalahan server");
    }
});

app.get('/data_user/add_user', isLoggedIn, checkRole('admin'), (req, res) => {
    res.render('users/add_user', { title: 'Add User Page', pageClass: 'add-user-page' });
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
    res.render('kamars/data_kamar', { title: 'Data Kamar', pageClass: 'data-kamar-page', kamarData: kamar });
});

app.get('/data_kamar/add_kamar', isLoggedIn, checkRole('admin'), (req, res) => {
    res.render('kamars/add_kamar', { title: 'Add Kamar Page', pageClass: 'add-kamar-page' });
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

app.get('/staff', isLoggedIn, checkRole('staff'), (req, res) => {
    res.send("Selamat datang di halaman Staff!");
});

app.get('/user', isLoggedIn, checkRole('clients'), async (req, res) => {
    const user = { name: "William" };
    const rooms = [   
        { id: 1, name: "Deluxe Room", price: 500000, image: "/img/deluxe.jpg" },
        { id: 2, name: "Suite Room", price: 1200000, image: "/img/suite.jpg" },
        { id: 3, name: "Standard Room", price: 350000, image: "/img/standard.jpg" },
    ];
    const bookings = [
        { roomName: "Deluxe Room", checkIn: "2025-09-01", checkOut: "2025-09-03", status: "confirmed" }
    ];
    const promos = [
        { message: "🎉 Promo September: Diskon 20% untuk pemesanan minimal 3 malam!" }
    ];

    const [kamar] = await db.execute("SELECT * FROM kamar WHERE status='empty'");

    res.render('dashboard_client', { title: 'Dashboard', pageClass: 'user-page', user, rooms, bookings, promos, dataKamar: kamar });
});

app.get('/logout', (req, res) => {
    req.session.destroy
    res.send("<script>alert('Anda telah logout'); window.location.href = '/login?message=Anda telah logout';</script>");
});

app.listen(port, () => console.log(`Server jalan di http://localhost:${port}`));
