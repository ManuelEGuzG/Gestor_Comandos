// main.js — ProjectGen v3.0

var $ = function(id) { return document.getElementById(id); };

var generateBtn   = $('generate-btn');
var resetBtn      = $('reset-btn');
var outputSection = $('output-section');
var configCard    = $('config-card');
var treePreview   = $('tree-preview');
var commandsList  = $('commands-list');
var pkgPreview    = $('pkg-preview');
var urlsGrid      = $('urls-grid');
var copyAllBtn    = $('copy-all-btn');
var copyPkgBtn    = $('copy-pkg-btn');
var toast         = $('toast');

// ── TOAST ──
var toastTimer;
function showToast() {
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { toast.classList.add('hidden'); }, 2000);
}

// ── COPY ──
function copyText(text, btn) {
  function markUsed() {
    if (btn) {
      var item = btn.closest('.cmd-item');
      if (item) {
        item.classList.add('cmd-used');
        var prompt = item.querySelector('.cmd-prompt');
        if (prompt) prompt.textContent = '✓';
      }
      btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
      btn.style.color = 'var(--green)';
    }
    showToast();
  }

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(markUsed).catch(function() { fallbackCopy(text, markUsed); });
  } else {
    fallbackCopy(text, markUsed);
  }
}

function fallbackCopy(text, cb) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
  document.body.appendChild(ta);
  ta.focus(); ta.select();
  try { document.execCommand('copy'); } catch(e) {}
  document.body.removeChild(ta);
  if (cb) cb();
}

// ── HELPERS ──
function getServer() {
  return document.querySelector('input[name="server"]:checked').value;
}
function slugify(s) {
  return s.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

// ── TREE ──
function buildTree(name) {
  var lines = [
    { indent: 0, prefix: '',     name: name,           cls: 'is-folder', comment: '# Carpeta del proyecto' },
    { indent: 1, prefix: '├─ ',  name: 'src/',         cls: 'is-folder', comment: '# Código fuente' },
    { indent: 2, prefix: '├─ ',  name: 'assets/',      cls: 'is-folder', comment: '# Estáticos' },
    { indent: 3, prefix: '├─ ',  name: 'fonts/',       cls: 'is-folder', comment: '' },
    { indent: 3, prefix: '└─ ',  name: 'images/',      cls: 'is-folder', comment: '' },
    { indent: 2, prefix: '├─ ',  name: 'index.html',   cls: 'is-html',   comment: '# HTML principal' },
    { indent: 2, prefix: '├─ ',  name: 'global.css',   cls: 'is-css',    comment: '# Estilos' },
    { indent: 2, prefix: '└─ ',  name: 'main.js',      cls: 'is-js',     comment: '# Javascript' },
    { indent: 1, prefix: '├─ ',  name: 'README.md',    cls: 'is-file',   comment: '# Documentación' },
    { indent: 1, prefix: '├─ ',  name: '.gitignore',   cls: 'is-file',   comment: '# Ignorados' },
    { indent: 1, prefix: '└─ ',  name: 'package.json', cls: 'is-file',   comment: '# Config' },
  ];

  treePreview.innerHTML = lines.map(function(l) {
    var pad = '';
    for (var i = 0; i < l.indent; i++) pad += '\u00a0\u00a0\u00a0';
    return '<div class="tree-line">'
      + '<span class="tree-indent">' + pad + l.prefix + '</span>'
      + '<span class="tree-name ' + l.cls + '">' + l.name + '</span>'
      + (l.comment ? '<span class="tree-comment">' + l.comment + '</span>' : '')
      + '</div>';
  }).join('');
}

// ── HIGHLIGHT ──
function highlightCmd(cmd) {
  var safe = cmd.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  safe = safe.replace(/^(cd|mkdir|pnpm|git|New-Item|echo|touch|code)\b/, '<span class="kw">$1</span>');
  safe = safe.replace(/(\s--?[\w-]+)/g, '<span class="flag">$1</span>');
  safe = safe.replace(/&quot;(.*?)&quot;/g, '<span class="val">"$1"</span>');
  return safe;
}

// ── COMMANDS ──
function buildCommands(cfg) {
  var groups = [];

  // 1. Estructura
  var mkCmds = [
    'mkdir ' + cfg.name,
    'cd ' + cfg.name,
    'mkdir src',
    'New-Item src\\index.html',
    'New-Item src\\global.css',
    'New-Item src\\main.js',
  ];
  if (cfg.readme)    mkCmds.push('New-Item README.md');
  if (cfg.gitignore) mkCmds.push('New-Item .gitignore');
  mkCmds.push('code .');
  groups.push({ title: 'Estructura de carpetas', cmds: mkCmds });

  // 2. pnpm
  groups.push({ title: 'Inicializar pnpm', cmds: [
    'pnpm init',
    'pnpm pkg set type=module',
    'pnpm pkg set name="' + cfg.name + '"',
    cfg.desc    ? 'pnpm pkg set description="' + cfg.desc   + '"' : null,
    cfg.author  ? 'pnpm pkg set author="'      + cfg.author + '"' : null,
  ].filter(Boolean)});

  // 3. Servidor
  var serverInstall, serverRun;
  if (cfg.server === 'servor') {
    serverInstall = 'pnpm add -D servor';
    serverRun     = 'pnpx servor src/ index.html 1234 --reload';
  } else if (cfg.server === 'live-server') {
    serverInstall = 'pnpm add -D live-server';
    serverRun     = 'pnpx live-server src/ --port=1234';
  } else {
    serverInstall = 'pnpm add -D vite';
    serverRun     = 'pnpx vite --root src/ --port 1234';
  }
  groups.push({ title: 'Servidor · ' + cfg.server, cmds: [
    serverInstall,
    'pnpm pkg set scripts.dev="' + serverRun + '"',
    '# Arrancar: pnpm run dev',
  ]});

  // 4. Git
  var gitCmds = [
    'git init',
    'git branch -M main',
    'git config core.ignorecase false',
  ];
  if (cfg.gitignore) {
    gitCmds.push('echo "node_modules/" >> .gitignore');
    gitCmds.push('echo ".DS_Store" >> .gitignore');
    gitCmds.push('echo "dist/" >> .gitignore');
  }
  gitCmds.push('git add .');
  gitCmds.push('git commit -m "feat: init project structure"');
  groups.push({ title: 'Configurar git', cmds: gitCmds });

  // 5. GitHub remoto
  if (cfg.user) {
    groups.push({ title: 'Conectar con GitHub', cmds: [
      '# Crea el repo en github.com primero, luego:',
      'git remote add origin https://github.com/' + cfg.user + '/' + cfg.name + '.git',
      'git push -u origin main',
    ]});
  }

  // 6. GitHub Pages
  if (cfg.ghPages) {
    groups.push({ title: 'Desplegar en GitHub Pages', cmds: [
      'pnpm add -D gh-pages',
      'pnpm pkg set scripts.deploy="gh-pages -d src/ --no-history"',
      '# Publicar: pnpm run deploy',
      'pnpm run deploy',
    ]});
  }

  // RENDER
  var html = '';
  groups.forEach(function(g) {
    html += '<div class="cmd-group"><div class="cmd-group-title">' + g.title + '</div>';
    g.cmds.forEach(function(cmd) {
      if (cmd.charAt(0) === '#') {
        html += '<div class="cmd-item cmd-comment">'
          + '<span class="cmd-prompt" style="color:var(--text-3)">#</span>'
          + '<span class="cmd-text"><span style="color:var(--text-3)">' + cmd.slice(2) + '</span></span>'
          + '</div>';
      } else {
        var encoded = cmd.replace(/&/g,'&amp;').replace(/"/g,'&quot;');
        html += '<div class="cmd-item">'
          + '<span class="cmd-prompt">$</span>'
          + '<span class="cmd-text">' + highlightCmd(cmd) + '</span>'
          + '<button class="copy-cmd-btn" data-cmd="' + encoded + '" title="Copiar">'
          + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>'
          + '</button></div>';
      }
    });
    html += '</div>';
  });

  commandsList.innerHTML = html;
  commandsList.querySelectorAll('.copy-cmd-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      copyText(this.getAttribute('data-cmd'), this);
    });
  });

  return groups;
}

// ── PACKAGE JSON ──
function buildPkgJson(cfg) {
  var scripts = {};
  var devDeps = {};

  if (cfg.server === 'servor') {
    scripts.dev = 'pnpx servor src/ index.html 1234 --reload';
    devDeps.servor = '^4.0.2';
  } else if (cfg.server === 'live-server') {
    scripts.dev = 'pnpx live-server src/ --port=1234';
    devDeps['live-server'] = '^1.2.2';
  } else {
    scripts.dev = 'pnpx vite --root src/ --port 1234';
    devDeps.vite = '^5.0.0';
  }
  if (cfg.ghPages) {
    scripts.deploy = 'gh-pages -d src/ --no-history';
    devDeps['gh-pages'] = '^6.0.0';
  }

  var pkg = { name: cfg.name, description: cfg.desc || '', type: 'module', author: cfg.author || '', scripts: scripts, devDependencies: devDeps };
  var json = JSON.stringify(pkg, null, 2);

  pkgPreview.innerHTML = json
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
    .replace(/: "([^"]+)"/g, ': <span class="json-str">"$1"</span>')
    .replace(/[{}]/g, function(m) { return '<span class="json-brace">'+m+'</span>'; });

  return json;
}

// ── URLS ──
function buildUrls(cfg) {
  var items = [
    { label: 'Servidor local', url: 'http://localhost:1234', desc: 'pnpm run dev' },
    { label: 'Código fuente',  url: cfg.user ? 'https://github.com/'+cfg.user+'/'+cfg.name : 'https://github.com/USER/REPO', desc: 'Repositorio GitHub' },
  ];
  if (cfg.ghPages && cfg.user)
    items.push({ label: 'GitHub Pages', url: 'https://'+cfg.user+'.github.io/'+cfg.name, desc: 'Web pública' });

  urlsGrid.innerHTML = items.map(function(item) {
    return '<div class="url-item">'
      +'<div class="url-label">'+item.label+'</div>'
      +'<a class="url-link" href="'+item.url+'" target="_blank">'+item.url+'</a>'
      +'<div class="url-desc">'+item.desc+'</div>'
      +'</div>';
  }).join('');
}

function getAllCommands(groups) {
  return groups.map(function(g) {
    return '# '+g.title+'\n'+g.cmds.join('\n');
  }).join('\n\n');
}

// ── GENERATE ──
generateBtn.addEventListener('click', function() {
  var cfg = {
    name:      slugify($('project-name').value.trim()) || 'my-project',
    desc:      $('project-desc').value.trim(),
    author:    $('author-name').value.trim(),
    user:      $('github-user').value.trim(),
    server:    getServer(),
    ghPages:   $('include-github').checked,
    gitignore: $('include-gitignore').checked,
    readme:    $('include-readme').checked,
  };

  buildTree(cfg.name);
  var groups  = buildCommands(cfg);
  var pkgJson = buildPkgJson(cfg);
  buildUrls(cfg);

  copyAllBtn.onclick = function() { copyText(getAllCommands(groups), null); };
  copyPkgBtn.onclick = function() { copyText(pkgJson, null); };

  outputSection.classList.remove('hidden');
  setTimeout(function() {
    outputSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);
});

resetBtn.addEventListener('click', function() {
  outputSection.classList.add('hidden');
  configCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

$('project-name').addEventListener('blur', function() {
  if (this.value) this.value = slugify(this.value);
});