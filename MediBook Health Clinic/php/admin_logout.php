<?php
require __DIR__ . '/config.php';
admin_session();
$_SESSION = [];
session_destroy();
respond(['ok' => true]);
