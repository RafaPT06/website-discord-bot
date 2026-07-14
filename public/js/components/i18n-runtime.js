const PREFS_KEY = 'meowzDashboardPreferences';
const VALID_LANGUAGES = new Set(['en', 'pt', 'es', 'de', 'fr']);
const LOCALES = { en: 'en-GB', pt: 'pt-PT', es: 'es-ES', de: 'de-DE', fr: 'fr-FR' };

const TRANSLATIONS = {
  pt: {
    'Home': 'Início', 'Dashboard': 'Painel', 'Documentation': 'Documentação', 'Changelog': 'Alterações', 'Settings': 'Definições',
    'Menu': 'Menu', 'Navigation': 'Navegação', 'Account': 'Conta', 'Login with Discord': 'Entrar com Discord', 'Logout': 'Terminar sessão',
    'Exit Demo': 'Sair da demonstração', 'Demo User': 'Utilizador de demonstração', 'Demo Mode': 'Modo de demonstração',
    'Checking login...': 'A verificar sessão...', 'Loading demo...': 'A carregar demonstração...', 'Open navigation': 'Abrir navegação', 'Close navigation': 'Fechar navegação',
    'Meowz home': 'Página inicial do Meowz', 'Main navigation': 'Navegação principal', 'Meowz, upgraded.': 'Meowz, melhorado.',
    'A modern Discord bot website with live stats, slash command documentation, AI image editing, leveling and useful server tools.': 'Um website moderno para um bot de Discord, com estatísticas em direto, documentação de comandos, edição de imagens por IA, níveis e ferramentas úteis para servidores.',
    'Invite Bot': 'Adicionar bot', 'Invite bot': 'Adicionar bot', 'View Documentation': 'Ver documentação',
    'Checking bot status...': 'A verificar o estado do bot...', 'Loading bot...': 'A carregar bot...', 'Connecting to API': 'A ligar à API',
    'Status': 'Estado', 'Ping': 'Latência', 'Servers': 'Servidores', 'Users': 'Utilizadores', 'Commands': 'Comandos', 'Uptime': 'Tempo online',
    'Loading': 'A carregar', 'Loading live stats...': 'A carregar estatísticas em direto...', 'Features': 'Funcionalidades',
    'Made for active Discord servers': 'Criado para servidores de Discord ativos', 'AI Image Editing': 'Edição de imagens por IA',
    'Edit uploaded images with controlled access for trusted users.': 'Edita imagens enviadas com acesso controlado para utilizadores de confiança.',
    'Leveling': 'Níveis', 'XP, ranks, level-up messages and leaderboard support.': 'XP, classificações, mensagens de subida de nível e tabelas de líderes.',
    'Slash Commands': 'Comandos slash', 'Clean command categories, permissions and documentation.': 'Categorias, permissões e documentação de comandos organizadas.',
    'Server Utilities': 'Utilitários do servidor', 'Setup tools, maintenance mode, deploy logs and admin features.': 'Ferramentas de configuração, modo de manutenção, registos de deploy e opções administrativas.',
    'All rights reserved.': 'Todos os direitos reservados.', 'Made by Rafa (@atuaprima_)': 'Criado por Rafa (@atuaprima_)',
    'Slash command reference': 'Referência de comandos slash',
    'Search commands, open details in a dedicated panel and browse without rendering the full list at once.': 'Pesquisa comandos, abre detalhes num painel dedicado e navega sem carregar toda a lista de uma vez.',
    'Search': 'Pesquisar', 'Search commands': 'Pesquisar comandos', 'Search commands...': 'Pesquisar comandos...', 'All': 'Todos',
    'Loading slash commands...': 'A carregar comandos slash...', 'Command': 'Comando', 'Description': 'Descrição', 'Category': 'Categoria', 'Access': 'Acesso',
    'Select a command': 'Seleciona um comando',
    'Choose any command from the list to view usage, parameters, access and notes without moving the command table.': 'Seleciona um comando da lista para veres a utilização, parâmetros, acesso e notas sem sair da tabela.',
    'Go to page': 'Ir para a página', 'Choose a page.': 'Escolhe uma página.', 'Close page picker': 'Fechar seletor de páginas', 'Cancel': 'Cancelar', 'Go': 'Ir',
    'Latest website updates': 'Últimas atualizações do website', 'Update archive': 'Arquivo de atualizações', 'Filter by month': 'Filtrar por mês',
    'All months': 'Todos os meses', 'Archive': 'Arquivo', 'Other updates': 'Outras atualizações', 'Choose a month': 'Escolher um mês',
    'Some archived entries could not be reached, so the available updates are being shown.': 'Algumas entradas arquivadas não ficaram disponíveis, por isso estão a ser mostradas as atualizações acessíveis.',
    'Retry': 'Tentar novamente', 'No updates were found for this month.': 'Não foram encontradas atualizações para este mês.',
    'Could not load the changelog.': 'Não foi possível carregar as alterações.',
    'The update files could not be reached. Check the connection and try again.': 'Não foi possível aceder aos ficheiros de atualizações. Verifica a ligação e tenta novamente.',
    'No changelog entries are available yet.': 'Ainda não existem entradas de alterações disponíveis.',
    'Page not found': 'Página não encontrada', 'Meowz could not find the page you were looking for.': 'O Meowz não encontrou a página que procuravas.', 'Return Home': 'Voltar ao início',
    'Overview': 'Visão geral', 'Welcome': 'Boas-vindas', 'Goodbye': 'Despedida', 'Logs': 'Registos', 'Moderation': 'Moderação',
    'Owner View': 'Vista do proprietário', 'User View': 'Vista de utilizador', 'Open': 'Abrir', 'Back to servers': 'Voltar aos servidores',
    'Choose a server below to manage Meowz. Use owner view to preview every server Meowz is installed in.': 'Escolhe um servidor abaixo para gerir o Meowz. Usa a vista do proprietário para veres todos os servidores onde o Meowz está instalado.',
    'Choose a server to open its settings.': 'Escolhe um servidor para abrir as suas definições.',
    'No available servers found.': 'Não foram encontrados servidores disponíveis.',
    'Meowz is already installed in all servers available to this view.': 'O Meowz já está instalado em todos os servidores disponíveis nesta vista.',
    'Servers where you can add Meowz will appear here.': 'Os servidores onde podes adicionar o Meowz aparecem aqui.',
    'Need help?': 'Precisas de ajuda?', 'View docs': 'Ver documentação', 'Server manager': 'Gestor de servidores',
    'Login required': 'É necessário iniciar sessão', 'Connect your Discord account to manage Meowz servers.': 'Liga a tua conta Discord para gerir os servidores do Meowz.',
    'Control dashboard preferences. Theme and language preferences are saved locally on this browser, even when you are not logged in.': 'Controla as preferências do painel. O tema e o idioma ficam guardados localmente neste navegador, mesmo sem sessão iniciada.',
    'Dashboard Preferences': 'Preferências do painel', 'View mode': 'Modo de visualização', 'Choose how the dashboard lists servers.': 'Escolhe como o painel apresenta os servidores.',
    'Owner/User view': 'Vista de proprietário/utilizador',
    'Owner View shows every server Meowz is installed in. User View shows the same list a normal manager sees.': 'A vista do proprietário mostra todos os servidores onde o Meowz está instalado. A vista de utilizador mostra a lista disponível para um gestor normal.',
    'Owner View is only available to the bot owner.': 'A vista do proprietário só está disponível para o proprietário do bot.',
    'Appearance': 'Aparência', 'Theme': 'Tema', 'Choose the dashboard theme for this browser.': 'Escolhe o tema do painel para este navegador.',
    'Dark': 'Escuro', 'Light': 'Claro', 'Language': 'Idioma', 'Dashboard language': 'Idioma do painel',
    'Choose the language used across the Meowz website and dashboard.': 'Escolhe o idioma utilizado no website e no painel do Meowz.',
    'Language changes apply immediately and are saved on this browser.': 'As alterações de idioma são aplicadas imediatamente e ficam guardadas neste navegador.',
    'The selector is ready for future translations. English remains the active dashboard copy for now.': 'Escolhe o idioma utilizado no website e no painel do Meowz.',
    'Coming soon': 'Em breve', 'Future settings': 'Definições futuras', 'Notifications': 'Notificações',
    'Control dashboard alerts and reminders.': 'Controla alertas e lembretes do painel.', 'Privacy': 'Privacidade',
    'Manage account visibility and saved preferences.': 'Gere a visibilidade da conta e as preferências guardadas.', 'Experiments': 'Experiências',
    'Try new dashboard features early.': 'Experimenta antecipadamente novas funcionalidades do painel.',
    'Theme updated': 'Tema atualizado', 'Language saved': 'Idioma guardado', 'Language updated': 'Idioma atualizado',
    'Translations can be connected later.': 'A preferência de idioma está ativa.',
    'Your language preference is now active across the website.': 'A tua preferência de idioma está agora ativa em todo o website.',
    'Dark mode selected.': 'Modo escuro selecionado.', 'Light mode selected.': 'Modo claro selecionado.',
    'Demo mode is read-only': 'O modo de demonstração é apenas de leitura', 'Real changes are disabled in preview mode.': 'As alterações reais estão desativadas no modo de pré-visualização.',
    'You have unsaved changes': 'Tens alterações por guardar', 'Discard': 'Descartar', 'Save Changes': 'Guardar alterações', 'Saving...': 'A guardar...',
    'Server settings saved': 'Definições do servidor guardadas', 'All pending changes were saved.': 'Todas as alterações pendentes foram guardadas.',
    'Enabled': 'Ativado', 'Disabled': 'Desativado', 'Channel': 'Canal', 'Message': 'Mensagem', 'Preview': 'Pré-visualização',
    'Owner controls': 'Controlos do proprietário', 'Remove Meowz from this server': 'Remover o Meowz deste servidor', 'Remove Meowz': 'Remover Meowz',
    'Permanent server action': 'Ação permanente no servidor', 'Server name': 'Nome do servidor', 'Meowz was removed': 'O Meowz foi removido',
    'Remove': 'Remover', 'Close': 'Fechar', 'Copy': 'Copiar', 'Copied': 'Copiado', 'Add user': 'Adicionar utilizador',
  },
  es: {
    'Home': 'Inicio', 'Dashboard': 'Panel', 'Documentation': 'Documentación', 'Changelog': 'Cambios', 'Settings': 'Ajustes',
    'Menu': 'Menú', 'Navigation': 'Navegación', 'Account': 'Cuenta', 'Login with Discord': 'Iniciar sesión con Discord', 'Logout': 'Cerrar sesión',
    'Open navigation': 'Abrir navegación', 'Close navigation': 'Cerrar navegación', 'Invite Bot': 'Añadir bot', 'View Documentation': 'Ver documentación',
    'Status': 'Estado', 'Ping': 'Latencia', 'Servers': 'Servidores', 'Users': 'Usuarios', 'Commands': 'Comandos', 'Uptime': 'Tiempo activo',
    'Features': 'Funciones', 'AI Image Editing': 'Edición de imágenes con IA', 'Leveling': 'Niveles', 'Slash Commands': 'Comandos slash', 'Server Utilities': 'Utilidades del servidor',
    'Search': 'Buscar', 'Search commands...': 'Buscar comandos...', 'All': 'Todos', 'Command': 'Comando', 'Description': 'Descripción', 'Category': 'Categoría', 'Access': 'Acceso',
    'Select a command': 'Selecciona un comando', 'Go to page': 'Ir a la página', 'Choose a page.': 'Elige una página.', 'Cancel': 'Cancelar', 'Go': 'Ir',
    'Latest website updates': 'Últimas actualizaciones del sitio', 'Update archive': 'Archivo de actualizaciones', 'Filter by month': 'Filtrar por mes', 'All months': 'Todos los meses',
    'Archive': 'Archivo', 'Other updates': 'Otras actualizaciones', 'Choose a month': 'Elegir un mes', 'Retry': 'Reintentar',
    'Page not found': 'Página no encontrada', 'Return Home': 'Volver al inicio', 'Overview': 'Resumen', 'Welcome': 'Bienvenida', 'Logs': 'Registros', 'Moderation': 'Moderación',
    'Owner View': 'Vista del propietario', 'User View': 'Vista de usuario', 'Open': 'Abrir', 'Back to servers': 'Volver a los servidores',
    'Appearance': 'Apariencia', 'Theme': 'Tema', 'Dark': 'Oscuro', 'Light': 'Claro', 'Language': 'Idioma', 'Dashboard language': 'Idioma del panel',
    'Choose the language used across the Meowz website and dashboard.': 'Elige el idioma usado en el sitio y el panel de Meowz.',
    'Language changes apply immediately and are saved on this browser.': 'Los cambios de idioma se aplican al instante y se guardan en este navegador.',
    'Coming soon': 'Próximamente', 'Future settings': 'Ajustes futuros', 'Notifications': 'Notificaciones', 'Privacy': 'Privacidad', 'Experiments': 'Experimentos',
    'Language saved': 'Idioma guardado', 'Translations can be connected later.': 'La preferencia de idioma está activa.',
    'You have unsaved changes': 'Tienes cambios sin guardar', 'Discard': 'Descartar', 'Save Changes': 'Guardar cambios', 'Saving...': 'Guardando...',
    'Enabled': 'Activado', 'Disabled': 'Desactivado', 'Owner controls': 'Controles del propietario', 'Remove Meowz': 'Quitar Meowz', 'Server name': 'Nombre del servidor',
    'Close': 'Cerrar', 'Copy': 'Copiar', 'Copied': 'Copiado',
  },
  de: {
    'Home': 'Startseite', 'Dashboard': 'Dashboard', 'Documentation': 'Dokumentation', 'Changelog': 'Änderungen', 'Settings': 'Einstellungen',
    'Menu': 'Menü', 'Navigation': 'Navigation', 'Account': 'Konto', 'Login with Discord': 'Mit Discord anmelden', 'Logout': 'Abmelden',
    'Open navigation': 'Navigation öffnen', 'Close navigation': 'Navigation schließen', 'Invite Bot': 'Bot hinzufügen', 'View Documentation': 'Dokumentation anzeigen',
    'Status': 'Status', 'Ping': 'Latenz', 'Servers': 'Server', 'Users': 'Benutzer', 'Commands': 'Befehle', 'Uptime': 'Laufzeit',
    'Features': 'Funktionen', 'AI Image Editing': 'KI-Bildbearbeitung', 'Leveling': 'Levelsystem', 'Slash Commands': 'Slash-Befehle', 'Server Utilities': 'Server-Werkzeuge',
    'Search': 'Suchen', 'Search commands...': 'Befehle suchen...', 'All': 'Alle', 'Command': 'Befehl', 'Description': 'Beschreibung', 'Category': 'Kategorie', 'Access': 'Zugriff',
    'Select a command': 'Befehl auswählen', 'Go to page': 'Zur Seite', 'Choose a page.': 'Seite auswählen.', 'Cancel': 'Abbrechen', 'Go': 'Los',
    'Latest website updates': 'Neueste Website-Updates', 'Update archive': 'Update-Archiv', 'Filter by month': 'Nach Monat filtern', 'All months': 'Alle Monate',
    'Archive': 'Archiv', 'Other updates': 'Weitere Updates', 'Choose a month': 'Monat auswählen', 'Retry': 'Erneut versuchen',
    'Page not found': 'Seite nicht gefunden', 'Return Home': 'Zur Startseite', 'Overview': 'Übersicht', 'Welcome': 'Willkommen', 'Logs': 'Protokolle', 'Moderation': 'Moderation',
    'Owner View': 'Besitzeransicht', 'User View': 'Benutzeransicht', 'Open': 'Öffnen', 'Back to servers': 'Zurück zu den Servern',
    'Appearance': 'Darstellung', 'Theme': 'Design', 'Dark': 'Dunkel', 'Light': 'Hell', 'Language': 'Sprache', 'Dashboard language': 'Dashboard-Sprache',
    'Choose the language used across the Meowz website and dashboard.': 'Wähle die Sprache für die Meowz-Website und das Dashboard.',
    'Language changes apply immediately and are saved on this browser.': 'Sprachänderungen werden sofort angewendet und in diesem Browser gespeichert.',
    'Coming soon': 'Demnächst', 'Future settings': 'Zukünftige Einstellungen', 'Notifications': 'Benachrichtigungen', 'Privacy': 'Datenschutz', 'Experiments': 'Experimente',
    'Language saved': 'Sprache gespeichert', 'Translations can be connected later.': 'Die Spracheinstellung ist aktiv.',
    'You have unsaved changes': 'Du hast ungespeicherte Änderungen', 'Discard': 'Verwerfen', 'Save Changes': 'Änderungen speichern', 'Saving...': 'Speichern...',
    'Enabled': 'Aktiviert', 'Disabled': 'Deaktiviert', 'Owner controls': 'Besitzersteuerung', 'Remove Meowz': 'Meowz entfernen', 'Server name': 'Servername',
    'Close': 'Schließen', 'Copy': 'Kopieren', 'Copied': 'Kopiert',
  },
  fr: {
    'Home': 'Accueil', 'Dashboard': 'Tableau de bord', 'Documentation': 'Documentation', 'Changelog': 'Modifications', 'Settings': 'Paramètres',
    'Menu': 'Menu', 'Navigation': 'Navigation', 'Account': 'Compte', 'Login with Discord': 'Se connecter avec Discord', 'Logout': 'Se déconnecter',
    'Open navigation': 'Ouvrir la navigation', 'Close navigation': 'Fermer la navigation', 'Invite Bot': 'Ajouter le bot', 'View Documentation': 'Voir la documentation',
    'Status': 'Statut', 'Ping': 'Latence', 'Servers': 'Serveurs', 'Users': 'Utilisateurs', 'Commands': 'Commandes', 'Uptime': 'Disponibilité',
    'Features': 'Fonctionnalités', 'AI Image Editing': 'Édition d’images par IA', 'Leveling': 'Niveaux', 'Slash Commands': 'Commandes slash', 'Server Utilities': 'Outils serveur',
    'Search': 'Rechercher', 'Search commands...': 'Rechercher des commandes...', 'All': 'Toutes', 'Command': 'Commande', 'Description': 'Description', 'Category': 'Catégorie', 'Access': 'Accès',
    'Select a command': 'Sélectionner une commande', 'Go to page': 'Aller à la page', 'Choose a page.': 'Choisissez une page.', 'Cancel': 'Annuler', 'Go': 'Aller',
    'Latest website updates': 'Dernières mises à jour du site', 'Update archive': 'Archive des mises à jour', 'Filter by month': 'Filtrer par mois', 'All months': 'Tous les mois',
    'Archive': 'Archive', 'Other updates': 'Autres mises à jour', 'Choose a month': 'Choisir un mois', 'Retry': 'Réessayer',
    'Page not found': 'Page introuvable', 'Return Home': 'Retour à l’accueil', 'Overview': 'Vue d’ensemble', 'Welcome': 'Bienvenue', 'Logs': 'Journaux', 'Moderation': 'Modération',
    'Owner View': 'Vue propriétaire', 'User View': 'Vue utilisateur', 'Open': 'Ouvrir', 'Back to servers': 'Retour aux serveurs',
    'Appearance': 'Apparence', 'Theme': 'Thème', 'Dark': 'Sombre', 'Light': 'Clair', 'Language': 'Langue', 'Dashboard language': 'Langue du tableau de bord',
    'Choose the language used across the Meowz website and dashboard.': 'Choisissez la langue utilisée sur le site et le tableau de bord Meowz.',
    'Language changes apply immediately and are saved on this browser.': 'Les changements de langue sont immédiats et enregistrés dans ce navigateur.',
    'Coming soon': 'Bientôt', 'Future settings': 'Paramètres à venir', 'Notifications': 'Notifications', 'Privacy': 'Confidentialité', 'Experiments': 'Expériences',
    'Language saved': 'Langue enregistrée', 'Translations can be connected later.': 'La préférence de langue est active.',
    'You have unsaved changes': 'Vous avez des modifications non enregistrées', 'Discard': 'Annuler', 'Save Changes': 'Enregistrer', 'Saving...': 'Enregistrement...',
    'Enabled': 'Activé', 'Disabled': 'Désactivé', 'Owner controls': 'Contrôles propriétaire', 'Remove Meowz': 'Retirer Meowz', 'Server name': 'Nom du serveur',
    'Close': 'Fermer', 'Copy': 'Copier', 'Copied': 'Copié',
  },
};

const textSources = new WeakMap();
const attributeSources = new WeakMap();
let currentLanguage = 'en';
let observer = null;

function normalizeLanguage(value) {
  return VALID_LANGUAGES.has(value) ? value : 'en';
}

export function getStoredLanguage() {
  try {
    const prefs = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    return normalizeLanguage(prefs.language);
  } catch {
    return 'en';
  }
}

export function getLocale(language = currentLanguage) {
  return LOCALES[normalizeLanguage(language)] || LOCALES.en;
}

function patternTranslation(source, language) {
  const patterns = {
    pt: [[/^Welcome back, (.+)$/u, 'Bem-vindo de volta, $1'], [/^(\d+) updates across (\d+) months?$/u, '$1 atualizações em $2 meses'], [/^(\d+) updates in (.+)$/u, '$1 atualizações em $2'], [/^(\d+) updates?$/u, '$1 atualizações'], [/^(\d+) options?$/u, '$1 opções'], [/^Choose a page from 1 to (\d+)$/u, 'Escolhe uma página de 1 a $1'], [/^(\d+) members?$/u, '$1 membros']],
    es: [[/^Welcome back, (.+)$/u, 'Bienvenido de nuevo, $1'], [/^(\d+) updates across (\d+) months?$/u, '$1 actualizaciones en $2 meses'], [/^(\d+) updates?$/u, '$1 actualizaciones'], [/^(\d+) options?$/u, '$1 opciones'], [/^Choose a page from 1 to (\d+)$/u, 'Elige una página del 1 al $1']],
    de: [[/^Welcome back, (.+)$/u, 'Willkommen zurück, $1'], [/^(\d+) updates across (\d+) months?$/u, '$1 Updates in $2 Monaten'], [/^(\d+) updates?$/u, '$1 Updates'], [/^(\d+) options?$/u, '$1 Optionen'], [/^Choose a page from 1 to (\d+)$/u, 'Wähle eine Seite von 1 bis $1']],
    fr: [[/^Welcome back, (.+)$/u, 'Bon retour, $1'], [/^(\d+) updates across (\d+) months?$/u, '$1 mises à jour sur $2 mois'], [/^(\d+) updates?$/u, '$1 mises à jour'], [/^(\d+) options?$/u, '$1 options'], [/^Choose a page from 1 to (\d+)$/u, 'Choisissez une page de 1 à $1']],
  };
  for (const [pattern, replacement] of patterns[language] || []) {
    if (pattern.test(source)) return source.replace(pattern, replacement);
  }
  return source;
}

export function t(source, variables = {}, language = currentLanguage) {
  const normalized = normalizeLanguage(language);
  let output = normalized === 'en' ? source : (TRANSLATIONS[normalized]?.[source] || patternTranslation(source, normalized));
  Object.entries(variables).forEach(([key, value]) => { output = output.replaceAll(`{${key}}`, String(value)); });
  return output;
}

function shouldSkip(node) {
  const parent = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  return !parent || Boolean(parent.closest('script, style, code, pre, textarea, [data-i18n-ignore]'));
}

function translateTextNode(node) {
  if (shouldSkip(node)) return;
  const raw = node.textContent || '';
  const trimmed = raw.trim();
  if (!trimmed) return;
  if (!textSources.has(node)) textSources.set(node, trimmed);
  const source = textSources.get(node);
  const translated = t(source);
  const leading = raw.match(/^\s*/u)?.[0] || '';
  const trailing = raw.match(/\s*$/u)?.[0] || '';
  const next = `${leading}${translated}${trailing}`;
  if (raw !== next) node.textContent = next;
}

function translateAttributes(element) {
  if (!(element instanceof Element) || shouldSkip(element)) return;
  let sources = attributeSources.get(element);
  if (!sources) {
    sources = new Map();
    attributeSources.set(element, sources);
  }
  ['placeholder', 'aria-label', 'title'].forEach((name) => {
    if (!element.hasAttribute(name)) return;
    const current = element.getAttribute(name) || '';
    if (!sources.has(name)) sources.set(name, current);
    const translated = t(sources.get(name));
    if (current !== translated) element.setAttribute(name, translated);
  });
}

function translateTree(root) {
  if (!root) return;
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root);
    return;
  }
  if (root instanceof Element) translateAttributes(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) translateTextNode(node);
    else translateAttributes(node);
    node = walker.nextNode();
  }
}

export function applyLanguage(language = getStoredLanguage()) {
  currentLanguage = normalizeLanguage(language);
  document.documentElement.lang = currentLanguage;
  document.documentElement.dataset.language = currentLanguage;
  translateTree(document.body);
  return currentLanguage;
}

export function setStoredLanguage(language) {
  const normalized = normalizeLanguage(language);
  let prefs = {};
  try { prefs = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); } catch {}
  prefs.language = normalized;
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  applyLanguage(normalized);
  window.dispatchEvent(new CustomEvent('meowz:language-change', { detail: { language: normalized, locale: getLocale(normalized) } }));
  return normalized;
}

export function initI18n() {
  applyLanguage(getStoredLanguage());
  if (observer || !document.body) return;
  observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => translateTree(node));
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
