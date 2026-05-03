// Motor asíncrono para liberar el hilo principal (Garantiza 120fps en Android/iOS)
function deferAction(callback) {
    if(window.navigator.vibrate) window.navigator.vibrate(10);
    window.requestAnimationFrame(() => {
        setTimeout(callback, 0); 
    });
}

const API = 'https://script.google.com/macros/s/AKfycbw3G94u3EZR6kyOKKn-7RgIVJROgkKYvG95dw3l7yfVqpIiqW8Wj5k4NsY-_ltEPPzDNg/exec';
const DEFAULT_IMG = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300' style='background-color:%230A0A0B;'%3E%3Ctext fill='%23666666' x='50%25' y='50%25' font-family='sans-serif' font-size='24' font-weight='900' text-anchor='middle' dominant-baseline='middle'%3ESin Imagen%3C/text%3E%3C/svg%3E";

const swCode = `
    const CACHE_NAME = 'combox-assets-v1';
    const ASSETS = [
        'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=block',
        'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@100..700&display=swap'
    ];
    self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS))); });
    self.addEventListener('fetch', e => {
        if (e.request.url.includes('fonts.googleapis.com') || e.request.url.includes('fonts.gstatic.com')) {
            e.respondWith(caches.match(e.request).then(res => res || fetch(e.request).then(fRes => {
                return caches.open(CACHE_NAME).then(c => { c.put(e.request, fRes.clone()); return fRes; });
            })));
        }
    });
`;
if('serviceWorker' in navigator) {
    const swBlob = new Blob([swCode], {type: 'application/javascript'});
    navigator.serviceWorker.register(URL.createObjectURL(swBlob)).catch(err => console.log('SW falló:', err));
}

let deferredPrompt;
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

if (isStandalone) {
    const banner = document.getElementById('pwa-install-banner');
    if (banner) banner.style.display = 'none';
    
    const topAppBtn = document.getElementById('top-nav-app-btn');
    if (topAppBtn) topAppBtn.style.display = 'none';
    
    const topAppSeparator = document.getElementById('top-nav-app-separator');
    if (topAppSeparator) topAppSeparator.style.display = 'none';
} else {
    setTimeout(() => {
        if(!localStorage.getItem('pwa_prompt_dismissed')) {
            const banner = document.getElementById('pwa-install-banner');
            if (banner) banner.classList.remove('translate-y-[200%]');
        }
    }, 2000);
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
});

function hidePwaInstall() {
    document.getElementById('pwa-install-banner').classList.add('translate-y-[200%]');
    localStorage.setItem('pwa_prompt_dismissed', 'true');
}

const isIos = () => { return /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase()); }

function renderInstallModal() {
    const inst = document.getElementById('install-instructions');
    const btn = document.getElementById('modal-install-btn');
    
    if (isIos()) {
        inst.innerHTML = `
            <div class="flex flex-col gap-4 text-center">
                <p>Para instalar <b>Combox</b> en tu iPhone o iPad sigue estos pasos:</p>
                <div class="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center gap-4 text-left">
                    <span class="material-symbols-outlined text-3xl text-zinc-300">more_horiz</span>
                    <p class="text-xs">1. Presiona el botón de los <b>3 puntos</b>.</p>
                </div>
                <div class="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center gap-4 text-left">
                    <span class="material-symbols-outlined text-3xl text-blue-400">ios_share</span>
                    <p class="text-xs">2. Toca la opción de <b>"Compartir"</b>.</p>
                </div>
                <div class="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center gap-4 text-left">
                    <span class="material-symbols-outlined text-3xl text-zinc-300">add_box</span>
                    <p class="text-xs">3. Selecciona <b>"Añadir a pantalla de inicio"</b>.</p>
                </div>
            </div>`;
        btn.classList.add('hidden');
    } else {
        inst.innerHTML = `
            <div class="flex flex-col gap-4 text-center">
                <p>Instala la App oficial para un acceso inmediato y un rendimiento superior.</p>
                <div class="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center gap-4 text-left">
                    <span class="material-symbols-outlined text-3xl text-zinc-300">more_vert</span>
                    <p class="text-xs">1. Toca el <b>Menú de 3 puntos</b> en la esquina superior de tu navegador.</p>
                </div>
                <div class="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center gap-4 text-left">
                    <span class="material-symbols-outlined text-3xl text-primary">add_to_home_screen</span>
                    <p class="text-xs">2. Selecciona <b>"Instalar aplicación"</b> o <b>"Agregar a pantalla principal"</b>.</p>
                </div>
            </div>`;
        
        if (deferredPrompt) {
            btn.classList.remove('hidden');
            btn.innerHTML = 'Instalar Automáticamente <span class="material-symbols-outlined">download</span>';
            btn.onclick = async () => {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') { toggleModal('install-modal', false); hidePwaInstall(); }
                deferredPrompt = null;
            };
        } else {
            btn.classList.add('hidden');
        }
    }
}

if (/android/i.test(navigator.userAgent)) {
    document.documentElement.classList.add('is-android');
}

let db = null; 
let cart = {}; 
let currentType = 'Individual'; 
let currentCat = 'TODOS'; 
let currentSort = 'precio_menor'; 
let currentSede = null; 
let currentHorarioSede = null; 
let checkoutType = 'delivery'; 
let checkoutSede = null; 
let lastScrollY = window.scrollY; 
let tasaBCV = 1; 
let audioCtx;
let ticking = false;
let searchRenderTimer = null; 
let searchScrollTimer = null;
let initialRenderDone = false;
let cachedDataString = null;

let catalogLimit = 24;
let totalFilteredItemsCount = 0;

const searchContainer = document.getElementById('search-container');

async function fetchWithRetry(url, options = {}, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) throw new Error('Servidor ocupado o fallo HTTP');
            return await response.json();
        } catch (err) {
            if (i === maxRetries - 1) throw err;
            await new Promise(res => setTimeout(res, 200 * Math.pow(2, i)));
        }
    }
}

function customAlert(msg, title = 'Aviso') {
    document.getElementById('dialog-title').innerText = title;
    document.getElementById('dialog-msg').innerText = msg;
    document.getElementById('dialog-buttons').innerHTML = `<button class="w-full bg-primary text-white font-black py-3 rounded-xl text-xs uppercase shadow-lg shadow-primary/30" onclick="closeCustomDialog()">Entendido</button>`;
    toggleModal('custom-dialog-modal', true);
}

function customConfirm(msg, onConfirm, title = 'Confirmar') {
    document.getElementById('dialog-title').innerText = title;
    document.getElementById('dialog-msg').innerText = msg;
    window._pendingConfirm = onConfirm;
    document.getElementById('dialog-buttons').innerHTML = `
        <button class="w-full bg-white/10 text-white font-black py-3 rounded-xl text-xs uppercase" onclick="closeCustomDialog()">Cancelar</button>
        <button class="w-full bg-primary text-white font-black py-3 rounded-xl text-xs uppercase shadow-lg shadow-primary/30" onclick="let cb = window._pendingConfirm; closeCustomDialog(); if(cb) cb();">Aceptar</button>
    `;
    toggleModal('custom-dialog-modal', true);
}

function closeCustomDialog() {
    toggleModal('custom-dialog-modal', false);
    window._pendingConfirm = null;
}

function clearCategoryAndKeepScroll() {
    const targetScroll = window.scrollY; 
    
    currentCat = 'TODOS'; 
    catalogLimit = 24; 
    if (currentSort === 'relevancia') currentSort = 'precio_menor';
    
    const menuBtn = document.getElementById('cat-menu-btn');
    if (menuBtn) {
        menuBtn.classList.add('bg-white/10', 'border-white/20');
        menuBtn.classList.remove('bg-primary', 'border-primary');
    }
    
    const searchInput = document.getElementById('global-search');
    if(searchInput) searchInput.value = '';
    const searchIcon = document.getElementById('search-icon');
    if(searchIcon) {
        searchIcon.innerText = 'search';
        searchIcon.classList.remove('text-primary');
    }
    
    const tabsContainer = document.getElementById('type-tabs-container');
    tabsContainer.classList.remove('tabs-hidden');

    setTimeout(() => {
        window.requestAnimationFrame(() => {
            render(); 
            window.requestAnimationFrame(() => {
                window.scrollTo(0, targetScroll); 
            });
        });
    }, 0);
}

function generarId() { return 'ID-' + Math.random().toString(36).substr(2, 9).toUpperCase(); }

async function enviarSugerencia() {
    const lastSugTime = localStorage.getItem('last_sug_time');
    if (lastSugTime && (Date.now() - parseInt(lastSugTime)) < 60000) {
        customAlert('Por favor, espera 1 minuto antes de enviar otra sugerencia.');
        return;
    }

    const texto = document.getElementById('sug-texto').value.trim();
    if (!texto) { customAlert('Por favor, escribe una sugerencia.'); return; }
    
    const nombre = document.getElementById('sug-nombre').value.trim() || 'Anónimo';
    const btn = document.getElementById('btn-enviar-sug');
    
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Enviando...';

    localStorage.setItem('last_sug_time', Date.now());

    const payload = { action: 'nueva_sugerencia', id_sugerencia: generarId(), nombre_cliente: nombre, sugerencia: texto };

    try {
        await fetch(API, {
            method: 'POST',
            mode: 'no-cors', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        document.getElementById('sug-texto').value = '';
        document.getElementById('sug-nombre').value = '';
        toggleModal('sugerencias-modal', false);
        setTimeout(() => customAlert('¡Gracias por tu sugerencia!'), 300);
    } catch (e) {
        customAlert('Revisa tu conexión a internet e intenta de nuevo.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Enviar Sugerencia <span class="material-symbols-outlined">send</span>';
    }
}

async function enviarCurriculum() {
    const lastCVTime = localStorage.getItem('last_cv_time');
    if (lastCVTime && (Date.now() - parseInt(lastCVTime)) < 60000) {
        customAlert('Debes esperar 1 minuto antes de volver a enviar tus datos.');
        return;
    }

    const cedula = document.getElementById('emp-cedula').value.trim();
    const nombre = document.getElementById('emp-nombre').value.trim();
    const sexo = document.getElementById('emp-sexo').value;
    const fecha = document.getElementById('emp-fecha').value;
    const telefono = document.getElementById('emp-telefono').value.trim();
    const domicilio = document.getElementById('emp-domicilio').value.trim();
    const discapacidad = document.getElementById('emp-discapacidad').value.trim() || 'Ninguna';
    
    const cargosChecked = Array.from(document.querySelectorAll('.emp-cargo-cb:checked')).map(cb => cb.value);
    const cargo = cargosChecked.join(', ');

    if (!cedula || !nombre || !fecha || !telefono || !domicilio || cargosChecked.length === 0) {
        customAlert('Por favor, completa todos los campos obligatorios (*) y selecciona al menos un cargo.');
        return;
    }

    const btn = document.getElementById('btn-enviar-emp');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Enviando...';

    await localforage.setItem('combox_cv_data', { cedula, nombre, sexo, fecha, telefono, domicilio, discapacidad });
    localStorage.setItem('last_cv_time', Date.now());

    const payload = { action: 'nuevo_curriculum', id_curriculum: generarId(), Cedula: cedula, Nombre: nombre, Fecha_nac: fecha, telefono: telefono, Domicilio: domicilio, Discapacidad: discapacidad, Cargos_interesado: cargo, Sexo: sexo };

    try {
        await fetch(API, {
            method: 'POST',
            mode: 'no-cors', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        toggleModal('empleo-modal', false);
        setTimeout(() => customAlert('¡Datos enviados con éxito! Te contactaremos pronto.', 'Genial'), 300);
    } catch (e) {
        customAlert('Revisa tu conexión a internet e intenta de nuevo.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Enviar Datos <span class="material-symbols-outlined">send</span>';
    }
}

async function loadSavedCV() {
    const data = await localforage.getItem('combox_cv_data');
    if(data) {
        if(data.cedula) document.getElementById('emp-cedula').value = data.cedula;
        if(data.nombre) document.getElementById('emp-nombre').value = data.nombre;
        if(data.sexo) document.getElementById('emp-sexo').value = data.sexo;
        if(data.fecha) document.getElementById('emp-fecha').value = data.fecha;
        if(data.telefono) document.getElementById('emp-telefono').value = data.telefono;
        if(data.domicilio) document.getElementById('emp-domicilio').value = data.domicilio;
        if(data.discapacidad) document.getElementById('emp-discapacidad').value = data.discapacidad;
    }
}

let ptrStartY = 0;
let ptrCurrentY = 0;
let isPtrPulling = false;
const ptrContainer = document.getElementById('ptr-container');
const ptrIcon = document.getElementById('ptr-icon');
const ptrText = document.getElementById('ptr-text');

document.addEventListener('touchstart', (e) => {
    if (window.scrollY <= 0 && !document.body.classList.contains('modal-open')) {
        ptrStartY = e.touches[0].clientY;
        isPtrPulling = true;
        ptrContainer.style.transition = 'none';
    }
}, {passive: true});

document.addEventListener('touchmove', (e) => {
    if (!isPtrPulling) return;
    ptrCurrentY = e.touches[0].clientY;
    let pullDist = ptrCurrentY - ptrStartY;
    
    if (pullDist > 0 && window.scrollY <= 0) {
        let move = Math.min(pullDist * 0.35, 180); 
        ptrContainer.style.transform = `translate3d(0, calc(-100% + ${move}px), 0)`;
        
        if (move > 100) {
            ptrIcon.classList.remove('animate-spin');
            ptrIcon.style.transform = `rotate(${pullDist}deg)`;
            ptrText.innerText = "Suelta para actualizar";
        } else {
            ptrIcon.classList.remove('animate-spin');
            ptrText.innerText = "Estira más para actualizar";
        }
    }
}, {passive: true});

document.addEventListener('touchend', async () => {
    if (!isPtrPulling) return;
    isPtrPulling = false;
    ptrContainer.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    
    let pullDist = ptrCurrentY - ptrStartY;
    let move = Math.min(pullDist * 0.35, 180);
    
    if (move > 100 && window.scrollY <= 0) {
        ptrContainer.style.transform = `translate3d(0, 45px, 0)`;
        ptrIcon.classList.add('animate-spin');
        ptrText.innerText = "Actualizando...";
        
        if(window.navigator.vibrate) window.navigator.vibrate(15);
        
        await localforage.removeItem('combox_db_v2');
        saveCart(); 
        
        setTimeout(() => {
            window.location.reload(true);
        }, 600); 
    } else {
        ptrContainer.style.transform = `translate3d(0, -100%, 0)`;
    }
    
    ptrStartY = 0;
    ptrCurrentY = 0;
});

function initAudio() {
    if(!audioCtx) { 
        audioCtx = new (window.AudioContext || window.webkitAudioContext)(); 
        const buffer = audioCtx.createBuffer(1, 1, 22050);
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        source.start(0);
    }
}

function playClick() {
    if(!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.04);
    gain.gain.setValueAtTime(1.2, audioCtx.currentTime); 
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.04);
}

document.addEventListener('touchstart', initAudio, {once: true, passive: true});
document.addEventListener('click', initAudio, {once: true, passive: true});

document.addEventListener('visibilitychange', () => {
    if (!document.hidden && audioCtx) {
        if (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted') {
            audioCtx.resume();
        }
    }
});

document.addEventListener('touchstart', () => {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}, {passive: true});

window.addEventListener('scroll', () => {
    if (document.body.classList.contains('modal-open')) return;
    if (!ticking) {
        window.requestAnimationFrame(() => {
            const currentScrollY = window.scrollY;
            const searchInput = document.getElementById('global-search');
            const isFocused = document.activeElement === searchInput;

            if (isFocused) {
                searchContainer.classList.remove('search-hidden');
                lastScrollY = currentScrollY;
                ticking = false;
                return;
            }

            const searchValue = searchInput ? searchInput.value.trim() : '';
            if (searchValue !== '') { 
                searchContainer.classList.remove('search-hidden'); 
            } 
            else if (currentScrollY > 300) {
                if (currentScrollY > lastScrollY) searchContainer.classList.add('search-hidden'); 
                else searchContainer.classList.remove('search-hidden'); 
            } else { 
                searchContainer.classList.remove('search-hidden'); 
            }

            if ((window.innerHeight + currentScrollY) >= document.body.offsetHeight - 500) {
                if (catalogLimit < totalFilteredItemsCount) {
                    catalogLimit += 24;
                    renderCatalog(); 
                }
            }
            lastScrollY = currentScrollY;
            ticking = false;
        });
        ticking = true;
    }
}, { passive: true });

document.addEventListener("DOMContentLoaded", () => {
    const inputs = document.querySelectorAll('#checkout-name, #checkout-phone, #checkout-location');
    inputs.forEach(input => {
        input.addEventListener('focus', function() { setTimeout(() => this.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300); });
    });
    
    const globalSearch = document.getElementById('global-search');
    if(globalSearch){
        globalSearch.addEventListener('focus', function(e) {
            window.scrollTo({top: window.scrollY}); 
        });
    }
});

async function init() {
    loadSavedCV();
    
    const urlParams = new URLSearchParams(window.location.search);
    if(urlParams.get('sugerencias')) {
        setTimeout(() => toggleModal('sugerencias-modal', true), 500);
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    let loadedFromCache = false;
    try {
        const cachedObjStr = await localforage.getItem('combox_db_v2');
        if (cachedObjStr) {
            const parsed = JSON.parse(cachedObjStr);
            if (Date.now() - parsed.time < 21600000) {
                db = parsed.data;
                cachedDataString = JSON.stringify(db);
                loadedFromCache = true;
            } else {
                await localforage.removeItem('combox_db_v2');
            }
        }
    } catch(e) { console.error("Error cargando caché localForage:", e); }

    try {
        const savedCart = await localforage.getItem('combox_cart');
        if(savedCart) {
            const parsed = JSON.parse(savedCart);
            if (Date.now() - parsed.time < 3600000) { cart = parsed.cart; } 
            else { await localforage.removeItem('combox_cart'); }
        }
    } catch(e) { console.error("Error al cargar carrito:", e); }

    if (loadedFromCache) {
        await setupAfterDBLoad(true);
    }

    try {
        const freshDB = await fetchWithRetry(API);
        
        if(freshDB.catalogo) freshDB.catalogo.forEach((p, i) => p._index = i);
        if(freshDB.combos) freshDB.combos.forEach((p, i) => p._index = i);
        
        const isDifferent = JSON.stringify(freshDB) !== cachedDataString;
        
        if (loadedFromCache && isDifferent) {
            const toast = document.getElementById('update-toast');
            if(toast) {
                toast.style.opacity = '1';
                toast.style.transform = 'translate(-50%, -50%) scale(1)';
                setTimeout(async () => {
                    db = freshDB;
                    await localforage.setItem('combox_db_v2', JSON.stringify({data: db, time: Date.now()})); 
                    await setupAfterDBLoad(false); 
                    setTimeout(() => {
                        toast.style.opacity = '0';
                        toast.style.transform = 'translate(-50%, -50%) scale(0.9)';
                    }, 800);
                }, 1200);
            }
        } else {
            db = freshDB;
            await localforage.setItem('combox_db_v2', JSON.stringify({data: db, time: Date.now()})); 
            if (!loadedFromCache) {
                await setupAfterDBLoad(false); 
            }
        }
    } catch(e) { 
        console.error("Error cargando DB:", e); 
        if (loadedFromCache) {
            const s = document.getElementById('splash'); 
            if(s) { s.style.opacity = '0'; setTimeout(() => s.remove(), 600); }
        } else {
            customAlert("No hay conexión a internet y no hay datos guardados para arrancar la aplicación.");
        }
    }
}

async function setupAfterDBLoad(isCached) {
    if(db && db.finanzas && db.finanzas.tasa_usd) {
        tasaBCV = parseFloat(db.finanzas.tasa_usd);
        const displayEl = document.getElementById('tasa-bcv-display');
        if(displayEl) displayEl.innerText = `Bs ${tasaBCV.toFixed(2)}`;
    }
    
    if(db && db.sedes && db.sedes.length) { 
        const savedSedeId = await localforage.getItem('combox_sede_id');
        if (savedSedeId) {
            currentSede = db.sedes.find(s => s.ID_SEDE === savedSedeId) || db.sedes[0];
        } else {
            currentSede = db.sedes[0]; 
        }
        updateHeader(); 
    }

    const urlParams = new URLSearchParams(window.location.search);
    const pedidoParam = urlParams.get('pedido');
    if(pedidoParam) {
        const pairs = pedidoParam.split('_');
        let hasNewItems = false;
        pairs.forEach(pair => {
            const [id, qty] = pair.split('-');
            const productExists = getAllSourceData().find(x => getUnifiedId(x) === id);
            if(productExists && qty && !isNaN(qty)) {
                cart[id] = parseInt(qty);
                hasNewItems = true;
            }
        });
        if(hasNewItems) {
            saveCart();
            updateOrder();
            urlParams.delete('pedido');
            const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
            window.history.replaceState({}, document.title, newUrl);
            setTimeout(() => toggleModal('cart-modal', true, renderCart), 800);
        }
    }
    
    renderPromos();
    
    if(!initialRenderDone) {
        render(); 
        initialRenderDone = true;
        updateOrder(); 
        
        setTimeout(() => { const s = document.getElementById('splash'); if(s) { s.style.opacity = '0'; setTimeout(() => s.remove(), 600); } }, isCached ? 100 : 1200);

        const productId = urlParams.get('id');
        if(productId) { setTimeout(() => openProductView(productId), 500); }
    } else {
        render();
        updateOrder(); 
    }
}

function getSortedSedes() {
    if (!db?.sedes) return [];
    return [...db.sedes].sort((a, b) => {
        if (a.ID_SEDE === currentSede?.ID_SEDE) return -1;
        if (b.ID_SEDE === currentSede?.ID_SEDE) return 1;
        return 0;
    });
}

async function saveCart() {
    try { await localforage.setItem('combox_cart', JSON.stringify({cart: cart, time: Date.now()})); } 
    catch(e) { console.error("Error guardando carrito:", e); }
}

function shareCartUrl() {
    if(Object.keys(cart).length === 0) { customAlert('Tu pedido está vacío. Agrega productos antes de compartir.'); return; }
    const cartStr = Object.entries(cart).map(([id, qty]) => `${id}-${qty}`).join('_');
    const url = new URL(window.location.href);
    url.searchParams.set('pedido', cartStr);
    if (navigator.share) {
        navigator.share({ title: 'Mi Pedido en Combox', text: '¡Mira los productos que elegí en Combox!', url: url.href }).catch(console.error);
    } else {
        navigator.clipboard.writeText(url.href);
        customAlert('¡Enlace del pedido copiado con éxito! Envíalo a quien quieras para que pueda abrir tu pedido listo.');
    }
}

function openInstagram() { if(currentSede?.LINK_INSTAGRAM) window.open(currentSede.LINK_INSTAGRAM, '_blank'); }

function lockScroll(lock) { 
    if(lock) { 
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        document.body.classList.add('modal-open');
    } else { 
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        document.body.classList.remove('modal-open'); 
    } 
}

function checkActiveModals() {
    const modals = ['cart-modal', 'sedes-modal', 'categories-modal', 'horario-modal', 'checkout-modal', 'product-modal', 'mapa-modal', 'chat-modal', 'sugerencias-modal', 'empleo-modal', 'custom-dialog-modal', 'install-modal', 'delivery-pickup-modal'];
    if(!modals.some(id => document.getElementById(id).classList.contains('active'))) {
        lockScroll(false);
    }
}

function toggleModal(modalId, show, renderFn) { 
    const modal = document.getElementById(modalId); 
    
    if(show) { 
        if(document.activeElement) document.activeElement.blur(); 
        if(renderFn) renderFn();
        modal.classList.add('active'); 
        lockScroll(true); 
    } else { 
        modal.classList.remove('active'); 
        checkActiveModals();
    } 
}

function toggleSedesModal(show) { toggleModal('sedes-modal', show, renderSedesModal); }
function toggleCategoriesModal(show) { toggleModal('categories-modal', show, renderAllCategories); }
function toggleCartModal(show) { toggleModal('cart-modal', show, renderCart); }
function toggleProductModal(show) { toggleModal('product-modal', show, null); }

function formatTimeFromIso(iso) { if(!iso) return null; return new Date(iso).toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit', hour12:true}); }

function openHorarioModal() {
    if(!currentSede || !db?.sedes) return;
    currentHorarioSede = currentSede; 
    
    const select = document.getElementById('horario-sede-select');
    select.innerHTML = db.sedes.map(s => `<option value="${s.ID_SEDE}" ${currentHorarioSede.ID_SEDE === s.ID_SEDE ? 'selected' : ''}>${s.NOMBRE_SEDE}</option>`).join('');
    
    toggleModal('horario-modal', true, renderHorarioList);
}

function changeHorarioSede(id) {
    if(db?.sedes) currentHorarioSede = db.sedes.find(s => s.ID_SEDE === id) || currentHorarioSede;
    if(window.navigator.vibrate) window.navigator.vibrate(10);
    renderHorarioList(); 
}

function renderHorarioList() {
    if(!currentHorarioSede) return;
    
    const days = ["LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO","DOMINGO"];
    const names = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
    const now = new Date();
    const todayIdx = (now.getDay()+6)%7; 
    
    document.getElementById('horario-list-container').innerHTML = days.map((d,i) => {
        const open = currentHorarioSede[`${d}_APERTURA`], close = currentHorarioSede[`${d}_CIERRE`];
        const isToday = i === todayIdx;
        
        let timeHtml = '<span class="text-zinc-500">Cerrado</span>';
        if (open && close) {
            timeHtml = `
                <span class="inline-flex items-center gap-0.5">
                    <span class="material-symbols-outlined text-[14px] text-[#39FF14] drop-shadow-[0_0_5px_rgba(57,255,20,0.6)]">lock_open</span>
                    <span class="text-[#39FF14] font-black drop-shadow-[0_0_5px_rgba(57,255,20,0.6)]">${formatTimeFromIso(open)}</span>
                </span>
                <span class="text-zinc-500 mx-1">-</span>
                <span class="inline-flex items-center gap-0.5">
                    <span class="material-symbols-outlined text-[14px] text-[#ff0000] drop-shadow-[0_0_5px_rgba(255,0,0,0.6)]">lock</span>
                    <span class="text-[#ff0000] font-black drop-shadow-[0_0_5px_rgba(255,0,0,0.6)]">${formatTimeFromIso(close)}</span>
                </span>
            `;
        }

        let dayClass = 'bg-white/5 border-white/10'; 
        if (isToday) {
            dayClass = (open && close) 
                ? 'bg-white/10 border-gray-300 shadow-[0_0_15px_rgba(255,255,255,0.1)]' 
                : 'bg-red-500/10 border-red-500 shadow-[0_0_15px_rgba(255,0,0,0.2)]'; 
        }
        
        return `<div onclick="void(0)" class="flex justify-between items-center p-3.5 rounded-2xl border ${dayClass}">
            <span class="${isToday ? 'text-white font-black' : 'text-white font-bold'} text-sm">${names[i]}</span>
            <span class="text-xs tracking-wide flex items-center">${timeHtml}</span>
        </div>`;
    }).join('');
}

function renderMapModal() {
    const sorted = getSortedSedes();
    document.getElementById('mapa-list-container').innerHTML = sorted.map(s => {
        const active = currentSede?.ID_SEDE === s.ID_SEDE;
        const bgClass = active ? 'bg-zinc-800/90 border-zinc-500' : 'bg-white/5 border-white/10';
        return `
        <div class="flex items-center justify-between p-4 rounded-2xl ${bgClass} border gap-3">
            <div class="flex flex-col min-w-0 flex-1">
                <span class="text-white font-bold text-base truncate">${s.NOMBRE_SEDE.split(',')[0]}</span>
                <span class="text-[10px] text-zinc-400 uppercase font-black truncate">${s.NOMBRE_SEDE.split(',')[1] || 'Sucursal'}</span>
            </div>
            <button onclick="window.open('${s.LINK_UBICACION}', '_blank')" class="bg-blue-500/20 text-blue-400 p-2.5 rounded-full active:scale-95 flex items-center gap-2 border border-blue-500/30 flex-shrink-0">
                <span class="material-symbols-outlined text-[20px]">near_me</span> <span class="text-[10px] font-black uppercase tracking-widest">Ir</span>
            </button>
        </div>
    `}).join('');
}

function renderChatModal() {
    const sorted = getSortedSedes();
    document.getElementById('chat-list-container').innerHTML = sorted.map(s => {
        const active = currentSede?.ID_SEDE === s.ID_SEDE;
        const bgClass = active ? 'bg-zinc-800/90 border-zinc-500' : 'bg-white/5 border-white/10';
        return `
        <div class="flex items-center justify-between p-4 rounded-2xl ${bgClass} border gap-3">
            <div class="flex flex-col min-w-0 flex-1">
                <span class="text-white font-bold text-base truncate">${s.NOMBRE_SEDE.split(',')[0]}</span>
                <span class="text-[10px] text-zinc-400 uppercase font-black truncate">${s.NOMBRE_SEDE.split(',')[1] || 'Sucursal'}</span>
            </div>
            <button onclick="window.open('https://wa.me/${s.TELEFONO}?text=${encodeURIComponent('Hola Combox, me comunico con la sede de ' + s.NOMBRE_SEDE + '. Necesito información.')}', '_blank')" class="bg-[#25D366]/20 text-[#25D366] px-3 py-1.5 rounded-full active:scale-[0.90] transition-transform flex items-center gap-1.5 border border-[#25D366]/40 flex-shrink-0">
                <svg class="w-4 h-4 fill-current drop-shadow-md" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> 
                <span class="text-[9px] font-black uppercase tracking-widest">WhatsApp</span>
            </button>
        </div>
    `}).join('');
}

async function openCheckoutModal(type) {
    checkoutType = type; 
    const title = document.getElementById('checkout-title');
    const sedeLabel = document.getElementById('checkout-sede-label');
    const locContainer = document.getElementById('checkout-location-container');
    const submitBtn = document.getElementById('checkout-submit-btn');
    const accent = document.getElementById('checkout-accent');
    
    if(type === 'delivery') {
        title.innerText = 'Datos de Delivery';
        sedeLabel.innerText = 'Sede que enviará tu pedido';
        locContainer.style.display = 'block'; 
        submitBtn.innerHTML = 'Solicitar Delivery <span class="material-symbols-outlined">two_wheeler</span>';
        submitBtn.className = "w-full bg-neon-accent text-black font-[900] py-3.5 rounded-2xl text-sm uppercase shadow-lg shadow-neon-accent/20 active:scale-[0.98] flex items-center justify-center gap-2";
        accent.className = "w-1.5 h-6 bg-neon-accent rounded-full";
        
        const locInput = document.getElementById('checkout-location');
        if (!locInput.value) {
            getLocation(); 
        }
    } else {
        title.innerText = 'Datos de Pick-Up';
        sedeLabel.innerText = 'Sede donde retirarás';
        locContainer.style.display = 'none'; 
        submitBtn.innerHTML = 'Solicitar Pick-Up <span class="material-symbols-outlined">storefront</span>';
        submitBtn.className = "w-full bg-white text-black font-[900] py-3.5 rounded-2xl text-sm uppercase shadow-lg shadow-white/20 active:scale-[0.98] flex items-center justify-center gap-2";
        accent.className = "w-1.5 h-6 bg-white rounded-full";
    }
    
    const select = document.getElementById('checkout-sede-select');
    if(db?.sedes) {
        select.innerHTML = db.sedes.map(s => `<option value="${s.ID_SEDE}" ${currentSede?.ID_SEDE === s.ID_SEDE ? 'selected' : ''}>${s.NOMBRE_SEDE}</option>`).join('');
        checkoutSede = currentSede;
    }

    const savedName = await localforage.getItem('combox_cliente_nombre');
    const savedPhone = await localforage.getItem('combox_cliente_telefono');
    
    if(savedName) document.getElementById('checkout-name').value = savedName;
    if(savedPhone) document.getElementById('checkout-phone').value = savedPhone;
    
    document.getElementById('cart-modal').classList.remove('active');
    toggleModal('checkout-modal', true, null);
    document.getElementById('checkout-scroll-area').scrollTop = 0;
}

function closeCheckout() { toggleModal('checkout-modal', false, null); setTimeout(() => toggleModal('cart-modal', true), 150); }

function updateCheckoutSede(id) { if(db?.sedes) checkoutSede = db.sedes.find(s => s.ID_SEDE === id) || currentSede; }

function updateLocationBtnState() {
    const loc = document.getElementById('checkout-location');
    const btn = document.getElementById('checkout-loc-action-btn');
    const icon = document.getElementById('checkout-loc-action-icon');
    if(loc.value.trim() === '') { btn.className = "w-14 bg-neon-accent/10 border border-neon-accent/20 text-neon-accent rounded-2xl flex items-center justify-center active:scale-90 flex-shrink-0"; icon.innerText = "my_location"; }
    else { btn.className = "w-14 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center justify-center active:scale-90 flex-shrink-0"; icon.innerText = "delete_sweep"; }
}

function handleLocationAction() { const loc = document.getElementById('checkout-location'); if(loc.value.trim() === '') getLocation(); else { loc.value = ''; loc.focus(); updateLocationBtnState(); } }

function getLocation() {
    const loc = document.getElementById('checkout-location');
    if(!navigator.geolocation) { loc.value = ""; loc.placeholder = "GPS no soportado."; return; }
    loc.value = "Obteniendo coordenadas...";
    navigator.geolocation.getCurrentPosition(
        pos => { 
            loc.value = `https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`; 
            updateLocationBtnState(); 
        },
        err => { 
            loc.value = ""; loc.placeholder = "No se pudo obtener. Escribe dirección."; 
            updateLocationBtnState(); 
        }, 
        { enableHighAccuracy: true, timeout: 5000 }
    );
}

function submitOrder() {
    const name = document.getElementById('checkout-name').value.trim();
    const phone = document.getElementById('checkout-phone').value.trim();
    
    if(!name) { customAlert('Ingresa tu nombre.'); document.getElementById('checkout-name').focus(); return; }
    if(!phone) { customAlert('Ingresa tu teléfono.'); document.getElementById('checkout-phone').focus(); return; }
    
    localforage.setItem('combox_cliente_nombre', name).catch(e => console.error(e));
    localforage.setItem('combox_cliente_telefono', phone).catch(e => console.error(e));
    
    if(checkoutType === 'delivery') {
        const loc = document.getElementById('checkout-location').value.trim();
        if(!loc || loc.includes('Obteniendo')) { customAlert('Indica tu ubicación.'); document.getElementById('checkout-location').focus(); return; }
    }
    
    let telefonoSede = checkoutSede?.TELEFONO || '584244701273';
    let nombreSede = checkoutSede?.NOMBRE_SEDE || '';
    
    let total = 0;
    const allItems = getAllSourceData();
    let itemsText = '';
    
    Object.keys(cart).forEach(id => {
        const p = allItems.find(x => getUnifiedId(x) === id);
        if(!p) return;
        const price = getProductPrice(p);
        const priceStr = price === 0 ? 'Por cotizar' : `${price}$ c/u`;
        itemsText += `- *${p.nombre.toUpperCase()}*\nCant:  \`${cart[id]}\`  |  \`${priceStr}\`\n\n`;
        total += price * cart[id];
    });

    const date = new Date();
    const monthNames = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
    const dateStr = `(_${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}_)`;

    const cartStr = Object.entries(cart).map(([id, qty]) => `${id}-${qty}`).join('_');
    const cartUrl = `${window.location.origin}${window.location.pathname}?pedido=${cartStr}`;
    
    let msg = '';
    
    if(checkoutType === 'delivery') {
        const locationLink = document.getElementById('checkout-location').value.trim();
        msg = `🛵 *SOLICITUD DE DELIVERY*\n${dateStr}\n\n\n`;
        msg += `🏢 *SEDE:* \`${nombreSede}\`\n\n`;
        msg += `👤 *CLIENTE:* \`${name}\`\n`;
        msg += `☎️ *TELEFONO:* \`${phone}\`\n\n`;
        msg += `📍 *UBICACION:*\n${locationLink}\n\n\n`;
        msg += `📦 *PEDIDO:*\n\n${itemsText}`;
        msg += `*TOTAL (SIN DELIVERY Ni IVA):* \`$${total.toFixed(2)}\`\n\n`;
        msg += `____________________________________\n\n`;
        msg += `> 🛒 *LINK CARRITO:* ${cartUrl}`;
    } else {
        msg = `🚘 *SOLICITUD DE PICK-UP*\n${dateStr}\n\n\n`;
        msg += `🏢 *SEDE:* \`${nombreSede}\`\n\n`;
        msg += `👤 *CLIENTE:* \`${name}\`\n`;
        msg += `☎️ *TELEFONO:* \`${phone}\`\n\n\n`;
        msg += `📦 *PEDIDO:*\n\n${itemsText}`;
        msg += `*TOTAL (SIN IVA):* \`$${total.toFixed(2)}\`\n\n`;
        msg += `____________________________________\n\n`;
        msg += `> 🛒 *LINK CARRITO:* ${cartUrl}`;
    }
    
    window.open(`https://wa.me/${telefonoSede}?text=${encodeURIComponent(msg)}`, '_blank');
}

function getSchedule(sede) {
    const now = new Date();
    let day = now.getDay();
    const days = ["DOMINGO","LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO"];
    let dayName = days[day];
    
    let openIso = sede[`${dayName}_APERTURA`], closeIso = sede[`${dayName}_CIERRE`];
    if(!openIso || !closeIso) return { isOpen: false, text: "Cerrado hoy", nextTime: "" };
    
    let openDate = new Date(openIso), closeDate = new Date(closeIso);
    
    let openMins = openDate.getHours()*60+openDate.getMinutes(), 
        closeMins = closeDate.getHours()*60+closeDate.getMinutes(), 
        nowMins = now.getHours()*60+now.getMinutes();
        
    const format = d => d.toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit', hour12:true});
    let isOpen = false;
    
    if(closeMins < openMins) { if(nowMins >= openMins) isOpen = true; }
    else { if(nowMins >= openMins && nowMins <= closeMins) isOpen = true; }
    
    return { isOpen, text: isOpen ? "Abierto" : "Cerrado", nextTime: isOpen ? `Cierra ${format(closeDate)}` : `Abre ${format(openDate)}` };
}

function updateHeader() {
    if(!currentSede) return;
    document.getElementById('current-location-label').innerText = currentSede.NOMBRE_SEDE;
    const sched = getSchedule(currentSede);
    document.getElementById('header-status-text').innerText = sched.isOpen ? `Abiertos hasta las ${sched.nextTime.replace('Cierra ','')}` : `Cerrado. ${sched.nextTime}`;
    const dot = document.getElementById('header-status-dot');
    dot.className = `w-1.5 h-1.5 rounded-full ${sched.isOpen ? 'bg-neon-accent animate-pulse shadow-[0_0_8px_#39FF14]' : 'bg-red-500 animate-pulse shadow-[0_0_8px_#ff0000]'}`;
}

function renderSedesModal() {
    const sorted = getSortedSedes();
    document.getElementById('sedes-list-container').innerHTML = sorted.map(s => {
        const sched = getSchedule(s);
        const active = currentSede?.ID_SEDE === s.ID_SEDE;
        const [main, sub] = s.NOMBRE_SEDE.split(',');
        
        const bgClass = active ? 'bg-zinc-800/90 border-zinc-500 shadow-[0_0_15px_rgba(255,255,255,0.05)]' : 'bg-white/5 border-white/10';
        const iconClass = active ? 'bg-white/20 text-white' : 'bg-white/5 text-white/30';

        return `<button class="w-full flex items-center justify-between p-4 md:p-5 rounded-3xl ${bgClass} border transition-all" onclick="selectLocation('${s.ID_SEDE}')">
            <div class="flex items-center gap-3 min-w-0 flex-1">
                <div class="w-10 h-10 flex-shrink-0 md:w-12 md:h-12 rounded-2xl ${iconClass} flex items-center justify-center">
                    <span class="material-symbols-outlined text-[20px] md:text-[24px]">storefront</span>
                </div>
                <div class="text-left min-w-0 flex-1 pr-2">
                    <span class="block text-white font-bold text-base md:text-lg truncate leading-tight">${main}</span>
                    <span class="block text-[9px] md:text-[10px] text-zinc-400 uppercase font-black truncate">${sub?.trim() || 'Sucursal'}</span>
                </div>
            </div>
            <div class="flex flex-col items-end gap-1 flex-shrink-0">
                <div class="flex items-center gap-1.5 flex-shrink-0 ${sched.isOpen ? 'bg-neon-accent/10 border-neon-accent/20' : 'bg-red-500/10 border-red-500/20'} px-2 py-1 rounded-full border">
                    <span class="w-1.5 h-1.5 flex-shrink-0 rounded-full ${sched.isOpen ? 'bg-neon-accent' : 'bg-red-500'}"></span>
                    <span class="text-[8px] md:text-[9px] font-black whitespace-nowrap ${sched.isOpen ? 'text-neon-accent' : 'text-red-500'} uppercase">${sched.text}</span>
                </div>
                <span class="text-[10px] md:text-[11px] whitespace-nowrap text-white font-bold uppercase">${sched.nextTime}</span>
            </div>
        </button>`;
    }).join('');
}

function selectLocation(id) { 
    if(db?.sedes) {
        currentSede = db.sedes.find(s => s.ID_SEDE === id) || currentSede; 
        localforage.setItem('combox_sede_id', currentSede.ID_SEDE);
    }
    updateHeader(); 
    if(window.navigator.vibrate) window.navigator.vibrate(10); 
    setTimeout(() => toggleModal('sedes-modal', false), 50); 
}

function getSourceData() { if(!db) return []; if(currentType === 'Combos') return db.combos || []; if(currentType === 'Individual') return db.catalogo || []; if(currentType === 'Servicios') return (db.catalogo || []).filter(p => p.tipo === 'Servicios'); return []; }
function getAllSourceData() { return [...(db?.catalogo || []), ...(db?.combos || [])]; }

function getProductPrice(p) { 
    if(p.precios) { 
        if(p.promocion?.activa && p.precios.promo > 0) return parseFloat(p.precios.promo); 
        return parseFloat(p.precios.normal || 0); 
    } 
    if(p.precio_promo && parseFloat(p.precio_promo) > 0) return parseFloat(p.precio_promo); 
    return parseFloat(p.precio || 0); 
}

function getUnifiedId(p) { return (p.id || p.id_producto || p.ID_PRODUCTO_VENTA || '').toString(); }

function getLevenshtein(a, b) {
    if(a.length === 0) return b.length;
    if(b.length === 0) return a.length;
    let prevRow = Array.from({length: b.length + 1}, (_, i) => i);
    for (let i = 0; i < a.length; i++) {
        let currRow = [i + 1];
        for (let j = 0; j < b.length; j++) {
            let cost = a[i] === b[j] ? 0 : 1;
            currRow.push(Math.min(currRow[j] + 1, prevRow[j + 1] + 1, prevRow[j] + cost));
        }
        prevRow = currRow;
    }
    return prevRow[b.length];
}

function getSearchScore(query, text) {
    if (!query) return 1;
    
    const normalize = (s) => {
        let str = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/s\b/g, '');
        str = str.replace(/(\d+)\s+(kg|gr|g|lt|l|ml|cc|und|u|paq|pqte)\b/gi, '$1$2');
        return str;
    };
    
    const qClean = normalize(query);
    const tClean = normalize(text);
    
    let score = 0;

    if (tClean === qClean) {
        score += 1000;
    } else if (tClean.includes(qClean)) {
        score += 500;
    }

    const qWords = qClean.split(/\s+/).filter(w => w.length > 0);
    const tWords = tClean.split(/\s+/).filter(w => w.length > 0);
    
    let allWordsMatch = true;

    for (const qw of qWords) {
        let wordMatched = false;
        
        const isUnit = /^\d+(kg|gr|g|lt|l|ml|cc|und|u|paq|pqte)$/.test(qw);

        if (tClean.includes(qw)) {
            score += 50;
            wordMatched = true;
            
            if (tWords.includes(qw)) {
                score += 150; 
                if(isUnit) score += 500; 
            }
        } else {
            const maxTypos = qw.length <= 4 ? 1 : 2; 
            let bestFuzzy = -1;
            
            for (const tw of tWords) {
                const limit = Math.min(tw.length, qw.length + Math.floor(maxTypos/2));
                const dist = getLevenshtein(qw, tw.substring(0, limit));
                
                if (dist <= maxTypos) {
                    wordMatched = true;
                    let fuzzyScore = 20 - (dist * 5); 
                    if (fuzzyScore > bestFuzzy) bestFuzzy = fuzzyScore;
                }
            }
            if (bestFuzzy > 0) score += bestFuzzy;
        }
        
        if (!wordMatched) allWordsMatch = false;
    }

    return allWordsMatch ? score : 0;
}

function onSearchInput() {
    const val = document.getElementById('global-search').value.trim();
    const icon = document.getElementById('search-icon');
    const tabsContainer = document.getElementById('type-tabs-container');
    
    if (val.length > 0) {
        icon.innerText = 'close';
        icon.classList.add('text-primary');
        catalogLimit = 9999; 
        
        tabsContainer.classList.add('tabs-hidden');

        if (currentSort !== 'relevancia') {
            currentSort = 'relevancia';
        }

        if (currentCat !== 'TODOS') {
            currentCat = 'TODOS';
            const menuBtn = document.getElementById('cat-menu-btn');
            if(menuBtn) {
                menuBtn.classList.add('bg-white/10', 'border-white/20');
                menuBtn.classList.remove('bg-primary', 'border-primary');
            }
        }
    } else {
        icon.innerText = 'search';
        icon.classList.remove('text-primary');
        catalogLimit = 24; 
        
        tabsContainer.classList.remove('tabs-hidden');
        if (currentSort === 'relevancia') currentSort = 'precio_menor';
    }
    
    clearTimeout(searchRenderTimer);
    clearTimeout(searchScrollTimer);

    searchRenderTimer = setTimeout(() => {
        window.requestAnimationFrame(() => {
            render();
        });
        if (val.length > 0) scrollToCatalog();
    }, 1500); 
}

function handleSearchEnter(e) {
    if (e.key === 'Enter') {
        e.preventDefault(); 
        clearTimeout(searchRenderTimer);
        clearTimeout(searchScrollTimer);
        if(document.activeElement) document.activeElement.blur(); 
        
        window.requestAnimationFrame(() => {
            render(); 
            setTimeout(() => {
                scrollToCatalog();
            }, 50); 
        });
    }
}

function handleSearchClick() {
    const input = document.getElementById('global-search');
    if (input.value.length > 0) {
        input.value = '';
        clearCategoryAndKeepScroll(); 
        onSearchInput(); 
        clearTimeout(searchRenderTimer);
        render(); 
    } else {
        input.focus();
    }
}

function scrollToCatalog() {
    const grid = document.getElementById('catalog-anchor');
    if (grid) {
        const offset = 80; 
        const y = grid.getBoundingClientRect().top + window.scrollY - offset;
        
        window.scrollTo({ top: y, behavior: 'smooth' });
        
        setTimeout(() => { lastScrollY = window.scrollY; }, 500); 
    }
}

function render() { if(!db) return; renderCatalog(); }

function showSkeletons() {
    const grid = document.getElementById('catalog-grid');
    if(!grid) return;
    let skeletons = '';
    for(let i=0; i<6; i++) {
        skeletons += `
            <div class="product-card-glass glass-contour skeleton rounded-3xl" style="height: 280px; width: 100%;">
                <div class="mt-auto p-4 w-full text-center">
                    <div class="skeleton-title"></div>
                    <div class="skeleton-pill mt-4"></div>
                </div>
            </div>`;
    }
    grid.innerHTML = `<div class="auto-grid px-1 pt-4 pb-4">${skeletons}</div>`;
}

function selectCategory(c) {
    if (currentCat === c) {
        toggleModal('categories-modal', false);
        return;
    }
    
    toggleModal('categories-modal', false);
    
    setTimeout(() => {
        showSkeletons();
        setTimeout(() => {
            setCat(c);
        }, 50);
    }, 150);
}

function renderAllCategories() {
    const items = getSourceData();
    const cats = ['TODOS', ...new Set(items.map(p => p.categoria).filter(Boolean))]; 
    document.getElementById('all-categories-list').innerHTML = cats.map(c => `<button onclick="deferAction(() => selectCategory('${c}'))" class="cat-btn w-full py-4 rounded-2xl text-[10px] font-black uppercase border ${currentCat === c ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-white/5 text-zinc-400 border-white/10'}">${c}</button>`).join('');
}

function renderPromos() {
    const section = document.getElementById('promo-section');
    const today = new Date();
    const dayNames = ["Domingo","Lunes","Martes","Miercoles","Jueves","Viernes","Sabado"];
    const currentDay = dayNames[today.getDay()];
    
    const promos = getAllSourceData().filter(p => {
        if(p.promocion?.activa && p.promocion) {
            const dateOk = p.promocion.hasta ? new Date(p.promocion.hasta) >= today : true;
            const dayOk = p.promocion.dias?.includes(currentDay) || p.promocion.dias?.includes("Todos Los Dias");
            return dateOk && dayOk;
        }
        return p.precio_promo && parseFloat(p.precio_promo) > 0;
    });
    
    if(promos.length) { 
        section.classList.remove('hidden'); 
        document.querySelector('#promo-section button').setAttribute('onclick', "deferAction(() => { setCat('PROMOCIONES'); scrollToCatalog(); })");
        const containerClass = 'flex overflow-x-auto hide-scrollbar flex-nowrap overscroll-x-contain gap-4 px-1 pt-4 pb-4 scroll-smooth';
        document.getElementById('promo-carousel').className = containerClass;
        document.getElementById('promo-carousel').innerHTML = promos.map(p => createCard(p, true)).join(''); 
    }
    else section.classList.add('hidden');
}

function changeSort(val) {
    currentSort = val;
    renderCatalog();
}

function extractUnitValue(name) {
    if (!name) return 0;
    const match = name.match(/([\d.,]+)\s*(KG|GR|G|LT|L|ML|CC|UND|U|PAQ|PQTE)\s*$/i);
    if (match) {
        let val = parseFloat(match[1].replace(',', '.'));
        let unit = match[2].toUpperCase();
        if (unit === 'KG' || unit === 'LT' || unit === 'L') return val * 1000;
        if (unit === 'GR' || unit === 'G' || unit === 'ML' || unit === 'CC') return val;
        if (unit === 'UND' || unit === 'U' || unit === 'PAQ' || unit === 'PQTE') return val; 
        return val;
    }
    return 0;
}

function renderCatalog() {
    const search = document.getElementById('global-search').value.trim();
    
    let items = search !== '' ? getAllSourceData() : getSourceData();
    
    if (currentCat === 'PROMOCIONES') {
        const today = new Date();
        const dayNames = ["Domingo","Lunes","Martes","Miercoles","Jueves","Viernes","Sabado"];
        const currentDay = dayNames[today.getDay()];
        
        items = items.filter(p => {
            if(p.promocion?.activa && p.promocion) {
                const dateOk = p.promocion.hasta ? new Date(p.promocion.hasta) >= today : true;
                const dayOk = p.promocion.dias?.includes(currentDay) || p.promocion.dias?.includes("Todos Los Dias");
                return dateOk && dayOk;
            }
            return p.precio_promo && parseFloat(p.precio_promo) > 0;
        });
    } else if(currentCat !== 'TODOS' && search === '') { 
        items = items.filter(p => p.categoria === currentCat); 
    }
    
    if(search) {
        const normalize = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const searchClean = normalize(search);

        items = items.map(p => {
            let score = getSearchScore(search, p.nombre);
            
            if (p.categoria && normalize(p.categoria) === searchClean) {
                score += 5000;
            }
            
            return {
                ...p,
                _searchScore: score
            };
        }).filter(p => p._searchScore > 0);
        
        items.sort((a, b) => {
            if (currentSort === 'relevancia' || currentSort === 'default') {
                if (b._searchScore !== a._searchScore) {
                    return b._searchScore - a._searchScore;
                }
            }
            if(currentSort === 'precio_mayor') return getProductPrice(b) - getProductPrice(a);
            if(currentSort === 'precio_menor') return getProductPrice(a) - getProductPrice(b);
            if(currentSort === 'pres_mayor') return extractUnitValue(b.nombre) - extractUnitValue(a.nombre);
            if(currentSort === 'pres_menor') return extractUnitValue(a.nombre) - extractUnitValue(b.nombre);
            return b._index - a._index;
        });
    } else {
        if(currentSort === 'precio_mayor') items.sort((a, b) => getProductPrice(b) - getProductPrice(a));
        else if(currentSort === 'precio_menor') items.sort((a, b) => getProductPrice(a) - getProductPrice(b));
        else if(currentSort === 'pres_mayor') items.sort((a, b) => extractUnitValue(b.nombre) - extractUnitValue(a.nombre));
        else if(currentSort === 'pres_menor') items.sort((a, b) => extractUnitValue(a.nombre) - extractUnitValue(b.nombre));
        else items.sort((a, b) => b._index - a._index);
    }
    
    totalFilteredItemsCount = items.length;
    
    const isCarousel = currentCat === 'TODOS' && search === '';
    const paginatedItems = isCarousel ? items : items.slice(0, catalogLimit);

    let grouped = {};
    if (search) {
        grouped['RESULTADOS'] = paginatedItems;
    } else {
        grouped = paginatedItems.reduce((acc,p) => { const cat = p.categoria || 'VARIOS'; acc[cat] = acc[cat] || []; acc[cat].push(p); return acc; }, {});
    }
    
    const showFilterUI = currentCat !== 'TODOS' || search !== '';

    const filterUI = showFilterUI ? `
        <div class="relative ml-auto">
            <select onchange="deferAction(() => changeSort(this.value))" class="filter-select appearance-none bg-white/5 border border-white/10 text-white font-black uppercase rounded-full outline-none focus:border-[#ff0000] focus:ring-1 focus:ring-[#ff0000]">
                ${search ? `<option class="text-black" value="relevancia" ${currentSort==='relevancia'?'selected':''}>Relevancia</option>` : ''}
                <option class="text-black" value="default" ${currentSort==='default'?'selected':''}>Últimos</option>
                <option class="text-black" value="precio_menor" ${currentSort==='precio_menor'?'selected':''}>Precio: Menor</option>
                <option class="text-black" value="precio_mayor" ${currentSort==='precio_mayor'?'selected':''}>Precio: Mayor</option>
                <option class="text-black" value="pres_mayor" ${currentSort==='pres_mayor'?'selected':''}>Volumen: Mayor</option>
                <option class="text-black" value="pres_menor" ${currentSort==='pres_menor'?'selected':''}>Volumen: Menor</option>
            </select>
            <span class="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-[14px] text-zinc-400 pointer-events-none">filter_list</span>
        </div>
    ` : '';
    
    const htmlString = Object.entries(grouped).map(([cat, products]) => {
        const containerClass = isCarousel ? 'flex overflow-x-auto hide-scrollbar flex-nowrap overscroll-x-contain gap-4 px-1 pt-4 pb-4 scroll-smooth' : 'auto-grid px-1 pt-4 pb-4';
        
        let titleBtn = '';
        let rightBtn = '';

        if (search) {
            titleBtn = `<button onclick="document.getElementById('global-search').value=''; onSearchInput(); clearTimeout(searchRenderTimer); render();" class="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-zinc-400 active:scale-90 ml-2 flex-shrink-0"><span class="material-symbols-outlined text-[16px]">close</span></button>`;
        } else if (currentCat !== 'TODOS') {
            titleBtn = `<button onclick="clearCategoryAndKeepScroll()" class="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-zinc-400 active:scale-90 ml-2 flex-shrink-0"><span class="material-symbols-outlined text-[16px]">close</span></button>`;
        } else if (isCarousel) {
            rightBtn = `<button onclick="deferAction(() => selectCategory('${cat}'))" class="text-[10px] font-black text-zinc-300 uppercase bg-white/10 border border-white/20 px-4 py-2 rounded-full active:scale-95 flex-shrink-0 transition-colors ml-2">Ver Todo</button>`;
        }
        
        return `<div class="mb-10"><div class="flex items-center justify-between mb-5 px-1"><div class="flex items-center gap-3 w-full"><div class="w-1.5 h-6 bg-primary rounded-full flex-shrink-0"></div><div class="flex items-center gap-0"><h2 class="text-xl font-black text-white uppercase tracking-tight truncate">${cat}</h2>${titleBtn}</div></div>${filterUI}${rightBtn}</div><div class="${containerClass}">${products.map(p => createCard(p, isCarousel)).join('')}</div></div>`;
    }).join('');
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlString || '<div class="text-center text-zinc-500 py-10 font-bold uppercase tracking-widest text-xs">No se encontraron resultados</div>';
    
    const fragment = document.createDocumentFragment();
    while(tempDiv.firstChild) {
        fragment.appendChild(tempDiv.firstChild);
    }
    
    const grid = document.getElementById('catalog-grid');
    grid.innerHTML = ''; 
    grid.appendChild(fragment); 
}

function triggerTap(el) {
    if (!el) return;
    el.classList.add('btn-bounce-active');
    setTimeout(() => el.classList.remove('btn-bounce-active'), 150);
}

function createCard(p, isCarousel) {
    const id = getUnifiedId(p);
    const count = cart[id] || 0; 
    const isOut = p.status === 'OUT_OF_STOCK';
    const price = getProductPrice(p);
    const isPromo = (p.promocion?.activa) || (p.precio_promo && parseFloat(p.precio_promo) > 0);
    const priceDisplay = price === 0 ? 'SOLICITAR PRECIO' : '$' + price.toFixed(2);
    
    const cardClass = isCarousel ? 'carousel-card' : 'w-full';
    const contourClass = isPromo ? 'card-promo' : '';
    const pricePillAnimationClass = '';
    
    const img = p.imagen || DEFAULT_IMG;
    
    return `<div class="product-card-glass glass-contour ${isOut ? 'out-of-stock' : ''} ${cardClass} ${contourClass}" data-id="${id}" onclick="openProductView('${id}')">
        <div class="bg-blur-image" style="background-image: url('${img}')"></div>
        
        <div class="glass-overlay">
            <div class="w-full aspect-square rounded-2xl overflow-hidden mb-2 relative flex items-center justify-center image-container flex-shrink-0">
                ${isPromo ? '<div class="absolute top-2 left-2 z-30 bg-black/60 backdrop-blur-md border border-white/10 text-white text-[9px] font-black px-2 py-1 rounded-full shadow-lg tracking-widest flex items-center gap-1">🔥 PROMO!</div>' : ''}
                <img class="main-image" src="${img}" decoding="async" onload="this.classList.add('loaded')" onerror="this.classList.add('loaded')" loading="lazy" oncontextmenu="return false;" draggable="false"/>
                <img class="placeholder-blur" src="${img}" aria-hidden="true" decoding="async"/>
            </div>
            
            <h3 class="card-title text-white uppercase text-center w-full font-black leading-tight">${p.nombre}</h3>
            <p class="text-[8px] text-zinc-400/80 font-bold uppercase tracking-widest mb-1 text-center mt-auto">Toca para ver más</p>
            
            <div class="flex justify-center w-full pt-1 relative btn-action-area btn-bounce" onclick="event.stopPropagation(); triggerTap(this); add('${id}')">
                ${count > 0 ? `<div class="count-badge">${count}</div>` : ''} 
                <button class="price-pill w-full py-2.5 rounded-full text-[11px] md:text-xs font-bold flex items-center justify-center gap-1 ${count > 0 ? 'active' : ''}" ${isOut ? 'disabled' : ''}>
                    ${isOut ? 'SIN STOCK' : priceDisplay}
                </button>
            </div>
        </div>
    </div>`;
}

function renderCart() {
    const list = document.getElementById('cart-items-list');
    const items = Object.keys(cart).map(id => { const p = getAllSourceData().find(x => getUnifiedId(x) === id); return p ? {...p, qty: cart[id]} : null; }).filter(p => p && p.qty > 0);
    
    if(!items.length) { list.innerHTML = `<div class="flex flex-col items-center justify-center py-20 text-zinc-600"><span class="material-symbols-outlined text-6xl mb-4">shopping_basket</span><p class="font-black uppercase tracking-widest text-[10px]">Carrito vacío</p></div>`; return; }
    
    list.innerHTML = items.map(p => { 
        const id = getUnifiedId(p); const price = getProductPrice(p); 
        const priceDisplay = price === 0 ? '<span class="text-xs text-zinc-400">SOLICITAR PRECIO</span>' : `$${price.toFixed(2)} <span class="text-[10px] text-primary font-bold ml-1">C/u</span>`;
        const img = p.imagen || DEFAULT_IMG;

        return `<div class="flex items-center justify-between bg-white/5 p-3 rounded-3xl border border-white/10 gap-2 cursor-pointer active:scale-[0.98]" id="cart-item-${id}" onclick="openProductView('${id}')">
            <div class="flex items-center gap-3 flex-1 min-w-0">
                <div class="w-[72px] h-[72px] rounded-2xl overflow-hidden bg-white/5 flex-shrink-0">
                    <img src="${img}" decoding="async" class="w-full h-full object-cover" oncontextmenu="return false;" draggable="false">
                </div>
                <div class="flex flex-col min-w-0 flex-1 pr-1">
                    <span class="text-sm md:text-base font-[800] text-white uppercase leading-tight line-clamp-2 w-full">${p.nombre}</span>
                    <span class="text-sm md:text-base text-primary font-black tracking-wider mt-1">${priceDisplay}</span>
                </div>
            </div>
            <div class="flex items-center justify-between bg-white/5 rounded-full p-1 border border-white/10 flex-shrink-0" onclick="event.stopPropagation();">
                <button onclick="changeQty('${id}', -1)" class="w-7 h-7 rounded-full flex items-center justify-center text-white active:scale-90">
                    <span class="material-symbols-outlined text-[16px]">remove</span>
                </button>
                <span class="w-5 text-center text-[11px] font-black text-white">${p.qty}</span>
                <button onclick="changeQty('${id}', 1)" class="w-7 h-7 rounded-full flex items-center justify-center text-white active:scale-90">
                    <span class="material-symbols-outlined text-[16px]">add</span>
                </button>
            </div>
        </div>`; 
    }).join('');
}

function changeQty(id, delta) {
    const newQty = Math.max(0, (cart[id] || 0) + delta);
    if(newQty === 0) delete cart[id];
    else cart[id] = newQty;
    
    const cartModalActive = document.getElementById('cart-modal').classList.contains('active');
    if(cartModalActive) renderCart();
    
    updateOrder();
    syncCardBadge(id); 
    saveCart(); 
    
    playClick();
    if(window.navigator.vibrate) window.navigator.vibrate(5); 
}

function syncCardBadge(id) {
    const count = cart[id] || 0;
    document.querySelectorAll(`[data-id="${id}"]`).forEach(card => {
        const badge = card.querySelector('.count-badge');
        const pill = card.querySelector('.price-pill');
        
        if(count > 0) { 
            if(badge) badge.innerText = count; 
            else { 
                const area = card.querySelector('.btn-action-area'); 
                if(area) area.insertAdjacentHTML('afterbegin', `<div class="count-badge">${count}</div>`); 
            } 
            if(pill) pill.classList.add('active'); 
        }
        else { 
            if(badge) badge.remove(); 
            if(pill) pill.classList.remove('active'); 
        }
    });
}

function clearCart() { 
    customConfirm('¿Seguro que deseas vaciar todo el pedido?', () => {
        cart = {}; 
        updateOrder(); 
        document.querySelectorAll('.count-badge').forEach(b => b.remove()); 
        document.querySelectorAll('.price-pill').forEach(p => p.classList.remove('active')); 
        saveCart(); 
        renderCart(); 
        toggleModal('cart-modal', false); 
    }, 'Vaciar Pedido');
}

function add(id) { 
    cart[id] = (cart[id] || 0) + 1; 
    updateOrder(); 
    syncCardBadge(id); 
    saveCart(); 
    
    playClick();
    if(window.navigator.vibrate) window.navigator.vibrate(8); 
    
    const cartActive = document.getElementById('cart-modal').classList.contains('active'); 
    if(cartActive) renderCart(); 
}

function updateOrder() {
    let total = 0, count = 0;
    const all = getAllSourceData();
    Object.keys(cart).forEach(id => { const p = all.find(x => getUnifiedId(x) === id); if(p) { const price = getProductPrice(p); total += price * cart[id]; count += cart[id]; } });
    
    document.getElementById('order-total').innerText = `$${total.toFixed(2)}`;
    document.getElementById('cart-subtotal').innerText = `$${total.toFixed(2)}`;
    
    const subtotalBsEl = document.getElementById('cart-subtotal-bs');
    if(subtotalBsEl) {
        const totalBs = total * tasaBCV;
        subtotalBsEl.innerText = `Bs ${totalBs.toLocaleString('es-ES', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    }
    
    const island = document.getElementById('order-island');
    if(count > 0) {
        island.classList.remove('order-island-hidden');
        document.body.classList.add('island-active');
    } else {
        island.classList.add('order-island-hidden');
        document.body.classList.remove('island-active');
    }
}

function setType(type, btn) { 
    if (currentType === type) return;
    
    document.querySelectorAll('.type-tab').forEach(b => { b.classList.remove('type-tab-active'); b.classList.add('type-tab-inactive'); }); 
    btn.classList.add('type-tab-active'); 
    btn.classList.remove('type-tab-inactive'); 
    
    const menuBtn = document.getElementById('cat-menu-btn');
    if(menuBtn) {
        menuBtn.classList.add('bg-white/10', 'border-white/20');
        menuBtn.classList.remove('bg-primary', 'border-primary');
    }

    currentType = type; 
    currentCat = 'TODOS'; 
    catalogLimit = 24; 

    const searchInput = document.getElementById('global-search');
    if (searchInput) searchInput.value = ''; 
    const searchIcon = document.getElementById('search-icon');
    if(searchIcon) {
        searchIcon.innerText = 'search';
        searchIcon.classList.remove('text-primary');
    }
    
    const tabsContainer = document.getElementById('type-tabs-container');
    tabsContainer.classList.remove('tabs-hidden');
    
    showSkeletons();
    
    setTimeout(() => {
        renderCatalog();
        scrollToCatalog();
    }, 150); 
}

function setCat(c) { 
    currentCat = c; 
    catalogLimit = 24; 
    
    const menuBtn = document.getElementById('cat-menu-btn');
    if (c !== 'TODOS') {
        menuBtn.classList.remove('bg-white/10', 'border-white/20');
        menuBtn.classList.add('bg-primary', 'border-primary');
    } else {
        menuBtn.classList.add('bg-white/10', 'border-white/20');
        menuBtn.classList.remove('bg-primary', 'border-primary');
    }
    
    const searchInput = document.getElementById('global-search');
    if(searchInput) searchInput.value = ''; 
    const searchIcon = document.getElementById('search-icon');
    if(searchIcon) {
        searchIcon.innerText = 'search';
        searchIcon.classList.remove('text-primary');
    }
    
    render(); 
    scrollToCatalog();
}

function shareProduct(id, name) {
    const url = window.location.origin + window.location.pathname + '?id=' + id;
    if (navigator.share) {
        navigator.share({ title: 'Combox - ' + name, url: url }).catch(console.error);
    } else {
        navigator.clipboard.writeText(url);
        customAlert('¡Enlace del producto copiado con éxito!');
    }
}

function shareSugerencias() {
    const url = window.location.origin + window.location.pathname + '?sugerencias=true';
    if (navigator.share) {
        navigator.share({ title: 'Combox - Buzón de Sugerencias', url: url }).catch(console.error);
    } else {
        navigator.clipboard.writeText(url);
        customAlert('¡Enlace de sugerencias copiado!');
    }
}

function openProductView(id) {
    setTimeout(() => {
        const p = getAllSourceData().find(x => getUnifiedId(x) === id);
        if(!p) return;
        
        const price = getProductPrice(p);
        const isOut = p.status === 'OUT_OF_STOCK';
        const img = p.imagen || DEFAULT_IMG;
        const safeName = p.nombre.replace(/'/g, "\\'");
        const priceDisplay = price === 0 ? 'Por cotizar' : '$' + price.toFixed(2);
        
        document.getElementById('product-content').innerHTML = `
            <div class="absolute inset-0 bg-[#0A0A0B] z-0"></div>
            <div class="absolute -inset-10 z-10 opacity-35 bg-cover bg-center pointer-events-none" style="background-image: url('${img}'); filter: blur(40px); transform: translateZ(0);"></div>
            <div class="absolute bottom-0 inset-x-0 h-[65%] z-20 pointer-events-none bg-gradient-to-t from-[#0A0A0B] via-[#0A0A0B]/85 to-transparent"></div>
            
            <div class="absolute top-4 right-4 z-50 flex items-center gap-2">
                <button type="button" class="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white active:scale-90 shadow-lg transition-transform" onclick="shareProduct('${id}', '${safeName}')">
                    <span class="material-symbols-outlined text-[18px]">ios_share</span>
                </button>
                <button type="button" class="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white active:scale-90 shadow-lg transition-transform" onclick="toggleModal('product-modal', false)">
                    <span class="material-symbols-outlined text-lg">close</span>
                </button>
            </div>
            
            <div class="relative z-30 w-full flex-shrink-0 flex items-center justify-center mt-20 mb-4 px-8" style="height: 35vh;">
                <div class="relative w-full max-w-[280px] aspect-square rounded-3xl overflow-hidden shadow-2xl bg-black/20 border border-white/20 glass-contour" style="box-shadow: inset 0 0 20px rgba(255,255,255,0.1), 0 20px 40px rgba(0,0,0,0.6);">
                    <img src="${img}" decoding="async" class="w-full h-full object-cover pointer-events-none select-none rounded-3xl" draggable="false" oncontextmenu="return false;"/>
                </div>
            </div>
            
            <div class="relative z-40 p-6 md:p-8 flex flex-col flex-1 overflow-y-auto hide-scrollbar">
                <h2 class="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter leading-tight mb-2 drop-shadow-md">${p.nombre}</h2>
                <p class="text-sm text-zinc-300 leading-relaxed overflow-y-auto hide-scrollbar mb-6 drop-shadow-md">${p.descripcion || 'Sin descripción.'}</p>
                <div class="mt-auto pt-4 border-t border-white/20 flex items-center justify-between">
                    <div class="flex flex-col">
                        <span class="text-[10px] text-zinc-400 uppercase font-black tracking-widest mb-0.5">Precio</span>
                        <span class="text-3xl font-black text-white tracking-tighter leading-none drop-shadow-lg">${priceDisplay}</span>
                    </div>
                    <button type="button" onclick="add('${id}'); toggleModal('product-modal', false);" ${isOut ? 'disabled' : ''} class="bg-primary text-white font-black px-8 py-3.5 rounded-full text-xs uppercase shadow-lg shadow-primary/40 active:scale-95 tracking-widest ${isOut ? 'opacity-50 grayscale' : ''}">
                        ${isOut ? 'Agotado' : 'Agregar'}
                    </button>
                </div>
            </div>`;
        toggleProductModal(true); 
    }, 15);
}

init();

