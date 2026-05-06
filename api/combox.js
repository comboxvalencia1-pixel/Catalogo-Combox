export default async function handler(req, res) {
    // 1. Aquí Vercel buscará la URL que configuraste en su panel (paso 2 de las instrucciones anteriores)
    const GOOGLE_URL = process.env.GOOGLE_SCRIPT_URL;

    // 2. Esta es la clave que "firmará" la petición. 
    // Debe ser la misma que pongas en tu Google Apps Script (.gs)
    const SECRET_TOKEN = "CLAVE_INTERNA_COMBOX_2026";

    // 3. Solo permitimos el método POST (que es el que usas para enviar pedidos y sugerencias)
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido. Solo se acepta POST.' });
    }

    try {
        // 4. Recibimos los datos que vienen de tu página web (nombre, pedido, sugerencia, etc.)
        const userData = req.body;

        // 5. Le inyectamos la clave secreta a esos datos antes de mandarlos a Google
        const finalData = {
            ...userData,
            auth_token: SECRET_TOKEN
        };

        // 6. Enviamos todo a Google de forma privada (nadie puede ver esta petición)
        const googleResponse = await fetch(GOOGLE_URL, {
            method: 'POST',
            body: JSON.stringify(finalData),
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // 7. Obtenemos lo que Google nos responda (ej: "Pedido guardado con éxito")
        const result = await googleResponse.json();

        // 8. Se lo devolvemos a tu página web
        return res.status(200).json(result);

    } catch (error) {
        console.error("Error en la API:", error);
        return res.status(500).json({ error: 'Error al conectar con la base de datos de Google' });
    }
}
