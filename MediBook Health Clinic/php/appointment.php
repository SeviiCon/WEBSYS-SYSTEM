<?php
// Book an appointment (patient side).
require __DIR__ . '/config.php';
require_post();

$name   = clean($_POST['patient_name'] ?? '');
$email  = strtolower(clean($_POST['patient_email'] ?? ''));
$phone  = clean($_POST['patient_phone'] ?? '');
$date   = clean($_POST['preferred_date'] ?? '');
$time   = clean($_POST['preferred_time'] ?? '');
$type   = clean($_POST['visit_type'] ?? '');
$doctor = (int)($_POST['preferred_doctor'] ?? 0);
$note   = clean($_POST['patient_note'] ?? '');

$errors = [];
if ($name === '' || mb_strlen($name) > 120) $errors[] = 'Please enter your full name.';
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'Please enter a valid email address.';
if (!valid_phone($phone)) $errors[] = 'Please enter a valid phone number.';
if (!valid_date($date)) $errors[] = 'Please choose a valid date.';
if (!preg_match('/^\d{2}:\d{2}$/', $time)) $errors[] = 'Please choose a time slot.';
if (!in_array($type, VISIT_TYPES, true)) $errors[] = 'Please select a visit type.';
if ($doctor < 1) $errors[] = 'Please choose a doctor.';
if (mb_strlen($note) > 500) $errors[] = 'Notes must be 500 characters or fewer.';
if ($errors) respond(['ok' => false, 'message' => implode(' ', $errors)], 422);

try {
    $pdo = db();
    if (!slot_is_available($pdo, $doctor, $date, $time)) {
        respond(['ok' => false, 'message' => 'That time slot is not available. Please pick another.'], 409);
    }

    $pdo->beginTransaction();

    // Store / update basic patient details
    $q = $pdo->prepare('INSERT INTO patients (full_name, email, phone) VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), phone = VALUES(phone), id = LAST_INSERT_ID(id)');
    $q->execute([$name, $email, $phone]);
    $patientId = (int)$pdo->lastInsertId();

    $q = $pdo->prepare('INSERT INTO appointments
        (patient_id, doctor_id, visit_type, appointment_date, appointment_time, patient_note)
        VALUES (?, ?, ?, ?, ?, ?)');
    $q->execute([$patientId, $doctor, $type, $date, $time . ':00', $note ?: null]);
    $id = (int)$pdo->lastInsertId();

    $ref = 'MB-' . str_pad((string)$id, 5, '0', STR_PAD_LEFT);
    $pdo->prepare('UPDATE appointments SET reference = ? WHERE id = ?')->execute([$ref, $id]);
    $pdo->commit();

    respond(['ok' => true, 'reference' => $ref,
             'message' => 'Request received! Status: Pending. The clinic will confirm it on the website.']);
} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    if (is_duplicate_key($e)) {
        respond(['ok' => false, 'message' => 'Sorry, that slot was just taken. Please pick another time.'], 409);
    }
    respond(['ok' => false, 'message' => 'Server error. Please try again later.'], 500);
} catch (Throwable $e) {
    respond(['ok' => false, 'message' => 'Server error. Please try again later.'], 500);
}
