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

// Route to serve the index.html file for the root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Teacher Login Route
app.post('/teacher-login', async (req, res) => {
    const { email, password } = req.body;
    console.log('Received teacher login request with:', { email, password }); // Log the input
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.execute(
            'SELECT * FROM teachers WHERE email = ? AND password = ?',
            [email, password]
        );

        if (rows.length > 0) {
            // Note: In a real-world app, you would use sessions here.
            // For now, a simple success response is enough for the front-end to proceed.
            res.status(200).json({ message: 'Login successful' });
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
    console.log('Received student login request with:', { roll_number, registration_number }); // Log the input
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.execute(
            'SELECT * FROM student WHERE roll_number = ? AND registration_number = ?',
            [roll_number, registration_number]
        );

        if (rows.length > 0) {
            // Login successful
            res.status(200).json({ message: 'Login successful', student: rows[0] });
        } else {
            // Invalid credentials
            res.status(401).json({ message: 'Invalid roll number or registration number' });
        }
    } catch (error) {
        console.error('Student login error:', error.message); // Updated for more specific error
        res.status(500).json({ message: 'Server error during student login' });
    } finally {
        if (connection) connection.release();
    }
});

// Dashboard Data Route
app.get('/dashboard-data', async (req, res) => {
    console.log('Received teacher dashboard data request.'); // Log the request
    let connection;
    try {
        connection = await pool.getConnection();

        // 1. Get total students count
        const [studentCountResult] = await connection.execute('SELECT COUNT(*) AS totalStudents FROM student');
        const totalStudents = studentCountResult[0].totalStudents;

        // 2. Get recent students data
        const [recentStudents] = await connection.execute('SELECT id, name, roll_number, department, semester FROM student ORDER BY id DESC LIMIT 5');

        // 3. Get total classes and pending results (for now, these are mock data)
        const totalClasses = 3; // Placeholder data
        const pendingResults = 1; // Placeholder data
        const teacherName = "Mr. Shakib Khan"; // Placeholder name

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
    console.log('Received student dashboard data request for ID:', studentId); // Log the input
    let connection;
    try {
        connection = await pool.getConnection();
        const [student] = await connection.execute('SELECT * FROM student WHERE id = ?', [studentId]);
        const [results] = await connection.execute('SELECT * FROM results WHERE student_id = ?', [studentId]);
        const [attendance] = await connection.execute('SELECT * FROM attendance WHERE student_id = ?', [studentId]);

        if (student.length > 0) {
            res.status(200).json({
                student: student[0],
                results: results,
                attendance: attendance,
            });
        } else {
            res.status(404).json({ message: 'Student not found.' });
        }
    } catch (error) {
        console.error('Student dashboard data fetch error:', error.message); // Updated for more specific error
        res.status(500).json({ message: 'Failed to fetch student data.' });
    } finally {
        if (connection) connection.release();
    }
});

// AI Analysis Route
app.post('/ai-analysis', async (req, res) => {
    const { student_id } = req.body;
    console.log('Received AI analysis request for student ID:', student_id); // Log the input
    let connection;
    try {
        connection = await pool.getConnection();

        // Fetch student data from DB
        const [studentData] = await connection.execute('SELECT * FROM student WHERE id = ?', [student_id]);
        
        // Fetch student results, attendance, and performance from DB
        const [results] = await connection.execute('SELECT * FROM results WHERE student_id = ?', [student_id]);
        const [attendance] = await connection.execute('SELECT * FROM attendance WHERE student_id = ?', [student_id]);
        const [performance] = await connection.execute('SELECT * FROM performance WHERE student_id = ?', [student_id]);

        if (studentData.length === 0) {
            return res.status(404).json({ message: 'Student not found.' });
        }
        const student = studentData[0];

        // Construct a detailed prompt for the AI model
        const prompt = `Generate a detailed academic and behavioral analysis for the following student.
Student Name: ${student.name}
Roll Number: ${student.roll_number}
Department: ${student.department}
Semester: ${student.semester}
Academic Results: ${JSON.stringify(results)}
Attendance Record: ${JSON.stringify(attendance)}
Performance Remarks: ${JSON.stringify(performance)}
`;
        
        // Call the Gemini API for analysis
        const analysisReport = await getGeminiAnalysis(prompt);

        res.status(200).json({ report: analysisReport });

    } catch (error) {
        console.error('AI Analysis error:', error);
        res.status(500).json({ message: 'Failed to generate AI analysis report' });
    } finally {
        if (connection) connection.release();
    }
});

// Logout Route
app.post('/logout', (req, res) => {
    // In a real app, you would destroy the session here.
    // For this example, we just send a success message.
    console.log('Received logout request.'); // Log the request
    res.status(200).json({ message: 'Logout successful' });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
