<?php
header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

$rootDir = realpath(__DIR__ . '/../../');
$levelDir = $rootDir . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'level';

if ($rootDir === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'invalid root directory']);
    exit;
}

if ($method === 'GET') {
    if (!is_dir($levelDir)) {
        echo json_encode([]);
        exit;
    }

    $list = [];
    $entries = scandir($levelDir);

    if ($entries !== false) {
        foreach ($entries as $name) {
            if ($name === '.' || $name === '..') {
                continue;
            }

            $fullPath = $levelDir . DIRECTORY_SEPARATOR . $name;
            if (!is_file($fullPath)) {
                continue;
            }

            $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
            if ($ext !== 'json') {
                continue;
            }

            $list[] = 'data/level/' . $name;
        }
    }

    sort($list, SORT_NATURAL | SORT_FLAG_CASE);
    echo json_encode($list);
    exit;
}

if ($method === 'POST') {
    $rawBody = file_get_contents('php://input');
    $payload = json_decode($rawBody ?? '', true);
    if (json_last_error() !== JSON_ERROR_NONE || !is_array($payload)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'invalid json']);
        exit;
    }

    $fileName = trim((string)($payload['fileName'] ?? ''));
    $level = $payload['level'] ?? null;
    if ($fileName === '' || strpos($fileName, '..') !== false || !preg_match('/^[A-Za-z0-9._-]+\.json$/', $fileName)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'invalid fileName']);
        exit;
    }
    if (!is_array($level) || array_keys($level) === range(0, count($level) - 1)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'level must be an object']);
        exit;
    }

    if (!is_dir($levelDir) && !@mkdir($levelDir, 0775, true)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'unable to create level directory']);
        exit;
    }

    $targetFile = $levelDir . DIRECTORY_SEPARATOR . $fileName;
    $encoded = json_encode($level, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($encoded === false) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'unable to encode level json']);
        exit;
    }

    if (@file_put_contents($targetFile, $encoded . PHP_EOL) === false) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'unable to write level file']);
        exit;
    }

    echo json_encode(['ok' => true, 'file' => 'data/level/' . $fileName]);
    exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'error' => 'method not allowed']);
