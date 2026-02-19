/* RF401 Contract Timeline — Firebase Configuration */

var FirebaseConfig = (function () {
    var config = {
        apiKey: "AIzaSyD5pmIxew4yjuaOiZGzr-hTTwjLIkF-xcE",
        authDomain: "rf401-timeline.firebaseapp.com",
        projectId: "rf401-timeline",
        storageBucket: "rf401-timeline.firebasestorage.app",
        messagingSenderId: "1073947358426",
        appId: "1:1073947358426:web:8aed4f2bc70aed0e3b21e3"
    };

    firebase.initializeApp(config);

    var db = firebase.firestore();
    var auth = firebase.auth();

    return { db: db, auth: auth };
})();
