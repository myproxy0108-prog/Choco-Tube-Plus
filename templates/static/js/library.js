/* ===== LIBRARY: Subscriptions & History ===== */

const LIB_SUBS_KEY = 'invtube_subs';
const LIB_HIST_KEY = 'invtube_history';
const LIB_HIST_MAX = 1000;

const SEARCH_HIST_KEY = 'invtube_search_history';
const SEARCH_HIST_MAX = 20;

function getSearchHistory() {
  try { return JSON.parse(localStorage.getItem(SEARCH_HIST_KEY) || '[]'); } catch { return []; }
}

function addSearchHistory(q) {
  if (!q || !q.trim()) return;
  const term = q.trim();
  let hist = getSearchHistory().filter(h => h !== term);
  hist.unshift(term);
  if (hist.length > SEARCH_HIST_MAX) hist.length = SEARCH_HIST_MAX;
  localStorage.setItem(SEARCH_HIST_KEY, JSON.stringify(hist));
}

function clearSearchHistory() {
  localStorage.removeItem(SEARCH_HIST_KEY);
}

function getSubscriptions() {
  try { return JSON.parse(localStorage.getItem(LIB_SUBS_KEY) || '[]'); } catch { return []; }
}

function isSubscribed(authorId) {
  return getSubscriptions().some(s => s.authorId === authorId);
}

function toggleSubscription(channel) {
  const subs = getSubscriptions();
  const idx = subs.findIndex(s => s.authorId === channel.authorId);
  if (idx >= 0) {
    subs.splice(idx, 1);
    localStorage.setItem(LIB_SUBS_KEY, JSON.stringify(subs));
    return false;
  } else {
    subs.unshift({ ...channel, subscribedAt: Date.now() });
    localStorage.setItem(LIB_SUBS_KEY, JSON.stringify(subs));
    return true;
  }
}

function getHistory() {
  try { return JSON.parse(localStorage.getItem(LIB_HIST_KEY) || '[]'); } catch { return []; }
}

function addHistory(video) {
  const hist = getHistory().filter(h => h.videoId !== video.videoId);
  hist.unshift({ ...video, watchedAt: Date.now() });
  if (hist.length > LIB_HIST_MAX) hist.length = LIB_HIST_MAX;
  localStorage.setItem(LIB_HIST_KEY, JSON.stringify(hist));
}

function clearHistory() {
  localStorage.removeItem(LIB_HIST_KEY);
}

function exportLibrary() {
  const payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    subscriptions: getSubscriptions(),
    history: getHistory(),
    playlists: getPlaylists(),
    favorites: getFavorites()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `invtube-library-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importLibrary(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.subscriptions && Array.isArray(data.subscriptions)) {
          const existing = getSubscriptions();
          const merged = [...data.subscriptions];
          existing.forEach(s => { if (!merged.find(m => m.authorId === s.authorId)) merged.push(s); });
          localStorage.setItem(LIB_SUBS_KEY, JSON.stringify(merged));
        }
        if (data.history && Array.isArray(data.history)) {
          const existing = getHistory();
          const ids = new Set(data.history.map(h => h.videoId));
          const merged = [...data.history, ...existing.filter(h => !ids.has(h.videoId))];
          merged.sort((a, b) => (b.watchedAt || 0) - (a.watchedAt || 0));
          if (merged.length > LIB_HIST_MAX) merged.length = LIB_HIST_MAX;
          localStorage.setItem(LIB_HIST_KEY, JSON.stringify(merged));
        }
        if (data.playlists && Array.isArray(data.playlists)) {
          const existing = getPlaylists();
          const ids = new Set(existing.map(p => p.id));
          const merged = [...existing, ...data.playlists.filter(p => !ids.has(p.id))];
          localStorage.setItem(LIB_PL_KEY, JSON.stringify(merged));
        }
        if (data.favorites && Array.isArray(data.favorites)) {
          const existing = getFavorites();
          const ids = new Set(existing.map(v => v.videoId));
          const merged = [...existing, ...data.favorites.filter(v => !ids.has(v.videoId))];
          localStorage.setItem(LIB_FAV_KEY, JSON.stringify(merged));
        }
        resolve();
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

/* ===== FAVORITES ===== */

const LIB_FAV_KEY = 'invtube_favorites';

function getFavorites() {
  try { return JSON.parse(localStorage.getItem(LIB_FAV_KEY) || '[]'); } catch { return []; }
}

function isFavorite(videoId) {
  return getFavorites().some(v => v.videoId === videoId);
}

function toggleFavorite(video) {
  const favs = getFavorites();
  const idx = favs.findIndex(v => v.videoId === video.videoId);
  if (idx >= 0) {
    favs.splice(idx, 1);
    localStorage.setItem(LIB_FAV_KEY, JSON.stringify(favs));
    return false;
  } else {
    favs.unshift({ ...video, favoritedAt: Date.now() });
    localStorage.setItem(LIB_FAV_KEY, JSON.stringify(favs));
    return true;
  }
}

function removeFavorite(videoId) {
  const favs = getFavorites().filter(v => v.videoId !== videoId);
  localStorage.setItem(LIB_FAV_KEY, JSON.stringify(favs));
}

/* ===== SETTINGS ===== */

const LIB_SETTINGS_KEY = 'invtube_settings';

function getSettings() {
  const defaults = { defaultSpeed: 1, loop: false, autoplayNext: false, defaultVolume: 100 };
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(LIB_SETTINGS_KEY) || '{}') }; }
  catch { return defaults; }
}

function saveSettings(s) {
  localStorage.setItem(LIB_SETTINGS_KEY, JSON.stringify(s));
}

/* ===== PLAYLISTS ===== */

const LIB_PL_KEY = 'invtube_playlists';

function getPlaylists() {
  try { return JSON.parse(localStorage.getItem(LIB_PL_KEY) || '[]'); } catch { return []; }
}

function getPlaylist(id) {
  return getPlaylists().find(p => p.id === id) || null;
}

function savePlaylists(pls) {
  localStorage.setItem(LIB_PL_KEY, JSON.stringify(pls));
}

function createPlaylist(name) {
  const pl = { id: 'pl_' + Date.now(), name: name.trim(), createdAt: Date.now(), videos: [] };
  const pls = getPlaylists();
  pls.unshift(pl);
  savePlaylists(pls);
  return pl;
}

function deletePlaylist(id) {
  savePlaylists(getPlaylists().filter(p => p.id !== id));
}

function renamePlaylist(id, name) {
  const pls = getPlaylists();
  const pl = pls.find(p => p.id === id);
  if (pl) { pl.name = name.trim(); savePlaylists(pls); }
}

function addVideoToPlaylist(id, video) {
  const pls = getPlaylists();
  const pl = pls.find(p => p.id === id);
  if (!pl) return;
  if (pl.videos.some(v => v.videoId === video.videoId)) return;
  pl.videos.push({ ...video, addedAt: Date.now() });
  savePlaylists(pls);
}

function removeVideoFromPlaylist(playlistId, videoId) {
  const pls = getPlaylists();
  const pl = pls.find(p => p.id === playlistId);
  if (!pl) return;
  pl.videos = pl.videos.filter(v => v.videoId !== videoId);
  savePlaylists(pls);
}

function isVideoInPlaylist(playlistId, videoId) {
  const pl = getPlaylist(playlistId);
  return pl ? pl.videos.some(v => v.videoId === videoId) : false;
}

function getPlaylistsContaining(videoId) {
  return getPlaylists().filter(p => p.videos.some(v => v.videoId === videoId)).map(p => p.id);
}

/**
 * header-search.js
 * 全ページ共通のヘッダー検索ボックス（サジェスト付き）を初期化する。
 *
 * 使い方:
 *   initHeaderSearch();                          // 選択時に /search?q=... へ遷移
 *   initHeaderSearch({ onSubmit: (q) => ... });  // コールバックでカスタム動作
 */
