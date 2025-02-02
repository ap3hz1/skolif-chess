// Your Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAsW4LcY5UnkVjwhhm3m57cUE0SAoXCmb0",
    authDomain: "skolif-c6c04.firebaseapp.com",
    projectId: "skolif-c6c04",
    storageBucket: "skolif-c6c04.firebasestorage.app",
    messagingSenderId: "193728202172",
    appId: "1:193728202172:web:815e6a4b14efa0e0e8d7b9",
    measurementId: "G-6JZHCXC9KT"
};

let db;

// Initialize Firebase
try {
    firebase.initializeApp(firebaseConfig);
    firebase.analytics();
    db = firebase.firestore();
    console.log("Firebase initialized successfully");
} catch (error) {
    console.error("Error initializing Firebase:", error);
}

// Export the database instance
window.db = db; 