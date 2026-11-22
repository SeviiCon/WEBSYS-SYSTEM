-- MediBook Health Clinic: Clinic Appointment Management System
CREATE DATABASE IF NOT EXISTS medibook_clinic CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE medibook_clinic;

CREATE TABLE doctors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  specialty VARCHAR(100) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1
);

-- Clinic operating hours (weekday: 1 = Monday ... 7 = Sunday)
CREATE TABLE clinic_hours (
  weekday TINYINT PRIMARY KEY,
  is_open TINYINT(1) NOT NULL DEFAULT 1,
  open_time TIME NULL,
  close_time TIME NULL
);

-- Doctor schedules: the time ranges patients can book (split into 30-minute slots)
CREATE TABLE doctor_schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  doctor_id INT NOT NULL,
  weekday TINYINT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
);

-- Basic patient details needed for booking
CREATE TABLE patients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  phone VARCHAR(30) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reference VARCHAR(12) NULL UNIQUE,
  patient_id INT NOT NULL,
  doctor_id INT NOT NULL,
  visit_type ENUM('consultation','checkup','follow-up','medical-certificate') NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  patient_note VARCHAR(500) NULL,
  status ENUM('pending','confirmed','completed','cancelled') NOT NULL DEFAULT 'pending',
  cancelled_by ENUM('patient','clinic') NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- Prevents double booking: one active appointment per doctor/date/time.
  -- Cancelled appointments free the slot (value becomes NULL).
  active_slot VARCHAR(40) GENERATED ALWAYS AS (
    IF(status = 'cancelled', NULL, CONCAT(doctor_id, '|', appointment_date, '|', appointment_time))
  ) STORED,
  UNIQUE KEY uq_active_slot (active_slot),
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (doctor_id) REFERENCES doctors(id)
);

-- Clinic staff accounts
CREATE TABLE admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL
);

CREATE TABLE contact_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(60) NOT NULL,
  last_name VARCHAR(60) NOT NULL,
  email VARCHAR(150) NOT NULL,
  phone VARCHAR(30) NULL,
  inquiry_type VARCHAR(40) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------- Sample data (edit freely) ----------
INSERT INTO clinic_hours (weekday, is_open, open_time, close_time) VALUES
(1,1,'08:00','17:00'),(2,1,'08:00','17:00'),(3,1,'08:00','17:00'),
(4,1,'08:00','17:00'),(5,1,'08:00','17:00'),(6,1,'08:00','12:00'),(7,0,NULL,NULL);

INSERT INTO doctors (name, specialty) VALUES
('Dr. Maria Santos', 'General Medicine'),
('Dr. Juan Dela Cruz', 'Internal Medicine'),
('Dr. Ana Reyes', 'Family Medicine');

INSERT INTO doctor_schedules (doctor_id, weekday, start_time, end_time) VALUES
(1,1,'09:00','12:00'),(1,1,'13:00','16:00'),(1,3,'09:00','12:00'),(1,3,'13:00','16:00'),(1,5,'09:00','12:00'),(1,5,'13:00','16:00'),
(2,2,'09:00','12:00'),(2,2,'13:00','16:00'),(2,4,'09:00','12:00'),(2,4,'13:00','16:00'),(2,6,'08:00','12:00'),
(3,1,'08:00','12:00'),(3,2,'08:00','12:00'),(3,3,'08:00','12:00'),(3,4,'08:00','12:00'),(3,5,'08:00','12:00');

-- Default admin login: username "admin", password "admin123"  (change this!)
INSERT INTO admins (username, password_hash) VALUES
('admin', '$2b$12$0TZfyNdmmekMX6jSzIkJW.oyVXO9fS63JFqfJ1pF5pBZAOc/2bRH.');
