// Login function
document.getElementById('login-button').addEventListener('click', async () => {
    const email = document.getElementById('user-id-input').value.trim();
    const password = document.getElementById('password-input').value.trim();

    try {
        const response = await fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();

        if(data.success) {
            showDashboard(data.student.id);
        } else {
            document.getElementById('login-message').textContent = data.message;
            document.getElementById('login-message').classList.remove('hidden');
        }
    } catch(err) {
        console.error(err);
    }
});

// Get student info
async function showDashboard(studentId) {
    const res = await fetch(`http://localhost:3000/api/student/${studentId}`);
    const data = await res.json();
    
    // এরপর তোমার updateUI ফাংশন দিয়ে UI আপডেট করো
    updateUI({
        name: data.student.name,
        studentId: data.student.id,
        major: data.student.class,
        enrollmentYear: 2023,
        results: data.results.map(r => ({ subject: r.subject, grade: r.grade, status: r.marks >= 50 ? 'Passed' : 'Failed' })),
        attendance: { attended: data.attendance.filter(a => a.status === 'Present').length, total: data.attendance.length },
        performance: { gpa: 3.0, lastGrade: data.results[data.results.length -1]?.grade || 'N/A' },
        upcomingEvents: [] // যদি ডাটাবেসে না থাকে
    });

    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('dashboard-section').classList.remove('hidden');
}
