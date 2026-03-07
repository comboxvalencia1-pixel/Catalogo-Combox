const API_URL = "https://script.google.com/macros/s/AKfycbyJOqe3K6Q6Eps-eLDNSwasHfcPRadqUH7rRU5HhpcBiiszYVh9uzpaBXCsZ5OjkfhY/exec";

let db = { productos: [], combos: [], sedes: [], params: {}, tipos: [], categorias: [], catCombos: [], etiquetas: [] };
let cart = JSON.parse(localStorage.getItem('combox_cart')) || [];
let currentSede = null, currentType = null, currentSubcat = null, deliveryMethod = 'tienda';

// === AUDIO Y VIBRACIÓN ===
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

// === INICIO Y FETCH SÚPER SIMPLE (LA MAGIA DE LA V1) ===
window.onload = async () => {
    // 1. Ocultar Splash a los 1.5s máximo
    setTimeout(() => { const s = document.getElementById('splash'); if(s) s.style.display = 'none'; }, 1500);

    // 2. Cargar caché para velocidad inmediata
    const cache = localStorage.getItem('combox_cache');
    if(cache) { 
        db = JSON.parse(cache); 
        initApp(); 
    }

    try {
        // 3. Petición simple (Sin CORS estricto) + Date.now() para burlar la caché del navegador
        const res = await fetch(`${API_URL}?action=getAppData&t=${Date.now()}`);
        const freshData = await res.json();
        
        if (freshData && freshData.productos) {
            db = freshData;
            localStorage.setItem('combox_cache', JSON.stringify(db));
            initApp();
        }
    } catch (e) { 
        console.error("Modo Offline activo. Error de red:", e); 
    }
};

function initApp() {
    // PROTECCIÓN: Sede y Tipo por defecto
    if(db.sedes && db.sedes.length > 0) currentSede = db.sedes[0];
    else currentSede = { NOMBRE_SEDE: "General", TELEFONO: "" };

    if(db.tipos && db.tipos.length > 0 && !currentType) currentType = db.tipos[0].id_tipo_producto;

    document.getElementById('currentSedeName').innerText = currentSede.NOMBRE_SEDE;
    document.getElementById('currentSedeNameModal').innerText = currentSede.NOMBRE_SEDE;
    
    // Links del Header
    const tel = (currentSede.TELEFONO || '').toString().replace(/\D/g, '');
    if(document.getElementById('linkWS')) document.getElementById('linkWS').href = `https://wa.me/${tel}`;
    if(document.getElementById('linkIG')) document.getElementById('linkIG').href = currentSede.LINK_INSTAGRAM || '#';
    if(document.getElementById('linkMap')) document.getElementById('linkMap').href = currentSede.LINK_UBICACION || '#';

    renderTypeButtons();
    renderSubcategorias();
    renderProducts();
    updateCartUI();
}

// === RENDERIZADO DE BOTONES ===
function renderTypeButtons() {
    const container = document.getElementById('typeButtons');
    if(!db.tipos) return;
    container.innerHTML = db.tipos.map(t => `
        <button class="${currentType === t.id_tipo_producto ? 'active' : ''}" onclick="selectType('${t.id_tipo_producto}')">
            ${t.tipo_producto}
        </button>
    `).join('');
}

function selectType(id) {
    currentType = id; currentSubcat = null;
    document.getElementById('searchInput').value = "";
    renderTypeButtons(); renderSubcategorias(); renderProducts();
}

function renderSubcategorias() {
    if(!db.tipos || !currentType) return;
    const tipoActivo = db.tipos.find(t => t.id_tipo_producto === currentType);
    const isCombo = (tipoActivo?.tipo_producto || "").toLowerCase().includes('combo');
    const cats = isCombo ? (db.catCombos || []) : (db.categorias || []);
    
    let html = `<span class="subcat-pill ${!currentSubcat ? 'active' : ''}" onclick="currentSubcat=null; renderProducts();">Todos</span>`;
    cats.forEach(c => {
        const id = c.ID_CATEGORIA || c.ID_CATEGORIA_COMBO;
        const name = c.NOMBRE_CATEGORIA || c.NOMBRE_CATEGORIA_COMBO;
        html += `<span class="subcat-pill ${currentSubcat === id ? 'active' : ''}" onclick="currentSubcat='${id}'; renderSubcategorias(); renderProducts();">${name}</span>`;
    });
    document.getElementById('subcatContainer').innerHTML = html;
}

// === LÓGICA DE PRECIOS (PROMO Y MAYORISTA) ===
function getActivePrice(p, qty = 1) {
    let precioNormal = parseFloat(p.Precio_venta_NORMAL) || 0;
    let price = precioNormal;
    let esPromo = false;

    // 1. Promo Activa
    if (p.PROMOCION_ACTIVA === "Activa" && p.Precio_promocion_TEMPORAL) {
        const hoy = new Date();
        const diaSemana = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"][hoy.getDay()];
        const diasValidos = (p.dias_promocion || "todos").toString().toLowerCase();
        const sedeValida = (p.PROMOCION_VALIDA_POR_SEDE_FK || "").includes(currentSede?.NOMBRE_SEDE || "");

        if (sedeValida && (diasValidos.includes("todos") || diasValidos.includes(diaSemana))) {
            price = parseFloat(p.Precio_promocion_TEMPORAL);
            esPromo = true;
        }
    }

    // 2. Mayorista (Sobrescribe si la cantidad es suficiente y es mejor precio)
    const minMayor = parseInt(p.cantidad_minima_mayor) || 0;
    const priceMayor = parseFloat(p.precio_mayor) || 0;
    if (minMayor > 0 && qty >= minMayor && priceMayor > 0) {
        price = priceMayor;
        esPromo = false; // Quita la tachadura visual de promo
    }

    return { price, esPromo, precioNormal };
}

// === RENDER DE PRODUCTOS Y CARRUSEL ===
function renderProducts(filter = "") {
    const container = document.getElementById('productContainer');
    const tipoActivo = (db.tipos || []).find(t => t.id_tipo_producto === currentType);
    const isCombo = (tipoActivo?.tipo_producto || "").toLowerCase().includes('combo');
    
    let items = isCombo ? (db.combos || []) : (db.productos || []);

    // Filtros
    items = items.filter(p => p.tipo_producto_fk === currentType);
    if(filter) {
        const search = filter.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        items = items.filter(p => (p.PRODUCTO || p.nombre_COMBO || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(search));
    }
    if(currentSubcat) items = items.filter(p => (p.ID_CATEGORIA_FK || p.CATEGORIA) === currentSubcat);

    // Filtrar Ocultos
    items = items.filter(p => {
        const tag = (db.etiquetas || []).find(e => e.id_etiqueta === (p.etiqueta_fk || p.Etiqueta_fk))?.etiqueta;
        return tag !== "Ocultar";
    });

    // Carrusel Promos
    const promos = items.filter(p => getActivePrice(p).esPromo);
    renderCarousel(promos);

    // Agrupar por Categorías
    const grupos = {};
    items.forEach(p => {
        let catId = p.ID_CATEGORIA_FK || p.CATEGORIA;
        let cName = (isCombo ? db.catCombos.find(c=>c.ID_CATEGORIA_COMBO===catId)?.NOMBRE_CATEGORIA_COMBO : db.categorias.find(c=>c.ID_CATEGORIA===catId)?.NOMBRE_CATEGORIA) || 'OTROS';
        if(!grupos[cName]) grupos[cName] = [];
        grupos[cName].push(p);
    });

    let html = "";
    for(let cat in grupos) {
        html += `<h3 class="grid-category-title">${cat}</h3><div class="product-grid">`;
        html += grupos[cat].map(p => {
            const { price, esPromo, precioNormal } = getActivePrice(p);
            const tag = (db.etiquetas || []).find(e => e.id_etiqueta === (p.etiqueta_fk || p.Etiqueta_fk))?.etiqueta;
            const isSinStock = tag === "Sin Stock";
            const id = p.ID_PRODUCTO || p.ID_PRODUCTO_VENTA;
            const nombre = (p.PRODUCTO || p.nombre_COMBO || "Producto").toUpperCase();
            
            return `
                <div class="card">
                    ${tag === 'Agotándose' ? '<span class="badge">⚠️ Agotándose</span>' : ''}
                    <img src="${p.foto_producto || p.IMAGEN_PRODUCTO_CATALOGO || 'logo_white.png'}" loading="lazy">
                    <h4>${nombre}</h4>
                    <div class="price">
                        ${esPromo ? `<span style="text-decoration:line-through; color:#999; font-size:0.8rem; display:block;">$${precioNormal.toFixed(2)}</span>` : ''}
                        $${price.toFixed(2)}
                    </div>
                    <button class="btn-add ${isSinStock ? 'disabled' : ''}" ${isSinStock ? 'disabled' : `onclick="addToCart('${id}', this)"`}>
                        ${isSinStock ? 'SIN STOCK' : '<i class="fa-solid fa-plus"></i> AGREGAR'}
                    </button>
                </div>
            `;
        }).join('');
        html += `</div>`;
    }
    container.innerHTML = html || "<p style='text-align:center; padding:30px; font-weight:bold; color:#666;'>No hay productos</p>";
}

function renderCarousel(promos) {
    const sec = document.getElementById('promoSection');
    if(!sec) return;
    if(promos.length === 0) { sec.style.display = 'none'; return; }
    sec.style.display = 'block';
    
    document.getElementById('promoCarousel').innerHTML = promos.map(p => {
        const { price } = getActivePrice(p);
        return `<div class="promo-slide">
            <img src="${p.foto_producto || p.IMAGEN_PRODUCTO_CATALOGO || 'logo_white.png'}" loading="lazy">
            <h4 style="font-size:0.8rem; margin:5px 0;">${(p.PRODUCTO || p.nombre_COMBO).toUpperCase()}</h4>
            <span style="color:var(--primary); font-weight:800;">$${price.toFixed(2)}</span>
        </div>`;
    }).join('');
}

// === CARRITO DE COMPRAS ===
function addToCart(id, btn) {
    playTap();
    btn.classList.add('added');
    btn.innerHTML = '<i class="fa-solid fa-check"></i> AGREGADO';
    
    const item = [...(db.productos||[]), ...(db.combos||[])].find(p => (p.ID_PRODUCTO || p.ID_PRODUCTO_VENTA) === id);
    const inCart = cart.find(c => c.id === id);
    if(inCart) inCart.qty++; else cart.push({ id, raw: item, qty: 1 });
    
    updateCartUI();
    saveCart();
    setTimeout(() => { btn.classList.remove('added'); btn.innerHTML = '<i class="fa-solid fa-plus"></i> AGREGAR'; }, 1500);
}

function updateCartUI() {
    let total = 0, count = 0;
    cart.forEach(c => {
        const { price } = getActivePrice(c.raw, c.qty);
        total += price * c.qty; count += c.qty;
    });
    document.getElementById('cartTotal').innerText = `$${total.toFixed(2)}`;
    document.getElementById('cartCount').innerText = `${count} producto${count !== 1 ? 's' : ''}`;
    document.getElementById('bottomIsland').style.display = count > 0 ? 'flex' : 'none';
    if(document.getElementById('modalTotal')) document.getElementById('modalTotal').innerText = `$${total.toFixed(2)}`;
}

function openCart() { 
    const list = document.getElementById('cartItemsList');
    list.innerHTML = cart.map((c, i) => {
        const name = (c.raw.PRODUCTO || c.raw.nombre_COMBO).toUpperCase();
        const { price } = getActivePrice(c.raw, c.qty);
        return `
            <div class="cart-item">
                <div style="flex:1;">
                    <span class="item-name">${name}</span>
                    <span class="item-price">$${price.toFixed(2)}</span>
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
}

function saveCart() { localStorage.setItem('combox_cart', JSON.stringify(cart)); }
function clearCart() { cart = []; saveCart(); updateCartUI(); closeModal('cartModal'); }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// === CHECKOUT Y WHATSAPP ===
function showDeliveryOptions() { closeModal('cartModal'); document.getElementById('deliveryModal').style.display = 'flex'; selectMethod('tienda'); }
function backToCart() { closeModal('deliveryModal'); openCart(); }

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
        btn.innerHTML = 'Aquí'; alert("Permite el GPS o pega un link.");
    });
}

function checkForm() {
    const btn = document.getElementById('btnWhatsApp');
    if (deliveryMethod === 'tienda') btn.disabled = !document.getElementById('clientName').value.trim();
    else btn.disabled = !(document.getElementById('locationLink').value.trim() && document.getElementById('receiverName').value.trim());
}
document.addEventListener('input', e => { if (e.target.matches('#clientName, #locationLink, #receiverName')) checkForm(); });

function finalizarPedido() {
    const name = (document.getElementById('clientName').value || document.getElementById('receiverName').value).trim();
    let subtotal = 0;
    
    let itemsTexto = cart.map(c => {
        const { price } = getActivePrice(c.raw, c.qty);
        subtotal += price * c.qty;
        return `- *${(c.raw.PRODUCTO || c.raw.nombre_COMBO).toUpperCase()}*\n\`Cant:\`  *${c.qty}* |  *$\`${(price * c.qty).toFixed(2)}\`*`;
    }).join('\n\n');

    let msg = "";
    if (deliveryMethod === 'tienda') {
        msg = `Hola! Soy *${name}*, Confirmame La disponibilidad para este pedido. Quiero recogerlo en la sede de *${currentSede.NOMBRE_SEDE}*\n\n${itemsTexto}\n\n_______________________________________\n\n💵 *SUBTOTAL:* *$\`${subtotal.toFixed(2)}\`*`;
    } else {
        const gps = document.getElementById('locationLink').value;
        msg = `Hola! Soy *${name}*, quiero este pedido.\n\n${itemsTexto}\n\n______________________________________\n\n💵 *SUBTOTAL:* *$\`${subtotal.toFixed(2)}\`*\n\n______________________________________\n\n🛵 *ENTREGA POR DELIVERY:*\n\nPor favor dime cuánto sale para esta zona.\n\n${gps}`;
    }

    const tel = (currentSede.TELEFONO || '').toString().replace(/\D/g, '');
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank');
}

// Modal Sedes y Horarios
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
    initApp(); closeModal('sedeModal');
}
function toggleHorarios() { alert(`🕒 HORARIOS ${currentSede.NOMBRE_SEDE}\nLunes: ${currentSede.LUNES_APERTURA}-${currentSede.LUNES_CIERRE}\nMartes: ${currentSede.MARTES_APERTURA}-${currentSede.MARTES_CIERRE}`); }
