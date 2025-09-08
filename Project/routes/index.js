import express from 'express';
import path from 'path';

const app = express();
const __dirname = path.resolve();

app.get('/', (req, res) => {
    res.redirect('/login');
});

app.get('/login', (req, res) => {
    res.render('login', { title: 'Login Page' });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    const [rows] = await db.execute("SELECT * FROM users WHERE username=?", [username]);
    if (rows.length === 0) return res.send("User tidak ditemukan");

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.send("Password salah");

    if (user.role == 'admin') {
        req.session.user = { id: user.id, username: user.username, role: user.role };
        res.redirect('/data_user');
    } else if (user.role == 'staff') {
        // ke staff
    } else {
        // ke user
    }
});

app.get('/dashboard', isLoggedIn, (req, res) => {
    res.send(`Halo ${req.session.user.username}, role Anda: ${req.session.user.role}`);
});

app.get('/data_user', isLoggedIn, async (req, res) => {
    try {
        const [users] = await db.execute("SELECT * FROM users");

        res.render('data_user', {
            title: 'Admin Page',
            userData: users,
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Terjadi kesalahan server");
    }
});

app.get('/staff', isLoggedIn, checkRole('staff'), (req, res) => {
    res.send("Selamat datang di halaman Staff!");
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.send("Anda sudah logout.");
});

export default router;