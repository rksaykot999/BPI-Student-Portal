// Load environment variables from .env file
require('dotenv').config();

// Import necessary modules
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Enable JSON body parsing for incoming requests
app.use(express.json());

// Serve static files (HTML, CSS, JS) from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Database connection pool setup
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Helper function for making API calls to Gemini
async function getGeminiAnalysis(prompt) {
    const systemPrompt = "You are an educational AI assistant. Provide a concise, professional, and empathetic analysis of a student's academic performance and suggestions for improvement. The analysis should be based on the provided student data.";
    const userQuery = prompt;
    const apiKey = ""; // Canvas will provide this in runtime
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error('API call failed with status:', response.status);
            return 'Could not generate report at this time.';
        }

        const result = await response.json();
        const candidate = result.candidates?.[0];
        if (candidate && candidate.content?.parts?.[0]?.text) {
            return candidate.content.parts[0].text;
        } else {
            return 'No analysis available.';
        }
    } catch (error) {
        console.error("Gemini API call error:", error);
        return 'An error occurred while generating the report.';
    }
}

//--- ROUTES ---

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Teacher Login Route
app.post('/teacher-login', async (req, res) => {
    const { email, password } = req.body;
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.execute(
            'SELECT * FROM teachers WHERE email = ? AND password = ?',
            [email, password]
        );

        if (rows.length > 0) {
            res.status(200).json({ message: 'Login successful', teacher: rows[0] });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login' });
    } finally {
        if (connection) connection.release();
    }
});

// Student Login Route
app.post('/student-login', async (req, res) => {
    const { roll_number, registration_number } = req.body;
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.execute(
            'SELECT * FROM student WHERE roll_number = ? AND registration_number = ?',
            [roll_number, registration_number]
        );

        if (rows.length > 0) {
            res.status(200).json({ message: 'Login successful', student: rows[0] });
        } else {
            res.status(401).json({ message: 'Invalid roll number or registration number' });
        }
    } catch (error) {
        console.error('Student login error:', error.message);
        res.status(500).json({ message: 'Server error during student login' });
    } finally {
        if (connection) connection.release();
    }
});

// Dashboard Data Route (for Teachers)
app.get('/dashboard-data', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();

        const [studentCountResult] = await connection.execute('SELECT COUNT(*) AS totalStudents FROM student');
        const totalStudents = studentCountResult[0].totalStudents;

        const [recentStudents] = await connection.execute(
            'SELECT id, name, roll_number, department, semester FROM student ORDER BY id DESC');

        const [totalClassesResult] = await connection.execute('SELECT COUNT(DISTINCT exam_name) AS totalClasses FROM exams');
        const totalClasses = totalClassesResult[0].totalClasses;

        const [pendingResultsResult] = await connection.execute('SELECT COUNT(*) AS pendingResults FROM results WHERE grade IS NULL OR grade = ""');
        const pendingResults = pendingResultsResult[0].pendingResults;

        const teacherName = "Teacher";

        res.status(200).json({
            teacherName,
            totalStudents,
            totalClasses,
            pendingResults,
            recentStudents
        });

    } catch (error) {
        console.error('Dashboard data fetch error:', error);
        res.status(500).json({ message: 'Failed to fetch dashboard data' });
    } finally {
        if (connection) connection.release();
    }
});

// Student Dashboard Data Route
app.get('/student-dashboard-data/:id', async (req, res) => {
    const studentId = req.params.id;
    let connection;
    try {
        connection = await pool.getConnection();
        const [student] = await connection.execute('SELECT * FROM student WHERE id = ?', [studentId]);
        const [results] = await connection.execute('SELECT * FROM results WHERE student_id = ?', [studentId]);
        const [attendance] = await connection.execute('SELECT * FROM attendance WHERE student_id = ?', [studentId]);
        const [performance] = await connection.execute('SELECT * FROM performance WHERE student_id = ?', [studentId]);

        if (student.length > 0) {
            res.status(200).json({
                student: student[0],
                results: results,
                attendance: attendance,
                performance: performance[0]
            });
        } else {
            res.status(404).json({ message: 'Student not found.' });
        }
    } catch (error) {
        console.error('Student dashboard data fetch error:', error.message);
        res.status(500).json({ message: 'Failed to fetch student data.' });
    } finally {
        if (connection) connection.release();
    }
});

// AI Analysis Route
app.post('/ai-analysis', async (req, res) => {
    const { student_id } = req.body;
    let connection;
    try {
        connection = await pool.getConnection();

        const [studentData] = await connection.execute('SELECT * FROM student WHERE id = ?', [student_id]);
        const [results] = await connection.execute('SELECT * FROM results WHERE student_id = ?', [student_id]);
        const [attendance] = await connection.execute('SELECT * FROM attendance WHERE student_id = ?', [student_id]);
        const [performance] = await connection.execute('SELECT * FROM performance WHERE student_id = ?', [student_id]);

        if (studentData.length === 0) {
            return res.status(404).json({ message: 'Student not found.' });
        }
        const student = studentData[0];

        const prompt = `Generate a detailed academic and behavioral analysis for the following student.
            Student Name: ${student.name}
            Roll Number: ${student.roll_number}
            Department: ${student.department}
            Semester: ${student.semester}
            Academic Results: ${JSON.stringify(results)}
            Attendance Record: ${JSON.stringify(attendance)}
            Performance Remarks: ${JSON.stringify(performance)}
            `;

        const analysisReport = await getGeminiAnalysis(prompt);

        res.status(200).json({ report: analysisReport });

    } catch (error) {
        console.error('AI Analysis error:', error);
        res.status(500).json({ message: 'Failed to generate AI analysis report' });
    } finally {
        if (connection) connection.release();
    }
});

// Route to add a new student
app.post('/add-student', async (req, res) => {
    const { name, roll_number, registration_number, department, semester, phone_number, session } = req.body;

    let connection;
    try {
        connection = await pool.getConnection();
        const [result] = await connection.execute(
            'INSERT INTO student (name, roll_number, registration_number, department, semester, phone_number, session) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, roll_number, registration_number, department, semester, phone_number, session]
        );

        if (result.affectedRows > 0) {
            res.status(201).json({ message: 'New student added successfully!' });
        } else {
            res.status(500).json({ message: 'Failed to add student.' });
        }
    } catch (error) {
        console.error('Error adding new student:', error);
        res.status(500).json({ message: 'Server error during student addition.' });
    } finally {
        if (connection) connection.release();
    }
});

// Route to add a new result for a student
app.post('/add-result', async (req, res) => {
    const { student_id, subject, marks, grade } = req.body;
    let connection;
    try {
        connection = await pool.getConnection();
        const [result] = await connection.execute(
            'INSERT INTO results (student_id, subject, marks, grade) VALUES (?, ?, ?, ?)',
            [student_id, subject, marks, grade]
        );
        if (result.affectedRows > 0) {
            res.status(201).json({ message: 'Result added successfully!' });
        } else {
            res.status(500).json({ message: 'Failed to add result.' });
        }
    } catch (error) {
        console.error('Error adding result:', error);
        res.status(500).json({ message: 'Server error during result addition.' });
    } finally {
        if (connection) connection.release();
    }
});

// Route to add a new attendance record for a student
app.post('/add-attendance', async (req, res) => {
    const { student_id, attendance_date, status } = req.body;
    let connection;
    try {
        connection = await pool.getConnection();
        const [result] = await connection.execute(
            'INSERT INTO attendance (student_id, attendance_date, status) VALUES (?, ?, ?)',
            [student_id, attendance_date, status]
        );
        if (result.affectedRows > 0) {
            res.status(201).json({ message: 'Attendance record added successfully!' });
        } else {
            res.status(500).json({ message: 'Failed to add attendance record.' });
        }
    } catch (error) {
        console.error('Error adding attendance record:', error);
        res.status(500).json({ message: 'Server error during attendance addition.' });
    } finally {
        if (connection) connection.release();
    }
});

// Route to edit student data
app.post('/edit-student', async (req, res) => {
    const { student_id, name, roll_number, department } = req.body;
    let connection;
    try {
        connection = await pool.getConnection();
        const [result] = await connection.execute(
            'UPDATE student SET name = ?, roll_number = ?, department = ? WHERE id = ?',
            [name, roll_number, department, student_id]
        );

        if (result.affectedRows > 0) {
            res.status(200).json({ message: 'Student data updated successfully!' });
        } else {
            res.status(404).json({ message: 'Student not found or no changes made.' });
        }
    } catch (error) {
        console.error('Error updating student data:', error);
        res.status(500).json({ message: 'Server error during student update.' });
    } finally {
        if (connection) connection.release();
    }
});

// Route to delete a student and all related records
app.post('/delete-student', async (req, res) => {
    const { student_id } = req.body;
    let connection;
    try {
        connection = await pool.getConnection();

        await connection.beginTransaction();

        await connection.execute('DELETE FROM results WHERE student_id = ?', [student_id]);
        await connection.execute('DELETE FROM attendance WHERE student_id = ?', [student_id]);
        await connection.execute('DELETE FROM performance WHERE student_id = ?', [student_id]);

        const [result] = await connection.execute('DELETE FROM student WHERE id = ?', [student_id]);

        if (result.affectedRows > 0) {
            await connection.commit();
            res.status(200).json({ message: 'Student and all related records deleted successfully!' });
        } else {
            await connection.rollback();
            res.status(404).json({ message: 'Student not found.' });
        }
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Error deleting student:', error);
        res.status(500).json({ message: 'Server error during student deletion. Please check the database log for details.' });
    } finally {
        if (connection) connection.release();
    }
});

// Logout Route
app.post('/logout', (req, res) => {
    res.status(200).json({ message: 'Logout successful' });
});

// Announcements Route
app.get('/announcements', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [announcements] = await connection.execute('SELECT * FROM notices ORDER BY created_at DESC');
        res.status(200).json(announcements);
    } catch (error) {
        console.error('Error fetching announcements:', error);
        res.status(500).json({ message: 'Failed to fetch announcements.' });
    } finally {
        if (connection) connection.release();
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});