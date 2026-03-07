// ====================================================
// CONFIGURACIÓN INICIAL
// ====================================================

// URL del Google Apps Script que devuelve los datos en JSON
const API_URL = "https://script.google.com/macros/s/AKfycbyJOqe3K6Q6Eps-eLDNSwasHfcPRadqUH7rRU5HhpcBiiszYVh9uzpaBXCsZ5OjkfhY/exec";

// Base de datos: se llenará con la respuesta de la API
let db = {
    productos: [],
    combos: [],
    sedes: [],
    params: {},
    tipos: [],
    etiquetas: [],
    categorias: [],
    catCombos: []
};

// Carrito: se recupera de localStorage o se inicia vacío
let cart = JSON.parse(localStorage.getItem('combox_cart')) || [];

// Variables de estado
let currentSede = null;           // Sede seleccionada actualmente
let currentType = null;           // ID del tipo de producto seleccionado
let currentSubcat = null;         // Subcategoría seleccionada (null = todas)
let deliveryMethod = 'tienda';     // Método de entrega: 'tienda' o 'delivery'

// ====================================================
// FEEDBACK TÁCTIL (sonido + vibración)
// ====================================================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

/**
 * Reproduce un sonido sintético y vibra (si el dispositivo lo soporta).
 * Se llama en cada clic en "AGREGAR".
 */
function playTap() {
    // Sonido
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
    // Vibración (si está disponible)
    if (navigator.vibrate) navigator.vibrate(50);
}

// ====================================================
// FUNCIONES DE NORMALIZACIÓN PARA BÚSQUEDA INTELIGENTE
// ====================================================

/**
 * Elimina tildes y diacríticos de una cadena, y la convierte a minúsculas.
 * @param {string} str - Cadena a normalizar.
 * @returns {string} Cadena normalizada.
 */
function normalizeString(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// ====================================================
// INICIALIZACIÓN DE LA APLICACIÓN
// ====================================================

window.onload = async () => {
    // Timeout de seguridad: si en 5 segundos no se ha cargado, se oculta el splash
    const safetyTimer = setTimeout(hideSplash, 5000);

    try {
        const res = await fetch(`${API_URL}?action=getAppData`);
        
        if (!res.ok) {
             throw new Error(`HTTP error! Status: ${res.status}`);
        }

        db = await res.json();

        // Asegurar que todos los arrays existan
        db.productos = db.productos || [];
        db.combos = db.combos || [];
        db.sedes = db.sedes || [];
        db.params = db.params || {};
        db.tipos = db.tipos || [];
        db.etiquetas = db.etiquetas || [];
        db.categorias = db.categorias || [];
        db.catCombos = db.catCombos || [];

        // Aplicar dinamismo desde los parámetros de la hoja CONFIG
        document.documentElement.style.setProperty('--primary', db.params.codigo_color_fk || '#E53935');
        const brandElement = document.getElementById('brandName');
        if (brandElement) {
             brandElement.innerText = db.params.Nombre_principal || "COMBOX";
        }

        // Mostrar mensaje de bienvenida si existe
        if (db.params.mensaje_bienvenida) {
            alert(db.params.mensaje_bienvenida); // Se puede reemplazar por un toast elegante
        }

        // Si la página está desactivada, mostrar mensaje de mantenimiento
        if (db.params.pagina_funcional === "no") {
            document.body.innerHTML = `<div class='mantenimiento' style='padding:50px; text-align:center;'><h1>${db.params.mensaje_bienvenida || 'SITIO EN MANTENIMIENTO'}</h1></div>`;
            hideSplash();
            clearTimeout(safetyTimer);
            return;
        }

        // Inicializar la interfaz
        initApp();
        clearTimeout(safetyTimer);
        setTimeout(hideSplash, 1000); // Ocultar splash tras 1 segundo
    } catch (e) {
        console.error("Error cargando datos:", e);
        hideSplash(); // Ocultar splash aunque haya error
    }
};

/**
 * Oculta el splash con transición y lo elimina del DOM.
 */
function hideSplash() {
    const s = document.getElementById('splash');
    if (s) {
        s.style.opacity = '0';
        setTimeout(() => s.remove(), 800);
    }
}

/**
 * Inicializa la aplicación después de cargar los datos.
 */
function initApp() {
    // 1. Establecer el primer Tipo de Producto dinámicamente
    if (db.tipos && db.tipos.length > 0) {
        currentType = db.tipos[0].id_tipo_producto;
    }

    // 2. Seleccionar la primera sede por defecto
    if (db.sedes.length > 0) {
        currentSede = db.sedes[0];
        actualizarEnlacesSede();
    }

    // 3. Renderizar todos los componentes
    renderTypeButtons();
    renderSubcategorias();
    renderProducts();
    renderPromoCarousel();
    updateCartUI();

    // Registrar Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js');
    }
}

// ====================================================
// SELECCIÓN DE SEDES
// ====================================================

function openSedeModal() {
    renderSedes();
    const modal = document.getElementById('sedeModal');
    if (modal) modal.style.display = 'flex';
}

function renderSedes() {
    const container = document.getElementById('sedeList');
    if (!container) return;
    container.innerHTML = '';
    db.sedes.forEach(sede => {
        const item = document.createElement('div');
        item.className = `sede-item ${currentSede && currentSede.ID_SEDE === sede.ID_SEDE ? 'active' : ''}`;
        item.innerHTML = `
            <div>
                <div class="sede-name">${sede.NOMBRE_SEDE}</div>
                <div class="sede-address">${sede.LINK_UBICACION ? 'Ver mapa' : ''}</div>
            </div>
        `;
        item.onclick = () => setSede(sede.ID_SEDE);
        container.appendChild(item);
    });
}

function setSede(sedeId) {
    const nuevaSede = db.sedes.find(s => s.ID_SEDE === sedeId);
    if (!nuevaSede) return;
    currentSede = nuevaSede;
    actualizarEnlacesSede();
    closeModal('sedeModal');
    // Refrescar productos para que las promociones por sede se actualicen
    renderProducts();
    renderPromoCarousel();
}

/**
 * Actualiza los enlaces del header según la sede actual.
 */
function actualizarEnlacesSede() {
    const currentSedeNameElement = document.getElementById('currentSedeName');
    if (currentSedeNameElement) {
        currentSedeNameElement.innerText = currentSede.NOMBRE_SEDE || 'Sede';
    }
    
    const currentSedeNameModalElement = document.getElementById('currentSedeNameModal');
    if(currentSedeNameModalElement){
         currentSedeNameModalElement.innerText = currentSede.NOMBRE_SEDE || 'Sede';
    }

    const tel = (currentSede.TELEFONO || '').toString().replace(/\D/g, '');
    const linkWSElement = document.getElementById('linkWS');
    if (linkWSElement) linkWSElement.href = `https://wa.me/${tel}`;

    const linkIGElement = document.getElementById('linkIG');
    if(linkIGElement) linkIGElement.href = currentSede.LINK_INSTAGRAM || '#';

    const linkMapElement = document.getElementById('linkMap');
    if(linkMapElement) linkMapElement.href = currentSede.LINK_UBICACION || '#';
}

// ====================================================
// TIPOS DE PRODUCTO Y SUBCATEGORÍAS (con detección por nombre)
// ====================================================

function renderTypeButtons() {
    const container = document.getElementById('typeButtons');
    if (!container) return;
    container.innerHTML = '';
    db.tipos.forEach(tipo => {
        const btn = document.createElement('button');
        btn.innerText = tipo.tipo_producto;
        btn.dataset.id = tipo.id_tipo_producto;
        btn.onclick = () => selectType(tipo.id_tipo_producto);
        if (tipo.id_tipo_producto === currentType) btn.classList.add('active');
        container.appendChild(btn);
    });
}

function selectType(typeId) {
    currentType = typeId;
    currentSubcat = null; // Reiniciar subcategoría al cambiar de tipo
    document.querySelectorAll('#typeButtons button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.id === typeId);
    });
    renderSubcategorias();
    renderProducts();
}

function renderSubcategorias() {
    const container = document.getElementById('subcatContainer');
    if (!container) return;
    container.innerHTML = '';

    // Buscar el tipo seleccionado por su ID
    const tipoSeleccionado = db.tipos.find(t => t.id_tipo_producto === currentType);
    if (!tipoSeleccionado) return;

    const nombreTipo = tipoSeleccionado.tipo_producto.toLowerCase();
    let categorias = [];

    // Decidir qué lista de subcategorías usar según el nombre
    if (nombreTipo.includes('individual')) {
        categorias = db.categorias;
    } else if (nombreTipo.includes('combo')) {
        categorias = db.catCombos;
    } else {
        categorias = []; // Otros tipos no tienen subcategorías
    }

    // Opción "Todos"
    const allPill = document.createElement('span');
    allPill.className = `subcat-pill ${!currentSubcat ? 'active' : ''}`;
    allPill.innerText = 'Todos';
    allPill.onclick = () => {
        currentSubcat = null;
        document.querySelectorAll('.subcat-pill').forEach(p => p.classList.remove('active'));
        allPill.classList.add('active');
        renderProducts();
    };
    container.appendChild(allPill);

    // Categorías individuales
    categorias.forEach(cat => {
        const idCat = cat.ID_CATEGORIA || cat.ID_CATEGORIA_COMBO;
        const nombreCat = cat.NOMBRE_CATEGORIA || cat.NOMBRE_CATEGORIA_COMBO;

        const pill = document.createElement('span');
        pill.className = `subcat-pill ${currentSubcat === idCat ? 'active' : ''}`;
        pill.innerText = nombreCat;
        pill.onclick = () => {
            currentSubcat = idCat;
            document.querySelectorAll('.subcat-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            renderProducts();
        };
        container.appendChild(pill);
    });
}

// ====================================================
// LÓGICA DE PRECIOS (MEJORADA)
// ====================================================

/**
 * Calcula el precio activo de un producto según promoción y cantidad mayorista.
 * @param {Object} item - Producto o combo.
 * @param {number} qty - Cantidad (para evaluar mayorista).
 * @returns {Object} - { precio, label } donde label puede ser 'PROMO', 'MAYOR' o 'NORMAL'.
 */
function getActivePrice(item, qty = 1) {
    let precioNormal = parseFloat(item.Precio_venta_NORMAL || 0);
    let precioFinal = precioNormal;
    let label = 'NORMAL';

    // 1. Evaluar Promoción primero (suele ser la oferta más agresiva)
    if (item.PROMOCION_ACTIVA === "Activa") {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0); // Normalizar a medianoche
        const fechaHasta = item.promocion_hasta ? new Date(item.promocion_hasta) : null;
        if (fechaHasta) fechaHasta.setHours(0, 0, 0, 0);

        // Validar fecha: no debe haber expirado (incluye todo el día de vencimiento)
        const fechaValida = !fechaHasta || fechaHasta >= hoy;

        // Validar día de la semana
        const diasSemana = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
        const diaHoy = diasSemana[hoy.getDay()].toLowerCase();
        const diasPromo = (item.dias_promocion || "").toLowerCase();
        const diaValido = diasPromo.includes("todos") || diasPromo.includes(diaHoy);

        // Validar sede: puede venir una o varias separadas por comas (IDs o nombres)
        const sedesValidas = (item.PROMOCION_VALIDA_POR_SEDE_FK || "").split(',').map(s => s.trim());
        const sedeValida = sedesValidas.length === 0 ||
            sedesValidas.includes(currentSede.NOMBRE_SEDE) ||
            sedesValidas.includes(currentSede.ID_SEDE);

        if (fechaValida && diaValido && sedeValida) {
            precioFinal = parseFloat(item.Precio_promocion_TEMPORAL) || precioNormal;
            label = 'PROMO';
        }
    }

    // 2. Mayorista: si aplica y es más barato que el precio actual, se usa
    const pMayor = parseFloat(item.precio_mayor || 0);
    const minMayor = parseInt(item.cantidad_minima_mayor || 0);

    if (minMayor > 0 && qty >= minMayor && pMayor > 0 && pMayor < precioFinal) {
        precioFinal = pMayor;
        label = 'MAYOR';
    }

    return { precio: precioFinal, label };
}

// ====================================================
// RENDERIZADO DE PRODUCTOS (con búsqueda inteligente)
// ====================================================

/**
 * Renderiza los productos en el contenedor, aplicando filtros de búsqueda, tipo y subcategoría.
 * @param {string} query - Texto de búsqueda (opcional).
 */
function renderProducts(query = "") {
    const container = document.getElementById('productContainer');
    if (!container) return;
    container.innerHTML = "";

    const tipoSeleccionado = db.tipos.find(t => t.id_tipo_producto === currentType);
    if (!tipoSeleccionado) return;

    const nombreTipo = tipoSeleccionado.tipo_producto.toLowerCase();
    let items = [];

    // Selección dinámica de la fuente de datos según el nombre del tipo
    if (nombreTipo.includes('individual')) {
        items = db.productos;
    } else if (nombreTipo.includes('combo')) {
        items = db.combos;
    } else {
        // Para otros tipos (ej: "Servicios"), filtramos productos por el ID del tipo
        items = db.productos.filter(p => p.tipo_producto_fk === currentType);
    }

    // Filtrar por búsqueda (usando normalización)
    if (query) {
        const normalizedQuery = normalizeString(query);
        items = items.filter(i => {
            const nombre = i.PRODUCTO || i.nombre_COMBO || '';
            return normalizeString(nombre).includes(normalizedQuery);
        });
    }

    // Filtrar por subcategoría seleccionada
    if (currentSubcat) {
        items = items.filter(i => (i.ID_CATEGORIA_FK || i.CATEGORIA) === currentSubcat);
    }

    // Excluir productos con etiqueta "Ocultar"
    const etiquetaOcultar = db.etiquetas.find(e => e.etiqueta === 'Ocultar')?.id_etiqueta;
    items = items.filter(i => i.etiqueta_fk !== etiquetaOcultar);

    // Agrupar por nombre de categoría (para mostrar títulos)
    const grupos = {};
    items.forEach(i => {
        let catId = i.ID_CATEGORIA_FK || i.CATEGORIA;
        let catNombre = 'Otros';
        if (nombreTipo.includes('individual')) {
            const cat = db.categorias.find(c => c.ID_CATEGORIA === catId);
            catNombre = cat ? cat.NOMBRE_CATEGORIA : 'Sin categoría';
        } else if (nombreTipo.includes('combo')) {
            const cat = db.catCombos.find(c => c.ID_CATEGORIA_COMBO === catId);
            catNombre = cat ? cat.NOMBRE_CATEGORIA_COMBO : 'Sin categoría';
        } else {
            catNombre = 'Otros';
        }
        if (!grupos[catNombre]) grupos[catNombre] = [];
        grupos[catNombre].push(i);
    });

    // Renderizar cada grupo
    for (let cat in grupos) {
        const titulo = document.createElement('h3');
        titulo.className = "grid-category-title";
        titulo.innerText = cat.toUpperCase();
        container.appendChild(titulo);

        const grid = document.createElement('div');
        grid.className = "product-grid";
        grupos[cat].forEach(item => {
            grid.appendChild(createCard(item));
        });
        container.appendChild(grid);
    }
}

/**
 * Crea una tarjeta de producto (DOM element) con todos sus datos y botón.
 * @param {Object} item - Producto o combo.
 * @returns {HTMLElement} Tarjeta lista para insertar.
 */
function createCard(item) {
    const card = document.createElement('div');
    card.className = "card";
    const { precio } = getActivePrice(item);

    // Obtener etiqueta (estado del producto)
    const etiquetaObj = db.etiquetas.find(e => e.id_etiqueta === item.etiqueta_fk);
    const etiqueta = etiquetaObj ? etiquetaObj.etiqueta : 'Disponible';

    // Imagen
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.src = item.foto_producto || item.IMAGEN_PRODUCTO_CATALOGO || 'logo_white.png';
    img.alt = item.PRODUCTO || item.nombre_COMBO;
    card.appendChild(img);

    // Nombre
    const nombre = document.createElement('h4');
    nombre.innerText = (item.PRODUCTO || item.nombre_COMBO || '').toUpperCase();
    card.appendChild(nombre);

    // Badge si está agotándose
    if (etiqueta === 'Agotándose') {
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.innerText = '⚠️ AGOTÁNDOSE';
        card.appendChild(badge);
    }

    // Precio
    const priceSpan = document.createElement('span');
    priceSpan.className = 'price';
    priceSpan.innerText = `$${precio.toFixed(2)}`;
    card.appendChild(priceSpan);

    // Botón Agregar
    const btn = document.createElement('button');
    btn.className = 'btn-add';
    if (etiqueta === 'Sin Stock') {
        btn.disabled = true;
        btn.classList.add('disabled');
        btn.innerHTML = 'SIN STOCK';
    } else {
        btn.innerHTML = '<i class="fa-solid fa-plus"></i> AGREGAR';
        btn.onclick = (e) => {
            e.stopPropagation(); // Evita que el clic en el botón abra el carrito (si el padre lo tuviera)
            addToCart(item.ID_PRODUCTO || item.ID_PRODUCTO_VENTA, btn);
        };
    }
    card.appendChild(btn);

    return card;
}

// ====================================================
// CARRUSEL DE PROMOCIONES (con combos incluidos)
// ====================================================

function renderPromoCarousel() {
    const container = document.getElementById('promoCarousel');
    if (!container) return;
    container.innerHTML = '';

    // Combinar productos y combos
    const todos = [...db.productos, ...db.combos];
    const promos = todos.filter(item => {
        if (item.PROMOCION_ACTIVA !== 'Activa') return false;
        const { label } = getActivePrice(item, 1);
        return label === 'PROMO';
    }).slice(0, 10); // Máximo 10 slides

    const promoSection = document.getElementById('promoSection');
    if (promos.length === 0) {
        if (promoSection) promoSection.style.display = 'none';
        return;
    }
    if (promoSection) promoSection.style.display = 'block';

    promos.forEach(item => {
        const slide = document.createElement('div');
        slide.className = 'promo-slide';
        // Usamos getActivePrice para asegurar el precio correcto (aunque ya sabemos que es PROMO)
        const { precio } = getActivePrice(item, 1);
        slide.innerHTML = `
            <img src="${item.foto_producto || item.IMAGEN_PRODUCTO_CATALOGO || 'logo_white.png'}" loading="lazy">
            <h4>${(item.PRODUCTO || item.nombre_COMBO || '').toUpperCase()}</h4>
            <span class="promo-price">$${precio.toFixed(2)}</span>
        `;
        container.appendChild(slide);
    });
}

// ====================================================
// CARRITO DE COMPRAS
// ====================================================

/**
 * Agrega un producto al carrito, reproduce feedback táctil y anima el botón.
 * @param {string} id - ID del producto o combo.
 * @param {HTMLElement} btn - Botón que disparó la acción (para animación).
 */
function addToCart(id, btn) {
    playTap();

    // Animar botón
    btn.classList.add('success');
    setTimeout(() => btn.classList.remove('success'), 300);

    const item = db.productos.find(p => p.ID_PRODUCTO === id) || db.combos.find(c => c.ID_PRODUCTO_VENTA === id);
    if (!item) return;

    const existing = cart.find(c => (c.ID_PRODUCTO || c.ID_PRODUCTO_VENTA) === id);
    if (existing) {
        existing.qty++;
    } else {
        cart.push({ ...item, qty: 1 });
    }
    updateCartUI();
    saveCart();
}

function updateCartUI() {
    const total = cart.reduce((acc, i) => acc + (getActivePrice(i, i.qty).precio * i.qty), 0);
    const count = cart.reduce((acc, i) => acc + i.qty, 0);
    
    const cartTotalElement = document.getElementById('cartTotal');
    if (cartTotalElement) cartTotalElement.innerText = `$${total.toFixed(2)}`;
    
    const cartCountElement = document.getElementById('cartCount');
    if(cartCountElement) cartCountElement.innerText = `${count} producto(s)`;
    
    const bottomIsland = document.getElementById('bottomIsland');
    if (bottomIsland) bottomIsland.style.display = cart.length > 0 ? 'flex' : 'none';
}

function saveCart() {
    localStorage.setItem('combox_cart', JSON.stringify(cart));
}

function openCart() {
    renderCartItems();
    const modal = document.getElementById('cartModal');
    if (modal) modal.style.display = 'flex';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

function renderCartItems() {
    const list = document.getElementById('cartItemsList');
    if (!list) return;
    list.innerHTML = '';
    cart.forEach((item, index) => {
        const { precio } = getActivePrice(item, item.qty);
        const itemDiv = document.createElement('div');
        itemDiv.className = 'cart-item';
        itemDiv.innerHTML = `
            <div class="item-info">
                <span class="item-name">${(item.PRODUCTO || item.nombre_COMBO || '').toUpperCase()}</span>
                <span class="item-price">$${precio.toFixed(2)}</span>
            </div>
            <div class="item-qty">
                <button onclick="adjustQty(${index}, -1)">-</button>
                <span>${item.qty}</span>
                <button onclick="adjustQty(${index}, 1)">+</button>
            </div>
        `;
        list.appendChild(itemDiv);
    });
    const total = cart.reduce((acc, i) => acc + (getActivePrice(i, i.qty).precio * i.qty), 0);
    const modalTotalElement = document.getElementById('modalTotal');
    if (modalTotalElement) modalTotalElement.innerText = `$${total.toFixed(2)}`;
}

function adjustQty(index, delta) {
    cart[index].qty += delta;
    if (cart[index].qty <= 0) {
        cart.splice(index, 1);
    }
    saveCart();
    updateCartUI();
    const modal = document.getElementById('cartModal');
    if (modal && modal.style.display === 'flex') {
        renderCartItems();
    }
}

function clearCart() {
    cart = [];
    saveCart();
    updateCartUI();
    closeModal('cartModal');
}

// ====================================================
// MODAL DE ENTREGA
// ====================================================

function showDeliveryOptions() {
    closeModal('cartModal');
    const modal = document.getElementById('deliveryModal');
    if (modal) modal.style.display = 'flex';
    selectMethod('tienda');
    checkForm();
}

function backToCart() {
    closeModal('deliveryModal');
    openCart();
}

function selectMethod(method) {
    deliveryMethod = method;
    
    const btnStore = document.getElementById('btnStore');
    if (btnStore) btnStore.classList.toggle('active', method === 'tienda');
    
    const btnDelivery = document.getElementById('btnDelivery');
    if (btnDelivery) btnDelivery.classList.toggle('active', method === 'delivery');
    
    const storeInfo = document.getElementById('storeInfo');
    if (storeInfo) storeInfo.style.display = method === 'tienda' ? 'block' : 'none';
    
    const deliveryInfo = document.getElementById('deliveryInfo');
    if(deliveryInfo) deliveryInfo.style.display = method === 'delivery' ? 'block' : 'none';
    
    checkForm();
}

/**
 * Obtiene la ubicación actual del usuario y genera un link de Google Maps.
 */
function getLocation() {
    if (!navigator.geolocation) {
        alert('Tu navegador no soporta geolocalización');
        return;
    }
    navigator.geolocation.getCurrentPosition(
        pos => {
            // Formato correcto para Google Maps
            const link = `http://maps.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`;
            const locationLinkElement = document.getElementById('locationLink');
            if (locationLinkElement) {
                locationLinkElement.value = link;
                checkForm();
            }
        },
        error => {
            alert('No se pudo obtener la ubicación: ' + error.message);
        }
    );
}

/**
 * Habilita/deshabilita el botón de WhatsApp según los campos requeridos.
 */
function checkForm() {
    const btn = document.getElementById('btnWhatsApp');
    if (!btn) return;
    if (deliveryMethod === 'tienda') {
        const clientNameElement = document.getElementById('clientName');
        const name = clientNameElement ? clientNameElement.value.trim() : '';
        btn.disabled = !name;
    } else {
        const locationLinkElement = document.getElementById('locationLink');
        const ref = locationLinkElement ? locationLinkElement.value.trim() : '';
        
        const receiverNameElement = document.getElementById('receiverName');
        const name = receiverNameElement ? receiverNameElement.value.trim() : '';
        btn.disabled = !(ref && name);
    }
}

// Escuchar cambios en los inputs para validar el formulario
document.addEventListener('input', function(e) {
    if (e.target.matches('#clientName, #locationLink, #receiverName')) {
        checkForm();
    }
});

// ====================================================
// ENVÍO DEL PEDIDO POR WHATSAPP
// ====================================================

function finalizarPedido() {
    const method = deliveryMethod;
    
    let nombre = '';
    if (method === 'tienda') {
        const clientNameElement = document.getElementById('clientName');
        nombre = clientNameElement ? clientNameElement.value.trim() : '';
    } else {
         const receiverNameElement = document.getElementById('receiverName');
         nombre = receiverNameElement ? receiverNameElement.value.trim() : '';
    }

    let msg = `Hola! Soy *${nombre}*, `;
    if (method === 'tienda') {
        msg += `quiero recoger en la sede de *${currentSede.NOMBRE_SEDE}*\n\n`;
    } else {
        msg += `quiero este pedido a domicilio.\n\n`;
    }

    cart.forEach(item => {
        const { precio } = getActivePrice(item, item.qty);
        msg += `- *${(item.PRODUCTO || item.nombre_COMBO).toUpperCase()}*\n`;
        msg += `\`Cant:\` *${item.qty}* | *\$${(precio * item.qty).toFixed(2)}*\n\n`;
    });

    const totalElement = document.getElementById('cartTotal');
    const total = totalElement ? totalElement.innerText : '$0.00';
    msg += `💵 *SUBTOTAL:* *${total}*\n`;

    if (method === 'delivery') {
        const locationLinkElement = document.getElementById('locationLink');
        const locationValue = locationLinkElement ? locationLinkElement.value : '';
        msg += `\n🛵 *ENTREGA POR DELIVERY:*\n${locationValue}`;
    }

    const tel = (currentSede.TELEFONO || '').toString().replace(/\D/g, '');
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank');
}

// ====================================================
// HORARIOS DE APERTURA
// ====================================================

function toggleHorarios() {
    if (!currentSede) return;
    const horarios = `
        Lunes: ${currentSede.LUNES_APERTURA} - ${currentSede.LUNES_CIERRE}
        Martes: ${currentSede.MARTES_APERTURA} - ${currentSede.MARTES_CIERRE}
        Miércoles: ${currentSede.MIERCOLES_APERTURA} - ${currentSede.MIERCOLES_CIERRE}
        Jueves: ${currentSede.JUEVES_APERTURA} - ${currentSede.JUEVES_CIERRE}
        Viernes: ${currentSede.VIERNES_APERTURA} - ${currentSede.VIERNES_CIERRE}
        Sábado: ${currentSede.SABADO_APERTURA} - ${currentSede.SABADO_CIERRE}
        Domingo: ${currentSede.DOMINGO_APERTURA} - ${currentSede.DOMINGO_CIERRE}
    `;
    alert(horarios); // Se puede mejorar con un modal personalizado
}
