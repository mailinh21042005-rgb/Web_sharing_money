import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCPAS0tZxGkJYlT6l7Lq7sWviFcW-KP8eY",
  authDomain: "web-sharing-money.firebaseapp.com",
  projectId: "web-sharing-money",
  storageBucket: "web-sharing-money.firebasestorage.app",
  messagingSenderId: "805357988631",
  appId: "1:805357988631:web:a0c300cd17d0c028966552"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);