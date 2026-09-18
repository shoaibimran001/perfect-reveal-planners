import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import {
  GoogleAuthProvider,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';
import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';

const loginScreen = document.getElementById('loginScreen');
const adminScreen = document.getElementById('adminScreen');
const logoutButton = document.getElementById('logoutButton');
const loginForm = document.getElementById('loginForm');
const googleLoginButton = document.getElementById('googleLoginButton');
const passwordInput = document.getElementById('passwordInput');
const passwordToggle = document.getElementById('passwordToggle');
const manualForm = document.getElementById('manualReviewForm');
const planForm = document.getElementById('planForm');
const plansList = document.getElementById('plansList');
const importPlansButton = document.getElementById('importPlansButton');
const newPlanButton = document.getElementById('newPlanButton');
const addFeatureButton = document.getElementById('addFeatureButton');
const cancelPlanButton = document.getElementById('cancelPlanButton');
const DEFAULT_PLAN_NOTE = 'Plan modifications start at ₹69. Additional charges may apply for custom requests.';
const OWNER_EMAIL = 'nanimuthu044@gmail.com';
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
let auth;
let db;
let googleProvider;
let pendingReviews = [];
let publishedReviews = [];
let plans = [];
let planClicks = [];

function timestampValue(review) {
  if (review.publishedAt && typeof review.publishedAt.toMillis === 'function') return review.publishedAt.toMillis();
  if (review.createdAt && typeof review.createdAt.toMillis === 'function') return review.createdAt.toMillis();
  return new Date(review.date || 0).getTime();
}

function formatRupees(value) {
  return `₹${new Intl.NumberFormat('en-IN').format(Number(value) || 0)}`;
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'plan';
}

async function uniquePlanId(name) {
  const baseSlug = slugify(name);
  const existing = await getDoc(doc(db, 'plans', baseSlug));
  if (!existing.exists()) return baseSlug;

  let suffix = 2;
  let candidate = `${baseSlug}-${suffix}`;
  while ((await getDoc(doc(db, 'plans', candidate))).exists()) {
    suffix += 1;
    candidate = `${baseSlug}-${suffix}`;
  }
  return candidate;
}

function planOrderValue(plan) {
  return Number(plan.order) || 0;
}

function sortedPlans() {
  return [...plans].sort((first, second) => planOrderValue(first) - planOrderValue(second));
}

function showMessage(text, type = 'success') {
  const element = document.getElementById('message');
  element.textContent = text;
  element.className = `message ${type}`;
  element.style.display = 'block';
  window.setTimeout(() => { element.style.display = 'none'; }, 4500);
}

function showLoginMessage(text) {
  const element = document.getElementById('loginMessage');
  element.textContent = text;
  element.style.display = 'block';
}

function setSignedInDisplay(signedIn) {
  loginScreen.style.display = signedIn ? 'none' : 'flex';
  adminScreen.style.display = signedIn ? 'block' : 'none';
  logoutButton.style.display = signedIn ? 'block' : 'none';
}

function renderStats() {
  const container = document.getElementById('stats');
  container.textContent = '';
  [['Pending', pendingReviews.length], ['Published', publishedReviews.length], ['Visible + Pending', pendingReviews.length + publishedReviews.length]]
    .forEach(([label, value]) => {
      const box = document.createElement('div');
      box.className = 'stat-box';
      const number = document.createElement('div');
      number.className = 'stat-number';
      number.textContent = String(value);
      const caption = document.createElement('div');
      caption.className = 'stat-label';
      caption.textContent = label;
      box.append(number, caption);
      container.appendChild(box);
    });
}

function renderPendingReviews() {
  const container = document.getElementById('pendingReviews');
  container.textContent = '';
  if (!pendingReviews.length) {
    renderEmptyState(container, 'No pending reviews.');
    return;
  }
  pendingReviews.forEach(review => {
    const card = document.createElement('article');
    card.className = 'review-card';
    appendReviewText(card, 'review-name', review.name);
    appendReviewText(card, 'review-meta', `${review.email} | ${review.role}`);
    appendReviewText(card, 'review-rating', '★'.repeat(Number(review.rating)));
    appendReviewText(card, 'review-text', `"${review.text}"`);
    const actions = document.createElement('div');
    actions.className = 'review-actions';
    actions.append(
      createActionButton('Approve & Publish', () => approveReview(review.id), 'btn-approve'),
      createActionButton('Reject', () => rejectReview(review.id), 'btn-reject'),
      createActionButton('Edit Text', () => editPendingReview(review.id))
    );
    card.appendChild(actions);
    container.appendChild(card);
  });
}

function renderPublishedReviews() {
  const container = document.getElementById('approvedReviews');
  container.textContent = '';
  if (!publishedReviews.length) {
    renderEmptyState(container, 'No published reviews yet.');
    return;
  }
  publishedReviews.forEach(review => {
    const card = document.createElement('article');
    card.className = 'review-card';
    appendReviewText(card, 'review-name', review.name);
    appendReviewText(card, 'review-meta', review.role);
    appendReviewText(card, 'review-rating', '★'.repeat(Number(review.rating)));
    appendReviewText(card, 'review-text', `"${review.text}"`);
    const response = document.createElement('div');
    response.className = 'response';
    const responseLabel = document.createElement('strong');
    responseLabel.textContent = 'Perfect Reveal Planners responded:';
    response.append(responseLabel, document.createTextNode(review.ownerResponse || 'Thank you for your feedback!'));
    const actions = document.createElement('div');
    actions.className = 'review-actions';
    actions.appendChild(createActionButton('Delete', () => deletePublishedReview(review.id), 'btn-delete'));
    card.append(response, actions);
    container.appendChild(card);
  });
}

function renderEmptyState(container, text) {
  const empty = document.createElement('div');
  empty.className = 'empty-message';
  empty.textContent = text;
  container.appendChild(empty);
}

function appendReviewText(container, className, text) {
  const element = document.createElement('div');
  element.className = className;
  element.textContent = text || '';
  container.appendChild(element);
}

function createActionButton(label, handler, className = '') {
  const button = document.createElement('button');
  button.className = `action-btn ${className}`.trim();
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', handler);
  return button;
}

function renderFeatureRows(features = ['']) {
  const container = document.getElementById('planFeatures');
  container.textContent = '';
  features.forEach((feature, index) => {
    const row = document.createElement('div');
    row.className = 'feature-row';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'plan-feature-input';
    input.value = feature;
    input.placeholder = `Feature ${index + 1}`;
    input.addEventListener('input', renderPlanPreview);
    row.append(
      input,
      createActionButton('Up', () => moveFeature(index, -1)),
      createActionButton('Down', () => moveFeature(index, 1)),
      createActionButton('Remove', () => removeFeature(index), 'btn-delete')
    );
    container.appendChild(row);
  });
}

function currentFeatureValues() {
  return Array.from(document.querySelectorAll('.plan-feature-input')).map(input => input.value);
}

function setFeatureValues(values) {
  renderFeatureRows(values.length ? values : ['']);
  renderPlanPreview();
}

function addFeatureRow() {
  setFeatureValues([...currentFeatureValues(), '']);
}

function removeFeature(index) {
  const features = currentFeatureValues();
  features.splice(index, 1);
  setFeatureValues(features);
}

function moveFeature(index, direction) {
  const features = currentFeatureValues();
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= features.length) return;
  [features[index], features[nextIndex]] = [features[nextIndex], features[index]];
  setFeatureValues(features);
}

function resetPlanForm(plan = null) {
  document.getElementById('planFormTitle').textContent = plan ? 'Edit Plan' : 'Add Plan';
  document.getElementById('planId').value = plan?.id || '';
  document.getElementById('planName').value = plan?.name || '';
  document.getElementById('planPrice').value = plan?.price ?? '';
  document.getElementById('planPriceSuffix').value = plan?.priceSuffix || '/ surprise';
  document.getElementById('planBadge').value = plan?.badge || '';
  document.getElementById('planDescription').value = plan?.description || '';
  document.getElementById('planFeatured').checked = Boolean(plan?.featured);
  document.getElementById('planVisible').checked = plan ? Boolean(plan.visible) : true;
  document.getElementById('planWhatsappText').value = plan?.whatsappText || '';
  setFeatureValues(Array.isArray(plan?.features) ? plan.features : ['']);
  planForm.style.display = 'block';
  planForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function hidePlanForm() {
  planForm.reset();
  planForm.style.display = 'none';
  setFeatureValues(['']);
}

function planFormData() {
  const features = currentFeatureValues().map(feature => feature.trim());
  const price = Number(document.getElementById('planPrice').value);
  return {
    id: document.getElementById('planId').value,
    name: document.getElementById('planName').value.trim(),
    price,
    priceSuffix: document.getElementById('planPriceSuffix').value.trim() || '/ surprise',
    description: document.getElementById('planDescription').value.trim(),
    features,
    badge: document.getElementById('planBadge').value.trim(),
    featured: document.getElementById('planFeatured').checked,
    visible: document.getElementById('planVisible').checked,
    whatsappText: document.getElementById('planWhatsappText').value.trim()
  };
}

function renderPlanPreview() {
  const container = document.getElementById('planPreviewCard');
  if (!container) return;
  const data = planFormData();
  container.textContent = '';
  const card = document.createElement('div');
  card.className = `plan-card${data.featured ? ' featured' : ''}`;
  if (data.badge) {
    const badge = document.createElement('div');
    badge.className = 'plan-badge';
    badge.textContent = `✦ ${data.badge}`;
    card.appendChild(badge);
  }
  appendPreviewText(card, 'plan-name', data.name || 'Plan name');
  const price = document.createElement('div');
  price.className = 'plan-price';
  const rupee = document.createElement('sup');
  rupee.textContent = '₹';
  price.append(rupee, document.createTextNode(new Intl.NumberFormat('en-IN').format(Number(data.price) || 0)));
  const suffix = document.createElement('span');
  suffix.textContent = ` ${data.priceSuffix || '/ surprise'}`;
  price.appendChild(suffix);
  card.appendChild(price);
  appendPreviewText(card, 'plan-desc', data.description || 'Plan description');
  const features = document.createElement('ul');
  features.className = 'plan-features';
  data.features.filter(feature => feature.trim()).forEach(feature => {
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
  card.appendChild(button);
  container.appendChild(card);
}

function appendPreviewText(container, className, text) {
  const element = document.createElement('div');
  element.className = className;
  element.textContent = text;
  container.appendChild(element);
}

function validatePlan(plan) {
  if (!plan.name) return 'Plan name is required.';
  if (!Number.isFinite(plan.price) || plan.price < 0) return 'Price must be a number greater than or equal to 0.';
  if (!plan.description) return 'Description is required.';
  if (!plan.features.length) return 'Add at least one feature.';
  if (plan.features.some(feature => !feature)) return 'Remove empty feature rows or fill them in.';
  return '';
}

function renderPlansAdmin() {
  importPlansButton.style.display = plans.length ? 'none' : 'inline-flex';
  plansList.textContent = '';
  if (!plans.length) {
    renderEmptyState(plansList, 'No plans yet. Import the defaults or add a plan.');
    return;
  }

  const orderedPlans = sortedPlans();
  orderedPlans.forEach((plan, index) => {
    const card = document.createElement('article');
    card.className = 'review-card';
    appendReviewText(card, 'review-name', plan.name);
    appendReviewText(card, 'review-meta', `${formatRupees(plan.price)} ${plan.priceSuffix || '/ surprise'} | Order ${Number(plan.order) || 0}`);
    appendReviewText(card, 'response', plan.description || '');
    const labels = document.createElement('div');
    labels.className = 'plan-labels';
    if (!plan.visible) labels.appendChild(createPlanLabel('Hidden', 'hidden'));
    if (plan.featured) labels.appendChild(createPlanLabel('Featured', 'featured'));
    if (plan.badge) labels.appendChild(createPlanLabel(plan.badge));
    card.appendChild(labels);
    const actions = document.createElement('div');
    actions.className = 'review-actions';
    const up = createActionButton('Up', () => movePlanOrder(plan.id, -1));
    const down = createActionButton('Down', () => movePlanOrder(plan.id, 1));
    up.disabled = index === 0;
    down.disabled = index === orderedPlans.length - 1;
    actions.append(
      createActionButton('Edit', () => editPlan(plan.id)),
      createActionButton(plan.visible ? 'Hide' : 'Show', () => togglePlanVisibility(plan.id)),
      createActionButton('Duplicate', () => duplicatePlan(plan.id)),
      up,
      down,
      createActionButton('Delete', () => deletePlan(plan.id), 'btn-delete')
    );
    card.appendChild(actions);
    plansList.appendChild(card);
  });
}

function createPlanLabel(text, className = '') {
  const label = document.createElement('span');
  label.className = `plan-label ${className}`.trim();
  label.textContent = text;
  return label;
}

function renderPlanAnalytics() {
  const container = document.getElementById('planAnalytics');
  if (!container) return;

  const today = Date.now();
  const recentClicks = planClicks.filter(click => {
    const timestamp = click.createdAt?.toMillis?.();
    return timestamp && today - timestamp <= 7 * 24 * 60 * 60 * 1000;
  }).length;
  const counts = planClicks.reduce((result, click) => {
    const name = click.planName || click.planId || 'Unknown plan';
    result[name] = (result[name] || 0) + 1;
    return result;
  }, {});
  const ranking = Object.entries(counts).sort((first, second) => second[1] - first[1]);

  container.textContent = '';
  const stats = document.createElement('div');
  stats.className = 'stats';
  [['Total clicks', planClicks.length], ['Last 7 days', recentClicks], ['Top plan clicks', ranking.length ? ranking[0][1] : 0]]
    .forEach(([label, value]) => {
      const box = document.createElement('div');
      box.className = 'stat-box';
      const number = document.createElement('div');
      number.className = 'stat-number';
      number.textContent = String(value);
      const caption = document.createElement('div');
      caption.className = 'stat-label';
      caption.textContent = label;
      box.append(number, caption);
      stats.appendChild(box);
    });
  const card = document.createElement('div');
  card.className = 'review-card';
  appendReviewText(card, 'review-name', 'Plan interest');
  if (!ranking.length) {
    renderEmptyState(card, 'No plan clicks recorded yet.');
  } else {
    ranking.forEach(([name, count]) => appendReviewText(card, 'review-meta', `${name}: ${count} click${count === 1 ? '' : 's'}`));
  }
  container.append(stats, card);
}

async function loadDashboard() {
  const pendingSnapshot = await getDocs(query(collection(db, 'reviewSubmissions'), where('status', '==', 'pending')));
  const publishedSnapshot = await getDocs(collection(db, 'publishedReviews'));
  const plansSnapshot = await getDocs(collection(db, 'plans'));
  const planClicksSnapshot = await getDocs(collection(db, 'planClicks'));
  pendingReviews = pendingSnapshot.docs.map(snapshot => ({ id: snapshot.id, ...snapshot.data() }))
    .sort((first, second) => timestampValue(second) - timestampValue(first));
  publishedReviews = publishedSnapshot.docs.map(snapshot => ({ id: snapshot.id, ...snapshot.data() }))
    .sort((first, second) => timestampValue(second) - timestampValue(first));
  plans = plansSnapshot.docs.map(snapshot => ({ id: snapshot.id, ...snapshot.data() }))
    .sort((first, second) => planOrderValue(first) - planOrderValue(second));
  planClicks = planClicksSnapshot.docs.map(snapshot => ({ id: snapshot.id, ...snapshot.data() }));
  await loadPlansNote();
  renderStats();
  renderPendingReviews();
  renderPublishedReviews();
  renderPlansAdmin();
  renderPlanAnalytics();
}

async function verifyAdminAndLoad() {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      setSignedInDisplay(false);
      showLoginMessage('No user logged in.');
      return;
    }
    
    if (user.email?.toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
      await signOut(auth);
      setSignedInDisplay(false);
      showLoginMessage('Access denied');
      return;
    }
    await user.getIdToken(true);
    await loadDashboard();
    setSignedInDisplay(true);
  } catch (error) {
    await signOut(auth);
    setSignedInDisplay(false);
    const message = error.code === 'permission-denied'
      ? 'Google sign-in succeeded, but Firestore denied dashboard access. Deploy the current firestore.rules file and try again.'
      : 'Unable to load the owner dashboard after Google sign-in.';
    showLoginMessage(`${message} (${error.code || 'unknown error'})`);
  }
}

async function authenticate(event) {
  event.preventDefault();
  const button = loginForm.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    await signInWithEmailAndPassword(
      auth,
      document.getElementById('emailInput').value.trim(),
      document.getElementById('passwordInput').value
    );
  } catch (error) {
    const message = {
      'auth/invalid-credential': 'Firebase rejected this email/password. Check that this exact email exists in Authentication > Users and reset the password if needed.',
      'auth/user-not-found': 'No Firebase user exists for this email address.',
      'auth/wrong-password': 'The password is incorrect for this administrator account.',
      'auth/invalid-email': 'Enter a valid administrator email address.',
      'auth/too-many-requests': 'Too many failed attempts. Please wait a moment and try again.',
      'auth/operation-not-allowed': 'Firebase Email/Password sign-in is not enabled for this project.'
    }[error.code] || 'Unable to sign in. Check your Firebase Authentication setup.';
    showLoginMessage(`${message} (${error.code || 'unknown error'})`);
  } finally {
    button.disabled = false;
  }
}

async function authenticateWithGoogle() {
  googleLoginButton.disabled = true;
  try {
    showLoginMessage('Opening Google sign-in...');
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    if (['auth/popup-blocked', 'auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(error.code)) {
      showLoginMessage('Popup unavailable. Redirecting to Google sign-in...');
      try {
        await signInWithRedirect(auth, googleProvider);
        return;
      } catch (redirectError) {
        error = redirectError;
      }
    }
    const message = {
      'auth/account-exists-with-different-credential': 'This email already uses another sign-in method. Sign in with email/password first, then link Google in Firebase if needed.',
      'auth/operation-not-allowed': 'Google sign-in is not enabled for this Firebase project.',
      'auth/unauthorized-domain': 'This website domain is not authorised in Firebase Authentication. Add this domain in Authentication > Settings > Authorised domains.'
    }[error.code] || 'Unable to sign in with Google. Check your Firebase Authentication setup.';
    showLoginMessage(`${message} (${error.code || 'unknown error'})`);
  } finally {
    googleLoginButton.disabled = false;
  }
}

async function logout() {
  await signOut(auth);
}

function showTab(tabName, button) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.tab-button').forEach(tabButton => tabButton.classList.remove('active'));
  document.getElementById(tabName).classList.add('active');
  button.classList.add('active');
}

function togglePasswordVisibility() {
  const showing = passwordInput.type === 'text';
  passwordInput.type = showing ? 'password' : 'text';
  passwordToggle.textContent = showing ? 'Show' : 'Hide';
  passwordToggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
  passwordToggle.setAttribute('aria-pressed', String(!showing));
}

async function approveReview(id) {
  const review = pendingReviews.find(item => item.id === id);
  if (!review) return;
  const batch = writeBatch(db);
  batch.set(doc(db, 'publishedReviews', id), {
    name: review.name,
    role: review.role,
    rating: review.rating,
    text: review.text,
    ownerResponse: 'Thank you for your feedback!',
    createdAt: review.createdAt,
    publishedAt: serverTimestamp()
  });
  batch.update(doc(db, 'reviewSubmissions', id), { status: 'approved', reviewedAt: serverTimestamp() });
  await batch.commit();
  showMessage('Review approved and published.');
  await loadDashboard();
}

async function rejectReview(id) {
  if (!window.confirm('Reject this review?')) return;
  await updateDoc(doc(db, 'reviewSubmissions', id), { status: 'rejected', reviewedAt: serverTimestamp() });
  showMessage('Review rejected.');
  await loadDashboard();
}

async function editPendingReview(id) {
  const review = pendingReviews.find(item => item.id === id);
  if (!review) return;
  const editedText = window.prompt('Edit review text before publishing:', review.text);
  if (!editedText || !editedText.trim()) return;
  await updateDoc(doc(db, 'reviewSubmissions', id), { text: editedText.trim() });
  showMessage('Review text updated.');
  await loadDashboard();
}

async function deletePublishedReview(id) {
  if (!window.confirm('Delete this published review?')) return;
  await deleteDoc(doc(db, 'publishedReviews', id));
  showMessage('Published review removed.');
  await loadDashboard();
}

async function addManualReview(event) {
  event.preventDefault();
  const button = manualForm.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    await addDoc(collection(db, 'publishedReviews'), {
      name: document.getElementById('manualName').value.trim(),
      role: document.getElementById('manualRole').value.trim(),
      rating: Number.parseInt(document.getElementById('manualRating').value, 10),
      text: document.getElementById('manualText').value.trim(),
      ownerResponse: document.getElementById('manualResponse').value.trim() || 'Thank you for your feedback!',
      publishedAt: serverTimestamp()
    });
    manualForm.reset();
    showMessage('Review published.');
    await loadDashboard();
  } catch (error) {
    showMessage('Unable to publish this review.', 'error');
  } finally {
    button.disabled = false;
  }
}

async function savePlan(event) {
  event.preventDefault();
  const button = document.getElementById('savePlanButton');
  const data = planFormData();
  const validationMessage = validatePlan(data);
  if (validationMessage) {
    showMessage(validationMessage, 'error');
    return;
  }

  button.disabled = true;
  try {
    const id = data.id || await uniquePlanId(data.name);
    const existingPlan = plans.find(plan => plan.id === id);
    const order = existingPlan?.order ?? ((plans.length + 1) * 10);
    const planPayload = {
      name: data.name,
      price: data.price,
      priceSuffix: data.priceSuffix,
      description: data.description,
      features: data.features,
      badge: data.badge,
      featured: data.featured,
      visible: data.visible,
      order,
      whatsappText: data.whatsappText,
      updatedAt: serverTimestamp()
    };

    const batch = writeBatch(db);
    if (data.featured) {
      plans
        .filter(plan => plan.id !== id && plan.featured)
        .forEach(plan => batch.update(doc(db, 'plans', plan.id), {
          featured: false,
          updatedAt: serverTimestamp()
        }));
    }
    if (!existingPlan) planPayload.createdAt = serverTimestamp();
    batch.set(doc(db, 'plans', id), planPayload, { merge: true });
    await batch.commit();
    hidePlanForm();
    showMessage(existingPlan ? 'Plan updated.' : 'Plan added.');
    await loadDashboard();
  } catch (error) {
    showMessage('Unable to save this plan.', 'error');
  } finally {
    button.disabled = false;
  }
}

function editPlan(id) {
  const plan = plans.find(item => item.id === id);
  if (plan) resetPlanForm(plan);
}

async function togglePlanVisibility(id) {
  const plan = plans.find(item => item.id === id);
  if (!plan) return;
  await updateDoc(doc(db, 'plans', id), {
    visible: !plan.visible,
    updatedAt: serverTimestamp()
  });
  showMessage(plan.visible ? 'Plan hidden.' : 'Plan shown.');
  await loadDashboard();
}

async function duplicatePlan(id) {
  const plan = plans.find(item => item.id === id);
  if (!plan) return;
  const name = `${plan.name} Copy`;
  const newId = await uniquePlanId(name);
  await setDoc(doc(db, 'plans', newId), {
    name,
    price: Number(plan.price) || 0,
    priceSuffix: plan.priceSuffix || '/ surprise',
    description: plan.description || '',
    features: Array.isArray(plan.features) ? plan.features : [],
    badge: plan.badge || '',
    featured: false,
    visible: Boolean(plan.visible),
    order: (Math.max(0, ...plans.map(item => Number(item.order) || 0)) + 10),
    whatsappText: plan.whatsappText || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  showMessage('Plan duplicated.');
  await loadDashboard();
}

async function deletePlan(id) {
  if (!window.confirm('Delete this plan?')) return;
  await deleteDoc(doc(db, 'plans', id));
  showMessage('Plan deleted.');
  await loadDashboard();
}

async function movePlanOrder(id, direction) {
  const orderedPlans = sortedPlans();
  const index = orderedPlans.findIndex(plan => plan.id === id);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= orderedPlans.length) return;
  [orderedPlans[index], orderedPlans[nextIndex]] = [orderedPlans[nextIndex], orderedPlans[index]];

  const batch = writeBatch(db);
  orderedPlans.forEach((plan, planIndex) => {
    batch.update(doc(db, 'plans', plan.id), {
      order: (planIndex + 1) * 10,
      updatedAt: serverTimestamp()
    });
  });
  await batch.commit();
  showMessage('Plan order updated.');
  await loadDashboard();
}

async function importDefaultPlans() {
  if (plans.length) return;
  const button = importPlansButton;
  button.disabled = true;
  try {
    const batch = writeBatch(db);
    DEFAULT_PLANS.forEach(plan => {
      const { id, ...planData } = plan;
      batch.set(doc(db, 'plans', id), {
        ...planData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });
    batch.set(doc(db, 'settings', 'plansPage'), {
      note: DEFAULT_PLAN_NOTE,
      updatedAt: serverTimestamp()
    }, { merge: true });
    await batch.commit();
    showMessage('Default plans imported.');
    await loadDashboard();
  } catch (error) {
    showMessage('Unable to import default plans.', 'error');
  } finally {
    button.disabled = false;
  }
}

async function savePlansNote(event) {
  event.preventDefault();
  const button = document.getElementById('savePlansNoteButton');
  const note = document.getElementById('plansPageNote').value.trim();
  if (!note) {
    showMessage('Page note is required.', 'error');
    return;
  }
  button.disabled = true;
  try {
    await setDoc(doc(db, 'settings', 'plansPage'), {
      note,
      updatedAt: serverTimestamp()
    }, { merge: true });
    showMessage('Page note saved.');
  } catch (error) {
    showMessage('Unable to save the page note.', 'error');
  } finally {
    button.disabled = false;
  }
}

async function loadPlansNote() {
  const snapshot = await getDoc(doc(db, 'settings', 'plansPage'));
  document.getElementById('plansPageNote').value = snapshot.exists() && typeof snapshot.data().note === 'string'
    ? snapshot.data().note
    : DEFAULT_PLAN_NOTE;
}

async function importStarterReviews() {
  // importStarterReviews removed to enforce publishing only via owner approvals
}

window.logout = logout;
window.showTab = showTab;
window.approveReview = approveReview;
window.rejectReview = rejectReview;
window.editPendingReview = editPendingReview;
window.deletePublishedReview = deletePublishedReview;
window.editPlan = editPlan;
window.togglePlanVisibility = togglePlanVisibility;
window.duplicatePlan = duplicatePlan;
window.deletePlan = deletePlan;
window.movePlanOrder = movePlanOrder;
window.removeFeature = removeFeature;
window.moveFeature = moveFeature;

passwordToggle.addEventListener('click', togglePasswordVisibility);
newPlanButton.addEventListener('click', () => resetPlanForm());
addFeatureButton.addEventListener('click', addFeatureRow);
cancelPlanButton.addEventListener('click', hidePlanForm);
importPlansButton.addEventListener('click', importDefaultPlans);
document.getElementById('plansNoteForm').addEventListener('submit', savePlansNote);
['planName', 'planPrice', 'planPriceSuffix', 'planBadge', 'planDescription', 'planFeatured'].forEach(id => {
  document.getElementById(id).addEventListener('input', renderPlanPreview);
  document.getElementById(id).addEventListener('change', renderPlanPreview);
});

if (!isFirebaseConfigured()) {
  showLoginMessage('Add your Firebase web configuration in js/firebase-config.js before using this dashboard.');
  loginForm.addEventListener('submit', event => event.preventDefault());
  loginForm.querySelector('button[type="submit"]').disabled = true;
  googleLoginButton.disabled = true;
  newPlanButton.disabled = true;
  importPlansButton.disabled = true;
} else {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
  loginForm.addEventListener('submit', authenticate);
  googleLoginButton.addEventListener('click', authenticateWithGoogle);
  manualForm.addEventListener('submit', addManualReview);
  planForm.addEventListener('submit', savePlan);
  getRedirectResult(auth).catch(error => {
    const message = {
      'auth/unauthorized-domain': 'This website domain is not authorised in Firebase Authentication. Add localhost in Authentication > Settings > Authorised domains.',
      'auth/operation-not-allowed': 'Google sign-in is not enabled for this Firebase project.'
    }[error.code] || 'Google sign-in could not be completed. Please try again.';
    showLoginMessage(`${message} (${error.code || 'unknown error'})`);
    googleLoginButton.disabled = false;
  });
  onAuthStateChanged(auth, user => {
    if (user) {
      verifyAdminAndLoad();
    } else {
      setSignedInDisplay(false);
    }
  });
}
