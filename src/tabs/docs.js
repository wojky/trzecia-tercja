// ─── Docs tab ─────────────────────────────────────────────────────────────────
// Loads docs/content.pl.md, renders via marked.js (global CDN), toggles panel.

const navDocs   = document.getElementById('navDocs');
const navMecz   = document.getElementById('navMecz');
const contentInner = document.querySelector('.content-inner');
const docsPanel = document.getElementById('docsPanel');
const docsArticle = document.getElementById('docsArticle');
const docsToc   = document.getElementById('docsToc');

let _loaded = false;
let _tocObserver = null;

// ─── Nav toggles ──────────────────────────────────────────────────────────────

navDocs.addEventListener('click', e => {
  e.preventDefault();
  _showDocs();
});

navMecz.addEventListener('click', e => {
  e.preventDefault();
  _showMecz();
});

function _showDocs() {
  contentInner.style.display = 'none';
  docsPanel.style.display    = 'flex';
  navDocs.classList.add('active');
  navMecz.classList.remove('active');
  if (!_loaded) _loadDocs();
}

function _showMecz() {
  contentInner.style.display = '';
  docsPanel.style.display    = 'none';
  navMecz.classList.add('active');
  navDocs.classList.remove('active');
  _tocObserver?.disconnect();
}

// ─── Load & render markdown ───────────────────────────────────────────────────

async function _loadDocs() {
  _loaded = true;
  try {
    const res = await fetch('docs/content.pl.md');
    if (!res.ok) throw new Error(res.status);
    const md = await res.text();
    _render(md);
  } catch {
    docsArticle.innerHTML = '<p class="docs-loading">Nie udało się załadować dokumentacji.</p>';
  }
}

function _render(md) {
  // marked is loaded from CDN as global
  const raw = window.marked.parse(md);
  docsArticle.innerHTML = raw;

  // ── Convert {#slug} anchors written in markdown headings ──
  // marked strips them but leaves them as text; re-parse manually
  docsArticle.querySelectorAll('h1, h2, h3').forEach(el => {
    // Remove {#...} tokens that marked may have left as text
    el.textContent = el.textContent.replace(/\{#[\w-]+\}$/, '').trim();

    // Assign id from text (slugify with PL chars)
    if (!el.id) el.id = _slugify(el.textContent);

    // Append anchor link icon for direct linking
    if (el.tagName !== 'H1') {
      const a = document.createElement('a');
      a.href      = `#${el.id}`;
      a.className = 'heading-anchor';
      a.innerHTML = '<i class="bi bi-link-45deg"></i>';
      a.title     = 'Skopiuj link do sekcji';
      a.addEventListener('click', e => {
        e.preventDefault();
        const url = `${location.pathname}#${el.id}`;
        history.pushState(null, '', url);
        el.scrollIntoView({ behavior: 'smooth' });
      });
      el.appendChild(a);
    }
  });

  // Wrap last <p> (footer note) if it starts with italic
  docsArticle.querySelectorAll('p').forEach(p => {
    if (p.firstChild?.tagName === 'EM' && p.textContent.startsWith('Dokumentacja')) {
      p.classList.add('docs-footer-note');
    }
  });

  // Wrap blockquote paragraphs to aid styling already done via CSS
  // (no extra processing needed)

  _buildToc();
  _initTocScroll();

  // Honour hash on initial open
  const hash = location.hash;
  if (hash) {
    const target = docsArticle.querySelector(hash);
    if (target) setTimeout(() => target.scrollIntoView({ behavior: 'smooth' }), 50);
  }
}

// ─── TOC builder ──────────────────────────────────────────────────────────────

function _buildToc() {
  const headings = [...docsArticle.querySelectorAll('h2, h3')];
  docsToc.innerHTML = '<div class="toc-title">Spis treści</div>';

  headings.forEach(h => {
    const a = document.createElement('a');
    a.href      = `#${h.id}`;
    a.className = 'toc-link' + (h.tagName === 'H3' ? ' toc-sub' : '');
    a.textContent = h.textContent.replace(/\u{1F517}|\uFE0F/gu, '').trim();
    a.dataset.target = h.id;

    a.addEventListener('click', e => {
      e.preventDefault();
      const target = document.getElementById(h.id);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
        history.pushState(null, '', `#${h.id}`);
      }
    });

    docsToc.appendChild(a);
  });
}

// ─── Highlight active TOC entry via IntersectionObserver ─────────────────────

function _initTocScroll() {
  _tocObserver?.disconnect();

  const headings = [...docsArticle.querySelectorAll('h2, h3')];
  if (!headings.length) return;

  _tocObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        docsToc.querySelectorAll('.toc-link').forEach(a => {
          a.classList.toggle('toc-active', a.dataset.target === entry.target.id);
        });
      }
    });
  }, { rootMargin: '-10% 0px -80% 0px', threshold: 0 });

  headings.forEach(h => _tocObserver.observe(h));
}

// ─── Slugify (Polish-aware) ───────────────────────────────────────────────────

function _slugify(text) {
  const map = { ą:'a', ć:'c', ę:'e', ł:'l', ń:'n', ó:'o', ś:'s', ź:'z', ż:'z',
                Ą:'a', Ć:'c', Ę:'e', Ł:'l', Ń:'n', Ó:'o', Ś:'s', Ź:'z', Ż:'z' };
  return text
    .replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, c => map[c] || c)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
