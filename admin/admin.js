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
        
        // Calculate current tier
        let currentTier = 8;
        if (totalCount >= 64) currentTier = 64;
        else if (totalCount >= 32) currentTier = 32;
        else if (totalCount >= 16) currentTier = 16;

        // Sort by timestamp to ensure consistent ordering
        const allPlayers = [...registrations].sort((a, b) => {
            const timeA = a.timestamp ? a.timestamp.toDate().getTime() : 0;
            const timeB = b.timestamp ? b.timestamp.toDate().getTime() : 0;
            return timeA - timeB;
        });

        // Calculate status without updating documents
        allPlayers.forEach((player, index) => {
            player.displayStatus = index < currentTier ? 'confirmed' : 'waiting';
        });

        // Update the table with calculated status
        const rows = registrationsTable.getElementsByTagName('tr');
        for (let i = 0; i < rows.length; i++) {
            const statusCell = rows[i].cells[4]; // Status is in the 5th column
            if (statusCell) {
                const playerEmail = rows[i].cells[2].textContent; // Email is in the 3rd column
                const player = allPlayers.find(p => p.email === playerEmail);
                if (player) {
                    statusCell.textContent = player.displayStatus;
                    statusCell.className = player.displayStatus === 'confirmed' ? 'text-success' : 'text-warning';
                }
            }
        }

        // Update display counts
        const confirmedCount = allPlayers.filter((_, index) => index < currentTier).length;
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
            .orderBy('timestamp', 'asc') // Changed to ascending to match status calculation
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

                    // Create a details string for the tooltip
                    const deviceDetails = registration.deviceInfo ? `
                        IP: ${registration.ipAddress || 'N/A'}
                        Enhet: ${registration.deviceInfo.platform || 'N/A'}
                        Webbläsare: ${registration.deviceInfo.userAgent.split(') ')[0] + ')' || 'N/A'}
                        Skärm: ${registration.deviceInfo.screenResolution || 'N/A'}
                        Språk: ${registration.deviceInfo.language || 'N/A'}
                    `.replace(/\n\s+/g, '\n') : 'Ingen enhetsinformation tillgänglig';

                    row.innerHTML = `
                        <td>${index}</td>
                        <td>${registration.name}</td>
                        <td>${registration.email}</td>
                        <td>${registration.className}</td>
                        <td class="status-cell">...</td>
                        <td>${formattedDate}</td>
                        <td>
                            <button class="btn btn-info btn-sm me-2" 
                                data-bs-toggle="tooltip" 
                                data-bs-placement="left" 
                                title="${deviceDetails.replace(/"/g, '&quot;')}">
                                <i class="bi bi-info-circle"></i> Info
                            </button>
                            <button onclick="removeRegistration('${doc.id}')" class="btn btn-danger btn-sm">
                                Ta bort
                            </button>
                        </td>
                    `;
                    registrationsTable.appendChild(row);

                    // Initialize tooltips
                    const tooltips = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
                    tooltips.map(function (tooltipTriggerEl) {
                        return new bootstrap.Tooltip(tooltipTriggerEl);
                    });

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
                // Get the registration data before deleting
                const docRef = await db.collection('registrations').doc(docId).get();
                const registration = docRef.data();
                
                // Delete from Firestore
                await db.collection('registrations').doc(docId).delete();

                // Broadcast a custom event that will be caught by script.js
                const event = new CustomEvent('registrationDeleted', {
                    detail: { email: registration.email }
                });
                window.dispatchEvent(event);

                console.log('Registration deleted successfully');
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