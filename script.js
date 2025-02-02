document.addEventListener('DOMContentLoaded', function() {
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
    const hasRegistered = localStorage.getItem('hasRegistered');
    if (hasRegistered) {
        form.innerHTML = `
            <div class="alert alert-info" role="alert">
                <h4 class="alert-heading">Du är redan anmäld!</h4>
                <p>Du har redan registrerat dig från denna enhet. Om detta är ett misstag eller om du behöver göra ändringar, 
                kontakta administratören.</p>
                <hr>
                <p class="mb-0">E-post som användes: ${localStorage.getItem('registeredEmail')}</p>
            </div>
        `;
    }

    // Handle form submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Check if already registered
        if (hasRegistered) {
            alert('Du har redan registrerat dig från denna enhet.');
            return;
        }

        if (!form.checkValidity()) {
            e.stopPropagation();
            form.classList.add('was-validated');
            return;
        }

        const name = document.getElementById('name').value;
        const className = document.getElementById('class').value;
        let email = document.getElementById('email').value.toLowerCase();
        if (!email.endsWith('@elev.gnesta.se')) {
            email = email + '@elev.gnesta.se';
        }

        // Check if email is already registered
        const emailExists = await checkEmailExists(email);
        if (emailExists) {
            alert('Denna e-postadress är redan registrerad.');
            return;
        }

        try {
            await db.collection('registrations').add({
                name: name,
                email: email,
                className: className,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'waiting'
            });

            // Store registration in localStorage
            localStorage.setItem('hasRegistered', 'true');
            localStorage.setItem('registeredEmail', email);

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

    // Check if email already exists
    async function checkEmailExists(email) {
        const snapshot = await db.collection('registrations')
            .where('email', '==', email)
            .get();
        return !snapshot.empty;
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
}); 