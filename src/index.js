const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

// Example: login API
app.post('/api/login', (req, res) => {
  const { userId, password } = req.body;

  const query = 'SELECT * FROM students WHERE student_id = ? AND password = ?';
  db.query(query, [userId, password], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.length > 0) {
      res.json({ success: true, user: result[0] });
    } else {
      res.json({ success: false, message: 'Invalid credentials' });
    }
  });
});

// Example: get student data
app.get('/api/student/:id', (req, res) => {
  const id = req.params.id;
  db.query('SELECT * FROM students WHERE student_id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(result[0]);
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
