const express = require('express');
const cors = require('cors');

// 🔥 Firebase
const admin = require("firebase-admin");
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ☁️ Cloudinary
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'platos',
        allowed_formats: ['jpg', 'jpeg', 'png'],
        transformation: [{ width: 500, height: 500, crop: 'fill' }]
    }
});

const upload = multer({ storage });

const app = express();
app.use(cors());
app.use(express.json());

/* ===============================
   ✅ RUTA BASE
================================ */
app.get('/', (req, res) => {
    res.send("API funcionando 🚀");
});

/* ===============================
   🌱 SEED (DATOS INICIALES)
================================ */
app.get('/seed', async (req, res) => {
    try {
        const platos = [
            { nombre: "Ensalada César", precio: 18, categoria: "entrada", disponible: true, imagenURL: "https://picsum.photos/200?1" },
            { nombre: "Sopa de Verduras", precio: 15, categoria: "entrada", disponible: true, imagenURL: "https://picsum.photos/200?2" },
            { nombre: "Lomo Saltado", precio: 30, categoria: "principal", disponible: true, imagenURL: "https://picsum.photos/200?3" },
            { nombre: "Arroz con Pollo", precio: 25, categoria: "principal", disponible: true, imagenURL: "https://picsum.photos/200?4" },
            { nombre: "Tallarines Rojos", precio: 22, categoria: "principal", disponible: true, imagenURL: "https://picsum.photos/200?5" },
            { nombre: "Cheesecake", precio: 12, categoria: "postre", disponible: true, imagenURL: "https://picsum.photos/200?6" },
            { nombre: "Helado", precio: 10, categoria: "postre", disponible: true, imagenURL: "https://picsum.photos/200?7" },
            { nombre: "Chicha Morada", precio: 8, categoria: "bebida", disponible: true, imagenURL: "https://picsum.photos/200?8" },
            { nombre: "Inca Kola", precio: 7, categoria: "bebida", disponible: true, imagenURL: "https://picsum.photos/200?9" },
            { nombre: "Papas Fritas", precio: 9, categoria: "extras", disponible: true, imagenURL: "https://picsum.photos/200?10" }
        ];

        for (let p of platos) {
            await db.collection('platos').add({
                ...p,
                fecha: new Date()
            });
        }

        res.json({ mensaje: "Datos insertados correctamente" });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/* ===============================
   🍽️ CRUD PLATOS
================================ */

// LISTAR
app.get('/platos', async (req, res) => {
    try {
        const snapshot = await db.collection('platos')
            .where('disponible', '==', true)
            .get();

        const platos = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        res.json(platos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// OBTENER POR ID
app.get('/platos/:id', async (req, res) => {
    try {
        const doc = await db.collection('platos').doc(req.params.id).get();

        if (!doc.exists) {
            return res.status(404).json({ error: "No encontrado" });
        }

        res.json({ id: doc.id, ...doc.data() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// CREAR
app.post('/platos', async (req, res) => {
    try {
        const { nombre, precio, categoria, imagenURL } = req.body;

        if (!nombre || !precio) {
            return res.status(400).json({ error: "Datos incompletos" });
        }

        const doc = await db.collection('platos').add({
            nombre,
            precio: Number(precio),
            categoria: categoria || "principal",
            imagenURL: imagenURL || "",
            disponible: true,
            fecha: new Date()
        });

        res.status(201).json({ id: doc.id });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ACTUALIZAR
app.put('/platos/:id', async (req, res) => {
    try {
        await db.collection('platos').doc(req.params.id).update(req.body);
        res.json({ mensaje: "Plato actualizado" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ELIMINAR (lógico)
app.delete('/platos/:id', async (req, res) => {
    try {
        await db.collection('platos').doc(req.params.id).update({
            disponible: false
        });

        res.json({ mensaje: "Plato desactivado" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/* ===============================
   🖼️ UPLOAD IMAGEN
================================ */
app.post('/upload', upload.single('imagen'), (req, res) => {
    res.json({ url: req.file.path });
});

/* ===============================
   🧾 PEDIDOS
================================ */

// CREAR
app.post('/pedidos', async (req, res) => {
    const doc = await db.collection('pedidos').add({
        mesaId: req.body.mesaId,
        estado: "abierto",
        total: 0,
        fecha: new Date()
    });

    res.json({ id: doc.id });
});

// AGREGAR DETALLE
app.post('/pedidos/:id/detalles', async (req, res) => {
    const { platoId, cantidad } = req.body;

    const platoDoc = await db.collection('platos').doc(platoId).get();
    const plato = platoDoc.data();

    const subtotal = plato.precio * cantidad;
    const pedidoRef = db.collection('pedidos').doc(req.params.id);

    await pedidoRef.collection('detalles').add({
        platoId,
        cantidad,
        subtotal
    });

    await db.runTransaction(async (t) => {
        const pedido = await t.get(pedidoRef);
        t.update(pedidoRef, {
            total: (pedido.data().total || 0) + subtotal
        });
    });

    res.json({ mensaje: "Detalle agregado" });
});

// CERRAR
app.put('/pedidos/:id/cerrar', async (req, res) => {
    await db.collection('pedidos').doc(req.params.id).update({
        estado: "cerrado"
    });

    res.json({ mensaje: "Pedido cerrado" });
});

/* ===============================
   📊 REPORTES
================================ */
app.get('/reportes', async (req, res) => {
    const { desde, hasta } = req.query;

    const snapshot = await db.collection('pedidos')
        .where('fecha', '>=', new Date(desde))
        .where('fecha', '<=', new Date(hasta))
        .get();

    const pedidos = snapshot.docs.map(doc => doc.data());

    res.json(pedidos);
});

/* ===============================
   🚀 SERVIDOR
================================ */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("Servidor corriendo en puerto " + PORT);
});