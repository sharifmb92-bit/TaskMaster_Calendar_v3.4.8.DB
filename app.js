// medbasha - TaskMaster Pro v3.4.8 Logica Principal
const config = { version: '3.4.8', sysSignature: 'medbasha' };

const firebaseConfig = {
    apiKey: "AIzaSyAelzQOy8KFQ5OZkctKJS2DZUaxvaLMfRE",
    authDomain: "taskmastercalendar-a779e.firebaseapp.com",
    databaseURL: "https://taskmastercalendar-a779e-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "taskmastercalendar-a779e",
    storageBucket: "taskmastercalendar-a779e.firebasestorage.app",
    messagingSenderId: "628005433300",
    appId: "1:628005433300:web:b6a39ed06922a34de07041"
};
const vapidKey = "BGClAqG08mtup_uhnNeCjWeJdZfLU-pnmrEpfXbkKf6uVTRjAAdu-4PO1ASiuA-UOvyXvBiswDxpauthHiGw37I";

firebase.initializeApp(firebaseConfig);
const fbDB = firebase.database();
const fbMessaging = ('serviceWorker' in navigator && firebase.messaging.isSupported()) ? firebase.messaging() : null;

// GESTIÓN DE CONEXIÓN ONLINE / OFFLINE Y SINCRONIZACIÓN
window.addEventListener('online', () => {
    fbDB.goOnline();
    const syncStatus = document.getElementById('firebase-cloud-status');
    if (syncStatus) syncStatus.innerText = "Activa Multi-Dispositivo ✓";
    syncLocalPendingToFirebase();
});

window.addEventListener('offline', () => {
    fbDB.goOffline();
    const syncStatus = document.getElementById('firebase-cloud-status');
    if (syncStatus) syncStatus.innerText = "Pausada (Modo Offline)";
});

const db = new Dexie('TaskMasterDB');
db.version(1).stores({
    events: 'id, date, priority, loc, alarmFired, notified, done',
    todos: '++id, dateKey, done, category',
    notes: 'dateKey',
    settings: 'key',
    locations: 'key'
});

const profilePresets = {
    personal: {
        name: 'Personal / Estilo de Vida',
        defaultTheme: 'gris',
        taskPlaceholder: 'Ej. Hacer compras / Limpieza de casa',
        eventPlaceholder: 'Ej. Cumpleaños / Evento familiar',
        notesPlaceholder: 'Anotaciones personales, tiempo libre...',
        locCentral: 'Mi Trabajo',
        locPuntoA: '📍 Mi Punto A (Frecuente)',
        locPuntoB: '📍 Mi Punto B (Frecuente)'
    },
    trabajo: {
        name: 'Trabajo / Proyectos',
        defaultTheme: 'marino',
        taskPlaceholder: 'Ej. Entregar informe / Enviar presupuesto',
        eventPlaceholder: 'Ej. Reunión de equipo / Presentación',
        notesPlaceholder: 'Notas de proyectos, reuniones o tareas...',
        locCentral: 'Oficina / Base Central',
        locPuntoA: '📍 Cliente Principal',
        locPuntoB: '📍 Sala de Reuniones'
    },
    salud: {
        name: 'Salud y Bienestar',
        defaultTheme: 'menta',
        taskPlaceholder: 'Ej. Beber 2L de agua / Tomar medicación',
        eventPlaceholder: 'Ej. Cita médica / Entrenamiento',
        notesPlaceholder: 'Seguimiento de salud, ejercicios y hábitos...',
        locCentral: 'Centro Médico / Hospital',
        locPuntoA: '📍 Gimnasio / Parque',
        locPuntoB: '📍 Farmacia Habitual'
    },
    finanzas: {
        name: 'Finanzas / Gastos',
        defaultTheme: 'cream',
        taskPlaceholder: 'Ej. Pagar recibo luz / Revisar facturas',
        eventPlaceholder: 'Ej. Vencimiento de seguro / Pago mensual',
        notesPlaceholder: 'Presupuestos, recibos pendientes o ahorro...',
        locCentral: 'Mi Banco / Gestoría',
        locPuntoA: '📍 Oficina de Pagos',
        locPuntoB: '📍 Punto de Cobro'
    },
    urgente: {
        name: '🚨 Urgente e Importante',
        defaultTheme: 'cafe',
        taskPlaceholder: 'Ej. Resolver incidencia crítica HOY',
        eventPlaceholder: 'Ej. Entrega urgente límite',
        notesPlaceholder: 'Crisis, temas prioritarios e inmediatos...',
        locCentral: 'Punto Crítico / Urgencias',
        locPuntoA: '📍 Zona Prioritaria A',
        locPuntoB: '📍 Zona Prioritaria B'
    },
    general: {
        name: 'General / Personal',
        defaultTheme: 'gris',
        taskPlaceholder: 'Ej. Cita personal / Hacer compras',
        eventPlaceholder: 'Ej. Cita médico / Factura luz',
        notesPlaceholder: 'Notas y anotaciones generales...',
        locCentral: 'Mi Trabajo',
        locPuntoA: '📍 Mi Punto A (Frecuente)',
        locPuntoB: '📍 Mi Punto B (Frecuente)'
    }
};

const tutorialSteps = [
    { icon: '🎭', title: 'Pilares Vitales', desc: 'Organiza tu día agrupando tareas en Personal, Trabajo, Salud, Finanzas o Urgencias.' },
    { icon: '🎙️✨', title: 'Asistente de Voz IA', desc: 'Pulsa el micrófono superior y habla con naturalidad. Entiende fechas relativas como "el jueves que viene" o horas exactas.' },
    { icon: '💻📱', title: 'Avisos Multi-Dispositivo', desc: 'Sincroniza tus eventos mediante Firebase para recibir alarmas en todos tus dispositivos en tiempo real.' },
    { icon: '📍🗺️', title: 'Geofencing de Alta Precisión', desc: 'Guarda tus ubicaciones frecuentes con precisión de 6 decimales para recibir alertas al aproximarte.' }
];
let currentTutorialIndex = 0;

let currentProfileKey = 'general';
let activeCategoryFilter = 'all';
let isRecordingSpeech = false;
let isGlobalMicActive = false;
let speechRecognition = null;

function triggerHaptic() {
    if (navigator.vibrate) {
        navigator.vibrate([25, 15, 25]);
    }
}

function openContributionLink(type) {
    if (type === 'paypal') {
        window.open('https://paypal.me/sherrif86', '_blank');
    } else if (type === 'revolut') {
        window.open('https://revolut.me/sharifmb', '_blank');
    }
}

function autoExpandTextarea(el) {
    el.style.height = 'auto';
    el.style.height = (el.scrollHeight) + 'px';
}

async function enableStoragePersistence() {
    if (navigator.storage && navigator.storage.persist) {
        const isPersisted = await navigator.storage.persist();
        const statusSpan = document.getElementById('db-protection-status');
        if (statusSpan) {
            statusSpan.innerText = isPersisted ? "Seguro y Protegido ✓" : "Estándar (Navegador)";
        }
    }
}

const todayDate = new Date();
let currentYear = todayDate.getFullYear();
let currentMonth = todayDate.getMonth();
let currentActiveTab = 'calendar';

const getFormattedDateKey = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
let selectedDateStr = getFormattedDateKey(todayDate);
let selectedPriority = 'low';

let globalAudioCtx = null;
let leafletMap = null;
let mapMarker = null;
let activeTargetType = null; 
let tempCoords = { lat: 39.999612, lon: 3.834921 };
let pendingEventCustomCoords = null; 
let swRegistration = null;

const geofenceZones = {
    gasolinera: [
        { name: 'Repsol Ciutadella', lat: 40.001245, lon: 3.841123 },
        { name: 'Cepsa Centro', lat: 39.905512, lon: 4.241045 }
    ],
    super: [
        { name: 'Mercadona Ciutadella', lat: 40.005789, lon: 3.854612 },
        { name: 'Eroski', lat: 40.002134, lon: 3.842367 },
        { name: 'Lidl', lat: 39.998521, lon: 3.849943 }
    ]
};

document.addEventListener('DOMContentLoaded', async () => {
    await enableStoragePersistence();

    if (!navigator.onLine) {
        fbDB.goOffline();
    }

    try {
        const savedProfileRec = await db.settings.get('user_profile');
        if (savedProfileRec) {
            currentProfileKey = savedProfileRec.value;
            applyProfileUI(currentProfileKey);
        } else {
            openWelcomeScreen();
        }

        const savedThemeRec = await db.settings.get('app_theme');
        const defaultThemeForProfile = profilePresets[currentProfileKey]?.defaultTheme || 'cafe';
        const savedTheme = savedThemeRec ? savedThemeRec.value : defaultThemeForProfile;
        applyThemeUI(savedTheme);

        const glassRec = await db.settings.get('glass_mode');
        if (glassRec) {
            const mode = glassRec.value;
            const selectEl = document.getElementById('glass-effect-select');
            if (selectEl) selectEl.value = mode;
            if (mode === 'on') document.body.classList.add('glass-active');
        }

        const soundRec = await db.settings.get('sound_type');
        if (soundRec) {
            const soundSelect = document.getElementById('sound-type-select');
            if (soundSelect) soundSelect.value = soundRec.value;
        }
    } catch(e) {
        console.warn("Error al cargar ajustes de Dexie:", e);
    }

    registerServiceWorker();
    await initCalendar();
    renderWeekBar();
    initSmartTracking();
    initTimeAlarms();
    await updateLocationUI();
    updatePermissionBanner();
    await loadTabData();

    // ESCUCHAR Y SINCRONIZAR EVENTOS DESDE FIREBASE EN TIEMPO REAL
    initFirebaseRealtimeSync();

    const versionTag = document.getElementById('version-tag');
    if (versionTag) versionTag.innerText = 'TaskMaster Calendar Pro_v ' + config.version;
});

/* --- SINCRONIZACIÓN EN TIEMPO REAL CON FIREBASE REALTIME DATABASE --- */
function initFirebaseRealtimeSync() {
    if (!fbDB) return;

    const alarmsRef = fbDB.ref('alarms');

    // Al añadir o cambiar un evento en la nube
    alarmsRef.on('child_added', async (snapshot) => {
        const data = snapshot.val();
        if (data && snapshot.key) {
            await mergeRemoteEventToLocal(snapshot.key, data);
        }
    });

    alarmsRef.on('child_changed', async (snapshot) => {
        const data = snapshot.val();
        if (data && snapshot.key) {
            await mergeRemoteEventToLocal(snapshot.key, data);
        }
    });

    // Al eliminar un evento en la nube
    alarmsRef.on('child_removed', async (snapshot) => {
        if (snapshot.key) {
            await db.events.delete(snapshot.key);
            await initCalendar();
            await renderCalSelectedEvents();
            await updateSummaryData();
        }
    });
}

async function mergeRemoteEventToLocal(id, data) {
    const existing = await db.events.get(id);
    if (!existing) {
        const eventData = {
            id: id,
            date: data.date || selectedDateStr,
            title: data.title || 'Evento Sincronizado',
            details: data.details || '',
            time: data.time || '--:--',
            priority: data.priority || 'medium',
            loc: data.loc || 'none',
            notified: false,
            alarmFired: false,
            done: data.done || false
        };
        await db.events.put(eventData);
        await initCalendar();
        await renderCalSelectedEvents();
        await updateSummaryData();
    }
}

function syncEventWithFirebase(eventData) {
    if (!navigator.onLine || !fbDB) return;
    fbDB.ref('alarms/' + eventData.id).set({
        title: eventData.title,
        date: eventData.date,
        time: eventData.time,
        priority: eventData.priority || 'medium',
        details: eventData.details || '',
        loc: eventData.loc || 'none',
        done: eventData.done || false,
        timestamp: Date.now()
    }).catch(err => console.error("Error al sincronizar evento con Firebase:", err));
}

async function syncLocalPendingToFirebase() {
    if (!navigator.onLine || !fbDB) return;
    const allEvents = await db.events.toArray();
    allEvents.forEach(ev => {
        syncEventWithFirebase(ev);
    });
}

async function toggleGlassMode(val) {
    triggerHaptic();
    if (val === 'on') {
        document.body.classList.add('glass-active');
    } else {
        document.body.classList.remove('glass-active');
    }
    await db.settings.put({ key: 'glass_mode', value: val });
}

function applyProfileUI(profileKey) {
    const p = profilePresets[profileKey] || profilePresets.general;
    currentProfileKey = profileKey;

    const taskInput = document.getElementById('taskInputText');
    const eventInput = document.getElementById('eventTitle');
    if (taskInput) taskInput.placeholder = p.taskPlaceholder;
    if (eventInput) eventInput.placeholder = p.eventPlaceholder;

    const optCentral = document.getElementById('opt-loc-central');
    const optPuntoA = document.getElementById('opt-loc-punto-a');
    const optPuntoB = document.getElementById('opt-loc-punto-b');
    if (optCentral) optCentral.innerText = p.locCentral;
    if (optPuntoA) optPuntoA.innerText = p.locPuntoA;
    if (optPuntoB) optPuntoB.innerText = p.locPuntoB;

    const lblCochera = document.getElementById('lbl-setting-cochera');
    const lblPuntoA = document.getElementById('lbl-setting-punto-a');
    const lblPuntoB = document.getElementById('lbl-setting-punto-b');
    if (lblCochera) lblCochera.innerText = p.locCentral;
    if (lblPuntoA) lblPuntoA.innerText = p.locPuntoA;
    if (lblPuntoB) lblPuntoB.innerText = p.locPuntoB;

    const summaryProfile = document.getElementById('summary-profile-name');
    const settingsProfile = document.getElementById('settings-profile-label');
    if (summaryProfile) summaryProfile.innerText = p.name;
    if (settingsProfile) settingsProfile.innerText = 'Perfil Actual: ' + p.name;
}

async function selectUserProfile(profileKey) {
    triggerHaptic();
    await db.settings.put({ key: 'user_profile', value: profileKey });
    applyProfileUI(profileKey);

    const defaultTheme = profilePresets[profileKey]?.defaultTheme || 'cafe';
    applyThemeUI(defaultTheme);
    await db.settings.put({ key: 'app_theme', value: defaultTheme });

    switchTab('calendar');
}

function openWelcomeScreen() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screenWelcome = document.getElementById('screen-welcome');
    if (screenWelcome) screenWelcome.classList.add('active');
    const fabBtn = document.getElementById('fab-main-btn');
    if (fabBtn) fabBtn.style.display = 'none';
}

function openTutorialModal(stepIndex) {
    currentTutorialIndex = stepIndex;
    renderTutorialStep();
    const modal = document.getElementById('tutorial-modal');
    if (modal) modal.style.display = 'flex';
}

function renderTutorialStep() {
    const step = tutorialSteps[currentTutorialIndex];
    document.getElementById('tut-icon').innerText = step.icon;
    document.getElementById('tut-title').innerText = step.title;
    document.getElementById('tut-desc').innerText = step.desc;
    document.getElementById('tut-counter').innerText = `${currentTutorialIndex + 1} / ${tutorialSteps.length}`;
    document.getElementById('tut-prev-btn').style.visibility = (currentTutorialIndex === 0) ? 'hidden' : 'visible';
    document.getElementById('tut-next-btn').innerText = (currentTutorialIndex === tutorialSteps.length - 1) ? 'Entendido ✓' : 'Siguiente';
}

function moveTutorialStep(dir) {
    currentTutorialIndex += dir;
    if (currentTutorialIndex >= tutorialSteps.length) {
        document.getElementById('tutorial-modal').style.display = 'none';
        currentTutorialIndex = 0;
    } else if (currentTutorialIndex < 0) {
        currentTutorialIndex = 0;
    } else {
        renderTutorialStep();
    }
}

function unlockAudioContext() {
    if (!globalAudioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        globalAudioCtx = new AudioContext();
    }
    if (globalAudioCtx.state === 'suspended') {
        globalAudioCtx.resume();
    }
}

function applyThemeUI(themeName) {
    document.body.className = document.body.className.replace(/theme-\w+/g, '');
    document.body.classList.add('theme-' + themeName);
    document.querySelectorAll('.theme-card-btn').forEach(btn => {
        if (btn.dataset.theme === themeName) btn.classList.add('active');
        else btn.classList.remove('active');
    });
}

async function switchTab(tabName) {
    currentActiveTab = tabName;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const tabEl = document.getElementById('tab-' + tabName);
    const navEl = document.getElementById('nav-' + tabName);
    if (tabEl) tabEl.classList.add('active');
    if (navEl) navEl.classList.add('active');

    const fab = document.getElementById('fab-main-btn');
    if (fab) fab.style.display = (tabName === 'tasks') ? 'flex' : 'none';

    await loadTabData();
}

function openSettingsScreen() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screenSettings = document.getElementById('screen-settings');
    if (screenSettings) screenSettings.classList.add('active');
    const fabBtn = document.getElementById('fab-main-btn');
    if (fabBtn) fabBtn.style.display = 'none';
}

function openDayModalForSelectedDate() {
    document.getElementById('selected-date-title').innerText = selectedDateStr;
    const dParts = selectedDateStr.split('-');
    const dObj = new Date(dParts[0], dParts[1] - 1, dParts[2]);
    const dayNames = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    document.getElementById('selected-weekday').innerText = dayNames[dObj.getDay()];

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-day-modal').classList.add('active');
    const fabBtn = document.getElementById('fab-main-btn');
    if (fabBtn) fabBtn.style.display = 'none';
}

function openTaskModal() {
    const taskModal = document.getElementById('task-modal');
    if (taskModal) taskModal.style.display = 'flex';
}

function closeTaskModal() {
    const taskModal = document.getElementById('task-modal');
    if (taskModal) taskModal.style.display = 'none';
}

function handleFabClick() {
    if (currentActiveTab === 'tasks') {
        openTaskModal();
    }
}

async function goToToday() {
    const t = new Date();
    currentYear = t.getFullYear();
    currentMonth = t.getMonth();
    selectedDateStr = getFormattedDateKey(t);
    const dateLabel = document.getElementById('cal-selected-date-label');
    if (dateLabel) dateLabel.innerText = selectedDateStr;
    await initCalendar();
    await renderCalSelectedEvents();
}

async function loadTabData() {
    const noteRecord = await db.notes.get(selectedDateStr);
    const area = document.getElementById('tab-day-notes');
    if (area) {
        area.innerHTML = (noteRecord && noteRecord.html) ? noteRecord.html : (noteRecord && noteRecord.text ? noteRecord.text : '');
    }
    const notesDateLabel = document.getElementById('notes-date-label');
    if (notesDateLabel) notesDateLabel.innerText = selectedDateStr;

    await renderDayTasksList();
    await updateSummaryData();
    await renderCalSelectedEvents();
}

/* --- MOTOR DE VOZ IA INTELIGENTE --- */
function toggleGlobalVoiceAssistant() {
    const micBtn = document.getElementById('btn-global-mic');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        return alert("El reconocimiento por voz no está soportado en este navegador.");
    }

    if (isGlobalMicActive) {
        if (speechRecognition) speechRecognition.stop();
        isGlobalMicActive = false;
        if (micBtn) micBtn.style.color = 'var(--text-main)';
    } else {
        speechRecognition = new SpeechRecognition();
        speechRecognition.lang = navigator.language || 'es-ES';
        speechRecognition.continuous = false;
        speechRecognition.interimResults = false;

        speechRecognition.onstart = () => {
            isGlobalMicActive = true;
            if (micBtn) micBtn.style.color = '#e54d42';
        };

        speechRecognition.onresult = async (event) => {
            const phrase = event.results[0][0].transcript;
            await processUniversalVoiceCommand(phrase);
        };

        speechRecognition.onerror = () => {
            isGlobalMicActive = false;
            if (micBtn) micBtn.style.color = 'var(--text-main)';
        };

        speechRecognition.onend = () => {
            isGlobalMicActive = false;
            if (micBtn) micBtn.style.color = 'var(--text-main)';
        };

        speechRecognition.start();
    }
}

async function processUniversalVoiceCommand(phrase) {
    const lower = phrase.toLowerCase();
    let targetDate = new Date();

    const weekDaysMap = { 'domingo': 0, 'lunes': 1, 'martes': 2, 'miércoles': 3, 'miercoles': 3, 'jueves': 4, 'viernes': 5, 'sábado': 6, 'sabado': 6 };
    let weekDayFound = null;

    for (let dayName in weekDaysMap) {
        if (lower.includes(dayName)) {
            weekDayFound = weekDaysMap[dayName];
            break;
        }
    }

    if (weekDayFound !== null) {
        const todayDayIndex = targetDate.getDay();
        let daysToAdd = weekDayFound - todayDayIndex;
        if (daysToAdd <= 0 || lower.includes('que viene') || lower.includes('próximo') || lower.includes('proximo')) {
            daysToAdd += 7;
        }
        targetDate.setDate(targetDate.getDate() + daysToAdd);
    } else if (lower.includes('mañana') || lower.includes('tomorrow')) {
        targetDate.setDate(targetDate.getDate() + 1);
    } else if (lower.includes('pasado mañana')) {
        targetDate.setDate(targetDate.getDate() + 2);
    } else {
        const dayNumMatch = lower.match(/(?:el día|día|el)\s*(\d{1,2})\s*(?:del mes que viene|del próximo mes|del mes siguiente)?/i);
        const isNextMonth = lower.includes('mes que viene') || lower.includes('próximo mes') || lower.includes('mes siguiente');

        if (isNextMonth && dayNumMatch) {
            targetDate.setMonth(targetDate.getMonth() + 1);
            targetDate.setDate(parseInt(dayNumMatch[1]));
        } else if (dayNumMatch) {
            const dayVal = parseInt(dayNumMatch[1]);
            if (dayVal < targetDate.getDate()) targetDate.setMonth(targetDate.getMonth() + 1);
            targetDate.setDate(dayVal);
        }
    }

    const targetDateKey = getFormattedDateKey(targetDate);

    let timeFound = '';
    const standardTimeMatch = lower.match(/(\d{1,2})[:\.](\d{2})/);
    const spokenTimeMatch = lower.match(/(?:a las|at)\s*(\d{1,2})\s*(?:y|\:)\s*(\d{1,2})/i);
    const halfTimeMatch = lower.match(/(?:a las|at)\s*(\d{1,2})\s*y media/i);

    if (standardTimeMatch) {
        timeFound = `${String(standardTimeMatch[1]).padStart(2,'0')}:${standardTimeMatch[2]}`;
    } else if (spokenTimeMatch) {
        timeFound = `${String(spokenTimeMatch[1]).padStart(2,'0')}:${String(spokenTimeMatch[2]).padStart(2,'0')}`;
    } else if (halfTimeMatch) {
        timeFound = `${String(halfTimeMatch[1]).padStart(2,'0')}:30`;
    } else {
        const hourOnlyMatch = lower.match(/(?:a las|at)\s*(\d{1,2})/i);
        if (hourOnlyMatch) {
            timeFound = `${String(hourOnlyMatch[1]).padStart(2,'0')}:00`;
        }
    }

    let loc = 'none';
    if (lower.includes('casa')) loc = 'casa';
    else if (lower.includes('cochera') || lower.includes('trabajo') || lower.includes('base') || lower.includes('central')) loc = 'central';
    else if (lower.includes('super') || lower.includes('compras')) loc = 'super';
    else if (lower.includes('gasolinera')) loc = 'gasolinera';

    let category = 'personal';
    if (lower.includes('trabajo') || lower.includes('revisar') || lower.includes('informe')) category = 'trabajo';
    else if (lower.includes('urgente') || lower.includes('ya') || lower.includes('medico') || lower.includes('doctor')) category = 'urgente';

    const isEvent = lower.includes('vacaciones') || lower.includes('cita') || lower.includes('reunión') || 
                    lower.includes('evento') || lower.includes('clase') || lower.includes('gimnasio') || 
                    lower.includes('médico') || lower.includes('doctor') || (timeFound !== '');

    if (isEvent) {
        const eventId = 'ev_' + Date.now();
        const eventData = {
            id: eventId,
            date: targetDateKey,
            title: phrase,
            details: 'Dictado por Voz IA',
            time: timeFound || '09:00',
            priority: 'high',
            loc: loc,
            notified: false,
            alarmFired: false,
            done: false
        };
        await db.events.put(eventData);
        syncEventWithFirebase(eventData);
        
        selectedDateStr = targetDateKey;
        currentYear = targetDate.getFullYear();
        currentMonth = targetDate.getMonth();
        
        await initCalendar();
        alert(`✓ Evento asignado al ${targetDateKey}:\n"${phrase}"\n⏰ Alarma a las: ${eventData.time}`);
        switchTab('calendar');
    } else {
        await db.todos.add({
            dateKey: targetDateKey,
            text: phrase,
            done: false,
            category: category,
            subtasks: [],
            repeat: 'none',
            loc: loc,
            time: timeFound
        });
        
        selectedDateStr = targetDateKey;
        currentYear = targetDate.getFullYear();
        currentMonth = targetDate.getMonth();

        await renderDayTasksList();
        await initCalendar();
        alert(`✓ Tarea asignada al ${targetDateKey}:\n"${phrase}"`);
        switchTab('tasks');
    }
}

function toggleStrikethroughNote() {
    triggerHaptic();
    const area = document.getElementById('tab-day-notes');
    const sel = window.getSelection();

    if (sel.rangeCount > 0 && sel.toString().trim() !== '') {
        document.execCommand('strikeThrough', false, null);
    } else if (area) {
        const isTached = area.classList.contains('note-strike-txt');
        if (isTached) {
            area.classList.remove('note-strike-txt');
            area.querySelectorAll('strike, s, del').forEach(el => {
                el.outerHTML = el.innerHTML;
            });
        } else {
            area.classList.add('note-strike-txt');
        }
    }
    saveTabNotes();
}

async function clearTabNotes() {
    if (confirm("¿Quieres borrar toda la nota de este día?")) {
        const area = document.getElementById('tab-day-notes');
        if (area) {
            area.innerHTML = '';
            area.classList.remove('note-strike-txt');
        }
        await db.notes.delete(selectedDateStr);
        await initCalendar();
    }
}

function filterTaskCategory(cat, el) {
    triggerHaptic();
    activeCategoryFilter = cat;
    document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
    if (el) el.classList.add('active');
    renderDayTasksList();
}

async function updateTaskProgress() {
    const list = await db.todos.where('dateKey').equals(selectedDateStr).toArray();
    const total = list.length;
    const completed = list.filter(t => t.done).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    const percentTxt = document.getElementById('progress-percent-txt');
    const fillBar = document.getElementById('progress-bar-fill');
    if (percentTxt) percentTxt.innerText = percent + '%';
    if (fillBar) fillBar.style.width = percent + '%';
}

async function loadPresetTemplate(type) {
    let items = [];
    if (currentProfileKey === 'trabajo') {
        items = ['Revisar correo e incidencias', 'Planificar entregas del día', 'Verificar proyectos activos'];
    } else if (currentProfileKey === 'salud') {
        items = ['Beber vaso de agua', '30 min de ejercicio / caminata', 'Tomar medicación / vitaminas'];
    } else if (currentProfileKey === 'finanzas') {
        items = ['Revisar saldo e ingresos', 'Registrar gastos diarios', 'Verificar facturas pendientes'];
    } else if (currentProfileKey === 'personal') {
        items = ['Organizar la casa', 'Hacer compra diaria', 'Tiempo libre / Lectura'];
    } else {
        items = ['Revisar agenda del día', 'Hacer compras pendientes', 'Organizar tareas personales'];
    }

    for (let text of items) {
        await db.todos.add({ dateKey: selectedDateStr, text, done: false, category: 'trabajo', loc: 'none', time: '' });
    }
    await renderDayTasksList();
    alert("✓ Plantilla cargada para el día actual.");
}

async function shareDaySummary() {
    const tasksList = await db.todos.where('dateKey').equals(selectedDateStr).toArray();
    const eventsList = await db.events.where('date').equals(selectedDateStr).toArray();
    const noteRecord = await db.notes.get(selectedDateStr);

    let msg = `📅 *RESUMEN DE JORNADA (${selectedDateStr})*\n\n`;
    
    if (eventsList.length > 0) {
        msg += `🔵 *Eventos:*\n`;
        eventsList.forEach(e => msg += `• ${e.time} - ${e.title}\n`);
        msg += `\n`;
    }

    if (tasksList.length > 0) {
        msg += `🟢 *Tareas:*\n`;
        tasksList.forEach(t => msg += `${t.done ? '✅' : '⏳'} ${t.text}\n`);
        msg += `\n`;
    }

    if (noteRecord && (noteRecord.text || noteRecord.html)) {
        const cleanTxt = (noteRecord.text || noteRecord.html.replace(/<[^>]*>/g, '')).trim();
        if (cleanTxt) msg += `🟠 *Notas:*\n${cleanTxt}\n`;
    }

    if (navigator.share) {
        navigator.share({ title: 'Resumen TaskMaster', text: msg });
    } else {
        navigator.clipboard.writeText(msg);
        alert("✓ Resumen copiado al portapapeles. ¡Listo para compartir!");
    }
}

async function handleGlobalSearch(query) {
    const box = document.getElementById('search-results-box');
    const listContainer = document.getElementById('search-results-list');
    
    if (!query || query.trim().length < 2) {
        if (box) box.style.display = 'none';
        return;
    }

    const q = query.toLowerCase().trim();
    const allTasks = await db.todos.toArray();
    const allEvents = await db.events.toArray();
    const allNotes = await db.notes.toArray();

    const matchedTasks = allTasks.filter(t => t.text.toLowerCase().includes(q));
    const matchedEvents = allEvents.filter(e => e.title.toLowerCase().includes(q) || (e.details && e.details.toLowerCase().includes(q)));
    const matchedNotes = allNotes.filter(n => (n.text && n.text.toLowerCase().includes(q)) || (n.html && n.html.toLowerCase().includes(q)));

    if (listContainer) listContainer.innerHTML = '';
    let total = 0;

    matchedTasks.forEach(t => {
        total++;
        if (listContainer) listContainer.innerHTML += `<div class="event-card"><div class="event-info"><div class="event-time">🟢 Tarea (${t.dateKey})</div><div class="event-title-txt">${t.text}</div></div></div>`;
    });

    matchedEvents.forEach(e => {
        total++;
        if (listContainer) listContainer.innerHTML += `<div class="event-card"><div class="event-info"><div class="event-time">🔵 Evento (${e.date})</div><div class="event-title-txt">${e.title}</div></div></div>`;
    });

    matchedNotes.forEach(n => {
        total++;
        const displayTxt = n.text || n.html.replace(/<[^>]*>/g, '');
        if (listContainer) listContainer.innerHTML += `<div class="event-card"><div class="event-info"><div class="event-time">🟠 Nota (${n.dateKey})</div><div class="event-title-txt">${displayTxt.substring(0, 45)}...</div></div></div>`;
    });

    if (total === 0 && listContainer) {
        listContainer.innerHTML = '<div class="empty-hint">No se encontraron coincidencias.</div>';
    }

    if (box) box.style.display = 'block';
}

function toggleDictation() {
    const btn = document.getElementById('btn-dictate-notes');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        return alert("El reconocimiento por voz no está soportado en este navegador.");
    }

    if (isRecordingSpeech) {
        if (speechRecognition) speechRecognition.stop();
        isRecordingSpeech = false;
        if (btn) {
            btn.classList.remove('recording');
            btn.innerText = '🎙️ Dictar';
        }
    } else {
        speechRecognition = new SpeechRecognition();
        speechRecognition.lang = navigator.language || 'es-ES';
        speechRecognition.continuous = true;
        speechRecognition.interimResults = false;

        speechRecognition.onstart = () => {
            isRecordingSpeech = true;
            if (btn) {
                btn.classList.add('recording');
                btn.innerText = '🔴 Escuchando...';
            }
        };

        speechRecognition.onresult = (event) => {
            const transcript = event.results[event.results.length - 1][0].transcript;
            const area = document.getElementById('tab-day-notes');
            if (area) {
                area.innerHTML += (area.innerHTML ? '<br>' : '') + transcript;
                saveTabNotes();
            }
        };

        speechRecognition.onerror = () => {
            isRecordingSpeech = false;
            if (btn) {
                btn.classList.remove('recording');
                btn.innerText = '🎙️ Dictar';
            }
        };

        speechRecognition.onend = () => {
            isRecordingSpeech = false;
            if (btn) {
                btn.classList.remove('recording');
                btn.innerText = '🎙️ Dictar';
            }
        };

        speechRecognition.start();
    }
}

function formatNotesWithIA() {
    const area = document.getElementById('tab-day-notes');
    if (!area) return;
    let rawText = area.innerText.trim();
    if (!rawText) return alert("Escribe o dicta algo primero en las notas.");

    const lines = rawText.split('\n').filter(l => l.trim() !== '');
    const formatted = lines.map(line => '• ' + line.replace(/^[\s•\-*]+/, '')).join('<br>');
    area.innerHTML = `<b>📝 NOTAS ESTRUCTURADAS:</b><br>${formatted}`;
    saveTabNotes();
}

async function convertNoteToAlarm() {
    const area = document.getElementById('tab-day-notes');
    if (!area) return;
    let rawText = area.innerText.trim();
    if (!rawText) return alert("Escribe primero la nota que quieres convertir en alarma.");

    const timeStr = prompt("Introduce la hora de la alarma (Ejemplo: 14:30):", "09:00");
    if (!timeStr) return;

    const eventId = 'ev_' + Date.now();
    const eventData = {
        id: eventId,
        date: selectedDateStr,
        title: '📌 Alarma Nota: ' + rawText.substring(0, 25),
        details: rawText,
        time: timeStr,
        priority: 'medium',
        loc: 'none',
        notified: false,
        alarmFired: false,
        done: false
    };

    await db.events.put(eventData);
    syncEventWithFirebase(eventData);
    await initCalendar();
    alert("✓ Nota convertida en Alerta correctamente.");
}

function renderWeekBar() {
    const container = document.getElementById('week-bar');
    if (!container) return;
    container.innerHTML = '';
    
    const curr = new Date();
    const first = curr.getDate() - curr.getDay() + 1;
    const dayNames = ['L','M','X','J','V','S','D'];

    for (let i = 0; i < 7; i++) {
        const nextDay = new Date(curr.setDate(first + i));
        const dateKey = getFormattedDateKey(nextDay);
        const dayNum = nextDay.getDate();

        const chip = document.createElement('div');
        chip.className = `week-day-chip ${dateKey === selectedDateStr ? 'active' : ''}`;
        if (dateKey === getFormattedDateKey(todayDate)) chip.classList.add('today-highlight');

        chip.innerHTML = `
            <span class="day-name">${dayNames[i]}</span>
            <span class="day-num">${dayNum}</span>
        `;
        chip.onclick = async () => {
            triggerHaptic();
            selectedDateStr = dateKey;
            renderWeekBar();
            await loadTabData();
        };
        container.appendChild(chip);
    }
}

function handleSaveTaskClick() {
    const txt = document.getElementById('taskInputText').value;
    if (!txt) return alert("Escribe el nombre de la tarea.");

    const time = document.getElementById('taskTimeInput').value;
    if (!time) {
        const modal = document.getElementById('reminder-prompt-modal');
        if (modal) modal.style.display = 'flex';
    } else {
        executeSaveTask();
    }
}

function promptAddReminderTime() {
    const modal = document.getElementById('reminder-prompt-modal');
    if (modal) modal.style.display = 'none';
    const timeInput = document.getElementById('taskTimeInput');
    if (timeInput) timeInput.focus();
}

function promptSaveWithoutReminder() {
    const modal = document.getElementById('reminder-prompt-modal');
    if (modal) modal.style.display = 'none';
    executeSaveTask();
}

async function executeSaveTask() {
    const txt = document.getElementById('taskInputText').value;
    const category = document.getElementById('taskCategorySelect').value;
    const subtasksRaw = document.getElementById('taskSubtasksInput').value;
    const repeat = document.getElementById('taskRepeatSelect').value;
    const loc = document.getElementById('taskLocSelect').value;
    const time = document.getElementById('taskTimeInput').value;

    const subtasks = subtasksRaw ? subtasksRaw.split(',').map(s => ({ text: s.trim(), done: false })).filter(s => s.text !== '') : [];

    await db.todos.add({ 
        dateKey: selectedDateStr, 
        text: txt, 
        done: false, 
        category, 
        subtasks, 
        repeat, 
        loc, 
        time 
    });

    if (loc !== 'none' || time) {
        const eventId = 'ev_' + Date.now();
        const eventData = {
            id: eventId,
            date: selectedDateStr,
            title: txt, details: '', time: time || '--:--', priority: 'low', loc,
            customCoords: pendingEventCustomCoords,
            notified: false, alarmFired: false, done: false
        };
        await db.events.put(eventData);

        if (time) {
            syncEventWithFirebase(eventData);
        }
        await initCalendar();
    }

    const taskArea = document.getElementById('taskInputText');
    if (taskArea) {
        taskArea.value = '';
        taskArea.style.height = 'auto';
    }
    const subtasksInput = document.getElementById('taskSubtasksInput');
    const timeInput = document.getElementById('taskTimeInput');
    if (subtasksInput) subtasksInput.value = '';
    if (timeInput) timeInput.value = '';

    closeTaskModal();
    pendingEventCustomCoords = null;
    await renderDayTasksList();
}

async function renderDayTasksList() {
    const container = document.getElementById('tasks-day-list');
    if (!container) return;
    container.innerHTML = '';
    let list = await db.todos.where('dateKey').equals(selectedDateStr).toArray();

    if (activeCategoryFilter !== 'all') {
        list = list.filter(t => t.category === activeCategoryFilter);
    }

    if (list.length === 0) {
        container.innerHTML = '<div class="empty-hint">No hay tareas anotadas para este día. Toca (+) para añadir una.</div>';
        await updateTaskProgress();
        return;
    }

    list.forEach((todo) => {
        const div = document.createElement('div');
        div.className = `todo-item ${todo.done ? 'done' : ''}`;
        
        let subtasksHtml = '';
        if (todo.subtasks && todo.subtasks.length > 0) {
            subtasksHtml = '<div class="subtasks-container">';
            todo.subtasks.forEach((st, idx) => {
                subtasksHtml += `
                    <div class="subtask-item ${st.done ? 'done' : ''}">
                        <input type="checkbox" ${st.done ? 'checked' : ''} onchange="triggerHaptic(); toggleSubtask(${todo.id}, ${idx});">
                        <span>${st.text}</span>
                    </div>
                `;
            });
            subtasksHtml += '</div>';
        }

        div.innerHTML = `
            <div class="todo-main-row">
                <input type="checkbox" class="todo-checkbox" ${todo.done ? 'checked' : ''} onchange="triggerHaptic(); toggleDayTodo(${todo.id}, ${todo.done});">
                <span class="todo-text-span">${todo.text}</span>
                <button class="btn-reminder" onclick="triggerHaptic(); setTaskTimePrompt(${todo.id}, '${todo.text}', '${todo.time || ''}');">🔔 ${todo.time ? todo.time : 'Recordar'}</button>
                <button class="event-del" onclick="triggerHaptic(); deleteDayTodo(${todo.id});">✕</button>
            </div>
            ${subtasksHtml}
        `;
        container.appendChild(div);
    });
    await updateTaskProgress();
}

async function setTaskTimePrompt(todoId, title, currentTime) {
    const timeStr = prompt(`⏰ Asignar hora de alarma para:\n"${title}"`, currentTime || "09:00");
    if (!timeStr) return;

    await db.todos.update(todoId, { time: timeStr });

    const eventId = 'ev_t_' + todoId;
    const eventData = {
        id: eventId,
        date: selectedDateStr,
        title: title,
        details: 'Recordatorio de Tarea',
        time: timeStr,
        priority: 'medium',
        loc: 'none',
        notified: false,
        alarmFired: false,
        done: false
    };

    await db.events.put(eventData);
    syncEventWithFirebase(eventData);

    await renderDayTasksList();
    await initCalendar();
    alert(`✓ Alarma programada a las ${timeStr} para: "${title}"`);
}

async function toggleSubtask(todoId, subtaskIdx) {
    const todo = await db.todos.get(todoId);
    if (todo && todo.subtasks) {
        todo.subtasks[subtaskIdx].done = !todo.subtasks[subtaskIdx].done;
        await db.todos.update(todoId, { subtasks: todo.subtasks });
        await renderDayTasksList();
    }
}

async function toggleDayTodo(id, currentDone) {
    const todo = await db.todos.get(id);
    const newDoneState = !currentDone;
    await db.todos.update(id, { done: newDoneState });

    if (newDoneState && todo && todo.repeat && todo.repeat !== 'none') {
        const nextDate = new Date(todo.dateKey);
        let nextTime = todo.time;

        if (todo.repeat === '10m' || todo.repeat === '15m' || todo.repeat === '30m' || todo.repeat === '1h') {
            const now = new Date();
            const minutesToAdd = todo.repeat === '10m' ? 10 : todo.repeat === '15m' ? 15 : todo.repeat === '30m' ? 30 : 60;
            now.setMinutes(now.getMinutes() + minutesToAdd);
            nextDate.setTime(now.getTime());
            nextTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
        } else if (todo.repeat === 'daily') {
            nextDate.setDate(nextDate.getDate() + 1);
        } else if (todo.repeat === 'weekly') {
            nextDate.setDate(nextDate.getDate() + 7);
        } else if (todo.repeat === 'monthly') {
            nextDate.setMonth(nextDate.getMonth() + 1);
        }

        const nextDateKey = getFormattedDateKey(nextDate);
        await db.todos.add({
            dateKey: nextDateKey,
            text: todo.text,
            done: false,
            category: todo.category,
            subtasks: todo.subtasks ? todo.subtasks.map(s => ({ ...s, done: false })) : [],
            repeat: todo.repeat,
            loc: todo.loc,
            time: nextTime
        });
    }

    await renderDayTasksList();
}

async function deleteDayTodo(id) {
    await db.todos.delete(id);
    await db.events.delete('ev_t_' + id);
    if (fbDB) fbDB.ref('alarms/ev_t_' + id).remove();
    await renderDayTasksList();
    await initCalendar();
}

async function saveTabNotes() {
    const area = document.getElementById('tab-day-notes');
    if (!area) return;
    const htmlContent = area.innerHTML;
    const plainText = area.innerText.trim();

    if (!plainText) {
        await db.notes.delete(selectedDateStr);
    } else {
        await db.notes.put({ dateKey: selectedDateStr, html: htmlContent, text: plainText });
    }
    await renderCalSelectedEvents();
    await initCalendar();
}

async function updateSummaryData() {
    const todayKey = getFormattedDateKey(todayDate);
    const pendingTasks = await db.todos.where('dateKey').equals(todayKey).filter(t => !t.done).count();
    const completedTasks = await db.todos.where('dateKey').equals(todayKey).filter(t => t.done).count();
    const todayEvents = await db.events.where('date').equals(todayKey).count();
    const savedLocs = await db.locations.count();

    const pendingEl = document.getElementById('summary-pending-count');
    const eventsEl = document.getElementById('summary-events-count');
    const locsEl = document.getElementById('summary-locs-count');
    if (pendingEl) pendingEl.innerText = pendingTasks;
    if (eventsEl) eventsEl.innerText = todayEvents;
    if (locsEl) locsEl.innerText = savedLocs;

    const iaSummaryBox = document.getElementById('ia-executive-summary-text');
    if (iaSummaryBox) {
        if (pendingTasks === 0 && todayEvents === 0) {
            iaSummaryBox.innerText = "💡 ¡Todo al día! No tienes tareas ni eventos pendientes para hoy.";
        } else {
            iaSummaryBox.innerText = `💡 Tienes ${pendingTasks} tareas pendientes y ${todayEvents} eventos hoy. Mantén el ritmo en tus objetivos.`;
        }
    }

    drawModernBarChart(pendingTasks, completedTasks, todayEvents, savedLocs);
}

function drawModernBarChart(pending, completed, eventsCount, locs) {
    const canvas = document.getElementById('summaryCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const categories = [
        { label: 'Pendientes', value: pending, color: '#e54d42' },
        { label: 'Hechas', value: completed, color: '#6bb05d' },
        { label: 'Eventos', value: eventsCount, color: '#38bdf8' },
        { label: 'GPS', value: locs, color: '#e5934a' }
    ];

    const maxValue = Math.max(...categories.map(c => c.value), 5);
    const startY = 25;
    const barHeight = 18;
    const gap = 16;

    categories.forEach((cat, index) => {
        const y = startY + index * (barHeight + gap);
        
        ctx.fillStyle = 'rgba(128, 128, 128, 0.12)';
        ctx.beginPath();
        ctx.roundRect(80, y, 220, barHeight, 6);
        ctx.fill();

        const filledWidth = Math.max((cat.value / maxValue) * 220, 8);
        ctx.fillStyle = cat.color;
        ctx.beginPath();
        ctx.roundRect(80, y, filledWidth, barHeight, 6);
        ctx.fill();

        ctx.fillStyle = 'var(--text-main)';
        ctx.font = 'bold 11px -apple-system, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(cat.label, 72, y + 13);

        ctx.textAlign = 'left';
        ctx.fillText(cat.value, 86 + filledWidth, y + 13);
    });
}

function handleLocSelectChange(val) {
    if (val === 'custom_map') openMapPicker('event_custom');
}

function openMapPicker(type) {
    activeTargetType = type;
    const mapModal = document.getElementById('map-modal');
    if (mapModal) mapModal.style.display = 'flex';

    if (!leafletMap) {
        leafletMap = L.map('map').setView([tempCoords.lat, tempCoords.lon], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(leafletMap);
        mapMarker = L.marker([tempCoords.lat, tempCoords.lon], { draggable: true }).addTo(leafletMap);

        leafletMap.on('click', (e) => {
            tempCoords = { lat: e.latlng.lat, lon: e.latlng.lng };
            mapMarker.setLatLng(e.latlng);
        });
        mapMarker.on('dragend', () => {
            const pos = mapMarker.getLatLng();
            tempCoords = { lat: pos.lat, lon: pos.lng };
        });
    }
    setTimeout(() => { leafletMap.invalidateSize(); centerMapOnUserGPS(); }, 250);
}

function centerMapOnUserGPS() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            tempCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
            if (leafletMap && mapMarker) {
                leafletMap.setView([tempCoords.lat, tempCoords.lon], 16);
                mapMarker.setLatLng([tempCoords.lat, tempCoords.lon]);
            }
        }, null, { enableHighAccuracy: true });
    }
}

function closeMapPicker() { 
    const mapModal = document.getElementById('map-modal');
    if (mapModal) mapModal.style.display = 'none'; 
}

async function confirmMapLocation() {
    if (activeTargetType === 'event_custom') {
        pendingEventCustomCoords = { lat: tempCoords.lat, lon: tempCoords.lon };
        const statusDiv = document.getElementById('event-custom-coord-status');
        if (statusDiv) {
            statusDiv.innerText = `📍 Punto Fijado (${tempCoords.lat.toFixed(6)}, ${tempCoords.lon.toFixed(6)})`;
            statusDiv.style.display = 'block';
        }
    } else if (activeTargetType) {
        await db.locations.put({ key: activeTargetType, data: { lat: tempCoords.lat, lon: tempCoords.lon } });
        await updateLocationUI();
    }
    closeMapPicker();
}

async function changeMonth(dir) {
    currentMonth += dir;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    else if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    
    selectedDateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-01`;
    const label = document.getElementById('cal-selected-date-label');
    if (label) label.innerText = selectedDateStr;
    await initCalendar();
    await renderCalSelectedEvents();
}

async function initCalendar() {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;
    grid.innerHTML = ''; 
    
    const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const monthYearLabel = document.getElementById('calendar-month-year');
    if (monthYearLabel) monthYearLabel.innerText = `${months[currentMonth]} ${currentYear}`;

    ['D','L','M','X','J','V','S'].forEach(n => {
        const el = document.createElement('div');
        el.className = 'calendar-day-name'; el.innerText = n;
        grid.appendChild(el);
    });

    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();

    for (let x = 0; x < firstDayIndex; x++) {
        grid.appendChild(Object.assign(document.createElement('div'), { className: 'calendar-cell empty' }));
    }

    const allEvents = await db.events.toArray();
    const allNotes = await db.notes.toArray();

    for (let i = 1; i <= totalDays; i++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-cell'; cell.innerText = i;
        const dateKey = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;

        if (dateKey === getFormattedDateKey(todayDate)) cell.classList.add('today');

        const hasNote = allNotes.some(n => n.dateKey === dateKey && (n.text || n.html) && (n.text.trim() !== '' || n.html.trim() !== ''));
        if (hasNote) {
            const noteDot = document.createElement('div');
            noteDot.className = 'note-dot-hint';
            cell.appendChild(noteDot);
        }

        const dayEvents = allEvents.filter(e => e.date === dateKey);
        if (dayEvents.length > 0) {
            const barContainer = document.createElement('div');
            barContainer.className = 'indicator-bar-container';
            dayEvents.slice(0, 3).forEach(ev => {
                const bar = document.createElement('div');
                bar.className = 'ind-bar';
                bar.style.backgroundColor = `var(--color-${ev.priority})`;
                barContainer.appendChild(bar);
            });
            cell.appendChild(barContainer);
        }

        cell.onclick = async () => {
            triggerHaptic();
            selectedDateStr = dateKey;
            const dateLabel = document.getElementById('cal-selected-date-label');
            if (dateLabel) dateLabel.innerText = dateKey;
            await renderCalSelectedEvents();

            const tasksInDay = await db.todos.where('dateKey').equals(dateKey).count();
            const eventsInDay = dayEvents.length;
            const noteInDay = hasNote;

            if (tasksInDay === 0 && eventsInDay === 0 && !noteInDay) {
                openDayModalForSelectedDate();
            }
        };
        grid.appendChild(cell);
    }
}

async function renderCalSelectedEvents() {
    const container = document.getElementById('cal-selected-events-list');
    if (!container) return;
    container.innerHTML = '';
    const dayEvents = await db.events.where('date').equals(selectedDateStr).toArray();
    const noteRecord = await db.notes.get(selectedDateStr);

    let hasItems = false;

    if (dayEvents.length > 0) {
        hasItems = true;
        dayEvents.forEach(ev => {
            const div = document.createElement('div');
            div.className = `event-card ${ev.done ? 'done' : ''}`;
            div.innerHTML = `
                <input type="checkbox" class="todo-checkbox" ${ev.done ? 'checked' : ''} onchange="triggerHaptic(); toggleEventDone('${ev.id}', ${ev.done});">
                <div class="event-dot" style="background:var(--color-${ev.priority});"></div>
                <div class="event-info">
                    <div class="event-time">
                        ${ev.time !== '--:--' ? ev.time : 'Solo Ubicación'}
                        <button class="btn-reminder" onclick="triggerHaptic(); setTaskTimePrompt('${ev.id}', '${ev.title}', '${ev.time}');">🔔 Recordar</button>
                    </div>
                    <div class="event-title-txt">${ev.title}</div>
                    ${ev.details ? `<div class="event-desc-txt">${ev.details}</div>` : ''}
                </div>
                <button class="event-del" onclick="triggerHaptic(); deleteEvent('${ev.id}');">✕</button>
            `;
            container.appendChild(div);
        });
    }

    if (noteRecord && (noteRecord.html || noteRecord.text)) {
        hasItems = true;
        const noteDiv = document.createElement('div');
        noteDiv.className = 'event-card card-note';
        const displayContent = noteRecord.html || noteRecord.text;
        
        noteDiv.innerHTML = `
            <div class="event-dot" style="background:var(--color-note);"></div>
            <div class="event-info">
                <div class="event-time">🟠 Nota del Día</div>
                <div class="event-title-txt" style="font-weight: normal; margin-top: 4px;">${displayContent}</div>
            </div>
            <button class="event-del" onclick="triggerHaptic(); clearTabNotes();">✕</button>
        `;
        container.appendChild(noteDiv);
    }

    if (!hasItems) {
        container.innerHTML = '<div class="empty-hint">Sin eventos ni notas anotadas para esta fecha.</div>';
    }
}

async function toggleEventDone(id, currentDone) {
    const newDone = !currentDone;
    await db.events.update(id, { done: newDone });
    if (fbDB) fbDB.ref('alarms/' + id + '/done').set(newDone);
    await renderCalSelectedEvents();
}

async function saveEventFromCalModal() {
    const title = document.getElementById('eventTitle').value;
    const details = document.getElementById('eventDesc').value;
    const time = document.getElementById('eventTime').value;

    if (!title) return alert("Rellena el título del evento.");

    const eventId = 'ev_' + Date.now();
    const eventData = {
        id: eventId,
        date: selectedDateStr,
        title, details: details || '', time: time || '--:--', priority: selectedPriority, loc: 'none',
        notified: false, alarmFired: false, done: false
    };

    await db.events.put(eventData);
    syncEventWithFirebase(eventData);

    document.getElementById('eventTitle').value = '';
    document.getElementById('eventDesc').value = '';
    document.getElementById('eventTime').value = '';

    await initCalendar();
    await updateSummaryData();
    await switchTab('calendar');
}

async function deleteEvent(id) {
    await db.events.delete(id);
    if (fbDB) fbDB.ref('alarms/' + id).remove();
    await initCalendar();
    await renderCalSelectedEvents();
    await updateSummaryData();
}

async function updateSoundType(val) {
    await db.settings.put({ key: 'sound_type', value: val });
}

function selectPriority(el) {
    document.querySelectorAll('.priority-chip').forEach(c => c.classList.remove('selected'));
    if (el) {
        el.classList.add('selected'); 
        selectedPriority = el.dataset.value;
    }
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').then(reg => { 
            swRegistration = reg;
            if (fbMessaging) {
                fbMessaging.useServiceWorker(reg);
            }
        }).catch(err => console.log("SW Registro:", err));
    }
}

function updatePermissionBanner() {
    const banner = document.getElementById('permission-banner');
    const notifStatus = document.getElementById('notif-status');
    if ('Notification' in window && Notification.permission !== 'granted') {
        if (banner) banner.style.display = 'block';
        if (notifStatus) notifStatus.innerText = 'Pendiente';
    } else {
        if (banner) banner.style.display = 'none';
        if (notifStatus) notifStatus.innerText = 'Activadas ✓';
    }
}

function requestPermissions() {
    unlockAudioContext();
    if ('Notification' in window) {
        Notification.requestPermission().then((perm) => {
            updatePermissionBanner();
            if (perm === 'granted' && fbMessaging && navigator.onLine) {
                fbMessaging.getToken({ vapidKey }).then(token => {
                    fbDB.ref('device_tokens/main_device').set(token);
                }).catch(err => console.error("Error FCM Token:", err));
            }
        });
    }
    triggerHaptic();
}

async function updateLocationUI() {
    const cocheraStatus = document.getElementById('cochera-status');
    const casaStatus = document.getElementById('casa-status');
    const puntoAStatus = document.getElementById('punto-a-status');
    const puntoBStatus = document.getElementById('punto-b-status');

    const locCentral = await db.locations.get('central');
    const locCasa = await db.locations.get('casa');
    const locPuntoA = await db.locations.get('punto_a');
    const locPuntoB = await db.locations.get('punto_b');

    if (locCentral && cocheraStatus) cocheraStatus.innerText = `Guardada (${locCentral.data.lat.toFixed(6)}, ${locCentral.data.lon.toFixed(6)})`;
    if (locCasa && casaStatus) casaStatus.innerText = `Guardada (${locCasa.data.lat.toFixed(6)}, ${locCasa.data.lon.toFixed(6)})`;
    if (locPuntoA && puntoAStatus) puntoAStatus.innerText = `Guardada (${locPuntoA.data.lat.toFixed(6)}, ${locPuntoA.data.lon.toFixed(6)})`;
    if (locPuntoB && puntoBStatus) puntoBStatus.innerText = `Guardada (${locPuntoB.data.lat.toFixed(6)}, ${locPuntoB.data.lon.toFixed(6)})`;
}

async function setTheme(themeName, element) {
    applyThemeUI(themeName);
    await db.settings.put({ key: 'app_theme', value: themeName });
}

async function playAlertSound() {
    unlockAudioContext();
    const soundTypeRec = await db.settings.get('sound_type');
    const soundType = soundTypeRec ? soundTypeRec.value : 'classic';

    try {
        const playNote = (delay, freq, dur, type = 'sine') => {
            const osc = globalAudioCtx.createOscillator();
            const gain = globalAudioCtx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, globalAudioCtx.currentTime + delay);
            gain.gain.setValueAtTime(0.4, globalAudioCtx.currentTime + delay);
            gain.gain.exponentialRampToValueAtTime(0.01, globalAudioCtx.currentTime + delay + dur);
            osc.connect(gain);
            gain.connect(globalAudioCtx.destination);
            osc.start(globalAudioCtx.currentTime + delay);
            osc.stop(globalAudioCtx.currentTime + delay + dur);
        };

        if (soundType === 'harmonic') {
            playNote(0, 523.25, 0.25, 'triangle');
            playNote(0.2, 659.25, 0.3, 'triangle');
            playNote(0.4, 783.99, 0.4, 'triangle');
        } else if (soundType === 'double') {
            playNote(0, 900, 0.12, 'square');
            playNote(0.15, 900, 0.12, 'square');
            playNote(0.3, 900, 0.2, 'square');
        } else {
            playNote(0, 880, 0.15, 'sine');
            playNote(0.2, 880, 0.15, 'sine');
            playNote(0.4, 1174.66, 0.3, 'sine');
        }
    } catch (e) {}
}

function initSmartTracking() {
    if (!navigator.geolocation) return;
    
    const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    };

    navigator.geolocation.watchPosition(async (pos) => {
        const { latitude, longitude, speed } = pos.coords;
        const currentSpeedKmh = speed ? (speed * 3.6) : 30;
        const triggerDistanceKm = currentSpeedKmh > 25 ? 0.60 : 0.15;

        const eventsList = await db.events.toArray();
        const locCentral = await db.locations.get('central');
        const locCasa = await db.locations.get('casa');
        const locPuntoA = await db.locations.get('punto_a');
        const locPuntoB = await db.locations.get('punto_b');

        eventsList.forEach(async (ev) => {
            if (ev.loc === 'none' || ev.notified || ev.done) return;

            let locationsToCheck = [];
            if (ev.loc === 'custom_map' && ev.customCoords) {
                locationsToCheck = [{ name: 'Lugar Personalizado', lat: ev.customCoords.lat, lon: ev.customCoords.lon }];
            } else if (ev.loc === 'central' && locCentral) {
                locationsToCheck = [{ name: 'Tu Base / Central', lat: locCentral.data.lat, lon: locCentral.data.lon }];
            } else if (ev.loc === 'casa' && locCasa) {
                locationsToCheck = [{ name: 'Tu Casa', lat: locCasa.data.lat, lon: locCasa.data.lon }];
            } else if (ev.loc === 'punto_a' && locPuntoA) {
                locationsToCheck = [{ name: 'Mi Punto A', lat: locPuntoA.data.lat, lon: locPuntoA.data.lon }];
            } else if (ev.loc === 'punto_b' && locPuntoB) {
                locationsToCheck = [{ name: 'Mi Punto B', lat: locPuntoB.data.lat, lon: locPuntoB.data.lon }];
            } else {
                locationsToCheck = geofenceZones[ev.loc] || [];
            }

            locationsToCheck.forEach(async (place) => {
                if (ev.notified) return;
                const distanceKm = calculateDistance(latitude, longitude, place.lat, place.lon);
                const timeToArrivalMinutes = (distanceKm / currentSpeedKmh) * 60;

                if (timeToArrivalMinutes <= 5 || distanceKm < triggerDistanceKm) {
                    await playAlertSound();
                    triggerHaptic();
                    if (swRegistration && swRegistration.showNotification) {
                        swRegistration.showNotification('TaskMaster Proximidad', {
                            body: `Estás llegando a ${place.name}. Tarea: ${ev.title}`,
                            icon: './icon-192.png',
                            badge: './icon-192.png',
                            requireInteraction: true,
                            renotify: true,
                            tag: 'geo_' + ev.id
                        });
                    }
                    await db.events.update(ev.id, { notified: true });
                }
            });
        });
    }, null, options);
}

function initTimeAlarms() {
    checkTimeAlarms();
    setInterval(checkTimeAlarms, 10000);
}

async function checkTimeAlarms() {
    const now = new Date();
    const todayStr = getFormattedDateKey(now);
    const eventsList = await db.events.where('date').equals(todayStr).toArray();

    eventsList.forEach(async (ev) => {
        if (ev.alarmFired || ev.time === '--:--' || ev.done) return;
        const [evH, evM] = ev.time.split(':').map(Number);
        const eventMinutes = evH * 60 + evM;
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        if (currentMinutes >= eventMinutes) {
            await playAlertSound();
            triggerHaptic();
            if (swRegistration && swRegistration.showNotification) {
                swRegistration.showNotification('TaskMaster Alerta', {
                    body: ev.title,
                    icon: './icon-192.png',
                    badge: './icon-192.png',
                    requireInteraction: true,
                    renotify: true,
                    tag: 'time_' + ev.id
                });
            }
            await db.events.update(ev.id, { alarmFired: true });
        }
    });
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
