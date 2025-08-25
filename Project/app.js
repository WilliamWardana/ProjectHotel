import express from 'express';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import session from 'express-session';
import bodyParser from 'body-parser';

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'secretKey',
    resave: false,
    saveUninitialized: false
}));

// koneksi database
const db = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'project_hotel'
});

// Middleware cek login
function isLoggedIn(req, res, next) {
    if (req.session.user) return next();
    res.send("Silakan login dulu!");
}

// Middleware cek role
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

// Halaman login
app.get('/login', (req, res) => {
    res.send(`
        <form method="POST" action="/login">
            <input name="username" placeholder="Username"/><br/>
            <input name="password" type="password" placeholder="Password"/><br/>
            <button type="submit">Login</button>
        </form>
    `);
});

// Proses login
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    const [rows] = await db.execute("SELECT * FROM users WHERE username=?", [username]);
    if (rows.length === 0) return res.send("User tidak ditemukan");

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.send("Password salah");

    // simpan session
    req.session.user = { id: user.id, username: user.username, role: user.role };

    res.send(`Login berhasil sebagai ${user.role}. <a href="/dashboard">Dashboard</a>`);
});

// Dashboard umum
app.get('/dashboard', isLoggedIn, (req, res) => {
    res.send(`Halo ${req.session.user.username}, role Anda: ${req.session.user.role}`);
});

// Halaman khusus Admin
app.get('/admin', isLoggedIn, checkRole('admin'), (req, res) => {
    res.send("Selamat datang di halaman Admin!");
});

// Halaman khusus Staff
app.get('/staff', isLoggedIn, checkRole('staff'), (req, res) => {
    res.send("Selamat datang di halaman Staff!");
});

// Halaman khusus User
app.get('/user', isLoggedIn, checkRole('user'), (req, res) => {
    res.send("Selamat datang di halaman User!");
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.send("Anda sudah logout.");
});

app.listen(3001, () => console.log("Server jalan di http://localhost:3001"));
