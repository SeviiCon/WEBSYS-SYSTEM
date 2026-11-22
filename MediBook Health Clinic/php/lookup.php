<?php
// Patient looks up an appointment with reference number + email.
require __DIR__ . '/config.php';
require_post();

$ref = strtoupper(clean($_POST['reference'] ?? ''));
$email = strtolower(clean($_POST['email'] ?? ''));
try {
    $a = appointment_row(db(), $ref);
    // Same message for "not found" and "wrong email" so references can't be guessed.
    if (!$a || strtolower($a['email']) !== $email) {
        respond(['ok' => false, 'message' => 'No appointment found with that reference number and email.'], 404);
    }
    unset($a['email'], $a['phone'], $a['id']);
    respond(['ok' => true, 'appointment' => $a]);
} catch (Throwable $e) {
    respond(['ok' => false, 'message' => 'Server error. Please try again later.'], 500);
}
