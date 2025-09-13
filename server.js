// server.js
const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// MySQL Connection Pool
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'rksaykot', // আপনার MySQL password
    database: 'bpi_portal',
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test DB Connection
async function testDbConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Connected to MySQL database.');
        connection.release();
    } catch (err) {
        console.error('❌ DB connection error:', err);
    }
}
testDbConnection();

// ---------------- Routes ---------------- //

// Home
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Teacher Login
app.post('/api/teacher-login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email & password required' });

    try {
        const [results] = await pool.query(
            'SELECT * FROM teachers WHERE email = ? AND password = ?',
            [email, password]
        );

        if (results.length === 0) return res.json({ success: false, message: 'Invalid credentials' });
        res.json({ success: true, teacher: results[0] });
    } catch (err) {
        console.error('Teacher login error:', err);
        res.status(500).json({ success: false, message: 'DB error' });
    }
});

// Student Login
app.post('/api/student-login', async (req, res) => {
    const { identifier, password } = req.body;
    if (!identifier || !password) return res.status(400).json({ success: false, message: 'Roll number & registration number required' });

    try {
        const [results] = await pool.query(
            'SELECT * FROM student WHERE roll_number = ? AND registration_number = ?',
            [identifier, password]
        );

        if (results.length === 0) return res.json({ success: false, message: 'Invalid credentials' });
        res.json({ success: true, student: results[0] });
    } catch (err) {
        console.error('Student login error:', err);
        res.status(500).json({ success: false, message: 'DB error' });
    }
});

// ---------------- Get All Students (For Teacher Dashboard) ---------------- //
app.get('/api/students', async (req, res) => {
    try {
        const [results] = await pool.query(
            'SELECT id, roll_number, name, department, semester, registration_number FROM student ORDER BY id DESC'
        );
        res.json({ success: true, students: results });
    } catch (err) {
        console.error('Error fetching students:', err);
        res.status(500).json({ success: false, message: 'DB error' });
    }
});

// ---------------- Get Single Student ---------------- //
app.get('/api/student/:id', async (req, res) => {
    const studentId = req.params.id;
    try {
        const [studentResults] = await pool.query('SELECT * FROM student WHERE id = ?', [studentId]);
        if (studentResults.length === 0) return res.status(404).json({ success: false, message: 'Student not found' });
        const student = studentResults[0];

        const [resultsData] = await pool.query('SELECT subject, marks, grade, exam_type FROM results WHERE student_id = ?', [studentId]);
        const [attendanceData] = await pool.query('SELECT attendance_date AS date, status FROM attendance WHERE student_id = ?', [studentId]);
        const [performanceData] = await pool.query('SELECT remarks, rating FROM performance WHERE student_id = ?', [studentId]);

        const [noticesData] = await pool.query('SELECT title FROM notices ORDER BY created_at DESC LIMIT 5');
        const [examsData] = await pool.query('SELECT exam_name AS name FROM exams ORDER BY exam_date ASC LIMIT 5');
        const [assignmentsData] = await pool.query('SELECT title FROM assignments ORDER BY due_date ASC LIMIT 5');

        res.json({
            success: true,
            student: {
                id: student.id,
                name: student.name,
                roll_number: student.roll_number,
                registration_number: student.registration_number,
                department: student.department,
                semester: student.semester,
                session: student.session,
                phone_number: student.phone_number
            },
            results: resultsData,
            attendance: attendanceData,
            performance: performanceData[0] || null,
            notices: noticesData.map(n => n.title),
            exams: examsData.map(e => e.name),
            assignments: assignmentsData.map(a => a.title)
        });
    } catch (err) {
        console.error('Error fetching student data:', err);
        res.status(500).json({ success: false, message: 'Error fetching data' });
    }
});

// ---------------- Server Start ---------------- //
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
