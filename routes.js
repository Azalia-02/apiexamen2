const express = require('express');
const router = express.Router();
const connection = require('./db');
const failedAttempts = {};
const bcrypt = require('bcrypt');

router.get('/registros', (req, res) => {
    connection.query('SELECT * FROM tb_login', (err, results) => {
        if (err) {
            console.error('Error al obtener registros:', err );
            res.status(500).json({ error: 'Error al obtener registros'});
            return;
        }

        if (results.length === 0){
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json(results);
    });
});

//Logeo de usuarios
router.post('/redirige', async (req, res) => {
    const { email, password } = req.body;

    if (failedAttempts[email] && failedAttempts[email].blockedUntil > Date.now()) {
        const remainingTime = Math.ceil((failedAttempts[email].blockedUntil - Date.now()) / 1000);
        return res.status(429).json({ error: `Demasiados intentos fallidos. Por favor, inténtelo de nuevo en ${remainingTime} segundos.` });
    }

    try {
        connection.query('SELECT * FROM tb_login WHERE email = ?', [email], async (err, results) => {
            if (err) {
                console.error('Error en la consulta:', err);
                return res.status(500).json({ error: 'Error al obtener registros' });
            }

            if (results.length === 0) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }

            const user = results[0];

            const isPasswordValid = await bcrypt.compare(password, user.password);

            if (!isPasswordValid) {
                failedAttempts[email] = failedAttempts[email] || { count: 0 };
                failedAttempts[email].count += 1;

                if (failedAttempts[email].count >= 3) {
                    failedAttempts[email].blockedUntil = Date.now() + 30000; 
                    return res.status(429).json({ error: 'Demasiados intentos fallidos. Por favor, inténtelo de nuevo en 30 segundos.' });
                }

                return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
            }

            delete failedAttempts[email];

            res.json(user);
        });
    } catch (error) {
        console.error('Error en el servidor:', error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// Crear nuevos usuarios
router.post('/registros', async (req, res) => {
    const { name, email, password} = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password.trim(), 10);
        console.log('Contraseña hasheada:', hashedPassword);

        const query = 'INSERT INTO tb_login (name, email, password) VALUES (?, ?, ?)';
        const values = [name, email, hashedPassword, new Date(), new Date()];

        connection.query(query, values, (err, results) => {
            if (err) {
                console.error('Error en la consulta:', err);
                return res.status(500).json({ error: 'Error al registrar el usuario' });
            }

            console.log('Usuario registrado exitosamente:', results);
            res.json({ success: true, message: 'Usuario registrado exitosamente' });
        });
    } catch (error) {
        console.error('Error en el servidor:', error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

module.exports = router;