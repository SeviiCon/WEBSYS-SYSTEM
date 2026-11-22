<?php
// Patient updates (reschedules) or cancels their own appointment.
require __DIR__ . '/config.php';
require_post();

$ref = strtoupper(clean($_POST['reference'] ?? ''));
$email = strtolower(clean($_POST['email'] ?? ''));
$action = clean($_POST['action'] ?? '');

try {
    $pdo = db();
    $a = appointment_row($pdo, $ref);
    if (!$a || strtolower($a['email']) !== $email) {
        respond(['ok' => false, 'message' => 'Appointment not found.'], 404);
    }
    if (!in_array($a['status'], ['pending', 'confirmed'], true)) {
        respond(['ok' => false, 'message' => 'This appointment is ' . $a['status'] . ' and can no longer be changed.'], 409);
    }

    if ($action === 'cancel') {
        $pdo->prepare("UPDATE appointments SET status = 'cancelled', cancelled_by = 'patient' WHERE id = ?")->execute([$a['id']]);
        respond(['ok' => true, 'message' => 'Your appointment has been cancelled.']);
    }

    if ($action === 'reschedule') {
        $date = clean($_POST['date'] ?? '');
        $time = clean($_POST['time'] ?? '');
        if (!valid_date($date) || !preg_match('/^\d{2}:\d{2}$/', $time)) {
            respond(['ok' => false, 'message' => 'Please choose a new date and time.'], 422);
        }
        if ($date === $a['appointment_date'] && $time === $a['appointment_time']) {
            respond(['ok' => false, 'message' => 'That is already your current appointment time.'], 422);
        }
        if (!slot_is_available($pdo, (int)$a['doctor_id'], $date, $time)) {
            respond(['ok' => false, 'message' => 'That time slot is not available.'], 409);
        }
        // A changed appointment goes back to "pending" so the clinic can confirm the new time.
        $pdo->prepare("UPDATE appointments SET appointment_date = ?, appointment_time = ?, status = 'pending' WHERE id = ?")
            ->execute([$date, $time . ':00', $a['id']]);
        respond(['ok' => true, 'message' => 'Appointment updated. Status is back to Pending until the clinic confirms the new time.']);
    }

    respond(['ok' => false, 'message' => 'Unknown action.'], 422);
} catch (PDOException $e) {
    if (is_duplicate_key($e)) respond(['ok' => false, 'message' => 'That slot was just taken. Please pick another.'], 409);
    respond(['ok' => false, 'message' => 'Server error. Please try again later.'], 500);
} catch (Throwable $e) {
    respond(['ok' => false, 'message' => 'Server error. Please try again later.'], 500);
}
