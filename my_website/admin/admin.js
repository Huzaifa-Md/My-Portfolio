// ═══════════════════════════════════════════════════════════════
//   HELLODEV — ADMIN DASHBOARD JAVASCRIPT
// ═══════════════════════════════════════════════════════════════

let currentUser = null;
let allLeads = [];
let cmsData = {};
let modalMode = null; // 'project' | 'testimonial'
let editingId = null;

// ══════════════════════════════════
//   INIT
// ══════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {

  // Auth guard
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = '/admin/index.html';
    return;
  }

  currentUser = session.user;
  document.getElementById('user-email').textContent = currentUser.email;
  document.getElementById('user-avatar').textContent = currentUser.email.substring(0, 2).toUpperCase();

  // Sidebar navigation
  document.querySelectorAll('.nav-item[data-panel]').forEach(item => {
    item.addEventListener('click', () => {
      const panel = item.dataset.panel;
      switchPanel(panel);
    });
  });

  // Logout
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = '/admin/index.html';
  });

  // Mobile sidebar toggle
  const sidebarToggle = document.getElementById('sidebar-toggle');
  sidebarToggle.style.display = 'flex';
  sidebarToggle.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('mobile-open');
  });

  // Leads search
  document.getElementById('leads-search').addEventListener('input', (e) => {
    renderLeadsTable(filterLeads(e.target.value));
  });

  // Modal form submit
  document.getElementById('modal-form').addEventListener('submit', handleModalSubmit);

  // Load initial data
  await Promise.all([
    loadDashboard(),
    loadLeads(),
    loadCMSContent(),
    loadProjects(),
    loadTestimonials(),
    loadSEO(),
    loadVisibility()
  ]);
});

// ══════════════════════════════════
//   PANEL NAVIGATION
// ══════════════════════════════════
function switchPanel(panelId) {
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById(`panel-${panelId}`)?.classList.add('active');
  document.querySelector(`[data-panel="${panelId}"]`)?.classList.add('active');

  const titles = {
    dashboard: 'Dashboard',
    leads: 'Leads',
    cms: 'CMS Editor',
    projects: 'Projects',
    testimonials: 'Testimonials',
    seo: 'SEO Settings',
    visibility: 'Section Visibility'
  };
  document.getElementById('page-title').textContent = titles[panelId] || panelId;

  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('mobile-open');
}

// ══════════════════════════════════
//   DASHBOARD
// ══════════════════════════════════
async function loadDashboard() {
  try {
    const [
      { count: leadsCount },
      { count: projCount },
      { count: testiCount },
      { data: recentLeads }
    ] = await Promise.all([
      supabaseClient.from('leads').select('*', { count: 'exact', head: true }),
      supabaseClient.from('projects').select('*', { count: 'exact', head: true }),
      supabaseClient.from('testimonials').select('*', { count: 'exact', head: true }),
      supabaseClient.from('leads').select('*').order('created_at', { ascending: false }).limit(5)
    ]);

    document.getElementById('stat-leads').textContent = leadsCount ?? 0;
    document.getElementById('stat-projects').textContent = projCount ?? 0;
    document.getElementById('stat-testi').textContent = testiCount ?? 0;

    // Today's leads
    const today = new Date().toISOString().split('T')[0];
    const { count: todayCount } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today);
    document.getElementById('stat-today').textContent = todayCount ?? 0;

    // Recent leads table
    const tbody = document.getElementById('recent-leads-body');
    if (recentLeads && recentLeads.length > 0) {
      tbody.innerHTML = recentLeads.map(lead => `
        <tr>
          <td class="cell-name">${escHtml(lead.name)}</td>
          <td>${escHtml(lead.email)}</td>
          <td>${escHtml(lead.phone || '—')}</td>
          <td>${formatDate(lead.created_at)}</td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = `<tr><td colspan="4" class="table-empty">No leads yet.</td></tr>`;
    }
  } catch (e) {
    console.error('Dashboard load error:', e);
  }
}

// ══════════════════════════════════
//   LEADS
// ══════════════════════════════════
async function loadLeads() {
  try {
    const { data, error } = await supabaseClient.from('leads').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    allLeads = data || [];
    renderLeadsTable(allLeads);
    document.getElementById('leads-count').textContent = `${allLeads.length} total lead${allLeads.length !== 1 ? 's' : ''}`;
  } catch (e) {
    console.error(e);
  }
}

function renderLeadsTable(leads) {
  const tbody = document.getElementById('leads-table-body');
  if (!leads || leads.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty">No leads found.</td></tr>`;
    return;
  }

  tbody.innerHTML = leads.map(lead => `
    <tr>
      <td class="cell-name">${escHtml(lead.name)}</td>
      <td><a href="mailto:${escHtml(lead.email)}" style="color:var(--accent)">${escHtml(lead.email)}</a></td>
      <td>${escHtml(lead.phone || '—')}</td>
      <td style="max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escHtml(lead.message || '')}">${escHtml(truncate(lead.message || '', 60))}</td>
      <td style="white-space:nowrap;">${formatDate(lead.created_at)}</td>
      <td>
        <button class="btn-delete" onclick="deleteLead('${lead.id}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

function filterLeads(query) {
  const q = query.toLowerCase();
  return allLeads.filter(l =>
    l.name.toLowerCase().includes(q) ||
    l.email.toLowerCase().includes(q) ||
    (l.message || '').toLowerCase().includes(q)
  );
}

async function deleteLead(id) {
  if (!confirm('Delete this lead? This cannot be undone.')) return;
  const { error } = await supabaseClient.from('leads').delete().eq('id', id);
  if (error) { toast('error', 'Failed to delete lead.'); return; }
  allLeads = allLeads.filter(l => l.id !== id);
  renderLeadsTable(allLeads);
  document.getElementById('leads-count').textContent = `${allLeads.length} total lead(s)`;
  toast('success', 'Lead deleted.');
  loadDashboard();
}

// ══════════════════════════════════
//   CMS CONTENT
// ══════════════════════════════════
async function loadCMSContent() {
  try {
    const { data } = await supabaseClient.from('cms_content').select('*');
    if (!data) return;

    data.forEach(row => {
      cmsData[row.id] = row.content;
      switch (row.id) {
        case 'hero': populateHeroCMS(row.content); break;
        case 'about': populateAboutCMS(row.content); break;
        case 'services': populateServicesCMS(row.content); break;
        case 'faq': populateFAQCMS(row.content); break;
      }
    });
  } catch (e) { console.error(e); }
}

function populateHeroCMS(c) {
  setVal('hero-headline', c.headline);
  setVal('hero-subheadline', c.subheadline);
  setVal('hero-cta1', c.cta_primary);
  setVal('hero-cta2', c.cta_secondary);
}

function populateAboutCMS(c) {
  setVal('about-title', c.title);
  setVal('about-intro', c.intro);
  setVal('about-mission', c.mission);
  setVal('about-skills', (c.skills || []).join(', '));
}

function populateServicesCMS(c) {
  setVal('services-title', c.title);
  const container = document.getElementById('services-items');
  container.innerHTML = '';
  (c.items || []).forEach((item, i) => addServiceItem(item, i));
}

function populateFAQCMS(c) {
  setVal('faq-title', c.title);
  const container = document.getElementById('faq-items');
  container.innerHTML = '';
  (c.items || []).forEach((item, i) => addFAQItem(item, i));
}

function addServiceItem(data = {}, index) {
  const container = document.getElementById('services-items');
  const idx = index !== undefined ? index : container.children.length;
  const div = document.createElement('div');
  div.className = 'item-block';
  div.dataset.index = idx;
  div.innerHTML = `
    <div class="item-block-header">
      <span class="item-block-label">Service ${idx + 1}</span>
      <button type="button" class="btn-remove-item" onclick="this.closest('.item-block').remove()">Remove</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div class="cms-field">
        <label class="cms-label">Icon (globe/smartphone/database/code)</label>
        <input type="text" class="cms-input svc-icon" value="${escHtml(data.icon || '')}" placeholder="globe" />
      </div>
      <div class="cms-field">
        <label class="cms-label">Title</label>
        <input type="text" class="cms-input svc-title" value="${escHtml(data.title || '')}" placeholder="Service title" />
      </div>
    </div>
    <div class="cms-field">
      <label class="cms-label">Description</label>
      <textarea class="cms-textarea svc-desc" style="min-height:70px;">${escHtml(data.description || '')}</textarea>
    </div>
    <div class="cms-field">
      <label class="cms-label">Features (comma-separated)</label>
      <input type="text" class="cms-input svc-features" value="${escHtml((data.features || []).join(', '))}" placeholder="Feature 1, Feature 2, Feature 3" />
    </div>
  `;
  container.appendChild(div);
}

function addFAQItem(data = {}, index) {
  const container = document.getElementById('faq-items');
  const idx = index !== undefined ? index : container.children.length;
  const div = document.createElement('div');
  div.className = 'item-block';
  div.innerHTML = `
    <div class="item-block-header">
      <span class="item-block-label">FAQ ${idx + 1}</span>
      <button type="button" class="btn-remove-item" onclick="this.closest('.item-block').remove()">Remove</button>
    </div>
    <div class="cms-field">
      <label class="cms-label">Question</label>
      <input type="text" class="cms-input faq-q" value="${escHtml(data.question || '')}" placeholder="Enter question..." />
    </div>
    <div class="cms-field">
      <label class="cms-label">Answer</label>
      <textarea class="cms-textarea faq-a" style="min-height:80px;">${escHtml(data.answer || '')}</textarea>
    </div>
  `;
  container.appendChild(div);
}

async function saveCMS(section) {
  const statusEl = document.getElementById(`${section}-status`);
  let content = {};

  try {
    switch (section) {
      case 'hero':
        content = {
          headline: getVal('hero-headline'),
          subheadline: getVal('hero-subheadline'),
          cta_primary: getVal('hero-cta1'),
          cta_secondary: getVal('hero-cta2'),
        };
        break;
      case 'about':
        content = {
          title: getVal('about-title'),
          intro: getVal('about-intro'),
          mission: getVal('about-mission'),
          skills: getVal('about-skills').split(',').map(s => s.trim()).filter(Boolean),
        };
        break;
      case 'services':
        content = {
          title: getVal('services-title'),
          items: Array.from(document.querySelectorAll('#services-items .item-block')).map(block => ({
            icon: block.querySelector('.svc-icon').value.trim(),
            title: block.querySelector('.svc-title').value.trim(),
            description: block.querySelector('.svc-desc').value.trim(),
            features: block.querySelector('.svc-features').value.split(',').map(s => s.trim()).filter(Boolean),
          })),
        };
        break;
      case 'faq':
        content = {
          title: getVal('faq-title'),
          items: Array.from(document.querySelectorAll('#faq-items .item-block')).map(block => ({
            question: block.querySelector('.faq-q').value.trim(),
            answer: block.querySelector('.faq-a').value.trim(),
          })).filter(item => item.question),
        };
        break;
    }

    const { error } = await supabaseClient.from('cms_content').upsert({ id: section, content, updated_at: new Date().toISOString() });
    if (error) throw error;

    statusEl.textContent = '✓ Saved!';
    statusEl.className = 'cms-save-status ok';
    toast('success', `${section} section saved!`);
    setTimeout(() => { statusEl.className = 'cms-save-status'; }, 3000);
  } catch (e) {
    statusEl.textContent = '✕ Save failed.';
    statusEl.className = 'cms-save-status err';
    toast('error', 'Save failed: ' + (e.message || e));
  }
}

// ══════════════════════════════════
//   PROJECTS MANAGER
// ══════════════════════════════════
let allProjects = [];

async function loadProjects() {
  const { data } = await supabaseClient.from('projects').select('*').order('sort_order');
  allProjects = data || [];
  renderProjectsManage();
}

function renderProjectsManage() {
  const grid = document.getElementById('projects-manage-grid');
  grid.innerHTML = allProjects.map(p => `
    <div class="manage-card">
      <div class="manage-card-title">
        ${escHtml(p.title)}
        ${p.is_visible ? '' : '<span style="font-size:0.7rem;color:var(--text-subtle);font-weight:400;">(hidden)</span>'}
      </div>
      <div class="manage-card-text">${escHtml(truncate(p.description || '', 100))}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;">
        ${(p.tech_stack || []).map(t => `<span style="font-size:0.72rem;padding:3px 8px;background:rgba(56,189,248,0.08);border:1px solid rgba(56,189,248,0.2);color:var(--accent);border-radius:99px;">${escHtml(t)}</span>`).join('')}
      </div>
      <div class="manage-card-actions">
        <button class="btn-sm edit" onclick="editProject('${p.id}')">Edit</button>
        <button class="btn-sm delete" onclick="deleteProject('${p.id}')">Delete</button>
      </div>
    </div>
  `).join('') + `
    <div class="add-btn-card" onclick="openModal('project')">
      <span class="plus">+</span>
      <span>Add Project</span>
    </div>
  `;
}

async function deleteProject(id) {
  if (!confirm('Delete this project?')) return;
  const { error } = await supabaseClient.from('projects').delete().eq('id', id);
  if (error) { toast('error', 'Delete failed.'); return; }
  allProjects = allProjects.filter(p => p.id !== id);
  renderProjectsManage();
  toast('success', 'Project deleted.');
}

function editProject(id) {
  editingId = id;
  const p = allProjects.find(x => x.id === id);
  if (!p) return;
  openModal('project', p);
}

// ══════════════════════════════════
//   TESTIMONIALS MANAGER
// ══════════════════════════════════
let allTesti = [];

async function loadTestimonials() {
  const { data } = await supabaseClient.from('testimonials').select('*').order('sort_order');
  allTesti = data || [];
  renderTestimonialsManage();
}

function renderTestimonialsManage() {
  const grid = document.getElementById('testi-manage-grid');
  grid.innerHTML = allTesti.map(t => `
    <div class="manage-card">
      <div class="manage-card-title">
        ${escHtml(t.client_name)}
        <span style="color:#f59e0b;font-size:0.85rem;">★${'★'.repeat((t.rating || 5) - 1)}</span>
      </div>
      <div class="manage-card-text">${escHtml(truncate(t.feedback || '', 100))}</div>
      <div class="manage-card-actions">
        <button class="btn-sm edit" onclick="editTestimonial('${t.id}')">Edit</button>
        <button class="btn-sm delete" onclick="deleteTestimonial('${t.id}')">Delete</button>
      </div>
    </div>
  `).join('') + `
    <div class="add-btn-card" onclick="openModal('testimonial')">
      <span class="plus">+</span>
      <span>Add Testimonial</span>
    </div>
  `;
}

async function deleteTestimonial(id) {
  if (!confirm('Delete this testimonial?')) return;
  const { error } = await supabaseClient.from('testimonials').delete().eq('id', id);
  if (error) { toast('error', 'Delete failed.'); return; }
  allTesti = allTesti.filter(t => t.id !== id);
  renderTestimonialsManage();
  toast('success', 'Testimonial deleted.');
}

function editTestimonial(id) {
  editingId = id;
  const t = allTesti.find(x => x.id === id);
  if (!t) return;
  openModal('testimonial', t);
}

// ══════════════════════════════════
//   SEO SETTINGS
// ══════════════════════════════════
async function loadSEO() {
  const { data } = await supabaseClient.from('seo_settings').select('*').eq('id', 'main').single();
  if (!data) return;
  setVal('seo-title', data.meta_title);
  setVal('seo-desc', data.meta_description);
  setVal('seo-keywords', data.meta_keywords);
  setVal('seo-og-title', data.og_title);
  setVal('seo-og-desc', data.og_description);
}

async function saveSEO() {
  const payload = {
    id: 'main',
    meta_title: getVal('seo-title'),
    meta_description: getVal('seo-desc'),
    meta_keywords: getVal('seo-keywords'),
    og_title: getVal('seo-og-title'),
    og_description: getVal('seo-og-desc'),
  };

  const { error } = await supabaseClient.from('seo_settings').upsert(payload);
  if (error) {
    toast('error', 'SEO save failed.');
    return;
  }
  toast('success', 'SEO settings saved!');
  const statusEl = document.getElementById('seo-status');
  statusEl.textContent = '✓ Saved!';
  statusEl.className = 'cms-save-status ok';
  setTimeout(() => { statusEl.className = 'cms-save-status'; }, 3000);
}

// ══════════════════════════════════
//   SECTION VISIBILITY
// ══════════════════════════════════
async function loadVisibility() {
  const { data } = await supabaseClient.from('section_visibility').select('*');
  const grid = document.getElementById('visibility-grid');
  if (!data || !grid) return;

  const icons = { hero: '🏠', about: '👤', services: '⚙️', projects: '💼', testimonials: '💬', faq: '❓', contact: '📬' };

  grid.innerHTML = data.map(row => `
    <div class="visibility-card">
      <div class="visibility-label">
        ${icons[row.section_id] || '📄'}
        <span style="text-transform:capitalize;">${row.section_id}</span>
      </div>
      <label class="toggle-switch">
        <input type="checkbox" ${row.is_visible ? 'checked' : ''} onchange="toggleVisibility('${row.section_id}', this.checked)" />
        <span class="toggle-slider"></span>
      </label>
    </div>
  `).join('');
}

async function toggleVisibility(sectionId, isVisible) {
  const { error } = await supabaseClient.from('section_visibility').upsert({ section_id: sectionId, is_visible: isVisible });
  if (error) { toast('error', 'Failed to update visibility.'); return; }
  toast('success', `${sectionId} section ${isVisible ? 'shown' : 'hidden'}.`);
}

// ══════════════════════════════════
//   MODAL
// ══════════════════════════════════
function openModal(type, data = null) {
  modalMode = type;
  editingId = data ? data.id : null;
  document.getElementById('modal-overlay').classList.add('open');

  const title = data
    ? `Edit ${type === 'project' ? 'Project' : 'Testimonial'}`
    : `Add ${type === 'project' ? 'Project' : 'Testimonial'}`;
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = type === 'project'
    ? getProjectForm(data)
    : getTestimonialForm(data);
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  editingId = null;
  modalMode = null;
}

function getProjectForm(d) {
  return `
    <div class="form-group">
      <label class="form-label">Title *</label>
      <input type="text" id="m-proj-title" class="form-input" value="${escHtml(d?.title || '')}" placeholder="Project name" required />
    </div>
    <div class="form-group">
      <label class="form-label">Description</label>
      <textarea id="m-proj-desc" class="form-input" style="resize:vertical;min-height:80px;" placeholder="Short description...">${escHtml(d?.description || '')}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Tech Stack (comma-separated)</label>
      <input type="text" id="m-proj-tech" class="form-input" value="${escHtml((d?.tech_stack || []).join(', '))}" placeholder="Flutter, React, Supabase" />
    </div>
    <div class="form-group">
      <label class="form-label">Image URL</label>
      <input type="url" id="m-proj-img" class="form-input" value="${escHtml(d?.image_url || '')}" placeholder="https://..." />
    </div>
    <div class="form-group">
      <label class="form-label">Project Link</label>
      <input type="url" id="m-proj-link" class="form-input" value="${escHtml(d?.link_url || '')}" placeholder="https://..." />
    </div>
    <div class="form-group">
      <label class="form-label">Sort Order</label>
      <input type="number" id="m-proj-order" class="form-input" value="${d?.sort_order ?? 0}" min="0" />
    </div>
    <label style="display:flex;align-items:center;gap:10px;cursor:pointer;margin-top:4px;">
      <label class="toggle-switch" style="width:44px;height:24px;flex-shrink:0;">
        <input type="checkbox" id="m-proj-visible" ${d?.is_visible !== false ? 'checked' : ''} />
        <span class="toggle-slider"></span>
      </label>
      <span style="font-size:0.88rem;color:var(--text-muted);">Visible on site</span>
    </label>
  `;
}

function getTestimonialForm(d) {
  return `
    <div class="form-group">
      <label class="form-label">Client Name *</label>
      <input type="text" id="m-testi-name" class="form-input" value="${escHtml(d?.client_name || '')}" placeholder="Client name" required />
    </div>
    <div class="form-group">
      <label class="form-label">Feedback *</label>
      <textarea id="m-testi-feedback" class="form-input" style="resize:vertical;min-height:120px;" placeholder="Client feedback..." required>${escHtml(d?.feedback || '')}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Rating (1-5)</label>
      <input type="number" id="m-testi-rating" class="form-input" value="${d?.rating ?? 5}" min="1" max="5" />
    </div>
    <div class="form-group">
      <label class="form-label">Sort Order</label>
      <input type="number" id="m-testi-order" class="form-input" value="${d?.sort_order ?? 0}" min="0" />
    </div>
    <label style="display:flex;align-items:center;gap:10px;cursor:pointer;margin-top:4px;">
      <label class="toggle-switch" style="width:44px;height:24px;flex-shrink:0;">
        <input type="checkbox" id="m-testi-visible" ${d?.is_visible !== false ? 'checked' : ''} />
        <span class="toggle-slider"></span>
      </label>
      <span style="font-size:0.88rem;color:var(--text-muted);">Visible on site</span>
    </label>
  `;
}

async function handleModalSubmit(e) {
  e.preventDefault();
  const saveBtn = document.getElementById('modal-save');
  saveBtn.disabled = true;

  try {
    if (modalMode === 'project') {
      const payload = {
        title: document.getElementById('m-proj-title').value.trim(),
        description: document.getElementById('m-proj-desc').value.trim(),
        tech_stack: document.getElementById('m-proj-tech').value.split(',').map(s => s.trim()).filter(Boolean),
        image_url: document.getElementById('m-proj-img').value.trim() || null,
        link_url: document.getElementById('m-proj-link').value.trim() || null,
        sort_order: parseInt(document.getElementById('m-proj-order').value) || 0,
        is_visible: document.getElementById('m-proj-visible').checked,
      };

      if (!payload.title) { toast('error', 'Title is required.'); saveBtn.disabled = false; return; }

      if (editingId) {
        await supabaseClient.from('projects').update(payload).eq('id', editingId);
        toast('success', 'Project updated!');
      } else {
        await supabaseClient.from('projects').insert(payload);
        toast('success', 'Project added!');
      }
      await loadProjects();

    } else if (modalMode === 'testimonial') {
      const payload = {
        client_name: document.getElementById('m-testi-name').value.trim(),
        feedback: document.getElementById('m-testi-feedback').value.trim(),
        rating: parseInt(document.getElementById('m-testi-rating').value) || 5,
        sort_order: parseInt(document.getElementById('m-testi-order').value) || 0,
        is_visible: document.getElementById('m-testi-visible').checked,
      };

      if (!payload.client_name || !payload.feedback) { toast('error', 'Name and feedback are required.'); saveBtn.disabled = false; return; }

      if (editingId) {
        await supabaseClient.from('testimonials').update(payload).eq('id', editingId);
        toast('success', 'Testimonial updated!');
      } else {
        await supabaseClient.from('testimonials').insert(payload);
        toast('success', 'Testimonial added!');
      }
      await loadTestimonials();
    }

    closeModal();
    loadDashboard();
  } catch (err) {
    toast('error', 'Save failed: ' + (err.message || err));
  } finally {
    saveBtn.disabled = false;
  }
}

// ══════════════════════════════════
//   CMS CARD TOGGLE
// ══════════════════════════════════
function toggleCmsCard(name) {
  document.getElementById(`cms-${name}`).classList.toggle('expanded');
}

// ══════════════════════════════════
//   TOAST
// ══════════════════════════════════
function toast(type, message) {
  const container = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = message;
  container.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

// ══════════════════════════════════
//   UTILS
// ══════════════════════════════════
function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val || '';
}

function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function truncate(str, max) {
  return str.length > max ? str.substring(0, max) + '…' : str;
}

function formatDate(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

// Close modal on overlay click
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});
