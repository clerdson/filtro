const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise'); // Para suporte a async/await
const multer = require('multer');
const path = require('path');
const app = express();
const cors = require('cors');


app.use(cors());

app.use(bodyParser.json());


const db = mysql.createConnection('mysql://root:ByIRUVnxnLJTKDMJqfWOBlHHkPrVFara@roundhouse.proxy.rlwy.net:26335/railway')
/*
// Conexão com o banco de dados
const db = mysql.createPool({
    host: 'mysql.railway.internal',
    user: 'root',
    password: 'ByIRUVnxnLJTKDMJqfWOBlHHkPrVFara',
    database: 'railway',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});
*/

  var sql = " CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY,name VARCHAR(100) NOT NULL, email VARCHAR(100) NOT NULL UNIQUE,password VARCHAR(255) NOT NULL,profile_image VARCHAR(255) NOT NULL);";
  db.query(sql, function (err, result) {
    if (err) throw err;
    console.log("Table created");
  });



  var sql = "CREATE TABLE measurements (id INT AUTO_INCREMENT PRIMARY KEY,user_id INT NOT NULL,local VARCHAR(255) NOT NULL, initial_mass FLOAT NOT NULL, final_mass FLOAT NOT NULL,image VARCHAR(255),created_at DATETIME NOT NULL,FOREIGN KEY (user_id) REFERENCES users(id));";
  db.query(sql, function (err, result) {
    if (err) throw err;
    console.log("Table created");
  });








// Servir a pasta uploads como público para acesso direto via URL
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploads/'); // Pasta onde a imagem será salva
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + path.extname(file.originalname)); // Nome único para a imagem
    }
  });
  
  const upload = multer({ storage: storage });
  
  // Configura o body parser
  app.use(bodyParser.json());
  

  // Rota principal
  app.get('/', (req, res) => {
    return res.json({ message: 'ok' });
  });

   // Registro
   app.post('/register_admin', upload.single('profileImage'), async (req, res) => {
    const { name, email, password } = req.body;
    const profileImage = req.file ? req.file.path : null; // Salva o caminho do arquivo
  
    if (!name || !email || !password || !profileImage) {
      return res.status(400).json({ message: 'Todos os campos são obrigatórios!' });
    }
  
    try {
      // Hash da senha
      const hashedPassword = await bcrypt.hash(password, 10);
  
      // Salva no banco de dados
      await db.execute(
        'INSERT INTO users_admin (name, email, password, profile_image) VALUES (?, ?, ?, ?)',
        [name, email, hashedPassword, profileImage]
      );
  
      res.status(201).json({ message: 'Usuário registrado com sucesso!' });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        res.status(400).json({ message: 'Email já está em uso!' });
      } else {
        res.status(500).json({ message: 'Erro ao registrar usuário!', error });
      }
    }
  });
  
  app.get('/measurements_filtro', verifyJWT, async (req, res) => {
    const { local } = req.query; // Obtém o filtro de 'local' da query string
    const userId = req.userId;
  
    try {
      let query = 'SELECT * FROM measurements WHERE user_id = ?';
      let values = [userId];
  
      if (local) {
        query += ' AND local LIKE ?';
        values.push(`%${local}%`); // Usa LIKE para buscar por local (parcial)
      }
  
      const [measurements] = await db.execute(query, values);
  
      res.status(200).json({ measurements });
    } catch (error) {
      console.error('Erro ao buscar medições:', error);
      res.status(500).json({ message: 'Erro interno do servidor.' });
    }
  });
  
  // Registro
  app.post('/register', upload.single('profileImage'), async (req, res) => {
    const { name, email, password } = req.body;
    const profileImage = req.file ? req.file.path : null; // Salva o caminho do arquivo
  
    if (!name || !email || !password || !profileImage) {
      return res.status(400).json({ message: 'Todos os campos são obrigatórios!' });
    }
  
    try {
      // Hash da senha
      const hashedPassword = await bcrypt.hash(password, 10);
  
      // Salva no banco de dados
      await db.execute(
        'INSERT INTO users (name, email, password, profile_image) VALUES (?, ?, ?, ?)',
        [name, email, hashedPassword, profileImage]
      );
  
      res.status(201).json({ message: 'Usuário registrado com sucesso!' });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        res.status(400).json({ message: 'Email já está em uso!' });
      } else {
        res.status(500).json({ message: 'Erro ao registrar usuário!', error });
      }
    }
  });
// admin
app.post('/admin', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
      return res.status(400).json({ message: 'Email e senha são obrigatórios!' });
  }
  

  try {
      // Verifica se o usuário existe
      const [rows] = await db.execute('SELECT * FROM users_admin WHERE email = ?', [email]);

      if (rows.length === 0) {
          return res.status(404).json({ message: 'Usuário não encontrado!' });
      }

      const user = rows[0];

      // Verifica a senha
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
          return res.status(401).json({ message: 'Senha incorreta!' });
      }
    

      // Gera o token JWT
      const token = jwt.sign(
          { id: user.id, email: user.email },
           '1',
          { expiresIn:'1h' }
      );

      res.json({ auth: true, token:token });
  } catch (error) {
      res.status(500).json({ message: 'Erro interno do servidor!', error });
  }
});
// Login
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email e senha são obrigatórios!' });
    }
    

    try {
        // Verifica se o usuário existe
        const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado!' });
        }

        const user = rows[0];

        // Verifica a senha
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Senha incorreta!' });
        }
      

        // Gera o token JWT
        const token = jwt.sign(
            { id: user.id, email: user.email },
             '1',
            { expiresIn:'1h' }
        );

        res.json({ auth: true, token:token });
    } catch (error) {
        res.status(500).json({ message: 'Erro interno do servidor!', error });
    }
});

// Middleware para verificar o token JWT
function verifyJWT(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ auth: false, message: 'Nenhum token fornecido.' });
    }
    const token = authHeader.split(' ')[1]; 

    jwt.verify(token, '1', (err, decoded) => {
        if (err) {
            return res.status(403).json({ auth: false, message: 'Falha ao autenticar o token.' });
        }

        // Armazena os dados decodificados do token no objeto `req`
        req.userId = decoded.id;
        req.email = decoded.email;

        // Passa para o próximo middleware ou rota
        next();
    });
}
// Rota para obter todas as medições
app.get('/measurements', verifyJWT, async (req, res) => {
    try {
      // Faz a consulta ao banco de dados para obter todas as medições
      const [rows] = await db.execute(
        'SELECT * FROM measurements WHERE user_id = ?',
        [req.userId]
      );
  
      // Verifica se há medições e retorna a lista
      if (rows.length > 0) {
        res.status(200).json({ measurements: rows });
      } else {
        res.status(404).json({ message: 'Nenhuma medição encontrada.' });
      }
    } catch (error) {
      console.error('Erro ao recuperar medições:', error);
      res.status(500).json({ message: 'Erro interno do servidor.', error });
    }
  });
  
  
  
  // Rota para registrar medições com upload de imagem
  app.post('/measurements', verifyJWT, upload.single('image'), async (req, res) => {
      const { initial_mass, final_mass, local } = req.body;
      let imagePath = null;
  
      // Verificar se todos os campos obrigatórios estão presentes
      if (!initial_mass || !final_mass || !local) {
          return res.status(400).json({ message: 'Todos os campos são obrigatórios!' });
      }
  
      // Verificar se uma imagem foi enviada
      if (req.file) {
          imagePath = `/uploads/${req.file.filename}`; // Caminho da imagem no servidor
      }
  
      try {
          const createdAt = new Date();
  
          // Inserir a medição no banco de dados com a imagem (se houver)
          await db.execute(
              'INSERT INTO measurements (user_id, local, initial_mass, final_mass, image, created_at) VALUES (?, ?, ?, ?, ?, ?)',
              [req.userId, local, initial_mass, final_mass, imagePath, createdAt]
          );
  
          res.status(201).json({ message: 'Cadastro realizado com sucesso!' });
      } catch (error) {
          console.error('Erro ao registrar medição:', error);
          res.status(500).json({ message: 'Erro interno do servidor.', error });
      }
  });
  


// Rota protegida para pegar email e imagem do usuário
app.get('/cadastro', verifyJWT, async (req, res) => {
    try {
        // Consulta o banco de dados para obter os dados do usuário
        const [rows] = await db.execute(
            'SELECT email, profile_image FROM users WHERE id = ?',
            [req.userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado!' });
        }

        const { email, profile_image } = rows[0];
        res.json({ email, profile_image });
    } catch (error) {
        res.status(500).json({ message: 'Erro interno do servidor!', error });
    }
});



// Inicia o servidor
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
