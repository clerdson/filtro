const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const multer = require('multer');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Criando pool de conexão com MySQL
const db = mysql.createPool({
    host: 'roundhouse.proxy.rlwy.net',
    port: 26335,
    user: 'root',
    password: 'ByIRUVnxnLJTKDMJqfWOBlHHkPrVFara',
    database: 'railway',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 60000 // 60 segundos
});


// Criando as tabelas após a conexão ser estabelecida
async function createTables() {
    try {
        const conn = await db.getConnection();

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                profile_image VARCHAR(255) NOT NULL
            )
        `);

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS measurements (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                local VARCHAR(255) NOT NULL,
                initial_mass FLOAT NOT NULL,
                final_mass FLOAT NOT NULL,
                image VARCHAR(255),
                created_at DATETIME NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        console.log('Tabelas verificadas/criadas com sucesso!');
        conn.release();
    } catch (error) {
        console.error('Erro ao criar tabelas:', error);
    }
}

createTables();

// Servir arquivos estáticos da pasta uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/', express.static(path.join(__dirname, 'public')));

// Configuração do multer para upload de imagens
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage });



// Middleware para autenticação JWT
function verifyJWT(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ auth: false, message: 'Nenhum token fornecido.' });
    }

    const token = authHeader.split(' ')[1];
    jwt.verify(token, '1', (err, decoded) => {
        if (err) {
            return res.status(403).json({ auth: false, message: 'Token inválido.' });
        }
        req.userId = decoded.id;
        next();
    });
}

// Registro de Usuário
app.post('/register', upload.single('profileImage'), async (req, res) => {
    const { name, email, password } = req.body;
    const profileImage = req.file ? req.file.path : null;

    if (!name || !email || !password || !profileImage) {
        return res.status(400).json({ message: 'Todos os campos são obrigatórios!' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        await db.execute(
            'INSERT INTO users (name, email, password, profile_image) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, profileImage]
        );
        res.status(201).json({ message: 'Usuário registrado com sucesso!' });
    } catch (error) {
        console.error('Erro ao registrar usuário:', error);
           res.status(500).json({
               message: 'Erro ao registrar usuário!',
               error: error.message || error
           });
    }
});

// Login
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email e senha são obrigatórios!' });
    }

    try {
        const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado!' });
        }

        const user = rows[0];
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Senha incorreta!' });
        }

        const token = jwt.sign({ id: user.id, email: user.email }, '1', { expiresIn: '1h' });
        res.json({ auth: true, token });
    } catch (error) {
        res.status(500).json({ message: 'Erro interno do servidor!', error });
    }
});

// Rota para buscar medições do usuário autenticado
app.get('/measurements', verifyJWT, async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM measurements WHERE user_id = ?', [req.userId]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Nenhuma medição encontrada.' });
        }

        res.status(200).json({ measurements: rows });
    } catch (error) {
        res.status(500).json({ message: 'Erro interno do servidor.', error });
    }
});

// Rota para cadastrar medições com imagem
app.post('/measurements', verifyJWT, upload.single('image'), async (req, res) => {
    const { initial_mass, final_mass, local } = req.body;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

    if (!initial_mass || !final_mass || !local) {
        return res.status(400).json({ message: 'Todos os campos são obrigatórios!' });
    }

    try {
        const createdAt = new Date();

        await db.execute(
            'INSERT INTO measurements (user_id, local, initial_mass, final_mass, image, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [req.userId, local, initial_mass, final_mass, imagePath, createdAt]
        );

        res.status(201).json({ message: 'Medição registrada com sucesso!' });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao registrar medição!', error });
    }
});

// Inicia o servidor
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
