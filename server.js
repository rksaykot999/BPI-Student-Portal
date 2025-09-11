const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Serve static HTML
app.use(express.static(path.join(__dirname, 'public')));

// MySQL Connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'rksaykot',   // <-- your password
    database: 'bpistudentportal',
    port: 3306
});

db.connect(err => {
    if(err) {
        console.error('DB connection error:', err);
        return;
    }
    console.log('Connected to MySQL database.');
});

// ----------- Routes -----------

// Home route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Teacher Login
app.post('/api/teacher-login', (req, res) => {
    const { email, password } = req.body;
    if(!email || !password) return res.status(400).json({ success:false, message:'Email & password required' });

    db.query('SELECT * FROM teachers WHERE email = ? AND password = ?', [email, password], (err, results) => {
        if(err) return res.status(500).json({ success:false, message:'DB error' });
        if(results.length === 0) return res.json({ success:false, message:'Invalid credentials' });
        res.json({ success:true, teacher: results[0] });
    });
});

// Student Login
app.post('/api/student-login', (req, res) => {
    const { identifier, password } = req.body;
    if(!identifier || !password) return res.status(400).json({ success:false, message:'Identifier & password required' });

    db.query('SELECT * FROM students WHERE (roll_no = ? OR email = ?) AND password = ?', [identifier, identifier, password], (err, results) => {
        if(err) return res.status(500).json({ success:false, message:'DB error' });
        if(results.length === 0) return res.json({ success:false, message:'Invalid credentials' });
        res.json({ success:true, student: results[0] });
    });
});

// Get all students (teacher dashboard)
app.get('/api/students', (req, res) => {
    db.query('SELECT id, roll_no, name, class, email FROM students ORDER BY id DESC', (err, results) => {
        if(err) return res.status(500).json({ success:false, message:'DB error' });
        res.json({ students: results });
    });
});

// Get single student data
app.get('/api/student/:id', (req, res) => {
    const studentId = req.params.id;
    db.query('SELECT id, roll_no, name, class, email FROM students WHERE id = ?', [studentId], (err, studentResults) => {
        if(err || studentResults.length === 0) return res.status(404).json({ message:'Student not found' });
        const student = studentResults[0];

        // Fetch results
        db.query('SELECT subject, marks, grade FROM results WHERE student_id = ?', [studentId], (err, resultsData) => {
            if(err) return res.status(500).json({ message:'Error fetching results' });

            // Fetch attendance
            db.query('SELECT present, total FROM attendance WHERE student_id = ?', [studentId], (err, attendanceData) => {
                if(err) return res.status(500).json({ message:'Error fetching attendance' });

                // Fetch performance
                db.query('SELECT remarks, rating FROM performance WHERE student_id = ?', [studentId], (err, performanceData) => {
                    if(err) return res.status(500).json({ message:'Error fetching performance' });

                    // Notices
                    db.query('SELECT title FROM notices ORDER BY created_at DESC LIMIT 5', (err, noticesData) => {
                        if(err) return res.status(500).json({ message:'Error fetching notices' });

                        // Exams
                        db.query('SELECT exam_name FROM exams ORDER BY date ASC LIMIT 5', (err, examsData) => {
                            if(err) return res.status(500).json({ message:'Error fetching exams' });

                            // Assignments
                            db.query('SELECT title FROM assignments ORDER BY due_date ASC LIMIT 5', (err, assignmentsData) => {
                                if(err) return res.status(500).json({ message:'Error fetching assignments' });

                                res.json({
                                    id: student.id,
                                    roll_no: student.roll_no,
                                    name: student.name,
                                    class: student.class,
                                    email: student.email,
                                    results: resultsData,
                                    attendance: attendanceData[0] || {present:0, total:0},
                                    performance: performanceData[0] || null,
                                    notices: noticesData.map(n => n.title),
                                    exams: examsData.map(e => e.exam_name),
                                    assignments: assignmentsData.map(a => a.title)
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});

// Start server
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
