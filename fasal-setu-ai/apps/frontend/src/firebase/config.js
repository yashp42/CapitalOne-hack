import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAplUkV8VFROYai3lQaAstg3Thjpb_RJLM",
  authDomain: "fasalsetu-38410.firebaseapp.com",
  projectId: "fasalsetu-38410",
  storageBucket: "fasalsetu-38410.firebasestorage.app",
  messagingSenderId: "744208041314",
  appId: "1:744208041314:web:83f61ebd42230f75c7583b",
  measurementId: "G-KVYKXDTYTF"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;
