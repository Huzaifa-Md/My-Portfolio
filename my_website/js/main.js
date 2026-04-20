// ═══════════════════════════════════════════════════════════════
//   HELLODEV — MAIN PORTFOLIO JAVASCRIPT
// ═══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {

  // ── FOOTER YEAR ──
  document.getElementById('footer-year').textContent = new Date().getFullYear();

  // ── NAVBAR SCROLL ──
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
  });

  // ── HAMBURGER MENU ──
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('nav-links');

  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    navLinks.classList.toggle('mobile-open');
  });

  // Close menu on link click
  navLinks.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('open');
      navLinks.classList.remove('mobile-open');
    });
  });

  // ── ACTIVE NAV LINK ON SCROLL ──
  const sections = document.querySelectorAll('.section');
  const navItems = document.querySelectorAll('.nav-link');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navItems.forEach(item => {
          item.classList.toggle('active', item.dataset.section === id);
        });
      }
    });
  }, { threshold: 0.3, rootMargin: '-80px 0px -60% 0px' });

  sections.forEach(s => observer.observe(s));

  // ── SCROLL ANIMATIONS ──
  const animateObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        animateObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('.animate-fade-up, .animate-fade-right, .animate-fade-left').forEach(el => {
    animateObserver.observe(el);
  });

  // ── LOAD CMS CONTENT + SECTIONS ──
  try {
    const [cmsRes, visibilityRes] = await Promise.all([
      supabaseClient.from('cms_content').select('*'),
      supabaseClient.from('section_visibility').select('*'),
      supabaseClient.from('seo_settings').select('*').eq('id', 'main').single()
    ]);

    // Section Visibility
    if (visibilityRes.data) {
      visibilityRes.data.forEach(row => {
        if (!row.is_visible) {
          const el = document.getElementById(row.section_id);
          if (el) el.style.display = 'none';
        }
      });
    }

    // CMS Content
    if (cmsRes.data) {
      cmsRes.data.forEach(row => {
        switch (row.id) {
          case 'hero': renderHero(row.content); break;
          case 'about': renderAbout(row.content); break;
          case 'services': renderServices(row.content); break;
          case 'faq': renderFAQ(row.content); break;
        }
      });
    }
  } catch (e) {
    // Fallback to static content already in HTML
  }

  // Load SEO
  try {
    const { data: seo } = await supabaseClient.from('seo_settings').select('*').eq('id', 'main').single();
    if (seo) applySEO(seo);
  } catch (_) {}

  // ── LOAD PROJECTS ──
  try {
    const { data: projects } = await supabaseClient.from('projects').select('*').order('sort_order');
    if (projects && projects.length > 0) renderProjects(projects);
  } catch (_) {}

  // ── LOAD TESTIMONIALS ──
  try {
    const { data: testi } = await supabaseClient.from('testimonials').select('*').order('sort_order');
    if (testi && testi.length > 0) renderTestimonials(testi);
  } catch (_) {}

  // ── CONTACT FORM SUBMIT ──
  const form = document.getElementById('contact-form');
  const formStatus = document.getElementById('form-status');
  const submitBtn = document.getElementById('submit-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('lead-name').value.trim();
    const email = document.getElementById('lead-email').value.trim();
    const phone = document.getElementById('lead-phone').value.trim();
    const message = document.getElementById('lead-message').value.trim();

    if (!name || !email || !message) {
      showFormStatus('error', '⚠ Please fill in all required fields.');
      return;
    }

    if (!isValidEmail(email)) {
      showFormStatus('error', '⚠ Please enter a valid email address.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-text').textContent = 'Sending...';

    try {
      const { error } = await supabaseClient.from('leads').insert({ name, email, phone, message });

      if (error) throw error;

      showFormStatus('success', '✓ Message sent! I will get back to you within 24 hours.');
      form.reset();

      // Send email notification (best-effort, non-blocking)
      fetch(`${SUPABASE_URL}/functions/v1/notify-lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, message }),
      }).catch(() => {}); // silently ignore if notification fails

    } catch (err) {
      showFormStatus('error', '✕ Something went wrong. Please try again or contact directly.');
      console.error(err);
    } finally {
      submitBtn.disabled = false;
      submitBtn.querySelector('.btn-text').textContent = 'Send Message';
    }
  });

  function showFormStatus(type, msg) {
    formStatus.className = 'form-status ' + type;
    formStatus.textContent = msg;
    formStatus.style.display = 'block';
    setTimeout(() => { formStatus.style.display = 'none'; }, 6000);
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
});

// ══════════════════════════════════
//   RENDER FUNCTIONS
// ══════════════════════════════════

function applySEO(seo) {
  if (seo.meta_title) {
    document.title = seo.meta_title;
    const el = document.getElementById('meta-title');
    if (el) el.textContent = seo.meta_title;
  }
  if (seo.meta_description) {
    const el = document.getElementById('meta-desc');
    if (el) el.setAttribute('content', seo.meta_description);
  }
  if (seo.meta_keywords) {
    const el = document.getElementById('meta-keywords');
    if (el) el.setAttribute('content', seo.meta_keywords);
  }
  if (seo.og_title) document.getElementById('og-title')?.setAttribute('content', seo.og_title);
  if (seo.og_description) document.getElementById('og-desc')?.setAttribute('content', seo.og_description);
}

function renderHero(content) {
  if (content.headline) {
    const el = document.getElementById('hero-headline');
    if (el) el.textContent = content.headline;
  }
  if (content.subheadline) {
    const el = document.getElementById('hero-sub');
    if (el) el.textContent = content.subheadline;
  }
  if (content.cta_primary) {
    const el = document.getElementById('hero-cta-primary');
    if (el) el.textContent = content.cta_primary;
  }
  if (content.cta_secondary) {
    const el = document.getElementById('hero-cta-secondary');
    if (el) el.textContent = content.cta_secondary;
  }
}

function renderAbout(content) {
  if (content.title) {
    const el = document.getElementById('about-title');
    if (el) el.textContent = content.title;
  }
  if (content.intro) {
    const el = document.getElementById('about-intro');
    if (el) el.textContent = content.intro;
  }
  if (content.mission) {
    const el = document.getElementById('about-mission');
    if (el) el.textContent = content.mission;
  }
  if (content.skills && Array.isArray(content.skills)) {
    const grid = document.getElementById('skills-grid');
    if (grid) {
      grid.innerHTML = content.skills.map(s =>
        `<span class="skill-tag">✦ ${s}</span>`
      ).join('');
    }
  }
}

function renderServices(content) {
  const iconMap = { globe: '🌐', smartphone: '📱', database: '🗄️', code: '💻', design: '🎨', cloud: '☁️' };
  const grid = document.getElementById('services-grid');
  if (!grid || !content.items) return;

  grid.innerHTML = content.items.map((svc, i) => `
    <div class="service-card animate-fade-up delay-${i + 1}">
      <div class="service-icon-wrapper">${iconMap[svc.icon] || '⚡'}</div>
      <h3 class="service-title">${escHtml(svc.title)}</h3>
      <p class="service-desc">${escHtml(svc.description)}</p>
      ${svc.features ? `
        <div class="service-features">
          ${svc.features.map(f => `<span class="service-feature">${escHtml(f)}</span>`).join('')}
        </div>
      ` : ''}
    </div>
  `).join('');

  // Re-observe new elements
  const animateObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        animateObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  grid.querySelectorAll('.animate-fade-up').forEach(el => animateObserver.observe(el));
}

function renderProjects(projects) {
  const emojiMap = ['💼', '🚀', '📊', '🛒', '📱', '🌐', '⚙️'];
  const grid = document.getElementById('projects-grid');
  if (!grid) return;

  grid.innerHTML = projects.map((p, i) => `
    <div class="project-card animate-fade-up">
      <div class="project-img-wrapper">
        ${p.image_url
          ? `<img src="${escHtml(p.image_url)}" alt="${escHtml(p.title)}" class="project-img" loading="lazy">`
          : `<div class="project-img-placeholder">${emojiMap[i % emojiMap.length]}</div>`
        }
      </div>
      <div class="project-body">
        <h3 class="project-title">${escHtml(p.title)}</h3>
        <p class="project-desc">${escHtml(p.description || '')}</p>
        ${p.tech_stack ? `
          <div class="project-tech">
            ${p.tech_stack.map(t => `<span class="tech-tag">${escHtml(t)}</span>`).join('')}
          </div>
        ` : ''}
        ${p.link_url && p.link_url !== '#' ? `
          <a href="${escHtml(p.link_url)}" target="_blank" rel="noopener" class="project-link">View Project →</a>
        ` : ''}
      </div>
    </div>
  `).join('');

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }});
  }, { threshold: 0.1 });
  grid.querySelectorAll('.animate-fade-up').forEach(el => obs.observe(el));
}

// ── TESTIMONIALS CAROUSEL ──
let currentSlide = 0;

function renderTestimonials(items) {
  const track = document.getElementById('testimonials-track');
  const dotsContainer = document.getElementById('carousel-dots');
  if (!track) return;

  track.innerHTML = items.map(t => `
    <div class="testimonial-slide">
      <div class="testimonial-card">
        <div class="testi-stars">
          ${'<span class="star">★</span>'.repeat(Math.min(t.rating || 5, 5))}
        </div>
        <p class="testi-quote">"${escHtml(t.feedback)}"</p>
        <div class="testi-author">
          <div class="testi-avatar">${escHtml(t.client_name.substring(0, 2).toUpperCase())}</div>
          <div>
            <div class="testi-name">${escHtml(t.client_name)}</div>
          </div>
        </div>
      </div>
    </div>
  `).join('');

  // Dots
  dotsContainer.innerHTML = items.map((_, i) =>
    `<button class="carousel-dot ${i === 0 ? 'active' : ''}" aria-label="Slide ${i + 1}" data-slide="${i}"></button>`
  ).join('');

  dotsContainer.querySelectorAll('.carousel-dot').forEach(dot => {
    dot.addEventListener('click', () => goToSlide(parseInt(dot.dataset.slide), items.length));
  });

  document.getElementById('testi-prev').addEventListener('click', () => {
    goToSlide(currentSlide === 0 ? items.length - 1 : currentSlide - 1, items.length);
  });

  document.getElementById('testi-next').addEventListener('click', () => {
    goToSlide(currentSlide === items.length - 1 ? 0 : currentSlide + 1, items.length);
  });

  // Auto-advance
  setInterval(() => {
    goToSlide(currentSlide === items.length - 1 ? 0 : currentSlide + 1, items.length);
  }, 5000);
}

function goToSlide(index, total) {
  currentSlide = index;
  document.getElementById('testimonials-track').style.transform = `translateX(-${index * 100}%)`;
  document.querySelectorAll('.carousel-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === index);
  });
}

// ── FAQ ACCORDION ──
function renderFAQ(content) {
  const container = document.getElementById('faq-container');
  if (!container || !content.items) return;

  container.innerHTML = content.items.map((item, i) => `
    <div class="faq-item animate-fade-up" id="faq-item-${i}">
      <div class="faq-question" onclick="toggleFAQ(${i})">
        <span>${escHtml(item.question)}</span>
        <span class="faq-icon">+</span>
      </div>
      <div class="faq-answer">
        <div class="faq-answer-inner">${escHtml(item.answer)}</div>
      </div>
    </div>
  `).join('');

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }});
  }, { threshold: 0.1 });
  container.querySelectorAll('.animate-fade-up').forEach(el => obs.observe(el));
}

function toggleFAQ(index) {
  const item = document.getElementById(`faq-item-${index}`);
  if (!item) return;
  const isOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(el => el.classList.remove('open'));
  if (!isOpen) item.classList.add('open');
}

// ── UTILS ──
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
