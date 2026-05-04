'use strict';

const PAGES_MIN = 1;
const PAGES_MAX = 604;
const API_BASE = 'https://api.alquran.cloud/v1/page';

const state = {
    joriyBet: 0,
    oyatlar: [],
    joriyOyatIndex: -1,
    avtomatikQoyish: false,
    abortController: null,
};

const els = {
    pageInput: document.getElementById('pageInput'),
    showBtn: document.getElementById('showBtn'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    loadingDiv: document.getElementById('loadingDiv'),
    errorDiv: document.getElementById('errorDiv'),
    resultSection: document.getElementById('resultSection'),
    pageInfo: document.getElementById('pageInfo'),
    ayatlarRoyxati: document.getElementById('ayatlarRoyxati'),
    playAllBtn: document.getElementById('playAllBtn'),
    pauseAllBtn: document.getElementById('pauseAllBtn'),
    debugInfo: document.getElementById('debugInfo'),
    debugLog: document.getElementById('debugLog'),
};

const audio = new Audio();
audio.preload = 'auto';
audio.volume = 1.0;
audio.muted = false;

function debugLog(msg, kind = '') {
    if (!els.debugLog) return;
    const line = document.createElement('div');
    line.className = 'log-line' + (kind ? ' ' + kind : '');
    const time = new Date().toLocaleTimeString();
    line.textContent = `[${time}] ${msg}`;
    els.debugLog.appendChild(line);
    while (els.debugLog.children.length > 30) {
        els.debugLog.removeChild(els.debugLog.firstChild);
    }
    els.debugLog.scrollTop = els.debugLog.scrollHeight;
}

function debugInfo(msg) {
    if (els.debugInfo) els.debugInfo.textContent = msg;
}

[
    'loadstart', 'loadedmetadata', 'loadeddata', 'canplay', 'canplaythrough',
    'play', 'playing', 'pause', 'ended', 'stalled', 'suspend', 'waiting',
    'abort', 'emptied',
].forEach(evt => {
    audio.addEventListener(evt, () => {
        const dur = isFinite(audio.duration) ? audio.duration.toFixed(2) + 's' : '?';
        debugLog(`${evt} (duration=${dur}, currentTime=${audio.currentTime.toFixed(2)}s)`);
    });
});

function xatolikniKorsatish(xabar) {
    els.errorDiv.textContent = '❌ ' + xabar;
    els.errorDiv.style.display = 'block';
    els.loadingDiv.style.display = 'none';
}

function xatolikniYashirish() {
    els.errorDiv.style.display = 'none';
}

function playingnyOlibTashlash() {
    const oldCard = document.getElementById(`ayat-${state.joriyOyatIndex}`);
    if (oldCard) oldCard.classList.remove('playing');
}

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
    els.showBtn.textContent = '⏳ Юкланмоқда...';

    try {
        const matnURL = `${API_BASE}/${betRaqami}/quran-uthmani`;
        const audioURL = `${API_BASE}/${betRaqami}/ar.aymanswaid`;

        const [matnResponse, audioResponse] = await Promise.all([
            fetch(matnURL, { signal }),
            fetch(audioURL, { signal }),
        ]);

        if (!matnResponse.ok || !audioResponse.ok) {
            throw new Error(`API status: ${matnResponse.status}/${audioResponse.status}`);
        }

        const matnData = await matnResponse.json();
        const audioData = await audioResponse.json();

        if (
            matnData.code !== 200 ||
            audioData.code !== 200 ||
            !Array.isArray(matnData.data?.ayahs) ||
            !Array.isArray(audioData.data?.ayahs) ||
            matnData.data.ayahs.length !== audioData.data.ayahs.length
        ) {
            throw new Error('API дан хато қайтди');
        }

        state.joriyBet = betRaqami;
        state.oyatlar = matnData.data.ayahs.map((oyat, index) => {
            const a = audioData.data.ayahs[index];
            const primary = (a?.audio || '').replace(/^http:/, 'https:');
            const secondary = Array.isArray(a?.audioSecondary)
                ? a.audioSecondary.map(u => u.replace(/^http:/, 'https:'))
                : [];
            return {
                matn: oyat.text,
                oyatRaqami: oyat.numberInSurah,
                suraRaqami: oyat.surah.number,
                suraNomi: oyat.surah.name,
                suraNomiEn: oyat.surah.englishName,
                audioUrls: [primary, ...secondary].filter(Boolean),
            };
        });

        betniRender();

        els.loadingDiv.style.display = 'none';
        els.resultSection.classList.add('active');
        els.prevBtn.disabled = (betRaqami <= PAGES_MIN);
        els.nextBtn.disabled = (betRaqami >= PAGES_MAX);
    } catch (error) {
        if (error.name === 'AbortError') {
            return;
        }
        xatolikniKorsatish('Маълумотларни юклашда хатолик: ' + error.message + '. Интернет уланишини текширинг.');
    } finally {
        els.showBtn.disabled = false;
        els.showBtn.textContent = '🔊 Бетни Кўрсатиш';
    }
}

function betniRender() {
    els.pageInfo.textContent = `📄 ${state.joriyBet}-бет`;
    els.ayatlarRoyxati.replaceChildren();

    let oldingiSuraRaqami = -1;

    state.oyatlar.forEach((oyat, index) => {
        if (oyat.suraRaqami !== oldingiSuraRaqami) {
            const divider = document.createElement('div');
            divider.className = 'surah-divider';
            divider.appendChild(document.createTextNode(`📿 ${oyat.suraRaqami}-сура: `));
            const nameSpan = document.createElement('span');
            nameSpan.className = 'surah-name';
            nameSpan.textContent = oyat.suraNomi;
            divider.appendChild(nameSpan);
            els.ayatlarRoyxati.appendChild(divider);
            oldingiSuraRaqami = oyat.suraRaqami;
        }

        const card = document.createElement('div');
        card.className = 'ayat-card';
        card.id = `ayat-${index}`;

        const header = document.createElement('div');
        header.className = 'ayat-header';
        const info = document.createElement('span');
        info.className = 'ayat-info';
        info.textContent = `${oyat.suraRaqami}:${oyat.oyatRaqami}-оят`;
        const num = document.createElement('span');
        num.className = 'ayat-number';
        num.textContent = oyat.oyatRaqami;
        header.appendChild(info);
        header.appendChild(num);

        const arabic = document.createElement('div');
        arabic.className = 'arabic-text';
        arabic.textContent = oyat.matn;

        const controls = document.createElement('div');
        controls.className = 'ayat-controls';
        const playBtn = document.createElement('button');
        playBtn.className = 'audio-btn btn-play';
        playBtn.textContent = '▶️ Эшитиш';
        playBtn.addEventListener('click', () => oyatniQoyish(index));
        const replayBtn = document.createElement('button');
        replayBtn.className = 'audio-btn btn-replay';
        replayBtn.textContent = '🔄 Қайта эшитиш';
        replayBtn.addEventListener('click', () => oyatniQaytaQoyish(index));
        controls.appendChild(playBtn);
        controls.appendChild(replayBtn);

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
    }
});

const ERR_CODES = {
    1: 'ABORTED',
    2: 'NETWORK',
    3: 'DECODE',
    4: 'SRC_NOT_SUPPORTED',
};

audio.addEventListener('error', () => {
    if (!audio.src) return;
    const code = audio.error?.code;
    const codeName = ERR_CODES[code] || `code ${code}`;
    debugLog(`✗ error event: ${codeName}`, 'warn');
    const oyat = state.oyatlar[state.joriyOyatIndex];
    const fallbacks = oyat?.audioUrls || [];
    const nextIndex = (state.fallbackIndex ?? 0) + 1;
    if (nextIndex < fallbacks.length) {
        state.fallbackIndex = nextIndex;
        debugInfo(`URL (fallback ${nextIndex}): ${fallbacks[nextIndex]}`);
        debugLog(`↻ trying fallback ${nextIndex}`, 'warn');
        audio.src = fallbacks[nextIndex];
        audio.play().catch(() => {});
        return;
    }
    state.avtomatikQoyish = false;
    playingnyOlibTashlash();
    xatolikniKorsatish(`Аудиони юклашда муаммо (${codeName}). URL: ${audio.src}`);
});

function oyatniQoyish(index, autoMode = false) {
    playingnyOlibTashlash();

    state.joriyOyatIndex = index;
    state.avtomatikQoyish = autoMode;
    state.fallbackIndex = 0;

    const yangiCard = document.getElementById(`ayat-${index}`);
    if (yangiCard) {
        yangiCard.classList.add('playing');
        yangiCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    const urls = state.oyatlar[index]?.audioUrls || [];
    if (urls.length === 0) {
        xatolikniKorsatish('Бу оят учун аудио манзил топилмади.');
        return;
    }

    debugInfo(`URL: ${urls[0]}`);
    debugLog(`▶ Set src for ayah ${index}`, 'ok');
    audio.src = urls[0];
    audio.play().then(() => {
        debugLog(`✓ play() resolved (volume=${audio.volume}, muted=${audio.muted}, paused=${audio.paused})`, 'ok');
    }).catch(err => {
        debugLog(`✗ play() rejected: ${err.name} - ${err.message}`, 'warn');
        xatolikniKorsatish('Аудиони қўйишда муаммо: ' + err.message + ' — ' + audio.src);
    });
}

function oyatniQaytaQoyish(index) {
    state.avtomatikQoyish = false;
    oyatniQoyish(index, false);
}

function hammasiniQoyish() {
    if (state.oyatlar.length > 0) {
        oyatniQoyish(0, true);
    }
}

function hammasiniToxtatish() {
    state.avtomatikQoyish = false;
    audio.pause();
    playingnyOlibTashlash();
    state.joriyOyatIndex = -1;
}

function oldingiBet() {
    if (state.joriyBet > PAGES_MIN) {
        els.pageInput.value = state.joriyBet - 1;
        betniKorsatish();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function keyingiBet() {
    if (state.joriyBet < PAGES_MAX) {
        els.pageInput.value = state.joriyBet + 1;
        betniKorsatish();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

els.showBtn.addEventListener('click', betniKorsatish);
els.prevBtn.addEventListener('click', oldingiBet);
els.nextBtn.addEventListener('click', keyingiBet);
els.playAllBtn.addEventListener('click', hammasiniQoyish);
els.pauseAllBtn.addEventListener('click', hammasiniToxtatish);

els.pageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        betniKorsatish();
    }
});
