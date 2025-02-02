document.addEventListener('DOMContentLoaded', function() {
    // Check if Firebase is initialized properly
    if (!firebase || !firebase.firestore) {
        console.error('Firebase is not initialized properly');
        alert('Ett fel uppstod vid anslutning till databasen. Vänligen ladda om sidan.');
        return;
    }

    const db = firebase.firestore();
    const form = document.getElementById('registrationForm');
    const emailInput = document.getElementById('email');
    const confirmedList = document.getElementById('confirmedList');
    const waitingList = document.getElementById('waitingList');
    const confirmedCount = document.getElementById('confirmedCount');
    const waitingCount = document.getElementById('waitingCount');

    let currentTier = 8; // Starting with 8 players
    let registrations = [];

    // Add animation class to form on load
    form.classList.add('animate__animated', 'animate__fadeIn');

    // Function to validate email
    function validateEmail(email) {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@elev\.gnesta\.se$/;
        return emailRegex.test(email);
    }

    // Function to format timestamp
    function formatTimestamp(timestamp) {
        if (!timestamp || !timestamp.toDate) {
            return 'Nyss';
        }
        const date = timestamp.toDate();
        return date.toLocaleString('sv-SE', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Function to update registration lists
    function updateRegistrationLists() {
        confirmedList.innerHTML = '';
        waitingList.innerHTML = '';
        
        registrations.forEach((reg, index) => {
            const listItem = document.createElement('li');
            listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
            
            const playerInfo = document.createElement('div');
            playerInfo.className = 'player-info';
            
            const playerNumber = document.createElement('span');
            playerNumber.className = 'player-number';
            playerNumber.textContent = index + 1;
            
            const playerDetails = document.createElement('div');
            playerDetails.innerHTML = `
                <div class="player-name">${reg.name}</div>
                <div class="player-class">${reg.className}</div>
            `;
            
            playerInfo.appendChild(playerNumber);
            playerInfo.appendChild(playerDetails);
            listItem.appendChild(playerInfo);
            
            const timestamp = document.createElement('small');
            timestamp.className = 'text-muted';
            timestamp.textContent = formatTimestamp(reg.timestamp);
            listItem.appendChild(timestamp);

            if (index < currentTier) {
                confirmedList.appendChild(listItem);
            } else {
                waitingList.appendChild(listItem);
            }
        });

        // Update counts
        confirmedCount.textContent = `(${Math.min(registrations.length, currentTier)}/${currentTier})`;
        waitingCount.textContent = `(${Math.max(0, registrations.length - currentTier)})`;

        // Check if we need to increase the tier
        if (registrations.length >= currentTier) {
            if (currentTier === 8) currentTier = 16;
            else if (currentTier === 16) currentTier = 32;
            else if (currentTier === 32) currentTier = 64;
        }
    }

    // Real-time email validation
    emailInput.addEventListener('input', function() {
        const email = this.value;
        
        // Remove @elev.gnesta.se if user types it
        if (email.endsWith('@elev.gnesta.se')) {
            this.value = email.replace('@elev.gnesta.se', '');
            return;
        }

        const fullEmail = email + '@elev.gnesta.se';
        if (email && !validateEmail(fullEmail)) {
            this.setCustomValidity('Du måste använda din @elev.gnesta.se e-postadress');
            this.classList.add('is-invalid');
        } else {
            this.setCustomValidity('');
            this.classList.remove('is-invalid');
        }
    });

    // Listen for registration changes
    try {
        db.collection('registrations').orderBy('timestamp').onSnapshot((snapshot) => {
            registrations = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            updateRegistrationLists();
        }, (error) => {
            console.error("Error getting registrations:", error);
            alert('Ett fel uppstod vid hämtning av registreringar. Vänligen ladda om sidan.');
        });
    } catch (error) {
        console.error("Error setting up registration listener:", error);
    }

    // Form submission handling
    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Add was-validated class to show validation feedback
        form.classList.add('was-validated');

        // Get form values
        const name = document.getElementById('name').value.trim();
        const email = emailInput.value.trim() + '@elev.gnesta.se';
        const className = document.getElementById('class').value;
        const consent = document.getElementById('consent').checked;

        // Validate all fields
        if (!name || !validateEmail(email) || !className || !consent) {
            form.classList.add('animate__animated', 'animate__shakeX');
            setTimeout(() => {
                form.classList.remove('animate__animated', 'animate__shakeX');
            }, 1000);
            return;
        }

        try {
            // Check if email is already registered
            const emailCheck = await db.collection('registrations')
                .where('email', '==', email)
                .get();

            if (!emailCheck.empty) {
                alert('Denna e-postadress är redan registrerad.');
                return;
            }

            // Add registration to Firebase
            await db.collection('registrations').add({
                name,
                email,
                className,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                status: registrations.length < currentTier ? 'confirmed' : 'waiting'
            });

            // Show success message
            const successAlert = document.createElement('div');
            successAlert.className = 'alert alert-success mt-3 animate__animated animate__fadeInDown';
            successAlert.role = 'alert';
            successAlert.innerHTML = `
                <h4 class="alert-heading">♔ Tack för din anmälan!</h4>
                <p>Vi har tagit emot din registrering till schackturneringen. Du kommer att få mer information via e-post inom kort.</p>
            `;

            // Remove any existing alerts
            const existingAlerts = form.parentElement.querySelectorAll('.alert');
            existingAlerts.forEach(alert => alert.remove());

            form.insertAdjacentElement('beforebegin', successAlert);
            
            // Reset form
            form.classList.remove('was-validated');
            form.reset();

            // Remove success message after 5 seconds
            setTimeout(() => {
                successAlert.classList.remove('animate__fadeInDown');
                successAlert.classList.add('animate__fadeOutUp');
                setTimeout(() => {
                    successAlert.remove();
                }, 500);
            }, 5000);

        } catch (error) {
            console.error('Error adding registration:', error);
            alert('Ett fel uppstod vid registrering. Kontrollera din internetanslutning och försök igen.');
        }
    });
}); 