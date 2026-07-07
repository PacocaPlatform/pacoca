/* Paçoca Map Editor — bilingual layer (pt-BR / en-US).

   This mirrors site/i18n.js so the editor honours the SAME language choice the
   visitor made on the landing page. Both deploy on the same origin (/editor/ and
   the site root), so the persisted key ("pacoca_lang") is shared:

   Language pick order:
     1. explicit user choice saved in localStorage ("pacoca_lang")
        (set on the landing page or via the editor's own EN/PT toggle)
     2. auto-detect: Brazil -> pt-BR, everyone else -> en-US
        (timezone is the primary geo signal; navigator.language is a fallback)

   Markup conventions (applied on load and on every switch):
     data-i18n="key"                -> element.textContent
     data-i18n-html="key"           -> element.innerHTML
     data-i18n-attr="attr:key;..."  -> element.setAttribute(attr, value)

   Exposes window.I18n:
     .lang            current language ("pt-BR" | "en-US")
     .t(key, vars)    translated string; {name}-style placeholders filled from vars
     .set(lang)       switch language + persist + re-render
     .applyTo(root)   translate a DOM subtree
     .onChange(fn)    subscribe (fn called with the new lang)

   i18n.js must load before app.js so its dynamic strings read the dictionary. */
(function () {
  "use strict";

  var STORAGE_KEY = "pacoca_lang";

  // Brazilian IANA timezones — the reliable "is this visitor in Brazil?" signal.
  var BR_ZONES = {
    "America/Sao_Paulo": 1, "America/Bahia": 1, "America/Fortaleza": 1,
    "America/Recife": 1, "America/Maceio": 1, "America/Araguaina": 1,
    "America/Belem": 1, "America/Santarem": 1, "America/Manaus": 1,
    "America/Cuiaba": 1, "America/Campo_Grande": 1, "America/Porto_Velho": 1,
    "America/Boa_Vista": 1, "America/Rio_Branco": 1, "America/Eirunepe": 1,
    "America/Noronha": 1
  };

  function detect() {
    var saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    if (saved === "pt-BR" || saved === "en-US") return saved;

    // Primary: timezone says Brazil.
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz && BR_ZONES[tz]) return "pt-BR";
    } catch (e) {}

    // Fallback: browser prefers Brazilian Portuguese (pt-BR, or bare "pt").
    var langs = navigator.languages || [navigator.language || ""];
    for (var i = 0; i < langs.length; i++) {
      if (/^pt(-br)?$/i.test(langs[i])) return "pt-BR";
    }
    return "en-US";
  }

  var DICT = {
    "pt-BR": {
      "doc.title": "Paçoca 2.5D — Editor de Fases Visual",
      "nav.lang.next": "EN",
      "nav.lang.title": "Switch to English",

      // Top bar — level identity
      "topbar.level": "Fase",
      "level.name.ph": "Nome da fase",
      "level.name.title": "Nome da fase",
      "level.defaultName": "Nova Fase",
      "theme.title": "Tema da fase (materiais do terreno)",
      "theme.forest": "Floresta",
      "theme.glacial": "Glacial",
      "theme.city": "Cidade",
      "theme.cave": "Caverna",
      "difficulty.title": "Grau de dificuldade da fase",
      "diff.infantil": "Infantil",
      "diff.iniciante": "Iniciante",
      "diff.normal": "Normal",
      "diff.hard": "Difícil",
      "diff.impossible": "Impossível",

      // Top bar — grid / scale
      "grid.label": "Grade",
      "grid.width.title": "Largura (colunas)",
      "grid.height.title": "Altura (linhas)",
      "grid.apply": "Aplicar",
      "grid.apply.title": "Aplicar dimensões",
      "scale.label": "Escala (X/Y)",
      "scale.x.title": "Largura da coluna (passo X em metros)",
      "scale.y.title": "Altura da linha (passo Y em metros)",

      // Settings / setup wizard modal
      "settings.title": "Configurações gerais da fase",
      "settings.head": "Vamos criar a sua fase",
      "settings.headEdit": "Configurações da fase",
      "settings.close": "Fechar (Esc)",
      "settings.intro": "Defina as informações gerais para começar a construir a sua fase.",
      "settings.identity": "Identidade",
      "settings.theme.label": "Tema",
      "settings.difficulty.label": "Dificuldade",
      "settings.identity.hint": "O nome define a identidade da fase. O tema muda os materiais do cenário.",
      "settings.size": "Tamanho da grade",
      "settings.size.small": "Pequeno",
      "settings.size.medium": "Médio",
      "settings.size.large": "Grande",
      "settings.size.hint": "Cada coluna vale 2m e cada linha 3m. Precisa de outro tamanho? Use as opções avançadas.",
      "settings.advanced": "Avançado",
      "settings.scale.hint": "Os valores padrão de escala (2.0 / 3.0) casam com a física do jogo. Mude só se souber o efeito.",
      "settings.start": "Começar a construir",
      "settings.save": "Salvar",

      // View controls
      "view.zoomOut": "Diminuir zoom",
      "view.zoomIn": "Aumentar zoom",
      "view.zoomReset": "Resetar zoom",
      "view.toggleGrid": "Mostrar/ocultar linhas de grade",
      "view.togglePreview": "Mostrar/ocultar prévia (minimapa)",
      "view.toggleTheme": "Alternar tema claro/escuro",
      "theme.toDark": "Mudar para tema escuro",
      "theme.toLight": "Mudar para tema claro",

      // Top bar — actions
      "action.maps": "Fases",
      "action.maps.title": "Salvar, abrir e gerenciar fases (no navegador)",
      "action.code": "Código",
      "action.code.title": "Exportar código (ASCII / JSON)",
      "action.test": "Testar",
      "action.test.title": "Testar a fase no navegador (WebAssembly)",
      "action.play": "Jogar",
      "action.play.title": "Abrir o jogo pelo menu",
      "action.publish": "Publicar",
      "action.share": "Compartilhar",
      "action.share.title": "Publique a fase para gerar o link de compartilhamento",
      "auth.google.title": "Entrar com Google",
      "auth.mylevels": "Minhas fases",
      "auth.logout": "Sair",

      // Tools
      "tool.paint": "Pincel (B)",
      "tool.erase": "Borracha (E)",
      "tool.line": "Linha (L) — arraste para desenhar uma reta",
      "tool.rect": "Retângulo (R) — arraste para preencher um retângulo",
      "tool.fill": "Balde (G) — preenche uma região conectada",
      "tool.select": "Seleção (M) — arraste para selecionar; Ctrl+C/X/V, Del",
      "tool.clear": "Limpar tudo",

      // Palette elements (short = chip label, name = tooltip title, desc = hint)
      "el.platform.short": "Plataforma",
      "el.platform.name": "Plataforma de grama",
      "el.platform.desc": "Bloco sólido básico (CSGBox3D)",
      "el.ramp-up.short": "Rampa ↑",
      "el.ramp-up.name": "Rampa para cima",
      "el.ramp-up.desc": "Rampa diagonal sólida subindo à direita",
      "el.ramp-down.short": "Rampa ↓",
      "el.ramp-down.name": "Rampa para baixo",
      "el.ramp-down.desc": "Rampa diagonal sólida descendo à direita",
      "el.ring.short": "Anel",
      "el.ring.name": "Anel",
      "el.ring.desc": "Item colecionável para pontos/vidas",
      "el.spring-v.short": "Mola V",
      "el.spring-v.name": "Mola vertical",
      "el.spring-v.desc": "Lançamento vertical alto (LaunchForce: 22)",
      "el.spring-d.short": "Mola diag.",
      "el.spring-d.name": "Mola diagonal",
      "el.spring-d.desc": "Lançamento diagonal para frente (LaunchForce: 25)",
      "el.dash.short": "Impulso",
      "el.dash.name": "Impulso (Dash)",
      "el.dash.desc": "Impulsiona o jogador para frente em rolamento",
      "el.enemy.short": "Robô",
      "el.enemy.name": "Inimigo robô",
      "el.enemy.desc": "Inimigo comum que patrulha (Velocidade: 3)",
      "el.cactus.short": "Cacto",
      "el.cactus.name": "Inimigo cacto",
      "el.cactus.desc": "Cacto que patrulha (Velocidade: 1,25)",
      "el.spikes.short": "Espinhos",
      "el.spikes.name": "Espinhos",
      "el.spikes.desc": "Espinhos no chão que causam dano",
      "el.spawn.short": "Início",
      "el.spawn.name": "Ponto inicial",
      "el.spawn.desc": "Ponto de partida do jogador (Z:0, Y: Spawn + 0.5)",
      "el.goal.short": "Chegada",
      "el.goal.name": "Moeda de chegada",
      "el.goal.desc": "Moeda gigante giratória que finaliza a fase",

      // Drawer / tabs
      "drawer.title": "Código & Publicar",
      "drawer.close": "Fechar (Esc)",
      "tab.import": "Importar",
      "tab.publish": "Publicar",
      "btn.copy": "Copiar",
      "btn.download.txt": "Baixar .txt",
      "btn.download.json": "Baixar .json",
      "import.note": "Cole um mapa em grade ASCII (com cabeçalhos) ou JSON para carregar no editor.",
      "import.ph": "Cole seu level_XX_map.txt ou .json aqui...",
      "import.load": "Carregar no editor",

      // Publish tab
      "publish.head": "Publicar para a comunidade",
      "publish.blurb": "Publique a fase direto do navegador. Ela vira JSON estruturado que o jogo monta em tempo real — jogável na hora, sem compilar nada.",
      "publish.author.label": "Seu nome (opcional)",
      "publish.author.ph": "Anônimo",
      "publish.testBeforeTitle": "Testar antes de publicar",
      "publish.now": "Publicar agora",
      "metrics.head": "Métricas importantes (Platformer Kit)",
      "metrics.li1": "<strong>Grade X (largura)</strong>: cada bloco <code>#</code> ou rampa <code>/</code> mede <strong>2m</strong>.",
      "metrics.li2": "<strong>Grade Y (altura)</strong>: cada linha mede <strong>3m</strong> (<code>ystep: 3.0</code>).",
      "metrics.li3": "<strong>Pulo médio</strong>: 4m na horizontal (parado), até 15m (em velocidade máxima).",
      "metrics.li4": "<strong>Molas</strong>: verticais lançam até 22m; diagonais para travessias rápidas.",
      "metrics.li5": "<strong>Queda fatal</strong>: evite plataformas em Y &lt; -15m.",

      // Maps modal
      "maps.head": "Minhas fases",
      "maps.close": "Fechar (Esc)",
      "maps.save": "Salvar fase",
      "maps.loading": "Carregando…",
      "maps.empty": "Nenhuma fase salva ainda. Desenhe e clique em \"Salvar fase\".",
      "maps.noname": "(sem nome)",
      "maps.editTitle": "Abrir para editar",
      "maps.edit": "Editar",
      "maps.deleteTitle": "Excluir",
      "maps.savedAs": "Salvo no navegador como \"{name}\".",
      "maps.needName": "Dê um nome à fase para salvar.",

      // Status bar
      "status.nav.title": "Navegação horizontal",
      "coord.initial": "X: 0, Y: 0 | Real: 0,0m, 0,0m",
      "coord.col": "Col",
      "coord.row": "Lin",

      // Toasts / confirms / alerts (dynamic)
      "toast.undoNothing": "Nada para desfazer",
      "toast.redoNothing": "Nada para refazer",
      "toast.selNothing": "Nada selecionado (use a ferramenta de Seleção)",
      "toast.copied": "Copiado {w}×{h} células — Ctrl+V e clique para colar",
      "toast.clipEmpty": "Área de transferência vazia — selecione e Ctrl+C antes",
      "toast.clipPlace": "Clique na grade para colar o bloco copiado (Esc cancela)",
      "toast.pasted": "Bloco colado",
      "confirm.clear": "Tem certeza de que deseja limpar toda a grade? Todos os dados não salvos serão perdidos.",
      "toast.cleared": "Grade limpa com sucesso!",
      "toast.resized": "Grade redimensionada para {w}x{h}",
      "alert.importEmpty": "Cole o código do mapa para importar!",
      "alert.importError": "Erro ao importar o mapa. Verifique se o formato do texto está correto.\nErro: {msg}",
      "import.defaultName": "Fase importada",
      "error.noGrid": "Seção '[grid]' não encontrada ou vazia no texto colado.",
      "toast.jsonImported": "Mapa JSON importado com sucesso! Fase: {id}",
      "toast.asciiImported": "Mapa ASCII importado com sucesso! Fase: {id}",
      "toast.copiedClipboard": "Copiado para a área de transferência!",
      "toast.copiedShort": "Copiado!",
      "toast.needNameFirst": "Dê um nome à fase primeiro!",
      "toast.mapSaved": "Fase \"{name}\" salva no navegador",
      "toast.saveFail": "Não foi possível salvar (armazenamento cheio?)",
      "toast.mapNotFound": "Fase não encontrada",
      "toast.mapLoaded": "Fase \"{name}\" carregada",
      "confirm.deleteMap": "Excluir a fase{name}? Esta ação não pode ser desfeita.",
      "toast.mapDeleted": "Fase excluída",
      "toast.needTerrain": "Desenhe ao menos uma plataforma",
      "toast.noGoal": "Aviso: a fase não tem chegada (G)",
      "toast.testFail": "Não foi possível preparar o teste (armazenamento cheio?)",
      "toast.opening": "Abrindo a fase no navegador…",
      "live.waiting": "● Aguardando o jogo…",
      "live.tracking": "● ao vivo · X {x}m  Y {y}m · {speed} m/s",
      "toast.welcome": "Bem-vindo, {name}!",
      "auth.player": "jogador",
      "toast.loginFail": "Falha no login",
      "toast.loginOffline": "Não foi possível entrar (backend offline?)",
      "auth.you": "Você",
      "publish.title": "Publicar a fase para a comunidade",
      "publish.needLoginTitle": "Entre com Google para publicar",
      "toast.openFail": "Não foi possível abrir a fase",
      "toast.notOwner": "Você só pode editar as fases que publicou. Entre com a conta certa.",
      "toast.editing": "Editando \"{name}\" — Publicar salva as alterações",
      "toast.editBackendOff": "Backend indisponível para abrir a fase",
      "publish.saveChanges": "Salvar alterações",
      "publish.saveChanges.title": "Salvar as alterações desta fase",
      "share.editTitle": "Compartilhar o link desta fase",
      "toast.shareNeedPublish": "Publique a fase primeiro para gerar o link",
      "share.shareTitle": "Paçoca — {name}",
      "share.shareTitleDefault": "Fase da comunidade Paçoca",
      "share.shareText": "Jogue esta fase do Paçoca:",
      "toast.linkCopied": "Link copiado para a área de transferência",
      "share.copyPrompt": "Copie o link da fase:",
      "toast.needLoginPublish": "Entre com Google para publicar sua fase",
      "toast.saving": "Salvando…",
      "toast.publishing": "Publicando…",
      "toast.savedChanges": "Alterações salvas!",
      "toast.published": "Publicada! Link copiado para a área de transferência",
      "toast.sessionExpired": "Sua sessão expirou — entre novamente",
      "toast.failSave": "Falha ao salvar (HTTP {status})",
      "toast.failPublish": "Falha ao publicar (HTTP {status})",
      "toast.backendOff": "Backend da comunidade indisponível",
      "toast.downloadStarted": "Download de '{file}' iniciado!",
      "level.fallback": "fase",
      "loading.text": "Carregando fase..."
    },

    "en-US": {
      "doc.title": "Paçoca 2.5D — Visual Map Editor",
      "nav.lang.next": "PT",
      "nav.lang.title": "Mudar para português",

      "topbar.level": "Level",
      "level.name.ph": "Level name",
      "level.name.title": "Level name",
      "level.defaultName": "New Level",
      "theme.title": "Level theme (terrain materials)",
      "theme.forest": "Forest",
      "theme.glacial": "Ice",
      "theme.city": "City",
      "theme.cave": "Cave",
      "difficulty.title": "Level difficulty",
      "diff.infantil": "Kids",
      "diff.iniciante": "Beginner",
      "diff.normal": "Normal",
      "diff.hard": "Hard",
      "diff.impossible": "Impossible",

      "grid.label": "Grid",
      "grid.width.title": "Width (columns)",
      "grid.height.title": "Height (rows)",
      "grid.apply": "Apply",
      "grid.apply.title": "Apply dimensions",
      "scale.label": "Scale (X/Y)",
      "scale.x.title": "Column width (X step in meters)",
      "scale.y.title": "Row height (Y step in meters)",

      // Settings / setup wizard modal
      "settings.title": "General level settings",
      "settings.head": "Let's create your level",
      "settings.headEdit": "Level settings",
      "settings.close": "Close (Esc)",
      "settings.intro": "Set the general info to start building your level.",
      "settings.identity": "Identity",
      "settings.theme.label": "Theme",
      "settings.difficulty.label": "Difficulty",
      "settings.identity.hint": "The name is the level's identity. The theme changes the scenery materials.",
      "settings.size": "Grid size",
      "settings.size.small": "Small",
      "settings.size.medium": "Medium",
      "settings.size.large": "Large",
      "settings.size.hint": "Each column is 2m and each row 3m. Need another size? Use the advanced options.",
      "settings.advanced": "Advanced",
      "settings.scale.hint": "The default scale (2.0 / 3.0) matches the game physics. Change only if you know the effect.",
      "settings.start": "Start building",
      "settings.save": "Save",

      "view.zoomOut": "Zoom out",
      "view.zoomIn": "Zoom in",
      "view.zoomReset": "Reset zoom",
      "view.toggleGrid": "Toggle gridlines",
      "view.togglePreview": "Toggle level preview (minimap)",
      "view.toggleTheme": "Toggle light/dark theme",
      "theme.toDark": "Switch to dark theme",
      "theme.toLight": "Switch to light theme",

      "action.maps": "Levels",
      "action.maps.title": "Save, open and manage levels (in the browser)",
      "action.code": "Code",
      "action.code.title": "Export code (ASCII / JSON)",
      "action.test": "Playtest",
      "action.test.title": "Playtest the level in the browser (WebAssembly)",
      "action.play": "Play",
      "action.play.title": "Open the game menu",
      "action.publish": "Publish",
      "action.share": "Share",
      "action.share.title": "Publish the level to generate a share link",
      "auth.google.title": "Sign in with Google",
      "auth.mylevels": "My levels",
      "auth.logout": "Sign out",

      "tool.paint": "Paint (B)",
      "tool.erase": "Eraser (E)",
      "tool.line": "Line (L) — drag to draw a straight line",
      "tool.rect": "Rectangle (R) — drag to fill a rectangle",
      "tool.fill": "Fill bucket (G) — fill a connected region",
      "tool.select": "Select (M) — drag to select; Ctrl+C/X/V, Del",
      "tool.clear": "Clear all",

      "el.platform.short": "Grass",
      "el.platform.name": "Grass Platform",
      "el.platform.desc": "Basic solid block (CSGBox3D)",
      "el.ramp-up.short": "Ramp ↑",
      "el.ramp-up.name": "Ramp Up",
      "el.ramp-up.desc": "Solid diagonal ramp rising right",
      "el.ramp-down.short": "Ramp ↓",
      "el.ramp-down.name": "Ramp Down",
      "el.ramp-down.desc": "Solid diagonal ramp falling right",
      "el.ring.short": "Ring",
      "el.ring.name": "Ring",
      "el.ring.desc": "Collectible item for points/lives",
      "el.spring-v.short": "Spring V",
      "el.spring-v.name": "Vertical Spring",
      "el.spring-v.desc": "High vertical launch (LaunchForce: 22)",
      "el.spring-d.short": "Spring D",
      "el.spring-d.name": "Diagonal Spring",
      "el.spring-d.desc": "Forward diagonal launch (LaunchForce: 25)",
      "el.dash.short": "Booster",
      "el.dash.name": "Booster (Dash)",
      "el.dash.desc": "Boosts player forward into roll state",
      "el.enemy.short": "Robot",
      "el.enemy.name": "Robot Enemy",
      "el.enemy.desc": "Standard patrolling enemy (Speed: 3)",
      "el.cactus.short": "Cactus",
      "el.cactus.name": "Cactus Enemy",
      "el.cactus.desc": "Patrolling cactus (Speed: 1.25)",
      "el.spikes.short": "Spikes",
      "el.spikes.name": "Spikes",
      "el.spikes.desc": "Ground spikes that cause damage",
      "el.spawn.short": "Spawn",
      "el.spawn.name": "Player Spawn",
      "el.spawn.desc": "Player starting point (Z:0, Y: Spawn + 0.5)",
      "el.goal.short": "Goal",
      "el.goal.name": "Goal Coin",
      "el.goal.desc": "Giant spinning coin that finishes the stage",

      "drawer.title": "Code & Publish",
      "drawer.close": "Close (Esc)",
      "tab.import": "Import",
      "tab.publish": "Publish",
      "btn.copy": "Copy",
      "btn.download.txt": "Download .txt",
      "btn.download.json": "Download .json",
      "import.note": "Paste an ASCII Grid map (with headers) or JSON to load it into the editor.",
      "import.ph": "Paste your level_XX_map.txt or .json here...",
      "import.load": "Load in Editor",

      "publish.head": "Publish to the community",
      "publish.blurb": "Publish the level straight from the browser. It becomes structured JSON that the game builds in real time — playable instantly, nothing to compile.",
      "publish.author.label": "Your name (optional)",
      "publish.author.ph": "Anonymous",
      "publish.testBeforeTitle": "Playtest before publishing",
      "publish.now": "Publish now",
      "metrics.head": "Key metrics (Platformer Kit)",
      "metrics.li1": "<strong>Grid X (width)</strong>: each block <code>#</code> or ramp <code>/</code> is <strong>2m</strong>.",
      "metrics.li2": "<strong>Grid Y (height)</strong>: each row is <strong>3m</strong> (<code>ystep: 3.0</code>).",
      "metrics.li3": "<strong>Average jump</strong>: 4m horizontally (standing), up to 15m (at full speed).",
      "metrics.li4": "<strong>Springs</strong>: vertical ones launch up to 22m; diagonal ones for fast crossings.",
      "metrics.li5": "<strong>Fatal fall</strong>: avoid platforms at Y &lt; -15m.",

      "maps.head": "My levels",
      "maps.close": "Close (Esc)",
      "maps.save": "Save level",
      "maps.loading": "Loading…",
      "maps.empty": "No levels saved yet. Draw one and click \"Save level\".",
      "maps.noname": "(untitled)",
      "maps.editTitle": "Open to edit",
      "maps.edit": "Edit",
      "maps.deleteTitle": "Delete",
      "maps.savedAs": "Saved in the browser as \"{name}\".",
      "maps.needName": "Name the level to save it.",

      "status.nav.title": "Horizontal navigation",
      "coord.initial": "X: 0, Y: 0 | Real: 0.0m, 0.0m",
      "coord.col": "Col",
      "coord.row": "Row",

      "toast.undoNothing": "Nothing to undo",
      "toast.redoNothing": "Nothing to redo",
      "toast.selNothing": "Nothing selected (use the Select tool)",
      "toast.copied": "Copied {w}×{h} cells — Ctrl+V then click to place",
      "toast.clipEmpty": "Clipboard empty — select and Ctrl+C first",
      "toast.clipPlace": "Click on the grid to place the copied block (Esc cancels)",
      "toast.pasted": "Block pasted",
      "confirm.clear": "Are you sure you want to clear the entire grid? All unsaved data will be lost.",
      "toast.cleared": "Grid cleared successfully!",
      "toast.resized": "Grid resized to {w}x{h}",
      "alert.importEmpty": "Paste the map code to import!",
      "alert.importError": "Error importing map. Make sure the text format is correct.\nError: {msg}",
      "import.defaultName": "Imported Level",
      "error.noGrid": "'[grid]' section not found or empty in pasted text.",
      "toast.jsonImported": "JSON map imported successfully! Level: {id}",
      "toast.asciiImported": "ASCII map imported successfully! Level: {id}",
      "toast.copiedClipboard": "Copied to clipboard!",
      "toast.copiedShort": "Copied!",
      "toast.needNameFirst": "Name the level first!",
      "toast.mapSaved": "Level \"{name}\" saved in the browser",
      "toast.saveFail": "Couldn't save (storage full?)",
      "toast.mapNotFound": "Level not found",
      "toast.mapLoaded": "Level \"{name}\" loaded",
      "confirm.deleteMap": "Delete the level{name}? This action cannot be undone.",
      "toast.mapDeleted": "Level deleted",
      "toast.needTerrain": "Draw at least one platform",
      "toast.noGoal": "Warning: the level has no goal (G)",
      "toast.testFail": "Couldn't prepare the playtest (storage full?)",
      "toast.opening": "Opening the level in the browser…",
      "live.waiting": "● Waiting for the game…",
      "live.tracking": "● live · X {x}m  Y {y}m · {speed} m/s",
      "toast.welcome": "Welcome, {name}!",
      "auth.player": "player",
      "toast.loginFail": "Sign-in failed",
      "toast.loginOffline": "Couldn't sign in (backend offline?)",
      "auth.you": "You",
      "publish.title": "Publish the level to the community",
      "publish.needLoginTitle": "Sign in with Google to publish",
      "toast.openFail": "Couldn't open the level",
      "toast.notOwner": "You can only edit levels you published. Sign in with the right account.",
      "toast.editing": "Editing \"{name}\" — Publish saves the changes",
      "toast.editBackendOff": "Backend unavailable to open the level",
      "publish.saveChanges": "Save changes",
      "publish.saveChanges.title": "Save the changes to this level",
      "share.editTitle": "Share this level's link",
      "toast.shareNeedPublish": "Publish the level first to generate the link",
      "share.shareTitle": "Paçoca — {name}",
      "share.shareTitleDefault": "Paçoca community level",
      "share.shareText": "Play this Paçoca level:",
      "toast.linkCopied": "Link copied to the clipboard",
      "share.copyPrompt": "Copy the level link:",
      "toast.needLoginPublish": "Sign in with Google to publish your level",
      "toast.saving": "Saving…",
      "toast.publishing": "Publishing…",
      "toast.savedChanges": "Changes saved!",
      "toast.published": "Published! Link copied to the clipboard",
      "toast.sessionExpired": "Your session expired — sign in again",
      "toast.failSave": "Failed to save (HTTP {status})",
      "toast.failPublish": "Failed to publish (HTTP {status})",
      "toast.backendOff": "Community backend unavailable",
      "toast.downloadStarted": "Download of '{file}' started!",
      "level.fallback": "level",
      "loading.text": "Loading level..."
    }
  };

  var lang = detect();
  var listeners = [];

  function fill(str, vars) {
    if (!vars) return str;
    return str.replace(/\{(\w+)\}/g, function (m, k) {
      return (k in vars) ? vars[k] : m;
    });
  }

  function t(key, vars) {
    var table = DICT[lang] || DICT["en-US"];
    var str = (key in table) ? table[key] : key;
    return fill(str, vars);
  }

  function applyTo(root) {
    root = root || document;
    root.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    root.querySelectorAll("[data-i18n-html]").forEach(function (el) {
      el.innerHTML = t(el.getAttribute("data-i18n-html"));
    });
    root.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
      el.getAttribute("data-i18n-attr").split(";").forEach(function (pair) {
        var bits = pair.split(":");
        if (bits.length === 2) el.setAttribute(bits[0].trim(), t(bits[1].trim()));
      });
    });
  }

  function apply() {
    document.documentElement.setAttribute("lang", lang);
    applyTo(document);
    var toggle = document.querySelector("[data-lang-toggle]");
    if (toggle) {
      toggle.textContent = t("nav.lang.next");
      toggle.setAttribute("title", t("nav.lang.title"));
      toggle.setAttribute("aria-label", t("nav.lang.title"));
    }
  }

  function set(next) {
    if (next !== "pt-BR" && next !== "en-US") return;
    if (next === lang) return;
    lang = next;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
    apply();
    listeners.forEach(function (fn) { try { fn(lang); } catch (e) {} });
  }

  function wireToggle() {
    var toggle = document.querySelector("[data-lang-toggle]");
    if (!toggle) return;
    toggle.addEventListener("click", function () {
      set(lang === "pt-BR" ? "en-US" : "pt-BR");
    });
  }

  window.I18n = {
    get lang() { return lang; },
    t: t,
    set: set,
    applyTo: applyTo,
    onChange: function (fn) { if (typeof fn === "function") listeners.push(fn); }
  };

  document.documentElement.setAttribute("lang", lang);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { apply(); wireToggle(); });
  } else {
    apply();
    wireToggle();
  }
})();
