'use strict';

const PAGES_MIN = 1;
const PAGES_MAX = 604;
const API_BASE = 'https://api.alquran.cloud/v1/page';

function buildAudioUrls(suraRaqami, oyatRaqami) {
    const s = String(suraRaqami).padStart(3, '0');
    const a = String(oyatRaqami).padStart(3, '0');
    return [
        `https://everyayah.com/data/Ayman_Sowaid_64kbps/${s}${a}.mp3`,
        `https://www.everyayah.com/data/Ayman_Sowaid_64kbps/${s}${a}.mp3`,
        `https://everyayah.com/data/Husary_64kbps/${s}${a}.mp3`,
    ];
}

const state = {
    joriyBet: 0,
    oyatlar: [],
    joriyOyatIndex: -1,
    avtomatikQoyish: false,
    abortController: null,
    fallbackIndex: 0,
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
    stickyAudio: document.getElementById('stickyAudio'),
    stickyTitle: document.getElementById('stickyTitle'),
    stickyProgressBar: document.getElementById('stickyProgressBar'),
    stickyToggleBtn: document.getElementById('stickyToggleBtn'),
    stickyCloseBtn: document.getElementById('stickyCloseBtn'),
};

const audio = new Audio();
audio.preload = 'auto';

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

function stickyKorsatish(oyat) {
    els.stickyTitle.textContent = `${oyat.suraRaqami}:${oyat.oyatRaqami}-оят`;
    els.stickyProgressBar.style.width = '0%';
    els.stickyAudio.classList.add('visible');
}

function stickyYashirish() {
    els.stickyAudio.classList.remove('visible');
    els.stickyProgressBar.style.width = '0%';
}

function stickyTogglenyYangilash() {
    els.stickyToggleBtn.textContent = audio.paused ? '▶' : '⏸';
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
            suraNomi: oyat.surah.name,
            suraNomiEn: oyat.surah.englishName,
            audioUrls: buildAudioUrls(oyat.surah.number, oyat.numberInSurah),
        }));

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
            const num = document.createTextNode(`${oyat.suraRaqami}-сура`);
            const nameSpan = document.createElement('span');
            nameSpan.className = 'surah-name';
            nameSpan.textContent = oyat.suraNomi;
            const ornR = document.createElement('span');
            ornR.className = 'ornament';
            ornR.textContent = '✦';

            divider.appendChild(ornL);
            divider.appendChild(num);
            divider.appendChild(nameSpan);
            divider.appendChild(ornR);

            els.ayatlarRoyxati.appendChild(divider);
            oldingiSuraRaqami = oyat.suraRaqami;
        }

        const card = document.createElement('div');
        card.className = 'ayat-card';
        card.id = `ayat-${index}`;
        card.style.animationDelay = `${index * 40}ms`;

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
        playBtn.type = 'button';
        playBtn.textContent = '▶️ Эшитиш';
        playBtn.addEventListener('click', () => oyatniQoyish(index));
        const replayBtn = document.createElement('button');
        replayBtn.className = 'audio-btn btn-replay';
        replayBtn.type = 'button';
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
        stickyYashirish();
    }
});

audio.addEventListener('timeupdate', () => {
    if (audio.duration > 0 && isFinite(audio.duration)) {
        const pct = (audio.currentTime / audio.duration) * 100;
        els.stickyProgressBar.style.width = pct + '%';
    }
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
    stickyYashirish();
}

function stickyToxtatishToggle() {
    if (audio.paused) {
        audio.play().catch(() => {});
    } else {
        audio.pause();
    }
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
els.stickyToggleBtn.addEventListener('click', stickyToxtatishToggle);
els.stickyCloseBtn.addEventListener('click', hammasiniToxtatish);

els.pageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        betniKorsatish();
    }
});
