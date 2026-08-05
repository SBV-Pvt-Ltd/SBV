document.addEventListener('DOMContentLoaded', () => {

  /* ---------- Disclaimer gate ---------- */
  const gate = document.getElementById('disclaimerGate');
  const agreeBtn = document.getElementById('disclaimerAgree');
  agreeBtn.addEventListener('click', () => {
    gate.classList.add('hidden');
    document.body.style.overflow = '';
  });
  document.body.style.overflow = 'hidden';
  setTimeout(() => { document.body.style.overflow = gate.classList.contains('hidden') ? '' : 'hidden'; }, 50);

  /* ---------- Sticky nav shrink ---------- */
  const nav = document.getElementById('siteNav');
  const onScroll = () => {
    if (window.scrollY > 40) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile nav ---------- */
  const burger = document.getElementById('navBurger');
  const navLinks = document.getElementById('navLinks');
  burger.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    burger.setAttribute('aria-expanded', open);
    if (open) {
      const navBottom = nav.getBoundingClientRect().bottom;
      navLinks.style.cssText = `display:flex;flex-direction:column;position:fixed;top:${navBottom}px;left:0;right:0;max-height:calc(100vh - ${navBottom}px);overflow-y:auto;background:rgba(243,238,227,0.98);backdrop-filter:blur(14px);padding:24px;gap:20px;border-bottom:1px solid rgba(20,22,26,0.1);z-index:499;`;
      document.body.style.overflow = 'hidden';
    } else {
      navLinks.removeAttribute('style');
      document.body.style.overflow = '';
    }
  });
  navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    navLinks.classList.remove('open');
    navLinks.removeAttribute('style');
  }));

  /* ---------- Scroll reveal ---------- */
  const revealEls = document.querySelectorAll('.reveal');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
  revealEls.forEach(el => io.observe(el));

  /* ---------- Animated counters ---------- */
  const counters = document.querySelectorAll('.counter');
  const counterIO = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseInt(el.dataset.count, 10);
      const duration = 1600;
      const start = performance.now();
      const step = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(eased * target);
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      counterIO.unobserve(el);
    });
  }, { threshold: 0.5 });
  counters.forEach(c => counterIO.observe(c));

  /* ---------- Hero particles ---------- */
  const particleHost = document.getElementById('heroParticles');
  if (particleHost) {
    const count = 16;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('span');
      const left = Math.random() * 100;
      const delay = Math.random() * 8;
      const duration = 6 + Math.random() * 6;
      p.style.left = left + '%';
      p.style.bottom = '0';
      p.style.animationDelay = delay + 's';
      p.style.animationDuration = duration + 's';
      particleHost.appendChild(p);
    }
  }

  /* ---------- Testimonial carousel ---------- */
  const track = document.getElementById('testimonialTrack');
  const slides = track ? track.children.length : 0;
  const dotsHost = document.getElementById('tDots');
  let current = 0;

  if (track && slides > 0) {
    for (let i = 0; i < slides; i++) {
      const dot = document.createElement('span');
      if (i === 0) dot.classList.add('active');
      dot.addEventListener('click', () => goTo(i));
      dotsHost.appendChild(dot);
    }

    function goTo(index) {
      current = (index + slides) % slides;
      track.style.transform = `translateX(-${current * 100}%)`;
      [...dotsHost.children].forEach((d, i) => d.classList.toggle('active', i === current));
    }

    document.getElementById('tPrev').addEventListener('click', () => goTo(current - 1));
    document.getElementById('tNext').addEventListener('click', () => goTo(current + 1));

    let autoplay = setInterval(() => goTo(current + 1), 6500);
    const wrap = document.querySelector('.testimonial-wrap');
    wrap.addEventListener('mouseenter', () => clearInterval(autoplay));
    wrap.addEventListener('mouseleave', () => { autoplay = setInterval(() => goTo(current + 1), 6500); });
  }

  /* ---------- FAQ accordion ---------- */
  document.querySelectorAll('.faq-item').forEach(item => {
    const q = item.querySelector('.faq-q');
    const a = item.querySelector('.faq-a');
    q.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(other => {
        if (other !== item) {
          other.classList.remove('open');
          other.querySelector('.faq-a').style.maxHeight = null;
        }
      });
      item.classList.toggle('open', !isOpen);
      a.style.maxHeight = !isOpen ? a.scrollHeight + 'px' : null;
    });
  });

  /* ---------- Consultation form validation ---------- */
  const form = document.getElementById('consultForm');
  const successPanel = document.getElementById('formSuccess');

  const validators = {
    name: v => v.trim().length > 1,
    phone: v => /^[+\d][\d\s-]{7,}$/.test(v.trim()),
    email: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
    area: v => v.trim().length > 0,
    message: v => v.trim().length > 4,
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let valid = true;

    Object.keys(validators).forEach(name => {
      const input = form.elements[name];
      const field = input.closest('.field');
      const ok = validators[name](input.value);
      field.classList.toggle('invalid', !ok);
      if (!ok) valid = false;
    });

    if (!valid) {
      const firstInvalid = form.querySelector('.field.invalid input, .field.invalid select, .field.invalid textarea');
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    const submitBtn = document.getElementById('consultSubmit');
    submitBtn.querySelector('.btn-label').textContent = 'Sending…';
    submitBtn.disabled = true;

    setTimeout(() => {
      successPanel.classList.add('show');
      submitBtn.querySelector('.btn-label').textContent = 'Request a Consultation';
      submitBtn.disabled = false;
      form.reset();
      setTimeout(() => successPanel.classList.remove('show'), 5000);
    }, 900);
  });

  // clear invalid state as user types
  form.querySelectorAll('input, select, textarea').forEach(el => {
    el.addEventListener('input', () => el.closest('.field').classList.remove('invalid'));
  });

  /* ---------- Footer year ---------- */
  document.getElementById('year').textContent = new Date().getFullYear();

});
