<?php
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method not allowed']);
    exit;
}

$rootDir = realpath(__DIR__ . '/../../');
$musicDir = $rootDir . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'music';

if ($rootDir === false || !is_dir($musicDir)) {
    echo json_encode([]);
    exit;
}

$allowedExt = ['mp3', 'ogg', 'wav', 'm4a', 'aac'];
$list = [];

$entries = scandir($musicDir);
if ($entries !== false) {
    foreach ($entries as $name) {
        if ($name === '.' || $name === '..') {
            continue;
        }

        $fullPath = $musicDir . DIRECTORY_SEPARATOR . $name;
        if (!is_file($fullPath)) {
            continue;
        }

        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        if (!in_array($ext, $allowedExt, true)) {
            continue;
        }

        $list[] = 'data/music/' . $name;
    }
}

sort($list, SORT_NATURAL | SORT_FLAG_CASE);
echo json_encode($list);
