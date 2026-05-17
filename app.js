'use strict';

const PAGES_MIN = 1;
const PAGES_MAX = 604;
const API_BASE = 'https://api.alquran.cloud/v1/page';
const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

const SURA_NOMLARI = [
    null,
    'Фотиҳа', 'Бақара', 'Оли Имрон', 'Нисо', 'Моида',
    'Анъом', 'Аъроф', 'Анфол', 'Тавба', 'Юнус',
    'Ҳуд', 'Юсуф', 'Раъд', 'Иброҳим', 'Ҳижр',
    'Наҳл', 'Исро', 'Каҳф', 'Марям', 'Тоҳо',
    'Анбиё', 'Ҳаж', 'Мўминун', 'Нур', 'Фурқон',
    'Шуаро', 'Намл', 'Қасас', 'Анкабут', 'Рум',
    'Луқмон', 'Сажда', 'Аҳзоб', 'Сабаъ', 'Фотир',
    'Ёсин', 'Соффот', 'Сод', 'Зумар', 'Ғофир',
    'Фуссилат', 'Шуро', 'Зухруф', 'Духон', 'Жосия',
    'Аҳқоф', 'Муҳаммад', 'Фатҳ', 'Ҳужурот', 'Қоф',
    'Зориёт', 'Тур', 'Нажм', 'Қамар', 'Раҳмон',
    'Воқиа', 'Ҳадид', 'Мужодала', 'Ҳашр', 'Мумтаҳана',
    'Соф', 'Жумъа', 'Мунофиқун', 'Тағобун', 'Талоқ',
    'Таҳрим', 'Мулк', 'Қалам', 'Ҳоққа', 'Маориж',
    'Нуҳ', 'Жин', 'Муззаммил', 'Муддассир', 'Қиёмат',
    'Инсон', 'Мурсалот', 'Набаъ', 'Нозиот', 'Абаса',
    'Таквир', 'Инфитор', 'Мутаффифин', 'Иншиқоқ', 'Буруж',
    'Ториқ', 'Аъло', 'Ғошия', 'Фажр', 'Балад',
    'Шамс', 'Лайл', 'Зуҳо', 'Шарҳ', 'Тин',
    'Алақ', 'Қадр', 'Баййина', 'Залзала', 'Одиёт',
    'Қориа', 'Такосур', 'Аср', 'Ҳумаза', 'Фил',
    'Қурайш', 'Моун', 'Кавсар', 'Кофирун', 'Наср',
    'Масад', 'Ихлос', 'Фалақ', 'Нос',
];

function buildAudioUrls(suraRaqami, oyatRaqami) {
    const s = String(suraRaqami).padStart(3, '0');
    const a = String(oyatRaqami).padStart(3, '0');
    return [
        `https://everyayah.com/data/Ayman_Sowaid_64kbps/${s}${a}.mp3`,
        `https://www.everyayah.com/data/Ayman_Sowaid_64kbps/${s}${a}.mp3`,
        `https://everyayah.com/data/Husary_64kbps/${s}${a}.mp3`,
    ];
}

function icon(name) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.classList.add('icon');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', `#i-${name}`);
    use.setAttributeNS(XLINK_NS, 'xlink:href', `#i-${name}`);
    svg.appendChild(use);
    return svg;
}

function fmtTime(s) {
    if (!isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${String(r).padStart(2, '0')}`;
}

const state = {
    joriyBet: 0,
    oyatlar: [],
    joriyOyatIndex: -1,
    avtomatikQoyish: false,
    abortController: null,
    fallbackIndex: 0,
    seeking: false,
};

const els = {
    pageInput: document.getElementById('pageInput'),
    showBtn: document.getElementById('showBtn'),
    loadingDiv: document.getElementById('loadingDiv'),
    errorDiv: document.getElementById('errorDiv'),
    resultSection: document.getElementById('resultSection'),
    pageInfo: document.getElementById('pageInfo'),
    ayatlarRoyxati: document.getElementById('ayatlarRoyxati'),
    stickyAudio: document.getElementById('stickyAudio'),
    stickyTitle: document.getElementById('stickyTitle'),
    stickyTime: document.getElementById('stickyTime'),
    stickyProgressTrack: document.getElementById('stickyProgressTrack'),
    stickyProgressBar: document.getElementById('stickyProgressBar'),
    stickyProgressHandle: document.getElementById('stickyProgressHandle'),
    stickyToggleBtn: document.getElementById('stickyToggleBtn'),
    stickyCloseBtn: document.getElementById('stickyCloseBtn'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
};

const audio = new Audio();
audio.preload = 'auto';

function xatolikniKorsatish(xabar) {
    els.errorDiv.replaceChildren(icon('alert'), document.createTextNode(xabar));
    els.errorDiv.style.display = 'flex';
    els.loadingDiv.style.display = 'none';
}

function xatolikniYashirish() {
    els.errorDiv.style.display = 'none';
}

function playingnyOlibTashlash() {
    const oldCard = document.getElementById(`ayat-${state.joriyOyatIndex}`);
    if (oldCard) oldCard.classList.remove('playing');
}

function progressniYangilash(pct) {
    const clamped = Math.max(0, Math.min(100, pct));
    els.stickyProgressBar.style.width = clamped + '%';
    els.stickyProgressHandle.style.left = clamped + '%';
}

function stickyKorsatish(oyat) {
    els.stickyTitle.textContent = `${oyat.suraRaqami}:${oyat.oyatRaqami}-оят`;
    els.stickyTime.textContent = '0:00 / 0:00';
    progressniYangilash(0);
    els.stickyAudio.classList.add('visible');
}

function stickyYashirish() {
    els.stickyAudio.classList.remove('visible');
    progressniYangilash(0);
    els.stickyTime.textContent = '0:00 / 0:00';
}

function stickyTogglenyYangilash() {
    els.stickyToggleBtn.replaceChildren(icon(audio.paused ? 'play' : 'pause'));
}

stickyTogglenyYangilash();

async function betniKorsatish() {
    xatolikniYashirish();
    hammasiniToxtatish();

    const rawValue = els.pageInput.value.trim();
    const betRaqami = Number(rawValue);

    if (!Number.isInteger(betRaqami) || betRaqami < PAGES_MIN || betRaqami > PAGES_MAX) {
        xatolikniKorsatish(`Илтимос, ${PAGES_MIN} дан ${PAGES_MAX} гача бўлган бутун рақамни киритинг!`);
        return;
    }

    if (state.abortController) {
        state.abortController.abort();
    }
    state.abortController = new AbortController();
    const { signal } = state.abortController;

    els.loadingDiv.style.display = 'block';
    els.resultSection.classList.remove('active');
    els.showBtn.disabled = true;
    els.showBtn.querySelector('span').textContent = 'Юкланмоқда…';

    try {
        const matnURL = `${API_BASE}/${betRaqami}/quran-uthmani`;
        const matnResponse = await fetch(matnURL, { signal });

        if (!matnResponse.ok) {
            throw new Error(`API status: ${matnResponse.status}`);
        }

        const matnData = await matnResponse.json();

        if (matnData.code !== 200 || !Array.isArray(matnData.data?.ayahs)) {
            throw new Error('API дан хато қайтди');
        }

        state.joriyBet = betRaqami;
        state.oyatlar = matnData.data.ayahs.map((oyat) => ({
            matn: oyat.text,
            oyatRaqami: oyat.numberInSurah,
            suraRaqami: oyat.surah.number,
            suraNomi: SURA_NOMLARI[oyat.surah.number] || oyat.surah.englishName,
            audioUrls: buildAudioUrls(oyat.surah.number, oyat.numberInSurah),
        }));

        betniRender();

        els.loadingDiv.style.display = 'none';
        els.resultSection.classList.add('active');
    } catch (error) {
        if (error.name === 'AbortError') {
            return;
        }
        xatolikniKorsatish('Маълумотларни юклашда хатолик: ' + error.message + '. Интернет уланишини текширинг.');
    } finally {
        els.showBtn.disabled = false;
        els.showBtn.querySelector('span').textContent = 'Бетни кўрсатиш';
    }
}

function betniRender() {
    els.pageInfo.textContent = `${state.joriyBet}-бет`;
    els.ayatlarRoyxati.replaceChildren();

    let oldingiSuraRaqami = -1;

    state.oyatlar.forEach((oyat, index) => {
        if (oyat.suraRaqami !== oldingiSuraRaqami) {
            const divider = document.createElement('div');
            divider.className = 'surah-divider';
            divider.style.animationDelay = `${index * 30}ms`;

            const ornL = document.createElement('span');
            ornL.className = 'ornament';
            ornL.textContent = '✦';
            const nameSpan = document.createElement('span');
            nameSpan.className = 'surah-name';
            nameSpan.textContent = oyat.suraNomi;
            const numSpan = document.createElement('span');
            numSpan.className = 'surah-num';
            numSpan.textContent = `${oyat.suraRaqami}-сура`;
            const ornR = document.createElement('span');
            ornR.className = 'ornament';
            ornR.textContent = '✦';

            divider.appendChild(ornL);
            divider.appendChild(nameSpan);
            divider.appendChild(ornR);
            divider.appendChild(numSpan);

            els.ayatlarRoyxati.appendChild(divider);
            oldingiSuraRaqami = oyat.suraRaqami;
        }

        const card = document.createElement('div');
        card.className = 'ayat-card';
        card.id = `ayat-${index}`;
        card.style.animationDelay = `${index * 40}ms`;

        const header = document.createElement('div');
        header.className = 'ayat-header';

        const sura = document.createElement('span');
        sura.className = 'ayat-info-sura';
        sura.textContent = oyat.suraNomi;
        const num = document.createElement('span');
        num.className = 'ayat-info-num';
        num.textContent = `${oyat.oyatRaqami}-оят`;

        header.appendChild(sura);
        header.appendChild(num);

        const arabic = document.createElement('div');
        arabic.className = 'arabic-text';
        arabic.textContent = oyat.matn;

        const controls = document.createElement('div');
        controls.className = 'ayat-controls';

        const playBtn = document.createElement('button');
        playBtn.className = 'audio-btn btn-play';
        playBtn.type = 'button';
        playBtn.appendChild(icon('play'));
        playBtn.appendChild(document.createTextNode('Эшитиш'));
        playBtn.addEventListener('click', () => oyatniQoyish(index));

        controls.appendChild(playBtn);

        card.appendChild(header);
        card.appendChild(arabic);
        card.appendChild(controls);

        els.ayatlarRoyxati.appendChild(card);
    });
}

audio.addEventListener('ended', () => {
    playingnyOlibTashlash();
    if (state.avtomatikQoyish && state.joriyOyatIndex < state.oyatlar.length - 1) {
        oyatniQoyish(state.joriyOyatIndex + 1, true);
    } else {
        state.avtomatikQoyish = false;
        state.joriyOyatIndex = -1;
        stickyYashirish();
    }
});

audio.addEventListener('timeupdate', () => {
    if (state.seeking) return;
    if (audio.duration > 0 && isFinite(audio.duration)) {
        progressniYangilash((audio.currentTime / audio.duration) * 100);
    }
    els.stickyTime.textContent = `${fmtTime(audio.currentTime)} / ${fmtTime(audio.duration)}`;
});

audio.addEventListener('loadedmetadata', () => {
    els.stickyTime.textContent = `${fmtTime(audio.currentTime)} / ${fmtTime(audio.duration)}`;
});

audio.addEventListener('play', stickyTogglenyYangilash);
audio.addEventListener('pause', stickyTogglenyYangilash);
audio.addEventListener('playing', stickyTogglenyYangilash);

const ERR_CODES = {
    1: 'ABORTED',
    2: 'NETWORK',
    3: 'DECODE',
    4: 'SRC_NOT_SUPPORTED',
};

audio.addEventListener('error', () => {
    if (!audio.src) return;
    const oyat = state.oyatlar[state.joriyOyatIndex];
    const fallbacks = oyat?.audioUrls || [];
    const nextIndex = (state.fallbackIndex ?? 0) + 1;
    if (nextIndex < fallbacks.length) {
        state.fallbackIndex = nextIndex;
        audio.src = fallbacks[nextIndex];
        audio.play().catch(() => {});
        return;
    }
    state.avtomatikQoyish = false;
    playingnyOlibTashlash();
    stickyYashirish();
    const code = audio.error?.code;
    const codeName = ERR_CODES[code] || `code ${code}`;
    xatolikniKorsatish(`Аудиони юклашда муаммо (${codeName}).`);
});

function oyatniQoyish(index, autoMode = false) {
    playingnyOlibTashlash();

    state.joriyOyatIndex = index;
    state.avtomatikQoyish = autoMode;
    state.fallbackIndex = 0;

    const oyat = state.oyatlar[index];
    if (!oyat) return;

    const yangiCard = document.getElementById(`ayat-${index}`);
    if (yangiCard) {
        yangiCard.classList.add('playing');
        yangiCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    const urls = oyat.audioUrls || [];
    if (urls.length === 0) {
        xatolikniKorsatish('Бу оят учун аудио манзил топилмади.');
        return;
    }

    stickyKorsatish(oyat);
    audio.src = urls[0];
    audio.play().catch(err => {
        xatolikniKorsatish('Аудиони қўйишда муаммо: ' + err.message);
    });
}

function hammasiniToxtatish() {
    state.avtomatikQoyish = false;
    audio.pause();
    playingnyOlibTashlash();
    state.joriyOyatIndex = -1;
    stickyYashirish();
}

function stickyToxtatishToggle() {
    if (audio.paused) {
        audio.play().catch(() => {});
    } else {
        audio.pause();
    }
}

function progressBoyichaQidirish(clientX) {
    if (!audio.duration || !isFinite(audio.duration)) return;
    const rect = els.stickyProgressTrack.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    audio.currentTime = pct * audio.duration;
    progressniYangilash(pct * 100);
    els.stickyTime.textContent = `${fmtTime(audio.currentTime)} / ${fmtTime(audio.duration)}`;
}

els.stickyProgressTrack.addEventListener('pointerdown', (e) => {
    state.seeking = true;
    els.stickyProgressTrack.setPointerCapture(e.pointerId);
    progressBoyichaQidirish(e.clientX);
});

els.stickyProgressTrack.addEventListener('pointermove', (e) => {
    if (!state.seeking) return;
    progressBoyichaQidirish(e.clientX);
});

els.stickyProgressTrack.addEventListener('pointerup', (e) => {
    state.seeking = false;
    els.stickyProgressTrack.releasePointerCapture(e.pointerId);
});

els.stickyProgressTrack.addEventListener('pointercancel', () => {
    state.seeking = false;
});

els.showBtn.addEventListener('click', betniKorsatish);
els.stickyToggleBtn.addEventListener('click', stickyToxtatishToggle);
els.stickyCloseBtn.addEventListener('click', hammasiniToxtatish);

function themaniYangilash() {
    const light = document.documentElement.classList.contains('light');
    els.themeToggleBtn.replaceChildren(icon(light ? 'sun' : 'moon'));
    els.themeToggleBtn.setAttribute('aria-label',
        light ? 'Қоронғи режимга ўтиш' : 'Ёруғ режимга ўтиш');
    const meta = document.getElementById('themeColorMeta');
    if (meta) meta.setAttribute('content', light ? '#fafbf9' : '#0c1410');
}

function themaniAlmashtirish() {
    const root = document.documentElement;
    const next = root.classList.contains('light') ? 'dark' : 'light';
    root.classList.remove('light', 'dark');
    root.classList.add(next);
    try { localStorage.setItem('theme', next); } catch (e) {}
    themaniYangilash();
}

themaniYangilash();
els.themeToggleBtn.addEventListener('click', themaniAlmashtirish);

els.pageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        betniKorsatish();
    }
});
