const API_URL = "https://script.google.com/macros/s/AKfycbyJOqe3K6Q6Eps-eLDNSwasHfcPRadqUH7rRU5HhpcBiiszYVh9uzpaBXCsZ5OjkfhY/exec";

let db = {}, cart = [], currentSede = null, currentType = "", currentSub = "";

window.onload = async () => {
    // Bloquear scroll
    document.body.style.overflow = 'hidden';
    await fetchData();
    checkSede();
    
    setTimeout(() => {
        gsap.to("#splash", { yPercent: -100, duration: 1, ease: "expo.inOut", onComplete: () => {
            document.body.style.overflow = 'auto';
            if(db.params.mensaje_bienvenida) showToast(db.params.mensaje_bienvenida);
        }});
    }, 1000);
};

async function fetchData() {
    const res = await fetch(API_URL);
    db = await res.json();
    
    // Configuración Dinámica
    document.documentElement.style.setProperty('--primary', db.params.codigo_color_cfk);
    document.getElementById('brandName').innerText = db.params.Nombre_principal;
    
    renderTypes();
}

// LÓGICA DE PRECIOS Y PROMOCIONES
function getActivePrice(p) {
    const hoy = new Date();
    const diaSemana = ["domingo","lunes","martes","miercoles","jueves","viernes","sabado"][hoy.getDay()];
    
    // 1. Validar Promoción
    const esPromoActiva = p.PROMOCION_ACTIVA === "Activa";
    const fechaValida = new Date(p.promocion_hasta) >= hoy;
    const diaValido = p.dias_promocion.toLowerCase().includes(diaSemana) || p.dias_promocion.toLowerCase() === "todos los dias";
    const sedeValida = p.PROMOCION_VALIDA_POR_SEDE_FK.toString().includes(currentSede.ID_SEDE);

    if (esPromoActiva && fechaValida && diaValido && sedeValida) {
        return { precio: p.Precio_promocion_TEMPORAL, esPromo: true };
    }

    // 2. Precio Normal
    return { precio: p.Precio_venta_NORMAL, esPromo: false };
}

function render() {
    const grid = document.getElementById('productGrid');
    const search = document.getElementById('searchInput').value.toLowerCase();
    
    // Decidir tabla según tipo seleccionado
    let data = (currentType.toLowerCase().includes('combo')) ? db.combos : db.productos;
    
    // Filtrar por tipo, subcategoría, búsqueda y etiqueta "Ocultar"
    let filtrados = data.filter(p => {
        const nombre = (p.PRODUCTO || p.nombre_COMBO).toLowerCase();
        const tipoMatch = (p.tipo_producto_fk || p.tipo_producto_fk) === currentType;
        const subMatch = currentSub === "" || (p.ID_CATEGORIA_FK || p.CATEGORIA) === currentSub;
        const oculto = p.etiqueta_fk === "Ocultar";
        return tipoMatch && subMatch && nombre.includes(search) && !oculto;
    });

    grid.innerHTML = filtrados.map(p => {
        const {precio, esPromo} = getActivePrice(p);
        const name = p.PRODUCTO || p.nombre_COMBO;
        const status = p.etiqueta_fk;
        const item = cart.find(i => i.nombre === name);

        return `
            <div class="card ${status === 'Sin Stock' ? 'disabled' : ''}">
                ${status === 'Agotándose' ? '<span class="tag-warning">Agotándose</span>' : ''}
                <img src="${p.foto_producto || p.IMAGEN_PRODUCTO_CATALOGO}">
                <div class="p-name">${name.toUpperCase()}</div>
                <div class="p-price ${esPromo ? 'promo-anim' : ''}">$${parseFloat(precio).toFixed(2)}</div>
                ${status === 'Sin Stock' ? 
                    '<button class="btn-add gray" disabled>SIN STOCK</button>' : 
                    `<button class="btn-add ${item?'added':''}" onclick="addToCart('${name}', ${precio})">
                        ${item ? '<i class="fa fa-check"></i> AGREGADO' : '+ AGREGAR'}
                        ${item ? `<span class="badge">${item.qty}</span>` : ''}
                    </button>`
                }
            </div>
        `;
    }).join('');
}

// WHATSAPP FORMATTER
function sendWhatsApp() {
    const nombre = document.getElementById(deliveryMethod === 'tienda' ? 'nameTienda' : 'nameDelivery').value;
    if(!nombre) return alert("Ingresa tu nombre");

    let subtotal = cart.reduce((a, b) => a + (b.precio * b.qty), 0);
    let itemsTxt = cart.map(i => `- *${i.nombre.toUpperCase()}*\n\`Cant:\` *${i.qty}* | *$\`${(i.precio*i.qty).toFixed(2)}\`*`).join('\n\n');

    let msg = "";
    if(deliveryMethod === 'delivery') {
        msg = `Hola! Soy *${nombre}*, quiero este pedido.\n\n${itemsTxt}\n\n💵 *SUBTOTAL:* *$\`${subtotal.toFixed(2)}\`*\n\n______________________________________\n\n🛵 *ENTREGA POR DELIVERY:*\n\nPor favor dime cuánto sale para esta zona.\n\n${document.getElementById('deliveryLink').value}`;
    } else {
        msg = `Hola! Soy *${nombre}*, Confirmame La disponibilidad para este pedido. Quiero recogerlo en la sede de *${currentSede.NOMBRE_SEDE}*\n\n${itemsTxt}\n\n_______________________________________\n\n💵 *SUBTOTAL:* *$\`${subtotal.toFixed(2)}\`*`;
    }

    window.open(`https://wa.me/${currentSede.TELEFONO.replace('+', '')}?text=${encodeURIComponent(msg)}`);
}

// GPS NATIVO
function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            const link = `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`;
            document.getElementById('deliveryLink').value = link;
            playTap();
        });
    }
}

// HAPTICOS Y SONIDO
function playTap() {
    if (navigator.vibrate) navigator.vibrate(20);
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'sine'; o.frequency.setValueAtTime(600, ctx.currentTime);
    g.gain.setValueAtTime(0.1, ctx.currentTime);
    o.start(); o.stop(ctx.currentTime + 0.05);
}
