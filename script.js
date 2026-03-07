const API_URL = "TU_URL_DE_APPS_SCRIPT_AQUI"; // REEMPLAZA ESTO

let db = { productos: [], combos: [], sedes: [], params: {}, tipos: [], categorias: [], catCombos: [], etiquetas: [] };
let cart = JSON.parse(localStorage.getItem('combox_cart')) || [];
let currentSede = null, currentType = null, currentSubcat = null, deliveryMethod = 'tienda';

// Audio y Feedback Háptico
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTap() {
    try {
        const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.type = 'sine'; osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start(); osc.stop(audioCtx.currentTime + 0.1);
        if (navigator.vibrate) navigator.vibrate(50);
    } catch(e){}
}

// Ocultar header en Scroll Down
let lastScroll = 0;
window.addEventListener('scroll', () => {
    const header = document.getElementById('mainHeader');
    const currentScroll = window.pageYOffset;
    if (currentScroll > 50 && currentScroll > lastScroll) {
        header.classList.add('hidden');
    } else {
        header.classList.remove('hidden');
    }
    lastScroll = currentScroll;
});

// Inicialización
window.onload = async () => {
    setTimeout(() => { const s = document.getElementById('splash'); if(s) s.style.display = 'none'; }, 1000); // 1 Segundo Splash
    
    // OFFLINE FIRST (Caché local)
    const cachedData = localStorage.getItem('combox_cache_db');
    if (cachedData) {
        db = JSON.parse(cachedData);
        initApp();
    }

    try {
        const res = await fetch(`${API_URL}?action=getAppData`, { mode: 'cors', redirect: 'follow' });
        if(res.ok) {
            db = await res.json();
            localStorage.setItem('combox_cache_db', JSON.stringify(db));
            initApp();
        }
    } catch (e) { console.error("Modo Offline"); }
};

function initApp() {
    if(!db.sedes || db.sedes.length === 0) return;
    if(!currentSede) currentSede = db.sedes[0];
    if(!currentType && db.tipos.length > 0) currentType = db.tipos[0].id_tipo_producto;

    document.getElementById('currentSedeName').innerText = currentSede.NOMBRE_SEDE;
    document.getElementById('currentSedeNameModal').innerText = currentSede.NOMBRE_SEDE;
    const tel = (currentSede.TELEFONO || '').toString().replace(/\D/g, '');
    document.getElementById('linkWS').href = `https://wa.me/${tel}`;
    document.getElementById('linkIG').href = currentSede.LINK_INSTAGRAM || '#';
    document.getElementById('linkMap').href = currentSede.LINK_UBICACION || '#';

    renderTypeButtons();
    renderSubcategorias();
    renderProducts();
    updateCartUI();
    
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
}

// Búsqueda Inteligente y Categorías
function normalizeStr(str) { return (str||"").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }

function selectType(id) {
    currentType = id; currentSubcat = null;
    document.getElementById('searchInput').value = "";
    renderTypeButtons(); renderSubcategorias(); renderProducts();
}

function renderTypeButtons() {
    document.getElementById('typeButtons').innerHTML = db.tipos.map(t => `
        <button class="${currentType === t.id_tipo_producto ? 'active' : ''}" onclick="selectType('${t.id_tipo_producto}')">
            ${t.tipo_producto}
        </button>
    `).join('');
}

function renderSubcategorias() {
    const isCombo = db.tipos.find(t => t.id_tipo_producto === currentType)?.tipo_producto.toLowerCase().includes('combo');
    const cats = isCombo ? db.catCombos : db.categorias;
    
    let html = `<span class="subcat-pill ${!currentSubcat ? 'active' : ''}" onclick="currentSubcat=null; renderProducts();">Todos</span>`;
    cats.forEach(c => {
        const id = c.ID_CATEGORIA || c.ID_CATEGORIA_COMBO;
        const name = c.NOMBRE_CATEGORIA || c.NOMBRE_CATEGORIA_COMBO;
        html += `<span class="subcat-pill ${currentSubcat === id ? 'active' : ''}" onclick="currentSubcat='${id}'; renderSubcategorias(); renderProducts();">${name}</span>`;
    });
    document.getElementById('subcatContainer').innerHTML = html;
}

// Lógica de Precios (Promociones y Mayorista)
function getActivePrice(p, isCart = false, currentQty = 0) {
    let precioNormal = parseFloat(p.Precio_venta_NORMAL) || 0;
    let precio = precioNormal;
    let esPromo = false;

    // Lógica Promoción
    if (p.PROMOCION_ACTIVA === "Activa" && p.Precio_promocion_TEMPORAL) {
        const hoy = new Date(); hoy.setHours(0,0,0,0);
        const fHasta = p.promocion_hasta ? new Date(p.promocion_hasta) : null;
        const diasPromo = (p.dias_promocion || "todos").toLowerCase();
        const diaHoy = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"][hoy.getDay()];
        const sedeValida = (p.PROMOCION_VALIDA_POR_SEDE_FK || "").includes(currentSede.NOMBRE_SEDE) || !p.PROMOCION_VALIDA_POR_SEDE_FK;

        if ((!fHasta || fHasta >= hoy) && (diasPromo.includes("todos") || diasPromo.includes(diaHoy)) && sedeValida) {
            precio = parseFloat(p.Precio_promocion_TEMPORAL) || precioNormal;
            esPromo = true;
        }
    }

    // Lógica Mayorista (Aplica si la cantidad supera el mínimo y si no hay promo que sea más barata)
    if (isCart && currentQty > 0) {
        const pMayor = parseFloat(p.precio_mayor) || 0;
        const minMayor = parseInt(p.cantidad_minima_mayor) || 0;
        if (minMayor > 0 && currentQty >= minMayor && pMayor > 0 && pMayor < precio) {
            precio = pMayor;
            esPromo = false; // El precio mayorista reemplaza la visualización de promo
        }
    }

    return { precio, precioNormal, esPromo };
}

// Renderizar Productos
function renderProducts(filter = "") {
    filter = normalizeStr(filter);
    const isCombo = db.tipos.find(t => t.id_tipo_producto === currentType)?.tipo_producto.toLowerCase().includes('combo');
    let items = isCombo ? db.combos : db.productos;
    
    items = items.filter(p => p.tipo_producto_fk === currentType);
    if(filter) items = items.filter(p => normalizeStr(p.PRODUCTO || p.nombre_COMBO).includes(filter));
    if(currentSubcat) items = items.filter(p => (p.ID_CATEGORIA_FK || p.CATEGORIA) === currentSubcat);

    // Separar promociones para el carrusel
    const promos = items.filter(p => getActivePrice(p).esPromo);
    renderCarousel(promos);

    // Render Grid agrupado por categoría
    const grupos = {};
    items.forEach(p => {
        // Filtrar Ocultos
        const tag = db.etiquetas.find(e => e.id_etiqueta === p.etiqueta_fk)?.etiqueta;
        if(tag === 'Ocultar') return;

        let catId = p.ID_CATEGORIA_FK || p.CATEGORIA;
        let cName = (isCombo ? db.catCombos.find(c=>c.ID_CATEGORIA_COMBO===catId)?.NOMBRE_CATEGORIA_COMBO : db.categorias.find(c=>c.ID_CATEGORIA===catId)?.NOMBRE_CATEGORIA) || 'OTROS';
        if(!grupos[cName]) grupos[cName] = [];
        grupos[cName].push(p);
    });

    let html = "";
    for(let cat in grupos) {
        html += `<h3 class="grid-category-title">${cat}</h3><div class="product-grid">`;
        html += grupos[cat].map(p => createCardHTML(p)).join('');
        html += `</div>`;
    }
    document.getElementById('productContainer').innerHTML = html || "<p style='text-align:center; padding:20px;'>No hay resultados</p>";
}

function renderCarousel(promos) {
    const sec = document.getElementById('promoSection');
    if(promos.length === 0) { sec.style.display = 'none'; return; }
    sec.style.display = 'block';
    
    document.getElementById('promoCarousel').innerHTML = promos.map(p => {
        const { precio } = getActivePrice(p);
        return `<div class="promo-slide">
            <img src="${p.foto_producto || p.IMAGEN_PRODUCTO_CATALOGO || 'logo_white.png'}" loading="lazy">
            <h4 style="font-size:0.8rem; margin:5px 0;">${(p.PRODUCTO || p.nombre_COMBO).toUpperCase()}</h4>
            <span style="color:var(--primary); font-weight:800;">$${precio.toFixed(2)}</span>
        </div>`;
    }).join('');
}

function createCardHTML(p) {
    const { precio, precioNormal, esPromo } = getActivePrice(p);
    const tag = db.etiquetas.find(e => e.id_etiqueta === p.etiqueta_fk)?.etiqueta;
    const id = p.ID_PRODUCTO || p.ID_PRODUCTO_VENTA;
    const qtyInCart = cart.find(c => c.id === id)?.qty || 0;
    const isSinStock = tag === 'Sin Stock';
    
    // Generar ID único seguro para el DOM
    const btnId = 'btn_' + btoa(encodeURIComponent(id)).replace(/=/g, '');

    return `
        <div class="card">
            ${tag === 'Agotándose' ? '<span class="badge">⚠️ Agotándose</span>' : ''}
            <img src="${p.foto_producto || p.IMAGEN_PRODUCTO_CATALOGO || 'logo_white.png'}" loading="lazy">
            <h4>${(p.PRODUCTO || p.nombre_COMBO).toUpperCase()}</h4>
            
            <div class="price">
                ${esPromo ? `<span style="text-decoration:line-through; color:#999; font-size:0.8rem; display:block;">$${precioNormal.toFixed(2)}</span>` : ''}
                $${precio.toFixed(2)}
            </div>
            
            <button id="${btnId}" class="btn-add ${isSinStock ? 'disabled' : ''}" onclick="addAnim('${id}', '${btnId}')" ${isSinStock ? 'disabled' : ''}>
                <i class="fa-solid fa-plus"></i> ${isSinStock ? 'SIN STOCK' : 'AGREGAR'}
                ${qtyInCart > 0 ? `<span class="qty-badge">${qtyInCart}</span>` : ''}
            </button>
        </div>
    `;
}

// Carrito y Animaciones
function addAnim(itemId, btnId) {
    playTap();
    const btn = document.getElementById(btnId);
    
    // Animación AGREGADO
    btn.classList.add('added');
    btn.innerHTML = `<i class="fa-solid fa-check"></i> AGREGADO`;
    
    // Lógica agregar
    const rawItem = db.productos.find(p => p.ID_PRODUCTO === itemId) || db.combos.find(c => c.ID_PRODUCTO_VENTA === itemId);
    const ext = cart.find(c => c.id === itemId);
    if(ext) ext.qty++; else cart.push({ id: itemId, raw: rawItem, qty: 1 });
    
    updateCartUI();
    saveCart();

    // Restaurar botón visualmente (manteniendo el badge de qty)
    setTimeout(() => {
        const currentQty = cart.find(c => c.id === itemId)?.qty || 0;
        btn.classList.remove('added');
        btn.innerHTML = `<i class="fa-solid fa-plus"></i> AGREGAR <span class="qty-badge">${currentQty}</span>`;
    }, 1500);
}

function updateCartUI() {
    let total = 0, count = 0;
    cart.forEach(c => {
        const { precio } = getActivePrice(c.raw, true, c.qty);
        total += precio * c.qty;
        count += c.qty;
    });
    document.getElementById('cartTotal').innerText = `$${total.toFixed(2)}`;
    document.getElementById('cartCount').innerText = `${count} producto${count !== 1 ? 's' : ''}`;
    document.getElementById('bottomIsland').style.display = count > 0 ? 'flex' : 'none';
    document.getElementById('modalTotal').innerText = `$${total.toFixed(2)}`;
}

function openCart() {
    const list = document.getElementById('cartItemsList');
    list.innerHTML = cart.map((c, i) => {
        const name = (c.raw.PRODUCTO || c.raw.nombre_COMBO).toUpperCase();
        const { precio } = getActivePrice(c.raw, true, c.qty);
        return `
            <div class="cart-item">
                <div style="flex:1;">
                    <span class="item-name">${name}</span>
                    <span class="item-price">$${precio.toFixed(2)}</span>
                </div>
                <div class="item-qty">
                    <button onclick="changeQty(${i}, -1)">-</button>
                    <span>${c.qty}</span>
                    <button onclick="changeQty(${i}, 1)">+</button>
                </div>
            </div>
        `;
    }).join('');
    updateCartUI();
    document.getElementById('cartModal').style.display = 'flex';
}

function changeQty(index, delta) {
    cart[index].qty += delta;
    if(cart[index].qty <= 0) cart.splice(index, 1);
    saveCart(); updateCartUI(); openCart();
    if(cart.length === 0) closeModal('cartModal');
    renderProducts(document.getElementById('searchInput').value); // Update UI badges
}

function clearCart() { cart = []; saveCart(); updateCartUI(); closeModal('cartModal'); renderProducts(); }
function saveCart() { localStorage.setItem('combox_cart', JSON.stringify(cart)); }

// Checkout & WhatsApp Flow
function showDeliveryOptions() { closeModal('cartModal'); document.getElementById('deliveryModal').style.display = 'flex'; selectMethod('tienda'); }
function backToCart() { closeModal('deliveryModal'); openCart(); }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

function selectMethod(m) {
    deliveryMethod = m;
    document.getElementById('btnStore').classList.toggle('active', m === 'tienda');
    document.getElementById('btnDelivery').classList.toggle('active', m === 'delivery');
    document.getElementById('storeInfo').style.display = m === 'tienda' ? 'block' : 'none';
    document.getElementById('deliveryInfo').style.display = m === 'delivery' ? 'block' : 'none';
    checkForm();
}

function getLocation() {
    if(!navigator.geolocation) return alert("GPS no soportado");
    const btn = document.querySelector('.btn-gps');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    navigator.geolocation.getCurrentPosition(pos => {
        document.getElementById('locationLink').value = `http://googleusercontent.com/maps.google.com/${pos.coords.latitude},${pos.coords.longitude}`;
        btn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Aquí';
        checkForm();
    }, () => {
        btn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Aquí';
        alert("Permite acceso al GPS");
    });
}

function checkForm() {
    const btn = document.getElementById('btnWhatsApp');
    if (deliveryMethod === 'tienda') {
        btn.disabled = !document.getElementById('clientName').value.trim();
    } else {
        btn.disabled = !(document.getElementById('locationLink').value.trim() && document.getElementById('receiverName').value.trim());
    }
}
document.addEventListener('input', e => { if (e.target.matches('#clientName, #locationLink, #receiverName')) checkForm(); });

function finalizarPedido() {
    const name = (document.getElementById('clientName').value || document.getElementById('receiverName').value).trim();
    let msg = "";

    if (deliveryMethod === 'delivery') {
        msg = `Hola! Soy *${name}*, quiero este pedido.\n\n`;
        cart.forEach(c => {
            const { precio } = getActivePrice(c.raw, true, c.qty);
            msg += `- *${(c.raw.PRODUCTO || c.raw.nombre_COMBO).toUpperCase()}*\n\`Cant:\`  *${c.qty}* |  *$${precio.toFixed(2)}*\n\n`;
        });
        msg += `💵 *SUBTOTAL:* *${document.getElementById('cartTotal').innerText}*\n\n______________________________________\n\n`;
        msg += `🛵 *ENTREGA POR DELIVERY:*\n\nPor favor dime cuánto sale para esta zona.\n\n${document.getElementById('locationLink').value}`;
    } else {
        msg = `Hola! Soy *${name}*, Confirmame La disponibilidad para este pedido. Quiero recogerlo en la sede de *${currentSede.NOMBRE_SEDE}*\n\n`;
        cart.forEach(c => {
            const { precio } = getActivePrice(c.raw, true, c.qty);
            msg += `- *${(c.raw.PRODUCTO || c.raw.nombre_COMBO).toUpperCase()}*\n\`Cant:\`  *${c.qty}* |  *$${precio.toFixed(2)}*\n\n`;
        });
        msg += `_______________________________________\n\n💵 *SUBTOTAL:* *${document.getElementById('cartTotal').innerText}*\n`;
    }

    const tel = (currentSede.TELEFONO || '').toString().replace(/\D/g, '');
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank');
}

// Modal Sedes
function openSedeModal() {
    document.getElementById('sedeList').innerHTML = db.sedes.map(s => `
        <div class="sede-item ${currentSede && currentSede.ID_SEDE === s.ID_SEDE ? 'active' : ''}" onclick="setSede('${s.ID_SEDE}')">
            ${s.NOMBRE_SEDE}
        </div>
    `).join('');
    document.getElementById('sedeModal').style.display = 'flex';
}
function setSede(id) {
    currentSede = db.sedes.find(s => s.ID_SEDE === id);
    document.getElementById('currentSedeName').innerText = currentSede.NOMBRE_SEDE;
    document.getElementById('currentSedeNameModal').innerText = currentSede.NOMBRE_SEDE;
    closeModal('sedeModal'); renderProducts();
}
function toggleHorarios() { alert(`Horarios ${currentSede.NOMBRE_SEDE}\nLunes: ${currentSede.LUNES_APERTURA}-${currentSede.LUNES_CIERRE}\nMartes: ${currentSede.MARTES_APERTURA}-${currentSede.MARTES_CIERRE}`); }
