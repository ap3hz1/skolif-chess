document.addEventListener('DOMContentLoaded', function() {
    // Check if Firebase is properly initialized
    if (!window.db) {
        console.error('Firebase database not initialized');
        alert('Ett fel uppstod vid anslutning till databasen. Vänligen ladda om sidan.');
        return;
    }

    const loginForm = document.getElementById('loginForm');
    const adminDashboard = document.getElementById('adminDashboard');
    const adminLoginForm = document.getElementById('adminLoginForm');
    const logoutBtn = document.getElementById('logoutBtn');
    const registrationsTable = document.getElementById('registrationsTable');
    const totalRegistrationsEl = document.getElementById('totalRegistrations');
    const confirmedCountEl = document.getElementById('confirmedCount');
    const waitingCountEl = document.getElementById('waitingCount');

    // Admin credentials (in production, this should be handled securely through Firebase Auth)
    const ADMIN_USERNAME = 'admin';
    const ADMIN_PASSWORD = 'AbedBernar123';

    let registrations = [];

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

    // Update stats
    function updateStats() {
        const confirmed = registrations.filter(r => r.status === 'confirmed').length;
        const waiting = registrations.filter(r => r.status === 'waiting').length;

        totalRegistrationsEl.textContent = registrations.length;
        confirmedCountEl.textContent = confirmed;
        waitingCountEl.textContent = waiting;
    }

    // Load and display registrations
    function loadRegistrations() {
        try {
            window.db.collection('registrations')
                .orderBy('timestamp')
                .onSnapshot((snapshot) => {
                    registrations = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    updateRegistrationsTable();
                    updateStats();
                }, (error) => {
                    console.error("Error loading registrations:", error);
                    alert('Ett fel uppstod vid laddning av registreringar');
                });
        } catch (error) {
            console.error("Error setting up registration listener:", error);
            alert('Ett fel uppstod vid anslutning till databasen');
        }
    }

    // Update registrations table
    function updateRegistrationsTable() {
        registrationsTable.innerHTML = '';
        
        registrations.forEach((reg, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${index + 1}</td>
                <td>${reg.name}</td>
                <td>${reg.email}</td>
                <td>${reg.className}</td>
                <td>
                    <span class="status-badge ${reg.status === 'confirmed' ? 'status-confirmed' : 'status-waiting'}">
                        ${reg.status === 'confirmed' ? 'Bekräftad' : 'I kö'}
                    </span>
                </td>
                <td>${formatTimestamp(reg.timestamp)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-danger btn-sm" onclick="removeRegistration('${reg.id}')">
                            Ta bort
                        </button>
                    </div>
                </td>
            `;
            registrationsTable.appendChild(tr);
        });
    }

    // Remove registration
    window.removeRegistration = async function(id) {
        if (confirm('Är du säker på att du vill ta bort denna registrering?')) {
            try {
                await window.db.collection('registrations').doc(id).delete();
                alert('Registrering borttagen');
            } catch (error) {
                console.error("Error removing registration:", error);
                alert('Ett fel uppstod vid borttagning av registrering');
            }
        }
    };
}); 