const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// prueba base
app.get('/', (req, res) => {
    res.send("API funcionando 🚀");
});

// endpoint platos
let platos = [
    { id: 1, nombre: "Pizza", precio: 25 },
    { id: 2, nombre: "Hamburguesa", precio: 18 }
];

app.get('/platos', (req, res) => {
    res.json(platos);
});

app.post('/platos', (req, res) => {
    const nuevo = {
        id: Date.now(),
        ...req.body
    };
    platos.push(nuevo);
    res.json(nuevo);
});

// puerto dinámico (IMPORTANTE)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("Servidor corriendo en puerto " + PORT);
});