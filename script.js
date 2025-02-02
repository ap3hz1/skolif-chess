document.addEventListener('DOMContentLoaded', async function() {
    // Check if Firebase is properly initialized
    if (!window.db) {
        console.error('Firebase database not initialized');
        alert('Ett fel uppstod vid anslutning till databasen. Vänligen ladda om sidan.');
        return;
    }

    const form = document.getElementById('registrationForm');
    const confirmedList = document.getElementById('confirmedList');
    const waitingList = document.getElementById('waitingList');
    const confirmedCountEl = document.getElementById('confirmedCount');
    const waitingCountEl = document.getElementById('waitingCount');

    // Check if user has already registered
    const storedEmail = localStorage.getItem('registeredEmail');
    
    if (storedEmail) {
        // Check if the email still exists in the database
        const emailSnapshot = await db.collection('registrations')
            .where('email', '==', storedEmail)
            .get();

        if (emailSnapshot.empty) {
            // Email no longer exists in database, clear localStorage
            localStorage.removeItem('hasRegistered');
            localStorage.removeItem('registeredEmail');
            localStorage.removeItem('registrationId');
        } else {
            // Email still exists, show the message
            form.innerHTML = `
                <div class="alert alert-info" role="alert">
                    <h4 class="alert-heading">Du är redan anmäld!</h4>
                    <p>Du har redan registrerat dig med denna e-postadress. Om detta är ett misstag eller om du behöver göra ändringar, 
                    kontakta administratören.</p>
                    <hr>
                    <p class="mb-0">E-post som användes: ${storedEmail}</p>
                </div>
            `;
        }
    }

    // Handle form submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        if (!form.checkValidity()) {
            e.stopPropagation();
            form.classList.add('was-validated');
            return;
        }

        const name = document.getElementById('name').value;
        const className = document.getElementById('class').value;
        let email = document.getElementById('email').value.toLowerCase();
        
        // Add @elev.gnesta.se if not present
        if (!email.includes('@')) {
            email = email + '@elev.gnesta.se';
        } else if (!email.endsWith('@elev.gnesta.se')) {
            alert('Du måste använda din @elev.gnesta.se e-postadress');
            return;
        }

        // Check if email is already registered
        const emailSnapshot = await db.collection('registrations')
            .where('email', '==', email)
            .get();

        if (!emailSnapshot.empty) {
            alert('Denna e-postadress är redan registrerad.');
            return;
        }

        try {
            // Get device information
            const deviceInfo = {
                userAgent: navigator.userAgent,
                platform: navigator.platform || 'unknown',
                vendor: navigator.vendor || 'unknown',
                language: navigator.language || 'unknown',
                screenResolution: `${window.screen.width}x${window.screen.height}`,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                // Add more detailed mobile information
                isMobile: /Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
                deviceType: /Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop',
                operatingSystem: (function() {
                    const ua = navigator.userAgent;
                    if (/Windows/i.test(ua)) return 'Windows';
                    if (/Android/i.test(ua)) return 'Android';
                    if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
                    if (/Mac/i.test(ua)) return 'MacOS';
                    if (/Linux/i.test(ua)) return 'Linux';
                    return 'Unknown';
                })(),
                browser: (function() {
                    const ua = navigator.userAgent;
                    if (/Chrome/i.test(ua)) return 'Chrome';
                    if (/Firefox/i.test(ua)) return 'Firefox';
                    if (/Safari/i.test(ua)) return 'Safari';
                    if (/Edge/i.test(ua)) return 'Edge';
                    if (/Opera|OPR/i.test(ua)) return 'Opera';
                    return 'Unknown';
                })(),
                touchScreen: 'ontouchstart' in window || navigator.maxTouchPoints > 0
            };

            // Get IP address using ipify API
            const ipResponse = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipResponse.json();

            await db.collection('registrations').add({
                name: name,
                email: email,
                className: className,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'waiting',
                deviceInfo: deviceInfo,
                ipAddress: ipData.ip,
                registrationInfo: {
                    registeredFrom: window.location.hostname,
                    browserFingerprint: await generateBrowserFingerprint()
                }
            });

            // Store registration in localStorage
            localStorage.setItem('hasRegistered', 'true');
            localStorage.setItem('registeredEmail', email);
            localStorage.setItem('registrationId', email); // Store unique identifier

            // Replace form with success message
            form.innerHTML = `
                <div class="alert alert-success" role="alert">
                    <h4 class="alert-heading">Tack för din anmälan!</h4>
                    <p>Din registrering har mottagits. Kolla i listan nedan för att se din status.</p>
                    <hr>
                    <p class="mb-0">E-post som användes: ${email}</p>
                </div>
            `;

        } catch (error) {
            console.error('Error adding registration:', error);
            alert('Ett fel uppstod vid registrering. Försök igen.');
        }
    });

    // Generate a browser fingerprint
    async function generateBrowserFingerprint() {
        const components = [
            navigator.userAgent,
            navigator.language,
            new Date().getTimezoneOffset(),
            navigator.hardwareConcurrency,
            navigator.deviceMemory,
            navigator.platform,
            navigator.vendor,
            window.screen.colorDepth,
            window.screen.pixelDepth,
            window.screen.width + 'x' + window.screen.height
        ].join('|');
        
        // Create a hash of the components
        const encoder = new TextEncoder();
        const data = encoder.encode(components);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Check if email or device has already registered
    async function checkEmailExists(email) {
        const emailSnapshot = await db.collection('registrations')
            .where('email', '==', email)
            .get();

        if (!emailSnapshot.empty) {
            return true;
        }

        // Get device fingerprint
        const browserFingerprint = await generateBrowserFingerprint();
        
        // Check for existing registration with same fingerprint
        const deviceSnapshot = await db.collection('registrations')
            .where('registrationInfo.browserFingerprint', '==', browserFingerprint)
            .get();

        return !deviceSnapshot.empty;
    }

    // Update registration lists
    function updateLists(registrations) {
        confirmedList.innerHTML = '';
        waitingList.innerHTML = '';

        // Calculate current tier
        const totalCount = registrations.length;
        let currentTier = 8;
        if (totalCount >= 64) currentTier = 64;
        else if (totalCount >= 32) currentTier = 32;
        else if (totalCount >= 16) currentTier = 16;

        // Sort by timestamp
        registrations.sort((a, b) => {
            const timeA = a.timestamp ? a.timestamp.toDate().getTime() : 0;
            const timeB = b.timestamp ? b.timestamp.toDate().getTime() : 0;
            return timeA - timeB;
        });

        let confirmedCount = 0;
        let waitingCount = 0;

        registrations.forEach((reg, index) => {
            const listItem = document.createElement('li');
            listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
            
            const shouldBeConfirmed = index < currentTier;
            const status = shouldBeConfirmed ? 'confirmed' : 'waiting';

            // Update status in Firestore if needed
            if (reg.status !== status) {
                db.collection('registrations')
                    .where('email', '==', reg.email)
                    .limit(1)
                    .get()
                    .then(snapshot => {
                        if (!snapshot.empty) {
                            snapshot.docs[0].ref.update({ status: status });
                        }
                    });
            }

            if (shouldBeConfirmed) {
                confirmedCount++;
                listItem.innerHTML = `
                    <span>
                        <span class="badge bg-primary me-2">${confirmedCount}</span>
                        ${reg.name} (${reg.className})
                    </span>
                `;
                confirmedList.appendChild(listItem);
            } else {
                waitingCount++;
                listItem.innerHTML = `
                    <span>
                        <span class="badge bg-secondary me-2">${waitingCount}</span>
                        ${reg.name} (${reg.className})
                    </span>
                `;
                waitingList.appendChild(listItem);
            }
        });

        confirmedCountEl.textContent = `(${Math.min(currentTier, totalCount)}/${currentTier})`;
        waitingCountEl.textContent = `(${Math.max(0, totalCount - currentTier)})`;
    }

    // Listen for registration updates
    db.collection('registrations')
        .orderBy('timestamp')
        .onSnapshot((snapshot) => {
            const registrations = [];
            snapshot.forEach((doc) => {
                registrations.push(doc.data());
            });
            updateLists(registrations);
        }, (error) => {
            console.error("Error loading registrations:", error);
        });

    // Listen for registration deletion events from admin panel
    window.addEventListener('registrationDeleted', function(event) {
        const deletedEmail = event.detail.email;
        const storedEmail = localStorage.getItem('registeredEmail');
        
        // If this device's registration was deleted, clear localStorage
        if (deletedEmail === storedEmail) {
            localStorage.removeItem('hasRegistered');
            localStorage.removeItem('registeredEmail');
            localStorage.removeItem('registrationId');
            
            // Reload the page to show the registration form again
            window.location.reload();
        }
    });
}); 