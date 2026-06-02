;(() => {
  if (!document.body.classList.contains('page-hashtag')) return;
const params = new URLSearchParams(location.search);
const tag = params.get('tag') || '';
let currentPage = parseInt(params.get('page') || '1', 10);
let isLoading = false;

document.addEventListener('DOMContentLoaded', () => {
  initHeaderSearch();
  if (!tag) {
    document.getElementById('resultGrid').innerHTML =
      `<div class="error-state"><div class="error-icon">⚠️</div><p>ハッシュタグが指定されていません。</p></div>`;
    return;
  }
  document.title = `#${tag} — Choco-tube-plus`;
  const header = document.getElementById('resultHeader');
  document.getElementById('resultInfo').innerHTML =
    `<strong style="font-size:1.2rem;">#${escapeHtml(tag)}</strong>`;
  header.hidden = false;
  loadHashtag();
  bindPagination();
});

function buildApiUrl() {
  const p = new URLSearchParams({ page: currentPage });
  return `/api/hashtag/${encodeURIComponent(tag)}?${p}`;
}

function pushState() {
  const p = new URLSearchParams({ tag });
  if (currentPage > 1) p.set('page', currentPage);
  history.pushState(null, '', `/hashtag?${p}`);
}

async function loadHashtag() {
  if (isLoading) return;
  isLoading = true;

  const grid = document.getElementById('resultGrid');
  const pagination = document.getElementById('pagination');
  grid.innerHTML = '';
  pagination.hidden = true;
  for (let i = 0; i < 20; i++) grid.appendChild(createSkeletonCard());

  try {
    const data = await fetchMain(buildApiUrl());
    const videos = Array.isArray(data) ? data : (data.videos || data.results || []);
    grid.innerHTML = '';

    if (!videos.length) {
      grid.innerHTML = `<div class="empty-state"><p>#${escapeHtml(tag)} の動画が見つかりませんでした。</p></div>`;
    } else {
      const missingIcons = [];
      videos.forEach(v => {
        const card = createVideoCard(v);
        grid.appendChild(card);
        if (!v.authorThumbnails && v.authorId) {
          missingIcons.push({ card, authorId: v.authorId });
        }
      });
      if (missingIcons.length > 0) fillMissingIcons(missingIcons);
      updatePagination(videos.length);
    }
  } catch (e) {
    grid.innerHTML = `<div class="error-state"><div class="error-icon">⚠️</div><p>動画の取得に失敗しました。</p></div>`;
    console.error(e);
  }

  isLoading = false;
}

function updatePagination(count) {
  const pagination = document.getElementById('pagination');
  const pageInfo = document.getElementById('pageInfo');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');

  pageInfo.textContent = `${currentPage} ページ`;
  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = count < 20;
  pagination.hidden = (currentPage <= 1 && count < 20);
}

function bindPagination() {
  document.getElementById('prevBtn').addEventListener('click', () => {
    if (currentPage <= 1) return;
    currentPage--;
    pushState();
    loadHashtag();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  document.getElementById('nextBtn').addEventListener('click', () => {
    currentPage++;
    pushState();
    loadHashtag();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}
})();
