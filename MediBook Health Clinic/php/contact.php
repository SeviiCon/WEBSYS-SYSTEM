<?php
require __DIR__ . '/config.php';
require_post();

$first   = clean($_POST['first_name'] ?? '');
$last    = clean($_POST['last_name'] ?? '');
$email   = clean($_POST['email'] ?? '');
$phone   = clean($_POST['phone'] ?? '');
$type    = clean($_POST['inquiry_type'] ?? '');
$message = clean($_POST['message'] ?? '');

$types = ['appointment', 'services', 'medical-certificate', 'feedback', 'other'];
$errors = [];
if ($first === '' || $last === '') $errors[] = 'Please enter your first and last name.';
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'Please enter a valid email address.';
if ($phone !== '' && !valid_phone($phone)) $errors[] = 'Please enter a valid contact number.';
if (!in_array($type, $types, true)) $errors[] = 'Please select a type of inquiry.';
if ($message === '' || mb_strlen($message) > 2000) $errors[] = 'Please enter a message (up to 2000 characters).';
if ($errors) respond(['ok' => false, 'message' => implode(' ', $errors)], 422);

try {
    db()->prepare('INSERT INTO contact_messages (first_name, last_name, email, phone, inquiry_type, message)
        VALUES (?, ?, ?, ?, ?, ?)')->execute([$first, $last, $email, $phone ?: null, $type, $message]);
    respond(['ok' => true, 'message' => 'Thank you! Your message has been sent.']);
} catch (Throwable $e) {
    respond(['ok' => false, 'message' => 'Server error. Please try again later.'], 500);
}
