<?php
// GET ?doctor_id=1&date=2026-11-20  ->  slots with available true/false
require __DIR__ . '/config.php';
$doctorId = (int)($_GET['doctor_id'] ?? 0);
$date = clean($_GET['date'] ?? '');
if ($doctorId < 1 || !valid_date($date)) respond(['ok' => false, 'message' => 'Choose a doctor and date.'], 422);
try {
    respond(['ok' => true, 'slots' => get_slots(db(), $doctorId, $date)]);
} catch (Throwable $e) {
    respond(['ok' => false, 'message' => 'Could not check availability.'], 500);
}
