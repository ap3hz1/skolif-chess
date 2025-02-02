document.addEventListener('DOMContentLoaded', function() {
    // Check if Firebase is properly initialized
    if (!window.db) {
        console.error('Firebase database not initialized');
        alert('Ett fel uppstod vid anslutning till databasen. Vänligen ladda om sidan.');
        return;
    }

    // Get DOM elements
    const loginForm = document.getElementById('loginForm');
    const adminDashboard = document.getElementById('adminDashboard');
    const adminLoginForm = document.getElementById('adminLoginForm');
    const logoutBtn = document.getElementById('logoutBtn');
    const registrationsTable = document.getElementById('registrationsTable');
    const totalRegistrationsEl = document.getElementById('totalRegistrations');
    const confirmedPlayersEl = document.getElementById('confirmedPlayers');
    const waitingListEl = document.getElementById('waitingList');

    // Admin credentials (in production, this should be handled securely through Firebase Auth)
    const ADMIN_USERNAME = 'admin';
    const ADMIN_PASSWORD = 'AbedBernar123';

    // Update statistics function
    function updateStats(registrations) {
        if (!totalRegistrationsEl || !confirmedPlayersEl || !waitingListEl) {
            console.error('Stats elements not found');
            return;
        }

        const totalCount = registrations.length;
        
        // Calculate current tier using the same logic as script.js
        let currentTier = 8;
        if (totalCount >= 64) currentTier = 64;
        else if (totalCount >= 32) currentTier = 32;
        else if (totalCount >= 16) currentTier = 16;

        // Count confirmed and waiting players
        const confirmedPlayers = registrations.filter(reg => reg.status === 'confirmed');
        const waitingPlayers = registrations.filter(reg => reg.status === 'waiting');

        // Sort by timestamp to ensure consistent ordering
        const allPlayers = [...registrations].sort((a, b) => {
            const timeA = a.timestamp ? a.timestamp.toDate().getTime() : 0;
            const timeB = b.timestamp ? b.timestamp.toDate().getTime() : 0;
            return timeA - timeB;
        });

        // Update player statuses based on their position
        allPlayers.forEach((player, index) => {
            if (index < currentTier && player.status === 'waiting') {
                // Update to confirmed if within tier limit
                db.collection('registrations')
                    .where('email', '==', player.email)
                    .limit(1)
                    .get()
                    .then(snapshot => {
                        if (!snapshot.empty) {
                            snapshot.docs[0].ref.update({ status: 'confirmed' });
                        }
                    });
            }
        });

        // Update display
        totalRegistrationsEl.textContent = totalCount;
        confirmedPlayersEl.textContent = `${Math.min(currentTier, totalCount)}/${currentTier}`;
        waitingListEl.textContent = Math.max(0, totalCount - currentTier);
    }

    // Handle login
    adminLoginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
            loginForm.classList.add('d-none');
            adminDashboard.classList.remove('d-none');
            loadRegistrations();
        } else {
            alert('Felaktigt användarnamn eller lösenord');
        }
    });

    // Handle logout
    logoutBtn.addEventListener('click', function() {
        loginForm.classList.remove('d-none');
        adminDashboard.classList.add('d-none');
        adminLoginForm.reset();
    });

    // Format timestamp
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

    // Load and display registrations
    function loadRegistrations() {
        db.collection('registrations')
            .orderBy('timestamp', 'desc')
            .onSnapshot((snapshot) => {
                if (!registrationsTable) {
                    console.error('Registrations table not found');
                    return;
                }

                registrationsTable.innerHTML = ''; // Clear existing rows
                let index = 1;
                const registrations = [];

                snapshot.forEach((doc) => {
                    const registration = doc.data();
                    registrations.push(registration);
                    const row = document.createElement('tr');
                    
                    const timestamp = registration.timestamp ? registration.timestamp.toDate() : new Date();
                    const formattedDate = timestamp.toLocaleDateString('sv-SE') + ' ' + 
                                        timestamp.toLocaleTimeString('sv-SE');

                    row.innerHTML = `
                        <td>${index}</td>
                        <td>${registration.name}</td>
                        <td>${registration.email}</td>
                        <td>${registration.className}</td>
                        <td>${registration.status}</td>
                        <td>${formattedDate}</td>
                        <td>
                            <button onclick="removeRegistration('${doc.id}')" class="btn btn-danger btn-sm">
                                Ta bort
                            </button>
                        </td>
                    `;
                    registrationsTable.appendChild(row);
                    index++;
                });

                // Update statistics with the collected registrations
                updateStats(registrations);
            }, (error) => {
                console.error("Error loading registrations:", error);
            });
    }

    // Remove a registration
    window.removeRegistration = async function(docId) {
        if (confirm('Är du säker på att du vill ta bort denna registrering?')) {
            try {
                await db.collection('registrations').doc(docId).delete();
                // Stats will update automatically through the snapshot listener
            } catch (error) {
                console.error("Error removing registration:", error);
                alert('Ett fel uppstod när registreringen skulle tas bort');
            }
        }
    };

    // Check if user is already logged in (dashboard is visible)
    if (!adminDashboard.classList.contains('d-none')) {
        loadRegistrations();
    }
}); 