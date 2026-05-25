import { Innertube, UniversalCache } from 'youtubei.js';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = 5000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let yt;

async function initInnertube() {
  yt = await Innertube.create({
    cache: new UniversalCache(false),
    generate_session_locally: true,
    gl: 'JP',
    hl: 'ja',
  });
  console.log('Innertube initialized');
}

function safeJson(obj) {
  try {
    return JSON.parse(JSON.stringify(obj, (key, value) => {
      if (typeof value === 'bigint') return value.toString();
      return value;
    }));
  } catch {
    return {};
  }
}

// ─── In-memory TTL cache ────────────────────────────────────────────────────
const _cache = new Map();
function cacheGet(key) {
  const e = _cache.get(key);
  if (!e) return null;
  if (Date.now() > e.exp) { _cache.delete(key); return null; }
  return e.data;
}
function cacheSet(key, data, ttlMs) { _cache.set(key, { data, exp: Date.now() + ttlMs }); }

// ─── Continuation store (search / comments) ────────────────────────────────
const _conts = new Map();
let _contSeq = 0;
function contStore(obj, ttlMs = 600_000) {
  const key = String(++_contSeq);
  _conts.set(key, { obj, exp: Date.now() + ttlMs });
  setTimeout(() => _conts.delete(key), ttlMs);
  return key;
}
function contGet(key) {
  const e = _conts.get(key);
  if (!e || Date.now() > e.exp) return null;
  return e.obj;
}

const ENDPOINTS = [
  {
    group: '一般',
    items: [
      { method: 'GET', path: '/home', desc: 'YouTubeホームフィード', example: '/home', noLogin: true },
      { method: 'GET', path: '/guide', desc: 'ナビゲーションガイド（サイドバー）', example: '/guide', noLogin: true },
      { method: 'GET', path: '/library', desc: 'ユーザーライブラリ（要ログイン）', example: '/library' },
      { method: 'GET', path: '/courses', desc: 'コース一覧（要ログイン）', example: '/courses' },
    ],
  },
  {
    group: '検索',
    items: [
      {
        method: 'GET', path: '/search', desc: '動画・チャンネル・プレイリストを検索',
        query: [
          { name: 'q', req: true, desc: '検索キーワード' },
          { name: 'type', req: false, desc: 'all / video / channel / playlist / movie (デフォルト: all)' },
        ],
        example: '/search?q=lofi+music&type=video', noLogin: true,
      },
      {
        method: 'GET', path: '/search/continue', desc: '検索結果の続きを取得',
        query: [{ name: 'key', req: true, desc: '/search の _contKey 値' }],
        example: '/search/continue?key=1', noLogin: true,
      },
      {
        method: 'GET', path: '/search/suggestions', desc: '検索サジェストを取得',
        query: [{ name: 'q', req: true, desc: '検索キーワード' }],
        example: '/search/suggestions?q=minecraft', noLogin: true,
      },
    ],
  },
  {
    group: '動画',
    items: [
      { method: 'GET', path: '/video/:videoId', desc: '動画の基本情報とチャンネルサムネイル', example: '/video/dQw4w9WgXcQ', noLogin: true },
      { method: 'GET', path: '/video/:videoId/info', desc: '動画のストリーミング情報・フォーマット一覧', example: '/video/dQw4w9WgXcQ/info', noLogin: true },
      { method: 'GET', path: '/video/:videoId/streaming', desc: '動画のストリーミングURLのみ', example: '/video/dQw4w9WgXcQ/streaming', noLogin: true },
      { method: 'GET', path: '/video/:videoId/comments', desc: '動画のコメント一覧（_contKey 付き）', example: '/video/dQw4w9WgXcQ/comments', noLogin: true },
      { method: 'GET', path: '/video/:videoId/related', desc: '関連動画', example: '/video/dQw4w9WgXcQ/related', noLogin: true },
      { method: 'GET', path: '/video/:videoId/captions', desc: '字幕・キャプション情報', example: '/video/dQw4w9WgXcQ/captions', noLogin: true },
      { method: 'GET', path: '/video/:videoId/transcript', desc: '文字起こし（トランスクリプト）', example: '/video/dQw4w9WgXcQ/transcript', noLogin: true },
    ],
  },
  {
    group: 'コメントページング',
    items: [
      {
        method: 'GET', path: '/comments/more', desc: 'コメントの続きを取得',
        query: [{ name: 'key', req: true, desc: '/video/:videoId/comments の _contKey 値' }],
        example: '/comments/more?key=2', noLogin: true,
      },
    ],
  },
  {
    group: 'ショート',
    items: [
      { method: 'GET', path: '/shorts/:videoId', desc: 'ショート動画の詳細情報', example: '/shorts/abc123', noLogin: true },
    ],
  },
  {
    group: 'チャンネル',
    items: [
      { method: 'GET', path: '/channel/:channelId', desc: 'チャンネルのホーム情報', example: '/channel/@MrBeast', noLogin: true },
      { method: 'GET', path: '/channel/:channelId/videos', desc: 'チャンネルの動画一覧', example: '/channel/@MrBeast/videos', noLogin: true },
      { method: 'GET', path: '/channel/:channelId/shorts', desc: 'チャンネルのショート一覧', example: '/channel/@MrBeast/shorts', noLogin: true },
      { method: 'GET', path: '/channel/:channelId/live', desc: 'チャンネルのライブ配信一覧', example: '/channel/@MrBeast/live', noLogin: true },
      { method: 'GET', path: '/channel/:channelId/playlists', desc: 'チャンネルのプレイリスト一覧', example: '/channel/@MrBeast/playlists', noLogin: true },
      { method: 'GET', path: '/channel/:channelId/community', desc: 'チャンネルのコミュニティ投稿', example: '/channel/@MrBeast/community', noLogin: true },
      { method: 'GET', path: '/channel/:channelId/members', desc: 'メンバーシップ情報', example: '/channel/@MrBeast/members', noLogin: true },
      { method: 'GET', path: '/channels-feed', desc: '購読チャンネル一覧フィード（要ログイン）', example: '/channels-feed' },
    ],
  },
  {
    group: 'プレイリスト',
    items: [
      { method: 'GET', path: '/playlist/:playlistId', desc: 'プレイリスト情報と動画一覧', example: '/playlist/PLbpi6ZahtOH6Ar_3GPy3workx59b-vZg1', noLogin: true },
      { method: 'GET', path: '/playlists', desc: 'ユーザーのプレイリスト一覧（要ログイン）', example: '/playlists' },
      {
        method: 'POST', path: '/playlist/create', desc: 'プレイリストを作成（要ログイン）',
        body: [
          { name: 'title', req: true, desc: 'プレイリスト名' },
          { name: 'videoIds', req: false, desc: '追加する動画IDの配列' },
          { name: 'privacy', req: false, desc: 'PUBLIC / UNLISTED / PRIVATE' },
        ],
        example: 'POST /playlist/create',
      },
      {
        method: 'DELETE', path: '/playlist/:playlistId', desc: 'プレイリストを削除（要ログイン）',
        example: 'DELETE /playlist/PLxxxxx',
      },
      {
        method: 'POST', path: '/playlist/:playlistId/videos/add', desc: 'プレイリストに動画を追加（要ログイン）',
        body: [{ name: 'videoIds', req: true, desc: '追加する動画IDの配列' }],
        example: 'POST /playlist/PLxxxxx/videos/add',
      },
      {
        method: 'POST', path: '/playlist/:playlistId/videos/remove', desc: 'プレイリストから動画を削除（要ログイン）',
        body: [{ name: 'videoIds', req: true, desc: '削除する動画IDの配列' }],
        example: 'POST /playlist/PLxxxxx/videos/remove',
      },
    ],
  },
  {
    group: 'トレンド・ハッシュタグ',
    items: [
      {
        method: 'GET', path: '/trending', desc: 'トレンド動画',
        query: [{ name: 'type', req: false, desc: 'default / music / gaming / movies' }],
        example: '/trending?type=gaming', noLogin: true,
      },
      { method: 'GET', path: '/hashtag/:tag', desc: 'ハッシュタグに関連する動画', example: '/hashtag/lofi', noLogin: true },
    ],
  },
  {
    group: '投稿・コメント',
    items: [
      { method: 'GET', path: '/post/:postId', desc: 'コミュニティ投稿を取得', example: '/post/UgkxxxxxPostId', noLogin: true },
      { method: 'GET', path: '/post/:postId/comments', desc: 'コミュニティ投稿のコメント', example: '/post/UgkxxxxxPostId/comments', noLogin: true },
      {
        method: 'POST', path: '/interact/comment', desc: '動画にコメントを投稿（要ログイン）',
        body: [
          { name: 'videoId', req: true, desc: '動画ID' },
          { name: 'text', req: true, desc: 'コメント内容' },
        ],
        example: 'POST /interact/comment',
      },
    ],
  },
  {
    group: 'インタラクション（要ログイン）',
    items: [
      {
        method: 'POST', path: '/interact/like', desc: '動画にいいね',
        body: [{ name: 'videoId', req: true, desc: '動画ID' }],
        example: 'POST /interact/like',
      },
      {
        method: 'POST', path: '/interact/dislike', desc: '動画に低評価',
        body: [{ name: 'videoId', req: true, desc: '動画ID' }],
        example: 'POST /interact/dislike',
      },
      {
        method: 'POST', path: '/interact/remove-rating', desc: '評価を取り消す',
        body: [{ name: 'videoId', req: true, desc: '動画ID' }],
        example: 'POST /interact/remove-rating',
      },
      {
        method: 'POST', path: '/interact/subscribe', desc: 'チャンネルを登録',
        body: [{ name: 'channelId', req: true, desc: 'チャンネルID' }],
        example: 'POST /interact/subscribe',
      },
      {
        method: 'POST', path: '/interact/unsubscribe', desc: 'チャンネル登録を解除',
        body: [{ name: 'channelId', req: true, desc: 'チャンネルID' }],
        example: 'POST /interact/unsubscribe',
      },
    ],
  },
  {
    group: 'ユーザー・アカウント（要ログイン）',
    items: [
      { method: 'GET', path: '/account/info', desc: 'アカウント情報', example: '/account/info' },
      { method: 'GET', path: '/account/settings', desc: 'アカウント設定', example: '/account/settings' },
      { method: 'GET', path: '/history', desc: '視聴履歴', example: '/history' },
      { method: 'GET', path: '/subscriptions', desc: '購読フィード', example: '/subscriptions' },
      { method: 'GET', path: '/notifications', desc: '通知一覧', example: '/notifications' },
      { method: 'GET', path: '/notifications/count', desc: '未読通知数', example: '/notifications/count' },
    ],
  },
  {
    group: 'YouTube Music',
    items: [
      {
        method: 'GET', path: '/music/search', desc: '楽曲・アルバム・アーティストを検索',
        query: [
          { name: 'q', req: true, desc: '検索キーワード' },
          { name: 'type', req: false, desc: 'all / song / video / album / playlist / artist' },
        ],
        example: '/music/search?q=billie+eilish&type=song', noLogin: true,
      },
      {
        method: 'GET', path: '/music/suggestions', desc: 'Music 検索サジェスト',
        query: [{ name: 'q', req: true, desc: '検索キーワード' }],
        example: '/music/suggestions?q=taylor', noLogin: true,
      },
      { method: 'GET', path: '/music/home', desc: 'Music ホームフィード', example: '/music/home', noLogin: true },
      { method: 'GET', path: '/music/trending', desc: 'Music トレンドチャート', example: '/music/trending', noLogin: true },
      { method: 'GET', path: '/music/explore', desc: 'Music 探索ページ', example: '/music/explore', noLogin: true },
      { method: 'GET', path: '/music/library', desc: 'Music ライブラリ（要ログイン）', example: '/music/library' },
      { method: 'GET', path: '/music/recap', desc: 'Music リキャップ（要ログイン）', example: '/music/recap' },
      { method: 'GET', path: '/music/artist/:artistId', desc: 'アーティスト情報', example: '/music/artist/UCxxxxxx', noLogin: true },
      { method: 'GET', path: '/music/album/:albumId', desc: 'アルバム情報', example: '/music/album/MPRExxxxxx', noLogin: true },
      { method: 'GET', path: '/music/playlist/:playlistId', desc: 'Music プレイリスト', example: '/music/playlist/PLxxxxxx', noLogin: true },
      { method: 'GET', path: '/music/lyrics/:videoId', desc: '歌詞を取得', example: '/music/lyrics/dQw4w9WgXcQ', noLogin: true },
      { method: 'GET', path: '/music/upnext/:videoId', desc: '次の曲情報', example: '/music/upnext/dQw4w9WgXcQ', noLogin: true },
      { method: 'GET', path: '/music/related/:videoId', desc: '関連楽曲', example: '/music/related/dQw4w9WgXcQ', noLogin: true },
    ],
  },
  {
    group: 'YouTube Kids',
    items: [
      {
        method: 'GET', path: '/kids/search', desc: '子供向けコンテンツを検索',
        query: [{ name: 'q', req: true, desc: '検索キーワード' }],
        example: '/kids/search?q=peppa+pig', noLogin: true,
      },
      { method: 'GET', path: '/kids/home', desc: 'Kids ホームフィード', example: '/kids/home', noLogin: true },
      { method: 'GET', path: '/kids/video/:videoId', desc: 'Kids 動画情報', example: '/kids/video/xxxxx', noLogin: true },
      { method: 'GET', path: '/kids/channel/:channelId', desc: 'Kids チャンネル情報', example: '/kids/channel/UCxxxxx', noLogin: true },
    ],
  },
  {
    group: 'ユーティリティ',
    items: [
      {
        method: 'GET', path: '/resolve', desc: 'YouTube URLを解析して情報取得',
        query: [{ name: 'url', req: true, desc: 'YouTube URL' }],
        example: '/resolve?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ', noLogin: true,
      },
    ],
  },
];

app.get('/docs', (req, res) => {
  const totalCount = ENDPOINTS.reduce((acc, g) => acc + g.items.length, 0);
  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>YouTube Innertube API</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0f0f0f; color: #e0e0e0; line-height: 1.6; }
    header { background: linear-gradient(135deg, #ff0000 0%, #cc0000 100%); padding: 40px 32px; }
    header h1 { font-size: 2.2rem; font-weight: 700; color: #fff; }
    header p { color: rgba(255,255,255,0.85); margin-top: 8px; font-size: 1.05rem; }
    .badges { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
    .badge { display: inline-block; background: rgba(255,255,255,0.2); border-radius: 20px; padding: 3px 14px; font-size: 0.8rem; color: #fff; font-weight: 500; }
    main { max-width: 1000px; margin: 0 auto; padding: 40px 24px; }
    .group-title { font-size: 1rem; font-weight: 700; color: #ff4444; text-transform: uppercase; letter-spacing: 0.12em; margin: 36px 0 14px; display: flex; align-items: center; gap: 10px; }
    .group-title::after { content: ''; flex: 1; height: 1px; background: #222; }
    .endpoint { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 10px; margin-bottom: 12px; overflow: hidden; transition: border-color 0.2s; }
    .endpoint:hover { border-color: #444; }
    .ep-header { display: flex; align-items: center; gap: 14px; padding: 14px 20px; cursor: default; }
    .method { font-weight: 700; font-size: 0.7rem; padding: 3px 9px; border-radius: 4px; flex-shrink: 0; letter-spacing: 0.05em; }
    .method.GET { background: #238636; color: #fff; }
    .method.POST { background: #1a6fb5; color: #fff; }
    .method.DELETE { background: #b62424; color: #fff; }
    .path { font-family: 'Courier New', monospace; font-size: 0.95rem; color: #58a6ff; flex-grow: 1; }
    .desc { color: #999; font-size: 0.85rem; text-align: right; }
    .ep-body { padding: 0 20px 14px; }
    .params-title { font-size: 0.75rem; text-transform: uppercase; color: #555; margin-top: 10px; margin-bottom: 6px; letter-spacing: 0.08em; }
    .param-row { display: flex; align-items: baseline; gap: 10px; font-size: 0.85rem; margin-bottom: 4px; }
    .param-name { font-family: monospace; color: #e3b341; min-width: 160px; }
    .param-req { color: #f85149; font-size: 0.72rem; min-width: 28px; }
    .param-opt { color: #58a6ff; font-size: 0.72rem; min-width: 28px; }
    .param-desc { color: #888; }
    .example { background: #0d1117; border: 1px solid #222; border-radius: 6px; padding: 8px 14px; margin-top: 10px; font-family: monospace; font-size: 0.83rem; color: #7ee787; }
    .example span { color: #555; font-size: 0.72rem; display: block; margin-bottom: 3px; }
    footer { text-align: center; color: #444; font-size: 0.85rem; padding: 40px 0; border-top: 1px solid #1a1a1a; margin-top: 40px; }
    .no-login-badge { background: #1a4731; color: #3fb950; font-size: 0.68rem; font-weight: 600; padding: 2px 7px; border-radius: 10px; border: 1px solid #2ea043; letter-spacing: 0.04em; flex-shrink: 0; }
    .login-badge { background: #2d1b1b; color: #f85149; font-size: 0.68rem; font-weight: 600; padding: 2px 7px; border-radius: 10px; border: 1px solid #6e2020; letter-spacing: 0.04em; flex-shrink: 0; }
    .free-section { background: #0d1f0d; border: 1px solid #2a4a2a; border-radius: 12px; padding: 24px 28px; margin-bottom: 40px; }
    .free-section h2 { color: #3fb950; font-size: 1rem; font-weight: 700; margin-bottom: 16px; display: flex; align-items: center; gap: 10px; }
    .free-section h2 span { font-size: 1.2rem; }
    .free-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 6px; }
    .free-item { display: flex; align-items: center; gap: 8px; background: #0f2a0f; border: 1px solid #1e3e1e; border-radius: 6px; padding: 7px 12px; }
    .free-item .f-method { font-size: 0.65rem; font-weight: 700; padding: 2px 6px; border-radius: 3px; flex-shrink: 0; }
    .free-item .f-method.GET { background: #238636; color: #fff; }
    .free-item .f-path { font-family: 'Courier New', monospace; font-size: 0.8rem; color: #79c0ff; }
    .free-item .f-desc { font-size: 0.75rem; color: #6e7681; margin-left: auto; text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }
  </style>
</head>
<body>
  <header>
    <h1>🎬 YouTube Innertube API</h1>
    <p>youtubei.js (Innertube) を使用した YouTube 非公式 REST API</p>
    <div class="badges">
      <span class="badge">v2.0.0</span>
      <span class="badge">${totalCount} エンドポイント</span>
      <span class="badge">youtubei.js v12</span>
    </div>
  </header>
  <main>
    <div class="free-section">
      <h2><span>✅</span> ログイン不要で使えるエンドポイント（${ENDPOINTS.flatMap(g => g.items).filter(ep => ep.noLogin).length} 件）</h2>
      <div class="free-grid">
        ${ENDPOINTS.flatMap(g => g.items).filter(ep => ep.noLogin).map(ep => `
        <div class="free-item">
          <span class="f-method ${ep.method}">${ep.method}</span>
          <span class="f-path">${ep.path}</span>
          <span class="f-desc">${ep.desc.replace(/（[^）]*）/g, '').trim()}</span>
        </div>`).join('')}
      </div>
    </div>

    ${ENDPOINTS.map(group => `
    <div class="group-title">${group.group}</div>
    ${group.items.map(ep => `
    <div class="endpoint">
      <div class="ep-header">
        <span class="method ${ep.method}">${ep.method}</span>
        <span class="path">${ep.path}</span>
        ${ep.noLogin ? '<span class="no-login-badge">ログイン不要</span>' : '<span class="login-badge">要ログイン</span>'}
        <span class="desc">${ep.desc}</span>
      </div>
      ${(ep.query || ep.body) ? `<div class="ep-body">
        ${ep.query ? `
        <div class="params-title">クエリパラメータ</div>
        ${ep.query.map(p => `
          <div class="param-row">
            <span class="param-name">?${p.name}</span>
            <span class="${p.req ? 'param-req' : 'param-opt'}">${p.req ? '必須' : '任意'}</span>
            <span class="param-desc">${p.desc}</span>
          </div>`).join('')}` : ''}
        ${ep.body ? `
        <div class="params-title">リクエストボディ (JSON)</div>
        ${ep.body.map(p => `
          <div class="param-row">
            <span class="param-name">${p.name}</span>
            <span class="${p.req ? 'param-req' : 'param-opt'}">${p.req ? '必須' : '任意'}</span>
            <span class="param-desc">${p.desc}</span>
          </div>`).join('')}` : ''}
        <div class="example"><span>例</span>${ep.example}</div>
      </div>` : `<div class="ep-body"><div class="example"><span>例</span>${ep.example}</div></div>`}
    </div>`).join('')}`).join('')}
  </main>
  <footer>Powered by <strong>youtubei.js</strong> (Innertube) &mdash; 非公式 API</footer>
</body>
</html>`;
  res.send(html);
});

app.get('/home', async (req, res) => {
  const ckey = 'home';
  const cached = cacheGet(ckey);
  if (cached) return res.json(cached);
  try {
    const data = safeJson(await yt.getHomeFeed());
    cacheSet(ckey, data, 5 * 60_000);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/guide', async (req, res) => {
  try { res.json(safeJson(await yt.getGuide())); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/library', async (req, res) => {
  try { res.json(safeJson(await yt.getLibrary())); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/courses', async (req, res) => {
  try { res.json(safeJson(await yt.getCourses())); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/search', async (req, res) => {
  const { q, type = 'all' } = req.query;
  if (!q) return res.status(400).json({ error: '"q" が必要です' });
  const ckey = `search:${q}:${type}`;
  const cached = cacheGet(ckey);
  if (cached) return res.json(cached);
  try {
    const filters = type !== 'all' ? { type } : {};
    const result = await yt.search(q, filters);
    const contKey = result.has_continuation ? contStore(result) : null;
    const data = { ...safeJson(result), _contKey: contKey };
    cacheSet(ckey, data, 5 * 60_000);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/search/continue', async (req, res) => {
  const { key } = req.query;
  if (!key) return res.status(400).json({ error: '"key" が必要です' });
  const prev = contGet(key);
  if (!prev) return res.status(410).json({ error: 'continuation 期限切れ、もう一度検索してください' });
  try {
    const result = await prev.getContinuation();
    const contKey = result.has_continuation ? contStore(result) : null;
    res.json({ ...safeJson(result), _contKey: contKey });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/search/suggestions', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: '"q" が必要です' });
  const ckey = `sug:${q}`;
  const cached = cacheGet(ckey);
  if (cached) return res.json(cached);
  try {
    const data = safeJson(await yt.getSearchSuggestions(q));
    cacheSet(ckey, data, 60 * 60_000);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/video/:videoId', async (req, res) => {
  const ckey = `video:${req.params.videoId}`;
  const cached = cacheGet(ckey);
  if (cached) return res.json(cached);
  try {
    const info = await yt.getInfo(req.params.videoId);
    const data = safeJson(info);
    const channelThumb = info.secondary_info?.owner?.author?.thumbnails?.[0]?.url || '';
    if (channelThumb) data._channelThumb = channelThumb;
    cacheSet(ckey, data, 10 * 60_000);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/video/:videoId/info', async (req, res) => {
  try { res.json(safeJson(await yt.getInfo(req.params.videoId))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/video/:videoId/streaming', async (req, res) => {
  try { res.json(safeJson(await yt.getStreamingData(req.params.videoId))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/video/:videoId/comments', async (req, res) => {
  try {
    const comments = await yt.getComments(req.params.videoId);
    const contKey = typeof comments.getContinuation === 'function' ? contStore(comments) : null;
    res.json({ ...safeJson(comments), _contKey: contKey });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/comments/more', async (req, res) => {
  const { key } = req.query;
  if (!key) return res.status(400).json({ error: '"key" が必要です' });
  const prev = contGet(key);
  if (!prev) return res.status(410).json({ error: 'continuation 期限切れです' });
  try {
    const result = await prev.getContinuation();
    const contKey = typeof result.getContinuation === 'function' ? contStore(result) : null;
    res.json({ ...safeJson(result), _contKey: contKey });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/video/:videoId/related', async (req, res) => {
  try {
    const info = await yt.getBasicInfo(req.params.videoId);
    res.json(safeJson({ related: info.watch_next_feed }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/video/:videoId/captions', async (req, res) => {
  try {
    const info = await yt.getBasicInfo(req.params.videoId);
    res.json(safeJson({ captions: info.captions }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/video/:videoId/transcript', async (req, res) => {
  try {
    const info = await yt.getInfo(req.params.videoId);
    const transcript = await info.getTranscript();
    res.json(safeJson(transcript));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/shorts/:videoId', async (req, res) => {
  try { res.json(safeJson(await yt.getShortsVideoInfo(req.params.videoId))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/channel/continue', async (req, res) => {
  const { key } = req.query;
  if (!key) return res.status(400).json({ error: '"key" が必要です' });
  const prev = contGet(key);
  if (!prev) return res.status(410).json({ error: 'continuation 期限切れです' });
  try {
    const result = await prev.getContinuation();
    const contKey = result.has_continuation ? contStore(result) : null;
    res.json({ ...safeJson(result), _contKey: contKey });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/channel/continue-raw', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: '"token" が必要です' });
  try {
    const response = await yt.actions.execute('browse', { continuation: token });
    const data = safeJson(response);
    let videos = [];
    let nextToken = null;
    const actions = data.on_response_received_actions || data.on_response_received_endpoints || [];
    for (const action of actions) {
      const items = (action.continuation_items)
        || (action.append_continuation_items_action && action.append_continuation_items_action.continuation_items)
        || [];
      for (const item of items) {
        if (!item) continue;
        if (item.type === 'RichItem' && item.content) {
          const c = item.content;
          if (c.content_type === 'VIDEO' && c.content_id) {
            const title = (c.metadata && c.metadata.title && c.metadata.title.text) || '';
            videos.push({ videoId: c.content_id, title });
          }
        }
        if (item.type === 'ContinuationItem') {
          nextToken = (item.endpoint && item.endpoint.payload && item.endpoint.payload.token) || null;
        }
      }
    }
    res.json({ videos, _rawContToken: nextToken });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/channel/:channelId', async (req, res) => {
  try { res.json(safeJson(await yt.getChannel(req.params.channelId))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/channel/:channelId/videos', async (req, res) => {
  try {
    const ch = await yt.getChannel(req.params.channelId);
    const result = await ch.getVideos();
    const contKey = result.has_continuation ? contStore(result) : null;
    res.json({ ...safeJson(result), _contKey: contKey });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/channel/:channelId/shorts', async (req, res) => {
  try {
    const ch = await yt.getChannel(req.params.channelId);
    const result = await ch.getShorts();
    const contKey = result.has_continuation ? contStore(result) : null;
    res.json({ ...safeJson(result), _contKey: contKey });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/channel/:channelId/live', async (req, res) => {
  try {
    const ch = await yt.getChannel(req.params.channelId);
    const result = await ch.getLiveStreams();
    const contKey = result.has_continuation ? contStore(result) : null;
    res.json({ ...safeJson(result), _contKey: contKey });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/channel/:channelId/playlists', async (req, res) => {
  try {
    const ch = await yt.getChannel(req.params.channelId);
    res.json(safeJson(await ch.getPlaylists()));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/channel/:channelId/community', async (req, res) => {
  try {
    const ch = await yt.getChannel(req.params.channelId);
    res.json(safeJson(await ch.getCommunityPosts()));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/channel/:channelId/members', async (req, res) => {
  try {
    const ch = await yt.getChannel(req.params.channelId);
    res.json(safeJson(await ch.getMemberships()));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/channels-feed', async (req, res) => {
  try { res.json(safeJson(await yt.getChannelsFeed())); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/playlist/:playlistId', async (req, res) => {
  try { res.json(safeJson(await yt.getPlaylist(req.params.playlistId))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/playlists', async (req, res) => {
  try { res.json(safeJson(await yt.getPlaylists())); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/playlist/create', async (req, res) => {
  const { title, videoIds, privacy } = req.body;
  if (!title) return res.status(400).json({ error: '"title" が必要です' });
  try {
    const result = await yt.playlist.create(title, videoIds || [], privacy || 'PUBLIC');
    res.json(safeJson(result));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/playlist/:playlistId', async (req, res) => {
  try {
    const result = await yt.playlist.delete(req.params.playlistId);
    res.json(safeJson(result));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/playlist/:playlistId/videos/add', async (req, res) => {
  const { videoIds } = req.body;
  if (!videoIds) return res.status(400).json({ error: '"videoIds" が必要です' });
  try {
    const result = await yt.playlist.addVideos(req.params.playlistId, videoIds);
    res.json(safeJson(result));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/playlist/:playlistId/videos/remove', async (req, res) => {
  const { videoIds } = req.body;
  if (!videoIds) return res.status(400).json({ error: '"videoIds" が必要です' });
  try {
    const result = await yt.playlist.removeVideos(req.params.playlistId, videoIds);
    res.json(safeJson(result));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/trending', async (req, res) => {
  const { type = 'default' } = req.query;
  const ckey = `trending:${type}`;
  const cached = cacheGet(ckey);
  if (cached) return res.json(cached);
  try {
    let results;
    switch (type) {
      case 'music':
        results = await yt.music.getCharts();
        break;
      case 'gaming':
        results = await yt.search('ゲーム 急上昇', { type: 'video' });
        break;
      case 'movies':
        results = await yt.search('映画 予告編 2025', { type: 'video' });
        break;
      default:
        results = await yt.search('急上昇 日本', { type: 'video' });
        break;
    }
    const data = safeJson(results);
    cacheSet(ckey, data, 10 * 60_000);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/hashtag/:tag', async (req, res) => {
  try { res.json(safeJson(await yt.getHashtag(req.params.tag))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/post/:postId', async (req, res) => {
  try { res.json(safeJson(await yt.getPost(req.params.postId))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/post/:postId/comments', async (req, res) => {
  try {
    const post = await yt.getPost(req.params.postId);
    res.json(safeJson(await yt.getPostComments(post)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/interact/comment', async (req, res) => {
  const { videoId, text } = req.body;
  if (!videoId || !text) return res.status(400).json({ error: '"videoId" と "text" が必要です' });
  try {
    const info = await yt.getInfo(videoId);
    const result = await yt.interact.comment(info, { text });
    res.json(safeJson(result));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/interact/like', async (req, res) => {
  const { videoId } = req.body;
  if (!videoId) return res.status(400).json({ error: '"videoId" が必要です' });
  try {
    const info = await yt.getBasicInfo(videoId);
    res.json(safeJson(await yt.interact.like(info)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/interact/dislike', async (req, res) => {
  const { videoId } = req.body;
  if (!videoId) return res.status(400).json({ error: '"videoId" が必要です' });
  try {
    const info = await yt.getBasicInfo(videoId);
    res.json(safeJson(await yt.interact.dislike(info)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/interact/remove-rating', async (req, res) => {
  const { videoId } = req.body;
  if (!videoId) return res.status(400).json({ error: '"videoId" が必要です' });
  try {
    const info = await yt.getBasicInfo(videoId);
    res.json(safeJson(await yt.interact.removeRating(info)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/interact/subscribe', async (req, res) => {
  const { channelId } = req.body;
  if (!channelId) return res.status(400).json({ error: '"channelId" が必要です' });
  try {
    const ch = await yt.getChannel(channelId);
    res.json(safeJson(await yt.interact.subscribe(ch)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/interact/unsubscribe', async (req, res) => {
  const { channelId } = req.body;
  if (!channelId) return res.status(400).json({ error: '"channelId" が必要です' });
  try {
    const ch = await yt.getChannel(channelId);
    res.json(safeJson(await yt.interact.unsubscribe(ch)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/account/info', async (req, res) => {
  try { res.json(safeJson(await yt.account.getInfo())); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/account/settings', async (req, res) => {
  try { res.json(safeJson(await yt.account.getSettings())); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/history', async (req, res) => {
  try { res.json(safeJson(await yt.getHistory())); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/subscriptions', async (req, res) => {
  try { res.json(safeJson(await yt.getSubscriptionsFeed())); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/notifications', async (req, res) => {
  try { res.json(safeJson(await yt.getNotifications())); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/notifications/count', async (req, res) => {
  try { res.json(safeJson({ count: await yt.getUnseenNotificationsCount() })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/music/search', async (req, res) => {
  const { q, type = 'all' } = req.query;
  if (!q) return res.status(400).json({ error: '"q" が必要です' });
  try {
    const filters = type !== 'all' ? { type } : {};
    res.json(safeJson(await yt.music.search(q, filters)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/music/suggestions', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: '"q" が必要です' });
  try { res.json(safeJson(await yt.music.getSearchSuggestions(q))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/music/home', async (req, res) => {
  try { res.json(safeJson(await yt.music.getHomeFeed())); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/music/trending', async (req, res) => {
  try { res.json(safeJson(await yt.music.getCharts())); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/music/explore', async (req, res) => {
  try { res.json(safeJson(await yt.music.getExplore())); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/music/library', async (req, res) => {
  try { res.json(safeJson(await yt.music.getLibrary())); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/music/recap', async (req, res) => {
  try { res.json(safeJson(await yt.music.getRecap())); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/music/artist/:artistId', async (req, res) => {
  try { res.json(safeJson(await yt.music.getArtist(req.params.artistId))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/music/album/:albumId', async (req, res) => {
  try { res.json(safeJson(await yt.music.getAlbum(req.params.albumId))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/music/playlist/:playlistId', async (req, res) => {
  try { res.json(safeJson(await yt.music.getPlaylist(req.params.playlistId))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/music/lyrics/:videoId', async (req, res) => {
  try {
    const info = await yt.music.getInfo(req.params.videoId);
    const lyrics = await info.getLyrics();
    res.json(safeJson(lyrics));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/music/upnext/:videoId', async (req, res) => {
  try {
    const info = await yt.music.getInfo(req.params.videoId);
    const upnext = await info.getUpNext();
    res.json(safeJson(upnext));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/music/related/:videoId', async (req, res) => {
  try {
    const info = await yt.music.getInfo(req.params.videoId);
    const related = await info.getRelated();
    res.json(safeJson(related));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/kids/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: '"q" が必要です' });
  try { res.json(safeJson(await yt.kids.search(q))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/kids/home', async (req, res) => {
  try { res.json(safeJson(await yt.kids.getHomeFeed())); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/kids/video/:videoId', async (req, res) => {
  try { res.json(safeJson(await yt.kids.getInfo(req.params.videoId))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/kids/channel/:channelId', async (req, res) => {
  try { res.json(safeJson(await yt.kids.getChannel(req.params.channelId))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/resolve', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: '"url" が必要です' });
  try { res.json(safeJson(await yt.resolveURL(url))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

initInnertube().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`YouTube Innertube API サーバー起動: http://0.0.0.0:${PORT}`);
  });
}).catch(err => {
  console.error('Innertube 初期化失敗:', err);
  process.exit(1);
});
