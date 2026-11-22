<?php
// Admin: list appointments (GET) and view/confirm/update/cancel them (POST).
require __DIR__ . '/config.php';
admin_required();

try {
    $pdo = db();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $where = [];
        $args = [];
        $status = clean($_GET['status'] ?? '');
        if (in_array($status, ['pending', 'confirmed', 'completed', 'cancelled'], true)) {
            $where[] = 'a.status = ?'; $args[] = $status;
        }
        $date = clean($_GET['date'] ?? '');
        if (valid_date($date)) { $where[] = 'a.appointment_date = ?'; $args[] = $date; }
        $search = clean($_GET['search'] ?? '');
        if ($search !== '') {
            $where[] = '(p.full_name LIKE ? OR p.email LIKE ? OR a.reference LIKE ?)';
            $like = '%' . $search . '%';
            array_push($args, $like, $like, $like);
        }
        $sql = "SELECT a.id, a.reference, a.visit_type, a.appointment_date,
                    TIME_FORMAT(a.appointment_time, '%H:%i') AS appointment_time,
                    a.patient_note, a.status, a.cancelled_by, a.doctor_id,
                    d.name AS doctor_name, p.full_name, p.email, p.phone
                FROM appointments a
                JOIN doctors d ON d.id = a.doctor_id
                JOIN patients p ON p.id = a.patient_id"
            . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
            . ' ORDER BY a.appointment_date DESC, a.appointment_time DESC LIMIT 300';
        $q = $pdo->prepare($sql);
        $q->execute($args);
        $rows = $q->fetchAll();
        foreach ($rows as &$r) $r['time_label'] = label_time($r['appointment_time']);
        unset($r);

        $counts = ['pending' => 0, 'confirmed' => 0, 'completed' => 0, 'cancelled' => 0];
        foreach ($pdo->query('SELECT status, COUNT(*) c FROM appointments GROUP BY status')->fetchAll() as $c) {
            $counts[$c['status']] = (int)$c['c'];
        }
        $today = (int)$pdo->query("SELECT COUNT(*) FROM appointments WHERE appointment_date = CURDATE() AND status <> 'cancelled'")->fetchColumn();

        respond(['ok' => true, 'appointments' => $rows, 'counts' => $counts, 'today' => $today]);
    }


    // ---- POST actions ----
    $action = clean($_POST['action'] ?? '');

    // Clear all appointments
    if ($action === 'clear_all') {
        try {
            $pdo->beginTransaction();

            $deleted = $pdo->exec('DELETE FROM appointments');

            $pdo->commit();

            respond([
                'ok' => true,
                'message' => $deleted . ' appointment records deleted.'
            ]);
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            respond([
                'ok' => false,
                'message' => 'Could not clear appointments.'
            ], 500);
        }
    }

    // Existing individual appointment actions
    $id = (int)($_POST['id'] ?? 0);
    $q = $pdo->prepare('SELECT id, doctor_id, status, appointment_date, TIME_FORMAT(appointment_time, "%H:%i") AS t FROM appointments WHERE id = ?');

    $q->execute([$id]);
    $a = $q->fetch();
    if (!$a) respond(['ok' => false, 'message' => 'Appointment not found.'], 404);

    if (in_array($a['status'], ['completed', 'cancelled'], true)) {
        respond(['ok' => false, 'message' => 'This appointment is ' . $a['status'] . ' and cannot be changed.'], 409);
    }

    if ($action === 'confirm') {
        if ($a['status'] !== 'pending') respond(['ok' => false, 'message' => 'Only pending appointments can be confirmed.'], 409);
        $pdo->prepare("UPDATE appointments SET status = 'confirmed' WHERE id = ?")->execute([$id]);
        respond(['ok' => true, 'message' => 'Appointment confirmed.']);
    }
    if ($action === 'complete') {
        if ($a['status'] !== 'confirmed') respond(['ok' => false, 'message' => 'Confirm the appointment before completing it.'], 409);
        $pdo->prepare("UPDATE appointments SET status = 'completed' WHERE id = ?")->execute([$id]);
        respond(['ok' => true, 'message' => 'Appointment marked as completed.']);
    }
    if ($action === 'cancel') {
        $pdo->prepare("UPDATE appointments SET status = 'cancelled', cancelled_by = 'clinic' WHERE id = ?")->execute([$id]);
        respond(['ok' => true, 'message' => 'Appointment cancelled.']);
    }
    if ($action === 'reschedule') {
        $date = clean($_POST['date'] ?? '');
        $time = clean($_POST['time'] ?? '');
        if (!valid_date($date) || !preg_match('/^\d{2}:\d{2}$/', $time)) {
            respond(['ok' => false, 'message' => 'Choose a new date and time.'], 422);
        }
        if (!slot_is_available($pdo, (int)$a['doctor_id'], $date, $time)) {
            respond(['ok' => false, 'message' => 'That slot is not available.'], 409);
        }
        $pdo->prepare('UPDATE appointments SET appointment_date = ?, appointment_time = ? WHERE id = ?')
            ->execute([$date, $time . ':00', $id]);
        respond(['ok' => true, 'message' => 'Appointment updated.']);
    }
    respond(['ok' => false, 'message' => 'Unknown action.'], 422);
} catch (PDOException $e) {
    if (is_duplicate_key($e)) respond(['ok' => false, 'message' => 'That slot was just taken.'], 409);
    respond(['ok' => false, 'message' => 'Server error.'], 500);
} catch (Throwable $e) {
    respond(['ok' => false, 'message' => 'Server error.'], 500);
}
