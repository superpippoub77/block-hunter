<?php
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method not allowed']);
    exit;
}

$rootDir = realpath(__DIR__ . '/../../../');

if ($rootDir === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'invalid root directory']);
    exit;
}

$TYPE_CONFIG = [
    'background' => [
        'dir'  => $rootDir . '/assets/images/background',
        'exts' => ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'],
    ],
    'foreground' => [
        'dir'  => $rootDir . '/assets/images/foreground',
        'exts' => ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'],
    ],
    'music' => [
        'dir'  => $rootDir . '/assets/music',
        'exts' => ['mp3', 'ogg', 'wav', 'm4a', 'aac'],
    ],
];

$rawBody = file_get_contents('php://input');
$payload = json_decode($rawBody ?? '', true);

if (json_last_error() !== JSON_ERROR_NONE || !is_array($payload)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid json body']);
    exit;
}

$type          = isset($payload['type'])          ? trim((string) $payload['type'])          : '';
$fileName      = isset($payload['fileName'])      ? trim((string) $payload['fileName'])      : '';
$contentBase64 = isset($payload['contentBase64']) ? (string) $payload['contentBase64']       : '';

if (!isset($TYPE_CONFIG[$type])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid type; expected background, foreground or music']);
    exit;
}

// Validate file name: only safe characters, no path traversal
if (!preg_match('/^[a-zA-Z0-9_\-\.]+$/', $fileName) || strpos($fileName, '..') !== false) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid file name']);
    exit;
}

$cfg = $TYPE_CONFIG[$type];
$ext = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));

if (!in_array($ext, $cfg['exts'], true)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'file type not allowed']);
    exit;
}

$dir = $cfg['dir'];
if (!is_dir($dir)) {
    if (!@mkdir($dir, 0755, true)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'cannot create asset directory']);
        exit;
    }
}

$fileContent = base64_decode($contentBase64, true);
if ($fileContent === false) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid base64 content']);
    exit;
}

$filePath = $dir . '/' . $fileName;
if (file_put_contents($filePath, $fileContent) === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'unable to write file']);
    exit;
}

echo json_encode(['ok' => true, 'name' => $fileName]);
