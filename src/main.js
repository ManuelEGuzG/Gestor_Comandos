// main.js — ProjectGen

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
function showToast(msg) {
  toast.textContent = msg || '¡Copiado!';
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { toast.classList.add('hidden'); }, 2200);
}

// ── COPY ── usa un textarea temporal para máxima compatibilidad
function copyText(text, btn) {
  function markUsed() {
    if (btn) {
      var item = btn.closest('.cmd-item');
      if (item && !item.classList.contains('cmd-used')) {
        item.classList.add('cmd-used');
        var prompt = item.querySelector('.cmd-prompt');
        if (prompt) prompt.textContent = '✓';
      }
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
      btn.style.color = 'var(--green)';
    }
    showToast('¡Copiado!');
  }

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(markUsed).catch(function() {
      fallbackCopy(text, markUsed);
    });
  } else {
    fallbackCopy(text, markUsed);
  }
}

function fallbackCopy(text, callback) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;top:-999px;left:-999px;opacity:0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try { document.execCommand('copy'); } catch(e) {}
  document.body.removeChild(ta);
  if (callback) callback();
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
    { indent: 0, name: name,           cls: 'is-folder', comment: '# Carpeta del proyecto' },
    { indent: 1, name: 'src',          cls: 'is-folder', comment: '# Código fuente editable' },
    { indent: 2, name: 'assets',       cls: 'is-folder', comment: '# Ficheros estáticos' },
    { indent: 3, name: 'fonts',        cls: 'is-folder', comment: '# Tipografías' },
    { indent: 3, name: 'images',       cls: 'is-folder', comment: '# Imágenes' },
    { indent: 2, name: 'index.html',   cls: 'is-html',   comment: '# Nuestro HTML' },
    { indent: 2, name: 'global.css',   cls: 'is-css',    comment: '# Archivo CSS' },
    { indent: 2, name: 'main.js',      cls: 'is-js',     comment: '# Javascript principal' },
    { indent: 1, name: 'README.md',    cls: 'is-file',   comment: '# Instrucciones del proyecto' },
    { indent: 1, name: '.gitignore',   cls: 'is-file',   comment: '# Ficheros a ignorar' },
    { indent: 1, name: 'package.json', cls: 'is-file',   comment: '# Info del proyecto' },
  ];

  treePreview.innerHTML = lines.map(function(l) {
    var pad = '';
    for (var i = 0; i < l.indent; i++) pad += '\u00a0\u00a0';
    var prefix = l.indent > 0 ? '\u2514\u2500 ' : '';
    return '<div class="tree-line">'
      + '<span style="font-family:var(--mono);color:var(--text-dim)">' + pad + prefix + '</span>'
      + '<span class="tree-name ' + l.cls + '">' + l.name + '</span>'
      + '<span style="flex:1"></span>'
      + '<span class="tree-comment">' + l.comment + '</span>'
      + '</div>';
  }).join('');
}

// ── SYNTAX HIGHLIGHT ──
function highlightCmd(cmd) {
  // Escape HTML first
  var safe = cmd
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // Highlight keywords at start
  safe = safe.replace(/^(cd|mkdir|pnpm|git|New-Item|echo|touch)\b/, '<span class="kw">$1</span>');
  // Flags
  safe = safe.replace(/(\s--?[\w-]+)/g, '<span class="flag">$1</span>');
  // Quoted strings
  safe = safe.replace(/(&quot;|&#34;|")(.*?)(\1)/g, '<span class="val">"$2"</span>');
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
  groups.push({ title: '📁 Estructura de carpetas', cmds: mkCmds });

  // 2. pnpm
  groups.push({ title: '📦 Inicializar pnpm', cmds: [
    'pnpm init',
    'pnpm pkg set type=module',
    'pnpm pkg set name="' + cfg.name + '"',
    'pnpm pkg set description="' + cfg.desc + '"',
    'pnpm pkg set author="' + cfg.author + '"',
  ]});

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
  groups.push({ title: '🖥️ Servidor (' + cfg.server + ')', cmds: [
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
  groups.push({ title: '🔀 Git', cmds: gitCmds });

  // 5. GitHub remoto
  if (cfg.user) {
    groups.push({ title: '🐙 GitHub — conectar remoto', cmds: [
      '# Crea el repo en github.com primero, luego:',
      'git remote add origin https://github.com/' + cfg.user + '/' + cfg.name + '.git',
      'git push -u origin main',
    ]});
  }

  // 6. GitHub Pages
  if (cfg.ghPages) {
    groups.push({ title: '🚀 GitHub Pages', cmds: [
      'pnpm add -D gh-pages',
      'pnpm pkg set scripts.deploy="gh-pages -d src/ --no-history"',
      '# Publicar: pnpm run deploy',
      'pnpm run deploy',
    ]});
  }

  // ── RENDER usando data-cmd y event listeners ──
  var html = '';
  groups.forEach(function(g) {
    html += '<div class="cmd-group"><div class="cmd-group-title">' + g.title + '</div>';
    g.cmds.forEach(function(cmd) {
      if (cmd.charAt(0) === '#') {
        html += '<div class="cmd-item cmd-comment">'
          + '<span class="cmd-prompt" style="color:var(--text-dim)">#</span>'
          + '<span class="cmd-text"><em style="color:var(--text-dim);font-style:italic">'
          + cmd.slice(2)
          + '</em></span></div>';
      } else {
        // Encode command safely into a data attribute
        var encoded = cmd.replace(/&/g,'&amp;').replace(/"/g,'&quot;');
        html += '<div class="cmd-item">'
          + '<span class="cmd-prompt">$</span>'
          + '<span class="cmd-text">' + highlightCmd(cmd) + '</span>'
          + '<button class="copy-cmd-btn" data-cmd="' + encoded + '" title="Copiar">'
          + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'
          + '<rect x="9" y="9" width="13" height="13" rx="2"/>'
          + '<path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>'
          + '</svg></button></div>';
      }
    });
    html += '</div>';
  });

  commandsList.innerHTML = html;

  // Attach event listeners AFTER innerHTML is set
  var btns = commandsList.querySelectorAll('.copy-cmd-btn');
  btns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var cmd = this.getAttribute('data-cmd');
      copyText(cmd, this);
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
    scripts.deploy = 'gh-pages -d src/';
    devDeps['gh-pages'] = '^6.0.0';
  }

  var pkg = {
    name: cfg.name,
    description: cfg.desc || 'My pet project',
    type: 'module',
    author: cfg.author || '',
    scripts: scripts,
    devDependencies: devDeps
  };

  var json = JSON.stringify(pkg, null, 2);

  pkgPreview.innerHTML = json
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
    .replace(/: "([^"]+)"/g, ': <span class="json-str">"$1"</span>')
    .replace(/[{}]/g, function(m) { return '<span class="json-brace">' + m + '</span>'; });

  return json;
}

// ── URLS ──
function buildUrls(cfg) {
  var items = [
    { label: 'Servidor local', url: 'http://localhost:1234', desc: 'Durante el desarrollo (pnpm run dev)' },
    { label: 'Código fuente',  url: cfg.user ? 'https://github.com/' + cfg.user + '/' + cfg.name : 'https://github.com/USER/REPO', desc: 'Repositorio en GitHub' },
  ];
  if (cfg.ghPages && cfg.user) {
    items.push({ label: 'GitHub Pages', url: 'https://' + cfg.user + '.github.io/' + cfg.name, desc: 'Web pública desplegada' });
  }
  urlsGrid.innerHTML = items.map(function(item) {
    return '<div class="url-item">'
      + '<div class="url-label">' + item.label + '</div>'
      + '<a class="url-link" href="' + item.url + '" target="_blank">' + item.url + '</a>'
      + '<div class="url-desc">' + item.desc + '</div>'
      + '</div>';
  }).join('');
}

// ── GET ALL COMMANDS AS TEXT ──
function getAllCommands(groups) {
  return groups.map(function(g) {
    return '# ' + g.title + '\n' + g.cmds.join('\n');
  }).join('\n\n');
}

// ── GENERATE ──
generateBtn.addEventListener('click', function() {
  var rawName = $('project-name').value.trim();
  var cfg = {
    name:      slugify(rawName) || 'my-project',
    desc:      $('project-desc').value.trim()  || 'My pet project',
    author:    $('author-name').value.trim()   || 'Manuel',
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

// ── RESET ──
resetBtn.addEventListener('click', function() {
  outputSection.classList.add('hidden');
  configCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// ── AUTO SLUGIFY ──
$('project-name').addEventListener('blur', function() {
  if (this.value) this.value = slugify(this.value);
});