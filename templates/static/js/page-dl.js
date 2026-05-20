;(() => {
  if (!document.body.classList.contains('page-dl')) return;

/* ===== URL parsing ===== */
function parseVideoId(raw) {
  raw = raw.trim();
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /shorts\/([A-Za-z0-9_-]{11})/,
    /embed\/([A-Za-z0-9_-]{11})/,
    /\/watch\/([A-Za-z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (m) return m[1];
  }
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;
  return null;
}

/* ===== Stream format helpers ===== */
function getStreamExt(fmt) {
  if (fmt.container) return fmt.container.replace(/^m4a$/, 'mp4');
  if (fmt.type) {
    const m = fmt.type.match(/^(video|audio)\/(\w+)/);
    if (m) return m[2] === 'webm' ? 'webm' : 'mp4';
  }
  return 'mp4';
}

function getStreamCodecLabel(fmt) {
  const enc = (fmt.encoding || '').toLowerCase();
  if (enc.startsWith('av01') || enc.startsWith('av1')) return 'AV1';
  if (enc === 'vp9') return 'VP9';
  if (enc === 'h264' || enc === 'avc1') return 'H.264';
  if (enc === 'aac' || enc === 'mp4a') return 'AAC';
  if (enc === 'opus') return 'Opus';
  if (fmt.type) {
    const t = fmt.type.toLowerCase();
    if (t.includes('vp9')) return 'VP9';
    if (t.includes('av01') || t.includes('av1')) return 'AV1';
    if (t.includes('avc') || t.includes('h264')) return 'H.264';
    if (t.includes('opus')) return 'Opus';
    if (t.includes('aac') || t.includes('mp4a')) return 'AAC';
  }
  if (fmt.container === 'webm') return 'VP9';
  if (fmt.container === 'm4a' || fmt.container === 'mp4') return 'AAC';
  return enc || fmt.container || '';
}

/* ===== Thumbnail quality → ytimg key ===== */
const QUALITY_TO_YTIMG = {
  maxres: 'maxresdefault', maxresdefault: 'maxresdefault',
  sddefault: 'sddefault', sd: 'sddefault',
  high: 'hqdefault', hqdefault: 'hqdefault', hq: 'hqdefault',
  medium: 'mqdefault', mqdefault: 'mqdefault', mq: 'mqdefault',
  default: 'default',
  start: '1', middle: '2', end: '3',
};
function thumbDisplayUrl(videoId, qualityLabel) {
  const key = QUALITY_TO_YTIMG[qualityLabel] || qualityLabel || 'mqdefault';
  const ytUrl = `https://i.ytimg.com/vi/${videoId}/${key}.jpg`;
  return wsrv(ytUrl, 480);
}

/* ===== SVG icons ===== */
const COMBINED_ICON   = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="2" y="3" width="20" height="14" rx="2"/><polygon points="10 8 16 11 10 14 10 8" fill="currentColor" stroke="none"/><path d="M8 21h8M12 17v4"/></svg>`;
const VIDEO_ICON      = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="2" y="4" width="15" height="16" rx="2"/><path d="M17 8l5 4-5 4V8z"/></svg>`;
const AUDIO_ICON      = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
const THUMB_ICON      = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
const STORYBOARD_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="2" y="2" width="9" height="9" rx="1"/><rect x="13" y="2" width="9" height="9" rx="1"/><rect x="2" y="13" width="9" height="9" rx="1"/><rect x="13" y="13" width="9" height="9" rx="1"/></svg>`;
const DL_SVG          = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="14" height="14"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
const EXT_SVG         = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;

/* ===== Section builder ===== */
function makeSection(iconSvg, title, count) {
  const sec = document.createElement('div');
  sec.className = 'dls-section';
  const hdr = document.createElement('div');
  hdr.className = 'dls-section-header';
  hdr.innerHTML = `${iconSvg}<span class="dls-section-title">${escapeHtml(title)}</span><span class="dls-section-count">${count}件</span>`;
  const list = document.createElement('div');
  list.className = 'dls-list';
  sec.appendChild(hdr);
  sec.appendChild(list);
  return { sec, list };
}

function makeStreamRow(label, sublabel, url) {
  const row = document.createElement('div');
  row.className = 'dls-item';
  row.innerHTML = `
    <div class="dls-item-info">
      <span class="dls-item-label">${escapeHtml(label)}</span>
      ${sublabel ? `<span class="dls-item-sub">${escapeHtml(sublabel)}</span>` : ''}
    </div>
    <a class="dls-btn" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
      ${DL_SVG} リンクを開く
    </a>
  `;
  return row;
}

/* ===== Main renderer ===== */
function renderSections(videoId, streamData, meta) {
  const container = document.getElementById('dlSections');
  container.innerHTML = '';
  const safeTitle = (meta.title || videoId).replace(/[/\\?%*:|"<>]/g, '_').substring(0, 80);

  const formatStreams   = streamData.formatStreams   || [];
  const adaptiveFormats = streamData.adaptiveFormats || [];
  const videoFormats    = adaptiveFormats.filter(f => f.type && f.type.startsWith('video/'));
  const audioFormats    = adaptiveFormats.filter(f => f.type && f.type.startsWith('audio/'));

  /* ── 通常ストリーム ── */
  if (formatStreams.length > 0) {
    const preferred = ['1080p60','1080p','720p60','720p','480p','360p','240p','144p'];
    const sorted = [...formatStreams].sort((a, b) => {
      const ai = preferred.indexOf(a.qualityLabel), bi = preferred.indexOf(b.qualityLabel);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    const { sec, list } = makeSection(COMBINED_ICON, '通常ストリーム（映像＋音声）', sorted.length);
    sorted.forEach(fmt => {
      const quality = fmt.qualityLabel || fmt.quality || '?';
      const codec   = getStreamCodecLabel(fmt);
      const ext     = getStreamExt(fmt);
      list.appendChild(makeStreamRow(quality, `${codec ? codec + ' · ' : ''}${ext.toUpperCase()}`, fmt.url));
    });
    container.appendChild(sec);
  }

  /* ── 映像のみ ── */
  if (videoFormats.length > 0) {
    function videoHeight(f) {
      const n = parseInt(f.qualityLabel); if (n) return n;
      const m = (f.size || '').match(/x(\d+)/); return m ? parseInt(m[1]) : 0;
    }
    const CODEC_PREF = { 'H.264': 0, 'VP9': 1, 'AV1': 2 };
    const sortedV = [...videoFormats].sort((a, b) => {
      const hd = videoHeight(b) - videoHeight(a); if (hd !== 0) return hd;
      return (CODEC_PREF[getStreamCodecLabel(a)] ?? 9) - (CODEC_PREF[getStreamCodecLabel(b)] ?? 9);
    });
    const { sec, list } = makeSection(VIDEO_ICON, '映像のみ（音声なし）', sortedV.length);
    sortedV.forEach(fmt => {
      const fps     = fmt.fps ? ` ${fmt.fps}fps` : '';
      const quality = `${fmt.qualityLabel || '?'}${fps}`;
      const codec   = getStreamCodecLabel(fmt);
      const ext     = getStreamExt(fmt);
      list.appendChild(makeStreamRow(quality, `${codec ? codec + ' · ' : ''}${ext.toUpperCase()}`, fmt.url));
    });
    container.appendChild(sec);
  }

  /* ── 音声のみ ── */
  if (audioFormats.length > 0) {
    const sortedA = [...audioFormats].sort((a, b) => (parseInt(b.bitrate) || 0) - (parseInt(a.bitrate) || 0));
    const { sec, list } = makeSection(AUDIO_ICON, '音声のみ', sortedA.length);
    sortedA.forEach(fmt => {
      const kbps  = fmt.bitrate ? `${Math.round(parseInt(fmt.bitrate) / 1000)}kbps` : '?';
      const codec = getStreamCodecLabel(fmt);
      const ext   = getStreamExt(fmt);
      list.appendChild(makeStreamRow(kbps, `${codec ? codec + ' · ' : ''}${ext.toUpperCase()}`, fmt.url));
    });
    container.appendChild(sec);
  }

  /* ── サムネイル ── */
  const thumbDefaults = [
    { label: 'maxres', size: '1280×720', displayUrl: thumbDisplayUrl(videoId, 'maxres'), url: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`, key: 'maxresdefault' },
    { label: 'sd',     size: '640×480',  displayUrl: thumbDisplayUrl(videoId, 'sd'),     url: `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,     key: 'sddefault' },
    { label: 'hq',     size: '480×360',  displayUrl: thumbDisplayUrl(videoId, 'hq'),     url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,     key: 'hqdefault' },
    { label: 'mq',     size: '320×180',  displayUrl: thumbDisplayUrl(videoId, 'mq'),     url: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,     key: 'mqdefault' },
  ];

  let thumbList = thumbDefaults.map(t => ({
    ...t,
    proxyUrl: `/download?url=${encodeURIComponent(t.url)}&filename=${encodeURIComponent(safeTitle + '_thumb_' + t.key + '.jpg')}`
  }));

  if (meta.videoThumbnails && meta.videoThumbnails.length > 0) {
    const sorted = [...meta.videoThumbnails].sort((a, b) => (b.width || 0) - (a.width || 0));
    const seen = new Set();
    thumbList = [];
    sorted.forEach(t => {
      if (!t.url || seen.has(t.url)) return;
      seen.add(t.url);
      const w = t.width || '?'; const h = t.height || '?';
      const ql = (t.quality || '').toLowerCase();
      thumbList.push({
        label: t.quality || 'thumb',
        size: `${w}×${h}`,
        displayUrl: thumbDisplayUrl(videoId, ql),
        url: t.url,
        proxyUrl: `/download?url=${encodeURIComponent(t.url)}&filename=${encodeURIComponent(safeTitle + '_thumb_' + ql + '.jpg')}`
      });
    });
  }

  if (thumbList.length > 0) {
    const thumbSec = document.createElement('div');
    thumbSec.className = 'dls-section';
    thumbSec.innerHTML = `
      <div class="dls-section-header">
        ${THUMB_ICON}
        <span class="dls-section-title">サムネイル</span>
        <span class="dls-section-count">${thumbList.length}件</span>
      </div>
    `;
    const grid = document.createElement('div');
    grid.className = 'dls-thumb-grid';

    thumbList.forEach(t => {
      const card = document.createElement('div');
      card.className = 'dls-thumb-card';
      card.innerHTML = `
        <div class="dls-thumb-card-img">
          <div class="thumb-sk"></div>
          <img src="${escapeHtml(t.displayUrl)}" alt="${escapeHtml(t.label)}" loading="lazy"
            onload="this.classList.add('loaded');this.previousElementSibling.style.display='none'"
            onerror="this.previousElementSibling.style.display='none'" />
        </div>
        <div class="dls-thumb-card-body">
          <span class="dls-thumb-card-label">${escapeHtml(t.label)}</span>
          <span class="dls-thumb-card-sub">${escapeHtml(t.size)} · JPG</span>
          <a class="dls-thumb-card-btn" href="${escapeHtml(t.proxyUrl)}" target="_blank" rel="noopener noreferrer">
            ${DL_SVG} ダウンロード
          </a>
        </div>
      `;
      grid.appendChild(card);
    });

    thumbSec.appendChild(grid);
    container.appendChild(thumbSec);
  }

  /* ── ストーリーボード ── */
  const storyboards = meta.storyboards || streamData.storyboards || [];
  {
    const { sec, list } = makeSection(STORYBOARD_ICON, 'ストーリーボード', storyboards.length);
    if (storyboards.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'dls-item';
      empty.innerHTML = '<div class="dls-item-info"><span class="dls-item-sub">ストーリーボード情報はありません</span></div>';
      list.appendChild(empty);
    } else {
      storyboards.forEach((sb, i) => {
        const thumbW   = sb.width  || '?';
        const thumbH   = sb.height || '?';
        const cnt      = sb.count  || '?';
        const cols     = sb.storyboardWidth  || '';
        const rows     = sb.storyboardHeight || '';
        const sheetCnt = sb.storyboardCount  || 1;
        const interval = sb.interval ? `${(sb.interval / 1000).toFixed(1)}秒ごと` : '';
        const grid     = (cols && rows) ? `${cols}×${rows}グリッド` : '';
        const sub      = [
          `サムネ ${thumbW}×${thumbH}px`,
          cnt !== '?' ? `計${cnt}枚` : '',
          grid,
          interval,
        ].filter(Boolean).join(' · ');

        const templateUrl = sb.templateUrl || '';
        const isMultiSheet = templateUrl.includes('M$M');

        /* build per-sheet URLs */
        const sheetUrls = [];
        if (templateUrl) {
          if (isMultiSheet) {
            for (let s = 0; s < sheetCnt; s++) {
              sheetUrls.push(templateUrl.replace('M$M', `M${s}`));
            }
          } else {
            sheetUrls.push(templateUrl);
          }
        }

        /* header row */
        const header = document.createElement('div');
        header.className = 'dls-item';
        const sheetLabel = sheetCnt > 1 ? ` (${sheetCnt}枚のスプライトシート)` : '';
        header.innerHTML = `
          <div class="dls-item-info">
            <span class="dls-item-label">ストーリーボード ${i + 1}${escapeHtml(sheetLabel)}</span>
            ${sub ? `<span class="dls-item-sub">${escapeHtml(sub)}</span>` : ''}
          </div>
        `;
        list.appendChild(header);

        /* one download link per sheet */
        sheetUrls.forEach((sheetUrl, s) => {
          const sheetRow = document.createElement('div');
          sheetRow.className = 'dls-item dls-item-sheet';
          const label = sheetCnt > 1 ? `シート ${s + 1} / ${sheetCnt}` : 'スプライトシート';
          sheetRow.innerHTML = `
            <div class="dls-item-info">
              <span class="dls-item-sub">${escapeHtml(label)}</span>
            </div>
            <a class="dls-btn" href="${escapeHtml(sheetUrl)}" target="_blank" rel="noopener noreferrer"
               download>${EXT_SVG} 表示</a>
          `;
          list.appendChild(sheetRow);
        });

        if (sheetUrls.length === 0) {
          const noUrl = document.createElement('div');
          noUrl.className = 'dls-item dls-item-sheet';
          noUrl.innerHTML = '<div class="dls-item-info"><span class="dls-item-sub">URLが取得できませんでした</span></div>';
          list.appendChild(noUrl);
        }
      });
    }
    container.appendChild(sec);
  }

  if (container.children.length === 0) {
    container.innerHTML = '<p class="dl-no-streams">ダウンロード可能なストリームが見つかりませんでした。</p>';
  }
}

/* ===== Edu inline player ===== */
let currentVideoId    = null;
let currentStreamData = null;
let eduChoco2Param    = null;

async function fetchEduChoco2() {
  if (eduChoco2Param !== null) return eduChoco2Param;
  try {
    const res = await fetch('https://raw.githubusercontent.com/choco-1515/About-youtube/refs/heads/main/edu/key2.json');
    const json = await res.json();
    eduChoco2Param = json.value || '?autoplay=1';
  } catch {
    eduChoco2Param = '?autoplay=1';
  }
  return eduChoco2Param;
}

async function playEduInline(videoId) {
  const thumbEl  = document.getElementById('dlThumb');
  const overlay  = document.getElementById('dlPlayOverlay');
  const videoEl  = document.getElementById('dlInlineVideo');
  const iframeEl = document.getElementById('dlInlineIframe');

  const param = await fetchEduChoco2();
  thumbEl.setAttribute('hidden', '');
  overlay.style.display = 'none';
  videoEl.pause();
  videoEl.setAttribute('hidden', '');
  iframeEl.src = `https://www.youtubeeducation.com/embed/${videoId}${param}`;
  iframeEl.removeAttribute('hidden');
}

function initThumbPlay(videoId) {
  currentVideoId = videoId;
  const overlay = document.getElementById('dlPlayOverlay');
  const thumbEl = document.getElementById('dlThumb');

  const handler = (e) => {
    e.stopPropagation();
    playEduInline(videoId);
  };

  overlay.onclick = handler;
  thumbEl.onclick = handler;
  thumbEl.style.cursor = 'pointer';
}

/* ===== Main fetch ===== */
let currentFetch = null;

async function fetchAndRender(videoId) {
  if (currentFetch) currentFetch.cancelled = true;
  const ctx = { cancelled: false };
  currentFetch = ctx;

  const result   = document.getElementById('dlResult');
  const loading  = document.getElementById('dlLoading');
  const fetchErr = document.getElementById('dlFetchError');
  const sections = document.getElementById('dlSections');
  const infoSk   = document.getElementById('dlInfoSkeleton');
  const infoIn   = document.getElementById('dlInfoInner');
  const thumbEl  = document.getElementById('dlThumb');
  const thumbSk  = document.getElementById('dlThumbSkeleton');
  const btn      = document.getElementById('dlUrlBtn');

  btn.disabled = true;
  result.removeAttribute('hidden');
  loading.removeAttribute('hidden');
  fetchErr.setAttribute('hidden', '');
  sections.innerHTML = '';
  infoIn.setAttribute('hidden', '');
  infoSk.removeAttribute('hidden');
  thumbEl.setAttribute('hidden', '');
  thumbSk.style.display = '';

  document.getElementById('dlThumbActions').setAttribute('hidden', '');
  document.getElementById('dlWatchBtn').href = `/watch?v=${videoId}`;
  document.getElementById('dlYtLink').href   = `https://www.youtube.com/watch?v=${videoId}`;
  currentStreamData = null;

  const videoEl  = document.getElementById('dlInlineVideo');
  const iframeEl = document.getElementById('dlInlineIframe');
  const overlay  = document.getElementById('dlPlayOverlay');
  videoEl.pause();
  videoEl.src = '';
  videoEl.setAttribute('hidden', '');
  iframeEl.src = '';
  iframeEl.setAttribute('hidden', '');
  overlay.style.display = '';

  const thumbUrl = getThumbnailUrl(videoId);
  thumbEl.src = thumbUrl;
  thumbEl.style.cursor = '';
  thumbEl.removeAttribute('hidden');
  thumbEl.onload  = () => { thumbEl.classList.add('loaded'); thumbSk.style.display = 'none'; };
  thumbEl.onerror = () => { thumbSk.style.display = 'none'; };

  fetchEduChoco2();
  initThumbPlay(videoId);

  try {
    const [streamResult, videoResult] = await Promise.all([
      withRetry(() => fetchStream(`/api/stream/${videoId}`)),
      withRetry(() => fetchStream(`/api/videos/${videoId}`))
    ]);

    if (ctx.cancelled) return;

    const streamData = streamResult.data;
    const meta = videoResult.data;
    currentStreamData = streamData;
    document.title = `${meta.title || '動画'} のダウンロード - Inv-tube`;

    infoSk.setAttribute('hidden', '');
    infoIn.removeAttribute('hidden');
    document.getElementById('dlTitle').textContent   = meta.title  || '';
    document.getElementById('dlChannel').textContent = meta.author || '';

    const views = formatViews(meta.viewCount);
    const date  = meta.publishedText || '';
    document.getElementById('dlMeta').innerHTML = [views, date]
      .filter(Boolean)
      .map(p => `<span>${escapeHtml(p)}</span>`)
      .join('<span class="dl-meta-sep">·</span>');

    document.getElementById('dlThumbActions').removeAttribute('hidden');

    loading.setAttribute('hidden', '');
    renderSections(videoId, streamData, meta);

  } catch (e) {
    if (ctx.cancelled) return;
    loading.setAttribute('hidden', '');
    infoSk.setAttribute('hidden', '');
    document.getElementById('dlFetchErrorMsg').textContent = '情報の取得に失敗しました。別のインスタンスに切り替えてから再試行してください。';
    fetchErr.removeAttribute('hidden');
    console.error(e);
  } finally {
    if (!ctx.cancelled) btn.disabled = false;
  }
}

/* ===== Boot ===== */
document.addEventListener('DOMContentLoaded', () => {
  initHeaderSearch();

  const form  = document.getElementById('dlUrlForm');
  const input = document.getElementById('dlUrlInput');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const raw = input.value.trim();
    if (!raw) return;
    const videoId = parseVideoId(raw);
    if (!videoId) {
      showInputError('有効なYouTube URLまたは動画IDを入力してください。');
      return;
    }
    hideInputError();
    fetchAndRender(videoId);
  });

  input.addEventListener('input', () => {
    if (input.value.trim()) hideInputError();
  });

  const params = new URLSearchParams(location.search);
  const initId = params.get('v');
  if (initId) {
    input.value = `https://www.youtube.com/watch?v=${initId}`;
    fetchAndRender(initId);
  }
});

function showInputError(msg) {
  const el = document.getElementById('dlUrlError');
  el.textContent = msg;
  el.removeAttribute('hidden');
}
function hideInputError() {
  document.getElementById('dlUrlError').setAttribute('hidden', '');
}
})();
