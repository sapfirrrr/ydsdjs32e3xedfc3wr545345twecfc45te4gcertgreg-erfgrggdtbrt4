// Инициализация карты — Братск
const map = L.map('map', {
    attributionControl: false
}).setView([56.150703, 101.632976], 16);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; CartoDB',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

// Глобальные переменные
let allKiosks = [];
let markersLayer = L.layerGroup().addTo(map);
let selectedMarker = null;
let currentKioskId = null;

// Функция создания иконки для выбранного объекта
function createSelectedIcon() {
    return L.divIcon({
        className: 'selected-icon',
        html: `<div style="
            width: 40px; height: 40px;
            background: #9b59b6;
            border: 4px solid white;
            border-radius: 50%;
            box-shadow: 0 0 20px rgba(155, 89, 182, 0.9), 0 0 60px rgba(155, 89, 182, 0.5);
            animation: pulse 1.5s ease-in-out infinite;
        "></div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    });
}

// Расчёт остатка по договору
function getRemaining(contractDate) {
    const now = new Date();
    const end = new Date(contractDate);
    const diffMs = end - now;

    if (!contractDate || diffMs <= 0) {
        return { text: 'Истёк / нет договора', color: '#95a5a6' };
    }

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);

    let text = '';
    if (years > 0) text += years + ' г. ';
    if (months > 0) text += months + ' мес.';
    if (years === 0 && months === 0) text = 'Менее месяца';

    let color;
    if (years < 1) color = '#e74c3c';
    else if (years < 3) color = '#f39c12';
    else color = '#27ae60';

    return { text: text.trim(), color: color };
}

// Создание иконки маркера по цвету
function createIcon(color) {
    return L.divIcon({
        className: 'custom-icon',
        html: `<div style="
            width: 20px; height: 20px;
            background: ${color};
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        "></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
}

// Проверка статуса киоска (свободен/занят)
function getKioskStatus(k) {
    const now = new Date();
    const end = new Date(k.contract);
    return (!k.contract || end <= now) ? 'free' : 'taken';
}

// Основная функция фильтрации и отрисовки
function applyFilters() {
    let filtered = [...allKiosks];

    // 1. Текстовый поиск
    const query = document.getElementById('search').value.toLowerCase().trim();
    if (query) {
        filtered = filtered.filter(k =>
            k.name.toLowerCase().includes(query) ||
            k.id.toString().includes(query)
        );
    }

    // 2. Статус
    const statusFilter = document.getElementById('filter-status').value;
    if (statusFilter !== 'all') {
        filtered = filtered.filter(k => getKioskStatus(k) === statusFilter);
    }

    // 3. Специализация
    const specFilter = document.getElementById('filter-specialization').value;
    if (specFilter !== 'all') {
        filtered = filtered.filter(k => (k.specialization || '').trim() === specFilter);
    }

    // 4. Площадь (от и до)
    const areaMin = parseFloat(document.getElementById('filter-area-min').value);
    const areaMax = parseFloat(document.getElementById('filter-area-max').value);
    if (!isNaN(areaMin)) {
        filtered = filtered.filter(k => k.area >= areaMin);
    }
    if (!isNaN(areaMax)) {
        filtered = filtered.filter(k => k.area <= areaMax);
    }

    // 5. Срок договора (радиокнопки)
    const termRadio = document.querySelector('input[name="contract-term"]:checked');
    if (termRadio) {
        const termValue = termRadio.value;
        if (termValue === 'less1') {
            filtered = filtered.filter(k => {
                const rem = getRemaining(k.contract);
                return rem.color === '#e74c3c' && k.contract && new Date(k.contract) > new Date();
            });
        } else if (termValue === '1to3') {
            filtered = filtered.filter(k => {
                const rem = getRemaining(k.contract);
                return rem.color === '#f39c12' && k.contract && new Date(k.contract) > new Date();
            });
        } else if (termValue === 'more3') {
            filtered = filtered.filter(k => {
                const rem = getRemaining(k.contract);
                return rem.color === '#27ae60' && k.contract && new Date(k.contract) > new Date();
            });
        } else if (termValue === 'expired') {
            filtered = filtered.filter(k => {
                const status = getKioskStatus(k);
                return status === 'free';
            });
        }
        // 'all' — ничего не делаем
    }

    renderKiosks(filtered);

    // Если найден ровно один и есть поиск — центрируем
    if (filtered.length === 1 && query) {
        map.setView([filtered[0].lat, filtered[0].lng], 18);
    }
}

// Отрисовка маркеров на карте
function renderKiosks(kiosks) {
    markersLayer.clearLayers();

    kiosks.forEach(k => {
        const rem = getRemaining(k.contract);
        const marker = L.marker([k.lat, k.lng], { icon: createIcon(rem.color) });

        marker.on('click', () => {
            if (currentKioskId === k.id && !document.getElementById('card').classList.contains('hidden')) {
                return;
            }
            currentKioskId = k.id;

            // Заполняем карточку
            document.getElementById('card-name').textContent = k.name;
            document.getElementById('card-specialization').textContent = k.specialization || 'не указана';
            document.getElementById('card-area').textContent = k.area;
            document.getElementById('card-contract').textContent = k.contract || '—';
            document.getElementById('card-remaining').textContent = rem.text;
            document.getElementById('card-2gis-link').href = `https://2gis.ru/geo/${k.lng},${k.lat}`;

            // Удаляем старый указатель
            if (selectedMarker) {
                map.removeLayer(selectedMarker);
                selectedMarker = null;
            }
            currentKioskId = null;

            // Создаём новый фиолетовый указатель
            selectedMarker = L.marker([k.lat, k.lng], {
                icon: createSelectedIcon(),
                zIndexOffset: 1000
            }).addTo(map);

            // Статус и кнопка аренды
            const statusEl = document.getElementById('card-status');
            const rentBtn = document.getElementById('card-rent-btn');
            const status = getKioskStatus(k);
            if (status === 'free') {
                statusEl.textContent = 'Свободен';
                statusEl.className = 'status-free';
                rentBtn.style.display = 'inline-block';
            } else {
                statusEl.textContent = 'Занят';
                statusEl.className = 'status-taken';
                rentBtn.style.display = 'none';
            }

            document.getElementById('card').classList.remove('hidden');
            document.getElementById('card-rent-btn').addEventListener('click', function(e) {
                e.stopPropagation();
                showRentModal();
            });
        });

        markersLayer.addLayer(marker);
    });
}

// Загрузка данных
fetch('kiosks.json')
    .then(response => response.json())
    .then(data => {
        allKiosks = data;
        // Заполняем выпадающий список специализаций
        const specSelect = document.getElementById('filter-specialization');
        const specs = new Set();
        allKiosks.forEach(k => {
            const s = (k.specialization || '').trim();
            if (s) specs.add(s);
        });
        specs.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = s;
            specSelect.appendChild(opt);
        });
        applyFilters();
    })
    .catch(err => {
        alert('Ошибка загрузки данных: ' + err.message);
    });

// События фильтров
document.getElementById('search').addEventListener('input', applyFilters);
document.getElementById('filter-status').addEventListener('change', applyFilters);
document.getElementById('filter-specialization').addEventListener('change', applyFilters);
document.getElementById('filter-area-min').addEventListener('input', applyFilters);
document.getElementById('filter-area-max').addEventListener('input', applyFilters);
document.querySelectorAll('input[name="contract-term"]').forEach(el => {
    el.addEventListener('change', applyFilters);
});

// Кнопка "Применить" (дублирует applyFilters, но можно оставить для удобства)
document.getElementById('applyFiltersBtn').addEventListener('click', applyFilters);

// Сброс всех фильтров
document.getElementById('resetFiltersBtn').addEventListener('click', function() {
    document.getElementById('search').value = '';
    document.getElementById('filter-status').value = 'all';
    document.getElementById('filter-specialization').value = 'all';
    document.getElementById('filter-area-min').value = '';
    document.getElementById('filter-area-max').value = '';
    document.querySelector('input[name="contract-term"][value="all"]').checked = true;
    applyFilters();
});

// Показать/скрыть расширенные фильтры
document.getElementById('toggleFiltersBtn').addEventListener('click', function() {
    const adv = document.getElementById('advancedFilters');
    adv.classList.toggle('hidden');
    this.textContent = adv.classList.contains('hidden') ? '⚙️ Расширенный фильтр' : '⚙️ Скрыть фильтры';
});

// Скрытие карточки и указателя при клике на карту
map.on('click', function () {
    document.getElementById('card').classList.add('hidden');
    if (selectedMarker) {
        map.removeLayer(selectedMarker);
        selectedMarker = null;
    }
    currentKioskId = null;
});

// ---- Модальное окно со списком ----
const modal = document.getElementById('listModal');
const showListBtn = document.getElementById('showListBtn');
const closeModal = document.getElementById('closeModal');
const listSearch = document.getElementById('listSearch');
const listContainer = document.getElementById('kioskListContainer');

function renderKioskList(filter = '') {
    const query = filter.toLowerCase().trim();
    let filtered = allKiosks.filter(k =>
        k.name.toLowerCase().includes(query) ||
        k.id.toString().includes(query)
    );

    if (filtered.length === 0) {
        listContainer.innerHTML = '<p style="text-align:center; color:#888; padding:20px;">Ничего не найдено</p>';
        return;
    }

    let html = '';
    filtered.forEach(k => {
        const rem = getRemaining(k.contract);
        const status = getKioskStatus(k);
        const statusLabel = status === 'free' ? 'Свободен' : 'Занят';
        const statusClass = status === 'free' ? 'free' : 'taken';

        html += `
            <div class="kiosk-item" data-id="${k.id}">
                <div>
                    <span class="name">${k.name}</span>
                    <span class="status-badge ${statusClass}">${statusLabel}</span>
                </div>
                <div class="detail">
                    № ${k.id} · Площадь: ${k.area} м² · Договор до: ${k.contract || '—'} · Осталось: ${rem.text}
                </div>
            </div>
        `;
    });
    listContainer.innerHTML = html;

    listContainer.querySelectorAll('.kiosk-item').forEach(el => {
        el.addEventListener('click', function() {
            const id = parseInt(this.dataset.id);
            const kiosk = allKiosks.find(k => k.id === id);
            if (kiosk) {
                modal.classList.add('hidden');
                map.setView([kiosk.lat, kiosk.lng], 18);
                // Имитируем клик по маркеру
                const rem = getRemaining(kiosk.contract);
                document.getElementById('card-name').textContent = kiosk.name;
                document.getElementById('card-area').textContent = kiosk.area;
                document.getElementById('card-contract').textContent = kiosk.contract || '—';
                document.getElementById('card-remaining').textContent = rem.text;
                const statusEl = document.getElementById('card-status');
                const status = getKioskStatus(kiosk);
                if (status === 'free') {
                    statusEl.textContent = 'Свободен';
                    statusEl.className = 'status-free';
                } else {
                    statusEl.textContent = 'Занят';
                    statusEl.className = 'status-taken';
                }
                document.getElementById('card').classList.remove('hidden');
            }
        });
    });
}

showListBtn.addEventListener('click', function() {
    renderKioskList(listSearch.value);
    modal.classList.remove('hidden');
});
closeModal.addEventListener('click', function() {
    modal.classList.add('hidden');
});
modal.addEventListener('click', function(e) {
    if (e.target === modal) modal.classList.add('hidden');
});
listSearch.addEventListener('input', function() {
    renderKioskList(this.value);
});

// ---- Подсказка "Как найти точку?" ----
const helpModal = document.getElementById('helpModal');
const helpBtn = document.getElementById('how-to-find-btn');
const closeHelpBtn = document.getElementById('closeHelpModal');

if (helpBtn) {
    helpBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        helpModal.classList.remove('hidden');
    });
}
if (closeHelpBtn) {
    closeHelpBtn.addEventListener('click', function() {
        helpModal.classList.add('hidden');
    });
}
helpModal.addEventListener('click', function(e) {
    if (e.target === helpModal) {
        helpModal.classList.add('hidden');
    }
});

// =====================================================
// === ГЛОБАЛЬНЫЕ ФУНКЦИИ для открытия/закрытия модалок ===
// =====================================================
function openLoginModal() {
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
        loginModal.classList.remove('hidden');
    }
}

function openPlaceModal() {
    const placeModal = document.getElementById('placeModal');
    if (placeModal) {
        document.getElementById('place-comment').value = '';
        placeModal.classList.remove('hidden');
    }
}

function closeLoginModal() {
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
        loginModal.classList.add('hidden');
    }
}

function closePlaceModal() {
    const placeModal = document.getElementById('placeModal');
    if (placeModal) {
        placeModal.classList.add('hidden');
    }
}

// Закрытие по клику на фон (дополнительно)
document.getElementById('loginModal').addEventListener('click', function(e) {
    if (e.target === this) this.classList.add('hidden');
});
document.getElementById('placeModal').addEventListener('click', function(e) {
    if (e.target === this) this.classList.add('hidden');
});

// Пустые обработчики для кнопок "Войти" и "Отправить"
document.getElementById('login-submit').addEventListener('click', function() {
    console.log('Вход пока не реализован');
});
document.getElementById('place-submit').addEventListener('click', function() {
    console.log('Отправка заявки пока не реализована');
});

// ---- Модалка для аренды ----
const rentModal = document.getElementById('rentModal');
const closeRent = document.getElementById('closeRentModal');
const rentCloseBtn = document.getElementById('rent-close-btn');

function showRentModal() {
    rentModal.classList.remove('hidden');
}
if (closeRent) {
    closeRent.addEventListener('click', () => rentModal.classList.add('hidden'));
}
if (rentCloseBtn) {
    rentCloseBtn.addEventListener('click', () => rentModal.classList.add('hidden'));
}
if (rentModal) {
    rentModal.addEventListener('click', (e) => {
        if (e.target === rentModal) rentModal.classList.add('hidden');
    });
}

// ---- Двойной клик по карте для предложения разместить НТО ----
let doubleClickCoords = null;
let crossMarker = null;
const placeHerePopup = document.getElementById('placeHerePopup');
const popupYes = document.getElementById('popup-yes');
const popupNo = document.getElementById('popup-no');

function createCrossIcon() {
    return L.divIcon({
        className: 'cross-icon',
        html: `<div style="width:30px;height:30px;position:relative;">
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:4px;height:30px;background:red;border-radius:2px;box-shadow:0 0 10px rgba(255,0,0,0.8);"></div>
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(90deg);width:4px;height:30px;background:red;border-radius:2px;box-shadow:0 0 10px rgba(255,0,0,0.8);"></div>
        </div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });
}

map.on('dblclick', function(e) {
    if (e.originalEvent.target.closest('.leaflet-marker-icon')) {
        return;
    }
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    doubleClickCoords = { lat, lng };

    if (crossMarker) {
        map.removeLayer(crossMarker);
        crossMarker = null;
    }
    crossMarker = L.marker([lat, lng], {
        icon: createCrossIcon(),
        zIndexOffset: 2000
    }).addTo(map);

    placeHerePopup.classList.remove('hidden');
});

if (popupYes) {
    popupYes.addEventListener('click', function() {
        placeHerePopup.classList.add('hidden');
        if (crossMarker) {
            map.removeLayer(crossMarker);
            crossMarker = null;
        }
        if (doubleClickCoords) {
            const placeModal = document.getElementById('placeModal');
            if (placeModal) {
                placeModal.classList.remove('hidden');
                document.getElementById('place-comment').value =
                    `Координаты планируемого НТО: ${doubleClickCoords.lat}, ${doubleClickCoords.lng}`;
                doubleClickCoords = null;
            }
        }
    });
}
if (popupNo) {
    popupNo.addEventListener('click', function() {
        placeHerePopup.classList.add('hidden');
        if (crossMarker) {
            map.removeLayer(crossMarker);
            crossMarker = null;
        }
        doubleClickCoords = null;
    });
}

map.on('click', function() {
    if (!placeHerePopup.classList.contains('hidden')) {
        placeHerePopup.classList.add('hidden');
        if (crossMarker) {
            map.removeLayer(crossMarker);
            crossMarker = null;
        }
        doubleClickCoords = null;
    }
});
