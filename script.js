// Инициализация карты — Братск
const map = L.map('map', {
    attributionControl: false  // отключаем встроенную атрибуцию
}).setView([56.150703, 101.632976], 16);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; CartoDB',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

// Глобальные переменные
let allKiosks = [];       // все киоски
let markersLayer = L.layerGroup().addTo(map); // слой с маркерами
let selectedMarker = null; // указатель на выбранный НТО
let currentKioskId = null; // ID текущего выбранного НТО

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
// Функция расчета остатка
function getRemaining(contractDate) {
    const now = new Date();
    const end = new Date(contractDate);
    const diffMs = end - now;

    if (diffMs <= 0) return { text: 'Договор истёк', color: '#95a5a6' };

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);

    let text = '';
    if (years > 0) text += years + ' г. ';
    if (months > 0) text += months + ' мес.';
    if (years === 0 && months === 0) text = 'Менее месяца';

    let color;
    if (years < 1) color = '#e74c3c';        // красный — меньше года
    else if (years < 3) color = '#f39c12';   // желтый — 1-3 года
    else color = '#27ae60';                  // зеленый — больше 3 лет

    return { text: text.trim(), color: color };
}

// Функция создания HTML-иконки для маркера
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

// Функция отображения всех киосков (с учетом фильтра)
function renderKiosks(kiosks) {
    markersLayer.clearLayers();

    kiosks.forEach(k => {
        const rem = getRemaining(k.contract);
        const marker = L.marker([k.lat, k.lng], { icon: createIcon(rem.color) });

        marker.on('click', () => {
            // Если клик по тому же объекту и карточка уже открыта – игнорируем
            if (currentKioskId === k.id && !document.getElementById('card').classList.contains('hidden')) {
                return;
            }

            // Обновляем текущий ID
            currentKioskId = k.id;

            // Заполняем карточку
            document.getElementById('card-name').textContent = k.name;
            document.getElementById('card-specialization').textContent = k.specialization || 'не указана';
            document.getElementById('card-area').textContent = k.area;
            document.getElementById('card-contract').textContent = k.contract || '—';
            document.getElementById('card-remaining').textContent = rem.text;
            document.getElementById('card-2gis-link').href = `https://2gis.ru/geo/${k.lng},${k.lat}`;

            // Удаляем старый указатель (если есть)
            if (selectedMarker) {
                map.removeLayer(selectedMarker);
                selectedMarker = null;
            }
            currentKioskId = null; // сбрасываем ID

            // Создаём новый фиолетовый указатель
            selectedMarker = L.marker([k.lat, k.lng], {
                icon: createSelectedIcon(),
                zIndexOffset: 1000
            }).addTo(map);

            // Статус
            const statusEl = document.getElementById('card-status');
            const now = new Date();
            const end = new Date(k.contract);
            if (!k.contract || end <= now) {
                statusEl.textContent = 'Свободен';
                statusEl.className = 'status-free';
            } else {
                statusEl.textContent = 'Занят';
                statusEl.className = 'status-taken';
            }
            // Показываем/скрываем кнопку аренды
            const rentBtn = document.getElementById('card-rent-btn');
            if (!k.contract || end <= now) {
                statusEl.textContent = 'Свободен';
                statusEl.className = 'status-free';
                rentBtn.style.display = 'inline-block'; // показываем
            } else {
                statusEl.textContent = 'Занят';
                statusEl.className = 'status-taken';
                rentBtn.style.display = 'none'; // скрываем
            }
            // Показываем карточку
            document.getElementById('card').classList.remove('hidden');
            document.getElementById('card-rent-btn').addEventListener('click', function(e) {
                e.stopPropagation(); // чтобы не закрыть карточку
                showRentModal();
            });
        });

        markersLayer.addLayer(marker);
    });
}

// Загрузка JSON
fetch('kiosks.json')
    .then(response => response.json())
    .then(data => {
        allKiosks = data;
        renderKiosks(allKiosks);
    })
    .catch(err => {
        alert('Ошибка загрузки данных: ' + err.message);
    });

renderKiosks(allKiosks);
// Поиск
document.getElementById('search').addEventListener('input', function (e) {
    const query = e.target.value.toLowerCase().trim();
    applyFilters();
});

// Фильтр по сроку
document.getElementById('filter-expiring').addEventListener('change', function () {
    applyFilters();
});

function applyFilters() {
    let filtered = [...allKiosks];

    // Поиск
    const query = document.getElementById('search').value.toLowerCase().trim();
    if (query) {
        filtered = filtered.filter(k =>
            k.name.toLowerCase().includes(query) ||
            k.id.toString().includes(query)
        );
    }

    // Фильтр "до конца < 1 года"
    if (document.getElementById('filter-expiring').checked) {
        filtered = filtered.filter(k => {
            const rem = getRemaining(k.contract);
            return rem.color === '#e74c3c'; // красные — меньше года
        });
    }

    renderKiosks(filtered);

    // Центрирование на результат поиска, если найден ровно один
    if (filtered.length === 1 && query) {
        map.setView([filtered[0].lat, filtered[0].lng], 18);
    }
}

// Скрытие карточки при клике на карту
map.on('click', function () {
    document.getElementById('card').classList.add('hidden');

});
// --- Модальное окно со списком ---
const modal = document.getElementById('listModal');
const showListBtn = document.getElementById('showListBtn');
const closeModal = document.getElementById('closeModal');
const listSearch = document.getElementById('listSearch');
const listContainer = document.getElementById('kioskListContainer');

modal.classList.add('hidden');
// Функция отрисовки списка
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
        const now = new Date();
        const end = new Date(k.contract);
        const status = end <= now ? 'Свободен' : 'Занят';
        const statusClass = end <= now ? 'free' : 'taken';

        html += `
            <div class="kiosk-item" data-id="${k.id}">
                <div>
                    <span class="name">${k.name}</span>
                    <span class="status-badge ${statusClass}">${status}</span>
                </div>
                <div class="detail">
                    № ${k.id} · Площадь: ${k.area} м² · Договор до: ${k.contract} · Осталось: ${rem.text}
                </div>
            </div>
        `;
    });
    listContainer.innerHTML = html;

    // При клике на элемент списка центрируем карту и показываем карточку
    listContainer.querySelectorAll('.kiosk-item').forEach(el => {
        el.addEventListener('click', function() {
            const id = parseInt(this.dataset.id);
            const kiosk = allKiosks.find(k => k.id === id);
            if (kiosk) {
                // Закрываем модалку
                modal.classList.add('hidden');
                // Центрируем и показываем карточку (имитируем клик по маркеру)
                map.setView([kiosk.lat, kiosk.lng], 18);
                // Вручную заполняем карточку
                const rem = getRemaining(kiosk.contract);
                document.getElementById('card-name').textContent = kiosk.name;
                document.getElementById('card-area').textContent = kiosk.area;
                document.getElementById('card-contract').textContent = kiosk.contract;
                document.getElementById('card-remaining').textContent = rem.text;
                const statusEl = document.getElementById('card-status');
                const now = new Date();
                const end = new Date(kiosk.contract);
                if (end <= now) {
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

// Открыть модалку
showListBtn.addEventListener('click', function() {
    renderKioskList(listSearch.value);
    modal.classList.remove('hidden');
});

// Закрыть модалку
closeModal.addEventListener('click', function() {
    modal.classList.add('hidden');
});
if (closeModal) {
    closeModal.addEventListener('click', function() {
        modal.classList.add('hidden');
    });
}
modal.addEventListener('click', function(e) {
    if (e.target === modal) modal.classList.add('hidden');
});

// Фильтрация списка при вводе
listSearch.addEventListener('input', function() {
    renderKioskList(this.value);
});
// ---- Подсказка "Как найти точку?" ----
const helpModal = document.getElementById('helpModal');
const helpBtn = document.getElementById('how-to-find-btn');
const closeHelpBtn = document.getElementById('closeHelpModal');

if (helpBtn) {
    helpBtn.addEventListener('click', function(e) {
        e.stopPropagation(); // чтобы не закрыть карточку случайно
        helpModal.classList.remove('hidden');
    });
}

if (closeHelpBtn) {
    closeHelpBtn.addEventListener('click', function() {
        helpModal.classList.add('hidden');
    });
}

// Закрываем подсказку при клике на фон
helpModal.addEventListener('click', function(e) {
    if (e.target === helpModal) {
        helpModal.classList.add('hidden');
    }
});
// Скрытие карточки и удаление указателя при клике на карту
map.on('click', function () {
    document.getElementById('card').classList.add('hidden');
    if (selectedMarker) {
        map.removeLayer(selectedMarker);
        selectedMarker = null;
    }
    currentKioskId = null;
});
// ---- Кнопки в правом верхнем углу ----
const cabinetBtn = document.getElementById('btn-cabinet');
const placeBtn = document.getElementById('btn-place-nto');

const loginModal = document.getElementById('loginModal');
const closeLogin = document.getElementById('closeLoginModal');
const placeModal = document.getElementById('placeModal');
const closePlace = document.getElementById('closePlaceModal');

// Открыть личный кабинет
cabinetBtn.addEventListener('click', () => {
    loginModal.classList.remove('hidden');
});
closeLogin.addEventListener('click', () => {
    loginModal.classList.add('hidden');
});
loginModal.addEventListener('click', (e) => {
    if (e.target === loginModal) loginModal.classList.add('hidden');
});

// Открыть заявку на размещение
placeBtn.addEventListener('click', () => {
    document.getElementById('place-comment').value = ''; // очищаем поле
    placeModal.classList.remove('hidden');
});
closePlace.addEventListener('click', () => {
    placeModal.classList.add('hidden');
});
placeModal.addEventListener('click', (e) => {
    if (e.target === placeModal) placeModal.classList.add('hidden');
});

// Кнопки без обработчиков – оставляем пустыми
document.getElementById('login-submit').addEventListener('click', () => {
    // пока ничего
});
document.getElementById('place-submit').addEventListener('click', () => {
    // пока ничего
});

// ---- Модалка для аренды (вызывается из карточки) ----
const rentModal = document.getElementById('rentModal');
const closeRent = document.getElementById('closeRentModal');
const rentCloseBtn = document.getElementById('rent-close-btn');

function showRentModal() {
    rentModal.classList.remove('hidden');
}
closeRent.addEventListener('click', () => {
    rentModal.classList.add('hidden');
});
rentCloseBtn.addEventListener('click', () => {
    rentModal.classList.add('hidden');
});
rentModal.addEventListener('click', (e) => {
    if (e.target === rentModal) rentModal.classList.add('hidden');
});

// ---- Двойной клик по карте для предложения разместить НТО ----
let doubleClickCoords = null;
let crossMarker = null; // маркер-крестик

// Элементы плавающего окна
const placeHerePopup = document.getElementById('placeHerePopup');
const popupYes = document.getElementById('popup-yes');
const popupNo = document.getElementById('popup-no');

// Функция создания красного крестика
function createCrossIcon() {
    return L.divIcon({
        className: 'cross-icon',
        html: `<div style="
            width: 30px; height: 30px;
            position: relative;
        ">
            <div style="
                position: absolute;
                top: 50%; left: 50%;
                transform: translate(-50%, -50%);
                width: 4px; height: 30px;
                background: red;
                border-radius: 2px;
                box-shadow: 0 0 10px rgba(255,0,0,0.8);
            "></div>
            <div style="
                position: absolute;
                top: 50%; left: 50%;
                transform: translate(-50%, -50%) rotate(90deg);
                width: 4px; height: 30px;
                background: red;
                border-radius: 2px;
                box-shadow: 0 0 10px rgba(255,0,0,0.8);
            "></div>
        </div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });
}

map.on('dblclick', function(e) {
    // Проверяем, не клик ли по маркеру
    if (e.originalEvent.target.closest('.leaflet-marker-icon')) {
        return; // игнорируем двойной клик по маркеру
    }
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    doubleClickCoords = { lat, lng };

    // Удаляем старый крестик, если есть
    if (crossMarker) {
        map.removeLayer(crossMarker);
        crossMarker = null;
    }

    // Создаём новый крестик
    crossMarker = L.marker([lat, lng], {
        icon: createCrossIcon(),
        zIndexOffset: 2000
    }).addTo(map);

    // Показываем плавающее окно
    placeHerePopup.classList.remove('hidden');
});

// Кнопка "Да"
popupYes.addEventListener('click', function() {
    placeHerePopup.classList.add('hidden');
    // Убираем крестик
    if (crossMarker) {
        map.removeLayer(crossMarker);
        crossMarker = null;
    }
    if (doubleClickCoords) {
        // Открываем модалку размещения
        placeModal.classList.remove('hidden');
        // Заполняем комментарий
        const commentField = document.getElementById('place-comment');
        commentField.value = `Координаты планируемого НТО: ${doubleClickCoords.lat}, ${doubleClickCoords.lng}`;
        doubleClickCoords = null;
    }
});

// Кнопка "Отмена"
popupNo.addEventListener('click', function() {
    placeHerePopup.classList.add('hidden');
    if (crossMarker) {
        map.removeLayer(crossMarker);
        crossMarker = null;
    }
    doubleClickCoords = null;
});

// Закрываем при клике вне окна (но не на карту, т.к. окно плавающее)
// Можно добавить клик по карте, чтобы закрыть попап
map.on('click', function() {
    if (!placeHerePopup.classList.contains('hidden')) {
        // Если попап открыт и кликнули по карте – закрываем
        placeHerePopup.classList.add('hidden');
        if (crossMarker) {
            map.removeLayer(crossMarker);
            crossMarker = null;
        }
        doubleClickCoords = null;
    }
});


// Проверим, что обработчик dblclick привязан
console.log('Обработчики dblclick на карте:', map._events ? map._events.dblclick : 'нет');