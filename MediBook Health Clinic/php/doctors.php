<?php
// Clinic information: doctors, their schedules, and clinic operating hours.
require __DIR__ . '/config.php';
try {
    $pdo = db();
    $doctors = $pdo->query('SELECT id, name, specialty FROM doctors WHERE is_active = 1 ORDER BY name')->fetchAll();
    $sched = $pdo->query("SELECT doctor_id, weekday, TIME_FORMAT(start_time,'%H:%i') AS s, TIME_FORMAT(end_time,'%H:%i') AS e
        FROM doctor_schedules ORDER BY weekday, start_time")->fetchAll();
    $byDoc = [];
    foreach ($sched as $r) {
        $byDoc[$r['doctor_id']][] = ['weekday' => (int)$r['weekday'], 'start' => label_time($r['s']), 'end' => label_time($r['e'])];
    }
    foreach ($doctors as &$d) $d['schedule'] = $byDoc[$d['id']] ?? [];
    unset($d);

    $hours = $pdo->query("SELECT weekday, is_open, TIME_FORMAT(open_time,'%H:%i') AS o, TIME_FORMAT(close_time,'%H:%i') AS c
        FROM clinic_hours ORDER BY weekday")->fetchAll();
    foreach ($hours as &$h) {
        $h['weekday'] = (int)$h['weekday'];
        $h['is_open'] = (bool)$h['is_open'];
        $h['open'] = $h['o'] ? label_time($h['o']) : null;
        $h['close'] = $h['c'] ? label_time($h['c']) : null;
        unset($h['o'], $h['c']);
    }
    unset($h);

    respond(['ok' => true, 'doctors' => $doctors, 'hours' => $hours]);
} catch (Throwable $e) {
    respond(['ok' => false, 'message' => 'Could not load clinic information.'], 500);
}
