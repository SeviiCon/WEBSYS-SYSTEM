<?php
// ---- Settings (XAMPP defaults: user "root", empty password) ----
const DB_HOST = 'localhost';
const DB_NAME = 'medibook_clinic';
const DB_USER = 'root';
const DB_PASS = '';

const SLOT_MINUTES = 30;     // length of one appointment slot
const MAX_DAYS_AHEAD = 60;   // how far ahead patients can book
const VISIT_TYPES = ['consultation', 'checkup', 'follow-up', 'medical-certificate'];

date_default_timezone_set('Asia/Manila');

function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER, DB_PASS,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
             PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
             PDO::ATTR_EMULATE_PREPARES => false]
        );
    }
    return $pdo;
}

function respond(array $data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data);
    exit;
}

function clean(?string $v): string {
    return trim(strip_tags($v ?? ''));
}

function require_post(): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(['ok' => false, 'message' => 'Invalid request.'], 405);
}

function valid_date(string $date): bool {
    $d = DateTime::createFromFormat('Y-m-d', $date);
    return $d && $d->format('Y-m-d') === $date;
}

function valid_phone(string $p): bool {
    return (bool)preg_match('/^\+?[0-9 ()-]{7,20}$/', $p);
}

function label_time(string $hhmm): string {
    return date('g:i A', strtotime($hhmm));
}

/**
 * Availability checker: every slot of a doctor's schedule on a date,
 * flagged available=false when already booked (pending/confirmed/completed) or already past.
 */
function get_slots(PDO $pdo, int $doctorId, string $date): array {
    if (!valid_date($date) || $date < date('Y-m-d')) return [];
    if ($date > date('Y-m-d', strtotime('+' . MAX_DAYS_AHEAD . ' days'))) return [];

    $weekday = (int)date('N', strtotime($date));

    $q = $pdo->prepare('SELECT s.start_time, s.end_time FROM doctor_schedules s
        JOIN doctors d ON d.id = s.doctor_id
        WHERE s.doctor_id = ? AND s.weekday = ? AND d.is_active = 1 ORDER BY s.start_time');
    $q->execute([$doctorId, $weekday]);
    $ranges = $q->fetchAll();
    if (!$ranges) return [];

    $q = $pdo->prepare("SELECT TIME_FORMAT(appointment_time, '%H:%i') AS t FROM appointments
        WHERE doctor_id = ? AND appointment_date = ? AND status <> 'cancelled'");
    $q->execute([$doctorId, $date]);
    $booked = array_column($q->fetchAll(), 't');

    $now = date('H:i');
    $isToday = ($date === date('Y-m-d'));
    $slots = [];
    foreach ($ranges as $r) {
        $t = strtotime($r['start_time']);
        $end = strtotime($r['end_time']);
        while ($t + SLOT_MINUTES * 60 <= $end) {
            $hhmm = date('H:i', $t);
            $free = !in_array($hhmm, $booked, true) && !($isToday && $hhmm <= $now);
            $slots[] = ['time' => $hhmm, 'label' => label_time($hhmm), 'available' => $free];
            $t += SLOT_MINUTES * 60;
        }
    }
    return $slots;
}

function slot_is_available(PDO $pdo, int $doctorId, string $date, string $time): bool {
    foreach (get_slots($pdo, $doctorId, $date) as $s) {
        if ($s['time'] === $time) return $s['available'];
    }
    return false;
}

function is_duplicate_key(PDOException $e): bool {
    return $e->getCode() === '23000' && isset($e->errorInfo[1]) && (int)$e->errorInfo[1] === 1062;
}

function appointment_row(PDO $pdo, string $reference): ?array {
    $q = $pdo->prepare("SELECT a.id, a.reference, a.visit_type, a.appointment_date,
            TIME_FORMAT(a.appointment_time, '%H:%i') AS appointment_time,
            a.patient_note, a.status, a.cancelled_by, a.doctor_id,
            d.name AS doctor_name, d.specialty, p.full_name, p.email, p.phone
        FROM appointments a
        JOIN doctors d ON d.id = a.doctor_id
        JOIN patients p ON p.id = a.patient_id
        WHERE a.reference = ?");
    $q->execute([$reference]);
    $r = $q->fetch();
    if ($r) $r['time_label'] = label_time($r['appointment_time']);
    return $r ?: null;
}

function admin_session(): void {
    if (session_status() === PHP_SESSION_NONE) {
        session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax']);
        session_start();
    }
}

function admin_required(): void {
    admin_session();
    if (empty($_SESSION['admin_id'])) respond(['ok' => false, 'message' => 'Please log in.'], 401);
    // Basic CSRF protection: the JS sends this custom header, cross-site forms cannot.
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'fetch') {
        respond(['ok' => false, 'message' => 'Invalid request.'], 403);
    }
}
