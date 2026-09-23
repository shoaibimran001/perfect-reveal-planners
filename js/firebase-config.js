// Replace these values with the Web App configuration from your Firebase project.
// This configuration identifies your Firebase app; access is protected by Firestore rules.
export const firebaseConfig = {
  apiKey: 'REPLACE_WITH_FIREBASE_API_KEY',
  authDomain: 'perfect-reveal-planners.firebaseapp.com',
  projectId: 'perfect-reveal-planners',
  storageBucket: 'perfect-reveal-planners.firebasestorage.app',
  messagingSenderId: '625576213739',
  appId: '1:625576213739:web:d74d78e4aca98d5846d2ae',
  measurementId: 'G-V32QYF1VVE'
};

export function isFirebaseConfigured() {
  return !Object.values(firebaseConfig).some(value => typeof value !== 'string' || value.startsWith('REPLACE_WITH_'));
}
