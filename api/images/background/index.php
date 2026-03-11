<?php
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method not allowed']);
    exit;
}

$rootDir = realpath(__DIR__ . '/../../../');
$imagesDir = $rootDir . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR . 'images' . DIRECTORY_SEPARATOR . 'background';

if ($rootDir === false || !is_dir($imagesDir)) {
    echo json_encode([]);
    exit;
}

$allowedExt = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
$list = [];

$entries = scandir($imagesDir);
if ($entries !== false) {
    foreach ($entries as $name) {
        if ($name === '.' || $name === '..') {
            continue;
        }

        $fullPath = $imagesDir . DIRECTORY_SEPARATOR . $name;
        if (!is_file($fullPath)) {
            continue;
        }

        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        if (!in_array($ext, $allowedExt, true)) {
            continue;
        }

        $list[] = 'assets/images/background/' . $name;
    }
}

sort($list, SORT_NATURAL | SORT_FLAG_CASE);
echo json_encode($list);
