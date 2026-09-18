import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { getAnalytics, isSupported, logEvent } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-analytics.js';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  getFirestore,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';
import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';

const app = isFirebaseConfigured() ? initializeApp(firebaseConfig) : null;
const db = app ? getFirestore(app) : null;
const analyticsReady = app
  ? isSupported()
    .then(supported => supported ? getAnalytics(app) : null)
    .catch(() => null)
  : Promise.resolve(null);
const viewedPlanIds = new Set();
const trafficSource = getTrafficSource();
const WHATSAPP_NUMBER = '919059740220';
const DEFAULT_PLAN_NOTE = 'Plan modifications start at ₹69. Additional charges may apply for custom requests.';
const PLANS_CACHE_KEY = 'perfectReveal.plans.v1';
const PLAN_NOTE_CACHE_KEY = 'perfectReveal.plansNote.v1';
const DEFAULT_PLANS = [
  {
    id: 'base-plan',
    name: 'Base Plan',
    price: 1234,
    priceSuffix: '/ surprise',
    description: 'Everything essential for a beautiful, thoughtful surprise.',
    features: ['Customised Cake', 'Rose Flower Bouquet', 'Complimentary Gift', 'Surprise at Doorstep'],
    badge: '',
    featured: false,
    visible: true,
    order: 10,
    whatsappText: ''
  },
  {
    id: 'gold-plan',
    name: 'Gold Plan',
    price: 1599,
    priceSuffix: '/ surprise',
    description: 'Elevated elegance with a keepsake to remember the moment.',
    features: ['Customised Cake', 'Rose Bouquet', 'Complimentary Gift', 'Photo Frame (8×12)', 'Surprise at Doorstep'],
    badge: '',
    featured: false,
    visible: true,
    order: 20,
    whatsappText: ''
  },
  {
    id: 'teddy-plan',
    name: 'Teddy Plan',
    price: 1499,
    priceSuffix: '/ surprise',
    description: 'Our popular choice — treats, roses and a cuddly surprise.',
    features: ['Customised Cake', 'Rose Flower Bouquet', 'Complimentary Gift', 'Teddy Man Surprise', 'Surprise at Doorstep'],
    badge: 'Most Popular',
    featured: true,
    visible: true,
    order: 30,
    whatsappText: ''
  },
  {
    id: 'teddy-premium',
    name: 'Teddy Premium',
    price: 2499,
    priceSuffix: '/ surprise',
    description: 'Premium teddy experience — keepsakes, prints and bigger smiles.',
    features: ['Customised Cake', 'Rose Flower Bouquet', 'Complimentary Gift', 'Teddy Man Surprise', 'Photo Frame (12×18)', 'Instant Hand Print', 'Surprise at Doorstep'],
    badge: '',
    featured: false,
    visible: true,
    order: 40,
    whatsappText: ''
  },
  {
    id: 'mega-teddy-plan',
    name: 'Mega Teddy Plan',
    price: 2799,
    priceSuffix: '/ surprise',
    description: 'Our most complete experience — big surprises and lasting keepsakes.',
    features: ['Customised Cake', 'Rose Flower Bouquet', 'Photo Frame', 'Hand Print', 'Complimentary Gift', 'Surprise at Doorstep', 'Sweet & Simple Decoration for Cake Cutting'],
    badge: '',
    featured: false,
    visible: true,
    order: 50,
    whatsappText: ''
  }
];

let renderedPlans = false;

function getTrafficSource() {
  const params = new URLSearchParams(window.location.search);
  const source = params.get('utm_source');
  const medium = params.get('utm_medium');
  const campaign = params.get('utm_campaign');
  if (source || medium || campaign) {
    return { source: source || 'unknown', medium: medium || 'unknown', campaign: campaign || 'none' };
  }
  if (document.referrer) {
    try {
      return { source: new URL(document.referrer).hostname, medium: 'referral', campaign: 'none' };
    } catch (error) {
      return { source: 'unknown', medium: 'unknown', campaign: 'none' };
    }
  }
  return { source: 'direct', medium: 'none', campaign: 'none' };
}

function readJsonCache(key) {
  try {
    const cached = window.localStorage.getItem(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    return null;
  }
}

function writeJsonCache(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // Ignore storage failures so private/incognito modes do not break rendering.
  }
}

function readTextCache(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

function writeTextCache(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    // Ignore storage failures so private/incognito modes do not break rendering.
  }
}

function formatRupees(value) {
  const amount = Number(value) || 0;
  return `₹${new Intl.NumberFormat('en-IN').format(amount)}`;
}

function sortedVisiblePlans(plans) {
  return plans
    .filter(plan => plan && plan.visible === true)
    .sort((first, second) => (Number(first.order) || 0) - (Number(second.order) || 0));
}

function createPlanCard(plan, index) {
  const card = document.createElement('div');
  card.className = `plan-card${plan.featured ? ' featured' : ''} reveal reveal-delay-${(index % 3) + 1}`;
  card.dataset.planId = String(plan.id || '');
  card.dataset.planName = String(plan.name || '');

  if (plan.badge) {
    const badge = document.createElement('div');
    badge.className = 'plan-badge';
    badge.textContent = `✦ ${plan.badge}`;
    card.appendChild(badge);
  }

  const name = document.createElement('div');
  name.className = 'plan-name';
  name.textContent = plan.name;
  card.appendChild(name);

  const price = document.createElement('div');
  price.className = 'plan-price';
  const rupee = document.createElement('sup');
  rupee.textContent = '₹';
  price.appendChild(rupee);
  price.appendChild(document.createTextNode(new Intl.NumberFormat('en-IN').format(Number(plan.price) || 0)));
  const suffix = document.createElement('span');
  suffix.textContent = ` ${plan.priceSuffix || '/ surprise'}`;
  price.appendChild(suffix);
  card.appendChild(price);

  const description = document.createElement('p');
  description.className = 'plan-desc';
  description.textContent = plan.description || '';
  card.appendChild(description);

  const features = document.createElement('ul');
  features.className = 'plan-features';
  (Array.isArray(plan.features) ? plan.features : []).forEach(feature => {
    const item = document.createElement('li');
    item.textContent = feature;
    features.appendChild(item);
  });
  card.appendChild(features);

  const button = document.createElement('button');
  button.className = 'plan-btn';
  button.type = 'button';
  const buttonText = document.createElement('span');
  buttonText.textContent = 'Select Plan';
  button.appendChild(buttonText);
  button.addEventListener('click', () => {
    trackPlanClick(plan);
    trackWhatsAppClick(button, plan);
    const message = plan.whatsappText?.trim()
      || `Hi! I'd like to book the ${plan.name} (${formatRupees(plan.price)})`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  });
  card.appendChild(button);

  return card;
}

function trackPlanClick(plan) {
  if (!db) return;
  addDoc(collection(db, 'planClicks'), {
    planId: String(plan.id || ''),
    planName: String(plan.name || ''),
    price: Number(plan.price) || 0,
    source: 'plans-page',
    createdAt: serverTimestamp()
  }).catch(() => {
    // Analytics must never prevent a visitor from contacting the business.
  });
  analyticsReady.then(analytics => {
    if (!analytics) return;
    logEvent(analytics, 'plan_click', {
      content_type: 'plan',
      item_id: String(plan.id || ''),
      item_name: String(plan.name || ''),
      source: trafficSource.source,
      medium: trafficSource.medium,
      campaign: trafficSource.campaign
    });
  });
}

function trackPlanView(card) {
  const planId = card.dataset.planId;
  if (!planId || viewedPlanIds.has(planId)) return;
  viewedPlanIds.add(planId);
  analyticsReady.then(analytics => {
    if (!analytics) return;
    logEvent(analytics, 'plan_view', {
      content_type: 'plan',
      item_id: planId,
      item_name: card.dataset.planName || '',
      source: trafficSource.source,
      medium: trafficSource.medium,
      campaign: trafficSource.campaign
    });
  });
}

const planViewObserver = typeof IntersectionObserver === 'undefined'
  ? null
  : new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) trackPlanView(entry.target);
    });
  }, { threshold: 0.5 });

function trackWhatsAppClick(button, plan = null) {
  analyticsReady.then(analytics => {
    if (!analytics) return;
    const eventData = {
      source: trafficSource.source,
      medium: trafficSource.medium,
      campaign: trafficSource.campaign,
      button_name: button.getAttribute('aria-label') || button.textContent.trim().slice(0, 40) || 'WhatsApp'
    };
    if (plan) {
      eventData.plan_id = String(plan.id || '');
      eventData.plan_name = String(plan.name || '');
      eventData.conversion_step = 'plan_to_whatsapp';
    }
    logEvent(analytics, 'whatsapp_click', eventData);
  });
}

function setupBookingAnalytics() {
  document.querySelectorAll('[data-whatsapp-booking], a[href^="https://wa.me/"]').forEach(button => {
    button.addEventListener('click', () => trackWhatsAppClick(button));
  });
}

analyticsReady.then(analytics => {
  if (!analytics) return;
  logEvent(analytics, 'page_view', {
    page_title: document.title,
    page_location: window.location.href,
    source: trafficSource.source,
    medium: trafficSource.medium,
    campaign: trafficSource.campaign
  });
});

function renderPlanSkeleton() {
  const grid = document.getElementById('plansGrid');
  if (!grid) return;
  grid.textContent = '';
  for (let index = 0; index < 3; index += 1) {
    const card = document.createElement('div');
    card.className = `plan-card reveal reveal-delay-${index + 1}`;
    const name = document.createElement('div');
    name.className = 'plan-name';
    name.textContent = 'Loading plan...';
    const description = document.createElement('p');
    description.className = 'plan-desc';
    description.textContent = 'Fetching the latest package details.';
    card.append(name, description);
    grid.appendChild(card);
  }
}

function renderPlans(plans) {
  const grid = document.getElementById('plansGrid');
  const footerPlans = document.getElementById('footerPlans');
  if (!grid || !footerPlans) return;

  const visiblePlans = sortedVisiblePlans(plans);
  grid.textContent = '';
  footerPlans.textContent = '';

  if (!visiblePlans.length) {
    const empty = document.createElement('div');
    empty.className = 'plan-card';
    const name = document.createElement('div');
    name.className = 'plan-name';
    name.textContent = 'No plans available';
    const description = document.createElement('p');
    description.className = 'plan-desc';
    description.textContent = 'Please check back soon or contact us on WhatsApp.';
    empty.append(name, description);
    grid.appendChild(empty);
    renderedPlans = true;
    return;
  }

  visiblePlans.forEach((plan, index) => {
    const card = createPlanCard(plan, index);
    grid.appendChild(card);
    if (typeof observer !== 'undefined') observer.observe(card);
    if (planViewObserver) planViewObserver.observe(card);

    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = '#plans';
    link.textContent = `${plan.name} — ${formatRupees(plan.price)}${plan.badge ? ` (${plan.badge})` : ''}`;
    item.appendChild(link);
    footerPlans.appendChild(item);
  });
  renderedPlans = true;
}

function renderPlanNote(note) {
  const noteElement = document.getElementById('plansNote');
  if (!noteElement) return;
  noteElement.textContent = `Note: ${note || DEFAULT_PLAN_NOTE}`;
}

function renderDefaultPlans() {
  renderPlans(DEFAULT_PLANS);
  renderPlanNote(DEFAULT_PLAN_NOTE);
}

function loadPlans() {
  const cachedPlans = readJsonCache(PLANS_CACHE_KEY);
  const cachedNote = readTextCache(PLAN_NOTE_CACHE_KEY);
  if (Array.isArray(cachedPlans)) {
    renderPlans(cachedPlans);
  } else {
    renderPlanSkeleton();
  }
  renderPlanNote(cachedNote || DEFAULT_PLAN_NOTE);

  if (!db) {
    if (!renderedPlans) renderDefaultPlans();
    return;
  }

  const fallbackTimer = window.setTimeout(() => {
    if (!renderedPlans) renderDefaultPlans();
  }, 3000);

  onSnapshot(collection(db, 'plans'), snapshot => {
    window.clearTimeout(fallbackTimer);
    const plans = snapshot.docs.map(planDoc => ({ id: planDoc.id, ...planDoc.data() }));
    writeJsonCache(PLANS_CACHE_KEY, plans);
    renderPlans(plans);
  }, error => {
    window.clearTimeout(fallbackTimer);
    if (!renderedPlans) renderDefaultPlans();
  });

  onSnapshot(doc(db, 'settings', 'plansPage'), snapshot => {
    const note = snapshot.exists() && typeof snapshot.data().note === 'string'
      ? snapshot.data().note
      : DEFAULT_PLAN_NOTE;
    writeTextCache(PLAN_NOTE_CACHE_KEY, note);
    renderPlanNote(note);
  }, error => {
    renderPlanNote(cachedNote || DEFAULT_PLAN_NOTE);
  });
}

// PARTICLES
const canvas = document.getElementById('particles');
const ctx = canvas.getContext('2d');
let W;
let H;
const particles = [];

function resize() {
  W = canvas.width = canvas.offsetWidth;
  H = canvas.height = canvas.offsetHeight;
}

resize();
window.addEventListener('resize', resize);
for (let i = 0; i < 80; i += 1) {
  particles.push({
    x: Math.random() * 2000,
    y: Math.random() * 800,
    size: Math.random() * 2 + 0.5,
    speed: Math.random() * 0.4 + 0.1,
    opacity: Math.random() * 0.6 + 0.2,
    twinkle: Math.random() * Math.PI * 2
  });
}

function animParticles() {
  ctx.clearRect(0, 0, W, H);
  particles.forEach(particle => {
    particle.twinkle += 0.02;
    particle.y -= particle.speed;
    if (particle.y < 0) {
      particle.y = H;
      particle.x = Math.random() * W;
    }
    const opacity = particle.opacity * (0.5 + 0.5 * Math.sin(particle.twinkle));
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(201,168,76,${opacity})`;
    ctx.fill();
  });
  requestAnimationFrame(animParticles);
}
animParticles();

// GOLD LINE ANIMATE
setTimeout(() => document.getElementById('goldLine').classList.add('animate'), 300);

// NAV SCROLL
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => navbar.classList.toggle('scrolled', window.scrollY > 60));

// SCROLL REVEAL
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(element => observer.observe(element));

// COUNTER ANIMATION
const counterObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting && !entry.target.dataset.counted) {
      entry.target.dataset.counted = '1';
      const element = entry.target;
      const target = Number(element.dataset.count);
      let start = 0;
      const step = () => {
        start += Math.ceil(target / 40);
        if (start >= target) {
          element.textContent = target + (target === 5 ? '★' : target === 100 ? '%' : '+');
        } else {
          element.textContent = start;
          requestAnimationFrame(step);
        }
      };
      step();
    }
  });
}, { threshold: 0.5 });
document.querySelectorAll('.stat-num[data-count]').forEach(element => counterObserver.observe(element));

// TESTIMONIAL CAROUSEL
let currentSlide = 0;
let totalSlides = 0;
let rotationTimer;

function reviewDateValue(review) {
  if (review.createdAt && typeof review.createdAt.toMillis === 'function') {
    return review.createdAt.toMillis();
  }
  return new Date(review.date || 0).getTime();
}

function goToSlide(number) {
  currentSlide = number;
  document.getElementById('testiSlides').style.transform = `translateX(-${number * 100}%)`;
  document.querySelectorAll('.testi-dot').forEach((dot, index) => {
    dot.classList.toggle('active', index === number);
  });
}

function changeSlide(direction) {
  if (totalSlides) goToSlide((currentSlide + direction + totalSlides) % totalSlides);
}

function toggleOwnerResponse(headerElement) {
  const textElement = headerElement.nextElementSibling;
  const icon = headerElement.querySelector('.expand-icon');
  const isExpanded = textElement.style.display !== 'none';
  textElement.style.display = isExpanded ? 'none' : 'block';
  icon.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(180deg)';
}

function renderReviews(reviews) {
  // Normalize rating and date, then sort by rating (desc) then by published/created date (desc)
  const topReviews = reviews
    .map(r => ({
      ...r,
      rating: Number(r.rating) || 0,
      _sortDate: (r.publishedAt && typeof r.publishedAt.toMillis === 'function')
        ? r.publishedAt.toMillis()
        : (r.createdAt && typeof r.createdAt.toMillis === 'function')
          ? r.createdAt.toMillis()
          : new Date(r.date || 0).getTime()
    }))
    .sort((a, b) => (b.rating - a.rating) || (b._sortDate - a._sortDate))
    .slice(0, 5);

  totalSlides = topReviews.length;
  currentSlide = 0;
  const slidesContainer = document.getElementById('testiSlides');
  const navContainer = document.getElementById('testiNav');
  slidesContainer.textContent = '';
  navContainer.textContent = '';

  topReviews.forEach((review, idx) => {
    const stars = '★'.repeat(Number(review.rating));
    const slide = document.createElement('div');
    slide.className = 'testi-slide';
    const card = document.createElement('div');
    card.className = 'testi-card';
    if (idx === 0) appendTextElement(card, 'div', 'top-badge', 'Top review');
    appendTextElement(card, 'div', 'testi-quote', '"');
    appendTextElement(card, 'div', 'testi-stars', stars);
    appendTextElement(card, 'p', 'testi-text', review.text);
    appendTextElement(card, 'div', 'testi-author', review.name);
    appendTextElement(card, 'div', 'testi-role', review.role);
    const response = document.createElement('div');
    response.className = 'owner-response';
    const responseHeader = document.createElement('div');
    responseHeader.className = 'owner-response-header';
    appendTextElement(responseHeader, 'span', 'owner-name', 'Perfect Reveal Planners responded');
    appendTextElement(responseHeader, 'span', 'expand-icon', '▼');
    const responseText = appendTextElement(response, 'div', 'owner-response-text', review.ownerResponse || 'Thank you for your feedback!');
    responseText.style.display = 'none';
    response.insertBefore(responseHeader, responseText);
    card.appendChild(response);
    slide.appendChild(card);
    responseHeader.addEventListener('click', event => {
      toggleOwnerResponse(event.currentTarget);
    });
    slidesContainer.appendChild(slide);
  });

  for (let index = 0; index < totalSlides; index += 1) {
    const dot = document.createElement('div');
    dot.className = `testi-dot${index === 0 ? ' active' : ''}`;
    dot.addEventListener('click', () => goToSlide(index));
    navContainer.appendChild(dot);
  }

  clearInterval(rotationTimer);
  if (totalSlides > 1) rotationTimer = setInterval(() => changeSlide(1), 5000);
}

function loadReviews() {
  if (!db) {
    renderReviewState('Online reviews are not configured.');
    return;
  }

  // Real-time listener: updates on any changes to publishedReviews
  onSnapshot(collection(db, 'publishedReviews'), snapshot => {
    const reviews = snapshot.docs.map(document => ({ id: document.id, ...document.data() }));
    if (!reviews.length) {
      renderReviewState('No reviews published yet.');
      return;
    }
    renderReviews(reviews);
  }, error => {
    renderReviewState('Reviews are temporarily unavailable.');
  });
}

function appendTextElement(parent, tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text || '';
  parent.appendChild(element);
  return element;
}

function renderReviewState(text) {
  const slides = document.getElementById('testiSlides');
  slides.textContent = '';
  const slide = document.createElement('div');
  slide.className = 'testi-slide';
  const card = document.createElement('div');
  card.className = 'testi-card';
  appendTextElement(card, 'p', 'testi-text', text);
  slide.appendChild(card);
  slides.appendChild(slide);
}

function showReviewMessage(text, type) {
  const messageElement = document.getElementById('reviewMessage');
  messageElement.style.display = 'block';
  messageElement.className = `review-message ${type}`;
  messageElement.textContent = text;
}

async function submitReview(event) {
  event.preventDefault();
  const form = document.getElementById('reviewForm');
  const submitButton = form.querySelector('button[type="submit"]');
  const review = {
    name: document.getElementById('reviewName').value.trim(),
    email: document.getElementById('reviewEmail').value.trim(),
    role: document.getElementById('reviewRole').value.trim(),
    rating: Number.parseInt(document.getElementById('reviewRating').value, 10),
    text: document.getElementById('reviewText').value.trim()
  };

  if (!review.name || !review.email || !review.role || !review.rating || !review.text) {
    showReviewMessage('Please fill in all fields.', 'error');
    return;
  }
  if (!db) {
    showReviewMessage('Online review submission is not configured yet. Please contact us directly.', 'error');
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = 'Submitting...';
  try {
    await addDoc(collection(db, 'reviewSubmissions'), {
      ...review,
      status: 'pending',
      createdAt: serverTimestamp()
    });
    showReviewMessage('Thank you for sharing your experience with us.', 'success');
    form.reset();
  } catch (error) {
    showReviewMessage('We could not submit your review right now. Please try again later.', 'error');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Submit Your Review';
  }
}

window.changeSlide = changeSlide;
window.submitReview = submitReview;

document.addEventListener('DOMContentLoaded', () => {
  loadPlans();
  loadReviews();
  setupBookingAnalytics();
});

// WHATSAPP GREETING
(() => {
  const waGreeting = document.getElementById('waGreeting');
  const waClose = document.getElementById('waClose');
  const plansSection = document.getElementById('plans');
  let wasAbovePlans = true;
  let messageClosed = false;

  function showWa() {
    if (!plansSection) return;
    const rect = plansSection.getBoundingClientRect();
    const isAbovePlans = rect.bottom > 0;
    const isBelowPlans = rect.top < 0;

    if (isBelowPlans && wasAbovePlans) {
      wasAbovePlans = false;
      messageClosed = false;
    }
    if (isAbovePlans && !wasAbovePlans) {
      wasAbovePlans = true;
      messageClosed = false;
    }
    if (!wasAbovePlans && !messageClosed) {
      setTimeout(() => {
        if (!messageClosed) waGreeting.classList.add('show');
      }, 300);
    } else {
      waGreeting.classList.remove('show');
    }
  }

  window.addEventListener('scroll', showWa, { passive: true });
  showWa();

  if (waClose) {
    waClose.addEventListener('click', event => {
      event.preventDefault();
      messageClosed = true;
      waGreeting.classList.remove('show');
    });
  }
  document.getElementById('waBtn').addEventListener('mouseenter', () => {
    if (!messageClosed) waGreeting.classList.add('show');
  });
})();
