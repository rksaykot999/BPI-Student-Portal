CREATE DATABASE IF NOT EXISTS bpi_portal;
USE bpi_portal;

-- Student Table
CREATE TABLE IF NOT EXISTS student (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    roll_number VARCHAR(50) UNIQUE NOT NULL,
    registration_number VARCHAR(50) UNIQUE NOT NULL,
    department VARCHAR(100) NOT NULL,
    session VARCHAR(50) NOT NULL,
    semester VARCHAR(50) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Teachers Table
CREATE TABLE IF NOT EXISTS teachers (
    teacher_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample teachers
INSERT INTO teachers (email, password, name)
VALUES
('teacher1@bpi.edu', '123456', 'Mr. Rashedul Islam'),
('teacher2@bpi.edu', '123456', 'Ms. Farida Begum');

-- Attendance Table
CREATE TABLE IF NOT EXISTS attendance (
    attendance_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    attendance_date DATE NOT NULL,
    status ENUM('Present', 'Absent', 'Late', 'Excused') NOT NULL DEFAULT 'Present',
    FOREIGN KEY (student_id) REFERENCES student(id)
);

-- Results Table
CREATE TABLE IF NOT EXISTS results (
    result_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    subject VARCHAR(100) NOT NULL,
    marks INT NOT NULL,
    grade ENUM('A+', 'A', 'B+', 'B', 'C', 'D', 'F') NOT NULL,
    exam_type VARCHAR(50) NOT NULL,
    FOREIGN KEY (student_id) REFERENCES student(id)
);

-- Assignments Table
CREATE TABLE IF NOT EXISTS assignments (
    assignment_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    due_date DATE NOT NULL,
    teacher_id INT,
    FOREIGN KEY (teacher_id) REFERENCES teachers(teacher_id)
);

-- Notices Table
CREATE TABLE IF NOT EXISTS notices (
    notice_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    teacher_id INT,
    FOREIGN KEY (teacher_id) REFERENCES teachers(teacher_id)
);

-- Performance Table
CREATE TABLE IF NOT EXISTS performance (
    performance_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    remarks TEXT,
    rating TINYINT CHECK (rating BETWEEN 1 AND 5),
    FOREIGN KEY (student_id) REFERENCES student(id)
);

-- Exams Table
CREATE TABLE IF NOT EXISTS exams (
    exam_id INT AUTO_INCREMENT PRIMARY KEY,
    exam_name VARCHAR(100) NOT NULL,
    exam_date DATE NOT NULL,
    total_marks INT NOT NULL,
    teacher_id INT,
    FOREIGN KEY (teacher_id) REFERENCES teachers(teacher_id)
);

-- Insert sample students
INSERT INTO student (name, roll_number, registration_number, department, session, semester, phone_number)
VALUES
('Md. Alamin Hossain', '12345', 'BPI2023-101', 'Computer Technology', '2023-24', '1st', '01712345678'),
('Fahim Ahmed', '67890', 'BPI2023-102', 'Civil Technology', '2023-24', '1st', '01812345678'),
('RK Saykot', '743738', '1502269452', 'Computer Technology', '2022-23', '6th', '01981736667');

-- Insert sample attendance
INSERT INTO attendance (student_id, attendance_date, status)
VALUES
(1, '2024-05-01', 'Present'),
(1, '2024-05-02', 'Absent'),
(2, '2024-05-01', 'Present'),
(2, '2024-05-02', 'Late');

-- Insert sample results
INSERT INTO results (student_id, subject, marks, grade, exam_type)
VALUES
(1, 'Physics', 85, 'A', 'Midterm'),
(1, 'Chemistry', 78, 'B+', 'Midterm'),
(2, 'Physics', 92, 'A+', 'Midterm'),
(2, 'Chemistry', 88, 'A', 'Midterm');

-- Insert sample performance
INSERT INTO performance (student_id, remarks, rating)
VALUES
(1, 'Good progress, but needs to improve in group work.', 4),
(2, 'Excellent student, consistently performs well.', 5);
