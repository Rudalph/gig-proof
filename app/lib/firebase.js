import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyCnPXREztwIatKXNrWiSsz1Udkxmyvru5Q",
    authDomain: "gig-proof.firebaseapp.com",
    projectId: "gig-proof",
    storageBucket: "gig-proof.firebasestorage.app",
    messagingSenderId: "637884590906",
    appId: "1:637884590906:web:1ff7b2fb7aab0fb4cf7e03",
    measurementId: "G-0800P187F5"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };