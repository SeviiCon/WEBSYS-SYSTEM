<?php
require __DIR__ . '/config.php';
require_post();
admin_session();

$u = clean($_POST['username'] ?? '');
$p = $_POST['password'] ?? '';
try {
    $q = db()->prepare('SELECT id, password_hash FROM admins WHERE username = ?');
    $q->execute([$u]);
    $row = $q->fetch();
    if (!$row || !password_verify($p, $row['password_hash'])) {
        respond(['ok' => false, 'message' => 'Incorrect username or password.'], 401);
    }
    session_regenerate_id(true);
    $_SESSION['admin_id'] = (int)$row['id'];
    respond(['ok' => true]);
} catch (Throwable $e) {
    respond(['ok' => false, 'message' => 'Server error.'], 500);
}
