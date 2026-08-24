/**
 * Application de Gestion des Candidatures - Regroupement par Bannière Violette d'Offre Exacte
 */

document.addEventListener('DOMContentLoaded', () => {

  // --- State Variables ---
  const STORAGE_KEY = 'candidatures_tracker_data_v20';
  const PASS_STORAGE_KEY = 'candidatures_admin_password_v1';
  const SESSION_KEY = 'candidatures_admin_session_v1';
  const CLOUD_API_URL = 'https://crudcrud.com/api/0b77ab68a3bc44beafcbd09692e84400/candidates/6a86cb9b8541be03e8f65d58';
  
  let candidates = [];
  let currentSort = 'offer-priority';
  let currentFilterStatus = 'all';
  let currentFilterOffer = 'all';
  let currentFilterAssignee = 'all';
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
  const filterAssigneeSelect = document.getElementById('filter-assignee');
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
  const datalistSuiviPar = document.getElementById('datalist-suivi-par');
  const datalistTransmisPar = document.getElementById('datalist-transmis-par');

  // Form Fields
  const fieldId = document.getElementById('candidate-id');
  const fieldNom = document.getElementById('field-nom');
  const fieldPrenom = document.getElementById('field-prenom');
  const fieldIntitule = document.getElementById('field-intitule');
  const fieldReference = document.getElementById('field-reference');
  const fieldSuiviPar = document.getElementById('field-suivi-par');
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

  // --- Toast Notification Helper ---
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle-2';
    if (type === 'warning') iconName = 'alert-triangle';
    if (type === 'error') iconName = 'alert-circle';

    toast.innerHTML = `<i data-lucide="${iconName}" style="width:16px; height:16px;"></i> <span>${escapeHTML(message)}</span>`;
    container.appendChild(toast);

    if (window.lucide) {
      lucide.createIcons();
    }

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 3500);
  }

  function initTheme() {
    const savedTheme = localStorage.getItem('theme_preference');
    if (savedTheme === 'light') {
      document.body.classList.add('light-theme');
    }
  }

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
    if (!datalistIntitule || !datalistReference || !datalistSuiviPar || !datalistTransmisPar) return;

    datalistIntitule.innerHTML = '';
    datalistReference.innerHTML = '';
    datalistSuiviPar.innerHTML = '';
    datalistTransmisPar.innerHTML = '';

    const uniqueIntitules = new Set();
    const uniqueReferences = new Map();
    const uniqueAssignees = new Set();
    const uniqueSources = new Set();

    candidates.forEach(c => {
      if (c.intitule && c.intitule.trim()) uniqueIntitules.add(c.intitule.trim());
      if (c.reference && c.reference.trim()) uniqueReferences.set(c.reference.trim().toUpperCase(), c.intitule ? c.intitule.trim() : '');
      if (c.suiviPar && c.suiviPar.trim()) uniqueAssignees.add(c.suiviPar.trim());
      if (c.transmisPar && c.transmisPar.trim()) uniqueSources.add(c.transmisPar.trim());
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

    uniqueAssignees.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      datalistSuiviPar.appendChild(opt);
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

    const payload = { candidates: candidates };
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
        if (!map.has(k)) map.set(k, []);
        const list = map.get(k);
        if (!list.some(item => item.id === c.id)) list.push(c);
      });
    });

    const multiAppMap = new Map();
    map.forEach((list, k) => {
      const uniqueOffers = new Set(list.map(c => (c.reference || '').trim().toUpperCase()));
      if (uniqueOffers.size >= 2) multiAppMap.set(k, list);
    });

    return multiAppMap;
  }

  function getMultiApplicationsForCandidate(cand) {
    const multiMap = getMultiApplicantsMap();
    const keyNom = `${(cand.nom || '').trim().toLowerCase()}|${(cand.prenom || '').trim().toLowerCase()}`;
    const keyEmail = (cand.email || '').trim().toLowerCase();

    return multiMap.get(keyNom) || multiMap.get(keyEmail) || null;
  }

  // --- Filter Dropdowns Populator ---
  function updateFilterOptions() {
    // 1. Offer Filter
    const previousOfferVal = filterOfferSelect.value;
    filterOfferSelect.innerHTML = '<option value="all">Toutes les offres</option>';
    const offersMap = new Map();
    candidates.forEach(c => {
      if (c.reference) offersMap.set(c.reference.trim(), `${c.reference.trim()} - ${c.intitule || 'Offre'}`);
    });
    offersMap.forEach((label, ref) => {
      const opt = document.createElement('option');
      opt.value = ref;
      opt.textContent = label;
      filterOfferSelect.appendChild(opt);
    });
    filterOfferSelect.value = offersMap.has(previousOfferVal) || previousOfferVal === 'all' ? previousOfferVal : 'all';

    // 2. Source Filter (Transmis Par)
    const previousSourceVal = filterSourceSelect.value;
    filterSourceSelect.innerHTML = '<option value="all">Toutes les provenances</option>';
    const sourcesSet = new Set();
    candidates.forEach(c => { if (c.transmisPar && c.transmisPar.trim()) sourcesSet.add(c.transmisPar.trim()); });
    sourcesSet.forEach(src => {
      const opt = document.createElement('option');
      opt.value = src;
      opt.textContent = `Transmis par : ${src}`;
      filterSourceSelect.appendChild(opt);
    });
    filterSourceSelect.value = sourcesSet.has(previousSourceVal) || previousSourceVal === 'all' ? previousSourceVal : 'all';

    // 3. Assignee (Suivi Par) Filter
    const previousAssigneeVal = filterAssigneeSelect.value;
    filterAssigneeSelect.innerHTML = '<option value="all">Tous les recruteurs (Suivi par)</option>';
    const assigneesSet = new Set();
    candidates.forEach(c => { if (c.suiviPar && c.suiviPar.trim()) assigneesSet.add(c.suiviPar.trim()); });
    assigneesSet.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = `Suivi par : ${name}`;
      filterAssigneeSelect.appendChild(opt);
    });
    filterAssigneeSelect.value = assigneesSet.has(previousAssigneeVal) || previousAssigneeVal === 'all' ? previousAssigneeVal : 'all';
  }

  // --- Render Function ---
  function render() {
    updateFilterOptions();
    updateModalDatalists();

    const multiMap = getMultiApplicantsMap();

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

        listHTML += `<li><strong>${escapeHTML(name)}</strong> : <em>${escapeHTML(offers)}</em></li>`;
      });
      listHTML += '</ul>';

      multiAppBannerList.innerHTML = listHTML;
    } else {
      multiAppBanner.style.display = 'none';
    }

    let filtered = candidates.filter(cand => {
      const q = currentSearchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        (cand.nom && cand.nom.toLowerCase().includes(q)) ||
        (cand.prenom && cand.prenom.toLowerCase().includes(q)) ||
        (cand.intitule && cand.intitule.toLowerCase().includes(q)) ||
        (cand.reference && cand.reference.toLowerCase().includes(q)) ||
        (cand.transmisPar && cand.transmisPar.toLowerCase().includes(q)) ||
        (cand.suiviPar && cand.suiviPar.toLowerCase().includes(q)) ||
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
      const matchesAssignee = currentFilterAssignee === 'all' || (cand.suiviPar && cand.suiviPar.trim() === currentFilterAssignee);

      return matchesSearch && matchesStatus && matchesOffer && matchesSource && matchesAssignee;
    });

    filtered.sort((a, b) => {
      const prioA = parseInt(a.priorite, 10) || 99;
      const priob = parseInt(b.priorite, 10) || 99;

      if (currentSort === 'offer-priority') {
        const keyA = `${(a.reference || '').toLowerCase()}|${(a.intitule || '').toLowerCase()}`;
        const keyB = `${(b.reference || '').toLowerCase()}|${(b.intitule || '').toLowerCase()}`;
        if (keyA !== keyB) return keyA.localeCompare(keyB);
        return prioA - priob;
      }
      if (currentSort === 'priority-asc') return prioA - priob;
      if (currentSort === 'recent') return new Date(b.dateCandidature || 0) - new Date(a.dateCandidature || 0);
      if (currentSort === 'nom-asc') return (a.nom || '').localeCompare(b.nom || '');
      return 0;
    });

    updateStats(multiMap);

    tbody.innerHTML = '';

    if (filtered.length === 0) {
      emptyState.style.display = 'block';
    } else {
      emptyState.style.display = 'none';

      let lastGroupKey = null;

      filtered.forEach(cand => {
        const multiApps = getMultiApplicationsForCandidate(cand);
        const isMulti = multiApps !== null;

        // Render Purple Group Banner when sorting by offer
        if (currentSort === 'offer-priority' && currentFilterOffer === 'all') {
          const ref = (cand.reference || 'SANS-REF').trim().toUpperCase();
          const title = (cand.intitule || 'Poste non spécifié').trim();
          const currentGroupKey = `${ref}|${title}`;

          if (currentGroupKey !== lastGroupKey) {
            lastGroupKey = currentGroupKey;
            
            const countForOffer = candidates.filter(c => 
              (c.reference || '').trim().toUpperCase() === ref && 
              (c.intitule || '').trim() === title
            ).length;

            const groupTr = document.createElement('tr');
            groupTr.className = 'offer-group-row';
            groupTr.innerHTML = `
              <td colspan="11" data-label="Offre">
                <div style="display:flex; align-items:center; justify-space-between; width:100%;">
                  <div>
                    <i data-lucide="folder" style="width:15px; height:15px; display:inline-block; vertical-align:middle; margin-right:6px; color:#a5b4fc;"></i>
                    <strong style="letter-spacing:0.02em; color:#ffffff;">OFFRE RÉF. ${escapeHTML(ref)}</strong> 
                    <span style="color:#c7d2fe; margin-left:8px; font-weight:600;">— ${escapeHTML(title)}</span>
                  </div>
                  <span style="font-size:0.75rem; background:rgba(255,255,255,0.15); padding:0.15rem 0.55rem; border-radius:999px; color:#ffffff; font-weight:700; border:1px solid rgba(255,255,255,0.2);">
                    ${countForOffer} candidat${countForOffer > 1 ? 's' : ''}
                  </span>
                </div>
              </td>
            `;
            tbody.appendChild(groupTr);
          }
        }

        const tr = document.createElement('tr');
        if (isMulti) tr.className = 'is-multi-applicant';
        
        const initials = `${(cand.prenom || '')[0] || ''}${(cand.nom || '')[0] || ''}`.toUpperCase() || 'C';
        const formattedDate = formatDateShort(cand.dateCandidature);
        const statusBadge = getStatusBadgeHTML(cand.statut);
        const priorityBadge = getPriorityBadgeHTML(cand.priorite);

        let multiBadgeHTML = '';
        if (isMulti) {
          multiBadgeHTML = `
            <div class="multi-app-badge" data-name="${escapeHTML(cand.nom)}" title="${escapeHTML(cand.prenom)} a postulé à ${multiApps.length} offres !">
              ⚠️ ${multiApps.length} offres
            </div>
          `;
        }

        const transmisTag = (cand.transmisPar && cand.transmisPar.trim()) 
          ? `<span class="source-pill">👤 ${escapeHTML(cand.transmisPar.trim())}</span>` 
          : `<span style="color:var(--text-muted); font-size:0.75rem;">-</span>`;

        const suiviTag = (cand.suiviPar && cand.suiviPar.trim()) 
          ? `<span class="assignee-pill">💼 ${escapeHTML(cand.suiviPar.trim())}</span>` 
          : `<span style="color:var(--text-muted); font-size:0.75rem;">-</span>`;

        const notesText = (cand.notes && cand.notes.trim()) ? cand.notes.trim() : '';
        const notesTag = notesText 
          ? `<div class="notes-preview" title="${escapeHTML(notesText)}">💬 ${escapeHTML(notesText)}</div>` 
          : `<span style="color:var(--text-muted); font-size:0.75rem;">-</span>`;

        tr.innerHTML = `
          <td data-label="Prio">
            <div class="priority-pill-wrapper">
              <button class="btn-rank-step btn-prio-up" data-id="${cand.id}" title="Augmenter">▲</button>
              ${priorityBadge}
              <button class="btn-rank-step btn-prio-down" data-id="${cand.id}" title="Diminuer">▼</button>
            </div>
          </td>
          <td data-label="Candidat">
            <div class="candidate-name">
              <div class="avatar-circle">${initials}</div>
              <div>
                <div>${escapeHTML(cand.prenom)} <strong>${escapeHTML(cand.nom)}</strong></div>
                ${multiBadgeHTML}
              </div>
            </div>
          </td>
          <td data-label="Poste">
            <div class="job-title" title="${escapeHTML(cand.intitule)}">${escapeHTML(cand.intitule)}</div>
          </td>
          <td data-label="Réf.">
            <span class="ref-badge">${escapeHTML(cand.reference)}</span>
          </td>
          <td data-label="Transmis par">${transmisTag}</td>
          <td data-label="Suivi par">${suiviTag}</td>
          <td data-label="Notes">${notesTag}</td>
          <td data-label="Lieu">
            <div class="location-tag">
              ${escapeHTML(cand.lieu || '-')}
            </div>
          </td>
          <td data-label="Statut">${statusBadge}</td>
          <td data-label="Date" style="color:var(--text-secondary); font-size:0.78rem;">${formattedDate}</td>
          <td data-label="Actions">
            <div class="actions-cell" style="justify-content: flex-end;">
              <button class="btn-table-action edit" data-id="${cand.id}" title="Éditer">
                <i data-lucide="edit-3" style="width:14px; height:14px;"></i>
              </button>
              <button class="btn-table-action delete" data-id="${cand.id}" title="Supprimer">
                <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
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

  function updateStats(multiMap) {
    statTotal.textContent = candidates.length;
    statP1.textContent = candidates.filter(c => parseInt(c.priorite, 10) === 1).length;
    
    const uniqueMultiNames = new Set();
    multiMap.forEach(list => {
      const first = list[0];
      uniqueMultiNames.add(`${first.prenom.toLowerCase()}|${first.nom.toLowerCase()}`);
    });
    statMultiApp.textContent = uniqueMultiNames.size;
    statEntretien.textContent = candidates.filter(c => c.statut === 'entretien').length;
    statRetenu.textContent = candidates.filter(c => c.statut === 'retenu').length;
  }

  function getPriorityBadgeHTML(priorite) {
    const p = parseInt(priorite, 10) || 1;
    let rankClass = 'rank-default';
    let icon = '';

    if (p === 1) { rankClass = 'rank-1'; icon = '🥇 '; }
    else if (p === 2) { rankClass = 'rank-2'; icon = '🥈 '; }
    else if (p === 3) { rankClass = 'rank-3'; icon = '🥉 '; }

    return `<span class="priority-badge ${rankClass}">${icon}N°${p}</span>`;
  }

  function getStatusBadgeHTML(statut) {
    const labels = { nouveau: 'Nouveau', en_cours: "En cours", entretien: 'Entretien', retenu: 'Retenu', refuse: 'Refusé' };
    const s = statut || 'nouveau';
    return `<span class="status-badge ${s}"><span class="status-dot"></span>${labels[s] || s}</span>`;
  }

  function formatDateShort(dateString) {
    if (!dateString) return '-';
    try {
      const d = new Date(dateString);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = String(d.getFullYear()).slice(2);
      return `${day}/${month}/${year}`;
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
      modalDuplicateWarningText.textContent = `⚠️ Candidat déjà inscrit pour : ${offersText} !`;
      modalDuplicateWarning.style.display = 'flex';
      if (window.lucide) lucide.createIcons();
    } else {
      modalDuplicateWarning.style.display = 'none';
    }
  }

  function handleReferenceChange() {
    const refVal = fieldReference.value.trim().toUpperCase();
    if (!refVal) return;
    const matching = candidates.find(c => (c.reference || '').trim().toUpperCase() === refVal);
    if (matching && matching.intitule && !fieldIntitule.value.trim()) {
      fieldIntitule.value = matching.intitule;
    }
  }

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
      fieldSuiviPar.value = candidate.suiviPar || '';
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

    try {
      const id = fieldId.value;
      const candidateData = {
        id: id || 'cand-' + Date.now(),
        nom: fieldNom.value.trim(),
        prenom: fieldPrenom.value.trim(),
        intitule: fieldIntitule.value.trim(),
        reference: fieldReference.value.trim().toUpperCase(),
        transmisPar: fieldTransmisPar.value.trim(),
        suiviPar: fieldSuiviPar.value.trim(),
        priorite: parseInt(fieldPriorite.value, 10) || 1,
        lieu: fieldLieu.value.trim() || '-',
        statut: fieldStatut.value,
        email: fieldEmail.value.trim(),
        telephone: fieldTelephone.value.trim(),
        dateCandidature: fieldDate.value || new Date().toISOString().split('T')[0],
        notes: fieldNotes.value.trim()
      };

      if (id) {
        const index = candidates.findIndex(c => c.id === id);
        if (index !== -1) {
          candidates[index] = candidateData;
        }
      } else {
        candidates.unshift(candidateData);
      }

      saveLocalCandidates();
      render();
      closeModal();
      showToast(id ? "Candidature mise à jour !" : "Nouveau candidat ajouté avec succès !", "success");
      await pushToCloud();
    } catch (err) {
      console.error("Erreur enregistrement:", err);
      alert("Erreur lors de l'enregistrement: " + err.message);
    }
  }

  async function changePriority(id, delta) {
    const cand = candidates.find(c => c.id === id);
    if (!cand) return;
    let currentPrio = parseInt(cand.priorite, 10) || 1;
    let newPrio = Math.max(1, currentPrio + delta);
    cand.priorite = newPrio;
    saveLocalCandidates();
    render();
    await pushToCloud();
  }

  async function deleteCandidate(id) {
    const cand = candidates.find(c => c.id === id);
    if (!cand) return;
    if (confirm(`Supprimer la candidature de ${cand.prenom} ${cand.nom} ?`)) {
      candidates = candidates.filter(c => c.id !== id);
      saveLocalCandidates();
      render();
      showToast("Candidat supprimé", "info");
      await pushToCloud();
    }
  }

  // --- SMART & BULLETPROOF CSV PARSER ---
  function detectSeparator(text) {
    const firstLine = text.split(/\r\n|\n/)[0] || '';
    const semicolons = (firstLine.match(/;/g) || []).length;
    const commas = (firstLine.match(/,/g) || []).length;
    const tabs = (firstLine.match(/\t/g) || []).length;
    if (tabs > semicolons && tabs > commas) return '\t';
    if (semicolons >= commas) return ';';
    return ',';
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

  function parseAndLoadCSV(csvText) {
    const lines = csvText.split(/\r\n|\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) {
      showToast("Le fichier CSV est vide.", "error");
      return;
    }

    const sep = detectSeparator(csvText);
    const headerCols = parseCSVRow(lines[0], sep).map(h => h.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

    const hasHeader = headerCols.some(h => 
      h.includes('nom') || h.includes('prenom') || h.includes('poste') || h.includes('ref') || h.includes('prio')
    );

    let colMap = {
      nom: -1, prenom: -1, intitule: -1, reference: -1,
      priorite: -1, transmisPar: -1, suiviPar: -1, notes: -1,
      lieu: -1, statut: -1, email: -1, telephone: -1, date: -1
    };

    if (hasHeader) {
      headerCols.forEach((h, idx) => {
        if (h.includes('prio') || h.includes('rang')) colMap.priorite = idx;
        else if (h.includes('nom') && !h.includes('prenom')) colMap.nom = idx;
        else if (h.includes('prenom')) colMap.prenom = idx;
        else if (h.includes('ref') || h.includes('offre')) colMap.reference = idx;
        else if (h.includes('poste') || h.includes('intitule') || h.includes('titre') || h.includes('job')) colMap.intitule = idx;
        else if (h.includes('transmis') || h.includes('origine') || h.includes('source')) colMap.transmisPar = idx;
        else if (h.includes('suivi') || h.includes('recruteur') || h.includes('assignee')) colMap.suiviPar = idx;
        else if (h.includes('note') || h.includes('remarque') || h.includes('comment')) colMap.notes = idx;
        else if (h.includes('lieu') || h.includes('ville') || h.includes('location')) colMap.lieu = idx;
        else if (h.includes('statut') || h.includes('status') || h.includes('etat')) colMap.statut = idx;
        else if (h.includes('email') || h.includes('mail')) colMap.email = idx;
        else if (h.includes('tel') || h.includes('phone')) colMap.telephone = idx;
        else if (h.includes('date')) colMap.date = idx;
      });
    }

    const startIdx = hasHeader ? 1 : 0;
    const importedCandidates = [];

    for (let i = startIdx; i < lines.length; i++) {
      const cols = parseCSVRow(lines[i], sep);
      if (cols.length === 0 || cols.every(c => c === '')) continue;

      let nomVal = colMap.nom !== -1 ? cols[colMap.nom] : (cols[1] || cols[0] || 'Inconnu');
      let prenomVal = colMap.prenom !== -1 ? cols[colMap.prenom] : (cols[2] || cols[1] || '');
      let refVal = colMap.reference !== -1 ? cols[colMap.reference] : (cols[3] || 'REF-GENERAL');
      let intituleVal = colMap.intitule !== -1 ? cols[colMap.intitule] : (cols[4] || 'Candidat');

      if (!nomVal && !prenomVal) continue;

      importedCandidates.push({
        id: 'imported-' + Date.now() + '-' + i,
        priorite: colMap.priorite !== -1 ? (parseInt(cols[colMap.priorite], 10) || 1) : (parseInt(cols[0], 10) || 1),
        nom: nomVal || 'Inconnu',
        prenom: prenomVal || '',
        reference: (refVal || 'REF-OFFRE').toUpperCase(),
        intitule: intituleVal || 'Poste',
        transmisPar: colMap.transmisPar !== -1 ? cols[colMap.transmisPar] : (cols[5] || ''),
        suiviPar: colMap.suiviPar !== -1 ? cols[colMap.suiviPar] : (cols[6] || ''),
        notes: colMap.notes !== -1 ? cols[colMap.notes] : (cols[7] || ''),
        lieu: colMap.lieu !== -1 ? cols[colMap.lieu] : (cols[8] || '-'),
        statut: colMap.statut !== -1 ? normalizeStatus(cols[colMap.statut]) : 'nouveau',
        dateCandidature: colMap.date !== -1 ? cols[colMap.date] : new Date().toISOString().split('T')[0],
        email: colMap.email !== -1 ? cols[colMap.email] : '',
        telephone: colMap.telephone !== -1 ? cols[colMap.telephone] : ''
      });
    }

    if (importedCandidates.length > 0) {
      candidates = [...importedCandidates, ...candidates];
      saveLocalCandidates();
      render();
      showToast(`${importedCandidates.length} candidat(s) importé(s) avec succès ! 🎉`, "success");
      pushToCloud();
    } else {
      showToast("Impossible d'extraire des candidats valides. Vérifiez le format du fichier.", "warning");
    }
  }

  function normalizeStatus(str) {
    if (!str) return 'nouveau';
    const s = str.toLowerCase().trim();
    if (s.includes('cours') || s.includes('examen')) return 'en_cours';
    if (s.includes('entre') || s.includes('rdv')) return 'entretien';
    if (s.includes('ret') || s.includes('gagn') || s.includes('offre') || s.includes('accept')) return 'retenu';
    if (s.includes('refus') || s.includes('rejet') || s.includes('non')) return 'refuse';
    return 'nouveau';
  }

  function exportToExcelCSV() {
    if (candidates.length === 0) {
      showToast("Aucune donnée à exporter.", "warning");
      return;
    }
    const headers = ["Priorité", "Nom", "Prénom", "Référence", "Poste", "Transmis par", "Suivi par", "Notes", "Multi-Offres", "Lieu", "Statut", "Date", "Email", "Téléphone"];
    const rows = candidates.map(c => [
      escapeCsvField(c.priorite || 1), escapeCsvField(c.nom), escapeCsvField(c.prenom), escapeCsvField(c.reference), escapeCsvField(c.intitule), escapeCsvField(c.transmisPar || '-'), escapeCsvField(c.suiviPar || '-'), escapeCsvField(c.notes || '-'), escapeCsvField(getMultiApplicationsForCandidate(c) ? "Multi" : "Unique"), escapeCsvField(c.lieu || '-'), escapeCsvField(c.statut), escapeCsvField(c.dateCandidature), escapeCsvField(c.email), escapeCsvField(c.telephone)
    ]);
    let csvContent = "\uFEFF" + headers.join(";") + "\n" + rows.map(r => r.join(";")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Candidatures_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Exportation Excel téléchargée !", "success");
  }

  function escapeCsvField(field) {
    if (field === null || field === undefined) return '""';
    return `"${String(field).replace(/"/g, '""')}"`;
  }

  async function importFromCSV(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(event) {
      const text = event.target.result;
      parseAndLoadCSV(text);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function setupEventListeners() {
    loginForm.addEventListener('submit', handleLogin);
    btnLogout.addEventListener('click', handleLogout);
    btnChangePass.addEventListener('click', openChangePassModal);
    btnClosePassModal.addEventListener('click', closeChangePassModal);
    btnCancelPassModal.addEventListener('click', closeChangePassModal);
    changePassForm.addEventListener('submit', handleChangePassSubmit);

    searchInput.addEventListener('input', (e) => { currentSearchQuery = e.target.value; render(); });
    filterOfferSelect.addEventListener('change', (e) => { currentFilterOffer = e.target.value; render(); });
    filterSourceSelect.addEventListener('change', (e) => { currentFilterSource = e.target.value; render(); });
    filterAssigneeSelect.addEventListener('change', (e) => { currentFilterAssignee = e.target.value; render(); });
    filterStatusSelect.addEventListener('change', (e) => { currentFilterStatus = e.target.value; render(); });
    sortBySelect.addEventListener('change', (e) => { currentSort = e.target.value; render(); });

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
      if (prioUpBtn) changePriority(prioUpBtn.getAttribute('data-id'), -1);
      if (prioDownBtn) changePriority(prioDownBtn.getAttribute('data-id'), 1);
      if (editBtn) {
        const candidate = candidates.find(c => c.id === editBtn.getAttribute('data-id'));
        if (candidate) openModal(candidate);
      }
      if (deleteBtn) deleteCandidate(deleteBtn.getAttribute('data-id'));
    });

    btnAddCandidate.addEventListener('click', () => openModal());
    btnCloseModal.addEventListener('click', closeModal);
    btnCancelModal.addEventListener('click', closeModal);

    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    candidateForm.addEventListener('submit', handleFormSubmit);

    btnExportExcel.addEventListener('click', exportToExcelCSV);
    btnImportCsv.addEventListener('click', () => fileCsvInput.click());
    fileCsvInput.addEventListener('change', importFromCSV);

    btnThemeToggle.addEventListener('click', () => {
      const isLight = document.body.classList.toggle('light-theme');
      localStorage.setItem('theme_preference', isLight ? 'light' : 'dark');
    });
  }

  initApp();
});
