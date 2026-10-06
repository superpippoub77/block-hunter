<?php
header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$rootDir = realpath(__DIR__ . '/../../');

if ($rootDir === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'invalid root directory']);
    exit;
}

// Same types as server.js getMappingConfigForType()
$mappingTypes = [
    'entities' => ['file' => 'game-entities-mapping.json', 'itemRootKey' => 'entities'],
    'effects'  => ['file' => 'game-effects-mapping.json',  'itemRootKey' => 'effectProfiles'],
    'tiles'    => ['file' => 'game-tiles-mapping.json',    'itemRootKey' => 'tiles'],
];

$type = strtolower(trim($_GET['type'] ?? ''));
if (!isset($mappingTypes[$type])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid mapping type']);
    exit;
}

$cfg = $mappingTypes[$type];
$filePath = $rootDir . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . $cfg['file'];

// ── GET ──────────────────────────────────────────────────────────────────────
if ($method === 'GET') {
    $raw = @file_get_contents($filePath);
    if ($raw === false) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'unable to read file']);
        exit;
    }
    $parsed = json_decode($raw === '' ? '{}' : $raw);
    if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'invalid mapping json']);
        exit;
    }
    echo json_encode([
        'ok' => true,
        'type' => $type,
        'file' => 'data/' . $cfg['file'],
        'itemRootKey' => $cfg['itemRootKey'],
        'data' => $parsed,
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

// ── POST ─────────────────────────────────────────────────────────────────────
if ($method === 'POST') {
    $payload = json_decode(file_get_contents('php://input') ?: '', false);
    if (json_last_error() !== JSON_ERROR_NONE || !is_object($payload)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'invalid json']);
        exit;
    }
    $data = $payload->data ?? null;
    if (!is_object($data)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'mapping data must be an object']);
        exit;
    }

    $backupDir = $rootDir . DIRECTORY_SEPARATOR . 'bck';
    if (!is_dir($backupDir) && !@mkdir($backupDir, 0755, true)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'cannot create backup directory']);
        exit;
    }
    $backupFileName = 'mapping-' . $type . '-' . date('Ymd-His') . '.json';
    $current = @file_get_contents($filePath);
    if (@file_put_contents($backupDir . DIRECTORY_SEPARATOR . $backupFileName, $current === false ? '{}' : $current) === false) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'unable to write backup']);
        exit;
    }

    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    // 2-space indent, same format written by server.js
    if ($json !== false) {
        $json = preg_replace_callback('/^(?: {4})+/m', function ($m) {
            return str_repeat(' ', strlen($m[0]) / 2);
        }, $json);
    }
    if ($json === false || @file_put_contents($filePath, $json . "\n") === false) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'unable to write file']);
        exit;
    }

    echo json_encode(['ok' => true, 'backupFile' => 'bck/' . $backupFileName]);
    exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'error' => 'method not allowed']);
