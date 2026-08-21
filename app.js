/**
 * Application de Gestion des Candidatures - JavaScript Logic avec Authentification Admin par Mot de Passe
 */

document.addEventListener('DOMContentLoaded', () => {

  // --- State Variables ---
  const STORAGE_KEY = 'candidatures_tracker_data_v12';
  const PASS_STORAGE_KEY = 'candidatures_admin_password_v1';
  const SESSION_KEY = 'candidatures_admin_session_v1';
  const CLOUD_API_URL = 'https://crudcrud.com/api/0b77ab68a3bc44beafcbd09692e84400/candidates/6a86cb9b8541be03e8f65d58';
  
  let candidates = [];
  let currentSort = 'offer-priority';
  let currentFilterStatus = 'all';
  let currentFilterOffer = 'all';
  let currentFilterSource = 'all';
  let currentSearchQuery = '';
  let isSyncing = false;
  let lastCloudJsonString = '';

  // --- Admin Auth Elements ---
  const loginOverlay = document.getElementById('login-overlay');
  const loginForm = document.getElementById('login-form');
  const loginUsernameInput = document.getElementById('login-username');
  const loginPasswordInput = document.getElementById('login-password');
  const loginRememberInput = document.getElementById('login-remember');
  const loginErrorMsg = document.getElementById('login-error-msg');
  const btnLogout = document.getElementById('btn-logout');
  const btnChangePass = document.getElementById('btn-change-pass');
  const changePassModal = document.getElementById('change-pass-modal');
  const changePassForm = document.getElementById('change-pass-form');
  const btnClosePassModal = document.getElementById('btn-close-pass-modal');
  const btnCancelPassModal = document.getElementById('btn-cancel-pass-modal');
  const newPassVal = document.getElementById('new-pass-val');
  const confirmPassVal = document.getElementById('confirm-pass-val');

  // --- DOM Elements ---
  const tbody = document.getElementById('candidates-tbody');
  const emptyState = document.getElementById('empty-state');
  const searchInput = document.getElementById('search-input');
  const filterOfferSelect = document.getElementById('filter-offer');
  const filterSourceSelect = document.getElementById('filter-source');
  const filterStatusSelect = document.getElementById('filter-status');
  const sortBySelect = document.getElementById('sort-by');
  
  // Banner & Sync Elements
  const multiAppBanner = document.getElementById('multi-app-banner');
  const multiAppBannerList = document.getElementById('multi-app-banner-list');
  const modalDuplicateWarning = document.getElementById('modal-duplicate-warning');
  const modalDuplicateWarningText = document.getElementById('modal-duplicate-warning-text');
  const syncStatusText = document.getElementById('sync-status-text');

  // KPI Elements
  const statTotal = document.getElementById('stat-total');
  const statP1 = document.getElementById('stat-p1');
  const statMultiApp = document.getElementById('stat-multi-app');
  const statEntretien = document.getElementById('stat-entretien');
  const statRetenu = document.getElementById('stat-retenu');

  // Modal Elements
  const modal = document.getElementById('candidate-modal');
  const modalTitle = document.getElementById('modal-title');
  const candidateForm = document.getElementById('candidate-form');
  const btnAddCandidate = document.getElementById('btn-add-candidate');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCancelModal = document.getElementById('btn-cancel-modal');

  // Datalists
  const datalistIntitule = document.getElementById('datalist-intitule');
  const datalistReference = document.getElementById('datalist-reference');
  const datalistTransmisPar = document.getElementById('datalist-transmis-par');

  // Form Fields
  const fieldId = document.getElementById('candidate-id');
  const fieldNom = document.getElementById('field-nom');
  const fieldPrenom = document.getElementById('field-prenom');
  const fieldIntitule = document.getElementById('field-intitule');
  const fieldReference = document.getElementById('field-reference');
  const fieldTransmisPar = document.getElementById('field-transmis-par');
  const fieldPriorite = document.getElementById('field-priorite');
  const fieldLieu = document.getElementById('field-lieu');
  const fieldStatut = document.getElementById('field-statut');
  const fieldEmail = document.getElementById('field-email');
  const fieldTelephone = document.getElementById('field-telephone');
  const fieldDate = document.getElementById('field-date');
  const fieldNotes = document.getElementById('field-notes');

  // Actions & Tools
  const btnExportExcel = document.getElementById('btn-export-excel');
  const btnImportCsv = document.getElementById('btn-import-csv');
  const fileCsvInput = document.getElementById('file-csv-input');
  const btnThemeToggle = document.getElementById('btn-theme-toggle');

  // --- Admin Password Management ---
  function getAdminPassword() {
    return localStorage.getItem(PASS_STORAGE_KEY) || 'admin123';
  }

  function isAuthenticated() {
    return localStorage.getItem(SESSION_KEY) === 'authenticated' || sessionStorage.getItem(SESSION_KEY) === 'authenticated';
  }

  function setAuthenticated(remember = true) {
    if (remember) {
      localStorage.setItem(SESSION_KEY, 'authenticated');
    } else {
      sessionStorage.setItem(SESSION_KEY, 'authenticated');
    }
  }

  function clearAuthentication() {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  }

  function checkAuthOnLoad() {
    if (isAuthenticated()) {
      loginOverlay.classList.remove('active');
    } else {
      loginOverlay.classList.add('active');
    }
  }

  function handleLogin(e) {
    e.preventDefault();
    const user = loginUsernameInput.value.trim().toLowerCase();
    const pass = loginPasswordInput.value;
    const currentAdminPass = getAdminPassword();

    if (user === 'admin' && pass === currentAdminPass) {
      loginErrorMsg.style.display = 'none';
      setAuthenticated(loginRememberInput.checked);
      loginOverlay.classList.remove('active');
      showToast("Connexion réussie ! Bienvenue Admin.", "success");
      render();
    } else {
      loginErrorMsg.style.display = 'block';
    }
  }

  function handleLogout() {
    if (confirm("Voulez-vous vraiment vous déconnecter de l'Espace Admin ?")) {
      clearAuthentication();
      loginOverlay.classList.add('active');
      loginPasswordInput.value = '';
      showToast("Vous êtes déconnecté.", "info");
    }
  }

  function openChangePassModal() {
    changePassForm.reset();
    changePassModal.classList.add('active');
  }

  function closeChangePassModal() {
    changePassModal.classList.remove('active');
  }

  function handleChangePassSubmit(e) {
    e.preventDefault();
    const nPass = newPassVal.value;
    const cPass = confirmPassVal.value;

    if (nPass !== cPass) {
      alert("Les mots de passe ne correspondent pas !");
      return;
    }

    if (nPass.length < 4) {
      alert("Le mot de passe doit contenir au moins 4 caractères.");
      return;
    }

    localStorage.setItem(PASS_STORAGE_KEY, nPass);
    closeChangePassModal();
    showToast("Mot de passe Admin mis à jour avec succès !", "success");
  }

  // --- Initialization ---
  async function initApp() {
    checkAuthOnLoad();
    loadLocalCandidates();
    setupEventListeners();
    render();
    initTheme();
    
    // Initial fetch from cloud & start auto-polling (every 3 seconds)
    await fetchCloudData(true);
    setInterval(pollCloudUpdates, 3000);
  }

  // --- Local Storage Handling ---
  function loadLocalCandidates() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          candidates = parsed;
          return;
        }
      } catch (e) {
        console.error("Erreur chargement local:", e);
      }
    }
    candidates = window.INITIAL_CANDIDATES || [];
    saveLocalCandidates();
  }

  function saveLocalCandidates() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(candidates));
  }

  // --- Populate Datalists ---
  function updateModalDatalists() {
    if (!datalistIntitule || !datalistReference || !datalistTransmisPar) return;

    datalistIntitule.innerHTML = '';
    datalistReference.innerHTML = '';
    datalistTransmisPar.innerHTML = '';

    const uniqueIntitules = new Set();
    const uniqueReferences = new Map();
    const uniqueSources = new Set();

    candidates.forEach(c => {
      if (c.intitule && c.intitule.trim()) {
        uniqueIntitules.add(c.intitule.trim());
      }
      if (c.reference && c.reference.trim()) {
        uniqueReferences.set(c.reference.trim().toUpperCase(), c.intitule ? c.intitule.trim() : '');
      }
      if (c.transmisPar && c.transmisPar.trim()) {
        uniqueSources.add(c.transmisPar.trim());
      }
    });

    uniqueIntitules.forEach(title => {
      const opt = document.createElement('option');
      opt.value = title;
      datalistIntitule.appendChild(opt);
    });

    uniqueReferences.forEach((intitule, ref) => {
      const opt = document.createElement('option');
      opt.value = ref;
      opt.label = intitule ? `${ref} (${intitule})` : ref;
      datalistReference.appendChild(opt);
    });

    uniqueSources.forEach(source => {
      const opt = document.createElement('option');
      opt.value = source;
      datalistTransmisPar.appendChild(opt);
    });
  }

  // --- Cloud Sync Real-Time Multi-User ---
  async function fetchCloudData(isInitial = false) {
    if (isSyncing) return;
    isSyncing = true;
    updateSyncPill("Synchro...", "orange");

    try {
      const response = await fetch(CLOUD_API_URL, { cache: 'no-cache' });
      if (response.ok) {
        const json = await response.json();
        if (json && Array.isArray(json.candidates) && json.candidates.length > 0) {
          const cloudCandidates = json.candidates;
          const currentStr = JSON.stringify(cloudCandidates);
          
          if (currentStr !== lastCloudJsonString) {
            lastCloudJsonString = currentStr;
            candidates = cloudCandidates;
            saveLocalCandidates();
            render();
            if (!isInitial) {
              showToast("Mise à jour synchronisée en direct !", "info");
            }
          }
        }
      }
      updateSyncPill("En direct 🟢", "green");
    } catch (err) {
      console.log("Synchro cloud hors-ligne:", err);
      updateSyncPill("Local 🟢", "green");
    } finally {
      isSyncing = false;
    }
  }

  async function pushToCloud() {
    saveLocalCandidates();
    updateSyncPill("Sauvegarde...", "orange");

    const payload = {
      candidates: candidates
    };

    const payloadStr = JSON.stringify(candidates);
    lastCloudJsonString = payloadStr;

    try {
      const response = await fetch(CLOUD_API_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        updateSyncPill("En direct 🟢", "green");
      } else {
        updateSyncPill("Sauvegardé local 🟢", "green");
      }
    } catch (err) {
      console.log("Erreur sauvegarde cloud:", err);
      updateSyncPill("Sauvegardé local 🟢", "green");
    }
  }

  async function pollCloudUpdates() {
    if (isSyncing) return;
    try {
      const response = await fetch(CLOUD_API_URL, { cache: 'no-cache' });
      if (response.ok) {
        const json = await response.json();
        if (json && Array.isArray(json.candidates) && json.candidates.length > 0) {
          const cloudCandidates = json.candidates;
          const cloudStr = JSON.stringify(cloudCandidates);
          if (cloudStr !== lastCloudJsonString) {
            lastCloudJsonString = cloudStr;
            candidates = cloudCandidates;
            saveLocalCandidates();
            render();
            showToast("Mise à jour en direct reçue !", "info");
          }
        }
      }
    } catch (e) {
      // Silent catch
    }
  }

  function updateSyncPill(text, color) {
    if (syncStatusText) {
      syncStatusText.textContent = text;
    }
  }

  // --- Multi-Application Detection Logic ---
  function getMultiApplicantsMap() {
    const map = new Map();

    candidates.forEach(c => {
      const keyNom = `${(c.nom || '').trim().toLowerCase()}|${(c.prenom || '').trim().toLowerCase()}`;
      const keyEmail = (c.email || '').trim().toLowerCase();

      const keysToRegister = [];
      if (keyNom !== '|') keysToRegister.push(keyNom);
      if (keyEmail) keysToRegister.push(keyEmail);

      keysToRegister.forEach(k => {
        if (!map.has(k)) {
          map.set(k, []);
        }
        const list = map.get(k);
        if (!list.some(item => item.id === c.id)) {
          list.push(c);
        }
      });
    });

    const multiAppMap = new Map();
    map.forEach((list, k) => {
      const uniqueOffers = new Set(list.map(c => (c.reference || '').trim().toUpperCase()));
      if (uniqueOffers.size >= 2) {
        multiAppMap.set(k, list);
      }
    });

    return multiAppMap;
  }

  function getMultiApplicationsForCandidate(cand) {
    const multiMap = getMultiApplicantsMap();
    const keyNom = `${(cand.nom || '').trim().toLowerCase()}|${(cand.prenom || '').trim().toLowerCase()}`;
    const keyEmail = (cand.email || '').trim().toLowerCase();

    return multiMap.get(keyNom) || multiMap.get(keyEmail) || null;
  }

  // --- Offer & Source Filter Dropdowns Populator ---
  function updateFilterOptions() {
    // 1. Offer Filter
    const previousOfferVal = filterOfferSelect.value;
    filterOfferSelect.innerHTML = '<option value="all">Toutes les offres</option>';

    const offersMap = new Map();
    candidates.forEach(c => {
      if (c.reference) {
        const key = c.reference.trim();
        const label = `${key} - ${c.intitule || 'Offre'}`;
        offersMap.set(key, label);
      }
    });

    offersMap.forEach((label, ref) => {
      const opt = document.createElement('option');
      opt.value = ref;
      opt.textContent = label;
      filterOfferSelect.appendChild(opt);
    });

    if (offersMap.has(previousOfferVal) || previousOfferVal === 'all') {
      filterOfferSelect.value = previousOfferVal;
    } else {
      filterOfferSelect.value = 'all';
      currentFilterOffer = 'all';
    }

    // 2. Source Filter
    const previousSourceVal = filterSourceSelect.value;
    filterSourceSelect.innerHTML = '<option value="all">Toutes les provenances</option>';

    const sourcesSet = new Set();
    candidates.forEach(c => {
      if (c.transmisPar && c.transmisPar.trim()) {
        sourcesSet.add(c.transmisPar.trim());
      }
    });

    sourcesSet.forEach(src => {
      const opt = document.createElement('option');
      opt.value = src;
      opt.textContent = `Transmis par : ${src}`;
      filterSourceSelect.appendChild(opt);
    });

    if (sourcesSet.has(previousSourceVal) || previousSourceVal === 'all') {
      filterSourceSelect.value = previousSourceVal;
    } else {
      filterSourceSelect.value = 'all';
      currentFilterSource = 'all';
    }
  }

  // --- Render Function ---
  function render() {
    updateFilterOptions();
    updateModalDatalists();

    const multiMap = getMultiApplicantsMap();

    // 0. Update Multi-App Alert Banner
    if (multiMap.size > 0) {
      multiAppBanner.style.display = 'flex';
      
      const uniqueMultiNames = new Set();
      multiMap.forEach(list => {
        const first = list[0];
        uniqueMultiNames.add(`${first.prenom} ${first.nom.toUpperCase()}`);
      });

      let listHTML = '<ul>';
      uniqueMultiNames.forEach(name => {
        const matchingCand = candidates.find(c => `${c.prenom} ${c.nom.toUpperCase()}` === name);
        const offers = candidates
          .filter(c => c.nom.toLowerCase() === matchingCand.nom.toLowerCase() && c.prenom.toLowerCase() === matchingCand.prenom.toLowerCase())
          .map(c => `Réf ${c.reference} (${c.intitule})`)
          .join(' + ');

        listHTML += `<li><strong>${escapeHTML(name)}</strong> a postulé à ${candidates.filter(c => c.nom.toLowerCase() === matchingCand.nom.toLowerCase() && c.prenom.toLowerCase() === matchingCand.prenom.toLowerCase()).length} offres : <em>${escapeHTML(offers)}</em></li>`;
      });
      listHTML += '</ul>';

      multiAppBannerList.innerHTML = listHTML;
    } else {
      multiAppBanner.style.display = 'none';
    }

    // 1. Filter candidates
    let filtered = candidates.filter(cand => {
      const q = currentSearchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        (cand.nom && cand.nom.toLowerCase().includes(q)) ||
        (cand.prenom && cand.prenom.toLowerCase().includes(q)) ||
        (cand.intitule && cand.intitule.toLowerCase().includes(q)) ||
        (cand.reference && cand.reference.toLowerCase().includes(q)) ||
        (cand.transmisPar && cand.transmisPar.toLowerCase().includes(q)) ||
        (cand.lieu && cand.lieu.toLowerCase().includes(q)) ||
        (cand.notes && cand.notes.toLowerCase().includes(q));

      let matchesStatus = true;
      if (currentFilterStatus === 'multi-only') {
        matchesStatus = getMultiApplicationsForCandidate(cand) !== null;
      } else if (currentFilterStatus !== 'all') {
        matchesStatus = cand.statut === currentFilterStatus;
      }

      const matchesOffer = currentFilterOffer === 'all' || (cand.reference && cand.reference.trim() === currentFilterOffer);
      const matchesSource = currentFilterSource === 'all' || (cand.transmisPar && cand.transmisPar.trim() === currentFilterSource);

      return matchesSearch && matchesStatus && matchesOffer && matchesSource;
    });

    // 2. Sort candidates
    filtered.sort((a, b) => {
      const prioA = parseInt(a.priorite, 10) || 99;
      const priob = parseInt(b.priorite, 10) || 99;

      if (currentSort === 'offer-priority') {
        const refA = (a.reference || '').toLowerCase();
        const refB = (b.reference || '').toLowerCase();
        if (refA !== refB) {
          return refA.localeCompare(refB);
        }
        return prioA - priob;
      }

      if (currentSort === 'priority-asc') {
        return prioA - priob;
      }

      if (currentSort === 'recent') {
        return new Date(b.dateCandidature || 0) - new Date(a.dateCandidature || 0);
      }
      if (currentSort === 'nom-asc') {
        return (a.nom || '').localeCompare(b.nom || '');
      }
      if (currentSort === 'intitule-asc') {
        return (a.intitule || '').localeCompare(b.intitule || '');
      }
      return 0;
    });

    // 3. Render Stats Cards
    updateStats(multiMap);

    // 4. Render Table Rows
    tbody.innerHTML = '';

    if (filtered.length === 0) {
      emptyState.style.display = 'block';
    } else {
      emptyState.style.display = 'none';

      let lastGroupRef = null;

      filtered.forEach(cand => {
        const multiApps = getMultiApplicationsForCandidate(cand);
        const isMulti = multiApps !== null;

        if (currentSort === 'offer-priority' && currentFilterOffer === 'all') {
          const currentRef = (cand.reference || 'SANS-REF').trim();
          if (currentRef !== lastGroupRef) {
            lastGroupRef = currentRef;
            const countForOffer = candidates.filter(c => (c.reference || '').trim() === currentRef).length;
            const groupTr = document.createElement('tr');
            groupTr.className = 'offer-group-row';
            groupTr.innerHTML = `
              <td colspan="10">
                <i data-lucide="folder" style="width:16px; height:16px; display:inline-block; vertical-align:middle; margin-right:6px; color:var(--primary);"></i>
                OFFRE RÉF. ${escapeHTML(currentRef)} — ${escapeHTML(cand.intitule)} 
                <span style="font-weight: normal; opacity: 0.8; margin-left:8px;">(${countForOffer} candidat${countForOffer > 1 ? 's' : ''})</span>
              </td>
            `;
            tbody.appendChild(groupTr);
          }
        }

        const tr = document.createElement('tr');
        if (isMulti) {
          tr.className = 'is-multi-applicant';
        }
        
        const initials = `${(cand.prenom || '')[0] || ''}${(cand.nom || '')[0] || ''}`.toUpperCase() || 'C';
        const formattedDate = formatDate(cand.dateCandidature);
        const statusBadge = getStatusBadgeHTML(cand.statut);
        const priorityBadge = getPriorityBadgeHTML(cand.priorite);

        let multiBadgeHTML = '';
        if (isMulti) {
          const totalApps = multiApps.length;
          multiBadgeHTML = `
            <div class="multi-app-badge" data-name="${escapeHTML(cand.nom)}" title="${escapeHTML(cand.prenom)} a postulé à ${totalApps} offres d'emploi ! Cliquez pour filtrer.">
              ⚠️ Postulé à ${totalApps} offres
            </div>
          `;
        }

        // Transmis par pill badge
        const transmisTag = (cand.transmisPar && cand.transmisPar.trim()) 
          ? `<span class="source-pill">👤 ${escapeHTML(cand.transmisPar.trim())}</span>` 
          : `<span style="color:var(--text-muted); font-size:0.8rem;">-</span>`;

        // Notes & Remarques Preview cell
        const notesText = (cand.notes && cand.notes.trim()) ? cand.notes.trim() : '';
        const notesTag = notesText 
          ? `<div class="notes-preview" title="${escapeHTML(notesText)}">💬 ${escapeHTML(notesText)}</div>` 
          : `<span style="color:var(--text-muted); font-size:0.8rem;">-</span>`;

        tr.innerHTML = `
          <td>
            <div class="priority-pill-wrapper">
              <button class="btn-rank-step btn-prio-up" data-id="${cand.id}" title="Augmenter la priorité">▲</button>
              ${priorityBadge}
              <button class="btn-rank-step btn-prio-down" data-id="${cand.id}" title="Diminuer la priorité">▼</button>
            </div>
          </td>
          <td>
            <div class="candidate-name">
              <div class="avatar-circle">${initials}</div>
              <div>
                <div>${escapeHTML(cand.prenom)} <strong>${escapeHTML(cand.nom)}</strong></div>
                ${cand.email ? `<small style="color:var(--text-muted);">${escapeHTML(cand.email)}</small>` : ''}
                ${multiBadgeHTML}
              </div>
            </div>
          </td>
          <td>
            <div class="job-title">${escapeHTML(cand.intitule)}</div>
          </td>
          <td>
            <span class="ref-badge">${escapeHTML(cand.reference)}</span>
          </td>
          <td>
            ${transmisTag}
          </td>
          <td>
            ${notesTag}
          </td>
          <td>
            <div class="location-tag">
              <i data-lucide="map-pin" style="width:14px; height:14px;"></i>
              ${escapeHTML(cand.lieu || '-')}
            </div>
          </td>
          <td>${statusBadge}</td>
          <td style="color:var(--text-secondary); font-size:0.85rem;">${formattedDate}</td>
          <td>
            <div class="actions-cell" style="justify-content: flex-end;">
              <button class="btn-table-action edit" data-id="${cand.id}" title="Éditer">
                <i data-lucide="edit-3"></i>
              </button>
              <button class="btn-table-action delete" data-id="${cand.id}" title="Supprimer">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </td>
        `;

        tbody.appendChild(tr);
      });
    }

    if (window.lucide) {
      lucide.createIcons();
    }
  }

  // --- Helper Functions ---
  function updateStats(multiMap) {
    statTotal.textContent = candidates.length;

    const p1Count = candidates.filter(c => parseInt(c.priorite, 10) === 1).length;
    statP1.textContent = p1Count;

    const uniqueMultiNames = new Set();
    multiMap.forEach(list => {
      const first = list[0];
      uniqueMultiNames.add(`${first.prenom.toLowerCase()}|${first.nom.toLowerCase()}`);
    });
    statMultiApp.textContent = uniqueMultiNames.size;

    const entretienCount = candidates.filter(c => c.statut === 'entretien').length;
    statEntretien.textContent = entretienCount;

    const retenuCount = candidates.filter(c => c.statut === 'retenu').length;
    statRetenu.textContent = retenuCount;
  }

  function getPriorityBadgeHTML(priorite) {
    const p = parseInt(priorite, 10) || 1;
    let rankClass = 'rank-default';
    let icon = '';

    if (p === 1) {
      rankClass = 'rank-1';
      icon = '🥇 ';
    } else if (p === 2) {
      rankClass = 'rank-2';
      icon = '🥈 ';
    } else if (p === 3) {
      rankClass = 'rank-3';
      icon = '🥉 ';
    }

    return `<span class="priority-badge ${rankClass}">${icon}N°${p}</span>`;
  }

  function getStatusBadgeHTML(statut) {
    const labels = {
      nouveau: 'Nouveau',
      en_cours: "En cours",
      entretien: 'Entretien',
      retenu: 'Retenu',
      refuse: 'Refusé'
    };

    const s = statut || 'nouveau';
    const label = labels[s] || s;

    return `
      <span class="status-badge ${s}">
        <span class="status-dot"></span>
        ${label}
      </span>
    `;
  }

  function formatDate(dateString) {
    if (!dateString) return '-';
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateString;
    }
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // --- Modal Live Duplicate Check ---
  function checkModalDuplicate() {
    const nomVal = fieldNom.value.trim().toLowerCase();
    const prenomVal = fieldPrenom.value.trim().toLowerCase();
    const emailVal = fieldEmail.value.trim().toLowerCase();
    const currentId = fieldId.value;

    if (!nomVal && !emailVal) {
      modalDuplicateWarning.style.display = 'none';
      return;
    }

    const existing = candidates.filter(c => {
      if (c.id === currentId) return false;
      const matchName = (c.nom || '').trim().toLowerCase() === nomVal && (c.prenom || '').trim().toLowerCase() === prenomVal && nomVal !== '';
      const matchEmail = emailVal !== '' && (c.email || '').trim().toLowerCase() === emailVal;
      return matchName || matchEmail;
    });

    if (existing.length > 0) {
      const offersText = existing.map(e => `Réf ${e.reference} (${e.intitule})`).join(', ');
      modalDuplicateWarningText.textContent = `⚠️ Attention : Ce candidat a déjà postulé pour l'offre : ${offersText} !`;
      modalDuplicateWarning.style.display = 'flex';
      if (window.lucide) lucide.createIcons();
    } else {
      modalDuplicateWarning.style.display = 'none';
    }
  }

  // --- Auto-fill job title when selecting an existing reference ---
  function handleReferenceChange() {
    const refVal = fieldReference.value.trim().toUpperCase();
    if (!refVal) return;

    const matching = candidates.find(c => (c.reference || '').trim().toUpperCase() === refVal);
    if (matching && matching.intitule && !fieldIntitule.value.trim()) {
      fieldIntitule.value = matching.intitule;
    }
  }

  // --- Modal & Form Actions ---
  function openModal(candidate = null) {
    candidateForm.reset();
    updateModalDatalists();
    modalDuplicateWarning.style.display = 'none';

    if (candidate) {
      modalTitle.textContent = "Modifier la Candidature";
      fieldId.value = candidate.id;
      fieldNom.value = candidate.nom || '';
      fieldPrenom.value = candidate.prenom || '';
      fieldIntitule.value = candidate.intitule || '';
      fieldReference.value = candidate.reference || '';
      fieldTransmisPar.value = candidate.transmisPar || '';
      fieldPriorite.value = candidate.priorite || 1;
      fieldLieu.value = candidate.lieu || '';
      fieldStatut.value = candidate.statut || 'nouveau';
      fieldEmail.value = candidate.email || '';
      fieldTelephone.value = candidate.telephone || '';
      fieldDate.value = candidate.dateCandidature || new Date().toISOString().split('T')[0];
      fieldNotes.value = candidate.notes || '';

      checkModalDuplicate();
    } else {
      modalTitle.textContent = "Ajouter un Candidat";
      fieldId.value = '';
      fieldPriorite.value = 1;
      fieldDate.value = new Date().toISOString().split('T')[0];
      fieldStatut.value = 'nouveau';
    }

    modal.classList.add('active');
  }

  function closeModal() {
    modal.classList.remove('active');
  }

  async function handleFormSubmit(e) {
    e.preventDefault();

    const id = fieldId.value;
    const candidateData = {
      id: id || 'cand-' + Date.now(),
      nom: fieldNom.value.trim(),
      prenom: fieldPrenom.value.trim(),
      intitule: fieldIntitule.value.trim(),
      reference: fieldReference.value.trim().toUpperCase(),
      transmisPar: fieldTransmisPar.value.trim(),
      priorite: parseInt(fieldPriorite.value, 10) || 1,
      lieu: fieldLieu.value.trim() || '-',
      statut: fieldStatut.value,
      email: fieldEmail.value.trim(),
      telephone: fieldTelephone.value.trim(),
      dateCandidature: fieldDate.value || new Date().toISOString().split('T')[0],
      notes: fieldNotes.value.trim()
    };

    const multiApps = candidates.filter(c => 
      c.id !== id && 
      c.nom.toLowerCase() === candidateData.nom.toLowerCase() && 
      c.prenom.toLowerCase() === candidateData.prenom.toLowerCase()
    );

    if (id) {
      const index = candidates.findIndex(c => c.id === id);
      if (index !== -1) {
        candidates[index] = candidateData;
        showToast("Candidature mise à jour en direct !", "success");
      }
    } else {
      candidates.unshift(candidateData);
      if (multiApps.length > 0) {
        showToast(`⚠️ Alerte : ${candidateData.prenom} ${candidateData.nom} a désormais ${multiApps.length + 1} candidatures enregistrées !`, "warning");
      } else {
        showToast("Nouveau candidat ajouté !", "success");
      }
    }

    saveLocalCandidates();
    render();
    closeModal();
    await pushToCloud();
  }

  async function changePriority(id, delta) {
    const cand = candidates.find(c => c.id === id);
    if (!cand) return;
    
    let currentPrio = parseInt(cand.priorite, 10) || 1;
    let newPrio = Math.max(1, currentPrio + delta);
    
    cand.priorite = newPrio;
    saveLocalCandidates();
    render();
    showToast(`Priorité de ${cand.prenom} ${cand.nom} passée à N°${newPrio}`, "info");
    await pushToCloud();
  }

  async function deleteCandidate(id) {
    const cand = candidates.find(c => c.id === id);
    if (!cand) return;

    if (confirm(`Êtes-vous sûr de vouloir supprimer la candidature de ${cand.prenom} ${cand.nom} ?`)) {
      candidates = candidates.filter(c => c.id !== id);
      saveLocalCandidates();
      render();
      showToast("Candidat supprimé", "info");
      await pushToCloud();
    }
  }

  // --- CSV Export for Excel ---
  function exportToExcelCSV() {
    if (candidates.length === 0) {
      showToast("Aucune donnée à exporter.", "warning");
      return;
    }

    const headers = [
      "Priorité/Rang",
      "Nom",
      "Prénom",
      "Référence de l'offre",
      "Intitulé du poste",
      "Transmis par / Origine",
      "Notes & Remarques",
      "Alerte Multi-Offres",
      "Lieu",
      "Statut",
      "Date Candidature",
      "Email",
      "Téléphone"
    ];

    const rows = candidates.map(c => {
      const multiApps = getMultiApplicationsForCandidate(c);
      const multiText = multiApps ? `ATTENTION: Postulé à ${multiApps.length} offres` : "Unique";

      return [
        escapeCsvField(c.priorite || 1),
        escapeCsvField(c.nom),
        escapeCsvField(c.prenom),
        escapeCsvField(c.reference),
        escapeCsvField(c.intitule),
        escapeCsvField(c.transmisPar || '-'),
        escapeCsvField(c.notes || '-'),
        escapeCsvField(multiText),
        escapeCsvField(c.lieu || '-'),
        escapeCsvField(c.statut),
        escapeCsvField(c.dateCandidature),
        escapeCsvField(c.email),
        escapeCsvField(c.telephone)
      ];
    });

    let csvContent = "\uFEFF";
    csvContent += headers.join(";") + "\n";

    rows.forEach(rowArray => {
      csvContent += rowArray.join(";") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const today = new Date().toISOString().split('T')[0];
    
    link.setAttribute("href", url);
    link.setAttribute("download", `Candidatures_Synchro_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("Exportation Excel (.csv) téléchargée !", "success");
  }

  function escapeCsvField(field) {
    if (field === null || field === undefined) return '""';
    const str = String(field).replace(/"/g, '""');
    return `"${str}"`;
  }

  // --- CSV Import ---
  async function importFromCSV(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(event) {
      const text = event.target.result;
      await parseAndLoadCSV(text);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function parseAndLoadCSV(csvText) {
    const lines = csvText.split(/\r\n|\n/).filter(line => line.trim() !== '');
    if (lines.length <= 1) {
      showToast("Fichier CSV vide ou invalide.", "error");
      return;
    }

    const headerLine = lines[0];
    const sep = headerLine.includes(';') ? ';' : ',';

    const importedCandidates = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVRow(lines[i], sep);
      if (cols.length >= 5) {
        importedCandidates.push({
          id: 'imported-' + Date.now() + '-' + i,
          priorite: parseInt(cols[0], 10) || 1,
          nom: cols[1] || 'Inconnu',
          prenom: cols[2] || '',
          reference: cols[3] || '',
          intitule: cols[4] || '',
          transmisPar: cols[5] || '',
          notes: cols[6] || '',
          lieu: cols[8] || cols[7] || '-',
          statut: cols[9] || 'nouveau',
          dateCandidature: cols[10] || new Date().toISOString().split('T')[0],
          email: cols[11] || '',
          telephone: cols[12] || ''
        });
      }
    }

    if (importedCandidates.length > 0) {
      candidates = [...importedCandidates, ...candidates];
      saveLocalCandidates();
      render();
      showToast(`${importedCandidates.length} candidat(s) importé(s) avec succès !`, "success");
      await pushToCloud();
    } else {
      showToast("Impossible d'extraire des candidats valides du fichier CSV.", "warning");
    }
  }

  function parseCSVRow(row, sep) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      if (char === '"') {
        if (inQuotes && row[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === sep && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  // --- Theme Toggle ---
  function initTheme() {
    const savedTheme = localStorage.getItem('theme_preference') || 'dark';
    if (savedTheme === 'light') {
      document.body.classList.add('light-theme');
    }
  }

  function toggleTheme() {
    const isLight = document.body.classList.toggle('light-theme');
    localStorage.setItem('theme_preference', isLight ? 'light' : 'dark');
    
    const themeIcon = btnThemeToggle.querySelector('i');
    if (themeIcon) {
      themeIcon.setAttribute('data-lucide', isLight ? 'moon' : 'sun');
      if (window.lucide) lucide.createIcons();
    }
  }

  // --- Toast Notifications ---
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'warning') iconName = 'alert-triangle';
    if (type === 'error') iconName = 'alert-circle';

    toast.innerHTML = `
      <i data-lucide="${iconName}"></i>
      <span>${escapeHTML(message)}</span>
    `;

    container.appendChild(toast);
    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // --- Event Listeners Setup ---
  function setupEventListeners() {
    // Admin Auth Listeners
    loginForm.addEventListener('submit', handleLogin);
    btnLogout.addEventListener('click', handleLogout);
    btnChangePass.addEventListener('click', openChangePassModal);
    btnClosePassModal.addEventListener('click', closeChangePassModal);
    btnCancelPassModal.addEventListener('click', closeChangePassModal);
    changePassForm.addEventListener('submit', handleChangePassSubmit);

    searchInput.addEventListener('input', (e) => {
      currentSearchQuery = e.target.value;
      render();
    });

    filterOfferSelect.addEventListener('change', (e) => {
      currentFilterOffer = e.target.value;
      render();
    });

    filterSourceSelect.addEventListener('change', (e) => {
      currentFilterSource = e.target.value;
      render();
    });

    filterStatusSelect.addEventListener('change', (e) => {
      currentFilterStatus = e.target.value;
      render();
    });

    sortBySelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      render();
    });

    fieldNom.addEventListener('input', checkModalDuplicate);
    fieldPrenom.addEventListener('input', checkModalDuplicate);
    fieldEmail.addEventListener('input', checkModalDuplicate);
    fieldReference.addEventListener('change', handleReferenceChange);

    tbody.addEventListener('click', (e) => {
      const prioUpBtn = e.target.closest('.btn-prio-up');
      const prioDownBtn = e.target.closest('.btn-prio-down');
      const editBtn = e.target.closest('.btn-table-action.edit');
      const deleteBtn = e.target.closest('.btn-table-action.delete');
      const multiBadge = e.target.closest('.multi-app-badge');
      const notesPrev = e.target.closest('.notes-preview');

      if (notesPrev) {
        const fullNotes = notesPrev.getAttribute('title');
        if (fullNotes) alert("💬 Note/Remarque :\n\n" + fullNotes);
      }

      if (multiBadge) {
        const nom = multiBadge.getAttribute('data-name');
        searchInput.value = nom;
        currentSearchQuery = nom;
        render();
      }

      if (prioUpBtn) {
        const id = prioUpBtn.getAttribute('data-id');
        changePriority(id, -1);
      }

      if (prioDownBtn) {
        const id = prioDownBtn.getAttribute('data-id');
        changePriority(id, 1);
      }

      if (editBtn) {
        const id = editBtn.getAttribute('data-id');
        const candidate = candidates.find(c => c.id === id);
        if (candidate) openModal(candidate);
      }

      if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-id');
        deleteCandidate(id);
      }
    });

    btnAddCandidate.addEventListener('click', () => openModal());
    btnCloseModal.addEventListener('click', closeModal);
    btnCancelModal.addEventListener('click', closeModal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    candidateForm.addEventListener('submit', handleFormSubmit);

    btnExportExcel.addEventListener('click', exportToExcelCSV);
    btnImportCsv.addEventListener('click', () => fileCsvInput.click());
    fileCsvInput.addEventListener('change', importFromCSV);

    btnThemeToggle.addEventListener('click', toggleTheme);
  }

  // Launch App
  initApp();

});
