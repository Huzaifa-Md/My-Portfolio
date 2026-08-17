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
  let projectMeta = {};
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
          case 'industries': renderIndustries(row.content); break;
          case 'process': renderProcess(row.content); break;
          case 'project_meta': projectMeta = row.content; break;
        }
      });
    }

    // Fallbacks for Repositioning
    if (!cmsRes.data?.find(r => r.id === 'industries')) renderIndustries({ items: [
      { icon: '🍽️', title: 'Restaurant & Cafe' }, { icon: '⚕️', title: 'Healthcare & Clinics' },
      { icon: '🎓', title: 'Schools & Education' }, { icon: '🚀', title: 'Startups' }, { icon: '🏢', title: 'Local Businesses' }
    ]});
    if (!cmsRes.data?.find(r => r.id === 'process')) renderProcess({ items: [
      { title: 'Discovery Call', desc: 'Understanding your business needs and goals.' },
      { title: 'Planning', desc: 'Creating a strategic roadmap and architecture.' },
      { title: 'Design', desc: 'Crafting a premium user interface and experience.' },
      { title: 'Development', desc: 'Building scalable and robust solutions.' },
      { title: 'Launch', desc: 'Deploying your new digital presence.' },
      { title: 'Support', desc: 'Ongoing maintenance and growth optimization.' }
    ]});
  } catch (e) {
    // Fallback to static content already in HTML
  }

  // Load SEO
  try {
    const { data: seo } = await supabaseClient.from('seo_settings').select('*').eq('id', 'main').single();
    if (seo) applySEO(seo);
  } catch (_) {}



  // ── STATS COUNTER ANIMATION ──
  const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const counters = entry.target.querySelectorAll('.counter');
        counters.forEach(counter => {
          const target = +counter.getAttribute('data-target');
          const duration = 2000;
          const increment = target / (duration / 16);
          let current = 0;
          const updateCounter = () => {
            current += increment;
            if (current < target) {
              counter.innerText = Math.ceil(current);
              requestAnimationFrame(updateCounter);
            } else {
              counter.innerText = target;
            }
          };
          updateCounter();
        });
        statsObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });
  
  const statsSection = document.getElementById('about-stats');
  if (statsSection) statsObserver.observe(statsSection);

  // ── STATIC FAQ ACCORDION ──
  const faqQuestions = document.querySelectorAll('.static-faq-question');
  faqQuestions.forEach(question => {
    question.addEventListener('click', () => {
      const item = question.parentElement;
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.static-faq-item.open').forEach(el => el.classList.remove('open'));
      if (!isOpen) {
        item.classList.add('open');
      }
    });
  });

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




function renderIndustries(content) {
  const grid = document.getElementById('industries-grid');
  if (!grid || !content.items) return;

  grid.innerHTML = content.items.map((ind, i) => `
    <div class="industry-card animate-fade-up delay-${(i % 4) + 1}">
      <span class="industry-icon">${escHtml(ind.icon || '🏢')}</span>
      <h3 class="industry-title">${escHtml(ind.title)}</h3>
    </div>
  `).join('');

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }});
  }, { threshold: 0.1 });
  grid.querySelectorAll('.animate-fade-up').forEach(el => obs.observe(el));
}

function renderProcess(content) {
  const container = document.getElementById('process-timeline');
  if (!container || !content.items) return;

  container.innerHTML = content.items.map((step, i) => `
    <div class="process-step animate-fade-up delay-${(i % 3) + 1}">
      <div class="process-number">${i + 1}</div>
      <div class="process-content">
        <h3 class="process-title">${escHtml(step.title)}</h3>
        <p class="process-desc">${escHtml(step.desc)}</p>
      </div>
    </div>
  `).join('');

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }});
  }, { threshold: 0.1 });
  container.querySelectorAll('.animate-fade-up').forEach(el => obs.observe(el));
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

// ── PROJECT CAROUSEL & LIGHTBOX ──
function phCarousel(index) {
  const slides = document.querySelectorAll('.ph-slide');
  const pills = document.querySelectorAll('.cpill');
  
  if (!slides.length || !pills.length) return;

  slides.forEach((slide, i) => {
    if (i === index) slide.classList.add('active');
    else slide.classList.remove('active');
  });

  pills.forEach((pill, i) => {
    if (i === index) pill.classList.add('active');
    else pill.classList.remove('active');
  });
}

function openLightbox(src, captionText) {
  const lightbox = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  const caption = document.getElementById('lightbox-caption');
  
  if (!lightbox || !img) return;
  
  img.src = src;
  if (caption) caption.textContent = captionText || '';
  
  lightbox.classList.add('active');
  document.body.style.overflow = 'hidden'; // Prevent scrolling
}

function closeLightbox() {
  const lightbox = document.getElementById('lightbox');
  if (!lightbox) return;
  
  lightbox.classList.remove('active');
  document.body.style.overflow = '';
}

// Close lightbox on escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeLightbox();
});
