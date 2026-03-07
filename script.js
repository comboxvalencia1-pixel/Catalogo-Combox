const API_URL = "https://script.google.com/macros/s/AKfycbyJOqe3K6Q6Eps-eLDNSwasHfcPRadqUH7rRU5HhpcBiiszYVh9uzpaBXCsZ5OjkfhY/exec";

let db = { productos: [], combos: [], sedes: [], params: {}, tipos: [] };
let cart = JSON.parse(localStorage.getItem('combox_cart')) || [];
let currentSede = null;
let currentType = null;
let deliveryMethod = 'tienda';

// Audio Context para Sonido Sintético (Instrucción playTap)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTap() {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
    if (navigator.vibrate) navigator.vibrate(50);
}

window.onload = async () => {
    try {
        const response = await fetch(`${API_URL}?action=getAppData`);
        db = await response.json();
        
        // Aplicar Parametros Dinámicos
        document.getElementById('brandName')?.innerText = db.params.Nombre_principal;
        if(db.params.pagina_funcional === "no") {
            document.body.innerHTML = "<h1>SITIO EN MANTENIMIENTO</h1>";
            return;
        }

        initApp();
        setTimeout(hideSplash, 1000); // Instrucción: no más de 1 seg
    } catch (e) {
        console.error("Error cargando DB", e);
    }
};

function hideSplash() {
    const s = document.getElementById('splash');
    s.style.opacity = '0';
    setTimeout(() => {
        s.style.display = 'none';
        document.body.style.overflow = 'auto';
    }, 800);
}

function initApp() {
    // Cargar Sede por defecto o preguntar
    currentSede = db.sedes[0]; 
    renderTypeButtons();
    renderProducts();
    updateCartUI();
}

// LÓGICA DE PRECIOS (Corregida con Mayorista y Promos)
function getActivePrice(p, qty = 1) {
    let precio = parseFloat(p.Precio_venta_NORMAL || 0);
    let esPromo = false;

    // 1. Validar Mayorista
    const minMayor = parseInt(p.cantidad_minima_mayor || 0);
    if (minMayor > 0 && qty >= minMayor && parseFloat(p.precio_mayor) > 0) {
        precio = parseFloat(p.precio_mayor);
    }

    // 2. Validar Promoción Activa
    if (p.PROMOCION_ACTIVA === "Activa") {
        const hoy = new Date();
        const hasta = new Date(p.promocion_hasta);
        const diaHoy = hoy.toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase();
        
        const sedeOk = !p.PROMOCION_VALIDA_POR_SEDE_FK || p.PROMOCION_VALIDA_POR_SEDE_FK.includes(currentSede.NOMBRE_SEDE);
        const fechaOk = !p.promocion_hasta || hasta >= hoy.setHours(0,0,0,0);
        const diaOk = p.dias_promocion.toLowerCase().includes("todos") || p.dias_promocion.toLowerCase().includes(diaHoy);

        if (sedeOk && fechaOk && diaOk) {
            precio = parseFloat(p.Precio_promocion_TEMPORAL);
            esPromo = true;
        }
    }
    return { precio, esPromo };
}

// BUSCADOR INTELIGENTE
function filterProducts() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    renderProducts(query);
}

function addToCart(id) {
    playTap();
    const item = db.productos.find(x => x.ID_PRODUCTO === id) || db.combos.find(x => x.ID_PRODUCTO_VENTA === id);
    const inCart = cart.find(x => (x.ID_PRODUCTO || x.ID_PRODUCTO_VENTA) === id);

    if (inCart) {
        inCart.qty++;
    } else {
        cart.push({ ...item, qty: 1 });
    }
    
    updateCartUI();
    saveCart();
}

function updateCartUI() {
    const total = cart.reduce((acc, curr) => {
        const { precio } = getActivePrice(curr, curr.qty);
        return acc + (precio * curr.qty);
    }, 0);

    const count = cart.reduce((acc, curr) => acc + curr.qty, 0);

    document.getElementById('cartTotal').innerText = `$${total.toFixed(2)}`;
    document.getElementById('cartCount').innerText = `${count} producto(s)`;
    
    const island = document.getElementById('bottomIsland');
    island.style.display = cart.length > 0 ? 'flex' : 'none';
}

function saveCart() {
    localStorage.setItem('combox_cart', JSON.stringify(cart));
}

// GPS NATIVO
function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            const link = `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`;
            document.getElementById('locationLink').value = link;
            checkForm();
        });
    }
}

function finalizarPedido() {
    let msg = `Hola! Soy *${document.getElementById('clientName').value || document.getElementById('receiverName').value}*, `;
    
    if(deliveryMethod === 'tienda') {
        msg += `quiero recoger en la sede de *${currentSede.NOMBRE_SEDE}*\n\n`;
    } else {
        msg += `quiero este pedido a domicilio.\n\n`;
    }

    cart.forEach(item => {
        const { precio } = getActivePrice(item, item.qty);
        msg += `- *${(item.PRODUCTO || item.nombre_COMBO).toUpperCase()}*\n`;
        msg += `\`Cant:\` *${item.qty}* | *$\`${(precio * item.qty).toFixed(2)}\`*\n\n`;
    });

    const total = document.getElementById('cartTotal').innerText;
    msg += `💵 *SUBTOTAL:* *${total}*\n`;

    if(deliveryMethod === 'delivery') {
        msg += `\n🛵 *ENTREGA POR DELIVERY:*\n${document.getElementById('locationLink').value}`;
    }

    const tel = currentSede.TELEFONO.replace(/\D/g,'');
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank');
}
