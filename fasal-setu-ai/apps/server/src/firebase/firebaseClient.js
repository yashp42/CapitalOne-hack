// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAplUkV8VFROYai3lQaAstg3Thjpb_RJLM",
  authDomain: "fasalsetu-38410.firebaseapp.com",
  projectId: "fasalsetu-38410",
  storageBucket: "fasalsetu-38410.firebasestorage.app",
  messagingSenderId: "744208041314",
  appId: "1:744208041314:web:83f61ebd42230f75c7583b",
  measurementId: "G-KVYKXDTYTF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { auth };